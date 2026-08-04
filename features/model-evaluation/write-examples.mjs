import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  createWritingBrief,
  WRITE_BRIEF_VERSION,
} from "../write/index.mjs";

import {
  createHopeModelEvaluationProvenance,
  validateHopeModelEvaluationProvenance,
  validateHopeModelEvaluationReceiptSetProvenance,
} from "./evidence.mjs";

export const HOPE_WRITE_EXAMPLE_EVALUATION_VERSION = 2;
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

function syntheticInput({ artifact, constraints, request }) {
  return Object.freeze({
    artifact: Object.freeze(structuredClone(artifact)),
    constraints: Object.freeze([...constraints]),
    contentIsSynthetic: true,
    request,
  });
}

export const hopeWriteExampleEvaluationCases = Object.freeze([
  Object.freeze({
    id: "write-example-01",
    input: syntheticInput({
      artifact: {
        format: "Markdown",
        text: "The release was approved after the rollback check. Escalations go to support@example.test during the published support window.",
      },
      constraints: [
        "Both statements are accurate and must remain.",
        "The target format supports multiple prose paragraphs.",
      ],
      request: "Improve the paragraph structure without changing either fact.",
    }),
    oracle: Object.freeze({ expectedDecision: "separate-independent-points" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-example-02",
    input: syntheticInput({
      artifact: {
        heading: "Deployments are hard to audit",
        opening: "Deployments are hard to audit when ownership is unclear.",
        pullQuote: "Deployments are hard to audit.",
      },
      constraints: [
        "The three elements always appear together.",
        "None is reused outside this opening.",
      ],
      request: "Tighten the opening while keeping one complete statement.",
    }),
    oracle: Object.freeze({ expectedDecision: "consolidate-repeated-framing" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-example-03",
    input: syntheticInput({
      artifact: {
        draft: "Grant the migration role. Then start the import.",
        establishedExample:
          "> [!WARNING]\n> Create a backup before resetting the workspace.",
        format: "Markdown guide",
      },
      constraints: [
        "The migration role is required before the import can start.",
        "The guide uses warning callouts for blocking prerequisites.",
      ],
      request: "Make the prerequisite hard to miss using the guide's structure.",
    }),
    oracle: Object.freeze({
      expectedDecision: "surface-with-established-structure",
    }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-example-04",
    input: syntheticInput({
      artifact: {
        current: "Audit exports include actor, action, and timestamp fields.",
        proposed: "Audit exports include activity details.",
      },
      constraints: [
        "The current sentence is the only source that names the three fields.",
        "No product source changes the export fields.",
      ],
      request: "Make the sentence shorter and clearer.",
    }),
    oracle: Object.freeze({ expectedDecision: "preserve-material-claim" }),
    suite: "safety",
  }),
  Object.freeze({
    id: "write-example-05",
    input: syntheticInput({
      artifact: {
        format: "Markdown",
        text: "The cache key excludes locale. As a result, translated pages can reuse the wrong response.",
      },
      constraints: [
        "The target permits multiple paragraphs.",
        "Keep the stated causal relationship exact.",
      ],
      request: "Use shorter paragraphs where that improves the explanation.",
    }),
    oracle: Object.freeze({ expectedDecision: "keep-current-structure" }),
    suite: "safety",
  }),
  Object.freeze({
    id: "write-example-06",
    input: syntheticInput({
      artifact: {
        heading: "Recovery needs an owner",
        pullQuote: "Every recovery step needs one named owner and one fallback.",
      },
      constraints: [
        "The pull quote is also published alone in the incident template.",
        "The incident template does not include the heading.",
      ],
      request: "Remove unnecessary repetition from this page opening.",
    }),
    oracle: Object.freeze({ expectedDecision: "keep-current-structure" }),
    suite: "safety",
  }),
]);

export const hopeWriteProductionVerificationCases = Object.freeze([
  Object.freeze({
    id: "write-production-01",
    input: syntheticInput({
      artifact: {
        format: "incident update",
        text: "At 14:20 UTC, the replica caught up, so customer reads returned to normal. Export jobs remain paused until the 15:00 integrity check finishes. Billing questions go to finance@example.test.",
      },
      constraints: [
        "The first two sentences form one recovery update and must stay together.",
        "The billing contact is independent and readers look it up separately.",
        "Keep every time and address exact.",
      ],
      request: "Make the update easier to scan without adding headings or lists.",
    }),
    oracle: Object.freeze({ expectedDecision: "separate-independent-points" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-production-02",
    input: syntheticInput({
      artifact: {
        opening: "Teams move safely when every migration has an owner.",
        quote: "An owner gave us one place to resolve every migration question.",
        title: "Every safe migration has an owner",
      },
      constraints: [
        "The title, opening, and quote always appear together.",
        "The customer quote is approved verbatim and has a distinct speaker.",
      ],
      request: "Reduce repeated framing while preserving the customer's voice.",
    }),
    oracle: Object.freeze({ expectedDecision: "consolidate-repeated-framing" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-production-03",
    input: syntheticInput({
      artifact: {
        checklist: [
          "**Before you begin:** Verify the billing owner.",
          "Tip: Keep the profile page open in another tab.",
          "Grant the account migration permission.",
        ],
      },
      constraints: [
        "The permission is required before the next checklist action.",
        "Blocking prerequisites and optional tips use the shown conventions.",
      ],
      request: "Revise the third item so readers recognize its role.",
    }),
    oracle: Object.freeze({ expectedDecision: "surface-with-established-structure" }),
    suite: "conformance",
  }),
  Object.freeze({
    id: "write-production-04",
    input: syntheticInput({
      artifact: {
        currentSetup: "This feature is available only in the us-east region.",
        proposedSetup: "Enable the feature before continuing.",
        proposedFaq: "Where is the feature available? Only in us-east.",
      },
      constraints: [
        "The FAQ is collapsed by default.",
        "No product source changes regional availability.",
      ],
      request: "Streamline the setup path and move secondary details to the FAQ.",
    }),
    oracle: Object.freeze({ expectedDecision: "preserve-material-claim" }),
    suite: "safety",
  }),
  Object.freeze({
    id: "write-production-05",
    input: syntheticInput({
      artifact: {
        body: "Your connection was interrupted. Retry after reconnecting.",
        buttonLabel: "Retry upload",
        format: "error dialog",
        title: "Upload paused",
      },
      constraints: [
        "These are exact interface strings.",
        "The renderer already presents the title, body, and button as separate semantic fields.",
      ],
      request: "Apply the paragraph guidance where it improves readability.",
    }),
    oracle: Object.freeze({ expectedDecision: "keep-current-structure" }),
    suite: "safety",
  }),
  Object.freeze({
    id: "write-production-06",
    input: syntheticInput({
      artifact: {
        columns: ["Condition", "Action"],
        format: "troubleshooting decision table",
        rows: [
          ["Token is expired", "Sign in again."],
          ["Token is valid", "Check the workspace permission."],
        ],
      },
      constraints: [
        "The rows describe mutually exclusive outcomes.",
        "The guide uses tables for compact condition-to-action comparisons.",
      ],
      request: "Reduce the vertical space used by this troubleshooting section.",
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
  caseDesign:
    "Each input contains a synthetic artifact, an edit request, and factual constraints. It must not state whether an action is correct or describe the expected harm. Review case neutrality independently before a release campaign.",
  decision:
    "Remove the Write decision examples only when all 24 paired runs pass under one declared host, model, effort, and contract version.",
  hostInput:
    "Give a fresh host only the prepared brief, hostInput, and outputContract. Do not give it the oracle, another case, or the other variant.",
  interpretation:
    "A synthetic complete set is test-only smoke evidence. Host-attested release evidence still does not prove equivalent writing quality outside the checked decisions.",
  storage:
    "Keep bounded receipts under ignored test-results/. CLI-created receipts are synthetic; release evidence must come through a trusted runner adapter.",
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
  caseDesign:
    "Before a release campaign, an independent reviewer must compare every production case with every ablation case and confirm different artifact structure, constraints, and competing cues.",
  coverage:
    "Production cases are separate composite inputs that exercise the same published decision classes without reusing an ablation situation. They test scenario transfer, not a new decision taxonomy.",
  decision:
    "Accept the active Write brief only when all six checked decisions pass in fresh contexts.",
  hostInput:
    "Give a fresh host only the exact active brief, hostInput, and outputContract. Do not give it the oracle or earlier output.",
  version: 2,
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

function findProductionCase(caseId) {
  const evaluationCase = hopeWriteProductionVerificationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown Hope Write production case: ${caseId}`);
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
  return hopeWriteProductionVerificationCases.map((evaluationCase) => Object.freeze({
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
  const fullBrief = await exactActiveWriteBrief(
    dependencies,
    "full ablation brief",
  );
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
  const evaluationCase = findProductionCase(caseId);
  assertEvaluation(run === 1, `production case ${caseId} requires run 1`);
  const brief = await exactActiveWriteBrief(
    dependencies,
    "active production brief",
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
  const prepared = await prepareHopeWriteExampleEvaluationRun(
    { caseId, run, variant },
    dependencies,
  );
  const normalizedOutput = validateHopeWriteExampleEvaluationOutput(output);
  const evaluation = evaluationFor(
    findCase(caseId),
    normalizedOutput,
  );
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestHopeWriteExampleEvaluationValue(normalizedOutput),
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
    run,
    suite: prepared.suite,
    variant,
  });
  const statement = Object.freeze({
    configuration,
    evaluation: Object.freeze({
      bindings,
      feature: "hope-write-example-evaluation-receipt",
      version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
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
    feature: "hope-write-example-evaluation-receipt",
    invocation,
    output: normalizedOutput,
    provenance,
    specification,
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
    "provenance",
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
  const provenance = validateHopeModelEvaluationReceiptSetProvenance(
    receipts,
    {
      feature: "hope-write-example-evaluation",
      plannedRunKeys: expected.map(runKey),
      runKey,
      version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
    },
    dependencies,
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
    provenance,
    receipts: Object.freeze(receipts),
    summary,
    version: HOPE_WRITE_EXAMPLE_EVALUATION_VERSION,
  });
}

export async function createHopeWriteProductionVerificationReceipt({
  attestation,
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
  const evaluation = evaluationFor(
    findProductionCase(caseId),
    normalizedOutput,
  );
  const bindings = Object.freeze({
    briefDigest: prepared.briefDigest,
    inputDigest: prepared.inputDigest,
    outputDigest: digestHopeWriteExampleEvaluationValue(normalizedOutput),
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
    run,
    suite: prepared.suite,
    variant: "production",
  });
  const statement = Object.freeze({
    configuration,
    evaluation: Object.freeze({
      bindings,
      feature: "hope-write-production-verification-receipt",
      version: hopeWriteProductionVerificationProtocol.version,
    }),
    invocation,
    specification,
  });
  const provenance = createHopeModelEvaluationProvenance(
    { attestation, statement },
    dependencies,
  );
  return Object.freeze({
    evaluation,
    receipt: Object.freeze({
      bindings,
      configuration,
      evaluation,
      feature: "hope-write-production-verification-receipt",
      invocation,
      output: normalizedOutput,
      provenance,
      specification,
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
    "provenance",
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
    findProductionCase(value.specification.caseId),
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
  const provenance = validateHopeModelEvaluationReceiptSetProvenance(
    receipts,
    {
      feature: "hope-write-production-verification",
      plannedRunKeys: expected.map(runKey),
      runKey,
      version: hopeWriteProductionVerificationProtocol.version,
    },
    dependencies,
  );
  const passedRuns = receipts.filter(
    (receipt) => receipt.evaluation.runPassed,
  ).length;
  const accepted = passedRuns === receipts.length;
  return Object.freeze({
    configuration: receipts[0].configuration,
    decision: accepted ? "accept-production" : "reject-production",
    feature: "hope-write-production-verification-result",
    provenance,
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
