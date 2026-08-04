#!/usr/bin/env node

import { isEntrypoint } from "../../entrypoint/index.mjs";
import { takeOptions } from "../command-options/index.mjs";

import {
  createHopeFeatureSelectionEvaluationPlan,
  createHopeFeatureSelectionEvaluationReceiptFromFile,
  createHopeWriteExampleEvaluationPlan,
  createHopeWriteExampleEvaluationReceiptFromFile,
  createHopeWriteProductionVerificationPlan,
  createHopeWriteProductionVerificationReceiptFromFile,
  getHopeFeatureSelectionEvaluationOracle,
  getHopeWriteExampleEvaluationOracle,
  HOPE_FEATURE_SELECTION_VARIANTS,
  HOPE_WRITE_EXAMPLE_VARIANTS,
  prepareHopeFeatureSelectionEvaluationRun,
  prepareHopeWriteExampleEvaluationRun,
  prepareHopeWriteProductionVerificationRun,
  validateHopeFeatureSelectionEvaluationReceiptFile,
  validateHopeFeatureSelectionEvaluationReceiptSetFile,
  validateHopeWriteExampleEvaluationReceiptFile,
  validateHopeWriteExampleEvaluationReceiptSetFile,
  validateHopeWriteProductionVerificationReceiptFile,
  validateHopeWriteProductionVerificationReceiptSetFile,
} from "./index.mjs";

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
    "  hope model-evaluation write-example-plan",
    "  hope model-evaluation write-example-prepare --case <id> --variant <rules-only|full> --run <number>",
    "  hope model-evaluation write-example-oracle --case <id>",
    "  hope model-evaluation write-example-receipt --case <id> --variant <rules-only|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope model-evaluation write-example-validate --input <receipt.json>",
    "  hope model-evaluation write-example-validate-set --input <receipts.json>",
    "  hope model-evaluation write-production-plan",
    "  hope model-evaluation write-production-prepare --case <id> --run <number>",
    "  hope model-evaluation write-production-receipt --case <id> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope model-evaluation write-production-validate --input <receipt.json>",
    "  hope model-evaluation write-production-validate-set --input <receipts.json>",
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
    "write-example-oracle",
    "write-example-plan",
    "write-example-prepare",
    "write-example-receipt",
    "write-example-validate",
    "write-example-validate-set",
    "write-production-plan",
    "write-production-prepare",
    "write-production-receipt",
    "write-production-validate",
    "write-production-validate-set",
  ]);
  if (!commands.has(command)) throw new TypeError(usage());
  if (
    command === "feature-selection-plan"
    || command === "write-example-plan"
    || command === "write-production-plan"
  ) {
    if (values.length !== 0) throw new TypeError(usage());
    return { command };
  }
  const receiptCommand = command === "feature-selection-receipt"
    || command === "write-example-receipt";
  const productionReceipt = command === "write-production-receipt";
  const prepareCommand = command === "feature-selection-prepare"
    || command === "write-example-prepare";
  const productionPrepare = command === "write-production-prepare";
  const oracleCommand = command === "feature-selection-oracle"
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
  if (options.command === "write-example-plan") {
    return writeJson(
      stdout,
      (dependencies.createWriteExamplePlan
        ?? createHopeWriteExampleEvaluationPlan)(),
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
  if (options.command === "write-example-prepare") {
    return writeJson(
      stdout,
      await (dependencies.prepareWriteExampleRun
        ?? prepareHopeWriteExampleEvaluationRun)(options),
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
  if (options.command === "write-example-oracle") {
    return writeJson(
      stdout,
      (dependencies.getWriteExampleOracle
        ?? getHopeWriteExampleEvaluationOracle)(options.caseId),
    );
  }
  if (options.command === "feature-selection-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createFeatureSelectionReceiptFromFile
        ?? createHopeFeatureSelectionEvaluationReceiptFromFile)(options),
    );
  }
  if (options.command === "write-example-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createWriteExampleReceiptFromFile
        ?? createHopeWriteExampleEvaluationReceiptFromFile)(options),
    );
  }
  if (options.command === "write-production-receipt") {
    return writeJson(
      stdout,
      await (dependencies.createWriteProductionReceiptFromFile
        ?? createHopeWriteProductionVerificationReceiptFromFile)(options),
    );
  }
  if (options.command === "feature-selection-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateFeatureSelectionReceiptFile
        ?? validateHopeFeatureSelectionEvaluationReceiptFile)(options.inputPath),
    );
  }
  if (options.command === "write-example-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteExampleReceiptFile
        ?? validateHopeWriteExampleEvaluationReceiptFile)(options.inputPath),
    );
  }
  if (options.command === "write-production-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteProductionReceiptFile
        ?? validateHopeWriteProductionVerificationReceiptFile)(
          options.inputPath,
        ),
    );
  }
  if (options.command === "write-production-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteProductionReceiptSetFile
        ?? validateHopeWriteProductionVerificationReceiptSetFile)(
          options.inputPath,
        ),
    );
  }
  if (options.command === "write-example-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteExampleReceiptSetFile
        ?? validateHopeWriteExampleEvaluationReceiptSetFile)(options.inputPath),
    );
  }
  return writeJson(
    stdout,
    await (dependencies.validateFeatureSelectionReceiptSetFile
      ?? validateHopeFeatureSelectionEvaluationReceiptSetFile)(options.inputPath),
  );
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`hope model-evaluation: ${error.message}\n`);
    process.exitCode = 1;
  });
}
