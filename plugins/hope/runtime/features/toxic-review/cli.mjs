#!/usr/bin/env node
// Generated from features/toxic-review/cli.mjs. Do not edit.

import { takeOptions } from "../command-options/index.mjs";
import { isEntrypoint } from "../../entrypoint/index.mjs";
import {
  completeToxicReviewRoleFile,
  createCausalCompletenessEvaluationPlanForActiveBrief,
  createCausalCompletenessEvaluationRecordTemplateFromFile,
  createCausalCompletenessEvaluationRun,
  createToxicReviewBrief,
  failToxicReviewRoleFile,
  finalizeToxicReviewRunFile,
  getToxicReviewRoleInputFile,
  getCausalCompletenessEvaluationOracle,
  prepareToxicReviewRunFile,
  retryToxicReviewRoleFile,
  runToxicReview,
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  validateCausalCompletenessEvaluationRecordFile,
  validateCausalCompletenessEvaluationRecordSetFile,
  validateToxicReviewFile,
} from "./index.mjs";

function usage() {
  return [
    "Use the Hope toxic review feature.",
    "",
    "Automatic AI work uses the Hope Skill or a configured harness model adapter.",
    "",
    "Internal Skill protocol:",
    "  hope toxic-review brief [--target <kind>] [--stage <stage>] [--risk <low|medium|high>]",
    "  hope toxic-review run-prepare --input <plan.json>",
    "  hope toxic-review role-input --state <run.json> --role <id>",
    "  hope toxic-review role-complete --state <run.json> --input <role-result.json> --invocation <id>",
    "  hope toxic-review role-fail --state <run.json> --role <id> --invocation <id> --code <code> --message <message> --retryable <true|false> [--status <failed|cancelled>]",
    "  hope toxic-review role-retry --state <run.json> --role <id>",
    "  hope toxic-review run-finalize --state <run.json> --input <adjudication.json>",
    "  hope toxic-review validate --input <review.json>",
    "  hope toxic-review evaluation-plan",
    "  hope toxic-review evaluation-prepare --case <id> --variant <legacy|rules-only|full> --run <number>",
    "  hope toxic-review evaluation-oracle --case <id>",
    "  hope toxic-review evaluation-record --case <id> --variant <variant> --run <number> --input <review.json> --model <id> --effort <level> --invocation <id>",
    "  hope toxic-review evaluation-validate --input <record.json>",
    "  hope toxic-review evaluation-validate-set --input <records.json>",
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

function parseBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new TypeError(usage());
}

export function parseToxicReviewArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (![
    "brief",
    "validate",
    "run-prepare",
    "role-input",
    "role-complete",
    "role-fail",
    "role-retry",
    "run-finalize",
    "evaluation-plan",
    "evaluation-prepare",
    "evaluation-oracle",
    "evaluation-record",
    "evaluation-validate",
    "evaluation-validate-set",
  ].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest, {
    allowed: [
      "case",
      "code",
      "effort",
      "input",
      "invocation",
      "message",
      "model",
      "retryable",
      "risk",
      "role",
      "run",
      "stage",
      "state",
      "status",
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
  if (command === "evaluation-record") {
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
  if (command === "run-prepare") {
    requireCommandOptions(options, { required: ["input"] });
    return { command, inputPath: options.input };
  }
  if (["role-input", "role-retry"].includes(command)) {
    requireCommandOptions(options, { required: ["role", "state"] });
    return {
      command,
      roleId: options.role,
      statePath: options.state,
    };
  }
  if (command === "role-complete") {
    requireCommandOptions(options, {
      required: ["input", "invocation", "state"],
    });
    return {
      command,
      hostInvocationId: options.invocation,
      resultPath: options.input,
      statePath: options.state,
    };
  }
  if (command === "role-fail") {
    requireCommandOptions(options, {
      optional: ["status"],
      required: [
        "code",
        "invocation",
        "message",
        "retryable",
        "role",
        "state",
      ],
    });
    return {
      command,
      code: options.code,
      hostInvocationId: options.invocation,
      message: options.message,
      retryable: parseBoolean(options.retryable),
      roleId: options.role,
      statePath: options.state,
      status: options.status ?? "failed",
    };
  }
  if (command === "run-finalize") {
    requireCommandOptions(options, { required: ["input", "state"] });
    return {
      command,
      decisionPath: options.input,
      statePath: options.state,
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
    result = await (dependencies.runToxicReview ?? runToxicReview)(
      options.arguments,
      dependencies,
    );
  } else if (options.command === "brief") {
    result = await (
      dependencies.createToxicReviewBrief ?? createToxicReviewBrief
    )(options, dependencies);
  } else if (options.command === "validate") {
    result = await (
      dependencies.validateToxicReviewFile ?? validateToxicReviewFile
    )(options.inputPath, dependencies);
  } else if (options.command === "run-prepare") {
    result = await (
      dependencies.prepareToxicReviewRunFile ?? prepareToxicReviewRunFile
    )(options.inputPath, dependencies);
  } else if (options.command === "role-input") {
    result = await (
      dependencies.getToxicReviewRoleInputFile
        ?? getToxicReviewRoleInputFile
    )(options.statePath, options.roleId, dependencies);
  } else if (options.command === "role-complete") {
    result = await (
      dependencies.completeToxicReviewRoleFile
        ?? completeToxicReviewRoleFile
    )(options, dependencies);
  } else if (options.command === "role-fail") {
    result = await (
      dependencies.failToxicReviewRoleFile ?? failToxicReviewRoleFile
    )(options, dependencies);
  } else if (options.command === "role-retry") {
    result = await (
      dependencies.retryToxicReviewRoleFile ?? retryToxicReviewRoleFile
    )(options.statePath, options.roleId, dependencies);
  } else if (options.command === "run-finalize") {
    result = await (
      dependencies.finalizeToxicReviewRunFile
        ?? finalizeToxicReviewRunFile
    )(options, dependencies);
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
  } else if (options.command === "evaluation-record") {
    result = await (
      dependencies.createCausalCompletenessEvaluationRecordTemplate
        ?? createCausalCompletenessEvaluationRecordTemplateFromFile
    )(options, dependencies);
  } else if (options.command === "evaluation-validate") {
    result = await (
      dependencies.validateCausalCompletenessEvaluationRecordFile
        ?? validateCausalCompletenessEvaluationRecordFile
    )(options.inputPath, dependencies);
  } else {
    result = await (
      dependencies.validateCausalCompletenessEvaluationRecordSetFile
        ?? validateCausalCompletenessEvaluationRecordSetFile
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
