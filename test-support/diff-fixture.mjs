import { digestJson } from "../features/diff/hash.mjs";

export function makeSnapshot({
  locale = "en-US",
  theme = "system",
  title = "Keep the last retry error",
} = {}) {
  const value = {
    capturedAt: "2026-07-23T00:00:00.000Z",
    files: [
      {
        additions: 2,
        bodyState: "included",
        deletions: 1,
        id: "file-1",
        path: "src/retry.js",
        providerStatus: "modified",
        sourceIds: ["source-3"],
      },
    ],
    limits: [
      {
        id: "limit-1",
        kind: "unchanged-context",
        reason: "Unchanged callers were not collected",
        subject: "Unchanged callers",
      },
    ],
    pullRequest: {
      author: "octocat",
      number: 142,
      state: "open",
      title,
      url: "https://github.com/example/hope/pull/142",
    },
    repository: {
      name: "hope",
      owner: "example",
      provider: "github",
    },
    schemaVersion: 1,
    settings: {
      locale,
      localeSource: "override",
      theme,
      themeSource: "override",
    },
    snapshot: {
      base: "a".repeat(40),
      head: "b".repeat(40),
      mergeBase: "c".repeat(40),
    },
    sources: [
      {
        id: "source-1",
        kind: "pull-request-title",
        lineCount: 1,
        text: title,
      },
      {
        id: "source-2",
        kind: "pull-request-description",
        lineCount: 1,
        text: "Return the final error after all retries fail.",
      },
      {
        fileId: "file-1",
        id: "source-3",
        kind: "patch",
        lineCount: 4,
        path: "src/retry.js",
        revision: "b".repeat(40),
        text: "@@ -1 +1,2 @@\n-throw new Error()\n+const last = error\n+throw last",
      },
    ],
  };
  return Object.freeze({
    ...value,
    digest: digestJson(value),
  });
}

function reference(sourceId, startLine, endLine = startLine) {
  return { endLine, sourceId, startLine };
}

export function makeTeachingBehavior({
  includeMicroworld = true,
  visualKind = "decision-table",
} = {}) {
  const evidence = [reference("source-3", 2, 4)];
  const grounded = {
    basis: "code",
    evidence,
  };
  const visuals = {
    "component-map": {
      ...grounded,
      caption: "The retry branch passes the saved failure to its caller.",
      components: [
        { detail: "Keeps the final failure.", id: "retry", label: "Retry branch" },
        { detail: "Receives the preserved failure.", id: "caller", label: "Caller" },
      ],
      connections: [
        { from: "retry", label: "throws the saved failure", to: "caller" },
      ],
      kind: "component-map",
      title: "Failure handoff",
    },
    "decision-table": {
      ...grounded,
      caption: "The saved state determines which failure reaches the caller.",
      columns: ["Previous behavior", "New behavior"],
      kind: "decision-table",
      rows: [
        {
          case: "No saved failure",
          cells: ["Generic failure", "Generic failure"],
        },
        {
          case: "Saved failure",
          cells: ["Generic failure", "Saved failure"],
        },
      ],
      title: "Retry outcome",
    },
    flow: {
      ...grounded,
      caption: "The final failure now survives the retry boundary.",
      items: [
        { detail: "The retry attempt fails.", label: "Receive failure" },
        { detail: "The branch keeps and throws that failure.", label: "Preserve failure" },
      ],
      kind: "flow",
      title: "Failure path",
    },
    sequence: {
      ...grounded,
      caption: "The retry branch returns the saved failure to the caller.",
      kind: "sequence",
      messages: [
        { from: "attempt", label: "reports the final failure", to: "retry" },
        { from: "retry", label: "throws the saved failure", to: "caller" },
      ],
      participants: [
        { id: "attempt", label: "Attempt" },
        { id: "retry", label: "Retry branch" },
        { id: "caller", label: "Caller" },
      ],
      title: "Failure sequence",
    },
  };
  const behavior = {
    summary: {
      ...grounded,
      text: "The final failure is preserved across the retry boundary.",
    },
    steps: [
      {
        ...grounded,
        text: "A retry attempt produces a failure.",
      },
      {
        ...grounded,
        text: "The branch stores and throws the final failure.",
      },
    ],
    visual: visuals[visualKind],
  };
  if (includeMicroworld) {
    const combinations = [
      ["failed", "missing"],
      ["failed", "present"],
      ["succeeded", "missing"],
      ["succeeded", "present"],
    ];
    behavior.microworld = {
      ...grounded,
      controls: [
        {
          defaultOptionId: "failed",
          id: "attempt",
          kind: "input",
          label: "Final attempt",
          options: [
            { id: "failed", label: "Failed" },
            { id: "succeeded", label: "Succeeded" },
          ],
        },
        {
          defaultOptionId: "missing",
          id: "saved-error",
          kind: "state",
          label: "Saved failure",
          options: [
            { id: "missing", label: "Missing" },
            { id: "present", label: "Present" },
          ],
        },
      ],
      evidence,
      instructions: "Change the attempt result and saved state to compare outcomes.",
      omits: "Caller-specific recovery and logging outside the changed branch.",
      scenarios: combinations.map(([attempt, savedError]) => {
        const hasSavedError = savedError === "present";
        const succeeded = attempt === "succeeded";
        const outcome = succeeded
          ? "The successful value continues."
          : hasSavedError
            ? "The saved failure reaches the caller."
            : "A generic failure reaches the caller.";
        return {
          after: {
            outcome,
            steps: [
              succeeded ? "Keep the successful result." : "Read the final failure.",
              hasSavedError ? "Use the saved failure." : "Use the generic fallback.",
            ],
          },
          before: {
            outcome: succeeded
              ? "The successful value continues."
              : "A generic failure reaches the caller.",
            steps: [
              succeeded ? "Keep the successful result." : "Discard the final failure.",
              succeeded ? "Return the value." : "Create a generic failure.",
            ],
          },
          id: `${attempt}-${savedError}`,
          lesson: succeeded || !hasSavedError
            ? "The changed branch has the same visible result."
            : "Only a stored final failure changes the visible result.",
          title: `${attempt === "failed" ? "Failed" : "Succeeded"} with ${hasSavedError ? "saved" : "missing"} failure`,
          when: [
            { controlId: "attempt", optionId: attempt },
            { controlId: "saved-error", optionId: savedError },
          ],
        };
      }),
      simplifies: "The model treats retry completion as one final branch.",
      title: "Retry result explorer",
    };
  }
  return behavior;
}

export function makeTeachingAidDecisions({
  microworld = false,
  quiz = false,
  visual = false,
} = {}) {
  const decision = (included, teachingJob) => included
    ? {
        decision: "included",
        reason: "This aid makes a distinct behavior easier to predict.",
        teachingJob,
      }
    : {
        decision: "omitted",
        reason: "The prose and selected aids already explain this behavior.",
      };
  return {
    microworld: decision(
      microworld,
      "Let the reader compare retry outcomes by changing bounded state.",
    ),
    quiz: decision(
      quiz,
      "Check one non-trivial prediction about the final failure.",
    ),
    visual: decision(
      visual,
      "Show the retry branch and outcome relationship.",
    ),
  };
}

export function makeAnalysis(snapshot, runId) {
  return {
    codeSteps: [
      {
        basis: "code",
        evidence: [reference("source-3", 2, 4)],
        fileIds: ["file-1"],
        text: "The retry path stores the final error and throws it.",
        title: "Preserve the final error",
      },
    ],
    contextChecks: [
      {
        basis: "code",
        evidence: [reference("source-3", 1, 4)],
        explanation: "The changed retry branch and its direct result were checked.",
        limitIds: [],
        status: "checked",
        subject: "Changed retry behavior",
      },
      {
        basis: "unknown",
        evidence: [],
        explanation: "Unchanged direct callers were not collected.",
        limitIds: ["limit-1"],
        status: "limited",
        subject: "Unchanged direct callers",
      },
      {
        basis: "unknown",
        evidence: [],
        explanation: "This change does not modify stored data or a migration.",
        limitIds: [],
        status: "not-applicable",
        subject: "Stored data and migrations",
      },
    ],
    coreChange: {
      after: {
        basis: "code",
        evidence: [reference("source-3", 2, 4)],
        text: "The final retry error is returned to the caller.",
      },
      before: {
        basis: "code",
        evidence: [reference("source-3", 2)],
        text: "The final retry error was replaced by a generic error.",
      },
      details: [
        {
          basis: "code",
          evidence: [reference("source-3", 2, 4)],
          text: "The changed branch keeps the last error before it exits.",
        },
      ],
      why: {
        basis: "inferred",
        evidence: [reference("source-2", 1), reference("source-3", 2, 4)],
        text: "Callers can distinguish the real failure reason.",
      },
    },
    fileDispositions: [
      { disposition: "explained", fileId: "file-1" },
    ],
    limitImpacts: [
      {
        impact: "Compatibility with unchanged callers cannot be confirmed.",
        limitId: "limit-1",
        material: true,
      },
    ],
    locale: snapshot.settings.locale,
    purpose: {
      basis: "stated",
      evidence: [reference("source-2", 1)],
      text: "Return the final error after all retries fail.",
    },
    reviewItems: [
      {
        basis: "inferred",
        doneWhen: "A caller test confirms the final error is preserved.",
        effect: "An unchanged caller may handle the new error differently.",
        evidence: [reference("source-3", 2, 4)],
        explanation: "The changed error reaches callers that were not collected.",
        importance: "medium",
        kind: "verify",
        limitIds: ["limit-1"],
        nextStep: "Run or inspect a direct caller test.",
        title: "Check unchanged callers",
      },
    ],
    runId,
    schemaVersion: 2,
    snapshotDigest: snapshot.digest,
    teachingAids: makeTeachingAidDecisions(),
  };
}
