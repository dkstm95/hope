#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createAlignRecord,
  inspectAlignRecord,
  renderAlignRecord,
  reviseAlignRecord,
} from "./artifact.mjs";
import { migrateAlignArtifact } from "./migrate.mjs";

const COMMANDS = Object.freeze({
  create: { required: ["input", "output"], optional: ["root"] },
  inspect: { required: ["record"], optional: [] },
  revise: { required: ["input", "record"], optional: ["root"] },
  render: { required: ["record"], optional: [] },
  migrate: { required: ["artifact"], optional: [] },
});

function usage() {
  return [
    "Use Hope Align through its private Skill adapter.",
    "",
    "Internal Skill subcommands:",
    "  create --input <draft.json> --output <record.json> [--root <repository>]",
    "  inspect --record <record.json>",
    "  revise --input <draft.json> --record <record.json> [--root <repository>]",
    "  render --record <record.json>",
    "  migrate --artifact <legacy.html>",
  ].join("\n");
}

function takeOptions(values, allowed) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) throw new TypeError(usage());
    const key = value.slice(2);
    if (!allowed.includes(key)) throw new TypeError(`Unknown Hope Align option: ${value}`);
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
  const shape = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!shape) throw new TypeError(usage());
  const options = takeOptions(rest, [...shape.required, ...shape.optional]);
  if (!shape.required.every((key) => options[key] !== undefined)) throw new TypeError(usage());
  return {
    command,
    ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
    ...(options.input === undefined ? {} : { inputPath: options.input }),
    ...(options.output === undefined ? {} : { outputPath: options.output }),
    ...(options.record === undefined ? {} : { recordPath: options.record }),
    ...(shape.optional.includes("root") ? { root: options.root } : {}),
  };
}

const handlers = Object.freeze({
  create: (options, dependencies) => (dependencies.createAlignRecord ?? createAlignRecord)(
    options,
    dependencies,
  ),
  inspect: (options, dependencies) => (dependencies.inspectAlignRecord ?? inspectAlignRecord)(
    options.recordPath,
  ),
  revise: (options, dependencies) => (dependencies.reviseAlignRecord ?? reviseAlignRecord)(
    options,
    dependencies,
  ),
  render: (options, dependencies) => (dependencies.renderAlignRecord ?? renderAlignRecord)(
    options.recordPath,
  ),
  migrate: (options, dependencies) => (dependencies.migrateAlignArtifact ?? migrateAlignArtifact)(
    options,
  ),
});

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseAlignArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return undefined;
  }
  const result = await handlers[options.command](options, dependencies);
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
