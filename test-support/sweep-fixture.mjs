import {
  createSweepApprovalCandidate,
  createSweepApprovalReceipt,
  sweepCompletionDigest,
  sweepPlanDigest,
  sweepApprovalStatementDigest,
} from "../features/sweep/validate.mjs";
import { sweepInventoryDigest } from "../features/sweep/inventory.mjs";
import { createPolishReceipt } from "../features/polish/validate.mjs";
import { SWEEP_CATEGORY_CATALOG } from "../features/sweep/constants.mjs";

const digest = (character) => `sha256:${character.repeat(64)}`;

export const sweepApprovalDependencies = Object.freeze({
  verifyApprovalAttestation(attestation, statement) {
    return attestation.issuer === "hope-test-host"
      && attestation.eventId === "test-user-decision"
      && attestation.proof === "opaque-test-host-proof"
      && attestation.statementDigest === statement.statementDigest;
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
  return createSweepApprovalCandidate(plan, "remove-unused-helper");
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
  return {
    version: 1,
    title: "Complete the example Sweep session",
    plan,
    planDigest: sweepPlanDigest(plan),
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
