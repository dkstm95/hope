import assert from "node:assert/strict";
import test from "node:test";

import {
  createSweepBrief,
  runSweep,
  SWEEP_MODEL_ADAPTER_CODE,
} from "../features/sweep/index.mjs";
import { parseSweepArguments } from "../features/sweep/cli.mjs";
import { createPolishReceipt } from "../features/polish/validate.mjs";
import {
  createSweepBatchManifest,
  createSweepBatchModeSelection,
  createSweepBatchReport,
  createSweepBatchReportSet,
  createSweepCrossBatchSynthesis,
  digestSweepBatchManifest,
  digestSweepBatchReportSet,
  digestSweepCrossBatchSynthesis,
  mergeSweepBatchReports,
  selectSweepInspectionMode,
  sweepBatchAttemptOutputDigest,
  sweepBatchAttemptId,
  sweepBatchBindingDigest,
  validateSweepBatchMerge,
  validateSweepBatchModeSelection,
  validateSweepBatchReport,
  validateSweepBatchReportSet,
} from "../features/sweep/batch.mjs";
import {
  createSweepApprovalCandidate,
  sweepPlanDigest,
  validateSweepApprovalReceipt,
  validateSweepCompletion,
  validateSweepPlan,
  validateSweepSessionResult,
} from "../features/sweep/validate.mjs";
import {
  makeSweepApprovalCandidate,
  makeSweepBatchCapabilities,
  makeSweepBatchReport,
  makeSweepBatchReportSet,
  makeSweepHybridPlan,
  makeSweepApprovalReceipt,
  makeSweepCompletion,
  makeSweepInventory,
  makeSweepPlan,
  makeSweepPolishRun,
  makeSweepSessionResult,
  sweepBatchDependencies,
  sweepApprovalDependencies,
  verifySweepLiveInventory,
} from "../test-support/sweep-fixture.mjs";
import {
  SWEEP_CHECK_CATALOG,
} from "../features/sweep/constants.mjs";
import { sweepInventoryDigest } from "../features/sweep/inventory.mjs";

const clone = (value) => structuredClone(value);
const validateCompletion = (value) => validateSweepCompletion(
  value,
  sweepApprovalDependencies,
);
const validateSessionResult = (value) => {
  const inventory = makeSweepInventory(value.plan);
  return validateSweepSessionResult(
    value,
    {
      ...sweepApprovalDependencies,
      inventory,
      verifyLiveInventory: verifySweepLiveInventory(inventory),
    },
  );
};
const validateTestPlan = (value, options = {}) => {
  const inventory = options.inventory ?? makeSweepInventory(value);
  return validateSweepPlan(value, {
    ...options,
    inventory,
    verifyLiveInventory: options.verifyLiveInventory
      ?? verifySweepLiveInventory(inventory),
  });
};

test("sweep validates one full-codebase dead-code plan", () => {
  const plan = validateTestPlan(makeSweepPlan());
  assert.equal(plan.result.state, "awaiting-approval");
  assert.equal(plan.result.executableCandidates, 1);
  assert.equal(plan.resources.categories, 7);
  assert.equal(plan.resources.checks, 21);
  assert.equal(plan.resources.filesChecked, 3);
});

test("sweep direct plan validation requires a verified live inventory", () => {
  assert.throws(
    () => validateSweepPlan(makeSweepPlan()),
    /inventory is required for an entire-codebase plan/u,
  );
});

test("sweep direct plan validation requires a trusted live-worktree verifier", () => {
  const plan = makeSweepPlan();
  const inventory = makeSweepInventory(plan);
  assert.throws(
    () => validateSweepPlan(plan, { inventory }),
    /trusted live-worktree verifier/u,
  );
  assert.throws(
    () => validateSweepPlan(plan, {
      inventory,
      verifyLiveInventory: () => false,
    }),
    /current live worktree/u,
  );
});

test("sweep validates the hybrid batch contract and preserves merge evidence", () => {
  const hybrid = makeSweepHybridPlan();
  const plan = validateTestPlan(hybrid.plan, {
    inventory: hybrid.inventory,
    batchMerge: hybrid.batchMerge,
    batchReportSet: hybrid.reportSet,
    capabilities: hybrid.capabilities,
    ...sweepBatchDependencies,
  });
  assert.equal(plan.coverage.inspectionMode, "subagent-hybrid");
  assert.equal(plan.coverage.batchMergeDigest, hybrid.batchMerge.digest);
  assert.deepEqual(
    plan.coverage.relationshipIds,
    hybrid.batchMerge.relationships.map((item) => item.id),
  );
  assert.equal(
    createSweepApprovalCandidate(hybrid.plan, "remove-unused-helper", {
      inventory: hybrid.inventory,
      verifyLiveInventory: verifySweepLiveInventory(hybrid.inventory),
      batchMerge: hybrid.batchMerge,
      batchReportSet: hybrid.reportSet,
      capabilities: hybrid.capabilities,
      ...sweepBatchDependencies,
    }).candidate.id,
    "remove-unused-helper",
  );

  assert.throws(
    () => validateTestPlan(hybrid.plan, {
      inventory: hybrid.inventory,
      capabilities: hybrid.capabilities,
      batchReportSet: hybrid.reportSet,
      ...sweepBatchDependencies,
    }),
    /batchMerge is required/u,
  );
  const changedMerge = structuredClone(hybrid.batchMerge);
  changedMerge.relationships[0].summary = "A conflicting relationship claim.";
  assert.throws(
    () => validateTestPlan(hybrid.plan, {
      inventory: hybrid.inventory,
      batchMerge: changedMerge,
      batchReportSet: hybrid.reportSet,
      capabilities: hybrid.capabilities,
      ...sweepBatchDependencies,
    }),
    /batchMerge|digest/u,
  );
  assert.throws(
    () => validateSweepBatchReportSet(hybrid.reportSet, {
      inventory: hybrid.inventory,
      capabilities: hybrid.capabilities,
    }),
    /trusted host verifier/u,
  );
  assert.throws(
    () => validateSweepBatchMerge(hybrid.batchMerge, {
      inventory: hybrid.inventory,
      capabilities: hybrid.capabilities,
      ...sweepBatchDependencies,
    }),
    /reportSet is required/u,
  );
  const unassignedEvidence = clone(hybrid.reportSet.reports[0]);
  unassignedEvidence.checks[0].evidenceSourceIds = ["repo"];
  assert.throws(
    () => validateSweepBatchReport(unassignedEvidence, {
      inventory: hybrid.inventory,
      capabilities: hybrid.capabilities,
      ...sweepBatchDependencies,
    }),
    /source ID|assigned/u,
  );
});

test("sweep validates hybrid session results with their report artifacts", () => {
  const hybrid = makeSweepHybridPlan();
  const dependencies = {
    inventory: hybrid.inventory,
    verifyLiveInventory: verifySweepLiveInventory(hybrid.inventory),
    batchMerge: hybrid.batchMerge,
    batchReportSet: hybrid.reportSet,
    capabilities: hybrid.capabilities,
    ...sweepBatchDependencies,
  };
  const result = {
    version: 1,
    title: "Complete a hybrid Sweep session",
    plan: hybrid.plan,
    planDigest: sweepPlanDigest(hybrid.plan, dependencies),
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
  assert.equal(
    validateSweepSessionResult(result, dependencies).result.state,
    "incomplete",
  );
  assert.throws(
    () => validateSweepSessionResult(result, { inventory: hybrid.inventory }),
    /batchMerge is required|batchReportSet is required/u,
  );
});

test("sweep standalone reports remain bound to the manifest run, batch, and retry budget", () => {
  const inventory = makeSweepInventory();
  const capabilities = makeSweepBatchCapabilities();
  const reportSet = makeSweepBatchReportSet(inventory, capabilities);
  const rebind = (changes) => {
    const report = {
      ...clone(reportSet.reports[0]),
      ...changes,
    };
    report.bindingDigest = sweepBatchBindingDigest({
      runId: report.runId,
      inventoryDigest: report.inventoryDigest,
      manifestDigest: report.manifestDigest,
      batch: report.batch,
      capabilityDigest: report.capabilityDigest,
    });
    report.attemptId = sweepBatchAttemptId({
      bindingDigest: report.bindingDigest,
      manifestDigest: report.manifestDigest,
      attempt: report.attempt,
      inputDigest: report.inputDigest,
      invocationId: report.invocationId,
      outputDigest: report.outputDigest,
    });
    delete report.reportDigest;
    return report;
  };
  assert.throws(
    () => createSweepBatchReport(
      rebind({ runId: "foreign-sweep-run" }),
      {
        inventory,
        manifest: reportSet.manifest,
        modeSelection: reportSet.modeSelection,
        capabilities,
        ...sweepBatchDependencies,
      },
    ),
    /runId does not match the pre-dispatch manifest/u,
  );
  assert.throws(
    () => createSweepBatchReport(
      rebind({
        batch: {
          ...reportSet.reports[0].batch,
          id: "batch-unknown",
        },
      }),
      {
        inventory,
        manifest: reportSet.manifest,
        modeSelection: reportSet.modeSelection,
        capabilities,
        ...sweepBatchDependencies,
      },
    ),
    /does not exactly match a pre-dispatch manifest batch/u,
  );
  assert.throws(
    () => createSweepBatchReport(
      rebind({ attempt: capabilities.retryBudget + 2 }),
      {
        inventory,
        manifest: reportSet.manifest,
        modeSelection: reportSet.modeSelection,
        capabilities,
        ...sweepBatchDependencies,
      },
    ),
    /exceeds the declared retry budget/u,
  );
});

test("sweep cannot downgrade scope or create approval without live inventory", () => {
  const scoped = makeSweepPlan();
  scoped.session.scope = "selected-files";
  assert.throws(
    () => validateTestPlan(scoped),
    /session\.scope must be entire-codebase/u,
  );
  assert.throws(
    () => createSweepApprovalCandidate(makeSweepPlan(), "remove-unused-helper"),
    /verified live inventory/u,
  );
});

test("sweep negotiates the inspection fallback before dispatch", () => {
  assert.deepEqual(
    selectSweepInspectionMode({ requestedMode: "active-session" }),
    { mode: "active-session", fallbackUsed: false },
  );
  assert.equal(
    selectSweepInspectionMode({
      requestedMode: "subagent-hybrid",
      capabilities: makeSweepBatchCapabilities(),
      activeSessionAvailable: true,
      ...sweepBatchDependencies,
    }).mode,
    "subagent-hybrid",
  );
  const fallback = selectSweepInspectionMode({
    requestedMode: "subagent-hybrid",
    capabilities: { mode: "subagent-hybrid" },
    activeSessionAvailable: true,
  });
  assert.equal(fallback.mode, "active-session");
  assert.equal(fallback.fallbackUsed, true);
  assert.throws(
    () => selectSweepInspectionMode({
      requestedMode: "subagent-hybrid",
      capabilities: { mode: "subagent-hybrid" },
      activeSessionAvailable: false,
    }),
    /fallback is unavailable/u,
  );
  assert.throws(
    () => selectSweepInspectionMode({
      requestedMode: "subagent-hybrid",
      capabilities: makeSweepBatchCapabilities(),
      activeSessionAvailable: false,
    }),
    /trusted host.*verifier/u,
  );
  assert.throws(
    () => selectSweepInspectionMode({
      requestedMode: "subagent-hybrid",
      capabilities: makeSweepBatchCapabilities(),
      ...sweepBatchDependencies,
      activeSessionAvailable: "yes",
    }),
    /fallback is unavailable/u,
  );
  const hybrid = makeSweepHybridPlan();
  assert.throws(
    () => validateSweepBatchModeSelection(hybrid.reportSet.modeSelection, {
      inventory: hybrid.inventory,
      capabilities: hybrid.capabilities,
      manifest: hybrid.reportSet.manifest,
      ...sweepBatchDependencies,
      activeSessionAvailable: false,
    }),
    /active-session fallback/u,
  );
  assert.throws(
    () => validateSweepBatchModeSelection(hybrid.reportSet.modeSelection, {
      inventory: hybrid.inventory,
      capabilities: hybrid.capabilities,
      manifest: hybrid.reportSet.manifest,
      ...sweepBatchDependencies,
      verifyBatchCapabilities: undefined,
    }),
    /trusted host verifier/u,
  );
});

test("sweep retains failed retry attempts and rejects stale report bindings", () => {
  const capabilities = makeSweepBatchCapabilities();
  const inventory = makeSweepInventory();
  const baseReportSet = makeSweepHybridPlan().reportSet;
  const manifest = baseReportSet.manifest;
  const failedReport = makeSweepBatchReport(inventory, capabilities, {
    attempt: 1,
    inputDigest: `sha256:${"b".repeat(64)}`,
    invocationId: "failed-invocation",
    manifest,
  });
  const successfulReport = makeSweepBatchReport(inventory, capabilities, {
    attempt: 2,
    inputDigest: `sha256:${"c".repeat(64)}`,
    invocationId: "successful-invocation",
    manifest,
  });
  const failedAttemptId = (report, error) => sweepBatchAttemptId({
    bindingDigest: report.bindingDigest,
    manifestDigest: manifest.digest,
    attempt: report.attempt,
    inputDigest: report.inputDigest,
    invocationId: report.invocationId,
    outputDigest: sweepBatchAttemptOutputDigest({ status: "failed", error }),
  });
  const retryAttempts = [
    {
      batch: failedReport.batch,
      manifestDigest: manifest.digest,
      attempt: failedReport.attempt,
      attemptId: failedAttemptId(failedReport, "The host cancelled the first attempt."),
      status: "failed",
      inputDigest: failedReport.inputDigest,
      invocationId: failedReport.invocationId,
      outputDigest: sweepBatchAttemptOutputDigest({
        status: "failed",
        error: "The host cancelled the first attempt.",
      }),
      error: "The host cancelled the first attempt.",
    },
    {
      batch: successfulReport.batch,
      manifestDigest: manifest.digest,
      attempt: successfulReport.attempt,
      attemptId: successfulReport.attemptId,
      status: "succeeded",
      inputDigest: successfulReport.inputDigest,
      invocationId: successfulReport.invocationId,
      outputDigest: successfulReport.outputDigest,
    },
  ];
  const retrySynthesisInput = structuredClone(baseReportSet.crossBatchSynthesis);
  for (const key of [
    "modeSelectionDigest",
    "reportSetInputDigest",
    "mergeInputDigest",
    "attemptsDigest",
    "inputDigest",
    "attemptId",
    "outputDigest",
    "digest",
  ]) delete retrySynthesisInput[key];
  const retrySynthesis = createSweepCrossBatchSynthesis(retrySynthesisInput, {
    inventory,
    capabilities,
    manifest,
    modeSelection: baseReportSet.modeSelection,
    reports: [successfulReport],
    attempts: retryAttempts,
    ...sweepBatchDependencies,
  });
  const reportSet = createSweepBatchReportSet({
    feature: "sweep-batch-report-set",
    version: 1,
    runId: successfulReport.runId,
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    manifest,
    modeSelection: baseReportSet.modeSelection,
    crossBatchSynthesis: retrySynthesis,
    reports: [successfulReport],
    attempts: retryAttempts,
  }, {
    inventory,
    capabilities,
    ...sweepBatchDependencies,
  });
  assert.equal(
    validateSweepBatchReportSet(reportSet, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }).attempts.length,
    2,
  );
  assert.equal(mergeSweepBatchReports(reportSet, {
    inventory,
    capabilities,
    ...sweepBatchDependencies,
  }).state, "complete");

  const successThenFailureError = "The host failed the terminal retry.";
  const successThenFailureAttempts = [
    {
      ...retryAttempts[0],
      status: "succeeded",
      attemptId: failedReport.attemptId,
      outputDigest: failedReport.outputDigest,
    },
    {
      ...retryAttempts[1],
      status: "failed",
      attemptId: failedAttemptId(successfulReport, successThenFailureError),
      outputDigest: sweepBatchAttemptOutputDigest({
        status: "failed",
        error: successThenFailureError,
      }),
      error: successThenFailureError,
    },
  ];
  const successThenFailureSynthesisInput = structuredClone(
    baseReportSet.crossBatchSynthesis,
  );
  for (const key of [
    "modeSelectionDigest",
    "reportSetInputDigest",
    "mergeInputDigest",
    "attemptsDigest",
    "inputDigest",
    "attemptId",
    "outputDigest",
    "digest",
  ]) delete successThenFailureSynthesisInput[key];
  const successThenFailureSynthesis = createSweepCrossBatchSynthesis(
    successThenFailureSynthesisInput,
    {
      inventory,
      capabilities,
      manifest,
      modeSelection: baseReportSet.modeSelection,
      reports: [failedReport],
      attempts: successThenFailureAttempts,
      ...sweepBatchDependencies,
    },
  );
  assert.throws(
    () => createSweepBatchReportSet({
      ...reportSet,
      crossBatchSynthesis: successThenFailureSynthesis,
      reports: [failedReport],
      attempts: successThenFailureAttempts,
      digest: undefined,
    }, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }),
    /after succeeded attempt/u,
  );

  const replayedSynthesisSet = {
    ...reportSet,
    crossBatchSynthesis: baseReportSet.crossBatchSynthesis,
  };
  replayedSynthesisSet.digest = digestSweepBatchReportSet(replayedSynthesisSet);
  assert.throws(
    () => validateSweepBatchReportSet(replayedSynthesisSet, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }),
    /report-set inputs|attemptsDigest|inputDigest/u,
  );

  const tamperedSynthesis = {
    ...reportSet.crossBatchSynthesis,
    inputDigest: `sha256:${"0".repeat(64)}`,
  };
  tamperedSynthesis.digest = digestSweepCrossBatchSynthesis(tamperedSynthesis);
  const tamperedSynthesisSet = {
    ...reportSet,
    crossBatchSynthesis: tamperedSynthesis,
  };
  tamperedSynthesisSet.digest = digestSweepBatchReportSet(tamperedSynthesisSet);
  assert.throws(
    () => validateSweepBatchReportSet(tamperedSynthesisSet, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }),
    /inputDigest|report-set inputs/u,
  );

  const stale = structuredClone(successfulReport);
  stale.inputDigest = `sha256:${"e".repeat(64)}`;
  assert.throws(
    () => validateSweepBatchReportSet({
      ...reportSet,
      reports: [stale],
    }, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }),
    /batchReport|binding|digest/u,
  );

  const overBudgetReport = makeSweepBatchReport(inventory, capabilities, {
    attempt: 1,
    inputDigest: `sha256:${"f".repeat(64)}`,
    invocationId: "over-budget-invocation",
    manifest,
  });
  const overBudgetAttempt = {
    ...overBudgetReport,
    attempt: capabilities.retryBudget + 2,
  };
  const overBudget = clone(reportSet);
  overBudget.attempts.push({
    batch: overBudgetAttempt.batch,
    manifestDigest: manifest.digest,
    attempt: overBudgetAttempt.attempt,
    attemptId: failedAttemptId(overBudgetAttempt, "The host exhausted the retry budget."),
    status: "failed",
    inputDigest: overBudgetAttempt.inputDigest,
    invocationId: overBudgetAttempt.invocationId,
    outputDigest: sweepBatchAttemptOutputDigest({
      status: "failed",
      error: "The host exhausted the retry budget.",
    }),
    error: "The host exhausted the retry budget.",
  });
  delete overBudget.digest;
  assert.throws(
    () => createSweepBatchReportSet(overBudget, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }),
    /retryBudget|too many/u,
  );

  const duplicateReport = makeSweepBatchReport(inventory, capabilities, {
    attempt: 1,
    inputDigest: `sha256:${"9".repeat(64)}`,
    invocationId: "duplicate-invocation",
    manifest,
  });
  const duplicateAttempt = clone(reportSet);
  duplicateAttempt.attempts.push({
    batch: duplicateReport.batch,
    manifestDigest: manifest.digest,
    attempt: duplicateReport.attempt,
    attemptId: failedAttemptId(duplicateReport, "The host recorded a duplicate attempt ordinal."),
    status: "failed",
    inputDigest: duplicateReport.inputDigest,
    invocationId: duplicateReport.invocationId,
    outputDigest: sweepBatchAttemptOutputDigest({
      status: "failed",
      error: "The host recorded a duplicate attempt ordinal.",
    }),
    error: "The host recorded a duplicate attempt ordinal.",
  });
  delete duplicateAttempt.digest;
  assert.throws(
    () => createSweepBatchReportSet(duplicateAttempt, {
      inventory,
      capabilities,
      ...sweepBatchDependencies,
    }),
    /repeats an attempt number|attemptId|digest/u,
  );
});

test("sweep keeps failed manifest batches and validates cross-batch synthesis", () => {
  const capabilities = makeSweepBatchCapabilities();
  const inventory = makeSweepInventory();
  const [first, second, third] = inventory.fileSourceIds;
  const batches = [
    { id: "batch-001", ordinal: 1, fileSourceIds: [first, second] },
    { id: "batch-002", ordinal: 2, fileSourceIds: [third] },
  ];
  const manifestValue = {
    feature: "sweep-batch-manifest",
    version: 1,
    runId: "sweep-hybrid-run",
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    batches,
    invocationId: "manifest-multi-batch-invocation",
  };
  const modeSelection = createSweepBatchModeSelection({
    feature: "sweep-batch-mode-selection",
    version: 1,
    requestedMode: "subagent-hybrid",
    mode: "subagent-hybrid",
    fallbackUsed: false,
    runId: manifestValue.runId,
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    manifestDigest: digestSweepBatchManifest(manifestValue),
    invocationId: "multi-batch-mode-selection-invocation",
  }, {
    inventory,
    capabilities,
    manifest: {
      ...manifestValue,
      digest: digestSweepBatchManifest(manifestValue),
    },
    ...sweepBatchDependencies,
  });
  const manifest = createSweepBatchManifest(manifestValue, {
    inventory,
    capabilities,
    modeSelection,
    ...sweepBatchDependencies,
  });
  const report = makeSweepBatchReport(inventory, capabilities, {
    batch: batches[0],
    manifest,
    modeSelection,
    relationshipId: "relationship-local",
  });
  const failure = "The second batch exhausted its retry budget.";
  const failureInputDigest = `sha256:${"a".repeat(64)}`;
  const failureOutputDigest = sweepBatchAttemptOutputDigest({
    status: "failed",
    error: failure,
  });
  const failureBindingDigest = sweepBatchBindingDigest({
    runId: manifest.runId,
    inventoryDigest: inventory.digest,
    manifestDigest: manifest.digest,
    batch: batches[1],
    capabilityDigest: capabilities.digest,
  });
  const failureAttemptId = sweepBatchAttemptId({
    bindingDigest: failureBindingDigest,
    manifestDigest: manifest.digest,
    attempt: 1,
    inputDigest: failureInputDigest,
    invocationId: "failed-second-batch-invocation",
    outputDigest: failureOutputDigest,
  });
  const attempts = [
    {
      batch: report.batch,
      manifestDigest: manifest.digest,
      attempt: 1,
      attemptId: report.attemptId,
      status: "succeeded",
      inputDigest: report.inputDigest,
      invocationId: report.invocationId,
      outputDigest: report.outputDigest,
    },
    {
      batch: batches[1],
      manifestDigest: manifest.digest,
      attempt: 1,
      attemptId: failureAttemptId,
      status: "failed",
      inputDigest: failureInputDigest,
      invocationId: "failed-second-batch-invocation",
      outputDigest: failureOutputDigest,
      error: failure,
    },
  ];
  const crossBatchSynthesis = createSweepCrossBatchSynthesis({
    feature: "sweep-cross-batch-synthesis",
    version: 1,
    runId: manifest.runId,
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    manifestDigest: manifest.digest,
    invocationId: "cross-batch-synthesis-invocation",
    inspection: "checked",
    evidenceSourceIds: [...inventory.fileSourceIds],
    relationships: [{
      id: "relationship-cross-batch",
      sourceIds: [first, third],
      status: "observed",
      summary: "A coordinator confirmed a relationship across manifest batches.",
      evidenceSourceIds: [...inventory.fileSourceIds],
      gaps: [],
    }],
    gaps: [],
  }, {
    inventory,
    capabilities,
    manifest,
    modeSelection,
    reports: [report],
    attempts,
    ...sweepBatchDependencies,
  });
  const reportSet = createSweepBatchReportSet({
    feature: "sweep-batch-report-set",
    version: 1,
    runId: manifest.runId,
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    manifest,
    modeSelection,
    crossBatchSynthesis,
    reports: [report],
    attempts,
  }, {
    inventory,
    capabilities,
    ...sweepBatchDependencies,
  });
  const merge = mergeSweepBatchReports(reportSet, {
    inventory,
    capabilities,
    ...sweepBatchDependencies,
  });
  assert.equal(merge.state, "failed");
  assert.equal(merge.batches[1].inspection, "failed");
  assert.ok(merge.relationships.some((item) => item.id === "relationship-cross-batch"));
  const invalidSynthesis = structuredClone(crossBatchSynthesis);
  invalidSynthesis.relationships[0].sourceIds = [first, second];
  delete invalidSynthesis.digest;
  assert.throws(
    () => createSweepCrossBatchSynthesis(invalidSynthesis, {
      inventory,
      capabilities,
      manifest,
      ...sweepBatchDependencies,
    }),
    /cross two or more manifest batches/u,
  );
});

test("sweep binds every category to its exact maintenance checks", () => {
  const wrongCheck = makeSweepPlan();
  wrongCheck.categories[0].checks[0].id = "dead-code";
  assert.throws(
    () => validateTestPlan(wrongCheck),
    /checks\[0\]\.id must be broken-references/u,
  );

  const wrongState = makeSweepPlan();
  wrongState.categories[0].checks[0].inspection = "partial";
  wrongState.categories[0].checks[0].gaps = ["One path could not be resolved."];
  assert.throws(
    () => validateTestPlan(wrongState),
    /category.*inspection must be partial|inspection must be partial/u,
  );

  const emptyEvidence = makeSweepPlan();
  emptyEvidence.candidates[0].evidenceChecks[0].sourceIds = [];
  assert.throws(
    () => validateTestPlan(emptyEvidence),
    /passed must cite at least one evidence source/u,
  );

  const incomplete = makeSweepPlan();
  incomplete.candidates[0].evidenceChecks[0].status = "inconclusive";
  assert.throws(
    () => validateTestPlan(incomplete),
    /Polish evidence references is incomplete|must pass/u,
  );
});

test("sweep supports every declared maintenance check", () => {
  for (const check of SWEEP_CHECK_CATALOG) {
    const input = makeSweepPlan();
    const candidate = input.candidates[0];
    candidate.id = `candidate-${check.id}`;
    candidate.categoryId = check.categoryId;
    candidate.checkId = check.id;
    candidate.evidenceSourceIds = ["repo"];
    candidate.evidenceChecks = check.evidenceChecks.map((id) => ({
      id,
      status: "passed",
      detail: `${id} was checked at the captured codebase identity.`,
      sourceIds: ["repo"],
    }));
    const plan = validateTestPlan(input);
    assert.equal(plan.candidates[0].checkId, check.id);
    assert.equal(plan.result.executableCandidates, 1);
  }
});

test("sweep routes work from three separate impact decisions", () => {
  const dependencyChange = makeSweepPlan();
  dependencyChange.candidates[0].dependencyImpact = "changing";
  assert.throws(
    () => validateTestPlan(dependencyChange),
    /Polish work must preserve dependencies/u,
  );

  const publicHandoff = makeSweepPlan();
  publicHandoff.candidates[0].disposition = "handoff";
  publicHandoff.candidates[0].publicContractImpact = "changing";
  publicHandoff.session.state = "complete-with-findings";
  assert.equal(validateTestPlan(publicHandoff).result.handoffs, 1);

  const unnecessaryReport = makeSweepPlan();
  unnecessaryReport.candidates[0].disposition = "report-only";
  unnecessaryReport.session.state = "complete-with-findings";
  assert.throws(
    () => validateTestPlan(unnecessaryReport),
    /report-only work must record an uncertain impact|fully supported preserving work must use Polish/u,
  );
});

test("sweep derives no-change, findings-only, and blocked plan states", () => {
  const noChange = makeSweepPlan();
  noChange.candidates = [];
  noChange.session.state = "complete-no-change";
  assert.equal(validateTestPlan(noChange).result.state, "complete-no-change");

  const findings = makeSweepPlan();
  findings.candidates[0].disposition = "report-only";
  findings.candidates[0].behaviorImpact = "uncertain";
  findings.candidates[0].gaps = ["A dynamic caller may exist."];
  findings.session.state = "complete-with-findings";
  assert.equal(validateTestPlan(findings).result.reportOnly, 1);

  const blocked = makeSweepPlan();
  blocked.candidates = [];
  blocked.categories[0].checks[0].inspection = "partial";
  blocked.categories[0].checks[0].gaps = ["One reference source was unavailable."];
  blocked.categories[0].inspection = "partial";
  blocked.categories[0].gaps = ["Integrity inspection was incomplete."];
  blocked.session.state = "blocked";
  assert.equal(validateTestPlan(blocked).result.state, "blocked");
});

test("sweep binds approval to the exact plan, candidate, sources, and preview", () => {
  const plan = makeSweepPlan();
  const first = makeSweepApprovalCandidate(plan);
  const second = makeSweepApprovalCandidate(plan);
  assert.equal(first.candidateDigest, second.candidateDigest);

  const changed = makeSweepPlan();
  changed.candidates[0].preview.patch = "*** Delete two files";
  const changedCandidate = createSweepApprovalCandidate(
    changed,
    "remove-unused-helper",
    (() => {
      const inventory = makeSweepInventory(changed);
      return {
        inventory,
        verifyLiveInventory: verifySweepLiveInventory(inventory),
      };
    })(),
  );
  assert.notEqual(changedCandidate.candidateDigest, first.candidateDigest);

  const planInventory = makeSweepInventory(plan);
  assert.equal(first.planDigest, sweepPlanDigest(plan, {
    inventory: planInventory,
    verifyLiveInventory: verifySweepLiveInventory(planInventory),
  }));
  assert.equal(
    createSweepApprovalCandidate(plan, "remove-unused-helper", {
      ...(() => {
        const inventory = makeSweepInventory(plan);
        return {
          inventory,
          verifyLiveInventory: verifySweepLiveInventory(inventory),
        };
      })(),
      planDigest: `sha256:${"9".repeat(64)}`,
    }).planDigest,
    first.planDigest,
  );

  for (const [label, mutate] of [
    ["target identity", (value) => {
      value.snapshot.sources.find((source) => source.id === "target-file").digest =
        `sha256:${"8".repeat(64)}`;
    }],
    ["evidence identity", (value) => {
      value.snapshot.sources.find((source) => source.id === "entrypoints").digest =
        `sha256:${"7".repeat(64)}`;
    }],
    ["source ID", (value) => {
      value.snapshot.sources.find((source) => source.id === "target-file").id =
        "renamed-target";
      value.candidates[0].targetSourceIds = ["renamed-target"];
      for (const category of value.categories) {
        category.evidenceSourceIds = category.evidenceSourceIds.map(
          (sourceId) => sourceId === "target-file" ? "renamed-target" : sourceId,
        );
        for (const check of category.checks) {
          check.evidenceSourceIds = check.evidenceSourceIds.map(
            (sourceId) => sourceId === "target-file" ? "renamed-target" : sourceId,
          );
        }
      }
    }],
    ["preview", (value) => {
      value.candidates[0].preview.summary = "Delete the exact renamed preview.";
    }],
    ["maximumChanges", (value) => {
      value.candidates[0].maximumChanges = 2;
    }],
  ]) {
    const variant = makeSweepPlan();
    mutate(variant);
    const fileSourceIds = variant.snapshot.sources
      .filter((source) => source.kind === "file")
      .map((source) => source.id);
    variant.coverage.fileSourceIds = [...fileSourceIds];
    variant.coverage.batches[0].fileSourceIds = [...fileSourceIds];
    variant.coverage.inventoryDigest = sweepInventoryDigest(variant.snapshot);
    const bound = createSweepApprovalCandidate(
      variant,
      "remove-unused-helper",
      (() => {
        const inventory = makeSweepInventory(variant);
        return {
          inventory,
          verifyLiveInventory: verifySweepLiveInventory(inventory),
        };
      })(),
    );
    assert.notEqual(bound.candidateDigest, first.candidateDigest, label);
  }

  const handoff = makeSweepPlan();
  handoff.candidates[0].disposition = "handoff";
  handoff.candidates[0].publicContractImpact = "changing";
  handoff.candidates[0].gaps = ["The public contract must change."];
  handoff.session.state = "complete-with-findings";
  assert.throws(
    () => createSweepApprovalCandidate(
      handoff,
      "remove-unused-helper",
      (() => {
        const inventory = makeSweepInventory(handoff);
        return {
          inventory,
          verifyLiveInventory: verifySweepLiveInventory(inventory),
        };
      })(),
    ),
    /is not executable by Polish/u,
  );
});

test("sweep approval receipts bind the decision and conversation authority", () => {
  const receipt = makeSweepApprovalReceipt();
  assert.equal(
    validateSweepApprovalReceipt(receipt, sweepApprovalDependencies).decision,
    "approved",
  );

  const forged = clone(receipt);
  forged.decision = "rejected";
  assert.throws(
    () => validateSweepApprovalReceipt(forged, sweepApprovalDependencies),
    /receiptDigest does not match/u,
  );

  assert.throws(
    () => validateSweepApprovalReceipt(receipt),
    /requires a trusted host attestation verifier/u,
  );
  assert.throws(
    () => validateSweepApprovalReceipt(receipt, {
      verifyApprovalAttestation: () => false,
    }),
    /was not verified by the trusted host/u,
  );
});

test("sweep validates an exact approved and verified completion", () => {
  const completion = validateCompletion(makeSweepCompletion());
  assert.equal(completion.result.status, "applied");
  assert.equal(completion.result.changed, true);
  assert.deepEqual(completion.outcome.removedSourceIds, ["target-file"]);
  assert.equal(
    completion.result.verificationStatus,
    "verified-in-checked-scope",
  );
});

test("sweep rejects an invented output identity for a removed target", () => {
  const completion = clone(makeSweepCompletion());
  const target = completion.snapshot.sources.find(
    (source) => source.id === "target-file",
  );
  completion.outcome.outputSnapshot = {
    capturedAt: "2026-08-04T00:06:00.000Z",
    sources: [{ ...target, digest: `sha256:${"9".repeat(64)}` }],
  };
  assert.throws(
    () => validateCompletion(completion),
    /must contain every surviving target source|must match the validated Polish output/u,
  );
});

test("sweep keeps surviving target identities for no-change", () => {
  const completion = clone(makeSweepCompletion());
  const target = completion.snapshot.sources.find(
    (source) => source.id === "target-file",
  );
  const polish = makeSweepPolishRun(completion.approvalReceipt);
  polish.plan = [];
  polish.outcome = {
    status: "no-change",
    outputSnapshot: {
      capturedAt: "2026-08-04T00:06:00.000Z",
      sources: [{ ...target }],
    },
    removedSourceIds: [],
    changes: [],
    unresolved: [],
  };
  polish.application = {
    status: "not-needed",
    authoritySourceIds: [],
    beforeIdentityChecked: false,
    finalIdentityChecked: false,
  };
  completion.polishReceipt = createPolishReceipt(polish);
  completion.outcome = {
    status: "no-change",
    outputSnapshot: {
      capturedAt: "2026-08-04T00:06:00.000Z",
      sources: [{ ...target }],
    },
    removedSourceIds: [],
    changes: [],
    verification: completion.outcome.verification,
    gaps: [],
  };
  assert.equal(validateCompletion(completion).result.status, "no-change");
});

test("sweep binds the Polish receipt to the approved candidate and run", () => {
  const wrongCandidate = clone(makeSweepCompletion());
  wrongCandidate.polishReceipt.run.target.maximumChanges = 2;
  assert.throws(
    () => validateCompletion(wrongCandidate),
    /polishReceipt|receiptDigest|change budget/u,
  );

  const wrongRun = clone(makeSweepCompletion());
  wrongRun.polishReceipt.run.snapshot.sources.find(
    (source) => source.id === "target-file",
  ).digest = `sha256:${"9".repeat(64)}`;
  assert.throws(
    () => validateCompletion(wrongRun),
    /polishReceipt|receiptDigest|approved source/u,
  );
});

test("sweep rejects an approved-action or verification substitution", () => {
  for (const [mutate, message] of [
    [
      (run) => { run.target.purpose = "Delete another implementation."; },
      /approved action and preview/u,
    ],
    [
      (run) => { run.verification[0].method = "Run a smaller test."; },
      /verification methods must match/u,
    ],
    [
      (run) => { run.application.comparison = "*** Delete another file"; },
      /comparison must match the approved patch preview/u,
    ],
  ]) {
    const completion = clone(makeSweepCompletion());
    const run = makeSweepPolishRun(completion.approvalReceipt);
    mutate(run);
    completion.polishReceipt = createPolishReceipt(run);
    assert.throws(() => validateCompletion(completion), message);
  }
});

test("sweep invalidates approval when a bound source changes", () => {
  const stale = clone(makeSweepCompletion());
  stale.snapshot.sources.find((source) => source.id === "target-file").digest =
    `sha256:${"9".repeat(64)}`;
  delete stale.polishReceipt;
  stale.outcome = {
    status: "stale",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    verification: [],
    gaps: ["The target changed after approval."],
  };
  const completion = validateCompletion(stale);
  assert.equal(completion.result.status, "stale");
});

test("sweep keeps a Polish material choice as an ordinary-task handoff", () => {
  const handoff = clone(makeSweepCompletion());
  const polish = makeSweepPolishRun(handoff.approvalReceipt);
  polish.plan = [];
  for (const condition of polish.preservation) condition.verificationIds = [];
  polish.outcome = {
    status: "needs-alignment",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    unresolved: ["Removing the file requires a public contract decision."],
  };
  polish.verification = [];
  polish.application = {
    status: "not-needed",
    authoritySourceIds: [],
    beforeIdentityChecked: false,
    finalIdentityChecked: false,
  };
  handoff.polishReceipt = createPolishReceipt(polish);
  handoff.outcome = {
    status: "handed-off",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    verification: [],
    gaps: ["Removing the file requires a public contract decision."],
  };
  assert.equal(validateCompletion(handoff).result.status, "handed-off");
});

test("sweep derives the file budget from cited file sources", () => {
  const understated = makeSweepPlan();
  understated.summary.filesChecked = 2;
  assert.throws(
    () => validateTestPlan(understated),
    /must equal the 3 distinct file sources/u,
  );

  const overstated = makeSweepPlan();
  overstated.summary.filesChecked = 4;
  assert.throws(
    () => validateTestPlan(overstated),
    /must equal the 3 distinct file sources/u,
  );
});

test("sweep full-codebase candidates target only inventory files", () => {
  const plan = makeSweepPlan();
  plan.candidates[0].targetSourceIds = ["repo"];
  assert.throws(
    () => validateTestPlan(plan),
    /targetSourceIds must contain only inventory file sources/u,
  );
});

test("sweep session result binds every candidate, completion, and gap", () => {
  const result = validateSessionResult(makeSweepSessionResult());
  assert.equal(result.result.state, "complete");
  assert.equal(result.result.completedCandidates, 1);

  const missingCandidate = clone(makeSweepSessionResult());
  missingCandidate.candidateResults = [];
  assert.throws(
    () => validateSessionResult(missingCandidate),
    /must contain every plan candidate|unreported candidate/u,
  );

  const wrongCompletion = clone(makeSweepSessionResult());
  wrongCompletion.candidateResults[0].completionDigest = `sha256:${"9".repeat(64)}`;
  assert.throws(
    () => validateSessionResult(wrongCompletion),
    /completionDigest must match/u,
  );

  const omittedGap = clone(makeSweepSessionResult());
  omittedGap.plan.summary.remainingGaps = ["One package path was not inspected."];
  const omittedGapInventory = makeSweepInventory(omittedGap.plan);
  omittedGap.planDigest = sweepPlanDigest(omittedGap.plan, {
    inventory: omittedGapInventory,
    verifyLiveInventory: verifySweepLiveInventory(omittedGapInventory),
  });
  assert.throws(
    () => validateSessionResult(omittedGap),
    /remainingGaps must keep every unresolved/u,
  );
});

test("sweep enforces the approved budget and target-linked verification", () => {
  const overBudget = clone(makeSweepCompletion());
  const extraChange = clone(overBudget.outcome.changes[0]);
  extraChange.polishChangeId = "extra-change";
  overBudget.outcome.changes.push(extraChange);
  assert.throws(
    () => validateCompletion(overBudget),
    /exceed the approved maximumChanges/u,
  );

  const unrelated = clone(makeSweepCompletion());
  unrelated.outcome.verification[0].sourceIds = ["repo"];
  assert.throws(
    () => validateCompletion(unrelated),
    /needs a linked passed verification/u,
  );

  const failed = clone(makeSweepCompletion());
  failed.outcome.verification[0].status = "failed";
  assert.throws(
    () => validateCompletion(failed),
    /requires every verification to pass|needs a linked passed verification/u,
  );

  const empty = clone(makeSweepCompletion());
  empty.outcome.verification = [];
  assert.throws(
    () => validateCompletion(empty),
    /requires every verification to pass|unknown verification ID/u,
  );
});

test("sweep brief and CLI expose the two-stage contract", async () => {
  const brief = await createSweepBrief(
    { risk: "high" },
    { loadWritingStandard: async () => "shared standard\n" },
  );
  assert.equal(brief.feature, "sweep");
  assert.equal(brief.categories.length, 7);
  assert.equal(brief.composition.dependency, "Sweep -> Polish");
  assert.match(brief.approvalSchemaPath, /approval-v1\.schema\.json$/u);
  assert.match(brief.inventorySchemaPath, /inventory-v1\.schema\.json$/u);
  assert.match(brief.discovery.join(" "), /every tracked and unignored/u);
  assert.match(brief.approval.join(" "), /Do not modify repository files/u);
  assert.equal(brief.writingStandard.text, "shared standard\n");
  assert.deepEqual(
    parseSweepArguments([
      "approval-candidate",
      "--input",
      "/tmp/plan.json",
      "--candidate",
      "candidate-1",
      "--root",
      "/tmp/repository",
    ]),
    {
      candidateId: "candidate-1",
      command: "approval-candidate",
      inputPath: "/tmp/plan.json",
      repositoryRoot: "/tmp/repository",
    },
  );
  assert.deepEqual(
    parseSweepArguments(["inventory", "--root", "/tmp/repository"]),
    { command: "inventory", root: "/tmp/repository" },
  );
  assert.deepEqual(
    parseSweepArguments([
      "model-evaluation-prepare",
      "--case",
      "sweep-safe-private",
      "--run",
      "1",
    ]),
    {
      caseId: "sweep-safe-private",
      command: "model-evaluation-prepare",
      run: 1,
    },
  );
  assert.deepEqual(
    parseSweepArguments([
      "approval-receipt",
      "--input",
      "/tmp/approval.json",
    ]),
    {
      command: "approval-receipt",
      inputPath: "/tmp/approval.json",
    },
  );
  assert.throws(
    runSweep,
    (error) => error.code === SWEEP_MODEL_ADAPTER_CODE,
  );
});
