// Generated from features/align/validate.mjs. Do not edit.
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
} from "./constants.mjs";

const idPattern = /^[a-z][a-z0-9-]{0,63}$/u;
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

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addUnknownKeys(value, allowed, path, errors) {
  if (!plainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function text(value, path, errors, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || [...value].length > ALIGN_LIMITS.stringCharacters
  ) {
    errors.push(
      `${path} must be a non-empty string within ${ALIGN_LIMITS.stringCharacters} characters`,
    );
    return "";
  }
  return value;
}

function integer(value, path, errors, { minimum = 0, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Number.isSafeInteger(value) || value < minimum) {
    errors.push(`${path} must be an integer of at least ${minimum}`);
    return minimum;
  }
  return value;
}

function choice(value, allowed, path, errors) {
  if (!allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
  }
  return value;
}

function object(value, path, errors) {
  if (!plainObject(value)) {
    errors.push(`${path} must be an object`);
    return {};
  }
  return value;
}

function array(value, path, errors, maximum = ALIGN_LIMITS.groupItems) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length > maximum) {
    errors.push(`${path} must have at most ${maximum} items`);
  }
  return value.slice(0, maximum);
}

function identifier(value, path, errors, ids) {
  const result = text(value, path, errors);
  if (result && !idPattern.test(result)) errors.push(`${path} is invalid`);
  if (result && ids.has(result)) errors.push(`${path} repeats ID ${result}`);
  if (result) ids.add(result);
  return result;
}

function stringList(value, path, errors, { minimum = 0 } = {}) {
  const items = array(value, path, errors);
  if (items.length < minimum) {
    errors.push(
      `${path} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`,
    );
  }
  return items.map((item, index) => text(item, `${path}[${index}]`, errors));
}

function sourceIds(value, path, errors, knownSources, { minimum = 0 } = {}) {
  const items = stringList(value, path, errors, { minimum });
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) errors.push(`${path} repeats source ID ${item}`);
    seen.add(item);
    if (!knownSources.has(item)) {
      errors.push(`${path} references unknown source ID ${item}`);
    }
  }
  return items;
}

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
  if (input.version !== ALIGN_CONTRACT_VERSION) {
    errors.push(`align.version must be ${ALIGN_CONTRACT_VERSION}`);
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
    readiness,
    observedMetrics: validateObservedMetrics(trustedObservedMetrics, errors),
  };
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
      slices: slices.length,
      sources: snapshot.sources.length,
    }),
  });
}
