// Generated from features/sweep/validate.mjs. Do not edit.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { createResultValidation } from "../result-validation/index.mjs";
import { validatePolishReceipt } from "../polish/validate.mjs";
import {
  serializedJsonBytes,
  stringBytes,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import {
  SWEEP_APPROVAL_STATUSES,
  SWEEP_APPROVAL_RECEIPT_VERSION,
  SWEEP_BEHAVIOR_IMPACTS,
  SWEEP_CANDIDATE_DISPOSITIONS,
  SWEEP_CANDIDATE_RESULT_STATUSES,
  SWEEP_CATEGORY_CATALOG,
  SWEEP_CATEGORY_SUPPORT,
  SWEEP_CHECK_CATALOG,
  SWEEP_COMPLETION_STATUSES,
  SWEEP_COMPLETION_VERSION,
  SWEEP_CONTRACT_VERSION,
  SWEEP_DISCOVERY_MODES,
  SWEEP_EVIDENCE_STATUSES,
  SWEEP_INSPECTION_STATES,
  SWEEP_LIMITS,
  SWEEP_PLAN_STATES,
  SWEEP_PLAN_VERSION,
  SWEEP_RISKS,
  SWEEP_SESSION_RESULT_VERSION,
  SWEEP_SESSION_STATES,
  SWEEP_VERIFICATION_STATUSES,
} from "./constants.mjs";
import {
  sweepInventoryDigest,
  validateSweepInventory,
} from "./inventory.mjs";

const digestPattern = /^sha256:[a-f0-9]{64}$/u;

const validation = createResultValidation({
  groupItems: SWEEP_LIMITS.groupItems,
  referenceItems: SWEEP_LIMITS.sources,
  referenceNoun: "source ID",
  stringCharacters: SWEEP_LIMITS.stringCharacters,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function invalid(label, errors) {
  if (errors.length === 0) return;
  throw new TypeError(`${label} is invalid:\n- ${errors.join("\n- ")}`);
}

function snapshot(value, path, errors) {
  try {
    return validateWorkSnapshot(value, {
      maximumSources: SWEEP_LIMITS.sources,
    });
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return { capturedAt: "1970-01-01T00:00:00.000Z", sources: [] };
  }
}

function digest(value, path, errors, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  const result = validation.text(value, path, errors);
  if (result && !digestPattern.test(result)) {
    errors.push(`${path} must use the sha256: format`);
  }
  return result;
}

function sourceIdentity(source) {
  return JSON.stringify({
    digest: source.digest,
    kind: source.kind,
    locator: source.locator,
    revision: source.revision,
  });
}

function sameSourceIdentity(left, right) {
  return Boolean(left)
    && Boolean(right)
    && sourceIdentity(left) === sourceIdentity(right);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function hashCanonicalValue(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex")}`;
}

function planPayload(value) {
  return {
    version: value.version,
    title: value.title,
    risk: value.risk,
    snapshot: value.snapshot,
    session: value.session,
    categories: value.categories,
    candidates: value.candidates,
    summary: value.summary,
    ...(value.inventory ? { inventory: value.inventory } : {}),
  };
}

function normalizedSweepPlanDigest(value) {
  return hashCanonicalValue(planPayload(value));
}

export function sweepPlanDigest(value) {
  return normalizedSweepPlanDigest(validateSweepPlan(value));
}

function approvalPayload(value) {
  return {
    feature: value.feature,
    version: value.version,
    sessionId: value.sessionId,
    planDigest: value.planDigest,
    candidate: value.candidate,
    sources: value.sources,
    executionContract: value.executionContract,
    executionContractDigest: value.executionContractDigest,
  };
}

const sweepOutOfScope = Object.freeze([
  "Change intended behavior.",
  "Change a public contract.",
  "Change an external dependency.",
  "Perform work outside this approved candidate.",
]);

function executionContractFor(candidate) {
  return {
    action: candidate.action,
    preview: { ...candidate.preview },
    target: {
      name: candidate.title,
      purpose: candidate.action,
      sourceIds: [...candidate.targetSourceIds],
      inScope: [candidate.preview.summary, candidate.preview.patch],
      outOfScope: [...sweepOutOfScope],
      maximumChanges: candidate.maximumChanges,
    },
    preservation: [
      {
        id: "preserve-behavior",
        condition: "Preserve intended behavior.",
        impact: candidate.behaviorImpact,
      },
      {
        id: "preserve-public-contract",
        condition: "Preserve public contracts.",
        impact: candidate.publicContractImpact,
      },
      {
        id: "preserve-dependencies",
        condition: "Preserve external dependencies.",
        impact: candidate.dependencyImpact,
      },
    ],
    evidenceChecks: candidate.evidenceChecks.map((item) => ({
      ...item,
      sourceIds: [...item.sourceIds],
    })),
    verificationMethods: [...candidate.verification],
  };
}

export function sweepExecutionContractDigest(value) {
  return hashCanonicalValue(value);
}

export function sweepApprovalCandidateDigest(value) {
  return hashCanonicalValue(approvalPayload(value));
}

function normalizeEvidenceChecks(
  value,
  path,
  errors,
  sourceIds,
  checkSpecification,
) {
  const expectedChecks = checkSpecification?.evidenceChecks ?? [];
  const items = validation.array(
    value,
    path,
    errors,
    SWEEP_LIMITS.evidenceChecks,
  );
  if (items.length !== expectedChecks.length) {
    errors.push(
      `${path} must contain exactly ${expectedChecks.length} checks`,
    );
  }
  const ids = new Set();
  const normalized = items.map((raw, index) => {
    const itemPath = `${path}[${index}]`;
    const item = validation.object(raw, itemPath, errors);
    validation.unknownKeys(
      item,
      ["id", "status", "detail", "sourceIds"],
      itemPath,
      errors,
    );
    const id = validation.identifier(item.id, `${itemPath}.id`, errors, ids);
    const checkedSources = validation.references(
      item.sourceIds,
      `${itemPath}.sourceIds`,
      errors,
      sourceIds,
    );
    const status = validation.choice(
      item.status,
      SWEEP_EVIDENCE_STATUSES,
      `${itemPath}.status`,
      errors,
    );
    if (["passed", "not-applicable"].includes(status) && checkedSources.length === 0) {
      errors.push(`${itemPath}.${status} must cite at least one evidence source`);
    }
    return {
      id,
      status,
      detail: validation.text(item.detail, `${itemPath}.detail`, errors),
      sourceIds: checkedSources,
    };
  });
  for (let index = 0; index < expectedChecks.length; index += 1) {
    if (normalized[index]?.id !== expectedChecks[index]) {
      errors.push(
        `${path}[${index}].id must be ${expectedChecks[index]}`,
      );
    }
  }
  return normalized;
}

function normalizeCandidate(raw, path, errors, snapshotSourceIds, candidateIds) {
  const candidate = validation.object(raw, path, errors);
  validation.unknownKeys(
    candidate,
    [
      "id",
      "categoryId",
      "checkId",
      "title",
      "targetSourceIds",
      "evidenceSourceIds",
      "behaviorImpact",
      "publicContractImpact",
      "dependencyImpact",
      "disposition",
      "reason",
      "action",
      "preview",
      "maximumChanges",
      "evidenceChecks",
      "verification",
      "gaps",
    ],
    path,
    errors,
  );
  const id = validation.identifier(
    candidate.id,
    `${path}.id`,
    errors,
    candidateIds,
  );
  const targetSourceIds = validation.references(
    candidate.targetSourceIds,
    `${path}.targetSourceIds`,
    errors,
    snapshotSourceIds,
    { minimum: 1 },
  );
  const evidenceSourceIds = validation.references(
    candidate.evidenceSourceIds,
    `${path}.evidenceSourceIds`,
    errors,
    snapshotSourceIds,
    { minimum: 1 },
  );
  const evidenceIdSet = new Set(evidenceSourceIds);
  const categoryId = validation.text(
    candidate.categoryId,
    `${path}.categoryId`,
    errors,
  );
  const checkId = validation.text(candidate.checkId, `${path}.checkId`, errors);
  const checkSpecification = SWEEP_CHECK_CATALOG.find(
    (check) => check.id === checkId,
  );
  if (!checkSpecification) {
    errors.push(`${path}.checkId must identify a supported maintenance check`);
  } else if (checkSpecification.categoryId !== categoryId) {
    errors.push(
      `${path}.checkId ${checkId} does not belong to category ${categoryId}`,
    );
  }
  const preview = validation.object(
    candidate.preview,
    `${path}.preview`,
    errors,
  );
  validation.unknownKeys(
    preview,
    ["summary", "patch"],
    `${path}.preview`,
    errors,
  );
  const normalized = {
    id,
    categoryId,
    checkId,
    title: validation.text(candidate.title, `${path}.title`, errors),
    targetSourceIds,
    evidenceSourceIds,
    behaviorImpact: validation.choice(
      candidate.behaviorImpact,
      SWEEP_BEHAVIOR_IMPACTS,
      `${path}.behaviorImpact`,
      errors,
    ),
    publicContractImpact: validation.choice(
      candidate.publicContractImpact,
      SWEEP_BEHAVIOR_IMPACTS,
      `${path}.publicContractImpact`,
      errors,
    ),
    dependencyImpact: validation.choice(
      candidate.dependencyImpact,
      SWEEP_BEHAVIOR_IMPACTS,
      `${path}.dependencyImpact`,
      errors,
    ),
    disposition: validation.choice(
      candidate.disposition,
      SWEEP_CANDIDATE_DISPOSITIONS,
      `${path}.disposition`,
      errors,
    ),
    reason: validation.text(candidate.reason, `${path}.reason`, errors),
    action: validation.text(candidate.action, `${path}.action`, errors),
    preview: {
      summary: validation.text(
        preview.summary,
        `${path}.preview.summary`,
        errors,
      ),
      patch: validation.text(preview.patch, `${path}.preview.patch`, errors),
    },
    maximumChanges: validation.integer(
      candidate.maximumChanges,
      `${path}.maximumChanges`,
      errors,
      { minimum: 1 },
    ),
    evidenceChecks: normalizeEvidenceChecks(
      candidate.evidenceChecks,
      `${path}.evidenceChecks`,
      errors,
      evidenceIdSet,
      checkSpecification,
    ),
    verification: validation.stringList(
      candidate.verification,
      `${path}.verification`,
      errors,
      { minimum: 1 },
    ),
    gaps: validation.stringList(candidate.gaps, `${path}.gaps`, errors),
  };

  if (normalized.maximumChanges > SWEEP_LIMITS.changes) {
    errors.push(
      `${path}.maximumChanges must not exceed ${SWEEP_LIMITS.changes}`,
    );
  }
  for (const check of normalized.evidenceChecks) {
    for (const sourceId of check.sourceIds) {
      if (!evidenceIdSet.has(sourceId)) {
        errors.push(
          `${path}.evidenceChecks source ${sourceId} is not candidate evidence`,
        );
      }
    }
  }
  if (normalized.disposition === "polish") {
    for (const [label, impact] of [
      ["behavior", normalized.behaviorImpact],
      ["public contracts", normalized.publicContractImpact],
      ["dependencies", normalized.dependencyImpact],
    ]) {
      if (impact !== "preserving") {
        errors.push(`${path} Polish work must preserve ${label}`);
      }
    }
    if (normalized.gaps.length > 0) {
      errors.push(`${path} Polish work must not keep evidence gaps`);
    }
    for (const check of normalized.evidenceChecks) {
      if (!["passed", "not-applicable"].includes(check.status)) {
        errors.push(`${path} Polish evidence ${check.id} is incomplete`);
      }
    }
    for (const required of checkSpecification?.requiredPassed ?? []) {
      const check = normalized.evidenceChecks.find((item) => item.id === required);
      if (check?.status !== "passed") {
        errors.push(`${path} Polish evidence ${required} must pass`);
      }
    }
  }
  const impacts = [
    normalized.behaviorImpact,
    normalized.publicContractImpact,
    normalized.dependencyImpact,
  ];
  if (
    normalized.disposition === "handoff"
    && !impacts.includes("changing")
  ) {
    errors.push(
      `${path} handoff must record a changing behavior, public contract, or dependency`,
    );
  }
  if (
    normalized.disposition === "report-only"
    && !impacts.includes("uncertain")
  ) {
    errors.push(`${path} report-only work must record an uncertain impact`);
  }
  if (
    normalized.disposition === "report-only"
    && impacts.includes("changing")
  ) {
    errors.push(`${path} changing work must use handoff`);
  }
  const evidenceComplete = normalized.evidenceChecks.every(
    (check) => ["passed", "not-applicable"].includes(check.status),
  ) && (checkSpecification?.requiredPassed ?? []).every((required) => (
    normalized.evidenceChecks.find((check) => check.id === required)?.status
      === "passed"
  ));
  if (
    normalized.disposition === "report-only"
    && normalized.gaps.length === 0
    && evidenceComplete
    && impacts.every((impact) => impact === "preserving")
  ) {
    errors.push(`${path} fully supported preserving work must use Polish`);
  }
  return normalized;
}

function planMetrics(value, normalized, inputFileBytes) {
  return {
    authoredStringBytes: stringBytes(value),
    candidates: normalized.candidates.length,
    categories: normalized.categories.length,
    checks: normalized.categories.reduce(
      (total, category) => total + category.checks.length,
      0,
    ),
    executableCandidates: normalized.candidates.filter(
      (candidate) => candidate.disposition === "polish",
    ).length,
    filesChecked: normalized.summary.filesChecked,
    inventoryFiles: normalized.inventory?.summary.totalFiles ?? 0,
    inventoryBatches: normalized.inventory?.batches.length ?? 0,
    inventoryState: normalized.inventory?.state ?? null,
    inputFileBytes,
    jsonBytes: serializedJsonBytes(normalized),
    sources: normalized.snapshot.sources.length,
  };
}

export function validateSweepPlan(value, {
  inputFileBytes = serializedJsonBytes(value),
} = {}) {
  const errors = [];
  const plan = validation.object(value, "sweep", errors);
  validation.unknownKeys(
    plan,
    [
      "version",
      "title",
      "risk",
      "snapshot",
      "session",
      "inventory",
      "categories",
      "candidates",
      "summary",
    ],
    "sweep",
    errors,
  );
  const normalizedSnapshot = snapshot(plan.snapshot, "sweep.snapshot", errors);
  const snapshotSourceIds = new Set(
    normalizedSnapshot.sources.map((source) => source.id),
  );
  let normalizedInventory;
  if (plan.inventory !== undefined) {
    try {
      normalizedInventory = validateSweepInventory(plan.inventory);
    } catch (error) {
      errors.push(`sweep.inventory: ${error.message}`);
    }
  }
  const session = validation.object(plan.session, "sweep.session", errors);
  validation.unknownKeys(
    session,
    [
      "id",
      "scope",
      "state",
      "budget",
      "consideredCategoryIds",
      "discoveryMode",
      "inventoryDigest",
    ],
    "sweep.session",
    errors,
  );
  const budget = validation.object(
    session.budget,
    "sweep.session.budget",
    errors,
  );
  validation.unknownKeys(
    budget,
    ["maximumFiles", "maximumCandidates", "maximumChanges"],
    "sweep.session.budget",
    errors,
  );
  const categoryIds = new Set(SWEEP_CATEGORY_CATALOG.map((item) => item.id));
  const normalizedSession = {
    id: validation.text(session.id, "sweep.session.id", errors),
    scope: validation.text(session.scope, "sweep.session.scope", errors),
    discoveryMode: validation.choice(
      session.discoveryMode ?? "bounded",
      SWEEP_DISCOVERY_MODES,
      "sweep.session.discoveryMode",
      errors,
    ),
    ...(session.inventoryDigest === undefined
      ? {}
      : {
        inventoryDigest: digest(
          session.inventoryDigest,
          "sweep.session.inventoryDigest",
          errors,
          { optional: true },
        ),
      }),
    state: validation.choice(
      session.state,
      SWEEP_PLAN_STATES,
      "sweep.session.state",
      errors,
    ),
    budget: {
      maximumFiles: validation.integer(
        budget.maximumFiles,
        "sweep.session.budget.maximumFiles",
        errors,
        { minimum: 1 },
      ),
      maximumCandidates: validation.integer(
        budget.maximumCandidates,
        "sweep.session.budget.maximumCandidates",
        errors,
        { minimum: 1 },
      ),
      maximumChanges: validation.integer(
        budget.maximumChanges,
        "sweep.session.budget.maximumChanges",
        errors,
        { minimum: 1 },
      ),
    },
    consideredCategoryIds: validation.references(
      session.consideredCategoryIds,
      "sweep.session.consideredCategoryIds",
      errors,
      categoryIds,
    ),
  };
  if (normalizedInventory) {
    if (!normalizedSession.inventoryDigest) {
      errors.push("sweep.session.inventoryDigest is required when inventory is present");
    } else if (
      sweepInventoryDigest(normalizedInventory)
      !== normalizedSession.inventoryDigest
    ) {
      errors.push("sweep.session.inventoryDigest must match sweep.inventory");
    }
    if (normalizedInventory.sessionId !== normalizedSession.id) {
      errors.push("sweep.inventory.sessionId must match sweep.session.id");
    }
  }
  if (normalizedSession.discoveryMode === "whole-project" && !normalizedInventory) {
    errors.push("sweep.session.discoveryMode whole-project requires sweep.inventory");
  }
  if (normalizedSession.budget.maximumCandidates > SWEEP_LIMITS.candidates) {
    errors.push(
      `sweep.session.budget.maximumCandidates must not exceed ${SWEEP_LIMITS.candidates}`,
    );
  }
  if (normalizedSession.budget.maximumChanges > SWEEP_LIMITS.changes) {
    errors.push(
      `sweep.session.budget.maximumChanges must not exceed ${SWEEP_LIMITS.changes}`,
    );
  }
  if (
    normalizedSession.consideredCategoryIds.length
    !== SWEEP_CATEGORY_CATALOG.length
  ) {
    errors.push("sweep.session must consider every version 1 category");
  }
  for (let index = 0; index < SWEEP_CATEGORY_CATALOG.length; index += 1) {
    if (
      normalizedSession.consideredCategoryIds[index]
      !== SWEEP_CATEGORY_CATALOG[index].id
    ) {
      errors.push(
        `sweep.session.consideredCategoryIds[${index}] must be ${SWEEP_CATEGORY_CATALOG[index].id}`,
      );
    }
  }

  const rawCategories = validation.array(
    plan.categories,
    "sweep.categories",
    errors,
    SWEEP_LIMITS.categories,
  );
  if (rawCategories.length !== SWEEP_CATEGORY_CATALOG.length) {
    errors.push(
      `sweep.categories must contain exactly ${SWEEP_CATEGORY_CATALOG.length} categories`,
    );
  }
  const normalizedCategories = rawCategories.map((raw, index) => {
    const path = `sweep.categories[${index}]`;
    const category = validation.object(raw, path, errors);
    validation.unknownKeys(
      category,
      [
        "id",
        "support",
        "inspection",
        "summary",
        "checks",
        "evidenceSourceIds",
        "gaps",
      ],
      path,
      errors,
    );
    const catalog = SWEEP_CATEGORY_CATALOG[index];
    const rawChecks = validation.array(
      category.checks,
      `${path}.checks`,
      errors,
      SWEEP_LIMITS.checks,
    );
    if (rawChecks.length !== (catalog?.checks.length ?? 0)) {
      errors.push(
        `${path}.checks must contain exactly ${catalog?.checks.length ?? 0} checks`,
      );
    }
    const checkIds = new Set();
    const checks = rawChecks.map((rawCheck, checkIndex) => {
      const checkPath = `${path}.checks[${checkIndex}]`;
      const check = validation.object(rawCheck, checkPath, errors);
      validation.unknownKeys(
        check,
        ["id", "inspection", "summary", "evidenceSourceIds", "gaps"],
        checkPath,
        errors,
      );
      const normalizedCheck = {
        id: validation.identifier(
          check.id,
          `${checkPath}.id`,
          errors,
          checkIds,
        ),
        inspection: validation.choice(
          check.inspection,
          SWEEP_INSPECTION_STATES,
          `${checkPath}.inspection`,
          errors,
        ),
        summary: validation.text(
          check.summary,
          `${checkPath}.summary`,
          errors,
        ),
        evidenceSourceIds: validation.references(
          check.evidenceSourceIds,
          `${checkPath}.evidenceSourceIds`,
          errors,
          snapshotSourceIds,
        ),
        gaps: validation.stringList(
          check.gaps,
          `${checkPath}.gaps`,
          errors,
        ),
      };
      const expectedCheckId = catalog?.checks[checkIndex];
      if (normalizedCheck.id !== expectedCheckId) {
        errors.push(
          `${checkPath}.id must be ${expectedCheckId ?? "a known category check"}`,
        );
      }
      if (
        ["checked", "partial"].includes(normalizedCheck.inspection)
        && normalizedCheck.evidenceSourceIds.length === 0
      ) {
        errors.push(`${checkPath} inspected check must cite evidence`);
      }
      if (
        ["partial", "not-checked", "failed"].includes(
          normalizedCheck.inspection,
        )
        && normalizedCheck.gaps.length === 0
      ) {
        errors.push(`${checkPath} incomplete check must explain its gap`);
      }
      if (
        normalizedCheck.inspection === "checked"
        && normalizedCheck.gaps.length > 0
      ) {
        errors.push(`${checkPath} checked check must not keep inspection gaps`);
      }
      if (
        normalizedCheck.inspection === "not-checked"
        && normalizedCheck.evidenceSourceIds.length > 0
      ) {
        errors.push(`${checkPath} not-checked check must not claim evidence`);
      }
      return normalizedCheck;
    });
    const derivedInspection = checks.some(
      (check) => check.inspection === "failed",
    )
      ? "failed"
      : checks.every((check) => check.inspection === "checked")
        ? "checked"
        : checks.every((check) => check.inspection === "not-checked")
          ? "not-checked"
          : "partial";
    const expectedEvidenceSourceIds = [...new Set(
      checks.flatMap((check) => check.evidenceSourceIds),
    )];
    const normalized = {
      id: validation.text(category.id, `${path}.id`, errors),
      support: validation.choice(
        category.support,
        SWEEP_CATEGORY_SUPPORT,
        `${path}.support`,
        errors,
      ),
      inspection: validation.choice(
        category.inspection,
        SWEEP_INSPECTION_STATES,
        `${path}.inspection`,
        errors,
      ),
      summary: validation.text(category.summary, `${path}.summary`, errors),
      checks,
      evidenceSourceIds: validation.references(
        category.evidenceSourceIds,
        `${path}.evidenceSourceIds`,
        errors,
        snapshotSourceIds,
      ),
      gaps: validation.stringList(category.gaps, `${path}.gaps`, errors),
    };
    if (normalized.id !== catalog?.id) {
      errors.push(`${path}.id must be ${catalog?.id ?? "a known category"}`);
    }
    if (normalized.support !== catalog?.support) {
      errors.push(`${path}.support must be ${catalog?.support}`);
    }
    if (normalized.inspection !== derivedInspection) {
      errors.push(
        `${path}.inspection must be ${derivedInspection} for its check results`,
      );
    }
    if (
      JSON.stringify(normalized.evidenceSourceIds)
      !== JSON.stringify(expectedEvidenceSourceIds)
    ) {
      errors.push(
        `${path}.evidenceSourceIds must be the ordered union of check evidence`,
      );
    }
    if (normalized.support === "unsupported") {
      if (normalized.inspection !== "not-checked") {
        errors.push(`${path} unsupported category must be not-checked`);
      }
      if (normalized.evidenceSourceIds.length > 0) {
        errors.push(`${path} unsupported category must not claim evidence`);
      }
      if (normalized.gaps.length === 0) {
        errors.push(`${path} unsupported category must explain its gap`);
      }
    } else {
      if (
        ["checked", "partial"].includes(normalized.inspection)
        && normalized.evidenceSourceIds.length === 0
      ) {
        errors.push(`${path} inspected category must cite evidence`);
      }
      if (
        ["partial", "not-checked", "failed"].includes(normalized.inspection)
        && normalized.gaps.length === 0
      ) {
        errors.push(`${path} incomplete category must explain its gap`);
      }
    }
    return normalized;
  });

  const rawCandidates = validation.array(
    plan.candidates,
    "sweep.candidates",
    errors,
    SWEEP_LIMITS.candidates,
  );
  const candidateIds = new Set();
  const normalizedCandidates = rawCandidates.map((candidate, index) => (
    normalizeCandidate(
      candidate,
      `sweep.candidates[${index}]`,
      errors,
      snapshotSourceIds,
      candidateIds,
    )
  ));
  for (const [index, candidate] of normalizedCandidates.entries()) {
    const category = normalizedCategories.find(
      (item) => item.id === candidate.categoryId,
    );
    const check = category?.checks.find((item) => item.id === candidate.checkId);
    if (check?.inspection !== "checked") {
      errors.push(
        `sweep.candidates[${index}] requires a checked category check`,
      );
    }
    const categoryEvidence = new Set(category?.evidenceSourceIds ?? []);
    for (const sourceId of candidate.evidenceSourceIds) {
      if (!categoryEvidence.has(sourceId)) {
        errors.push(
          `sweep.candidates[${index}] evidence ${sourceId} is absent from its category`,
        );
      }
    }
  }
  if (
    normalizedCandidates.length > normalizedSession.budget.maximumCandidates
  ) {
    errors.push("sweep.candidates exceeds the session candidate budget");
  }
  const plannedChanges = normalizedCandidates.reduce(
    (total, candidate) => total + candidate.maximumChanges,
    0,
  );
  if (plannedChanges > normalizedSession.budget.maximumChanges) {
    errors.push("sweep.candidates exceeds the session change budget");
  }

  const summary = validation.object(plan.summary, "sweep.summary", errors);
  validation.unknownKeys(
    summary,
    ["assessment", "filesChecked", "checkedScope", "remainingGaps"],
    "sweep.summary",
    errors,
  );
  const normalizedSummary = {
    assessment: validation.text(
      summary.assessment,
      "sweep.summary.assessment",
      errors,
    ),
    filesChecked: validation.integer(
      summary.filesChecked,
      "sweep.summary.filesChecked",
      errors,
    ),
    checkedScope: validation.stringList(
      summary.checkedScope,
      "sweep.summary.checkedScope",
      errors,
    ),
    remainingGaps: validation.stringList(
      summary.remainingGaps,
      "sweep.summary.remainingGaps",
      errors,
    ),
  };
  const inspectedFileSourceIds = new Set(
    normalizedCategories
      .flatMap((category) => category.checks)
      .flatMap((check) => check.evidenceSourceIds)
      .filter((sourceId) => (
        normalizedSnapshot.sources.find((source) => source.id === sourceId)
          ?.kind === "file"
      )),
  );
  if (normalizedSummary.filesChecked !== inspectedFileSourceIds.size) {
    errors.push(
      `sweep.summary.filesChecked must equal the ${inspectedFileSourceIds.size} distinct file sources cited by inspected checks`,
    );
  }
  if (normalizedSummary.filesChecked > normalizedSession.budget.maximumFiles) {
    errors.push("sweep.summary.filesChecked exceeds the session file budget");
  }

  const executable = normalizedCandidates.filter(
    (candidate) => candidate.disposition === "polish",
  );
  const allChecksCompleted = normalizedCategories.every(
    (category) => category.inspection === "checked",
  );
  const expectedState = executable.length > 0
    ? "awaiting-approval"
    : normalizedCandidates.length > 0
      ? "complete-with-findings"
      : allChecksCompleted
      ? "complete-no-change"
      : "blocked";
  const inventoryIncomplete = normalizedSession.discoveryMode === "whole-project"
    && normalizedInventory?.state !== "complete";
  const expectedDiscoveryState = inventoryIncomplete ? "blocked" : expectedState;
  if (inventoryIncomplete && normalizedSummary.remainingGaps.length === 0) {
    errors.push("whole-project discovery with an incomplete inventory must record a remaining gap");
  }
  if (normalizedSession.state !== expectedDiscoveryState) {
    errors.push(
      `sweep.session.state must be ${expectedDiscoveryState} for this plan`,
    );
  }

  const normalized = {
    version: validation.integer(plan.version, "sweep.version", errors, {
      minimum: SWEEP_PLAN_VERSION,
    }),
    title: validation.text(plan.title, "sweep.title", errors),
    risk: validation.choice(plan.risk, SWEEP_RISKS, "sweep.risk", errors),
    snapshot: normalizedSnapshot,
    ...(normalizedInventory ? { inventory: normalizedInventory } : {}),
    session: normalizedSession,
    categories: normalizedCategories,
    candidates: normalizedCandidates,
    summary: normalizedSummary,
  };
  if (normalized.version !== SWEEP_PLAN_VERSION) {
    errors.push(`sweep.version must be ${SWEEP_PLAN_VERSION}`);
  }
  const inputLimit = normalizedInventory
    ? SWEEP_LIMITS.sessionInputBytes
    : SWEEP_LIMITS.inputBytes;
  if (inputFileBytes > inputLimit) {
    errors.push(`sweep input exceeds ${inputLimit} bytes`);
  }
  const proseLimit = normalizedInventory
    ? SWEEP_LIMITS.sessionProseBytes
    : SWEEP_LIMITS.proseBytes;
  if (stringBytes(value) > proseLimit) {
    errors.push(`sweep prose exceeds ${proseLimit} bytes`);
  }
  invalid("Hope sweep plan", errors);

  const resources = planMetrics(value, normalized, inputFileBytes);
  return deepFreeze({
    ...normalized,
    result: {
      executableCandidates: executable.length,
      handoffs: normalizedCandidates.filter(
        (candidate) => candidate.disposition === "handoff",
      ).length,
      reportOnly: normalizedCandidates.filter(
        (candidate) => candidate.disposition === "report-only",
      ).length,
      state: normalizedSession.state,
    },
    resources,
  });
}

export function createSweepApprovalCandidate(value, candidateId) {
  const plan = validateSweepPlan(value);
  const planDigest = normalizedSweepPlanDigest(plan);
  const candidate = plan.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    throw new TypeError(`Unknown Hope sweep candidate: ${candidateId}`);
  }
  if (candidate.disposition !== "polish") {
    throw new TypeError(
      `Hope sweep candidate ${candidateId} is not executable by Polish`,
    );
  }
  const sourceIds = [...new Set([
    ...candidate.targetSourceIds,
    ...candidate.evidenceSourceIds,
  ])];
  const sources = sourceIds.map((sourceId) => (
    plan.snapshot.sources.find((source) => source.id === sourceId)
  ));
  const result = {
    feature: "sweep-approval-candidate",
    version: SWEEP_CONTRACT_VERSION,
    sessionId: plan.session.id,
    planDigest,
    candidate,
    sources,
    executionContract: executionContractFor(candidate),
  };
  const executionContractDigest = sweepExecutionContractDigest(
    result.executionContract,
  );
  const boundResult = { ...result, executionContractDigest };
  return deepFreeze({
    ...boundResult,
    candidateDigest: sweepApprovalCandidateDigest(boundResult),
  });
}

function normalizeApprovalCandidate(value, path, errors) {
  const candidate = validation.object(value, path, errors);
  validation.unknownKeys(
    candidate,
    [
      "feature",
      "version",
      "sessionId",
      "planDigest",
      "candidate",
      "sources",
      "executionContract",
      "executionContractDigest",
      "candidateDigest",
    ],
    path,
    errors,
  );
  const sourceSnapshot = snapshot(
    {
      capturedAt: "1970-01-01T00:00:00.000Z",
      sources: candidate.sources,
    },
    `${path}.sources`,
    errors,
  );
  const sourceIds = new Set(sourceSnapshot.sources.map((source) => source.id));
  const normalizedCandidate = normalizeCandidate(
    candidate.candidate,
    `${path}.candidate`,
    errors,
    sourceIds,
    new Set(),
  );
  const normalized = {
    feature: validation.text(candidate.feature, `${path}.feature`, errors),
    version: validation.integer(candidate.version, `${path}.version`, errors, {
      minimum: SWEEP_CONTRACT_VERSION,
    }),
    sessionId: validation.text(
      candidate.sessionId,
      `${path}.sessionId`,
      errors,
    ),
    planDigest: digest(candidate.planDigest, `${path}.planDigest`, errors),
    candidate: normalizedCandidate,
    sources: sourceSnapshot.sources,
    executionContract: executionContractFor(normalizedCandidate),
    executionContractDigest: digest(
      candidate.executionContractDigest,
      `${path}.executionContractDigest`,
      errors,
    ),
    candidateDigest: digest(
      candidate.candidateDigest,
      `${path}.candidateDigest`,
      errors,
    ),
  };
  if (!isDeepStrictEqual(
    canonicalValue(candidate.executionContract),
    canonicalValue(normalized.executionContract),
  )) {
    errors.push(`${path}.executionContract must match the derived candidate contract`);
  }
  if (
    normalized.executionContractDigest
    !== sweepExecutionContractDigest(normalized.executionContract)
  ) {
    errors.push(`${path}.executionContractDigest does not match its contract`);
  }
  if (normalized.feature !== "sweep-approval-candidate") {
    errors.push(`${path}.feature must be sweep-approval-candidate`);
  }
  if (normalized.version !== SWEEP_CONTRACT_VERSION) {
    errors.push(`${path}.version must be ${SWEEP_CONTRACT_VERSION}`);
  }
  if (normalized.candidate.disposition !== "polish") {
    errors.push(`${path}.candidate must be executable by Polish`);
  }
  const requiredSourceIds = new Set([
    ...normalized.candidate.targetSourceIds,
    ...normalized.candidate.evidenceSourceIds,
  ]);
  if (requiredSourceIds.size !== normalized.sources.length) {
    errors.push(`${path}.sources must contain exactly the bound candidate sources`);
  }
  for (const sourceId of requiredSourceIds) {
    if (!sourceIds.has(sourceId)) {
      errors.push(`${path}.sources is missing ${sourceId}`);
    }
  }
  if (
    normalized.candidateDigest
    !== sweepApprovalCandidateDigest(normalized)
  ) {
    errors.push(`${path}.candidateDigest does not match its normalized payload`);
  }
  return normalized;
}

function approvalReceiptPayload(value) {
  return {
    feature: value.feature,
    version: value.version,
    approvalCandidate: value.approvalCandidate,
    decision: value.decision,
    authoritySource: value.authoritySource,
    hostAttestation: value.hostAttestation,
  };
}

export function sweepApprovalReceiptDigest(value) {
  return hashCanonicalValue(approvalReceiptPayload(value));
}

function normalizeApprovalAuthority(value, path, errors) {
  const authoritySnapshot = snapshot(
    {
      capturedAt: "1970-01-01T00:00:00.000Z",
      sources: [value],
    },
    path,
    errors,
  );
  const authority = authoritySnapshot.sources[0];
  if (authority?.kind !== "conversation") {
    errors.push(`${path} must be a conversation source`);
  }
  if (!authority?.digest || !digestPattern.test(authority.digest)) {
    errors.push(`${path} must have an exact sha256 digest`);
  }
  return authority;
}

function approvalStatement({ approvalCandidate, decision, authoritySource }) {
  return {
    feature: "sweep-approval-statement",
    version: SWEEP_APPROVAL_RECEIPT_VERSION,
    sessionId: approvalCandidate.sessionId,
    candidateDigest: approvalCandidate.candidateDigest,
    decision,
    authoritySource,
  };
}

export function sweepApprovalStatementDigest(value) {
  return hashCanonicalValue(approvalStatement(value));
}

function normalizeHostAttestation(
  value,
  path,
  errors,
  statement,
  verifyApprovalAttestation,
) {
  const input = validation.object(value, path, errors);
  validation.unknownKeys(
    input,
    ["version", "issuer", "eventId", "issuedAt", "statementDigest", "proof"],
    path,
    errors,
  );
  const attestation = {
    version: validation.integer(input.version, `${path}.version`, errors, {
      minimum: 1,
    }),
    issuer: validation.text(input.issuer, `${path}.issuer`, errors),
    eventId: validation.text(input.eventId, `${path}.eventId`, errors),
    issuedAt: validation.text(input.issuedAt, `${path}.issuedAt`, errors),
    statementDigest: digest(
      input.statementDigest,
      `${path}.statementDigest`,
      errors,
    ),
    proof: validation.text(input.proof, `${path}.proof`, errors),
  };
  if (attestation.version !== 1) {
    errors.push(`${path}.version must be 1`);
  }
  if (Number.isNaN(Date.parse(attestation.issuedAt))) {
    errors.push(`${path}.issuedAt must be an ISO date-time`);
  }
  const expectedStatementDigest = hashCanonicalValue(statement);
  if (attestation.statementDigest !== expectedStatementDigest) {
    errors.push(`${path}.statementDigest must match the exact approval statement`);
  }
  if (typeof verifyApprovalAttestation !== "function") {
    errors.push(`${path} requires a trusted host attestation verifier`);
  } else {
    let verified = false;
    try {
      verified = verifyApprovalAttestation(attestation, deepFreeze({
        ...statement,
        statementDigest: expectedStatementDigest,
      })) === true;
    } catch (error) {
      errors.push(`${path} verification failed: ${error.message}`);
      return attestation;
    }
    if (!verified) {
      errors.push(`${path} was not verified by the trusted host`);
    }
  }
  return attestation;
}

function normalizeApprovalReceipt(value, path, errors, {
  verifyApprovalAttestation,
} = {}) {
  const receipt = validation.object(value, path, errors);
  validation.unknownKeys(
    receipt,
    [
      "feature",
      "version",
      "approvalCandidate",
      "decision",
      "authoritySource",
      "hostAttestation",
      "receiptDigest",
    ],
    path,
    errors,
  );
  const approvalCandidate = normalizeApprovalCandidate(
    receipt.approvalCandidate,
    `${path}.approvalCandidate`,
    errors,
  );
  const authoritySource = normalizeApprovalAuthority(
    receipt.authoritySource,
    `${path}.authoritySource`,
    errors,
  );
  const decision = validation.choice(
    receipt.decision,
    SWEEP_APPROVAL_STATUSES,
    `${path}.decision`,
    errors,
  );
  const statement = approvalStatement({
    approvalCandidate,
    decision,
    authoritySource,
  });
  const normalized = {
    feature: validation.text(receipt.feature, `${path}.feature`, errors),
    version: validation.integer(receipt.version, `${path}.version`, errors, {
      minimum: SWEEP_APPROVAL_RECEIPT_VERSION,
    }),
    approvalCandidate,
    decision,
    authoritySource,
    hostAttestation: normalizeHostAttestation(
      receipt.hostAttestation,
      `${path}.hostAttestation`,
      errors,
      statement,
      verifyApprovalAttestation,
    ),
  };
  if (normalized.feature !== "sweep-approval-receipt") {
    errors.push(`${path}.feature must be sweep-approval-receipt`);
  }
  if (normalized.version !== SWEEP_APPROVAL_RECEIPT_VERSION) {
    errors.push(
      `${path}.version must be ${SWEEP_APPROVAL_RECEIPT_VERSION}`,
    );
  }
  if (
    authoritySource
    && approvalCandidate.sources.some((source) => source.id === authoritySource.id)
  ) {
    errors.push(`${path}.authoritySource must have a distinct source ID`);
  }
  const receiptDigest = digest(
    receipt.receiptDigest,
    `${path}.receiptDigest`,
    errors,
  );
  if (
    receiptDigest
    && receiptDigest !== sweepApprovalReceiptDigest(normalized)
  ) {
    errors.push(`${path}.receiptDigest does not match its normalized approval`);
  }
  return { ...normalized, receiptDigest };
}

export function createSweepApprovalReceipt(value, options = {}) {
  const errors = [];
  const input = validation.object(value, "sweepApproval", errors);
  validation.unknownKeys(
    input,
    ["approvalCandidate", "decision", "authoritySource", "hostAttestation"],
    "sweepApproval",
    errors,
  );
  const approvalCandidate = normalizeApprovalCandidate(
    input.approvalCandidate,
    "sweepApproval.approvalCandidate",
    errors,
  );
  const authoritySource = normalizeApprovalAuthority(
    input.authoritySource,
    "sweepApproval.authoritySource",
    errors,
  );
  const decision = validation.choice(
    input.decision,
    SWEEP_APPROVAL_STATUSES,
    "sweepApproval.decision",
    errors,
  );
  const receipt = {
    feature: "sweep-approval-receipt",
    version: SWEEP_APPROVAL_RECEIPT_VERSION,
    approvalCandidate,
    decision,
    authoritySource,
    hostAttestation: normalizeHostAttestation(
      input.hostAttestation,
      "sweepApproval.hostAttestation",
      errors,
      approvalStatement({ approvalCandidate, decision, authoritySource }),
      options.verifyApprovalAttestation,
    ),
  };
  if (
    authoritySource
    && approvalCandidate.sources.some((source) => source.id === authoritySource.id)
  ) {
    errors.push("sweepApproval.authoritySource must have a distinct source ID");
  }
  invalid("Hope sweep approval", errors);
  return deepFreeze({
    ...receipt,
    receiptDigest: sweepApprovalReceiptDigest(receipt),
  });
}

export function validateSweepApprovalReceipt(value, options = {}) {
  const errors = [];
  const receipt = normalizeApprovalReceipt(
    value,
    "sweepApprovalReceipt",
    errors,
    options,
  );
  invalid("Hope sweep approval receipt", errors);
  return deepFreeze(receipt);
}

function normalizedOutputSnapshot(value, path, errors) {
  if (value === undefined || value === null) return undefined;
  return snapshot(value, path, errors);
}

function outputIdentityCheck(
  output,
  removedSourceIds,
  approvalCandidate,
  status,
  errors,
) {
  const targetIds = approvalCandidate.candidate.targetSourceIds;
  const removedIds = new Set(removedSourceIds);
  const expectedOutputIds = targetIds.filter((id) => !removedIds.has(id));
  const outputIds = output?.sources.map((source) => source.id) ?? [];
  if (
    outputIds.length !== expectedOutputIds.length
    || outputIds.some((id, index) => id !== expectedOutputIds[index])
  ) {
    errors.push(
      "sweep.outcome.outputSnapshot must contain every surviving target source in order",
    );
    return new Set();
  }
  let changed = removedIds.size;
  for (const source of output?.sources ?? []) {
    const before = approvalCandidate.sources.find((item) => item.id === source.id);
    if (!before || before.kind !== source.kind || before.locator !== source.locator) {
      errors.push(`sweep output source ${source.id} must keep its target`);
      continue;
    }
    if (!sameSourceIdentity(before, source)) changed += 1;
  }
  if (status === "applied" && changed === 0) {
    errors.push("sweep applied output must change at least one target identity");
  }
  if (status === "no-change" && changed > 0) {
    errors.push("sweep no-change output must keep every target identity");
  }
  return new Set([
    ...removedSourceIds,
    ...(output?.sources ?? [])
      .filter((source) => {
        const before = approvalCandidate.sources.find(
          (item) => item.id === source.id,
        );
        return before && !sameSourceIdentity(before, source);
      })
      .map((source) => source.id),
  ]);
}

export function validateSweepCompletion(value, {
  inputFileBytes = serializedJsonBytes(value),
  verifyApprovalAttestation,
} = {}) {
  const errors = [];
  const work = validation.object(value, "sweep", errors);
  validation.unknownKeys(
    work,
    [
      "version",
      "title",
      "snapshot",
      "approvalReceipt",
      "polishReceipt",
      "outcome",
      "summary",
    ],
    "sweep",
    errors,
  );
  const normalizedSnapshot = snapshot(work.snapshot, "sweep.snapshot", errors);
  const snapshotSources = new Map(
    normalizedSnapshot.sources.map((source) => [source.id, source]),
  );
  const snapshotSourceIds = new Set(snapshotSources.keys());
  const approvalReceipt = normalizeApprovalReceipt(
    work.approvalReceipt,
    "sweep.approvalReceipt",
    errors,
    { verifyApprovalAttestation },
  );
  const approvalCandidate = approvalReceipt.approvalCandidate;
  const requiredSnapshotIds = new Set([
    ...approvalCandidate.sources.map((source) => source.id),
    approvalReceipt.authoritySource?.id,
  ].filter(Boolean));
  if (
    requiredSnapshotIds.size !== normalizedSnapshot.sources.length
    || normalizedSnapshot.sources.some((source) => !requiredSnapshotIds.has(source.id))
  ) {
    errors.push(
      "sweep.snapshot must contain exactly the approval candidate and authority sources",
    );
  }
  if (
    approvalReceipt.authoritySource
    && !sameSourceIdentity(
      approvalReceipt.authoritySource,
      snapshotSources.get(approvalReceipt.authoritySource.id),
    )
  ) {
    errors.push("sweep approval authority identity is stale");
  }

  const targetMatches = approvalCandidate.candidate.targetSourceIds.every(
    (sourceId) => sameSourceIdentity(
      approvalCandidate.sources.find((source) => source.id === sourceId),
      snapshotSources.get(sourceId),
    ),
  );
  const evidenceMatches = approvalCandidate.candidate.evidenceSourceIds.every(
    (sourceId) => sameSourceIdentity(
      approvalCandidate.sources.find((source) => source.id === sourceId),
      snapshotSources.get(sourceId),
    ),
  );
  let polishReceipt;
  if (work.polishReceipt !== undefined) {
    try {
      polishReceipt = validatePolishReceipt(work.polishReceipt);
    } catch (error) {
      errors.push(`sweep.polishReceipt: ${error.message}`);
    }
  }
  if (polishReceipt) {
    const polishRun = polishReceipt.run;
    const executionContract = approvalCandidate.executionContract;
    const expectedComposition = {
      caller: "sweep",
      sessionId: approvalCandidate.sessionId,
      workUnitDigest: approvalCandidate.candidateDigest,
      executionContractDigest: approvalCandidate.executionContractDigest,
      authorityReceiptDigest: approvalReceipt.receiptDigest,
    };
    if (!isDeepStrictEqual(polishRun.composition, expectedComposition)) {
      errors.push("sweep Polish composition must bind the exact approval and execution contract");
    }
    if (
      JSON.stringify(polishRun.target.sourceIds)
      !== JSON.stringify(approvalCandidate.candidate.targetSourceIds)
    ) {
      errors.push("sweep Polish target must match the exact approved targets");
    }
    if (
      polishRun.target.maximumChanges
      !== approvalCandidate.candidate.maximumChanges
    ) {
      errors.push("sweep Polish change budget must match the exact approval");
    }
    if (!isDeepStrictEqual(polishRun.target, executionContract.target)) {
      errors.push("sweep Polish target must match the approved action and preview");
    }
    const expectedPreservation = executionContract.preservation.map(
      ({ id, condition }) => ({ id, condition }),
    );
    const actualPreservation = polishRun.preservation.map(
      ({ id, condition }) => ({ id, condition }),
    );
    if (!isDeepStrictEqual(actualPreservation, expectedPreservation)) {
      errors.push("sweep Polish preservation conditions must match the exact approval");
    }
    const expectedVerificationIds = polishRun.verification.map((item) => item.id);
    if (
      polishRun.outcome.status !== "needs-alignment"
      && !isDeepStrictEqual(
        polishRun.verification.map((item) => item.method),
        executionContract.verificationMethods,
      )
    ) {
      errors.push("sweep Polish verification methods must match the exact approval");
    }
    if (polishRun.plan.length > 0) {
      const expectedPlan = {
        target: approvalCandidate.candidate.preview.summary,
        action: approvalCandidate.candidate.action,
        reason: approvalCandidate.candidate.reason,
        sourceIds: approvalCandidate.candidate.targetSourceIds,
        preservationIds: executionContract.preservation.map((item) => item.id),
        verificationIds: expectedVerificationIds,
      };
      if (
        polishRun.plan.length !== 1
        || !Object.entries(expectedPlan).every(([key, expected]) => (
          isDeepStrictEqual(polishRun.plan[0][key], expected)
        ))
      ) {
        errors.push("sweep Polish plan must execute only the approved action");
      }
    }
    if (
      polishRun.application.status === "applied"
      && polishRun.application.comparison !== approvalCandidate.candidate.preview.patch
    ) {
      errors.push("sweep Polish application comparison must match the approved patch preview");
    }
    for (const source of approvalCandidate.sources) {
      if (!sameSourceIdentity(
        source,
        polishRun.snapshot.sources.find((item) => item.id === source.id),
      )) {
        errors.push(`sweep Polish run must bind approved source ${source.id}`);
      }
    }
    const authority = approvalReceipt.authoritySource;
    if (
      authority
      && !sameSourceIdentity(
        authority,
        polishRun.snapshot.sources.find((item) => item.id === authority.id),
      )
    ) {
      errors.push("sweep Polish run must bind the exact approval authority");
    }
    if (
      polishRun.application.status === "applied"
      && !polishRun.application.authoritySourceIds.includes(authority?.id)
    ) {
      errors.push("sweep Polish application must cite the approval authority");
    }
  }
  const outcome = validation.object(work.outcome, "sweep.outcome", errors);
  validation.unknownKeys(
    outcome,
    [
      "status",
      "outputSnapshot",
      "removedSourceIds",
      "changes",
      "verification",
      "gaps",
    ],
    "sweep.outcome",
    errors,
  );
  if (!Object.hasOwn(outcome, "outputSnapshot")) {
    errors.push("sweep.outcome.outputSnapshot is required; use null when absent");
  }
  const outputSnapshot = normalizedOutputSnapshot(
    outcome.outputSnapshot,
    "sweep.outcome.outputSnapshot",
    errors,
  );
  const targetSourceIds = new Set(
    approvalCandidate.candidate.targetSourceIds,
  );
  const removedSourceIds = validation.references(
    outcome.removedSourceIds,
    "sweep.outcome.removedSourceIds",
    errors,
    targetSourceIds,
  );
  const outputSourceIds = new Set(outputSnapshot?.sources.map((source) => source.id));
  const resultSourceIds = new Set([
    ...snapshotSourceIds,
    ...(outputSourceIds ?? []),
  ]);
  const verificationIds = new Set();
  const polishChangeIds = new Set();
  const verification = validation.array(
    outcome.verification,
    "sweep.outcome.verification",
    errors,
    SWEEP_LIMITS.verifications,
  ).map((raw, index) => {
    const path = `sweep.outcome.verification[${index}]`;
    const item = validation.object(raw, path, errors);
    validation.unknownKeys(
      item,
      ["id", "name", "method", "status", "scope", "detail", "sourceIds"],
      path,
      errors,
    );
    return {
      id: validation.identifier(item.id, `${path}.id`, errors, verificationIds),
      name: validation.text(item.name, `${path}.name`, errors),
      method: validation.text(item.method, `${path}.method`, errors),
      status: validation.choice(
        item.status,
        SWEEP_VERIFICATION_STATUSES,
        `${path}.status`,
        errors,
      ),
      scope: validation.text(item.scope, `${path}.scope`, errors),
      detail: validation.text(item.detail, `${path}.detail`, errors),
      sourceIds: validation.references(
        item.sourceIds,
        `${path}.sourceIds`,
        errors,
        resultSourceIds,
        { minimum: 1 },
      ),
    };
  });
  const changes = validation.array(
    outcome.changes,
    "sweep.outcome.changes",
    errors,
    SWEEP_LIMITS.changes,
  ).map((raw, index) => {
    const path = `sweep.outcome.changes[${index}]`;
    const change = validation.object(raw, path, errors);
    validation.unknownKeys(
      change,
      ["polishChangeId", "summary", "sourceIds", "verificationIds"],
      path,
      errors,
    );
    return {
      polishChangeId: validation.identifier(
        change.polishChangeId,
        `${path}.polishChangeId`,
        errors,
        polishChangeIds,
      ),
      summary: validation.text(change.summary, `${path}.summary`, errors),
      sourceIds: validation.references(
        change.sourceIds,
        `${path}.sourceIds`,
        errors,
        targetSourceIds,
        { minimum: 1 },
      ),
      verificationIds: validation.references(
        change.verificationIds,
        `${path}.verificationIds`,
        errors,
        verificationIds,
        { minimum: 1, noun: "verification ID" },
      ),
    };
  });
  const normalizedOutcome = {
    status: validation.choice(
      outcome.status,
      SWEEP_COMPLETION_STATUSES,
      "sweep.outcome.status",
      errors,
    ),
    outputSnapshot: outputSnapshot ?? null,
    removedSourceIds,
    changes,
    verification,
    gaps: validation.stringList(outcome.gaps, "sweep.outcome.gaps", errors),
  };
  if (
    verification.length > 0
    && !isDeepStrictEqual(
      verification.map((item) => item.method),
      approvalCandidate.executionContract.verificationMethods,
    )
  ) {
    errors.push("sweep final verification methods must match the exact approval");
  }
  const summary = validation.object(work.summary, "sweep.summary", errors);
  validation.unknownKeys(
    summary,
    ["assessment", "remainingGaps"],
    "sweep.summary",
    errors,
  );
  const normalizedSummary = {
    assessment: validation.text(
      summary.assessment,
      "sweep.summary.assessment",
      errors,
    ),
    remainingGaps: validation.stringList(
      summary.remainingGaps,
      "sweep.summary.remainingGaps",
      errors,
    ),
  };

  const terminal = normalizedOutcome.status;
  const allPassed = verification.length > 0
    && verification.every((item) => item.status === "passed");
  const approved = approvalReceipt.decision === "approved";
  const exactApproval = targetMatches
    && evidenceMatches
    && Boolean(approvalReceipt.authoritySource)
    && sameSourceIdentity(
      approvalReceipt.authoritySource,
      snapshotSources.get(approvalReceipt.authoritySource?.id),
    );
  if (["applied", "no-change"].includes(terminal)) {
    if (!approved || !exactApproval) {
      errors.push(`sweep ${terminal} outcome requires an exact approval`);
    }
    if (!polishReceipt) {
      errors.push(`sweep ${terminal} outcome requires a Polish receipt`);
    }
    if (polishReceipt?.result.verificationStatus !== "verified-in-checked-scope") {
      errors.push(`sweep ${terminal} outcome requires verified Polish work`);
    }
    const expectedPolish = terminal === "applied" ? "revised" : "no-change";
    if (polishReceipt?.result.status !== expectedPolish) {
      errors.push(`sweep ${terminal} outcome requires Polish ${expectedPolish}`);
    }
    if (!allPassed) {
      errors.push(`sweep ${terminal} outcome requires every verification to pass`);
    }
  }
  if (terminal === "applied" && changes.length === 0) {
    errors.push("sweep applied outcome requires at least one change");
  }
  if (terminal !== "applied" && changes.length > 0) {
    errors.push(`sweep ${terminal} outcome must not claim applied changes`);
  }
  if (terminal !== "applied" && removedSourceIds.length > 0) {
    errors.push(`sweep ${terminal} outcome must not claim removed targets`);
  }
  if (terminal === "stale") {
    if (!approved || (targetMatches && evidenceMatches)) {
      errors.push("sweep stale outcome requires an approved identity mismatch");
    }
    if (polishReceipt || outputSnapshot || normalizedOutcome.gaps.length === 0) {
      errors.push("sweep stale outcome must stop before Polish and explain the gap");
    }
  }
  if (terminal === "rejected") {
    if (approved || polishReceipt || outputSnapshot) {
      errors.push("sweep rejected outcome must stop before execution");
    }
  }
  if (["failed", "inconclusive"].includes(terminal)) {
    if (!approved || !exactApproval || outputSnapshot || normalizedOutcome.gaps.length === 0) {
      errors.push(`sweep ${terminal} outcome must stop and explain the gap`);
    }
    const expected = terminal === "failed" ? "failed" : "inconclusive";
    if (!verification.some((item) => item.status === expected)) {
      errors.push(`sweep ${terminal} outcome requires a ${expected} verification`);
    }
  }
  if (terminal === "handed-off") {
    if (outputSnapshot || normalizedOutcome.gaps.length === 0) {
      errors.push("sweep handed-off outcome must not apply output and must explain the handoff");
    }
    if (!approved || !exactApproval) {
      errors.push("sweep handed-off outcome requires an exact approval");
    }
    if (polishReceipt?.result.status !== "needs-alignment") {
      errors.push("sweep handed-off completion requires Polish needs-alignment");
    }
  }
  let changedTargetIds = new Set();
  if (["applied", "no-change"].includes(terminal)) {
    changedTargetIds = outputIdentityCheck(
      outputSnapshot,
      removedSourceIds,
      approvalCandidate,
      terminal,
      errors,
    );
  }

  const approvedMaximumChanges = approvalCandidate.candidate.maximumChanges;
  if (changes.length > approvedMaximumChanges) {
    errors.push("sweep outcome changes exceed the approved maximumChanges");
  }
  if (changedTargetIds.size > approvedMaximumChanges) {
    errors.push("sweep changed targets exceed the approved maximumChanges");
  }
  if (terminal === "applied") {
    const coveredTargets = new Set();
    const usedPolishChangeIds = new Set();
    for (const [index, change] of changes.entries()) {
      if (usedPolishChangeIds.has(change.polishChangeId)) {
        errors.push(
          `sweep.outcome.changes[${index}].polishChangeId must be unique`,
        );
      }
      usedPolishChangeIds.add(change.polishChangeId);
      const polishChange = polishReceipt?.run.outcome.changes.find(
        (item) => item.id === change.polishChangeId,
      );
      if (!polishChange) {
        errors.push(
          `sweep.outcome.changes[${index}] must cite a validated Polish change`,
        );
      } else {
        if (polishChange.summary !== change.summary) {
          errors.push(
            `sweep.outcome.changes[${index}] must keep the Polish change summary`,
          );
        }
        if (
          JSON.stringify(polishChange.sourceIds)
          !== JSON.stringify(change.sourceIds)
        ) {
          errors.push(
            `sweep.outcome.changes[${index}] must keep the Polish change sources`,
          );
        }
      }
      for (const sourceId of change.sourceIds) {
        if (!changedTargetIds.has(sourceId)) {
          errors.push(
            `sweep.outcome.changes[${index}] cites unchanged target ${sourceId}`,
          );
          continue;
        }
        coveredTargets.add(sourceId);
        const verified = change.verificationIds.some((verificationId) => {
          const check = verification.find((item) => item.id === verificationId);
          return check?.status === "passed" && check.sourceIds.includes(sourceId);
        });
        if (!verified) {
          errors.push(
            `sweep changed target ${sourceId} needs a linked passed verification`,
          );
        }
      }
    }
    for (const sourceId of changedTargetIds) {
      if (!coveredTargets.has(sourceId)) {
        errors.push(`sweep changed target ${sourceId} is missing from changes`);
      }
    }
    for (const polishChange of polishReceipt?.run.outcome.changes ?? []) {
      if (!usedPolishChangeIds.has(polishChange.id)) {
        errors.push(`sweep must report Polish change ${polishChange.id}`);
      }
    }
  }

  if (polishReceipt && ["applied", "no-change"].includes(terminal)) {
    const polishRun = polishReceipt.run;
    const sameRemoved = JSON.stringify(polishRun.outcome.removedSourceIds)
      === JSON.stringify(removedSourceIds);
    const polishSources = polishRun.outcome.outputSnapshot?.sources ?? [];
    const sweepSources = outputSnapshot?.sources ?? [];
    const sameOutput = polishSources.length === sweepSources.length
      && polishSources.every((source, index) => (
        source.id === sweepSources[index]?.id
        && sameSourceIdentity(source, sweepSources[index])
      ));
    if (!sameRemoved || !sameOutput) {
      errors.push("sweep outcome must match the validated Polish output exactly");
    }
    const expectedApplication = terminal === "applied" ? "applied" : "not-needed";
    if (polishRun.application.status !== expectedApplication) {
      errors.push(
        `sweep ${terminal} requires Polish application ${expectedApplication}`,
      );
    }
  }

  const normalized = {
    version: validation.integer(work.version, "sweep.version", errors, {
      minimum: SWEEP_COMPLETION_VERSION,
    }),
    title: validation.text(work.title, "sweep.title", errors),
    snapshot: normalizedSnapshot,
    approvalReceipt,
    ...(polishReceipt ? { polishReceipt } : {}),
    outcome: normalizedOutcome,
    summary: normalizedSummary,
  };
  if (normalized.version !== SWEEP_COMPLETION_VERSION) {
    errors.push(`sweep.version must be ${SWEEP_COMPLETION_VERSION}`);
  }
  if (inputFileBytes > SWEEP_LIMITS.inputBytes) {
    errors.push(`sweep input exceeds ${SWEEP_LIMITS.inputBytes} bytes`);
  }
  if (stringBytes(value) > SWEEP_LIMITS.proseBytes) {
    errors.push(`sweep prose exceeds ${SWEEP_LIMITS.proseBytes} bytes`);
  }
  invalid("Hope sweep completion", errors);

  const verificationStatus = verification.some((item) => item.status === "failed")
    ? "failed"
    : verification.some((item) => ["inconclusive", "not-run"].includes(item.status))
      ? "incomplete"
      : verification.length > 0
        ? "verified-in-checked-scope"
        : "not-run";
  return deepFreeze({
    ...normalized,
    result: {
      candidateId: approvalCandidate.candidate.id,
      changed: terminal === "applied",
      status: terminal,
      verificationStatus,
    },
    resources: {
      authoredStringBytes: stringBytes(value),
      changes: changes.length,
      inputFileBytes,
      jsonBytes: serializedJsonBytes(normalized),
      sources: normalizedSnapshot.sources.length,
      verifications: verification.length,
    },
  });
}

function completionPayload(value) {
  return {
    version: value.version,
    title: value.title,
    snapshot: value.snapshot,
    approvalReceipt: value.approvalReceipt,
    ...(value.polishReceipt ? { polishReceipt: value.polishReceipt } : {}),
    outcome: value.outcome,
    summary: value.summary,
  };
}

function normalizedSweepCompletionDigest(value) {
  return hashCanonicalValue(completionPayload(value));
}

export function sweepCompletionDigest(value, options = {}) {
  return normalizedSweepCompletionDigest(validateSweepCompletion(value, options));
}

function orderedUnique(values) {
  return [...new Set(values)];
}

export function validateSweepSessionResult(value, {
  inputFileBytes = serializedJsonBytes(value),
  verifyApprovalAttestation,
} = {}) {
  const errors = [];
  const input = validation.object(value, "sweepSessionResult", errors);
  validation.unknownKeys(
    input,
    [
      "version",
      "title",
      "plan",
      "planDigest",
      "completions",
      "candidateResults",
      "summary",
    ],
    "sweepSessionResult",
    errors,
  );

  let plan;
  try {
    plan = validateSweepPlan(input.plan);
  } catch (error) {
    errors.push(`sweepSessionResult.plan: ${error.message}`);
    plan = {
      session: { id: "", state: "blocked" },
      candidates: [],
      categories: [],
      summary: { remainingGaps: [] },
    };
  }
  const planDigest = digest(
    input.planDigest,
    "sweepSessionResult.planDigest",
    errors,
  );
  if (planDigest && planDigest !== normalizedSweepPlanDigest(plan)) {
    errors.push("sweepSessionResult.planDigest must match the normalized plan");
  }

  const completions = validation.array(
    input.completions,
    "sweepSessionResult.completions",
    errors,
    SWEEP_LIMITS.candidates,
  ).map((completion, index) => {
    try {
      return validateSweepCompletion(completion, { verifyApprovalAttestation });
    } catch (error) {
      errors.push(`sweepSessionResult.completions[${index}]: ${error.message}`);
      return undefined;
    }
  }).filter(Boolean);
  const completionByCandidateId = new Map();
  for (const [index, completion] of completions.entries()) {
    const candidateId = completion.result.candidateId;
    if (completionByCandidateId.has(candidateId)) {
      errors.push(
        `sweepSessionResult.completions[${index}] repeats candidate ${candidateId}`,
      );
    }
    completionByCandidateId.set(candidateId, completion);
  }

  const rawResults = validation.array(
    input.candidateResults,
    "sweepSessionResult.candidateResults",
    errors,
    SWEEP_LIMITS.candidates,
  );
  if (rawResults.length !== plan.candidates.length) {
    errors.push("sweepSessionResult.candidateResults must contain every plan candidate exactly once");
  }
  const seenCandidateIds = new Set();
  const candidateResults = rawResults.map((raw, index) => {
    const path = `sweepSessionResult.candidateResults[${index}]`;
    const item = validation.object(raw, path, errors);
    validation.unknownKeys(
      item,
      ["candidateId", "disposition", "status", "completionDigest", "gaps"],
      path,
      errors,
    );
    const candidateId = validation.identifier(
      item.candidateId,
      `${path}.candidateId`,
      errors,
      seenCandidateIds,
    );
    const disposition = validation.choice(
      item.disposition,
      SWEEP_CANDIDATE_DISPOSITIONS,
      `${path}.disposition`,
      errors,
    );
    const status = validation.choice(
      item.status,
      SWEEP_CANDIDATE_RESULT_STATUSES,
      `${path}.status`,
      errors,
    );
    let completionDigest;
    if (item.completionDigest !== null && item.completionDigest !== undefined) {
      completionDigest = digest(
        item.completionDigest,
        `${path}.completionDigest`,
        errors,
      );
    }
    const gaps = validation.stringList(item.gaps, `${path}.gaps`, errors);
    const candidate = plan.candidates[index];
    if (candidateId !== candidate?.id) {
      errors.push(`${path}.candidateId must be ${candidate?.id ?? "a plan candidate"}`);
    }
    if (disposition !== candidate?.disposition) {
      errors.push(`${path}.disposition must match the plan candidate`);
    }
    const completion = completionByCandidateId.get(candidateId);
    const expectedGaps = orderedUnique([
      ...(candidate?.gaps ?? []),
      ...(completion?.outcome.gaps ?? []),
      ...(completion?.summary.remainingGaps ?? []),
    ]);
    if (!isDeepStrictEqual(gaps, expectedGaps)) {
      errors.push(`${path}.gaps must keep every candidate and completion gap in order`);
    }
    if (status === "pending") {
      if (completion || completionDigest) {
        errors.push(`${path} pending work cannot claim a completion`);
      }
    } else if (disposition === "polish") {
      if (!completion) {
        errors.push(`${path} completed Polish work requires one completion`);
      } else {
        if (status !== completion.result.status) {
          errors.push(`${path}.status must match its completion`);
        }
        const expectedDigest = normalizedSweepCompletionDigest(completion);
        if (completionDigest !== expectedDigest) {
          errors.push(`${path}.completionDigest must match its completion`);
        }
      }
    } else {
      const expectedStatus = disposition === "report-only"
        ? "reported"
        : "handed-off";
      if (status !== expectedStatus) {
        errors.push(`${path}.status must be ${expectedStatus}`);
      }
      if (completion || completionDigest) {
        errors.push(`${path} ${disposition} work cannot claim a Sweep completion`);
      }
    }
    return {
      candidateId,
      disposition,
      status,
      completionDigest: completionDigest ?? null,
      gaps,
    };
  });
  for (const candidateId of completionByCandidateId.keys()) {
    if (!seenCandidateIds.has(candidateId)) {
      errors.push(`sweepSessionResult.completions contains unreported candidate ${candidateId}`);
    }
  }

  const summaryInput = validation.object(
    input.summary,
    "sweepSessionResult.summary",
    errors,
  );
  validation.unknownKeys(
    summaryInput,
    ["state", "assessment", "remainingGaps"],
    "sweepSessionResult.summary",
    errors,
  );
  const summary = {
    state: validation.choice(
      summaryInput.state,
      SWEEP_SESSION_STATES,
      "sweepSessionResult.summary.state",
      errors,
    ),
    assessment: validation.text(
      summaryInput.assessment,
      "sweepSessionResult.summary.assessment",
      errors,
    ),
    remainingGaps: validation.stringList(
      summaryInput.remainingGaps,
      "sweepSessionResult.summary.remainingGaps",
      errors,
    ),
  };
  const hasPending = candidateResults.some((item) => item.status === "pending");
  if (summary.state === "complete" && hasPending) {
    errors.push("sweepSessionResult complete state cannot contain pending candidates");
  }
  if (summary.state === "incomplete" && !hasPending) {
    errors.push("sweepSessionResult incomplete state requires pending candidates");
  }
  if (summary.state === "cancelled" && !hasPending) {
    errors.push("sweepSessionResult cancelled state requires unfinished candidates");
  }
  const expectedRemainingGaps = orderedUnique([
    ...plan.summary.remainingGaps,
    ...plan.categories.flatMap((category) => [
      ...category.gaps,
      ...category.checks.flatMap((check) => check.gaps),
    ]),
    ...candidateResults.flatMap((item) => item.gaps),
  ]);
  if (!isDeepStrictEqual(summary.remainingGaps, expectedRemainingGaps)) {
    errors.push("sweepSessionResult.summary.remainingGaps must keep every unresolved plan and candidate gap in order");
  }

  const normalized = {
    version: validation.integer(
      input.version,
      "sweepSessionResult.version",
      errors,
      { minimum: SWEEP_SESSION_RESULT_VERSION },
    ),
    title: validation.text(input.title, "sweepSessionResult.title", errors),
    plan: planPayload(plan),
    planDigest,
    completions: completions.map(completionPayload),
    candidateResults,
    summary,
  };
  if (normalized.version !== SWEEP_SESSION_RESULT_VERSION) {
    errors.push(`sweepSessionResult.version must be ${SWEEP_SESSION_RESULT_VERSION}`);
  }
  if (inputFileBytes > SWEEP_LIMITS.sessionInputBytes) {
    errors.push(`sweep session result exceeds ${SWEEP_LIMITS.sessionInputBytes} bytes`);
  }
  if (stringBytes(value) > SWEEP_LIMITS.sessionProseBytes) {
    errors.push(`sweep session result prose exceeds ${SWEEP_LIMITS.sessionProseBytes} bytes`);
  }
  invalid("Hope sweep session result", errors);
  return deepFreeze({
    ...normalized,
    result: {
      state: summary.state,
      candidates: candidateResults.length,
      completedCandidates: candidateResults.filter(
        (item) => item.status !== "pending",
      ).length,
      remainingGaps: summary.remainingGaps.length,
    },
    resources: {
      completions: completions.length,
      inputFileBytes,
      jsonBytes: serializedJsonBytes(normalized),
    },
  });
}
