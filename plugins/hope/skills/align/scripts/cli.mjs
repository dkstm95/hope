#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createAlignArtifact,
  inspectAlignArtifact,
  reviseAlignArtifact,
} from "./artifact.mjs";

function usage() {
  return [
    "Use Hope Align through its private Skill adapter.",
    "",
    "Internal Skill subcommands:",
    "  create --input <draft.json> --output <artifact.html> [--root <repository>]",
    "  inspect --artifact <artifact.html>",
    "  revise --input <draft.json> --artifact <artifact.html> --expect <digest> [--root <repository>]",
  ].join("\n");
}

function takeOptions(values) {
  const allowed = new Set(["artifact", "expect", "input", "output", "root"]);
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) throw new TypeError(usage());
    const key = value.slice(2);
    if (!allowed.has(key)) throw new TypeError(`Unknown Hope Align option: ${value}`);
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new TypeError(`Hope Align option ${value} needs a value`);
    }
    if (options[key] !== undefined) {
      throw new TypeError(`Hope Align option ${value} was repeated`);
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

export function parseAlignArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (!["create", "inspect", "revise"].includes(command)) {
    throw new TypeError(usage());
  }
  const options = takeOptions(rest);
  if (command === "create") {
    if (!options.input || !options.output || options.artifact || options.expect) {
      throw new TypeError(usage());
    }
    return {
      command,
      inputPath: options.input,
      outputPath: options.output,
      root: options.root,
    };
  }
  if (command === "inspect") {
    if (!options.artifact || options.input || options.output || options.expect || options.root) {
      throw new TypeError(usage());
    }
    return { artifactPath: options.artifact, command };
  }
  if (!options.artifact || !options.expect || !options.input || options.output) {
    throw new TypeError(usage());
  }
  return {
    artifactPath: options.artifact,
    command,
    expectedDigest: options.expect,
    inputPath: options.input,
    root: options.root,
  };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseAlignArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return undefined;
  }
  let result;
  if (options.command === "create") {
    result = await (dependencies.createAlignArtifact ?? createAlignArtifact)(
      options,
      dependencies,
    );
  } else if (options.command === "inspect") {
    result = await (dependencies.inspectAlignArtifact ?? inspectAlignArtifact)(
      options.artifactPath,
      dependencies,
    );
  } else {
    result = await (dependencies.reviseAlignArtifact ?? reviseAlignArtifact)(
      options,
      dependencies,
    );
  }
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function isEntrypoint(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entryPath);
  } catch {
    return false;
  }
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
