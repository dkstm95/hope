#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "../entrypoint/index.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function runGit(arguments_, cwd = root) {
  return spawnSync("git", arguments_, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function requireGitResult(result, action) {
  if (result.error) throw result.error;
  if (result.status === null || result.status > 1) {
    const detail = result.stderr?.trim();
    throw new Error(detail ? `${action}: ${detail}` : action);
  }
}

export function assertReleasedPluginVersionIsImmutable(
  version,
  { cwd = root, git = runGit } = {},
) {
  const tag = `v${version}`;
  const tagResult = git(
    ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`],
    cwd,
  );
  requireGitResult(tagResult, `Could not inspect ${tag}`);
  if (tagResult.status === 1) return { released: false, tag };

  const diffResult = git(
    ["diff", "--quiet", tag, "--", "plugins/hope"],
    cwd,
  );
  requireGitResult(diffResult, `Could not compare plugins/hope with ${tag}`);
  if (diffResult.status === 1) {
    throw new Error(
      `Hope ${version} is already released as ${tag}; update the public version before changing the plugin package`,
    );
  }
  return { released: true, tag };
}

export async function checkPluginVersion() {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const result = assertReleasedPluginVersionIsImmutable(packageJson.version);
  process.stdout.write(
    result.released
      ? `Hope ${packageJson.version} matches ${result.tag}.\n`
      : `Hope ${packageJson.version} has no release tag yet.\n`,
  );
}

if (isEntrypoint(import.meta.url)) {
  checkPluginVersion().catch((error) => {
    process.stderr.write(`check-plugin-version: ${error.message}\n`);
    process.exitCode = 1;
  });
}
