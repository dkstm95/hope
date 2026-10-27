#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  addDiffContext,
  cancelDiff,
  captureDiff,
  DIFF_CLEANUP_FAILED_CODE,
  DIFF_PUBLICATION_RETRYABLE_CODE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
  publishDiff,
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
    "  capture [GitHub PR URL or PR number] [--base <ref>] [--untracked] [--host-locale <locale>] [--locale <locale>] [--theme <theme>] [--output <path>] [--bundle-bytes <n>]",
    "  context --run <private-run-path> --path <repository-path> --revision head|merge-base [--path <p> --revision <r> ...]",
    "  validate --run <private-run-path>",
    "  publish --run <private-run-path>",
    "  cancel --run <private-run-path>",
  ].join("\n");
}

const commandOptions = {
  capture: ["base", "untracked", "host-locale", "locale", "theme", "output", "bundle-bytes"],
  context: ["run", "path", "revision"],
  validate: ["run"],
  publish: ["run"],
  cancel: ["run"],
};
const flags = new Set(["untracked"]);
const repeatable = new Set(["path", "revision"]);
const knownOptions = new Set(Object.values(commandOptions).flat());

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
    if (!knownOptions.has(key)) throw new TypeError(`Unknown Hope diff option: ${value}`);
    if (flags.has(key)) {
      if (options[key] !== undefined) throw new TypeError(`Hope diff option ${value} was repeated`);
      options[key] = true;
      continue;
    }
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) throw new TypeError(`Hope diff option ${value} needs a value`);
    if (repeatable.has(key)) {
      (options[key] ??= []).push(next);
    } else {
      if (options[key] !== undefined) throw new TypeError(`Hope diff option ${value} was repeated`);
      options[key] = next;
    }
    index += 1;
  }
  return { options, positionals };
}

function integerOption(value, name) {
  if (value === undefined) return undefined;
  const number = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(number) || String(number) !== value) throw new TypeError(`${name} needs an integer`);
  return number;
}

export function parseDiffArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) return { command: "help" };
  const [command, ...rest] = argv;
  if (!Object.hasOwn(commandOptions, command)) throw new TypeError(usage());
  const { options, positionals } = takeOptions(rest);
  if (Object.keys(options).some((key) => !commandOptions[command].includes(key))) throw new TypeError(usage());
  if (command === "capture") {
    if (positionals.length > 1) throw new TypeError(usage());
    return {
      base: options.base,
      bundleBytes: integerOption(options["bundle-bytes"], "--bundle-bytes"),
      command,
      hostLocale: options["host-locale"],
      locale: options.locale,
      outputPath: options.output,
      theme: options.theme,
      untracked: options.untracked === true,
      ...parsePullRequestTargetArgument(positionals[0]),
    };
  }
  if (positionals.length > 0 || !options.run) throw new TypeError(usage());
  if (command === "context") {
    const paths = options.path ?? [];
    const revisions = options.revision ?? [];
    if (paths.length === 0 || paths.length !== revisions.length) {
      throw new TypeError("Hope diff context needs matching --path and --revision pairs");
    }
    return {
      command,
      requests: paths.map((path, index) => ({ path, revision: revisions[index] })),
      runPath: options.run,
    };
  }
  return { command, runPath: options.run };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseDiffArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return undefined;
  }
  const commands = {
    cancel: () => (dependencies.cancelDiff ?? cancelDiff)(options.runPath, dependencies),
    capture: () => (dependencies.captureDiff ?? captureDiff)(options, dependencies),
    context: () => (dependencies.addDiffContext ?? addDiffContext)(options.runPath, options.requests, dependencies),
    publish: () => (dependencies.publishDiff ?? publishDiff)(options.runPath, dependencies),
    validate: () => (dependencies.validateDiff ?? validateDiff)(options.runPath, dependencies),
  };
  const result = await commands[options.command]();
  if (result !== undefined) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const structuredCodes = new Set([
  "HOPE_ANALYSIS_INVALID",
  DIFF_REVALIDATION_RETRYABLE_CODE,
  DIFF_PUBLICATION_RETRYABLE_CODE,
  DIFF_CLEANUP_FAILED_CODE,
]);

export function diffErrorDetails(error) {
  const structured = structuredCodes.has(error?.code);
  if (!structured && error?.preservedPath === undefined && error?.runPath === undefined) return "";
  const details = {};
  if (structured) {
    details.canRetry = error.canRetry;
    details.code = error.code;
    if (Array.isArray(error.issues)) details.issues = error.issues;
    if (error.command !== undefined) details.command = error.command;
    if (error.outputPath !== undefined) details.outputPath = error.outputPath;
  } else if (error.code !== undefined) {
    details.code = error.code;
  }
  if (error.runPath !== undefined) details.runPath = error.runPath;
  if (error.preservedPath !== undefined) details.preservedPath = error.preservedPath;
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
