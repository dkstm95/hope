#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createPolishBrief,
  POLISH_MODEL_ADAPTER_CODE,
  runPolish,
  validatePolishFile,
} from "./index.mjs";

function usage() {
  return [
    "Use the Hope polish feature.",
    "",
    "The automatic AI path is provided by the Hope Polish Skill.",
    "",
    "Internal Skill protocol:",
    "  hope polish brief [--risk <low|medium|high>]",
    "  hope polish validate --input <run.json>",
  ].join("\n");
}

function takeOptions(values) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    if (!["input", "risk"].includes(key)) {
      throw new TypeError(`Unknown Hope polish option: ${value}`);
    }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new TypeError(`Hope polish option ${value} needs a value`);
    }
    if (options[key] !== undefined) {
      throw new TypeError(`Hope polish option ${value} was repeated`);
    }
    options[key] = next;
    index += 1;
  }
  return { options, positionals };
}

export function parsePolishArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (!["brief", "validate"].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest);
  if (positionals.length > 0) throw new TypeError(usage());
  if (command === "brief") {
    if (options.input) throw new TypeError(usage());
    return { command, risk: options.risk };
  }
  if (!options.input || options.risk) throw new TypeError(usage());
  return { command, inputPath: options.input };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parsePolishArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  let result;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "automatic") {
    return await (dependencies.runPolish ?? runPolish)(
      options.arguments,
      dependencies,
    );
  }
  if (options.command === "brief") {
    result = await (
      dependencies.createPolishBrief ?? createPolishBrief
    )(options, dependencies);
  } else {
    result = await (
      dependencies.validatePolishFile ?? validatePolishFile
    )(options.inputPath, dependencies);
  }
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const isEntrypoint = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isEntrypoint) {
  main().catch((error) => {
    process.stderr.write(`hope polish: ${error.message}\n`);
    process.exitCode = error.code === POLISH_MODEL_ADAPTER_CODE ? 2 : 1;
  });
}
