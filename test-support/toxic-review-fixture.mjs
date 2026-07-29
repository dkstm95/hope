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
