// Generated from features/model-evaluation/write-plain-language-comparison.mjs. Do not edit.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { createWritingBrief } from "../write/index.mjs";

import {
  getHopeWritePlainLanguageEvaluationOracle,
  hopeWritePlainLanguageEvaluationCases,
  hopeWritePlainLanguageOutputContract,
  validateHopeWritePlainLanguageOutput,
} from "./write-plain-language.mjs";

export const HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VERSION = 1;
export const HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VARIANTS = Object.freeze([
  "baseline",
  "current",
]);
export const HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_RUNS = 3;

export const hopeWritePlainLanguageComparisonLimits = Object.freeze({
  assessmentBytes: 64 * 1024,
  evidenceCharacters: 2048,
  outputBytes: 16 * 1024,
  resultBytes: 2 * 1024 * 1024,
});

const baselineDecisionExamples = Object.freeze([
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

const preferenceIds = Object.freeze([
  "plain-for-intended-reader",
  "natural-target-language",
  "only-needed-repairs",
  "overall",
]);

export const hopeWritePlainLanguageComparisonAssessmentContract = Object.freeze({
  additionalFields: false,
  fields: Object.freeze({
    candidates:
      "For candidates A and B in order, judge every preservation assertion and reader criterion with id, passed, and brief evidence.",
    preferences:
      "For each supplied criterion and overall in order, select A, B, or tie and give brief comparative evidence.",
  }),
  format: "Return one JSON object and no surrounding prose.",
});

export const hopeWritePlainLanguageComparisonProtocol = Object.freeze({
  assessment:
    "After both outputs exist, give a fresh evaluator only evaluatorInput and assessmentContract. Do not reveal variant names, assignment, brief versions, writer identities, models, effort, invocation IDs, or earlier judgments.",
  baseline:
    "Baseline is the exact committed Write version 2 edit brief captured before the plain-language patch. Its standard is stored as the immutable evaluation fixture write-baseline-v2.md.",
  decision:
    "Treat the current brief as improved only when all twelve current outputs pass every preservation assertion and reader criterion, current wins exceed baseline wins overall and for plain-language clarity, and no current output loses a preservation assertion.",
  interpretation:
    "This comparison is actual but unattested observational model evidence. It can falsify or support the bounded improvement claim, but it is not release-eligible evidence without trusted writer and evaluator attestations and complete-attempt ledgers.",
  writers:
    "For every case, variant, and run, use a fresh writer context and give it only the prepared brief, hostInput, and outputContract.",
  version: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VERSION,
});

function fail(message) {
  throw new TypeError(`Invalid Hope Write plain-language comparison: ${message}`);
}

function assertComparison(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, expected, label) {
  assertComparison(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  assertComparison(
    isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort()),
    `${label} must contain exactly ${expected.join(", ")}`,
  );
}

function boundedText(value, label, maximum = 256) {
  assertComparison(
    typeof value === "string"
      && value.trim().length > 0
      && [...value].length <= maximum,
    `${label} must be text between 1 and ${maximum} characters`,
  );
  return value;
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

export function digestHopeWritePlainLanguageComparisonValue(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex")}`;
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
  assertComparison(
    Number.isSafeInteger(run)
      && run >= 1
      && run <= HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_RUNS,
    `run must be between 1 and ${HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_RUNS}`,
  );
}

function assertVariant(variant) {
  assertComparison(
    HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VARIANTS.includes(variant),
    `unknown variant ${variant}`,
  );
}

export async function loadHopeWritePlainLanguageBaselineStandard({
  read = readFile,
  standardUrl = new URL("./write-baseline-v2.md", import.meta.url),
} = {}) {
  const value = String(await read(standardUrl, "utf8"))
    .replace(/\r\n?/gu, "\n")
    .trim();
  assertComparison(value.length > 0, "baseline standard is empty");
  return `${value}\n`;
}

export async function createHopeWritePlainLanguageBaselineBrief(
  dependencies = {},
) {
  return Object.freeze({
    decisionExamples: baselineDecisionExamples,
    feature: "write",
    mode: "edit",
    response:
      "Change the requested target and lead with the completed result.\n\nPreserve a material ambiguity instead of silently choosing a new meaning.",
    standard: await (
      dependencies.loadBaselineStandard
      ?? loadHopeWritePlainLanguageBaselineStandard
    )(),
    standardVersion: 2,
    version: 2,
  });
}

function writerRuns() {
  return hopeWritePlainLanguageEvaluationCases.flatMap((evaluationCase) =>
    HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VARIANTS.flatMap((variant) =>
      Array.from(
        { length: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_RUNS },
        (_, index) => Object.freeze({
          caseId: evaluationCase.id,
          run: index + 1,
          suite: evaluationCase.suite,
          variant,
        }),
      )
    )
  );
}

function assessmentRuns() {
  return hopeWritePlainLanguageEvaluationCases.flatMap((evaluationCase) =>
    Array.from(
      { length: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_RUNS },
      (_, index) => Object.freeze({
        caseId: evaluationCase.id,
        run: index + 1,
        suite: evaluationCase.suite,
      }),
    )
  );
}

export function createHopeWritePlainLanguageComparisonPlan() {
  const writers = writerRuns();
  const assessments = assessmentRuns();
  return Object.freeze({
    assessmentRuns: Object.freeze(assessments),
    feature: "hope-write-plain-language-comparison",
    protocol: hopeWritePlainLanguageComparisonProtocol,
    totalAssessments: assessments.length,
    totalWriterRuns: writers.length,
    version: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VERSION,
    writerRuns: Object.freeze(writers),
  });
}

export async function prepareHopeWritePlainLanguageComparisonRun({
  caseId,
  run,
  variant,
}, dependencies = {}) {
  const evaluationCase = findCase(caseId);
  assertRun(run);
  assertVariant(variant);
  const brief = variant === "baseline"
    ? await createHopeWritePlainLanguageBaselineBrief(dependencies)
    : await (dependencies.createCurrentBrief ?? createWritingBrief)({
      mode: "edit",
    });
  if (variant === "current") {
    const canonical = await createWritingBrief({ mode: "edit" });
    assertComparison(
      isDeepStrictEqual(brief, canonical),
      "current brief must match the complete canonical active Write brief",
    );
  }
  const hostInput = structuredClone(evaluationCase.input);
  const preparedInput = Object.freeze({
    brief,
    hostInput,
    outputContract: hopeWritePlainLanguageOutputContract,
  });
  return Object.freeze({
    brief,
    briefDigest: digestHopeWritePlainLanguageComparisonValue(brief),
    caseId,
    feature: "hope-write-plain-language-comparison-run",
    hostInput,
    inputDigest: digestHopeWritePlainLanguageComparisonValue(preparedInput),
    outputContract: hopeWritePlainLanguageOutputContract,
    run,
    suite: evaluationCase.suite,
    variant,
    version: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VERSION,
  });
}

function assignmentFor(caseId, run) {
  findCase(caseId);
  assertRun(run);
  const caseIndex = hopeWritePlainLanguageEvaluationCases.findIndex(
    (evaluationCase) => evaluationCase.id === caseId,
  );
  const currentIsA = (caseIndex + run) % 2 === 0;
  return Object.freeze({
    A: currentIsA ? "current" : "baseline",
    B: currentIsA ? "baseline" : "current",
  });
}

function normalizeOutputs(value) {
  exactKeys(value, ["baseline", "current"], "outputs");
  return Object.freeze({
    baseline: validateHopeWritePlainLanguageOutput(value.baseline),
    current: validateHopeWritePlainLanguageOutput(value.current),
  });
}

export function prepareHopeWritePlainLanguageComparisonAssessment({
  caseId,
  outputs,
  run,
}) {
  const evaluationCase = findCase(caseId);
  assertRun(run);
  const normalizedOutputs = normalizeOutputs(outputs);
  const assignment = assignmentFor(caseId, run);
  const evaluatorInput = Object.freeze({
    assertions: evaluationCase.oracle.assertions,
    candidates: Object.freeze(["A", "B"].map((id) => Object.freeze({
      id,
      revision: normalizedOutputs[assignment[id]].revision,
    }))),
    criteria: getHopeWritePlainLanguageEvaluationOracle(caseId).criteria,
    source: structuredClone(evaluationCase.input),
  });
  const assessmentInput = Object.freeze({
    assessmentContract: hopeWritePlainLanguageComparisonAssessmentContract,
    evaluatorInput,
  });
  return Object.freeze({
    assessmentContract: hopeWritePlainLanguageComparisonAssessmentContract,
    caseId,
    evaluatorInput,
    feature: "hope-write-plain-language-comparison-assessment",
    inputDigest: digestHopeWritePlainLanguageComparisonValue(assessmentInput),
    outputDigests: Object.freeze({
      baseline: digestHopeWritePlainLanguageComparisonValue(
        normalizedOutputs.baseline,
      ),
      current: digestHopeWritePlainLanguageComparisonValue(
        normalizedOutputs.current,
      ),
    }),
    privateAssignment: assignment,
    run,
    suite: evaluationCase.suite,
    version: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VERSION,
  });
}

function normalizeJudgments(values, expected, label) {
  assertComparison(Array.isArray(values), `${label} must be an array`);
  assertComparison(
    values.length === expected.length,
    `${label} must contain ${expected.length} entries`,
  );
  return Object.freeze(values.map((value, index) => {
    exactKeys(value, ["evidence", "id", "passed"], `${label}[${index}]`);
    assertComparison(
      value.id === expected[index].id,
      `${label}[${index}].id must be ${expected[index].id}`,
    );
    assertComparison(
      typeof value.passed === "boolean",
      `${label}[${index}].passed must be a boolean`,
    );
    return Object.freeze({
      evidence: boundedText(
        value.evidence,
        `${label}[${index}].evidence`,
        hopeWritePlainLanguageComparisonLimits.evidenceCharacters,
      ),
      id: value.id,
      passed: value.passed,
    });
  }));
}

export function validateHopeWritePlainLanguageComparisonAssessment(
  value,
  caseId,
) {
  const oracle = getHopeWritePlainLanguageEvaluationOracle(caseId);
  exactKeys(value, ["candidates", "preferences"], "assessment");
  assertComparison(
    Array.isArray(value.candidates) && value.candidates.length === 2,
    "assessment.candidates must contain A and B",
  );
  const candidates = Object.freeze(value.candidates.map((candidate, index) => {
    exactKeys(
      candidate,
      ["assertions", "criteria", "id"],
      `assessment.candidates[${index}]`,
    );
    const id = index === 0 ? "A" : "B";
    assertComparison(
      candidate.id === id,
      `assessment.candidates[${index}].id must be ${id}`,
    );
    return Object.freeze({
      assertions: normalizeJudgments(
        candidate.assertions,
        oracle.assertions,
        `assessment.candidates[${index}].assertions`,
      ),
      criteria: normalizeJudgments(
        candidate.criteria,
        oracle.criteria,
        `assessment.candidates[${index}].criteria`,
      ),
      id,
    });
  }));
  assertComparison(
    Array.isArray(value.preferences)
      && value.preferences.length === preferenceIds.length,
    `assessment.preferences must contain ${preferenceIds.length} entries`,
  );
  const preferences = Object.freeze(value.preferences.map((preference, index) => {
    exactKeys(
      preference,
      ["evidence", "id", "selected"],
      `assessment.preferences[${index}]`,
    );
    assertComparison(
      preference.id === preferenceIds[index],
      `assessment.preferences[${index}].id must be ${preferenceIds[index]}`,
    );
    assertComparison(
      ["A", "B", "tie"].includes(preference.selected),
      `assessment.preferences[${index}].selected must be A, B, or tie`,
    );
    return Object.freeze({
      evidence: boundedText(
        preference.evidence,
        `assessment.preferences[${index}].evidence`,
        hopeWritePlainLanguageComparisonLimits.evidenceCharacters,
      ),
      id: preference.id,
      selected: preference.selected,
    });
  }));
  return Object.freeze({ candidates, preferences });
}

function recordKey({ caseId, run }) {
  return `${caseId}:${run}`;
}

function variantCandidate(assessment, assignment, variant) {
  const candidateId = assignment.A === variant ? "A" : "B";
  return assessment.candidates.find((candidate) => candidate.id === candidateId);
}

function candidatePassed(candidate) {
  return [...candidate.assertions, ...candidate.criteria].every(
    (judgment) => judgment.passed,
  );
}

function selectedVariant(preference, assignment) {
  return preference.selected === "tie"
    ? "tie"
    : assignment[preference.selected];
}

export function createHopeWritePlainLanguageComparisonResult(value) {
  assertComparison(Array.isArray(value), "result input must be an array");
  const expected = assessmentRuns();
  assertComparison(
    value.length === expected.length,
    `result input must contain ${expected.length} assessed pairs`,
  );
  const normalized = value.map((record, index) => {
    exactKeys(
      record,
      ["assessment", "caseId", "outputs", "run"],
      `records[${index}]`,
    );
    const prepared = prepareHopeWritePlainLanguageComparisonAssessment(record);
    const assessment = validateHopeWritePlainLanguageComparisonAssessment(
      record.assessment,
      record.caseId,
    );
    return Object.freeze({
      assessment,
      assignment: prepared.privateAssignment,
      caseId: record.caseId,
      inputDigest: prepared.inputDigest,
      outputDigests: prepared.outputDigests,
      run: record.run,
    });
  });
  const expectedKeys = new Set(expected.map(recordKey));
  const actualKeys = normalized.map(recordKey);
  assertComparison(
    new Set(actualKeys).size === actualKeys.length,
    "result input repeats an assessed pair",
  );
  assertComparison(
    actualKeys.every((key) => expectedKeys.has(key)),
    "result input contains an unplanned assessed pair",
  );
  const variants = Object.fromEntries(
    HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VARIANTS.map((variant) => [
      variant,
      {
        assertionFailures: 0,
        criterionFailures: 0,
        eligibleOutputs: 0,
        overallWins: 0,
        plainLanguageWins: 0,
      },
    ]),
  );
  let overallTies = 0;
  let plainLanguageTies = 0;
  for (const record of normalized) {
    for (const variant of HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VARIANTS) {
      const candidate = variantCandidate(
        record.assessment,
        record.assignment,
        variant,
      );
      variants[variant].assertionFailures += candidate.assertions.filter(
        (judgment) => !judgment.passed,
      ).length;
      variants[variant].criterionFailures += candidate.criteria.filter(
        (judgment) => !judgment.passed,
      ).length;
      if (candidatePassed(candidate)) variants[variant].eligibleOutputs += 1;
    }
    const overall = record.assessment.preferences.find(
      (preference) => preference.id === "overall",
    );
    const overallSelected = selectedVariant(overall, record.assignment);
    if (overallSelected === "tie") overallTies += 1;
    else variants[overallSelected].overallWins += 1;
    const plain = record.assessment.preferences.find(
      (preference) => preference.id === "plain-for-intended-reader",
    );
    const plainSelected = selectedVariant(plain, record.assignment);
    if (plainSelected === "tie") plainLanguageTies += 1;
    else variants[plainSelected].plainLanguageWins += 1;
  }
  for (const variant of HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VARIANTS) {
    Object.freeze(variants[variant]);
  }
  const current = variants.current;
  const baseline = variants.baseline;
  const improved = current.eligibleOutputs === expected.length
    && current.assertionFailures === 0
    && current.overallWins > baseline.overallWins
    && current.plainLanguageWins > baseline.plainLanguageWins;
  const result = Object.freeze({
    decision: improved
      ? "observed-improvement"
      : "improvement-not-demonstrated",
    feature: "hope-write-plain-language-comparison-result",
    provenance: Object.freeze({ kind: "observational-unattested" }),
    records: Object.freeze(normalized),
    releaseEligible: false,
    summary: Object.freeze({
      improved,
      overallTies,
      plainLanguageTies,
      totalPairs: expected.length,
      variants: Object.freeze(variants),
    }),
    version: HOPE_WRITE_PLAIN_LANGUAGE_COMPARISON_VERSION,
  });
  assertComparison(
    Buffer.byteLength(JSON.stringify(result), "utf8")
      <= hopeWritePlainLanguageComparisonLimits.resultBytes,
    "comparison result exceeds the byte limit",
  );
  return result;
}
