import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
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

function hasDirectoryIdentity(info, expected) {
  return (
    info.isDirectory()
    && !info.isSymbolicLink()
    && info.dev === expected.dev
    && info.ino === expected.ino
    && info.birthtimeNs === expected.birthtimeNs
  );
}

function hasMarkerIdentity(info, expected) {
  return (
    info.isFile()
    && !info.isSymbolicLink()
    && info.dev === expected.markerDev
    && info.ino === expected.markerIno
    && info.birthtimeNs === expected.markerBirthtimeNs
  );
}

async function lstatIfPresent(path) {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function removeOwnedDirectory(owned) {
  const current = await lstatIfPresent(owned.path);
  if (!current) return;
  const markerPath = join(owned.path, owned.markerName);
  const marker = await lstatIfPresent(markerPath);
  if (
    !hasDirectoryIdentity(current, owned)
    || !marker
    || !hasMarkerIdentity(marker, owned)
  ) {
    throw new Error(
      `The test temporary directory changed before cleanup: ${owned.path}`,
    );
  }

  const claimedPath = `${owned.path}.hope-cleanup-${randomUUID()}`;
  try {
    await rename(owned.path, claimedPath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const claimed = await lstatIfPresent(claimedPath);
  if (!claimed) return;
  const claimedMarker = await lstatIfPresent(join(claimedPath, owned.markerName));
  if (
    !hasDirectoryIdentity(claimed, owned)
    || !claimedMarker
    || !hasMarkerIdentity(claimedMarker, owned)
  ) {
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
        failures.push(error);
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
    const markerName = `.hope-test-directory-owner-${randomUUID()}`;
    const markerPath = join(path, markerName);
    await writeFile(markerPath, "", { flag: "wx", mode: 0o600 });
    const [identity, markerIdentity] = await Promise.all([
      lstat(path, { bigint: true }),
      lstat(markerPath, { bigint: true }),
    ]);
    if (!identity.isDirectory() || identity.isSymbolicLink()) {
      throw new Error("The test temporary directory is not a regular directory");
    }
    if (!markerIdentity.isFile() || markerIdentity.isSymbolicLink()) {
      throw new Error("The test temporary directory ownership marker is not a regular file");
    }
    ownedDirectories.push(Object.freeze({
      birthtimeNs: identity.birthtimeNs,
      dev: identity.dev,
      ino: identity.ino,
      markerBirthtimeNs: markerIdentity.birthtimeNs,
      markerDev: markerIdentity.dev,
      markerIno: markerIdentity.ino,
      markerName,
      path,
    }));
    return path;
  };
}
