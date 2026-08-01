#!/usr/bin/env node

import { takeOptions } from "../command-options/index.mjs";
import { isEntrypoint } from "../../entrypoint/index.mjs";
import {
  createToxicReviewBrief,
  runToxicReview,
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  validateToxicReviewFile,
} from "./index.mjs";

function usage() {
  return [
    "Use the Hope toxic review feature.",
    "",
    "The automatic AI path is provided by the Hope Toxic Review Skill.",
    "",
    "Internal Skill protocol:",
    "  hope toxic-review brief [--target <kind>] [--stage <stage>] [--risk <low|medium|high>]",
    "  hope toxic-review validate --input <review.json>",
  ].join("\n");
}

export function parseToxicReviewArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (!["brief", "validate"].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest, {
    allowed: ["input", "risk", "stage", "target"],
    prefix: "Hope toxic review",
  });
  if (positionals.length > 0) throw new TypeError(usage());
  if (command === "brief") {
    if (options.input) throw new TypeError(usage());
    return {
      command,
      risk: options.risk,
      stage: options.stage,
      target: options.target,
    };
  }
  if (!options.input || options.risk || options.stage || options.target) {
    throw new TypeError(usage());
  }
  return { command, inputPath: options.input };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseToxicReviewArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  let result;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "automatic") {
    return await (dependencies.runToxicReview ?? runToxicReview)(
      options.arguments,
      dependencies,
    );
  }
  if (options.command === "brief") {
    result = await (
      dependencies.createToxicReviewBrief ?? createToxicReviewBrief
    )(options, dependencies);
  } else {
    result = await (
      dependencies.validateToxicReviewFile ?? validateToxicReviewFile
    )(options.inputPath, dependencies);
  }
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`hope toxic-review: ${error.message}\n`);
    process.exitCode = error.code === TOXIC_REVIEW_MODEL_ADAPTER_CODE ? 2 : 1;
  });
}
