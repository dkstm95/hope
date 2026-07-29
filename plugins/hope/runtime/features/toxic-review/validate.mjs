// Generated from features/toxic-review/validate.mjs. Do not edit.
import {
  serializedJsonBytes,
  stringBytes,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import {
  TOXIC_REVIEW_CONFIDENCE,
  TOXIC_REVIEW_CONTRACT_VERSION,
  TOXIC_REVIEW_JUDGMENTS,
  TOXIC_REVIEW_LIMITS,
  TOXIC_REVIEW_PRIORITIES,
  TOXIC_REVIEW_RISKS,
  TOXIC_REVIEW_STAGES,
  TOXIC_REVIEW_TARGETS,
} from "./constants.mjs";

const idPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const priorityRank = new Map(
  TOXIC_REVIEW_PRIORITIES.map((priority, index) => [priority, index]),
);

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
    || [...value].length > TOXIC_REVIEW_LIMITS.stringCharacters
  ) {
    errors.push(
      `${path} must be a non-empty string within ${TOXIC_REVIEW_LIMITS.stringCharacters} characters`,
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

function array(value, path, errors, maximum = TOXIC_REVIEW_LIMITS.groupItems) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length > maximum) {
    errors.push(`${path} must have at most ${maximum} items`);
  }
  return value.slice(0, maximum);
}

function id(value, path, errors, seen) {
  const result = text(value, path, errors);
  if (result && !idPattern.test(result)) errors.push(`${path} is invalid`);
  if (result && seen.has(result)) errors.push(`${path} repeats ID ${result}`);
  if (result) seen.add(result);
  return result;
}

function strings(
  value,
  path,
  errors,
  {
    maximum = TOXIC_REVIEW_LIMITS.groupItems,
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
    maximum = TOXIC_REVIEW_LIMITS.sources,
    minimum = 0,
  } = {},
) {
  const items = strings(value, path, errors, { maximum, minimum });
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) errors.push(`${path} repeats ID ${item}`);
    seen.add(item);
    if (!known.has(item)) errors.push(`${path} references unknown ID ${item}`);
  }
  return items;
}

function nonNegative(value, path, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`${path} must be a non-negative integer`);
    return 0;
  }
  return value;
}

function observedMetrics(value, errors) {
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

export function validateToxicReview(value, {
  inputFileBytes,
  observedMetrics: trustedObservedMetrics,
} = {}) {
  const errors = [];
  const input = object(value, "toxicReview", errors);
  unknownKeys(
    input,
    [
      "adjudications",
      "findings",
      "risk",
      "roles",
      "snapshot",
      "summary",
      "target",
      "title",
      "version",
    ],
    "toxicReview",
    errors,
  );
  if (input.version !== TOXIC_REVIEW_CONTRACT_VERSION) {
    errors.push(`toxicReview.version must be ${TOXIC_REVIEW_CONTRACT_VERSION}`);
  }
  let snapshot = { capturedAt: "", sources: [] };
  try {
    snapshot = validateWorkSnapshot(input.snapshot, {
      maximumSources: TOXIC_REVIEW_LIMITS.sources,
    });
  } catch (error) {
    errors.push(error.message);
  }
  const knownSources = new Set(snapshot.sources.map((source) => source.id));

  const targetInput = object(input.target, "target", errors);
  unknownKeys(targetInput, ["kind", "stage", "summary"], "target", errors);
  const target = {
    kind: choice(
      targetInput.kind,
      TOXIC_REVIEW_TARGETS,
      "target.kind",
      errors,
    ),
    stage: choice(
      targetInput.stage,
      TOXIC_REVIEW_STAGES,
      "target.stage",
      errors,
    ),
    summary: text(targetInput.summary, "target.summary", errors),
  };

  const roleIds = new Set();
  const sourceIdsByRole = new Map();
  const roles = array(
    input.roles,
    "roles",
    errors,
    TOXIC_REVIEW_LIMITS.roles,
  ).map((entry, index) => {
    const path = `roles[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "claimsToTest",
        "evidenceSourceIds",
        "excludedAreas",
        "expectedOutput",
        "focusRisks",
        "id",
        "name",
        "target",
      ],
      path,
      errors,
    );
    const role = {
      id: id(item.id, `${path}.id`, errors, roleIds),
      name: text(item.name, `${path}.name`, errors),
      target: text(item.target, `${path}.target`, errors),
      focusRisks: strings(item.focusRisks, `${path}.focusRisks`, errors, {
        minimum: 1,
      }),
      evidenceSourceIds: references(
        item.evidenceSourceIds,
        `${path}.evidenceSourceIds`,
        errors,
        knownSources,
        { minimum: 1 },
      ),
      excludedAreas: strings(item.excludedAreas, `${path}.excludedAreas`, errors),
      claimsToTest: strings(item.claimsToTest, `${path}.claimsToTest`, errors, {
        minimum: 1,
      }),
      expectedOutput: text(item.expectedOutput, `${path}.expectedOutput`, errors),
    };
    sourceIdsByRole.set(role.id, new Set(role.evidenceSourceIds));
    return role;
  });
  if (roles.length === 0) {
    errors.push("roles must contain at least one role");
  }

  const findingIds = new Set();
  const findings = array(
    input.findings,
    "findings",
    errors,
    TOXIC_REVIEW_LIMITS.findings,
  ).map((entry, index) => {
    const path = `findings[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "action",
        "confidence",
        "id",
        "impact",
        "issue",
        "priority",
        "roleId",
        "sourceIds",
        "title",
      ],
      path,
      errors,
    );
    const roleId = text(item.roleId, `${path}.roleId`, errors);
    if (roleId && !roleIds.has(roleId)) {
      errors.push(`${path}.roleId references unknown role ID ${roleId}`);
    }
    const finding = {
      id: id(item.id, `${path}.id`, errors, findingIds),
      roleId,
      title: text(item.title, `${path}.title`, errors),
      issue: text(item.issue, `${path}.issue`, errors),
      impact: text(item.impact, `${path}.impact`, errors),
      action: text(item.action, `${path}.action`, errors),
      priority: choice(
        item.priority,
        TOXIC_REVIEW_PRIORITIES,
        `${path}.priority`,
        errors,
      ),
      confidence: choice(
        item.confidence,
        TOXIC_REVIEW_CONFIDENCE,
        `${path}.confidence`,
        errors,
      ),
      sourceIds: references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        { minimum: 1 },
      ),
    };
    const allowedSources = sourceIdsByRole.get(roleId);
    if (allowedSources) {
      for (const sourceId of finding.sourceIds) {
        if (!allowedSources.has(sourceId)) {
          errors.push(
            `${path}.sourceIds references ${sourceId} outside role ${roleId} evidence`,
          );
        }
      }
    }
    return finding;
  });

  const adjudicated = new Set();
  const adjudications = array(
    input.adjudications,
    "adjudications",
    errors,
    TOXIC_REVIEW_LIMITS.findings,
  ).map((entry, index) => {
    const path = `adjudications[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "action",
        "confidence",
        "duplicateOf",
        "findingId",
        "impact",
        "nextStep",
        "priority",
        "rationale",
        "sourceIds",
        "status",
      ],
      path,
      errors,
    );
    const findingId = text(item.findingId, `${path}.findingId`, errors);
    if (!findingIds.has(findingId)) {
      errors.push(`${path}.findingId references unknown finding ID ${findingId}`);
    }
    if (adjudicated.has(findingId)) {
      errors.push(`${path}.findingId already has an adjudication for ${findingId}`);
    }
    adjudicated.add(findingId);
    const status = choice(
      item.status,
      TOXIC_REVIEW_JUDGMENTS,
      `${path}.status`,
      errors,
    );
    const action = text(item.action, `${path}.action`, errors, { optional: true });
    const impact = text(item.impact, `${path}.impact`, errors, { optional: true });
    const priority = item.priority === undefined
      ? undefined
      : choice(
        item.priority,
        TOXIC_REVIEW_PRIORITIES,
        `${path}.priority`,
        errors,
      );
    const confidence = item.confidence === undefined
      ? undefined
      : choice(
        item.confidence,
        TOXIC_REVIEW_CONFIDENCE,
        `${path}.confidence`,
        errors,
      );
    const sourceIds = item.sourceIds === undefined
      ? undefined
      : references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        knownSources,
        { minimum: 1 },
      );
    const nextStep = text(
      item.nextStep,
      `${path}.nextStep`,
      errors,
      { optional: true },
    );
    const duplicateOf = text(
      item.duplicateOf,
      `${path}.duplicateOf`,
      errors,
      { optional: true },
    );
    const actionable = ["accepted", "partially-accepted"].includes(status);
    for (const [field, fieldValue] of [
      ["action", action],
      ["impact", impact],
      ["priority", priority],
      ["confidence", confidence],
      ["sourceIds", sourceIds],
    ]) {
      if (actionable && !fieldValue) {
        errors.push(`${path}.${field} is required for ${status}`);
      }
      if (!actionable && fieldValue !== undefined) {
        errors.push(
          `${path}.${field} is allowed only for accepted or partially accepted findings`,
        );
      }
    }
    if (status === "deferred" && !nextStep) {
      errors.push(`${path}.nextStep is required for deferred findings`);
    }
    if (status !== "deferred" && nextStep) {
      errors.push(`${path}.nextStep is allowed only for deferred findings`);
    }
    if (status === "duplicate") {
      if (!duplicateOf || !findingIds.has(duplicateOf) || duplicateOf === findingId) {
        errors.push(`${path}.duplicateOf must reference another finding ID`);
      }
    } else if (duplicateOf) {
      errors.push(`${path}.duplicateOf is allowed only for duplicate status`);
    }
    return {
      findingId,
      status,
      rationale: text(item.rationale, `${path}.rationale`, errors),
      ...(action ? { action } : {}),
      ...(impact ? { impact } : {}),
      ...(priority ? { priority } : {}),
      ...(confidence ? { confidence } : {}),
      ...(sourceIds ? { sourceIds } : {}),
      ...(nextStep ? { nextStep } : {}),
      ...(duplicateOf ? { duplicateOf } : {}),
    };
  });
  for (const finding of findings) {
    if (!adjudicated.has(finding.id)) {
      errors.push(`finding ${finding.id} requires one adjudication`);
    }
  }
  if (adjudications.length !== findings.length) {
    errors.push("adjudications must contain exactly one entry for each finding");
  }

  const summaryInput = object(input.summary, "summary", errors);
  unknownKeys(
    summaryInput,
    ["assessment", "biggestRisk", "nextMove", "noMaterialIssueFound", "scopeLimits"],
    "summary",
    errors,
  );
  const summary = {
    assessment: text(summaryInput.assessment, "summary.assessment", errors),
    biggestRisk: text(
      summaryInput.biggestRisk,
      "summary.biggestRisk",
      errors,
      { optional: true },
    ),
    nextMove: text(summaryInput.nextMove, "summary.nextMove", errors, {
      optional: true,
    }),
    noMaterialIssueFound: summaryInput.noMaterialIssueFound,
    scopeLimits: strings(summaryInput.scopeLimits, "summary.scopeLimits", errors),
  };
  if (typeof summary.noMaterialIssueFound !== "boolean") {
    errors.push("summary.noMaterialIssueFound must be a boolean");
  }
  const judgmentByFinding = new Map(
    adjudications.map((item) => [item.findingId, item]),
  );
  for (const adjudication of adjudications) {
    if (adjudication.status !== "duplicate") continue;
    const owner = judgmentByFinding.get(adjudication.duplicateOf);
    if (!owner || ["duplicate", "rejected"].includes(owner.status)) {
      errors.push(
        `duplicate finding ${adjudication.findingId} must point to a finding that owns the issue`,
      );
    }
  }
  const actionable = findings
    .filter((finding) => (
      ["accepted", "partially-accepted"].includes(
        judgmentByFinding.get(finding.id)?.status,
      )
    ))
    .map((finding) => {
      const judgment = judgmentByFinding.get(finding.id);
      return {
        id: finding.id,
        roleId: finding.roleId,
        title: finding.title,
        issue: finding.issue,
        impact: judgment.impact,
        action: judgment.action,
        priority: judgment.priority,
        confidence: judgment.confidence,
        sourceIds: judgment.sourceIds,
        status: judgment.status,
        rationale: judgment.rationale,
      };
    })
    .sort((left, right) => (
      (priorityRank.get(left.priority) ?? 99) - (priorityRank.get(right.priority) ?? 99)
      || findings.findIndex((finding) => finding.id === left.id)
        - findings.findIndex((finding) => finding.id === right.id)
    ));
  const deferredJudgments = adjudications.filter(
    (adjudication) => adjudication.status === "deferred",
  );
  const deferred = deferredJudgments.map((judgment) => {
    const finding = findings.find((item) => item.id === judgment.findingId);
    return {
      id: finding.id,
      roleId: finding.roleId,
      title: finding.title,
      issue: finding.issue,
      proposal: {
        impact: finding.impact,
        action: finding.action,
        priority: finding.priority,
        confidence: finding.confidence,
        sourceIds: finding.sourceIds,
      },
      status: judgment.status,
      rationale: judgment.rationale,
      nextStep: judgment.nextStep,
    };
  });
  const hasMaterialIssue = actionable.length > 0 || deferred.length > 0;
  if (actionable.length > 0 && summary.noMaterialIssueFound) {
    errors.push(
      "summary cannot say no material issue was found when accepted findings remain",
    );
  }
  if (deferred.length > 0 && summary.noMaterialIssueFound) {
    errors.push(
      "summary cannot say no material issue was found when deferred findings remain",
    );
  }
  if (!hasMaterialIssue && !summary.noMaterialIssueFound) {
    errors.push(
      "summary.noMaterialIssueFound must be true when no finding is accepted or deferred",
    );
  }
  if (hasMaterialIssue && (!summary.biggestRisk || !summary.nextMove)) {
    errors.push(
      "summary requires biggestRisk and nextMove for material findings",
    );
  }
  if (findings.length === 0 && !summary.noMaterialIssueFound) {
    errors.push("an empty finding set must set summary.noMaterialIssueFound to true");
  }
  if (findings.length === 0 && summary.scopeLimits.length === 0) {
    errors.push("an empty finding set requires at least one scope limit");
  }

  const normalized = {
    version: input.version,
    title: text(input.title, "toxicReview.title", errors),
    risk: choice(input.risk, TOXIC_REVIEW_RISKS, "toxicReview.risk", errors),
    target,
    snapshot,
    roles,
    findings,
    adjudications,
    summary,
    observedMetrics: observedMetrics(trustedObservedMetrics, errors),
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
  if (actualFileBytes > TOXIC_REVIEW_LIMITS.inputBytes) {
    errors.push(`toxic review input exceeds ${TOXIC_REVIEW_LIMITS.inputBytes} bytes`);
  }
  if (jsonBytes > TOXIC_REVIEW_LIMITS.inputBytes) {
    errors.push(`toxic review serialization exceeds ${TOXIC_REVIEW_LIMITS.inputBytes} bytes`);
  }
  if (authoredStringBytes > TOXIC_REVIEW_LIMITS.proseBytes) {
    errors.push(`toxic review prose exceeds ${TOXIC_REVIEW_LIMITS.proseBytes} bytes`);
  }

  if (errors.length > 0) {
    const error = new TypeError(
      `Hope toxic review is invalid:\n${errors.map((item) => `- ${item}`).join("\n")}`,
    );
    error.code = "HOPE_TOXIC_REVIEW_INVALID";
    error.issues = Object.freeze([...errors]);
    throw error;
  }

  const judgmentCounts = Object.fromEntries(
    TOXIC_REVIEW_JUDGMENTS.map((status) => [
      status,
      adjudications.filter((item) => item.status === status).length,
    ]),
  );
  return Object.freeze({
    ...normalized,
    result: Object.freeze({
      actionable: Object.freeze(actionable.map((finding) => Object.freeze(finding))),
      deferred: Object.freeze(deferred.map((finding) => Object.freeze({
        ...finding,
        proposal: Object.freeze(finding.proposal),
      }))),
      judgmentCounts: Object.freeze(judgmentCounts),
      noMaterialIssueFound: summary.noMaterialIssueFound,
    }),
    resources: Object.freeze({
      actionableFindings: actionable.length,
      actionableRatio: findings.length === 0
        ? 0
        : Number((actionable.length / findings.length).toFixed(4)),
      authoredStringBytes,
      findings: findings.length,
      inputFileBytes: actualFileBytes,
      jsonBytes,
      roles: roles.length,
      sources: snapshot.sources.length,
    }),
  });
}
