import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, open, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  discoverSweepInventory,
  readSweepWorktreeEntry,
  verifySweepInventoryRepository,
} from "../features/sweep/discovery.mjs";

const execFile = promisify(execFileCallback);

async function git(root, ...args) {
  await execFile("git", ["-C", root, ...args], { encoding: "utf8" });
}

test("sweep discovery binds the inventory to the current Git worktree", async () => {
  const inventory = await discoverSweepInventory({
    root: process.cwd(),
    sessionId: "discovery-test-session",
  });
  assert.equal(inventory.discovery.protocol, "git-worktree-v1");
  assert.ok(inventory.discovery.revision.length >= 40);
  assert.ok(inventory.files.length > 0);
  assert.equal(inventory.summary.totalFiles, inventory.files.length);
  assert.match(inventory.discovery.manifestDigest, /^sha256:[a-f0-9]{64}$/u);
  await verifySweepInventoryRepository(inventory, { root: process.cwd() });
});

test("sweep discovery records symlink metadata without reading its target", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-sweep-discovery-"));
  const repository = join(temporary, "repo");
  const outside = join(temporary, "outside-secret.txt");
  try {
    await mkdir(repository);
    await writeFile(outside, "secret-v1\n");
    await symlink("../outside-secret.txt", join(repository, "external-link"));
    await git(repository, "init", "-q");
    await git(repository, "config", "user.email", "hope-test@example.com");
    await git(repository, "config", "user.name", "Hope Test");
    await git(repository, "add", "external-link");
    await git(repository, "commit", "-qm", "add symlink");

    const inventory = await discoverSweepInventory({
      root: repository,
      sessionId: "symlink-discovery-test-session",
    });
    const entry = inventory.files.find((file) => file.path === "external-link");
    assert.equal(entry?.entryType, "symbolic-link");

    await rm(outside);
    await verifySweepInventoryRepository(inventory, { root: repository });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("sweep discovery rejects a symbolic link in an ancestor directory", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-sweep-ancestor-link-"));
  const repository = join(temporary, "repo");
  const outside = join(temporary, "outside");
  try {
    await mkdir(repository);
    await mkdir(join(repository, "nested"));
    await mkdir(outside);
    await writeFile(join(repository, "nested", "tracked.txt"), "inside\n");
    await writeFile(join(outside, "tracked.txt"), "outside secret\n");
    await git(repository, "init", "-q");
    await git(repository, "config", "user.email", "hope-test@example.com");
    await git(repository, "config", "user.name", "Hope Test");
    await git(repository, "add", "nested/tracked.txt");
    await git(repository, "commit", "-qm", "add nested file");
    await rm(join(repository, "nested"), { recursive: true });
    await symlink("../outside", join(repository, "nested"));

    await assert.rejects(
      discoverSweepInventory({
        root: repository,
        sessionId: "ancestor-link-discovery-test-session",
      }),
      /non-directory ancestor/u,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("sweep discovery refuses a final entry replaced before open", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-sweep-entry-race-"));
  const repository = join(temporary, "repo");
  const target = join(repository, "tracked.txt");
  const outside = join(temporary, "outside-secret.txt");
  try {
    await mkdir(repository);
    await writeFile(target, "inside\n");
    await writeFile(outside, "outside secret\n");

    await assert.rejects(
      readSweepWorktreeEntry(repository, "tracked.txt", {
        openEntry: async (...args) => {
          await rm(target);
          await symlink("../outside-secret.txt", target);
          return open(...args);
        },
      }),
      /ELOOP|symbolic link|too many levels/u,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
