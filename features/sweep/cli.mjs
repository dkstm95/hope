#!/usr/bin/env node

import { isEntrypoint } from "../../entrypoint/index.mjs";
import { takeOptions } from "../command-options/index.mjs";
import {
  createSweepApprovalCandidateFile,
  createSweepApprovalReceiptFile,
  createSweepBrief,
  completeSweepInventoryBatchFile,
  createSweepInventoryBatchInputFile,
  discoverSweepInventoryFile,
  createSweepModelEvaluationPlan,
  createSweepModelEvaluationReceiptFile,
  getSweepModelEvaluationOracle,
  prepareSweepModelEvaluationRun,
  runSweep,
  startSweepInventoryBatchFile,
  SWEEP_MODEL_ADAPTER_CODE,
  validateSweepInventoryFile,
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
    "  hope sweep discover-inventory --root <repository> --session <id> [--title <text>] [--scope <text>] [--batch-size <number>]",
    "  hope sweep validate-inventory --input <inventory.json> [--root <repository>]",
    "  hope sweep batch-input --input <inventory.json> --batch <id>",
    "  hope sweep start-batch --input <inventory.json> --batch <id> --mode <single|parallel|sequential> [--workers <id,id,...>]",
    "  hope sweep complete-batch --input <inventory.json> --batch <id> --result <result.json>",
    "  hope sweep validate-plan --input <plan.json> [--root <repository>]",
    "  hope sweep approval-candidate --input <plan.json> --candidate <id>",
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
      "discover-inventory",
      "validate-inventory",
      "batch-input",
      "start-batch",
      "complete-batch",
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
      "batch",
      "batch-size",
      "case",
      "effort",
      "host",
      "input",
      "invocation",
      "model",
      "risk",
      "root",
      "mode",
      "result",
      "run",
      "scope",
      "session",
      "title",
      "workers",
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
  if (command === "discover-inventory") {
    if (
      !options.root
      || !options.session
      || !hasOnly(["root", "session", "title", "scope", "batch-size"])
    ) {
      throw new TypeError(usage());
    }
    const batchSize = options["batch-size"] === undefined
      ? undefined
      : Number(options["batch-size"]);
    if (
      batchSize !== undefined
      && (!Number.isSafeInteger(batchSize) || String(batchSize) !== options["batch-size"])
    ) {
      throw new TypeError(usage());
    }
    return {
      batchSize,
      command,
      root: options.root,
      scope: options.scope,
      sessionId: options.session,
      title: options.title,
    };
  }
  if (command === "validate-inventory") {
    if (!options.input || !hasOnly(["input", "root"])) throw new TypeError(usage());
    return { command, inputPath: options.input, repositoryRoot: options.root };
  }
  if (command === "batch-input") {
    if (!options.input || !options.batch || !hasOnly(["input", "batch"])) {
      throw new TypeError(usage());
    }
    return { batchId: options.batch, command, inputPath: options.input };
  }
  if (command === "start-batch") {
    if (
      !options.input
      || !options.batch
      || !options.mode
      || !hasOnly(["input", "batch", "mode", "workers"])
    ) {
      throw new TypeError(usage());
    }
    const workerIds = options.workers
      ? options.workers.split(",").filter((workerId) => workerId.length > 0)
      : [];
    if (options.workers && workerIds.length === 0) throw new TypeError(usage());
    return {
      batchId: options.batch,
      command,
      execution: { mode: options.mode, workerIds },
      inputPath: options.input,
    };
  }
  if (command === "complete-batch") {
    if (
      !options.input
      || !options.batch
      || !options.result
      || !hasOnly(["input", "batch", "result"])
    ) {
      throw new TypeError(usage());
    }
    return {
      batchId: options.batch,
      command,
      inputPath: options.input,
      resultPath: options.result,
    };
  }
  if (command === "validate-plan") {
    if (!options.input || !hasOnly(["input", "root"])) throw new TypeError(usage());
    return { command, inputPath: options.input, repositoryRoot: options.root };
  }
  if (evaluationKeys.some((key) => options[key]) || options.risk || !options.input) {
    throw new TypeError(usage());
  }
  if (command === "approval-candidate") {
    if (!options.candidate) throw new TypeError(usage());
    return {
      candidateId: options.candidate,
      command,
      inputPath: options.input,
    };
  }
  if (options.candidate) throw new TypeError(usage());
  return { command, inputPath: options.input };
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
  } else if (options.command === "discover-inventory") {
    result = await (
      dependencies.discoverSweepInventoryFile ?? discoverSweepInventoryFile
    )(options, dependencies);
  } else if (options.command === "validate-inventory") {
    result = await (
      dependencies.validateSweepInventoryFile ?? validateSweepInventoryFile
    )(options.inputPath, {
      ...dependencies,
      repositoryRoot: options.repositoryRoot,
    });
  } else if (options.command === "batch-input") {
    result = await (
      dependencies.createSweepInventoryBatchInputFile
      ?? createSweepInventoryBatchInputFile
    )(options.inputPath, options.batchId, dependencies);
  } else if (options.command === "start-batch") {
    result = await (
      dependencies.startSweepInventoryBatchFile
      ?? startSweepInventoryBatchFile
    )(options.inputPath, options.batchId, options.execution, dependencies);
  } else if (options.command === "complete-batch") {
    result = await (
      dependencies.completeSweepInventoryBatchFile
      ?? completeSweepInventoryBatchFile
    )(options.inputPath, options.batchId, options.resultPath, dependencies);
  } else if (options.command === "validate-plan") {
    result = await (
      dependencies.validateSweepPlanFile ?? validateSweepPlanFile
    )(options.inputPath, {
      ...dependencies,
      repositoryRoot: options.repositoryRoot,
    });
  } else if (options.command === "approval-candidate") {
    result = await (
      dependencies.createSweepApprovalCandidateFile
      ?? createSweepApprovalCandidateFile
    )(options.inputPath, options.candidateId, dependencies);
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
