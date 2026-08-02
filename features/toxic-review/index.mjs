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
import { validateToxicReview } from "./validate.mjs";

export const TOXIC_REVIEW_MODEL_ADAPTER_CODE =
  "HOPE_TOXIC_REVIEW_MODEL_ADAPTER_REQUIRED";
export const TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope toxic review currently runs through the Claude or Codex Skill.";

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
      "Do not put elapsed time or token claims in reviewer-authored JSON. A trusted host may supply observed metrics separately.",
      "Validate the result, fix only clear contract errors, and remove the private JSON after validation or cancellation.",
    ]),
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

export function runToxicReview() {
  const error = new Error(TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE);
  error.code = TOXIC_REVIEW_MODEL_ADAPTER_CODE;
  throw error;
}
