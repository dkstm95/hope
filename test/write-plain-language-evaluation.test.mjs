import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createHopeWritePlainLanguageEvaluationPlan,
  createHopeWritePlainLanguageEvaluationReceipt,
  getHopeWritePlainLanguageEvaluationOracle,
  prepareHopeWritePlainLanguageAssessment,
  prepareHopeWritePlainLanguageEvaluationRun,
  validateHopeWritePlainLanguageAssessment,
  validateHopeWritePlainLanguageEvaluationReceipt,
  validateHopeWritePlainLanguageEvaluationReceiptSet,
  validateHopeWritePlainLanguageOutput,
} from "../features/model-evaluation/write-plain-language.mjs";
import {
  main as runModelEvaluationCommand,
  parseModelEvaluationArguments,
} from "../features/model-evaluation/cli.mjs";
import {
  digestHopeModelEvaluationEvidence,
  HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
} from "../features/model-evaluation/evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const revisions = Object.freeze({
  "write-plain-language-01":
    "먼저 계정 소유자 확인을 완료하세요. 확인이 끝나면 데이터 이전을 다시 시도하세요.",
  "write-plain-language-02":
    "결제 생성 요청에는 멱등성 키를 사용할 수 있습니다. 같은 요청에 같은 멱등성 키를 보내면 중복 결제를 막을 수 있습니다.",
  "write-plain-language-03":
    "Finance approves the export. Support then delivers it to the workspace owner, who can archive it after delivery.",
  "write-plain-language-04":
    "날씨에 따라 다음 날 배송이 지연될 수 있습니다. 냉장 상품은 품질을 유지하기 위해 배송이 지연되면 주문이 취소될 수 있습니다.",
});

function outputFor(caseId) {
  return { revision: revisions[caseId] };
}

function assessmentFor(caseId, { failedCriterion } = {}) {
  const oracle = getHopeWritePlainLanguageEvaluationOracle(caseId);
  const assertions = oracle.assertions.map(({ id }) => ({
    evidence: `${id} is present in the revision.`,
    id,
    passed: true,
  }));
  const criteria = oracle.criteria.map(({ id }) => ({
    evidence: `${id} is satisfied by the revision.`,
    id,
    passed: id !== failedCriterion,
  }));
  return {
    assertions,
    criteria,
    overallPassed: [...assertions, ...criteria].every((entry) => entry.passed),
  };
}

function receiptOptions(specification, overrides = {}) {
  return {
    assessment: overrides.assessment ?? assessmentFor(specification.caseId),
    caseId: specification.caseId,
    evaluatorAttestation: overrides.evaluatorAttestation,
    evaluatorEffort: "review-effort",
    evaluatorHost: "independent-review-host",
    evaluatorInvocationId: `evaluator-${specification.caseId}`,
    evaluatorModel: "review-model",
    output: overrides.output ?? outputFor(specification.caseId),
    run: specification.run,
    writerAttestation: overrides.writerAttestation,
    writerEffort: "write-effort",
    writerHost: "writer-host",
    writerInvocationId: `writer-${specification.caseId}`,
    writerModel: "write-model",
  };
}

async function receiptFor(specification, overrides = {}, dependencies = {}) {
  return (await createHopeWritePlainLanguageEvaluationReceipt(
    receiptOptions(specification, overrides),
    dependencies,
  )).receipt;
}

function actorAttestation(receipt, actor, campaignId) {
  const writer = actor === "writer";
  const bindings = writer
    ? {
      briefDigest: receipt.bindings.briefDigest,
      inputDigest: receipt.bindings.inputDigest,
      outputDigest: receipt.bindings.outputDigest,
    }
    : {
      assessmentDigest: receipt.bindings.assessmentDigest,
      assessmentInputDigest: receipt.bindings.assessmentInputDigest,
      outputDigest: receipt.bindings.outputDigest,
      rubricDigest: receipt.bindings.rubricDigest,
    };
  const selected = receipt[actor];
  const statement = {
    configuration: selected.configuration,
    evaluation: {
      bindings,
      feature: writer
        ? "hope-write-plain-language-writer"
        : "hope-write-plain-language-evaluator",
      version: receipt.version,
    },
    invocation: selected.invocation,
    specification: receipt.specification,
  };
  return {
    campaignId,
    eventId: selected.invocation.id,
    issuedAt: "2026-08-04T00:00:00.000Z",
    issuer: "trusted-test-runner",
    proof: `proof-for-${selected.invocation.id}`,
    statementDigest: digestHopeModelEvaluationEvidence(statement),
    version: HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
  };
}

async function attestedReceiptFor(specification) {
  const synthetic = await receiptFor(specification);
  return await receiptFor(specification, {
    evaluatorAttestation: actorAttestation(
      synthetic,
      "evaluator",
      "write-plain-language-evaluator-campaign",
    ),
    writerAttestation: actorAttestation(
      synthetic,
      "writer",
      "write-plain-language-writer-campaign",
    ),
  }, {
    verifyModelEvaluationAttestation: () => true,
  });
}

test("plain-language evaluation binds four structurally varied generated-prose runs", async () => {
  const plan = createHopeWritePlainLanguageEvaluationPlan();
  assert.equal(plan.totalRuns, 4);
  assert.equal(new Set(plan.runs.map((run) => run.caseId)).size, 4);

  const prepared = await prepareHopeWritePlainLanguageEvaluationRun(
    plan.runs[0],
  );
  assert.equal(Object.hasOwn(prepared, "oracle"), false);
  assert.equal(Object.hasOwn(prepared.hostInput, "assertions"), false);
  assert.deepEqual(Object.keys(prepared.outputContract.fields), ["revision"]);

  const assessment = prepareHopeWritePlainLanguageAssessment({
    ...plan.runs[0],
    output: outputFor(plan.runs[0].caseId),
  });
  assert.equal(Object.hasOwn(assessment.evaluatorInput, "writer"), false);
  assert.equal(Object.hasOwn(assessment.evaluatorInput, "decision"), false);
  assert.equal(assessment.evaluatorInput.assertions.length, 2);
  assert.equal(assessment.evaluatorInput.criteria.length, 3);
});

test("plain-language output and assessment contracts reject unsupported fields and pass mismatches", () => {
  const output = outputFor("write-plain-language-01");
  assert.deepEqual(validateHopeWritePlainLanguageOutput(output), output);
  assert.throws(
    () => validateHopeWritePlainLanguageOutput({ ...output, reason: "extra" }),
    /must contain exactly revision/u,
  );
  const assessment = assessmentFor("write-plain-language-01");
  assert.deepEqual(
    validateHopeWritePlainLanguageAssessment(
      assessment,
      "write-plain-language-01",
    ),
    assessment,
  );
  assert.throws(
    () => validateHopeWritePlainLanguageAssessment(
      { ...assessment, overallPassed: false },
      "write-plain-language-01",
    ),
    /must equal all assertion and criterion results/u,
  );
});

test("plain-language receipts bind revisions and independent assessments", async () => {
  const specification = createHopeWritePlainLanguageEvaluationPlan().runs[0];
  const receipt = await receiptFor(specification);
  assert.equal(
    (await validateHopeWritePlainLanguageEvaluationReceipt(receipt))
      .evaluation.runPassed,
    true,
  );

  const tampered = structuredClone(receipt);
  tampered.output.revision = "확인하세요.";
  await assert.rejects(
    validateHopeWritePlainLanguageEvaluationReceipt(tampered),
    /bindings do not match/u,
  );

  const failed = await receiptFor(specification, {
    assessment: assessmentFor(specification.caseId, {
      failedCriterion: "plain-for-intended-reader",
    }),
  });
  assert.equal(
    (await validateHopeWritePlainLanguageEvaluationReceipt(failed))
      .evaluation.runPassed,
    false,
  );

  await assert.rejects(
    createHopeWritePlainLanguageEvaluationReceipt({
      ...receiptOptions(specification),
      evaluatorInvocationId: `writer-${specification.caseId}`,
    }),
    /must use different invocation identities/u,
  );
});

test("synthetic plain-language receipts are smoke evidence only", async () => {
  const receipts = await Promise.all(
    createHopeWritePlainLanguageEvaluationPlan().runs.map(receiptFor),
  );
  await assert.rejects(
    validateHopeWritePlainLanguageEvaluationReceiptSet(receipts),
    /requires host-attested evidence/u,
  );
  const result = await validateHopeWritePlainLanguageEvaluationReceiptSet(
    receipts,
    { allowSynthetic: true },
  );
  assert.deepEqual(result.summary, {
    accepted: false,
    failedRuns: 0,
    passedRuns: 4,
    totalRuns: 4,
  });
  assert.equal(result.decision, "reject-plain-language-behavior");
});

test("host-attested plain-language evidence requires both complete campaigns", async () => {
  const receipts = await Promise.all(
    createHopeWritePlainLanguageEvaluationPlan().runs.map(attestedReceiptFor),
  );
  const manifests = [];
  const result = await validateHopeWritePlainLanguageEvaluationReceiptSet(
    receipts,
    {
      verifyModelEvaluationAttestation: () => true,
      verifyModelEvaluationSet(manifest) {
        manifests.push(manifest);
        return manifest.events.length === 4;
      },
    },
  );
  assert.equal(result.summary.accepted, true);
  assert.equal(result.decision, "accept-plain-language-behavior");
  assert.deepEqual(
    manifests.map((manifest) => manifest.feature).sort(),
    [
      "hope-write-plain-language-evaluator",
      "hope-write-plain-language-writer",
    ],
  );
});

test("model-evaluation CLI parses the blinded assessment boundary", async () => {
  assert.deepEqual(
    parseModelEvaluationArguments([
      "write-plain-language-assessment-prepare",
      "--case",
      "write-plain-language-02",
      "--run",
      "1",
      "--input",
      "writer-output.json",
    ]),
    {
      caseId: "write-plain-language-02",
      command: "write-plain-language-assessment-prepare",
      inputPath: "writer-output.json",
      run: 1,
    },
  );

  let output = "";
  await runModelEvaluationCommand(["write-plain-language-plan"], {
    createWritePlainLanguagePlan: () => ({ planned: true }),
    stdout: { write(value) { output += value; } },
  });
  assert.equal(output, `${JSON.stringify({ planned: true }, null, 2)}\n`);
});

test("harness and generated plugin expose the same plain-language plan", () => {
  const harness = spawnSync(
    process.execPath,
    ["harness/hope.mjs", "model-evaluation", "write-plain-language-plan"],
    { cwd: root, encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      "plugins/hope/runtime/features/model-evaluation/cli.mjs",
      "write-plain-language-plan",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(harness.status, 0, harness.stderr);
  assert.equal(plugin.status, 0, plugin.stderr);
  assert.deepEqual(JSON.parse(harness.stdout), JSON.parse(plugin.stdout));
});
