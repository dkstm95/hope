import assert from "node:assert/strict";
import test from "node:test";

import {
  createPolishBrief,
  POLISH_MODEL_ADAPTER_CODE,
  runPolish,
} from "../features/polish/index.mjs";
import {
  parsePolishArguments,
} from "../features/polish/cli.mjs";
import {
  createPolishRecord,
  validatePolishRecord,
  validatePolishRun,
} from "../features/polish/validate.mjs";
import { makePolishRun } from "../test-support/polish-fixture.mjs";

test("polish binds each change to a plan, evidence, preservation, and verification", () => {
  const run = validatePolishRun(makePolishRun());
  assert.equal(run.result.changed, true);
  assert.equal(run.result.status, "revised");
  assert.equal(run.result.verificationStatus, "verified-in-checked-scope");
  assert.equal(run.resources.changeBudget, 4);
  assert.equal(run.resources.changes, 1);
  assert.equal(run.resources.changedTargetSources, 1);
});

test("polish accepts an exact no-change result", () => {
  const input = makePolishRun();
  input.plan = [];
  input.outcome = {
    status: "no-change",
    outputSnapshot: {
      capturedAt: "2026-07-29T00:05:00.000Z",
      sources: [{ ...input.snapshot.sources[0] }],
    },
    removedSourceIds: [],
    changes: [],
    unresolved: [],
  };
  input.application = {
    status: "not-needed",
    authoritySourceIds: [],
    beforeIdentityChecked: false,
    finalIdentityChecked: false,
  };
  input.summary.assessment = "No supported cleanup was found in the checked scope.";
  const run = validatePolishRun(input);
  assert.equal(run.result.changed, false);
  assert.equal(run.result.verificationStatus, "verified-in-checked-scope");

  input.outcome.outputSnapshot.sources[0] = {
    ...input.outcome.outputSnapshot.sources[0],
    digest: `sha256:${"e".repeat(64)}`,
  };
  assert.throws(
    () => validatePolishRun(input),
    /no-change output source target-1 must keep its exact identity/u,
  );
});

test("polish stops on a material ambiguity instead of hiding a decision", () => {
  const input = makePolishRun();
  input.plan = [];
  input.verification = [];
  input.preservation[0].verificationIds = [];
  input.outcome = {
    status: "needs-alignment",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    unresolved: [
      "The repeated paragraph may be a compatibility requirement.",
    ],
  };
  input.application = {
    status: "not-needed",
    authoritySourceIds: [],
    beforeIdentityChecked: false,
    finalIdentityChecked: false,
  };
  input.summary.assessment = "The run stopped before changing the guide.";
  const run = validatePolishRun(input);
  assert.equal(run.result.status, "needs-alignment");
  assert.equal(run.result.verificationStatus, "not-completed");

  input.outcome.unresolved = [];
  assert.throws(
    () => validatePolishRun(input),
    /needs-alignment requires at least one unresolved item/u,
  );
});

test("polish rejects unbounded or unverified revisions", () => {
  const unchanged = makePolishRun();
  unchanged.outcome.outputSnapshot.sources[0].digest =
    unchanged.snapshot.sources[0].digest;
  assert.throws(
    () => validatePolishRun(unchanged),
    /must change or remove at least one target identity/u,
  );

  const overBudget = makePolishRun();
  overBudget.target.maximumChanges = 1;
  overBudget.plan.push({
    ...overBudget.plan[0],
    id: "plan-2",
  });
  assert.throws(
    () => validatePolishRun(overBudget),
    /plan exceeds target.maximumChanges/u,
  );

  const droppedVerification = makePolishRun();
  droppedVerification.outcome.changes[0].verificationIds = [];
  assert.throws(
    () => validatePolishRun(droppedVerification),
    /must contain at least 1 item|must keep every planned verification/u,
  );
});

test("polish binds revisions to content identity without changing the target", () => {
  const metadataOnly = makePolishRun();
  metadataOnly.snapshot.sources[0].revision = "draft-1";
  metadataOnly.outcome.outputSnapshot.sources[0].revision = "draft-2";
  metadataOnly.outcome.outputSnapshot.sources[0].digest =
    metadataOnly.snapshot.sources[0].digest;
  assert.throws(
    () => validatePolishRun(metadataOnly),
    /must change or remove at least one target identity/u,
  );

  const movedTarget = makePolishRun();
  movedTarget.outcome.outputSnapshot.sources[0].locator = "docs/other.md";
  assert.throws(
    () => validatePolishRun(movedTarget),
    /must keep its locator/u,
  );
});

test("polish distinguishes a proposed revision from an applied one", () => {
  const proposed = makePolishRun();
  proposed.application = {
    status: "proposed",
    authoritySourceIds: [],
    comparison: "Compared the captured guide with the proposed revision.",
    beforeIdentityChecked: true,
    finalIdentityChecked: false,
  };
  assert.equal(validatePolishRun(proposed).application.status, "proposed");

  const unsupportedApplication = makePolishRun();
  unsupportedApplication.application.authoritySourceIds = ["rules-1"];
  assert.throws(
    () => validatePolishRun(unsupportedApplication),
    /conversation-backed application authority/u,
  );
});

test("polish source references use the snapshot limit, not the group limit", () => {
  const input = makePolishRun();
  const extras = Array.from({ length: 64 }, (_, index) => ({
    id: `extra-${index + 1}`,
    kind: "file",
    label: `Extra source ${index + 1}`,
    locator: `docs/extra-${index + 1}.md`,
    digest: `sha256:${"e".repeat(64)}`,
  }));
  const targetSources = [{ ...input.snapshot.sources[0] }, ...extras];
  const targetIds = targetSources.map((source) => source.id);
  input.snapshot.sources = [
    ...targetSources,
    ...input.snapshot.sources.slice(1),
  ];
  input.target.sourceIds = [...targetIds];
  input.preservation[0].sourceIds = [...targetIds];
  input.plan[0].sourceIds = ["target-1"];
  input.outcome.changes[0].sourceIds = ["target-1"];
  input.verification[0].sourceIds = [...targetIds];
  input.outcome.outputSnapshot.sources = targetSources.map((source, index) => ({
    ...source,
    ...(index === 0 ? { digest: `sha256:${"d".repeat(64)}` } : {}),
  }));
  assert.equal(validatePolishRun(input).target.sourceIds.length, 65);
});

test("polish reports verification limits without claiming full preservation", () => {
  const input = makePolishRun();
  input.verification[0].status = "inconclusive";
  input.verification[0].detail =
    "The changed prose was inspected, but no domain owner confirmed it.";
  const run = validatePolishRun(input);
  assert.equal(run.result.verificationStatus, "incomplete");
});

test("polish version 2 represents an exact target deletion", () => {
  const input = makePolishRun();
  input.outcome.outputSnapshot = null;
  input.outcome.removedSourceIds = ["target-1"];
  input.outcome.changes[0].summary = "Removed the unused guide.";
  input.outcome.changes[0].reason = "The exact approved target is unused.";
  const run = validatePolishRun(input);
  assert.equal(run.result.status, "revised");
  assert.deepEqual(run.outcome.removedSourceIds, ["target-1"]);
  assert.equal(run.resources.removedTargetSources, 1);
});

test("polish records revalidate the normalized version 2 run", () => {
  const record = createPolishRecord(makePolishRun());
  const validated = validatePolishRecord(record);
  assert.equal(validated.feature, "polish-record");
  assert.equal(validated.run.version, 2);
  assert.equal(validated.result.verificationStatus, "verified-in-checked-scope");

  const forged = structuredClone(record);
  forged.result.status = "no-change";
  assert.throws(
    () => validatePolishRecord(forged),
    /result must match|recordDigest does not match/u,
  );
});

test("polish keeps version 1 runs readable without deletion semantics", () => {
  const legacy = makePolishRun();
  legacy.version = 1;
  delete legacy.outcome.removedSourceIds;
  assert.equal(validatePolishRun(legacy).version, 1);

  legacy.outcome.outputSnapshot = undefined;
  assert.throws(
    () => validatePolishRun(legacy),
    /outputSnapshot is required when status is revised/u,
  );
});

test("polish brief keeps target heuristics out of the fixed contract", async () => {
  const brief = await createPolishBrief(
    { risk: "high" },
    { loadWritingStandard: async () => "shared standard\n" },
  );
  assert.equal(brief.feature, "polish");
  assert.match(brief.schemaPath, /run-v2\.schema\.json$/u);
  assert.match(brief.recordSchemaPath, /record-v1\.schema\.json$/u);
  assert.match(brief.planning[1], /Do not use a fixed target checklist/u);
  assert.match(brief.contract[3], /no-change/u);
  assert.deepEqual(brief.composition.callers, ["align", "sweep"]);
  assert.match(brief.composition.rules.join(" "), /never imports or invokes/u);
  assert.equal(brief.writingStandard.text, "shared standard\n");
  assert.deepEqual(
    parsePolishArguments(["brief", "--risk", "low"]),
    { command: "brief", risk: "low" },
  );
  assert.throws(
    runPolish,
    (error) => error.code === POLISH_MODEL_ADAPTER_CODE,
  );
});
