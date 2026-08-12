#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { takeOptions } from "./command-options.mjs";
import {
  addDiffContext,
  buildMicroworldSkeleton,
  cancelDiff,
  checkpointDiffWindow,
  DIFF_CLEANUP_FAILED_CODE,
  DIFF_PUBLICATION_RETRYABLE_CODE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
  finishDiff,
  prepareDiff,
  readDiffWindow,
  readDiffLedger,
  resolveDiffTarget,
  validateDiff,
} from "./index.mjs";
import { parsePullRequestTargetArgument } from "./target.mjs";

function isEntrypoint(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entryPath);
  } catch {
    return false;
  }
}

function usage() {
  return [
    "Use Hope Diff through its private Skill adapter.",
    "",
    "Internal Skill subcommands:",
    "  resolve-target [GitHub PR URL or PR number]",
    "  prepare [GitHub PR URL or PR number] [--host-locale <locale>] [--locale <locale>] [--theme <theme>] [--output <path>]",
    "  inspect-window --run <private-run-path> --page <start-number>",
    "  checkpoint-window --run <private-run-path> --page <start-number>",
    "  ledger --run <private-run-path> --page <number>",
    "  context --run <private-run-path> --request <context-request-id>",
    "  microworld-skeleton --input <private-controls.json>",
    "  validate --run <private-run-path>",
    "  finish --run <private-run-path>",
    "  cancel --run <private-run-path>",
  ].join("\n");
}

export function parseDiffArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (![
    "prepare",
    "resolve-target",
    "inspect-window",
    "checkpoint-window",
    "ledger",
    "context",
    "microworld-skeleton",
    "validate",
    "finish",
    "cancel",
  ].includes(command)) {
    throw new TypeError(usage());
  }
  const { options, positionals } = takeOptions(rest, {
    allowed: [
      "host-locale",
      "locale",
      "theme",
      "output",
      "run",
      "page",
      "request",
      "input",
    ],
    prefix: "Hope diff",
    repeatable: ["request"],
  });
  if (command === "prepare" || command === "resolve-target") {
    if (
      positionals.length > 1
      || options.run
      || options.page
      || options.request
      || options.input
    ) {
      throw new TypeError(usage());
    }
    if (
      command === "resolve-target"
      && (
        options["host-locale"]
        || options.locale
        || options.theme
        || options.output
      )
    ) {
      throw new TypeError(usage());
    }
    const target = parsePullRequestTargetArgument(positionals[0]);
    if (command === "resolve-target") return { command, ...target };
    return {
      command,
      hostLocale: options["host-locale"],
      locale: options.locale,
      outputPath: options.output,
      theme: options.theme,
      ...target,
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
    command === "inspect-window"
    || command === "checkpoint-window"
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
  if (options.command === "resolve-target") {
    result = await (dependencies.resolveDiffTarget ?? resolveDiffTarget)(
      options,
      dependencies,
    );
  } else if (options.command === "prepare") {
    result = await (dependencies.prepareDiff ?? prepareDiff)(options, dependencies);
  } else if (options.command === "inspect-window") {
    result = await (dependencies.readDiffWindow ?? readDiffWindow)(
      options.runPath,
      options.page,
      dependencies,
    );
  } else if (options.command === "checkpoint-window") {
    result = await (
      dependencies.checkpointDiffWindow ?? checkpointDiffWindow
    )(
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
    if (
      options.command === "inspect-window"
      || options.command === "checkpoint-window"
    ) {
      stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  }
  return result;
}

export function diffErrorDetails(error) {
  const structured = error?.code === "HOPE_ANALYSIS_INVALID"
    || error?.code === DIFF_REVALIDATION_RETRYABLE_CODE
    || error?.code === DIFF_PUBLICATION_RETRYABLE_CODE
    || error?.code === DIFF_CLEANUP_FAILED_CODE;
  if (!structured && error?.preservedPath === undefined) return "";
  const details = {};
  if (structured) {
    details.canRetry = error.canRetry;
    details.code = error.code;
    if (Array.isArray(error.issues)) details.issues = error.issues;
    if (error.command !== undefined) details.command = error.command;
    if (error.outputPath !== undefined) details.outputPath = error.outputPath;
    if (error.runPath !== undefined) details.runPath = error.runPath;
  }
  if (error.preservedPath !== undefined) {
    details.preservedPath = error.preservedPath;
  }
  return `\n${JSON.stringify(details)}`;
}

export function diffExitCode(error) {
  if (error?.code === "HOPE_ANALYSIS_INVALID") return 3;
  if (error?.code === "HOPE_DIFF_STALE") return 4;
  if (error?.code === DIFF_REVALIDATION_RETRYABLE_CODE) return 5;
  if (error?.code === DIFF_PUBLICATION_RETRYABLE_CODE) return 6;
  return 1;
}

export function diffErrorReport(error, { prefix = "Hope Diff" } = {}) {
  return Object.freeze({
    exitCode: diffExitCode(error),
    message: `${prefix}: ${error.message}${diffErrorDetails(error)}\n`,
  });
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    const report = diffErrorReport(error);
    process.stderr.write(report.message);
    process.exitCode = report.exitCode;
  });
}
