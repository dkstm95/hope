import { makeWorkSnapshot } from "./work-snapshot-fixture.mjs";

export function makeToxicReviewRunPlan(overrides = {}) {
  return {
    version: 1,
    runId: "review-run-1",
    title: "Challenge the implementation plan",
    risk: "high",
    target: {
      kind: "plan",
      stage: "design",
      summary: "A plan for adding one shared feature boundary.",
    },
    snapshot: makeWorkSnapshot(),
    selection: {
      reason: "One boundary review covers the material risk.",
      maximumRoles: 1,
      roles: [
        {
          id: "role-1",
          name: "Boundary skeptic",
          target: "The proposed feature and adapter boundary.",
          focusRisks: ["Duplicated behavior across entry paths."],
          evidenceSourceIds: ["repository-1"],
          excludedAreas: ["Visual polish."],
          claimsToTest: ["Every entry path reaches the same core."],
          expectedOutput: "Only evidence-linked boundary findings.",
        },
      ],
    },
    execution: {
      mode: "single",
      independentContexts: false,
    },
    ...overrides,
  };
}

export function makeMultiRoleToxicReviewRunPlan(overrides = {}) {
  const base = makeToxicReviewRunPlan();
  return {
    ...base,
    selection: {
      reason: "The boundary and request evidence create distinct material risks.",
      maximumRoles: 2,
      roles: [
        base.selection.roles[0],
        {
          id: "role-2",
          name: "Requirement skeptic",
          target: "The stated user outcome and scope.",
          focusRisks: ["The implementation can miss the requested outcome."],
          evidenceSourceIds: ["conversation-1"],
          excludedAreas: ["Repository implementation details."],
          claimsToTest: ["The plan covers the requested outcome."],
          expectedOutput: "Only evidence-linked requirement findings.",
        },
      ],
    },
    execution: {
      mode: "parallel",
      independentContexts: true,
    },
    ...overrides,
  };
}

export function makeToxicReviewRoleResult(input, {
  findings = [
    {
      id: `${input.roleId}-finding-1`,
      roleId: input.roleId,
      title: "The verification is too narrow",
      issue: "The plan does not test every supported entry path.",
      impact: "The entry paths can silently diverge.",
      action: "Add one entry-path parity test.",
      priority: "high",
      confidence: "established",
      sourceIds: [input.snapshot.sources[0].id],
    },
  ],
  causalAnalysis,
} = {}) {
  return {
    version: 1,
    runId: input.runId,
    roleId: input.roleId,
    attemptId: input.attemptId,
    bindingDigest: input.bindingDigest,
    inputDigest: input.inputDigest,
    status: "succeeded",
    findings,
    ...(causalAnalysis ? { causalAnalysis } : {}),
  };
}

export function makeToxicReviewAdjudication(run, { empty = false } = {}) {
  const findings = empty
    ? []
    : run.roleStates.flatMap((role) => role.attempts.at(-1).result.findings);
  return {
    version: 1,
    runId: run.runId,
    adjudications: findings.map((finding) => ({
      findingId: finding.id,
      status: "accepted",
      rationale: "The finding is supported by its assigned evidence.",
      action: finding.action,
      impact: finding.impact,
      priority: finding.priority,
      confidence: finding.confidence,
      sourceIds: finding.sourceIds,
    })),
    summary: findings.length === 0
      ? {
          assessment: "No material issue was found in the checked scope.",
          noMaterialIssueFound: true,
          scopeLimits: ["Only the assigned sources were checked."],
        }
      : {
          assessment: "The checked plan needs one or more corrections.",
          biggestRisk: "The supported entry paths can diverge.",
          nextMove: "Apply the accepted corrections and rerun the checks.",
          noMaterialIssueFound: false,
          scopeLimits: ["Only the assigned sources were checked."],
        },
  };
}
