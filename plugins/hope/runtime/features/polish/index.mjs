// Generated from features/polish/index.mjs. Do not edit.
import { fileURLToPath } from "node:url";

import {
  createWritingStandard,
  loadWritingStandard,
} from "../write/index.mjs";
import { readBoundedJson } from "../work-snapshot/index.mjs";
import {
  POLISH_CONTRACT_VERSION,
  POLISH_LIMITS,
  POLISH_RISKS,
} from "./constants.mjs";
import {
  createPolishRecord,
  validatePolishRun,
} from "./validate.mjs";

export const POLISH_MODEL_ADAPTER_CODE = "HOPE_POLISH_MODEL_ADAPTER_REQUIRED";
export const POLISH_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope polishing currently runs through the Claude or Codex Skill.";

export async function createPolishBrief({
  risk = "medium",
} = {}, dependencies = {}) {
  if (!POLISH_RISKS.includes(risk)) {
    throw new TypeError(`Unknown Hope polish risk: ${risk}`);
  }
  const writingStandard = await (
    dependencies.createWritingStandard ?? createWritingStandard
  )({
    loadStandard: dependencies.loadWritingStandard ?? loadWritingStandard,
  });
  return Object.freeze({
    feature: "polish",
    version: POLISH_CONTRACT_VERSION,
    risk,
    schemaPath: fileURLToPath(
      new URL("./run-v2.schema.json", import.meta.url),
    ),
    recordSchemaPath: fileURLToPath(
      new URL("./record-v1.schema.json", import.meta.url),
    ),
    snapshot: Object.freeze([
      "Capture the exact target and only the authority sources needed to judge this run.",
      "Use a full Git object ID or a `sha256:` content digest for Git. Use a `sha256:` content digest for every other source.",
      "Recheck the target identity before changing it. A changed target starts a new run.",
    ]),
    contract: Object.freeze([
      "Name the target purpose, bounded in-scope and out-of-scope areas, preservation conditions, and change budget before editing.",
      "Do not intentionally change observable behavior, a public contract, core meaning, facts, uncertainty, citations, or voice unless the person explicitly changes the task.",
      "Do not hide a bug fix, new requirement, or product decision inside polishing. Return needs-alignment when a material choice is unresolved.",
      "A no-change result is valid.",
    ]),
    planning: Object.freeze([
      "Create one run-specific plan from the target purpose, the person's intent, authoritative project rules, and available verification.",
      "Do not use a fixed target checklist. Treat familiar cleanup ideas as non-binding examples, not work that must be found.",
      "For every planned change, record the target, action, reason, evidence sources, preservation conditions, risk, and verification.",
      "Remove or merge content only when the run records evidence that it is unnecessary or duplicative. Otherwise keep it or return needs-alignment.",
    ]),
    editing: Object.freeze([
      "Perform at most one bounded modification round and stay within maximumChanges.",
      "Produce a new revision and change summary before any application step.",
      "For version 2, list deleted targets in removedSourceIds and identify every surviving target in outputSnapshot. Use null when every target was removed.",
      "Use the returned writing standard for language-bearing changes.",
      "Do not clean unrelated surrounding work, replace a formatter or linter, or commit, push, open a pull request, or merge unless the person separately asks.",
    ]),
    verification: Object.freeze([
      "Verify every preservation condition and change in the smallest relevant scope.",
      "Record passed, failed, inconclusive, and not-run checks honestly. Verified means only verified-in-checked-scope.",
      "Do not claim full semantic preservation from tests or inspection. Keep missing coverage and uncertainty visible.",
    ]),
    resultPreparation: Object.freeze([
      "Write one version 2 run that follows schemaPath to a private temporary JSON file outside the repository with restricted permissions.",
      "The output snapshot must identify every surviving target source. List deleted targets in removedSourceIds; for no-change, every target identity must match the input exactly.",
      "Validate the run, fix only clear contract errors, and remove the private JSON after validation or cancellation.",
      "Create the versioned record through the shared runtime when another feature composes this run. Do not author a record by hand.",
      "Record whether the revision is proposed, applied, or not needed. Applied work needs conversation-backed authority, a before-and-after comparison, and successful identity checks before and after application.",
      "Apply a revision only with explicit authority. Stop on an identity mismatch.",
    ]),
    stopping: Object.freeze([
      "Version 2 performs one plan and one modification round per exact target snapshot.",
      "Stop when the budget is used, the remaining candidate is a matter of taste, evidence is insufficient, or the next change is outside scope.",
      "Changed evidence or a changed target requires a new run.",
    ]),
    composition: Object.freeze({
      callers: Object.freeze(["align", "sweep"]),
      rules: Object.freeze([
        "The caller owns its discovery, approval, and result lifecycle. Polish owns only the bounded revision and its verification result.",
        "A composed run uses the same exact target, preservation, evidence, authority, identity, and application contract as a standalone run.",
        "Return needs-alignment instead of changing behavior, a public contract, a dependency, or another material decision.",
        "Polish never imports or invokes Align or Sweep.",
      ]),
    }),
    limits: POLISH_LIMITS,
    writingStandard,
  });
}

// Deprecated version 1 compatibility aliases.
export {
  createPolishRecordFile as createPolishReceiptFile,
};

export async function validatePolishFile(inputPath, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope polish run",
    maximumBytes: POLISH_LIMITS.inputBytes,
  });
  return (dependencies.validate ?? validatePolishRun)(input.value, {
    inputFileBytes: input.fileBytes,
    observedMetrics: dependencies.observedMetrics,
  });
}

export async function createPolishRecordFile(inputPath, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope polish run",
    maximumBytes: POLISH_LIMITS.inputBytes,
  });
  return (dependencies.createRecord ?? createPolishRecord)(input.value, {
    inputFileBytes: input.fileBytes,
    observedMetrics: dependencies.observedMetrics,
  });
}

export function runPolish() {
  const error = new Error(POLISH_MODEL_ADAPTER_MESSAGE);
  error.code = POLISH_MODEL_ADAPTER_CODE;
  throw error;
}
