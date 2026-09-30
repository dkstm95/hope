import { execFile as callback } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, realpath, lstat, open, unlink, rmdir } from "node:fs/promises";
import { tmpdir, devNull } from "node:os";
import { join } from "node:path";
import { LIMITS } from "./constants.mjs";
const execFile = promisify(callback);

/** Reconstruct only missing/truncated patches, without cloning or running repository code. */
export async function diffText(before, after, { execute = execFile, temporaryRoot = tmpdir() } = {}) {
  const directory = await mkdtemp(join(await realpath(temporaryRoot), "hope-diff-patch-"));
  const directoryIdentity = await lstat(directory);
  const identities = new Map();
  try {
    for (const [name, value] of [["before", before], ["after", after]]) {
      const path = join(directory, name);
      const handle = await open(path, "wx", 0o600);
      try { identities.set(path, await handle.stat()); await handle.writeFile(value); }
      finally { await handle.close(); }
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith("GIT_")));
    env.GIT_CONFIG_NOSYSTEM = "1";
    env.GIT_CONFIG_GLOBAL = devNull;
    let output;
    try {
      output = await execute("git", [
        "-c", `core.attributesFile=${devNull}`, "-c", "diff.algorithm=myers",
        "diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--text", "--unified=3",
        "--", "before", "after",
      ], { cwd: directory, env, encoding: "utf8", shell: false, timeout: 10_000, maxBuffer: LIMITS.safeBodyBytes * 4 });
    } catch (error) {
      if (error.code !== 1 || typeof error.stdout !== "string") throw new Error("Cannot reconstruct this patch");
      output = error;
    }
    const start = output.stdout.indexOf("@@ ");
    return start === -1 ? "" : output.stdout.slice(start).replace(/\n$/u, "");
  } finally {
    // Remove only the exact files this invocation created; preserve replacements.
    try {
      const actual = await lstat(directory);
      if (actual.dev !== directoryIdentity.dev || actual.ino !== directoryIdentity.ino || actual.isSymbolicLink()) {
        throw new Error(`Temporary patch directory changed; preserved ${directory}`);
      }
      for (const [path, expected] of identities) {
        const current = await lstat(path);
        if (current.dev !== expected.dev || current.ino !== expected.ino || current.isSymbolicLink()) {
          throw new Error(`Temporary patch file changed; preserved ${directory}`);
        }
        await unlink(path);
      }
      await rmdir(directory);
    } catch (cause) {
      const error = new Error(`Could not safely clean reconstructed patch files; preserved ${directory}`, { cause });
      error.code = "HOPE_PATCH_CLEANUP_FAILED";
      error.preservedPath = directory;
      throw error;
    }
  }
}

