#!/usr/bin/env node

import { isEntrypoint } from "../entrypoint/index.mjs";
import { isSemanticVersion } from "./prepare-release.mjs";

export const releaseIncrements = Object.freeze(["patch", "minor", "major"]);

export function nextReleaseVersion(version, increment) {
  if (!isSemanticVersion(version) || version.includes("-") || version.includes("+")) {
    throw new Error(`Expected a stable semantic version, received: ${version}`);
  }
  if (!releaseIncrements.includes(increment)) {
    throw new Error(`Expected one of ${releaseIncrements.join(", ")}, received: ${increment}`);
  }
  const [major, minor, patch] = version.split(".").map(Number);
  if (increment === "major") return `${major + 1}.0.0`;
  if (increment === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

if (isEntrypoint(import.meta.url)) {
  const [version, increment, ...extraArguments] = process.argv.slice(2);
  if (!version || !increment || extraArguments.length > 0) {
    process.stderr.write(
      "Usage: node tools/next-release-version.mjs <version> <patch|minor|major>\n",
    );
    process.exitCode = 1;
  } else {
    try {
      process.stdout.write(`${nextReleaseVersion(version, increment)}\n`);
    } catch (error) {
      process.stderr.write(`next-release-version: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
