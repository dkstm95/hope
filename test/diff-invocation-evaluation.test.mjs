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
  createDiffInvocationExampleRemovalReceipt,
  createDiffInvocationEvaluationPlan,
  createDiffInvocationEvaluationReceipt,
  createDiffInvocationEvaluationReceiptFromFile,
  createDiffInvocationProductionVerificationPlan,
  createDiffInvocationProductionVerificationReceipt,
  diffInvocationEvaluationCases,
  diffInvocationEvaluationLimits,
  diffInvocationEvaluationProtocol,
  getDiffInvocationEvaluationOracle,
  prepareDiffInvocationExampleRemovalRun,
  prepareDiffInvocationEvaluationRun,
  prepareDiffInvocationProductionVerificationRun,
  validateDiffInvocationExampleRemovalEvidence,
  validateDiffInvocationExampleRemovalReceiptSet,
  validateDiffInvocationEvaluationOutput,
  validateDiffInvocationEvaluationReceipt,
  validateDiffInvocationEvaluationReceiptFile,
  validateDiffInvocationEvaluationReceiptSet,
  validateDiffInvocationEvaluationReceiptSetFile,
  validateDiffInvocationProductionVerificationReceiptSet,
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

function receiptFor(specification, overrides = {}) {
  return createDiffInvocationEvaluationReceipt({
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
  }).receipt;
}

function exampleRemovalReceiptFor(specification, overrides = {}) {
  return createDiffInvocationExampleRemovalReceipt({
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
  }).receipt;
}

function productionVerificationReceiptFor(specification, overrides = {}) {
  return createDiffInvocationProductionVerificationReceipt({
    caseId: specification.caseId,
    run: specification.run,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: `production-${specification.caseId}-${specification.run}`,
    output: expectedOutput(specification.caseId),
    ...overrides,
  }).receipt;
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

test("Diff invocation receipts bind the prepared input and model output", async () => {
  const specification = {
    caseId: "invocation-04",
    variant: "full",
    run: 1,
  };
  const created = createDiffInvocationEvaluationReceipt({
    ...specification,
    host: "codex-test-host",
    model: "test-model",
    effort: "test-effort",
    invocationId: "invocation-receipt-test",
    output: expectedOutput(specification.caseId),
  });
  assert.equal(created.evaluation.runPassed, true);
  const validated = validateDiffInvocationEvaluationReceipt(created.receipt);
  assert.equal(validated.evaluation.runPassed, true);
  assert.ok(
    Buffer.byteLength(JSON.stringify(created.receipt), "utf8")
      < diffInvocationEvaluationLimits.receiptBytes,
  );

  const fromFile = await createDiffInvocationEvaluationReceiptFromFile(
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

  const tampered = structuredClone(created.receipt);
  tampered.output.reason = "Changed after the model invocation.";
  assert.throws(
    () => validateDiffInvocationEvaluationReceipt(tampered),
    /outputDigest does not match/u,
  );

  const wrongInput = structuredClone(created.receipt);
  wrongInput.invocation.inputDigest = `sha256:${"a".repeat(64)}`;
  assert.throws(
    () => validateDiffInvocationEvaluationReceipt(wrongInput),
    /inputDigest does not match/u,
  );
});

test("A wrong Diff invocation decision remains valid failed evidence", () => {
  const specification = {
    caseId: "invocation-06",
    variant: "full",
    run: 1,
  };
  const created = createDiffInvocationEvaluationReceipt({
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
    validateDiffInvocationEvaluationReceipt(created.receipt)
      .evaluation.runPassed,
    false,
  );
});

test("Diff invocation receipt sets require one complete model configuration", () => {
  const plan = createDiffInvocationEvaluationPlan();
  const receipts = plan.runs.map((specification) => receiptFor(specification));
  const validated = validateDiffInvocationEvaluationReceiptSet(receipts);
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

  const reusedInvocation = structuredClone(receipts);
  reusedInvocation.at(-1).invocation.id = reusedInvocation[0].invocation.id;
  assert.throws(
    () => validateDiffInvocationEvaluationReceiptSet(reusedInvocation),
    /repeats invocation/u,
  );

  const mixedModel = structuredClone(receipts);
  mixedModel.at(-1).configuration.model = "another-model";
  assert.throws(
    () => validateDiffInvocationEvaluationReceiptSet(mixedModel),
    /one host, model, and effort/u,
  );

  assert.throws(
    () => validateDiffInvocationEvaluationReceiptSet(receipts.slice(1)),
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
  const baselineReceipts = baselinePlan.runs.map(receiptFor);
  const followupPlan = createDiffInvocationExampleRemovalPlan();
  const followupReceipts = followupPlan.runs.map(exampleRemovalReceiptFor);
  const followup = validateDiffInvocationExampleRemovalReceiptSet(
    followupReceipts,
  );
  assert.deepEqual(followup.summary, {
    totalRuns: 22,
    passedRuns: 22,
    failedRuns: 0,
  });
  const evidence = validateDiffInvocationExampleRemovalEvidence({
    baselineReceipts,
    followupReceipts,
  });
  assert.deepEqual(evidence.summary, {
    totalRuns: 28,
    passedRuns: 28,
    failedRuns: 0,
    deletionReady: true,
  });
  assert.equal(evidence.decision, "remove-examples");

  const failed = structuredClone(followupReceipts);
  failed[0] = exampleRemovalReceiptFor(followupPlan.runs[0], {
    output: expectedOutput(followupPlan.runs[0].caseId, "answer"),
  });
  const failedEvidence = validateDiffInvocationExampleRemovalEvidence({
    baselineReceipts,
    followupReceipts: failed,
  });
  assert.equal(failedEvidence.summary.failedRuns, 1);
  assert.equal(failedEvidence.summary.deletionReady, false);
  assert.equal(failedEvidence.decision, "keep-examples");

  const mixed = structuredClone(followupReceipts);
  mixed.at(-1).configuration.model = "another-model";
  assert.throws(
    () => validateDiffInvocationExampleRemovalReceiptSet(mixed),
    /one host, model, and effort/u,
  );

  const reusedAcrossSets = structuredClone(followupReceipts);
  reusedAcrossSets[0].invocation.id = baselineReceipts[0].invocation.id;
  assert.throws(
    () => validateDiffInvocationExampleRemovalEvidence({
      baselineReceipts,
      followupReceipts: reusedAcrossSets,
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
  const receipts = plan.runs.map(productionVerificationReceiptFor);
  const result = validateDiffInvocationProductionVerificationReceiptSet(
    receipts,
  );
  assert.deepEqual(result.summary, {
    totalRuns: 8,
    passedRuns: 8,
    failedRuns: 0,
    verificationPassed: true,
  });
  assert.equal(result.decision, "accept-active-brief");

  const failed = structuredClone(receipts);
  failed[5] = productionVerificationReceiptFor(plan.runs[5], {
    output: expectedOutput(plan.runs[5].caseId, "execute"),
  });
  const failedResult = validateDiffInvocationProductionVerificationReceiptSet(
    failed,
  );
  assert.equal(failedResult.summary.failedRuns, 1);
  assert.equal(failedResult.summary.verificationPassed, false);
  assert.equal(failedResult.decision, "do-not-release");
});

test("Diff invocation evaluation file validators use bounded inputs", async () => {
  const plan = createDiffInvocationEvaluationPlan();
  const receipts = plan.runs.map((specification) => receiptFor(specification));
  const one = await validateDiffInvocationEvaluationReceiptFile(
    "receipt.json",
    { readInput: async () => ({ value: receipts[0] }) },
  );
  assert.equal(one.evaluation.runPassed, true);
  const complete = await validateDiffInvocationEvaluationReceiptSetFile(
    "receipts.json",
    { readInput: async () => ({ value: receipts }) },
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
      "invocation-evaluation-receipt",
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
      command: "invocation-evaluation-receipt",
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
    const baselineReceipts = createDiffInvocationEvaluationPlan().runs.map(
      receiptFor,
    );
    const followupPlan = createDiffInvocationExampleRemovalPlan();
    const followupReceipts = followupPlan.runs.map(exampleRemovalReceiptFor);
    const productionPlan = createDiffInvocationProductionVerificationPlan();
    const productionReceipts = productionPlan.runs.map(
      productionVerificationReceiptFor,
    );
    const failedFollowupReceipts = structuredClone(followupReceipts);
    failedFollowupReceipts[0] = exampleRemovalReceiptFor(
      followupPlan.runs[0],
      { output: expectedOutput(followupPlan.runs[0].caseId, "answer") },
    );
    const failedProductionReceipts = structuredClone(productionReceipts);
    failedProductionReceipts[5] = productionVerificationReceiptFor(
      productionPlan.runs[5],
      { output: expectedOutput(productionPlan.runs[5].caseId, "execute") },
    );

    const paths = Object.fromEntries([
      ["output", expectedOutput("invocation-06")],
      ["baseline", baselineReceipts],
      ["followup", followupReceipts],
      ["followupReceipt", followupReceipts[0]],
      ["production", productionReceipts],
      ["productionReceipt", productionReceipts[0]],
      ["failedProduction", failedProductionReceipts],
      ["evidence", { baselineReceipts, followupReceipts }],
      [
        "failedEvidence",
        { baselineReceipts, followupReceipts: failedFollowupReceipts },
      ],
    ].map(([name, value]) => [name, { name, value }]));
    await Promise.all(Object.values(paths).map(async (entry) => {
      entry.path = join(temporary, `${entry.name}.json`);
      await writeFile(entry.path, JSON.stringify(entry.value), { mode: 0o600 });
    }));

    const createdExample = assertEntryParity([
      "invocation-example-removal-receipt",
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
      paths.followupReceipt.path,
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
      "invocation-production-verification-receipt",
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
      paths.productionReceipt.path,
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

test("every Diff entry creates and validates the same evaluation receipt", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-diff-evaluation-"));
  try {
    const outputPath = join(temporary, "output.json");
    await writeFile(
      outputPath,
      JSON.stringify(expectedOutput("invocation-03")),
      { mode: 0o600 },
    );
    const arguments_ = [
      "invocation-evaluation-receipt",
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

    const receiptPath = join(temporary, "receipt.json");
    await writeFile(
      receiptPath,
      JSON.stringify(created.receipt),
      { mode: 0o600 },
    );
    const validated = assertEntryParity([
      "invocation-evaluation-validate",
      "--input",
      receiptPath,
    ]);
    assert.equal(validated.evaluation.runPassed, true);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});
