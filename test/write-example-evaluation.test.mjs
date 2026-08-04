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
  hopeWriteExampleEvaluationCases,
  hopeWriteProductionVerificationCases,
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
import {
  digestHopeModelEvaluationEvidence,
  HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
} from "../features/model-evaluation/evidence.mjs";
import { createWritingBrief } from "../features/write/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function outputFor(caseId, decision) {
  const selected = decision
    ?? getHopeWriteExampleEvaluationOracle(caseId).expectedDecision;
  return {
    decision: selected,
    reason: `The prepared standard supports ${selected}.`,
  };
}

function productionOutputFor(caseId, decision) {
  const evaluationCase = hopeWriteProductionVerificationCases.find(
    (candidate) => candidate.id === caseId,
  );
  assert.ok(evaluationCase, `Unknown production case ${caseId}`);
  const selected = decision ?? evaluationCase.oracle.expectedDecision;
  return {
    decision: selected,
    reason: `The active brief supports ${selected}.`,
  };
}

function attestationFor(receipt, {
  campaignId,
  issuer = "trusted-test-runner",
} = {}) {
  const statement = {
    configuration: receipt.configuration,
    evaluation: {
      bindings: receipt.bindings,
      feature: receipt.feature,
      version: receipt.version,
    },
    invocation: receipt.invocation,
    specification: receipt.specification,
  };
  return {
    campaignId,
    eventId: receipt.invocation.id,
    issuedAt: "2026-08-04T00:00:00.000Z",
    issuer,
    proof: `proof-for-${receipt.invocation.id}`,
    statementDigest: digestHopeModelEvaluationEvidence(statement),
    version: HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
  };
}

async function receiptFor(specification, overrides = {}, dependencies = {}) {
  return (await createHopeWriteExampleEvaluationReceipt({
    attestation: overrides.attestation,
    caseId: specification.caseId,
    effort: overrides.effort ?? "test-effort",
    host: overrides.host ?? "codex-test-host",
    invocationId: overrides.invocationId
      ?? `invocation-${specification.caseId}-${specification.variant}-${specification.run}`,
    model: overrides.model ?? "test-model",
    output: overrides.output ?? outputFor(specification.caseId),
    run: specification.run,
    variant: specification.variant,
  }, dependencies)).receipt;
}

async function completeReceipts() {
  return Promise.all(createHopeWriteExampleEvaluationPlan().runs.map(receiptFor));
}

async function attestedReceiptFor(specification, attestationOptions = {}) {
  const synthetic = await receiptFor(specification);
  return await receiptFor(specification, {
    attestation: attestationFor(synthetic, {
      campaignId: "write-example-campaign",
      ...attestationOptions,
    }),
  }, {
    verifyModelEvaluationAttestation: () => true,
  });
}

async function productionReceiptFor(specification, {
  attestationOptions,
  attested = false,
} = {}) {
  const options = {
    caseId: specification.caseId,
    effort: "test-effort",
    host: "codex-test-host",
    invocationId: `production-${specification.caseId}`,
    model: "test-model",
    output: productionOutputFor(specification.caseId),
    run: specification.run,
  };
  const synthetic = (await createHopeWriteProductionVerificationReceipt(
    options,
  )).receipt;
  if (!attested) return synthetic;
  return (await createHopeWriteProductionVerificationReceipt({
    ...options,
    attestation: attestationFor(synthetic, {
      campaignId: "write-production-campaign",
      ...attestationOptions,
    }),
  }, {
    verifyModelEvaluationAttestation: () => true,
  })).receipt;
}

test("Write example ablation pairs 32 fresh runs", () => {
  const plan = createHopeWriteExampleEvaluationPlan();
  assert.equal(plan.totalRuns, 32);
  assert.equal(plan.runs.filter((run) => run.variant === "rules-only").length, 16);
  assert.equal(plan.runs.filter((run) => run.variant === "full").length, 16);
  assert.equal(new Set(plan.runs.map((run) => run.caseId)).size, 8);
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
  assert.equal(full.brief.decisionExamples.length, 5);
  assert.equal(rulesOnly.brief.standard, full.brief.standard);
  assert.equal(rulesOnly.brief.response, full.brief.response);
  assert.equal(Object.hasOwn(rulesOnly, "oracle"), false);
  assert.equal(Object.hasOwn(rulesOnly.hostInput, "candidateAction"), false);
  assert.deepEqual(
    Object.keys(rulesOnly.hostInput).sort(),
    ["artifact", "constraints", "contentIsSynthetic", "request"],
  );
  assert.deepEqual(full.brief, await createWritingBrief({ mode: "edit" }));
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

test("plain-language ablation stays neutral and includes a precision control", () => {
  const rewrite = hopeWriteExampleEvaluationCases.find(
    (evaluationCase) => evaluationCase.id === "write-example-07",
  );
  const precision = hopeWriteExampleEvaluationCases.find(
    (evaluationCase) => evaluationCase.id === "write-example-08",
  );
  assert.ok(rewrite);
  assert.ok(precision);
  assert.doesNotMatch(
    rewrite.input.request,
    /한 번|쉽|어렵|다시 읽|one pass|reread|simpl/u,
  );
  assert.equal(rewrite.oracle.expectedDecision, "simplify-hard-sentence");
  assert.equal(precision.oracle.expectedDecision, "keep-current-structure");
  assert.match(precision.input.constraints.join(" "), /그대로 유지/u);
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
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(receipts),
    /requires host-attested evidence/u,
  );
  const result = await validateHopeWriteExampleEvaluationReceiptSet(
    receipts,
    { allowSynthetic: true },
  );
  assert.deepEqual(result.summary, {
    deletionReady: true,
    failedRuns: 0,
    passedRuns: 32,
    totalRuns: 32,
  });
  assert.equal(result.decision, "remove-examples");
  assert.deepEqual(result.byVariant, {
    "rules-only": { failed: 0, passed: 16, total: 16 },
    full: { failed: 0, passed: 16, total: 16 },
  });

  const repeated = structuredClone(receipts);
  repeated.at(-1).invocation.id = repeated[0].invocation.id;
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(
      repeated,
      { allowSynthetic: true },
    ),
    /repeats an invocation identity/u,
  );

  const mixed = structuredClone(receipts);
  mixed.at(-1).configuration.model = "another-model";
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(
      mixed,
      { allowSynthetic: true },
    ),
    /one host, model, and effort/u,
  );

  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(
      receipts.slice(1),
      { allowSynthetic: true },
    ),
    /must contain 32 runs/u,
  );
});

test("one failed Write example run keeps the examples", async () => {
  const plan = createHopeWriteExampleEvaluationPlan();
  const receipts = await completeReceipts();
  receipts[0] = await receiptFor(plan.runs[0], {
    output: outputFor(plan.runs[0].caseId, "keep-current-structure"),
  });
  const result = await validateHopeWriteExampleEvaluationReceiptSet(
    receipts,
    { allowSynthetic: true },
  );
  assert.equal(result.summary.deletionReady, false);
  assert.equal(result.decision, "keep-examples");
});

test("Write ablation trusted evidence rejects mixed campaigns", async () => {
  const plan = createHopeWriteExampleEvaluationPlan();
  const receipts = await Promise.all(plan.runs.map((specification) =>
    attestedReceiptFor(specification)
  ));
  const result = await validateHopeWriteExampleEvaluationReceiptSet(receipts, {
    verifyModelEvaluationAttestation: () => true,
    verifyModelEvaluationSet: (manifest) => manifest.events.length === 32,
  });
  assert.equal(result.provenance.kind, "host-attested");

  const mixedCampaign = [...receipts];
  mixedCampaign[mixedCampaign.length - 1] = await attestedReceiptFor(
    plan.runs.at(-1),
    { campaignId: "another-write-campaign" },
  );
  await assert.rejects(
    validateHopeWriteExampleEvaluationReceiptSet(mixedCampaign, {
      verifyModelEvaluationAttestation: () => true,
      verifyModelEvaluationSet: () => true,
    }),
    /one trusted runner campaign/u,
  );
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

test("Write production verification uses the exact active brief in seven runs", async () => {
  const plan = createHopeWriteProductionVerificationPlan();
  assert.equal(plan.totalRuns, 7);
  const prepared = await prepareHopeWriteProductionVerificationRun({
    caseId: "write-production-01",
    run: 1,
  });
  assert.equal(prepared.variant, "production");
  const activeBrief = await createWritingBrief({ mode: "edit" });
  assert.deepEqual(prepared.brief, activeBrief);
  assert.equal(Object.hasOwn(prepared, "oracle"), false);
  assert.equal(Object.hasOwn(prepared.hostInput, "candidateAction"), false);

  await assert.rejects(
    prepareHopeWriteProductionVerificationRun({
      caseId: "write-production-01",
      run: 1,
    }, {
      createBrief: async () => ({
        ...activeBrief,
        response: `${activeBrief.response} Return a heading first.`,
      }),
    }),
    /must match the complete canonical active Write brief/u,
  );
});

test("Write production cases use structures distinct from their ablation counterparts", () => {
  const productionById = new Map(hopeWriteProductionVerificationCases.map(
    (evaluationCase) => [evaluationCase.id, evaluationCase],
  ));
  assert.deepEqual(
    Object.keys(productionById.get("write-production-01").input.artifact).sort(),
    ["format", "text"],
  );
  assert.deepEqual(
    Object.keys(productionById.get("write-production-05").input.artifact).sort(),
    ["body", "buttonLabel", "format", "title"],
  );
  assert.deepEqual(
    Object.keys(productionById.get("write-production-06").input.artifact).sort(),
    ["columns", "format", "rows"],
  );
  assert.deepEqual(
    Object.keys(productionById.get("write-production-07").input.artifact).sort(),
    ["audience", "body", "placement"],
  );
  assert.match(
    productionById.get("write-production-01").input.constraints.join(" "),
    /first two sentences form one recovery update/u,
  );
  assert.match(
    productionById.get("write-production-05").input.constraints.join(" "),
    /separate semantic fields/u,
  );
  assert.match(
    productionById.get("write-production-06").input.constraints.join(" "),
    /mutually exclusive outcomes/u,
  );
  assert.match(
    productionById.get("write-production-07").input.constraints.join(" "),
    /같은 요청에 같은 키를 보내면 중복 결제를 막는다는 동작/u,
  );
});

test("complete Write production evidence accepts only seven passing fresh runs", async () => {
  const plan = createHopeWriteProductionVerificationPlan();
  const receipts = await Promise.all(plan.runs.map((specification) =>
    productionReceiptFor(specification)
  ));
  await assert.rejects(
    validateHopeWriteProductionVerificationReceiptSet(receipts),
    /requires host-attested evidence/u,
  );
  const result = await validateHopeWriteProductionVerificationReceiptSet(
    receipts,
    { allowSynthetic: true },
  );
  assert.deepEqual(result.summary, {
    accepted: true,
    failedRuns: 0,
    passedRuns: 7,
    totalRuns: 7,
  });
  assert.equal(result.decision, "accept-production");

  const reused = structuredClone(receipts);
  reused.at(-1).invocation.id = reused[0].invocation.id;
  await assert.rejects(
    validateHopeWriteProductionVerificationReceiptSet(
      reused,
      { allowSynthetic: true },
    ),
    /repeats an invocation identity/u,
  );
});

test("Write production trusted evidence fails a rejected attempt ledger", async () => {
  const receipts = await Promise.all(
    createHopeWriteProductionVerificationPlan().runs.map((specification) =>
      productionReceiptFor(specification, { attested: true })
    ),
  );
  await assert.rejects(
    validateHopeWriteProductionVerificationReceiptSet(receipts, {
      verifyModelEvaluationAttestation: () => true,
      verifyModelEvaluationSet: () => false,
    }),
    /did not verify the complete attempt history/u,
  );
  const result = await validateHopeWriteProductionVerificationReceiptSet(
    receipts,
    {
      verifyModelEvaluationAttestation: () => true,
      verifyModelEvaluationSet: (manifest) => manifest.events.length === 7,
    },
  );
  assert.equal(result.provenance.kind, "host-attested");
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
