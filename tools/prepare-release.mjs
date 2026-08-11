#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "../entrypoint/index.mjs";
import { buildPlugin } from "./build-plugin.mjs";

const root = new URL("../", import.meta.url);
const fromRoot = (path) => new URL(path, root);

export const versionFiles = Object.freeze([
  "package.json",
  "package-lock.json",
  "plugins/hope/.codex-plugin/plugin.json",
  "plugins/hope/.claude-plugin/plugin.json",
]);

const semanticVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/u;
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const conventionalSubject = /^(?<type>build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(?:\([^()\r\n]+\))?(?<breaking>!)?: \S.*$/u;
const breakingFooter = /^BREAKING(?: CHANGE|-CHANGE):[ \t]+\S.*$/mu;
const releaseTypePriority = Object.freeze({ patch: 0, minor: 1, major: 2 });

export function isSemanticVersion(version) {
  const match = semanticVersion.exec(version);
  if (!match) return false;
  const [, prerelease, build] = match;
  const prereleaseParts = prerelease?.split(".") ?? [];
  const buildParts = build?.split(".") ?? [];
  return !prereleaseParts.some(
    (part) => part === "" || (/^\d+$/u.test(part) && part.length > 1 && part.startsWith("0")),
  ) && !buildParts.some((part) => part === "");
}

export function releaseTypeForCommit(message) {
  if (typeof message !== "string" || !message.trim()) {
    throw new Error("Expected a non-empty commit message");
  }
  const [subject = ""] = message.split(/\r?\n/u, 1);
  const conventional = conventionalSubject.exec(subject);
  if (breakingFooter.test(message) || conventional?.groups?.breaking === "!") return "major";
  if (conventional?.groups?.type === "feat") return "minor";
  return "patch";
}

export function releaseTypeForCommits(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Automatic release requires at least one commit");
  }
  return messages.reduce((selected, message) => {
    const candidate = releaseTypeForCommit(message);
    return releaseTypePriority[candidate] > releaseTypePriority[selected]
      ? candidate
      : selected;
  }, "patch");
}

export function incrementVersion(version, releaseType) {
  const match = stableVersion.exec(version);
  if (!match) {
    throw new Error(`Automatic release requires a stable semantic version, received: ${version}`);
  }
  if (!(releaseType in releaseTypePriority)) {
    throw new Error(`Unknown release type: ${releaseType}`);
  }
  let major = BigInt(match[1]);
  let minor = BigInt(match[2]);
  let patch = BigInt(match[3]);
  if (releaseType === "major") {
    major += 1n;
    minor = 0n;
    patch = 0n;
  } else if (releaseType === "minor") {
    minor += 1n;
    patch = 0n;
  } else {
    patch += 1n;
  }
  return `${major}.${minor}.${patch}`;
}

export function promoteUnreleasedChangelog(content, version, date) {
  if (!isSemanticVersion(version)) {
    throw new Error(`Expected a semantic version without a v prefix, received: ${version}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new Error(`Expected a release date in YYYY-MM-DD form, received: ${date}`);
  }
  const headings = [...content.matchAll(/^## Unreleased\r?$/gmu)];
  if (headings.length !== 1) {
    throw new Error("CHANGELOG.md must contain exactly one Unreleased section");
  }
  if (new RegExp(`^## ${version.replaceAll(".", "\\.")} - `, "mu").test(content)) {
    throw new Error(`CHANGELOG.md already contains a ${version} release section`);
  }
  const heading = headings[0];
  const bodyStart = heading.index + heading[0].length;
  const nextHeading = /^## /gmu;
  nextHeading.lastIndex = bodyStart;
  const next = nextHeading.exec(content);
  const bodyEnd = next?.index ?? content.length;
  const body = content.slice(bodyStart, bodyEnd).trim();
  if (!/^[-*]\s+\S/mu.test(body)) {
    throw new Error("CHANGELOG.md Unreleased section must contain at least one list item");
  }
  const suffix = next ? content.slice(next.index) : "";
  return [
    content.slice(0, heading.index),
    "## Unreleased\n\n",
    `## ${version} - ${date}\n\n`,
    `${body}\n`,
    suffix ? `\n${suffix}` : "",
  ].join("");
}

export function withVersion(document, version) {
  if (!isSemanticVersion(version)) {
    throw new Error(`Expected a semantic version without a v prefix, received: ${version}`);
  }
  return { ...document, version };
}

export function replaceVersion(content, version) {
  if (!isSemanticVersion(version)) {
    throw new Error(`Expected a semantic version without a v prefix, received: ${version}`);
  }
  const versionLine = /^(\s*"version"\s*:\s*)"[^"]+"/mu;
  if (!versionLine.test(content)) throw new Error("JSON file does not declare a version");
  return content.replace(versionLine, `$1"${version}"`);
}

export function withPackageLockVersion(document, version) {
  if (!isSemanticVersion(version)) {
    throw new Error(`Expected a semantic version without a v prefix, received: ${version}`);
  }
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

function readCommitMessages(baseRef) {
  const result = spawnSync("git", [
    "log",
    "--format=%B%x00",
    `${baseRef}..HEAD`,
  ], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new Error(detail ? `Could not read commits after ${baseRef}: ${detail}` : `Could not read commits after ${baseRef}`);
  }
  return result.stdout
    .split("\0")
    .map((message) => message.trim())
    .filter(Boolean);
}

export async function prepareRelease(version) {
  if (!isSemanticVersion(version)) {
    throw new Error(`Expected a semantic version without a v prefix, received: ${version}`);
  }

  await Promise.all(versionFiles.map(async (path) => await writeVersion(path, version)));
  await buildPlugin();
  run(["tools/check-release.mjs"]);
  run(["--test"]);
  process.stdout.write(`Hope ${version} is ready to review and commit.\n`);
}

export async function prepareAutomaticRelease(
  baseRef,
  { date = new Date().toISOString().slice(0, 10) } = {},
) {
  if (typeof baseRef !== "string" || !baseRef.trim()) {
    throw new Error("Automatic release requires a base Git reference");
  }
  const packageJson = JSON.parse(await readFile(fromRoot("package.json"), "utf8"));
  const commitMessages = readCommitMessages(baseRef);
  const releaseType = releaseTypeForCommits(commitMessages);
  const version = incrementVersion(packageJson.version, releaseType);
  const changelog = await readFile(fromRoot("CHANGELOG.md"), "utf8");
  await writeFile(
    fromRoot("CHANGELOG.md"),
    promoteUnreleasedChangelog(changelog, version, date),
    "utf8",
  );
  await prepareRelease(version);
  process.stdout.write(
    `Selected Hope ${version} (${releaseType}) from ${commitMessages.length} commit${commitMessages.length === 1 ? "" : "s"}.\n`,
  );
  return { commitCount: commitMessages.length, releaseType, version };
}

if (isEntrypoint(import.meta.url)) {
  const arguments_ = process.argv.slice(2);
  const automatic = arguments_[0] === "--automatic";
  if (
    (automatic && arguments_.length !== 2)
    || (!automatic && arguments_.length !== 1)
  ) {
    process.stderr.write(
      "Usage: npm run release:prepare -- <version> | --automatic <base-ref>\n",
    );
    process.exitCode = 1;
  } else {
    const preparation = automatic
      ? prepareAutomaticRelease(arguments_[1])
      : prepareRelease(arguments_[0]);
    preparation.catch((error) => {
      process.stderr.write(`prepare-release: ${error.message}\n`);
      process.exitCode = 1;
    });
  }
}
