export function makePolishRun(overrides = {}) {
  const targetSource = {
    id: "target-1",
    kind: "file",
    label: "Guide",
    locator: "docs/guide.md",
    digest: `sha256:${"a".repeat(64)}`,
  };
  return {
    version: 2,
    title: "Refine the guide",
    risk: "medium",
    snapshot: {
      capturedAt: "2026-07-29T00:00:00.000Z",
      sources: [
        targetSource,
        {
          id: "request-1",
          kind: "conversation",
          label: "Polish request",
          locator: "conversation turn 1",
          digest: `sha256:${"b".repeat(64)}`,
        },
        {
          id: "rules-1",
          kind: "file",
          label: "Project writing rules",
          locator: "AGENTS.md",
          digest: `sha256:${"c".repeat(64)}`,
        },
      ],
    },
    target: {
      name: "Documentation guide",
      purpose: "Explain the feature without repeating the same requirement.",
      sourceIds: ["target-1"],
      inScope: ["Repeated and unclear prose in the guide."],
      outOfScope: ["Product behavior and public contracts."],
      maximumChanges: 4,
    },
    preservation: [
      {
        id: "preserve-meaning",
        condition: "Keep every product requirement and uncertainty.",
        rationale: "Polish may clarify the guide but may not redesign the feature.",
        sourceIds: ["target-1", "request-1", "rules-1"],
        verificationIds: ["verify-meaning"],
      },
    ],
    plan: [
      {
        id: "plan-1",
        target: "The repeated preservation paragraph.",
        action: "Merge the repeated sentences into one paragraph.",
        reason: "The sentences make the same claim and cite the same contract.",
        sourceIds: ["target-1", "rules-1"],
        preservationIds: ["preserve-meaning"],
        verificationIds: ["verify-meaning"],
        risk: "low",
      },
    ],
    outcome: {
      status: "revised",
      outputSnapshot: {
        capturedAt: "2026-07-29T00:05:00.000Z",
        sources: [
          {
            ...targetSource,
            digest: `sha256:${"d".repeat(64)}`,
          },
        ],
      },
      removedSourceIds: [],
      changes: [
        {
          id: "change-1",
          planItemId: "plan-1",
          summary: "Merged two repeated preservation statements.",
          reason: "One statement carries the same requirement more directly.",
          sourceIds: ["target-1", "rules-1"],
          preservationIds: ["preserve-meaning"],
          verificationIds: ["verify-meaning"],
        },
      ],
      unresolved: [],
    },
    verification: [
      {
        id: "verify-meaning",
        name: "Requirement comparison",
        method: "Compare the revised guide with the captured product contract.",
        status: "passed",
        scope: "The changed paragraph and its surrounding section.",
        detail: "Every requirement remains and no certainty level changed.",
        sourceIds: ["target-1", "rules-1"],
      },
    ],
    application: {
      status: "applied",
      authoritySourceIds: ["request-1"],
      comparison: "Compared the captured guide with the applied revision.",
      beforeIdentityChecked: true,
      finalIdentityChecked: true,
    },
    summary: {
      assessment: "The guide is shorter without changing its requirements.",
      scopeLimits: ["Only the captured guide was checked."],
    },
    ...overrides,
  };
}
