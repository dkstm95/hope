// Generated from features/sweep/inventory.mjs. Do not edit.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, readlink } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

import { validateWorkSnapshot } from "../work-snapshot/index.mjs";
import {
  SWEEP_LIMITS,
  SWEEP_INVENTORY_VERSION,
} from "./constants.mjs";

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const pathDigest = (value) => `sha256:${createHash("sha256")
  .update(value)
  .digest("hex")}`;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new TypeError(`${label} has an unknown field: ${key}`);
  }
}

function runGit(arguments_, cwd, { binary = false } = {}) {
  const result = spawnSync("git", arguments_, {
    cwd,
    encoding: binary ? "buffer" : "utf8",
    maxBuffer: SWEEP_LIMITS.inventoryBytes,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : result.stderr;
    const detail = stderr?.trim();
    throw new Error(
      detail ? `Sweep inventory Git command failed: ${detail}` : "Sweep inventory Git command failed",
    );
  }
  return result.stdout;
}

function repositoryRoot(cwd) {
  const output = runGit(["rev-parse", "--show-toplevel"], cwd);
  const root = resolve(String(output).trim());
  if (!root) throw new Error("Sweep inventory could not resolve the repository root");
  return root;
}

function repositoryRevision(root) {
  const result = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  const revision = result.status === 0 ? result.stdout.trim() : "";
  return revision || undefined;
}

function relativeRepositoryPath(root, path) {
  const normalized = path.replaceAll(sep, "/");
  const absolute = resolve(root, normalized);
  const relativePath = relative(root, absolute).replaceAll(sep, "/");
  if (
    !relativePath
    || relativePath.startsWith("../")
    || relativePath === ".."
    || relativePath.startsWith("/")
    || relativePath !== normalized
  ) {
    throw new Error(`Sweep inventory received an invalid repository path: ${path}`);
  }
  return relativePath;
}

async function fileDigest(path, relativePath) {
  const before = await lstat(path);
  if (before.isSymbolicLink()) {
    return pathDigest(`symlink:${await readlink(path)}`);
  }
  if (!before.isFile()) {
    throw new Error(`Sweep inventory cannot inspect non-file path: ${relativePath}`);
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const after = await lstat(path);
  if (
    !after.isFile()
    || before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs
    || before.ctimeMs !== after.ctimeMs
  ) {
    throw new Error(`Sweep inventory file changed while being read: ${relativePath}`);
  }
  return `sha256:${hash.digest("hex")}`;
}

function inventoryPayload(snapshot) {
  return {
    version: SWEEP_INVENTORY_VERSION,
    sources: snapshot.sources.map((source) => ({
      digest: source.digest,
      id: source.id,
      kind: source.kind,
      locator: source.locator,
      revision: source.revision,
    })),
  };
}

export function sweepInventoryDigest(snapshot) {
  const normalized = validateWorkSnapshot(snapshot, {
    maximumSources: SWEEP_LIMITS.sources,
  });
  return pathDigest(JSON.stringify(inventoryPayload(normalized)));
}

export function validateSweepInventory(value) {
  exactKeys(
    value,
    new Set(["feature", "version", "snapshot", "fileSourceIds", "digest"]),
    "Sweep inventory",
  );
  if (value.feature !== "sweep-inventory") {
    throw new TypeError("Sweep inventory feature must be sweep-inventory");
  }
  if (value.version !== SWEEP_INVENTORY_VERSION) {
    throw new TypeError(`Sweep inventory version must be ${SWEEP_INVENTORY_VERSION}`);
  }
  const snapshot = validateWorkSnapshot(value.snapshot, {
    maximumSources: SWEEP_LIMITS.sources,
  });
  const repositorySources = snapshot.sources.filter((source) => source.kind === "git");
  if (repositorySources.length !== 1) {
    throw new TypeError("Sweep inventory must contain exactly one repository source");
  }
  if (snapshot.sources.some((source) => !["git", "file"].includes(source.kind))) {
    throw new TypeError("Sweep inventory may contain only a repository source and file sources");
  }
  const expectedFileSourceIds = snapshot.sources
    .filter((source) => source.kind === "file")
    .map((source) => source.id);
  if (
    !Array.isArray(value.fileSourceIds)
    || value.fileSourceIds.length !== expectedFileSourceIds.length
    || value.fileSourceIds.some((id, index) => id !== expectedFileSourceIds[index])
  ) {
    throw new TypeError("Sweep inventory fileSourceIds must list every file source in snapshot order");
  }
  if (typeof value.digest !== "string" || !digestPattern.test(value.digest)) {
    throw new TypeError("Sweep inventory digest must use the sha256: format");
  }
  const expectedDigest = sweepInventoryDigest(snapshot);
  if (value.digest !== expectedDigest) {
    throw new TypeError("Sweep inventory digest does not match its snapshot");
  }
  return deepFreeze({
    feature: value.feature,
    version: value.version,
    snapshot,
    fileSourceIds: [...value.fileSourceIds],
    digest: value.digest,
  });
}

export async function createSweepInventory({
  cwd = process.cwd(),
  capturedAt = new Date().toISOString(),
} = {}) {
  const root = repositoryRoot(resolve(cwd));
  const output = runGit(
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    root,
    { binary: true },
  );
  const paths = [...new Set(output.toString("utf8").split("\0").filter(Boolean))]
    .map((path) => relativeRepositoryPath(root, path))
    .toSorted();
  if (paths.length === 0) {
    throw new Error("Sweep inventory found no tracked or unignored repository files");
  }
  if (paths.length + 1 > SWEEP_LIMITS.sources) {
    throw new Error(
      `Sweep inventory contains ${paths.length} files, above the runtime limit of ${SWEEP_LIMITS.sources}; it will not be truncated`,
    );
  }
  const revision = repositoryRevision(root);
  const repositorySource = {
    id: "repository",
    kind: "git",
    label: "Repository worktree",
    locator: "git:worktree",
    ...(revision
      ? { revision }
      : { digest: pathDigest(paths.join("\0")) }),
  };
  const fileSources = [];
  for (const path of paths) {
    fileSources.push({
      id: `file-${pathDigest(path).slice(7, 31)}`,
      kind: "file",
      label: `Repository file: ${path}`,
      locator: path,
      digest: await fileDigest(resolve(root, path), path),
    });
  }
  const snapshot = validateWorkSnapshot({
    capturedAt,
    sources: [repositorySource, ...fileSources],
  }, {
    maximumSources: SWEEP_LIMITS.sources,
  });
  return validateSweepInventory({
    feature: "sweep-inventory",
    version: SWEEP_INVENTORY_VERSION,
    snapshot,
    fileSourceIds: fileSources.map((source) => source.id),
    digest: sweepInventoryDigest(snapshot),
  });
}
