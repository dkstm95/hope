import assert from "node:assert/strict";
import test from "node:test";

import {
  createSweepModelEvaluationPlan,
  createSweepModelEvaluationRecord,
  getSweepModelEvaluationOracle,
  prepareSweepModelEvaluationRun,
  sweepModelEvaluationCases,
  validateSweepModelEvaluationOutput,
  validateSweepModelEvaluationRecord,
  validateSweepModelEvaluationRecordSet,
} from "../features/sweep/index.mjs";

const dependencies = {
  allowSynthetic: true,
  loadWritingStandard: async () => "shared standard\n",
};

function expectedOutput(caseId, overrides = {}) {
  const oracle = getSweepModelEvaluationOracle(caseId).oracle;
  return {
    categoryId: oracle.categoryId,
    checkId: oracle.checkId,
    decision: oracle.decision,
    impacts: { ...oracle.impacts },
    targetPaths: [...oracle.requiredTargetPaths],
    unsupportedCategoryIds: [],
    reason: "The repository evidence supports this whole-project Sweep disposition.",
    ...overrides,
  };
}

async function recordFor(specification, overrides = {}) {
  return (await createSweepModelEvaluationRecord({
    caseId: specification.caseId,
    run: specification.run,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: `invocation-${specification.caseId}-${specification.run}`,
    output: expectedOutput(specification.caseId),
    ...overrides,
  }, dependencies)).record;
}

test("Sweep model evaluation covers every category and its safety boundaries", () => {
  assert.deepEqual(
    sweepModelEvaluationCases.map((evaluationCase) => evaluationCase.id),
    [
      "sweep-safe-private",
      "sweep-dynamic-lookup",
      "sweep-public-contract",
      "sweep-abstraction-repetition",
      "sweep-integrity-generated-drift",
      "sweep-tests-docs-drift",
      "sweep-dependency-security",
      "sweep-performance-ci-waste",
      "sweep-architecture-drift",
      "sweep-untrusted-source",
    ],
  );
  assert.equal(createSweepModelEvaluationPlan().totalRuns, 10);
});

test("Sweep model evaluation keeps every oracle out of prepared host input", async () => {
  for (const evaluationCase of sweepModelEvaluationCases) {
    const prepared = await prepareSweepModelEvaluationRun({
      caseId: evaluationCase.id,
      run: 1,
    }, dependencies);
    assert.equal(Object.hasOwn(prepared, "oracle"), false);
    assert.equal(JSON.stringify(prepared).includes("targetPaths\":[]"), false);
    assert.equal(JSON.stringify(prepared.repositoryInput).includes("oracle"), false);
  }
});

test("Sweep model evaluation validates the exact whole-project output contract", () => {
  assert.equal(
    validateSweepModelEvaluationOutput(
      expectedOutput("sweep-safe-private"),
    ).decision,
    "polish",
  );
  assert.throws(
    () => validateSweepModelEvaluationOutput({
      ...expectedOutput("sweep-safe-private"),
      unsupportedCategoryIds: ["integrity"],
    }),
    /unsupportedCategoryIds must match/u,
  );
  assert.throws(
    () => validateSweepModelEvaluationOutput({
      ...expectedOutput("sweep-safe-private"),
      approved: true,
    }),
    /must contain exactly/u,
  );

  const large = expectedOutput("sweep-safe-private", {
    reason: "😀".repeat(2048),
    targetPaths: Array.from(
      { length: 8 },
      (_, index) => `${"😀".repeat(254)}${index}`,
    ),
  });
  assert.throws(
    () => validateSweepModelEvaluationOutput(large),
    /model output exceeds 16384 bytes/u,
  );
  assert.equal(
    validateSweepModelEvaluationOutput(expectedOutput("sweep-safe-private", {
      reason: "a".repeat(2048),
    })).reason.length,
    2048,
  );
});

test("Sweep model evaluation accepts a safe no-candidate dynamic result", async () => {
  const created = await createSweepModelEvaluationRecord({
    caseId: "sweep-dynamic-lookup",
    run: 1,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: "invocation-dynamic-no-candidate",
    output: {
      categoryId: null,
      checkId: null,
      decision: "no-candidate",
      impacts: null,
      targetPaths: [],
      unsupportedCategoryIds: [],
      reason: "Dynamic reachability prevents a supported dead-code finding.",
    },
  }, dependencies);
  assert.equal(created.evaluation.runPassed, true);
});

test("Sweep model evaluation accepts an equivalent public-contract category", async () => {
  const created = await createSweepModelEvaluationRecord({
    caseId: "sweep-public-contract",
    run: 1,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: "invocation-public-contract-alternative",
    output: {
      categoryId: "integrity",
      checkId: "configuration-drift",
      decision: "handoff",
      impacts: {
        behavior: "changing",
        publicContract: "changing",
        dependency: "preserving",
      },
      targetPaths: ["package.json", "src/legacy-api.mjs"],
      unsupportedCategoryIds: [],
      reason: "The exposed unsupported export is configuration drift with a breaking repair.",
    },
  }, dependencies);
  assert.equal(created.evaluation.runPassed, true);
});

test("Sweep model evaluation records bind the active brief, input, and output", async () => {
  const record = await recordFor({
    caseId: "sweep-public-contract",
    run: 1,
  });
  const validated = await validateSweepModelEvaluationRecord(
    record,
    dependencies,
  );
  assert.equal(validated.evaluation.runPassed, true);

  const changedOutput = structuredClone(record);
  changedOutput.output.reason = "Changed after the invocation.";
  await assert.rejects(
    validateSweepModelEvaluationRecord(changedOutput, dependencies),
    /outputDigest does not match/u,
  );

  const changedInput = structuredClone(record);
  changedInput.invocation.inputDigest = `sha256:${"a".repeat(64)}`;
  await assert.rejects(
    validateSweepModelEvaluationRecord(changedInput, dependencies),
    /inputDigest does not match/u,
  );

  const changedEvaluation = structuredClone(record);
  changedEvaluation.evaluationVersion -= 1;
  await assert.rejects(
    validateSweepModelEvaluationRecord(changedEvaluation, dependencies),
    /evaluationVersion does not match/u,
  );
});

test("Sweep model evaluation keeps failed runs and requires one complete configuration", async () => {
  const plan = createSweepModelEvaluationPlan();
  const records = [];
  for (const specification of plan.runs) {
    records.push(await recordFor(specification));
  }
  const result = await validateSweepModelEvaluationRecordSet(
    records,
    dependencies,
  );
  assert.deepEqual(result.summary, {
    totalRuns: 10,
    passedRuns: 10,
    failedRuns: 0,
  });

  const failed = [...records];
  failed[0] = await recordFor(plan.runs[0], {
    output: expectedOutput(plan.runs[0].caseId, {
      decision: "report-only",
      impacts: {
        behavior: "uncertain",
        publicContract: "preserving",
        dependency: "preserving",
      },
    }),
  });
  const failedResult = await validateSweepModelEvaluationRecordSet(
    failed,
    dependencies,
  );
  assert.equal(failedResult.summary.failedRuns, 1);

  const mixed = structuredClone(records);
  mixed[1].configuration.model = "another-model";
  await assert.rejects(
    validateSweepModelEvaluationRecordSet(mixed, dependencies),
    /briefDigest|one host, model, and effort/u,
  );
});

test("Sweep release evidence requires a runner-recorded host invocation", async () => {
  const plan = createSweepModelEvaluationPlan();
  const synthetic = [];
  for (const specification of plan.runs) {
    synthetic.push(await recordFor(specification));
  }
  await assert.rejects(
    validateSweepModelEvaluationRecordSet(synthetic, {
      loadWritingStandard: dependencies.loadWritingStandard,
    }),
    /requires host-recorded runner evidence/u,
  );

  const specification = plan.runs[0];
  const output = expectedOutput(specification.caseId);
  const invocationId = "runner-invocation";
  const runnerEvidence = {
    runner: "hope-test-runner",
    rawOutput: JSON.stringify(output),
    events: [
      { type: "thread.started", thread_id: invocationId },
      { type: "turn.started" },
      {
        type: "item.completed",
        item: { type: "agent_message", text: JSON.stringify(output) },
      },
      { type: "turn.completed" },
    ],
  };
  const recorded = await recordFor(specification, {
    invocationId,
    output,
    runnerEvidence,
  });
  const validated = await validateSweepModelEvaluationRecord(
    recorded,
    dependencies,
  );
  assert.equal(validated.record.provenance.kind, "codex-runner");

  const tampered = structuredClone(recorded);
  tampered.provenance.rawOutput = JSON.stringify({
    ...output,
    reason: "A different recorded output.",
  });
  await assert.rejects(
    validateSweepModelEvaluationRecord(tampered, dependencies),
    /does not match model output|digests do not match/u,
  );
});
