import { makeWorkSnapshot } from "./work-snapshot-fixture.mjs";

export function makeToxicReview(overrides = {}) {
  return {
    version: 1,
    title: "Challenge the implementation plan",
    risk: "high",
    target: {
      kind: "plan",
      stage: "design",
      summary: "A plan for adding a shared feature boundary.",
    },
    snapshot: makeWorkSnapshot(),
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
    findings: [
      {
        id: "finding-1",
        roleId: "role-1",
        title: "The verification is too narrow",
        issue: "The plan tests the Skill but not the harness route.",
        impact: "The two entry paths can silently diverge.",
        action: "Add a two-track boundary test.",
        priority: "medium",
        confidence: "established",
        sourceIds: ["repository-1"],
      },
      {
        id: "finding-2",
        roleId: "role-1",
        title: "The core boundary is missing",
        issue: "Behavior currently lives only in an adapter.",
        impact: "The feature cannot be used independently.",
        action: "Move the contract into a shared feature core.",
        priority: "critical",
        confidence: "supported",
        sourceIds: ["repository-1"],
      },
    ],
    adjudications: [
      {
        findingId: "finding-1",
        status: "accepted",
        rationale: "The repository requires entry-path parity.",
        action: "Add a test that invokes both generated and harness paths.",
        impact: "The two entry paths can silently diverge.",
        priority: "high",
        confidence: "established",
        sourceIds: ["repository-1"],
      },
      {
        findingId: "finding-2",
        status: "partially-accepted",
        rationale: "A core is required, but only current behavior should move.",
        action: "Create the smallest shared core used by both paths.",
        impact: "The feature cannot be used independently.",
        priority: "medium",
        confidence: "supported",
        sourceIds: ["repository-1"],
      },
    ],
    summary: {
      assessment: "The plan is not ready until the shared boundary exists.",
      biggestRisk: "Adapter-only behavior will diverge.",
      nextMove: "Create the core and prove both entry paths reach it.",
      noMaterialIssueFound: false,
      scopeLimits: ["Deployment behavior was not reviewed."],
    },
    ...overrides,
  };
}

export function makeCausalToxicReview(overrides = {}) {
  const base = makeToxicReview();
  return {
    ...base,
    roles: [
      {
        ...base.roles[0],
        method: "causal-completeness",
      },
    ],
    causalAnalysis: {
      roleId: "role-1",
      outcome: "The named workflow takes materially longer than expected.",
      baseline: "The captured run records the complete end-to-end duration.",
      claimAssessment: "unsupported",
      causeLevel: "mixed",
      candidateCount: 2,
      flow: [
        {
          id: "phase-1",
          phase: "Repeated boundary work",
          observation: "The same bounded transition appears on the critical path.",
          sourceIds: ["repository-1"],
          candidateIds: ["candidate-1"],
        },
        {
          id: "phase-2",
          phase: "Local transformation",
          observation: "One local operation also consumes measured time.",
          sourceIds: ["repository-1"],
          candidateIds: ["candidate-2"],
        },
      ],
      candidates: [
        {
          id: "candidate-1",
          level: "structural",
          location: "The repeated host-to-runtime boundary",
          statement: "Repeated boundary work may dominate the captured outcome.",
          evidence: "The transition occurs repeatedly on the critical path.",
          assumptions: ["The captured transition spans are not overlapped."],
          disconfirmingPrediction: "Exclusive timing would show little time at the repeated boundary.",
          sourceIds: ["repository-1"],
        },
        {
          id: "candidate-2",
          level: "local",
          location: "The local transformation phase",
          statement: "The local transformation may materially contribute to the outcome.",
          evidence: "The captured source records a material local duration.",
          assumptions: ["The local duration lies on the critical path."],
          disconfirmingPrediction: "Exclusive timing would show that the local duration overlaps other work.",
          sourceIds: ["repository-1"],
        },
      ],
      nextCheck: {
        kind: "discriminate",
        action: "Capture one comparable run with mutually exclusive spans.",
        rationale: "One bounded trace can distinguish the two retained candidates.",
        candidateIds: ["candidate-1", "candidate-2"],
      },
    },
    ...overrides,
  };
}
