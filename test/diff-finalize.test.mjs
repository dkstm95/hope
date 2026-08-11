import assert from "node:assert/strict";
import {
  access,
  link,
  lstat,
  mkdir,
  readFile,
  realpath,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import { finalizeReview } from "../plugins/hope/skills/diff/scripts/finalize.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

test("review finalization never replaces an existing output", async () => {
  const root = await createTestTemporaryDirectory("hope-finalize-test-");
  const outputPath = join(root, "review.html");
  await writeFile(outputPath, "keep me", "utf8");
  await assert.rejects(
    finalizeReview(Buffer.from("new"), {
      artifactDigest: "a".repeat(64),
      outputPath,
      revalidatedAt: "2026-07-23T00:00:00.000Z",
      runId: "1".repeat(32),
      snapshotDigest: "b".repeat(64),
    }),
    (error) => {
      assert.match(error.message, /did not replace/u);
      assert.match(error.message, /Choose a new destination with --output <new-path>/u);
      return true;
    },
  );
  assert.equal(await readFile(outputPath, "utf8"), "keep me");
});

test("review finalization does not follow an output symlink", async () => {
  const root = await createTestTemporaryDirectory("hope-finalize-link-");
  const target = join(root, "target.html");
  const outputPath = join(root, "review.html");
  await writeFile(target, "keep target", "utf8");
  await symlink(target, outputPath);
  await assert.rejects(
    finalizeReview(Buffer.from("new"), {
      artifactDigest: "a".repeat(64),
      outputPath,
      revalidatedAt: "2026-07-23T00:00:00.000Z",
      runId: "1".repeat(32),
      snapshotDigest: "b".repeat(64),
    }),
    (error) => {
      assert.match(error.message, /did not replace/u);
      assert.match(error.message, /Choose a new destination with --output <new-path>/u);
      return true;
    },
  );
  assert.equal(await readFile(target, "utf8"), "keep target");
});

test("review finalization resolves a symlinked ancestor before publication", async () => {
  const root = await createTestTemporaryDirectory("hope-finalize-parent-");
  const realDirectory = join(root, "real");
  const alias = join(root, "alias");
  await mkdir(realDirectory);
  await symlink(realDirectory, alias, "dir");
  const result = await finalizeReview(Buffer.from("review"), {
    artifactDigest: "a".repeat(64),
    outputPath: join(alias, "review.html"),
    revalidatedAt: "2026-07-23T00:00:00.000Z",
    runId: "1".repeat(32),
    snapshotDigest: "b".repeat(64),
  });
  assert.equal(result.outputPath, join(await realpath(realDirectory), "review.html"));
  assert.equal(await readFile(result.outputPath, "utf8"), "review");
  const info = await lstat(result.outputPath);
  if (process.platform !== "win32") assert.equal(info.mode & 0o077, 0);
});

test("review finalization has no cross-filesystem copy fallback", async () => {
  const root = await createTestTemporaryDirectory("hope-finalize-cross-");
  const outputPath = join(root, "review.html");
  const crossFilesystem = Object.assign(
    new Error("cross-filesystem link"),
    { code: "EXDEV" },
  );
  await assert.rejects(
    finalizeReview(Buffer.from("review"), {
      artifactDigest: "a".repeat(64),
      linkFile: async () => {
        throw crossFilesystem;
      },
      outputPath,
      revalidatedAt: "2026-07-23T00:00:00.000Z",
      runId: "1".repeat(32),
      snapshotDigest: "b".repeat(64),
    }),
    /cannot publish.*without an overwrite race/u,
  );
  await assert.rejects(access(outputPath), /ENOENT/u);
});

test("a publication race explains how to choose a new output", async () => {
  const root = await createTestTemporaryDirectory("hope-finalize-existing-race-");
  const outputPath = join(root, "review.html");
  await assert.rejects(
    finalizeReview(Buffer.from("review"), {
      artifactDigest: "a".repeat(64),
      linkFile: async () => {
        throw Object.assign(new Error("target appeared"), { code: "EEXIST" });
      },
      outputPath,
      revalidatedAt: "2026-07-23T00:00:00.000Z",
      runId: "1".repeat(32),
      snapshotDigest: "b".repeat(64),
    }),
    /Choose a new destination with --output <new-path>/u,
  );
  await assert.rejects(access(outputPath), /ENOENT/u);
});

test("review finalization rejects a replaced publication identity", async () => {
  const root = await createTestTemporaryDirectory("hope-finalize-race-");
  const outputPath = join(root, "review.html");
  await assert.rejects(
    finalizeReview(Buffer.from("review"), {
      artifactDigest: "a".repeat(64),
      linkFile: async (source, target) => {
        await link(source, target);
        await unlink(target);
        await writeFile(target, "replacement", { mode: 0o600 });
      },
      outputPath,
      revalidatedAt: "2026-07-23T00:00:00.000Z",
      runId: "1".repeat(32),
      snapshotDigest: "b".repeat(64),
    }),
    /artifact changed during publication/u,
  );
  assert.equal(await readFile(outputPath, "utf8"), "replacement");
  const info = await lstat(outputPath);
  assert.equal(info.nlink, 1);
});
