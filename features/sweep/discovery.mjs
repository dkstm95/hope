import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { resolve, sep } from "node:path";

import {
  SWEEP_INVENTORY_DISCOVERY_PROTOCOL,
  SWEEP_LIMITS,
} from "./constants.mjs";
import {
  createSweepInventory,
  sweepInventoryManifestDigest,
} from "./inventory.mjs";

const execFile = promisify(execFileCallback);

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseNulList(value) {
  return value.split("\0").filter((item) => item.length > 0);
}

function normalizePath(value) {
  const path = value.replaceAll("\\", "/").replace(/\/+$/u, "");
  if (
    path.length === 0
    || path.startsWith("/")
    || path.split("/").includes("..")
    || path.split("/").includes("")
  ) {
    throw new TypeError(`Git returned an unsafe project path: ${value}`);
  }
  return path;
}

function exclusionKind(path) {
  const parts = path.toLowerCase().split("/");
  if (parts.includes("node_modules") || parts.includes("vendor")) {
    return "ignored-dependency";
  }
  if (
    parts.some((part) => part === ".cache" || part === "cache" || part === "tmp")
  ) {
    return "ignored-cache";
  }
  if (
    parts.some((part) =>
      ["build", "dist", "coverage", ".next", ".turbo"].includes(part)
    )
  ) {
    return "ignored-build";
  }
  return "other";
}

async function git(root, args) {
  const result = await execFile("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.stdout;
}

async function readWorktreeFile(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${sep}`)) {
    throw new TypeError(`Git returned a path outside the repository: ${relativePath}`);
  }
  const info = await lstat(absolutePath);
  if (info.isDirectory()) {
    throw new TypeError(`Git returned a directory as a project file: ${relativePath}`);
  }
  const bytes = await readFile(absolutePath);
  return {
    digest: digestBytes(bytes),
    size: bytes.length,
  };
}

function parseIgnoredStatus(value) {
  return parseNulList(value)
    .filter((entry) => entry.startsWith("!! "))
    .map((entry) => normalizePath(entry.slice(3)));
}

export async function discoverSweepInventory({
  root,
  title = "Whole project inventory",
  sessionId,
  scope = "Every project-owned worktree file",
  batchSize = SWEEP_LIMITS.inventoryBatchFiles,
  capturedAt = new Date().toISOString(),
} = {}) {
  if (typeof root !== "string" || root.trim().length === 0) {
    throw new TypeError("Sweep discovery requires a repository root");
  }
  const repository = await realpath(root);
  const gitRoot = (await git(repository, ["rev-parse", "--show-toplevel"])).trim();
  const normalizedRoot = await realpath(gitRoot);
  if (normalizedRoot !== repository) {
    throw new TypeError("Sweep discovery root must be the Git repository root");
  }
  const revision = (await git(repository, ["rev-parse", "HEAD"])).trim();
  const tracked = new Set(
    parseNulList(await git(repository, ["ls-files", "--cached", "-z"]))
      .map(normalizePath),
  );
  const relevant = new Set(
    parseNulList(await git(repository, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]))
      .map(normalizePath),
  );
  const files = [];
  for (const path of [...relevant].sort()) {
    const file = await readWorktreeFile(repository, path);
    files.push({
      id: `file-${files.length + 1}`,
      path,
      kind: tracked.has(path) ? "tracked" : "untracked",
      ...file,
    });
  }
  const filePaths = new Set(files.map((file) => file.path));
  const exclusions = parseIgnoredStatus(
    await git(repository, ["status", "--short", "--ignored", "-z"]),
  )
    .filter((path) => !filePaths.has(path))
    .map((path) => ({
      path,
      kind: exclusionKind(path),
      reason: "Git marks this cache, dependency, build output, or other path as ignored.",
    }));
  const manifestDigest = sweepInventoryManifestDigest(files, exclusions);
  const discovery = {
    protocol: SWEEP_INVENTORY_DISCOVERY_PROTOCOL,
    repository,
    revision,
    manifestDigest,
    verifiedAt: capturedAt,
  };
  return createSweepInventory({
    title,
    sessionId,
    scope,
    snapshot: {
      capturedAt,
      sources: [{
        id: "repository",
        kind: "git",
        label: "Git worktree",
        locator: `git:${repository}`,
        revision,
      }],
    },
    discovery,
    files,
    exclusions,
    batchSize,
  });
}

export async function verifySweepInventoryRepository(value, { root } = {}) {
  const inventory = value;
  const discovered = await discoverSweepInventory({
    root: root ?? inventory.discovery?.repository,
    title: inventory.title,
    sessionId: inventory.sessionId,
    scope: inventory.scope,
    batchSize: inventory.batchSize,
    capturedAt: inventory.discovery?.verifiedAt,
  });
  if (discovered.discovery.revision !== inventory.discovery.revision) {
    throw new TypeError("Sweep inventory Git revision changed after discovery");
  }
  if (discovered.discovery.repository !== inventory.discovery.repository) {
    throw new TypeError("Sweep inventory repository changed after discovery");
  }
  if (discovered.discovery.manifestDigest !== inventory.discovery.manifestDigest) {
    throw new TypeError("Sweep inventory manifest changed after discovery");
  }
  return inventory;
}
