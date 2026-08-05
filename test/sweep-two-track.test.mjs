import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createSweepBrief,
  createSweepInventory,
  createSweepModelEvaluationPlan,
  createSweepModelEvaluationReceipt,
  getSweepModelEvaluationOracle,
  SWEEP_MODEL_ADAPTER_MESSAGE,
} from "../features/sweep/index.mjs";
import {
  mergeSweepBatchReports,
} from "../features/sweep/batch.mjs";
import {
  createSweepApprovalCandidate,
  validateSweepApprovalReceipt,
  validateSweepCompletion,
  validateSweepPlan,
  validateSweepSessionResult,
  sweepPlanDigest,
} from "../features/sweep/validate.mjs";
import { main, parseArguments } from "../harness/hope.mjs";
import {
  makeSweepCompletion,
  makeSweepApprovalReceipt,
  makeSweepBatchCapabilities,
  makeSweepBatchReport,
  makeSweepBatchReportSet,
  makeSweepInventory,
  makeSweepPlan,
  makeSweepSessionResult,
  bindSweepPlanToBatchMerge,
  sweepBatchDependencies,
  sweepApprovalDependencies,
  verifySweepLiveInventory,
} from "../test-support/sweep-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function createFixtureRepository(parent) {
  const repositoryRoot = join(parent, "repository");
  await mkdir(join(repositoryRoot, "src"), { recursive: true });
  await Promise.all([
    writeFile(join(repositoryRoot, "AGENTS.md"), "# Fixture rules\n"),
    writeFile(join(repositoryRoot, "package.json"), "{\"name\":\"sweep-fixture\"}\n"),
    writeFile(join(repositoryRoot, "src", "unused-helper.mjs"), "export const unused = true;\n"),
  ]);
  for (const arguments_ of [
    ["init", "-q"],
    ["config", "user.email", "hope-tests@example.invalid"],
    ["config", "user.name", "Hope Tests"],
    ["add", "."],
    ["commit", "-qm", "fixture"],
  ]) {
    const result = spawnSync("git", arguments_, {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  }
  return repositoryRoot;
}

function makeLivePlan(inventory) {
  const plan = makeSweepPlan();
  plan.snapshot = structuredClone(inventory.snapshot);
  const sourceIds = inventory.snapshot.sources.map((source) => source.id);
  const fileSourceIds = [...inventory.fileSourceIds];
  const targetSourceId = fileSourceIds.find((sourceId) => (
    inventory.snapshot.sources.find((source) => source.id === sourceId)
      ?.locator === "src/unused-helper.mjs"
  ));
  plan.session.budget.maximumFiles = fileSourceIds.length;
  plan.coverage.inventoryDigest = inventory.digest;
  plan.coverage.fileSourceIds = [...fileSourceIds];
  plan.coverage.batches[0].fileSourceIds = [...fileSourceIds];
  for (const category of plan.categories) {
    category.evidenceSourceIds = [...sourceIds];
    for (const check of category.checks) {
      check.evidenceSourceIds = [...sourceIds];
    }
  }
  const candidate = plan.candidates[0];
  candidate.targetSourceIds = [targetSourceId];
  candidate.evidenceSourceIds = [...sourceIds];
  for (const check of candidate.evidenceChecks) check.sourceIds = [...sourceIds];
  plan.summary.filesChecked = fileSourceIds.length;
  plan.summary.filesInInventory = fileSourceIds.length;
  plan.candidates[0].preview.patch = "*** Delete File: src/unused-helper.mjs";
  return plan;
}

function runJson(script, arguments_, environment = {}) {
  const run = spawnSync(process.execPath, [resolve(root, script), ...arguments_], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

function runFailure(script, arguments_, environment = {}) {
  const run = spawnSync(process.execPath, [resolve(root, script), ...arguments_], {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  assert.notEqual(run.status, 0, run.stdout);
  return run.stderr.replace(/^hope(?: sweep)?: /u, "");
}

function withoutSchemaPaths(value) {
  const {
    planSchemaPath,
    approvalSchemaPath,
    completionSchemaPath,
    inventorySchemaPath,
    sessionResultSchemaPath,
    batchReportSchemaPath,
    batchReportSetSchemaPath,
    batchMergeSchemaPath,
    batchCapabilitiesSchemaPath,
    ...rest
  } = value;
  assert.ok(planSchemaPath);
  assert.ok(approvalSchemaPath);
  assert.ok(completionSchemaPath);
  assert.ok(inventorySchemaPath);
  assert.ok(sessionResultSchemaPath);
  assert.ok(batchReportSchemaPath);
  assert.ok(batchReportSetSchemaPath);
  assert.ok(batchMergeSchemaPath);
  assert.ok(batchCapabilitiesSchemaPath);
  return rest;
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
    pluginValidator.validateSweepPlan(makeSweepPlan(), {
      inventory: makeSweepInventory(),
      verifyLiveInventory: verifySweepLiveInventory(makeSweepInventory()),
    }),
    validateSweepPlan(makeSweepPlan(), {
      inventory: makeSweepInventory(),
      verifyLiveInventory: verifySweepLiveInventory(makeSweepInventory()),
    }),
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
      {
        ...sweepApprovalDependencies,
        inventory: makeSweepInventory(),
        verifyLiveInventory: verifySweepLiveInventory(makeSweepInventory()),
      },
    ),
    validateSweepSessionResult(
      makeSweepSessionResult(),
      {
        ...sweepApprovalDependencies,
        inventory: makeSweepInventory(),
        verifyLiveInventory: verifySweepLiveInventory(makeSweepInventory()),
      },
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
  const repositoryRoot = await createFixtureRepository(temporaryRoot);
  const liveInventory = await createSweepInventory({ cwd: repositoryRoot });
  const livePlan = makeLivePlan(liveInventory);
  const batchCapabilities = makeSweepBatchCapabilities();
  const batchReport = makeSweepBatchReport(liveInventory, batchCapabilities);
  const batchReportSet = makeSweepBatchReportSet(
    liveInventory,
    batchCapabilities,
  );
  const batchMerge = mergeSweepBatchReports(batchReportSet, {
    inventory: liveInventory,
    capabilities: batchCapabilities,
    ...sweepBatchDependencies,
  });
  const hybridLivePlan = structuredClone(livePlan);
  hybridLivePlan.coverage.inspectionMode = "subagent-hybrid";
  hybridLivePlan.coverage.batchMergeDigest = batchMerge.digest;
  hybridLivePlan.coverage.relationshipEvidenceSourceIds = [
    ...batchMerge.relationshipEvidenceSourceIds,
  ];
  hybridLivePlan.coverage.relationshipIds = batchMerge.relationships.map(
    (item) => item.id,
  );
  hybridLivePlan.coverage.observationIds = batchMerge.observations.map(
    (item) => item.id,
  );
  hybridLivePlan.coverage.batches = batchMerge.batches.map((batch) => ({
    id: batch.id,
    ordinal: batch.ordinal,
    fileSourceIds: [...batch.fileSourceIds],
    inspection: batch.inspection,
    gaps: [...batch.gaps],
  }));
  bindSweepPlanToBatchMerge(hybridLivePlan, batchMerge);
  const planPath = join(temporaryRoot, "plan.json");
  const inventoryPath = join(temporaryRoot, "inventory.json");
  const capabilitiesPath = join(temporaryRoot, "capabilities.json");
  const manifestPath = join(temporaryRoot, "manifest.json");
  const hostAdapterPath = join(temporaryRoot, "sweep-host-adapter.mjs");
  const batchReportPath = join(temporaryRoot, "batch-report.json");
  const batchReportSetPath = join(temporaryRoot, "batch-reports.json");
  const hybridPlanPath = join(temporaryRoot, "hybrid-plan.json");
  const hybridSessionResultPath = join(
    temporaryRoot,
    "hybrid-session-result.json",
  );
  const completionPath = join(temporaryRoot, "completion.json");
  const approvalPath = join(temporaryRoot, "approval.json");
  const sessionResultPath = join(temporaryRoot, "session-result.json");
  const invalidPlanPath = join(temporaryRoot, "invalid-plan.json");
  const evaluationOutputPath = join(temporaryRoot, "evaluation-output.json");
  const evaluationReceiptsPath = join(temporaryRoot, "evaluation-receipts.json");
  const invalidEvaluationReceiptsPath = join(
    temporaryRoot,
    "invalid-evaluation-receipts.json",
  );
  const hostAdapterEnvironment = {
    HOPE_SWEEP_HOST_ADAPTER_MODULE: hostAdapterPath,
  };
  const runWithHostAdapter = (script, arguments_) => (
    runJson(script, arguments_, hostAdapterEnvironment)
  );
  const approvalCandidate = createSweepApprovalCandidate(
    livePlan,
    "remove-unused-helper",
    {
      inventory: liveInventory,
      verifyLiveInventory: verifySweepLiveInventory(liveInventory),
    },
  );
  const approvalReceipt = makeSweepCompletion().approvalReceipt;
  const invalidPlan = structuredClone(livePlan);
  invalidPlan.candidates[0].evidenceChecks[0].sourceIds = [];
  const noCandidatePlan = structuredClone(livePlan);
  noCandidatePlan.candidates = [];
  noCandidatePlan.session.state = "complete-no-change";
  const sessionResult = {
    version: 1,
    title: "Complete a no-change Sweep session",
    plan: noCandidatePlan,
    planDigest: sweepPlanDigest(noCandidatePlan, {
      inventory: liveInventory,
      verifyLiveInventory: verifySweepLiveInventory(liveInventory),
    }),
    completions: [],
    candidateResults: [],
    summary: {
      state: "complete",
      assessment: "The checked scope produced no candidate.",
      remainingGaps: [],
    },
  };
  const hybridSessionResult = {
    version: 1,
    title: "Complete a hybrid Sweep session",
    plan: hybridLivePlan,
    planDigest: sweepPlanDigest(hybridLivePlan, {
      inventory: liveInventory,
      verifyLiveInventory: verifySweepLiveInventory(liveInventory),
      batchMerge,
      batchReportSet,
      capabilities: batchCapabilities,
      ...sweepBatchDependencies,
    }),
    completions: [],
    candidateResults: [{
      candidateId: "remove-unused-helper",
      disposition: "polish",
      status: "pending",
      completionDigest: null,
      gaps: [],
    }],
    summary: {
      state: "incomplete",
      assessment: "The hybrid inspection plan is awaiting exact approval.",
      remainingGaps: [],
    },
  };
  const evaluationPlan = createSweepModelEvaluationPlan();
  const evaluationReceipts = [];
  for (const specification of evaluationPlan.runs) {
    const oracle = getSweepModelEvaluationOracle(specification.caseId).oracle;
    const output = {
      categoryId: oracle.categoryId,
      checkId: oracle.checkId,
      coverage: "complete",
      decision: oracle.decision,
      impacts: oracle.impacts ? { ...oracle.impacts } : null,
      targetPaths: [...oracle.requiredTargetPaths],
      unsupportedCategoryIds: [],
      reason: "The synthetic repository supports this full-codebase result.",
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
    writeFile(hostAdapterPath, `export default {
  activeSessionAvailable: true,
  capabilities: {
    boundedOutput: true,
    independentContexts: true,
    readOnly: true,
    sourceAllowlist: true,
  },
  verifyCapabilities(capabilities) {
    return capabilities.mode === "subagent-hybrid";
  },
  verifyInvocation(value) {
    return typeof value.invocationId === "string";
  },
};\n`),
    writeFile(planPath, JSON.stringify(livePlan), { mode: 0o600 }),
    writeFile(inventoryPath, JSON.stringify(liveInventory), { mode: 0o600 }),
    writeFile(capabilitiesPath, JSON.stringify(batchCapabilities), { mode: 0o600 }),
    writeFile(manifestPath, JSON.stringify(batchReportSet.manifest), { mode: 0o600 }),
    writeFile(batchReportPath, JSON.stringify(batchReport), { mode: 0o600 }),
    writeFile(batchReportSetPath, JSON.stringify(batchReportSet), { mode: 0o600 }),
    writeFile(hybridPlanPath, JSON.stringify(hybridLivePlan), { mode: 0o600 }),
    writeFile(
      hybridSessionResultPath,
      JSON.stringify(hybridSessionResult),
      { mode: 0o600 },
    ),
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
    writeFile(invalidPlanPath, JSON.stringify(invalidPlan), { mode: 0o600 }),
    writeFile(evaluationOutputPath, JSON.stringify({
      categoryId: "unused-stale",
      checkId: "dead-code",
      coverage: "complete",
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
  for (const [command, path] of [
    ["validate-plan", planPath],
    ["validate-session-result", sessionResultPath],
  ]) {
    assert.deepEqual(
      runJson("plugins/hope/runtime/features/sweep/cli.mjs", [
        command,
        "--input",
        path,
        ...(command === "validate-plan"
          ? ["--root", repositoryRoot, "--inventory", inventoryPath]
          : command === "validate-session-result"
            ? ["--root", repositoryRoot]
          : []),
      ]),
      runJson("harness/hope.mjs", [
        "sweep",
        command,
        "--input",
        path,
        ...(command === "validate-plan"
          ? ["--root", repositoryRoot, "--inventory", inventoryPath]
          : command === "validate-session-result"
            ? ["--root", repositoryRoot]
          : []),
      ]),
    );
  }
  const hybridSessionResultArguments = [
    "validate-session-result",
    "--input",
    hybridSessionResultPath,
    "--root",
    repositoryRoot,
    "--reports",
    batchReportSetPath,
    "--capabilities",
    capabilitiesPath,
  ];
  assert.deepEqual(
    runWithHostAdapter(
      "plugins/hope/runtime/features/sweep/cli.mjs",
      hybridSessionResultArguments,
    ),
    runWithHostAdapter("harness/hope.mjs", [
      "sweep",
      ...hybridSessionResultArguments,
    ]),
  );
  for (const arguments_ of [
    ["select-inspection-mode", "--mode", "active-session"],
    [
      "select-inspection-mode",
      "--mode",
      "subagent-hybrid",
      "--capabilities",
      capabilitiesPath,
    ],
  ]) {
    assert.deepEqual(
      (arguments_.includes("subagent-hybrid")
        ? runWithHostAdapter
        : runJson)("plugins/hope/runtime/features/sweep/cli.mjs", arguments_),
      (arguments_.includes("subagent-hybrid")
        ? runWithHostAdapter
        : runJson)("harness/hope.mjs", ["sweep", ...arguments_]),
    );
  }
  assert.match(
    runFailure(
      "plugins/hope/runtime/features/sweep/cli.mjs",
      [
        "select-inspection-mode",
        "--mode",
        "subagent-hybrid",
        "--capabilities",
        capabilitiesPath,
      ],
      { HOPE_SWEEP_HOST_ADAPTER_MODULE: "" },
    ),
    /trusted host adapter/u,
  );
  assert.match(
    runFailure(
      "plugins/hope/runtime/features/sweep/cli.mjs",
      [
        "select-inspection-mode",
        "--mode",
        "subagent-hybrid",
        "--capabilities",
        capabilitiesPath,
      ],
      { HOPE_SWEEP_HOST_ADAPTER_MODULE: "relative-adapter.mjs" },
    ),
    /absolute host-owned path/u,
  );
  for (const [command, path] of [
    ["validate-batch-report", batchReportPath],
    ["merge-batch-reports", batchReportSetPath],
  ]) {
    const arguments_ = [
      command,
      "--input",
      path,
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
      "--capabilities",
      capabilitiesPath,
      ...(command === "validate-batch-report" ? ["--manifest", manifestPath] : []),
    ];
    assert.deepEqual(
      runWithHostAdapter("plugins/hope/runtime/features/sweep/cli.mjs", arguments_),
      runWithHostAdapter("harness/hope.mjs", ["sweep", ...arguments_]),
    );
  }
  for (const commandArguments of [
    [
      "validate-plan",
      "--input",
      hybridPlanPath,
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
      "--reports",
      batchReportSetPath,
      "--capabilities",
      capabilitiesPath,
    ],
    [
      "approval-candidate",
      "--input",
      hybridPlanPath,
      "--candidate",
      "remove-unused-helper",
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
      "--reports",
      batchReportSetPath,
      "--capabilities",
      capabilitiesPath,
    ],
  ]) {
    assert.deepEqual(
      runWithHostAdapter("plugins/hope/runtime/features/sweep/cli.mjs", commandArguments),
      runWithHostAdapter("harness/hope.mjs", ["sweep", ...commandArguments]),
    );
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
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
    ]),
    runJson("harness/hope.mjs", [
      "sweep",
      "approval-candidate",
      "--input",
      planPath,
      "--candidate",
      "remove-unused-helper",
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
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
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
    ]),
    runFailure("harness/hope.mjs", [
      "sweep",
      "validate-plan",
      "--input",
      invalidPlanPath,
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
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
  await writeFile(
    join(repositoryRoot, "src", "unused-helper.mjs"),
    "export const changedAfterInventory = true;\n",
  );
  const stalePluginError = runFailure(
    "plugins/hope/runtime/features/sweep/cli.mjs",
    [
      "validate-plan",
      "--input",
      planPath,
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
    ],
  );
  const staleHarnessError = runFailure(
    "harness/hope.mjs",
    [
      "sweep",
      "validate-plan",
      "--input",
      planPath,
      "--root",
      repositoryRoot,
      "--inventory",
      inventoryPath,
    ],
  );
  assert.equal(stalePluginError, staleHarnessError);
  assert.match(stalePluginError, /stale|does not match/u);
});
