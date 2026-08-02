import assert from "node:assert/strict";
import test from "node:test";

import { digestJson } from "../features/diff/hash.mjs";
import { validateAnalysis } from "../features/diff/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingAidDecisions,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";

const runId = "1".repeat(32);

function addTeachingBehavior(analysis, options = {}) {
  const includeMicroworld = options.includeMicroworld ?? true;
  analysis.behavior = makeTeachingBehavior(options);
  analysis.teachingAids = makeTeachingAidDecisions({
    microworld: includeMicroworld,
    visual: true,
  });
  return analysis.behavior;
}

function markQuizIncluded(analysis) {
  analysis.teachingAids = {
    ...analysis.teachingAids,
    quiz: makeTeachingAidDecisions({ quiz: true }).quiz,
  };
}

test("analysis validation derives trusted status, scope, evidence, and file use", () => {
  const snapshot = makeSnapshot();
  const validated = validateAnalysis(makeAnalysis(snapshot, runId), snapshot, { runId });
  assert.equal(validated.result.status, "verify");
  assert.equal(validated.result.scope, "limited");
  assert.equal(validated.files[0].disposition, "explained");
  assert.equal(validated.reviewItems[0].evidence[0].excerpt.includes("throw last"), true);
  assert.equal(validated.reviewItems[0].basis, "inferred");
  assert.equal(validated.contextChecks.length, 3);
  assert.equal(validated.sourceIndex.length, snapshot.sources.length);
  assert.equal("text" in validated.sourceIndex[0], false);
  assert.deepEqual(validated.resources, {
    analysisCanonicalBytes: 2766,
    analysisFileBytes: 2766,
    authoredProseBytes: 1016,
    evidenceBytes: 178,
    evidenceLines: 5,
    evidenceReferences: 9,
    highlightedLines: 8,
    teachingAidDecisions: 3,
    teachingAidMicroworldIncluded: 0,
    teachingAidQuizIncluded: 0,
    teachingAidVisualIncluded: 0,
    teachingAidsIncluded: 0,
    teachingAidsNotApplicable: 0,
    teachingAidsOmitted: 3,
    uniqueEvidenceRanges: 4,
  });
  assert.equal(
    validated.coreChange.after.evidence[0],
    validated.coreChange.details[0].evidence[0],
  );
});

test("only material collection limits make the review scope limited", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.limitImpacts[0].material = false;
  analysis.limitImpacts[0].impact = "The changed function is self-contained, so callers are not needed here.";

  const validated = validateAnalysis(analysis, snapshot, { runId });
  assert.equal(validated.result.scope, "sufficient");
  assert.equal(validated.limits.length, 1);
  assert.equal(validated.limits[0].material, false);
});

test("analysis cannot omit, duplicate, or classify unavailable files", () => {
  const snapshot = makeSnapshot();
  const missing = makeAnalysis(snapshot, runId);
  missing.fileDispositions = [];
  assert.throws(
    () => validateAnalysis(missing, snapshot, { runId }),
    /No semantic disposition/u,
  );

  const duplicate = makeAnalysis(snapshot, runId);
  duplicate.fileDispositions.push({ ...duplicate.fileDispositions[0] });
  assert.throws(
    () => validateAnalysis(duplicate, snapshot, { runId }),
    /repeats/u,
  );

  const unavailableValue = { ...snapshot };
  unavailableValue.files = [{
    ...snapshot.files[0],
    bodyState: "redacted",
    bodyReason: "secret",
    sourceIds: [],
  }];
  const unavailable = makeAnalysis(unavailableValue, runId);
  assert.throws(
    () => validateAnalysis(unavailable, unavailableValue, { runId }),
    /cannot classify/u,
  );
});

test("analysis rejects invented evidence, cross-run data, and fake basis", () => {
  const snapshot = makeSnapshot();
  const invented = makeAnalysis(snapshot, runId);
  invented.purpose.evidence[0].sourceId = "source-99";
  assert.throws(
    () => validateAnalysis(invented, snapshot, { runId }),
    /unknown source/u,
  );

  const replay = makeAnalysis(snapshot, "2".repeat(32));
  assert.throws(
    () => validateAnalysis(replay, snapshot, { runId }),
    /runId does not match/u,
  );

  const fakeCode = makeAnalysis(snapshot, runId);
  fakeCode.purpose.basis = "code";
  assert.throws(
    () => validateAnalysis(fakeCode, snapshot, { runId }),
    /non-code evidence/u,
  );
});

test("every code step is backed by code evidence for its listed files", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.codeSteps[0] = {
    ...analysis.codeSteps[0],
    basis: "stated",
    evidence: [{ endLine: 1, sourceId: "source-2", startLine: 1 }],
  };

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /needs code evidence/u,
  );
});

test("code step file IDs are derived from evidence when omitted", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  const expected = [...analysis.codeSteps[0].fileIds];
  delete analysis.codeSteps[0].fileIds;

  const validated = validateAnalysis(analysis, snapshot, { runId });
  assert.deepEqual(validated.codeSteps[0].fileIds, expected);
});

test("analysis validation reports independent repair issues together", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.coreChange.before.basis = "unknown";
  analysis.coreChange.before.evidence = [];
  analysis.codeSteps[0].fileIds = ["file-99"];

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    (error) => {
      assert.ok(Array.isArray(error.issues));
      assert.ok(error.issues.length >= 2);
      assert.ok(error.issues.some((issue) => issue.code === "CHANGE_GROUNDING"));
      assert.ok(error.issues.some((issue) => issue.path === "codeSteps[0]"));
      return true;
    },
  );
});

test("analysis fails closed on unsupported schemas and model-owned URLs", () => {
  const snapshot = makeSnapshot();
  assert.throws(
    () => validateAnalysis(
      makeAnalysis(snapshot, runId),
      { ...snapshot, schemaVersion: 2 },
      { runId },
    ),
    /Unsupported Hope snapshot schema/u,
  );

  const retiredAnalysis = makeAnalysis(snapshot, runId);
  retiredAnalysis.schemaVersion = 1;
  assert.throws(
    () => validateAnalysis(retiredAnalysis, snapshot, { runId }),
    /Unsupported Hope analysis schema/u,
  );

  const modelUrl = makeAnalysis(snapshot, runId);
  modelUrl.url = "https://evil.example/review";
  assert.throws(
    () => validateAnalysis(modelUrl, snapshot, { runId }),
    /unknown field: url/u,
  );
});

test("quiz evidence follows the published schema limit", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  const evidence = Array.from({ length: 9 }, (_, index) => ({
    endLine: 1,
    sourceId: index % 2 === 0 ? "source-1" : "source-2",
    startLine: 1,
  }));
  analysis.quiz = Array.from({ length: 3 }, (_, index) => ({
    answer: `Answer ${index + 1}`,
    evidence,
    question: `Question ${index + 1}`,
  }));
  markQuizIncluded(analysis);

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /quiz\[0\]\.evidence has too many items/u,
  );
});

test("analysis rejects oversized evidence excerpts", () => {
  const snapshot = makeSnapshot();
  const longSource = {
    ...snapshot.sources[2],
    lineCount: 30,
    text: Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join("\n"),
  };
  const longSnapshot = {
    ...snapshot,
    sources: [snapshot.sources[0], snapshot.sources[1], longSource],
  };
  const analysis = makeAnalysis(longSnapshot, runId);
  analysis.codeSteps[0].evidence = [{
    endLine: 25,
    sourceId: "source-3",
    startLine: 1,
  }];

  assert.throws(
    () => validateAnalysis(analysis, longSnapshot, { runId }),
    /24-line evidence limit/u,
  );
});

test("analysis cannot use empty source text as evidence", () => {
  const snapshot = makeSnapshot();
  const emptySnapshot = {
    ...snapshot,
    sources: snapshot.sources.map((source) => (
      source.id === "source-2"
        ? { ...source, lineCount: 1, text: "" }
        : source
    )),
  };
  const analysis = makeAnalysis(emptySnapshot, runId);

  assert.throws(
    () => validateAnalysis(analysis, emptySnapshot, { runId }),
    /empty source text/u,
  );
});

test("analysis fails when the core change is unknown or no file body is available", () => {
  const snapshot = makeSnapshot();
  const unknown = makeAnalysis(snapshot, runId);
  unknown.coreChange.after = {
    basis: "unknown",
    evidence: [],
    text: "The new behavior could not be confirmed.",
  };
  assert.throws(
    () => validateAnalysis(unknown, snapshot, { runId }),
    /coreChange\.after must be grounded/u,
  );

  const unavailableSnapshot = {
    ...snapshot,
    files: snapshot.files.map((file) => ({
      ...file,
      bodyReason: "credential",
      bodyState: "redacted",
      sourceIds: [],
    })),
  };
  const unavailable = makeAnalysis(unavailableSnapshot, runId);
  unavailable.fileDispositions = [];
  assert.throws(
    () => validateAnalysis(unavailable, unavailableSnapshot, { runId }),
    /cannot be grounded without an included file/u,
  );

  const emptyExplanation = makeAnalysis(snapshot, runId);
  emptyExplanation.coreChange.details = [];
  assert.throws(
    () => validateAnalysis(emptyExplanation, snapshot, { runId }),
    /coreChange\.details needs the main explanation/u,
  );
});

test("purpose basis is limited to stated, inferred, or unknown", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.purpose = {
    basis: "code",
    evidence: [{ endLine: 4, sourceId: "source-3", startLine: 1 }],
    text: "The code changes retry behavior.",
  };

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /purpose basis must be stated, inferred, or unknown/u,
  );
});

test("context checks account for limits with status-specific evidence", () => {
  const snapshot = makeSnapshot();

  const checkedWithoutEvidence = makeAnalysis(snapshot, runId);
  checkedWithoutEvidence.contextChecks[0].evidence = [];
  assert.throws(
    () => validateAnalysis(checkedWithoutEvidence, snapshot, { runId }),
    /needs evidence when checked/u,
  );

  const limitedWithoutLimit = makeAnalysis(snapshot, runId);
  limitedWithoutLimit.contextChecks[1].limitIds = [];
  assert.throws(
    () => validateAnalysis(limitedWithoutLimit, snapshot, { runId }),
    /needs at least one limit when limited/u,
  );

  const missingLimitAccount = makeAnalysis(snapshot, runId);
  missingLimitAccount.contextChecks = missingLimitAccount.contextChecks.filter(
    (check) => check.status !== "limited",
  );
  assert.throws(
    () => validateAnalysis(missingLimitAccount, snapshot, { runId }),
    /No context check accounts for limit-1/u,
  );

  const notApplicableWithLimit = makeAnalysis(snapshot, runId);
  notApplicableWithLimit.contextChecks[2].limitIds = ["limit-1"];
  assert.throws(
    () => validateAnalysis(notApplicableWithLimit, snapshot, { runId }),
    /cannot link limits when not applicable/u,
  );

  const statedWithCode = makeAnalysis(snapshot, runId);
  statedWithCode.contextChecks[0].basis = "stated";
  assert.throws(
    () => validateAnalysis(statedWithCode, snapshot, { runId }),
    /stated-source basis/u,
  );

  const codeWithDescription = makeAnalysis(snapshot, runId);
  codeWithDescription.contextChecks[0].evidence = [{
    endLine: 1,
    sourceId: "source-2",
    startLine: 1,
  }];
  assert.throws(
    () => validateAnalysis(codeWithDescription, snapshot, { runId }),
    /non-code evidence as a code basis/u,
  );
});

test("exact-revision context is code evidence but cannot replace change evidence", () => {
  const original = makeSnapshot();
  const { digest: _digest, ...value } = original;
  value.sources = [
    ...value.sources,
    {
      id: "source-4",
      kind: "context-file",
      lineCount: 3,
      path: "src/caller.js",
      revision: original.snapshot.head,
      text: "export function caller() {\n  return retry()\n}",
    },
  ];
  const snapshot = {
    ...value,
    digest: digestJson(value),
  };
  const analysis = makeAnalysis(snapshot, runId);
  analysis.contextChecks[0] = {
    basis: "code",
    evidence: [{ endLine: 2, sourceId: "source-4", startLine: 1 }],
    explanation: "The exact head revision caller was checked.",
    limitIds: [],
    status: "checked",
    subject: "Direct caller",
  };
  assert.doesNotThrow(
    () => validateAnalysis(analysis, snapshot, { runId }),
  );

  analysis.coreChange.before.evidence = [{
    endLine: 2,
    sourceId: "source-4",
    startLine: 1,
  }];
  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /coreChange\.before must be grounded in collected code/u,
  );
});

test("review item basis must match its evidence kind", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.reviewItems[0].basis = "stated";

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /stated-source basis/u,
  );
});

test("analysis rejects bidirectional controls in user-facing prose", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.purpose.text = "Safe text \u202E disguised text";

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /bidirectional control character/u,
  );
});

test("generated prose rejects Markdown backticks while source excerpts keep them", () => {
  const snapshot = makeSnapshot();
  const invalid = makeAnalysis(snapshot, runId);
  invalid.purpose.text = "Use `--profile-directory` when Chrome starts.";

  assert.throws(
    () => validateAnalysis(invalid, snapshot, { runId }),
    /Markdown backtick/u,
  );

  const { digest: _digest, ...snapshotValue } = makeSnapshot();
  snapshotValue.sources = snapshotValue.sources.map((source) => (
    source.id === "source-3"
      ? { ...source, text: source.text.replace("throw last", "throw `last`") }
      : source
  ));
  const sourceSnapshot = {
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  };
  const validated = validateAnalysis(
    makeAnalysis(sourceSnapshot, runId),
    sourceSnapshot,
    { runId },
  );
  assert.match(validated.reviewItems[0].evidence[0].excerpt, /`last`/u);
});

test("review items can link only known scope limits once", () => {
  const snapshot = makeSnapshot();
  const unknown = makeAnalysis(snapshot, runId);
  unknown.reviewItems[0].limitIds = ["limit-404"];
  assert.throws(
    () => validateAnalysis(unknown, snapshot, { runId }),
    /unknown limit/u,
  );

  const duplicate = makeAnalysis(snapshot, runId);
  duplicate.reviewItems[0].limitIds = ["limit-1", "limit-1"];
  assert.throws(
    () => validateAnalysis(duplicate, snapshot, { runId }),
    /contains a duplicate/u,
  );
});

test("generated prose length uses the same code-point boundary as the schema", () => {
  const snapshot = makeSnapshot();
  const accepted = makeAnalysis(snapshot, runId);
  accepted.purpose.text = "가".repeat(32_768);
  assert.doesNotThrow(() => validateAnalysis(accepted, snapshot, {
    enforceResourceLimits: false,
    runId,
  }));

  const rejected = makeAnalysis(snapshot, runId);
  rejected.purpose.text = "가".repeat(32_769);
  assert.throws(
    () => validateAnalysis(rejected, snapshot, {
      enforceResourceLimits: false,
      runId,
    }),
    /purpose\.text is too long/u,
  );
});

test("analysis rejects excessive evidence references before rendering", () => {
  const snapshot = makeSnapshot();
  const { digest: _digest, ...snapshotValue } = snapshot;
  snapshotValue.sources = snapshotValue.sources.map((source) => (
    source.id === "source-3"
      ? {
        ...source,
        lineCount: 6,
        text: Array.from({ length: 6 }, (_, index) => `line ${index + 1}`).join("\n"),
      }
      : source
  ));
  const budgetSnapshot = {
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  };
  const analysis = makeAnalysis(budgetSnapshot, runId);
  const ranges = [];
  for (let startLine = 1; startLine <= 6; startLine += 1) {
    for (let endLine = startLine; endLine <= 6; endLine += 1) {
      ranges.push({ endLine, sourceId: "source-3", startLine });
    }
  }
  analysis.reviewItems = Array.from({ length: 20 }, (_, index) => ({
    ...analysis.reviewItems[0],
    evidence: ranges.slice(0, 12),
    title: `Review item ${index + 1}`,
  }));

  assert.throws(
    () => validateAnalysis(analysis, budgetSnapshot, { runId }),
    /more than 192 evidence references/u,
  );
});

test("analysis rejects excessive unique evidence bytes before rendering", () => {
  const snapshot = makeSnapshot();
  const { digest: _digest, ...snapshotValue } = snapshot;
  const line = "const value = \"" + "x".repeat(880) + "\";";
  snapshotValue.sources = snapshotValue.sources.map((source) => (
    source.id === "source-3"
      ? {
        ...source,
        lineCount: 120,
        text: Array.from({ length: 120 }, () => line).join("\n"),
      }
      : source
  ));
  const budgetSnapshot = {
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  };
  const analysis = makeAnalysis(budgetSnapshot, runId);
  analysis.codeSteps = Array.from({ length: 5 }, (_, index) => ({
    basis: "code",
    evidence: [{
      endLine: (index + 1) * 24,
      sourceId: "source-3",
      startLine: index * 24 + 1,
    }],
    fileIds: ["file-1"],
    text: `Changed code group ${index + 1}.`,
    title: `Code group ${index + 1}`,
  }));

  assert.throws(
    () => validateAnalysis(analysis, budgetSnapshot, { runId }),
    /evidence exceeds 98304 bytes/u,
  );
});

test("overlapping evidence ranges count every rendered code line", () => {
  const snapshot = makeSnapshot();
  const { digest: _digest, ...snapshotValue } = snapshot;
  snapshotValue.sources = snapshotValue.sources.map((source) => (
    source.id === "source-3"
      ? {
        ...source,
        lineCount: 60,
        text: Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join("\n"),
      }
      : source
  ));
  const budgetSnapshot = {
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  };
  const analysis = makeAnalysis(budgetSnapshot, runId);
  analysis.codeSteps = Array.from({ length: 3 }, (_, group) => ({
    basis: "code",
    evidence: Array.from({ length: 12 }, (_, index) => {
      const startLine = group * 12 + index + 1;
      return {
        endLine: startLine + 23,
        sourceId: "source-3",
        startLine,
      };
    }),
    fileIds: ["file-1"],
    text: `Changed overlapping code group ${group + 1}.`,
    title: `Overlapping code group ${group + 1}`,
  }));

  assert.throws(
    () => validateAnalysis(analysis, budgetSnapshot, { runId }),
    /more than 600 highlighted code lines/u,
  );
});

test("behavior accepts one grounded visual of every supported type", () => {
  const snapshot = makeSnapshot();
  for (const kind of ["flow", "decision-table", "sequence", "component-map"]) {
    const analysis = makeAnalysis(snapshot, runId);
    addTeachingBehavior(analysis, {
      includeMicroworld: false,
      visualKind: kind,
    });

    const validated = validateAnalysis(analysis, snapshot, { runId });
    assert.equal(validated.behavior.visual.kind, kind);
    assert.equal(validated.behavior.summary.text.includes("final failure"), true);
    assert.equal(validated.behavior.steps.length, 2);
    assert.equal(validated.behavior.visual.evidence[0].sourceKind, "patch");
    assert.equal(Object.isFrozen(validated.behavior.visual), true);
  }
});

test("decision-table cells count toward the generated prose budget", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  addTeachingBehavior(analysis, {
    includeMicroworld: false,
    visualKind: "decision-table",
  });
  analysis.behavior.visual.columns = Array.from(
    { length: 6 },
    (_, index) => `Column ${index + 1}`,
  );
  analysis.behavior.visual.rows = Array.from({ length: 12 }, (_, row) => ({
    case: `Case ${row + 1}`,
    cells: Array.from({ length: 6 }, () => "x".repeat(800)),
  }));

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /Analysis prose exceeds/u,
  );
});

test("behavior accepts a grounded, exhaustive declarative microworld", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  addTeachingBehavior(analysis);

  const validated = validateAnalysis(analysis, snapshot, { runId });
  assert.equal(validated.behavior.microworld.controls.length, 2);
  assert.deepEqual(
    validated.behavior.microworld.scenarios.map((scenario) => scenario.selectionKey),
    [
      "attempt=failed|saved-error=missing",
      "attempt=failed|saved-error=present",
      "attempt=succeeded|saved-error=missing",
      "attempt=succeeded|saved-error=present",
    ],
  );
  assert.equal(Object.isFrozen(validated.behavior.microworld), true);
  assert.equal(Object.isFrozen(validated.behavior.microworld.controls), true);
  assert.equal(Object.isFrozen(validated.behavior.microworld.scenarios[0].when), true);
  assert.ok(validated.resources.authoredProseBytes > 842);
});

test("visual validation rejects malformed structure and ungrounded claims", () => {
  const snapshot = makeSnapshot();

  const cells = makeAnalysis(snapshot, runId);
  addTeachingBehavior(cells, { includeMicroworld: false });
  cells.behavior.visual.rows[0].cells.pop();
  assert.throws(
    () => validateAnalysis(cells, snapshot, { runId }),
    /must match the decision-table column count/u,
  );

  const unknownParticipant = makeAnalysis(snapshot, runId);
  addTeachingBehavior(unknownParticipant, {
    includeMicroworld: false,
    visualKind: "sequence",
  });
  unknownParticipant.behavior.visual.messages[0].to = "missing";
  assert.throws(
    () => validateAnalysis(unknownParticipant, snapshot, { runId }),
    /unknown participant/u,
  );

  const duplicateComponent = makeAnalysis(snapshot, runId);
  addTeachingBehavior(duplicateComponent, {
    includeMicroworld: false,
    visualKind: "component-map",
  });
  duplicateComponent.behavior.visual.components[1].id = "retry";
  assert.throws(
    () => validateAnalysis(duplicateComponent, snapshot, { runId }),
    /duplicate id/u,
  );

  const noEvidence = makeAnalysis(snapshot, runId);
  addTeachingBehavior(noEvidence, { includeMicroworld: false });
  noEvidence.behavior.visual.evidence = [];
  assert.throws(
    () => validateAnalysis(noEvidence, snapshot, { runId }),
    /must include evidence/u,
  );

  const wrongBasis = makeAnalysis(snapshot, runId);
  addTeachingBehavior(wrongBasis, { includeMicroworld: false });
  wrongBasis.behavior.visual.basis = "stated";
  assert.throws(
    () => validateAnalysis(wrongBasis, snapshot, { runId }),
    /stated-source basis/u,
  );
});

test("microworld validation rejects unsafe or incomplete state models", () => {
  const snapshot = makeSnapshot();

  const missing = makeAnalysis(snapshot, runId);
  addTeachingBehavior(missing);
  missing.behavior.microworld.scenarios.pop();
  assert.throws(
    () => validateAnalysis(missing, snapshot, { runId }),
    /missing a control combination/u,
  );

  const duplicate = makeAnalysis(snapshot, runId);
  addTeachingBehavior(duplicate);
  duplicate.behavior.microworld.scenarios[1].when = [
    ...duplicate.behavior.microworld.scenarios[0].when,
  ];
  assert.throws(
    () => validateAnalysis(duplicate, snapshot, { runId }),
    /repeats a control combination/u,
  );

  const unknownDefault = makeAnalysis(snapshot, runId);
  addTeachingBehavior(unknownDefault);
  unknownDefault.behavior.microworld.controls[0].defaultOptionId = "unknown";
  assert.throws(
    () => validateAnalysis(unknownDefault, snapshot, { runId }),
    /defaultOptionId refers to an unknown option/u,
  );

  const partialBinding = makeAnalysis(snapshot, runId);
  addTeachingBehavior(partialBinding);
  partialBinding.behavior.microworld.scenarios[0].when.pop();
  assert.throws(
    () => validateAnalysis(partialBinding, snapshot, { runId }),
    /must bind every control exactly once/u,
  );

  const unknownOption = makeAnalysis(snapshot, runId);
  addTeachingBehavior(unknownOption);
  unknownOption.behavior.microworld.scenarios[0].when[0].optionId = "unknown";
  assert.throws(
    () => validateAnalysis(unknownOption, snapshot, { runId }),
    /refers to an unknown option/u,
  );

  const tooManyCombinations = makeAnalysis(snapshot, runId);
  addTeachingBehavior(tooManyCombinations);
  tooManyCombinations.behavior.microworld.controls[0].options = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
    { id: "four", label: "Four" },
  ];
  tooManyCombinations.behavior.microworld.controls[0].defaultOptionId = "one";
  tooManyCombinations.behavior.microworld.controls[1].options = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
    { id: "four", label: "Four" },
  ];
  tooManyCombinations.behavior.microworld.controls[1].defaultOptionId = "one";
  assert.throws(
    () => validateAnalysis(tooManyCombinations, snapshot, { runId }),
    /more than 12 combinations/u,
  );

  const unknownField = makeAnalysis(snapshot, runId);
  addTeachingBehavior(unknownField);
  unknownField.behavior.microworld.script = "run repository code";
  assert.throws(
    () => validateAnalysis(unknownField, snapshot, { runId }),
    /unknown field: script/u,
  );
});
