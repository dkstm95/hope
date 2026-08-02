// Generated from features/toxic-review/index.mjs. Do not edit.
import { fileURLToPath } from "node:url";

import {
  createWritingStandard,
  loadWritingStandard,
} from "../write/index.mjs";
import { readBoundedJson } from "../work-snapshot/index.mjs";
import {
  TOXIC_REVIEW_CONTRACT_VERSION,
  TOXIC_REVIEW_LIMITS,
  TOXIC_REVIEW_RISKS,
  TOXIC_REVIEW_STAGES,
  TOXIC_REVIEW_TARGETS,
} from "./constants.mjs";
import {
  causalCompletenessEvaluationReceiptLimits,
  createCausalCompletenessEvaluationPlan,
  createCausalCompletenessEvaluationReceiptTemplate,
  getCausalCompletenessEvaluationOracle,
  prepareCausalCompletenessEvaluationRun,
  validateCausalCompletenessEvaluationReceipt,
  validateCausalCompletenessEvaluationReceiptSet,
} from "./causal-evaluation.mjs";
import { validateToxicReview } from "./validate.mjs";

export {
  causalCompletenessEvaluationCases,
  causalCompletenessEvaluationProtocol,
  causalCompletenessEvaluationReceiptLimits,
  causalCompletenessRubric,
  createCausalCompletenessEvaluationPlan,
  createCausalCompletenessEvaluationReceiptTemplate,
  digestCausalEvaluationValue,
  getCausalCompletenessEvaluationOracle,
  prepareCausalCompletenessEvaluationRun,
  validateCausalCompletenessEvaluationReceipt,
  validateCausalCompletenessEvaluationReceiptSet,
} from "./causal-evaluation.mjs";

export const TOXIC_REVIEW_MODEL_ADAPTER_CODE =
  "HOPE_TOXIC_REVIEW_MODEL_ADAPTER_REQUIRED";
export const TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope toxic review currently runs through the Claude or Codex Skill.";

const causalCompletenessDecisionExamples = Object.freeze([
  Object.freeze({
    id: "repeated-boundary-dominates",
    situation:
      "One local function is slow, but captured end-to-end measurements show repeated state loading at a process boundary dominates the critical path.",
    expectedDecision:
      "Prefer the supported boundary-level candidate, state what would disconfirm it, and do not prioritize the off-path local function.",
  }),
  Object.freeze({
    id: "local-stage-dominates",
    situation:
      "The captured flow crosses each boundary once, while one measured local stage dominates the critical path and scales with the observed outcome.",
    expectedDecision:
      "Prefer the supported local candidate and do not invent a structural alternative merely to create competition.",
  }),
  Object.freeze({
    id: "missing-discriminating-evidence",
    situation:
      "The work product claims a cause, but the captured sources contain no baseline or observation that distinguishes it from another material explanation.",
    expectedDecision:
      "Treat the missing evidence as material, keep causation inconclusive, and defer the finding with the lowest-cost safe next check.",
  }),
]);

const causalCompleteness = Object.freeze({
  activation:
    "Select this perspective only when a named work product makes or relies on a material causal claim. Do not select it only because the target kind is incident.",
  role: Object.freeze([
    "Assign this sequence to one selected role and set that role's method to causal-completeness. Other roles keep independent targets, evidence, exclusions, and claims.",
    "Bind the claimed outcome and any captured baseline before reviewing a cause. Treat a missing baseline as an evidence gap instead of inventing one.",
    "Map only the end-to-end flow, state owners, I/O, and process boundaries relevant to the claimed outcome before judging a local explanation.",
    "Compare only materially distinct candidates supported by captured sources. A candidate is a still-plausible explanation for a material share of the outcome at the highest phase or boundary level the evidence supports. Zero or one supported candidate is valid; never manufacture an alternative.",
    "Remove a proposed cause from the candidate set when a captured upper bound or contrary observation disconfirms material contribution. Keep its rejection in the flow or finding instead of counting it as a live candidate.",
    "A long serial phase on the captured critical path can remain a phase-level candidate even when its internal implementation cause is unresolved. Keep independently bounded, non-overlapping material phases as distinct candidates; do not merge them only because one unresolved cross-cutting aggregate spans them. Do not reduce the candidate count to zero only because the source cannot split work inside a phase.",
    "For each candidate, record its evidence, assumptions, and one prediction that could disconfirm it.",
    "Choose the next check from the candidate count: with zero candidates, name the minimum observation needed to form one; with one, name the lowest-cost safe check that could disconfirm it; with two or more, name the lowest-cost safe discriminator.",
    "Do not execute a new check or mix later evidence into this run. If no safe check exists, state that limit instead of inventing one.",
  ]),
  record: Object.freeze([
    "When the causal-completeness method is selected, include one top-level causalAnalysis object for that role. Validation rejects a selected causal role without this record.",
    "Record the outcome, captured baseline or its absence, claim assessment, cause level, candidate count, mapped flow, candidates, and next check defined by schemaPath.",
    "Map every material observed phase or boundary before selecting candidates. Link each flow item to one or more candidates, or give a concrete exclusion reason.",
    "For every candidate, record its structural, local, or mixed level; location; statement; evidence; assumptions; disconfirming prediction; and source IDs.",
    "Treat an inseparable aggregate as one uncertainty boundary. Do not promote its named subcomponents to separate candidates unless a captured observation distinguishes them. When separately observed material phases partition that aggregate, link the aggregate flow item to those phase candidates instead of replacing them with one aggregate candidate.",
    "Do not keep a disconfirmed claimed cause as a candidate merely to document it. Do not exclude a material serial phase merely because its internal mechanism remains uncertain.",
    "candidateCount must equal the candidates array. Every candidate must be linked from the mapped flow, and nextCheck must reference every candidate.",
  ]),
  outcome: Object.freeze([
    "Set finding confidence from the evidence for the work product's defect, not from confidence in a root cause. An unsupported causal claim can be an established finding even when causation remains inconclusive.",
    "Defer a finding with a concrete nextStep only when new evidence or follow-up is required before the adjudication can close.",
    "For an inconclusive causal review, say so in the summary and name the missing evidence in scopeLimits.",
    "noMaterialIssueFound describes the checked work product, not whether Hope disproved a root cause. Do not manufacture a finding when the work product already represents uncertainty honestly.",
  ]),
  stopping: Object.freeze([
    "With zero candidates, stop after naming the minimum evidence needed to form one.",
    "With one candidate, stop after recording its disconfirming prediction and lowest-cost safe check.",
    "With two or more candidates, stop after each has a distinguishing prediction and the lowest-cost safe discriminator is known.",
    "When no safe check exists, state that limit and stop.",
    "Exclude branches outside the captured outcome and source set instead of expanding into an unbounded diagnosis.",
    "Changed evidence starts a new snapshot and review run.",
  ]),
  decisionExamples: causalCompletenessDecisionExamples,
});

export async function createToxicReviewBrief({
  risk = "medium",
  stage = "implementation",
  target = "other",
} = {}, dependencies = {}) {
  if (!TOXIC_REVIEW_RISKS.includes(risk)) {
    throw new TypeError(`Unknown Hope toxic review risk: ${risk}`);
  }
  if (!TOXIC_REVIEW_STAGES.includes(stage)) {
    throw new TypeError(`Unknown Hope toxic review stage: ${stage}`);
  }
  if (!TOXIC_REVIEW_TARGETS.includes(target)) {
    throw new TypeError(`Unknown Hope toxic review target: ${target}`);
  }
  const writingStandard = await (
    dependencies.createWritingStandard ?? createWritingStandard
  )({
    loadStandard: dependencies.loadWritingStandard ?? loadWritingStandard,
  });
  return Object.freeze({
    feature: "toxic-review",
    version: TOXIC_REVIEW_CONTRACT_VERSION,
    risk,
    stage,
    target,
    schemaPath: fileURLToPath(
      new URL("./review-v1.schema.json", import.meta.url),
    ),
    snapshot: Object.freeze([
      "Capture only sources needed to answer the selected claims.",
      "Use a full Git object ID or a `sha256:` content digest for Git. Use a `sha256:` content digest for every other source.",
      "Do not mix later content into the snapshot. Changed evidence starts a new run and result.",
    ]),
    roleSelection: Object.freeze([
      "Select one to six roles from the target, stage, evidence, and material risk. Do not use a fixed panel.",
      "Give every role an explicit target, focus risks, evidence source IDs, exclusions, claims to test, and expected output.",
      "Give each independent reviewer only the smallest source bundle needed for its claims.",
    ]),
    findings: Object.freeze([
      "A role may cite only its assigned evidence source IDs.",
      "Each finding records a concrete issue, practical impact, proposed action, priority, confidence, and source IDs.",
      "A review with no findings is valid. Do not manufacture criticism or turn uncertainty into an established defect.",
    ]),
    adjudication: Object.freeze([
      "Judge every finding as accepted, partially-accepted, rejected, deferred, or duplicate.",
      "Use evidence, impact, current scope, feasibility, and duplication. Do not count reviewer votes.",
      "For accepted and partially accepted findings, record the final action, impact, priority, confidence, and source IDs. Keep the role's original proposal only in the audit record.",
      "A deferred finding needs a next step and remains unresolved. It cannot set noMaterialIssueFound to true.",
      "A duplicate points to its owning finding. Rejected findings stay in the audit but not in actionable work.",
    ]),
    resultPreparation: Object.freeze([
      "Write one version 1 result that follows schemaPath to a private temporary JSON file outside the repository with restricted permissions.",
      "If a role uses method causal-completeness, include the schema's causalAnalysis record before validation.",
      "Do not put elapsed time or token claims in reviewer-authored JSON. A trusted host may supply observed metrics separately.",
      "Validate the result, fix only clear contract errors, and remove the private JSON after validation or cancellation.",
    ]),
    causalCompleteness,
    finalVoice:
      "Present the adjudicated result in one strict, competent voice. Lead with the highest-priority accepted issue, keep deferred risk visible, or say no material issue was found in the checked scope. Never attack a person.",
    stopping: Object.freeze([
      "Version 1 performs one round per run.",
      "Start a new run with a new snapshot only when changed evidence or an accepted high-impact finding creates a different material question.",
      "Stop when another run would repeat evidence or only increase the criticism count.",
    ]),
    limits: TOXIC_REVIEW_LIMITS,
    writingStandard,
  });
}

export async function validateToxicReviewFile(inputPath, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope toxic review",
    maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes,
  });
  return (dependencies.validate ?? validateToxicReview)(input.value, {
    inputFileBytes: input.fileBytes,
    observedMetrics: dependencies.observedMetrics,
  });
}

async function activeCausalEvaluationBrief(dependencies) {
  return await createToxicReviewBrief(
    { risk: "high", stage: "completed", target: "document" },
    dependencies,
  );
}

export async function createCausalCompletenessEvaluationPlanForActiveBrief(
  dependencies = {},
) {
  const brief = await activeCausalEvaluationBrief(dependencies);
  return createCausalCompletenessEvaluationPlan({ brief });
}

export async function createCausalCompletenessEvaluationRun(
  options,
  dependencies = {},
) {
  const brief = await activeCausalEvaluationBrief(dependencies);
  return prepareCausalCompletenessEvaluationRun({ ...options, brief });
}

export async function createCausalCompletenessEvaluationReceiptTemplateFromFile(
  options,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(
    options.inputPath,
    {
      label: "Hope toxic review causal evaluation output",
      maximumBytes: TOXIC_REVIEW_LIMITS.inputBytes,
    },
  );
  const validatedReview = (dependencies.validate ?? validateToxicReview)(
    input.value,
    { inputFileBytes: input.fileBytes },
  );
  const brief = await activeCausalEvaluationBrief(dependencies);
  return createCausalCompletenessEvaluationReceiptTemplate({
    ...options,
    brief,
    validatedReview,
  });
}

export async function validateCausalCompletenessEvaluationReceiptFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope toxic review causal evaluation receipt",
    maximumBytes: causalCompletenessEvaluationReceiptLimits.bytes,
  });
  const brief = await activeCausalEvaluationBrief(dependencies);
  return validateCausalCompletenessEvaluationReceipt(input.value, { brief });
}

export async function validateCausalCompletenessEvaluationReceiptSetFile(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope toxic review causal evaluation receipt set",
    maximumBytes: 2 * 1024 * 1024,
  });
  const brief = await activeCausalEvaluationBrief(dependencies);
  return validateCausalCompletenessEvaluationReceiptSet(input.value, { brief });
}

export function runToxicReview() {
  const error = new Error(TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE);
  error.code = TOXIC_REVIEW_MODEL_ADAPTER_CODE;
  throw error;
}
