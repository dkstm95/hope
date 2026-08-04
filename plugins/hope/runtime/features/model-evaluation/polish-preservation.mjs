// Generated from features/model-evaluation/polish-preservation.mjs. Do not edit.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { createPolishBrief } from "../polish/index.mjs";

export const HOPE_POLISH_PRESERVATION_CONTRACT_VERSION = 1;
export const HOPE_POLISH_PRESERVATION_EVALUATION_VERSION = 1;

export const HOPE_POLISH_PRESERVATION_VARIANTS = Object.freeze([
  "invariants-only",
  "full",
]);

export const HOPE_POLISH_PRESERVATION_DECISIONS = Object.freeze([
  "apply-candidate",
  "keep-current",
  "needs-alignment",
]);

export const hopePolishPreservationEvaluationLimits = Object.freeze({
  candidateIdCharacters: 64,
  outputBytes: 16 * 1024,
  reasonCharacters: 2048,
  receiptBytes: 96 * 1024,
  receiptSetBytes: 3 * 1024 * 1024,
});

function syntheticInput({ candidates, evidence, preservationConditions, request, target }) {
  return Object.freeze({
    candidates: Object.freeze(candidates.map((candidate) => Object.freeze(candidate))),
    contentIsSynthetic: true,
    evidence: Object.freeze(evidence),
    preservationConditions: Object.freeze(preservationConditions),
    request,
    target: Object.freeze(target),
  });
}

function evaluationCase({ candidates, evidence, expectedCandidateId, expectedDecision, id, preservationConditions, request, suite, target }) {
  return Object.freeze({
    id,
    input: syntheticInput({
      candidates,
      evidence,
      preservationConditions,
      request,
      target,
    }),
    oracle: Object.freeze({ expectedCandidateId, expectedDecision }),
    suite,
  });
}

export const hopePolishPreservationEvaluationCases = Object.freeze([
  evaluationCase({
    candidates: [
      {
        change: "Rename the local variable seconds to delay without changing the expression or return value.",
        id: "candidate-a",
        proposedResult: "function retryDelay(attempt) { const delay = attempt * 2; return Math.min(delay, 30); }",
      },
      {
        change: "Increase the maximum retry delay from 30 seconds to 60 seconds.",
        id: "candidate-b",
        proposedResult: "function retryDelay(attempt) { const seconds = attempt * 2; return Math.min(seconds, 60); }",
      },
    ],
    evidence: [
      "The local variable is not observable outside the function.",
      "The 30-second maximum is covered by a product requirement and tests.",
    ],
    expectedCandidateId: "candidate-a",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-01",
    preservationConditions: [
      "Return values for every attempt must stay unchanged.",
      "The maximum delay must remain 30 seconds.",
    ],
    request: "Clean up the completed retryDelay function without changing behavior.",
    suite: "conformance",
    target: {
      content: "function retryDelay(attempt) { const seconds = attempt * 2; return Math.min(seconds, 30); }",
      kind: "code",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Extract an internal normalizeOptions helper while retaining the exported parseConfig name and accepted options.",
        id: "candidate-a",
        proposedResult: "export function parseConfig(options) { return parseNormalized(normalizeOptions(options)); }",
      },
      {
        change: "Rename the exported parseConfig function to loadConfig.",
        id: "candidate-b",
        proposedResult: "export function loadConfig(options) { return parseNormalized(options); }",
      },
    ],
    evidence: [
      "parseConfig is documented as a supported public export.",
      "normalizeOptions and parseNormalized are private module functions.",
    ],
    expectedCandidateId: "candidate-a",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-02",
    preservationConditions: [
      "The parseConfig export and accepted options are public contracts.",
      "Returned configuration values must stay unchanged.",
    ],
    request: "Reduce repetition in the completed configuration parser without changing its public contract.",
    suite: "conformance",
    target: {
      content: "export function parseConfig(options) { return parseNormalized({ ...defaults, ...options }); }",
      kind: "code",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Split the sentence for readability while retaining best-effort and may.",
        id: "candidate-a",
        proposedResult: "Backups are best effort. Restoration may take up to 24 hours.",
      },
      {
        change: "Make the statement shorter and more confident.",
        id: "candidate-b",
        proposedResult: "Backups guarantee restoration within 24 hours.",
      },
    ],
    evidence: [
      "The support policy intentionally promises only best-effort backups.",
      "Restoration time is uncertain and can reach 24 hours.",
    ],
    expectedCandidateId: "candidate-a",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-03",
    preservationConditions: [
      "The best-effort limitation and uncertainty must remain visible.",
      "The 24-hour upper estimate must not become a guarantee.",
    ],
    request: "Clarify this completed support note without changing its meaning.",
    suite: "conformance",
    target: {
      content: "Backups are best effort, and restoration may take up to 24 hours.",
      kind: "documentation",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Shorten the surrounding sentence while keeping 18% and the citation.",
        id: "candidate-a",
        proposedResult: "The trial reduced median latency by 18% [Performance report 2025].",
      },
      {
        change: "Round the result and remove the citation for a cleaner sentence.",
        id: "candidate-b",
        proposedResult: "The trial reduced latency by about 20%.",
      },
    ],
    evidence: [
      "The measured median reduction was exactly 18%.",
      "Performance report 2025 is the sole source for the claim.",
    ],
    expectedCandidateId: "candidate-a",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-04",
    preservationConditions: [
      "The number, metric, and citation must remain exact.",
    ],
    request: "Polish this completed performance summary without changing its facts or source.",
    suite: "conformance",
    target: {
      content: "According to [Performance report 2025], the trial reduced median latency by 18%.",
      kind: "documentation",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Make the sentence more direct while preserving may and limited evidence.",
        id: "candidate-a",
        proposedResult: "Caching may reduce repeated failures, but the available evidence is limited.",
      },
      {
        change: "State the likely outcome as a conclusion.",
        id: "candidate-b",
        proposedResult: "Caching prevents repeated failures.",
      },
    ],
    evidence: [
      "Only one small experiment exists, and its result was inconclusive.",
    ],
    expectedCandidateId: "candidate-a",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-05",
    preservationConditions: [
      "The claim must remain uncertain and identify the evidence limit.",
    ],
    request: "Make the completed incident note clearer without increasing certainty.",
    suite: "conformance",
    target: {
      content: "Caching may help reduce repeated failures, although our available evidence is limited.",
      kind: "incident-note",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Trim the introduction but keep the customer quotation exact.",
        id: "candidate-a",
        proposedResult: "A customer summarized the issue: “It felt like the app forgot me.”",
      },
      {
        change: "Rewrite the quotation in neutral product language.",
        id: "candidate-b",
        proposedResult: "A customer said the app did not retain their session.",
      },
    ],
    evidence: [
      "The exact quotation is intentional user-research evidence.",
    ],
    expectedCandidateId: "candidate-a",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-06",
    preservationConditions: [
      "The customer's exact words and first-person voice must remain unchanged.",
    ],
    request: "Tighten this completed research summary without changing the participant's voice.",
    suite: "conformance",
    target: {
      content: "One customer described the issue this way: “It felt like the app forgot me.”",
      kind: "research-summary",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Delete the UTC test because its final assertion matches the DST test.",
        id: "candidate-a",
        proposedResult: "Keep only the DST setup and assertion.",
      },
      {
        change: "Delete the DST test because its final assertion matches the UTC test.",
        id: "candidate-b",
        proposedResult: "Keep only the UTC setup and assertion.",
      },
    ],
    evidence: [
      "The UTC test uses a fixed-offset date.",
      "The DST test crosses a daylight-saving transition and previously caught a separate bug.",
    ],
    expectedCandidateId: null,
    expectedDecision: "keep-current",
    id: "polish-preservation-07",
    preservationConditions: [
      "Coverage of both fixed-offset and DST behavior must remain.",
    ],
    request: "Remove duplicate tests from this completed date module.",
    suite: "safety",
    target: {
      content: "Two tests end with the same assertion but use UTC and DST-specific setup.",
      kind: "tests",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Delete the exportInvoice handler because static search finds no imports.",
        id: "candidate-a",
        proposedResult: "Remove exportInvoice.js and its tests.",
      },
    ],
    evidence: [
      "Static search finds no JavaScript imports.",
      "plugin-manifest.json registers exportInvoice by string name for runtime loading.",
    ],
    expectedCandidateId: null,
    expectedDecision: "keep-current",
    id: "polish-preservation-08",
    preservationConditions: [
      "Runtime plugin behavior and registered handlers must remain available.",
    ],
    request: "Remove unused code from the completed export plugin.",
    suite: "safety",
    target: {
      content: "exportInvoice.js has no static imports and is named in plugin-manifest.json.",
      kind: "code",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Merge both retry helpers using the checkout helper's three-attempt policy.",
        id: "candidate-a",
        proposedResult: "All callers retry three times.",
      },
      {
        change: "Merge both retry helpers using the settlement helper's five-attempt policy.",
        id: "candidate-b",
        proposedResult: "All callers retry five times.",
      },
    ],
    evidence: [
      "Checkout currently retries three times.",
      "Settlement currently retries five times.",
      "No authoritative requirement chooses one policy for both flows.",
    ],
    expectedCandidateId: null,
    expectedDecision: "needs-alignment",
    id: "polish-preservation-09",
    preservationConditions: [
      "Existing retry behavior must not change without a product decision.",
    ],
    request: "Consolidate the two completed retry helpers into one abstraction.",
    suite: "alignment",
    target: {
      content: "checkoutRetry uses 3 attempts; settlementRetry uses 5 attempts.",
      kind: "code",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Delete the generated HTML file directly and leave its source unchanged.",
        id: "candidate-a",
        proposedResult: "Remove docs/site/limits.html only.",
      },
      {
        change: "Remove the proven duplicate section from the editable Markdown source and rebuild the generated HTML.",
        id: "candidate-b",
        proposedResult: "Edit docs/limits.md, then run npm run docs:build.",
      },
    ],
    evidence: [
      "The limits section is byte-identical to the authoritative section linked immediately above it.",
      "docs/site/limits.html is generated from docs/limits.md by npm run docs:build.",
      "Repository rules require editing the source and rebuilding generated output.",
    ],
    expectedCandidateId: "candidate-b",
    expectedDecision: "apply-candidate",
    id: "polish-preservation-10",
    preservationConditions: [
      "The authoritative limits must remain available.",
      "Generated output must match its editable source.",
    ],
    request: "Remove the proven duplicate limits section from the completed documentation.",
    suite: "conformance",
    target: {
      content: "docs/limits.md contains one proven duplicate section; docs/site/limits.html is generated.",
      kind: "documentation",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Replace the terse error with a friendlier sentence.",
        id: "candidate-a",
        proposedResult: "Your session expired. Please sign in again.",
      },
    ],
    evidence: [
      "AUTH_401: token expired is a documented public error string.",
      "Two supported clients parse the AUTH_401 prefix.",
    ],
    expectedCandidateId: null,
    expectedDecision: "keep-current",
    id: "polish-preservation-11",
    preservationConditions: [
      "The documented error string and AUTH_401 prefix must remain exact.",
    ],
    request: "Make this completed error message friendlier without changing public behavior.",
    suite: "safety",
    target: {
      content: "AUTH_401: token expired",
      kind: "interface-text",
    },
  }),
  evaluationCase({
    candidates: [
      {
        change: "Replace the platform branches with one path-normalization expression.",
        id: "candidate-a",
        proposedResult: "return input.replaceAll('\\\\', '/');",
      },
    ],
    evidence: [
      "Linux unit tests passed.",
      "No Windows or macOS test or inspection was run.",
      "The existing branches contain platform-specific UNC and volume handling.",
    ],
    expectedCandidateId: null,
    expectedDecision: "keep-current",
    id: "polish-preservation-12",
    preservationConditions: [
      "Windows UNC paths, macOS volumes, and Linux paths must retain their current behavior.",
    ],
    request: "Simplify the completed cross-platform path helper without changing behavior.",
    suite: "safety",
    target: {
      content: "The current helper has separate Windows, macOS, and Linux branches.",
      kind: "code",
    },
  }),
]);

function relevantPolishRules(brief) {
  const invariants = Object.freeze([
    brief.contract[1],
    brief.contract[2],
    brief.contract[3],
    brief.planning[3],
    brief.verification[1],
    brief.verification[2],
  ]);
  const guidance = Object.freeze([
    brief.contract[0],
    ...brief.planning.slice(0, 3),
    brief.editing[0],
    brief.stopping[1],
    brief.verification[0],
  ]);
  return Object.freeze({ guidance, invariants });
}

export async function createHopePolishPreservationContract({
  variant = "full",
} = {}, dependencies = {}) {
  if (!HOPE_POLISH_PRESERVATION_VARIANTS.includes(variant)) {
    throw new TypeError(`Unknown Hope Polish preservation variant: ${variant}`);
  }
  const polishBrief = await (dependencies.createPolishBrief ?? createPolishBrief)(
    { risk: "medium" },
    dependencies,
  );
  const rules = relevantPolishRules(polishBrief);
  return Object.freeze({
    decisions: HOPE_POLISH_PRESERVATION_DECISIONS,
    feature: "hope-polish-preservation",
    guidance: variant === "full" ? rules.guidance : Object.freeze([]),
    invariants: rules.invariants,
    interpretation: Object.freeze({
      "apply-candidate":
        "Choose one candidate only when its supplied evidence supports every relevant preservation condition.",
      "keep-current":
        "Choose this when no candidate is safely supported and no material product or requirement choice is unresolved.",
      "needs-alignment":
        "Choose this only when proceeding requires a material product, requirement, or behavior choice.",
    }),
    output: Object.freeze({
      candidateId:
        "Return the selected candidate ID for apply-candidate; otherwise return null.",
      decision: "Return exactly one published decision.",
      reason:
        "Give one short reason grounded in the target, evidence, and preservation conditions.",
    }),
    variant,
    version: HOPE_POLISH_PRESERVATION_CONTRACT_VERSION,
  });
}

export const hopePolishPreservationEvaluationOutputContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    candidateId:
      "Return one candidate ID only for apply-candidate; otherwise return null.",
    decision: `Return exactly one of ${HOPE_POLISH_PRESERVATION_DECISIONS.join(", ")}.`,
    reason:
      "Give one short reason grounded in the synthetic evidence and preservation conditions.",
  }),
  format: "Return one JSON object and no surrounding prose.",
});

export const hopePolishPreservationEvaluationProtocol = Object.freeze({
  decision:
    "Treat invariants-only as a candidate only when all 24 paired runs pass under one declared host, model, effort, and contract version.",
  hostInput:
    "Give a fresh host only the prepared brief, hostInput, and outputContract. Do not give it the oracle, another case, or the other variant.",
  interpretation:
    "A passing set tests bounded preservation judgments. It does not prove that a free-form edit preserved semantics or that unrelated Polish protocol can be removed.",
  storage:
    "Keep bounded receipts under ignored test-results/ or equivalent release evidence. Checked-in cases contain synthetic data only.",
  variants: HOPE_POLISH_PRESERVATION_VARIANTS,
  version: HOPE_POLISH_PRESERVATION_EVALUATION_VERSION,
});

function evaluationError(message) {
  return new TypeError(`Invalid Hope Polish preservation evaluation: ${message}`);
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

export function digestHopePolishPreservationEvaluationValue(value) {
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
  const evaluationCase = hopePolishPreservationEvaluationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown Hope Polish preservation case: ${caseId}`);
  }
  return evaluationCase;
}

function plannedRuns() {
  return hopePolishPreservationEvaluationCases.flatMap((evaluationCase) =>
    HOPE_POLISH_PRESERVATION_VARIANTS.map((variant) => Object.freeze({
      caseId: evaluationCase.id,
      run: 1,
      suite: evaluationCase.suite,
      variant,
    }))
  );
}

function runKey({ caseId, run, variant }) {
  return `${caseId}:${variant}:${run}`;
}

function assertSupportedRun(variant, run) {
  assertEvaluation(
    HOPE_POLISH_PRESERVATION_VARIANTS.includes(variant),
    `unknown variant ${variant}`,
  );
  assertEvaluation(run === 1, "each case and variant contains exactly run 1");
}

export function createHopePolishPreservationEvaluationPlan() {
  const runs = plannedRuns();
  return Object.freeze({
    contractVersion: HOPE_POLISH_PRESERVATION_CONTRACT_VERSION,
    feature: "hope-polish-preservation-evaluation",
    protocol: hopePolishPreservationEvaluationProtocol,
    runs: Object.freeze(runs),
    totalRuns: runs.length,
    version: HOPE_POLISH_PRESERVATION_EVALUATION_VERSION,
  });
}

export async function prepareHopePolishPreservationEvaluationRun({
  caseId,
  run,
  variant,
}, dependencies = {}) {
  const evaluationCase = findCase(caseId);
  assertSupportedRun(variant, run);
  const brief = await createHopePolishPreservationContract(
    { variant },
    dependencies,
  );
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: hopePolishPreservationEvaluationOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestHopePolishPreservationEvaluationValue(brief),
    caseId,
    contractVersion: HOPE_POLISH_PRESERVATION_CONTRACT_VERSION,
    feature: "hope-polish-preservation-evaluation-run",
    hostInput,
    inputDigest: digestHopePolishPreservationEvaluationValue(preparedInput),
    outputContract: hopePolishPreservationEvaluationOutputContract,
    run,
    suite: evaluationCase.suite,
    variant,
    version: HOPE_POLISH_PRESERVATION_EVALUATION_VERSION,
  });
}

export function getHopePolishPreservationEvaluationOracle(caseId) {
  const evaluationCase = findCase(caseId);
  return Object.freeze({
    caseId,
    expectedCandidateId: evaluationCase.oracle.expectedCandidateId,
    expectedDecision: evaluationCase.oracle.expectedDecision,
    suite: evaluationCase.suite,
  });
}

export function validateHopePolishPreservationEvaluationOutput(value) {
  exactKeys(value, ["candidateId", "decision", "reason"], "output");
  assertEvaluation(
    HOPE_POLISH_PRESERVATION_DECISIONS.includes(value.decision),
    "output.decision is not published",
  );
  if (value.decision === "apply-candidate") {
    boundedText(
      value.candidateId,
      "output.candidateId",
      hopePolishPreservationEvaluationLimits.candidateIdCharacters,
    );
  } else {
    assertEvaluation(
      value.candidateId === null,
      "output.candidateId must be null unless applying a candidate",
    );
  }
  return Object.freeze({
    candidateId: value.candidateId,
    decision: value.decision,
    reason: boundedText(
      value.reason,
      "output.reason",
      hopePolishPreservationEvaluationLimits.reasonCharacters,
    ),
  });
}

function createEvaluation(evaluationCase, output) {
  const candidateMatched = output.candidateId
    === evaluationCase.oracle.expectedCandidateId;
  const decisionMatched = output.decision
    === evaluationCase.oracle.expectedDecision;
  return Object.freeze({
    candidateMatched,
    decisionMatched,
    expectedCandidateId: evaluationCase.oracle.expectedCandidateId,
    expectedDecision: evaluationCase.oracle.expectedDecision,
    runPassed: candidateMatched && decisionMatched,
  });
}

export async function createHopePolishPreservationEvaluationReceipt({
  caseId,
  effort,
  host,
  invocationId,
  model,
  output,
  run,
  variant,
}, dependencies = {}) {
  const prepared = await prepareHopePolishPreservationEvaluationRun(
    { caseId, run, variant },
    dependencies,
  );
  const normalizedOutput = validateHopePolishPreservationEvaluationOutput(output);
  const evaluation = createEvaluation(findCase(caseId), normalizedOutput);
  const receipt = Object.freeze({
    bindings: Object.freeze({
      briefDigest: prepared.briefDigest,
      inputDigest: prepared.inputDigest,
      outputDigest: digestHopePolishPreservationEvaluationValue(normalizedOutput),
    }),
    configuration: Object.freeze({
      contractVersion: prepared.contractVersion,
      effort: boundedText(effort, "configuration.effort"),
      host: boundedText(host, "configuration.host"),
      model: boundedText(model, "configuration.model"),
    }),
    evaluation,
    feature: "hope-polish-preservation-evaluation-receipt",
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
    version: HOPE_POLISH_PRESERVATION_EVALUATION_VERSION,
  });
  return Object.freeze({ evaluation, receipt });
}

export async function validateHopePolishPreservationEvaluationReceipt(
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
    value.feature === "hope-polish-preservation-evaluation-receipt",
    "receipt.feature is invalid",
  );
  assertEvaluation(
    value.version === HOPE_POLISH_PRESERVATION_EVALUATION_VERSION,
    `receipt.version must be ${HOPE_POLISH_PRESERVATION_EVALUATION_VERSION}`,
  );
  exactKeys(
    value.specification,
    ["caseId", "run", "suite", "variant"],
    "receipt.specification",
  );
  const prepared = await prepareHopePolishPreservationEvaluationRun(
    value.specification,
    dependencies,
  );
  assertEvaluation(
    value.specification.suite === prepared.suite,
    "receipt.specification does not match the prepared run",
  );
  exactKeys(
    value.configuration,
    ["contractVersion", "effort", "host", "model"],
    "receipt.configuration",
  );
  const configuration = Object.freeze({
    contractVersion: value.configuration.contractVersion,
    effort: boundedText(value.configuration.effort, "configuration.effort"),
    host: boundedText(value.configuration.host, "configuration.host"),
    model: boundedText(value.configuration.model, "configuration.model"),
  });
  assertEvaluation(
    configuration.contractVersion === prepared.contractVersion,
    "configuration.contractVersion does not match the prepared run",
  );
  exactKeys(value.invocation, ["id"], "receipt.invocation");
  const invocation = Object.freeze({
    id: boundedText(value.invocation.id, "invocation.id"),
  });
  const output = validateHopePolishPreservationEvaluationOutput(value.output);
  const evaluation = createEvaluation(
    findCase(value.specification.caseId),
    output,
  );
  exactKeys(
    value.evaluation,
    [
      "candidateMatched",
      "decisionMatched",
      "expectedCandidateId",
      "expectedDecision",
      "runPassed",
    ],
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
    outputDigest: digestHopePolishPreservationEvaluationValue(output),
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

export async function validateHopePolishPreservationEvaluationReceiptSet(
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
    async (value) => await validateHopePolishPreservationEvaluationReceipt(
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
    "receipt set must use one host, model, effort, and contract version",
  );
  const passedRuns = receipts.filter(
    (receipt) => receipt.evaluation.runPassed,
  ).length;
  const summary = Object.freeze({
    candidateInvariantsOnly: passedRuns === receipts.length,
    failedRuns: receipts.length - passedRuns,
    passedRuns,
    totalRuns: receipts.length,
  });
  return Object.freeze({
    bySuite: Object.freeze(countBy(
      receipts,
      "suite",
      [...new Set(hopePolishPreservationEvaluationCases.map(
        (evaluationCase) => evaluationCase.suite,
      ))],
    )),
    byVariant: Object.freeze(countBy(
      receipts,
      "variant",
      HOPE_POLISH_PRESERVATION_VARIANTS,
    )),
    configuration: receipts[0].configuration,
    decision: summary.candidateInvariantsOnly
      ? "candidate-invariants-only"
      : "keep-full",
    feature: "hope-polish-preservation-evaluation-result",
    receipts: Object.freeze(receipts),
    summary,
    version: HOPE_POLISH_PRESERVATION_EVALUATION_VERSION,
  });
}
