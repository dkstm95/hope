#!/usr/bin/env node

import { createRequire } from "node:module";

import { isEntrypoint } from "../entrypoint/index.mjs";

import {
  ALIGN_MODEL_ADAPTER_CODE,
} from "../features/align/index.mjs";
import { main as runAlignCommand } from "../features/align/cli.mjs";
import {
  diffErrorReport,
  main as runDiffCommand,
} from "../features/diff/cli.mjs";
import {
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
} from "../features/toxic-review/index.mjs";
import {
  main as runToxicReviewCommand,
} from "../features/toxic-review/cli.mjs";
import {
  POLISH_MODEL_ADAPTER_CODE,
} from "../features/polish/index.mjs";
import { main as runPolishCommand } from "../features/polish/cli.mjs";
import { main as runModelEvaluationCommand } from "../features/model-evaluation/cli.mjs";
import {
  SWEEP_MODEL_ADAPTER_CODE,
} from "../features/sweep/index.mjs";
import { main as runSweepCommand } from "../features/sweep/cli.mjs";
import {
  createTaskWritingPass,
  WRITE_MODEL_ADAPTER_CODE,
} from "../features/write/index.mjs";
import { main as runWriteCommand } from "../features/write/cli.mjs";
import { main as runSettingsCommand } from "../settings/cli.mjs";

const { version: VERSION } = createRequire(import.meta.url)("../package.json");

function usage() {
  return [
    "Use the Hope harness.",
    "",
    "Usage:",
    "  hope --help",
    "  hope --version",
    "  hope align",
    "  hope diff",
    "  hope model-evaluation <command>",
    "  hope polish",
    "  hope sweep",
    "  hope toxic-review",
    "  hope write",
    "  hope settings <show|set|reset>",
    "",
    "Automatic AI work currently runs through the Hope Skill for Claude or Codex.",
  ].join("\n");
}

export function parseArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  if (argv.length === 1 && ["--version", "-v"].includes(argv[0])) {
    return { command: "version" };
  }
  const [command, ...rest] = argv;
  if (
    ![
      "align",
      "diff",
      "model-evaluation",
      "polish",
      "settings",
      "sweep",
      "toxic-review",
      "write",
    ].includes(command)
  ) {
    throw new TypeError(`Unknown Hope command: ${command}`);
  }
  return { arguments: rest, command };
}

async function withWritingPass(dependencies, stdout) {
  const writingPass = await (
    dependencies.createTaskWritingPass ?? createTaskWritingPass
  )(dependencies.writingDependencies);
  return { ...dependencies, stdout, writingPass };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "version") {
    stdout.write(`${VERSION}\n`);
    return;
  }
  if (options.command === "settings") {
    return await (dependencies.runSettingsCommand ?? runSettingsCommand)(
      options.arguments,
      { ...dependencies, stdout },
    );
  }
  if (options.command === "write") {
    return await (dependencies.runWriteCommand ?? runWriteCommand)(
      options.arguments,
      { ...dependencies, stdout },
    );
  }
  if (options.command === "model-evaluation") {
    return await (
      dependencies.runModelEvaluationCommand ?? runModelEvaluationCommand
    )(options.arguments, { ...dependencies, stdout });
  }
  const taskDependencies = await withWritingPass(dependencies, stdout);
  if (options.command === "align") {
    return await (dependencies.runAlignCommand ?? runAlignCommand)(
      options.arguments.length === 0 ? ["automatic"] : options.arguments,
      taskDependencies,
    );
  }
  if (options.command === "toxic-review") {
    return await (
      dependencies.runToxicReviewCommand ?? runToxicReviewCommand
    )(
      options.arguments.length === 0 ? ["automatic"] : options.arguments,
      taskDependencies,
    );
  }
  if (options.command === "polish") {
    return await (dependencies.runPolishCommand ?? runPolishCommand)(
      options.arguments.length === 0 ? ["automatic"] : options.arguments,
      taskDependencies,
    );
  }
  if (options.command === "sweep") {
    return await (dependencies.runSweepCommand ?? runSweepCommand)(
      options.arguments.length === 0 ? ["automatic"] : options.arguments,
      taskDependencies,
    );
  }
  return await (dependencies.runDiffCommand ?? runDiffCommand)(
    options.arguments.length === 0 ? ["automatic"] : options.arguments,
    taskDependencies,
  );
}

export function harnessErrorReport(error) {
  if ([
    ALIGN_MODEL_ADAPTER_CODE,
    POLISH_MODEL_ADAPTER_CODE,
    SWEEP_MODEL_ADAPTER_CODE,
    TOXIC_REVIEW_MODEL_ADAPTER_CODE,
    WRITE_MODEL_ADAPTER_CODE,
  ].includes(error?.code)) {
    return Object.freeze({
      exitCode: 2,
      message: `hope: ${error.message}\n`,
    });
  }
  return diffErrorReport(error, { prefix: "hope" });
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    const report = harnessErrorReport(error);
    process.stderr.write(report.message);
    process.exitCode = report.exitCode;
  });
}
