#!/usr/bin/env node

import { takeOptions } from "../command-options/index.mjs";
import { isEntrypoint } from "../../entrypoint/index.mjs";
import {
  addDiffContext,
  buildMicroworldSkeleton,
  cancelDiff,
  checkpointDiffPage,
  checkpointDiffWindow,
  createDiffConfirmationFromFile,
  createDiffInvocationContract,
  createDiffInvocationExampleRemovalPlan,
  createDiffInvocationExampleRemovalReceiptFromFile,
  createDiffInvocationEvaluationPlan,
  createDiffInvocationEvaluationReceiptFromFile,
  createDiffInvocationProductionVerificationPlan,
  createDiffInvocationProductionVerificationReceiptFromFile,
  DIFF_MODEL_ADAPTER_CODE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
  finishDiff,
  getDiffInvocationEvaluationOracle,
  prepareDiff,
  prepareDiffInvocationExampleRemovalRun,
  prepareDiffInvocationEvaluationRun,
  prepareDiffInvocationProductionVerificationRun,
  readDiffPage,
  readDiffWindow,
  readDiffLedger,
  resolveDiffTarget,
  runDiff,
  transitionDiffConfirmationFromFile,
  validateDiff,
  validateDiffInvocationExampleRemovalEvidenceFile,
  validateDiffInvocationExampleRemovalReceiptFile,
  validateDiffInvocationExampleRemovalReceiptSetFile,
  validateDiffInvocationEvaluationReceiptFile,
  validateDiffInvocationEvaluationReceiptSetFile,
  validateDiffInvocationProductionVerificationReceiptFile,
  validateDiffInvocationProductionVerificationReceiptSetFile,
} from "./index.mjs";
import { serializeInspectionPage } from "./run.mjs";
import { parsePullRequestTargetArgument } from "./target.mjs";

function usage() {
  return [
    "Use the Hope diff feature.",
    "",
    "The automatic AI path is provided by the Hope skill.",
    "",
    "Internal skill protocol:",
    "  hope diff invocation-brief",
    "  hope diff invocation-example-removal-plan",
    "  hope diff invocation-example-removal-prepare --case <id> --batch <number> --run <number>",
    "  hope diff invocation-example-removal-receipt --case <id> --batch <number> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope diff invocation-example-removal-validate --input <receipt.json>",
    "  hope diff invocation-example-removal-validate-set --input <receipts.json>",
    "  hope diff invocation-example-removal-validate-evidence --input <evidence.json>",
    "  hope diff invocation-evaluation-plan",
    "  hope diff invocation-evaluation-prepare --case <id> --variant <minimal|rules-only|full> --run <number>",
    "  hope diff invocation-evaluation-oracle --case <id>",
    "  hope diff invocation-evaluation-receipt --case <id> --variant <variant> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope diff invocation-evaluation-validate --input <receipt.json>",
    "  hope diff invocation-evaluation-validate-set --input <receipts.json>",
    "  hope diff invocation-production-verification-plan",
    "  hope diff invocation-production-verification-prepare --case <id> --run <number>",
    "  hope diff invocation-production-verification-receipt --case <id> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope diff invocation-production-verification-validate --input <receipt.json>",
    "  hope diff invocation-production-verification-validate-set --input <receipts.json>",
    "  hope diff resolve-target [GitHub PR URL or PR number]",
    "  hope diff confirmation-create --input <private-input.json>",
    "  hope diff confirmation-transition --input <private-input.json>",
    "  hope diff prepare [GitHub PR URL or PR number] [--host-locale <locale>] [--locale <locale>] [--theme <theme>] [--output <path>]",
    "  hope diff inspect --run <private-run-path> --page <number>",
    "  hope diff checkpoint --run <private-run-path> --page <number>",
    "  hope diff inspect-window --run <private-run-path> --page <start-number>",
    "  hope diff checkpoint-window --run <private-run-path> --page <start-number>",
    "  hope diff ledger --run <private-run-path> --page <number>",
    "  hope diff context --run <private-run-path> --request <context-request-id>",
    "  hope diff microworld-skeleton --input <private-controls.json>",
    "  hope diff validate --run <private-run-path>",
    "  hope diff finish --run <private-run-path>",
    "  hope diff cancel --run <private-run-path>",
  ].join("\n");
}

function requireCommandOptions(options, { optional = [], required = [] } = {}) {
  const allowed = new Set([...required, ...optional]);
  const missing = required.some((key) => !options[key]);
  const unexpected = Object.entries(options).some(
    ([key, value]) => value !== undefined && !allowed.has(key),
  );
  if (missing || unexpected) throw new TypeError(usage());
}

function parseEvaluationRun(value) {
  const run = Number(value);
  if (!Number.isSafeInteger(run) || run < 1 || String(run) !== value) {
    throw new TypeError(usage());
  }
  return run;
}

export function parseDiffArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (![
    "prepare",
    "invocation-brief",
    "invocation-example-removal-plan",
    "invocation-example-removal-prepare",
    "invocation-example-removal-receipt",
    "invocation-example-removal-validate",
    "invocation-example-removal-validate-set",
    "invocation-example-removal-validate-evidence",
    "invocation-evaluation-plan",
    "invocation-evaluation-prepare",
    "invocation-evaluation-oracle",
    "invocation-evaluation-receipt",
    "invocation-evaluation-validate",
    "invocation-evaluation-validate-set",
    "invocation-production-verification-plan",
    "invocation-production-verification-prepare",
    "invocation-production-verification-receipt",
    "invocation-production-verification-validate",
    "invocation-production-verification-validate-set",
    "resolve-target",
    "confirmation-create",
    "confirmation-transition",
    "inspect",
    "inspect-window",
    "checkpoint",
    "checkpoint-window",
    "ledger",
    "context",
    "microworld-skeleton",
    "validate",
    "finish",
    "cancel",
  ].includes(command)) {
    return { arguments: argv, command: "automatic" };
  }
  if (
    command === "invocation-brief"
    || command === "invocation-example-removal-plan"
    || command === "invocation-evaluation-plan"
    || command === "invocation-production-verification-plan"
  ) {
    if (rest.length > 0) throw new TypeError(usage());
    return { command };
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
      "batch",
      "case",
      "variant",
      "host",
      "model",
      "effort",
      "invocation",
    ],
    prefix: "Hope diff",
    repeatable: ["request"],
  });
  if (command === "invocation-example-removal-prepare") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, {
      required: ["batch", "case", "run"],
    });
    return {
      command,
      batch: parseEvaluationRun(options.batch),
      caseId: options.case,
      run: parseEvaluationRun(options.run),
    };
  }
  if (command === "invocation-example-removal-receipt") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, {
      required: [
        "batch",
        "case",
        "effort",
        "host",
        "input",
        "invocation",
        "model",
        "run",
      ],
    });
    return {
      command,
      batch: parseEvaluationRun(options.batch),
      caseId: options.case,
      effort: options.effort,
      host: options.host,
      inputPath: options.input,
      invocationId: options.invocation,
      model: options.model,
      run: parseEvaluationRun(options.run),
    };
  }
  if (
    command === "invocation-example-removal-validate"
    || command === "invocation-example-removal-validate-set"
    || command === "invocation-example-removal-validate-evidence"
  ) {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, { required: ["input"] });
    return { command, inputPath: options.input };
  }
  if (command === "invocation-evaluation-oracle") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, { required: ["case"] });
    return { command, caseId: options.case };
  }
  if (command === "invocation-production-verification-prepare") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, { required: ["case", "run"] });
    return {
      command,
      caseId: options.case,
      run: parseEvaluationRun(options.run),
    };
  }
  if (command === "invocation-production-verification-receipt") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, {
      required: [
        "case",
        "effort",
        "host",
        "input",
        "invocation",
        "model",
        "run",
      ],
    });
    return {
      command,
      caseId: options.case,
      effort: options.effort,
      host: options.host,
      inputPath: options.input,
      invocationId: options.invocation,
      model: options.model,
      run: parseEvaluationRun(options.run),
    };
  }
  if (
    command === "invocation-production-verification-validate"
    || command === "invocation-production-verification-validate-set"
  ) {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, { required: ["input"] });
    return { command, inputPath: options.input };
  }
  if (command === "invocation-evaluation-prepare") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, {
      required: ["case", "run", "variant"],
    });
    return {
      command,
      caseId: options.case,
      run: parseEvaluationRun(options.run),
      variant: options.variant,
    };
  }
  if (command === "invocation-evaluation-receipt") {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, {
      required: [
        "case",
        "effort",
        "host",
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
      host: options.host,
      inputPath: options.input,
      invocationId: options.invocation,
      model: options.model,
      run: parseEvaluationRun(options.run),
      variant: options.variant,
    };
  }
  if (
    command === "invocation-evaluation-validate"
    || command === "invocation-evaluation-validate-set"
  ) {
    if (positionals.length > 0) throw new TypeError(usage());
    requireCommandOptions(options, { required: ["input"] });
    return { command, inputPath: options.input };
  }
  if (
    options.batch
    || options.case
    || options.variant
    || options.host
    || options.model
    || options.effort
    || options.invocation
  ) {
    throw new TypeError(usage());
  }
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
  if (
    command === "confirmation-create"
    || command === "confirmation-transition"
  ) {
    if (
      positionals.length > 0
      || !options.input
      || options.run
      || options.page
      || options.request
      || options["host-locale"]
      || options.locale
      || options.theme
      || options.output
    ) {
      throw new TypeError(usage());
    }
    return { command, inputPath: options.input };
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
    || command === "inspect-window"
    || command === "checkpoint"
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
  if (options.command === "automatic") {
    return await (dependencies.runDiff ?? runDiff)(
      options.arguments,
      dependencies,
    );
  }
  if (options.command === "invocation-brief") {
    result = (dependencies.createInvocationContract
      ?? createDiffInvocationContract)();
  } else if (options.command === "invocation-example-removal-plan") {
    result = (dependencies.createInvocationExampleRemovalPlan
      ?? createDiffInvocationExampleRemovalPlan)();
  } else if (options.command === "invocation-example-removal-prepare") {
    result = (dependencies.prepareInvocationExampleRemovalRun
      ?? prepareDiffInvocationExampleRemovalRun)(options);
  } else if (options.command === "invocation-example-removal-receipt") {
    result = await (
      dependencies.createInvocationExampleRemovalReceipt
        ?? createDiffInvocationExampleRemovalReceiptFromFile
    )(options, dependencies);
  } else if (options.command === "invocation-example-removal-validate") {
    result = await (
      dependencies.validateInvocationExampleRemovalReceipt
        ?? validateDiffInvocationExampleRemovalReceiptFile
    )(options.inputPath, dependencies);
  } else if (options.command === "invocation-example-removal-validate-set") {
    result = await (
      dependencies.validateInvocationExampleRemovalReceiptSet
        ?? validateDiffInvocationExampleRemovalReceiptSetFile
    )(options.inputPath, dependencies);
  } else if (
    options.command === "invocation-example-removal-validate-evidence"
  ) {
    result = await (
      dependencies.validateInvocationExampleRemovalEvidence
        ?? validateDiffInvocationExampleRemovalEvidenceFile
    )(options.inputPath, dependencies);
  } else if (options.command === "invocation-evaluation-plan") {
    result = (dependencies.createInvocationEvaluationPlan
      ?? createDiffInvocationEvaluationPlan)();
  } else if (options.command === "invocation-evaluation-prepare") {
    result = (dependencies.prepareInvocationEvaluationRun
      ?? prepareDiffInvocationEvaluationRun)(options);
  } else if (options.command === "invocation-evaluation-oracle") {
    result = (dependencies.getInvocationEvaluationOracle
      ?? getDiffInvocationEvaluationOracle)(options.caseId);
  } else if (options.command === "invocation-evaluation-receipt") {
    result = await (
      dependencies.createInvocationEvaluationReceipt
        ?? createDiffInvocationEvaluationReceiptFromFile
    )(options, dependencies);
  } else if (options.command === "invocation-evaluation-validate") {
    result = await (
      dependencies.validateInvocationEvaluationReceipt
        ?? validateDiffInvocationEvaluationReceiptFile
    )(options.inputPath, dependencies);
  } else if (options.command === "invocation-evaluation-validate-set") {
    result = await (
      dependencies.validateInvocationEvaluationReceiptSet
        ?? validateDiffInvocationEvaluationReceiptSetFile
    )(options.inputPath, dependencies);
  } else if (options.command === "invocation-production-verification-plan") {
    result = (dependencies.createInvocationProductionVerificationPlan
      ?? createDiffInvocationProductionVerificationPlan)();
  } else if (
    options.command === "invocation-production-verification-prepare"
  ) {
    result = (dependencies.prepareInvocationProductionVerificationRun
      ?? prepareDiffInvocationProductionVerificationRun)(options);
  } else if (
    options.command === "invocation-production-verification-receipt"
  ) {
    result = await (
      dependencies.createInvocationProductionVerificationReceipt
        ?? createDiffInvocationProductionVerificationReceiptFromFile
    )(options, dependencies);
  } else if (
    options.command === "invocation-production-verification-validate"
  ) {
    result = await (
      dependencies.validateInvocationProductionVerificationReceipt
        ?? validateDiffInvocationProductionVerificationReceiptFile
    )(options.inputPath, dependencies);
  } else if (
    options.command === "invocation-production-verification-validate-set"
  ) {
    result = await (
      dependencies.validateInvocationProductionVerificationReceiptSet
        ?? validateDiffInvocationProductionVerificationReceiptSetFile
    )(options.inputPath, dependencies);
  } else if (options.command === "confirmation-create") {
    result = await (
      dependencies.createDiffConfirmation ?? createDiffConfirmationFromFile
    )(options.inputPath, dependencies);
  } else if (options.command === "confirmation-transition") {
    result = await (
      dependencies.transitionDiffConfirmation
        ?? transitionDiffConfirmationFromFile
    )(options.inputPath, dependencies);
  } else if (options.command === "resolve-target") {
    result = await (dependencies.resolveDiffTarget ?? resolveDiffTarget)(
      options,
      dependencies,
    );
  } else if (options.command === "prepare") {
    result = await (dependencies.prepareDiff ?? prepareDiff)(options, dependencies);
  } else if (options.command === "inspect") {
    result = await (dependencies.readDiffPage ?? readDiffPage)(
      options.runPath,
      options.page,
      dependencies,
    );
  } else if (options.command === "inspect-window") {
    result = await (dependencies.readDiffWindow ?? readDiffWindow)(
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
    if (options.command === "inspect") {
      stdout.write(serializeInspectionPage(result));
    } else if (
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
  if (
    error?.code !== "HOPE_ANALYSIS_INVALID"
    && error?.code !== DIFF_REVALIDATION_RETRYABLE_CODE
  ) {
    return "";
  }
  const details = { canRetry: error.canRetry, code: error.code };
  if (Array.isArray(error.issues)) details.issues = error.issues;
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

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    const report = diffErrorReport(error);
    process.stderr.write(report.message);
    process.exitCode = report.exitCode;
  });
}
