import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdtemp,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

function validPrefix(prefix) {
  return (
    typeof prefix === "string"
    && prefix.length > 1
    && prefix.endsWith("-")
    && basename(prefix) === prefix
  );
}

function hasIdentity(info, expected) {
  return (
    info.isDirectory()
    && !info.isSymbolicLink()
    && info.dev === expected.dev
    && info.ino === expected.ino
  );
}

async function removeOwnedDirectory(owned) {
  const current = await lstat(owned.path);
  if (!hasIdentity(current, owned)) {
    throw new Error(
      `The test temporary directory changed before cleanup: ${owned.path}`,
    );
  }

  const claimedPath = `${owned.path}.hope-cleanup-${randomUUID()}`;
  await rename(owned.path, claimedPath);
  const claimed = await lstat(claimedPath);
  if (!hasIdentity(claimed, owned)) {
    throw new Error(
      `The claimed test temporary directory changed and was preserved: ${claimedPath}`,
    );
  }
  await rm(claimedPath, { recursive: true });
}

export function registerTestTemporaryDirectoryCleanup(registerCleanup) {
  if (typeof registerCleanup !== "function") {
    throw new TypeError("A test cleanup registration function is required");
  }

  const ownedDirectories = [];

  async function cleanup() {
    const failures = [];
    while (ownedDirectories.length > 0) {
      const owned = ownedDirectories.pop();
      try {
        await removeOwnedDirectory(owned);
      } catch (error) {
        if (error?.code !== "ENOENT") failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Hope could not clean every test temporary directory");
    }
  }

  registerCleanup(cleanup);

  return async function createTestTemporaryDirectory(prefix) {
    if (!validPrefix(prefix)) {
      throw new TypeError("A test temporary directory prefix must be one name ending in '-'");
    }
    const temporaryRoot = await realpath(tmpdir());
    const path = await mkdtemp(join(temporaryRoot, prefix));
    const identity = await lstat(path);
    if (!identity.isDirectory() || identity.isSymbolicLink()) {
      throw new Error("The test temporary directory is not a regular directory");
    }
    ownedDirectories.push(Object.freeze({
      dev: identity.dev,
      ino: identity.ino,
      path,
    }));
    return path;
  };
}
