import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { validateToxicReview } from "./validate.mjs";

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const evaluationVariants = Object.freeze(["legacy", "rules-only", "full"]);

function assertReceipt(condition, message) {
  if (!condition) {
    throw new TypeError(`Invalid causal evaluation receipt: ${message}`);
  }
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function digestCausalEvaluationValue(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex")}`;
}

function digestText(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function exactKeys(value, expected, label) {
  assertReceipt(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  assertReceipt(
    isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort()),
    `${label} must contain exactly ${expected.join(", ")}`,
  );
}

function receiptText(value, label, { maximum = 16384, minimum = 1 } = {}) {
  assertReceipt(
    typeof value === "string"
      && value.trim().length >= minimum
      && [...value].length <= maximum,
    `${label} must be text between ${minimum} and ${maximum} characters`,
  );
  return value;
}

export const causalCompletenessRubric = Object.freeze([
  Object.freeze({
    id: "binds-outcome",
    description:
      "Binds the claimed outcome and captured baseline before judging a cause.",
  }),
  Object.freeze({
    id: "maps-relevant-flow",
    description:
      "Maps the relevant end-to-end flow and material boundaries before accepting a local explanation, using the causal record when present.",
  }),
  Object.freeze({
    id: "uses-supported-candidates",
    description:
      "Records only materially distinct candidates supported by the blinded sources, does not split an inseparable aggregate, and permits an empty candidate set.",
  }),
  Object.freeze({
    id: "states-disconfirming-prediction",
    description:
      "States a disconfirming prediction for each supported candidate, or names the minimum evidence needed to form a candidate when there is none.",
  }),
  Object.freeze({
    id: "chooses-safe-next-check",
    description:
      "Chooses the lowest-cost safe next check for the candidate count without executing it, or states that no safe check exists.",
  }),
  Object.freeze({
    id: "targets-work-product",
    description:
      "Makes the finding about the named work product's causal claim or evidence gap rather than replacing it with a raw diagnosis.",
  }),
  Object.freeze({
    id: "respects-evidence-boundary",
    description:
      "Does not assert a root cause beyond the captured evidence and keeps unresolved causation visible.",
  }),
  Object.freeze({
    id: "matches-evidence",
    description:
      "Uses the expected cause level only when the blinded evidence supports it, or remains inconclusive when it does not.",
  }),
]);

const requiredRubricIds = Object.freeze(
  causalCompletenessRubric.map((criterion) => criterion.id),
);

export const causalCompletenessEvaluationReceiptLimits = Object.freeze({
  bytes: 128 * 1024,
  evidenceItemsPerCriterion: 3,
  excerptCharacters: 2048,
});

export const causalCompletenessEvaluationProtocol = Object.freeze({
  suites: Object.freeze({
    conformance: Object.freeze({
      runsPerVariant: 1,
      variants: Object.freeze(["full"]),
      purpose: "Check that the host can apply the published decision examples.",
    }),
    ablation: Object.freeze({
      runsPerVariant: 2,
      variants: Object.freeze(["legacy", "rules-only", "full"]),
      purpose:
        "Compare the existing review, the causal method without examples, and the complete method on one held-out critical path.",
    }),
    safety: Object.freeze({
      runsPerVariant: 2,
      variants: Object.freeze(["full"]),
      purpose:
        "Check supported and inconclusive claims so the host does not reject every causal work product.",
    }),
  }),
  sameConfiguration: Object.freeze(["model", "effort"]),
  hostInput:
    "Pass only the prepared brief and hostInput to the reviewing host. Keep the oracle for later evaluation.",
  evaluatorInput:
    "Read the case oracle only after the host has returned its result.",
  record: Object.freeze([
    "case, suite, variant, and run identifiers",
    "model, effort, normalized brief version and digest",
    "host invocation identity and exact input and output digests",
    "the case-bound sanitized validated review",
    "the observed claim assessment, cause level, candidate count, and no-material-issue decision",
    "a pass or fail, rationale, and decoded-field evidence for every rubric criterion",
    "the evaluator and evaluation time",
  ]),
  storage:
    "Keep bounded receipts under ignored test-results/ or equivalent release evidence. Never put private user sources in an evaluation receipt.",
  interpretation:
    "Report run success separately from correlated rubric criteria. These paired runs are Skill-based smoke evidence, not a CI model test or statistical guarantee.",
});

export const causalCompletenessEvaluationCases = Object.freeze([
  Object.freeze({
    id: "repeated-boundary-conformance",
    suite: "conformance",
    target: Object.freeze({
      summary:
        "Review whether the captured performance note explains a twelve-page analysis workflow.",
      sources: Object.freeze([
        Object.freeze({
          id: "workflow-trace",
          label: "Blinded workflow trace",
          text: [
            "Observed outcome: twelve evidence pages take 726 seconds from the first page request to the completed analysis.",
            "Flow: the host starts one command for each page, and every command opens and parses the same captured state before reading its page.",
            "Trusted timings: command startup and captured-state loading take 38 seconds per page; page analysis takes 18 seconds per page, including 1.5 seconds for ranking; final assembly takes 54 seconds once.",
            "The reviewed note claims that ranking is the primary cause because it is the slowest named function inside one page.",
          ].join("\n"),
        }),
      ]),
    }),
    oracle: Object.freeze({
      expectedClaimAssessment: "unsupported",
      expectedCauseLevels: Object.freeze(["structural"]),
      expectedCandidateCounts: Object.freeze([1]),
      expectedNoMaterialIssueFound: false,
      requiredRubricIds,
      forbiddenInputTerms: Object.freeze([
        "expected structural cause",
        "ranking is innocent",
      ]),
    }),
  }),
  Object.freeze({
    id: "single-local-stage-conformance",
    suite: "conformance",
    target: Object.freeze({
      summary:
        "Review whether the captured performance note explains a single-process rendering workflow.",
      sources: Object.freeze([
        Object.freeze({
          id: "workflow-trace",
          label: "Blinded workflow trace",
          text: [
            "Observed outcome: one render takes 68.5 seconds from captured input to completed output.",
            "Flow: one process loads the captured state once, collects input once, analyzes once, and renders once; increasing the item count does not add another process or state load.",
            "Trusted timings: state loading takes 1.2 seconds, collection takes 2.1 seconds, analysis takes 3.4 seconds, and rendering takes 61.8 seconds.",
            "Within rendering, one range-highlighting operation takes 58.7 seconds and grows with the number of rendered ranges.",
            "The reviewed note claims that module boundaries are the primary cause because the flow crosses four modules.",
          ].join("\n"),
        }),
      ]),
    }),
    oracle: Object.freeze({
      expectedClaimAssessment: "unsupported",
      expectedCauseLevels: Object.freeze(["local"]),
      expectedCandidateCounts: Object.freeze([1]),
      expectedNoMaterialIssueFound: false,
      requiredRubricIds,
      forbiddenInputTerms: Object.freeze([
        "expected local cause",
        "optimize the highlighter",
      ]),
    }),
  }),
  Object.freeze({
    id: "critical-path-ablation",
    suite: "ablation",
    target: Object.freeze({
      summary:
        "Review whether the captured performance note explains a long evidence-review run.",
      sources: Object.freeze([
        Object.freeze({
          id: "run-events",
          label: "Blinded event record",
          text: [
            "The run began at 11:36:31.000 and its final result completed at 11:56:38.711.",
            "Preparation ended at 11:37:13.458. The host then requested, reviewed, and checkpointed 29 evidence pages in order; the last page checkpoint completed at 11:47:52.913.",
            "Ledger reading and the first analysis draft completed at 11:50:56.956.",
            "Five validation failures were repaired one after another before the sixth validation succeeded at 11:56:08.086. Final recheck and publishing then took 30.625 seconds.",
            "The reviewed note claims that command startup and bounded-state loading are the primary reason the run remains slow.",
          ].join("\n"),
        }),
        Object.freeze({
          id: "host-totals",
          label: "Blinded host totals",
          text: [
            "All feature CLI commands together consumed 26.966 seconds. All tool calls together consumed 229.445 seconds.",
            "Forty-seven structured-file edits consumed 199.064 seconds across page checkpoints and analysis repair.",
            "Six validator executions consumed 1.263 seconds in total.",
            "The remaining 977.789 seconds combines model judgment, sequential coordination, and host waiting; the capture cannot split those three components.",
            "Page processing, structured-file edits, and the remaining host total overlap and must not be added as independent durations.",
          ].join("\n"),
        }),
      ]),
    }),
    oracle: Object.freeze({
      expectedClaimAssessment: "unsupported",
      expectedCauseLevels: Object.freeze(["structural", "mixed"]),
      expectedCandidateCounts: Object.freeze([2, 3]),
      expectedNoMaterialIssueFound: false,
      requiredRubricIds,
      forbiddenInputTerms: Object.freeze([
        "two supported candidates",
        "sequential protocol answer",
        "repair-loop answer",
      ]),
    }),
  }),
  Object.freeze({
    id: "honest-local-scope-safety",
    suite: "safety",
    target: Object.freeze({
      summary:
        "Review whether the captured performance note keeps a local improvement within its evidence boundary.",
      sources: Object.freeze([
        Object.freeze({
          id: "bounded-benchmark",
          label: "Blinded bounded benchmark",
          text: [
            "The same captured input was processed ten times before and ten times after a parser change.",
            "Median parser time fell from 40 milliseconds to 20 milliseconds, while end-to-end request time was not captured.",
            "The reviewed note says only that parser time improved by 50 percent in this benchmark. It explicitly says the end-to-end effect and the production bottleneck are unknown.",
          ].join("\n"),
        }),
      ]),
    }),
    oracle: Object.freeze({
      expectedClaimAssessment: "supported",
      expectedCauseLevels: Object.freeze(["local"]),
      expectedCandidateCounts: Object.freeze([1]),
      expectedNoMaterialIssueFound: true,
      requiredRubricIds,
      forbiddenInputTerms: Object.freeze([
        "must reject the note",
        "production bottleneck confirmed",
      ]),
    }),
  }),
  Object.freeze({
    id: "missing-evidence-safety",
    suite: "safety",
    target: Object.freeze({
      summary:
        "Review whether the captured incident note establishes why one response was stale after a deployment.",
      sources: Object.freeze([
        Object.freeze({
          id: "incident-capture",
          label: "Blinded incident capture",
          text: [
            "Observed outcome: a screenshot captured one stale response after a deployment.",
            "The screenshot has no request ID or trusted timestamp, and the capture contains no comparable fresh-response baseline.",
            "No cache access log, origin read, routing trace, or response header was retained for that request.",
            "The deployment log proves only that a deployment completed earlier that day.",
            "The reviewed note claims that cache invalidation failed because the stale response appeared after the deployment.",
          ].join("\n"),
        }),
      ]),
    }),
    oracle: Object.freeze({
      expectedClaimAssessment: "unsupported",
      expectedCauseLevels: Object.freeze(["inconclusive"]),
      expectedCandidateCounts: Object.freeze([0]),
      expectedNoMaterialIssueFound: false,
      requiredRubricIds,
      forbiddenInputTerms: Object.freeze([
        "zero supported candidates",
        "cache cause disproved",
      ]),
    }),
  }),
]);

function findEvaluationCase(caseId) {
  const evaluationCase = causalCompletenessEvaluationCases.find(
    (candidate) => candidate.id === caseId,
  );
  if (!evaluationCase) {
    throw new TypeError(`Unknown causal evaluation case: ${caseId}`);
  }
  return evaluationCase;
}

export function getCausalCompletenessEvaluationOracle(caseId) {
  const evaluationCase = findEvaluationCase(caseId);
  return Object.freeze({
    caseId: evaluationCase.id,
    suite: evaluationCase.suite,
    oracle: evaluationCase.oracle,
    rubric: causalCompletenessRubric,
  });
}

function variantBrief(brief, variant) {
  if (!evaluationVariants.includes(variant)) {
    throw new TypeError(`Unknown causal evaluation variant: ${variant}`);
  }
  const copy = structuredClone(brief);
  if (variant === "legacy") {
    delete copy.causalCompleteness;
    copy.evaluationControl = Object.freeze([
      "This run measures the legacy review behavior. Do not select role method causal-completeness or include causalAnalysis, even though the shared version 1 schema permits those optional fields.",
      "Use the remaining brief and host input without importing rules from another variant.",
    ]);
  }
  if (variant === "rules-only") {
    copy.causalCompleteness.decisionExamples = [];
  }
  return copy;
}

function portableBrief(brief) {
  const { schemaPath, ...portable } = brief;
  return portable;
}

function expectedRunSpecifications() {
  return causalCompletenessEvaluationCases.flatMap((evaluationCase) => {
    const suite = causalCompletenessEvaluationProtocol.suites[evaluationCase.suite];
    return suite.variants.flatMap((variant) => Array.from(
      { length: suite.runsPerVariant },
      (_, index) => Object.freeze({
        caseId: evaluationCase.id,
        suite: evaluationCase.suite,
        variant,
        run: index + 1,
      }),
    ));
  });
}

function expectedRunKeys() {
  return expectedRunSpecifications().map(
    (run) => `${run.caseId}:${run.variant}:${run.run}`,
  );
}

export function createCausalCompletenessEvaluationPlan({ brief }) {
  const runs = expectedRunSpecifications().map((run) => {
    const prepared = prepareCausalCompletenessEvaluationRun({ ...run, brief });
    return Object.freeze({
      ...run,
      briefDigest: prepared.briefDigest,
      inputDigest: prepared.inputDigest,
    });
  });
  return Object.freeze({
    evaluationVersion: 1,
    totalRuns: runs.length,
    runs: Object.freeze(runs),
    interpretation: causalCompletenessEvaluationProtocol.interpretation,
  });
}

export function prepareCausalCompletenessEvaluationRun({
  brief,
  caseId,
  run,
  variant,
}) {
  const evaluationCase = findEvaluationCase(caseId);
  const suite = causalCompletenessEvaluationProtocol.suites[evaluationCase.suite];
  if (!suite.variants.includes(variant)) {
    throw new TypeError(
      `Causal evaluation case ${caseId} does not support variant ${variant}`,
    );
  }
  if (!Number.isSafeInteger(run) || run < 1 || run > suite.runsPerVariant) {
    throw new TypeError(
      `Causal evaluation run must be between 1 and ${suite.runsPerVariant}`,
    );
  }
  const preparedBrief = variantBrief(brief, variant);
  const sources = evaluationCase.target.sources.map((source) => Object.freeze({
    id: source.id,
    kind: "artifact",
    label: source.label,
    locator: `hope:toxic-review-causal-evaluation/${caseId}/${source.id}`,
    digest: digestText(source.text),
  }));
  const hostInput = Object.freeze({
    target: evaluationCase.target,
    reviewBinding: Object.freeze({
      target: Object.freeze({
        kind: "document",
        stage: "completed",
        summary: evaluationCase.target.summary,
      }),
      sources: Object.freeze(sources),
    }),
  });
  return Object.freeze({
    evaluationVersion: 1,
    caseId,
    suite: evaluationCase.suite,
    variant,
    run,
    brief: preparedBrief,
    briefDigest: digestCausalEvaluationValue(portableBrief(preparedBrief)),
    inputDigest: digestCausalEvaluationValue(hostInput),
    hostInput,
  });
}

function decodedPointer(root, pointer, label) {
  receiptText(pointer, `${label}.pointer`, { maximum: 1024 });
  assertReceipt(
    /^\/(?:causalAnalysis|findings|adjudications|summary|roles)\//u.test(pointer),
    `${label}.pointer must reference an authored review field`,
  );
  let value = root;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replace(/~1/gu, "/").replace(/~0/gu, "~");
    assertReceipt(
      value !== null
        && typeof value === "object"
        && Object.hasOwn(value, key),
      `${label}.pointer does not resolve`,
    );
    value = value[key];
  }
  assertReceipt(typeof value === "string", `${label}.pointer must resolve to text`);
  return value;
}

function assessmentMatchesOracle(assessment, oracle) {
  return assessment.claimAssessment === oracle.expectedClaimAssessment
    && oracle.expectedCauseLevels.includes(assessment.causeLevel)
    && oracle.expectedCandidateCounts.includes(assessment.candidateCount)
    && assessment.noMaterialIssueFound === oracle.expectedNoMaterialIssueFound;
}

function assertReviewMatchesPrepared(review, prepared) {
  assertReceipt(
    isDeepStrictEqual(review.target, prepared.hostInput.reviewBinding.target),
    "validatedReview target does not match the prepared case",
  );
  assertReceipt(
    isDeepStrictEqual(
      review.snapshot.sources,
      prepared.hostInput.reviewBinding.sources,
    ),
    "validatedReview sources do not match the prepared case",
  );
}

export function createCausalCompletenessEvaluationReceiptTemplate({
  brief,
  caseId,
  variant,
  run,
  model,
  effort,
  invocationId,
  validatedReview,
}) {
  const prepared = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId,
    variant,
    run,
  });
  receiptText(model, "configuration.model", { maximum: 256 });
  receiptText(effort, "configuration.effort", { maximum: 256 });
  receiptText(invocationId, "invocation.id", { maximum: 512 });
  assertReviewMatchesPrepared(validatedReview, prepared);
  const recordedAssessment = validatedReview.causalAnalysis
    ? Object.freeze({
        claimAssessment: validatedReview.causalAnalysis.claimAssessment,
        causeLevel: validatedReview.causalAnalysis.causeLevel,
        candidateCount: validatedReview.causalAnalysis.candidateCount,
        noMaterialIssueFound: validatedReview.summary.noMaterialIssueFound,
      })
    : null;
  return Object.freeze({
    receipt: Object.freeze({
      receiptVersion: 1,
      caseId,
      suite: prepared.suite,
      variant,
      run,
      configuration: Object.freeze({
        model,
        effort,
        briefVersion: String(prepared.brief.version),
        briefDigest: prepared.briefDigest,
      }),
      invocation: Object.freeze({
        id: invocationId,
        inputDigest: prepared.inputDigest,
        outputDigest: digestCausalEvaluationValue(validatedReview),
      }),
      validatedReview,
      assessment: recordedAssessment,
      rubricResults: Object.freeze(causalCompletenessRubric.map((criterion) => (
        Object.freeze({
          criterionId: criterion.id,
          passed: null,
          rationale: null,
          evidence: Object.freeze([]),
        })
      ))),
      evaluator: null,
      evaluatedAt: null,
      sanitized: true,
    }),
    instructions: Object.freeze([
      "Read the oracle only after the reviewing host has returned this validated result.",
      "Keep a prefilled assessment from causalAnalysis; otherwise replace its null value after evaluation. Replace every rubric result, evaluator, and evaluatedAt without changing the bound fields.",
      "A passing rubric result needs a JSON Pointer to an authored text field and an exact excerpt from that decoded field.",
      "Keep failed rubric results with passed false and an empty evidence array when no result field supports the criterion.",
    ]),
  });
}

export function validateCausalCompletenessEvaluationReceipt(receipt, { brief }) {
  const encoded = JSON.stringify(receipt);
  assertReceipt(
    Buffer.byteLength(encoded, "utf8")
      <= causalCompletenessEvaluationReceiptLimits.bytes,
    `receipt exceeds ${causalCompletenessEvaluationReceiptLimits.bytes} bytes`,
  );
  exactKeys(receipt, [
    "receiptVersion",
    "caseId",
    "suite",
    "variant",
    "run",
    "configuration",
    "invocation",
    "validatedReview",
    "assessment",
    "rubricResults",
    "evaluator",
    "evaluatedAt",
    "sanitized",
  ], "receipt");
  assertReceipt(receipt.receiptVersion === 1, "receiptVersion must be 1");
  const evaluationCase = findEvaluationCase(receipt.caseId);
  const prepared = prepareCausalCompletenessEvaluationRun({
    brief,
    caseId: receipt.caseId,
    run: receipt.run,
    variant: receipt.variant,
  });
  assertReceipt(receipt.suite === evaluationCase.suite, "suite does not match case");

  exactKeys(
    receipt.configuration,
    ["model", "effort", "briefVersion", "briefDigest"],
    "configuration",
  );
  receiptText(receipt.configuration.model, "configuration.model", { maximum: 256 });
  receiptText(receipt.configuration.effort, "configuration.effort", { maximum: 256 });
  assertReceipt(
    receipt.configuration.briefVersion === String(prepared.brief.version),
    "configuration.briefVersion does not match the prepared brief",
  );
  assertReceipt(
    receipt.configuration.briefDigest === prepared.briefDigest,
    "configuration.briefDigest does not match the prepared brief",
  );

  exactKeys(
    receipt.invocation,
    ["id", "inputDigest", "outputDigest"],
    "invocation",
  );
  receiptText(receipt.invocation.id, "invocation.id", { maximum: 512 });
  assertReceipt(
    receipt.invocation.inputDigest === prepared.inputDigest,
    "invocation.inputDigest does not match the prepared host input",
  );
  assertReceipt(
    digestPattern.test(receipt.invocation.outputDigest),
    "invocation.outputDigest must be a sha256 digest",
  );

  assertReceipt(receipt.sanitized === true, "sanitized must be true");
  receiptText(receipt.evaluator, "evaluator", { maximum: 512 });
  assertReceipt(
    typeof receipt.evaluatedAt === "string"
      && Number.isFinite(Date.parse(receipt.evaluatedAt))
      && new Date(receipt.evaluatedAt).toISOString() === receipt.evaluatedAt,
    "evaluatedAt must be a canonical ISO timestamp",
  );

  const {
    result: storedResult,
    resources: storedResources,
    observedMetrics,
    ...reviewInput
  } = receipt.validatedReview ?? {};
  assertReceipt(
    observedMetrics === undefined,
    "validatedReview must not contain trusted host metrics",
  );
  const revalidated = validateToxicReview(reviewInput, {
    inputFileBytes: storedResources?.inputFileBytes,
  });
  assertReceipt(
    isDeepStrictEqual(revalidated.result, storedResult)
      && isDeepStrictEqual(revalidated.resources, storedResources),
    "validatedReview does not match a fresh validation",
  );
  assertReviewMatchesPrepared(revalidated, prepared);
  assertReceipt(
    receipt.invocation.outputDigest === digestCausalEvaluationValue(revalidated),
    "invocation.outputDigest does not match validatedReview",
  );

  exactKeys(
    receipt.assessment,
    ["claimAssessment", "causeLevel", "candidateCount", "noMaterialIssueFound"],
    "assessment",
  );
  assertReceipt(
    ["supported", "unsupported", "honest-uncertainty"].includes(
      receipt.assessment.claimAssessment,
    ),
    "assessment.claimAssessment is unknown",
  );
  assertReceipt(
    ["structural", "local", "mixed", "inconclusive"].includes(
      receipt.assessment.causeLevel,
    ),
    "assessment.causeLevel is unknown",
  );
  assertReceipt(
    Number.isSafeInteger(receipt.assessment.candidateCount)
      && receipt.assessment.candidateCount >= 0
      && receipt.assessment.candidateCount <= 32,
    "assessment.candidateCount must be between 0 and 32",
  );
  assertReceipt(
    typeof receipt.assessment.noMaterialIssueFound === "boolean",
    "assessment.noMaterialIssueFound must be boolean",
  );
  assertReceipt(
    receipt.assessment.noMaterialIssueFound
      === revalidated.summary.noMaterialIssueFound,
    "assessment.noMaterialIssueFound must match validatedReview",
  );
  if (revalidated.causalAnalysis) {
    assertReceipt(
      receipt.assessment.claimAssessment
        === revalidated.causalAnalysis.claimAssessment
        && receipt.assessment.causeLevel
          === revalidated.causalAnalysis.causeLevel
        && receipt.assessment.candidateCount
          === revalidated.causalAnalysis.candidateCount,
      "assessment must match validatedReview.causalAnalysis",
    );
  }

  assertReceipt(
    Array.isArray(receipt.rubricResults)
      && receipt.rubricResults.length === causalCompletenessRubric.length,
    `rubricResults must contain ${causalCompletenessRubric.length} items`,
  );
  const seenCriteria = new Set();
  const seenRationales = new Set();
  for (const [index, result] of receipt.rubricResults.entries()) {
    const label = `rubricResults[${index}]`;
    exactKeys(result, ["criterionId", "passed", "rationale", "evidence"], label);
    assertReceipt(
      requiredRubricIds.includes(result.criterionId)
        && !seenCriteria.has(result.criterionId),
      `${label}.criterionId must be unique and known`,
    );
    seenCriteria.add(result.criterionId);
    assertReceipt(typeof result.passed === "boolean", `${label}.passed must be boolean`);
    receiptText(result.rationale, `${label}.rationale`);
    assertReceipt(
      !seenRationales.has(result.rationale),
      `${label}.rationale must explain this criterion instead of repeating another result`,
    );
    seenRationales.add(result.rationale);
    assertReceipt(
      Array.isArray(result.evidence)
        && result.evidence.length
          <= causalCompletenessEvaluationReceiptLimits.evidenceItemsPerCriterion
        && (!result.passed || result.evidence.length >= 1),
      `${label}.evidence must contain supporting fields for a passing criterion`,
    );
    for (const [evidenceIndex, evidence] of result.evidence.entries()) {
      const evidenceLabel = `${label}.evidence[${evidenceIndex}]`;
      exactKeys(evidence, ["pointer", "excerpt"], evidenceLabel);
      const field = decodedPointer(revalidated, evidence.pointer, evidenceLabel);
      receiptText(evidence.excerpt, `${evidenceLabel}.excerpt`, {
        minimum: 12,
        maximum: causalCompletenessEvaluationReceiptLimits.excerptCharacters,
      });
      assertReceipt(
        field.includes(evidence.excerpt),
        `${evidenceLabel}.excerpt must appear in its decoded field`,
      );
    }
  }

  const failedCriteria = receipt.rubricResults
    .filter((result) => !result.passed)
    .map((result) => result.criterionId);
  const oracleMatched = assessmentMatchesOracle(
    receipt.assessment,
    evaluationCase.oracle,
  );
  return Object.freeze({
    ...receipt,
    validatedReview: revalidated,
    evaluation: Object.freeze({
      failedCriteria: Object.freeze(failedCriteria),
      oracleMatched,
      runPassed: failedCriteria.length === 0 && oracleMatched,
    }),
  });
}

export function validateCausalCompletenessEvaluationReceiptSet(
  receipts,
  { brief },
) {
  assertReceipt(Array.isArray(receipts), "receipt set must be an array");
  const expectedKeys = new Set(expectedRunKeys());
  assertReceipt(
    receipts.length === expectedKeys.size,
    `receipt set must contain ${expectedKeys.size} runs`,
  );
  const validated = receipts.map((receipt) => (
    validateCausalCompletenessEvaluationReceipt(receipt, { brief })
  ));
  const seenRuns = new Set();
  const seenInvocations = new Set();
  const { model, effort } = validated[0].configuration;
  for (const receipt of validated) {
    const key = `${receipt.caseId}:${receipt.variant}:${receipt.run}`;
    assertReceipt(
      expectedKeys.has(key) && !seenRuns.has(key),
      `receipt set repeats or does not expect ${key}`,
    );
    seenRuns.add(key);
    assertReceipt(
      !seenInvocations.has(receipt.invocation.id),
      `receipt set repeats invocation ${receipt.invocation.id}`,
    );
    seenInvocations.add(receipt.invocation.id);
    assertReceipt(
      receipt.configuration.model === model
        && receipt.configuration.effort === effort,
      "receipt set must use one model and effort",
    );
  }
  const passedRuns = validated.filter((receipt) => receipt.evaluation.runPassed).length;
  const passedCriteria = validated.reduce(
    (total, receipt) => total
      + receipt.rubricResults.filter((result) => result.passed).length,
    0,
  );
  return Object.freeze({
    receipts: Object.freeze(validated),
    summary: Object.freeze({
      totalRuns: validated.length,
      passedRuns,
      failedRuns: validated.length - passedRuns,
      totalCriteria: validated.length * causalCompletenessRubric.length,
      passedCriteria,
      failedCriteria:
        validated.length * causalCompletenessRubric.length - passedCriteria,
    }),
  });
}
