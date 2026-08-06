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
import {
  makeCausalToxicReview,
  makeToxicReview,
} from "../test-support/toxic-review-fixture.mjs";

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
  assert.deepEqual(
    review.result.actionable[0].proposalSourceIds,
    ["repository-1"],
  );
  assert.deepEqual(
    review.result.actionable[0].adjudicatorSourceIds,
    ["repository-1"],
  );
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

test("toxic review validates one explicit causal candidate record", () => {
  const review = validateToxicReview(makeCausalToxicReview());
  assert.equal(review.roles[0].method, "causal-completeness");
  assert.equal(review.causalAnalysis.candidateCount, 2);
  assert.equal(review.causalAnalysis.causeLevel, "mixed");
  assert.equal(review.causalAnalysis.flow.length, 2);
  assert.equal(review.resources.causalCandidates, 2);
  assert.equal(review.resources.causalFlowItems, 2);
});

test("toxic review binds a selected causal role to its analysis record", () => {
  const missingRecord = makeCausalToxicReview({ causalAnalysis: undefined });
  assert.throws(
    () => validateToxicReview(missingRecord),
    /causalAnalysis is required/u,
  );

  const missingMethod = makeCausalToxicReview({
    roles: makeToxicReview().roles,
  });
  assert.throws(
    () => validateToxicReview(missingMethod),
    /requires exactly one causal-completeness role/u,
  );

  const duplicateMethod = makeCausalToxicReview();
  duplicateMethod.roles.push({
    ...duplicateMethod.roles[0],
    id: "role-2",
  });
  assert.throws(
    () => validateToxicReview(duplicateMethod),
    /at most one causal-completeness method/u,
  );
});

test("toxic review requires flow disposition and candidate coverage", () => {
  const missingDisposition = makeCausalToxicReview();
  missingDisposition.causalAnalysis.flow[0].candidateIds = [];
  assert.throws(
    () => validateToxicReview(missingDisposition),
    /exclusion is required when candidateIds is empty/u,
  );

  const excluded = makeCausalToxicReview();
  excluded.causalAnalysis.flow[0].candidateIds = [];
  excluded.causalAnalysis.flow[0].exclusion =
    "The captured phase is outside the claimed outcome.";
  assert.throws(
    () => validateToxicReview(excluded),
    /candidate candidate-1 must be linked/u,
  );

  const linkedAndExcluded = makeCausalToxicReview();
  linkedAndExcluded.causalAnalysis.flow[0].exclusion =
    "This contradicts the candidate link.";
  assert.throws(
    () => validateToxicReview(linkedAndExcluded),
    /exclusion is allowed only when candidateIds is empty/u,
  );
});

test("toxic review derives causal count, level, and next-check shape", () => {
  const wrongCount = makeCausalToxicReview();
  wrongCount.causalAnalysis.candidateCount = 1;
  assert.throws(
    () => validateToxicReview(wrongCount),
    /candidateCount must match/u,
  );

  const wrongLevel = makeCausalToxicReview();
  wrongLevel.causalAnalysis.causeLevel = "structural";
  assert.throws(
    () => validateToxicReview(wrongLevel),
    /causeLevel must be mixed/u,
  );

  const wrongKind = makeCausalToxicReview();
  wrongKind.causalAnalysis.nextCheck.kind = "disconfirm";
  assert.throws(
    () => validateToxicReview(wrongKind),
    /nextCheck.kind must be discriminate/u,
  );

  const missingCandidate = makeCausalToxicReview();
  missingCandidate.causalAnalysis.nextCheck.candidateIds = ["candidate-1"];
  assert.throws(
    () => validateToxicReview(missingCandidate),
    /must reference every candidate exactly once/u,
  );
});

test("toxic review accepts zero-candidate and one-candidate stopping records", () => {
  const zero = makeCausalToxicReview();
  zero.causalAnalysis.candidates = [];
  zero.causalAnalysis.candidateCount = 0;
  zero.causalAnalysis.causeLevel = "inconclusive";
  for (const flowItem of zero.causalAnalysis.flow) {
    flowItem.candidateIds = [];
    flowItem.exclusion = "The capture cannot distinguish a causal candidate.";
  }
  zero.causalAnalysis.nextCheck = {
    kind: "form-candidate",
    action: "Capture the minimum missing observation.",
    rationale: "No supported candidate can be formed from this snapshot.",
    candidateIds: [],
  };
  assert.equal(validateToxicReview(zero).causalAnalysis.candidateCount, 0);

  const one = makeCausalToxicReview();
  one.causalAnalysis.candidates = [one.causalAnalysis.candidates[0]];
  one.causalAnalysis.candidateCount = 1;
  one.causalAnalysis.causeLevel = "structural";
  one.causalAnalysis.flow[1].candidateIds = [];
  one.causalAnalysis.flow[1].exclusion =
    "The local observation is outside the retained causal claim.";
  one.causalAnalysis.nextCheck = {
    kind: "disconfirm",
    action: "Measure the repeated boundary in one comparable run.",
    rationale: "The observation can disconfirm the only retained candidate.",
    candidateIds: ["candidate-1"],
  };
  assert.equal(validateToxicReview(one).causalAnalysis.candidateCount, 1);

  one.causalAnalysis.nextCheck.kind = "no-safe-check";
  assert.equal(
    validateToxicReview(one).causalAnalysis.nextCheck.kind,
    "no-safe-check",
  );
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
  assert.deepEqual(
    parseToxicReviewArguments([
      "evaluation-plan",
    ]),
    {
      command: "evaluation-plan",
    },
  );
  assert.deepEqual(
    parseToxicReviewArguments([
      "evaluation-prepare",
      "--case",
      "critical-path-ablation",
      "--variant",
      "rules-only",
      "--run",
      "2",
    ]),
    {
      command: "evaluation-prepare",
      caseId: "critical-path-ablation",
      variant: "rules-only",
      run: 2,
    },
  );
  assert.deepEqual(
    parseToxicReviewArguments([
      "evaluation-oracle",
      "--case",
      "critical-path-ablation",
    ]),
    {
      command: "evaluation-oracle",
      caseId: "critical-path-ablation",
    },
  );
  assert.deepEqual(
    parseToxicReviewArguments([
      "evaluation-record",
      "--case",
      "critical-path-ablation",
      "--variant",
      "full",
      "--run",
      "1",
      "--input",
      "review.json",
      "--model",
      "test-model",
      "--effort",
      "high",
      "--invocation",
      "host-run-1",
    ]),
    {
      command: "evaluation-record",
      caseId: "critical-path-ablation",
      effort: "high",
      inputPath: "review.json",
      invocationId: "host-run-1",
      model: "test-model",
      run: 1,
      variant: "full",
    },
  );
  assert.deepEqual(
    parseToxicReviewArguments([
      "evaluation-validate-set",
      "--input",
      "records.json",
    ]),
    {
      command: "evaluation-validate-set",
      inputPath: "records.json",
    },
  );
  assert.throws(
    () => parseToxicReviewArguments([
      "evaluation-prepare",
      "--case",
      "critical-path-ablation",
      "--variant",
      "full",
      "--run",
      "1.5",
    ]),
    /Internal Skill protocol/u,
  );
  await assert.rejects(
    () => runToxicReview(),
    (error) => error.code === TOXIC_REVIEW_MODEL_ADAPTER_CODE,
  );
});

test("toxic review brief offers one conditional causal-completeness perspective", async () => {
  const dependencies = { loadWritingStandard: async () => "shared standard\n" };
  const [plan, incident] = await Promise.all([
    createToxicReviewBrief(
      { risk: "high", stage: "design", target: "plan" },
      dependencies,
    ),
    createToxicReviewBrief(
      { risk: "high", stage: "operation", target: "incident" },
      dependencies,
    ),
  ]);
  assert.deepEqual(plan.causalCompleteness, incident.causalCompleteness);
  assert.match(
    plan.causalCompleteness.activation,
    /named work product makes or relies on a material causal claim/u,
  );
  assert.match(
    plan.causalCompleteness.activation,
    /Do not select it only because the target kind is incident/u,
  );
  assert.match(plan.causalCompleteness.role[0], /one selected role/u);
  assert.match(plan.causalCompleteness.role[0], /method to causal-completeness/u);
  assert.match(plan.causalCompleteness.role[1], /captured baseline/u);
  assert.match(plan.causalCompleteness.role[2], /end-to-end flow/u);
  assert.match(plan.causalCompleteness.role[3], /Zero or one supported candidate/u);
  assert.match(plan.causalCompleteness.role[4], /Remove a proposed cause/u);
  assert.match(plan.causalCompleteness.role[4], /disconfirms material contribution/u);
  assert.match(plan.causalCompleteness.role[5], /long serial phase/u);
  assert.match(plan.causalCompleteness.role[5], /phase-level candidate/u);
  assert.match(plan.causalCompleteness.role[5], /independently bounded/u);
  assert.match(plan.causalCompleteness.role[5], /do not merge them/u);
  assert.match(plan.causalCompleteness.role[6], /prediction that could disconfirm/u);
  assert.match(plan.causalCompleteness.role[7], /candidate count/u);
  assert.match(plan.causalCompleteness.role[7], /with zero candidates/u);
  assert.match(plan.causalCompleteness.role[7], /with one/u);
  assert.match(plan.causalCompleteness.role[7], /with two or more/u);
  assert.match(plan.causalCompleteness.role[8], /Do not execute a new check/u);
  assert.match(plan.causalCompleteness.role[8], /no safe check exists/u);
  assert.match(plan.causalCompleteness.record[0], /top-level causalAnalysis/u);
  assert.match(plan.causalCompleteness.record[2], /every material observed phase/u);
  assert.match(plan.causalCompleteness.record[2], /exclusion reason/u);
  assert.match(plan.causalCompleteness.record[4], /inseparable aggregate/u);
  assert.match(plan.causalCompleteness.record[4], /partition that aggregate/u);
  assert.match(plan.causalCompleteness.record[4], /phase candidates/u);
  assert.match(plan.causalCompleteness.record[5], /disconfirmed claimed cause/u);
  assert.match(plan.causalCompleteness.record[6], /candidateCount/u);
  assert.match(plan.causalCompleteness.outcome[0], /finding confidence/u);
  assert.match(plan.causalCompleteness.outcome[0], /root cause/u);
  assert.match(plan.causalCompleteness.outcome[1], /Defer a finding/u);
  assert.match(plan.causalCompleteness.outcome[2], /scopeLimits/u);
  assert.match(plan.causalCompleteness.outcome[3], /Do not manufacture a finding/u);
  assert.match(plan.causalCompleteness.stopping[0], /zero candidates/u);
  assert.match(plan.causalCompleteness.stopping[1], /one candidate/u);
  assert.match(plan.causalCompleteness.stopping[2], /two or more candidates/u);
  assert.match(plan.causalCompleteness.stopping[3], /no safe check exists/u);
  assert.deepEqual(
    plan.causalCompleteness.decisionExamples.map((example) => example.id),
    [
      "repeated-boundary-dominates",
      "local-stage-dominates",
      "missing-discriminating-evidence",
    ],
  );
});
