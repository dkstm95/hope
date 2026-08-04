#!/usr/bin/env node

import { isEntrypoint } from "../../entrypoint/index.mjs";
import { takeOptions } from "../command-options/index.mjs";

import {
  createHopeFeatureSelectionEvaluationPlan,
  createHopeFeatureSelectionEvaluationReceiptFromFile,
  createHopePolishPreservationEvaluationPlan,
  createHopePolishPreservationEvaluationReceiptFromFile,
  createHopeWriteExampleEvaluationPlan,
  createHopeWriteExampleEvaluationReceiptFromFile,
  createHopeWritePlainLanguageComparisonPlan,
  createHopeWritePlainLanguageComparisonResultFromFile,
  createHopeWritePlainLanguageEvaluationPlan,
  createHopeWritePlainLanguageEvaluationReceiptFromFile,
  createHopeWriteProductionVerificationPlan,
  createHopeWriteProductionVerificationReceiptFromFile,
  getHopeFeatureSelectionEvaluationOracle,
  getHopePolishPreservationEvaluationOracle,
  getHopeWriteExampleEvaluationOracle,
  getHopeWritePlainLanguageEvaluationOracle,
  HOPE_FEATURE_SELECTION_VARIANTS,
  HOPE_POLISH_PRESERVATION_VARIANTS,
  HOPE_WRITE_EXAMPLE_VARIANTS,
  prepareHopeFeatureSelectionEvaluationRun,
  prepareHopePolishPreservationEvaluationRun,
  prepareHopeWriteExampleEvaluationRun,
  prepareHopeWritePlainLanguageComparisonAssessmentFromFile,
  prepareHopeWritePlainLanguageComparisonRun,
  prepareHopeWritePlainLanguageAssessmentFromFile,
  prepareHopeWritePlainLanguageEvaluationRun,
  prepareHopeWriteProductionVerificationRun,
  validateHopeFeatureSelectionEvaluationReceiptFile,
  validateHopeFeatureSelectionEvaluationReceiptSetFile,
  validateHopePolishPreservationEvaluationReceiptFile,
  validateHopePolishPreservationEvaluationReceiptSetFile,
  validateHopeWriteExampleEvaluationReceiptFile,
  validateHopeWriteExampleEvaluationReceiptSetFile,
  validateHopeWritePlainLanguageEvaluationReceiptFile,
  validateHopeWritePlainLanguageEvaluationReceiptSetFile,
  validateHopeWriteProductionVerificationReceiptFile,
  validateHopeWriteProductionVerificationReceiptSetFile,
} from "./index.mjs";

export const HOPE_MODEL_EVALUATION_COMMAND_ERROR_CODE =
  "HOPE_MODEL_EVALUATION_COMMAND";

export class HopeModelEvaluationCommandError extends Error {
  constructor(cause) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.code = HOPE_MODEL_EVALUATION_COMMAND_ERROR_CODE;
    this.name = "HopeModelEvaluationCommandError";
  }
}

export function asHopeModelEvaluationCommandError(error) {
  return error?.code === HOPE_MODEL_EVALUATION_COMMAND_ERROR_CODE
    ? error
    : new HopeModelEvaluationCommandError(error);
}

export function modelEvaluationErrorReport(error) {
  return Object.freeze({
    exitCode: 1,
    message: `hope model-evaluation: ${error.message}\n`,
  });
}

function usage() {
  return [
    "Use Hope model evaluations.",
    "",
    "Usage:",
    "  hope model-evaluation feature-selection-plan",
    "  hope model-evaluation feature-selection-prepare --case <id> --variant <minimal|full> --run <number>",
    "  hope model-evaluation feature-selection-oracle --case <id>",
    "  hope model-evaluation feature-selection-receipt --case <id> --variant <minimal|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope model-evaluation feature-selection-validate --input <receipt.json>",
    "  hope model-evaluation feature-selection-validate-set --input <receipts.json>",
    "  hope model-evaluation polish-preservation-plan",
    "  hope model-evaluation polish-preservation-prepare --case <id> --variant <invariants-only|full> --run <number>",
    "  hope model-evaluation polish-preservation-oracle --case <id>",
    "  hope model-evaluation polish-preservation-receipt --case <id> --variant <invariants-only|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope model-evaluation polish-preservation-validate --input <receipt.json>",
    "  hope model-evaluation polish-preservation-validate-set --input <receipts.json>",
    "  hope model-evaluation write-example-plan",
    "  hope model-evaluation write-example-prepare --case <id> --variant <rules-only|full> --run <number>",
    "  hope model-evaluation write-example-oracle --case <id>",
    "  hope model-evaluation write-example-receipt --case <id> --variant <rules-only|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope model-evaluation write-example-validate --input <receipt.json>",
    "  hope model-evaluation write-example-validate-set --input <receipts.json>",
    "  hope model-evaluation write-plain-language-plan",
    "  hope model-evaluation write-plain-language-prepare --case <id> --run <number>",
    "  hope model-evaluation write-plain-language-assessment-prepare --case <id> --run <number> --input <output.json>",
    "  hope model-evaluation write-plain-language-oracle --case <id>",
    "  hope model-evaluation write-plain-language-receipt --case <id> --run <number> --input <evaluated.json> --host <id> --model <id> --effort <level> --invocation <id> --evaluator-host <id> --evaluator-model <id> --evaluator-effort <level> --evaluator-invocation <id>",
    "  hope model-evaluation write-plain-language-validate --input <receipt.json>",
    "  hope model-evaluation write-plain-language-validate-set --input <receipts.json>",
    "  hope model-evaluation write-plain-language-comparison-plan",
    "  hope model-evaluation write-plain-language-comparison-prepare --case <id> --variant <baseline|current> --run <1|2|3>",
    "  hope model-evaluation write-plain-language-comparison-assessment-prepare --case <id> --run <1|2|3> --input <outputs.json>",
    "  hope model-evaluation write-plain-language-comparison-result --input <assessments.json>",
    "  hope model-evaluation write-production-plan",
    "  hope model-evaluation write-production-prepare --case <id> --run <number>",
    "  hope model-evaluation write-production-receipt --case <id> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope model-evaluation write-production-validate --input <receipt.json>",
    "  hope model-evaluation write-production-validate-set --input <receipts.json>",
    "",
    "Receipt commands create synthetic test evidence.",
    "Release evidence requires a trusted host adapter and complete-attempt ledger.",
  ].join("\n");
}

function required(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Hope model-evaluation option ${label} is required`);
  }
  return value;
}

function runNumber(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError("Hope model-evaluation --run must be a positive integer");
  }
  return number;
}

export function parseModelEvaluationArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...values] = argv;
  const commands = new Set([
    "feature-selection-oracle",
    "feature-selection-plan",
    "feature-selection-prepare",
    "feature-selection-receipt",
    "feature-selection-validate",
    "feature-selection-validate-set",
    "polish-preservation-oracle",
    "polish-preservation-plan",
    "polish-preservation-prepare",
    "polish-preservation-receipt",
    "polish-preservation-validate",
    "polish-preservation-validate-set",
    "write-example-oracle",
    "write-example-plan",
    "write-example-prepare",
    "write-example-receipt",
    "write-example-validate",
    "write-example-validate-set",
    "write-plain-language-assessment-prepare",
    "write-plain-language-comparison-assessment-prepare",
    "write-plain-language-comparison-plan",
    "write-plain-language-comparison-prepare",
    "write-plain-language-comparison-result",
    "write-plain-language-oracle",
    "write-plain-language-plan",
    "write-plain-language-prepare",
    "write-plain-language-receipt",
    "write-plain-language-validate",
    "write-plain-language-validate-set",
    "write-production-plan",
    "write-production-prepare",
    "write-production-receipt",
    "write-production-validate",
    "write-production-validate-set",
  ]);
  if (!commands.has(command)) throw new TypeError(usage());
  if (
    command === "feature-selection-plan"
    || command === "polish-preservation-plan"
    || command === "write-example-plan"
    || command === "write-plain-language-comparison-plan"
    || command === "write-plain-language-plan"
    || command === "write-production-plan"
  ) {
    if (values.length !== 0) throw new TypeError(usage());
    return { command };
  }
  if (command.startsWith("write-plain-language-")) {
    const allowed = command === "write-plain-language-receipt"
      ? [
        "case",
        "effort",
        "evaluator-effort",
        "evaluator-host",
        "evaluator-invocation",
        "evaluator-model",
        "host",
        "input",
        "invocation",
        "model",
        "run",
      ]
      : command === "write-plain-language-assessment-prepare"
        ? ["case", "input", "run"]
        : command === "write-plain-language-comparison-assessment-prepare"
          ? ["case", "input", "run"]
          : command === "write-plain-language-comparison-prepare"
            ? ["case", "run", "variant"]
        : command === "write-plain-language-prepare"
          ? ["case", "run"]
          : command === "write-plain-language-oracle"
            ? ["case"]
            : ["input"];
    const { options, positionals } = takeOptions(values, {
      allowed,
      prefix: "Hope model-evaluation",
    });
    if (positionals.length > 0) throw new TypeError(usage());
    if (command === "write-plain-language-comparison-result") {
      return { command, inputPath: required(options.input, "--input") };
    }
    if (command === "write-plain-language-oracle") {
      return { caseId: required(options.case, "--case"), command };
    }
    if (
      command === "write-plain-language-validate"
      || command === "write-plain-language-validate-set"
    ) {
      return { command, inputPath: required(options.input, "--input") };
    }
    const common = {
      caseId: required(options.case, "--case"),
      command,
      run: runNumber(options.run),
    };
    if (command === "write-plain-language-comparison-prepare") {
      const variant = required(options.variant, "--variant");
      if (!["baseline", "current"].includes(variant)) {
        throw new TypeError(
          `Unknown Hope model-evaluation variant: ${variant}`,
        );
      }
      return { ...common, variant };
    }
    if (command === "write-plain-language-prepare") return common;
    if (
      command === "write-plain-language-assessment-prepare"
      || command === "write-plain-language-comparison-assessment-prepare"
    ) {
      return {
        ...common,
        inputPath: required(options.input, "--input"),
      };
    }
    return {
      ...common,
      evaluatorEffort: required(options["evaluator-effort"], "--evaluator-effort"),
      evaluatorHost: required(options["evaluator-host"], "--evaluator-host"),
      evaluatorInvocationId: required(
        options["evaluator-invocation"],
        "--evaluator-invocation",
      ),
      evaluatorModel: required(options["evaluator-model"], "--evaluator-model"),
      inputPath: required(options.input, "--input"),
      writerEffort: required(options.effort, "--effort"),
      writerHost: required(options.host, "--host"),
      writerInvocationId: required(options.invocation, "--invocation"),
      writerModel: required(options.model, "--model"),
    };
  }
  const receiptCommand = command === "feature-selection-receipt"
    || command === "polish-preservation-receipt"
    || command === "write-example-receipt";
  const productionReceipt = command === "write-production-receipt";
  const prepareCommand = command === "feature-selection-prepare"
    || command === "polish-preservation-prepare"
    || command === "write-example-prepare";
  const productionPrepare = command === "write-production-prepare";
  const oracleCommand = command === "feature-selection-oracle"
    || command === "polish-preservation-oracle"
    || command === "write-example-oracle";
  const allowed = receiptCommand
    ? ["case", "effort", "host", "input", "invocation", "model", "run", "variant"]
    : productionReceipt
      ? ["case", "effort", "host", "input", "invocation", "model", "run"]
    : prepareCommand
      ? ["case", "run", "variant"]
      : productionPrepare
        ? ["case", "run"]
      : oracleCommand
        ? ["case"]
        : ["input"];
  const { options, positionals } = takeOptions(values, {
    allowed,
    prefix: "Hope model-evaluation",
  });
  if (positionals.length > 0) throw new TypeError(usage());
  if (oracleCommand) {
    return { caseId: required(options.case, "--case"), command };
  }
  if (
    command === "feature-selection-validate"
    || command === "feature-selection-validate-set"
    || command === "polish-preservation-validate"
    || command === "polish-preservation-validate-set"
    || command === "write-example-validate"
    || command === "write-example-validate-set"
    || command === "write-production-validate"
    || command === "write-production-validate-set"
  ) {
    return { command, inputPath: required(options.input, "--input") };
  }
  if (productionPrepare) {
    return {
      caseId: required(options.case, "--case"),
      command,
      run: runNumber(options.run),
    };
  }
  if (productionReceipt) {
    return {
      caseId: required(options.case, "--case"),
      command,
      effort: required(options.effort, "--effort"),
      host: required(options.host, "--host"),
      inputPath: required(options.input, "--input"),
      invocationId: required(options.invocation, "--invocation"),
      model: required(options.model, "--model"),
      run: runNumber(options.run),
    };
  }
  const variant = required(options.variant, "--variant");
  const variants = command.startsWith("write-example-")
    ? HOPE_WRITE_EXAMPLE_VARIANTS
    : command.startsWith("polish-preservation-")
      ? HOPE_POLISH_PRESERVATION_VARIANTS
      : HOPE_FEATURE_SELECTION_VARIANTS;
  if (!variants.includes(variant)) {
    throw new TypeError(`Unknown Hope model-evaluation variant: ${variant}`);
  }
  const common = {
    caseId: required(options.case, "--case"),
    command,
    run: runNumber(options.run),
    variant,
  };
  if (prepareCommand) return common;
  return {
    ...common,
    effort: required(options.effort, "--effort"),
    host: required(options.host, "--host"),
    inputPath: required(options.input, "--input"),
    invocationId: required(options.invocation, "--invocation"),
    model: required(options.model, "--model"),
  };
}

function writeJson(stdout, value) {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  return value;
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseModelEvaluationArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "feature-selection-plan") {
    return writeJson(
      stdout,
      (dependencies.createFeatureSelectionPlan
        ?? createHopeFeatureSelectionEvaluationPlan)(),
    );
  }
  if (options.command === "polish-preservation-plan") {
    return writeJson(
      stdout,
      (dependencies.createPolishPreservationPlan
        ?? createHopePolishPreservationEvaluationPlan)(),
    );
  }
  if (options.command === "write-example-plan") {
    return writeJson(
      stdout,
      (dependencies.createWriteExamplePlan
        ?? createHopeWriteExampleEvaluationPlan)(),
    );
  }
  if (options.command === "write-plain-language-comparison-plan") {
    return writeJson(
      stdout,
      (dependencies.createWritePlainLanguageComparisonPlan
        ?? createHopeWritePlainLanguageComparisonPlan)(),
    );
  }
  if (options.command === "write-plain-language-plan") {
    return writeJson(
      stdout,
      (dependencies.createWritePlainLanguagePlan
        ?? createHopeWritePlainLanguageEvaluationPlan)(),
    );
  }
  if (options.command === "write-production-plan") {
    return writeJson(
      stdout,
      (dependencies.createWriteProductionPlan
        ?? createHopeWriteProductionVerificationPlan)(),
    );
  }
  if (options.command === "feature-selection-prepare") {
    return writeJson(
      stdout,
      (dependencies.prepareFeatureSelectionRun
        ?? prepareHopeFeatureSelectionEvaluationRun)(options),
    );
  }
  if (options.command === "polish-preservation-prepare") {
    return writeJson(
      stdout,
      await (dependencies.preparePolishPreservationRun
        ?? prepareHopePolishPreservationEvaluationRun)(options),
    );
  }
  if (options.command === "write-example-prepare") {
    return writeJson(
      stdout,
      await (dependencies.prepareWriteExampleRun
        ?? prepareHopeWriteExampleEvaluationRun)(options),
    );
  }
  if (options.command === "write-plain-language-comparison-prepare") {
    return writeJson(
      stdout,
      await (dependencies.prepareWritePlainLanguageComparisonRun
        ?? prepareHopeWritePlainLanguageComparisonRun)(options),
    );
  }
  if (
    options.command
      === "write-plain-language-comparison-assessment-prepare"
  ) {
    return writeJson(
      stdout,
      await (dependencies.prepareWritePlainLanguageComparisonAssessmentFromFile
        ?? prepareHopeWritePlainLanguageComparisonAssessmentFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-plain-language-prepare") {
    return writeJson(
      stdout,
      await (dependencies.prepareWritePlainLanguageRun
        ?? prepareHopeWritePlainLanguageEvaluationRun)(options),
    );
  }
  if (options.command === "write-plain-language-assessment-prepare") {
    return writeJson(
      stdout,
      await (dependencies.prepareWritePlainLanguageAssessmentFromFile
        ?? prepareHopeWritePlainLanguageAssessmentFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-prepare") {
    return writeJson(
      stdout,
      await (dependencies.prepareWriteProductionRun
        ?? prepareHopeWriteProductionVerificationRun)(options),
    );
  }
  if (options.command === "feature-selection-oracle") {
    return writeJson(
      stdout,
      (dependencies.getFeatureSelectionOracle
        ?? getHopeFeatureSelectionEvaluationOracle)(options.caseId),
    );
  }
  if (options.command === "polish-preservation-oracle") {
    return writeJson(
      stdout,
      (dependencies.getPolishPreservationOracle
        ?? getHopePolishPreservationEvaluationOracle)(options.caseId),
    );
  }
  if (options.command === "write-example-oracle") {
    return writeJson(
      stdout,
      (dependencies.getWriteExampleOracle
        ?? getHopeWriteExampleEvaluationOracle)(options.caseId),
    );
  }
  if (options.command === "write-plain-language-oracle") {
    return writeJson(
      stdout,
      (dependencies.getWritePlainLanguageOracle
        ?? getHopeWritePlainLanguageEvaluationOracle)(options.caseId),
    );
  }
  if (options.command === "feature-selection-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createFeatureSelectionReceiptFromFile
        ?? createHopeFeatureSelectionEvaluationReceiptFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "polish-preservation-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createPolishPreservationReceiptFromFile
        ?? createHopePolishPreservationEvaluationReceiptFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-example-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createWriteExampleReceiptFromFile
        ?? createHopeWriteExampleEvaluationReceiptFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-plain-language-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createWritePlainLanguageReceiptFromFile
        ?? createHopeWritePlainLanguageEvaluationReceiptFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createWriteProductionReceiptFromFile
        ?? createHopeWriteProductionVerificationReceiptFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "feature-selection-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateFeatureSelectionReceiptFile
        ?? validateHopeFeatureSelectionEvaluationReceiptFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "polish-preservation-validate") {
    return writeJson(
      stdout,
      await (dependencies.validatePolishPreservationReceiptFile
        ?? validateHopePolishPreservationEvaluationReceiptFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "polish-preservation-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validatePolishPreservationReceiptSetFile
        ?? validateHopePolishPreservationEvaluationReceiptSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-example-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteExampleReceiptFile
        ?? validateHopeWriteExampleEvaluationReceiptFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-plain-language-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWritePlainLanguageReceiptFile
        ?? validateHopeWritePlainLanguageEvaluationReceiptFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-plain-language-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWritePlainLanguageReceiptSetFile
        ?? validateHopeWritePlainLanguageEvaluationReceiptSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteProductionReceiptFile
        ?? validateHopeWriteProductionVerificationReceiptFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteProductionReceiptSetFile
        ?? validateHopeWriteProductionVerificationReceiptSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-plain-language-comparison-result") {
    return writeJson(
      stdout,
      await (dependencies.createWritePlainLanguageComparisonResultFromFile
        ?? createHopeWritePlainLanguageComparisonResultFromFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-example-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteExampleReceiptSetFile
        ?? validateHopeWriteExampleEvaluationReceiptSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  return writeJson(
    stdout,
    await (dependencies.validateFeatureSelectionReceiptSetFile
      ?? validateHopeFeatureSelectionEvaluationReceiptSetFile)(
        options.inputPath,
        dependencies,
      ),
  );
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    const report = modelEvaluationErrorReport(
      asHopeModelEvaluationCommandError(error),
    );
    process.stderr.write(report.message);
    process.exitCode = report.exitCode;
  });
}
