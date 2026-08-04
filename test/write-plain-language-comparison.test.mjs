import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createHopeWritePlainLanguageComparisonPlan,
  createHopeWritePlainLanguageComparisonResult,
  loadHopeWritePlainLanguageBaselineStandard,
  prepareHopeWritePlainLanguageComparisonAssessment,
  prepareHopeWritePlainLanguageComparisonRun,
  validateHopeWritePlainLanguageComparisonAssessment,
} from "../features/model-evaluation/write-plain-language-comparison.mjs";
import {
  getHopeWritePlainLanguageEvaluationOracle,
} from "../features/model-evaluation/write-plain-language.mjs";
import {
  parseModelEvaluationArguments,
} from "../features/model-evaluation/cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function outputsFor(caseId, run) {
  return {
    baseline: {
      revision: `Baseline revision for ${caseId}, run ${run}.`,
    },
    current: {
      revision: `Current revision for ${caseId}, run ${run}.`,
    },
  };
}

function assessmentFor(caseId, run, {
  failCurrentAssertion = false,
} = {}) {
  const outputs = outputsFor(caseId, run);
  const prepared = prepareHopeWritePlainLanguageComparisonAssessment({
    caseId,
    outputs,
    run,
  });
  const oracle = getHopeWritePlainLanguageEvaluationOracle(caseId);
  const currentId = prepared.privateAssignment.A === "current" ? "A" : "B";
  return {
    assessment: {
      candidates: ["A", "B"].map((id) => ({
        assertions: oracle.assertions.map(({ id: assertionId }, index) => ({
          evidence: `${assertionId} was checked for candidate ${id}.`,
          id: assertionId,
          passed: !(failCurrentAssertion && id === currentId && index === 0),
        })),
        criteria: oracle.criteria.map(({ id: criterionId }) => ({
          evidence: `${criterionId} was checked for candidate ${id}.`,
          id: criterionId,
          passed: true,
        })),
        id,
      })),
      preferences: [
        "plain-for-intended-reader",
        "natural-target-language",
        "only-needed-repairs",
        "overall",
      ].map((id) => ({
        evidence: `Candidate ${currentId} is stronger for ${id}.`,
        id,
        selected: currentId,
      })),
    },
    caseId,
    outputs,
    run,
  };
}

test("comparison plan fixes 24 fresh writers and 12 blind assessments", () => {
  const plan = createHopeWritePlainLanguageComparisonPlan();
  assert.equal(plan.totalWriterRuns, 24);
  assert.equal(plan.totalAssessments, 12);
  assert.equal(
    plan.writerRuns.filter((run) => run.variant === "baseline").length,
    12,
  );
  assert.equal(
    plan.writerRuns.filter((run) => run.variant === "current").length,
    12,
  );
});

test("comparison baseline is the exact committed Write version 2 standard", async () => {
  const standard = await loadHopeWritePlainLanguageBaselineStandard();
  assert.equal(
    createHash("sha256").update(standard).digest("hex"),
    "55a56febb08dd0cc253f7ecea6c877f01ddd7ed10316cbab31cab1c5b1c91100",
  );
  const baseline = await prepareHopeWritePlainLanguageComparisonRun({
    caseId: "write-plain-language-01",
    run: 1,
    variant: "baseline",
  });
  const current = await prepareHopeWritePlainLanguageComparisonRun({
    caseId: "write-plain-language-01",
    run: 1,
    variant: "current",
  });
  assert.equal(baseline.brief.version, 2);
  assert.equal(baseline.brief.standardVersion, 2);
  assert.equal(baseline.brief.decisionExamples.length, 4);
  assert.equal(current.brief.version, 4);
  assert.equal(current.brief.standardVersion, 4);
  assert.equal(current.brief.decisionExamples.length, 5);
  assert.equal(Object.hasOwn(baseline, "oracle"), false);
  assert.equal(Object.hasOwn(current, "oracle"), false);
});

test("comparison assessment hides variants and changes candidate order", () => {
  const prepared = [1, 2, 3].map((run) =>
    prepareHopeWritePlainLanguageComparisonAssessment({
      caseId: "write-plain-language-01",
      outputs: outputsFor("write-plain-language-01", run),
      run,
    })
  );
  for (const item of prepared) {
    assert.equal(Object.hasOwn(item.evaluatorInput, "variant"), false);
    assert.equal(Object.hasOwn(item.evaluatorInput, "assignment"), false);
    assert.deepEqual(
      item.evaluatorInput.candidates.map((candidate) => candidate.id),
      ["A", "B"],
    );
  }
  assert.ok(
    new Set(prepared.map((item) => item.privateAssignment.A)).size > 1,
  );
});

test("comparison result requires complete current preservation and blind wins", () => {
  const plan = createHopeWritePlainLanguageComparisonPlan();
  const records = plan.assessmentRuns.map(({ caseId, run }) =>
    assessmentFor(caseId, run)
  );
  for (const record of records) {
    assert.deepEqual(
      validateHopeWritePlainLanguageComparisonAssessment(
        record.assessment,
        record.caseId,
      ),
      record.assessment,
    );
  }
  const result = createHopeWritePlainLanguageComparisonResult(records);
  assert.equal(result.decision, "observed-improvement");
  assert.equal(result.summary.improved, true);
  assert.equal(result.summary.variants.current.eligibleOutputs, 12);
  assert.equal(result.summary.variants.current.overallWins, 12);
  assert.equal(result.releaseEligible, false);

  const failed = [...records];
  failed[0] = assessmentFor(failed[0].caseId, failed[0].run, {
    failCurrentAssertion: true,
  });
  const failedResult = createHopeWritePlainLanguageComparisonResult(failed);
  assert.equal(failedResult.decision, "improvement-not-demonstrated");
  assert.equal(failedResult.summary.improved, false);
});

test("comparison CLI parses a versioned writer run", () => {
  assert.deepEqual(
    parseModelEvaluationArguments([
      "write-plain-language-comparison-prepare",
      "--case",
      "write-plain-language-03",
      "--variant",
      "current",
      "--run",
      "2",
    ]),
    {
      caseId: "write-plain-language-03",
      command: "write-plain-language-comparison-prepare",
      run: 2,
      variant: "current",
    },
  );
});

test("harness and generated plugin expose the same comparison plan", () => {
  const harness = spawnSync(
    process.execPath,
    [
      "harness/hope.mjs",
      "model-evaluation",
      "write-plain-language-comparison-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "write-plain-language-comparison-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, 0, harness.stderr);
  assert.equal(plugin.status, 0, plugin.stderr);
  assert.deepEqual(JSON.parse(harness.stdout), JSON.parse(plugin.stdout));
});
