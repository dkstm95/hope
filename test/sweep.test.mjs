import assert from "node:assert/strict";
import test from "node:test";

import {
  createSweepBrief,
  runSweep,
  SWEEP_MODEL_ADAPTER_CODE,
} from "../features/sweep/index.mjs";
import { parseSweepArguments } from "../features/sweep/cli.mjs";
import { createPolishReceipt } from "../features/polish/validate.mjs";
import {
  createSweepApprovalCandidate,
  sweepPlanDigest,
  validateSweepApprovalReceipt,
  validateSweepCompletion,
  validateSweepPlan,
  validateSweepSessionResult,
} from "../features/sweep/validate.mjs";
import {
  makeSweepApprovalCandidate,
  makeSweepApprovalReceipt,
  makeSweepCompletion,
  makeSweepPlan,
  makeSweepPolishRun,
  makeSweepSessionResult,
  sweepApprovalDependencies,
} from "../test-support/sweep-fixture.mjs";
import {
  SWEEP_CHECK_CATALOG,
} from "../features/sweep/constants.mjs";

const clone = (value) => structuredClone(value);
const validateCompletion = (value) => validateSweepCompletion(
  value,
  sweepApprovalDependencies,
);
const validateSessionResult = (value) => validateSweepSessionResult(
  value,
  sweepApprovalDependencies,
);

test("sweep validates one bounded dead-code plan", () => {
  const plan = validateSweepPlan(makeSweepPlan());
  assert.equal(plan.result.state, "awaiting-approval");
  assert.equal(plan.result.executableCandidates, 1);
  assert.equal(plan.resources.categories, 7);
  assert.equal(plan.resources.checks, 21);
  assert.equal(plan.resources.filesChecked, 3);
});

test("sweep binds every category to its exact maintenance checks", () => {
  const wrongCheck = makeSweepPlan();
  wrongCheck.categories[0].checks[0].id = "dead-code";
  assert.throws(
    () => validateSweepPlan(wrongCheck),
    /checks\[0\]\.id must be broken-references/u,
  );

  const wrongState = makeSweepPlan();
  wrongState.categories[0].checks[0].inspection = "partial";
  wrongState.categories[0].checks[0].gaps = ["One path could not be resolved."];
  assert.throws(
    () => validateSweepPlan(wrongState),
    /category.*inspection must be partial|inspection must be partial/u,
  );

  const emptyEvidence = makeSweepPlan();
  emptyEvidence.candidates[0].evidenceChecks[0].sourceIds = [];
  assert.throws(
    () => validateSweepPlan(emptyEvidence),
    /passed must cite at least one evidence source/u,
  );

  const incomplete = makeSweepPlan();
  incomplete.candidates[0].evidenceChecks[0].status = "inconclusive";
  assert.throws(
    () => validateSweepPlan(incomplete),
    /Polish evidence references is incomplete|must pass/u,
  );
});

test("sweep supports every declared maintenance check", () => {
  for (const check of SWEEP_CHECK_CATALOG) {
    const input = makeSweepPlan();
    const candidate = input.candidates[0];
    candidate.id = `candidate-${check.id}`;
    candidate.categoryId = check.categoryId;
    candidate.checkId = check.id;
    candidate.evidenceSourceIds = ["repo"];
    candidate.evidenceChecks = check.evidenceChecks.map((id) => ({
      id,
      status: "passed",
      detail: `${id} was checked at the captured codebase identity.`,
      sourceIds: ["repo"],
    }));
    const plan = validateSweepPlan(input);
    assert.equal(plan.candidates[0].checkId, check.id);
    assert.equal(plan.result.executableCandidates, 1);
  }
});

test("sweep routes work from three separate impact decisions", () => {
  const dependencyChange = makeSweepPlan();
  dependencyChange.candidates[0].dependencyImpact = "changing";
  assert.throws(
    () => validateSweepPlan(dependencyChange),
    /Polish work must preserve dependencies/u,
  );

  const publicHandoff = makeSweepPlan();
  publicHandoff.candidates[0].disposition = "handoff";
  publicHandoff.candidates[0].publicContractImpact = "changing";
  publicHandoff.session.state = "complete-with-findings";
  assert.equal(validateSweepPlan(publicHandoff).result.handoffs, 1);

  const unnecessaryReport = makeSweepPlan();
  unnecessaryReport.candidates[0].disposition = "report-only";
  unnecessaryReport.session.state = "complete-with-findings";
  assert.throws(
    () => validateSweepPlan(unnecessaryReport),
    /report-only work must record an uncertain impact|fully supported preserving work must use Polish/u,
  );
});

test("sweep derives no-change, findings-only, and blocked plan states", () => {
  const noChange = makeSweepPlan();
  noChange.candidates = [];
  noChange.session.state = "complete-no-change";
  assert.equal(validateSweepPlan(noChange).result.state, "complete-no-change");

  const findings = makeSweepPlan();
  findings.candidates[0].disposition = "report-only";
  findings.candidates[0].behaviorImpact = "uncertain";
  findings.candidates[0].gaps = ["A dynamic caller may exist."];
  findings.session.state = "complete-with-findings";
  assert.equal(validateSweepPlan(findings).result.reportOnly, 1);

  const blocked = makeSweepPlan();
  blocked.candidates = [];
  blocked.categories[0].checks[0].inspection = "partial";
  blocked.categories[0].checks[0].gaps = ["One reference source was unavailable."];
  blocked.categories[0].inspection = "partial";
  blocked.categories[0].gaps = ["Integrity inspection was incomplete."];
  blocked.session.state = "blocked";
  assert.equal(validateSweepPlan(blocked).result.state, "blocked");
});

test("sweep binds approval to the exact plan, candidate, sources, and preview", () => {
  const plan = makeSweepPlan();
  const first = makeSweepApprovalCandidate(plan);
  const second = makeSweepApprovalCandidate(plan);
  assert.equal(first.candidateDigest, second.candidateDigest);

  const changed = makeSweepPlan();
  changed.candidates[0].preview.patch = "*** Delete two files";
  const changedCandidate = createSweepApprovalCandidate(
    changed,
    "remove-unused-helper",
  );
  assert.notEqual(changedCandidate.candidateDigest, first.candidateDigest);

  assert.equal(first.planDigest, sweepPlanDigest(plan));
  assert.equal(
    createSweepApprovalCandidate(plan, "remove-unused-helper", {
      planDigest: `sha256:${"9".repeat(64)}`,
    }).planDigest,
    first.planDigest,
  );

  for (const [label, mutate] of [
    ["target identity", (value) => {
      value.snapshot.sources.find((source) => source.id === "target-file").digest =
        `sha256:${"8".repeat(64)}`;
    }],
    ["evidence identity", (value) => {
      value.snapshot.sources.find((source) => source.id === "entrypoints").digest =
        `sha256:${"7".repeat(64)}`;
    }],
    ["source ID", (value) => {
      value.snapshot.sources.find((source) => source.id === "target-file").id =
        "renamed-target";
      value.candidates[0].targetSourceIds = ["renamed-target"];
      for (const category of value.categories) {
        category.evidenceSourceIds = category.evidenceSourceIds.map(
          (sourceId) => sourceId === "target-file" ? "renamed-target" : sourceId,
        );
        for (const check of category.checks) {
          check.evidenceSourceIds = check.evidenceSourceIds.map(
            (sourceId) => sourceId === "target-file" ? "renamed-target" : sourceId,
          );
        }
      }
    }],
    ["preview", (value) => {
      value.candidates[0].preview.summary = "Delete the exact renamed preview.";
    }],
    ["maximumChanges", (value) => {
      value.candidates[0].maximumChanges = 2;
    }],
  ]) {
    const variant = makeSweepPlan();
    mutate(variant);
    const bound = createSweepApprovalCandidate(
      variant,
      "remove-unused-helper",
    );
    assert.notEqual(bound.candidateDigest, first.candidateDigest, label);
  }

  const handoff = makeSweepPlan();
  handoff.candidates[0].disposition = "handoff";
  handoff.candidates[0].publicContractImpact = "changing";
  handoff.candidates[0].gaps = ["The public contract must change."];
  handoff.session.state = "complete-with-findings";
  assert.throws(
    () => createSweepApprovalCandidate(
      handoff,
      "remove-unused-helper",
    ),
    /is not executable by Polish/u,
  );
});

test("sweep approval receipts bind the decision and conversation authority", () => {
  const receipt = makeSweepApprovalReceipt();
  assert.equal(
    validateSweepApprovalReceipt(receipt, sweepApprovalDependencies).decision,
    "approved",
  );

  const forged = clone(receipt);
  forged.decision = "rejected";
  assert.throws(
    () => validateSweepApprovalReceipt(forged, sweepApprovalDependencies),
    /receiptDigest does not match/u,
  );

  assert.throws(
    () => validateSweepApprovalReceipt(receipt),
    /requires a trusted host attestation verifier/u,
  );
  assert.throws(
    () => validateSweepApprovalReceipt(receipt, {
      verifyApprovalAttestation: () => false,
    }),
    /was not verified by the trusted host/u,
  );
});

test("sweep validates an exact approved and verified completion", () => {
  const completion = validateCompletion(makeSweepCompletion());
  assert.equal(completion.result.status, "applied");
  assert.equal(completion.result.changed, true);
  assert.deepEqual(completion.outcome.removedSourceIds, ["target-file"]);
  assert.equal(
    completion.result.verificationStatus,
    "verified-in-checked-scope",
  );
});

test("sweep rejects an invented output identity for a removed target", () => {
  const completion = clone(makeSweepCompletion());
  const target = completion.snapshot.sources.find(
    (source) => source.id === "target-file",
  );
  completion.outcome.outputSnapshot = {
    capturedAt: "2026-08-04T00:06:00.000Z",
    sources: [{ ...target, digest: `sha256:${"9".repeat(64)}` }],
  };
  assert.throws(
    () => validateCompletion(completion),
    /must contain every surviving target source|must match the validated Polish output/u,
  );
});

test("sweep keeps surviving target identities for no-change", () => {
  const completion = clone(makeSweepCompletion());
  const target = completion.snapshot.sources.find(
    (source) => source.id === "target-file",
  );
  const polish = makeSweepPolishRun(completion.approvalReceipt);
  polish.plan = [];
  polish.outcome = {
    status: "no-change",
    outputSnapshot: {
      capturedAt: "2026-08-04T00:06:00.000Z",
      sources: [{ ...target }],
    },
    removedSourceIds: [],
    changes: [],
    unresolved: [],
  };
  polish.application = {
    status: "not-needed",
    authoritySourceIds: [],
    beforeIdentityChecked: false,
    finalIdentityChecked: false,
  };
  completion.polishReceipt = createPolishReceipt(polish);
  completion.outcome = {
    status: "no-change",
    outputSnapshot: {
      capturedAt: "2026-08-04T00:06:00.000Z",
      sources: [{ ...target }],
    },
    removedSourceIds: [],
    changes: [],
    verification: completion.outcome.verification,
    gaps: [],
  };
  assert.equal(validateCompletion(completion).result.status, "no-change");
});

test("sweep binds the Polish receipt to the approved candidate and run", () => {
  const wrongCandidate = clone(makeSweepCompletion());
  wrongCandidate.polishReceipt.run.target.maximumChanges = 2;
  assert.throws(
    () => validateCompletion(wrongCandidate),
    /polishReceipt|receiptDigest|change budget/u,
  );

  const wrongRun = clone(makeSweepCompletion());
  wrongRun.polishReceipt.run.snapshot.sources.find(
    (source) => source.id === "target-file",
  ).digest = `sha256:${"9".repeat(64)}`;
  assert.throws(
    () => validateCompletion(wrongRun),
    /polishReceipt|receiptDigest|approved source/u,
  );
});

test("sweep rejects an approved-action or verification substitution", () => {
  for (const [mutate, message] of [
    [
      (run) => { run.target.purpose = "Delete another implementation."; },
      /approved action and preview/u,
    ],
    [
      (run) => { run.verification[0].method = "Run a smaller test."; },
      /verification methods must match/u,
    ],
    [
      (run) => { run.application.comparison = "*** Delete another file"; },
      /comparison must match the approved patch preview/u,
    ],
  ]) {
    const completion = clone(makeSweepCompletion());
    const run = makeSweepPolishRun(completion.approvalReceipt);
    mutate(run);
    completion.polishReceipt = createPolishReceipt(run);
    assert.throws(() => validateCompletion(completion), message);
  }
});

test("sweep invalidates approval when a bound source changes", () => {
  const stale = clone(makeSweepCompletion());
  stale.snapshot.sources.find((source) => source.id === "target-file").digest =
    `sha256:${"9".repeat(64)}`;
  delete stale.polishReceipt;
  stale.outcome = {
    status: "stale",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    verification: [],
    gaps: ["The target changed after approval."],
  };
  const completion = validateCompletion(stale);
  assert.equal(completion.result.status, "stale");
});

test("sweep keeps a Polish material choice as an ordinary-task handoff", () => {
  const handoff = clone(makeSweepCompletion());
  const polish = makeSweepPolishRun(handoff.approvalReceipt);
  polish.plan = [];
  for (const condition of polish.preservation) condition.verificationIds = [];
  polish.outcome = {
    status: "needs-alignment",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    unresolved: ["Removing the file requires a public contract decision."],
  };
  polish.verification = [];
  polish.application = {
    status: "not-needed",
    authoritySourceIds: [],
    beforeIdentityChecked: false,
    finalIdentityChecked: false,
  };
  handoff.polishReceipt = createPolishReceipt(polish);
  handoff.outcome = {
    status: "handed-off",
    outputSnapshot: null,
    removedSourceIds: [],
    changes: [],
    verification: [],
    gaps: ["Removing the file requires a public contract decision."],
  };
  assert.equal(validateCompletion(handoff).result.status, "handed-off");
});

test("sweep derives the file budget from cited file sources", () => {
  const understated = makeSweepPlan();
  understated.summary.filesChecked = 2;
  assert.throws(
    () => validateSweepPlan(understated),
    /must equal the 3 distinct file sources/u,
  );

  const overstated = makeSweepPlan();
  overstated.summary.filesChecked = 4;
  assert.throws(
    () => validateSweepPlan(overstated),
    /must equal the 3 distinct file sources/u,
  );
});

test("sweep session result binds every candidate, completion, and gap", () => {
  const result = validateSessionResult(makeSweepSessionResult());
  assert.equal(result.result.state, "complete");
  assert.equal(result.result.completedCandidates, 1);

  const missingCandidate = clone(makeSweepSessionResult());
  missingCandidate.candidateResults = [];
  assert.throws(
    () => validateSessionResult(missingCandidate),
    /must contain every plan candidate|unreported candidate/u,
  );

  const wrongCompletion = clone(makeSweepSessionResult());
  wrongCompletion.candidateResults[0].completionDigest = `sha256:${"9".repeat(64)}`;
  assert.throws(
    () => validateSessionResult(wrongCompletion),
    /completionDigest must match/u,
  );

  const omittedGap = clone(makeSweepSessionResult());
  omittedGap.plan.summary.remainingGaps = ["One package path was not inspected."];
  omittedGap.planDigest = sweepPlanDigest(omittedGap.plan);
  assert.throws(
    () => validateSessionResult(omittedGap),
    /remainingGaps must keep every unresolved/u,
  );
});

test("sweep enforces the approved budget and target-linked verification", () => {
  const overBudget = clone(makeSweepCompletion());
  const extraChange = clone(overBudget.outcome.changes[0]);
  extraChange.polishChangeId = "extra-change";
  overBudget.outcome.changes.push(extraChange);
  assert.throws(
    () => validateCompletion(overBudget),
    /exceed the approved maximumChanges/u,
  );

  const unrelated = clone(makeSweepCompletion());
  unrelated.outcome.verification[0].sourceIds = ["repo"];
  assert.throws(
    () => validateCompletion(unrelated),
    /needs a linked passed verification/u,
  );

  const failed = clone(makeSweepCompletion());
  failed.outcome.verification[0].status = "failed";
  assert.throws(
    () => validateCompletion(failed),
    /requires every verification to pass|needs a linked passed verification/u,
  );

  const empty = clone(makeSweepCompletion());
  empty.outcome.verification = [];
  assert.throws(
    () => validateCompletion(empty),
    /requires every verification to pass|unknown verification ID/u,
  );
});

test("sweep brief and CLI expose the two-stage contract", async () => {
  const brief = await createSweepBrief(
    { risk: "high" },
    { loadWritingStandard: async () => "shared standard\n" },
  );
  assert.equal(brief.feature, "sweep");
  assert.equal(brief.categories.length, 7);
  assert.equal(brief.composition.dependency, "Sweep -> Polish");
  assert.match(brief.approvalSchemaPath, /approval-v1\.schema\.json$/u);
  assert.match(brief.approval.join(" "), /Do not modify repository files/u);
  assert.equal(brief.writingStandard.text, "shared standard\n");
  assert.deepEqual(
    parseSweepArguments([
      "approval-candidate",
      "--input",
      "/tmp/plan.json",
      "--candidate",
      "candidate-1",
    ]),
    {
      candidateId: "candidate-1",
      command: "approval-candidate",
      inputPath: "/tmp/plan.json",
    },
  );
  assert.deepEqual(
    parseSweepArguments([
      "model-evaluation-prepare",
      "--case",
      "sweep-safe-private",
      "--run",
      "1",
    ]),
    {
      caseId: "sweep-safe-private",
      command: "model-evaluation-prepare",
      run: 1,
    },
  );
  assert.deepEqual(
    parseSweepArguments([
      "approval-receipt",
      "--input",
      "/tmp/approval.json",
    ]),
    {
      command: "approval-receipt",
      inputPath: "/tmp/approval.json",
    },
  );
  assert.throws(
    runSweep,
    (error) => error.code === SWEEP_MODEL_ADAPTER_CODE,
  );
});
