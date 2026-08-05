#!/usr/bin/env node
// Generated from features/sweep/cli.mjs. Do not edit.

import { isEntrypoint } from "../../entrypoint/index.mjs";
import { takeOptions } from "../command-options/index.mjs";
import {
  createSweepApprovalCandidateFile,
  createSweepApprovalReceiptFile,
  createSweepBrief,
  createSweepInventory,
  createSweepModelEvaluationPlan,
  createSweepModelEvaluationReceiptFile,
  getSweepModelEvaluationOracle,
  prepareSweepModelEvaluationRun,
  runSweep,
  SWEEP_MODEL_ADAPTER_CODE,
  validateSweepCompletionFile,
  validateSweepModelEvaluationReceiptFile,
  validateSweepModelEvaluationReceiptSetFile,
  validateSweepPlanFile,
  validateSweepSessionResultFile,
} from "./index.mjs";

function usage() {
  return [
    "Use the Hope sweep feature.",
    "",
    "The automatic AI path is provided by the Hope Sweep Skill.",
    "",
    "Internal Skill protocol:",
    "  hope sweep brief [--risk <low|medium|high>]",
    "  hope sweep inventory [--root <repository-root>]",
    "  hope sweep validate-plan --input <plan.json> [--inventory <inventory.json>]",
    "  hope sweep approval-candidate --input <plan.json> --candidate <id> [--inventory <inventory.json>]",
    "  hope sweep approval-receipt --input <approval.json>",
    "  hope sweep validate-completion --input <completion.json>",
    "  hope sweep validate-session-result --input <session-result.json>",
    "  hope sweep model-evaluation-plan",
    "  hope sweep model-evaluation-prepare --case <id> --run <number>",
    "  hope sweep model-evaluation-oracle --case <id>",
    "  hope sweep model-evaluation-receipt --case <id> --run <number> --input <output.json> --host <id> --model <id> --effort <level> --invocation <id>",
    "  hope sweep model-evaluation-validate --input <receipt.json>",
    "  hope sweep model-evaluation-validate-set --input <receipts.json>",
  ].join("\n");
}

export function parseSweepArguments(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help" };
  }
  const [command, ...rest] = argv;
  if (
    ![
      "brief",
      "inventory",
      "validate-plan",
      "approval-candidate",
      "approval-receipt",
      "validate-completion",
      "validate-session-result",
      "model-evaluation-plan",
      "model-evaluation-prepare",
      "model-evaluation-oracle",
      "model-evaluation-receipt",
      "model-evaluation-validate",
      "model-evaluation-validate-set",
    ].includes(command)
  ) {
    return { arguments: argv, command: "automatic" };
  }
  const { options, positionals } = takeOptions(rest, {
    allowed: [
      "candidate",
      "case",
      "effort",
      "host",
      "input",
      "invocation",
      "inventory",
      "model",
      "risk",
      "root",
      "run",
    ],
    prefix: "Hope sweep",
  });
  if (positionals.length > 0) throw new TypeError(usage());
  const evaluationKeys = [
    "case",
    "effort",
    "host",
    "invocation",
    "model",
    "run",
  ];
  const hasOnly = (keys) => Object.keys(options).every((key) => keys.includes(key));
  const run = () => {
    if (!/^[1-9][0-9]*$/u.test(options.run ?? "")) {
      throw new TypeError(usage());
    }
    return Number(options.run);
  };
  if (command === "model-evaluation-plan") {
    if (!hasOnly([])) throw new TypeError(usage());
    return { command };
  }
  if (command === "model-evaluation-prepare") {
    if (!options.case || !options.run || !hasOnly(["case", "run"])) {
      throw new TypeError(usage());
    }
    return { caseId: options.case, command, run: run() };
  }
  if (command === "model-evaluation-oracle") {
    if (!options.case || !hasOnly(["case"])) throw new TypeError(usage());
    return { caseId: options.case, command };
  }
  if (command === "model-evaluation-receipt") {
    if (
      !options.case
      || !options.run
      || !options.input
      || !options.host
      || !options.model
      || !options.effort
      || !options.invocation
      || !hasOnly([
        "case",
        "run",
        "input",
        "host",
        "model",
        "effort",
        "invocation",
      ])
    ) {
      throw new TypeError(usage());
    }
    return {
      caseId: options.case,
      command,
      effort: options.effort,
      host: options.host,
      inputPath: options.input,
      invocationId: options.invocation,
      model: options.model,
      run: run(),
    };
  }
  if (["model-evaluation-validate", "model-evaluation-validate-set"].includes(command)) {
    if (!options.input || !hasOnly(["input"])) throw new TypeError(usage());
    return { command, inputPath: options.input };
  }
  if (command === "brief") {
    if (!hasOnly(["risk"])) throw new TypeError(usage());
    return { command, risk: options.risk };
  }
  if (command === "inventory") {
    if (!hasOnly(["root"])) throw new TypeError(usage());
    return { command, root: options.root };
  }
  if (command === "approval-candidate") {
    if (
      !options.candidate
      || !options.input
      || !hasOnly(["candidate", "input", "inventory"])
    ) {
      throw new TypeError(usage());
    }
    return {
      candidateId: options.candidate,
      command,
      inputPath: options.input,
      ...(options.inventory ? { inventoryPath: options.inventory } : {}),
    };
  }
  if (
    !options.input
    || options.candidate
    || !hasOnly(command === "validate-plan" ? ["input", "inventory"] : ["input"])
  ) {
    throw new TypeError(usage());
  }
  return {
    command,
    inputPath: options.input,
    ...(options.inventory ? { inventoryPath: options.inventory } : {}),
  };
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseSweepArguments(argv);
  const stdout = dependencies.stdout ?? process.stdout;
  let result;
  if (options.command === "help") {
    stdout.write(`${usage()}\n`);
    return;
  }
  if (options.command === "automatic") {
    return await (dependencies.runSweep ?? runSweep)(
      options.arguments,
      dependencies,
    );
  }
  if (options.command === "brief") {
    result = await (dependencies.createSweepBrief ?? createSweepBrief)(
      options,
      dependencies,
    );
  } else if (options.command === "inventory") {
    result = await (dependencies.createSweepInventory ?? createSweepInventory)(
      { cwd: options.root },
      dependencies,
    );
  } else if (options.command === "validate-plan") {
    result = await (
      dependencies.validateSweepPlanFile ?? validateSweepPlanFile
    )(options.inputPath, { ...dependencies, inventoryPath: options.inventoryPath });
  } else if (options.command === "approval-candidate") {
    result = await (
      dependencies.createSweepApprovalCandidateFile
      ?? createSweepApprovalCandidateFile
    )(options.inputPath, options.candidateId, {
      ...dependencies,
      inventoryPath: options.inventoryPath,
    });
  } else if (options.command === "approval-receipt") {
    result = await (
      dependencies.createSweepApprovalReceiptFile
      ?? createSweepApprovalReceiptFile
    )(options.inputPath, dependencies);
  } else if (options.command === "model-evaluation-plan") {
    result = (dependencies.createSweepModelEvaluationPlan
      ?? createSweepModelEvaluationPlan)();
  } else if (options.command === "model-evaluation-prepare") {
    result = await (dependencies.prepareSweepModelEvaluationRun
      ?? prepareSweepModelEvaluationRun)(options, dependencies);
  } else if (options.command === "model-evaluation-oracle") {
    result = (dependencies.getSweepModelEvaluationOracle
      ?? getSweepModelEvaluationOracle)(options.caseId);
  } else if (options.command === "model-evaluation-receipt") {
    result = await (dependencies.createSweepModelEvaluationReceiptFile
      ?? createSweepModelEvaluationReceiptFile)(options, dependencies);
  } else if (options.command === "model-evaluation-validate") {
    result = await (dependencies.validateSweepModelEvaluationReceiptFile
      ?? validateSweepModelEvaluationReceiptFile)(options.inputPath, dependencies);
  } else if (options.command === "model-evaluation-validate-set") {
    result = await (dependencies.validateSweepModelEvaluationReceiptSetFile
      ?? validateSweepModelEvaluationReceiptSetFile)(options.inputPath, dependencies);
  } else if (options.command === "validate-completion") {
    result = await (
      dependencies.validateSweepCompletionFile
      ?? validateSweepCompletionFile
    )(options.inputPath, dependencies);
  } else {
    result = await (
      dependencies.validateSweepSessionResultFile
      ?? validateSweepSessionResultFile
    )(options.inputPath, dependencies);
  }
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (isEntrypoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`hope sweep: ${error.message}\n`);
    process.exitCode = error.code === SWEEP_MODEL_ADAPTER_CODE ? 2 : 1;
  });
}
