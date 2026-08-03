// Generated from features/align/index.mjs. Do not edit.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  preflightArtifactOutput,
  publishArtifact,
} from "../artifact/index.mjs";
import {
  createWritingStandard,
  loadWritingStandard,
} from "../write/index.mjs";
import { readBoundedJson } from "../work-snapshot/index.mjs";
import { POLISH_LIMITS } from "../polish/constants.mjs";
import { validatePolishRun } from "../polish/validate.mjs";
import { resolveSettings } from "../../settings/index.mjs";
import {
  ALIGN_CONTRACT_VERSION,
  ALIGN_LIMITS,
  ALIGN_PERSPECTIVES,
  ALIGN_RISKS,
} from "./constants.mjs";
import { renderAlignSession } from "./render.mjs";
import {
  alignCandidateDigest,
  validateAlignState,
} from "./validate.mjs";

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
    (dependencies.createWritingStandard ?? createWritingStandard)({
      loadStandard: dependencies.loadWritingStandard ?? loadWritingStandard,
    }),
  ]);
  return Object.freeze({
    feature: "align",
    version: ALIGN_CONTRACT_VERSION,
    risk,
    ui,
    locale: settings.locale,
    theme: settings.theme,
    schemaPath: fileURLToPath(
      new URL("./session-v3.schema.json", import.meta.url),
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
      "Keep one private version 3 state that follows schemaPath and update it instead of replaying the conversation.",
      "Keep repository facts, user decisions with source IDs, AI proposals, open questions, assumptions, and uncertainty distinct.",
      "Record why every perspective is active or skipped. Do not activate one only to fill the schema.",
      "For UI work, record the changed aspects and preview disposition. Layout, hierarchy, placement, flow, and screen-state changes require provided wide and narrow frames from one canonical screen tree.",
      "Choose up to three primary agreement IDs for the first reading path. Open proposals remain visible even when they are not selected.",
      "Use not-required only for non-UI or copy-only work and record the reason.",
      "Validate after several related decisions are settled. A successful validation does not prove perfect understanding.",
    ]),
    polishing: Object.freeze([
      "After validation reports contractReady and before asking for approval, prepare one Polish target for the exact candidate state.",
      "Invoke Hope Polish once for that candidate digest. Preserve every fact, source, decision, uncertainty, and meaning. Do not create a new product choice.",
      "Consume the result through Align's complete-polish transition. Do not author a Polish receipt directly.",
      "If Polish returns a revision, increment the Align revision, record the change, and remain contract-ready before completing the transition.",
      "If Polish returns no-change, keep the candidate. If it returns needs-alignment, increment the revision, record a blocker, and continue the interview.",
      "The transition rejects a second pass over the same candidate digest. A user change creates a new candidate and may receive one new pass.",
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
    writingStandard,
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

export async function prepareAlignPolishCandidate(
  inputPath,
  dependencies = {},
) {
  const input = await (dependencies.readInput ?? readBoundedJson)(inputPath, {
    label: "Hope align state",
    maximumBytes: ALIGN_LIMITS.inputBytes,
  });
  const session = (dependencies.validate ?? validateAlignState)(input.value, {
    inputFileBytes: input.fileBytes,
  });
  if (
    !session.result.contractReady
    || session.readiness.state !== "ready-proposed"
  ) {
    const error = new Error(
      "Hope align can prepare Polish only for a contract-ready, ready-proposed candidate",
    );
    error.code = "HOPE_ALIGN_POLISH_NOT_READY";
    throw error;
  }
  const candidateDigest = (dependencies.candidateDigest ?? alignCandidateDigest)(
    session,
  );
  if (session.polish?.resultDigest === candidateDigest) {
    const error = new Error(
      "Hope align already completed Polish for this exact candidate",
    );
    error.code = "HOPE_ALIGN_POLISH_ALREADY_COMPLETED";
    throw error;
  }
  return Object.freeze({
    feature: "align-polish-candidate",
    version: ALIGN_CONTRACT_VERSION,
    risk: session.taskRisk,
    revision: session.revision,
    source: Object.freeze({
      id: "align-candidate",
      kind: "artifact",
      label: session.title,
      locator: resolve(inputPath),
      digest: candidateDigest,
    }),
    preservation: Object.freeze([
      "Preserve every repository fact and its source IDs.",
      "Preserve every user decision, rationale, and source ID.",
      "Preserve open uncertainty and its certainty level.",
      "Preserve the goal, scope, success conditions, scenarios, and implementation meaning.",
      "Do not add a product decision or resolve an ambiguity.",
    ]),
    next:
      "Run Hope Polish once for this digest, then consume its result with the Align complete-polish transition.",
  });
}

function alignPolishError(message, code = "HOPE_ALIGN_POLISH_INVALID") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function exactTargetSource(run, expected) {
  if (
    run.target.sourceIds.length !== 1
    || run.target.sourceIds[0] !== expected.id
  ) {
    throw alignPolishError(
      "Hope Align Polish must target only the prepared Align candidate",
    );
  }
  const source = run.snapshot.sources.find((item) => item.id === expected.id);
  if (
    !source
    || source.kind !== expected.kind
    || source.locator !== expected.locator
    || source.digest !== expected.digest
  ) {
    throw alignPolishError(
      "Hope Align Polish input must match the prepared candidate identity",
    );
  }
  return source;
}

function exactOutputSource(run, expectedDigest) {
  const source = run.outcome.outputSnapshot?.sources[0];
  if (
    !source
    || source.id !== "align-candidate"
    || source.kind !== "artifact"
    || source.digest !== expectedDigest
  ) {
    throw alignPolishError(
      "Hope Align Polish output must match the revalidated candidate identity",
    );
  }
  return source;
}

export async function completeAlignPolish({
  afterPath,
  beforePath,
  polishPath,
} = {}, dependencies = {}) {
  if (!beforePath || !polishPath) {
    throw new TypeError(
      "Hope Align complete-polish requires beforePath and polishPath",
    );
  }
  const readInput = dependencies.readInput ?? readBoundedJson;
  const [beforeInput, polishInput] = await Promise.all([
    readInput(beforePath, {
      label: "Hope align state before Polish",
      maximumBytes: ALIGN_LIMITS.inputBytes,
    }),
    readInput(polishPath, {
      label: "Hope polish run",
      maximumBytes: POLISH_LIMITS.inputBytes,
    }),
  ]);
  const before = (dependencies.validateAlign ?? validateAlignState)(
    beforeInput.value,
    { inputFileBytes: beforeInput.fileBytes },
  );
  if (
    !before.result.contractReady
    || before.readiness.state !== "ready-proposed"
  ) {
    throw alignPolishError(
      "Hope Align can complete Polish only from a contract-ready, ready-proposed candidate",
      "HOPE_ALIGN_POLISH_NOT_READY",
    );
  }
  const candidateDigest = (
    dependencies.candidateDigest ?? alignCandidateDigest
  )(before);
  if (before.polish?.resultDigest === candidateDigest) {
    throw alignPolishError(
      "Hope align already completed Polish for this exact candidate",
      "HOPE_ALIGN_POLISH_ALREADY_COMPLETED",
    );
  }
  const expectedSource = {
    id: "align-candidate",
    kind: "artifact",
    locator: resolve(beforePath),
    digest: candidateDigest,
  };
  const polish = (dependencies.validatePolish ?? validatePolishRun)(
    polishInput.value,
    { inputFileBytes: polishInput.fileBytes },
  );
  exactTargetSource(polish, expectedSource);

  let authoredState = beforeInput.value;
  let resultDigest = candidateDigest;
  if (polish.outcome.status === "revised") {
    if (!afterPath) {
      throw alignPolishError(
        "A revised Align Polish result requires afterPath",
      );
    }
    if (polish.application.status !== "applied") {
      throw alignPolishError(
        "A revised Align candidate must be applied before completion",
      );
    }
    const afterInput = await readInput(afterPath, {
      label: "Hope align state after Polish",
      maximumBytes: ALIGN_LIMITS.inputBytes,
    });
    if (afterInput.value.polish !== undefined) {
      throw alignPolishError(
        "The post-Polish Align state must not contain a pre-authored receipt",
      );
    }
    const after = (dependencies.validateAlign ?? validateAlignState)(
      afterInput.value,
      { inputFileBytes: afterInput.fileBytes },
    );
    if (
      after.revision !== before.revision + 1
      || after.readiness.state !== "ready-proposed"
      || !after.result.contractReady
    ) {
      throw alignPolishError(
        "A revised Align state must increment revision and remain contract-ready and ready-proposed",
      );
    }
    if (after.changes.length <= before.changes.length) {
      throw alignPolishError(
        "A revised Align state must record its Polish change",
      );
    }
    authoredState = afterInput.value;
    resultDigest = (
      dependencies.candidateDigest ?? alignCandidateDigest
    )(after);
    exactOutputSource(polish, resultDigest);
  } else if (polish.outcome.status === "no-change") {
    if (afterPath) {
      throw alignPolishError(
        "A no-change Align Polish result must not supply afterPath",
      );
    }
    exactOutputSource(polish, candidateDigest);
  } else {
    if (!afterPath) {
      throw alignPolishError(
        "A needs-alignment Polish result requires afterPath",
      );
    }
    const afterInput = await readInput(afterPath, {
      label: "Hope align state after Polish",
      maximumBytes: ALIGN_LIMITS.inputBytes,
    });
    if (afterInput.value.polish !== undefined) {
      throw alignPolishError(
        "The post-Polish Align state must not contain a pre-authored receipt",
      );
    }
    const after = (dependencies.validateAlign ?? validateAlignState)(
      afterInput.value,
      { inputFileBytes: afterInput.fileBytes },
    );
    if (
      after.revision !== before.revision + 1
      || after.readiness.state !== "interviewing"
      || after.result.blockers.length === 0
    ) {
      throw alignPolishError(
        "A needs-alignment result must increment revision and return to interviewing with a recorded blocker",
      );
    }
    authoredState = afterInput.value;
    resultDigest = (
      dependencies.candidateDigest ?? alignCandidateDigest
    )(after);
  }

  const receipt = Object.freeze({
    candidateDigest,
    resultDigest,
    outcome: polish.outcome.status,
    verificationStatus: polish.result.verificationStatus,
    changeSummary: Object.freeze(
      polish.outcome.status === "revised"
        ? polish.outcome.changes.map((change) => change.summary)
        : [],
    ),
  });
  const state = {
    ...authoredState,
    polish: receipt,
  };
  const validated = (dependencies.validateAlign ?? validateAlignState)(state);
  return Object.freeze({
    receipt,
    result: validated.result,
    state: Object.freeze(state),
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
