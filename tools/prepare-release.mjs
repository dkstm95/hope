#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "./entrypoint.mjs";
import { buildPlugin } from "./build-plugin.mjs";
import {
  incrementVersion,
  parseStableVersion,
} from "./release-impact.mjs";

const root = new URL("../", import.meta.url);
const fromRoot = (path) => new URL(path, root);

const versionFiles = Object.freeze([
  "package.json",
  "package-lock.json",
  "plugins/hope/.codex-plugin/plugin.json",
  "plugins/hope/.claude-plugin/plugin.json",
]);

export function replaceVersion(content, version) {
  parseStableVersion(version);
  const versionLine = /^(\s*"version"\s*:\s*)"[^"]+"/mu;
  if (!versionLine.test(content)) throw new Error("JSON file does not declare a version");
  return content.replace(versionLine, `$1"${version}"`);
}

export function withPackageLockVersion(document, version) {
  parseStableVersion(version);
  if (
    !document
    || typeof document !== "object"
    || Array.isArray(document)
    || !document.packages
    || typeof document.packages !== "object"
    || Array.isArray(document.packages)
    || !document.packages[""]
    || typeof document.packages[""] !== "object"
    || Array.isArray(document.packages[""])
  ) {
    throw new Error("Package lock does not declare the root package");
  }
  return {
    ...document,
    version,
    packages: {
      ...document.packages,
      "": {
        ...document.packages[""],
        version,
      },
    },
  };
}

async function writeVersion(path, version) {
  const url = fromRoot(path);
  const content = await readFile(url, "utf8");
  const document = JSON.parse(content);
  if (path === "package-lock.json") {
    await writeFile(
      url,
      `${JSON.stringify(withPackageLockVersion(document, version), null, 2)}\n`,
      "utf8",
    );
    return;
  }
  await writeFile(url, replaceVersion(content, version), "utf8");
}

function run(commandArguments) {
  const result = spawnSync(process.execPath, commandArguments, {
    cwd: fileURLToPath(root),
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${process.execPath} ${commandArguments.join(" ")} failed`);
  }
}

function git(arguments_) {
  const result = spawnSync("git", arguments_, {
    cwd: fileURLToPath(root),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new Error(detail || `git ${arguments_.join(" ")} failed`);
  }
  return result.stdout.trim();
}

export function versionFromBase(baseReference = "origin/main") {
  const resolvedBase = git([
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${baseReference}^{commit}`,
  ]);
  const mergeBase = git(["merge-base", "HEAD", resolvedBase]);
  if (mergeBase !== resolvedBase) {
    throw new Error(`Update the branch so ${baseReference} is an ancestor of HEAD`);
  }
  const packageJson = JSON.parse(git(["show", `${resolvedBase}:package.json`]));
  return packageJson.version;
}

async function prepareRelease(version) {
  parseStableVersion(version);

  await Promise.all(versionFiles.map(async (path) => await writeVersion(path, version)));
  await buildPlugin();
  run(["tools/check-release.mjs"]);
  run(["--test"]);
  process.stdout.write(`Hope ${version} is ready to review and commit.\n`);
}

export async function prepareReleaseType(releaseType, baseReference = "origin/main") {
  const version = incrementVersion(versionFromBase(baseReference), releaseType);
  await prepareRelease(version);
  process.stdout.write(`Selected Hope ${version} (${releaseType}).\n`);
  return version;
}

if (isEntrypoint(import.meta.url)) {
  const arguments_ = process.argv.slice(2);
  const [releaseType, baseReference] = arguments_;
  if (
    arguments_.length < 1
    || arguments_.length > 2
    || !["patch", "minor", "major"].includes(releaseType)
  ) {
    process.stderr.write(
      "Usage: npm run release:prepare -- <patch|minor|major> [base-ref]\n",
    );
    process.exitCode = 1;
  } else {
    prepareReleaseType(releaseType, baseReference).catch((error) => {
      process.stderr.write(`prepare-release: ${error.message}\n`);
      process.exitCode = 1;
    });
  }
}
