#!/usr/bin/env node
// Generated from features/toxic-review/cli.mjs. Do not edit.

import { takeOptions } from "../command-options/index.mjs";
import { isEntrypoint } from "../../entrypoint/index.mjs";
import {
  createCausalCompletenessEvaluationPlanForActiveBrief,
  createCausalCompletenessEvaluationReceiptTemplateFromFile,
  createCausalCompletenessEvaluationRun,
  createToxicReviewBrief,
  getCausalCompletenessEvaluationOracle,
  runToxicReview,
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  validateCausalCompletenessEvaluationReceiptFile,
  validateCausalCompletenessEvaluationReceiptSetFile,
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
    "  hope toxic-review evaluation-plan",
    "  hope toxic-review evaluation-prepare --case <id> --variant <legacy|rules-only|full> --run <number>",
    "  hope toxic-review evaluation-oracle --case <id>",
    "  hope toxic-review evaluation-receipt --case <id> --variant <variant> --run <number> --input <review.json> --model <id> --effort <level> --invocation <id>",
    "  hope toxic-review evaluation-validate --input <receipt.json>",
    "  hope toxic-review evaluation-validate-set --input <receipts.json>",
  ].join("\n");
}

function requireCommandOptions(options, { optional = [], required = [] } = {}) {
  const allowed = new Set([...required, ...optional]);
  const missingRequired = required.some((key) => !options[key]);
  const hasUnexpected = Object.entries(options).some(
    ([key, value]) => value && !allowed.has(key),
  );
  if (missingRequired || hasUnexpected) throw new TypeError(usage());
}

function parseRunNumber(value) {
  const run = Number(value);
  if (!Number.isSafeInteger(run) || String(run) !== value) {
    throw new TypeError(usage());
  }
  return run;
}

export function parseToxicReviewArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (![
    "brief",
    "validate",
    "evaluation-plan",
    "evaluation-prepare",
    "evaluation-oracle",
    "evaluation-receipt",
    "evaluation-validate",
    "evaluation-validate-set",
  ].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest, {
    allowed: [
      "case",
      "effort",
      "input",
      "invocation",
      "model",
      "risk",
      "run",
      "stage",
      "target",
      "variant",
    ],
    prefix: "Hope toxic review",
  });
  if (positionals.length > 0) throw new TypeError(usage());
  if (command === "brief") {
    requireCommandOptions(options, {
      optional: ["risk", "stage", "target"],
    });
    return {
      command,
      risk: options.risk,
      stage: options.stage,
      target: options.target,
    };
  }
  if (command === "evaluation-plan") {
    if (Object.keys(options).length > 0) throw new TypeError(usage());
    return { command };
  }
  if (command === "evaluation-oracle") {
    requireCommandOptions(options, { required: ["case"] });
    return { command, caseId: options.case };
  }
  if (command === "evaluation-prepare") {
    requireCommandOptions(options, {
      required: ["case", "run", "variant"],
    });
    return {
      command,
      caseId: options.case,
      run: parseRunNumber(options.run),
      variant: options.variant,
    };
  }
  if (command === "evaluation-receipt") {
    requireCommandOptions(options, {
      required: [
        "case",
        "effort",
        "input",
        "invocation",
        "model",
        "run",
        "variant",
      ],
    });
    return {
      command,
      caseId: options.case,
      effort: options.effort,
      inputPath: options.input,
      invocationId: options.invocation,
      model: options.model,
      run: parseRunNumber(options.run),
      variant: options.variant,
    };
  }
  requireCommandOptions(options, { required: ["input"] });
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
  } else if (options.command === "validate") {
    result = await (
      dependencies.validateToxicReviewFile ?? validateToxicReviewFile
    )(options.inputPath, dependencies);
  } else if (options.command === "evaluation-prepare") {
    result = await (
      dependencies.createCausalCompletenessEvaluationRun
        ?? createCausalCompletenessEvaluationRun
    )(options, dependencies);
  } else if (options.command === "evaluation-plan") {
    result = await (
      dependencies.createCausalCompletenessEvaluationPlan
        ?? createCausalCompletenessEvaluationPlanForActiveBrief
    )(dependencies);
  } else if (options.command === "evaluation-oracle") {
    result = await (
      dependencies.getCausalCompletenessEvaluationOracle
        ?? getCausalCompletenessEvaluationOracle
    )(options.caseId);
  } else if (options.command === "evaluation-receipt") {
    result = await (
      dependencies.createCausalCompletenessEvaluationReceiptTemplate
        ?? createCausalCompletenessEvaluationReceiptTemplateFromFile
    )(options, dependencies);
  } else if (options.command === "evaluation-validate") {
    result = await (
      dependencies.validateCausalCompletenessEvaluationReceiptFile
        ?? validateCausalCompletenessEvaluationReceiptFile
    )(options.inputPath, dependencies);
  } else {
    result = await (
      dependencies.validateCausalCompletenessEvaluationReceiptSetFile
        ?? validateCausalCompletenessEvaluationReceiptSetFile
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
