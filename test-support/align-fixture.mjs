import { makeWorkSnapshot } from "./work-snapshot-fixture.mjs";

export function makeAlignState(overrides = {}) {
  return {
    version: 3,
    title: "Add a bounded alignment feature",
    taskRisk: "medium",
    ui: false,
    revision: 3,
    interviewRounds: 2,
    locale: "en-US",
    theme: "system",
    snapshot: makeWorkSnapshot(),
    understanding: {
      goal: "Find material misunderstandings before implementation.",
      success: ["The person can predict the intended behavior."],
      inScope: ["Adaptive questions and deterministic state validation."],
      outOfScope: ["Implementing the aligned task."],
      scenarios: [
        {
          id: "scenario-1",
          kind: "representative",
          situation: "A medium-risk feature changes a shared boundary.",
          expected: "Align activates requirements and checks for verifiable work.",
        },
      ],
    },
    records: {
      facts: [
        {
          id: "fact-1",
          text: "The harness and Skills must share feature code.",
          sourceIds: ["repository-1"],
        },
      ],
      decisions: [
        {
          id: "decision-1",
          text: "The person approved implementation.",
          rationale: "The current state matches the intended scope.",
          sourceIds: ["conversation-1"],
        },
      ],
      proposals: [
        {
          id: "proposal-1",
          text: "Render the state only after several related decisions are settled.",
          rationale: "This avoids repeated model-authored HTML.",
          status: "accepted",
        },
      ],
      openQuestions: [],
    },
    assumptions: [
      {
        id: "assumption-1",
        text: "The host can write one private temporary JSON file.",
        origin: "ai",
        status: "delegated",
        sourceIds: [],
      },
    ],
    uncertainties: [
      {
        id: "uncertainty-1",
        text: "Interactive prototypes need a later declarative contract.",
        classification: "deferred",
        nextStep: "Revisit after the static artifact is used in real work.",
      },
    ],
    perspectives: [
      {
        kind: "shared-understanding",
        state: "active",
        reason: "The task can be interpreted in several ways.",
        items: [
          {
            title: "Teach-back",
            detail: "Confirm goal, scope, examples, and assumptions.",
          },
        ],
      },
      {
        kind: "product-requirements",
        state: "active",
        reason: "The feature adds a new product behavior.",
        items: [
          {
            title: "Approval gate",
            detail: "Implementation waits for explicit user approval.",
          },
        ],
      },
      {
        kind: "experience-design",
        state: "skipped",
        reason: "This fixture does not change an interactive product UI.",
        items: [],
      },
      {
        kind: "system-architecture",
        state: "skipped",
        reason: "No service or storage boundary changes.",
        items: [],
      },
      {
        kind: "program-design",
        state: "skipped",
        reason: "The fixture does not need a program-design decision.",
        items: [],
      },
      {
        kind: "vertical-slices",
        state: "active",
        reason: "The work needs one independently verifiable path.",
        items: [
          {
            title: "Structured state",
            detail: "Validate one state and render one artifact.",
          },
        ],
      },
    ],
    slices: [
      {
        id: "slice-1",
        title: "Validate and render one alignment",
        userChange: "The person can inspect the current shared understanding.",
        scope: "One structured state and one self-contained HTML file.",
        verification: "Validate derived blockers and byte-identical rendering.",
        failureRecovery: "Leave existing outputs untouched and report the error.",
      },
    ],
    changes: [
      {
        round: 2,
        summary: "The approval gate became an explicit user decision.",
      },
    ],
    readiness: {
      state: "ready-proposed",
      rationale: "No contract blocker remains; explicit approval is still required.",
    },
    presentation: {
      primaryAgreementIds: ["decision-1"],
    },
    preview: {
      disposition: "not-required",
      rationale: "This fixture does not change a user interface.",
      changedAspects: ["none"],
      screens: [],
      frames: [],
    },
    ...overrides,
  };
}

export function makeLegacyAlignState(overrides = {}) {
  const {
    presentation: _presentation,
    preview: _preview,
    ...state
  } = makeAlignState(overrides);
  return { ...state, version: 1 };
}

export function makePreviewV2AlignState(overrides = {}) {
  const {
    presentation: _presentation,
    ...state
  } = makeAlignPreviewState(overrides);
  return { ...state, version: 2 };
}

export function makeAlignPreviewState(overrides = {}) {
  const base = makeAlignState();
  return makeAlignState({
    ui: true,
    perspectives: base.perspectives.map((perspective) => (
      perspective.kind === "experience-design"
        ? {
          ...perspective,
          state: "active",
          reason: "The work changes layout and responsive behavior.",
          items: [{
            title: "Responsive preview",
            detail: "Compare one screen at wide and narrow viewports.",
          }],
        }
        : perspective
    )),
    preview: {
      disposition: "provided",
      rationale: "Alignment mockup only; this is not the implementation.",
      changedAspects: ["layout", "visual-hierarchy", "screen-state"],
      screens: [{
        id: "screen-alignment",
        label: "Alignment approval screen",
        scenarioId: "scenario-1",
        state: "Awaiting approval",
        root: {
          id: "screen-root",
          type: "group",
          label: "Approval content",
          layout: "stack",
          children: [
            { id: "screen-status", type: "status", text: "Awaiting approval" },
            { id: "screen-title", type: "heading", level: 1, text: "Align the work" },
            { id: "screen-goal", type: "text", text: "Confirm the goal and next action." },
            { id: "screen-action", type: "action", text: "Approve or revise this understanding" },
            {
              id: "screen-details",
              type: "group",
              label: "Scope and decisions",
              layout: "row",
              children: [
                {
                  id: "screen-scope",
                  type: "list",
                  label: "Scope",
                  items: ["Decision-centered flow", "Static UI preview"],
                },
                {
                  id: "screen-decisions",
                  type: "list",
                  label: "Decisions",
                  items: ["Show status once", "Keep the same reading order"],
                },
              ],
            },
            {
              id: "screen-supporting",
              type: "group",
              label: "Supporting content",
              layout: "row",
              children: [
                {
                  id: "screen-evidence",
                  type: "list",
                  label: "Evidence",
                  items: [
                    "Repository architecture source: docs/architecture.md",
                  ],
                },
                {
                  id: "screen-uncertainty",
                  type: "list",
                  label: "Remaining uncertainty",
                  items: [
                    "Confirm long source labels and uncertainty at narrow widths.",
                  ],
                },
              ],
            },
          ],
        },
        annotations: [
          {
            id: "annotation-action",
            nodeId: "screen-action",
            text: "The next action uses the strongest boundary.",
          },
          {
            id: "annotation-supporting",
            nodeId: "screen-supporting",
            text: "Dense supporting content stays readable in both viewports.",
          },
        ],
      }],
      frames: [
        {
          id: "frame-wide",
          label: "Desktop",
          viewport: "wide",
          screenId: "screen-alignment",
        },
        {
          id: "frame-narrow",
          label: "Mobile",
          viewport: "narrow",
          screenId: "screen-alignment",
        },
      ],
    },
    ...overrides,
  });
}

export function makeAlignApproval() {
  return {
    decisionId: "decision-1",
    sourceId: "conversation-1",
    sourceDigest: `sha256:${"c".repeat(64)}`,
  };
}
