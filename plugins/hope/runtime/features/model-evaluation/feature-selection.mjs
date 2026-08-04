// Generated from features/model-evaluation/feature-selection.mjs. Do not edit.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  createHopeModelEvaluationProvenance,
  validateHopeModelEvaluationProvenance,
  validateHopeModelEvaluationReceiptSetProvenance,
} from "./evidence.mjs";

export const HOPE_FEATURE_SELECTION_CONTRACT_VERSION = 2;
export const HOPE_FEATURE_SELECTION_EVALUATION_VERSION = 3;

export const hopeFeatureSelectionEvaluationLimits = Object.freeze({
  outputBytes: 16 * 1024,
  reasonCharacters: 2048,
  receiptBytes: 64 * 1024,
  receiptSetBytes: 2 * 1024 * 1024,
});

export const HOPE_FEATURE_SELECTION_DECISIONS = Object.freeze([
  "align",
  "diff",
  "polish",
  "settings",
  "sweep",
  "toxic-review",
  "write",
  "none",
]);

export const HOPE_FEATURE_SELECTION_VARIANTS = Object.freeze([
  "minimal",
  "full",
]);

const fullDescriptions = Object.freeze({
  align:
    "Align a person and AI on a task before implementation by finding important misunderstandings, adapting the interview to risk, and rendering the current shared understanding. Use when someone invokes $hope:align in Codex or /hope:align in Claude Code, asks to align before coding, wants requirements or design clarified before implementation, or needs a pre-implementation shared-understanding check.",
  diff:
    "Explain a GitHub pull request as one evidence-linked Hope review. Use when someone invokes $hope:diff in Codex or /hope:diff in Claude Code, asks about Hope Diff or its capabilities, asks to understand a PR, asks Hope to review the current or latest authored PR, or replies to a pending Hope Diff confirmation. A PR URL is optional when the session is inside the intended GitHub repository.",
  polish:
    "Refine a named completed work product without silently changing its behavior, public contract, or core meaning. Use when someone invokes $hope:polish in Codex or /hope:polish in Claude Code, asks for one bounded cleanup, simplification, deduplication, consolidation, or refactor of code, tests, documentation, comments, examples, errors, or another result, or wants a finalization pass before approval. Use Hope Write for a standalone language-only draft, edit, or review unless the person explicitly requests the full Polish contract.",
  settings:
    "Show, set, or reset the global Hope language and theme preferences shared by the harness and plugin. Use when someone invokes $hope:settings in Codex, /hope:settings in Claude Code, or asks to change Hope's default language or light, dark, or system theme.",
  sweep:
    "Inspect one exact codebase snapshot for broad maintenance needs, show a bounded plan, and apply only digest-bound behavior-preserving work that the person approves. Use when someone invokes $hope:sweep in Codex or /hope:sweep in Claude Code, asks for codebase maintenance, wants dead or stale work removed, wants repeated, missing, or premature abstractions corrected, or needs tests, documentation, dependencies, security, licenses, compatibility, performance, packaging, CI, architecture, support, release, or recovery readiness checked without fixed schedule profiles.",
  "toxic-review":
    "Strictly review an idea, requirement, UI, prototype, plan, implementation, patch, PR, Align result, Diff result, incident analysis, recovery plan, document, or other work product without attacking people or manufacturing criticism. Use when someone invokes $hope:toxic-review in Codex or /hope:toxic-review in Claude Code, asks for a toxic review, wants a harsh or skeptical review, or needs independent risk-focused reviewers and one adjudicated result.",
  write:
    "Draft, edit, or review clear language without losing meaning, facts, uncertainty, or voice. Use when someone invokes $hope:write in Codex or /hope:write in Claude Code, works on documentation or other prose, or would benefit from clearer prompts, instructions, responses, interface text, errors, comments, or names inside implementation work.",
});

const minimalDescriptions = Object.freeze({
  align:
    "Use before implementation to resolve material misunderstandings about requirements, scope, design, or expected behavior.",
  diff:
    "Use to explain a GitHub pull request as an evidence-linked review, including a pending Hope Diff confirmation.",
  polish:
    "Use for one bounded cleanup or refactor of a named completed work product while preserving behavior and meaning.",
  settings:
    "Use to show, set, or reset Hope's language or theme.",
  sweep:
    "Use to inspect a codebase for broad maintenance, show a bounded plan, and apply only exact approved behavior-preserving work.",
  "toxic-review":
    "Use for a strict, skeptical, risk-focused review of a named work product without attacking people or inventing criticism.",
  write:
    "Use for a standalone language-only draft, edit, or review that must preserve meaning, facts, uncertainty, and voice.",
});

export const hopeFeatureSelectionDescriptions = Object.freeze({
  full: fullDescriptions,
  minimal: minimalDescriptions,
});

const sharedRules = Object.freeze([
  "Choose exactly one decision from the published decision list.",
  "An explicit $hope:<name> or /hope:<name> invocation selects that feature unless the person cancels or replaces the request.",
  "Choose none when the request is ordinary implementation, testing, Git, research, or another task that does not ask for a Hope feature's job.",
  "Choose Diff for understanding or explaining a pull request. Choose Toxic Review only when the person asks for a harsh, skeptical, adversarial, or explicitly toxic review.",
  "Choose Write for standalone language work. Choose Polish for one bounded cleanup or refactor of a named completed work product, including code or structural changes.",
  "Choose Sweep for broad codebase maintenance discovery that must show a bounded plan and ask for exact work-unit approval before applying behavior-preserving work.",
  "Choose Align only before implementation when a shared-understanding check or material requirement or design clarification is the requested result.",
]);

function featuresFor(descriptions) {
  return Object.freeze(Object.entries(descriptions).map(([id, description]) =>
    Object.freeze({ description, id })
  ));
}

export function createHopeFeatureSelectionContract({
  variant = "full",
} = {}) {
  if (!HOPE_FEATURE_SELECTION_VARIANTS.includes(variant)) {
    throw new TypeError(`Unknown Hope feature-selection variant: ${variant}`);
  }
  const descriptions = hopeFeatureSelectionDescriptions[variant];
  return Object.freeze({
    decisions: HOPE_FEATURE_SELECTION_DECISIONS,
    feature: "hope-feature-selection",
    features: featuresFor(descriptions),
    none: Object.freeze({
      description:
        "The request does not ask for one of the published Hope feature jobs.",
      id: "none",
    }),
    output: Object.freeze({
      decision:
        "Return exactly one published decision and do not execute the selected feature.",
      reason:
        "Give one short reason grounded in the request and feature boundary.",
    }),
    rules: variant === "full" ? sharedRules : Object.freeze([
      sharedRules[0],
      sharedRules[1],
      sharedRules[2],
    ]),
    variant,
    version: HOPE_FEATURE_SELECTION_CONTRACT_VERSION,
  });
}

function syntheticInput(request) {
  return Object.freeze({
    contentIsSynthetic: true,
    request,
  });
}

export const hopeFeatureSelectionEvaluationCases = Object.freeze([
  Object.freeze({
    id: "selection-01",
    input: syntheticInput(
      "구현 전에 결제 실패 처리의 범위와 성공 조건부터 나와 맞춰줘.",
    ),
    oracle: Object.freeze({ expectedDecision: "align" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-02",
    input: syntheticInput(
      "Explain the current pull request and link each conclusion to its evidence.",
    ),
    oracle: Object.freeze({ expectedDecision: "diff" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-03",
    input: syntheticInput(
      "완성된 인증 모듈을 동작은 바꾸지 말고 한 번만 정리해줘. 중복 테스트와 이름도 함께 다듬어줘.",
    ),
    oracle: Object.freeze({ expectedDecision: "polish" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-04",
    input: syntheticInput(
      "Edit this error message for clarity only. Keep its meaning and uncertainty unchanged.",
    ),
    oracle: Object.freeze({ expectedDecision: "write" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-05",
    input: syntheticInput(
      "이 배포 계획을 독하게 검토해줘. 억지 지적은 만들지 말고 위험이 큰 문제만 판정해줘.",
    ),
    oracle: Object.freeze({ expectedDecision: "toxic-review" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-06",
    input: syntheticInput(
      "Set Hope's language to Korean and its theme to dark.",
    ),
    oracle: Object.freeze({ expectedDecision: "settings" }),
    runs: 1,
    suite: "conformance",
  }),
  Object.freeze({
    id: "selection-07",
    input: syntheticInput(
      "실패한 단위 테스트의 원인을 찾아 고치고 검증해줘.",
    ),
    oracle: Object.freeze({ expectedDecision: "none" }),
    runs: 1,
    suite: "safety",
  }),
  Object.freeze({
    id: "selection-08",
    input: syntheticInput(
      "이 저장소 전체의 죽은 코드, 낡은 문서, 테스트 공백을 점검하고 파일을 바꾸기 전에 승인할 계획을 보여줘.",
    ),
    oracle: Object.freeze({ expectedDecision: "sweep" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-09",
    input: syntheticInput(
      "Use $hope:sweep to find stale abstractions and CI waste, then apply only the exact behavior-preserving work I approve.",
    ),
    oracle: Object.freeze({ expectedDecision: "sweep" }),
    runs: 1,
    suite: "conformance",
  }),
  Object.freeze({
    id: "selection-10",
    input: syntheticInput(
      "Yes, continue with the Hope Diff review for PR #741 that you just asked me to confirm.",
    ),
    oracle: Object.freeze({ expectedDecision: "diff" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-11",
    input: syntheticInput(
      "완성된 README의 구조는 건드리지 말고 문장만 더 명확하게 고쳐줘. 의미와 불확실성은 유지해줘.",
    ),
    oracle: Object.freeze({ expectedDecision: "write" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-12",
    input: syntheticInput(
      "Review this pull request harshly for release risks. Do not invent criticism, and return one adjudicated result.",
    ),
    oracle: Object.freeze({ expectedDecision: "toxic-review" }),
    runs: 1,
    suite: "boundary",
  }),
  Object.freeze({
    id: "selection-13",
    input: syntheticInput(
      "Upgrade the database client to its next major version, fix the breaking API changes, and run the integration tests.",
    ),
    oracle: Object.freeze({ expectedDecision: "none" }),
    runs: 1,
    suite: "safety",
  }),
]);

export const hopeFeatureSelectionEvaluationProtocol = Object.freeze({
  hostInput:
    "Give a fresh host only the prepared brief, hostInput, and outputContract. Do not give it the oracle or another variant.",
  interpretation:
    "A synthetic complete set is test-only smoke evidence. Release evidence additionally requires trusted host attestations and complete-attempt verification, and still does not prove an untested plugin dispatcher made the same choice.",
  sameConfiguration: Object.freeze(["host", "model", "effort"]),
  storage:
    "Keep bounded receipts under ignored test-results/. CLI-created receipts are synthetic; release evidence must come through a trusted runner adapter.",
  variants: HOPE_FEATURE_SELECTION_VARIANTS,
  version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
});

export const hopeFeatureSelectionEvaluationOutputContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    decision: `Return exactly one of ${HOPE_FEATURE_SELECTION_DECISIONS.join(", ")}.`,
    reason: "Give one short reason grounded in the request and feature boundary.",
  }),
  format: "Return one JSON object and no surrounding prose.",
});

function evaluationError(message) {
  return new TypeError(`Invalid Hope feature-selection evaluation: ${message}`);
}

function assertEvaluation(condition, message) {
  if (!condition) throw evaluationError(message);
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

export function digestHopeFeatureSelectionEvaluationValue(value) {
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

function positiveRun(value) {
  assertEvaluation(
    Number.isSafeInteger(value) && value > 0,
    "run must be a positive integer",
  );
  return value;
}

function findCase(caseId) {
  const evaluationCase = hopeFeatureSelectionEvaluationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown Hope feature-selection case: ${caseId}`);
  }
  return evaluationCase;
}

function expectedSpecifications() {
  return hopeFeatureSelectionEvaluationCases.flatMap((evaluationCase) =>
    HOPE_FEATURE_SELECTION_VARIANTS.flatMap((variant) => Array.from(
      { length: evaluationCase.runs },
      (_, index) => Object.freeze({
        caseId: evaluationCase.id,
        run: index + 1,
        suite: evaluationCase.suite,
        variant,
      }),
    ))
  );
}

function runKey({ caseId, run, variant }) {
  return `${caseId}:${variant}:${run}`;
}

function assertSupportedRun(evaluationCase, variant, run) {
  assertEvaluation(
    HOPE_FEATURE_SELECTION_VARIANTS.includes(variant),
    `unknown variant ${variant}`,
  );
  positiveRun(run);
  assertEvaluation(
    run <= evaluationCase.runs,
    `case ${evaluationCase.id} variant ${variant} does not include run ${run}`,
  );
}

export function createHopeFeatureSelectionEvaluationPlan() {
  const runs = expectedSpecifications();
  return Object.freeze({
    contractVersion: HOPE_FEATURE_SELECTION_CONTRACT_VERSION,
    feature: "hope-feature-selection-evaluation",
    protocol: hopeFeatureSelectionEvaluationProtocol,
    runs: Object.freeze(runs),
    totalRuns: runs.length,
    version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
  });
}

export function prepareHopeFeatureSelectionEvaluationRun({
  caseId,
  run,
  variant,
}) {
  const evaluationCase = findCase(caseId);
  assertSupportedRun(evaluationCase, variant, run);
  const brief = createHopeFeatureSelectionContract({ variant });
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: hopeFeatureSelectionEvaluationOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestHopeFeatureSelectionEvaluationValue(brief),
    caseId,
    contractVersion: HOPE_FEATURE_SELECTION_CONTRACT_VERSION,
    feature: "hope-feature-selection-evaluation-run",
    hostInput,
    inputDigest: digestHopeFeatureSelectionEvaluationValue(preparedInput),
    outputContract: hopeFeatureSelectionEvaluationOutputContract,
    run,
    suite: evaluationCase.suite,
    variant,
    version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
  });
}

export function getHopeFeatureSelectionEvaluationOracle(caseId) {
  const evaluationCase = findCase(caseId);
  return Object.freeze({
    caseId,
    expectedDecision: evaluationCase.oracle.expectedDecision,
    suite: evaluationCase.suite,
  });
}

export function validateHopeFeatureSelectionEvaluationOutput(value) {
  exactKeys(value, ["decision", "reason"], "output");
  assertEvaluation(
    HOPE_FEATURE_SELECTION_DECISIONS.includes(value.decision),
    "output.decision is not published",
  );
  return Object.freeze({
    decision: value.decision,
    reason: boundedText(
      value.reason,
      "output.reason",
      hopeFeatureSelectionEvaluationLimits.reasonCharacters,
    ),
  });
}

function createEvaluation(evaluationCase, output) {
  const decisionMatched = output.decision === evaluationCase.oracle.expectedDecision;
  return Object.freeze({
    decisionMatched,
    expectedDecision: evaluationCase.oracle.expectedDecision,
    runPassed: decisionMatched,
  });
}

export function createHopeFeatureSelectionEvaluationReceipt({
  attestation,
  caseId,
  effort,
  host,
  invocationId,
  model,
  output,
  run,
  variant,
}, dependencies = {}) {
  const prepared = prepareHopeFeatureSelectionEvaluationRun({
    caseId,
    run,
    variant,
  });
  const evaluationCase = findCase(caseId);
  const normalizedOutput = validateHopeFeatureSelectionEvaluationOutput(output);
  const evaluation = createEvaluation(evaluationCase, normalizedOutput);
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestHopeFeatureSelectionEvaluationValue(normalizedOutput),
  });
  const configuration = Object.freeze({
    effort: boundedText(effort, "configuration.effort"),
    host: boundedText(host, "configuration.host"),
    model: boundedText(model, "configuration.model"),
  });
  const invocation = Object.freeze({
    id: boundedText(invocationId, "invocation.id"),
  });
  const specification = Object.freeze({
    caseId,
    contractVersion: prepared.contractVersion,
    run,
    suite: prepared.suite,
    variant,
  });
  const statement = Object.freeze({
    configuration,
    evaluation: Object.freeze({
      bindings,
      feature: "hope-feature-selection-evaluation-receipt",
      version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
    }),
    invocation,
    specification,
  });
  const provenance = createHopeModelEvaluationProvenance(
    { attestation, statement },
    dependencies,
  );
  const receipt = Object.freeze({
    bindings,
    configuration,
    evaluation,
    feature: "hope-feature-selection-evaluation-receipt",
    invocation,
    output: normalizedOutput,
    provenance,
    specification,
    version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
  });
  return Object.freeze({ evaluation, receipt });
}

export function validateHopeFeatureSelectionEvaluationReceipt(
  value,
  dependencies = {},
) {
  exactKeys(value, [
    "bindings",
    "configuration",
    "evaluation",
    "feature",
    "invocation",
    "output",
    "provenance",
    "specification",
    "version",
  ], "receipt");
  assertEvaluation(
    value.feature === "hope-feature-selection-evaluation-receipt",
    "receipt.feature is invalid",
  );
  assertEvaluation(
    value.version === HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
    `receipt.version must be ${HOPE_FEATURE_SELECTION_EVALUATION_VERSION}`,
  );
  exactKeys(
    value.specification,
    ["caseId", "contractVersion", "run", "suite", "variant"],
    "receipt.specification",
  );
  const prepared = prepareHopeFeatureSelectionEvaluationRun({
    caseId: value.specification.caseId,
    run: value.specification.run,
    variant: value.specification.variant,
  });
  assertEvaluation(
    value.specification.contractVersion === prepared.contractVersion
      && value.specification.suite === prepared.suite,
    "receipt.specification does not match the prepared run",
  );
  exactKeys(
    value.configuration,
    ["effort", "host", "model"],
    "receipt.configuration",
  );
  const configuration = Object.freeze({
    effort: boundedText(value.configuration.effort, "configuration.effort"),
    host: boundedText(value.configuration.host, "configuration.host"),
    model: boundedText(value.configuration.model, "configuration.model"),
  });
  exactKeys(value.invocation, ["id"], "receipt.invocation");
  const invocation = Object.freeze({
    id: boundedText(value.invocation.id, "invocation.id"),
  });
  const output = validateHopeFeatureSelectionEvaluationOutput(value.output);
  const evaluation = createEvaluation(findCase(value.specification.caseId), output);
  exactKeys(
    value.evaluation,
    ["decisionMatched", "expectedDecision", "runPassed"],
    "receipt.evaluation",
  );
  assertEvaluation(
    isDeepStrictEqual(value.evaluation, evaluation),
    "receipt.evaluation does not match the bound output and oracle",
  );
  exactKeys(
    value.bindings,
    ["briefDigest", "inputDigest", "outputDigest"],
    "receipt.bindings",
  );
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestHopeFeatureSelectionEvaluationValue(output),
  });
  assertEvaluation(
    isDeepStrictEqual(value.bindings, bindings),
    "receipt.bindings do not match the prepared run and output",
  );
  const statement = Object.freeze({
    configuration,
    evaluation: Object.freeze({
      bindings,
      feature: value.feature,
      version: value.version,
    }),
    invocation,
    specification: Object.freeze({ ...value.specification }),
  });
  const provenance = validateHopeModelEvaluationProvenance(
    value.provenance,
    statement,
    dependencies,
  );
  return Object.freeze({
    evaluation,
    receipt: Object.freeze({
      bindings,
      configuration,
      evaluation,
      feature: value.feature,
      invocation,
      output,
      provenance,
      specification: Object.freeze({ ...value.specification }),
      version: value.version,
    }),
  });
}

function countBy(receipts, field, values) {
  return Object.fromEntries(values.map((value) => {
    const selected = receipts.filter(
      (receipt) => receipt.specification[field] === value,
    );
    return [value, Object.freeze({
      failed: selected.filter((receipt) => !receipt.evaluation.runPassed).length,
      passed: selected.filter((receipt) => receipt.evaluation.runPassed).length,
      total: selected.length,
    })];
  }));
}

export function validateHopeFeatureSelectionEvaluationReceiptSet(
  values,
  dependencies = {},
) {
  assertEvaluation(Array.isArray(values), "receipt set must be an array");
  const expected = expectedSpecifications();
  assertEvaluation(
    values.length === expected.length,
    `receipt set must contain ${expected.length} runs`,
  );
  const receipts = values.map(
    (value) => validateHopeFeatureSelectionEvaluationReceipt(
      value,
      dependencies,
    ).receipt,
  );
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
  const invocationIds = receipts.map((receipt) => receipt.invocation.id);
  assertEvaluation(
    new Set(invocationIds).size === invocationIds.length,
    "receipt set repeats an invocation identity",
  );
  const configurations = new Set(receipts.map((receipt) => JSON.stringify(
    receipt.configuration,
  )));
  assertEvaluation(
    configurations.size === 1,
    "receipt set must use one host, model, and effort",
  );
  const provenance = validateHopeModelEvaluationReceiptSetProvenance(
    receipts,
    {
      feature: "hope-feature-selection-evaluation",
      plannedRunKeys: expected.map(runKey),
      runKey,
      version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
    },
    dependencies,
  );
  const passedRuns = receipts.filter(
    (receipt) => receipt.evaluation.runPassed,
  ).length;
  const summary = Object.freeze({
    candidateMinimal: passedRuns === receipts.length,
    failedRuns: receipts.length - passedRuns,
    passedRuns,
    totalRuns: receipts.length,
  });
  return Object.freeze({
    bySuite: Object.freeze(countBy(
      receipts,
      "suite",
      [...new Set(hopeFeatureSelectionEvaluationCases.map(
        (evaluationCase) => evaluationCase.suite,
      ))],
    )),
    byVariant: Object.freeze(countBy(
      receipts,
      "variant",
      HOPE_FEATURE_SELECTION_VARIANTS,
    )),
    configuration: receipts[0].configuration,
    decision: summary.candidateMinimal ? "candidate-minimal" : "keep-full",
    feature: "hope-feature-selection-evaluation-result",
    provenance,
    receipts: Object.freeze(receipts),
    summary,
    version: HOPE_FEATURE_SELECTION_EVALUATION_VERSION,
  });
}
