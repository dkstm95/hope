import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createDiffInvocationContract,
  createDiffInvocationExampleRemovalPlan,
  createDiffInvocationExampleRemovalRecord,
  createDiffInvocationEvaluationPlan,
  createDiffInvocationEvaluationRecord,
  createDiffInvocationEvaluationRecordFromFile,
  createDiffInvocationProductionVerificationPlan,
  createDiffInvocationProductionVerificationRecord,
  diffInvocationEvaluationCases,
  diffInvocationEvaluationLimits,
  diffInvocationEvaluationProtocol,
  getDiffInvocationEvaluationOracle,
  prepareDiffInvocationExampleRemovalRun,
  prepareDiffInvocationEvaluationRun,
  prepareDiffInvocationProductionVerificationRun,
  validateDiffInvocationExampleRemovalEvidence,
  validateDiffInvocationExampleRemovalRecordSet,
  validateDiffInvocationEvaluationOutput,
  validateDiffInvocationEvaluationRecord,
  validateDiffInvocationEvaluationRecordFile,
  validateDiffInvocationEvaluationRecordSet,
  validateDiffInvocationEvaluationRecordSetFile,
  validateDiffInvocationProductionVerificationRecordSet,
} from "../features/diff/index.mjs";
import {
  main as runDiffCommand,
  parseDiffArguments,
} from "../features/diff/cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const diffEntries = [
  ["features/diff/cli.mjs", []],
  ["harness/hope.mjs", ["diff"]],
  ["plugins/hope/runtime/features/diff/cli.mjs", []],
];

function runJson(path, prefixArguments, arguments_) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, path), ...prefixArguments, ...arguments_],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function assertEntryParity(arguments_) {
  const results = diffEntries.map(([path, prefix]) => runJson(
    path,
    prefix,
    arguments_,
  ));
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[2], results[0]);
  return results[0];
}

function expectedOutput(caseId, decision) {
  const oracle = getDiffInvocationEvaluationOracle(caseId);
  return {
    decision: decision ?? oracle.oracle.expectedDecision,
    reason: `The request maps to ${decision ?? oracle.oracle.expectedDecision}.`,
  };
}

function recordFor(specification, overrides = {}) {
  return createDiffInvocationEvaluationRecord({
    caseId: specification.caseId,
    variant: specification.variant,
    run: specification.run,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId:
      `invocation-${specification.caseId}-${specification.variant}-${specification.run}`,
    output: expectedOutput(specification.caseId),
    ...overrides,
  }).record;
}

function exampleRemovalRecordFor(specification, overrides = {}) {
  return createDiffInvocationExampleRemovalRecord({
    batch: specification.batch,
    caseId: specification.caseId,
    run: specification.run,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId:
      `example-removal-${specification.batch}-${specification.caseId}-${specification.run}`,
    output: expectedOutput(specification.caseId),
    ...overrides,
  }).record;
}

function productionVerificationRecordFor(specification, overrides = {}) {
  return createDiffInvocationProductionVerificationRecord({
    caseId: specification.caseId,
    run: specification.run,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: `production-${specification.caseId}-${specification.run}`,
    output: expectedOutput(specification.caseId),
    ...overrides,
  }).record;
}

test("Diff invocation evaluation separates conformance, ablation, and safety", () => {
  assert.deepEqual(
    Object.keys(diffInvocationEvaluationProtocol.suites),
    ["conformance", "ablation", "safety"],
  );
  assert.deepEqual(
    diffInvocationEvaluationProtocol.suites.ablation.variants,
    ["minimal", "rules-only", "full"],
  );
  assert.equal(
    diffInvocationEvaluationProtocol.suites.ablation.runsPerVariant,
    2,
  );
  assert.deepEqual(
    diffInvocationEvaluationCases.map((evaluationCase) => evaluationCase.suite),
    [
      "conformance",
      "conformance",
      "ablation",
      "ablation",
      "ablation",
      "safety",
      "safety",
      "safety",
    ],
  );
  assert.match(
    JSON.stringify(diffInvocationEvaluationCases),
    /[가-힣]/u,
  );
  assert.match(
    JSON.stringify(diffInvocationEvaluationCases),
    /Could you|Do not run/u,
  );
});

test("Diff invocation evaluation keeps held-out inputs blinded", () => {
  for (const evaluationCase of diffInvocationEvaluationCases) {
    assert.match(evaluationCase.id, /^invocation-[0-9]{2}$/u);
    const input = JSON.stringify(evaluationCase.input);
    assert.equal(input.includes("expectedDecision"), false);
    assert.equal(input.includes("oracle"), false);
  }
  const plan = createDiffInvocationEvaluationPlan();
  assert.equal(plan.totalRuns, 26);
  assert.equal(plan.runs.length, 26);
  assert.equal(JSON.stringify(plan).includes("expectedDecision"), false);
  assert.equal(JSON.stringify(plan).includes("hostInput"), true);
});

test("Diff invocation evaluation prepares distinct instruction variants", () => {
  const options = {
    caseId: "invocation-03",
    run: 1,
  };
  const minimal = prepareDiffInvocationEvaluationRun({
    ...options,
    variant: "minimal",
  });
  const rulesOnly = prepareDiffInvocationEvaluationRun({
    ...options,
    variant: "rules-only",
  });
  const full = prepareDiffInvocationEvaluationRun({
    ...options,
    variant: "full",
  });

  assert.equal(minimal.brief.classification, undefined);
  assert.equal(minimal.brief.evaluationCases, undefined);
  assert.equal(minimal.brief.targetResolution, undefined);
  assert.equal(rulesOnly.brief.evaluationCases, undefined);
  assert.ok(Array.isArray(rulesOnly.brief.classification));
  assert.ok(Array.isArray(full.brief.evaluationCases));
  assert.notEqual(minimal.briefDigest, rulesOnly.briefDigest);
  assert.notEqual(rulesOnly.briefDigest, full.briefDigest);
  assert.equal(
    full.briefDigest,
    "sha256:ba9701f4954a49d545ded77e2e8547eadc1b60c048d5fbd5dc87e3ceeea995fa",
  );
  assert.equal(
    rulesOnly.briefDigest,
    "sha256:eb369735e19acee119c3c3dfa2217913b4837d8c8f988b564fc11f00cb38e18f",
  );
  assert.equal(Object.hasOwn(minimal, "oracle"), false);
  assert.equal(Object.hasOwn(full.hostInput, "oracle"), false);
  assert.deepEqual(
    Object.keys(full.outputContract.fields),
    ["decision", "reason"],
  );
  assert.throws(
    () => prepareDiffInvocationEvaluationRun({
      caseId: "invocation-01",
      run: 1,
      variant: "minimal",
    }),
    /does not support variant minimal/u,
  );
});

test("Diff invocation evaluation validates bounded model output", () => {
  assert.deepEqual(
    validateDiffInvocationEvaluationOutput({
      decision: "answer",
      reason: "The person asked a capability question.",
    }),
    {
      decision: "answer",
      reason: "The person asked a capability question.",
    },
  );
  assert.throws(
    () => validateDiffInvocationEvaluationOutput({
      decision: "answer",
      reason: "Valid reason.",
      target: null,
    }),
    /must contain exactly decision, reason/u,
  );
  assert.throws(
    () => validateDiffInvocationEvaluationOutput({
      decision: "review",
      reason: "Unsupported decision.",
    }),
    /decision is not supported/u,
  );
});

test("Diff invocation records bind the prepared input and model output", async () => {
  const specification = {
    caseId: "invocation-04",
    variant: "full",
    run: 1,
  };
  const created = createDiffInvocationEvaluationRecord({
    ...specification,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: "invocation-record-test",
    output: expectedOutput(specification.caseId),
  });
  assert.equal(created.evaluation.runPassed, true);
  const validated = validateDiffInvocationEvaluationRecord(created.record);
  assert.equal(validated.evaluation.runPassed, true);
  assert.ok(
    Buffer.byteLength(JSON.stringify(created.record), "utf8")
      < diffInvocationEvaluationLimits.recordBytes,
  );

  const fromFile = await createDiffInvocationEvaluationRecordFromFile(
    {
      ...specification,
      host: "codex-test-host",
      model: "test-model",
      effort: "test-effort",
      invocationId: "invocation-file-test",
      inputPath: "synthetic-output.json",
    },
    {
      readInput: async () => ({
        value: expectedOutput(specification.caseId),
        fileBytes: 96,
      }),
    },
  );
  assert.equal(fromFile.evaluation.runPassed, true);

  const tampered = structuredClone(created.record);
  tampered.output.reason = "Changed after the model invocation.";
  assert.throws(
    () => validateDiffInvocationEvaluationRecord(tampered),
    /outputDigest does not match/u,
  );

  const wrongInput = structuredClone(created.record);
  wrongInput.invocation.inputDigest = `sha256:${"a".repeat(64)}`;
  assert.throws(
    () => validateDiffInvocationEvaluationRecord(wrongInput),
    /inputDigest does not match/u,
  );
});

test("A wrong Diff invocation decision remains valid failed evidence", () => {
  const specification = {
    caseId: "invocation-06",
    variant: "full",
    run: 1,
  };
  const created = createDiffInvocationEvaluationRecord({
    ...specification,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: "invocation-wrong-decision",
    output: expectedOutput(specification.caseId, "execute"),
  });
  assert.equal(created.evaluation.expectedDecision, "answer");
  assert.equal(created.evaluation.decisionMatched, false);
  assert.equal(created.evaluation.runPassed, false);
  assert.equal(
    validateDiffInvocationEvaluationRecord(created.record)
      .evaluation.runPassed,
    false,
  );
});

test("Diff invocation record sets require one complete model configuration", () => {
  const plan = createDiffInvocationEvaluationPlan();
  const records = plan.runs.map((specification) => recordFor(specification));
  const validated = validateDiffInvocationEvaluationRecordSet(records);
  assert.deepEqual(validated.summary, {
    totalRuns: 26,
    passedRuns: 26,
    failedRuns: 0,
  });
  assert.deepEqual(validated.byVariant, {
    full: { total: 14, passed: 14, failed: 0 },
    minimal: { total: 6, passed: 6, failed: 0 },
    "rules-only": { total: 6, passed: 6, failed: 0 },
  });
  assert.deepEqual(validated.bySuite, {
    conformance: { total: 2, passed: 2, failed: 0 },
    ablation: { total: 18, passed: 18, failed: 0 },
    safety: { total: 6, passed: 6, failed: 0 },
  });

  const reusedInvocation = structuredClone(records);
  reusedInvocation.at(-1).invocation.id = reusedInvocation[0].invocation.id;
  assert.throws(
    () => validateDiffInvocationEvaluationRecordSet(reusedInvocation),
    /repeats invocation/u,
  );

  const mixedModel = structuredClone(records);
  mixedModel.at(-1).configuration.model = "another-model";
  assert.throws(
    () => validateDiffInvocationEvaluationRecordSet(mixedModel),
    /one host, model, and effort/u,
  );

  assert.throws(
    () => validateDiffInvocationEvaluationRecordSet(records.slice(1)),
    /must contain 26 runs/u,
  );
});

test("Diff example removal completes and repeats rules-only coverage", () => {
  const plan = createDiffInvocationExampleRemovalPlan();
  assert.equal(plan.totalRuns, 22);
  assert.equal(plan.runs.filter((run) => run.batch === 1).length, 8);
  assert.equal(plan.runs.filter((run) => run.batch === 2).length, 14);
  assert.ok(plan.runs.every((run) => run.variant === "rules-only"));
  const prepared = prepareDiffInvocationExampleRemovalRun({
    batch: 1,
    caseId: "invocation-06",
    run: 1,
  });
  assert.equal(prepared.brief.evaluationCases, undefined);
  assert.ok(Array.isArray(prepared.brief.classification));
  assert.equal(Object.hasOwn(prepared, "oracle"), false);
  assert.throws(
    () => prepareDiffInvocationExampleRemovalRun({
      batch: 1,
      caseId: "invocation-03",
      run: 1,
    }),
    /is not planned/u,
  );
});

test("Diff example-removal evidence keeps failures and requires one configuration", () => {
  const baselinePlan = createDiffInvocationEvaluationPlan();
  const baselineRecords = baselinePlan.runs.map(recordFor);
  const followupPlan = createDiffInvocationExampleRemovalPlan();
  const followupRecords = followupPlan.runs.map(exampleRemovalRecordFor);
  const followup = validateDiffInvocationExampleRemovalRecordSet(
    followupRecords,
  );
  assert.deepEqual(followup.summary, {
    totalRuns: 22,
    passedRuns: 22,
    failedRuns: 0,
  });
  const evidence = validateDiffInvocationExampleRemovalEvidence({
    baselineRecords,
    followupRecords,
  });
  assert.deepEqual(evidence.summary, {
    totalRuns: 28,
    passedRuns: 28,
    failedRuns: 0,
    deletionReady: true,
  });
  assert.equal(evidence.decision, "remove-examples");

  const failed = structuredClone(followupRecords);
  failed[0] = exampleRemovalRecordFor(followupPlan.runs[0], {
    output: expectedOutput(followupPlan.runs[0].caseId, "answer"),
  });
  const failedEvidence = validateDiffInvocationExampleRemovalEvidence({
    baselineRecords,
    followupRecords: failed,
  });
  assert.equal(failedEvidence.summary.failedRuns, 1);
  assert.equal(failedEvidence.summary.deletionReady, false);
  assert.equal(failedEvidence.decision, "keep-examples");

  const mixed = structuredClone(followupRecords);
  mixed.at(-1).configuration.model = "another-model";
  assert.throws(
    () => validateDiffInvocationExampleRemovalRecordSet(mixed),
    /one host, model, and effort/u,
  );

  const reusedAcrossSets = structuredClone(followupRecords);
  reusedAcrossSets[0].invocation.id = baselineRecords[0].invocation.id;
  assert.throws(
    () => validateDiffInvocationExampleRemovalEvidence({
      baselineRecords,
      followupRecords: reusedAcrossSets,
    }),
    /baseline and follow-up evidence repeat invocation/u,
  );
});

test("Diff production verification evaluates the exact active brief", () => {
  const plan = createDiffInvocationProductionVerificationPlan();
  assert.equal(plan.contractVersion, 4);
  assert.equal(plan.totalRuns, 8);
  assert.ok(plan.runs.every((run) => run.variant === "production"));
  const prepared = prepareDiffInvocationProductionVerificationRun({
    caseId: "invocation-04",
    run: 1,
  });
  assert.deepEqual(prepared.brief, createDiffInvocationContract());
  assert.equal(prepared.brief.version, 4);
  assert.equal(prepared.brief.evaluationCases, undefined);
  assert.equal(prepared.brief.evaluationControl, undefined);
  assert.throws(
    () => prepareDiffInvocationProductionVerificationRun({
      caseId: "invocation-04",
      run: 2,
    }),
    /is not planned/u,
  );
});

test("Diff production verification requires every active-brief decision", () => {
  const plan = createDiffInvocationProductionVerificationPlan();
  const records = plan.runs.map(productionVerificationRecordFor);
  const result = validateDiffInvocationProductionVerificationRecordSet(
    records,
  );
  assert.deepEqual(result.summary, {
    totalRuns: 8,
    passedRuns: 8,
    failedRuns: 0,
    verificationPassed: true,
  });
  assert.equal(result.decision, "accept-active-brief");

  const failed = structuredClone(records);
  failed[5] = productionVerificationRecordFor(plan.runs[5], {
    output: expectedOutput(plan.runs[5].caseId, "execute"),
  });
  const failedResult = validateDiffInvocationProductionVerificationRecordSet(
    failed,
  );
  assert.equal(failedResult.summary.failedRuns, 1);
  assert.equal(failedResult.summary.verificationPassed, false);
  assert.equal(failedResult.decision, "do-not-release");
});

test("Diff invocation evaluation file validators use bounded inputs", async () => {
  const plan = createDiffInvocationEvaluationPlan();
  const records = plan.runs.map((specification) => recordFor(specification));
  const one = await validateDiffInvocationEvaluationRecordFile(
    "record.json",
    { readInput: async () => ({ value: records[0] }) },
  );
  assert.equal(one.evaluation.runPassed, true);
  const complete = await validateDiffInvocationEvaluationRecordSetFile(
    "records.json",
    { readInput: async () => ({ value: records }) },
  );
  assert.equal(complete.summary.passedRuns, 26);
});

test("Diff CLI parses and delegates invocation evaluation commands", async () => {
  assert.deepEqual(
    parseDiffArguments(["invocation-production-verification-plan"]),
    { command: "invocation-production-verification-plan" },
  );
  assert.deepEqual(
    parseDiffArguments([
      "invocation-production-verification-prepare",
      "--case",
      "invocation-03",
      "--run",
      "1",
    ]),
    {
      command: "invocation-production-verification-prepare",
      caseId: "invocation-03",
      run: 1,
    },
  );
  assert.deepEqual(
    parseDiffArguments(["invocation-example-removal-plan"]),
    { command: "invocation-example-removal-plan" },
  );
  assert.deepEqual(
    parseDiffArguments([
      "invocation-example-removal-prepare",
      "--case",
      "invocation-06",
      "--batch",
      "2",
      "--run",
      "1",
    ]),
    {
      command: "invocation-example-removal-prepare",
      batch: 2,
      caseId: "invocation-06",
      run: 1,
    },
  );
  assert.deepEqual(
    parseDiffArguments(["invocation-evaluation-plan"]),
    { command: "invocation-evaluation-plan" },
  );
  assert.deepEqual(
    parseDiffArguments([
      "invocation-evaluation-prepare",
      "--case",
      "invocation-03",
      "--variant",
      "minimal",
      "--run",
      "2",
    ]),
    {
      command: "invocation-evaluation-prepare",
      caseId: "invocation-03",
      variant: "minimal",
      run: 2,
    },
  );
  assert.deepEqual(
    parseDiffArguments([
      "invocation-evaluation-record",
      "--case",
      "invocation-03",
      "--variant",
      "minimal",
      "--run",
      "1",
      "--input",
      "/tmp/output.json",
      "--host",
      "codex",
      "--model",
      "model-id",
      "--effort",
      "medium",
      "--invocation",
      "invocation-id",
    ]),
    {
      command: "invocation-evaluation-record",
      caseId: "invocation-03",
      variant: "minimal",
      run: 1,
      inputPath: "/tmp/output.json",
      host: "codex",
      model: "model-id",
      effort: "medium",
      invocationId: "invocation-id",
    },
  );

  let received;
  let output = "";
  await runDiffCommand([
    "invocation-evaluation-prepare",
    "--case",
    "invocation-03",
    "--variant",
    "full",
    "--run",
    "1",
  ], {
    prepareInvocationEvaluationRun(options) {
      received = options;
      return { prepared: true };
    },
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.deepEqual(received, {
    command: "invocation-evaluation-prepare",
    caseId: "invocation-03",
    variant: "full",
    run: 1,
  });
  assert.equal(output, `${JSON.stringify({ prepared: true }, null, 2)}\n`);
});

test("core, harness, and generated plugin expose the same invocation evaluation", () => {
  for (const arguments_ of [
    ["invocation-example-removal-plan"],
    [
      "invocation-example-removal-prepare",
      "--case",
      "invocation-06",
      "--batch",
      "2",
      "--run",
      "1",
    ],
    ["invocation-evaluation-plan"],
    ["invocation-evaluation-oracle", "--case", "invocation-03"],
    [
      "invocation-evaluation-prepare",
      "--case",
      "invocation-03",
      "--variant",
      "rules-only",
      "--run",
      "1",
    ],
    ["invocation-production-verification-plan"],
    [
      "invocation-production-verification-prepare",
      "--case",
      "invocation-03",
      "--run",
      "1",
    ],
  ]) {
    assertEntryParity(arguments_);
  }
});

test("every Diff entry exposes the complete evaluation evidence workflow", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-diff-evidence-"));
  try {
    const baselineRecords = createDiffInvocationEvaluationPlan().runs.map(
      recordFor,
    );
    const followupPlan = createDiffInvocationExampleRemovalPlan();
    const followupRecords = followupPlan.runs.map(exampleRemovalRecordFor);
    const productionPlan = createDiffInvocationProductionVerificationPlan();
    const productionRecords = productionPlan.runs.map(
      productionVerificationRecordFor,
    );
    const failedFollowupRecords = structuredClone(followupRecords);
    failedFollowupRecords[0] = exampleRemovalRecordFor(
      followupPlan.runs[0],
      { output: expectedOutput(followupPlan.runs[0].caseId, "answer") },
    );
    const failedProductionRecords = structuredClone(productionRecords);
    failedProductionRecords[5] = productionVerificationRecordFor(
      productionPlan.runs[5],
      { output: expectedOutput(productionPlan.runs[5].caseId, "execute") },
    );

    const paths = Object.fromEntries([
      ["output", expectedOutput("invocation-06")],
      ["baseline", baselineRecords],
      ["followup", followupRecords],
      ["followupRecord", followupRecords[0]],
      ["production", productionRecords],
      ["productionRecord", productionRecords[0]],
      ["failedProduction", failedProductionRecords],
      ["evidence", { baselineRecords, followupRecords }],
      [
        "failedEvidence",
        { baselineRecords, followupRecords: failedFollowupRecords },
      ],
    ].map(([name, value]) => [name, { name, value }]));
    await Promise.all(Object.values(paths).map(async (entry) => {
      entry.path = join(temporary, `${entry.name}.json`);
      await writeFile(entry.path, JSON.stringify(entry.value), { mode: 0o600 });
    }));

    const createdExample = assertEntryParity([
      "invocation-example-removal-record",
      "--case",
      "invocation-06",
      "--batch",
      "1",
      "--run",
      "1",
      "--input",
      paths.output.path,
      "--host",
      "codex-test-host",
      "--model",
      "test-model",
      "--effort",
      "test-effort",
      "--invocation",
      "entry-example-removal",
    ]);
    assert.equal(createdExample.evaluation.runPassed, true);
    assert.equal(assertEntryParity([
      "invocation-example-removal-validate",
      "--input",
      paths.followupRecord.path,
    ]).evaluation.runPassed, true);
    assert.equal(assertEntryParity([
      "invocation-example-removal-validate-set",
      "--input",
      paths.followup.path,
    ]).summary.passedRuns, 22);
    assert.equal(assertEntryParity([
      "invocation-example-removal-validate-evidence",
      "--input",
      paths.evidence.path,
    ]).decision, "remove-examples");
    assert.equal(assertEntryParity([
      "invocation-example-removal-validate-evidence",
      "--input",
      paths.failedEvidence.path,
    ]).decision, "keep-examples");
    assert.equal(assertEntryParity([
      "invocation-evaluation-validate-set",
      "--input",
      paths.baseline.path,
    ]).summary.passedRuns, 26);

    const createdProduction = assertEntryParity([
      "invocation-production-verification-record",
      "--case",
      "invocation-06",
      "--run",
      "1",
      "--input",
      paths.output.path,
      "--host",
      "codex-test-host",
      "--model",
      "test-model",
      "--effort",
      "test-effort",
      "--invocation",
      "entry-production-verification",
    ]);
    assert.equal(createdProduction.evaluation.runPassed, true);
    assert.equal(assertEntryParity([
      "invocation-production-verification-validate",
      "--input",
      paths.productionRecord.path,
    ]).evaluation.runPassed, true);
    assert.equal(assertEntryParity([
      "invocation-production-verification-validate-set",
      "--input",
      paths.production.path,
    ]).decision, "accept-active-brief");
    assert.equal(assertEntryParity([
      "invocation-production-verification-validate-set",
      "--input",
      paths.failedProduction.path,
    ]).decision, "do-not-release");
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("every Diff entry creates and validates the same evaluation record", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-diff-evaluation-"));
  try {
    const outputPath = join(temporary, "output.json");
    await writeFile(
      outputPath,
      JSON.stringify(expectedOutput("invocation-03")),
      { mode: 0o600 },
    );
    const arguments_ = [
      "invocation-evaluation-record",
      "--case",
      "invocation-03",
      "--variant",
      "full",
      "--run",
      "1",
      "--input",
      outputPath,
      "--host",
      "codex-test-host",
      "--model",
      "test-model",
      "--effort",
      "test-effort",
      "--invocation",
      "shared-invocation-id",
    ];
    const created = assertEntryParity(arguments_);

    const recordPath = join(temporary, "record.json");
    await writeFile(
      recordPath,
      JSON.stringify(created.record),
      { mode: 0o600 },
    );
    const validated = assertEntryParity([
      "invocation-evaluation-validate",
      "--input",
      recordPath,
    ]);
    assert.equal(validated.evaluation.runPassed, true);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});
