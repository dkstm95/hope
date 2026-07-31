#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  addDiffContext,
  buildMicroworldSkeleton,
  cancelDiff,
  checkpointDiffPage,
  DIFF_MODEL_ADAPTER_CODE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
  finishDiff,
  prepareDiff,
  readDiffPage,
  readDiffLedger,
  runDiff,
  validateDiff,
} from "./index.mjs";
import { serializeInspectionPage } from "./run.mjs";

function usage() {
  return [
    "Use the Hope diff feature.",
    "",
    "The automatic AI path is provided by the Hope skill.",
    "",
    "Internal skill protocol:",
    "  hope diff prepare [GitHub PR URL] [--host-locale <locale>] [--locale <locale>] [--theme <theme>] [--output <path>]",
    "  hope diff inspect --run <private-run-path> --page <number>",
    "  hope diff checkpoint --run <private-run-path> --page <number>",
    "  hope diff ledger --run <private-run-path> --page <number>",
    "  hope diff context --run <private-run-path> --request <context-request-id>",
    "  hope diff microworld-skeleton --input <private-controls.json>",
    "  hope diff validate --run <private-run-path>",
    "  hope diff finish --run <private-run-path>",
    "  hope diff cancel --run <private-run-path>",
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
      "host-locale",
      "locale",
      "theme",
      "output",
      "run",
      "page",
      "request",
      "input",
    ].includes(key)) {
      throw new TypeError(`Unknown Hope diff option: ${value}`);
    }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new TypeError(`Hope diff option ${value} needs a value`);
    }
    if (key === "request") {
      const entries = options[key] ?? [];
      entries.push(next);
      options[key] = entries;
      index += 1;
      continue;
    }
    if (options[key] !== undefined) {
      throw new TypeError(`Hope diff option ${value} was repeated`);
    }
    options[key] = next;
    index += 1;
  }
  return { options, positionals };
}

export function parseDiffArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (![
    "prepare",
    "inspect",
    "checkpoint",
    "ledger",
    "context",
    "microworld-skeleton",
    "validate",
    "finish",
    "cancel",
  ].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest);
  if (command === "prepare") {
    if (
      positionals.length > 1
      || options.run
      || options.page
      || options.request
      || options.input
    ) {
      throw new TypeError(usage());
    }
    return {
      command,
      hostLocale: options["host-locale"],
      locale: options.locale,
      outputPath: options.output,
      theme: options.theme,
      url: positionals[0],
    };
  }
  if (command === "microworld-skeleton") {
    if (
      positionals.length > 0
      || !options.input
      || options.run
      || options.page
      || options.locale
      || options.theme
      || options.output
      || options["host-locale"]
      || options.request
    ) {
      throw new TypeError(usage());
    }
    return { command, inputPath: options.input };
  }
  if (positionals.length > 0 || !options.run) throw new TypeError(usage());
  if (command === "context") {
    if (
      options.page
      || options.input
      || options.locale
      || options.theme
      || options.output
      || options["host-locale"]
    ) {
      throw new TypeError(usage());
    }
    const requestIds = options.request ?? [];
    if (requestIds.length === 0) throw new TypeError(usage());
    return { command, requestIds, runPath: options.run };
  }
  if (options.request) throw new TypeError(usage());
  if (
    options.input
    || options.locale
    || options.theme
    || options.output
    || options["host-locale"]
  ) {
    throw new TypeError(usage());
  }
  if (
    command === "inspect"
    || command === "checkpoint"
    || command === "ledger"
  ) {
    const page = Number.parseInt(options.page, 10);
    if (!options.page || !Number.isSafeInteger(page) || String(page) !== options.page) {
      throw new TypeError(usage());
    }
    return { command, page, runPath: options.run };
  }
  if (options.page) throw new TypeError(usage());
  return { command, runPath: options.run };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseDiffArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  let result;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "automatic") {
    return await (dependencies.runDiff ?? runDiff)(
      options.arguments,
      dependencies,
    );
  }
  if (options.command === "prepare") {
    result = await (dependencies.prepareDiff ?? prepareDiff)(options, dependencies);
  } else if (options.command === "inspect") {
    result = await (dependencies.readDiffPage ?? readDiffPage)(
      options.runPath,
      options.page,
      dependencies,
    );
  } else if (options.command === "checkpoint") {
    result = await (dependencies.checkpointDiffPage ?? checkpointDiffPage)(
      options.runPath,
      options.page,
      dependencies,
    );
  } else if (options.command === "ledger") {
    result = await (dependencies.readDiffLedger ?? readDiffLedger)(
      options.runPath,
      options.page,
      dependencies,
    );
  } else if (options.command === "context") {
    result = await (dependencies.addDiffContext ?? addDiffContext)(
      options.runPath,
      options.requestIds,
      dependencies,
    );
  } else if (options.command === "microworld-skeleton") {
    result = await (
      dependencies.buildMicroworldSkeleton ?? buildMicroworldSkeleton
    )(options.inputPath, dependencies);
  } else if (options.command === "validate") {
    result = await (dependencies.validateDiff ?? validateDiff)(
      options.runPath,
      dependencies,
    );
  } else if (options.command === "finish") {
    result = await (dependencies.finishDiff ?? finishDiff)(options.runPath, dependencies);
  } else {
    result = await (dependencies.cancelDiff ?? cancelDiff)(options.runPath, dependencies);
  }
  if (result !== undefined) {
    if (options.command === "inspect") {
      stdout.write(serializeInspectionPage(result));
    } else {
      stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  }
  return result;
}

export function diffErrorDetails(error) {
  if (
    error?.code !== "HOPE_ANALYSIS_INVALID"
    && error?.code !== DIFF_REVALIDATION_RETRYABLE_CODE
  ) {
    return "";
  }
  const details = { canRetry: error.canRetry, code: error.code };
  if (error.command !== undefined) details.command = error.command;
  if (error.runPath !== undefined) details.runPath = error.runPath;
  return `\n${JSON.stringify(details)}`;
}

export function diffExitCode(error) {
  if (error?.code === DIFF_MODEL_ADAPTER_CODE) return 2;
  if (error?.code === "HOPE_ANALYSIS_INVALID") return 3;
  if (error?.code === "HOPE_DIFF_STALE") return 4;
  if (error?.code === DIFF_REVALIDATION_RETRYABLE_CODE) return 5;
  return 1;
}

export function diffErrorReport(error, { prefix = "hope diff" } = {}) {
  return Object.freeze({
    exitCode: diffExitCode(error),
    message: `${prefix}: ${error.message}${diffErrorDetails(error)}\n`,
  });
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
    const report = diffErrorReport(error);
    process.stderr.write(report.message);
    process.exitCode = report.exitCode;
  });
}
