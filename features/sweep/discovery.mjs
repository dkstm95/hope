import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
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

function sameEntry(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode;
}

async function captureAncestorDirectories(root, relativePath, stat) {
  const parts = relativePath.split("/");
  const ancestors = [];
  for (let index = 1; index < parts.length; index += 1) {
    const path = resolve(root, ...parts.slice(0, index));
    const info = await stat(path, { bigint: true });
    if (!info.isDirectory()) {
      throw new TypeError(
        `Git returned a project path with a non-directory ancestor: ${relativePath}`,
      );
    }
    ancestors.push({ info, path });
  }
  return ancestors;
}

async function verifyAncestorDirectories(ancestors, stat, relativePath) {
  for (const ancestor of ancestors) {
    const current = await stat(ancestor.path, { bigint: true });
    if (!current.isDirectory() || !sameEntry(current, ancestor.info)) {
      throw new TypeError(
        `Project path changed during Sweep discovery: ${relativePath}`,
      );
    }
  }
}

export async function readSweepWorktreeEntry(root, relativePath, {
  lstatEntry = lstat,
  noFollowFlag = constants.O_NOFOLLOW,
  openEntry = open,
  readLink = readlink,
} = {}) {
  const absolutePath = resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${sep}`)) {
    throw new TypeError(`Git returned a path outside the repository: ${relativePath}`);
  }
  const ancestors = await captureAncestorDirectories(
    root,
    relativePath,
    lstatEntry,
  );
  const info = await lstatEntry(absolutePath, { bigint: true });
  if (info.isDirectory()) {
    throw new TypeError(`Git returned a directory as a project entry: ${relativePath}`);
  }
  if (info.isSymbolicLink()) {
    const linkTarget = await readLink(absolutePath, { encoding: "buffer" });
    const current = await lstatEntry(absolutePath, { bigint: true });
    if (!current.isSymbolicLink() || !sameEntry(current, info)) {
      throw new TypeError(
        `Project entry changed during Sweep discovery: ${relativePath}`,
      );
    }
    await verifyAncestorDirectories(ancestors, lstatEntry, relativePath);
    return {
      entryType: "symbolic-link",
      digest: digestBytes(linkTarget),
      size: linkTarget.length,
    };
  }
  if (!info.isFile()) {
    throw new TypeError(`Git returned a non-file project entry: ${relativePath}`);
  }
  const handle = await openEntry(
    absolutePath,
    constants.O_RDONLY | (noFollowFlag ?? 0),
  );
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameEntry(opened, info)) {
      throw new TypeError(
        `Project entry changed before Sweep could read it: ${relativePath}`,
      );
    }
    await verifyAncestorDirectories(ancestors, lstatEntry, relativePath);
    const bytes = await handle.readFile();
    const current = await lstatEntry(absolutePath, { bigint: true });
    if (!current.isFile() || !sameEntry(current, opened)) {
      throw new TypeError(
        `Project entry changed during Sweep discovery: ${relativePath}`,
      );
    }
    await verifyAncestorDirectories(ancestors, lstatEntry, relativePath);
    return {
      entryType: "file",
      digest: digestBytes(bytes),
      size: bytes.length,
    };
  } finally {
    await handle.close();
  }
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
    const file = await readSweepWorktreeEntry(repository, path);
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
