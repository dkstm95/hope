import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createHopeFeatureSelectionContract,
  createHopeFeatureSelectionEvaluationPlan,
  createHopeFeatureSelectionEvaluationReceipt,
  getHopeFeatureSelectionEvaluationOracle,
  HOPE_FEATURE_SELECTION_CONTRACT_VERSION,
  HOPE_FEATURE_SELECTION_DECISIONS,
  HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
  hopeFeatureSelectionDescriptions,
  prepareHopeFeatureSelectionEvaluationRun,
  validateHopeFeatureSelectionEvaluationOutput,
  validateHopeFeatureSelectionEvaluationReceipt,
  validateHopeFeatureSelectionEvaluationReceiptSet,
} from "../features/model-evaluation/feature-selection.mjs";
import {
  validateHopeFeatureSelectionEvaluationReceiptFile,
  validateHopeFeatureSelectionEvaluationReceiptSetFile,
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

function expectedOutput(caseId, decision) {
  const oracle = getHopeFeatureSelectionEvaluationOracle(caseId);
  return {
    decision: decision ?? oracle.expectedDecision,
    reason: `The request matches ${decision ?? oracle.expectedDecision}.`,
  };
}

function receiptFor(specification, overrides = {}, dependencies = {}) {
  return createHopeFeatureSelectionEvaluationReceipt({
    attestation: overrides.attestation,
    caseId: specification.caseId,
    effort: overrides.effort ?? "test-effort",
    host: overrides.host ?? "codex-test-host",
    invocationId: overrides.invocationId
      ?? `invocation-${specification.caseId}-${specification.variant}-${specification.run}`,
    model: overrides.model ?? "test-model",
    output: overrides.output ?? expectedOutput(specification.caseId),
    run: specification.run,
    variant: specification.variant,
  }, dependencies).receipt;
}

function attestedReceiptFor(specification) {
  const synthetic = receiptFor(specification);
  const statement = {
    configuration: synthetic.configuration,
    evaluation: {
      bindings: synthetic.bindings,
      feature: synthetic.feature,
      version: synthetic.version,
    },
    invocation: synthetic.invocation,
    specification: synthetic.specification,
  };
  return receiptFor(specification, {
    attestation: {
      campaignId: "feature-selection-campaign",
      eventId: synthetic.invocation.id,
      issuedAt: "2026-08-04T00:00:00.000Z",
      issuer: "trusted-test-runner",
      proof: `proof-for-${synthetic.invocation.id}`,
      statementDigest: digestHopeModelEvaluationEvidence(statement),
      version: HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
    },
  }, {
    verifyModelEvaluationAttestation: () => true,
  });
}

test("feature selection covers every decision in 13 unique paired cases", () => {
  const plan = createHopeFeatureSelectionEvaluationPlan();
  assert.equal(plan.contractVersion, 3);
  assert.equal(plan.version, 4);
  assert.equal(HOPE_FEATURE_SELECTION_CONTRACT_VERSION, 3);
  assert.equal(HOPE_FEATURE_SELECTION_EVALUATION_VERSION, 4);
  assert.equal(plan.totalRuns, 26);
  assert.equal(plan.runs.filter((run) => run.variant === "minimal").length, 13);
  assert.equal(plan.runs.filter((run) => run.variant === "full").length, 13);
  assert.equal(plan.runs.every((run) => run.run === 1), true);
  assert.equal(new Set(plan.runs.map((run) => run.caseId)).size, 13);
  const decisions = new Set(plan.runs.map((run) =>
    getHopeFeatureSelectionEvaluationOracle(run.caseId).expectedDecision
  ));
  assert.deepEqual([...decisions].sort(), [...HOPE_FEATURE_SELECTION_DECISIONS].sort());
});

test("published Skills use the evaluated minimal descriptions", async () => {
  const contract = createHopeFeatureSelectionContract({ variant: "minimal" });
  for (const feature of contract.features) {
    const skill = await readFile(
      resolve(root, "plugins", "hope", "skills", feature.id, "SKILL.md"),
      "utf8",
    );
    const description = skill.match(/^description: (.+)$/mu)?.[1];
    assert.equal(
      description,
      hopeFeatureSelectionDescriptions.minimal[feature.id],
    );
  }
});

test("prepared feature-selection runs hide the oracle and bind each variant", () => {
  const minimal = prepareHopeFeatureSelectionEvaluationRun({
    caseId: "selection-03",
    run: 1,
    variant: "minimal",
  });
  const full = prepareHopeFeatureSelectionEvaluationRun({
    caseId: "selection-03",
    run: 1,
    variant: "full",
  });
  assert.equal(Object.hasOwn(minimal, "oracle"), false);
  assert.equal(minimal.brief.variant, "minimal");
  assert.equal(full.brief.variant, "full");
  assert.notEqual(minimal.briefDigest, full.briefDigest);
  assert.notEqual(minimal.inputDigest, full.inputDigest);
  assert.equal(minimal.hostInput.contentIsSynthetic, true);
});

test("feature-selection outputs stay bounded and exact", () => {
  assert.deepEqual(
    validateHopeFeatureSelectionEvaluationOutput({
      decision: "write",
      reason: "The request is a standalone language edit.",
    }),
    {
      decision: "write",
      reason: "The request is a standalone language edit.",
    },
  );
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationOutput({
      decision: "write",
      reason: "valid",
      extra: true,
    }),
    /must contain exactly/u,
  );
  assert.deepEqual(
    validateHopeFeatureSelectionEvaluationOutput({
      decision: "sweep",
      reason: "The request asks for broad approved codebase maintenance.",
    }),
    {
      decision: "sweep",
      reason: "The request asks for broad approved codebase maintenance.",
    },
  );
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationOutput({
      decision: "review",
      reason: "not published",
    }),
    /not published/u,
  );
});

test("feature-selection receipts retain wrong decisions and reject tampering", () => {
  const specification = createHopeFeatureSelectionEvaluationPlan().runs[0];
  const created = createHopeFeatureSelectionEvaluationReceipt({
    caseId: specification.caseId,
    effort: "test-effort",
    host: "codex-test-host",
    invocationId: "wrong-decision",
    model: "test-model",
    output: expectedOutput(specification.caseId, "none"),
    run: specification.run,
    variant: specification.variant,
  });
  assert.equal(created.evaluation.runPassed, false);
  assert.equal(
    validateHopeFeatureSelectionEvaluationReceipt(created.receipt)
      .evaluation.runPassed,
    false,
  );
  const tampered = structuredClone(created.receipt);
  tampered.output.reason = "changed after binding";
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationReceipt(tampered),
    /bindings do not match/u,
  );
});

test("complete feature-selection evidence requires unique runs and one configuration", () => {
  const plan = createHopeFeatureSelectionEvaluationPlan();
  const receipts = plan.runs.map(receiptFor);
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationReceiptSet(receipts),
    /requires host-attested evidence/u,
  );
  const result = validateHopeFeatureSelectionEvaluationReceiptSet(
    receipts,
    { allowSynthetic: true },
  );
  assert.deepEqual(result.summary, {
    candidateMinimal: true,
    failedRuns: 0,
    passedRuns: 26,
    totalRuns: 26,
  });
  assert.equal(result.decision, "candidate-minimal");
  assert.deepEqual(result.byVariant, {
    minimal: { failed: 0, passed: 13, total: 13 },
    full: { failed: 0, passed: 13, total: 13 },
  });

  const failed = structuredClone(receipts);
  failed[0] = receiptFor(plan.runs[0], {
    output: expectedOutput(plan.runs[0].caseId, "none"),
  });
  assert.equal(
    validateHopeFeatureSelectionEvaluationReceiptSet(
      failed,
      { allowSynthetic: true },
    ).decision,
    "keep-full",
  );

  const reusedInvocation = structuredClone(receipts);
  reusedInvocation.at(-1).invocation.id = reusedInvocation[0].invocation.id;
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationReceiptSet(
      reusedInvocation,
      { allowSynthetic: true },
    ),
    /repeats an invocation identity/u,
  );

  const mixedModel = structuredClone(receipts);
  mixedModel.at(-1).configuration.model = "another-model";
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationReceiptSet(
      mixedModel,
      { allowSynthetic: true },
    ),
    /one host, model, and effort/u,
  );

  assert.throws(
    () => validateHopeFeatureSelectionEvaluationReceiptSet(
      receipts.slice(1),
      { allowSynthetic: true },
    ),
    /must contain 26 runs/u,
  );
});

test("host-attested feature-selection evidence also requires the complete ledger", () => {
  const receipts = createHopeFeatureSelectionEvaluationPlan().runs.map(
    attestedReceiptFor,
  );
  assert.throws(
    () => validateHopeFeatureSelectionEvaluationReceiptSet(receipts, {
      verifyModelEvaluationAttestation: () => true,
    }),
    /requires a trusted complete-attempt verifier/u,
  );
  let eventCount = 0;
  const result = validateHopeFeatureSelectionEvaluationReceiptSet(receipts, {
    verifyModelEvaluationAttestation: () => true,
    verifyModelEvaluationSet(manifest) {
      eventCount = manifest.events.length;
      return manifest.plannedRunKeys.length === 26;
    },
  });
  assert.equal(eventCount, 26);
  assert.equal(result.provenance.kind, "host-attested");
  assert.match(result.provenance.manifestDigest, /^sha256:[a-f0-9]{64}$/u);
});

test("feature-selection file validators use bounded JSON inputs", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-feature-selection-"));
  try {
    const receipts = createHopeFeatureSelectionEvaluationPlan().runs.map(receiptFor);
    const receiptPath = join(temporary, "receipt.json");
    const setPath = join(temporary, "receipts.json");
    await Promise.all([
      writeFile(receiptPath, JSON.stringify(receipts[0])),
      writeFile(setPath, JSON.stringify(receipts)),
    ]);
    assert.equal(
      (await validateHopeFeatureSelectionEvaluationReceiptFile(receiptPath))
        .evaluation.runPassed,
      true,
    );
    assert.equal(
      (await validateHopeFeatureSelectionEvaluationReceiptSetFile(
        setPath,
        { allowSynthetic: true },
      ))
        .summary.passedRuns,
      26,
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("the model-evaluation CLI parses and delegates feature selection", async () => {
  assert.deepEqual(
    parseModelEvaluationArguments(["feature-selection-plan"]),
    { command: "feature-selection-plan" },
  );
  assert.deepEqual(
    parseModelEvaluationArguments([
      "feature-selection-prepare",
      "--case",
      "selection-01",
      "--variant",
      "minimal",
      "--run",
      "1",
    ]),
    {
      caseId: "selection-01",
      command: "feature-selection-prepare",
      run: 1,
      variant: "minimal",
    },
  );

  let received;
  let output = "";
  await runModelEvaluationCommand([
    "feature-selection-prepare",
    "--case",
    "selection-02",
    "--variant",
    "full",
    "--run",
    "1",
  ], {
    prepareFeatureSelectionRun(options) {
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
    caseId: "selection-02",
    command: "feature-selection-prepare",
    run: 1,
    variant: "full",
  });
  assert.equal(output, `${JSON.stringify({ prepared: true }, null, 2)}\n`);
});

test("harness and generated plugin expose the same feature-selection plan", () => {
  const harness = spawnSync(
    process.execPath,
    ["harness/hope.mjs", "model-evaluation", "feature-selection-plan"],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "feature-selection-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, 0, harness.stderr);
  assert.equal(plugin.status, 0, plugin.stderr);
  assert.deepEqual(JSON.parse(harness.stdout), JSON.parse(plugin.stdout));
});

test("harness and generated plugin report model-evaluation failures identically", () => {
  const argumentsList = ["model-evaluation", "not-a-command"];
  const harness = spawnSync(
    process.execPath,
    ["harness/hope.mjs", ...argumentsList],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "not-a-command",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, plugin.status);
  assert.equal(harness.stderr, plugin.stderr);
});
