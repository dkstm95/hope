// Generated from features/diff/teaching-aid-evaluation.mjs. Do not edit.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import {
  createHopeModelEvaluationProvenance,
  validateHopeModelEvaluationProvenance,
  validateHopeModelEvaluationRecordSetProvenance,
} from "../model-evaluation/evidence.mjs";
import { normalizeLegacyRecordTerms } from "../record-compat/index.mjs";
import { createWritingStandard } from "../write/index.mjs";
import {
  ANALYSIS_VERSION,
  TEACHING_AID_CONTRACT_VERSION,
} from "./constants.mjs";
import { createTeachingAidContract } from "./teaching-aids.mjs";

export const DIFF_TEACHING_EVALUATION_VERSION = 5;
export const DIFF_TEACHING_EVALUATION_MAX_ATTEMPTS = 4;

export const diffTeachingEvaluationLimits = Object.freeze({
  outputBytes: 32 * 1024,
  reasonCharacters: 2048,
  recordBytes: 96 * 1024,
  recordSetBytes: 4 * 1024 * 1024,
});

const visualDecisions = Object.freeze([
  "included",
  "omitted",
  "not-applicable",
]);
const visualKinds = Object.freeze([
  "flow",
  "decision-table",
  "sequence",
  "component-map",
]);
const valueFields = Object.freeze([
  "caption",
  "detail",
  "message-label",
  "row-cell",
]);
const bases = Object.freeze(["stated", "code", "inferred"]);
const primerDecisions = Object.freeze(["included", "omitted"]);

function evaluationError(message) {
  return new TypeError(`Invalid Diff teaching evaluation: ${message}`);
}

function assertEvaluation(condition, message) {
  if (!condition) throw evaluationError(message);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key,
    canonicalValue(value[key]),
  ]));
}

export function digestDiffTeachingEvaluationValue(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex")}`;
}

function exactKeys(value, expected, label) {
  assertEvaluation(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  assertEvaluation(
    isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort()),
    `${label} must contain exactly ${expected.join(", ")}`,
  );
}

function boundedText(value, label, maximum = 4096) {
  assertEvaluation(
    typeof value === "string"
      && value.trim().length > 0
      && [...value].length <= maximum,
    `${label} must be text between 1 and ${maximum} characters`,
  );
  return value;
}

function positiveInteger(value, label, maximum) {
  assertEvaluation(
    Number.isSafeInteger(value) && value >= 1 && value <= maximum,
    `${label} must be an integer between 1 and ${maximum}`,
  );
  return value;
}

function syntheticInput({ evidence, locale, ordinaryBackground, task }) {
  return Object.freeze({
    contentIsSynthetic: true,
    evidence: Object.freeze(evidence.map((item) => Object.freeze(item))),
    locale,
    ordinaryBackground: Object.freeze([...ordinaryBackground]),
    task,
  });
}

function localizedCases(locale) {
  const korean = locale === "ko-KR";
  const suffix = korean ? "ko" : "en";
  return [
    Object.freeze({
      id: `teaching-${suffix}-data-flow-value`,
      input: syntheticInput({
        evidence: [{
          sourceId: "source-1",
          sourceKind: "code",
          text: korean
            ? "retryLimit은 3이며 세 번째 실패 뒤 finalError를 호출자에게 반환한다."
            : "retryLimit is 3, and the third failure returns finalError to the caller.",
        }],
        locale,
        ordinaryBackground: [],
        task: korean
          ? "재시도 제어 흐름을 처음 보는 독자도 따라갈 수 있게 설명한다."
          : "Explain the retry control flow so a new reader can follow it.",
      }),
      locale,
      oracle: Object.freeze({
        exampleValue: Object.freeze({
          basis: "code",
          sourceId: "source-1",
          values: Object.freeze(korean
            ? ["3", "세 번째 실패"]
            : ["3", "third failure"]),
        }),
        primerDecision: "omitted",
        visualDecision: "included",
        visualKind: "flow",
      }),
      scenario: "data-flow-value",
    }),
    Object.freeze({
      id: `teaching-${suffix}-static-relationship`,
      input: syntheticInput({
        evidence: [{
          sourceId: "source-1",
          sourceKind: "code",
          text: korean
            ? "collector가 validator를 호출하고 validator가 renderer에 검증 결과를 전달한다. 값이나 횟수는 명시되지 않았다."
            : "The collector calls the validator, which passes the validated result to the renderer. No values or counts are stated.",
        }],
        locale,
        ordinaryBackground: [],
        task: korean
          ? "세 구성 요소의 고정 관계를 설명한다."
          : "Explain the fixed relationship among the three components.",
      }),
      locale,
      oracle: Object.freeze({
        exampleValue: null,
        primerDecision: "omitted",
        visualDecision: "included",
        visualKind: "component-map",
      }),
      scenario: "static-relationship",
    }),
    Object.freeze({
      id: `teaching-${suffix}-grounded-primer`,
      input: syntheticInput({
        evidence: [{
          sourceId: "source-1",
          sourceKind: "code",
          text: korean
            ? "catch 블록은 마지막 오류를 저장하고 반복이 끝나면 그 오류를 다시 던진다."
            : "The catch block stores the final error and throws it again after the loop ends.",
        }],
        locale,
        ordinaryBackground: [],
        task: korean
          ? "오류 전달 경계라는 개념을 모르는 독자에게 변경을 설명한다."
          : "Explain the change to a reader who does not know what an error-propagation boundary is.",
      }),
      locale,
      oracle: Object.freeze({
        exampleValue: null,
        primerBases: Object.freeze(["code", "inferred"]),
        primerDecision: "included",
        primerSourceId: "source-1",
        visualDecision: "not-applicable",
        visualKind: null,
      }),
      scenario: "grounded-primer",
    }),
    Object.freeze({
      id: `teaching-${suffix}-background-sufficient`,
      input: syntheticInput({
        evidence: [{
          sourceId: "source-1",
          sourceKind: "documentation",
          text: korean
            ? "설정 설명에는 다크 테마가 초기 색상만 바꾼다고 적혀 있다."
            : "The setting description says that dark theme changes only the initial colors.",
        }],
        locale,
        ordinaryBackground: [korean
          ? "다크 테마는 초기 색상 선택이다."
          : "Dark theme is an initial color choice."],
        task: korean
          ? "기존 배경 설명으로 충분한 작은 표시 변경을 설명한다."
          : "Explain a small presentation change that the existing background already covers.",
      }),
      locale,
      oracle: Object.freeze({
        exampleValue: null,
        primerDecision: "omitted",
        visualDecision: "not-applicable",
        visualKind: null,
      }),
      scenario: "background-sufficient",
    }),
    Object.freeze({
      id: `teaching-${suffix}-primer-unsupported`,
      input: syntheticInput({
        evidence: [{
          sourceId: "source-1",
          sourceKind: "metadata",
          text: korean
            ? "변경 제목은 '재시도 설명 개선'이다. 구현 근거나 개념 설명은 수집되지 않았다."
            : "The change title is 'Improve retry explanation.' No implementation or conceptual evidence was collected.",
        }],
        locale,
        ordinaryBackground: [],
        task: korean
          ? "수집된 근거만 사용해 변경을 설명한다."
          : "Explain the change using only the collected evidence.",
      }),
      locale,
      oracle: Object.freeze({
        exampleValue: null,
        primerDecision: "omitted",
        visualDecision: "not-applicable",
        visualKind: null,
      }),
      scenario: "primer-unsupported",
    }),
  ];
}

export const diffTeachingEvaluationCases = Object.freeze([
  ...localizedCases("ko-KR"),
  ...localizedCases("en-US"),
]);

export const diffTeachingEvaluationProtocol = Object.freeze({
  attemptLedger:
    "Keep every failed, cancelled, malformed, and successful attempt. Attempts for one planned run start at 1, remain contiguous, and never exceed four.",
  caseDesign:
    "Five paired Korean and English cases cover a grounded data-flow value, a static relationship without invented values, a grounded primer, sufficient ordinary background, and insufficient primer evidence.",
  decision:
    "Release is ready only when the latest attempt for every planned run passes and the trusted runner verifies the complete host-attested attempt ledger.",
  hostInput:
    "Give a fresh host only the exact returned brief, hostInput, and outputContract. Keep the oracle hidden until the host returns or the attempt fails.",
  storage:
    "Keep bounded records under ignored test-results/. CLI-created records are synthetic; release evidence must come through a trusted runner adapter.",
  version: DIFF_TEACHING_EVALUATION_VERSION,
});

export const diffTeachingEvaluationOutputContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    beginnerPrimer:
      "Return included only for a named concept or deeper starting point that ordinary Background cannot supply. A new-reader task alone does not require a primer. Included needs one to eight grounded items; omitted needs an empty items array. Use code when an item paraphrases a mechanism directly established by code evidence, and inferred only when its material meaning goes beyond the evidence.",
    reason:
      "Give one short reason grounded in the brief and synthetic evidence.",
    visual:
      "Apply the contract's decision order to this specific visual. A presentation-only change with no flow, branch, component relationship, interaction, state transition, or prediction to visualize is not-applicable, not omitted merely because ordinary Background explains it. Choose the kind from the task's teaching job: component-map for fixed structure or handoffs, sequence only when time order or ordered messages are the point, and flow for runtime data or control movement. Return the decision, its kind or null, and the smallest set of concrete values intentionally used in an existing caption, detail, message-label, or row-cell field. Record one underlying evidence value once; do not repeat it in cardinal, ordinal, or paraphrased form or for another visual field. Identifiers, component names, and prose step labels are not concrete example values merely because they appear in evidence.",
  }),
  format: "Return one JSON object and no surrounding prose.",
  shape: Object.freeze({
    beginnerPrimer: Object.freeze({
      decision: "included | omitted",
      items: "[{ title, text, basis, sourceIds }]",
    }),
    reason: "string",
    visual: Object.freeze({
      decision: "included | omitted | not-applicable",
      exampleValues: "[{ value, field, basis, sourceIds }]",
      kind: "flow | decision-table | sequence | component-map | null",
    }),
  }),
});

function findCase(caseId) {
  const evaluationCase = diffTeachingEvaluationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown Diff teaching evaluation case: ${caseId}`);
  }
  return evaluationCase;
}

function assertRun(evaluationCase, run) {
  assertEvaluation(run === 1, `case ${evaluationCase.id} requires run 1`);
}

function plannedRuns() {
  return diffTeachingEvaluationCases.map((evaluationCase) => Object.freeze({
    caseId: evaluationCase.id,
    locale: evaluationCase.locale,
    run: 1,
    scenario: evaluationCase.scenario,
  }));
}

async function activeBrief() {
  const [analysisSchemaText, writingStandard] = await Promise.all([
    readFile(new URL("./analysis-v2.schema.json", import.meta.url), "utf8"),
    createWritingStandard(),
  ]);
  return Object.freeze({
    analysisSchema: Object.freeze(JSON.parse(analysisSchemaText)),
    analysisSchemaVersion: ANALYSIS_VERSION,
    teachingAids: createTeachingAidContract(),
    teachingAidContractVersion: TEACHING_AID_CONTRACT_VERSION,
    writingStandard,
  });
}

export function createDiffTeachingEvaluationPlan() {
  const runs = plannedRuns();
  return Object.freeze({
    feature: "diff-teaching-evaluation",
    protocol: diffTeachingEvaluationProtocol,
    runs: Object.freeze(runs),
    totalRuns: runs.length,
    version: DIFF_TEACHING_EVALUATION_VERSION,
  });
}

export async function prepareDiffTeachingEvaluationRun({ caseId, run }) {
  const evaluationCase = findCase(caseId);
  assertRun(evaluationCase, run);
  const brief = await activeBrief();
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: diffTeachingEvaluationOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestDiffTeachingEvaluationValue(brief),
    caseId,
    feature: "diff-teaching-evaluation-run",
    hostInput,
    inputDigest: digestDiffTeachingEvaluationValue(preparedInput),
    locale: evaluationCase.locale,
    outputContract: diffTeachingEvaluationOutputContract,
    run,
    scenario: evaluationCase.scenario,
    version: DIFF_TEACHING_EVALUATION_VERSION,
  });
}

export function getDiffTeachingEvaluationOracle(caseId) {
  const evaluationCase = findCase(caseId);
  return Object.freeze({
    caseId,
    locale: evaluationCase.locale,
    oracle: evaluationCase.oracle,
    scenario: evaluationCase.scenario,
  });
}

function sourceMap(evaluationCase) {
  return new Map(evaluationCase.input.evidence.map((source) => [
    source.sourceId,
    source,
  ]));
}

function sourceIds(value, label, evaluationCase) {
  assertEvaluation(
    Array.isArray(value) && value.length >= 1 && value.length <= 12,
    `${label} must contain 1 to 12 source IDs`,
  );
  const ids = value.map((sourceId, index) => boundedText(
    sourceId,
    `${label}[${index}]`,
    128,
  ));
  assertEvaluation(new Set(ids).size === ids.length, `${label} repeats a source ID`);
  const sources = sourceMap(evaluationCase);
  assertEvaluation(
    ids.every((sourceId) => sources.has(sourceId)),
    `${label} cites evidence outside the prepared case`,
  );
  return Object.freeze(ids);
}

function groundedBasis(value, label, ids, evaluationCase) {
  assertEvaluation(bases.includes(value), `${label} is not supported`);
  const sources = sourceMap(evaluationCase);
  if (value === "code") {
    assertEvaluation(
      ids.every((sourceId) => sources.get(sourceId).sourceKind === "code"),
      `${label} uses non-code evidence as code`,
    );
  }
  if (value === "stated") {
    assertEvaluation(
      ids.every((sourceId) => sources.get(sourceId).sourceKind !== "code"),
      `${label} uses code as stated evidence`,
    );
  }
  return value;
}

function normalizeExampleValue(value, index, evaluationCase) {
  const label = `output.visual.exampleValues[${index}]`;
  exactKeys(value, ["basis", "field", "sourceIds", "value"], label);
  const ids = sourceIds(value.sourceIds, `${label}.sourceIds`, evaluationCase);
  assertEvaluation(valueFields.includes(value.field), `${label}.field is not supported`);
  return Object.freeze({
    basis: groundedBasis(value.basis, `${label}.basis`, ids, evaluationCase),
    field: value.field,
    sourceIds: ids,
    value: boundedText(value.value, `${label}.value`, 512),
  });
}

function normalizePrimerItem(value, index, evaluationCase) {
  const label = `output.beginnerPrimer.items[${index}]`;
  exactKeys(value, ["basis", "sourceIds", "text", "title"], label);
  const ids = sourceIds(value.sourceIds, `${label}.sourceIds`, evaluationCase);
  return Object.freeze({
    basis: groundedBasis(value.basis, `${label}.basis`, ids, evaluationCase),
    sourceIds: ids,
    text: boundedText(value.text, `${label}.text`, 4096),
    title: boundedText(value.title, `${label}.title`, 512),
  });
}

export function validateDiffTeachingEvaluationOutput(value, { caseId } = {}) {
  const evaluationCase = findCase(caseId);
  exactKeys(value, ["beginnerPrimer", "reason", "visual"], "output");
  exactKeys(
    value.visual,
    ["decision", "exampleValues", "kind"],
    "output.visual",
  );
  assertEvaluation(
    visualDecisions.includes(value.visual.decision),
    "output.visual.decision is not supported",
  );
  const visualIncluded = value.visual.decision === "included";
  assertEvaluation(
    visualIncluded
      ? visualKinds.includes(value.visual.kind)
      : value.visual.kind === null,
    "output.visual.kind does not match its decision",
  );
  assertEvaluation(
    Array.isArray(value.visual.exampleValues)
      && value.visual.exampleValues.length <= 8,
    "output.visual.exampleValues must contain at most 8 items",
  );
  const exampleValues = value.visual.exampleValues.map(
    (item, index) => normalizeExampleValue(item, index, evaluationCase),
  );
  assertEvaluation(
    visualIncluded || exampleValues.length === 0,
    "a visual that is not included cannot contain example values",
  );
  exactKeys(
    value.beginnerPrimer,
    ["decision", "items"],
    "output.beginnerPrimer",
  );
  assertEvaluation(
    primerDecisions.includes(value.beginnerPrimer.decision),
    "output.beginnerPrimer.decision is not supported",
  );
  assertEvaluation(
    Array.isArray(value.beginnerPrimer.items)
      && value.beginnerPrimer.items.length <= 8,
    "output.beginnerPrimer.items must contain at most 8 items",
  );
  const primerItems = value.beginnerPrimer.items.map(
    (item, index) => normalizePrimerItem(item, index, evaluationCase),
  );
  assertEvaluation(
    value.beginnerPrimer.decision === "included"
      ? primerItems.length >= 1
      : primerItems.length === 0,
    "output.beginnerPrimer.items does not match its decision",
  );
  const normalized = Object.freeze({
    beginnerPrimer: Object.freeze({
      decision: value.beginnerPrimer.decision,
      items: Object.freeze(primerItems),
    }),
    reason: boundedText(
      value.reason,
      "output.reason",
      diffTeachingEvaluationLimits.reasonCharacters,
    ),
    visual: Object.freeze({
      decision: value.visual.decision,
      exampleValues: Object.freeze(exampleValues),
      kind: value.visual.kind,
    }),
  });
  assertEvaluation(
    Buffer.byteLength(JSON.stringify(normalized), "utf8")
      <= diffTeachingEvaluationLimits.outputBytes,
    "output exceeds the byte limit",
  );
  return normalized;
}

function failedEvaluation() {
  return Object.freeze({
    exampleValueMatched: false,
    primerDecisionMatched: false,
    primerGroundingMatched: false,
    runPassed: false,
    visualDecisionMatched: false,
  });
}

function evaluationFor(evaluationCase, output) {
  const oracle = evaluationCase.oracle;
  const visualDecisionMatched = output.visual.decision === oracle.visualDecision
    && output.visual.kind === oracle.visualKind;
  const exampleValueMatched = oracle.exampleValue
    ? output.visual.exampleValues.length === 1
      && output.visual.exampleValues.every((item) => (
        oracle.exampleValue.values.includes(item.value)
        && item.basis === oracle.exampleValue.basis
        && item.sourceIds.includes(oracle.exampleValue.sourceId)
      ))
    : output.visual.exampleValues.length === 0;
  const primerDecisionMatched = output.beginnerPrimer.decision
    === oracle.primerDecision;
  const primerGroundingMatched = oracle.primerDecision === "included"
    ? output.beginnerPrimer.items.some((item) => (
      oracle.primerBases.includes(item.basis)
      && item.sourceIds.includes(oracle.primerSourceId)
    ))
    : output.beginnerPrimer.items.length === 0;
  return Object.freeze({
    exampleValueMatched,
    primerDecisionMatched,
    primerGroundingMatched,
    runPassed: visualDecisionMatched
      && exampleValueMatched
      && primerDecisionMatched
      && primerGroundingMatched,
    visualDecisionMatched,
  });
}

function normalizeFailure(value) {
  exactKeys(value, ["code", "message", "retryable"], "failure");
  assertEvaluation(typeof value.retryable === "boolean", "failure.retryable must be boolean");
  return Object.freeze({
    code: boundedText(value.code, "failure.code", 256),
    message: boundedText(value.message, "failure.message", 4096),
    retryable: value.retryable,
  });
}

async function createRecord({
  attestation,
  attempt,
  caseId,
  effort,
  failure,
  host,
  invocationId,
  model,
  output,
  run,
}, dependencies = {}) {
  const prepared = await prepareDiffTeachingEvaluationRun({ caseId, run });
  const evaluationCase = findCase(caseId);
  const attemptNumber = positiveInteger(
    attempt,
    "specification.attempt",
    DIFF_TEACHING_EVALUATION_MAX_ATTEMPTS,
  );
  const succeeded = failure === undefined;
  assertEvaluation(
    succeeded ? output !== undefined : output === undefined,
    "an attempt must contain either output or failure",
  );
  const outcome = succeeded
    ? Object.freeze({
      output: validateDiffTeachingEvaluationOutput(output, { caseId }),
      status: "succeeded",
    })
    : Object.freeze({
      failure: normalizeFailure(failure),
      status: "failed",
    });
  const evaluation = succeeded
    ? evaluationFor(evaluationCase, outcome.output)
    : failedEvaluation();
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestDiffTeachingEvaluationValue(
      succeeded ? outcome.output : outcome.failure,
    ),
  });
  const configuration = Object.freeze({
    effort: boundedText(effort, "configuration.effort", 256),
    host: boundedText(host, "configuration.host", 256),
    model: boundedText(model, "configuration.model", 256),
  });
  const invocation = Object.freeze({
    id: boundedText(invocationId, "invocation.id", 512),
  });
  const specification = Object.freeze({
    attempt: attemptNumber,
    caseId,
    locale: prepared.locale,
    run,
    scenario: prepared.scenario,
  });
  const statement = Object.freeze({
    configuration,
    evaluation: Object.freeze({
      bindings,
      feature: "diff-teaching-evaluation-record",
      version: DIFF_TEACHING_EVALUATION_VERSION,
    }),
    invocation,
    specification,
  });
  const provenance = createHopeModelEvaluationProvenance(
    { attestation, statement },
    dependencies,
  );
  const record = Object.freeze({
    bindings,
    configuration,
    evaluation,
    feature: "diff-teaching-evaluation-record",
    invocation,
    outcome,
    provenance,
    specification,
    version: DIFF_TEACHING_EVALUATION_VERSION,
  });
  assertEvaluation(
    Buffer.byteLength(JSON.stringify(record), "utf8")
      <= diffTeachingEvaluationLimits.recordBytes,
    "record exceeds the byte limit",
  );
  return Object.freeze({ evaluation, record });
}

export async function createDiffTeachingEvaluationRecord(options, dependencies = {}) {
  return await createRecord(options, dependencies);
}

export async function createDiffTeachingEvaluationFailureRecord(
  options,
  dependencies = {},
) {
  return await createRecord(options, dependencies);
}

export async function validateDiffTeachingEvaluationRecord(
  value,
  dependencies = {},
) {
  value = normalizeLegacyRecordTerms(value);
  exactKeys(value, [
    "bindings",
    "configuration",
    "evaluation",
    "feature",
    "invocation",
    "outcome",
    "provenance",
    "specification",
    "version",
  ], "record");
  assertEvaluation(
    value.feature === "diff-teaching-evaluation-record",
    "record.feature is invalid",
  );
  assertEvaluation(
    value.version === DIFF_TEACHING_EVALUATION_VERSION,
    `record.version must be ${DIFF_TEACHING_EVALUATION_VERSION}`,
  );
  exactKeys(
    value.specification,
    ["attempt", "caseId", "locale", "run", "scenario"],
    "record.specification",
  );
  const prepared = await prepareDiffTeachingEvaluationRun(value.specification);
  positiveInteger(
    value.specification.attempt,
    "record.specification.attempt",
    DIFF_TEACHING_EVALUATION_MAX_ATTEMPTS,
  );
  assertEvaluation(
    value.specification.locale === prepared.locale
      && value.specification.scenario === prepared.scenario,
    "record specification does not match the prepared case",
  );
  exactKeys(value.configuration, ["effort", "host", "model"], "record.configuration");
  const configuration = Object.freeze({
    effort: boundedText(value.configuration.effort, "configuration.effort", 256),
    host: boundedText(value.configuration.host, "configuration.host", 256),
    model: boundedText(value.configuration.model, "configuration.model", 256),
  });
  exactKeys(value.invocation, ["id"], "record.invocation");
  const invocation = Object.freeze({
    id: boundedText(value.invocation.id, "invocation.id", 512),
  });
  let outcome;
  let evaluation;
  let outputDigest;
  if (value.outcome?.status === "succeeded") {
    exactKeys(value.outcome, ["output", "status"], "record.outcome");
    const output = validateDiffTeachingEvaluationOutput(
      value.outcome.output,
      { caseId: value.specification.caseId },
    );
    outcome = Object.freeze({ output, status: "succeeded" });
    evaluation = evaluationFor(findCase(value.specification.caseId), output);
    outputDigest = digestDiffTeachingEvaluationValue(output);
  } else {
    exactKeys(value.outcome, ["failure", "status"], "record.outcome");
    assertEvaluation(value.outcome.status === "failed", "record.outcome.status is invalid");
    const failure = normalizeFailure(value.outcome.failure);
    outcome = Object.freeze({ failure, status: "failed" });
    evaluation = failedEvaluation();
    outputDigest = digestDiffTeachingEvaluationValue(failure);
  }
  exactKeys(value.evaluation, [
    "exampleValueMatched",
    "primerDecisionMatched",
    "primerGroundingMatched",
    "runPassed",
    "visualDecisionMatched",
  ], "record.evaluation");
  assertEvaluation(
    isDeepStrictEqual(value.evaluation, evaluation),
    "record.evaluation does not match the output and oracle",
  );
  exactKeys(
    value.bindings,
    ["briefDigest", "inputDigest", "outputDigest"],
    "record.bindings",
  );
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest,
  });
  assertEvaluation(
    isDeepStrictEqual(value.bindings, bindings),
    "record.bindings do not match the prepared run and outcome",
  );
  const specification = Object.freeze({ ...value.specification });
  const statement = Object.freeze({
    configuration,
    evaluation: Object.freeze({
      bindings,
      feature: value.feature,
      version: value.version,
    }),
    invocation,
    specification,
  });
  const provenance = validateHopeModelEvaluationProvenance(
    value.provenance,
    statement,
    dependencies,
  );
  return Object.freeze({
    evaluation,
    record: Object.freeze({
      bindings,
      configuration,
      evaluation,
      feature: value.feature,
      invocation,
      outcome,
      provenance,
      specification,
      version: value.version,
    }),
  });
}

function baseRunKey({ caseId, run }) {
  return `${caseId}:${run}`;
}

function attemptKey({ attempt, caseId, run }) {
  return `${baseRunKey({ caseId, run })}:${attempt}`;
}

function count(records, field, values) {
  return Object.freeze(Object.fromEntries(values.map((value) => {
    const matching = records.filter(
      (record) => record.specification[field] === value,
    );
    return [value, Object.freeze({
      failedAttempts: matching.filter(
        (record) => record.outcome.status === "failed"
          || !record.evaluation.runPassed,
      ).length,
      passedAttempts: matching.filter(
        (record) => record.outcome.status === "succeeded"
          && record.evaluation.runPassed,
      ).length,
      totalAttempts: matching.length,
    })];
  })));
}

export async function validateDiffTeachingEvaluationRecordSet(
  values,
  dependencies = {},
) {
  assertEvaluation(Array.isArray(values), "record set must be an array");
  assertEvaluation(
    Buffer.byteLength(JSON.stringify(values), "utf8")
      <= diffTeachingEvaluationLimits.recordSetBytes,
    "record set exceeds the byte limit",
  );
  const expected = plannedRuns();
  assertEvaluation(
    values.length >= expected.length
      && values.length <= expected.length * DIFF_TEACHING_EVALUATION_MAX_ATTEMPTS,
    `record set must contain ${expected.length} to ${expected.length * DIFF_TEACHING_EVALUATION_MAX_ATTEMPTS} attempts`,
  );
  const validated = await Promise.all(values.map((value) =>
    validateDiffTeachingEvaluationRecord(value, dependencies)
  ));
  const records = validated.map((result) => result.record);
  const expectedKeys = new Set(expected.map(baseRunKey));
  const actualAttemptKeys = records.map((record) => attemptKey(record.specification));
  assertEvaluation(
    new Set(actualAttemptKeys).size === actualAttemptKeys.length,
    "record set repeats an attempt",
  );
  assertEvaluation(
    records.every((record) => expectedKeys.has(baseRunKey(record.specification))),
    "record set contains an unplanned run",
  );
  const invocationIds = records.map((record) => record.invocation.id);
  assertEvaluation(
    new Set(invocationIds).size === invocationIds.length,
    "record set repeats an invocation identity",
  );
  const configurations = new Set(records.map((record) =>
    JSON.stringify(record.configuration)
  ));
  assertEvaluation(
    configurations.size === 1,
    "record set must use one host, model, and effort",
  );
  const latestRecords = [];
  for (const expectedRun of expected) {
    const key = baseRunKey(expectedRun);
    const attempts = records
      .filter((record) => baseRunKey(record.specification) === key)
      .sort((left, right) => (
        left.specification.attempt - right.specification.attempt
      ));
    assertEvaluation(attempts.length >= 1, `record set is missing run ${key}`);
    assertEvaluation(
      attempts.every((record, index) => record.specification.attempt === index + 1),
      `run ${key} has a gap in its attempt ledger`,
    );
    assertEvaluation(
      attempts.slice(0, -1).every((record) => (
        record.outcome.status === "failed"
        && record.outcome.failure.retryable === true
      )),
      `run ${key} retries an attempt that was not a retryable host failure`,
    );
    latestRecords.push(attempts.at(-1));
  }
  const provenance = validateHopeModelEvaluationRecordSetProvenance(
    records,
    {
      feature: "diff-teaching-evaluation",
      plannedRunKeys: expected.map(baseRunKey),
      runKey: baseRunKey,
      version: DIFF_TEACHING_EVALUATION_VERSION,
    },
    dependencies,
  );
  const passedRuns = latestRecords.filter(
    (record) => record.evaluation.runPassed,
  ).length;
  const failedAttempts = records.filter(
    (record) => record.outcome.status === "failed"
      || !record.evaluation.runPassed,
  ).length;
  const releaseReady = provenance.kind === "host-attested"
    && passedRuns === expected.length;
  return Object.freeze({
    byLocale: count(records, "locale", ["ko-KR", "en-US"]),
    byScenario: count(records, "scenario", [
      "data-flow-value",
      "static-relationship",
      "grounded-primer",
      "background-sufficient",
      "primer-unsupported",
    ]),
    configuration: records[0].configuration,
    decision: releaseReady ? "release-ready" : "release-blocked",
    feature: "diff-teaching-evaluation-result",
    provenance,
    records: Object.freeze(records),
    summary: Object.freeze({
      failedAttempts,
      failedRuns: expected.length - passedRuns,
      passedRuns,
      releaseReady,
      totalAttempts: records.length,
      totalRuns: expected.length,
    }),
    version: DIFF_TEACHING_EVALUATION_VERSION,
  });
}
