import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createSweepInventory,
  createSweepInventoryBatchResult,
  createSweepBrief,
  createSweepModelEvaluationPlan,
  createSweepModelEvaluationReceipt,
  getSweepModelEvaluationOracle,
  getSweepInventoryBatch,
  startSweepInventoryBatch,
  sweepInventoryBatchDigest,
  sweepInventoryDigest,
  sweepInventoryManifestDigest,
  SWEEP_MODEL_ADAPTER_MESSAGE,
} from "../features/sweep/index.mjs";
import {
  validateSweepApprovalReceipt,
  validateSweepCompletion,
  validateSweepPlan,
  validateSweepSessionResult,
  sweepPlanDigest,
} from "../features/sweep/validate.mjs";
import { main, parseArguments } from "../harness/hope.mjs";
import {
  makeSweepCompletion,
  makeSweepApprovalCandidate,
  makeSweepApprovalReceipt,
  makeSweepPlan,
  makeSweepSessionResult,
  sweepApprovalDependencies,
} from "../test-support/sweep-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runJson(script, arguments_) {
  const run = spawnSync(process.execPath, [resolve(root, script), ...arguments_], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

function runFailure(script, arguments_) {
  const run = spawnSync(process.execPath, [resolve(root, script), ...arguments_], {
    encoding: "utf8",
  });
  assert.notEqual(run.status, 0, run.stdout);
  return run.stderr.replace(/^hope(?: sweep)?: /u, "");
}

function withoutSchemaPaths(value) {
  const {
    batchResultSchemaPath,
    inventorySchemaPath,
    planSchemaPath,
    approvalSchemaPath,
    completionSchemaPath,
    sessionResultSchemaPath,
    ...rest
  } = value;
  assert.ok(planSchemaPath);
  assert.ok(inventorySchemaPath);
  assert.ok(batchResultSchemaPath);
  assert.ok(approvalSchemaPath);
  assert.ok(completionSchemaPath);
  assert.ok(sessionResultSchemaPath);
  return rest;
}

function makeTwoTrackInventory() {
  const digest = `sha256:${"a".repeat(64)}`;
  const files = [{
    id: "file-1",
    path: "src/file-1.mjs",
    kind: "tracked",
    digest,
  }];
  const exclusions = [];
  const revision = "1".repeat(40);
  return createSweepInventory({
    title: "Two-track inventory",
    sessionId: "two-track-session",
    scope: "Every project-owned file",
    snapshot: {
      capturedAt: "2026-08-05T00:00:00.000Z",
      sources: [{
        id: "repo",
        kind: "git",
        label: "Repository head",
        locator: "git:example/hope",
        revision,
      }],
    },
    discovery: {
      protocol: "git-worktree-v1",
      repository: "/tmp/hope-test",
      revision,
      manifestDigest: sweepInventoryManifestDigest(files, exclusions),
      verifiedAt: "2026-08-05T00:00:00.000Z",
    },
    files,
    exclusions,
  });
}

test("the harness parses and delegates Sweep", async () => {
  assert.deepEqual(parseArguments(["sweep"]), {
    arguments: [],
    command: "sweep",
  });
  const writingPass = {
    input: { mode: "edit" },
    response: { mode: "draft" },
  };
  let received;
  await main(["sweep"], {
    createTaskWritingPass: async () => writingPass,
    runSweepCommand: async (arguments_, context) => {
      received = [arguments_, context.writingPass];
    },
  });
  assert.deepEqual(received, [["automatic"], writingPass]);
});

test("core and generated Sweep reach the same contracts", async () => {
  const plugin = await import(
    "../plugins/hope/runtime/features/sweep/index.mjs"
  );
  const pluginValidator = await import(
    "../plugins/hope/runtime/features/sweep/validate.mjs"
  );
  const pluginInventory = await import(
    "../plugins/hope/runtime/features/sweep/inventory.mjs"
  );
  const dependencies = {
    loadWritingStandard: async () => "shared standard\n",
  };
  const [coreBrief, pluginBrief] = await Promise.all([
    createSweepBrief({ risk: "medium" }, dependencies),
    plugin.createSweepBrief({ risk: "medium" }, dependencies),
  ]);
  assert.deepEqual(
    withoutSchemaPaths(pluginBrief),
    withoutSchemaPaths(coreBrief),
  );
  assert.deepEqual(
    pluginValidator.validateSweepPlan(makeSweepPlan()),
    validateSweepPlan(makeSweepPlan()),
  );
  const inventory = makeTwoTrackInventory();
  assert.deepEqual(
    pluginInventory.validateSweepInventory(inventory, {
      inputFileBytes: inventory.resources.inputFileBytes,
    }),
    inventory,
  );
  assert.equal(
    pluginInventory.sweepInventoryDigest(inventory),
    sweepInventoryDigest(inventory),
  );
  assert.deepEqual(
    pluginValidator.validateSweepApprovalReceipt(
      makeSweepApprovalReceipt(),
      sweepApprovalDependencies,
    ),
    validateSweepApprovalReceipt(
      makeSweepApprovalReceipt(),
      sweepApprovalDependencies,
    ),
  );
  assert.deepEqual(
    pluginValidator.validateSweepCompletion(
      makeSweepCompletion(),
      sweepApprovalDependencies,
    ),
    validateSweepCompletion(makeSweepCompletion(), sweepApprovalDependencies),
  );
  assert.deepEqual(
    pluginValidator.validateSweepSessionResult(
      makeSweepSessionResult(),
      sweepApprovalDependencies,
    ),
    validateSweepSessionResult(
      makeSweepSessionResult(),
      sweepApprovalDependencies,
    ),
  );
});

test("harness and generated Sweep report the same missing AI boundary", () => {
  const harness = spawnSync(
    process.execPath,
    [resolve(root, "harness/hope.mjs"), "sweep"],
    { encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [resolve(root, "plugins/hope/runtime/features/sweep/cli.mjs"), "automatic"],
    { encoding: "utf8" },
  );
  assert.equal(harness.status, 2, harness.stderr);
  assert.equal(plugin.status, 2, plugin.stderr);
  assert.match(harness.stderr, new RegExp(SWEEP_MODEL_ADAPTER_MESSAGE, "u"));
  assert.match(plugin.stderr, new RegExp(SWEEP_MODEL_ADAPTER_MESSAGE, "u"));
});

test("exact harness and generated Sweep commands stay equivalent", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-sweep-two-track-");
  const planPath = join(temporaryRoot, "plan.json");
  const completionPath = join(temporaryRoot, "completion.json");
  const approvalPath = join(temporaryRoot, "approval.json");
  const sessionResultPath = join(temporaryRoot, "session-result.json");
  const inventoryPath = join(temporaryRoot, "inventory.json");
  const pluginInventoryPath = join(temporaryRoot, "plugin-inventory.json");
  const harnessInventoryPath = join(temporaryRoot, "harness-inventory.json");
  const batchResultPath = join(temporaryRoot, "batch-result.json");
  const invalidPlanPath = join(temporaryRoot, "invalid-plan.json");
  const evaluationOutputPath = join(temporaryRoot, "evaluation-output.json");
  const evaluationReceiptsPath = join(temporaryRoot, "evaluation-receipts.json");
  const invalidEvaluationReceiptsPath = join(
    temporaryRoot,
    "invalid-evaluation-receipts.json",
  );
  const approvalCandidate = makeSweepApprovalCandidate();
  const approvalReceipt = makeSweepCompletion().approvalReceipt;
  const invalidPlan = makeSweepPlan();
  invalidPlan.candidates[0].evidenceChecks[0].sourceIds = [];
  const noCandidatePlan = makeSweepPlan();
  noCandidatePlan.candidates = [];
  noCandidatePlan.session.state = "complete-no-change";
  const sessionResult = {
    version: 1,
    title: "Complete a no-change Sweep session",
    plan: noCandidatePlan,
    planDigest: sweepPlanDigest(noCandidatePlan),
    completions: [],
    candidateResults: [],
    summary: {
      state: "complete",
      assessment: "The checked scope produced no candidate.",
      remainingGaps: [],
    },
  };
  const inventory = makeTwoTrackInventory();
  const batchInput = getSweepInventoryBatch(inventory, "batch-1");
  const startedInventory = startSweepInventoryBatch(
    inventory,
    "batch-1",
    { mode: "single", workerIds: [] },
  );
  const batchResult = createSweepInventoryBatchResult({
    batchId: "batch-1",
    inventoryDigest: batchInput.inventoryDigest,
    inputDigest: sweepInventoryBatchDigest(batchInput),
    state: "complete",
    execution: startedInventory.batches[0].execution,
    receipts: [{
      workerId: "host",
      processedSourceIds: ["file-1"],
      gaps: [],
    }],
  });
  const evaluationPlan = createSweepModelEvaluationPlan();
  const evaluationReceipts = [];
  for (const specification of evaluationPlan.runs) {
    const oracle = getSweepModelEvaluationOracle(specification.caseId).oracle;
    const output = {
      categoryId: oracle.categoryId,
      checkId: oracle.checkId,
      decision: oracle.decision,
      impacts: oracle.impacts ? { ...oracle.impacts } : null,
      targetPaths: [...oracle.requiredTargetPaths],
      unsupportedCategoryIds: [],
      reason: "The synthetic repository supports this bounded result.",
    };
    const invocationId = `two-track-${specification.caseId}`;
    evaluationReceipts.push((await createSweepModelEvaluationReceipt({
      ...specification,
      host: "codex-test-host",
      model: "test-model",
      effort: "test-effort",
      invocationId,
      output,
      runnerEvidence: {
        runner: "hope-two-track-runner",
        rawOutput: JSON.stringify(output),
        events: [
          { type: "thread.started", thread_id: invocationId },
          { type: "turn.started" },
          {
            type: "item.completed",
            item: { type: "agent_message", text: JSON.stringify(output) },
          },
          { type: "turn.completed" },
        ],
      },
    })).receipt);
  }
  await Promise.all([
    writeFile(planPath, JSON.stringify(makeSweepPlan()), { mode: 0o600 }),
    writeFile(completionPath, JSON.stringify(makeSweepCompletion()), {
      mode: 0o600,
    }),
    writeFile(approvalPath, JSON.stringify({
      approvalCandidate,
      decision: "approved",
      authoritySource: approvalReceipt.authoritySource,
      hostAttestation: approvalReceipt.hostAttestation,
    }), { mode: 0o600 }),
    writeFile(sessionResultPath, JSON.stringify(sessionResult), { mode: 0o600 }),
    writeFile(inventoryPath, JSON.stringify(inventory), { mode: 0o600 }),
    writeFile(pluginInventoryPath, JSON.stringify(inventory), { mode: 0o600 }),
    writeFile(harnessInventoryPath, JSON.stringify(inventory), { mode: 0o600 }),
    writeFile(batchResultPath, JSON.stringify(batchResult), { mode: 0o600 }),
    writeFile(invalidPlanPath, JSON.stringify(invalidPlan), { mode: 0o600 }),
    writeFile(evaluationOutputPath, JSON.stringify({
      categoryId: "unused-stale",
      checkId: "dead-code",
      decision: "polish",
      impacts: {
        behavior: "preserving",
        publicContract: "preserving",
        dependency: "preserving",
      },
      targetPaths: ["src/unused-helper.mjs"],
      unsupportedCategoryIds: [],
      reason: "The private helper has no supported reference or contract.",
    }), { mode: 0o600 }),
    writeFile(
      evaluationReceiptsPath,
      JSON.stringify(evaluationReceipts),
      { mode: 0o600 },
    ),
    writeFile(
      invalidEvaluationReceiptsPath,
      JSON.stringify(evaluationReceipts.slice(1)),
      { mode: 0o600 },
    ),
  ]);
  const brief = ["brief", "--risk", "high"];
  assert.deepEqual(
    withoutSchemaPaths(runJson(
      "plugins/hope/runtime/features/sweep/cli.mjs",
      brief,
    )),
    withoutSchemaPaths(runJson("harness/hope.mjs", ["sweep", ...brief])),
  );
  for (const [command, arguments_] of [
    ["validate-inventory", ["--input", inventoryPath]],
    ["batch-input", ["--input", inventoryPath, "--batch", "batch-1"]],
    ["start-batch", [
      "--input",
      inventoryPath,
      "--batch",
      "batch-1",
      "--mode",
      "single",
    ]],
    ["complete-batch", [
      "--input",
      inventoryPath,
      "--batch",
      "batch-1",
      "--result",
      batchResultPath,
    ]],
    ["validate-plan", ["--input", planPath]],
    ["validate-session-result", ["--input", sessionResultPath]],
  ]) {
    if (command === "start-batch") {
      const pluginStarted = runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
        command,
        ...arguments_.map((argument) => argument === inventoryPath ? pluginInventoryPath : argument),
      ]);
      const harnessStarted = runJson("harness/hope.mjs", [
        "sweep",
        command,
        ...arguments_.map((argument) => argument === inventoryPath ? harnessInventoryPath : argument),
      ]);
      assert.deepEqual(pluginStarted, harnessStarted);
      await Promise.all([
        writeFile(pluginInventoryPath, JSON.stringify(pluginStarted), { mode: 0o600 }),
        writeFile(harnessInventoryPath, JSON.stringify(harnessStarted), { mode: 0o600 }),
      ]);
    } else {
      assert.deepEqual(
        runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
          command,
          ...arguments_.map((argument) => argument === inventoryPath ? pluginInventoryPath : argument),
        ]),
        runJson("harness/hope.mjs", [
          "sweep",
          command,
          ...arguments_.map((argument) => argument === inventoryPath ? harnessInventoryPath : argument),
        ]),
      );
    }
  }
  assert.equal(
    runFailure("plugins/hope/runtime/features/sweep/cli.mjs", [
      "validate-completion",
      "--input",
      completionPath,
    ]),
    runFailure("harness/hope.mjs", [
      "sweep",
      "validate-completion",
      "--input",
      completionPath,
    ]),
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
      "approval-candidate",
      "--input",
      planPath,
      "--candidate",
      "remove-unused-helper",
    ]),
    runJson("harness/hope.mjs", [
      "sweep",
      "approval-candidate",
      "--input",
      planPath,
      "--candidate",
      "remove-unused-helper",
    ]),
  );
  assert.equal(
    runFailure("plugins/hope/runtime/features/sweep/cli.mjs", [
      "approval-receipt",
      "--input",
      approvalPath,
    ]),
    runFailure("harness/hope.mjs", [
      "sweep",
      "approval-receipt",
      "--input",
      approvalPath,
    ]),
  );
  assert.equal(
    runFailure("plugins/hope/runtime/features/sweep/cli.mjs", [
      "validate-plan",
      "--input",
      invalidPlanPath,
    ]),
    runFailure("harness/hope.mjs", [
      "sweep",
      "validate-plan",
      "--input",
      invalidPlanPath,
    ]),
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
      "model-evaluation-plan",
    ]),
    runJson("harness/hope.mjs", [
      "sweep",
      "model-evaluation-plan",
    ]),
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
      "model-evaluation-oracle",
      "--case",
      "sweep-safe-private",
    ]),
    runJson("harness/hope.mjs", [
      "sweep",
      "model-evaluation-oracle",
      "--case",
      "sweep-safe-private",
    ]),
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
      "model-evaluation-prepare",
      "--case",
      "sweep-safe-private",
      "--run",
      "1",
    ]),
    runJson("harness/hope.mjs", [
      "sweep",
      "model-evaluation-prepare",
      "--case",
      "sweep-safe-private",
      "--run",
      "1",
    ]),
  );
  const evaluationReceiptArguments = [
    "model-evaluation-receipt",
    "--case",
    "sweep-safe-private",
    "--run",
    "1",
    "--input",
    evaluationOutputPath,
    "--host",
    "codex-test-host",
    "--model",
    "test-model",
    "--effort",
    "test-effort",
    "--invocation",
    "test-invocation",
  ];
  assert.deepEqual(
    runJson(
      "plugins/hope/runtime/features/sweep/cli.mjs",
      evaluationReceiptArguments,
    ),
    runJson("harness/hope.mjs", ["sweep", ...evaluationReceiptArguments]),
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
      "model-evaluation-validate-set",
      "--input",
      evaluationReceiptsPath,
    ]),
    runJson("harness/hope.mjs", [
      "sweep",
      "model-evaluation-validate-set",
      "--input",
      evaluationReceiptsPath,
    ]),
  );
  assert.equal(
    runFailure("plugins/hope/runtime/features/sweep/cli.mjs", [
      "model-evaluation-validate-set",
      "--input",
      invalidEvaluationReceiptsPath,
    ]),
    runFailure("harness/hope.mjs", [
      "sweep",
      "model-evaluation-validate-set",
      "--input",
      invalidEvaluationReceiptsPath,
    ]),
  );
});
