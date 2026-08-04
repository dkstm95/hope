import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createHopeWriteExampleEvaluationPlan,
  createHopeWriteExampleEvaluationReceipt,
  createHopeWriteProductionVerificationPlan,
  createHopeWriteProductionVerificationReceipt,
  getHopeWriteExampleEvaluationOracle,
  prepareHopeWriteExampleEvaluationRun,
  prepareHopeWriteProductionVerificationRun,
  validateHopeWriteExampleEvaluationOutput,
  validateHopeWriteExampleEvaluationReceipt,
  validateHopeWriteExampleEvaluationReceiptSet,
  validateHopeWriteProductionVerificationReceiptSet,
} from "../features/model-evaluation/write-examples.mjs";
import {
  main as runModelEvaluationCommand,
  parseModelEvaluationArguments,
} from "../features/model-evaluation/cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function outputFor(caseId, decision) {
  const selected = decision
    ?? getHopeWriteExampleEvaluationOracle(caseId).expectedDecision;
  return {
    decision: selected,
    reason: `The prepared standard supports ${selected}.`,
  };
}

async function receiptFor(specification, overrides = {}) {
  return (await createHopeWriteExampleEvaluationReceipt({
    caseId: specification.caseId,
    effort: overrides.effort ?? "test-effort",
    host: overrides.host ?? "codex-test-host",
    invocationId: overrides.invocationId
      ?? `invocation-${specification.caseId}-${specification.variant}-${specification.run}`,
    model: overrides.model ?? "test-model",
    output: overrides.output ?? outputFor(specification.caseId),
    run: specification.run,
    variant: specification.variant,
  })).receipt;
}

async function completeReceipts() {
  return Promise.all(createHopeWriteExampleEvaluationPlan().runs.map(receiptFor));
}

test("Write example ablation pairs 24 fresh runs", () => {
  const plan = createHopeWriteExampleEvaluationPlan();
  assert.equal(plan.totalRuns, 24);
  assert.equal(plan.runs.filter((run) => run.variant === "rules-only").length, 12);
  assert.equal(plan.runs.filter((run) => run.variant === "full").length, 12);
  assert.equal(new Set(plan.runs.map((run) => run.caseId)).size, 6);
});

test("rules-only removes only decision examples from the active Write brief", async () => {
  const rulesOnly = await prepareHopeWriteExampleEvaluationRun({
    caseId: "write-example-01",
    run: 1,
    variant: "rules-only",
  });
  const full = await prepareHopeWriteExampleEvaluationRun({
    caseId: "write-example-01",
    run: 1,
    variant: "full",
  });
  assert.equal(Object.hasOwn(rulesOnly.brief, "decisionExamples"), false);
  assert.equal(full.brief.decisionExamples.length, 4);
  assert.equal(rulesOnly.brief.standard, full.brief.standard);
  assert.equal(rulesOnly.brief.response, full.brief.response);
  assert.equal(Object.hasOwn(rulesOnly, "oracle"), false);
  assert.notEqual(rulesOnly.briefDigest, full.briefDigest);
  assert.notEqual(rulesOnly.inputDigest, full.inputDigest);
});

test("Write example outputs are exact and bounded", () => {
  const output = outputFor("write-example-04");
  assert.deepEqual(validateHopeWriteExampleEvaluationOutput(output), output);
  assert.throws(
    () => validateHopeWriteExampleEvaluationOutput({ ...output, extra: true }),
    /must contain exactly/u,
  );
  assert.throws(
    () => validateHopeWriteExampleEvaluationOutput({
      decision: "delete-material-claim",
      reason: "unsafe",
    }),
    /not published/u,
  );
});

test("Write example receipts retain failures and reject tampering", async () => {
  const specification = createHopeWriteExampleEvaluationPlan().runs[0];
  const created = await createHopeWriteExampleEvaluationReceipt({
    caseId: specification.caseId,
    effort: "test-effort",
    host: "codex-test-host",
    invocationId: "wrong-decision",
    model: "test-model",
    output: outputFor(specification.caseId, "keep-current-structure"),
    run: specification.run,
    variant: specification.variant,
  });
  assert.equal(created.evaluation.runPassed, false);
  assert.equal(
    (await validateHopeWriteExampleEvaluationReceipt(created.receipt))
      .evaluation.runPassed,
    false,
  );
  const tampered = structuredClone(created.receipt);
  tampered.output.reason = "changed after binding";
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceipt(tampered),
    /bindings do not match/u,
  );
});

test("complete Write example evidence requires every run and one configuration", async () => {
  const receipts = await completeReceipts();
  const result = await validateHopeWriteExampleEvaluationReceiptSet(receipts);
  assert.deepEqual(result.summary, {
    deletionReady: true,
    failedRuns: 0,
    passedRuns: 24,
    totalRuns: 24,
  });
  assert.equal(result.decision, "remove-examples");
  assert.deepEqual(result.byVariant, {
    "rules-only": { failed: 0, passed: 12, total: 12 },
    full: { failed: 0, passed: 12, total: 12 },
  });

  const repeated = structuredClone(receipts);
  repeated.at(-1).invocation.id = repeated[0].invocation.id;
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(repeated),
    /repeats an invocation identity/u,
  );

  const mixed = structuredClone(receipts);
  mixed.at(-1).configuration.model = "another-model";
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(mixed),
    /one host, model, and effort/u,
  );

  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(receipts.slice(1)),
    /must contain 24 runs/u,
  );
});

test("one failed Write example run keeps the examples", async () => {
  const plan = createHopeWriteExampleEvaluationPlan();
  const receipts = await completeReceipts();
  receipts[0] = await receiptFor(plan.runs[0], {
    output: outputFor(plan.runs[0].caseId, "keep-current-structure"),
  });
  const result = await validateHopeWriteExampleEvaluationReceiptSet(receipts);
  assert.equal(result.summary.deletionReady, false);
  assert.equal(result.decision, "keep-examples");
});

test("the model-evaluation CLI parses and delegates Write example preparation", async () => {
  assert.deepEqual(
    parseModelEvaluationArguments(["write-example-plan"]),
    { command: "write-example-plan" },
  );
  assert.deepEqual(
    parseModelEvaluationArguments([
      "write-example-prepare",
      "--case",
      "write-example-03",
      "--variant",
      "rules-only",
      "--run",
      "2",
    ]),
    {
      caseId: "write-example-03",
      command: "write-example-prepare",
      run: 2,
      variant: "rules-only",
    },
  );

  let received;
  let output = "";
  await runModelEvaluationCommand([
    "write-example-prepare",
    "--case",
    "write-example-03",
    "--variant",
    "rules-only",
    "--run",
    "2",
  ], {
    async prepareWriteExampleRun(options) {
      received = options;
      return { prepared: true };
    },
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.equal(received.command, "write-example-prepare");
  assert.equal(output, `${JSON.stringify({ prepared: true }, null, 2)}\n`);
});

test("harness and generated plugin expose the same Write example plan", () => {
  const harness = spawnSync(
    process.execPath,
    ["harness/hope.mjs", "model-evaluation", "write-example-plan"],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "write-example-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, 0, harness.stderr);
  assert.equal(plugin.status, 0, plugin.stderr);
  assert.deepEqual(JSON.parse(harness.stdout), JSON.parse(plugin.stdout));
});

test("Write production verification uses the exact active brief in six runs", async () => {
  const plan = createHopeWriteProductionVerificationPlan();
  assert.equal(plan.totalRuns, 6);
  const prepared = await prepareHopeWriteProductionVerificationRun({
    caseId: "write-example-01",
    run: 1,
  });
  assert.equal(prepared.variant, "production");
  assert.equal(Object.hasOwn(prepared.brief, "decisionExamples"), false);
  assert.equal(prepared.brief.version, 3);
  assert.equal(Object.hasOwn(prepared, "oracle"), false);
});

test("complete Write production evidence accepts only six passing fresh runs", async () => {
  const plan = createHopeWriteProductionVerificationPlan();
  const receipts = await Promise.all(plan.runs.map(async (specification) =>
    (await createHopeWriteProductionVerificationReceipt({
      caseId: specification.caseId,
      effort: "test-effort",
      host: "codex-test-host",
      invocationId: `production-${specification.caseId}`,
      model: "test-model",
      output: outputFor(specification.caseId),
      run: specification.run,
    })).receipt
  ));
  const result = await validateHopeWriteProductionVerificationReceiptSet(
    receipts,
  );
  assert.deepEqual(result.summary, {
    accepted: true,
    failedRuns: 0,
    passedRuns: 6,
    totalRuns: 6,
  });
  assert.equal(result.decision, "accept-production");

  const reused = structuredClone(receipts);
  reused.at(-1).invocation.id = reused[0].invocation.id;
  await assert.rejects(
    validateHopeWriteProductionVerificationReceiptSet(reused),
    /repeats an invocation identity/u,
  );
});

test("harness and generated plugin expose the same Write production plan", () => {
  const harness = spawnSync(
    process.execPath,
    ["harness/hope.mjs", "model-evaluation", "write-production-plan"],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "write-production-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, 0, harness.stderr);
  assert.equal(plugin.status, 0, plugin.stderr);
  assert.deepEqual(JSON.parse(harness.stdout), JSON.parse(plugin.stdout));
});
