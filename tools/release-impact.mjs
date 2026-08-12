#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "./entrypoint.mjs";
import { parsePackageFileList } from "./stage-plugin.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const releaseTypes = new Set(["patch", "minor", "major"]);
const versionedPackageFiles = new Set([
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
]);

function git(arguments_, { encoding = "utf8" } = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.toString().trim();
    throw new Error(detail || `git ${arguments_.join(" ")} failed`);
  }
  return result.stdout;
}

export function parseStableVersion(version) {
  const match = stableVersion.exec(version);
  if (!match) throw new Error(`Expected a stable semantic version, received: ${version}`);
  return match.slice(1).map((part) => BigInt(part));
}

export function compareVersions(left, right) {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

export function incrementVersion(version, releaseType) {
  if (!releaseTypes.has(releaseType)) {
    throw new Error(`Expected patch, minor, or major, received: ${releaseType}`);
  }
  let [major, minor, patch] = parseStableVersion(version);
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

export function releaseTypeBetween(baseVersion, headVersion) {
  if (compareVersions(baseVersion, headVersion) === 0) return "none";
  for (const releaseType of releaseTypes) {
    if (incrementVersion(baseVersion, releaseType) === headVersion) return releaseType;
  }
  return undefined;
}

export function validateReleaseImpact({
  baseDigest,
  baseVersion,
  headDigest,
  headVersion,
  releasedDigest,
  releasedVersion,
}) {
  if (compareVersions(baseVersion, releasedVersion) < 0) {
    throw new Error(
      `The base version ${baseVersion} is older than the released version ${releasedVersion}`,
    );
  }

  const selectedType = releaseTypeBetween(baseVersion, headVersion);
  if (!selectedType) {
    throw new Error(
      `Version ${headVersion} is not one patch, minor, or major step after ${baseVersion}`,
    );
  }

  const localPackageChange = baseDigest !== headDigest;
  const baseHasPackageDebt = releasedDigest !== baseDigest;
  const baseHasRecordedVersion = compareVersions(baseVersion, releasedVersion) > 0;
  const inheritedPackageDebt = baseHasPackageDebt && !baseHasRecordedVersion;
  const releaseRequired = localPackageChange || inheritedPackageDebt;

  if (releaseRequired && selectedType === "none") {
    const reason = localPackageChange
      ? "the pull request changes the public package"
      : "the base contains package changes not released by the current version";
    throw new Error(`A release is required because ${reason}`);
  }
  if (!releaseRequired && selectedType !== "none") {
    throw new Error("The version changes without a new or inherited public package change");
  }

  return Object.freeze({
    inheritedPackageDebt,
    localPackageChange,
    releaseRequired,
    selectedType,
  });
}

function resolveCommit(reference) {
  if (typeof reference !== "string" || !reference.trim()) {
    throw new Error("Expected a Git reference");
  }
  return git(["rev-parse", "--verify", "--end-of-options", `${reference}^{commit}`]).trim();
}

function readGitFile(commit, path) {
  return git(["show", `${commit}:${path}`], { encoding: null });
}

function normalizePackageFile(path, bytes) {
  if (!versionedPackageFiles.has(path)) return bytes;
  const content = bytes.toString("utf8");
  const versionLine = /^(\s*"version"\s*:\s*)"[^"]+"/mu;
  if (!versionLine.test(content)) {
    throw new Error(`${path} does not declare a version`);
  }
  return Buffer.from(content.replace(versionLine, '$1"0.0.0"'), "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function packageIdentityDigest(entries) {
  const hash = createHash("sha256");
  for (const { contentDigest, mode, path } of entries) {
    hash.update(path);
    hash.update("\0");
    hash.update(mode);
    hash.update("\0");
    hash.update(contentDigest);
  }
  return hash.digest("hex");
}

export function packageDigest(entries) {
  return packageIdentityDigest(entries.map(({ bytes, mode, path }) => ({
    contentDigest: sha256(normalizePackageFile(path, bytes)),
    mode,
    path,
  })));
}

export function packageDigestAt(reference) {
  const commit = resolveCommit(reference);
  const packageFiles = parsePackageFileList(
    readGitFile(commit, "tools/plugin-package-files.txt").toString("utf8"),
  );
  const tree = new Map(git(["ls-tree", "-r", commit, "--", "plugins/hope"])
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const match = /^(?<mode>\d+)\s+(?<type>\S+)\s+(?<digest>[0-9a-f]+)\tplugins\/hope\/(?<path>.+)$/u.exec(line);
      if (!match) throw new Error(`Could not parse package tree entry: ${line}`);
      return [match.groups.path, match.groups];
    }));
  return packageIdentityDigest(packageFiles.map((path) => {
    const entry = tree.get(path);
    if (!entry || entry.type !== "blob") {
      throw new Error(`Package entry is not a Git blob at ${commit}: ${path}`);
    }
    const contentDigest = versionedPackageFiles.has(path)
      ? sha256(normalizePackageFile(path, readGitFile(commit, `plugins/hope/${path}`)))
      : entry.digest;
    return { contentDigest, mode: entry.mode, path };
  }));
}

export function versionAt(reference) {
  const commit = resolveCommit(reference);
  const packageJson = JSON.parse(readGitFile(commit, "package.json").toString("utf8"));
  parseStableVersion(packageJson.version);
  return packageJson.version;
}

export function latestReleaseTag() {
  const tags = git([
    "for-each-ref",
    "--sort=-version:refname",
    "--format=%(refname:short)",
    "refs/tags/v*",
  ])
    .split(/\r?\n/u)
    .filter((tag) => stableVersion.test(tag.slice(1)));
  if (tags.length === 0) throw new Error("No stable Hope release tag exists");
  return tags[0];
}

export function checkReleaseImpact(baseReference, headReference = "HEAD") {
  const releasedReference = latestReleaseTag();
  const releasedVersion = versionAt(releasedReference);
  if (releasedReference !== `v${releasedVersion}`) {
    throw new Error(
      `Release tag ${releasedReference} does not match its package version ${releasedVersion}`,
    );
  }
  const baseVersion = versionAt(baseReference);
  const headVersion = versionAt(headReference);
  return {
    ...validateReleaseImpact({
      baseDigest: packageDigestAt(baseReference),
      baseVersion,
      headDigest: packageDigestAt(headReference),
      headVersion,
      releasedDigest: packageDigestAt(releasedReference),
      releasedVersion,
    }),
    baseVersion,
    headVersion,
    releasedReference,
    releasedVersion,
  };
}

if (isEntrypoint(import.meta.url)) {
  const [baseReference, headReference = "HEAD", ...extraArguments] = process.argv.slice(2);
  if (!baseReference || extraArguments.length > 0) {
    process.stderr.write(
      "Usage: node tools/release-impact.mjs <base-ref> [head-ref]\n",
    );
    process.exitCode = 1;
  } else {
    try {
      const result = checkReleaseImpact(baseReference, headReference);
      const debt = result.inheritedPackageDebt ? ", including inherited package debt" : "";
      process.stdout.write(
        `Hope release impact is valid: ${result.selectedType} `
        + `${result.baseVersion} -> ${result.headVersion}${debt}.\n`,
      );
    } catch (error) {
      process.stderr.write(`release-impact: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
