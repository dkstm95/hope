// Generated from features/align/index.mjs. Do not edit.
import { fileURLToPath } from "node:url";

import {
  preflightArtifactOutput,
  publishArtifact,
} from "../artifact/index.mjs";
import {
  loadWritingStandard,
  WRITE_BRIEF_VERSION,
} from "../write/index.mjs";
import { readBoundedJson } from "../work-snapshot/index.mjs";
import { resolveSettings } from "../../settings/index.mjs";
import {
  ALIGN_CONTRACT_VERSION,
  ALIGN_LIMITS,
  ALIGN_PERSPECTIVES,
  ALIGN_RISKS,
} from "./constants.mjs";
import { renderAlignSession } from "./render.mjs";
import { validateAlignState } from "./validate.mjs";

export const ALIGN_MODEL_ADAPTER_CODE = "HOPE_ALIGN_MODEL_ADAPTER_REQUIRED";
export const ALIGN_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope alignment currently runs through the Claude or Codex Skill.";

export async function createAlignBrief({
  hostLocale,
  locale,
  risk = "medium",
  theme,
  ui = false,
} = {}, dependencies = {}) {
  if (!ALIGN_RISKS.includes(risk)) {
    throw new TypeError(`Unknown Hope align risk: ${risk}`);
  }
  if (typeof ui !== "boolean") {
    throw new TypeError("Hope align UI flag must be a boolean");
  }
  const [settings, writingStandard] = await Promise.all([
    (dependencies.resolveSettings ?? resolveSettings)({
      hostLocale,
      locale,
      theme,
      ...(dependencies.settingsOptions ?? {}),
    }),
    (dependencies.loadWritingStandard ?? loadWritingStandard)(),
  ]);
  return Object.freeze({
    feature: "align",
    version: ALIGN_CONTRACT_VERSION,
    risk,
    ui,
    locale: settings.locale,
    theme: settings.theme,
    schemaPath: fileURLToPath(
      new URL("./session-v1.schema.json", import.meta.url),
    ),
    perspectives: ALIGN_PERSPECTIVES,
    activation: Object.freeze({
      always: Object.freeze(["shared-understanding"]),
      mediumOrHigh: Object.freeze([
        "product-requirements",
        "vertical-slices",
      ]),
      whenArchitectureChanges: "system-architecture",
      whenProgramShapeMatters: "program-design",
      whenUiChanges: "experience-design",
    }),
    snapshot: Object.freeze([
      "Capture only sources that can change the alignment decision.",
      "Use a full Git object ID or a `sha256:` content digest for Git. Use a `sha256:` content digest for every other source.",
      "A mutable name such as main, latest, or current does not identify a stable source. A changed source starts a new Align revision.",
    ]),
    interview: Object.freeze([
      "Inspect available project evidence before asking the person for a fact.",
      "Ask only about intent, preference, work rules, or a material choice.",
      "Teach back the current goal, scope, examples, and important assumptions.",
      "Include why a question matters, realistic options, a recommendation, and how the person can delegate the choice.",
      "Do not repeat a closed question or force implementation-time discovery into the interview.",
      "Propose readiness only when the runtime reports no blocker. Wait for explicit user approval before implementation.",
    ]),
    state: Object.freeze([
      "Keep one private version 1 state that follows schemaPath and update it instead of replaying the conversation.",
      "Keep repository facts, user decisions with source IDs, AI proposals, open questions, assumptions, and uncertainty distinct.",
      "Record why every perspective is active or skipped. Do not activate one only to fill the schema.",
      "Validate after several related decisions are settled. A successful validation does not prove perfect understanding.",
    ]),
    approval: Object.freeze([
      "Model-authored state cannot approve itself.",
      "The approved phase requires a trusted approval record from the host, supplied outside the state and bound to a sourced decision and a conversation turn with a content digest.",
      "When only the CLI is available, the Skill keeps ready-proposed in the runtime state. It may continue only after an explicit user response and must not claim runtime approval.",
    ]),
    rendering:
      "Render after several related decisions are settled or when the person asks, not after every message.",
    response:
      "Keep the interview conversational. Show the current understanding and remaining material choice; do not return a generic plan.",
    lifecycle: Object.freeze([
      "Write the state JSON only to a private temporary file outside the repository with restricted permissions.",
      "Never replace an existing HTML output.",
      "Remove private state after completion or cancellation. Keep the published HTML artifact.",
    ]),
    limits: ALIGN_LIMITS,
    writingStandard: Object.freeze({
      text: writingStandard,
      version: WRITE_BRIEF_VERSION,
    }),
  });
}

export async function validateAlignFile(inputPath, dependencies = {}) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope align state",
    maximumBytes: ALIGN_LIMITS.inputBytes,
  });
  return (dependencies.validate ?? validateAlignState)(input.value, {
    approval: dependencies.approval,
    inputFileBytes: input.fileBytes,
    observedMetrics: dependencies.observedMetrics,
  });
}

export async function renderAlignFile({
  inputPath,
  outputPath,
} = {}, dependencies = {}) {
  const preparedOutput = await (
    dependencies.preflightOutput ?? preflightArtifactOutput
  )(outputPath, { noun: "alignment artifact" });
  const session = await (dependencies.validateFile ?? validateAlignFile)(
    inputPath,
    dependencies,
  );
  const rendered = await (dependencies.render ?? renderAlignSession)(session);
  const publishedPath = await (
    dependencies.publish ?? publishArtifact
  )(rendered.bytes, {
    directoryPrefix: "hope-align-",
    fileName: "hope-alignment.html",
    noun: "alignment artifact",
    outputPath: preparedOutput,
    temporaryRoot: dependencies.temporaryRoot,
  });
  return Object.freeze({
    artifactDigest: rendered.digest,
    designVersion: rendered.designVersion,
    outputPath: publishedPath,
    rendererVersion: rendered.rendererVersion,
    resources: Object.freeze({
      ...session.resources,
      artifactBytes: rendered.bytes.length,
    }),
    result: session.result,
    revision: session.revision,
    title: session.title,
  });
}

export function runAlign() {
  const error = new Error(ALIGN_MODEL_ADAPTER_MESSAGE);
  error.code = ALIGN_MODEL_ADAPTER_CODE;
  throw error;
}
