import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createPolishBrief } from "../features/polish/index.mjs";
import {
  createHopePolishPreservationContract,
  createHopePolishPreservationEvaluationPlan,
  createHopePolishPreservationEvaluationReceipt,
  getHopePolishPreservationEvaluationOracle,
  HOPE_POLISH_PRESERVATION_DECISIONS,
  HOPE_POLISH_PRESERVATION_VARIANTS,
  prepareHopePolishPreservationEvaluationRun,
  validateHopePolishPreservationEvaluationOutput,
  validateHopePolishPreservationEvaluationReceipt,
  validateHopePolishPreservationEvaluationReceiptSet,
} from "../features/model-evaluation/polish-preservation.mjs";
import {
  validateHopePolishPreservationEvaluationReceiptFile,
  validateHopePolishPreservationEvaluationReceiptSetFile,
} from "../features/model-evaluation/index.mjs";
import {
  digestHopeModelEvaluationEvidence,
  HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
} from "../features/model-evaluation/evidence.mjs";
import {
  main as runModelEvaluationCommand,
  parseModelEvaluationArguments,
} from "../features/model-evaluation/cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function expectedOutput(caseId, overrides = {}) {
  const oracle = getHopePolishPreservationEvaluationOracle(caseId);
  return {
    candidateId: overrides.candidateId ?? oracle.expectedCandidateId,
    decision: overrides.decision ?? oracle.expectedDecision,
    reason: overrides.reason ?? `The evidence supports ${overrides.decision ?? oracle.expectedDecision}.`,
  };
}

function attestationFor(receipt, {
  campaignId = "polish-preservation-campaign",
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
  return (await createHopePolishPreservationEvaluationReceipt({
    attestation: overrides.attestation,
    caseId: specification.caseId,
    effort: overrides.effort ?? "test-effort",
    host: overrides.host ?? "codex-test-host",
    invocationId: overrides.invocationId
      ?? `invocation-${specification.caseId}-${specification.variant}`,
    model: overrides.model ?? "test-model",
    output: overrides.output ?? expectedOutput(specification.caseId),
    run: specification.run,
    variant: specification.variant,
  }, dependencies)).receipt;
}

async function attestedReceiptFor(specification, attestationOptions) {
  const synthetic = await receiptFor(specification);
  return await receiptFor(specification, {
    attestation: attestationFor(synthetic, attestationOptions),
  }, {
    verifyModelEvaluationAttestation: () => true,
  });
}

test("Polish preservation evaluates 12 distinct cases under both variants", () => {
  const plan = createHopePolishPreservationEvaluationPlan();
  assert.equal(plan.totalRuns, 24);
  assert.equal(plan.runs.filter(
    (run) => run.variant === "invariants-only"
  ).length, 12);
  assert.equal(plan.runs.filter((run) => run.variant === "full").length, 12);
  assert.equal(new Set(plan.runs.map((run) => run.caseId)).size, 12);
  assert.deepEqual(
    [...new Set(plan.runs.map((run) =>
      getHopePolishPreservationEvaluationOracle(run.caseId).expectedDecision
    ))].sort(),
    [...HOPE_POLISH_PRESERVATION_DECISIONS].sort(),
  );
  assert.deepEqual(
    [...new Set(plan.runs.map((run) => run.variant))],
    [...HOPE_POLISH_PRESERVATION_VARIANTS],
  );
});

test("Polish preservation variants retain the active product invariants", async () => {
  const [active, minimum, full] = await Promise.all([
    createPolishBrief({ risk: "medium" }),
    createHopePolishPreservationContract({ variant: "invariants-only" }),
    createHopePolishPreservationContract({ variant: "full" }),
  ]);
  assert.deepEqual(minimum.invariants, full.invariants);
  assert.deepEqual(minimum.guidance, []);
  assert.equal(full.guidance.length, 7);
  const activeRules = new Set([
    ...active.contract,
    ...active.planning,
    ...active.editing,
    ...active.stopping,
    ...active.verification,
  ]);
  for (const rule of [...full.invariants, ...full.guidance]) {
    assert.equal(activeRules.has(rule), true, rule);
  }
  assert.match(minimum.invariants.join("\n"), /observable behavior/u);
  assert.match(minimum.invariants.join("\n"), /public contract/u);
  assert.match(minimum.invariants.join("\n"), /uncertainty/u);
  assert.match(minimum.invariants.join("\n"), /needs-alignment/u);
});

test("prepared Polish preservation runs hide the oracle and bind one variant", async () => {
  const minimum = await prepareHopePolishPreservationEvaluationRun({
    caseId: "polish-preservation-09",
    run: 1,
    variant: "invariants-only",
  });
  const full = await prepareHopePolishPreservationEvaluationRun({
    caseId: "polish-preservation-09",
    run: 1,
    variant: "full",
  });
  assert.equal(Object.hasOwn(minimum, "oracle"), false);
  assert.equal(Object.hasOwn(minimum.hostInput, "oracle"), false);
  assert.equal(minimum.brief.variant, "invariants-only");
  assert.equal(full.brief.variant, "full");
  assert.notEqual(minimum.briefDigest, full.briefDigest);
  assert.notEqual(minimum.inputDigest, full.inputDigest);
  assert.equal(minimum.hostInput.contentIsSynthetic, true);
});

test("Polish preservation output is exact and decision-bound", () => {
  assert.deepEqual(
    validateHopePolishPreservationEvaluationOutput({
      candidateId: "candidate-a",
      decision: "apply-candidate",
      reason: "The evidence supports every preservation condition.",
    }),
    {
      candidateId: "candidate-a",
      decision: "apply-candidate",
      reason: "The evidence supports every preservation condition.",
    },
  );
  assert.deepEqual(
    validateHopePolishPreservationEvaluationOutput({
      candidateId: null,
      decision: "keep-current",
      reason: "The available evidence does not support removal.",
    }),
    {
      candidateId: null,
      decision: "keep-current",
      reason: "The available evidence does not support removal.",
    },
  );
  assert.throws(
    () => validateHopePolishPreservationEvaluationOutput({
      candidateId: "candidate-a",
      decision: "keep-current",
      reason: "invalid candidate binding",
    }),
    /must be null/u,
  );
  assert.throws(
    () => validateHopePolishPreservationEvaluationOutput({
      candidateId: null,
      decision: "apply-candidate",
      reason: "missing candidate",
    }),
    /candidateId must be text/u,
  );
});

test("Polish preservation receipts retain wrong judgments and reject tampering", async () => {
  const created = await createHopePolishPreservationEvaluationReceipt({
    caseId: "polish-preservation-01",
    effort: "test-effort",
    host: "codex-test-host",
    invocationId: "wrong-preservation-judgment",
    model: "test-model",
    output: {
      candidateId: "candidate-b",
      decision: "apply-candidate",
      reason: "The larger cap looks cleaner.",
    },
    run: 1,
    variant: "invariants-only",
  });
  assert.equal(created.evaluation.decisionMatched, true);
  assert.equal(created.evaluation.candidateMatched, false);
  assert.equal(created.evaluation.runPassed, false);
  assert.equal(
    (await validateHopePolishPreservationEvaluationReceipt(created.receipt))
      .evaluation.runPassed,
    false,
  );
  const tampered = structuredClone(created.receipt);
  tampered.output.reason = "changed after binding";
  await assert.rejects(
    async () => await validateHopePolishPreservationEvaluationReceipt(tampered),
    /bindings do not match/u,
  );
});

test("complete Polish preservation evidence requires unique runs and one configuration", async () => {
  const plan = createHopePolishPreservationEvaluationPlan();
  const receipts = await Promise.all(plan.runs.map(receiptFor));
  await assert.rejects(
    validateHopePolishPreservationEvaluationReceiptSet(receipts),
    /requires host-attested evidence/u,
  );
  const result = await validateHopePolishPreservationEvaluationReceiptSet(
    receipts,
    { allowSynthetic: true },
  );
  assert.deepEqual(result.summary, {
    candidateInvariantsOnly: true,
    failedRuns: 0,
    passedRuns: 24,
    totalRuns: 24,
  });
  assert.equal(result.decision, "candidate-invariants-only");
  assert.deepEqual(result.byVariant, {
    "invariants-only": { failed: 0, passed: 12, total: 12 },
    full: { failed: 0, passed: 12, total: 12 },
  });

  const failed = structuredClone(receipts);
  failed[0] = await receiptFor(plan.runs[0], {
    output: {
      candidateId: "candidate-b",
      decision: "apply-candidate",
      reason: "Wrong candidate retained as failed evidence.",
    },
  });
  assert.equal(
    (await validateHopePolishPreservationEvaluationReceiptSet(
      failed,
      { allowSynthetic: true },
    )).decision,
    "keep-full",
  );

  const reusedInvocation = structuredClone(receipts);
  reusedInvocation.at(-1).invocation.id = reusedInvocation[0].invocation.id;
  await assert.rejects(
    async () => await validateHopePolishPreservationEvaluationReceiptSet(
      reusedInvocation,
      { allowSynthetic: true },
    ),
    /repeats an invocation identity/u,
  );

  const mixedModel = structuredClone(receipts);
  mixedModel.at(-1).configuration.model = "another-model";
  await assert.rejects(
    async () => await validateHopePolishPreservationEvaluationReceiptSet(
      mixedModel,
      { allowSynthetic: true },
    ),
    /one host, model, effort, and contract version/u,
  );
});

test("Polish trusted evidence validates one campaign and issuer end to end", async () => {
  const plan = createHopePolishPreservationEvaluationPlan();
  const receipts = await Promise.all(plan.runs.map((specification) =>
    attestedReceiptFor(specification)
  ));
  const result = await validateHopePolishPreservationEvaluationReceiptSet(
    receipts,
    {
      verifyModelEvaluationAttestation: () => true,
      verifyModelEvaluationSet: (manifest) => manifest.events.length === 24,
    },
  );
  assert.equal(result.provenance.kind, "host-attested");

  const mixedIssuer = [...receipts];
  mixedIssuer[mixedIssuer.length - 1] = await attestedReceiptFor(
    plan.runs.at(-1),
    { issuer: "another-trusted-runner" },
  );
  await assert.rejects(
    validateHopePolishPreservationEvaluationReceiptSet(mixedIssuer, {
      verifyModelEvaluationAttestation: () => true,
      verifyModelEvaluationSet: () => true,
    }),
    /one trusted attestation issuer/u,
  );
});

test("Polish preservation file validators use bounded JSON inputs", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-polish-preservation-"));
  try {
    const receipts = await Promise.all(
      createHopePolishPreservationEvaluationPlan().runs.map(receiptFor),
    );
    const receiptPath = join(temporary, "receipt.json");
    const setPath = join(temporary, "receipts.json");
    await Promise.all([
      writeFile(receiptPath, JSON.stringify(receipts[0])),
      writeFile(setPath, JSON.stringify(receipts)),
    ]);
    assert.equal(
      (await validateHopePolishPreservationEvaluationReceiptFile(receiptPath))
        .evaluation.runPassed,
      true,
    );
    assert.equal(
      (await validateHopePolishPreservationEvaluationReceiptSetFile(
        setPath,
        { allowSynthetic: true },
      ))
        .summary.passedRuns,
      24,
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("the model-evaluation CLI parses and delegates Polish preservation", async () => {
  assert.deepEqual(
    parseModelEvaluationArguments(["polish-preservation-plan"]),
    { command: "polish-preservation-plan" },
  );
  assert.deepEqual(
    parseModelEvaluationArguments([
      "polish-preservation-prepare",
      "--case",
      "polish-preservation-01",
      "--variant",
      "invariants-only",
      "--run",
      "1",
    ]),
    {
      caseId: "polish-preservation-01",
      command: "polish-preservation-prepare",
      run: 1,
      variant: "invariants-only",
    },
  );

  let received;
  let output = "";
  await runModelEvaluationCommand([
    "polish-preservation-prepare",
    "--case",
    "polish-preservation-02",
    "--variant",
    "full",
    "--run",
    "1",
  ], {
    preparePolishPreservationRun(options) {
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
    caseId: "polish-preservation-02",
    command: "polish-preservation-prepare",
    run: 1,
    variant: "full",
  });
  assert.equal(output, `${JSON.stringify({ prepared: true }, null, 2)}\n`);
});

test("harness and generated plugin expose the same Polish preservation plan", () => {
  const harness = spawnSync(
    process.execPath,
    ["harness/hope.mjs", "model-evaluation", "polish-preservation-plan"],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "polish-preservation-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, 0, harness.stderr);
  assert.equal(plugin.status, 0, plugin.stderr);
  assert.deepEqual(JSON.parse(harness.stdout), JSON.parse(plugin.stdout));
});
