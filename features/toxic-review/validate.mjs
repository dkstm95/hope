import {
  serializedJsonBytes,
  stringBytes,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import { createResultValidation } from "../result-validation/index.mjs";
import {
  TOXIC_REVIEW_CONFIDENCE,
  TOXIC_REVIEW_CONTRACT_VERSION,
  TOXIC_REVIEW_CAUSAL_CANDIDATE_LEVELS,
  TOXIC_REVIEW_CAUSAL_CLAIM_ASSESSMENTS,
  TOXIC_REVIEW_CAUSAL_LEVELS,
  TOXIC_REVIEW_CAUSAL_NEXT_CHECKS,
  TOXIC_REVIEW_JUDGMENTS,
  TOXIC_REVIEW_LIMITS,
  TOXIC_REVIEW_PRIORITIES,
  TOXIC_REVIEW_RISKS,
  TOXIC_REVIEW_ROLE_METHODS,
  TOXIC_REVIEW_STAGES,
  TOXIC_REVIEW_TARGETS,
} from "./constants.mjs";

const priorityRank = new Map(
  TOXIC_REVIEW_PRIORITIES.map((priority, index) => [priority, index]),
);

const {
  array,
  choice,
  identifier: id,
  object,
  references,
  stringList: strings,
  text,
  unknownKeys,
} = createResultValidation({
  groupItems: TOXIC_REVIEW_LIMITS.groupItems,
  referenceItems: TOXIC_REVIEW_LIMITS.sources,
  stringCharacters: TOXIC_REVIEW_LIMITS.stringCharacters,
});

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

function sameReferences(left, right) {
  if (left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left].sort().every(
    (value, index) => value === sortedRight[index],
  );
}

function enforceRoleEvidence(sourceIds, roleSources, path, roleId, errors) {
  if (!roleSources) return;
  for (const sourceId of sourceIds) {
    if (!roleSources.has(sourceId)) {
      errors.push(
        `${path}.sourceIds references ${sourceId} outside role ${roleId} evidence`,
      );
    }
  }
}

function causalAnalysis(value, errors, {
  knownSources,
  roles,
  sourceIdsByRole,
}) {
  const causalRoles = roles.filter(
    (role) => role.method === "causal-completeness",
  );
  if (value === undefined) {
    if (causalRoles.length > 0) {
      errors.push(
        "causalAnalysis is required when a role uses causal-completeness",
      );
    }
    return undefined;
  }
  if (causalRoles.length !== 1) {
    errors.push(
      "causalAnalysis requires exactly one causal-completeness role",
    );
  }

  const input = object(value, "causalAnalysis", errors);
  unknownKeys(
    input,
    [
      "baseline",
      "candidateCount",
      "candidates",
      "causeLevel",
      "claimAssessment",
      "flow",
      "nextCheck",
      "outcome",
      "roleId",
    ],
    "causalAnalysis",
    errors,
  );
  const roleId = text(input.roleId, "causalAnalysis.roleId", errors);
  const selectedRole = roles.find((role) => role.id === roleId);
  if (!selectedRole || selectedRole.method !== "causal-completeness") {
    errors.push(
      "causalAnalysis.roleId must reference the causal-completeness role",
    );
  }
  const roleSources = sourceIdsByRole.get(roleId);

  const candidateIds = new Set();
  const candidates = array(
    input.candidates,
    "causalAnalysis.candidates",
    errors,
    TOXIC_REVIEW_LIMITS.groupItems,
  ).map((entry, index) => {
    const path = `causalAnalysis.candidates[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "assumptions",
        "disconfirmingPrediction",
        "evidence",
        "id",
        "level",
        "location",
        "sourceIds",
        "statement",
      ],
      path,
      errors,
    );
    const sourceIds = references(
      item.sourceIds,
      `${path}.sourceIds`,
      errors,
      knownSources,
      { minimum: 1 },
    );
    enforceRoleEvidence(sourceIds, roleSources, path, roleId, errors);
    return {
      id: id(item.id, `${path}.id`, errors, candidateIds),
      level: choice(
        item.level,
        TOXIC_REVIEW_CAUSAL_CANDIDATE_LEVELS,
        `${path}.level`,
        errors,
      ),
      location: text(item.location, `${path}.location`, errors),
      statement: text(item.statement, `${path}.statement`, errors),
      evidence: text(item.evidence, `${path}.evidence`, errors),
      assumptions: strings(item.assumptions, `${path}.assumptions`, errors, {
        minimum: 1,
      }),
      disconfirmingPrediction: text(
        item.disconfirmingPrediction,
        `${path}.disconfirmingPrediction`,
        errors,
      ),
      sourceIds,
    };
  });

  const referencedCandidates = new Set();
  const flowIds = new Set();
  const flow = array(
    input.flow,
    "causalAnalysis.flow",
    errors,
    TOXIC_REVIEW_LIMITS.groupItems,
  ).map((entry, index) => {
    const path = `causalAnalysis.flow[${index}]`;
    const item = object(entry, path, errors);
    unknownKeys(
      item,
      [
        "candidateIds",
        "exclusion",
        "id",
        "observation",
        "phase",
        "sourceIds",
      ],
      path,
      errors,
    );
    const linkedCandidates = references(
      item.candidateIds,
      `${path}.candidateIds`,
      errors,
      candidateIds,
    );
    for (const candidateId of linkedCandidates) {
      referencedCandidates.add(candidateId);
    }
    const exclusion = text(item.exclusion, `${path}.exclusion`, errors, {
      optional: true,
    });
    if (linkedCandidates.length === 0 && !exclusion) {
      errors.push(
        `${path}.exclusion is required when candidateIds is empty`,
      );
    }
    if (linkedCandidates.length > 0 && exclusion) {
      errors.push(
        `${path}.exclusion is allowed only when candidateIds is empty`,
      );
    }
    const sourceIds = references(
      item.sourceIds,
      `${path}.sourceIds`,
      errors,
      knownSources,
      { minimum: 1 },
    );
    enforceRoleEvidence(sourceIds, roleSources, path, roleId, errors);
    return {
      id: id(item.id, `${path}.id`, errors, flowIds),
      phase: text(item.phase, `${path}.phase`, errors),
      observation: text(item.observation, `${path}.observation`, errors),
      sourceIds,
      candidateIds: linkedCandidates,
      ...(exclusion ? { exclusion } : {}),
    };
  });
  if (flow.length === 0) {
    errors.push("causalAnalysis.flow must contain at least one mapped phase");
  }
  for (const candidateId of candidateIds) {
    if (!referencedCandidates.has(candidateId)) {
      errors.push(
        `causal candidate ${candidateId} must be linked from a mapped flow phase`,
      );
    }
  }

  const candidateCount = nonNegative(
    input.candidateCount,
    "causalAnalysis.candidateCount",
    errors,
  );
  if (candidateCount !== candidates.length) {
    errors.push(
      "causalAnalysis.candidateCount must match candidates.length",
    );
  }
  const causeLevel = choice(
    input.causeLevel,
    TOXIC_REVIEW_CAUSAL_LEVELS,
    "causalAnalysis.causeLevel",
    errors,
  );
  const candidateLevels = new Set(candidates.map((candidate) => candidate.level));
  const expectedCauseLevel = candidates.length === 0
    ? "inconclusive"
    : candidateLevels.size === 1 && candidateLevels.has("structural")
      ? "structural"
      : candidateLevels.size === 1 && candidateLevels.has("local")
        ? "local"
        : "mixed";
  if (causeLevel !== expectedCauseLevel) {
    errors.push(
      `causalAnalysis.causeLevel must be ${expectedCauseLevel} for its candidates`,
    );
  }

  const nextCheckInput = object(
    input.nextCheck,
    "causalAnalysis.nextCheck",
    errors,
  );
  unknownKeys(
    nextCheckInput,
    ["action", "candidateIds", "kind", "rationale"],
    "causalAnalysis.nextCheck",
    errors,
  );
  const nextCheckKind = choice(
    nextCheckInput.kind,
    TOXIC_REVIEW_CAUSAL_NEXT_CHECKS,
    "causalAnalysis.nextCheck.kind",
    errors,
  );
  const nextCheckCandidateIds = references(
    nextCheckInput.candidateIds,
    "causalAnalysis.nextCheck.candidateIds",
    errors,
    candidateIds,
  );
  const expectedNextCheckKind = candidates.length === 0
    ? "form-candidate"
    : candidates.length === 1
      ? "disconfirm"
      : "discriminate";
  if (
    nextCheckKind !== "no-safe-check"
    && nextCheckKind !== expectedNextCheckKind
  ) {
    errors.push(
      `causalAnalysis.nextCheck.kind must be ${expectedNextCheckKind} for ${candidates.length} candidates`,
    );
  }
  if (!sameReferences(nextCheckCandidateIds, [...candidateIds])) {
    errors.push(
      "causalAnalysis.nextCheck.candidateIds must reference every candidate exactly once",
    );
  }

  return {
    roleId,
    outcome: text(input.outcome, "causalAnalysis.outcome", errors),
    baseline: text(input.baseline, "causalAnalysis.baseline", errors),
    claimAssessment: choice(
      input.claimAssessment,
      TOXIC_REVIEW_CAUSAL_CLAIM_ASSESSMENTS,
      "causalAnalysis.claimAssessment",
      errors,
    ),
    causeLevel,
    candidateCount,
    flow,
    candidates,
    nextCheck: {
      kind: nextCheckKind,
      action: text(
        nextCheckInput.action,
        "causalAnalysis.nextCheck.action",
        errors,
      ),
      rationale: text(
        nextCheckInput.rationale,
        "causalAnalysis.nextCheck.rationale",
        errors,
      ),
      candidateIds: nextCheckCandidateIds,
    },
  };
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
      "causalAnalysis",
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
        "method",
        "target",
      ],
      path,
      errors,
    );
    const role = {
      id: id(item.id, `${path}.id`, errors, roleIds),
      name: text(item.name, `${path}.name`, errors),
      ...(item.method === undefined ? {} : {
        method: choice(
          item.method,
          TOXIC_REVIEW_ROLE_METHODS,
          `${path}.method`,
          errors,
        ),
      }),
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
  if (roles.filter((role) => role.method === "causal-completeness").length > 1) {
    errors.push("roles may contain at most one causal-completeness method");
  }

  const normalizedCausalAnalysis = causalAnalysis(input.causalAnalysis, errors, {
    knownSources,
    roles,
    sourceIdsByRole,
  });

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
    enforceRoleEvidence(
      finding.sourceIds,
      sourceIdsByRole.get(roleId),
      path,
      roleId,
      errors,
    );
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
    ...(normalizedCausalAnalysis
      ? { causalAnalysis: normalizedCausalAnalysis }
      : {}),
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
      causalCandidates: normalizedCausalAnalysis?.candidates.length ?? 0,
      causalFlowItems: normalizedCausalAnalysis?.flow.length ?? 0,
      sources: snapshot.sources.length,
    }),
  });
}
