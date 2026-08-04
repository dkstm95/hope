import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  createWritingBrief,
  loadWritingStandard,
  WRITE_BRIEF_VERSION,
} from "../write/index.mjs";

export const HOPE_WRITE_EXAMPLE_EVALUATION_VERSION = 1;
export const HOPE_WRITE_EXAMPLE_VARIANTS = Object.freeze([
  "rules-only",
  "full",
]);

export const HOPE_WRITE_EXAMPLE_DECISIONS = Object.freeze([
  "separate-independent-points",
  "consolidate-repeated-framing",
  "surface-with-established-structure",
  "preserve-material-claim",
  "keep-current-structure",
]);

export const hopeWriteExampleEvaluationLimits = Object.freeze({
  outputBytes: 16 * 1024,
  reasonCharacters: 2048,
  receiptBytes: 96 * 1024,
  receiptSetBytes: 3 * 1024 * 1024,
});

const EVALUATED_WRITE_DECISION_EXAMPLES = Object.freeze([
  Object.freeze({
    expectedDecision: "Put each independent point in its own paragraph.",
    id: "separate-independent-points",
    situation:
      "A prose paragraph contains two independent points, and the target format supports separate paragraphs.",
  }),
  Object.freeze({
    expectedDecision:
      "Consolidate the repeated framing, keep the version that best serves the target, and preserve standalone comprehension.",
    id: "remove-repeated-framing",
    situation:
      "The intended reading path always presents a heading, quote, and opening sentence together; they repeat the same problem and add no distinct meaning or voice.",
  }),
  Object.freeze({
    expectedDecision:
      "Use the least disruptive established semantic structure, and use a callout only when that convention supports one.",
    id: "surface-important-boundary",
    situation:
      "A prerequisite or limitation must be noticed, and the target or project already has an established semantic emphasis convention.",
  }),
  Object.freeze({
    expectedDecision:
      "Keep the claim or surface the choice instead of silently removing it.",
    id: "preserve-material-claim",
    situation:
      "An edit would delete, demote, or reorder a unique product claim, and the request does not explicitly authorize that content change.",
  }),
]);

async function createEvaluatedWritingBrief({ mode }, {
  loadStandard = loadWritingStandard,
} = {}) {
  assertEvaluation(mode === "edit", "evaluated Write mode must be edit");
  return Object.freeze({
    decisionExamples: EVALUATED_WRITE_DECISION_EXAMPLES,
    feature: "write",
    mode: "edit",
    response:
      "Change the requested target and lead with the completed result.\n\nPreserve a material ambiguity instead of silently choosing a new meaning.",
    standard: await loadStandard(),
    standardVersion: 2,
    version: 2,
  });
}

function syntheticInput({ candidateAction, situation }) {
  return Object.freeze({
    candidateAction,
    contentIsSynthetic: true,
    situation,
  });
}

export const hopeWriteExampleEvaluationCases = Object.freeze([
  Object.freeze({
    id: "write-example-01",
    input: syntheticInput({
      candidateAction:
        "Split the paragraph so each independent point has its own paragraph.",
      situation:
        "A Markdown paragraph explains the release decision and, independently, the support escalation path. The format permits separate paragraphs.",
    }),
    oracle: Object.freeze({ expectedDecision: "separate-independent-points" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-example-02",
    input: syntheticInput({
      candidateAction:
        "Consolidate the repeated framing while keeping the version that remains understandable on its own.",
      situation:
        "A heading, pull quote, and opening sentence always appear together, repeat the same problem, and add no distinct meaning or voice.",
    }),
    oracle: Object.freeze({ expectedDecision: "consolidate-repeated-framing" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-example-03",
    input: syntheticInput({
      candidateAction:
        "Use the target's existing warning callout for the prerequisite without inventing a new visual convention.",
      situation:
        "A prerequisite must be noticed before the reader follows the next step, and the target already uses warning callouts for prerequisites.",
    }),
    oracle: Object.freeze({
      expectedDecision: "surface-with-established-structure",
    }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-example-04",
    input: syntheticInput({
      candidateAction:
        "Keep the unique product claim and surface the unresolved content choice instead of deleting it.",
      situation:
        "A clarity edit would delete a unique product claim, but neither the request nor an authoritative source permits that content change.",
    }),
    oracle: Object.freeze({ expectedDecision: "preserve-material-claim" }),
    suite: "safety",
  }),
  Object.freeze({
    id: "write-example-05",
    input: syntheticInput({
      candidateAction:
        "Keep the two related sentences together because separating them would obscure their cause-and-effect relationship.",
      situation:
        "Two sentences form one short cause-and-effect explanation. Splitting them into separate paragraphs would harm flow and meaning.",
    }),
    oracle: Object.freeze({ expectedDecision: "keep-current-structure" }),
    suite: "safety",
  }),
  Object.freeze({
    id: "write-example-06",
    input: syntheticInput({
      candidateAction:
        "Keep the pull quote's self-contained wording because it is also reused outside the surrounding section.",
      situation:
        "A heading and nearby pull quote overlap, but the quote is reused alone elsewhere and would lose standalone comprehension if shortened.",
    }),
    oracle: Object.freeze({ expectedDecision: "keep-current-structure" }),
    suite: "safety",
  }),
]);

function plannedRuns() {
  return hopeWriteExampleEvaluationCases.flatMap((evaluationCase) =>
    HOPE_WRITE_EXAMPLE_VARIANTS.flatMap((variant) => [1, 2].map((run) =>
      Object.freeze({
        caseId: evaluationCase.id,
        run,
        suite: evaluationCase.suite,
        variant,
      })
    ))
  );
}

export const hopeWriteExampleEvaluationProtocol = Object.freeze({
  decision:
    "Remove the Write decision examples only when all 24 paired runs pass under one declared host, model, effort, and contract version.",
  hostInput:
    "Give a fresh host only the prepared brief, hostInput, and outputContract. Do not give it the oracle, another case, or the other variant.",
  interpretation:
    "A complete passing set is smoke evidence for one declared configuration. It does not prove equivalent writing quality outside the checked decisions.",
  storage:
    "Keep bounded receipts under ignored test-results/ or equivalent release evidence. Checked-in cases contain synthetic data only.",
  version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
});

export const hopeWriteExampleEvaluationOutputContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    decision: `Return exactly one of ${HOPE_WRITE_EXAMPLE_DECISIONS.join(", ")}.`,
    reason:
      "Give one short reason grounded in the prepared writing brief and synthetic situation.",
  }),
  format: "Return one JSON object and no surrounding prose.",
});

export const hopeWriteProductionVerificationProtocol = Object.freeze({
  decision:
    "Accept the active Write brief only when all six checked decisions pass in fresh contexts.",
  hostInput:
    "Give a fresh host only the exact active brief, hostInput, and outputContract. Do not give it the oracle or earlier output.",
  version: 1,
});

function evaluationError(message) {
  return new TypeError(`Invalid Hope Write example evaluation: ${message}`);
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

export function digestHopeWriteExampleEvaluationValue(value) {
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
  const evaluationCase = hopeWriteExampleEvaluationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown Hope Write example case: ${caseId}`);
  }
  return evaluationCase;
}

function assertRun(evaluationCase, variant, run) {
  assertEvaluation(
    HOPE_WRITE_EXAMPLE_VARIANTS.includes(variant),
    `unknown variant ${variant}`,
  );
  assertEvaluation(
    Number.isSafeInteger(run) && run >= 1 && run <= 2,
    `case ${evaluationCase.id} variant ${variant} requires run 1 or 2`,
  );
}

function withoutDecisionExamples(brief) {
  const { decisionExamples: omitted, ...rulesOnly } = brief;
  void omitted;
  return Object.freeze(rulesOnly);
}

export function createHopeWriteExampleEvaluationPlan() {
  const runs = plannedRuns();
  return Object.freeze({
    feature: "hope-write-example-evaluation",
    protocol: hopeWriteExampleEvaluationProtocol,
    runs: Object.freeze(runs),
    totalRuns: runs.length,
    version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
  });
}

function productionRuns() {
  return hopeWriteExampleEvaluationCases.map((evaluationCase) => Object.freeze({
    caseId: evaluationCase.id,
    run: 1,
    suite: evaluationCase.suite,
    variant: "production",
  }));
}

export function createHopeWriteProductionVerificationPlan() {
  const runs = productionRuns();
  return Object.freeze({
    briefVersion: WRITE_BRIEF_VERSION,
    feature: "hope-write-production-verification",
    protocol: hopeWriteProductionVerificationProtocol,
    runs: Object.freeze(runs),
    totalRuns: runs.length,
    version: hopeWriteProductionVerificationProtocol.version,
  });
}

export async function prepareHopeWriteExampleEvaluationRun({
  caseId,
  run,
  variant,
}, dependencies = {}) {
  const evaluationCase = findCase(caseId);
  assertRun(evaluationCase, variant, run);
  const fullBrief = await (
    dependencies.createBrief ?? createEvaluatedWritingBrief
  )({ mode: "edit" });
  const brief = variant === "full"
    ? fullBrief
    : withoutDecisionExamples(fullBrief);
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: hopeWriteExampleEvaluationOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestHopeWriteExampleEvaluationValue(brief),
    caseId,
    feature: "hope-write-example-evaluation-run",
    hostInput,
    inputDigest: digestHopeWriteExampleEvaluationValue(preparedInput),
    outputContract: hopeWriteExampleEvaluationOutputContract,
    run,
    suite: evaluationCase.suite,
    variant,
    version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
  });
}

export async function prepareHopeWriteProductionVerificationRun({
  caseId,
  run,
}, dependencies = {}) {
  const evaluationCase = findCase(caseId);
  assertEvaluation(run === 1, `production case ${caseId} requires run 1`);
  const brief = await (
    dependencies.createBrief ?? createWritingBrief
  )({ mode: "edit" });
  assertEvaluation(
    !Object.hasOwn(brief, "decisionExamples"),
    "active production brief still contains decisionExamples",
  );
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: hopeWriteExampleEvaluationOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestHopeWriteExampleEvaluationValue(brief),
    caseId,
    feature: "hope-write-production-verification-run",
    hostInput,
    inputDigest: digestHopeWriteExampleEvaluationValue(preparedInput),
    outputContract: hopeWriteExampleEvaluationOutputContract,
    run,
    suite: evaluationCase.suite,
    variant: "production",
    version: hopeWriteProductionVerificationProtocol.version,
  });
}

export function getHopeWriteExampleEvaluationOracle(caseId) {
  const evaluationCase = findCase(caseId);
  return Object.freeze({
    caseId,
    expectedDecision: evaluationCase.oracle.expectedDecision,
    suite: evaluationCase.suite,
  });
}

export function validateHopeWriteExampleEvaluationOutput(value) {
  exactKeys(value, ["decision", "reason"], "output");
  assertEvaluation(
    HOPE_WRITE_EXAMPLE_DECISIONS.includes(value.decision),
    "output.decision is not published",
  );
  return Object.freeze({
    decision: value.decision,
    reason: boundedText(
      value.reason,
      "output.reason",
      hopeWriteExampleEvaluationLimits.reasonCharacters,
    ),
  });
}

function evaluationFor(evaluationCase, output) {
  const decisionMatched = output.decision
    === evaluationCase.oracle.expectedDecision;
  return Object.freeze({
    decisionMatched,
    expectedDecision: evaluationCase.oracle.expectedDecision,
    runPassed: decisionMatched,
  });
}

export async function createHopeWriteExampleEvaluationReceipt({
  caseId,
  effort,
  host,
  invocationId,
  model,
  output,
  run,
  variant,
}, dependencies = {}) {
  const prepared = await prepareHopeWriteExampleEvaluationRun(
    { caseId, run, variant },
    dependencies,
  );
  const normalizedOutput = validateHopeWriteExampleEvaluationOutput(output);
  const evaluation = evaluationFor(findCase(caseId), normalizedOutput);
  const receipt = Object.freeze({
    bindings: Object.freeze({
      briefDigest: prepared.briefDigest,
      inputDigest: prepared.inputDigest,
      outputDigest: digestHopeWriteExampleEvaluationValue(normalizedOutput),
    }),
    configuration: Object.freeze({
      effort: boundedText(effort, "configuration.effort"),
      host: boundedText(host, "configuration.host"),
      model: boundedText(model, "configuration.model"),
    }),
    evaluation,
    feature: "hope-write-example-evaluation-receipt",
    invocation: Object.freeze({
      id: boundedText(invocationId, "invocation.id"),
    }),
    output: normalizedOutput,
    specification: Object.freeze({
      caseId,
      run,
      suite: prepared.suite,
      variant,
    }),
    version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
  });
  assertEvaluation(
    Buffer.byteLength(JSON.stringify(receipt), "utf8")
      <= hopeWriteExampleEvaluationLimits.receiptBytes,
    "receipt exceeds the byte limit",
  );
  return Object.freeze({ evaluation, receipt });
}

export async function validateHopeWriteExampleEvaluationReceipt(
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
    "specification",
    "version",
  ], "receipt");
  assertEvaluation(
    value.feature === "hope-write-example-evaluation-receipt",
    "receipt.feature is invalid",
  );
  assertEvaluation(
    value.version === HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
    `receipt.version must be ${HOPE_WRITE_EXAMPLE_EVALUATION_VERSION}`,
  );
  exactKeys(
    value.specification,
    ["caseId", "run", "suite", "variant"],
    "receipt.specification",
  );
  const prepared = await prepareHopeWriteExampleEvaluationRun(
    value.specification,
    dependencies,
  );
  assertEvaluation(
    value.specification.suite === prepared.suite,
    "receipt suite does not match the prepared run",
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
  const output = validateHopeWriteExampleEvaluationOutput(value.output);
  const evaluation = evaluationFor(
    findCase(value.specification.caseId),
    output,
  );
  exactKeys(
    value.evaluation,
    ["decisionMatched", "expectedDecision", "runPassed"],
    "receipt.evaluation",
  );
  assertEvaluation(
    isDeepStrictEqual(value.evaluation, evaluation),
    "receipt.evaluation does not match the output and oracle",
  );
  exactKeys(
    value.bindings,
    ["briefDigest", "inputDigest", "outputDigest"],
    "receipt.bindings",
  );
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestHopeWriteExampleEvaluationValue(output),
  });
  assertEvaluation(
    isDeepStrictEqual(value.bindings, bindings),
    "receipt.bindings do not match the prepared run and output",
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
      specification: Object.freeze({ ...value.specification }),
      version: value.version,
    }),
  });
}

function runKey({ caseId, run, variant }) {
  return `${caseId}:${variant}:${run}`;
}

function counts(receipts, field, values) {
  return Object.fromEntries(values.map((value) => {
    const matching = receipts.filter(
      (receipt) => receipt.specification[field] === value,
    );
    return [value, Object.freeze({
      failed: matching.filter((receipt) => !receipt.evaluation.runPassed).length,
      passed: matching.filter((receipt) => receipt.evaluation.runPassed).length,
      total: matching.length,
    })];
  }));
}

export async function validateHopeWriteExampleEvaluationReceiptSet(
  values,
  dependencies = {},
) {
  assertEvaluation(Array.isArray(values), "receipt set must be an array");
  assertEvaluation(
    Buffer.byteLength(JSON.stringify(values), "utf8")
      <= hopeWriteExampleEvaluationLimits.receiptSetBytes,
    "receipt set exceeds the byte limit",
  );
  const expected = plannedRuns();
  assertEvaluation(
    values.length === expected.length,
    `receipt set must contain ${expected.length} runs`,
  );
  const validated = await Promise.all(values.map((value) =>
    validateHopeWriteExampleEvaluationReceipt(value, dependencies)
  ));
  const receipts = validated.map((result) => result.receipt);
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
  const configurations = new Set(receipts.map((receipt) =>
    JSON.stringify(receipt.configuration)
  ));
  assertEvaluation(
    configurations.size === 1,
    "receipt set must use one host, model, and effort",
  );
  const passedRuns = receipts.filter(
    (receipt) => receipt.evaluation.runPassed,
  ).length;
  const summary = Object.freeze({
    deletionReady: passedRuns === receipts.length,
    failedRuns: receipts.length - passedRuns,
    passedRuns,
    totalRuns: receipts.length,
  });
  return Object.freeze({
    bySuite: Object.freeze(counts(
      receipts,
      "suite",
      ["conformance", "safety"],
    )),
    byVariant: Object.freeze(counts(
      receipts,
      "variant",
      HOPE_WRITE_EXAMPLE_VARIANTS,
    )),
    configuration: receipts[0].configuration,
    decision: summary.deletionReady ? "remove-examples" : "keep-examples",
    feature: "hope-write-example-evaluation-result",
    receipts: Object.freeze(receipts),
    summary,
    version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
  });
}

export async function createHopeWriteProductionVerificationReceipt({
  caseId,
  effort,
  host,
  invocationId,
  model,
  output,
  run,
}, dependencies = {}) {
  const prepared = await prepareHopeWriteProductionVerificationRun(
    { caseId, run },
    dependencies,
  );
  const normalizedOutput = validateHopeWriteExampleEvaluationOutput(output);
  const evaluation = evaluationFor(findCase(caseId), normalizedOutput);
  return Object.freeze({
    evaluation,
    receipt: Object.freeze({
      bindings: Object.freeze({
        briefDigest: prepared.briefDigest,
        inputDigest: prepared.inputDigest,
        outputDigest: digestHopeWriteExampleEvaluationValue(normalizedOutput),
      }),
      configuration: Object.freeze({
        effort: boundedText(effort, "configuration.effort"),
        host: boundedText(host, "configuration.host"),
        model: boundedText(model, "configuration.model"),
      }),
      evaluation,
      feature: "hope-write-production-verification-receipt",
      invocation: Object.freeze({
        id: boundedText(invocationId, "invocation.id"),
      }),
      output: normalizedOutput,
      specification: Object.freeze({
        caseId,
        run,
        suite: prepared.suite,
        variant: "production",
      }),
      version: hopeWriteProductionVerificationProtocol.version,
    }),
  });
}

export async function validateHopeWriteProductionVerificationReceipt(
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
    "specification",
    "version",
  ], "production receipt");
  assertEvaluation(
    value.feature === "hope-write-production-verification-receipt",
    "production receipt.feature is invalid",
  );
  assertEvaluation(
    value.version === hopeWriteProductionVerificationProtocol.version,
    "production receipt.version is invalid",
  );
  exactKeys(
    value.specification,
    ["caseId", "run", "suite", "variant"],
    "production receipt.specification",
  );
  assertEvaluation(
    value.specification.variant === "production",
    "production receipt variant is invalid",
  );
  const prepared = await prepareHopeWriteProductionVerificationRun(
    value.specification,
    dependencies,
  );
  assertEvaluation(
    value.specification.suite === prepared.suite,
    "production receipt suite does not match",
  );
  exactKeys(
    value.configuration,
    ["effort", "host", "model"],
    "production receipt.configuration",
  );
  const configuration = Object.freeze({
    effort: boundedText(value.configuration.effort, "configuration.effort"),
    host: boundedText(value.configuration.host, "configuration.host"),
    model: boundedText(value.configuration.model, "configuration.model"),
  });
  exactKeys(value.invocation, ["id"], "production receipt.invocation");
  const invocation = Object.freeze({
    id: boundedText(value.invocation.id, "invocation.id"),
  });
  const output = validateHopeWriteExampleEvaluationOutput(value.output);
  const evaluation = evaluationFor(
    findCase(value.specification.caseId),
    output,
  );
  assertEvaluation(
    isDeepStrictEqual(value.evaluation, evaluation),
    "production receipt evaluation does not match",
  );
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestHopeWriteExampleEvaluationValue(output),
  });
  assertEvaluation(
    isDeepStrictEqual(value.bindings, bindings),
    "production receipt bindings do not match",
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
      specification: Object.freeze({ ...value.specification }),
      version: value.version,
    }),
  });
}

export async function validateHopeWriteProductionVerificationReceiptSet(
  values,
  dependencies = {},
) {
  assertEvaluation(Array.isArray(values), "production receipt set must be an array");
  const expected = productionRuns();
  assertEvaluation(
    values.length === expected.length,
    `production receipt set must contain ${expected.length} runs`,
  );
  const validated = await Promise.all(values.map((value) =>
    validateHopeWriteProductionVerificationReceipt(value, dependencies)
  ));
  const receipts = validated.map((result) => result.receipt);
  const actualKeys = receipts.map((receipt) => runKey(receipt.specification));
  const expectedKeys = new Set(expected.map(runKey));
  assertEvaluation(
    new Set(actualKeys).size === actualKeys.length
      && actualKeys.every((key) => expectedKeys.has(key)),
    "production receipt set does not match the plan",
  );
  const invocationIds = receipts.map((receipt) => receipt.invocation.id);
  assertEvaluation(
    new Set(invocationIds).size === invocationIds.length,
    "production receipt set repeats an invocation identity",
  );
  const configurations = new Set(receipts.map((receipt) =>
    JSON.stringify(receipt.configuration)
  ));
  assertEvaluation(
    configurations.size === 1,
    "production receipt set must use one host, model, and effort",
  );
  const passedRuns = receipts.filter(
    (receipt) => receipt.evaluation.runPassed,
  ).length;
  const accepted = passedRuns === receipts.length;
  return Object.freeze({
    configuration: receipts[0].configuration,
    decision: accepted ? "accept-production" : "reject-production",
    feature: "hope-write-production-verification-result",
    receipts: Object.freeze(receipts),
    summary: Object.freeze({
      accepted,
      failedRuns: receipts.length - passedRuns,
      passedRuns,
      totalRuns: receipts.length,
    }),
    version: hopeWriteProductionVerificationProtocol.version,
  });
}
