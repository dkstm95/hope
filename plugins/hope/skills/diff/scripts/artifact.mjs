// Diff owns the artifact publication boundary; no other feature consumes it.
import { randomBytes } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  open,
  realpath,
  rmdir,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

async function syncDirectory(path) {
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    if (
      process.platform !== "win32"
      && !["EINVAL", "ENOTSUP", "EISDIR"].includes(error?.code)
    ) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

async function writeExclusive(path, bytes) {
  const handle = await open(path, "wx", 0o600);
  const created = await handle.stat();
  let written;
  let failure;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    written = await handle.stat();
  } catch (error) {
    failure = error;
  } finally {
    await handle.close();
  }
  if (failure) {
    await unlinkOwnedFile(path, created).catch(() => {});
    throw failure;
  }
  const info = await lstat(path);
  if (
    !info.isFile()
    || info.isSymbolicLink()
    || info.nlink !== 1
    || info.dev !== written.dev
    || info.ino !== written.ino
    || info.size !== bytes.length
  ) {
    throw new Error("Hope could not verify the artifact staging file");
  }
  return written;
}

function hasIdentity(info, expected) {
  return info.isFile()
    && !info.isSymbolicLink()
    && info.dev === expected.dev
    && info.ino === expected.ino;
}

function hasDirectoryIdentity(info, expected) {
  return info.isDirectory()
    && !info.isSymbolicLink()
    && info.dev === expected.dev
    && info.ino === expected.ino;
}

async function unlinkOwnedFile(path, expected) {
  if (!expected) return false;
  try {
    const info = await lstat(path);
    if (!hasIdentity(info, expected)) return false;
    await unlink(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function existingOutputError(target, noun) {
  return new Error(
    `Hope did not replace the existing ${noun}: ${target}. `
      + "Choose a new destination with --output <new-path>.",
  );
}

export async function preflightArtifactOutput(outputPath, {
  noun = "artifact",
} = {}) {
  if (!outputPath) return undefined;
  const requested = isAbsolute(outputPath) ? outputPath : resolve(outputPath);
  const parent = await realpath(dirname(requested));
  const target = join(parent, basename(requested));
  try {
    await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return target;
    throw error;
  }
  throw existingOutputError(target, noun);
}

export async function publishArtifact(bytes, {
  directoryPrefix = "hope-artifact-",
  fileName = "hope-artifact.html",
  linkFile = link,
  noun = "artifact",
  outputPath,
  temporaryRoot = tmpdir(),
} = {}) {
  let privateDirectory;
  let privateDirectoryIdentity;
  let target;
  if (outputPath) {
    target = await preflightArtifactOutput(outputPath, { noun });
  } else {
    const trustedTemporaryRoot = await realpath(temporaryRoot);
    privateDirectory = await mkdtemp(join(trustedTemporaryRoot, directoryPrefix));
    if (process.platform !== "win32") await chmod(privateDirectory, 0o700);
    privateDirectoryIdentity = await lstat(privateDirectory);
    if (
      !privateDirectoryIdentity.isDirectory()
      || privateDirectoryIdentity.isSymbolicLink()
    ) {
      throw new Error("Hope could not verify the artifact directory");
    }
    target = join(privateDirectory, fileName);
  }

  const parent = dirname(target);
  const staging = join(
    parent,
    `.${basename(target)}.hope-${randomBytes(12).toString("hex")}.tmp`,
  );
  let published = false;
  let written;
  try {
    written = await writeExclusive(staging, bytes);
    try {
      await linkFile(staging, target);
      published = true;
    } catch (error) {
      if (error?.code === "EEXIST") throw existingOutputError(target, noun);
      if (["EXDEV", "ENOTSUP", "EPERM"].includes(error?.code)) {
        throw new Error(
          `This filesystem cannot publish a Hope ${noun} without an overwrite race`,
        );
      }
      throw error;
    }
    const [stagingInfo, targetInfo] = await Promise.all([
      lstat(staging),
      lstat(target),
    ]);
    if (
      !hasIdentity(stagingInfo, written)
      || !hasIdentity(targetInfo, written)
      || stagingInfo.nlink !== 2
      || targetInfo.nlink !== 2
    ) {
      throw new Error("The Hope artifact changed during publication");
    }
    await unlink(staging);
    const finalInfo = await lstat(target);
    if (!hasIdentity(finalInfo, written) || finalInfo.nlink !== 1) {
      throw new Error("The Hope artifact changed during publication");
    }
    await syncDirectory(parent);
    return target;
  } catch (error) {
    if (published && written) {
      try {
        await unlinkOwnedFile(target, written);
      } catch {
        // An unknown target is never removed.
      }
    }
    await unlinkOwnedFile(staging, written).catch(() => {});
    if (privateDirectory && privateDirectoryIdentity) {
      try {
        const currentDirectory = await lstat(privateDirectory);
        if (hasDirectoryIdentity(currentDirectory, privateDirectoryIdentity)) {
          await rmdir(privateDirectory);
        }
      } catch {
        // A changed or non-empty directory is left in place.
      }
    }
    throw error;
  }
}
