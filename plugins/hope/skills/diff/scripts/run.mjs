import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, open, readdir, realpath, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { LIMITS, RUN_VERSION } from "./constants.mjs";
import { readBoundedJson } from "./structured-input.mjs";

const RUN_OWNER = "hope-diff-run";
const RUN_TTL_MS = 24 * 60 * 60 * 1000;
const MANIFEST_BYTES = 256 * 1024;
const privateMode = (info) => process.platform === "win32" || (info.mode & 0o077) === 0;

function sameDirectoryIdentity(value, expected) {
  return value.isDirectory()
    && !value.isSymbolicLink()
    && value.dev === expected.dev
    && value.ino === expected.ino
    && value.mode === expected.mode;
}

function replacedRunError(preservedPath) {
  const error = new Error(`Hope preserved a replaced run directory at ${preservedPath}`);
  error.code = "HOPE_DIFF_RUN_REPLACED";
  error.preservedPath = preservedPath;
  return error;
}

/** Remove only the directory Hope created: check identity, claim by rename, check again. */
export async function removeOwnedRunDirectory(path, expected, {
  removeDirectory = rm,
  renameDirectory = rename,
} = {}) {
  if (!sameDirectoryIdentity(await lstat(path), expected)) throw replacedRunError(path);
  const claimedPath = join(dirname(path), `.remove-${basename(path)}-${randomBytes(16).toString("hex")}`);
  await renameDirectory(path, claimedPath);
  if (!sameDirectoryIdentity(await lstat(claimedPath), expected)) throw replacedRunError(claimedPath);
  await removeDirectory(claimedPath, { recursive: true });
}

export async function privateRunRoot({ temporaryRoot = tmpdir() } = {}) {
  const userSuffix = typeof process.getuid === "function" ? `-${process.getuid()}` : "";
  const root = join(await realpath(temporaryRoot), `hope-diff-runs${userSuffix}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Hope diff run storage is not a regular directory");
  }
  if (process.platform !== "win32") await chmod(root, 0o700);
  return root;
}

/** Write a new private file; never follow or replace an existing path. */
export async function writeRunFile(runPath, name, value) {
  const handle = await open(join(runPath, name), "wx", 0o600);
  try {
    await handle.writeFile(typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Atomically replace a Hope-owned file inside the run. */
export async function replaceRunFile(runPath, name, value) {
  const temporary = join(dirname(name), `.${basename(name)}.${randomBytes(8).toString("hex")}.tmp`);
  await writeRunFile(runPath, temporary, value);
  try {
    await rename(join(runPath, temporary), join(runPath, name));
  } catch (error) {
    await rm(join(runPath, temporary), { force: true }).catch(() => {});
    throw error;
  }
}

/** Read Hope-written JSON, which must still be private to this user. */
export async function readRunJson(runPath, name, maximumBytes = MANIFEST_BYTES) {
  const path = join(runPath, name);
  if (!privateMode(await lstat(path))) throw new Error(`Hope diff ${name} permissions are too open`);
  return (await readBoundedJson(path, { label: `Hope diff ${name}`, maximumBytes })).value;
}

export async function createRun(manifest, { clock = () => new Date(), temporaryRoot } = {}) {
  const expired = await cleanupExpiredRuns({ clock, temporaryRoot });
  const root = await privateRunRoot({ temporaryRoot });
  const runId = randomBytes(16).toString("hex");
  const path = join(root, `run-${runId}`);
  await mkdir(path, { mode: 0o700 });
  const directory = await lstat(path);
  if (!directory.isDirectory() || directory.isSymbolicLink() || !privateMode(directory)) {
    throw new Error("Hope could not verify the new private run directory");
  }
  // Ownership is recorded before any source data, so expiry cleanup can reclaim a partial run.
  const value = { ...manifest, createdAt: clock().toISOString(), owner: RUN_OWNER, runId, runVersion: RUN_VERSION };
  await writeRunFile(path, "run.json", value);
  return Object.freeze({ directory, manifest: value, path, preservedRunPaths: expired.preservedPaths, runId });
}

export async function loadRun(runPath, { temporaryRoot } = {}) {
  if (typeof runPath !== "string" || runPath.length === 0) throw new TypeError("Hope diff needs a run path");
  const root = await privateRunRoot({ temporaryRoot });
  const path = await realpath(resolve(runPath));
  if (dirname(path) !== root || !basename(path).startsWith("run-")) {
    throw new Error("Hope diff run path is outside Hope's private run storage");
  }
  const directory = await lstat(path);
  if (!directory.isDirectory() || directory.isSymbolicLink() || !privateMode(directory)) {
    throw new Error("Hope diff run is not a private directory");
  }
  const manifest = await readRunJson(path, "run.json");
  if (manifest.owner !== RUN_OWNER || manifest.runId !== basename(path).slice(4)) {
    throw new Error("Hope diff run ownership does not match");
  }
  if (manifest.runVersion !== RUN_VERSION) throw new Error("This Hope diff run was created by another runtime version");
  const snapshot = await readRunJson(path, "snapshot.json", LIMITS.snapshotBytes);
  return Object.freeze({ directory, manifest, path, snapshot });
}

export async function removeRun(run, options = {}) {
  await removeOwnedRunDirectory(run.path, run.directory, options);
}

export async function cleanupExpiredRuns({ clock = () => new Date(), temporaryRoot } = {}) {
  const root = await privateRunRoot({ temporaryRoot });
  const removedPaths = [];
  const preservedPaths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("run-")) continue;
    const path = join(root, entry.name);
    try {
      const directory = await lstat(path);
      if (directory.isSymbolicLink() || !directory.isDirectory() || !privateMode(directory)) continue;
      const manifest = await readRunJson(path, "run.json");
      if (manifest.owner !== RUN_OWNER || manifest.runId !== entry.name.slice(4)) continue;
      const createdAt = Date.parse(manifest.createdAt);
      if (!Number.isFinite(createdAt) || clock().getTime() - createdAt < RUN_TTL_MS) continue;
      await removeOwnedRunDirectory(path, directory);
      removedPaths.push(path);
    } catch (error) {
      // Unknown state is left in place.
      if (error?.code === "HOPE_DIFF_RUN_REPLACED") preservedPaths.push(error.preservedPath);
    }
  }
  return Object.freeze({ preservedPaths: Object.freeze(preservedPaths), removedPaths: Object.freeze(removedPaths) });
}
