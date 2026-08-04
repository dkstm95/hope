import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { createWritingBrief, WRITE_BRIEF_VERSION } from "../write/index.mjs";

import {
  createHopeModelEvaluationProvenance,
  validateHopeModelEvaluationProvenance,
  validateHopeModelEvaluationReceiptSetProvenance,
} from "./evidence.mjs";

export const HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION = 1;

export const hopeWritePlainLanguageEvaluationLimits = Object.freeze({
  evidenceCharacters: 2048,
  outputBytes: 16 * 1024,
  receiptBytes: 128 * 1024,
  receiptSetBytes: 2 * 1024 * 1024,
  revisionCharacters: 8192,
});

export const hopeWritePlainLanguageCriteria = Object.freeze([
  Object.freeze({
    id: "plain-for-intended-reader",
    instruction:
      "Judge whether the intended reader can identify the actors, actions, conditions, relationships, and next step without unpacking the sentence structure. Do not penalize a necessary precise term merely for being specialist language.",
  }),
  Object.freeze({
    id: "natural-target-language",
    instruction:
      "Judge the revision as original prose in the target language, including natural word order, references, and word combinations.",
  }),
  Object.freeze({
    id: "only-needed-repairs",
    instruction:
      "Judge whether the revision applies only repairs supported by a concrete clarity problem and avoids forced actors, explanations, relationship labels, or sentence breaks.",
  }),
]);

function syntheticInput({ artifact, constraints, request }) {
  return Object.freeze({
    artifact: Object.freeze(structuredClone(artifact)),
    constraints: Object.freeze([...constraints]),
    contentIsSynthetic: true,
    request,
  });
}

function assertion(id, requirement) {
  return Object.freeze({ id, requirement });
}

export const hopeWritePlainLanguageEvaluationCases = Object.freeze([
  Object.freeze({
    id: "write-plain-language-01",
    input: syntheticInput({
      artifact: {
        audience: "일반 사용자",
        format: "한국어 서비스 안내문",
        text: "계정 소유자 확인 절차가 완료되지 않은 상태에서는 데이터 이전 작업의 개시가 불가하므로, 확인 절차의 선행 완료 후 이전 작업을 재시도하여 주시기 바랍니다.",
      },
      constraints: [
        "계정 소유자 확인을 먼저 완료해야 한다.",
        "확인이 끝난 뒤 데이터 이전을 다시 시도해야 한다.",
      ],
      request: "두 필수 행동을 유지하면서 안내문을 독자에 맞게 고치세요.",
    }),
    oracle: Object.freeze({
      assertions: Object.freeze([
        assertion("verification-first", "계정 소유자 확인을 먼저 완료해야 한다는 조건이 남아 있다."),
        assertion("retry-after-verification", "확인이 끝난 뒤 데이터 이전을 다시 시도해야 한다는 순서가 남아 있다."),
      ]),
    }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-plain-language-02",
    input: syntheticInput({
      artifact: {
        audience: "API를 처음 연동하는 개발자",
        format: "한국어 API 도움말",
        text: "결제 생성 요청에는 멱등성 키를 사용할 수 있습니다. 이것은 같은 요청에 같은 키가 제공되는 경우 그 처리가 중복으로 발생하지 않도록 하는 데 사용됩니다.",
      },
      constraints: [
        "정확한 제품 용어인 ‘멱등성 키’를 유지해야 한다.",
        "같은 요청에 같은 키를 보내면 중복 결제를 막는다는 동작을 유지해야 한다.",
      ],
      request: "제품 용어와 동작을 유지하면서 도움말을 독자에 맞게 고치세요.",
    }),
    oracle: Object.freeze({
      assertions: Object.freeze([
        assertion("keep-idempotency-key", "정확한 제품 용어인 ‘멱등성 키’가 남아 있다."),
        assertion("prevent-duplicate-payment", "같은 요청에 같은 키를 보내면 중복 결제를 막는다는 동작이 남아 있다."),
        assertion("clear-reference", "멱등성 키의 역할을 불확실한 대명사 없이 설명한다."),
      ]),
    }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-plain-language-03",
    input: syntheticInput({
      artifact: {
        audience: "workspace administrators",
        format: "English setup guide",
        text: "Following approval of the export by Finance, its delivery to the workspace owner is performed by Support, which must occur before they can archive it.",
      },
      constraints: [
        "Finance approves the export.",
        "Support delivers the approved export to the workspace owner.",
        "The workspace owner can archive the export only after delivery.",
      ],
      request: "Revise the setup guide for its stated audience while preserving the workflow.",
    }),
    oracle: Object.freeze({
      assertions: Object.freeze([
        assertion("finance-approves", "Finance remains responsible for approving the export."),
        assertion("support-delivers", "Support remains responsible for delivering the approved export to the workspace owner."),
        assertion("owner-archives-after", "The workspace owner can archive the export only after delivery."),
      ]),
    }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-plain-language-04",
    input: syntheticInput({
      artifact: {
        audience: "온라인 주문 고객",
        format: "한국어 배송 안내",
        text: "기상 상황에 따라 익일 배송이 지연될 수 있는 가능성이 존재하나, 냉장 상품의 경우 품질 유지를 위해 지연 발생 시 주문 취소가 이루어질 수 있음을 안내드립니다.",
      },
      constraints: [
        "날씨 때문에 다음 날 배송이 지연될 수 있다는 불확실성을 유지해야 한다.",
        "냉장 상품은 품질 유지를 위해 지연 시 주문이 취소될 수 있다는 예외를 유지해야 한다.",
        "취소가 확정이 아니라 가능성이라는 점을 유지해야 한다.",
      ],
      request: "불확실성과 예외를 유지하면서 배송 안내를 독자에 맞게 고치세요.",
    }),
    oracle: Object.freeze({
      assertions: Object.freeze([
        assertion("weather-delay-uncertain", "날씨 때문에 다음 날 배송이 지연될 수 있다는 불확실성이 남아 있다."),
        assertion("chilled-order-exception", "냉장 상품은 품질 유지를 위해 지연 시 주문이 취소될 수 있다는 예외가 남아 있다."),
        assertion("cancellation-not-certain", "주문 취소를 확정된 결과로 바꾸지 않는다."),
      ]),
    }),
    suite: "conformance",
  }),
]);

export const hopeWritePlainLanguageOutputContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    revision: "Return the complete revised passage in the artifact's target language.",
  }),
  format: "Return one JSON object and no surrounding prose.",
});

export const hopeWritePlainLanguageAssessmentContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    assertions:
      "Return every supplied preservation assertion in order with id, passed, and brief evidence from the revision.",
    criteria:
      "Return every supplied reader-oriented criterion in order with id, passed, and a brief rationale.",
    overallPassed:
      "Return true only when every preservation assertion and every criterion passes.",
  }),
  format: "Return one JSON object and no surrounding prose.",
});

export const hopeWritePlainLanguageEvaluationProtocol = Object.freeze({
  assessment:
    "After the writer returns, give a fresh evaluator only the prepared evaluatorInput and assessmentContract. The evaluator must not receive the writer identity, model, effort, invocation, provenance, decision label, or a reference revision.",
  decision:
    "Accept the plain-language behavior only when all generated revisions pass every preservation assertion and reader-oriented criterion in host-attested writer and evaluator campaigns.",
  hostInput:
    "Give a fresh writer only the exact active edit brief, hostInput, and outputContract. Do not reveal the assertions, rubric, another case, or an earlier output.",
  interpretation:
    "Decision-label results are secondary routing evidence. This suite observes generated prose, but a passing bounded campaign does not prove clarity for every reader or domain.",
  storage:
    "Keep bounded receipts under ignored test-results/. CLI-created receipts are synthetic; release evidence requires trusted writer and evaluator attestations plus complete-attempt ledgers.",
  version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
});

function fail(message) {
  throw new TypeError(`Invalid Hope Write plain-language evaluation: ${message}`);
}

function assertEvaluation(condition, message) {
  if (!condition) fail(message);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [
      key,
      canonicalValue(value[key]),
    ]));
  }
  return value;
}

export function digestHopeWritePlainLanguageEvaluationValue(value) {
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

function boundedText(value, label, maximum = 256) {
  assertEvaluation(
    typeof value === "string"
      && value.trim().length > 0
      && [...value].length <= maximum,
    `${label} must be text between 1 and ${maximum} characters`,
  );
  return value;
}

function findCase(caseId) {
  const evaluationCase = hopeWritePlainLanguageEvaluationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown Hope Write plain-language case: ${caseId}`);
  }
  return evaluationCase;
}

function assertRun(run) {
  assertEvaluation(run === 1, "each plain-language case contains exactly run 1");
}

function plannedRuns() {
  return hopeWritePlainLanguageEvaluationCases.map((evaluationCase) =>
    Object.freeze({
      caseId: evaluationCase.id,
      run: 1,
      suite: evaluationCase.suite,
    })
  );
}

function runKey({ caseId, run }) {
  return `${caseId}:${run}`;
}

async function exactActiveWriteBrief(dependencies, label) {
  const canonical = await createWritingBrief({ mode: "edit" });
  const candidate = await (
    dependencies.createBrief ?? createWritingBrief
  )({ mode: "edit" });
  assertEvaluation(
    isDeepStrictEqual(candidate, canonical),
    `${label} must match the complete canonical active Write brief`,
  );
  return canonical;
}

export function createHopeWritePlainLanguageEvaluationPlan() {
  const runs = plannedRuns();
  return Object.freeze({
    briefVersion: WRITE_BRIEF_VERSION,
    feature: "hope-write-plain-language-evaluation",
    protocol: hopeWritePlainLanguageEvaluationProtocol,
    runs: Object.freeze(runs),
    totalRuns: runs.length,
    version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
  });
}

export async function prepareHopeWritePlainLanguageEvaluationRun({
  caseId,
  run,
}, dependencies = {}) {
  const evaluationCase = findCase(caseId);
  assertRun(run);
  const brief = await exactActiveWriteBrief(dependencies, "writer brief");
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: hopeWritePlainLanguageOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestHopeWritePlainLanguageEvaluationValue(brief),
    caseId,
    feature: "hope-write-plain-language-evaluation-run",
    hostInput,
    inputDigest: digestHopeWritePlainLanguageEvaluationValue(preparedInput),
    outputContract: hopeWritePlainLanguageOutputContract,
    run,
    suite: evaluationCase.suite,
    version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
  });
}

export function getHopeWritePlainLanguageEvaluationOracle(caseId) {
  const evaluationCase = findCase(caseId);
  return Object.freeze({
    assertions: evaluationCase.oracle.assertions,
    caseId,
    criteria: hopeWritePlainLanguageCriteria,
    suite: evaluationCase.suite,
  });
}

export function validateHopeWritePlainLanguageOutput(value) {
  exactKeys(value, ["revision"], "output");
  return Object.freeze({
    revision: boundedText(
      value.revision,
      "output.revision",
      hopeWritePlainLanguageEvaluationLimits.revisionCharacters,
    ),
  });
}

export function prepareHopeWritePlainLanguageAssessment({
  caseId,
  output,
  run,
}) {
  const evaluationCase = findCase(caseId);
  assertRun(run);
  const normalizedOutput = validateHopeWritePlainLanguageOutput(output);
  const evaluatorInput = Object.freeze({
    assertions: evaluationCase.oracle.assertions,
    criteria: hopeWritePlainLanguageCriteria,
    source: structuredClone(evaluationCase.input),
    revision: normalizedOutput.revision,
  });
  return Object.freeze({
    assessmentContract: hopeWritePlainLanguageAssessmentContract,
    caseId,
    evaluatorInput,
    feature: "hope-write-plain-language-assessment-run",
    inputDigest: digestHopeWritePlainLanguageEvaluationValue({
      assessmentContract: hopeWritePlainLanguageAssessmentContract,
      evaluatorInput,
    }),
    outputDigest: digestHopeWritePlainLanguageEvaluationValue(normalizedOutput),
    run,
    suite: evaluationCase.suite,
    version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
  });
}

function normalizeJudgments(values, expected, label) {
  assertEvaluation(Array.isArray(values), `${label} must be an array`);
  assertEvaluation(
    values.length === expected.length,
    `${label} must contain ${expected.length} entries`,
  );
  return Object.freeze(values.map((value, index) => {
    exactKeys(value, ["evidence", "id", "passed"], `${label}[${index}]`);
    assertEvaluation(
      value.id === expected[index].id,
      `${label}[${index}].id must be ${expected[index].id}`,
    );
    assertEvaluation(
      typeof value.passed === "boolean",
      `${label}[${index}].passed must be a boolean`,
    );
    return Object.freeze({
      evidence: boundedText(
        value.evidence,
        `${label}[${index}].evidence`,
        hopeWritePlainLanguageEvaluationLimits.evidenceCharacters,
      ),
      id: value.id,
      passed: value.passed,
    });
  }));
}

export function validateHopeWritePlainLanguageAssessment(value, caseId) {
  const evaluationCase = findCase(caseId);
  exactKeys(
    value,
    ["assertions", "criteria", "overallPassed"],
    "assessment",
  );
  const assertions = normalizeJudgments(
    value.assertions,
    evaluationCase.oracle.assertions,
    "assessment.assertions",
  );
  const criteria = normalizeJudgments(
    value.criteria,
    hopeWritePlainLanguageCriteria,
    "assessment.criteria",
  );
  const derivedPass = [...assertions, ...criteria].every(
    (entry) => entry.passed,
  );
  assertEvaluation(
    value.overallPassed === derivedPass,
    "assessment.overallPassed must equal all assertion and criterion results",
  );
  return Object.freeze({ assertions, criteria, overallPassed: derivedPass });
}

function configuration({ effort, host, model }, label) {
  return Object.freeze({
    effort: boundedText(effort, `${label}.effort`),
    host: boundedText(host, `${label}.host`),
    model: boundedText(model, `${label}.model`),
  });
}

function invocation(id, label) {
  return Object.freeze({ id: boundedText(id, `${label}.id`) });
}

function statement({ bindings, configuration: selectedConfiguration, feature, invocation: selectedInvocation, specification }) {
  return Object.freeze({
    configuration: selectedConfiguration,
    evaluation: Object.freeze({
      bindings,
      feature,
      version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
    }),
    invocation: selectedInvocation,
    specification,
  });
}

function evaluationFor(assessment) {
  const assertionResults = assessment.assertions.map((entry) => entry.passed);
  const criterionResults = assessment.criteria.map((entry) => entry.passed);
  return Object.freeze({
    assertionsPassed: assertionResults.filter(Boolean).length,
    criteriaPassed: criterionResults.filter(Boolean).length,
    runPassed: assessment.overallPassed,
    totalAssertions: assertionResults.length,
    totalCriteria: criterionResults.length,
  });
}

export async function createHopeWritePlainLanguageEvaluationReceipt({
  assessment,
  caseId,
  evaluatorAttestation,
  evaluatorEffort,
  evaluatorHost,
  evaluatorInvocationId,
  evaluatorModel,
  output,
  run,
  writerAttestation,
  writerEffort,
  writerHost,
  writerInvocationId,
  writerModel,
}, dependencies = {}) {
  const prepared = await prepareHopeWritePlainLanguageEvaluationRun(
    { caseId, run },
    dependencies,
  );
  const normalizedOutput = validateHopeWritePlainLanguageOutput(output);
  const preparedAssessment = prepareHopeWritePlainLanguageAssessment({
    caseId,
    output: normalizedOutput,
    run,
  });
  const normalizedAssessment = validateHopeWritePlainLanguageAssessment(
    assessment,
    caseId,
  );
  const bindings = Object.freeze({
    assessmentDigest:
      digestHopeWritePlainLanguageEvaluationValue(normalizedAssessment),
    assessmentInputDigest: preparedAssessment.inputDigest,
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: preparedAssessment.outputDigest,
    rubricDigest: digestHopeWritePlainLanguageEvaluationValue({
      assertions: findCase(caseId).oracle.assertions,
      criteria: hopeWritePlainLanguageCriteria,
    }),
  });
  const specification = Object.freeze({
    caseId,
    run,
    suite: prepared.suite,
  });
  const writerConfiguration = configuration({
    effort: writerEffort,
    host: writerHost,
    model: writerModel,
  }, "writer.configuration");
  const writerInvocation = invocation(
    writerInvocationId,
    "writer.invocation",
  );
  const writerBindings = Object.freeze({
    briefDigest: bindings.briefDigest,
    inputDigest: bindings.inputDigest,
    outputDigest: bindings.outputDigest,
  });
  const evaluatorConfiguration = configuration({
    effort: evaluatorEffort,
    host: evaluatorHost,
    model: evaluatorModel,
  }, "evaluator.configuration");
  const evaluatorInvocation = invocation(
    evaluatorInvocationId,
    "evaluator.invocation",
  );
  assertEvaluation(
    writerInvocation.id !== evaluatorInvocation.id,
    "writer and evaluator must use different invocation identities",
  );
  const evaluatorBindings = Object.freeze({
    assessmentDigest: bindings.assessmentDigest,
    assessmentInputDigest: bindings.assessmentInputDigest,
    outputDigest: bindings.outputDigest,
    rubricDigest: bindings.rubricDigest,
  });
  const writerProvenance = createHopeModelEvaluationProvenance({
    attestation: writerAttestation,
    statement: statement({
      bindings: writerBindings,
      configuration: writerConfiguration,
      feature: "hope-write-plain-language-writer",
      invocation: writerInvocation,
      specification,
    }),
  }, dependencies);
  const evaluatorProvenance = createHopeModelEvaluationProvenance({
    attestation: evaluatorAttestation,
    statement: statement({
      bindings: evaluatorBindings,
      configuration: evaluatorConfiguration,
      feature: "hope-write-plain-language-evaluator",
      invocation: evaluatorInvocation,
      specification,
    }),
  }, dependencies);
  const evaluation = evaluationFor(normalizedAssessment);
  const receipt = Object.freeze({
    assessment: normalizedAssessment,
    bindings,
    evaluation,
    evaluator: Object.freeze({
      configuration: evaluatorConfiguration,
      invocation: evaluatorInvocation,
      provenance: evaluatorProvenance,
    }),
    feature: "hope-write-plain-language-evaluation-receipt",
    output: normalizedOutput,
    specification,
    version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
    writer: Object.freeze({
      configuration: writerConfiguration,
      invocation: writerInvocation,
      provenance: writerProvenance,
    }),
  });
  assertEvaluation(
    Buffer.byteLength(JSON.stringify(receipt), "utf8")
      <= hopeWritePlainLanguageEvaluationLimits.receiptBytes,
    "receipt exceeds the byte limit",
  );
  return Object.freeze({ evaluation, receipt });
}

function normalizeActor(value, label) {
  exactKeys(value, ["configuration", "invocation", "provenance"], label);
  return Object.freeze({
    configuration: configuration(value.configuration, `${label}.configuration`),
    invocation: (() => {
      exactKeys(value.invocation, ["id"], `${label}.invocation`);
      return invocation(value.invocation.id, `${label}.invocation`);
    })(),
    provenance: value.provenance,
  });
}

export async function validateHopeWritePlainLanguageEvaluationReceipt(
  value,
  dependencies = {},
) {
  exactKeys(value, [
    "assessment",
    "bindings",
    "evaluation",
    "evaluator",
    "feature",
    "output",
    "specification",
    "version",
    "writer",
  ], "receipt");
  assertEvaluation(
    value.feature === "hope-write-plain-language-evaluation-receipt",
    "receipt.feature is invalid",
  );
  assertEvaluation(
    value.version === HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
    `receipt.version must be ${HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION}`,
  );
  exactKeys(value.specification, ["caseId", "run", "suite"], "receipt.specification");
  const prepared = await prepareHopeWritePlainLanguageEvaluationRun(
    value.specification,
    dependencies,
  );
  assertEvaluation(
    value.specification.suite === prepared.suite,
    "receipt.specification does not match the prepared run",
  );
  const specification = Object.freeze({ ...value.specification });
  const output = validateHopeWritePlainLanguageOutput(value.output);
  const preparedAssessment = prepareHopeWritePlainLanguageAssessment({
    caseId: specification.caseId,
    output,
    run: specification.run,
  });
  const assessment = validateHopeWritePlainLanguageAssessment(
    value.assessment,
    specification.caseId,
  );
  exactKeys(value.bindings, [
    "assessmentDigest",
    "assessmentInputDigest",
    "briefDigest",
    "inputDigest",
    "outputDigest",
    "rubricDigest",
  ], "receipt.bindings");
  const bindings = Object.freeze({
    assessmentDigest: digestHopeWritePlainLanguageEvaluationValue(assessment),
    assessmentInputDigest: preparedAssessment.inputDigest,
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: preparedAssessment.outputDigest,
    rubricDigest: digestHopeWritePlainLanguageEvaluationValue({
      assertions: findCase(specification.caseId).oracle.assertions,
      criteria: hopeWritePlainLanguageCriteria,
    }),
  });
  assertEvaluation(
    isDeepStrictEqual(value.bindings, bindings),
    "receipt.bindings do not match the prepared run, output, and assessment",
  );
  const evaluation = evaluationFor(assessment);
  exactKeys(value.evaluation, [
    "assertionsPassed",
    "criteriaPassed",
    "runPassed",
    "totalAssertions",
    "totalCriteria",
  ], "receipt.evaluation");
  assertEvaluation(
    isDeepStrictEqual(value.evaluation, evaluation),
    "receipt.evaluation does not match the assessment",
  );
  const writer = normalizeActor(value.writer, "receipt.writer");
  const evaluator = normalizeActor(value.evaluator, "receipt.evaluator");
  assertEvaluation(
    writer.invocation.id !== evaluator.invocation.id,
    "writer and evaluator must use different invocation identities",
  );
  const writerBindings = Object.freeze({
    briefDigest: bindings.briefDigest,
    inputDigest: bindings.inputDigest,
    outputDigest: bindings.outputDigest,
  });
  const evaluatorBindings = Object.freeze({
    assessmentDigest: bindings.assessmentDigest,
    assessmentInputDigest: bindings.assessmentInputDigest,
    outputDigest: bindings.outputDigest,
    rubricDigest: bindings.rubricDigest,
  });
  const writerProvenance = validateHopeModelEvaluationProvenance(
    writer.provenance,
    statement({
      bindings: writerBindings,
      configuration: writer.configuration,
      feature: "hope-write-plain-language-writer",
      invocation: writer.invocation,
      specification,
    }),
    dependencies,
  );
  const evaluatorProvenance = validateHopeModelEvaluationProvenance(
    evaluator.provenance,
    statement({
      bindings: evaluatorBindings,
      configuration: evaluator.configuration,
      feature: "hope-write-plain-language-evaluator",
      invocation: evaluator.invocation,
      specification,
    }),
    dependencies,
  );
  return Object.freeze({
    evaluation,
    receipt: Object.freeze({
      assessment,
      bindings,
      evaluation,
      evaluator: Object.freeze({
        ...evaluator,
        provenance: evaluatorProvenance,
      }),
      feature: value.feature,
      output,
      specification,
      version: value.version,
      writer: Object.freeze({
        ...writer,
        provenance: writerProvenance,
      }),
    }),
  });
}

function actorEvidence(receipts, actor) {
  return receipts.map((receipt) => Object.freeze({
    invocation: receipt[actor].invocation,
    provenance: receipt[actor].provenance,
    specification: receipt.specification,
  }));
}

export async function validateHopeWritePlainLanguageEvaluationReceiptSet(
  values,
  dependencies = {},
) {
  assertEvaluation(Array.isArray(values), "receipt set must be an array");
  const expected = plannedRuns();
  assertEvaluation(
    values.length === expected.length,
    `receipt set must contain ${expected.length} runs`,
  );
  const validated = await Promise.all(values.map(
    async (value) => await validateHopeWritePlainLanguageEvaluationReceipt(
      value,
      dependencies,
    ),
  ));
  const receipts = validated.map((entry) => entry.receipt);
  const expectedKeys = new Set(expected.map(runKey));
  const actualKeys = receipts.map((receipt) => runKey(receipt.specification));
  assertEvaluation(
    new Set(actualKeys).size === actualKeys.length,
    "receipt set repeats a planned run",
  );
  assertEvaluation(
    actualKeys.every((key) => expectedKeys.has(key)),
    "receipt set contains an unplanned run",
  );
  const writerInvocations = receipts.map(
    (receipt) => receipt.writer.invocation.id,
  );
  const evaluatorInvocations = receipts.map(
    (receipt) => receipt.evaluator.invocation.id,
  );
  const allInvocations = [...writerInvocations, ...evaluatorInvocations];
  assertEvaluation(
    new Set(allInvocations).size === allInvocations.length,
    "receipt set repeats a writer or evaluator invocation identity",
  );
  assertEvaluation(
    new Set(receipts.map((receipt) => JSON.stringify(
      receipt.writer.configuration,
    ))).size === 1,
    "receipt set must use one writer host, model, and effort",
  );
  assertEvaluation(
    new Set(receipts.map((receipt) => JSON.stringify(
      receipt.evaluator.configuration,
    ))).size === 1,
    "receipt set must use one evaluator host, model, and effort",
  );
  const writerProvenance = validateHopeModelEvaluationReceiptSetProvenance(
    actorEvidence(receipts, "writer"),
    {
      feature: "hope-write-plain-language-writer",
      plannedRunKeys: expected.map(runKey),
      runKey,
      version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
    },
    dependencies,
  );
  const evaluatorProvenance = validateHopeModelEvaluationReceiptSetProvenance(
    actorEvidence(receipts, "evaluator"),
    {
      feature: "hope-write-plain-language-evaluator",
      plannedRunKeys: expected.map(runKey),
      runKey,
      version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
    },
    dependencies,
  );
  const passedRuns = receipts.filter(
    (receipt) => receipt.evaluation.runPassed,
  ).length;
  const provenance = Object.freeze({
    evaluator: evaluatorProvenance,
    writer: writerProvenance,
  });
  const accepted = passedRuns === receipts.length
    && writerProvenance.kind === "host-attested"
    && evaluatorProvenance.kind === "host-attested";
  return Object.freeze({
    decision: accepted
      ? "accept-plain-language-behavior"
      : "reject-plain-language-behavior",
    feature: "hope-write-plain-language-evaluation-result",
    provenance,
    receipts: Object.freeze(receipts),
    summary: Object.freeze({
      accepted,
      failedRuns: receipts.length - passedRuns,
      passedRuns,
      totalRuns: receipts.length,
    }),
    version: HOPE_WRITE_PLAIN_LANGUAGE_EVALUATION_VERSION,
  });
}
