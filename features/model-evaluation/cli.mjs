#!/usr/bin/env node

import { isEntrypoint } from "../../entrypoint/index.mjs";
import { takeOptions } from "../command-options/index.mjs";

import {
  createHopeFeatureSelectionEvaluationPlan,
  createHopeFeatureSelectionEvaluationRecordFromFile,
  createHopePolishPreservationEvaluationPlan,
  createHopePolishPreservationEvaluationRecordFromFile,
  createHopeWriteExampleEvaluationPlan,
  createHopeWriteExampleEvaluationRecordFromFile,
  createHopeWriteProductionVerificationPlan,
  createHopeWriteProductionVerificationRecordFromFile,
  getHopeFeatureSelectionEvaluationOracle,
  getHopePolishPreservationEvaluationOracle,
  getHopeWriteExampleEvaluationOracle,
  HOPE_FEATURE_SELECTION_VARIANTS,
  HOPE_POLISH_PRESERVATION_VARIANTS,
  HOPE_WRITE_EXAMPLE_VARIANTS,
  prepareHopeFeatureSelectionEvaluationRun,
  prepareHopePolishPreservationEvaluationRun,
  prepareHopeWriteExampleEvaluationRun,
  prepareHopeWriteProductionVerificationRun,
  validateHopeFeatureSelectionEvaluationRecordFile,
  validateHopeFeatureSelectionEvaluationRecordSetFile,
  validateHopePolishPreservationEvaluationRecordFile,
  validateHopePolishPreservationEvaluationRecordSetFile,
  validateHopeWriteExampleEvaluationRecordFile,
  validateHopeWriteExampleEvaluationRecordSetFile,
  validateHopeWriteProductionVerificationRecordFile,
  validateHopeWriteProductionVerificationRecordSetFile,
} from "./index.mjs";
import {
  hopeModelEvaluationHostAttestationStatus,
  loadHopeModelEvaluationHostAttestationAdapter,
  prepareHopeModelEvaluationEvidenceCommand,
} from "./host-attestation.mjs";

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
    "  hope model-evaluation host-attestation-status",
    "  hope model-evaluation feature-selection-plan",
    "  hope model-evaluation feature-selection-prepare --case <id> --variant <minimal|full> --run <number>",
    "  hope model-evaluation feature-selection-oracle --case <id>",
    "  hope model-evaluation feature-selection-record --case <id> --variant <minimal|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id> [--attestation <runner-attestation.json>]",
    "  hope model-evaluation feature-selection-validate --input <record.json>",
    "  hope model-evaluation feature-selection-validate-set --input <records.json>",
    "  hope model-evaluation polish-preservation-plan",
    "  hope model-evaluation polish-preservation-prepare --case <id> --variant <invariants-only|full> --run <number>",
    "  hope model-evaluation polish-preservation-oracle --case <id>",
    "  hope model-evaluation polish-preservation-record --case <id> --variant <invariants-only|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id> [--attestation <runner-attestation.json>]",
    "  hope model-evaluation polish-preservation-validate --input <record.json>",
    "  hope model-evaluation polish-preservation-validate-set --input <records.json>",
    "  hope model-evaluation write-example-plan",
    "  hope model-evaluation write-example-prepare --case <id> --variant <rules-only|full> --run <number>",
    "  hope model-evaluation write-example-oracle --case <id>",
    "  hope model-evaluation write-example-record --case <id> --variant <rules-only|full> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id> [--attestation <runner-attestation.json>]",
    "  hope model-evaluation write-example-validate --input <record.json>",
    "  hope model-evaluation write-example-validate-set --input <records.json>",
    "  hope model-evaluation write-production-plan",
    "  hope model-evaluation write-production-prepare --case <id> --run <number>",
    "  hope model-evaluation write-production-record --case <id> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id> [--attestation <runner-attestation.json>]",
    "  hope model-evaluation write-production-validate --input <record.json>",
    "  hope model-evaluation write-production-validate-set --input <records.json>",
    "",
    "Record commands create synthetic test evidence.",
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
  const [requestedCommand, ...values] = argv;
  const command = ({
    "feature-selection-receipt": "feature-selection-record",
    "polish-preservation-receipt": "polish-preservation-record",
    "write-example-receipt": "write-example-record",
    "write-production-receipt": "write-production-record",
  })[requestedCommand] ?? requestedCommand;
  const commands = new Set([
    "host-attestation-status",
    "feature-selection-oracle",
    "feature-selection-plan",
    "feature-selection-prepare",
    "feature-selection-record",
    "feature-selection-validate",
    "feature-selection-validate-set",
    "polish-preservation-oracle",
    "polish-preservation-plan",
    "polish-preservation-prepare",
    "polish-preservation-record",
    "polish-preservation-validate",
    "polish-preservation-validate-set",
    "write-example-oracle",
    "write-example-plan",
    "write-example-prepare",
    "write-example-record",
    "write-example-validate",
    "write-example-validate-set",
    "write-production-plan",
    "write-production-prepare",
    "write-production-record",
    "write-production-validate",
    "write-production-validate-set",
  ]);
  if (!commands.has(command)) throw new TypeError(usage());
  if (
    command === "host-attestation-status"
    || command === "feature-selection-plan"
    || command === "polish-preservation-plan"
    || command === "write-example-plan"
    || command === "write-production-plan"
  ) {
    if (values.length !== 0) throw new TypeError(usage());
    return { command };
  }
  const recordCommand = command === "feature-selection-record"
    || command === "polish-preservation-record"
    || command === "write-example-record";
  const productionRecord = command === "write-production-record";
  const prepareCommand = command === "feature-selection-prepare"
    || command === "polish-preservation-prepare"
    || command === "write-example-prepare";
  const productionPrepare = command === "write-production-prepare";
  const oracleCommand = command === "feature-selection-oracle"
    || command === "polish-preservation-oracle"
    || command === "write-example-oracle";
  const allowed = recordCommand
    ? ["attestation", "case", "effort", "host", "input", "invocation", "model", "run", "variant"]
    : productionRecord
      ? ["attestation", "case", "effort", "host", "input", "invocation", "model", "run"]
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
  if (productionRecord) {
    return {
      ...(options.attestation
        ? { attestationPath: options.attestation }
        : {}),
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
    ...(options.attestation
      ? { attestationPath: options.attestation }
      : {}),
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
  let options = parseModelEvaluationArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "host-attestation-status") {
    const adapter = await (
      dependencies.loadHostAttestationAdapter
        ?? loadHopeModelEvaluationHostAttestationAdapter
    )({
      cwd: dependencies.cwd ?? process.cwd(),
      environment: dependencies.environment ?? process.env,
      importModule: dependencies.importModule,
    });
    return writeJson(stdout, hopeModelEvaluationHostAttestationStatus(adapter));
  }
  if (
    options.command.endsWith("-record")
    || options.command.includes("-validate")
  ) {
    const prepared = await (
      dependencies.prepareEvidenceCommand
        ?? prepareHopeModelEvaluationEvidenceCommand
    )(options, dependencies);
    options = prepared.options;
    dependencies = prepared.dependencies;
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
  if (options.command === "feature-selection-record") {
    return writeJson(
      stdout,
      await (dependencies.createFeatureSelectionRecordFromFile
        ?? createHopeFeatureSelectionEvaluationRecordFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "polish-preservation-record") {
    return writeJson(
      stdout,
      await (dependencies.createPolishPreservationRecordFromFile
        ?? createHopePolishPreservationEvaluationRecordFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-example-record") {
    return writeJson(
      stdout,
      await (dependencies.createWriteExampleRecordFromFile
        ?? createHopeWriteExampleEvaluationRecordFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-record") {
    return writeJson(
      stdout,
      await (dependencies.createWriteProductionRecordFromFile
        ?? createHopeWriteProductionVerificationRecordFromFile)(
          options,
          dependencies,
        ),
    );
  }
  if (options.command === "feature-selection-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateFeatureSelectionRecordFile
        ?? validateHopeFeatureSelectionEvaluationRecordFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "polish-preservation-validate") {
    return writeJson(
      stdout,
      await (dependencies.validatePolishPreservationRecordFile
        ?? validateHopePolishPreservationEvaluationRecordFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "polish-preservation-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validatePolishPreservationRecordSetFile
        ?? validateHopePolishPreservationEvaluationRecordSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-example-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteExampleRecordFile
        ?? validateHopeWriteExampleEvaluationRecordFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-validate") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteProductionRecordFile
        ?? validateHopeWriteProductionVerificationRecordFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-production-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteProductionRecordSetFile
        ?? validateHopeWriteProductionVerificationRecordSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  if (options.command === "write-example-validate-set") {
    return writeJson(
      stdout,
      await (dependencies.validateWriteExampleRecordSetFile
        ?? validateHopeWriteExampleEvaluationRecordSetFile)(
          options.inputPath,
          dependencies,
        ),
    );
  }
  return writeJson(
    stdout,
    await (dependencies.validateFeatureSelectionRecordSetFile
      ?? validateHopeFeatureSelectionEvaluationRecordSetFile)(
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
