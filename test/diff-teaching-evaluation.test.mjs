import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createDiffTeachingEvaluationFailureRecord,
  createDiffTeachingEvaluationPlan,
  createDiffTeachingEvaluationRecord,
  diffTeachingEvaluationCases,
  digestDiffTeachingEvaluationValue,
  getDiffTeachingEvaluationOracle,
  prepareDiffTeachingEvaluationRun,
  validateDiffTeachingEvaluationOutput,
  validateDiffTeachingEvaluationRecord,
  validateDiffTeachingEvaluationRecordSet,
} from "../features/diff/teaching-aid-evaluation.mjs";
import {
  createDiffTeachingEvaluationRecordFromFile,
  validateDiffTeachingEvaluationRecordFile,
  validateDiffTeachingEvaluationRecordSetFile,
} from "../features/diff/index.mjs";
import {
  main as diffMain,
  parseDiffArguments,
} from "../features/diff/cli.mjs";
import {
  digestHopeModelEvaluationEvidence,
  HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
} from "../features/model-evaluation/evidence.mjs";

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

function outputFor(evaluationCase) {
  const common = {
    reason: evaluationCase.locale === "ko-KR"
      ? "수집된 근거와 교육 보조 규칙을 적용했다."
      : "Applied the collected evidence and teaching-aid rules.",
  };
  if (evaluationCase.scenario === "data-flow-value") {
    return {
      ...common,
      beginnerPrimer: { decision: "omitted", items: [] },
      visual: {
        decision: "included",
        exampleValues: [{
          basis: "code",
          field: "detail",
          sourceIds: ["source-1"],
          value: "3",
        }],
        kind: "flow",
      },
    };
  }
  if (evaluationCase.scenario === "static-relationship") {
    return {
      ...common,
      beginnerPrimer: { decision: "omitted", items: [] },
      visual: {
        decision: "included",
        exampleValues: [],
        kind: "component-map",
      },
    };
  }
  if (evaluationCase.scenario === "grounded-primer") {
    return {
      ...common,
      beginnerPrimer: {
        decision: "included",
        items: [{
          basis: "code",
          sourceIds: ["source-1"],
          text: evaluationCase.locale === "ko-KR"
            ? "오류 전달 경계는 마지막 실패가 호출자에게 넘어가는 지점이다."
            : "An error-propagation boundary is where the final failure reaches the caller.",
          title: evaluationCase.locale === "ko-KR"
            ? "오류 전달 경계"
            : "Error-propagation boundary",
        }],
      },
      visual: {
        decision: "not-applicable",
        exampleValues: [],
        kind: null,
      },
    };
  }
  return {
    ...common,
    beginnerPrimer: { decision: "omitted", items: [] },
    visual: {
      decision: "not-applicable",
      exampleValues: [],
      kind: null,
    },
  };
}

function recordOptions(evaluationCase, overrides = {}) {
  return {
    attempt: 1,
    caseId: evaluationCase.id,
    effort: "high",
    host: "codex",
    invocationId: `invocation-${evaluationCase.id}-1`,
    model: "test-model",
    output: outputFor(evaluationCase),
    run: 1,
    ...overrides,
  };
}

function statement(record) {
  return {
    configuration: record.configuration,
    evaluation: {
      bindings: record.bindings,
      feature: record.feature,
      version: record.version,
    },
    invocation: record.invocation,
    specification: record.specification,
  };
}

function attestation(record) {
  const bound = statement(record);
  return {
    campaignId: "diff-teaching-campaign-1",
    eventId: record.invocation.id,
    issuedAt: "2026-08-07T00:00:00.000Z",
    issuer: "trusted-test-runner",
    proof: `proof-${record.invocation.id}`,
    statementDigest: digestHopeModelEvaluationEvidence(bound),
    version: HOPE_MODEL_EVALUATION_EVIDENCE_VERSION,
  };
}

async function syntheticRecords() {
  return await Promise.all(diffTeachingEvaluationCases.map(async (evaluationCase) => (
    await createDiffTeachingEvaluationRecord(recordOptions(evaluationCase))
  ).record));
}

test("the plan pairs every required teaching scenario in Korean and English", async () => {
  const plan = createDiffTeachingEvaluationPlan();
  assert.equal(plan.totalRuns, 10);
  assert.deepEqual(
    [...new Set(plan.runs.map((run) => run.locale))].sort(),
    ["en-US", "ko-KR"],
  );
  for (const scenario of [
    "data-flow-value",
    "static-relationship",
    "grounded-primer",
    "background-sufficient",
    "primer-unsupported",
  ]) {
    assert.equal(plan.runs.filter((run) => run.scenario === scenario).length, 2);
  }

  const prepared = await prepareDiffTeachingEvaluationRun({
    caseId: "teaching-ko-data-flow-value",
    run: 1,
  });
  assert.equal(prepared.brief.analysisSchemaVersion, 2);
  assert.equal(prepared.brief.teachingAidContractVersion, 6);
  assert.equal(prepared.version, 5);
  assert.match(
    prepared.outputContract.fields.visual,
    /component-map.*sequence.*smallest set/u,
  );
  assert.match(
    prepared.outputContract.fields.visual,
    /presentation-only.*not-applicable.*not omitted/u,
  );
  assert.match(
    prepared.outputContract.fields.visual,
    /cardinal.*ordinal.*paraphrased/u,
  );
  assert.match(
    prepared.outputContract.fields.beginnerPrimer,
    /new-reader task alone does not require a primer/u,
  );
  assert.equal(prepared.brief.analysisSchema.properties.beginnerPrimer.minItems, 1);
  assert.equal(prepared.hostInput.locale, "ko-KR");
  assert.equal("oracle" in prepared, false);
  assert.match(prepared.briefDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.match(prepared.inputDigest, /^sha256:[a-f0-9]{64}$/u);
});

test("the hidden oracle checks grounded values and primer decisions", () => {
  const valueOracle = getDiffTeachingEvaluationOracle(
    "teaching-en-data-flow-value",
  );
  assert.deepEqual(
    valueOracle.oracle.exampleValue.values,
    ["3", "third failure"],
  );
  assert.equal(valueOracle.oracle.exampleValue.sourceId, "source-1");
  const primerOracle = getDiffTeachingEvaluationOracle(
    "teaching-ko-grounded-primer",
  );
  assert.equal(primerOracle.oracle.primerDecision, "included");
  assert.equal(primerOracle.oracle.primerSourceId, "source-1");
  assert.deepEqual(primerOracle.oracle.primerBases, ["code", "inferred"]);
});

test("a grounded inferred primer follows the product basis contract", async () => {
  const evaluationCase = diffTeachingEvaluationCases.find(
    (candidate) => candidate.scenario === "grounded-primer",
  );
  const output = outputFor(evaluationCase);
  output.beginnerPrimer.items[0].basis = "inferred";
  const created = await createDiffTeachingEvaluationRecord(recordOptions(
    evaluationCase,
    {
      invocationId: "invocation-grounded-inferred-primer",
      output,
    },
  ));
  assert.equal(created.evaluation.primerGroundingMatched, true);
  assert.equal(created.evaluation.runPassed, true);
});

test("one exact ordinal value follows the concrete-value contract", async () => {
  const evaluationCase = diffTeachingEvaluationCases.find(
    (candidate) => candidate.id === "teaching-en-data-flow-value",
  );
  const output = outputFor(evaluationCase);
  output.visual.exampleValues[0].value = "third failure";
  const created = await createDiffTeachingEvaluationRecord(recordOptions(
    evaluationCase,
    {
      invocationId: "invocation-grounded-ordinal-value",
      output,
    },
  ));
  assert.equal(created.evaluation.exampleValueMatched, true);
  assert.equal(created.evaluation.runPassed, true);
});

test("output validation rejects invented or mismatched grounding", () => {
  const evaluationCase = diffTeachingEvaluationCases.find(
    (candidate) => candidate.scenario === "data-flow-value",
  );
  const valid = outputFor(evaluationCase);
  assert.equal(
    validateDiffTeachingEvaluationOutput(valid, { caseId: evaluationCase.id })
      .visual.exampleValues[0].value,
    "3",
  );
  assert.throws(
    () => validateDiffTeachingEvaluationOutput({
      ...valid,
      visual: {
        ...valid.visual,
        exampleValues: [{
          ...valid.visual.exampleValues[0],
          sourceIds: ["source-99"],
        }],
      },
    }, { caseId: evaluationCase.id }),
    /outside the prepared case/u,
  );
  assert.throws(
    () => validateDiffTeachingEvaluationOutput({
      ...valid,
      visual: {
        ...valid.visual,
        exampleValues: [{
          ...valid.visual.exampleValues[0],
          basis: "stated",
        }],
      },
    }, { caseId: evaluationCase.id }),
    /uses code as stated evidence/u,
  );
});

test("synthetic complete sets pass behavior checks but cannot release", async () => {
  const records = await syntheticRecords();
  await assert.rejects(
    () => validateDiffTeachingEvaluationRecordSet(records),
    /requires host-attested evidence/u,
  );
  const result = await validateDiffTeachingEvaluationRecordSet(records, {
    allowSynthetic: true,
  });
  assert.equal(result.summary.passedRuns, 10);
  assert.equal(result.summary.failedRuns, 0);
  assert.equal(result.summary.releaseReady, false);
  assert.equal(result.decision, "release-blocked");
  assert.equal(result.provenance.kind, "synthetic");
});

test("the complete set preserves failed attempts and contiguous retries", async () => {
  const target = diffTeachingEvaluationCases[0];
  const otherRecords = await Promise.all(
    diffTeachingEvaluationCases.slice(1).map(async (evaluationCase) => (
      await createDiffTeachingEvaluationRecord(recordOptions(evaluationCase))
    ).record),
  );
  const failed = (await createDiffTeachingEvaluationFailureRecord({
    attempt: 1,
    caseId: target.id,
    effort: "high",
    failure: {
      code: "HOST_TIMEOUT",
      message: "The host did not return a complete JSON object.",
      retryable: true,
    },
    host: "codex",
    invocationId: `invocation-${target.id}-1`,
    model: "test-model",
    run: 1,
  })).record;
  const recovered = (await createDiffTeachingEvaluationRecord(recordOptions(
    target,
    {
      attempt: 2,
      invocationId: `invocation-${target.id}-2`,
    },
  ))).record;
  const result = await validateDiffTeachingEvaluationRecordSet(
    [failed, recovered, ...otherRecords],
    { allowSynthetic: true },
  );
  assert.equal(result.summary.totalAttempts, 11);
  assert.equal(result.summary.failedAttempts, 1);
  assert.equal(result.summary.passedRuns, 10);

  await assert.rejects(
    () => validateDiffTeachingEvaluationRecordSet(
      [recovered, ...otherRecords],
      { allowSynthetic: true },
    ),
    /gap in its attempt ledger/u,
  );

  const wrongOutput = outputFor(target);
  wrongOutput.visual.exampleValues[0].value = "4";
  const wrong = (await createDiffTeachingEvaluationRecord(recordOptions(
    target,
    {
      invocationId: `invocation-${target.id}-wrong`,
      output: wrongOutput,
    },
  ))).record;
  await assert.rejects(
    () => validateDiffTeachingEvaluationRecordSet(
      [wrong, recovered, ...otherRecords],
      { allowSynthetic: true },
    ),
    /not a retryable host failure/u,
  );
});

test("trusted complete sets can satisfy the release gate", async () => {
  const synthetic = await syntheticRecords();
  const dependencies = {
    verifyModelEvaluationAttestation(received, bound) {
      return received.proof === `proof-${received.eventId}`
        && received.statementDigest === bound.statementDigest;
    },
    verifyModelEvaluationSet(manifest) {
      return manifest.events.length === 10
        && manifest.plannedRunKeys.length === 10;
    },
  };
  const trusted = await Promise.all(diffTeachingEvaluationCases.map(
    async (evaluationCase, index) => (
      await createDiffTeachingEvaluationRecord({
        ...recordOptions(evaluationCase),
        attestation: attestation(synthetic[index]),
      }, dependencies)
    ).record,
  ));
  const result = await validateDiffTeachingEvaluationRecordSet(
    trusted,
    dependencies,
  );
  assert.equal(result.provenance.kind, "host-attested");
  assert.equal(result.summary.releaseReady, true);
  assert.equal(result.decision, "release-ready");
});

test("record validation binds the active brief, input, output, and oracle", async () => {
  const evaluationCase = diffTeachingEvaluationCases[0];
  const created = await createDiffTeachingEvaluationRecord(
    recordOptions(evaluationCase),
  );
  const validated = await validateDiffTeachingEvaluationRecord(created.record);
  assert.equal(validated.evaluation.runPassed, true);
  const invented = outputFor(evaluationCase);
  invented.visual.exampleValues.push({
    basis: "code",
    field: "caption",
    sourceIds: ["source-1"],
    value: "4",
  });
  const inventedRecord = await createDiffTeachingEvaluationRecord(
    recordOptions(evaluationCase, {
      invocationId: "invocation-invented-value",
      output: invented,
    }),
  );
  assert.equal(inventedRecord.evaluation.exampleValueMatched, false);
  assert.equal(inventedRecord.evaluation.runPassed, false);
  const tampered = structuredClone(created.record);
  tampered.outcome.output.visual.exampleValues[0].value = "4";
  await assert.rejects(
    () => validateDiffTeachingEvaluationRecord(tampered),
    /evaluation does not match|bindings do not match/u,
  );
});

test("Diff CLI exposes the teaching evaluation through the shared core", async () => {
  assert.deepEqual(parseDiffArguments(["teaching-evaluation-plan"]), {
    command: "teaching-evaluation-plan",
  });
  assert.deepEqual(parseDiffArguments([
    "teaching-evaluation-record",
    "--case", "teaching-en-data-flow-value",
    "--run", "1",
    "--attempt", "2",
    "--input", "/tmp/output.json",
    "--host", "codex",
    "--model", "test-model",
    "--effort", "high",
    "--invocation", "invocation-2",
  ]), {
    attempt: 2,
    caseId: "teaching-en-data-flow-value",
    command: "teaching-evaluation-record",
    effort: "high",
    host: "codex",
    inputPath: "/tmp/output.json",
    invocationId: "invocation-2",
    model: "test-model",
    run: 1,
  });
  assert.equal(
    parseDiffArguments([
      "teaching-evaluation-failure-record",
      "--case", "teaching-en-data-flow-value",
      "--run", "1",
      "--attempt", "1",
      "--code", "HOST_TIMEOUT",
      "--message", "Timed out",
      "--retryable", "true",
      "--host", "codex",
      "--model", "test-model",
      "--effort", "high",
      "--invocation", "invocation-1",
    ]).failure.retryable,
    true,
  );

  let stdout = "";
  await diffMain(["teaching-evaluation-plan"], {
    stdout: { write: (value) => { stdout += value; } },
  });
  assert.equal(JSON.parse(stdout).totalRuns, 10);
});

test("core, harness, and generated plugin expose one teaching evaluation", async () => {
  assert.equal(assertEntryParity(["teaching-evaluation-plan"]).totalRuns, 10);
  assert.equal(assertEntryParity([
    "teaching-evaluation-prepare",
    "--case", "teaching-ko-grounded-primer",
    "--run", "1",
  ]).locale, "ko-KR");
  assert.equal(assertEntryParity([
    "teaching-evaluation-oracle",
    "--case", "teaching-en-static-relationship",
  ]).oracle.visualKind, "component-map");

  const directory = await mkdtemp(join(tmpdir(), "hope-diff-teaching-entry-"));
  try {
    const evaluationCase = diffTeachingEvaluationCases[0];
    const outputPath = join(directory, "output.json");
    await writeFile(outputPath, JSON.stringify(outputFor(evaluationCase)));
    const created = assertEntryParity([
      "teaching-evaluation-record",
      "--case", evaluationCase.id,
      "--run", "1",
      "--attempt", "1",
      "--input", outputPath,
      "--host", "codex",
      "--model", "test-model",
      "--effort", "high",
      "--invocation", "entry-parity-invocation",
    ]);
    const recordPath = join(directory, "record.json");
    await writeFile(recordPath, JSON.stringify(created.record));
    assert.equal(assertEntryParity([
      "teaching-evaluation-validate",
      "--input", recordPath,
    ]).evaluation.runPassed, true);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("file adapters create and validate bounded synthetic records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hope-diff-teaching-eval-"));
  try {
    const evaluationCase = diffTeachingEvaluationCases[0];
    const outputPath = join(directory, "output.json");
    const recordPath = join(directory, "record.json");
    const recordsPath = join(directory, "records.json");
    await writeFile(outputPath, JSON.stringify(outputFor(evaluationCase)));
    const created = await createDiffTeachingEvaluationRecordFromFile({
      ...recordOptions(evaluationCase),
      inputPath: outputPath,
      output: undefined,
    });
    await writeFile(recordPath, JSON.stringify(created.record));
    assert.equal(
      (await validateDiffTeachingEvaluationRecordFile(recordPath)).evaluation.runPassed,
      true,
    );
    const records = await syntheticRecords();
    await writeFile(recordsPath, JSON.stringify(records));
    const set = await validateDiffTeachingEvaluationRecordSetFile(recordsPath, {
      allowSynthetic: true,
    });
    assert.equal(set.summary.totalRuns, 10);
    assert.equal(
      created.record.bindings.outputDigest,
      digestDiffTeachingEvaluationValue(outputFor(evaluationCase)),
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
