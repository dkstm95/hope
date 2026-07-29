import assert from "node:assert/strict";
import test from "node:test";

import {
  createToxicReviewBrief,
  runToxicReview,
  TOXIC_REVIEW_MODEL_ADAPTER_CODE,
} from "../features/toxic-review/index.mjs";
import {
  parseToxicReviewArguments,
} from "../features/toxic-review/cli.mjs";
import {
  validateToxicReview,
} from "../features/toxic-review/validate.mjs";
import { makeToxicReview } from "../test-support/toxic-review-fixture.mjs";

test("toxic review adjudicates every finding and sorts actionable work", () => {
  const review = validateToxicReview(makeToxicReview());
  assert.deepEqual(
    review.result.actionable.map((finding) => finding.id),
    ["finding-1", "finding-2"],
  );
  assert.equal(
    review.result.actionable[0].action,
    "Add a test that invokes both generated and harness paths.",
  );
  assert.equal(review.result.actionable[0].priority, "high");
  assert.equal(review.result.actionable[0].judgment, undefined);
  assert.deepEqual(review.result.judgmentCounts, {
    accepted: 1,
    "partially-accepted": 1,
    rejected: 0,
    deferred: 0,
    duplicate: 0,
  });
  assert.equal(review.resources.actionableRatio, 1);
  assert.equal(review.resources.actionableFindings, 2);
  assert.equal(review.resources.roles, 1);
});

test("toxic review rejects unadjudicated and padded results", () => {
  const missing = makeToxicReview({ adjudications: [] });
  assert.throws(
    () => validateToxicReview(missing),
    /requires one adjudication/u,
  );

  const falseEmpty = makeToxicReview({
    findings: [],
    adjudications: [],
    summary: {
      assessment: "Nothing was reported.",
      noMaterialIssueFound: false,
      scopeLimits: [],
    },
  });
  assert.throws(
    () => validateToxicReview(falseEmpty),
    /must set summary\.noMaterialIssueFound to true/u,
  );
});

test("toxic review allows an honest empty finding set", () => {
  const review = validateToxicReview(makeToxicReview({
    findings: [],
    adjudications: [],
    summary: {
      assessment: "No material issue was found in the checked scope.",
      noMaterialIssueFound: true,
      scopeLimits: ["Only the captured plan was checked."],
    },
  }));
  assert.equal(review.result.noMaterialIssueFound, true);
  assert.deepEqual(review.result.actionable, []);
  assert.equal(review.resources.actionableRatio, 0);
});

test("toxic review keeps deferred risk unresolved", () => {
  const input = makeToxicReview({
    adjudications: [
      {
        findingId: "finding-1",
        status: "deferred",
        rationale: "The repository evidence is incomplete.",
        nextStep: "Capture the missing harness trace.",
      },
      {
        findingId: "finding-2",
        status: "rejected",
        rationale: "The shared core is present.",
      },
    ],
    summary: {
      assessment: "One material question remains unresolved.",
      biggestRisk: "The entry paths may still diverge.",
      nextMove: "Capture the missing harness trace.",
      noMaterialIssueFound: false,
      scopeLimits: ["Only the captured plan was checked."],
    },
  });
  const review = validateToxicReview(input);
  assert.equal(review.result.noMaterialIssueFound, false);
  assert.deepEqual(review.result.actionable, []);
  assert.equal(review.result.deferred[0].id, "finding-1");
  assert.equal(
    review.result.deferred[0].nextStep,
    "Capture the missing harness trace.",
  );
  assert.equal(review.result.deferred[0].proposal.priority, "medium");

  input.summary.noMaterialIssueFound = true;
  assert.throws(
    () => validateToxicReview(input),
    /cannot say no material issue was found when deferred findings remain/u,
  );
});

test("toxic review uses role-bounded evidence and trusted telemetry", () => {
  const input = makeToxicReview();
  input.snapshot.sources.push({
    id: "repository-2",
    kind: "git",
    label: "Unassigned repository",
    locator: "example/other",
    revision: "b".repeat(40),
  });
  input.findings[0].sourceIds = ["repository-2"];
  assert.throws(
    () => validateToxicReview(input),
    /outside role role-1 evidence/u,
  );

  const authoredMetrics = makeToxicReview({
    observedMetrics: { elapsedMilliseconds: 1 },
  });
  assert.throws(
    () => validateToxicReview(authoredMetrics),
    /observedMetrics is not allowed/u,
  );
  const review = validateToxicReview(makeToxicReview(), {
    observedMetrics: { elapsedMilliseconds: 12 },
  });
  assert.equal(review.observedMetrics.elapsedMilliseconds, 12);
});

test("toxic review and schema share reference and text boundaries", () => {
  const input = makeToxicReview();
  const extraSources = Array.from({ length: 32 }, (_, index) => ({
    id: `repository-${index + 2}`,
    kind: "git",
    label: `Repository ${index + 2}`,
    locator: `example/repository-${index + 2}`,
    revision: "b".repeat(40),
  }));
  input.snapshot.sources.push(...extraSources);
  input.roles[0].evidenceSourceIds.push(
    ...extraSources.map((source) => source.id),
  );
  const review = validateToxicReview(input);
  assert.equal(review.roles[0].evidenceSourceIds.length, 33);

  input.title = " \t ";
  assert.throws(
    () => validateToxicReview(input),
    /must be a non-empty string/u,
  );
});

test("toxic review brief chooses roles dynamically instead of fixing a panel", async () => {
  const brief = await createToxicReviewBrief(
    { risk: "high", stage: "design", target: "plan" },
    { loadWritingStandard: async () => "shared standard\n" },
  );
  assert.equal(brief.feature, "toxic-review");
  assert.match(brief.roleSelection[0], /one to six roles/u);
  assert.match(brief.roleSelection[0], /Do not use a fixed panel/u);
  assert.equal(brief.writingStandard.text, "shared standard\n");
  assert.deepEqual(
    parseToxicReviewArguments([
      "brief",
      "--target",
      "idea",
      "--stage",
      "idea",
      "--risk",
      "low",
    ]),
    {
      command: "brief",
      risk: "low",
      stage: "idea",
      target: "idea",
    },
  );
  assert.throws(
    runToxicReview,
    (error) => error.code === TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  );
});
