// Generated from features/align/validate.mjs. Do not edit.
import { createHash } from "node:crypto";

import { createResultValidation } from "../result-validation/index.mjs";
import {
  serializedJsonBytes,
  stringBytes,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import {
  ALIGN_CONTRACT_VERSION,
  ALIGN_LIMITS,
  ALIGN_PERSPECTIVES,
  ALIGN_PHASES,
  ALIGN_RISKS,
  ALIGN_SUPPORTED_VERSIONS,
} from "./constants.mjs";

const scenarioKinds = Object.freeze([
  "representative",
  "edge",
  "counterexample",
]);
const assumptionOrigins = Object.freeze(["user", "repository", "ai"]);
const assumptionStates = Object.freeze(["confirmed", "delegated", "open"]);
const uncertaintyClasses = Object.freeze([
  "research",
  "implementation-check",
  "deferred",
]);
const polishOutcomes = Object.freeze([
  "revised",
  "no-change",
  "needs-alignment",
]);
const polishVerificationStatuses = Object.freeze([
  "verified-in-checked-scope",
  "incomplete",
  "failed",
  "not-completed",
]);
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const previewAspects = Object.freeze([
  "none",
  "copy",
  "layout",
  "visual-hierarchy",
  "component-placement",
  "user-flow",
  "screen-state",
]);
const previewDispositions = Object.freeze([
  "required",
  "provided",
  "not-required",
]);
const previewNodeTypes = Object.freeze([
  "group",
  "heading",
  "text",
  "list",
  "status",
  "action",
  "divider",
]);

const {
  array,
  choice,
  identifier,
  integer,
  object,
  plainObject,
  references: sourceIds,
  stringList,
  text,
  unknownKeys: addUnknownKeys,
} = createResultValidation({
  groupItems: ALIGN_LIMITS.groupItems,
  referenceNoun: "source ID",
  stringCharacters: ALIGN_LIMITS.stringCharacters,
});

function validateUnderstanding(value, errors, ids) {
  const input = object(value, "understanding", errors);
  addUnknownKeys(
    input,
    ["goal", "success", "inScope", "outOfScope", "scenarios"],
    "understanding",
    errors,
  );
  const scenarios = array(
    input.scenarios,
    "understanding.scenarios",
    errors,
    ALIGN_LIMITS.scenarios,
  ).map((entry, index) => {
    const path = `understanding.scenarios[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["expected", "id", "kind", "situation"], path, errors);
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      kind: choice(item.kind, scenarioKinds, `${path}.kind`, errors),
      situation: text(item.situation, `${path}.situation`, errors),
      expected: text(item.expected, `${path}.expected`, errors),
    };
  });
  return {
    goal: text(input.goal, "understanding.goal", errors),
    success: stringList(input.success, "understanding.success", errors),
    inScope: stringList(input.inScope, "understanding.inScope", errors),
    outOfScope: stringList(input.outOfScope, "understanding.outOfScope", errors),
    scenarios,
  };
}

function validateRecords(value, errors, ids, knownSources) {
  const input = object(value, "records", errors);
  addUnknownKeys(
    input,
    ["facts", "decisions", "proposals", "openQuestions"],
    "records",
    errors,
  );
  const facts = array(input.facts, "records.facts", errors).map((entry, index) => {
    const path = `records.facts[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["id", "sourceIds", "text"], path, errors);
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      text: text(item.text, `${path}.text`, errors),
      sourceIds: sourceIds(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        { minimum: 1 },
      ),
    };
  });
  const decisions = array(
    input.decisions,
    "records.decisions",
    errors,
  ).map((entry, index) => {
    const path = `records.decisions[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["id", "rationale", "sourceIds", "text"], path, errors);
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      text: text(item.text, `${path}.text`, errors),
      rationale: text(item.rationale, `${path}.rationale`, errors),
      sourceIds: sourceIds(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        { minimum: 1 },
      ),
    };
  });
  const proposals = array(
    input.proposals,
    "records.proposals",
    errors,
  ).map((entry, index) => {
    const path = `records.proposals[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["id", "rationale", "status", "text"], path, errors);
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      text: text(item.text, `${path}.text`, errors),
      rationale: text(item.rationale, `${path}.rationale`, errors),
      status: choice(
        item.status,
        ["open", "accepted", "rejected", "delegated"],
        `${path}.status`,
        errors,
      ),
    };
  });
  const openQuestions = array(
    input.openQuestions,
    "records.openQuestions",
    errors,
  ).map((entry, index) => {
    const path = `records.openQuestions[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(
      item,
      ["id", "options", "question", "recommendation", "whyItMatters"],
      path,
      errors,
    );
    const options = array(item.options, `${path}.options`, errors, 8).map(
      (option, optionIndex) => {
        const optionPath = `${path}.options[${optionIndex}]`;
        const optionValue = object(option, optionPath, errors);
        addUnknownKeys(optionValue, ["effect", "label"], optionPath, errors);
        return {
          label: text(optionValue.label, `${optionPath}.label`, errors),
          effect: text(optionValue.effect, `${optionPath}.effect`, errors),
        };
      },
    );
    if (options.length < 2) errors.push(`${path}.options must have at least 2 items`);
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      question: text(item.question, `${path}.question`, errors),
      whyItMatters: text(item.whyItMatters, `${path}.whyItMatters`, errors),
      recommendation: text(item.recommendation, `${path}.recommendation`, errors),
      options,
    };
  });
  return { facts, decisions, proposals, openQuestions };
}

function validatePresentation(value, errors, records) {
  const input = object(value, "presentation", errors);
  addUnknownKeys(
    input,
    ["primaryAgreementIds"],
    "presentation",
    errors,
  );
  const seen = new Set();
  const primaryAgreementIds = array(
    input.primaryAgreementIds,
    "presentation.primaryAgreementIds",
    errors,
    ALIGN_LIMITS.primaryAgreements,
  ).map((value, index) => identifier(
    value,
    `presentation.primaryAgreementIds[${index}]`,
    errors,
    seen,
  ));
  const agreements = [
    ...records.decisions,
    ...records.proposals.filter((proposal) => proposal.status !== "rejected"),
  ];
  const settled = agreements.filter(
    (agreement) => agreement.status !== "open",
  );
  const settledIds = new Set(settled.map((agreement) => agreement.id));
  for (const id of primaryAgreementIds) {
    if (!settledIds.has(id)) {
      errors.push(
        `presentation.primaryAgreementIds must reference a settled decision or proposal: ${id}`,
      );
    }
  }
  if (
    settled.length > 0
    && !primaryAgreementIds.some((id) => settledIds.has(id))
  ) {
    errors.push(
      "presentation.primaryAgreementIds must identify at least one settled agreement",
    );
  }
  return { primaryAgreementIds };
}

function validateAssumptions(value, errors, ids, knownSources) {
  return array(value, "assumptions", errors).map((entry, index) => {
    const path = `assumptions[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["id", "origin", "sourceIds", "status", "text"], path, errors);
    const origin = choice(item.origin, assumptionOrigins, `${path}.origin`, errors);
    const sources = sourceIds(item.sourceIds, `${path}.sourceIds`, errors, knownSources);
    if (origin === "repository" && sources.length === 0) {
      errors.push(
        `${path}.sourceIds must include evidence for a repository assumption`,
      );
    }
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      text: text(item.text, `${path}.text`, errors),
      origin,
      status: choice(item.status, assumptionStates, `${path}.status`, errors),
      sourceIds: sources,
    };
  });
}

function validateUncertainties(value, errors, ids) {
  return array(value, "uncertainties", errors).map((entry, index) => {
    const path = `uncertainties[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["classification", "id", "nextStep", "text"], path, errors);
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      text: text(item.text, `${path}.text`, errors),
      classification: choice(
        item.classification,
        uncertaintyClasses,
        `${path}.classification`,
        errors,
      ),
      nextStep: text(item.nextStep, `${path}.nextStep`, errors),
    };
  });
}

function validatePerspectives(value, errors) {
  const seen = new Set();
  return array(
    value,
    "perspectives",
    errors,
    ALIGN_LIMITS.perspectives,
  ).map((entry, index) => {
    const path = `perspectives[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["items", "kind", "reason", "state"], path, errors);
    const kind = choice(item.kind, ALIGN_PERSPECTIVES, `${path}.kind`, errors);
    if (seen.has(kind)) {
      errors.push(`${path}.kind repeats the ${kind} perspective`);
    }
    seen.add(kind);
    const state = choice(item.state, ["active", "skipped"], `${path}.state`, errors);
    const items = array(item.items, `${path}.items`, errors).map(
      (detail, detailIndex) => {
        const detailPath = `${path}.items[${detailIndex}]`;
        const detailValue = object(detail, detailPath, errors);
        addUnknownKeys(detailValue, ["detail", "title"], detailPath, errors);
        return {
          title: text(detailValue.title, `${detailPath}.title`, errors),
          detail: text(detailValue.detail, `${detailPath}.detail`, errors),
        };
      },
    );
    if (state === "active" && items.length === 0) {
      errors.push(`${path}.items must contain at least one item when active`);
    }
    if (state === "skipped" && items.length !== 0) {
      errors.push(`${path}.items must be empty when skipped`);
    }
    return {
      kind,
      state,
      reason: text(item.reason, `${path}.reason`, errors),
      items,
    };
  });
}

function validateSlices(value, errors, ids) {
  return array(value, "slices", errors, ALIGN_LIMITS.slices).map((entry, index) => {
    const path = `slices[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(
      item,
      ["failureRecovery", "id", "scope", "title", "userChange", "verification"],
      path,
      errors,
    );
    return {
      id: identifier(item.id, `${path}.id`, errors, ids),
      title: text(item.title, `${path}.title`, errors),
      userChange: text(item.userChange, `${path}.userChange`, errors),
      scope: text(item.scope, `${path}.scope`, errors),
      verification: text(item.verification, `${path}.verification`, errors),
      failureRecovery: text(item.failureRecovery, `${path}.failureRecovery`, errors),
    };
  });
}

function validateChanges(value, errors) {
  let previousRound = 0;
  return array(value, "changes", errors).map((entry, index) => {
    const path = `changes[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["round", "summary"], path, errors);
    const round = integer(item.round, `${path}.round`, errors, { minimum: 1 });
    if (round < previousRound) errors.push(`${path}.round must not move backward`);
    previousRound = round;
    return {
      round,
      summary: text(item.summary, `${path}.summary`, errors),
    };
  });
}

function validatePreviewNode(
  value,
  path,
  errors,
  nodeIds,
  counts,
  depth = 1,
) {
  const item = object(value, path, errors);
  addUnknownKeys(
    item,
    [
      "children",
      "emphasis",
      "id",
      "items",
      "label",
      "layout",
      "level",
      "text",
      "type",
    ],
    path,
    errors,
  );
  counts.nodes += 1;
  counts.depth = Math.max(counts.depth, depth);
  if (counts.nodes > ALIGN_LIMITS.previewNodes) {
    errors.push(`preview contains more than ${ALIGN_LIMITS.previewNodes} nodes`);
  }
  if (depth > ALIGN_LIMITS.previewDepth) {
    errors.push(`${path} exceeds preview depth ${ALIGN_LIMITS.previewDepth}`);
  }
  const type = choice(item.type, previewNodeTypes, `${path}.type`, errors);
  const result = {
    id: identifier(item.id, `${path}.id`, errors, nodeIds),
    type,
  };
  const optionalText = (key) => {
    if (item[key] === undefined) return undefined;
    return text(item[key], `${path}.${key}`, errors);
  };
  const labelValue = optionalText("label");
  const textValue = optionalText("text");
  const emphasis = item.emphasis === undefined
    ? "normal"
    : choice(
      item.emphasis,
      ["normal", "strong", "quiet"],
      `${path}.emphasis`,
      errors,
    );
  const items = item.items === undefined
    ? []
    : stringList(item.items, `${path}.items`, errors, {
      maximum: ALIGN_LIMITS.previewChildren,
    });
  const children = item.children === undefined
    ? []
    : array(
      item.children,
      `${path}.children`,
      errors,
      ALIGN_LIMITS.previewChildren,
    ).map((child, index) => validatePreviewNode(
      child,
      `${path}.children[${index}]`,
      errors,
      nodeIds,
      counts,
      depth + 1,
    ));
  const layout = item.layout === undefined
    ? undefined
    : choice(item.layout, ["stack", "row", "grid"], `${path}.layout`, errors);
  const level = item.level === undefined
    ? undefined
    : integer(item.level, `${path}.level`, errors, { minimum: 1 });
  if (level !== undefined && level > 3) {
    errors.push(`${path}.level must be at most 3`);
  }

  if (type === "group") {
    if (!layout) errors.push(`${path}.layout is required for a group node`);
    if (children.length === 0) {
      errors.push(`${path}.children must contain at least one group child`);
    }
    if (textValue || items.length > 0 || level !== undefined) {
      errors.push(`${path} group nodes allow only label, layout, emphasis, and children`);
    }
  } else if (type === "list") {
    if (items.length === 0) {
      errors.push(`${path}.items must contain at least one list item`);
    }
    if (textValue || layout || children.length > 0 || level !== undefined) {
      errors.push(`${path} list nodes allow only label, items, and emphasis`);
    }
  } else if (type === "divider") {
    if (textValue || items.length > 0 || layout || children.length > 0 || level !== undefined) {
      errors.push(`${path} divider nodes allow only an optional label`);
    }
  } else {
    if (!textValue) errors.push(`${path}.text is required for a ${type} node`);
    if (items.length > 0 || layout || children.length > 0) {
      errors.push(`${path} ${type} nodes cannot contain items, layout, or children`);
    }
    if (type === "heading" && level === undefined) {
      errors.push(`${path}.level is required for a heading node`);
    }
    if (type !== "heading" && level !== undefined) {
      errors.push(`${path}.level is allowed only for a heading node`);
    }
  }

  if (labelValue) result.label = labelValue;
  if (textValue) result.text = textValue;
  if (items.length > 0) result.items = items;
  if (layout) result.layout = layout;
  if (level !== undefined) result.level = level;
  if (emphasis !== "normal") result.emphasis = emphasis;
  if (children.length > 0) result.children = children;
  return result;
}

function validatePreview(value, errors, { scenarios, ui }) {
  const input = object(value, "preview", errors);
  addUnknownKeys(
    input,
    ["changedAspects", "disposition", "frames", "rationale", "screens"],
    "preview",
    errors,
  );
  const disposition = choice(
    input.disposition,
    previewDispositions,
    "preview.disposition",
    errors,
  );
  const changedAspects = array(
    input.changedAspects,
    "preview.changedAspects",
    errors,
    previewAspects.length,
  ).map((aspect, index) => choice(
    aspect,
    previewAspects,
    `preview.changedAspects[${index}]`,
    errors,
  ));
  if (changedAspects.length === 0) {
    errors.push("preview.changedAspects must contain at least one item");
  }
  if (new Set(changedAspects).size !== changedAspects.length) {
    errors.push("preview.changedAspects must not repeat an item");
  }

  const screenIds = new Set();
  const frameIds = new Set();
  const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  const counts = { annotations: 0, depth: 0, nodes: 0 };
  const screens = array(
    input.screens,
    "preview.screens",
    errors,
    ALIGN_LIMITS.previewScreens,
  ).map((entry, index) => {
    const path = `preview.screens[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(
      item,
      ["annotations", "id", "label", "root", "scenarioId", "state"],
      path,
      errors,
    );
    const nodeIds = new Set();
    const annotationIds = new Set();
    const screen = {
      id: identifier(item.id, `${path}.id`, errors, screenIds),
      label: text(item.label, `${path}.label`, errors),
      scenarioId: identifier(
        item.scenarioId,
        `${path}.scenarioId`,
        errors,
        new Set(),
      ),
      state: text(item.state, `${path}.state`, errors),
      root: validatePreviewNode(
        item.root,
        `${path}.root`,
        errors,
        nodeIds,
        counts,
      ),
    };
    if (!scenarioIds.has(screen.scenarioId)) {
      errors.push(`${path}.scenarioId must reference an expected scenario`);
    }
    screen.annotations = array(
      item.annotations,
      `${path}.annotations`,
      errors,
      ALIGN_LIMITS.previewAnnotations,
    ).map((entryValue, annotationIndex) => {
      const annotationPath = `${path}.annotations[${annotationIndex}]`;
      const annotation = object(entryValue, annotationPath, errors);
      addUnknownKeys(annotation, ["id", "nodeId", "text"], annotationPath, errors);
      const result = {
        id: identifier(
          annotation.id,
          `${annotationPath}.id`,
          errors,
          annotationIds,
        ),
        nodeId: identifier(
          annotation.nodeId,
          `${annotationPath}.nodeId`,
          errors,
          new Set(),
        ),
        text: text(annotation.text, `${annotationPath}.text`, errors),
      };
      if (!nodeIds.has(result.nodeId)) {
        errors.push(`${annotationPath}.nodeId must reference a node in the same screen`);
      }
      counts.annotations += 1;
      return result;
    });
    return screen;
  });
  if (counts.annotations > ALIGN_LIMITS.previewAnnotations) {
    errors.push(`preview contains more than ${ALIGN_LIMITS.previewAnnotations} annotations`);
  }

  const frames = array(
    input.frames,
    "preview.frames",
    errors,
    ALIGN_LIMITS.previewFrames,
  ).map((entry, index) => {
    const path = `preview.frames[${index}]`;
    const item = object(entry, path, errors);
    addUnknownKeys(item, ["id", "label", "screenId", "viewport"], path, errors);
    const frame = {
      id: identifier(item.id, `${path}.id`, errors, frameIds),
      label: text(item.label, `${path}.label`, errors),
      viewport: choice(item.viewport, ["wide", "narrow"], `${path}.viewport`, errors),
      screenId: identifier(
        item.screenId,
        `${path}.screenId`,
        errors,
        new Set(),
      ),
    };
    if (!screenIds.has(frame.screenId)) {
      errors.push(`${path}.screenId must reference a preview screen`);
    }
    return frame;
  });

  const hasVisualChange = changedAspects.some(
    (aspect) => !["none", "copy"].includes(aspect),
  );
  if (!ui) {
    if (
      disposition !== "not-required"
      || changedAspects.length !== 1
      || changedAspects[0] !== "none"
    ) {
      errors.push("non-UI work must use preview not-required with only the none change aspect");
    }
  } else if (changedAspects.includes("none")) {
    errors.push("UI work cannot use the none preview change aspect");
  } else if (hasVisualChange && disposition === "not-required") {
    errors.push("visual UI changes cannot mark the preview not-required");
  } else if (!hasVisualChange && disposition !== "not-required") {
    errors.push("copy-only UI work must mark the preview not-required");
  }
  if (disposition === "not-required" && (screens.length > 0 || frames.length > 0)) {
    errors.push("a not-required preview cannot contain screens or frames");
  }
  if (disposition === "provided") {
    if (screens.length === 0) errors.push("a provided preview requires a screen");
    for (const screen of screens) {
      for (const viewport of ["wide", "narrow"]) {
        const matches = frames.filter(
          (frame) => frame.screenId === screen.id && frame.viewport === viewport,
        );
        if (matches.length !== 1) {
          errors.push(
            `preview screen ${screen.id} requires exactly one ${viewport} frame`,
          );
        }
      }
    }
    if (frames.some((frame) => !screens.some((screen) => screen.id === frame.screenId))) {
      errors.push("every preview frame must belong to a provided screen");
    }
  }

  return {
    disposition,
    rationale: text(input.rationale, "preview.rationale", errors),
    changedAspects,
    screens,
    frames,
    resources: counts,
  };
}

function validateObservedMetrics(value, errors) {
  if (value === undefined) return undefined;
  const input = object(value, "observedMetrics", errors);
  addUnknownKeys(
    input,
    ["elapsedMilliseconds", "inputTokens", "outputTokens"],
    "observedMetrics",
    errors,
  );
  const result = {};
  for (const key of ["elapsedMilliseconds", "inputTokens", "outputTokens"]) {
    if (input[key] !== undefined) {
      result[key] = integer(input[key], `observedMetrics.${key}`, errors);
    }
  }
  if (Object.keys(result).length === 0) {
    errors.push("observedMetrics must contain at least one measured value");
  }
  return result;
}

function digest(value, path, errors) {
  const result = text(value, path, errors);
  if (result && !digestPattern.test(result)) {
    errors.push(`${path} must be a sha256 content digest`);
  }
  return result;
}

function candidateProjection(value) {
  return {
    version: value.version,
    title: value.title,
    taskRisk: value.taskRisk,
    ui: value.ui,
    revision: value.revision,
    interviewRounds: value.interviewRounds,
    locale: value.locale,
    theme: value.theme,
    snapshot: value.snapshot,
    understanding: value.understanding,
    records: value.records,
    assumptions: value.assumptions,
    uncertainties: value.uncertainties,
    perspectives: value.perspectives,
    slices: value.slices,
    changes: value.changes,
    ...(value.version >= 2 ? { preview: value.preview } : {}),
    ...(value.version >= 3 ? { presentation: value.presentation } : {}),
    readiness: {
      state: value.readiness.state,
      rationale: value.readiness.rationale,
    },
  };
}

export function alignCandidateDigest(value) {
  const bytes = Buffer.from(
    JSON.stringify(candidateProjection(value)),
    "utf8",
  );
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function validateAlignState(value, {
  approval: trustedApproval,
  inputFileBytes,
  observedMetrics: trustedObservedMetrics,
} = {}) {
  const errors = [];
  const input = object(value, "align", errors);
  addUnknownKeys(
    input,
    [
      "assumptions",
      "changes",
      "interviewRounds",
      "locale",
      "perspectives",
      "presentation",
      "preview",
      "polish",
      "readiness",
      "records",
      "revision",
      "slices",
      "snapshot",
      "taskRisk",
      "theme",
      "title",
      "ui",
      "uncertainties",
      "understanding",
      "version",
    ],
    "align",
    errors,
  );
  if (!ALIGN_SUPPORTED_VERSIONS.includes(input.version)) {
    errors.push(
      `align.version must be one of ${ALIGN_SUPPORTED_VERSIONS.join(", ")}`,
    );
  }
  const ids = new Set();
  let snapshot = { capturedAt: "", sources: [] };
  try {
    snapshot = validateWorkSnapshot(input.snapshot, {
      maximumSources: ALIGN_LIMITS.sources,
    });
  } catch (error) {
    errors.push(error.message);
  }
  const knownSources = new Set(snapshot.sources.map((source) => source.id));
  const understanding = validateUnderstanding(input.understanding, errors, ids);
  const records = validateRecords(input.records, errors, ids, knownSources);
  const presentation = input.version >= 3
    ? validatePresentation(input.presentation, errors, records)
    : undefined;
  const assumptions = validateAssumptions(
    input.assumptions,
    errors,
    ids,
    knownSources,
  );
  const uncertainties = validateUncertainties(input.uncertainties, errors, ids);
  const perspectives = validatePerspectives(input.perspectives, errors);
  const slices = validateSlices(input.slices, errors, ids);
  const changes = validateChanges(input.changes, errors);
  const preview = input.version >= 2
    ? validatePreview(input.preview, errors, {
      scenarios: understanding.scenarios,
      ui: input.ui,
    })
    : undefined;
  if (input.version === 1 && input.preview !== undefined) {
    errors.push("align version 1 cannot contain preview data");
  }
  if (input.version < 3 && input.presentation !== undefined) {
    errors.push("align versions 1 and 2 cannot contain presentation data");
  }
  const readinessInput = object(input.readiness, "readiness", errors);
  addUnknownKeys(
    readinessInput,
    ["rationale", "state"],
    "readiness",
    errors,
  );
  const readiness = {
    state: choice(readinessInput.state, ALIGN_PHASES, "readiness.state", errors),
    rationale: text(readinessInput.rationale, "readiness.rationale", errors),
  };

  const normalized = {
    version: input.version,
    title: text(input.title, "align.title", errors),
    taskRisk: choice(input.taskRisk, ALIGN_RISKS, "align.taskRisk", errors),
    ui: input.ui,
    revision: integer(input.revision, "align.revision", errors, { minimum: 1 }),
    interviewRounds: integer(
      input.interviewRounds,
      "align.interviewRounds",
      errors,
      { minimum: 0 },
    ),
    locale: choice(input.locale, ["en-US", "ko-KR"], "align.locale", errors),
    theme: choice(input.theme, ["system", "light", "dark"], "align.theme", errors),
    snapshot,
    understanding,
    records,
    assumptions,
    uncertainties,
    perspectives,
    slices,
    changes,
    ...(presentation ? { presentation } : {}),
    ...(preview ? { preview } : {}),
    readiness,
    observedMetrics: validateObservedMetrics(trustedObservedMetrics, errors),
  };
  let polish;
  if (input.polish !== undefined) {
    const polishInput = object(input.polish, "polish", errors);
    addUnknownKeys(
      polishInput,
      [
        "candidateDigest",
        "changeSummary",
        "outcome",
        "resultDigest",
        "verificationStatus",
      ],
      "polish",
      errors,
    );
    polish = {
      candidateDigest: digest(
        polishInput.candidateDigest,
        "polish.candidateDigest",
        errors,
      ),
      resultDigest: digest(
        polishInput.resultDigest,
        "polish.resultDigest",
        errors,
      ),
      outcome: choice(
        polishInput.outcome,
        polishOutcomes,
        "polish.outcome",
        errors,
      ),
      verificationStatus: choice(
        polishInput.verificationStatus,
        polishVerificationStatuses,
        "polish.verificationStatus",
        errors,
      ),
      changeSummary: stringList(
        polishInput.changeSummary,
        "polish.changeSummary",
        errors,
      ),
    };
    const currentDigest = alignCandidateDigest(normalized);
    if (polish.resultDigest !== currentDigest) {
      errors.push(
        "polish.resultDigest must match the current Align candidate",
      );
    }
    if (polish.outcome === "revised") {
      if (polish.candidateDigest === polish.resultDigest) {
        errors.push("a revised Polish receipt must change the candidate digest");
      }
      if (polish.changeSummary.length === 0) {
        errors.push("a revised Polish receipt requires a change summary");
      }
      if (readiness.state !== "ready-proposed") {
        errors.push(
          "a revised Polish receipt requires readiness.state ready-proposed",
        );
      }
    } else if (polish.changeSummary.length > 0) {
      errors.push(
        `${polish.outcome} Polish receipt cannot contain a change summary`,
      );
    }
    if (
      polish.outcome === "no-change"
      && polish.candidateDigest !== polish.resultDigest
    ) {
      errors.push("a no-change Polish receipt must keep the candidate digest");
    }
    if (
      polish.outcome === "no-change"
      && readiness.state !== "ready-proposed"
    ) {
      errors.push(
        "a no-change Polish receipt requires readiness.state ready-proposed",
      );
    }
    if (
      polish.outcome === "needs-alignment"
      && readiness.state !== "interviewing"
    ) {
      errors.push(
        "a needs-alignment Polish receipt requires readiness.state interviewing",
      );
    }
  }
  if (typeof normalized.ui !== "boolean") errors.push("align.ui must be a boolean");
  for (const kind of ALIGN_PERSPECTIVES) {
    if (!perspectives.some((perspective) => perspective.kind === kind)) {
      errors.push(`perspectives must record ${kind} as active or skipped`);
    }
  }
  if (
    normalized.ui === false
    && perspectives.some(
      (perspective) => (
        perspective.kind === "experience-design"
        && perspective.state === "active"
      ),
    )
  ) {
    errors.push("experience-design can be active only when align.ui is true");
  }
  if (changes.some((change) => change.round > normalized.interviewRounds)) {
    errors.push("changes cannot reference a future interview round");
  }

  let jsonBytes = 0;
  let authoredStringBytes = 0;
  try {
    jsonBytes = serializedJsonBytes(value);
    authoredStringBytes = stringBytes(value);
  } catch (error) {
    errors.push(error.message);
  }
  const actualFileBytes = inputFileBytes ?? jsonBytes;
  if (actualFileBytes > ALIGN_LIMITS.inputBytes) {
    errors.push(`align input exceeds ${ALIGN_LIMITS.inputBytes} bytes`);
  }
  if (jsonBytes > ALIGN_LIMITS.inputBytes) {
    errors.push(`align serialization exceeds ${ALIGN_LIMITS.inputBytes} bytes`);
  }
  if (authoredStringBytes > ALIGN_LIMITS.proseBytes) {
    errors.push(`align prose exceeds ${ALIGN_LIMITS.proseBytes} bytes`);
  }

  const active = new Set(
    perspectives
      .filter((perspective) => perspective.state === "active")
      .map((perspective) => perspective.kind),
  );
  const blockers = [];
  if (!understanding.goal) blockers.push("goal");
  if (understanding.success.length === 0) blockers.push("success-conditions");
  if (understanding.inScope.length === 0) blockers.push("in-scope");
  if (understanding.outOfScope.length === 0) blockers.push("out-of-scope");
  if (understanding.scenarios.length === 0) blockers.push("scenarios");
  if (records.openQuestions.length > 0) blockers.push("open-questions");
  if (records.proposals.some((proposal) => proposal.status === "open")) {
    blockers.push("open-proposals");
  }
  if (assumptions.some((assumption) => assumption.status === "open")) {
    blockers.push("open-assumptions");
  }
  if (slices.length === 0) blockers.push("vertical-slices");
  if (!active.has("shared-understanding")) blockers.push("shared-understanding");
  if (
    ["medium", "high"].includes(normalized.taskRisk)
    && !active.has("product-requirements")
  ) {
    blockers.push("product-requirements");
  }
  if (
    ["medium", "high"].includes(normalized.taskRisk)
    && !active.has("vertical-slices")
  ) {
    blockers.push("vertical-slice-perspective");
  }
  if (normalized.ui && !active.has("experience-design")) {
    blockers.push("experience-design");
  }
  if (preview?.disposition === "required") {
    blockers.push("preview-required");
  }
  const uniqueBlockers = [...new Set(blockers)];
  if (
    ["ready-proposed", "approved"].includes(readiness.state)
    && uniqueBlockers.length > 0
  ) {
    errors.push(
      `readiness.state cannot be ${readiness.state} while blockers remain: ${uniqueBlockers.join(", ")}`,
    );
  }
  if (readiness.state === "approved") {
    if (!plainObject(trustedApproval)) {
      errors.push(
        "readiness.state approved requires a trusted approval record from the host",
      );
    } else {
      addUnknownKeys(
        trustedApproval,
        ["decisionId", "sourceDigest", "sourceId"],
        "approval",
        errors,
      );
      const decisionId = text(
        trustedApproval.decisionId,
        "approval.decisionId",
        errors,
      );
      const sourceId = text(
        trustedApproval.sourceId,
        "approval.sourceId",
        errors,
      );
      const sourceDigest = text(
        trustedApproval.sourceDigest,
        "approval.sourceDigest",
        errors,
      );
      const decision = records.decisions.find(
        (item) => item.id === decisionId,
      );
      const source = snapshot.sources.find((item) => item.id === sourceId);
      if (!decision) {
        errors.push("approval.decisionId must point to a user decision");
      } else if (!decision.sourceIds.includes(sourceId)) {
        errors.push("the approval decision must include approval.sourceId");
      }
      if (!source || source.kind !== "conversation") {
        errors.push("approval.sourceId must point to a conversation source");
      } else if (source.digest !== sourceDigest) {
        errors.push("approval.sourceDigest must match the captured source");
      }
      readiness.approval = {
        decisionId,
        sourceDigest,
        sourceId,
      };
    }
  } else if (trustedApproval !== undefined) {
    errors.push(
      "a trusted host approval is allowed only when readiness.state is approved",
    );
  }

  if (errors.length > 0) {
    const error = new TypeError(
      `Hope align state is invalid:\n${errors.map((item) => `- ${item}`).join("\n")}`,
    );
    error.code = "HOPE_ALIGN_INVALID";
    error.issues = Object.freeze([...errors]);
    throw error;
  }

  return Object.freeze({
    ...normalized,
    ...(polish ? { polish } : {}),
    result: Object.freeze({
      blockers: Object.freeze(uniqueBlockers),
      contractReady: uniqueBlockers.length === 0,
      readyToImplement: readiness.state === "approved",
    }),
    resources: Object.freeze({
      activePerspectives: active.size,
      authoredStringBytes,
      inputFileBytes: actualFileBytes,
      interviewRounds: normalized.interviewRounds,
      jsonBytes,
      openQuestions: records.openQuestions.length,
      primaryAgreements: presentation?.primaryAgreementIds.length ?? 0,
      slices: slices.length,
      sources: snapshot.sources.length,
      previewAnnotations: preview?.resources.annotations ?? 0,
      previewDepth: preview?.resources.depth ?? 0,
      previewFrames: preview?.frames.length ?? 0,
      previewNodes: preview?.resources.nodes ?? 0,
      previewScreens: preview?.screens.length ?? 0,
    }),
  });
}
