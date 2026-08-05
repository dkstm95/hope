import {
  createSweepBatchCapabilities,
  createSweepBatchManifest,
  createSweepBatchModeSelection,
  createSweepBatchReport,
  createSweepBatchReportSet,
  createSweepCrossBatchSynthesis,
  sweepBatchAttemptOutputDigest,
  sweepBatchAttemptId,
  sweepBatchBindingDigest,
  sweepBatchOutputDigest,
  digestSweepBatchManifest,
  mergeSweepBatchReports,
} from "../features/sweep/batch.mjs";
import {
  createSweepApprovalCandidate,
  createSweepApprovalReceipt,
  sweepCompletionDigest,
  sweepPlanDigest,
  sweepApprovalStatementDigest,
} from "../features/sweep/validate.mjs";
import { sweepInventoryDigest } from "../features/sweep/inventory.mjs";
import { createPolishReceipt } from "../features/polish/validate.mjs";
import {
  SWEEP_CATEGORY_CATALOG,
  SWEEP_CHECK_CATALOG,
} from "../features/sweep/constants.mjs";

const digest = (character) => `sha256:${character.repeat(64)}`;

export const sweepApprovalDependencies = Object.freeze({
  verifyApprovalAttestation(attestation, statement) {
    return attestation.issuer === "hope-test-host"
      && attestation.eventId === "test-user-decision"
      && attestation.proof === "opaque-test-host-proof"
      && attestation.statementDigest === statement.statementDigest;
  },
});

export const sweepBatchDependencies = Object.freeze({
  verifyBatchCapabilities(capabilities) {
    return capabilities.mode === "subagent-hybrid"
      && capabilities.readOnly === true
      && capabilities.independentContexts === true
      && capabilities.sourceAllowlist === true
      && capabilities.boundedOutput === true;
  },
  verifyBatchInvocation(value) {
    return typeof value.invocationId === "string"
      && value.invocationId.length > 0;
  },
});

export function makeSweepPlan() {
  const snapshot = {
    capturedAt: "2026-08-04T00:00:00.000Z",
    sources: [
      {
        id: "repo",
        kind: "git",
        label: "Repository head",
        locator: "git:example/hope",
        revision: "1".repeat(40),
      },
      {
        id: "target-file",
        kind: "file",
        label: "Unused helper",
        locator: "src/unused-helper.mjs",
        digest: digest("a"),
      },
      {
        id: "entrypoints",
        kind: "file",
        label: "Package entry points",
        locator: "package.json",
        digest: digest("b"),
      },
      {
        id: "project-rules",
        kind: "file",
        label: "Project rules",
        locator: "AGENTS.md",
        digest: digest("c"),
      },
    ],
  };
  const sourceIds = snapshot.sources.map((source) => source.id);
  const fileSourceIds = snapshot.sources
    .filter((source) => source.kind === "file")
    .map((source) => source.id);
  const categories = SWEEP_CATEGORY_CATALOG.map((category) => ({
    id: category.id,
    support: category.support,
    inspection: "checked",
    summary: "Every maintenance check completed within the declared scope.",
    checks: category.checks.map((checkId) => ({
      id: checkId,
      inspection: "checked",
      summary: `${checkId} completed within the declared scope.`,
      evidenceSourceIds: [...sourceIds],
      gaps: [],
    })),
    evidenceSourceIds: [...sourceIds],
    gaps: [],
  }));
  return {
    version: 1,
    title: "Example codebase sweep",
    risk: "medium",
    snapshot,
    session: {
      id: "sweep-example-session",
      scope: "entire-codebase",
      state: "awaiting-approval",
      budget: {
        maximumFiles: fileSourceIds.length,
        maximumCandidates: 4,
        maximumChanges: 4,
      },
      consideredCategoryIds: SWEEP_CATEGORY_CATALOG.map((item) => item.id),
    },
    coverage: {
      mode: "full-codebase",
      inspectionMode: "active-session",
      inventoryDigest: sweepInventoryDigest(snapshot),
      fileSourceIds: [...fileSourceIds],
      batches: [
        {
          id: "batch-001",
          ordinal: 1,
          fileSourceIds: [...fileSourceIds],
          inspection: "checked",
          gaps: [],
        },
      ],
    },
    categories,
    candidates: [
      {
        id: "remove-unused-helper",
        categoryId: "unused-stale",
        checkId: "dead-code",
        title: "Remove the unused helper",
        targetSourceIds: ["target-file"],
        evidenceSourceIds: ["repo", "entrypoints", "project-rules"],
        behaviorImpact: "preserving",
        publicContractImpact: "preserving",
        dependencyImpact: "preserving",
        disposition: "polish",
        reason: "The private helper has no supported caller or contract.",
        action: "Delete src/unused-helper.mjs.",
        preview: {
          summary: "Delete one private module with no supported caller.",
          patch: "*** Delete File: src/unused-helper.mjs",
        },
        maximumChanges: 1,
        evidenceChecks: [
          {
            id: "references",
            status: "passed",
            detail: "Repository references were checked at the captured head.",
            sourceIds: ["repo"],
          },
          {
            id: "exports-entrypoints",
            status: "passed",
            detail: "The package does not export or start from this module.",
            sourceIds: ["entrypoints"],
          },
          {
            id: "configuration-generation",
            status: "passed",
            detail: "No configuration or generator names this module.",
            sourceIds: ["repo", "entrypoints"],
          },
          {
            id: "external-contracts",
            status: "not-applicable",
            detail: "The module is private and absent from the public package boundary.",
            sourceIds: ["entrypoints"],
          },
          {
            id: "tests-docs",
            status: "passed",
            detail: "Tests and documentation do not define a supported use.",
            sourceIds: ["repo", "project-rules"],
          },
        ],
        verification: [
          "Run the repository test suite.",
          "Recheck package entry points and repository references.",
        ],
        gaps: [],
      },
    ],
    summary: {
      assessment: "One behavior-preserving dead-code candidate needs approval.",
      filesChecked: 3,
      filesInInventory: 3,
      checkedScope: ["Every codebase maintenance category and check"],
      remainingGaps: [],
    },
  };
}

export function makeSweepApprovalCandidate(plan = makeSweepPlan()) {
  const inventory = makeSweepInventory(plan);
  return createSweepApprovalCandidate(plan, "remove-unused-helper", {
    inventory,
    verifyLiveInventory: (candidate) => candidate?.digest === inventory.digest,
  });
}

export function makeSweepInventory(plan = makeSweepPlan()) {
  const fileSourceIds = plan.snapshot.sources
    .filter((source) => source.kind === "file")
    .map((source) => source.id);
  return {
    feature: "sweep-inventory",
    version: 1,
    snapshot: structuredClone(plan.snapshot),
    fileSourceIds,
    digest: sweepInventoryDigest(plan.snapshot),
  };
}

export function verifySweepLiveInventory(inventory) {
  return (candidate) => candidate?.digest === inventory.digest;
}

export function makeSweepBatchCapabilities() {
  return createSweepBatchCapabilities({
    maxConcurrency: 2,
    timeoutMs: 60000,
    retryBudget: 2,
  });
}

export function makeSweepBatchReport(
  inventory = makeSweepInventory(),
  capabilities = makeSweepBatchCapabilities(),
  {
    batch = {
      id: "batch-001",
      ordinal: 1,
      fileSourceIds: [...inventory.fileSourceIds],
    },
    attempt = 1,
    inputDigest = digest("d"),
    invocationId = "sweep-batch-invocation",
    relationshipId = "relationship-entrypoints-target",
    manifest,
    modeSelection,
  } = {},
) {
  const sourceIds = [...batch.fileSourceIds];
  const repositorySourceId = batch.fileSourceIds[0];
  const manifestValue = {
    feature: "sweep-batch-manifest",
    version: 1,
    runId: "sweep-hybrid-run",
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    batches: [batch],
    invocationId: "sweep-batch-manifest-invocation",
  };
  const reportModeSelection = modeSelection ?? createSweepBatchModeSelection({
    feature: "sweep-batch-mode-selection",
    version: 1,
    requestedMode: "subagent-hybrid",
    mode: "subagent-hybrid",
    fallbackUsed: false,
    runId: manifest?.runId ?? manifestValue.runId,
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    manifestDigest: manifest?.digest ?? digestSweepBatchManifest(manifestValue),
    invocationId: "mode-selection-invocation",
  }, {
    inventory,
    capabilities,
    manifest: manifest ?? {
      ...manifestValue,
      digest: digestSweepBatchManifest(manifestValue),
    },
    ...sweepBatchDependencies,
  });
  const reportManifest = manifest ?? createSweepBatchManifest(manifestValue, {
    inventory,
    capabilities,
    modeSelection: reportModeSelection,
    ...sweepBatchDependencies,
  });
  const bindingDigest = sweepBatchBindingDigest({
    runId: "sweep-hybrid-run",
    inventoryDigest: inventory.digest,
    manifestDigest: reportManifest.digest,
    batch,
    capabilityDigest: capabilities.digest,
  });
  const report = {
    feature: "sweep-batch-report",
    version: 1,
    runId: "sweep-hybrid-run",
    inventoryDigest: inventory.digest,
    batch,
    manifestDigest: reportManifest.digest,
    capabilityDigest: capabilities.digest,
    bindingDigest,
    attempt,
    inputDigest,
    invocationId,
    outputDigest: undefined,
    inspection: "checked",
    relationshipInspection: "checked",
    relationshipEvidenceSourceIds: [...batch.fileSourceIds],
    sourceResults: batch.fileSourceIds.map((sourceId) => ({
      sourceId,
      inspection: "checked",
      evidenceSourceIds: [...sourceIds],
      gaps: [],
    })),
    checks: SWEEP_CHECK_CATALOG.map((check) => ({
      id: check.id,
      inspection: "checked",
      summary: `${check.id} completed in the assigned batch.`,
      evidenceSourceIds: [...sourceIds],
      gaps: [],
    })),
    relationships: batch.fileSourceIds.length >= 2
      ? [{
        id: relationshipId,
        sourceIds: batch.fileSourceIds.slice(0, 2),
        status: "observed",
        summary: "The batch preserved a relationship between assigned files.",
        evidenceSourceIds: [repositorySourceId],
        gaps: [],
      }]
      : [],
    observations: [],
    gaps: [],
  };
  report.outputDigest = sweepBatchOutputDigest(report);
  report.attemptId = sweepBatchAttemptId({
    bindingDigest,
    manifestDigest: reportManifest.digest,
    attempt,
    inputDigest,
    invocationId,
    outputDigest: report.outputDigest,
  });
  return createSweepBatchReport(report, {
    inventory,
    manifest: reportManifest,
    modeSelection: reportModeSelection,
    capabilities,
    ...sweepBatchDependencies,
  });
}

export function makeSweepBatchReportSet(
  inventory = makeSweepInventory(),
  capabilities = makeSweepBatchCapabilities(),
) {
  const batch = {
    id: "batch-001",
    ordinal: 1,
    fileSourceIds: [...inventory.fileSourceIds],
  };
  const manifestValue = {
    feature: "sweep-batch-manifest",
    version: 1,
    runId: "sweep-hybrid-run",
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    batches: [batch],
    invocationId: "sweep-batch-manifest-invocation",
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
    invocationId: "mode-selection-invocation",
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
    manifest,
    modeSelection,
  });
  const attempts = [
    {
      batch: report.batch,
      manifestDigest: manifest.digest,
      attempt: report.attempt,
      attemptId: report.attemptId,
      status: "succeeded",
      inputDigest: report.inputDigest,
      invocationId: report.invocationId,
      outputDigest: report.outputDigest,
    },
  ];
  const crossBatchSynthesis = createSweepCrossBatchSynthesis({
    feature: "sweep-cross-batch-synthesis",
    version: 1,
    runId: report.runId,
    inventoryDigest: inventory.digest,
    capabilityDigest: capabilities.digest,
    manifestDigest: manifest.digest,
    invocationId: "sweep-cross-batch-synthesis-invocation",
    inspection: "checked",
    evidenceSourceIds: [...inventory.fileSourceIds],
    relationships: [],
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
  return createSweepBatchReportSet({
    feature: "sweep-batch-report-set",
    version: 1,
    runId: report.runId,
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
}

export function bindSweepPlanToBatchMerge(plan, batchMerge) {
  const mergedEvidenceSourceIds = [...new Set(
    batchMerge.checkResults.flatMap((check) => check.evidenceSourceIds),
  )];
  const deriveInspection = (states) => states.includes("failed")
    ? "failed"
    : states.every((state) => state === "checked")
      ? "checked"
      : states.every((state) => state === "not-checked")
        ? "not-checked"
        : "partial";
  for (const category of plan.categories) {
    category.checks = category.checks.map((check) => {
      const merged = batchMerge.checkResults.find((item) => item.id === check.id);
      return merged
        ? {
          ...check,
          inspection: merged.inspection,
          evidenceSourceIds: [...merged.evidenceSourceIds],
          gaps: [...merged.gaps],
        }
        : check;
    });
    category.inspection = deriveInspection(
      category.checks.map((check) => check.inspection),
    );
    category.evidenceSourceIds = [...new Set(
      category.checks.flatMap((check) => check.evidenceSourceIds),
    )];
  }
  plan.candidates[0].evidenceSourceIds = [...mergedEvidenceSourceIds];
  for (const check of plan.candidates[0].evidenceChecks) {
    check.sourceIds = [...mergedEvidenceSourceIds];
  }
  return plan;
}

export function makeSweepHybridPlan(
  plan = makeSweepPlan(),
  inventory = makeSweepInventory(plan),
  capabilities = makeSweepBatchCapabilities(),
) {
  const reportSet = makeSweepBatchReportSet(inventory, capabilities);
  const batchMerge = mergeSweepBatchReports(reportSet, {
    inventory,
    capabilities,
    ...sweepBatchDependencies,
  });
  plan.coverage.inspectionMode = "subagent-hybrid";
  plan.coverage.batchMergeDigest = batchMerge.digest;
  plan.coverage.relationshipEvidenceSourceIds = [
    ...batchMerge.relationshipEvidenceSourceIds,
  ];
  plan.coverage.relationshipIds = batchMerge.relationships.map((item) => item.id);
  plan.coverage.observationIds = batchMerge.observations.map((item) => item.id);
  plan.coverage.batches = batchMerge.batches.map((batch) => ({
    id: batch.id,
    ordinal: batch.ordinal,
    fileSourceIds: [...batch.fileSourceIds],
    inspection: batch.inspection,
    gaps: [...batch.gaps],
  }));
  bindSweepPlanToBatchMerge(plan, batchMerge);
  return { capabilities, inventory, batchMerge, plan, reportSet };
}

export function makeSweepApprovalReceipt(
  approvalCandidate = makeSweepApprovalCandidate(),
  decision = "approved",
) {
  const authoritySource = {
    id: "approval-source",
    kind: "conversation",
    label: "Exact Sweep approval",
    locator: "codex:conversation:sweep-example-approval",
    digest: digest("e"),
  };
  const approval = {
    approvalCandidate,
    decision,
    authoritySource,
  };
  return createSweepApprovalReceipt({
    ...approval,
    hostAttestation: {
      version: 1,
      issuer: "hope-test-host",
      eventId: "test-user-decision",
      issuedAt: "2026-08-04T00:04:00.000Z",
      statementDigest: sweepApprovalStatementDigest(approval),
      proof: "opaque-test-host-proof",
    },
  }, sweepApprovalDependencies);
}

export function makeSweepPolishRun(
  approvalReceipt = makeSweepApprovalReceipt(),
) {
  const candidate = approvalReceipt.approvalCandidate.candidate;
  const executionContract = approvalReceipt.approvalCandidate.executionContract;
  const sources = [
    ...approvalReceipt.approvalCandidate.sources.map((source) => ({ ...source })),
    { ...approvalReceipt.authoritySource },
  ];
  const targetId = candidate.targetSourceIds[0];
  const allSourceIds = sources.map((source) => source.id);
  return {
    version: 2,
    title: "Remove the approved unused helper",
    risk: "medium",
    snapshot: {
      capturedAt: "2026-08-04T00:05:00.000Z",
      sources,
    },
    composition: {
      caller: "sweep",
      sessionId: approvalReceipt.approvalCandidate.sessionId,
      workUnitDigest: approvalReceipt.approvalCandidate.candidateDigest,
      executionContractDigest:
        approvalReceipt.approvalCandidate.executionContractDigest,
      authorityReceiptDigest: approvalReceipt.receiptDigest,
    },
    target: {
      ...structuredClone(executionContract.target),
    },
    preservation: executionContract.preservation.map((item) => ({
      id: item.id,
      condition: item.condition,
      rationale: candidate.reason,
      sourceIds: [...allSourceIds],
      verificationIds: ["repository-tests", "reference-check"],
    })),
    plan: [
      {
        id: "remove-target",
        target: candidate.preview.summary,
        action: candidate.action,
        reason: candidate.reason,
        sourceIds: [targetId],
        preservationIds: executionContract.preservation.map((item) => item.id),
        verificationIds: ["repository-tests", "reference-check"],
        risk: "medium",
      },
    ],
    outcome: {
      status: "revised",
      outputSnapshot: null,
      removedSourceIds: [targetId],
      changes: [
        {
          id: "remove-target-change",
          planItemId: "remove-target",
          summary: "Removed the unused private helper.",
          reason: candidate.reason,
          sourceIds: [targetId],
          preservationIds: executionContract.preservation.map((item) => item.id),
          verificationIds: ["repository-tests", "reference-check"],
        },
      ],
      unresolved: [],
    },
    verification: [
      {
        id: "repository-tests",
        name: "Repository tests",
        method: candidate.verification[0],
        status: "passed",
        scope: "The example repository test suite.",
        detail: "Every repository test passed.",
        sourceIds: [targetId],
      },
      {
        id: "reference-check",
        name: "Reference check",
        method: candidate.verification[1],
        status: "passed",
        scope: "Package entry points and repository references.",
        detail: "No supported reference points to the removed target.",
        sourceIds: [targetId, "repo", "entrypoints"],
      },
    ],
    application: {
      status: "applied",
      authoritySourceIds: [approvalReceipt.authoritySource.id],
      comparison: candidate.preview.patch,
      beforeIdentityChecked: true,
      finalIdentityChecked: true,
    },
    summary: {
      assessment: "The exact approved dead-code target was removed.",
      scopeLimits: ["Only the approved Sweep candidate was changed."],
    },
  };
}

export function makeSweepCompletion() {
  const approvalReceipt = makeSweepApprovalReceipt();
  const polishReceipt = createPolishReceipt(makeSweepPolishRun(approvalReceipt));
  const sources = [
    ...approvalReceipt.approvalCandidate.sources.map((source) => ({ ...source })),
    { ...approvalReceipt.authoritySource },
  ];
  return {
    version: 1,
    title: "Complete the unused helper removal",
    snapshot: {
      capturedAt: "2026-08-04T00:05:00.000Z",
      sources,
    },
    approvalReceipt,
    polishReceipt,
    outcome: {
      status: "applied",
      outputSnapshot: null,
      removedSourceIds: ["target-file"],
      changes: [
        {
          polishChangeId: "remove-target-change",
          summary: "Removed the unused private helper.",
          sourceIds: ["target-file"],
          verificationIds: ["repository-tests"],
        },
      ],
      verification: [
        {
          id: "repository-tests",
          name: "Repository tests",
          method: approvalReceipt.approvalCandidate.candidate.verification[0],
          status: "passed",
          scope: "The example repository test suite.",
          detail: "Every repository test passed.",
          sourceIds: ["target-file", "repo"],
        },
        {
          id: "reference-check",
          name: "Reference check",
          method: approvalReceipt.approvalCandidate.candidate.verification[1],
          status: "passed",
          scope: "Package entry points and repository references.",
          detail: "No supported reference points to the removed target.",
          sourceIds: ["target-file", "repo", "entrypoints"],
        },
      ],
      gaps: [],
    },
    summary: {
      assessment: "The exact approved dead-code candidate was applied and verified.",
      remainingGaps: [],
    },
  };
}

export function makeSweepSessionResult() {
  const plan = makeSweepPlan();
  const completion = makeSweepCompletion();
  const inventory = makeSweepInventory(plan);
  return {
    version: 1,
    title: "Complete the example Sweep session",
    plan,
    planDigest: sweepPlanDigest(plan, {
      inventory,
      verifyLiveInventory: verifySweepLiveInventory(inventory),
    }),
    completions: [completion],
    candidateResults: [
      {
        candidateId: "remove-unused-helper",
        disposition: "polish",
        status: "applied",
        completionDigest: sweepCompletionDigest(
          completion,
          sweepApprovalDependencies,
        ),
        gaps: [],
      },
    ],
    summary: {
      state: "complete",
      assessment: "Every planned candidate has a terminal result.",
      remainingGaps: [],
    },
  };
}
