#!/usr/bin/env node
// Generated from features/align/cli.mjs. Do not edit.

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ALIGN_MODEL_ADAPTER_CODE,
  completeAlignPolish,
  createAlignBrief,
  prepareAlignPolishCandidate,
  renderAlignFile,
  runAlign,
  validateAlignFile,
} from "./index.mjs";

function usage() {
  return [
    "Use the Hope align feature.",
    "",
    "The automatic AI path is provided by the Hope Align Skill.",
    "",
    "Internal Skill protocol:",
    "  hope align brief [--risk <low|medium|high>] [--ui <yes|no>] [--host-locale <locale>] [--locale <locale>] [--theme <theme>]",
    "  hope align validate --input <state.json>",
    "  hope align polish-candidate --input <state.json>",
    "  hope align complete-polish --before <state.json> --polish <run.json> [--after <state.json>]",
    "  hope align render --input <state.json> [--output <new-path>]",
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
    if (![
      "after",
      "before",
      "host-locale",
      "input",
      "locale",
      "output",
      "polish",
      "risk",
      "theme",
      "ui",
    ].includes(key)) {
      throw new TypeError(`Unknown Hope align option: ${value}`);
    }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new TypeError(`Hope align option ${value} needs a value`);
    }
    if (options[key] !== undefined) {
      throw new TypeError(`Hope align option ${value} was repeated`);
    }
    options[key] = next;
    index += 1;
  }
  return { options, positionals };
}

export function parseAlignArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (![
    "brief",
    "complete-polish",
    "polish-candidate",
    "render",
    "validate",
  ].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest);
  if (positionals.length > 0) throw new TypeError(usage());
  if (command === "brief") {
    if (
      options.after
      || options.before
      || options.input
      || options.output
      || options.polish
    ) throw new TypeError(usage());
    if (options.ui !== undefined && !["yes", "no"].includes(options.ui)) {
      throw new TypeError(usage());
    }
    return {
      command,
      hostLocale: options["host-locale"],
      locale: options.locale,
      risk: options.risk,
      theme: options.theme,
      ui: options.ui === "yes",
    };
  }
  if (command === "complete-polish") {
    if (
      !options.before
      || !options.polish
      || options["host-locale"]
      || options.input
      || options.locale
      || options.output
      || options.risk
      || options.theme
      || options.ui
    ) {
      throw new TypeError(usage());
    }
    return {
      command,
      beforePath: options.before,
      polishPath: options.polish,
      ...(options.after ? { afterPath: options.after } : {}),
    };
  }
  if (
    !options.input
    || options.after
    || options.before
    || options["host-locale"]
    || options.locale
    || options.risk
    || options.theme
    || options.ui
    || options.polish
    || (["polish-candidate", "validate"].includes(command) && options.output)
  ) {
    throw new TypeError(usage());
  }
  return {
    command,
    inputPath: options.input,
    ...(options.output ? { outputPath: options.output } : {}),
  };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseAlignArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  let result;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "automatic") {
    return await (dependencies.runAlign ?? runAlign)(
      options.arguments,
      dependencies,
    );
  }
  if (options.command === "brief") {
    result = await (dependencies.createAlignBrief ?? createAlignBrief)(
      options,
      dependencies,
    );
  } else if (options.command === "validate") {
    result = await (dependencies.validateAlignFile ?? validateAlignFile)(
      options.inputPath,
      dependencies,
    );
  } else if (options.command === "polish-candidate") {
    result = await (
      dependencies.prepareAlignPolishCandidate ?? prepareAlignPolishCandidate
    )(options.inputPath, dependencies);
  } else if (options.command === "complete-polish") {
    result = await (
      dependencies.completeAlignPolish ?? completeAlignPolish
    )(options, dependencies);
  } else {
    result = await (dependencies.renderAlignFile ?? renderAlignFile)(
      options,
      dependencies,
    );
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
    process.stderr.write(`hope align: ${error.message}\n`);
    process.exitCode = error.code === ALIGN_MODEL_ADAPTER_CODE ? 2 : 1;
  });
}
