// Generated from features/sweep/batch.mjs. Do not edit.
import { createHash } from "node:crypto";

import { createResultValidation } from "../result-validation/index.mjs";
import { serializedJsonBytes, stringBytes } from "../work-snapshot/index.mjs";
import { validateSweepInventory } from "./inventory.mjs";
import {
  SWEEP_BATCH_CAPABILITY_VERSION,
  SWEEP_BATCH_MERGE_VERSION,
  SWEEP_BATCH_REPORT_VERSION,
  SWEEP_BATCH_SYNTHESIS_VERSION,
  SWEEP_CATEGORY_CATALOG,
  SWEEP_CHECK_CATALOG,
  SWEEP_INSPECTION_STATES,
  SWEEP_LIMITS,
} from "./constants.mjs";

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const identifierPattern = /^[a-z][a-z0-9-]{0,63}$/u;
const batchValidation = createResultValidation({
  groupItems: SWEEP_LIMITS.batchObservations,
  referenceItems: SWEEP_LIMITS.sources,
  referenceNoun: "source ID",
  stringCharacters: SWEEP_LIMITS.stringCharacters,
});

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function digestValue(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex")}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function invalid(label, errors) {
  if (errors.length > 0) {
    throw new TypeError(`${label} is invalid:\n- ${errors.join("\n- ")}`);
  }
}

function trustedHostCheck(verifier, value, path, errors, context) {
  if (typeof verifier !== "function") {
    errors.push(`${path} requires a trusted host verifier`);
    return;
  }
  try {
    if (verifier(value, context) !== true) {
      errors.push(`${path} was rejected by the trusted host verifier`);
    }
  } catch (error) {
    errors.push(`${path} trusted host verification failed: ${error.message}`);
  }
}

function object(value, path, errors) {
  return batchValidation.object(value, path, errors);
}

function exactKeys(value, keys, path, errors) {
  batchValidation.unknownKeys(value, keys, path, errors);
}

function text(value, path, errors) {
  return batchValidation.text(value, path, errors);
}

function identifier(value, path, errors, ids) {
  const result = batchValidation.identifier(value, path, errors, ids);
  if (result && !identifierPattern.test(result)) {
    errors.push(`${path} must use a lower-case identifier`);
  }
  return result;
}

function digest(value, path, errors) {
  const result = text(value, path, errors);
  if (result && !digestPattern.test(result)) {
    errors.push(`${path} must use the sha256: format`);
  }
  return result;
}

function uniqueStrings(value, path, errors, maximum = SWEEP_LIMITS.sources) {
  const items = batchValidation.stringList(value, path, errors, { maximum });
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) errors.push(`${path} repeats ${item}`);
    seen.add(item);
  }
  return items;
}

function sourceContext(inventory, errors, path = "inventory") {
  if (!inventory) {
    errors.push(`${path} is required`);
    return { inventory: undefined, sourceIds: new Set(), fileSourceIds: [] };
  }
  try {
    const normalized = validateSweepInventory(inventory);
    return {
      inventory: normalized,
      sourceIds: new Set(normalized.snapshot.sources.map((source) => source.id)),
      fileSourceIds: [...normalized.fileSourceIds],
    };
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return { inventory: undefined, sourceIds: new Set(), fileSourceIds: [] };
  }
}

function capabilityPayload(value) {
  const { digest: _digest, ...payload } = value;
  return payload;
}

export function digestSweepBatchCapabilities(value) {
  return digestValue(capabilityPayload(value));
}

export function createSweepBatchCapabilities({
  maxConcurrency = 4,
  timeoutMs = 120000,
  retryBudget = 1,
  maxReportBytes = SWEEP_LIMITS.batchReportBytes,
} = {}) {
  const value = {
    feature: "sweep-batch-capabilities",
    version: SWEEP_BATCH_CAPABILITY_VERSION,
    mode: "subagent-hybrid",
    readOnly: true,
    independentContexts: true,
    sourceAllowlist: true,
    boundedOutput: true,
    untrustedRepositoryContent: true,
    sourcePolicy: "assigned-inventory-files-only",
    outputPolicy: "structured-report-only",
    maxConcurrency,
    timeoutMs,
    retryBudget,
    maxReportBytes,
    fallback: "active-session",
  };
  return deepFreeze({ ...value, digest: digestSweepBatchCapabilities(value) });
}

export function selectSweepInspectionMode({
  requestedMode = "active-session",
  capabilities,
  activeSessionAvailable = false,
  verifyBatchCapabilities,
  verifyBatchInvocation,
} = {}) {
  if (requestedMode === "active-session") {
    return Object.freeze({
      mode: "active-session",
      fallbackUsed: false,
    });
  }
  if (requestedMode !== "subagent-hybrid") {
    throw new TypeError(`Unknown Sweep inspection mode: ${requestedMode}`);
  }
  try {
    if (typeof verifyBatchInvocation !== "function") {
      throw new TypeError(
        "Sweep subagent-hybrid requires a trusted host invocation verifier",
      );
    }
    const normalized = validateSweepBatchCapabilities(capabilities, {
      verifyBatchCapabilities,
    });
    if (activeSessionAvailable !== true) {
      throw new TypeError(
        "Sweep subagent-hybrid requires an active-session fallback",
      );
    }
    return Object.freeze({
      mode: "subagent-hybrid",
      fallbackUsed: false,
      capabilityDigest: normalized.digest,
    });
  } catch (error) {
    if (activeSessionAvailable !== true) {
      throw new TypeError(
        `Sweep subagent-hybrid capability negotiation failed and active-session fallback is unavailable: ${error.message}`,
      );
    }
    return Object.freeze({
      mode: "active-session",
      fallbackUsed: true,
      reason: error.message,
    });
  }
}

export function validateSweepBatchCapabilities(
  value,
  { verifyBatchCapabilities } = {},
) {
  const errors = [];
  const capabilities = object(value, "sweep.batchCapabilities", errors);
  exactKeys(
    capabilities,
    [
      "feature",
      "version",
      "mode",
      "readOnly",
      "independentContexts",
      "sourceAllowlist",
      "boundedOutput",
      "untrustedRepositoryContent",
      "sourcePolicy",
      "outputPolicy",
      "maxConcurrency",
      "timeoutMs",
      "retryBudget",
      "maxReportBytes",
      "fallback",
      "digest",
    ],
    "sweep.batchCapabilities",
    errors,
  );
  const normalized = {
    feature: text(capabilities.feature, "sweep.batchCapabilities.feature", errors),
    version: batchValidation.integer(
      capabilities.version,
      "sweep.batchCapabilities.version",
      errors,
      { minimum: SWEEP_BATCH_CAPABILITY_VERSION },
    ),
    mode: batchValidation.choice(
      capabilities.mode,
      ["subagent-hybrid"],
      "sweep.batchCapabilities.mode",
      errors,
    ),
    readOnly: batchValidation.boolean(
      capabilities.readOnly,
      "sweep.batchCapabilities.readOnly",
      errors,
    ),
    independentContexts: batchValidation.boolean(
      capabilities.independentContexts,
      "sweep.batchCapabilities.independentContexts",
      errors,
    ),
    sourceAllowlist: batchValidation.boolean(
      capabilities.sourceAllowlist,
      "sweep.batchCapabilities.sourceAllowlist",
      errors,
    ),
    boundedOutput: batchValidation.boolean(
      capabilities.boundedOutput,
      "sweep.batchCapabilities.boundedOutput",
      errors,
    ),
    untrustedRepositoryContent: batchValidation.boolean(
      capabilities.untrustedRepositoryContent,
      "sweep.batchCapabilities.untrustedRepositoryContent",
      errors,
    ),
    sourcePolicy: text(
      capabilities.sourcePolicy,
      "sweep.batchCapabilities.sourcePolicy",
      errors,
    ),
    outputPolicy: text(
      capabilities.outputPolicy,
      "sweep.batchCapabilities.outputPolicy",
      errors,
    ),
    maxConcurrency: batchValidation.integer(
      capabilities.maxConcurrency,
      "sweep.batchCapabilities.maxConcurrency",
      errors,
      { minimum: 1 },
    ),
    timeoutMs: batchValidation.integer(
      capabilities.timeoutMs,
      "sweep.batchCapabilities.timeoutMs",
      errors,
      { minimum: 1 },
    ),
    retryBudget: batchValidation.integer(
      capabilities.retryBudget,
      "sweep.batchCapabilities.retryBudget",
      errors,
      { minimum: 0 },
    ),
    maxReportBytes: batchValidation.integer(
      capabilities.maxReportBytes,
      "sweep.batchCapabilities.maxReportBytes",
      errors,
      { minimum: 1 },
    ),
    fallback: batchValidation.choice(
      capabilities.fallback,
      ["active-session"],
      "sweep.batchCapabilities.fallback",
      errors,
    ),
    digest: digest(capabilities.digest, "sweep.batchCapabilities.digest", errors),
  };
  if (normalized.feature !== "sweep-batch-capabilities") {
    errors.push("sweep.batchCapabilities.feature must be sweep-batch-capabilities");
  }
  if (normalized.version !== SWEEP_BATCH_CAPABILITY_VERSION) {
    errors.push(`sweep.batchCapabilities.version must be ${SWEEP_BATCH_CAPABILITY_VERSION}`);
  }
  for (const [field, expected] of [
    ["readOnly", true],
    ["independentContexts", true],
    ["sourceAllowlist", true],
    ["boundedOutput", true],
    ["untrustedRepositoryContent", true],
  ]) {
    if (normalized[field] !== expected) {
      errors.push(`sweep.batchCapabilities.${field} must be ${expected}`);
    }
  }
  if (normalized.sourcePolicy !== "assigned-inventory-files-only") {
    errors.push("sweep.batchCapabilities.sourcePolicy must restrict each batch to assigned inventory files");
  }
  if (normalized.outputPolicy !== "structured-report-only") {
    errors.push("sweep.batchCapabilities.outputPolicy must be structured-report-only");
  }
  if (normalized.maxConcurrency > 32) {
    errors.push("sweep.batchCapabilities.maxConcurrency exceeds 32");
  }
  if (normalized.timeoutMs > 300000) {
    errors.push("sweep.batchCapabilities.timeoutMs exceeds 300000");
  }
  if (normalized.retryBudget > 3) {
    errors.push("sweep.batchCapabilities.retryBudget exceeds 3");
  }
  if (normalized.maxReportBytes > SWEEP_LIMITS.batchReportBytes) {
    errors.push(`sweep.batchCapabilities.maxReportBytes exceeds ${SWEEP_LIMITS.batchReportBytes}`);
  }
  if (normalized.digest !== digestSweepBatchCapabilities(normalized)) {
    errors.push("sweep.batchCapabilities.digest does not match its payload");
  }
  trustedHostCheck(
    verifyBatchCapabilities,
    normalized,
    "sweep.batchCapabilities",
    errors,
    { kind: "capabilities" },
  );
  invalid("Hope sweep batch capabilities", errors);
  return deepFreeze(normalized);
}

function batchBindingPayload(value) {
  return {
    runId: value.runId,
    inventoryDigest: value.inventoryDigest,
    manifestDigest: value.manifestDigest,
    batch: value.batch,
    capabilityDigest: value.capabilityDigest,
  };
}

export function sweepBatchBindingDigest(value) {
  return digestValue(batchBindingPayload(value));
}

export function sweepBatchAttemptId(value) {
  return digestValue({
    bindingDigest: value.bindingDigest,
    manifestDigest: value.manifestDigest,
    attempt: value.attempt,
    inputDigest: value.inputDigest,
    invocationId: value.invocationId,
    outputDigest: value.outputDigest,
  });
}

export function sweepBatchOutputDigest(value) {
  return digestValue({
    inspection: value.inspection,
    relationshipInspection: value.relationshipInspection,
    relationshipEvidenceSourceIds: value.relationshipEvidenceSourceIds,
    sourceResults: value.sourceResults,
    checks: value.checks,
    relationships: value.relationships,
    observations: value.observations,
    gaps: value.gaps,
  });
}

export function sweepBatchAttemptOutputDigest(value) {
  return digestValue({
    status: value.status,
    ...(value.error === undefined ? {} : { error: value.error }),
  });
}

function reportPayload(value) {
  const { reportDigest: _reportDigest, ...payload } = value;
  return payload;
}

function mergePayload(value) {
  const { digest: _digest, ...payload } = value;
  return payload;
}

function reportSetPayload(value) {
  const { digest: _digest, ...payload } = value;
  return payload;
}

function manifestPayload(value) {
  const { digest: _digest, ...payload } = value;
  return payload;
}

function crossBatchPayload(value) {
  const { digest: _digest, ...payload } = value;
  return payload;
}

export function digestSweepBatchReportSet(value) {
  return digestValue(reportSetPayload(value));
}

export function digestSweepBatchManifest(value) {
  return digestValue(manifestPayload(value));
}

export function digestSweepCrossBatchSynthesis(value) {
  return digestValue(crossBatchPayload(value));
}

function normalizeBatch(value, path, errors, fileSourceIds, ids) {
  const batch = object(value, path, errors);
  exactKeys(batch, ["id", "ordinal", "fileSourceIds"], path, errors);
  const id = identifier(batch.id, `${path}.id`, errors, ids);
  const ordinal = batchValidation.integer(batch.ordinal, `${path}.ordinal`, errors, { minimum: 1 });
  const files = batchValidation.references(
    batch.fileSourceIds,
    `${path}.fileSourceIds`,
    errors,
    new Set(fileSourceIds),
    { minimum: 1 },
  );
  return { id, ordinal, fileSourceIds: files };
}

export function validateSweepBatchManifest(
  value,
  { inventory, capabilities, verifyBatchInvocation } = {},
) {
  const errors = [];
  const context = sourceContext(inventory, errors);
  const manifest = object(value, "sweep.batchManifest", errors);
  exactKeys(
    manifest,
    [
      "feature",
      "version",
      "runId",
      "inventoryDigest",
      "capabilityDigest",
      "batches",
      "invocationId",
      "digest",
    ],
    "sweep.batchManifest",
    errors,
  );
  const runId = text(manifest.runId, "sweep.batchManifest.runId", errors);
  const inventoryDigest = digest(
    manifest.inventoryDigest,
    "sweep.batchManifest.inventoryDigest",
    errors,
  );
  const capabilityDigest = digest(
    manifest.capabilityDigest,
    "sweep.batchManifest.capabilityDigest",
    errors,
  );
  if (context.inventory && inventoryDigest !== context.inventory.digest) {
    errors.push("sweep.batchManifest.inventoryDigest does not match inventory");
  }
  if (capabilities && capabilityDigest !== capabilities.digest) {
    errors.push("sweep.batchManifest.capabilityDigest does not match capabilities");
  }
  const batchesRaw = batchValidation.array(
    manifest.batches,
    "sweep.batchManifest.batches",
    errors,
    SWEEP_LIMITS.coverageBatches,
  );
  if (batchesRaw.length === 0) {
    errors.push("sweep.batchManifest.batches must not be empty");
  }
  const batchIds = new Set();
  const batches = batchesRaw.map((item, index) => {
    const batch = normalizeBatch(
      item,
      `sweep.batchManifest.batches[${index}]`,
      errors,
      context.fileSourceIds,
      batchIds,
    );
    if (batch.ordinal !== index + 1) {
      errors.push(
        `sweep.batchManifest.batches[${index}].ordinal must be ${index + 1}`,
      );
    }
    return batch;
  });
  const covered = batches.flatMap((batch) => batch.fileSourceIds);
  if (JSON.stringify(covered) !== JSON.stringify(context.fileSourceIds)) {
    errors.push(
      "sweep.batchManifest.batches must cover every inventory file exactly once in order",
    );
  }
  const invocationId = text(
    manifest.invocationId,
    "sweep.batchManifest.invocationId",
    errors,
  );
  const normalized = {
    feature: text(manifest.feature, "sweep.batchManifest.feature", errors),
    version: batchValidation.integer(
      manifest.version,
      "sweep.batchManifest.version",
      errors,
      { minimum: SWEEP_BATCH_REPORT_VERSION },
    ),
    runId,
    inventoryDigest,
    capabilityDigest,
    batches,
    invocationId,
    digest: digest(manifest.digest, "sweep.batchManifest.digest", errors),
  };
  if (normalized.feature !== "sweep-batch-manifest") {
    errors.push("sweep.batchManifest.feature must be sweep-batch-manifest");
  }
  if (normalized.version !== SWEEP_BATCH_REPORT_VERSION) {
    errors.push(
      `sweep.batchManifest.version must be ${SWEEP_BATCH_REPORT_VERSION}`,
    );
  }
  if (normalized.digest !== digestSweepBatchManifest(normalized)) {
    errors.push("sweep.batchManifest.digest does not match its payload");
  }
  trustedHostCheck(
    verifyBatchInvocation,
    normalized,
    "sweep.batchManifest",
    errors,
    { kind: "manifest" },
  );
  invalid("Hope sweep batch manifest", errors);
  return deepFreeze(normalized);
}

export function createSweepBatchManifest(value, dependencies = {}) {
  const manifest = { ...value };
  if (!manifest.digest) {
    manifest.digest = digestSweepBatchManifest(manifest);
  }
  return validateSweepBatchManifest(manifest, dependencies);
}

function batchOwnersForSources(sourceIds, manifest) {
  return new Set(
    manifest.batches
      .filter((batch) => sourceIds.some((sourceId) => batch.fileSourceIds.includes(sourceId)))
      .map((batch) => batch.id),
  );
}

export function validateSweepCrossBatchSynthesis(
  value,
  {
    inventory,
    capabilities,
    manifest,
    verifyBatchInvocation,
  } = {},
) {
  const errors = [];
  const context = sourceContext(inventory, errors);
  const synthesis = object(value, "sweep.crossBatchSynthesis", errors);
  exactKeys(
    synthesis,
    [
      "feature",
      "version",
      "runId",
      "inventoryDigest",
      "capabilityDigest",
      "manifestDigest",
      "invocationId",
      "inspection",
      "evidenceSourceIds",
      "relationships",
      "gaps",
      "digest",
    ],
    "sweep.crossBatchSynthesis",
    errors,
  );
  const runId = text(synthesis.runId, "sweep.crossBatchSynthesis.runId", errors);
  const inventoryDigest = digest(synthesis.inventoryDigest, "sweep.crossBatchSynthesis.inventoryDigest", errors);
  if (context.inventory && inventoryDigest !== context.inventory.digest) {
    errors.push("sweep.crossBatchSynthesis.inventoryDigest does not match inventory");
  }
  const capabilityDigest = digest(synthesis.capabilityDigest, "sweep.crossBatchSynthesis.capabilityDigest", errors);
  if (capabilities && capabilityDigest !== capabilities.digest) {
    errors.push("sweep.crossBatchSynthesis.capabilityDigest does not match capabilities");
  }
  const manifestDigest = digest(synthesis.manifestDigest, "sweep.crossBatchSynthesis.manifestDigest", errors);
  if (!manifest) {
    errors.push("sweep.crossBatchSynthesis.manifest is required");
  } else if (manifestDigest !== manifest.digest) {
    errors.push("sweep.crossBatchSynthesis.manifestDigest does not match the pre-dispatch manifest");
  }
  if (manifest && runId !== manifest.runId) errors.push("sweep.crossBatchSynthesis.runId does not match the manifest");
  const invocationId = text(synthesis.invocationId, "sweep.crossBatchSynthesis.invocationId", errors);
  const inspection = batchValidation.choice(synthesis.inspection, SWEEP_INSPECTION_STATES, "sweep.crossBatchSynthesis.inspection", errors);
  const evidenceSourceIds = batchValidation.references(
    synthesis.evidenceSourceIds,
    "sweep.crossBatchSynthesis.evidenceSourceIds",
    errors,
    new Set(context.fileSourceIds),
  );
  if (["checked", "partial"].includes(inspection) && evidenceSourceIds.length === 0) {
    errors.push("sweep.crossBatchSynthesis inspected result must cite file evidence");
  }
  if (inspection === "checked" && JSON.stringify(evidenceSourceIds) !== JSON.stringify(context.fileSourceIds)) {
    errors.push("sweep.crossBatchSynthesis checked evidence must cover every inventory file");
  }
  const relationshipsRaw = batchValidation.array(
    synthesis.relationships,
    "sweep.crossBatchSynthesis.relationships",
    errors,
    SWEEP_LIMITS.batchRelationships,
  );
  const relationshipIds = new Set();
  const relationships = relationshipsRaw.map((item, index) => {
    const relationship = normalizeRelationship(
      item,
      `sweep.crossBatchSynthesis.relationships[${index}]`,
      errors,
      new Set(context.fileSourceIds),
      relationshipIds,
    );
    if (manifest && batchOwnersForSources(relationship.sourceIds, manifest).size < 2) {
      errors.push(`sweep.crossBatchSynthesis.relationships[${index}] must cross two or more manifest batches`);
    }
    return relationship;
  });
  const gaps = batchValidation.stringList(synthesis.gaps, "sweep.crossBatchSynthesis.gaps", errors);
  if (inspection === "checked" && gaps.length > 0) errors.push("sweep.crossBatchSynthesis checked result must not keep gaps");
  if (inspection !== "checked" && gaps.length === 0) errors.push("sweep.crossBatchSynthesis incomplete result must explain its gap");
  const normalized = {
    feature: text(synthesis.feature, "sweep.crossBatchSynthesis.feature", errors),
    version: batchValidation.integer(synthesis.version, "sweep.crossBatchSynthesis.version", errors, { minimum: SWEEP_BATCH_SYNTHESIS_VERSION }),
    runId,
    inventoryDigest,
    capabilityDigest,
    manifestDigest,
    invocationId,
    inspection,
    evidenceSourceIds,
    relationships,
    gaps,
    digest: digest(synthesis.digest, "sweep.crossBatchSynthesis.digest", errors),
  };
  if (normalized.feature !== "sweep-cross-batch-synthesis") errors.push("sweep.crossBatchSynthesis.feature must be sweep-cross-batch-synthesis");
  if (normalized.version !== SWEEP_BATCH_SYNTHESIS_VERSION) errors.push(`sweep.crossBatchSynthesis.version must be ${SWEEP_BATCH_SYNTHESIS_VERSION}`);
  if (normalized.digest !== digestSweepCrossBatchSynthesis(normalized)) errors.push("sweep.crossBatchSynthesis.digest does not match its payload");
  trustedHostCheck(
    verifyBatchInvocation,
    normalized,
    "sweep.crossBatchSynthesis",
    errors,
    { kind: "cross-batch-synthesis", manifestDigest },
  );
  invalid("Hope sweep cross-batch synthesis", errors);
  return deepFreeze(normalized);
}

export function createSweepCrossBatchSynthesis(value, dependencies = {}) {
  const synthesis = { ...value };
  if (!synthesis.digest) synthesis.digest = digestSweepCrossBatchSynthesis(synthesis);
  return validateSweepCrossBatchSynthesis(synthesis, dependencies);
}

function normalizeSourceResult(value, path, errors, sourceIds, expectedId) {
  const item = object(value, path, errors);
  exactKeys(item, ["sourceId", "inspection", "evidenceSourceIds", "gaps"], path, errors);
  const sourceId = text(item.sourceId, `${path}.sourceId`, errors);
  if (sourceId !== expectedId) errors.push(`${path}.sourceId must be ${expectedId}`);
  const inspection = batchValidation.choice(item.inspection, SWEEP_INSPECTION_STATES, `${path}.inspection`, errors);
  const evidenceSourceIds = batchValidation.references(
    item.evidenceSourceIds,
    `${path}.evidenceSourceIds`,
    errors,
    sourceIds,
  );
  const gaps = batchValidation.stringList(item.gaps, `${path}.gaps`, errors);
  if (["checked", "partial"].includes(inspection) && evidenceSourceIds.length === 0) {
    errors.push(`${path} inspected source must cite evidence`);
  }
  if (["partial", "not-checked", "failed"].includes(inspection) && gaps.length === 0) {
    errors.push(`${path} incomplete source must explain its gap`);
  }
  if (inspection === "checked" && gaps.length > 0) errors.push(`${path} checked source must not keep gaps`);
  if (inspection === "not-checked" && evidenceSourceIds.length > 0) errors.push(`${path} not-checked source must not claim evidence`);
  return { sourceId, inspection, evidenceSourceIds, gaps };
}

function normalizeCheck(value, path, errors, sourceIds, expected) {
  const item = object(value, path, errors);
  exactKeys(item, ["id", "inspection", "summary", "evidenceSourceIds", "gaps"], path, errors);
  const id = text(item.id, `${path}.id`, errors);
  if (id !== expected.id) errors.push(`${path}.id must be ${expected.id}`);
  const inspection = batchValidation.choice(item.inspection, SWEEP_INSPECTION_STATES, `${path}.inspection`, errors);
  const summary = text(item.summary, `${path}.summary`, errors);
  const evidenceSourceIds = batchValidation.references(item.evidenceSourceIds, `${path}.evidenceSourceIds`, errors, sourceIds);
  const gaps = batchValidation.stringList(item.gaps, `${path}.gaps`, errors);
  if (["checked", "partial"].includes(inspection) && evidenceSourceIds.length === 0) errors.push(`${path} inspected check must cite evidence`);
  if (["partial", "not-checked", "failed"].includes(inspection) && gaps.length === 0) errors.push(`${path} incomplete check must explain its gap`);
  if (inspection === "checked" && gaps.length > 0) errors.push(`${path} checked check must not keep gaps`);
  if (inspection === "not-checked" && evidenceSourceIds.length > 0) errors.push(`${path} not-checked check must not claim evidence`);
  return { id, inspection, summary, evidenceSourceIds, gaps };
}

function normalizeRelationship(value, path, errors, sourceIds, ids) {
  const item = object(value, path, errors);
  exactKeys(item, ["id", "sourceIds", "status", "summary", "evidenceSourceIds", "gaps"], path, errors);
  const id = identifier(item.id, `${path}.id`, errors, ids);
  const relationshipSourceIds = batchValidation.references(item.sourceIds, `${path}.sourceIds`, errors, sourceIds, { minimum: 2 });
  const status = batchValidation.choice(item.status, ["observed", "unresolved"], `${path}.status`, errors);
  const summary = text(item.summary, `${path}.summary`, errors);
  const evidenceSourceIds = batchValidation.references(item.evidenceSourceIds, `${path}.evidenceSourceIds`, errors, sourceIds);
  const gaps = batchValidation.stringList(item.gaps, `${path}.gaps`, errors);
  if (status === "observed" && evidenceSourceIds.length === 0) errors.push(`${path} observed relationship must cite evidence`);
  if (status === "observed" && gaps.length > 0) errors.push(`${path} observed relationship must not keep gaps`);
  if (status === "unresolved" && gaps.length === 0) errors.push(`${path} unresolved relationship must explain the uncertainty`);
  return { id, sourceIds: relationshipSourceIds, status, summary, evidenceSourceIds, gaps };
}

function normalizeObservation(value, path, errors, sourceIds, ids) {
  const item = object(value, path, errors);
  exactKeys(item, ["id", "categoryId", "checkId", "summary", "sourceIds", "disposition", "gaps"], path, errors);
  const id = identifier(item.id, `${path}.id`, errors, ids);
  const categoryId = text(item.categoryId, `${path}.categoryId`, errors);
  const checkId = text(item.checkId, `${path}.checkId`, errors);
  const check = SWEEP_CHECK_CATALOG.find((entry) => entry.id === checkId);
  if (!check || check.categoryId !== categoryId) errors.push(`${path}.checkId must belong to category ${categoryId}`);
  const summary = text(item.summary, `${path}.summary`, errors);
  const sourceIdsValue = batchValidation.references(item.sourceIds, `${path}.sourceIds`, errors, sourceIds, { minimum: 1 });
  const disposition = batchValidation.choice(item.disposition, ["candidate", "report-only"], `${path}.disposition`, errors);
  const gaps = batchValidation.stringList(item.gaps, `${path}.gaps`, errors);
  if (disposition === "candidate" && gaps.length > 0) errors.push(`${path} candidate observation must not keep gaps`);
  if (disposition === "report-only" && gaps.length === 0) errors.push(`${path} report-only observation must explain its gap`);
  return { id, categoryId, checkId, summary, sourceIds: sourceIdsValue, disposition, gaps };
}

function deriveInspection(states) {
  return states.includes("failed")
    ? "failed"
    : states.length > 0 && states.every((state) => state === "checked")
      ? "checked"
      : states.length > 0 && states.every((state) => state === "not-checked")
        ? "not-checked"
        : "partial";
}

function normalizeAttempt(value, path, errors, fileSourceIds, ids) {
  const item = object(value, path, errors);
  exactKeys(item, ["batch", "manifestDigest", "attempt", "attemptId", "status", "inputDigest", "invocationId", "outputDigest", "error"], path, errors);
  const batch = normalizeBatch(item.batch, `${path}.batch`, errors, fileSourceIds, new Set());
  const manifestDigest = digest(item.manifestDigest, `${path}.manifestDigest`, errors);
  const attempt = batchValidation.integer(item.attempt, `${path}.attempt`, errors, { minimum: 1 });
  const bindingDigest = sweepBatchBindingDigest({
    runId: errors.__runId ?? "invalid-run",
    inventoryDigest: errors.__inventoryDigest ?? "sha256:" + "0".repeat(64),
    manifestDigest: errors.__manifestDigest ?? manifestDigest,
    batch,
    capabilityDigest: errors.__capabilityDigest ?? "sha256:" + "0".repeat(64),
  });
  if (errors.__manifestDigest && manifestDigest !== errors.__manifestDigest) {
    errors.push(`${path}.manifestDigest does not match the pre-dispatch manifest`);
  }
  const inputDigest = digest(item.inputDigest, `${path}.inputDigest`, errors);
  const invocationId = text(item.invocationId, `${path}.invocationId`, errors);
  const outputDigest = digest(item.outputDigest, `${path}.outputDigest`, errors);
  const attemptId = digest(item.attemptId, `${path}.attemptId`, errors);
  const status = batchValidation.choice(item.status, ["succeeded", "failed", "cancelled"], `${path}.status`, errors);
  const error = item.error === undefined ? undefined : text(item.error, `${path}.error`, errors);
  if (status !== "succeeded" && !error) errors.push(`${path}.${status} attempt must explain its failure`);
  if (status === "succeeded" && error !== undefined) errors.push(`${path}.succeeded attempt must not contain an error`);
  if (status !== "succeeded" && outputDigest !== sweepBatchAttemptOutputDigest({ status, error })) {
    errors.push(`${path}.outputDigest does not match the failed attempt outcome`);
  }
  const expectedAttemptId = sweepBatchAttemptId({
    bindingDigest,
    manifestDigest,
    attempt,
    inputDigest,
    invocationId,
    outputDigest,
  });
  if (attemptId !== expectedAttemptId) errors.push(`${path}.attemptId does not match its binding`);
  return {
    batch,
    manifestDigest,
    attempt,
    attemptId,
    status,
    inputDigest,
    invocationId,
    outputDigest,
    ...(error === undefined ? {} : { error }),
  };
}

function sameBatch(left, right) {
  const binding = (batch) => ({
    id: batch?.id,
    ordinal: batch?.ordinal,
    fileSourceIds: batch?.fileSourceIds,
  });
  return JSON.stringify(canonicalValue(binding(left)))
    === JSON.stringify(canonicalValue(binding(right)));
}

function validateAttemptLedger(
  attempts,
  batches,
  retryBudget,
  path,
  errors,
) {
  const knownBatches = new Map(batches.map((batch) => [batch.id, batch]));
  const byBatch = new Map();
  const maximumAttempts = retryBudget + 1;
  for (const [index, attempt] of attempts.entries()) {
    const attemptPath = `${path}[${index}]`;
    const expectedBatch = knownBatches.get(attempt.batch.id);
    if (!expectedBatch) {
      errors.push(`${attemptPath}.batch.id must identify a report batch`);
      continue;
    }
    if (!sameBatch(attempt.batch, expectedBatch)) {
      errors.push(`${attemptPath}.batch must match its report batch`);
    }
    const batchAttempts = byBatch.get(attempt.batch.id) ?? [];
    batchAttempts.push(attempt);
    byBatch.set(attempt.batch.id, batchAttempts);
    if (attempt.attempt > maximumAttempts) {
      errors.push(`${attemptPath}.attempt exceeds retryBudget plus the initial attempt`);
    }
  }
  for (const [batchId, batchAttempts] of byBatch.entries()) {
    if (batchAttempts.length > maximumAttempts) {
      errors.push(`${path} contains too many attempts for ${batchId}`);
    }
    const rawNumbers = batchAttempts.map((attempt) => attempt.attempt);
    const numbers = [...new Set(rawNumbers)]
      .sort((left, right) => left - right);
    if (numbers.length !== rawNumbers.length) {
      errors.push(`${path} repeats an attempt number for ${batchId}`);
    }
    for (let index = 0; index < numbers.length; index += 1) {
      if (numbers[index] !== index + 1) {
        errors.push(`${path} attempts for ${batchId} must be contiguous from 1`);
        break;
      }
    }
  }
}

export function validateSweepBatchReport(
  value,
  {
    inventory,
    manifest,
    capabilities,
    verifyBatchCapabilities,
    verifyBatchInvocation,
  } = {},
) {
  const errors = [];
  const context = sourceContext(inventory, errors);
  let normalizedCapabilities;
  if (capabilities) {
    try {
      normalizedCapabilities = validateSweepBatchCapabilities(capabilities, {
        verifyBatchCapabilities,
      });
    } catch (error) {
      errors.push(`sweep.batchReport.capabilities: ${error.message}`);
    }
  } else {
    errors.push("sweep.batchReport.capabilities is required");
  }
  const report = object(value, "sweep.batchReport", errors);
  exactKeys(
    report,
    [
      "feature", "version", "runId", "inventoryDigest", "batch",
      "manifestDigest", "capabilityDigest", "bindingDigest", "attempt", "attemptId",
      "inputDigest", "invocationId", "outputDigest", "inspection", "relationshipInspection",
      "relationshipEvidenceSourceIds", "sourceResults", "checks",
      "relationships", "observations", "gaps",
      "reportDigest",
    ],
    "sweep.batchReport",
    errors,
  );
  const runId = text(report.runId, "sweep.batchReport.runId", errors);
  const inventoryDigest = digest(report.inventoryDigest, "sweep.batchReport.inventoryDigest", errors);
  if (context.inventory && inventoryDigest !== context.inventory.digest) errors.push("sweep.batchReport.inventoryDigest does not match inventory");
  const manifestDigest = digest(report.manifestDigest, "sweep.batchReport.manifestDigest", errors);
  if (!manifest) errors.push("sweep.batchReport.manifest is required for trusted report validation");
  let normalizedManifest;
  if (manifest) {
    try {
      normalizedManifest = validateSweepBatchManifest(manifest, {
        inventory: context.inventory,
        capabilities: normalizedCapabilities,
        verifyBatchInvocation,
      });
    } catch (error) {
      errors.push(`sweep.batchReport.manifest: ${error.message}`);
    }
  }
  if (normalizedManifest && manifestDigest !== normalizedManifest.digest) {
    errors.push("sweep.batchReport.manifestDigest does not match the pre-dispatch manifest");
  }
  const capabilityDigest = digest(report.capabilityDigest, "sweep.batchReport.capabilityDigest", errors);
  if (normalizedCapabilities && capabilityDigest !== normalizedCapabilities.digest) errors.push("sweep.batchReport.capabilityDigest does not match capabilities");
  const batch = normalizeBatch(report.batch, "sweep.batchReport.batch", errors, context.fileSourceIds, new Set());
  if (normalizedManifest && runId !== normalizedManifest.runId) {
    errors.push("sweep.batchReport.runId does not match the pre-dispatch manifest");
  }
  if (normalizedManifest) {
    const manifestBatch = normalizedManifest.batches.find((candidate) => (
      candidate.id === batch.id
      && candidate.ordinal === batch.ordinal
      && JSON.stringify(candidate.fileSourceIds) === JSON.stringify(batch.fileSourceIds)
    ));
    if (!manifestBatch) {
      errors.push("sweep.batchReport.batch does not exactly match a pre-dispatch manifest batch");
    }
  }
  const bindingDigest = digest(report.bindingDigest, "sweep.batchReport.bindingDigest", errors);
  const expectedBindingDigest = sweepBatchBindingDigest({ runId, inventoryDigest, manifestDigest, batch, capabilityDigest });
  if (bindingDigest !== expectedBindingDigest) errors.push("sweep.batchReport.bindingDigest does not match its batch binding");
  const attempt = batchValidation.integer(report.attempt, "sweep.batchReport.attempt", errors, { minimum: 1 });
  if (normalizedCapabilities && attempt > normalizedCapabilities.retryBudget + 1) {
    errors.push("sweep.batchReport.attempt exceeds the declared retry budget");
  }
  const inputDigest = digest(report.inputDigest, "sweep.batchReport.inputDigest", errors);
  const invocationId = text(report.invocationId, "sweep.batchReport.invocationId", errors);
  const outputDigest = digest(report.outputDigest, "sweep.batchReport.outputDigest", errors);
  const attemptId = digest(report.attemptId, "sweep.batchReport.attemptId", errors);
  const sourceResultsRaw = batchValidation.array(report.sourceResults, "sweep.batchReport.sourceResults", errors, context.fileSourceIds.length || 1);
  if (sourceResultsRaw.length !== batch.fileSourceIds.length) errors.push("sweep.batchReport.sourceResults must contain exactly one result per batch file");
  const sourceResults = batch.fileSourceIds.map((sourceId, index) => normalizeSourceResult(sourceResultsRaw[index], `sweep.batchReport.sourceResults[${index}]`, errors, new Set(batch.fileSourceIds), sourceId));
  const checksRaw = batchValidation.array(report.checks, "sweep.batchReport.checks", errors, SWEEP_CHECK_CATALOG.length);
  if (checksRaw.length !== SWEEP_CHECK_CATALOG.length) errors.push(`sweep.batchReport.checks must contain exactly ${SWEEP_CHECK_CATALOG.length} checks`);
  const checks = SWEEP_CHECK_CATALOG.map((specification, index) => normalizeCheck(checksRaw[index], `sweep.batchReport.checks[${index}]`, errors, new Set(batch.fileSourceIds), specification));
  const relationshipInspection = batchValidation.choice(report.relationshipInspection, SWEEP_INSPECTION_STATES, "sweep.batchReport.relationshipInspection", errors);
  const relationshipEvidenceSourceIds = batchValidation.references(
    report.relationshipEvidenceSourceIds,
    "sweep.batchReport.relationshipEvidenceSourceIds",
    errors,
    new Set(batch.fileSourceIds),
  );
  if (["checked", "partial"].includes(relationshipInspection) && relationshipEvidenceSourceIds.length === 0) {
    errors.push("sweep.batchReport relationship inspection must cite source evidence");
  }
  if (relationshipInspection === "checked") {
    for (const sourceId of batch.fileSourceIds) {
      if (!relationshipEvidenceSourceIds.includes(sourceId)) {
        errors.push(`sweep.batchReport relationship evidence is missing ${sourceId}`);
      }
    }
  }
  const relationshipsRaw = batchValidation.array(report.relationships, "sweep.batchReport.relationships", errors, SWEEP_LIMITS.batchRelationships);
  const relationshipIds = new Set();
  const relationships = relationshipsRaw.map((item, index) => normalizeRelationship(item, `sweep.batchReport.relationships[${index}]`, errors, new Set(batch.fileSourceIds), relationshipIds));
  const observationsRaw = batchValidation.array(report.observations, "sweep.batchReport.observations", errors, SWEEP_LIMITS.batchObservations);
  const observationIds = new Set();
  const observations = observationsRaw.map((item, index) => normalizeObservation(item, `sweep.batchReport.observations[${index}]`, errors, new Set(batch.fileSourceIds), observationIds));
  const gaps = batchValidation.stringList(report.gaps, "sweep.batchReport.gaps", errors);
  const inspection = batchValidation.choice(report.inspection, SWEEP_INSPECTION_STATES, "sweep.batchReport.inspection", errors);
  const expectedInspection = deriveInspection([
    ...sourceResults.map((item) => item.inspection),
    ...checks.map((item) => item.inspection),
    relationshipInspection,
  ]);
  if (inspection !== expectedInspection) errors.push(`sweep.batchReport.inspection must be ${expectedInspection}`);
  if (inspection === "checked" && gaps.length > 0) errors.push("sweep.batchReport checked report must not keep gaps");
  if (inspection !== "checked" && gaps.length === 0) errors.push("sweep.batchReport incomplete report must explain its gap");
  const normalized = {
    feature: text(report.feature, "sweep.batchReport.feature", errors),
    version: batchValidation.integer(report.version, "sweep.batchReport.version", errors, { minimum: SWEEP_BATCH_REPORT_VERSION }),
    runId,
    inventoryDigest,
    batch,
    manifestDigest,
    capabilityDigest,
    bindingDigest,
    attempt,
    attemptId,
    inputDigest,
    invocationId,
    outputDigest,
    inspection,
    relationshipInspection,
    relationshipEvidenceSourceIds,
    sourceResults,
    checks,
    relationships,
    observations,
    gaps,
    reportDigest: digest(report.reportDigest, "sweep.batchReport.reportDigest", errors),
  };
  if (normalized.outputDigest !== sweepBatchOutputDigest(normalized)) errors.push("sweep.batchReport.outputDigest does not match its inspection output");
  if (attemptId !== sweepBatchAttemptId({ bindingDigest, manifestDigest, attempt, inputDigest, invocationId, outputDigest })) errors.push("sweep.batchReport.attemptId does not match its attempt binding");
  if (normalized.feature !== "sweep-batch-report") errors.push("sweep.batchReport.feature must be sweep-batch-report");
  if (normalized.version !== SWEEP_BATCH_REPORT_VERSION) errors.push(`sweep.batchReport.version must be ${SWEEP_BATCH_REPORT_VERSION}`);
  if (normalized.reportDigest !== digestValue(reportPayload(normalized))) errors.push("sweep.batchReport.reportDigest does not match its payload");
  if (normalizedCapabilities && serializedJsonBytes(normalized) > normalizedCapabilities.maxReportBytes) errors.push("sweep.batchReport exceeds the declared maxReportBytes");
  trustedHostCheck(
    verifyBatchInvocation,
    normalized,
    "sweep.batchReport",
    errors,
    {
      kind: "report",
      manifestDigest,
      outputDigest,
    },
  );
  invalid("Hope sweep batch report", errors);
  return deepFreeze(normalized);
}

export function createSweepBatchReport(value, dependencies = {}) {
  const report = { ...value };
  if (!report.reportDigest) report.reportDigest = digestValue(reportPayload(report));
  return validateSweepBatchReport(report, dependencies);
}

export function validateSweepBatchReportSet(
  value,
  {
    inventory,
    capabilities,
    verifyBatchCapabilities,
    verifyBatchInvocation,
  } = {},
) {
  const errors = [];
  const context = sourceContext(inventory, errors);
  let normalizedCapabilities;
  if (capabilities) {
    try {
      normalizedCapabilities = validateSweepBatchCapabilities(capabilities, {
        verifyBatchCapabilities,
      });
    } catch (error) {
      errors.push(`sweep.batchReportSet.capabilities: ${error.message}`);
    }
  } else {
    errors.push("sweep.batchReportSet.capabilities is required");
  }
  let normalizedManifest;
  try {
    normalizedManifest = validateSweepBatchManifest(value?.manifest, {
      inventory: context.inventory,
      capabilities: normalizedCapabilities,
      verifyBatchInvocation,
    });
  } catch (error) {
    errors.push(`sweep.batchReportSet.manifest: ${error.message}`);
  }
  let normalizedCrossBatchSynthesis;
  try {
    normalizedCrossBatchSynthesis = validateSweepCrossBatchSynthesis(value?.crossBatchSynthesis, {
      inventory: context.inventory,
      capabilities: normalizedCapabilities,
      manifest: normalizedManifest,
      verifyBatchInvocation,
    });
  } catch (error) {
    errors.push(`sweep.batchReportSet.crossBatchSynthesis: ${error.message}`);
  }
  const valueObject = object(value, "sweep.batchReportSet", errors);
  exactKeys(valueObject, ["feature", "version", "runId", "inventoryDigest", "capabilityDigest", "manifest", "crossBatchSynthesis", "reports", "attempts", "digest"], "sweep.batchReportSet", errors);
  const runId = text(valueObject.runId, "sweep.batchReportSet.runId", errors);
  const inventoryDigest = digest(valueObject.inventoryDigest, "sweep.batchReportSet.inventoryDigest", errors);
  const capabilityDigest = digest(valueObject.capabilityDigest, "sweep.batchReportSet.capabilityDigest", errors);
  if (context.inventory && inventoryDigest !== context.inventory.digest) errors.push("sweep.batchReportSet.inventoryDigest does not match inventory");
  if (normalizedCapabilities && capabilityDigest !== normalizedCapabilities.digest) errors.push("sweep.batchReportSet.capabilityDigest does not match capabilities");
  const reportsRaw = batchValidation.array(valueObject.reports, "sweep.batchReportSet.reports", errors, SWEEP_LIMITS.batchReports);
  const reports = reportsRaw.map((item, index) => {
    try {
      return validateSweepBatchReport(item, {
        inventory: context.inventory,
        manifest: normalizedManifest,
        capabilities: normalizedCapabilities,
        verifyBatchCapabilities,
        verifyBatchInvocation,
      });
    } catch (error) {
      errors.push(`sweep.batchReportSet.reports[${index}]: ${error.message}`);
      return item;
    }
  });
  const reportBatchIds = new Set();
  const reportOrdinals = new Set();
  for (const [index, report] of reports.entries()) {
    if (!report || !report.batch) continue;
    if (report.runId !== runId) errors.push(`sweep.batchReportSet.reports[${index}] has a different runId`);
    if (report.inventoryDigest !== inventoryDigest) errors.push(`sweep.batchReportSet.reports[${index}] has a different inventoryDigest`);
    if (report.capabilityDigest !== capabilityDigest) errors.push(`sweep.batchReportSet.reports[${index}] has a different capabilityDigest`);
    if (reportBatchIds.has(report.batch.id)) errors.push(`sweep.batchReportSet repeats batch ${report.batch.id}`);
    if (reportOrdinals.has(report.batch.ordinal)) errors.push(`sweep.batchReportSet repeats batch ordinal ${report.batch.ordinal}`);
    reportBatchIds.add(report.batch.id);
    reportOrdinals.add(report.batch.ordinal);
  }
  if (normalizedManifest) {
    if (normalizedManifest.runId !== runId) {
      errors.push("sweep.batchReportSet.manifest.runId does not match the report set");
    }
    const manifestBatchIds = new Set(
      normalizedManifest.batches.map((batch) => batch.id),
    );
    for (const batchId of reportBatchIds) {
      if (!manifestBatchIds.has(batchId)) {
        errors.push(`sweep.batchReportSet report ${batchId} is absent from the manifest`);
      }
    }
    for (const report of reports) {
      if (!report?.batch) continue;
      const manifestBatch = normalizedManifest.batches.find(
        (batch) => batch.id === report.batch.id,
      );
      if (manifestBatch && !sameBatch(report.batch, manifestBatch)) {
        errors.push(
          `sweep.batchReportSet report ${report.batch.id} does not match the manifest`,
        );
      }
    }
  }
  const attemptsRaw = batchValidation.array(valueObject.attempts, "sweep.batchReportSet.attempts", errors, SWEEP_LIMITS.batchAttempts);
  if (attemptsRaw.length === 0) errors.push("sweep.batchReportSet.attempts must retain every dispatch attempt");
  const attemptIds = new Set();
  const attempts = [];
  for (const [index, item] of attemptsRaw.entries()) {
    const attemptErrors = [];
    attemptErrors.__runId = runId;
    attemptErrors.__inventoryDigest = inventoryDigest;
    attemptErrors.__capabilityDigest = capabilityDigest;
    attemptErrors.__manifestDigest = normalizedManifest?.digest;
    const normalized = normalizeAttempt(item, `sweep.batchReportSet.attempts[${index}]`, attemptErrors, context.fileSourceIds, new Set());
    for (const error of attemptErrors) if (typeof error === "string") errors.push(error);
    if (attemptIds.has(normalized.attemptId)) errors.push(`sweep.batchReportSet repeats attempt ${normalized.attemptId}`);
    attemptIds.add(normalized.attemptId);
    trustedHostCheck(
      verifyBatchInvocation,
      normalized,
      `sweep.batchReportSet.attempts[${index}]`,
      errors,
      {
        kind: "attempt",
        manifestDigest: normalized.manifestDigest,
        outputDigest: normalized.outputDigest,
      },
    );
    attempts.push(normalized);
  }
  validateAttemptLedger(
    attempts,
    normalizedManifest?.batches
      ?? reports.filter((report) => report?.batch).map((report) => report.batch),
    normalizedCapabilities?.retryBudget ?? 0,
    "sweep.batchReportSet.attempts",
    errors,
  );
  if (normalizedManifest) {
    for (const batch of normalizedManifest.batches) {
      const batchAttempts = attempts.filter((attempt) => attempt.batch.id === batch.id);
      if (batchAttempts.length === 0) {
        errors.push(
          `sweep.batchReportSet is missing an attempt for manifest batch ${batch.id}`,
        );
      } else if (!reports.some((report) => report?.batch?.id === batch.id)
        && batchAttempts.some((attempt) => attempt.status === "succeeded")) {
        errors.push(`sweep.batchReportSet is missing the succeeded report for ${batch.id}`);
      }
    }
  }
  for (const report of reports) {
    if (!report?.attemptId) continue;
    const success = attempts.find((attempt) => attempt.attemptId === report.attemptId && attempt.status === "succeeded");
    if (!success) {
      errors.push(`sweep.batchReportSet is missing the succeeded attempt for ${report.batch?.id ?? "unknown"}`);
    } else if (
      success.attempt !== report.attempt
      || success.manifestDigest !== report.manifestDigest
      || success.inputDigest !== report.inputDigest
      || success.invocationId !== report.invocationId
      || success.outputDigest !== report.outputDigest
      || !sameBatch(success.batch, report.batch)
    ) {
      errors.push(`sweep.batchReportSet succeeded attempt does not match report ${report.batch?.id ?? "unknown"}`);
    }
  }
  for (const attempt of attempts) {
    if (attempt.status === "succeeded" && !reports.some((report) => report?.attemptId === attempt.attemptId)) {
      errors.push(`sweep.batchReportSet succeeded attempt ${attempt.attemptId} has no report`);
    }
  }
  const normalized = {
    feature: text(valueObject.feature, "sweep.batchReportSet.feature", errors),
    version: batchValidation.integer(valueObject.version, "sweep.batchReportSet.version", errors, { minimum: SWEEP_BATCH_REPORT_VERSION }),
    runId,
    inventoryDigest,
    capabilityDigest,
    manifest: normalizedManifest,
    crossBatchSynthesis: normalizedCrossBatchSynthesis,
    reports,
    attempts,
    digest: digest(valueObject.digest, "sweep.batchReportSet.digest", errors),
  };
  if (normalized.feature !== "sweep-batch-report-set") errors.push("sweep.batchReportSet.feature must be sweep-batch-report-set");
  if (normalized.version !== SWEEP_BATCH_REPORT_VERSION) errors.push(`sweep.batchReportSet.version must be ${SWEEP_BATCH_REPORT_VERSION}`);
  if (normalized.digest !== digestValue(reportSetPayload(normalized))) errors.push("sweep.batchReportSet.digest does not match its payload");
  invalid("Hope sweep batch report set", errors);
  return deepFreeze(normalized);
}

export function createSweepBatchReportSet(value, dependencies = {}) {
  const reportSet = { ...value };
  if (!reportSet.digest) reportSet.digest = digestSweepBatchReportSet(reportSet);
  return validateSweepBatchReportSet(reportSet, dependencies);
}

function normalizedMergeCheck(specification, reports) {
  const checks = reports.map((report) => report.checks.find((item) => item.id === specification.id));
  const summaries = checks.map((check) => check.summary);
  const evidenceSourceIds = [...new Set(checks.flatMap((check) => check.evidenceSourceIds))];
  const gaps = [...new Set(checks.flatMap((check) => check.gaps))];
  return {
    categoryId: specification.categoryId,
    id: specification.id,
    inspection: deriveInspection(checks.map((check) => check.inspection)),
    summary: summaries.join(" | "),
    summaries,
    evidenceSourceIds,
    gaps,
  };
}

function createFailedBatchReport(reportSet, batch) {
  const attempts = reportSet.attempts
    .filter((attempt) => attempt.batch.id === batch.id)
    .sort((left, right) => left.attempt - right.attempt);
  const latest = attempts.at(-1);
  const failure = latest?.error ?? "No successful batch report was produced.";
  const sourceResults = batch.fileSourceIds.map((sourceId) => ({
    sourceId,
    inspection: "failed",
    evidenceSourceIds: [],
    gaps: [failure],
  }));
  const checks = SWEEP_CHECK_CATALOG.map((check) => ({
    id: check.id,
    inspection: "failed",
    summary: `The batch did not produce a report for ${check.id}.`,
    evidenceSourceIds: [],
    gaps: [failure],
  }));
  const report = {
    feature: "sweep-batch-report",
    version: SWEEP_BATCH_REPORT_VERSION,
    runId: reportSet.runId,
    inventoryDigest: reportSet.inventoryDigest,
    batch,
    manifestDigest: reportSet.manifest.digest,
    capabilityDigest: reportSet.capabilityDigest,
    bindingDigest: sweepBatchBindingDigest({
      runId: reportSet.runId,
      inventoryDigest: reportSet.inventoryDigest,
      manifestDigest: reportSet.manifest.digest,
      batch,
      capabilityDigest: reportSet.capabilityDigest,
    }),
    attempt: latest?.attempt ?? 1,
    attemptId: latest?.attemptId ?? digestValue({ batch, failure }),
    inputDigest: latest?.inputDigest ?? digestValue({ batch, failure }),
    invocationId: latest?.invocationId ?? `failed-${batch.id}`,
    inspection: "failed",
    relationshipInspection: "failed",
    relationshipEvidenceSourceIds: [],
    sourceResults,
    checks,
    relationships: [],
    observations: [],
    gaps: [failure],
  };
  report.outputDigest = sweepBatchOutputDigest(report);
  report.reportDigest = digestValue(reportPayload(report));
  return deepFreeze(report);
}

export function mergeSweepBatchReports(
  value,
  {
    inventory,
    capabilities,
    verifyBatchCapabilities,
    verifyBatchInvocation,
    skipValidation = false,
  } = {},
) {
  const reportSet = validateSweepBatchReportSet(value, {
    inventory,
    capabilities,
    verifyBatchCapabilities,
    verifyBatchInvocation,
  });
  const context = validateSweepInventory(inventory);
  const reportsByBatchId = new Map(reportSet.reports.map((report) => [report.batch.id, report]));
  const reports = reportSet.manifest.batches.map((batch) => (
    reportsByBatchId.get(batch.id) ?? createFailedBatchReport(reportSet, batch)
  ));
  const covered = reports.flatMap((report) => report.batch.fileSourceIds);
  if (covered.length !== context.fileSourceIds.length || JSON.stringify(covered) !== JSON.stringify(context.fileSourceIds)) {
    throw new TypeError("Hope sweep batch merge requires every inventory file exactly once in ordinal batch order");
  }
  const batchIds = new Set();
  for (const [index, report] of reports.entries()) {
    if (report.batch.ordinal !== index + 1) throw new TypeError(`Hope sweep batch merge requires ordinal ${index + 1}`);
    if (batchIds.has(report.batch.id)) throw new TypeError(`Hope sweep batch merge repeats batch ${report.batch.id}`);
    batchIds.add(report.batch.id);
  }
  const relationships = [];
  const relationshipIds = new Set();
  const observations = [];
  const observationIds = new Set();
  for (const report of reports) {
    for (const relationship of report.relationships) {
      if (relationshipIds.has(relationship.id)) throw new TypeError(`Hope sweep batch merge repeats relationship ${relationship.id}`);
      relationshipIds.add(relationship.id);
      relationships.push(relationship);
    }
    for (const observation of report.observations) {
      if (observationIds.has(observation.id)) throw new TypeError(`Hope sweep batch merge repeats observation ${observation.id}`);
      observationIds.add(observation.id);
      observations.push(observation);
    }
  }
  for (const relationship of reportSet.crossBatchSynthesis.relationships) {
    if (relationshipIds.has(relationship.id)) throw new TypeError(`Hope sweep batch merge repeats relationship ${relationship.id}`);
    relationshipIds.add(relationship.id);
    relationships.push(relationship);
  }
  const checkResults = SWEEP_CHECK_CATALOG.map((specification) => normalizedMergeCheck(specification, reports));
  const relationshipInspection = deriveInspection([
    ...reports.map((report) => report.relationshipInspection),
    reportSet.crossBatchSynthesis.inspection,
  ]);
  const relationshipEvidenceSourceIds = [...new Set(
    reports.flatMap((report) => report.relationshipEvidenceSourceIds)
      .concat(reportSet.crossBatchSynthesis.evidenceSourceIds),
  )];
  const relationshipEvidenceComplete = JSON.stringify(relationshipEvidenceSourceIds)
    === JSON.stringify(context.fileSourceIds);
  const state = deriveInspection([
    ...reports.map((report) => report.inspection),
    ...checkResults.map((check) => check.inspection),
    relationshipInspection,
  ]) === "checked" && relationshipEvidenceComplete
    ? "complete"
    : reports.some((report) => report.inspection === "failed") || checkResults.some((check) => check.inspection === "failed")
      ? "failed"
      : "partial";
  const gaps = [...new Set([
    ...reports.flatMap((report) => report.gaps),
    ...checkResults.flatMap((check) => check.gaps),
    ...reports.flatMap((report) => report.relationships.flatMap((relationship) => relationship.gaps)),
    ...reportSet.crossBatchSynthesis.gaps,
    ...(relationshipEvidenceComplete
      ? []
      : ["Cross-batch relationship evidence does not cover every inventory file."]),
  ])];
  const merge = {
    feature: "sweep-batch-merge",
    version: SWEEP_BATCH_MERGE_VERSION,
    runId: reportSet.runId,
    inventoryDigest: reportSet.inventoryDigest,
    capabilityDigest: reportSet.capabilityDigest,
    crossBatchSynthesis: reportSet.crossBatchSynthesis,
    state,
    relationshipInspection,
    relationshipEvidenceSourceIds,
    batches: reports.map((report) => ({
      id: report.batch.id,
      ordinal: report.batch.ordinal,
      fileSourceIds: [...report.batch.fileSourceIds],
      inspection: report.inspection,
      gaps: [...report.gaps],
      reportDigest: report.reportDigest,
    })),
    checkResults,
    relationships,
    observations,
    reportDigests: reports.map((report) => report.reportDigest),
    attempts: reportSet.attempts,
    gaps,
  };
  const normalized = { ...merge, digest: digestValue(mergePayload(merge)) };
  if (skipValidation) return deepFreeze(normalized);
  return validateSweepBatchMerge(normalized, {
    inventory: context,
    capabilities,
    reportSet,
    verifyBatchCapabilities,
    verifyBatchInvocation,
  });
}

export function validateSweepBatchMerge(
  value,
  {
    inventory,
    capabilities,
    reportSet,
    verifyBatchCapabilities,
    verifyBatchInvocation,
  } = {},
) {
  const errors = [];
  if (!reportSet) {
    errors.push("sweep.batchMerge.reportSet is required for trusted merge validation");
  }
  const context = sourceContext(inventory, errors);
  let normalizedCapabilities;
  if (capabilities) {
    try {
      normalizedCapabilities = validateSweepBatchCapabilities(capabilities, {
        verifyBatchCapabilities,
      });
    } catch (error) {
      errors.push(`sweep.batchMerge.capabilities: ${error.message}`);
    }
  } else {
    errors.push("sweep.batchMerge.capabilities is required");
  }
  let normalizedCrossBatchSynthesis;
  if (reportSet?.crossBatchSynthesis) {
    try {
      normalizedCrossBatchSynthesis = validateSweepCrossBatchSynthesis(
        value?.crossBatchSynthesis,
        {
          inventory: context.inventory,
          capabilities: normalizedCapabilities,
          manifest: reportSet.manifest,
          verifyBatchInvocation,
        },
      );
    } catch (error) {
      errors.push(`sweep.batchMerge.crossBatchSynthesis: ${error.message}`);
    }
  } else {
    errors.push("sweep.batchMerge.crossBatchSynthesis requires a validated report-set synthesis");
  }
  const merge = object(value, "sweep.batchMerge", errors);
  exactKeys(merge, ["feature", "version", "runId", "inventoryDigest", "capabilityDigest", "crossBatchSynthesis", "state", "relationshipInspection", "relationshipEvidenceSourceIds", "batches", "checkResults", "relationships", "observations", "reportDigests", "attempts", "gaps", "digest"], "sweep.batchMerge", errors);
  const runId = text(merge.runId, "sweep.batchMerge.runId", errors);
  const inventoryDigest = digest(merge.inventoryDigest, "sweep.batchMerge.inventoryDigest", errors);
  const capabilityDigest = digest(merge.capabilityDigest, "sweep.batchMerge.capabilityDigest", errors);
  if (context.inventory && inventoryDigest !== context.inventory.digest) errors.push("sweep.batchMerge.inventoryDigest does not match inventory");
  if (normalizedCapabilities && capabilityDigest !== normalizedCapabilities.digest) errors.push("sweep.batchMerge.capabilityDigest does not match capabilities");
  const rawBatches = batchValidation.array(merge.batches, "sweep.batchMerge.batches", errors, SWEEP_LIMITS.coverageBatches);
  const batchIds = new Set();
  const batches = rawBatches.map((item, index) => {
    const batch = object(item, `sweep.batchMerge.batches[${index}]`, errors);
    exactKeys(batch, ["id", "ordinal", "fileSourceIds", "inspection", "gaps", "reportDigest"], `sweep.batchMerge.batches[${index}]`, errors);
    const normalized = {
      id: identifier(batch.id, `sweep.batchMerge.batches[${index}].id`, errors, batchIds),
      ordinal: batchValidation.integer(batch.ordinal, `sweep.batchMerge.batches[${index}].ordinal`, errors, { minimum: 1 }),
      fileSourceIds: batchValidation.references(batch.fileSourceIds, `sweep.batchMerge.batches[${index}].fileSourceIds`, errors, new Set(context.fileSourceIds), { minimum: 1 }),
      inspection: batchValidation.choice(batch.inspection, SWEEP_INSPECTION_STATES, `sweep.batchMerge.batches[${index}].inspection`, errors),
      gaps: batchValidation.stringList(batch.gaps, `sweep.batchMerge.batches[${index}].gaps`, errors),
      reportDigest: digest(batch.reportDigest, `sweep.batchMerge.batches[${index}].reportDigest`, errors),
    };
    if (normalized.ordinal !== index + 1) errors.push(`sweep.batchMerge.batches[${index}].ordinal must be ${index + 1}`);
    return normalized;
  });
  const covered = batches.flatMap((batch) => batch.fileSourceIds);
  if (JSON.stringify(covered) !== JSON.stringify(context.fileSourceIds)) errors.push("sweep.batchMerge.batches must cover every inventory file exactly once in order");
  const checkResultsRaw = batchValidation.array(merge.checkResults, "sweep.batchMerge.checkResults", errors, SWEEP_CHECK_CATALOG.length);
  if (checkResultsRaw.length !== SWEEP_CHECK_CATALOG.length) errors.push(`sweep.batchMerge.checkResults must contain exactly ${SWEEP_CHECK_CATALOG.length} checks`);
  const checkResults = SWEEP_CHECK_CATALOG.map((specification, index) => {
    const item = object(checkResultsRaw[index], `sweep.batchMerge.checkResults[${index}]`, errors);
    exactKeys(item, ["categoryId", "id", "inspection", "summary", "summaries", "evidenceSourceIds", "gaps"], `sweep.batchMerge.checkResults[${index}]`, errors);
    const categoryId = text(item.categoryId, `sweep.batchMerge.checkResults[${index}].categoryId`, errors);
    const id = text(item.id, `sweep.batchMerge.checkResults[${index}].id`, errors);
    if (categoryId !== specification.categoryId) errors.push(`sweep.batchMerge.checkResults[${index}].categoryId must be ${specification.categoryId}`);
    if (id !== specification.id) errors.push(`sweep.batchMerge.checkResults[${index}].id must be ${specification.id}`);
    return {
      categoryId,
      id,
      inspection: batchValidation.choice(item.inspection, SWEEP_INSPECTION_STATES, `sweep.batchMerge.checkResults[${index}].inspection`, errors),
      summary: text(item.summary, `sweep.batchMerge.checkResults[${index}].summary`, errors),
      summaries: batchValidation.stringList(item.summaries, `sweep.batchMerge.checkResults[${index}].summaries`, errors, { minimum: 1 }),
      evidenceSourceIds: batchValidation.references(item.evidenceSourceIds, `sweep.batchMerge.checkResults[${index}].evidenceSourceIds`, errors, context.sourceIds),
      gaps: batchValidation.stringList(item.gaps, `sweep.batchMerge.checkResults[${index}].gaps`, errors),
    };
  });
  const relationshipIds = new Set();
  const relationships = batchValidation.array(merge.relationships, "sweep.batchMerge.relationships", errors, SWEEP_LIMITS.batchRelationships).map((item, index) => normalizeRelationship(item, `sweep.batchMerge.relationships[${index}]`, errors, context.sourceIds, relationshipIds));
  const observationIds = new Set();
  const observations = batchValidation.array(merge.observations, "sweep.batchMerge.observations", errors, SWEEP_LIMITS.batchObservations).map((item, index) => normalizeObservation(item, `sweep.batchMerge.observations[${index}]`, errors, context.sourceIds, observationIds));
  const reportDigests = batchValidation.array(merge.reportDigests, "sweep.batchMerge.reportDigests", errors, SWEEP_LIMITS.batchReports).map((item, index) => digest(item, `sweep.batchMerge.reportDigests[${index}]`, errors));
  const attemptsRaw = batchValidation.array(merge.attempts, "sweep.batchMerge.attempts", errors, SWEEP_LIMITS.batchAttempts);
  const attempts = attemptsRaw.map((item, index) => {
    const attemptErrors = [];
    attemptErrors.__runId = runId;
    attemptErrors.__inventoryDigest = inventoryDigest;
    attemptErrors.__capabilityDigest = capabilityDigest;
    const normalized = normalizeAttempt(item, `sweep.batchMerge.attempts[${index}]`, attemptErrors, context.fileSourceIds, new Set());
    for (const error of attemptErrors) if (typeof error === "string") errors.push(error);
    return normalized;
  });
  for (const [index, attempt] of attempts.entries()) {
    trustedHostCheck(
      verifyBatchInvocation,
      attempt,
      `sweep.batchMerge.attempts[${index}]`,
      errors,
      {
        kind: "attempt",
        manifestDigest: attempt.manifestDigest,
        outputDigest: attempt.outputDigest,
      },
    );
  }
  validateAttemptLedger(
    attempts,
    batches,
    normalizedCapabilities?.retryBudget ?? 0,
    "sweep.batchMerge.attempts",
    errors,
  );
  const state = batchValidation.choice(merge.state, ["complete", "partial", "failed"], "sweep.batchMerge.state", errors);
  const relationshipInspection = batchValidation.choice(merge.relationshipInspection, SWEEP_INSPECTION_STATES, "sweep.batchMerge.relationshipInspection", errors);
  const relationshipEvidenceSourceIds = batchValidation.references(
    merge.relationshipEvidenceSourceIds,
    "sweep.batchMerge.relationshipEvidenceSourceIds",
    errors,
    context.sourceIds,
  );
  if (["checked", "partial"].includes(relationshipInspection) && relationshipEvidenceSourceIds.length === 0) {
    errors.push("sweep.batchMerge relationship inspection must cite source evidence");
  }
  const relationshipEvidenceComplete = JSON.stringify(relationshipEvidenceSourceIds)
    === JSON.stringify(context.fileSourceIds);
  const gaps = batchValidation.stringList(merge.gaps, "sweep.batchMerge.gaps", errors);
  const expectedState = deriveInspection([
    ...batches.map((batch) => batch.inspection),
    ...checkResults.map((check) => check.inspection),
    relationshipInspection,
  ]) === "checked" && relationshipEvidenceComplete
    ? "complete"
    : batches.some((batch) => batch.inspection === "failed") || checkResults.some((check) => check.inspection === "failed")
      ? "failed"
      : "partial";
  if (state !== expectedState) errors.push(`sweep.batchMerge.state must be ${expectedState}`);
  if (state === "complete" && gaps.length > 0) errors.push("sweep.batchMerge complete result must not keep gaps");
  if (state !== "complete" && gaps.length === 0) errors.push("sweep.batchMerge incomplete result must explain its gap");
  const normalized = {
    feature: text(merge.feature, "sweep.batchMerge.feature", errors),
    version: batchValidation.integer(merge.version, "sweep.batchMerge.version", errors, { minimum: SWEEP_BATCH_MERGE_VERSION }),
    runId,
    inventoryDigest,
    capabilityDigest,
    crossBatchSynthesis: normalizedCrossBatchSynthesis,
    state,
    relationshipInspection,
    relationshipEvidenceSourceIds,
    batches,
    checkResults,
    relationships,
    observations,
    reportDigests,
    attempts,
    gaps,
    digest: digest(merge.digest, "sweep.batchMerge.digest", errors),
  };
  if (normalized.feature !== "sweep-batch-merge") errors.push("sweep.batchMerge.feature must be sweep-batch-merge");
  if (normalized.version !== SWEEP_BATCH_MERGE_VERSION) errors.push(`sweep.batchMerge.version must be ${SWEEP_BATCH_MERGE_VERSION}`);
  if (normalized.digest !== digestValue(mergePayload(normalized))) errors.push("sweep.batchMerge.digest does not match its payload");
  if (serializedJsonBytes(normalized) > SWEEP_LIMITS.batchMergeBytes) errors.push(`sweep.batchMerge exceeds ${SWEEP_LIMITS.batchMergeBytes} bytes`);
  if (reportSet && context.inventory && normalizedCapabilities) {
    try {
      const expected = mergeSweepBatchReports(reportSet, {
        inventory: context.inventory,
        capabilities: normalizedCapabilities,
        verifyBatchCapabilities,
        verifyBatchInvocation,
        skipValidation: true,
      });
      if (
        JSON.stringify(canonicalValue(expected))
        !== JSON.stringify(canonicalValue(normalized))
      ) {
        errors.push("sweep.batchMerge does not match the validated report set");
      }
    } catch (error) {
      errors.push(`sweep.batchMerge report-set binding: ${error.message}`);
    }
  }
  invalid("Hope sweep batch merge", errors);
  return deepFreeze(normalized);
}
