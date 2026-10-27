import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { digestJson } from "../plugins/hope/skills/diff/scripts/hash.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";

const runId = "1".repeat(32);

function addTeachingBehavior(analysis, options = {}) {
  analysis.behavior = makeTeachingBehavior(options);
  return analysis.behavior;
}

function withVerificationLimit(snapshot) {
  const { digest: _digest, ...value } = snapshot;
  const extended = {
    ...value,
    limits: [
      ...snapshot.limits,
      {
        id: "limit-2",
        kind: "verification",
        reason: "CI, tests, builds, and lint were not collected or run",
        subject: "Execution and CI results",
      },
    ],
  };
  return Object.freeze({ ...extended, digest: digestJson(extended) });
}

function analysisWithVerificationLimit(snapshot) {
  const analysis = makeAnalysis(snapshot, runId);
  analysis.limitImpacts.push({
    impact: "Static evidence establishes the reviewed change without execution results.",
    limitId: "limit-2",
    material: false,
  });
  return analysis;
}

test("analysis validation derives trusted status, scope, evidence, and file use", () => {
  const snapshot = makeSnapshot();
  const validated = validateAnalysis(makeAnalysis(snapshot, runId), snapshot, { runId });
  assert.equal(validated.result.status, "verify");
  assert.equal(validated.result.scope, "limited");
  assert.equal(validated.files[0].disposition, "explained");
  assert.equal(validated.title.text, "The final retry error now reaches the caller.");
  assert.equal(validated.reviewItems[0].evidence[0].excerpt.includes("throw last"), true);
  assert.equal(validated.reviewItems[0].basis, "inferred");
  assert.equal(validated.sourceIndex.length, snapshot.sources.length);
  assert.equal("text" in validated.sourceIndex[0], false);
  assert.deepEqual(validated.resources, {
    analysisCanonicalBytes: 1957,
    analysisFileBytes: 1957,
    authoredProseBytes: 654,
    evidenceBytes: 114,
    evidenceLines: 4,
    evidenceReferences: 9,
    codeEvidenceLines: 4,
    uniqueEvidenceRanges: 3,
  });
  assert.equal(
    validated.coreChange.after.evidence[0],
    validated.coreChange.details[0].evidence[0],
  );
});

test("review title explains the grounded change instead of copying provider text", () => {
  const snapshot = makeSnapshot();
  for (const punctuation of ["", ".", "?", "!", "。", "？", "！"]) {
    const copied = makeAnalysis(snapshot, runId);
    copied.title.text = `${snapshot.change.title}${punctuation}`;
    assert.throws(
      () => validateAnalysis(copied, snapshot, { runId }),
      /instead of copying the pull request title/u,
    );
  }

  const ungrounded = makeAnalysis(snapshot, runId);
  ungrounded.title = {
    basis: "unknown",
    evidence: [],
    text: "The change is easier to understand.",
  };
  assert.throws(
    () => validateAnalysis(ungrounded, snapshot, { runId }),
    /title must be grounded in collected code/u,
  );

  const long = makeAnalysis(snapshot, runId);
  long.title.text = "A".repeat(81);
  assert.throws(
    () => validateAnalysis(long, snapshot, { runId }),
    /title\.text must not exceed 80 characters/u,
  );
});

test("analysis rejects whitespace-only prose and microworld labels", () => {
  const snapshot = makeSnapshot();
  for (const change of [
    (analysis) => { analysis.title.text = "  \n\t"; },
    (analysis) => { analysis.purpose.text = "  \n\t"; },
  ]) {
    const analysis = makeAnalysis(snapshot, runId);
    change(analysis);
    assert.throws(
      () => validateAnalysis(analysis, snapshot, { runId }),
      /must be a non-empty string/u,
    );
  }

  for (const change of [
    (analysis) => { analysis.behavior.microworld.controls[0].label = " \n "; },
    (analysis) => { analysis.behavior.microworld.controls[0].options[0].label = " \n "; },
  ]) {
    const analysis = makeAnalysis(snapshot, runId);
    addTeachingBehavior(analysis);
    change(analysis);
    assert.throws(
      () => validateAnalysis(analysis, snapshot, { runId }),
      /must be a non-empty bounded string/u,
    );
  }
});

test("review title reuses evidence that the core explanation renders", () => {
  const snapshot = makeSnapshot();
  const titleOnly = makeAnalysis(snapshot, runId);
  titleOnly.title.evidence = [{ endLine: 1, sourceId: "source-3", startLine: 1 }];
  assert.throws(
    () => validateAnalysis(titleOnly, snapshot, { runId }),
    /title\.evidence must reuse evidence rendered by coreChange/u,
  );

  const reused = makeAnalysis(snapshot, runId);
  const validated = validateAnalysis(reused, snapshot, { runId });
  assert.equal(
    validated.title.evidence[0],
    validated.coreChange.after.evidence[0],
  );
});

test("the main explanation keeps at most four focused details", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.coreChange.details = Array.from(
    { length: 5 },
    () => structuredClone(analysis.coreChange.details[0]),
  );
  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /coreChange\.details has too many items/u,
  );
});

test("analysis rejects exact duplicate sibling claims", () => {
  const snapshot = makeSnapshot();
  const duplicateDetail = makeAnalysis(snapshot, runId);
  duplicateDetail.coreChange.details.push(
    structuredClone(duplicateDetail.coreChange.details[0]),
  );
  assert.throws(
    () => validateAnalysis(duplicateDetail, snapshot, { runId }),
    /coreChange\.details\[1\] duplicates coreChange\.details\[0\]/u,
  );

  const duplicateStep = makeAnalysis(snapshot, runId);
  addTeachingBehavior(duplicateStep);
  duplicateStep.behavior.steps.push(
    structuredClone(duplicateStep.behavior.steps[0]),
  );
  assert.throws(
    () => validateAnalysis(duplicateStep, snapshot, { runId }),
    /behavior\.steps\[2\] duplicates behavior\.steps\[0\]/u,
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

test("the standard execution boundary is non-material unless it creates a verify item", () => {
  const snapshot = withVerificationLimit(makeSnapshot());
  const nonMaterial = analysisWithVerificationLimit(snapshot);
  assert.doesNotThrow(() => validateAnalysis(nonMaterial, snapshot, { runId }));

  const unexplained = analysisWithVerificationLimit(snapshot);
  unexplained.limitImpacts[1].material = true;
  unexplained.limitImpacts[1].impact = "Runtime behavior remains unconfirmed.";
  assert.throws(
    () => validateAnalysis(unexplained, snapshot, { runId }),
    /material execution or CI limit needs a linked verify review item/u,
  );

  const actionable = analysisWithVerificationLimit(snapshot);
  actionable.limitImpacts[1].material = true;
  actionable.limitImpacts[1].impact = "Runtime behavior remains unconfirmed.";
  actionable.reviewItems.push({
    ...structuredClone(actionable.reviewItems[0]),
    doneWhen: "The relevant execution result confirms the expected behavior.",
    effect: "The behavior could differ when the changed path runs.",
    explanation: "Static evidence cannot establish the required runtime result.",
    limitIds: ["limit-2"],
    nextStep: "Run the focused verification and inspect its result.",
    title: "Confirm the runtime result",
  });
  const validated = validateAnalysis(actionable, snapshot, { runId });
  assert.equal(validated.reviewItems.length, 2);
  assert.equal(validated.result.scope, "limited");
});

test("analysis validation reports a material verification link with other issues", () => {
  const snapshot = withVerificationLimit(makeSnapshot());
  const analysis = analysisWithVerificationLimit(snapshot);
  analysis.coreChange.before.basis = "unknown";
  analysis.coreChange.before.evidence = [];
  analysis.limitImpacts[1].material = true;
  analysis.limitImpacts[1].impact = "Runtime behavior remains unconfirmed.";

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    (error) => {
      assert.ok(error.issues.some((issue) => issue.code === "CHANGE_GROUNDING"));
      assert.ok(error.issues.some(
        (issue) => issue.message.includes(
          "material execution or CI limit needs a linked verify review item",
        ),
      ));
      return true;
    },
  );
});

test("file use is the strongest group kind that owns any of its lines", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.groups = [
    { ...analysis.groups[0], id: "g-mechanical", kind: "mechanical", parts: [{ fileId: "file-1", startLine: 1, endLine: 2 }] },
    { ...analysis.groups[0], id: "g-supporting", kind: "supporting", parts: [{ fileId: "file-1", startLine: 3, endLine: 4 }] },
  ];
  assert.equal(validateAnalysis(analysis, snapshot, { runId }).files[0].disposition, "supporting");

  analysis.groups[0].kind = "explained";
  assert.equal(validateAnalysis(analysis, snapshot, { runId }).files[0].disposition, "explained");

  const unknownKind = makeAnalysis(snapshot, runId);
  unknownKind.groups[0].kind = "metadata-only";
  assert.throws(
    () => validateAnalysis(unknownKind, snapshot, { runId }),
    /groups\[0\]\.kind must be one of explained, supporting, mechanical/u,
  );

  const unavailableValue = { ...snapshot };
  unavailableValue.files = [
    snapshot.files[0],
    { ...snapshot.files[0], id: "file-2", path: "secret.env", bodyState: "redacted", bodyReason: "secret", sourceIds: [] },
  ];
  const unavailable = makeAnalysis(unavailableValue, runId);
  unavailable.groups[0].parts = [{ fileId: "file-1" }, { fileId: "file-2" }];
  assert.deepEqual(
    validateAnalysis(unavailable, unavailableValue, { runId }).files.map((file) => file.disposition),
    ["explained", "redacted"],
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

test("analysis validation reports independent repair issues together", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.coreChange.before.basis = "unknown";
  analysis.coreChange.before.evidence = [];
  analysis.reviewItems[0].evidence = [{
    endLine: 1,
    sourceId: "source-99",
    startLine: 1,
  }];

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    (error) => {
      assert.ok(Array.isArray(error.issues));
      assert.ok(error.issues.length >= 2);
      assert.ok(error.issues.some((issue) => issue.code === "CHANGE_GROUNDING"));
      assert.ok(error.issues.some((issue) => issue.path === "reviewItems[0]"));
      return true;
    },
  );
});

test("analysis validation keeps an uncollected first error", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.quiz = [{
    answer: "The saved failure reaches the caller.",
    evidence: [],
    question: "Which error reaches the caller?",
  }];
  analysis.reviewItems[0].evidence = [{
    endLine: 1,
    sourceId: "source-99",
    startLine: 1,
  }];

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    (error) => {
      assert.ok(error.issues.some(
        (issue) => issue.path === "quiz[0].evidence",
      ));
      assert.ok(error.issues.some(
        (issue) => issue.path === "reviewItems[0]",
      ));
      return true;
    },
  );
});

test("analysis validation reports the actual review-item index", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.reviewItems.push(structuredClone(analysis.reviewItems[0]));
  analysis.reviewItems[1].title = "Check another caller";
  analysis.reviewItems[1].evidence = [{
    endLine: 1,
    sourceId: "source-99",
    startLine: 1,
  }];

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    (error) => {
      assert.ok(error.issues.length > 0);
      assert.ok(error.issues.every((issue) => (
        issue.code === "EVIDENCE_SOURCE_UNKNOWN"
        && issue.path.startsWith("reviewItems[1]")
      )));
      return true;
    },
  );
});

test("analysis fails closed on unsupported schemas and model-owned URLs", () => {
  const snapshot = makeSnapshot();
  assert.throws(
    () => validateAnalysis(
      makeAnalysis(snapshot, runId),
      { ...snapshot, schemaVersion: 1 },
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

  assert.throws(
    () => validateAnalysis(analysis, snapshot, { runId }),
    /quiz\[0\]\.evidence has too many items/u,
  );
});

test("analysis splits one authored evidence interval into bounded excerpts", () => {
  const snapshot = makeSnapshot();
  const longSource = {
    ...snapshot.sources[2],
    lineCount: 30,
    text: [`@@ -0,0 +1,29 @@`, ...Array.from({ length: 29 }, (_, index) => `+line ${index + 1}`)].join("\n"),
  };
  const longSnapshot = {
    ...snapshot,
    sources: [snapshot.sources[0], snapshot.sources[1], longSource],
  };
  const analysis = makeAnalysis(longSnapshot, runId);
  analysis.reviewItems[0].evidence = [{
    endLine: 25,
    sourceId: "source-3",
    startLine: 1,
  }];

  const validated = validateAnalysis(analysis, longSnapshot, { runId });
  assert.deepEqual(
    validated.reviewItems[0].evidence.map(({ startLine, endLine }) => ({
      endLine,
      startLine,
    })),
    [
      { endLine: 24, startLine: 1 },
      { endLine: 25, startLine: 25 },
    ],
  );
});

test("analysis rejects an unfocused authored evidence interval", () => {
  const snapshot = makeSnapshot();
  const longSource = {
    ...snapshot.sources[2],
    lineCount: 100,
    text: [`@@ -0,0 +1,99 @@`, ...Array.from({ length: 99 }, (_, index) => `+line ${index + 1}`)].join("\n"),
  };
  const longSnapshot = {
    ...snapshot,
    sources: [snapshot.sources[0], snapshot.sources[1], longSource],
  };
  const analysis = makeAnalysis(longSnapshot, runId);
  analysis.reviewItems[0].evidence = [{
    endLine: 97,
    sourceId: "source-3",
    startLine: 1,
  }];

  assert.throws(
    () => validateAnalysis(analysis, longSnapshot, { runId }),
    (error) => {
      assert.match(error.message, /maximum authored range is 96/u);
      assert.equal(
        error.issues.filter(
          (issue) => issue.message.includes("maximum authored range is 96"),
        ).length,
        1,
      );
      return true;
    },
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
  assert.throws(
    () => validateAnalysis(unavailable, unavailableSnapshot, { runId }),
    /cannot be grounded without an included file/u,
  );

  const emptyExplanation = makeAnalysis(snapshot, runId);
  emptyExplanation.coreChange.details = [];
  assert.throws(
    () => validateAnalysis(emptyExplanation, snapshot, { runId }),
    /coreChange\.details needs at least 1 item/u,
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
  analysis.reviewItems[0].basis = "code";
  analysis.reviewItems[0].evidence = [{ endLine: 2, sourceId: "source-4", startLine: 1 }];
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

test("the published analysis schema matches runtime lexical rules", async () => {
  const schema = JSON.parse(await readFile(new URL(
    "../plugins/hope/skills/diff/scripts/analysis-v6.schema.json",
    import.meta.url,
  ), "utf8"));
  const pattern = new RegExp(schema.$defs.text.pattern, "u");
  const snapshot = makeSnapshot();

  assert.equal(pattern.test("Two plain-text lines\nremain valid."), true);
  for (const value of [
    "Use `--profile-directory` when Chrome starts.",
    "Safe text \u0001 hidden control",
    "Safe text \u202E disguised text",
  ]) {
    assert.equal(pattern.test(value), false);
    const analysis = makeAnalysis(snapshot, runId);
    analysis.purpose.text = value;
    assert.throws(() => validateAnalysis(analysis, snapshot, { runId }));
  }
});

test("every captured limit needs one impact", () => {
  const snapshot = { ...makeSnapshot(), limits: [] };
  const analysis = makeAnalysis(snapshot, runId);
  analysis.limitImpacts = [];
  analysis.reviewItems = [];
  assert.deepEqual(validateAnalysis(analysis, snapshot, { runId }).limits, []);

  const limitedSnapshot = makeSnapshot();
  const limited = makeAnalysis(limitedSnapshot, runId);
  limited.limitImpacts = [];
  assert.throws(
    () => validateAnalysis(limited, limitedSnapshot, { runId }),
    /No impact was provided for Unchanged callers/u,
  );
});

test("background and purpose constraints participate in the same repair pass", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.background = ["First", "Second"].map((title) => ({
    ...analysis.coreChange.details[0], title,
  }));
  analysis.purpose = { ...analysis.coreChange.after };
  analysis.reviewItems[0].evidence = [{ sourceId: "source-99", startLine: 1, endLine: 1 }];
  assert.throws(() => validateAnalysis(analysis, snapshot, { runId }), (error) => {
    assert.ok(error.issues.some((issue) => issue.path === "background"));
    assert.ok(error.issues.some((issue) => issue.path === "purpose"));
    assert.ok(error.issues.some((issue) => issue.path === "reviewItems[0]"));
    return true;
  });
});

test("core and optional schemas resolve offline and agree on review bounds", async () => {
  const root = new URL("../plugins/hope/skills/diff/scripts/", import.meta.url);
  const documents = new Map();
  async function checkDocument(url) {
    if (documents.has(url.href)) return documents.get(url.href);
    const schema = JSON.parse(await readFile(url, "utf8"));
    documents.set(url.href, schema);
    async function visit(value) {
      if (!value || typeof value !== "object") return;
      if (value.$ref) {
        const target = new URL(value.$ref, url);
        const fragment = target.hash.slice(1);
        target.hash = "";
        assert.equal(new URL(".", target).href, root.href);
        let resolved = await checkDocument(target);
        for (const key of fragment.slice(1).split("/")) {
          resolved = resolved?.[key.replaceAll("~1", "/").replaceAll("~0", "~")];
        }
        assert.notEqual(resolved, undefined, value.$ref);
      }
      for (const child of Object.values(value)) await visit(child);
    }
    await visit(schema);
    return schema;
  }
  const schema = await checkDocument(new URL("analysis-v6.schema.json", root));
  assert.equal(schema.properties.schemaVersion.const, 6);
  assert.equal(schema.properties.background.maxItems, 1);
  assert.deepEqual(schema.properties.groups.items.properties.kind.enum, ["explained", "supporting", "mechanical"]);
  for (const removed of ["codeSteps", "beginnerPrimer", "contextChecks", "fileDispositions"]) {
    assert.equal(removed in schema.properties, false, removed);
  }
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
        text: [`@@ -0,0 +1,5 @@`, ...Array.from({ length: 5 }, (_, index) => `+line ${index + 1}`)].join("\n"),
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
        text: ["@@ -0,0 +1,119 @@", ...Array.from({ length: 119 }, () => `+${line}`)].join("\n"),
      }
      : source
  ));
  const budgetSnapshot = {
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  };
  const analysis = makeAnalysis(budgetSnapshot, runId);
  analysis.reviewItems = Array.from({ length: 5 }, (_, index) => ({
    ...analysis.reviewItems[0],
    basis: "code",
    evidence: [{
      endLine: (index + 1) * 24,
      sourceId: "source-3",
      startLine: index * 24 + 1,
    }],
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
        text: [`@@ -0,0 +1,59 @@`, ...Array.from({ length: 59 }, (_, index) => `+line ${index + 1}`)].join("\n"),
      }
      : source
  ));
  const budgetSnapshot = {
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  };
  const analysis = makeAnalysis(budgetSnapshot, runId);
  analysis.reviewItems = Array.from({ length: 3 }, (_, group) => ({
    ...analysis.reviewItems[0],
    basis: "code",
    evidence: Array.from({ length: 12 }, (_, index) => {
      const startLine = group * 12 + index + 1;
      return {
        endLine: startLine + 23,
        sourceId: "source-3",
        startLine,
      };
    }),
    title: `Overlapping code group ${group + 1}`,
  }));

  assert.throws(
    () => validateAnalysis(analysis, budgetSnapshot, { runId }),
    (error) => {
      const issue = error.issues.find(
        (item) => item.code === "RESOURCE_CODE_EVIDENCE_LINES",
      );
      assert.ok(issue);
      assert.match(issue.message, /renders \d+ code evidence lines; limit is 600/u);
      assert.equal(issue.details.limit, 600);
      assert.equal(issue.details.target, 480);
      assert.ok(issue.details.actual > issue.details.limit);
      assert.ok(issue.details.byField.find(
        (item) => item.field === "reviewItems" && item.lines >= 864,
      ));
      assert.equal(issue.details.largestRanges[0].lines, 24);
      assert.equal(issue.details.largestRanges[0].field, "reviewItems");
      assert.ok(issue.details.overlappingRanges.length > 0);
      return true;
    },
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

test("microworld scenarios name unchanged traces without copying them", () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  addTeachingBehavior(analysis);
  const scenario = analysis.behavior.microworld.scenarios[0];
  scenario.after = "unchanged";

  const validated = validateAnalysis(analysis, snapshot, { runId });
  const normalized = validated.behavior.microworld.scenarios[0];
  assert.equal(normalized.unchanged, true);
  assert.equal(normalized.after, normalized.before);

  const repeated = makeAnalysis(snapshot, runId);
  addTeachingBehavior(repeated);
  repeated.behavior.microworld.scenarios[0].after = structuredClone(
    repeated.behavior.microworld.scenarios[0].before,
  );
  assert.throws(
    () => validateAnalysis(repeated, snapshot, { runId }),
    /after repeats before; use "unchanged"/u,
  );
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
    /missing control combinations: /u,
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
