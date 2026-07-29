import {
  serializedJsonBytes,
  stringBytes,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import {
  POLISH_APPLICATION_STATUSES,
  POLISH_CONTRACT_VERSION,
  POLISH_LIMITS,
  POLISH_OUTCOMES,
  POLISH_RISKS,
  POLISH_VERIFICATION_STATUSES,
} from "./constants.mjs";

const idPattern = /^[a-z][a-z0-9-]{0,63}$/u;

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value, path, errors) {
  if (!plainObject(value)) {
    errors.push(`${path} must be an object`);
    return {};
  }
  return value;
}

function unknownKeys(value, allowed, path, errors) {
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
    || [...value].length > POLISH_LIMITS.stringCharacters
  ) {
    errors.push(
      `${path} must be a non-empty string within ${POLISH_LIMITS.stringCharacters} characters`,
    );
    return "";
  }
  return value;
}

function choice(value, allowed, path, errors) {
  if (!allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
  }
  return value;
}

function integer(value, path, errors, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    errors.push(`${path} must be an integer of at least ${minimum}`);
    return minimum;
  }
  return value;
}

function boolean(value, path, errors) {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be a boolean`);
    return false;
  }
  return value;
}

function array(value, path, errors, maximum = POLISH_LIMITS.groupItems) {
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

function stringList(
  value,
  path,
  errors,
  {
    maximum = POLISH_LIMITS.groupItems,
    minimum = 0,
  } = {},
) {
  const items = array(value, path, errors, maximum);
  if (items.length < minimum) {
    errors.push(
      `${path} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`,
    );
  }
  return items.map((item, index) => text(item, `${path}[${index}]`, errors));
}

function references(
  value,
  path,
  errors,
  known,
  {
    maximum = POLISH_LIMITS.groupItems,
    minimum = 0,
    noun = "ID",
  } = {},
) {
  const items = stringList(value, path, errors, { maximum, minimum });
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) errors.push(`${path} repeats ${noun} ${item}`);
    seen.add(item);
    if (!known.has(item)) errors.push(`${path} references unknown ${noun} ${item}`);
  }
  return items;
}

function includesEvery(values, required) {
  const available = new Set(values);
  return required.every((value) => available.has(value));
}

function sourceContentIdentity(source) {
  return source.digest ?? source.revision ?? "";
}

function sourceExactIdentity(source) {
  return JSON.stringify({
    digest: source.digest ?? null,
    kind: source.kind,
    locator: source.locator,
    revision: source.revision ?? null,
  });
}

function nonNegative(value, path, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`${path} must be a non-negative integer`);
    return 0;
  }
  return value;
}

function validateObservedMetrics(value, errors) {
  if (value === undefined) return undefined;
  const input = object(value, "observedMetrics", errors);
  unknownKeys(
    input,
    ["elapsedMilliseconds", "inputTokens", "outputTokens"],
    "observedMetrics",
    errors,
  );
  const result = {};
  for (const key of ["elapsedMilliseconds", "inputTokens", "outputTokens"]) {
    if (input[key] !== undefined) {
      result[key] = nonNegative(input[key], `observedMetrics.${key}`, errors);
    }
  }
  if (Object.keys(result).length === 0) {
    errors.push("observedMetrics must contain at least one measured value");
  }
  return result;
}

export function validatePolishRun(value, {
  inputFileBytes,
  observedMetrics: trustedObservedMetrics,
} = {}) {
  const errors = [];
  const input = object(value, "polish", errors);
  unknownKeys(
    input,
    [
      "application",
      "outcome",
      "plan",
      "preservation",
      "risk",
      "snapshot",
      "summary",
      "target",
      "title",
      "verification",
      "version",
    ],
    "polish",
    errors,
  );
  if (input.version !== POLISH_CONTRACT_VERSION) {
    errors.push(`polish.version must be ${POLISH_CONTRACT_VERSION}`);
  }
  const title = text(input.title, "polish.title", errors);
  const risk = choice(input.risk, POLISH_RISKS, "polish.risk", errors);

  let snapshot = { capturedAt: "", sources: [] };
  try {
    snapshot = validateWorkSnapshot(input.snapshot, {
      maximumSources: POLISH_LIMITS.sources,
    });
  } catch (error) {
    errors.push(error.message);
  }
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.id, source]),
  );
  const knownSources = new Set(sourceById.keys());

  const targetInput = object(input.target, "target", errors);
  unknownKeys(
    targetInput,
    [
      "inScope",
      "maximumChanges",
      "name",
      "outOfScope",
      "purpose",
      "sourceIds",
    ],
    "target",
    errors,
  );
  const target = {
    name: text(targetInput.name, "target.name", errors),
    purpose: text(targetInput.purpose, "target.purpose", errors),
    sourceIds: references(
      targetInput.sourceIds,
      "target.sourceIds",
      errors,
      knownSources,
      {
        maximum: POLISH_LIMITS.sources,
        minimum: 1,
        noun: "source ID",
      },
    ),
    inScope: stringList(targetInput.inScope, "target.inScope", errors, {
      minimum: 1,
    }),
    outOfScope: stringList(
      targetInput.outOfScope,
      "target.outOfScope",
      errors,
      { minimum: 1 },
    ),
    maximumChanges: integer(
      targetInput.maximumChanges,
      "target.maximumChanges",
      errors,
      { minimum: 1 },
    ),
  };
  if (target.maximumChanges > POLISH_LIMITS.changes) {
    errors.push(
      `target.maximumChanges must not exceed ${POLISH_LIMITS.changes}`,
    );
  }

  const allIds = new Set();
  const verificationIds = new Set();
  const verification = array(
    input.verification,
    "verification",
    errors,
    POLISH_LIMITS.verifications,
  ).map((entry, index) => {
    const path = `verification[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      ["detail", "id", "method", "name", "scope", "sourceIds", "status"],
      path,
      errors,
    );
    const id = identifier(item.id, `${path}.id`, errors, allIds);
    if (id) verificationIds.add(id);
    return {
      id,
      name: text(item.name, `${path}.name`, errors),
      method: text(item.method, `${path}.method`, errors),
      status: choice(
        item.status,
        POLISH_VERIFICATION_STATUSES,
        `${path}.status`,
        errors,
      ),
      scope: text(item.scope, `${path}.scope`, errors),
      detail: text(item.detail, `${path}.detail`, errors),
      sourceIds: references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        {
          maximum: POLISH_LIMITS.sources,
          minimum: 1,
          noun: "source ID",
        },
      ),
    };
  });

  const preservationIds = new Set();
  const preservation = array(
    input.preservation,
    "preservation",
    errors,
    POLISH_LIMITS.preservationConditions,
  ).map((entry, index) => {
    const path = `preservation[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      ["condition", "id", "rationale", "sourceIds", "verificationIds"],
      path,
      errors,
    );
    const id = identifier(item.id, `${path}.id`, errors, allIds);
    if (id) preservationIds.add(id);
    return {
      id,
      condition: text(item.condition, `${path}.condition`, errors),
      rationale: text(item.rationale, `${path}.rationale`, errors),
      sourceIds: references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        {
          maximum: POLISH_LIMITS.sources,
          minimum: 1,
          noun: "source ID",
        },
      ),
      verificationIds: references(
        item.verificationIds,
        `${path}.verificationIds`,
        errors,
        verificationIds,
        { noun: "verification ID" },
      ),
    };
  });
  if (preservation.length === 0) {
    errors.push("preservation must contain at least one condition");
  }

  const planIds = new Set();
  const plan = array(
    input.plan,
    "plan",
    errors,
    POLISH_LIMITS.planItems,
  ).map((entry, index) => {
    const path = `plan[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "action",
        "id",
        "preservationIds",
        "reason",
        "risk",
        "sourceIds",
        "target",
        "verificationIds",
      ],
      path,
      errors,
    );
    const id = identifier(item.id, `${path}.id`, errors, allIds);
    if (id) planIds.add(id);
    return {
      id,
      target: text(item.target, `${path}.target`, errors),
      action: text(item.action, `${path}.action`, errors),
      reason: text(item.reason, `${path}.reason`, errors),
      sourceIds: references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        {
          maximum: POLISH_LIMITS.sources,
          minimum: 1,
          noun: "source ID",
        },
      ),
      preservationIds: references(
        item.preservationIds,
        `${path}.preservationIds`,
        errors,
        preservationIds,
        { minimum: 1, noun: "preservation ID" },
      ),
      verificationIds: references(
        item.verificationIds,
        `${path}.verificationIds`,
        errors,
        verificationIds,
        { minimum: 1, noun: "verification ID" },
      ),
      risk: choice(item.risk, POLISH_RISKS, `${path}.risk`, errors),
    };
  });

  const outcomeInput = object(input.outcome, "outcome", errors);
  unknownKeys(
    outcomeInput,
    ["changes", "outputSnapshot", "status", "unresolved"],
    "outcome",
    errors,
  );
  const status = choice(
    outcomeInput.status,
    POLISH_OUTCOMES,
    "outcome.status",
    errors,
  );
  let outputSnapshot;
  if (outcomeInput.outputSnapshot !== undefined) {
    try {
      outputSnapshot = validateWorkSnapshot(outcomeInput.outputSnapshot, {
        maximumSources: POLISH_LIMITS.sources,
      });
    } catch (error) {
      errors.push(`outcome.outputSnapshot: ${error.message}`);
    }
  }
  const usedPlanIds = new Set();
  const changes = array(
    outcomeInput.changes,
    "outcome.changes",
    errors,
    POLISH_LIMITS.changes,
  ).map((entry, index) => {
    const path = `outcome.changes[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "id",
        "planItemId",
        "preservationIds",
        "reason",
        "sourceIds",
        "summary",
        "verificationIds",
      ],
      path,
      errors,
    );
    const planItemId = text(item.planItemId, `${path}.planItemId`, errors);
    if (!planIds.has(planItemId)) {
      errors.push(`${path}.planItemId references unknown plan ID ${planItemId}`);
    }
    if (usedPlanIds.has(planItemId)) {
      errors.push(`${path}.planItemId repeats plan ID ${planItemId}`);
    }
    usedPlanIds.add(planItemId);
    const change = {
      id: identifier(item.id, `${path}.id`, errors, allIds),
      planItemId,
      summary: text(item.summary, `${path}.summary`, errors),
      reason: text(item.reason, `${path}.reason`, errors),
      sourceIds: references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        {
          maximum: POLISH_LIMITS.sources,
          minimum: 1,
          noun: "source ID",
        },
      ),
      preservationIds: references(
        item.preservationIds,
        `${path}.preservationIds`,
        errors,
        preservationIds,
        { minimum: 1, noun: "preservation ID" },
      ),
      verificationIds: references(
        item.verificationIds,
        `${path}.verificationIds`,
        errors,
        verificationIds,
        { minimum: 1, noun: "verification ID" },
      ),
    };
    const planned = plan.find((item) => item.id === planItemId);
    if (planned) {
      for (const [key, noun] of [
        ["sourceIds", "source"],
        ["preservationIds", "preservation"],
        ["verificationIds", "verification"],
      ]) {
        if (!includesEvery(change[key], planned[key])) {
          errors.push(
            `${path}.${key} must keep every planned ${noun} reference`,
          );
        }
      }
    }
    return change;
  });
  const unresolved = stringList(
    outcomeInput.unresolved,
    "outcome.unresolved",
    errors,
  );

  if (plan.length > target.maximumChanges) {
    errors.push("plan exceeds target.maximumChanges");
  }
  if (changes.length > target.maximumChanges) {
    errors.push("outcome.changes exceeds target.maximumChanges");
  }
  if (status === "revised") {
    if (!outputSnapshot) {
      errors.push("outcome.outputSnapshot is required when status is revised");
    }
    if (plan.length === 0 || changes.length === 0) {
      errors.push("a revised outcome requires at least one plan item and change");
    }
    if (plan.length !== changes.length || usedPlanIds.size !== planIds.size) {
      errors.push("a revised outcome requires exactly one change per plan item");
    }
    if (unresolved.length > 0) {
      errors.push("a revised outcome cannot leave material items unresolved");
    }
  } else {
    if (plan.length > 0 || changes.length > 0) {
      errors.push(`${status} cannot contain planned or completed changes`);
    }
  }
  if (status === "no-change") {
    if (!outputSnapshot) {
      errors.push("outcome.outputSnapshot is required when status is no-change");
    }
    if (unresolved.length > 0) {
      errors.push("a no-change outcome cannot leave material items unresolved");
    }
  }
  if (status === "needs-alignment") {
    if (outputSnapshot) {
      errors.push("needs-alignment cannot contain an output snapshot");
    }
    if (unresolved.length === 0) {
      errors.push("needs-alignment requires at least one unresolved item");
    }
  }

  let changedTargetSources = 0;
  if (outputSnapshot) {
    const outputById = new Map(
      outputSnapshot.sources.map((source) => [source.id, source]),
    );
    const outputIds = new Set(outputById.keys());
    if (
      outputIds.size !== target.sourceIds.length
      || target.sourceIds.some((id) => !outputIds.has(id))
    ) {
      errors.push(
        "outcome.outputSnapshot must contain exactly the target source IDs",
      );
    }
    for (const sourceId of target.sourceIds) {
      const before = sourceById.get(sourceId);
      const after = outputById.get(sourceId);
      if (!before || !after) continue;
      if (before.kind !== after.kind) {
        errors.push(
          `outcome.outputSnapshot source ${sourceId} must keep its source kind`,
        );
      }
      if (before.locator !== after.locator) {
        errors.push(
          `outcome.outputSnapshot source ${sourceId} must keep its locator`,
        );
      }
      if (before.digest !== undefined && after.digest === undefined) {
        errors.push(
          `outcome.outputSnapshot source ${sourceId} must keep digest-based identity`,
        );
      }
      if (
        before.digest === undefined
        && before.revision !== undefined
        && after.revision === undefined
      ) {
        errors.push(
          `outcome.outputSnapshot source ${sourceId} must keep revision-based identity`,
        );
      }
      if (sourceContentIdentity(before) !== sourceContentIdentity(after)) {
        changedTargetSources += 1;
      }
      if (
        status === "no-change"
        && sourceExactIdentity(before) !== sourceExactIdentity(after)
      ) {
        errors.push(
          `no-change output source ${sourceId} must keep its exact identity`,
        );
      }
    }
    if (status === "revised" && changedTargetSources === 0) {
      errors.push("a revised outcome must change at least one target identity");
    }
  }

  if (["revised", "no-change"].includes(status)) {
    if (verification.length === 0) {
      errors.push(`${status} requires at least one verification receipt`);
    }
    for (let index = 0; index < preservation.length; index += 1) {
      if (preservation[index].verificationIds.length === 0) {
        errors.push(
          `preservation[${index}].verificationIds must contain at least one verification ID`,
        );
      }
    }
  }

  const applicationInput = object(input.application, "application", errors);
  unknownKeys(
    applicationInput,
    [
      "authoritySourceIds",
      "beforeIdentityChecked",
      "comparison",
      "finalIdentityChecked",
      "status",
    ],
    "application",
    errors,
  );
  const application = {
    status: choice(
      applicationInput.status,
      POLISH_APPLICATION_STATUSES,
      "application.status",
      errors,
    ),
    authoritySourceIds: references(
      applicationInput.authoritySourceIds,
      "application.authoritySourceIds",
      errors,
      knownSources,
      {
        maximum: POLISH_LIMITS.sources,
        noun: "source ID",
      },
    ),
    comparison: text(
      applicationInput.comparison,
      "application.comparison",
      errors,
      { optional: true },
    ),
    beforeIdentityChecked: boolean(
      applicationInput.beforeIdentityChecked,
      "application.beforeIdentityChecked",
      errors,
    ),
    finalIdentityChecked: boolean(
      applicationInput.finalIdentityChecked,
      "application.finalIdentityChecked",
      errors,
    ),
  };
  if (status === "revised") {
    if (!["proposed", "applied"].includes(application.status)) {
      errors.push(
        "a revised outcome requires application.status proposed or applied",
      );
    }
  } else if (application.status !== "not-needed") {
    errors.push(`${status} requires application.status not-needed`);
  }
  if (application.status === "applied") {
    if (application.authoritySourceIds.length === 0) {
      errors.push(
        "an applied revision requires at least one application authority source",
      );
    }
    if (
      !application.authoritySourceIds.some(
        (sourceId) => sourceById.get(sourceId)?.kind === "conversation",
      )
    ) {
      errors.push(
        "an applied revision requires conversation-backed application authority",
      );
    }
    if (!application.comparison) {
      errors.push("an applied revision requires an application comparison");
    }
    if (!application.beforeIdentityChecked) {
      errors.push(
        "an applied revision requires application.beforeIdentityChecked",
      );
    }
    if (!application.finalIdentityChecked) {
      errors.push(
        "an applied revision requires application.finalIdentityChecked",
      );
    }
  }
  if (application.status === "proposed") {
    if (application.authoritySourceIds.length > 0) {
      errors.push("a proposed revision cannot claim application authority");
    }
    if (!application.comparison) {
      errors.push("a proposed revision requires an application comparison");
    }
    if (!application.beforeIdentityChecked) {
      errors.push(
        "a proposed revision requires application.beforeIdentityChecked",
      );
    }
    if (application.finalIdentityChecked) {
      errors.push(
        "a proposed revision cannot claim application.finalIdentityChecked",
      );
    }
  }
  if (application.status === "not-needed") {
    if (application.authoritySourceIds.length > 0) {
      errors.push("application authority is not allowed when no revision applies");
    }
    if (application.comparison !== undefined) {
      errors.push("application comparison is not allowed when no revision applies");
    }
    if (
      application.beforeIdentityChecked
      || application.finalIdentityChecked
    ) {
      errors.push(
        "application identity checks must be false when no revision applies",
      );
    }
  }

  const summaryInput = object(input.summary, "summary", errors);
  unknownKeys(
    summaryInput,
    ["assessment", "scopeLimits"],
    "summary",
    errors,
  );
  const summary = {
    assessment: text(summaryInput.assessment, "summary.assessment", errors),
    scopeLimits: stringList(
      summaryInput.scopeLimits,
      "summary.scopeLimits",
      errors,
    ),
  };

  let jsonBytes = 0;
  let authoredStringBytes = 0;
  try {
    jsonBytes = serializedJsonBytes(value);
    authoredStringBytes = stringBytes(value);
  } catch (error) {
    errors.push(error.message);
  }
  const actualFileBytes = inputFileBytes ?? jsonBytes;
  if (actualFileBytes > POLISH_LIMITS.inputBytes) {
    errors.push(`polish input exceeds ${POLISH_LIMITS.inputBytes} bytes`);
  }
  if (jsonBytes > POLISH_LIMITS.inputBytes) {
    errors.push(`polish serialization exceeds ${POLISH_LIMITS.inputBytes} bytes`);
  }
  if (authoredStringBytes > POLISH_LIMITS.proseBytes) {
    errors.push(`polish prose exceeds ${POLISH_LIMITS.proseBytes} bytes`);
  }

  const observedMetrics = validateObservedMetrics(
    trustedObservedMetrics,
    errors,
  );
  if (errors.length > 0) {
    const error = new TypeError(
      `Hope polish run is invalid:\n${errors.map((item) => `- ${item}`).join("\n")}`,
    );
    error.code = "HOPE_POLISH_INVALID";
    error.issues = Object.freeze([...errors]);
    throw error;
  }

  let verificationStatus = "not-completed";
  if (status !== "needs-alignment") {
    verificationStatus = verification.some((item) => item.status === "failed")
      ? "failed"
      : verification.some((item) => item.status !== "passed")
        ? "incomplete"
        : "verified-in-checked-scope";
  }
  return Object.freeze({
    version: input.version,
    title,
    risk,
    snapshot,
    target,
    preservation,
    plan,
    outcome: {
      status,
      ...(outputSnapshot ? { outputSnapshot } : {}),
      changes,
      unresolved,
    },
    verification,
    application,
    summary,
    observedMetrics,
    result: Object.freeze({
      changed: status === "revised",
      status,
      verificationStatus,
    }),
    resources: Object.freeze({
      authoredStringBytes,
      changeBudget: target.maximumChanges,
      changes: changes.length,
      changedTargetSources,
      inputFileBytes: actualFileBytes,
      jsonBytes,
      planItems: plan.length,
      preservationConditions: preservation.length,
      sources: snapshot.sources.length,
      verifications: verification.length,
    }),
  });
}
