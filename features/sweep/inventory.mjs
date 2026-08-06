import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  inspectStructuredValue,
  validateWorkSnapshot,
} from "../work-snapshot/index.mjs";
import {
  SWEEP_INVENTORY_BATCH_STATES,
  SWEEP_INVENTORY_DISCOVERY_PROTOCOL,
  SWEEP_INVENTORY_EXECUTION_MODES,
  SWEEP_INVENTORY_STATES,
  SWEEP_INVENTORY_VERSION,
  SWEEP_LIMITS,
} from "./constants.mjs";

export const SWEEP_INVENTORY_FILE_KINDS = Object.freeze([
  "tracked",
  "untracked",
]);

export const SWEEP_INVENTORY_EXCLUSION_KINDS = Object.freeze([
  "ignored-cache",
  "ignored-dependency",
  "ignored-build",
  "outside-project",
  "other",
]);

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const idPattern = /^[a-z][a-z0-9-]{0,63}$/u;

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalid(errors) {
  if (errors.length > 0) {
    throw new TypeError(`Hope sweep inventory is invalid:\n- ${errors.join("\n- ")}`);
  }
}

function text(value, path, errors, { maximum = SWEEP_LIMITS.stringCharacters } = {}) {
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || [...value].length > maximum
  ) {
    errors.push(`${path} must be a non-empty string within ${maximum} characters`);
    return "";
  }
  return value;
}

function identifier(value, path, errors, ids) {
  const result = text(value, path, errors, { maximum: 64 });
  if (result && !idPattern.test(result)) errors.push(`${path} is invalid`);
  if (result && ids) {
    if (ids.has(result)) errors.push(`${path} repeats ID ${result}`);
    ids.add(result);
  }
  return result;
}

function digest(value, path, errors, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  const result = text(value, path, errors, { maximum: 80 });
  if (result && !digestPattern.test(result)) {
    errors.push(`${path} must use the sha256: format`);
  }
  return result;
}

function integer(value, path, errors, { minimum = 0, maximum, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Number.isSafeInteger(value) || value < minimum) {
    errors.push(`${path} must be an integer of at least ${minimum}`);
    return minimum;
  }
  if (maximum !== undefined && value > maximum) {
    errors.push(`${path} must not exceed ${maximum}`);
  }
  return value;
}

function array(value, path, errors, maximum, { minimum = 0 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  if (value.length < minimum) {
    errors.push(`${path} must contain at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  }
  if (maximum !== undefined && value.length > maximum) {
    errors.push(`${path} must have at most ${maximum} items`);
  }
  return maximum === undefined ? value.slice() : value.slice(0, maximum);
}

function unknownKeys(value, allowed, path, errors) {
  if (!plainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function references(value, path, errors, known, { maximum = SWEEP_LIMITS.sources, minimum = 0 } = {}) {
  const items = array(value, path, errors, maximum, { minimum })
    .map((item, index) => text(item, `${path}[${index}]`, errors, { maximum: 64 }));
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) errors.push(`${path} repeats ${item}`);
    seen.add(item);
    if (!known.has(item)) errors.push(`${path} references unknown source ${item}`);
  }
  return items;
}

function validRelativePath(value) {
  return value.length > 0
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.includes("\0")
    && !value.split("/").includes("..")
    && value !== ".";
}

function normalizeFile(raw, path, errors, ids, paths) {
  const item = plainObject(raw) ? raw : {};
  if (!plainObject(raw)) errors.push(`${path} must be an object`);
  unknownKeys(item, ["id", "path", "kind", "digest", "size"], path, errors);
  const id = identifier(item.id, `${path}.id`, errors, ids);
  const filePath = text(item.path, `${path}.path`, errors, { maximum: 8_192 });
  if (filePath && !validRelativePath(filePath)) {
    errors.push(`${path}.path must be a normalized relative project path`);
  }
  if (filePath && paths.has(filePath)) errors.push(`${path}.path repeats ${filePath}`);
  if (filePath) paths.add(filePath);
  return {
    id,
    path: filePath,
    kind: item.kind,
    digest: digest(item.digest, `${path}.digest`, errors),
    size: integer(item.size, `${path}.size`, errors, { minimum: 0, optional: true }),
  };
}

function normalizeExclusion(raw, path, paths) {
  const errors = [];
  const item = plainObject(raw) ? raw : {};
  if (!plainObject(raw)) errors.push(`${path} must be an object`);
  unknownKeys(item, ["path", "kind", "reason"], path, errors);
  const filePath = text(item.path, `${path}.path`, errors, { maximum: 8_192 });
  if (filePath && !validRelativePath(filePath)) {
    errors.push(`${path}.path must be a normalized relative project path`);
  }
  if (filePath && paths.has(filePath)) errors.push(`${path}.path repeats ${filePath}`);
  if (filePath) paths.add(filePath);
  const kind = item.kind;
  if (!SWEEP_INVENTORY_EXCLUSION_KINDS.includes(kind)) {
    errors.push(`${path}.kind must be one of ${SWEEP_INVENTORY_EXCLUSION_KINDS.join(", ")}`);
  }
  return {
    value: {
      path: filePath,
      kind,
      reason: text(item.reason, `${path}.reason`, errors),
    },
    errors,
  };
}

function normalizeExecution(value, path, errors) {
  const input = plainObject(value) ? value : {};
  if (!plainObject(value)) errors.push(`${path} must be an object`);
  unknownKeys(input, ["mode", "workerIds"], path, errors);
  const mode = input.mode;
  if (!SWEEP_INVENTORY_EXECUTION_MODES.includes(mode)) {
    errors.push(`${path}.mode must be one of ${SWEEP_INVENTORY_EXECUTION_MODES.join(", ")}`);
  }
  const rawWorkers = array(input.workerIds, `${path}.workerIds`, errors, 16);
  const workerIds = [];
  const workerSet = new Set();
  rawWorkers.forEach((worker, index) => {
    workerIds.push(identifier(worker, `${path}.workerIds[${index}]`, errors, workerSet));
  });
  if (mode === "parallel" && workerIds.length < 2) {
    errors.push(`${path}.parallel execution requires at least two workers`);
  }
  if (mode === "single" && workerIds.length > 1) {
    errors.push(`${path}.single execution accepts at most one worker`);
  }
  return { mode, workerIds };
}

function unique(values) {
  return [...new Set(values)];
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

function inventoryJsonBytes(value) {
  inspectStructuredValue(value, { maximumNodes: SWEEP_LIMITS.inventoryNodes });
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function inventoryStringBytes(value) {
  return inspectStructuredValue(value, {
    maximumNodes: SWEEP_LIMITS.inventoryNodes,
  }).stringBytes;
}

function inventoryManifestPayload(files, exclusions) {
  return {
    files,
    exclusions,
  };
}

export function sweepInventoryManifestDigest(files, exclusions) {
  return hashCanonicalValue(inventoryManifestPayload(files, exclusions));
}

function normalizeDiscovery(raw, path, errors, files, exclusions) {
  const input = plainObject(raw) ? raw : {};
  if (!plainObject(raw)) errors.push(`${path} must be an object`);
  unknownKeys(
    input,
    ["protocol", "repository", "revision", "manifestDigest", "verifiedAt"],
    path,
    errors,
  );
  const protocol = text(input.protocol, `${path}.protocol`, errors, { maximum: 128 });
  if (protocol !== SWEEP_INVENTORY_DISCOVERY_PROTOCOL) {
    errors.push(`${path}.protocol must be ${SWEEP_INVENTORY_DISCOVERY_PROTOCOL}`);
  }
  const repository = text(input.repository, `${path}.repository`, errors, { maximum: 8_192 });
  const revision = text(input.revision, `${path}.revision`, errors, { maximum: 128 });
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(revision)) {
    errors.push(`${path}.revision must be a full Git object ID`);
  }
  const manifestDigest = digest(input.manifestDigest, `${path}.manifestDigest`, errors);
  const verifiedAt = text(input.verifiedAt, `${path}.verifiedAt`, errors, { maximum: 128 });
  if (!Number.isFinite(Date.parse(verifiedAt))) {
    errors.push(`${path}.verifiedAt must be an ISO date-time`);
  }
  const expectedDigest = sweepInventoryManifestDigest(files, exclusions);
  if (manifestDigest && manifestDigest !== expectedDigest) {
    errors.push(`${path}.manifestDigest must match the normalized file manifest`);
  }
  return {
    protocol,
    repository,
    revision,
    manifestDigest,
    verifiedAt: Number.isFinite(Date.parse(verifiedAt))
      ? new Date(verifiedAt).toISOString()
      : verifiedAt,
  };
}

function inventoryPayload(value) {
  return {
    version: value.version,
    title: value.title,
    sessionId: value.sessionId,
    scope: value.scope,
    snapshot: value.snapshot,
    discovery: value.discovery,
    batchSize: value.batchSize,
    files: value.files,
    exclusions: value.exclusions,
    batches: value.batches,
    state: value.state,
    summary: value.summary,
  };
}

function derivedState(batches) {
  if (batches.some((batch) => batch.state === "failed")) return "failed";
  if (batches.every((batch) => batch.state === "complete")) return "complete";
  if (batches.every((batch) => ["complete", "partial"].includes(batch.state))) {
    return "partial";
  }
  if (batches.some((batch) => batch.state !== "pending")) return "in-progress";
  return "ready";
}

function derivedSummary(files, exclusions, batches) {
  const processed = new Set(batches.flatMap((batch) => batch.processedSourceIds));
  return {
    totalFiles: files.length,
    inScopeFiles: files.length,
    excludedFiles: exclusions.length,
    processedFiles: processed.size,
    remainingFiles: files.length - processed.size,
    remainingGaps: unique(batches.flatMap((batch) => batch.gaps)),
  };
}

function expectedWorkerIds(execution) {
  return execution.workerIds.length > 0 ? execution.workerIds : ["host"];
}

function normalizeAssignments(raw, path, errors, sourceIds, execution) {
  const items = array(raw, path, errors, execution.workerIds.length > 0 ? 16 : 1, {
    minimum: 1,
  });
  const assignments = [];
  const assigned = new Set();
  const expectedWorkers = expectedWorkerIds(execution);
  if (items.length !== expectedWorkers.length) {
    errors.push(`${path} must contain one assignment per execution worker`);
  }
  items.forEach((rawAssignment, index) => {
    const assignmentPath = `${path}[${index}]`;
    const input = plainObject(rawAssignment) ? rawAssignment : {};
    if (!plainObject(rawAssignment)) errors.push(`${assignmentPath} must be an object`);
    unknownKeys(input, ["workerId", "sourceIds"], assignmentPath, errors);
    const workerId = identifier(input.workerId, `${assignmentPath}.workerId`, errors);
    if (!expectedWorkers.includes(workerId)) {
      errors.push(`${assignmentPath}.workerId is not in the execution worker set`);
    }
    const assignedSourceIds = references(
      input.sourceIds,
      `${assignmentPath}.sourceIds`,
      errors,
      sourceIds,
      { maximum: SWEEP_LIMITS.inventoryBatchFiles },
    );
    for (const sourceId of assignedSourceIds) {
      if (assigned.has(sourceId)) errors.push(`${path} assigns ${sourceId} more than once`);
      assigned.add(sourceId);
    }
    assignments.push({ workerId, sourceIds: assignedSourceIds });
  });
  if (assigned.size !== sourceIds.size) {
    errors.push(`${path} must assign every batch source exactly once`);
  }
  for (const sourceId of sourceIds) {
    if (!assigned.has(sourceId)) errors.push(`${path} is missing ${sourceId}`);
  }
  return assignments;
}

function normalizeReceipts(raw, path, errors, assignments) {
  const items = array(raw, path, errors, assignments.length);
  const expected = new Map(assignments.map((assignment) => [assignment.workerId, assignment.sourceIds]));
  const seen = new Set();
  const receipts = [];
  items.forEach((rawReceipt, index) => {
    const receiptPath = `${path}[${index}]`;
    const input = plainObject(rawReceipt) ? rawReceipt : {};
    if (!plainObject(rawReceipt)) errors.push(`${receiptPath} must be an object`);
    unknownKeys(input, ["workerId", "processedSourceIds", "gaps"], receiptPath, errors);
    const workerId = identifier(input.workerId, `${receiptPath}.workerId`, errors);
    if (seen.has(workerId)) errors.push(`${path} repeats worker ${workerId}`);
    seen.add(workerId);
    const assignedSourceIds = expected.get(workerId) ?? [];
    const processedSourceIds = references(
      input.processedSourceIds,
      `${receiptPath}.processedSourceIds`,
      errors,
      new Set(assignedSourceIds),
      { maximum: SWEEP_LIMITS.inventoryBatchFiles },
    );
    const gaps = array(input.gaps, `${receiptPath}.gaps`, errors, SWEEP_LIMITS.groupItems)
      .map((gap, gapIndex) => text(gap, `${receiptPath}.gaps[${gapIndex}]`, errors));
    receipts.push({ workerId, processedSourceIds, gaps });
  });
  if (receipts.length !== assignments.length) {
    errors.push(`${path} must contain one receipt per assignment`);
  }
  for (const assignment of assignments) {
    if (!seen.has(assignment.workerId)) errors.push(`${path} is missing worker ${assignment.workerId}`);
  }
  return receipts;
}

function receiptProcessedSourceIds(receipts, sourceOrder = undefined) {
  const processed = new Set(receipts.flatMap((receipt) => receipt.processedSourceIds));
  return sourceOrder
    ? sourceOrder.filter((sourceId) => processed.has(sourceId))
    : unique([...processed]);
}

function receiptGaps(receipts) {
  return unique(receipts.flatMap((receipt) => receipt.gaps));
}

function batchReceiptPayload(value) {
  return {
    batchId: value.batchId,
    inventoryDigest: value.inventoryDigest,
    inputDigest: value.inputDigest,
    state: value.state,
    execution: value.execution,
    receipts: value.receipts,
  };
}

export function sweepInventoryBatchResultDigest(value) {
  return hashCanonicalValue(batchReceiptPayload(value));
}

function normalizeBatch(raw, path, errors, batchIds, fileIds) {
  const input = plainObject(raw) ? raw : {};
  if (!plainObject(raw)) errors.push(`${path} must be an object`);
  unknownKeys(
    input,
    [
      "id",
      "ordinal",
      "sourceIds",
      "state",
      "execution",
      "assignments",
      "inventoryDigest",
      "inputDigest",
      "processedSourceIds",
      "receipts",
      "receiptDigest",
      "gaps",
    ],
    path,
    errors,
  );
  const id = identifier(input.id, `${path}.id`, errors, batchIds);
  const ordinal = integer(input.ordinal, `${path}.ordinal`, errors, { minimum: 1 });
  const sourceIds = references(
    input.sourceIds,
    `${path}.sourceIds`,
    errors,
    fileIds,
    { maximum: SWEEP_LIMITS.inventoryBatchFiles, minimum: 1 },
  );
  const state = input.state;
  if (!SWEEP_INVENTORY_BATCH_STATES.includes(state)) {
    errors.push(`${path}.state must be one of ${SWEEP_INVENTORY_BATCH_STATES.join(", ")}`);
  }
  const execution = normalizeExecution(input.execution, `${path}.execution`, errors);
  const assignments = input.assignments === undefined
    || (state === "pending" && Array.isArray(input.assignments) && input.assignments.length === 0)
    ? []
    : normalizeAssignments(
      input.assignments,
      `${path}.assignments`,
      errors,
      new Set(sourceIds),
      execution,
    );
  const inventoryDigest = digest(input.inventoryDigest, `${path}.inventoryDigest`, errors, {
    optional: true,
  });
  const inputDigest = digest(input.inputDigest, `${path}.inputDigest`, errors, {
    optional: true,
  });
  const processedSourceIds = references(
    input.processedSourceIds,
    `${path}.processedSourceIds`,
    errors,
    new Set(sourceIds),
    { maximum: SWEEP_LIMITS.inventoryBatchFiles },
  );
  const receipts = input.receipts === undefined
    || ((state === "pending" || state === "in-progress")
      && Array.isArray(input.receipts)
      && input.receipts.length === 0)
    ? []
    : normalizeReceipts(input.receipts, `${path}.receipts`, errors, assignments);
  const receiptDigest = digest(input.receiptDigest, `${path}.receiptDigest`, errors, {
    optional: true,
  });
  const gaps = array(input.gaps, `${path}.gaps`, errors, SWEEP_LIMITS.groupItems)
    .map((gap, index) => text(gap, `${path}.gaps[${index}]`, errors));
  if (state === "pending") {
    if (execution.mode !== "single" || execution.workerIds.length > 0) {
      errors.push(`${path} pending batch must use single execution with no workers`);
    }
    if (
      processedSourceIds.length > 0
      || assignments.length > 0
      || inventoryDigest
      || inputDigest
      || receipts.length > 0
      || receiptDigest
      || gaps.length > 0
    ) {
      errors.push(`${path} pending batch must not contain execution results`);
    }
  }
  if (state === "in-progress") {
    if (!inventoryDigest || !inputDigest) {
      errors.push(`${path} in-progress batch requires inventory and input digests`);
    }
    if (assignments.length === 0) errors.push(`${path} in-progress batch requires assignments`);
    if (receipts.length > 0 || receiptDigest) {
      errors.push(`${path} in-progress batch must not contain receipts`);
    }
  }
  if (state === "complete") {
    if (!isDeepStrictEqual(processedSourceIds, sourceIds)) {
      errors.push(`${path} complete batch must process every assigned file`);
    }
    if (!inventoryDigest || !inputDigest) {
      errors.push(`${path} complete batch requires inventory and input digests`);
    }
    if (assignments.length === 0) errors.push(`${path} complete batch requires assignments`);
    if (receipts.length === 0 || !receiptDigest) {
      errors.push(`${path} complete batch requires receipts and a receipt digest`);
    }
    if (gaps.length > 0) errors.push(`${path} complete batch must not keep gaps`);
  }
  if (state === "partial") {
    if (!inventoryDigest || !inputDigest || !receiptDigest) {
      errors.push(`${path} partial batch requires execution and receipt digests`);
    }
    if (assignments.length === 0 || receipts.length === 0) {
      errors.push(`${path} partial batch requires assignments and receipts`);
    }
    if (gaps.length === 0) errors.push(`${path} partial batch must explain its gap`);
  }
  if (state === "failed" && gaps.length === 0) {
    errors.push(`${path} failed batch must explain its gap`);
  }
  if (state === "failed") {
    if (!inventoryDigest || !inputDigest || !receiptDigest) {
      errors.push(`${path} failed batch requires execution and receipt digests`);
    }
    if (assignments.length === 0 || receipts.length === 0) {
      errors.push(`${path} failed batch requires assignments and receipts`);
    }
  }
  if (state !== "pending" && receipts.length > 0) {
    const expectedProcessed = receiptProcessedSourceIds(receipts, sourceIds);
    const expectedGaps = receiptGaps(receipts);
    if (!isDeepStrictEqual(processedSourceIds, expectedProcessed)) {
      errors.push(`${path}.processedSourceIds must be derived from worker receipts`);
    }
    if (!isDeepStrictEqual(gaps, expectedGaps)) {
      errors.push(`${path}.gaps must be derived from worker receipts`);
    }
    if (
      receiptDigest
      && receiptDigest !== sweepInventoryBatchResultDigest({
        batchId: id,
        inventoryDigest,
        inputDigest,
        state,
        execution,
        receipts,
      })
    ) {
      errors.push(`${path}.receiptDigest must match its worker receipts`);
    }
  }
  return {
    id,
    ordinal,
    sourceIds,
    state,
    execution,
    assignments,
    ...(inventoryDigest ? { inventoryDigest } : {}),
    ...(inputDigest ? { inputDigest } : {}),
    processedSourceIds,
    receipts,
    ...(receiptDigest ? { receiptDigest } : {}),
    gaps,
  };
}

export function validateSweepInventory(value, {
  inputFileBytes = inventoryJsonBytes(value),
} = {}) {
  const errors = [];
  if (!plainObject(value)) errors.push("sweepInventory must be an object");
  const input = plainObject(value) ? value : {};
  unknownKeys(
    input,
    [
      "version",
      "title",
      "sessionId",
      "scope",
      "snapshot",
      "discovery",
      "batchSize",
      "files",
      "exclusions",
      "batches",
      "state",
      "summary",
      "result",
      "resources",
    ],
    "sweepInventory",
    errors,
  );
  const version = integer(input.version, "sweepInventory.version", errors, { minimum: 1 });
  if (version !== SWEEP_INVENTORY_VERSION) {
    errors.push(`sweepInventory.version must be ${SWEEP_INVENTORY_VERSION}`);
  }
  const title = text(input.title, "sweepInventory.title", errors);
  const sessionId = text(input.sessionId, "sweepInventory.sessionId", errors);
  const scope = text(input.scope, "sweepInventory.scope", errors);
  let normalizedSnapshot = { capturedAt: "1970-01-01T00:00:00.000Z", sources: [] };
  try {
    normalizedSnapshot = validateWorkSnapshot(input.snapshot, {
      maximumSources: SWEEP_LIMITS.sources,
    });
  } catch (error) {
    errors.push(`sweepInventory.snapshot: ${error.message}`);
  }
  if (!normalizedSnapshot.sources.some((source) => source.kind === "git")) {
    errors.push("sweepInventory.snapshot must include a Git repository source");
  }
  const batchSize = integer(
    input.batchSize,
    "sweepInventory.batchSize",
    errors,
    { minimum: 1, maximum: SWEEP_LIMITS.inventoryBatchFiles },
  );
  const fileIds = new Set();
  const paths = new Set();
  const rawFiles = array(
    input.files,
    "sweepInventory.files",
    errors,
    undefined,
    { minimum: 1 },
  );
  const files = rawFiles.map((raw, index) => {
    const file = normalizeFile(raw, `sweepInventory.files[${index}]`, errors, fileIds, paths);
    if (!SWEEP_INVENTORY_FILE_KINDS.includes(file.kind)) {
      errors.push(`sweepInventory.files[${index}].kind must be one of ${SWEEP_INVENTORY_FILE_KINDS.join(", ")}`);
    }
    return file;
  });
  const rawExclusions = array(
    input.exclusions,
    "sweepInventory.exclusions",
    errors,
    undefined,
  );
  const exclusions = [];
  for (let index = 0; index < rawExclusions.length; index += 1) {
    const result = normalizeExclusion(
      rawExclusions[index],
      `sweepInventory.exclusions[${index}]`,
      paths,
    );
    errors.push(...result.errors);
    exclusions.push(result.value);
  }
  const discovery = normalizeDiscovery(
    input.discovery,
    "sweepInventory.discovery",
    errors,
    files,
    exclusions,
  );
  const gitSource = normalizedSnapshot.sources.find((source) => source.kind === "git");
  if (gitSource?.revision && gitSource.revision !== discovery.revision) {
    errors.push("sweepInventory.discovery.revision must match its Git snapshot source");
  }
  const rawBatches = array(
    input.batches,
    "sweepInventory.batches",
    errors,
    undefined,
    { minimum: 1 },
  );
  const batchIds = new Set();
  const batches = rawBatches.map((raw, index) => (
    normalizeBatch(
      raw,
      `sweepInventory.batches[${index}]`,
      errors,
      batchIds,
      fileIds,
    )
  ));
  batches.forEach((batch, index) => {
    if (batch.ordinal !== index + 1) {
      errors.push(`sweepInventory.batches[${index}].ordinal must be ${index + 1}`);
    }
    if (batch.sourceIds.length > batchSize) {
      errors.push(`sweepInventory.batches[${index}] exceeds batchSize`);
    }
  });
  const assigned = new Set();
  for (const batch of batches) {
    for (const sourceId of batch.sourceIds) {
      if (assigned.has(sourceId)) errors.push(`sweepInventory assigns ${sourceId} to multiple batches`);
      assigned.add(sourceId);
    }
  }
  for (const file of files) {
    if (!assigned.has(file.id)) errors.push(`sweepInventory file ${file.id} is not assigned to a batch`);
  }
  for (const sourceId of assigned) {
    if (!fileIds.has(sourceId)) errors.push(`sweepInventory batch references unknown file ${sourceId}`);
  }
  const processed = new Set(batches.flatMap((batch) => batch.processedSourceIds));
  for (const sourceId of processed) {
    if (!assigned.has(sourceId)) errors.push(`sweepInventory processed unknown file ${sourceId}`);
  }
  const state = input.state;
  const expectedState = derivedState(batches);
  if (!SWEEP_INVENTORY_STATES.includes(state)) {
    errors.push(`sweepInventory.state must be one of ${SWEEP_INVENTORY_STATES.join(", ")}`);
  }
  if (state !== expectedState) {
    errors.push(`sweepInventory.state must be ${expectedState} for its batches`);
  }
  const remainingGaps = unique(batches.flatMap((batch) => batch.gaps));
  const summaryInput = plainObject(input.summary) ? input.summary : {};
  if (!plainObject(input.summary)) errors.push("sweepInventory.summary must be an object");
  unknownKeys(
    summaryInput,
    ["totalFiles", "inScopeFiles", "excludedFiles", "processedFiles", "remainingFiles", "remainingGaps"],
    "sweepInventory.summary",
    errors,
  );
  const summary = {
    totalFiles: integer(summaryInput.totalFiles, "sweepInventory.summary.totalFiles", errors),
    inScopeFiles: integer(summaryInput.inScopeFiles, "sweepInventory.summary.inScopeFiles", errors),
    excludedFiles: integer(summaryInput.excludedFiles, "sweepInventory.summary.excludedFiles", errors),
    processedFiles: integer(summaryInput.processedFiles, "sweepInventory.summary.processedFiles", errors),
    remainingFiles: integer(summaryInput.remainingFiles, "sweepInventory.summary.remainingFiles", errors),
    remainingGaps: array(summaryInput.remainingGaps, "sweepInventory.summary.remainingGaps", errors, SWEEP_LIMITS.groupItems)
      .map((gap, index) => text(gap, `sweepInventory.summary.remainingGaps[${index}]`, errors)),
  };
  const expectedSummary = {
    totalFiles: files.length,
    inScopeFiles: files.length,
    excludedFiles: exclusions.length,
    processedFiles: processed.size,
    remainingFiles: files.length - processed.size,
    remainingGaps,
  };
  if (!isDeepStrictEqual(summary, expectedSummary)) {
    errors.push("sweepInventory.summary must match its file, batch, and exclusion state");
  }
  if (inputFileBytes > SWEEP_LIMITS.inventoryInputBytes) {
    errors.push(`sweep inventory input exceeds ${SWEEP_LIMITS.inventoryInputBytes} bytes`);
  }
  if (inventoryStringBytes(value) > SWEEP_LIMITS.inventoryProseBytes) {
    errors.push(`sweep inventory prose exceeds ${SWEEP_LIMITS.inventoryProseBytes} bytes`);
  }
  invalid(errors);
  const normalized = {
    version,
    title,
    sessionId,
    scope,
    snapshot: normalizedSnapshot,
    discovery,
    batchSize,
    files,
    exclusions,
    batches,
    state,
    summary,
  };
  return Object.freeze({
    ...normalized,
    result: Object.freeze({
      state,
      totalFiles: files.length,
      processedFiles: processed.size,
      remainingFiles: files.length - processed.size,
      excludedFiles: exclusions.length,
    }),
    resources: Object.freeze({
      inputFileBytes,
      jsonBytes: inventoryJsonBytes(normalized),
      files: files.length,
      exclusions: exclusions.length,
      batches: batches.length,
      processedFiles: processed.size,
    }),
  });
}

export function sweepInventoryDigest(value) {
  return hashCanonicalValue(inventoryPayload(validateSweepInventory(value)));
}

export function createSweepInventory({
  title,
  sessionId,
  scope,
  snapshot,
  discovery,
  files = [],
  exclusions = [],
  batchSize = SWEEP_LIMITS.inventoryBatchFiles,
} = {}) {
  const batches = [];
  for (let index = 0; index < files.length; index += batchSize) {
    const sourceIds = files.slice(index, index + batchSize).map((file) => file.id);
    batches.push({
      id: `batch-${batches.length + 1}`,
      ordinal: batches.length + 1,
      sourceIds,
      state: "pending",
      execution: { mode: "single", workerIds: [] },
      processedSourceIds: [],
      gaps: [],
    });
  }
  const inventory = {
    version: SWEEP_INVENTORY_VERSION,
    title,
    sessionId,
    scope,
    snapshot,
    discovery,
    batchSize,
    files,
    exclusions,
    batches,
    state: "ready",
    summary: {
      totalFiles: files.length,
      inScopeFiles: files.length,
      excludedFiles: exclusions.length,
      processedFiles: 0,
      remainingFiles: files.length,
      remainingGaps: [],
    },
  };
  return validateSweepInventory(inventory);
}

export function getSweepInventoryBatch(value, batchId) {
  const inventory = validateSweepInventory(value);
  const batch = inventory.batches.find((item) => item.id === batchId);
  if (!batch) throw new TypeError(`Unknown Hope sweep inventory batch: ${batchId}`);
  const files = batch.sourceIds.map((sourceId) => inventory.files.find((file) => file.id === sourceId));
  return Object.freeze({
    feature: "sweep-batch-input",
    version: SWEEP_INVENTORY_VERSION,
    inventoryDigest: sweepInventoryDigest(inventory),
    sessionId: inventory.sessionId,
    scope: inventory.scope,
    batch: Object.freeze({ ...batch }),
    files: Object.freeze(files),
  });
}

function normalizeBatchExecution(execution) {
  const errors = [];
  const result = normalizeExecution(execution, "batch.execution", errors);
  invalid(errors);
  return result;
}

function createAssignments(sourceIds, execution) {
  const workerIds = expectedWorkerIds(execution);
  const assignments = workerIds.map((workerId) => ({ workerId, sourceIds: [] }));
  sourceIds.forEach((sourceId, index) => {
    assignments[index % assignments.length].sourceIds.push(sourceId);
  });
  return assignments;
}

export function startSweepInventoryBatch(value, batchId, execution) {
  const inventory = validateSweepInventory(value);
  const normalizedExecution = normalizeBatchExecution(execution);
  const pendingInput = getSweepInventoryBatch(inventory, batchId);
  const inputDigest = sweepInventoryBatchDigest(pendingInput);
  const inventoryDigest = pendingInput.inventoryDigest;
  const batches = inventory.batches.map((batch) => {
    if (batch.id !== batchId) return batch;
    if (batch.state !== "pending") {
      throw new TypeError(`Sweep inventory batch ${batchId} is already ${batch.state}`);
    }
    return {
      ...batch,
      state: "in-progress",
      execution: normalizedExecution,
      assignments: createAssignments(batch.sourceIds, normalizedExecution),
      inventoryDigest,
      inputDigest,
    };
  });
  if (!inventory.batches.some((batch) => batch.id === batchId)) {
    throw new TypeError(`Unknown Hope sweep inventory batch: ${batchId}`);
  }
  const next = {
    ...inventory,
    batches,
    state: "in-progress",
    summary: derivedSummary(inventory.files, inventory.exclusions, batches),
  };
  return validateSweepInventory(next);
}

export function completeSweepInventoryBatch(value, batchId, result) {
  const inventory = validateSweepInventory(value);
  const input = plainObject(result) ? result : {};
  const errors = [];
  if (!plainObject(result)) errors.push("batch result must be an object");
  unknownKeys(
    input,
    [
      "batchId",
      "inventoryDigest",
      "inputDigest",
      "state",
      "execution",
      "receipts",
      "receiptDigest",
    ],
    "batch",
    errors,
  );
  if (input.batchId !== batchId) {
    errors.push("batch.batchId must match the requested inventory batch");
  }
  if (!["complete", "partial", "failed"].includes(input.state)) {
    errors.push("batch.state must be complete, partial, or failed");
  }
  const batch = inventory.batches.find((item) => item.id === batchId);
  if (!batch) throw new TypeError(`Unknown Hope sweep inventory batch: ${batchId}`);
  if (batch.state !== "in-progress") {
    throw new TypeError(`Sweep inventory batch ${batchId} must be in-progress before completion`);
  }
  const execution = normalizeExecution(input.execution, "batch.execution", errors);
  const inventoryDigest = digest(input.inventoryDigest, "batch.inventoryDigest", errors);
  const inputDigest = digest(input.inputDigest, "batch.inputDigest", errors);
  const receipts = normalizeReceipts(
    input.receipts,
    "batch.receipts",
    errors,
    batch.assignments,
  );
  const receiptDigest = digest(input.receiptDigest, "batch.receiptDigest", errors);
  if (inventoryDigest !== batch.inventoryDigest) {
    errors.push("batch.inventoryDigest must match the inventory captured at start");
  }
  if (inputDigest !== batch.inputDigest) {
    errors.push("batch.inputDigest must match the prepared batch input");
  }
  if (!isDeepStrictEqual(execution, batch.execution)) {
    errors.push("batch.execution must match the execution assigned at start");
  }
  const processedSourceIds = receiptProcessedSourceIds(receipts, batch.sourceIds);
  const gaps = receiptGaps(receipts);
  const expectedReceiptDigest = sweepInventoryBatchResultDigest({
    batchId,
    inventoryDigest,
    inputDigest,
    state: input.state,
    execution,
    receipts,
  });
  if (receiptDigest !== expectedReceiptDigest) {
    errors.push("batch.receiptDigest must match the exact worker receipts");
  }
  if (input.state === "complete" && !isDeepStrictEqual(processedSourceIds, batch.sourceIds)) {
    errors.push("complete batch result must process every assigned file");
  }
  if (input.state === "complete" && gaps.length > 0) errors.push("complete batch result must not keep gaps");
  if (input.state !== "complete" && gaps.length === 0) errors.push("incomplete batch result must explain its gap");
  invalid(errors);
  const batches = inventory.batches.map((item) => item.id === batchId
    ? {
      ...item,
      state: input.state,
      execution,
      receipts,
      inventoryDigest,
      inputDigest,
      processedSourceIds,
      receiptDigest,
      gaps,
    }
    : item);
  return validateSweepInventory({
    ...inventory,
    batches,
    state: derivedState(batches),
    summary: derivedSummary(inventory.files, inventory.exclusions, batches),
  });
}

export function validateSweepInventoryBatchInput(value) {
  const errors = [];
  const input = plainObject(value) ? value : {};
  if (!plainObject(value)) errors.push("sweep batch input must be an object");
  unknownKeys(input, ["feature", "version", "inventoryDigest", "sessionId", "scope", "batch", "files"], "sweepBatchInput", errors);
  if (input.feature !== "sweep-batch-input") errors.push("sweepBatchInput.feature must be sweep-batch-input");
  if (input.version !== SWEEP_INVENTORY_VERSION) errors.push(`sweepBatchInput.version must be ${SWEEP_INVENTORY_VERSION}`);
  digest(input.inventoryDigest, "sweepBatchInput.inventoryDigest", errors);
  text(input.sessionId, "sweepBatchInput.sessionId", errors);
  text(input.scope, "sweepBatchInput.scope", errors);
  const batch = plainObject(input.batch) ? input.batch : {};
  if (!plainObject(input.batch)) errors.push("sweepBatchInput.batch must be an object");
  unknownKeys(
    batch,
    [
      "id",
      "ordinal",
      "sourceIds",
      "state",
      "execution",
      "assignments",
      "inventoryDigest",
      "inputDigest",
      "processedSourceIds",
      "receipts",
      "receiptDigest",
      "gaps",
    ],
    "sweepBatchInput.batch",
    errors,
  );
  const fileIds = new Set();
  const filePaths = new Set();
  const files = array(input.files, "sweepBatchInput.files", errors, SWEEP_LIMITS.inventoryBatchFiles, { minimum: 1 });
  files.forEach((file, index) => {
    const normalized = normalizeFile(file, `sweepBatchInput.files[${index}]`, errors, fileIds, filePaths);
    files[index] = normalized;
  });
  const sourceIds = references(batch.sourceIds, "sweepBatchInput.batch.sourceIds", errors, fileIds, {
    maximum: SWEEP_LIMITS.inventoryBatchFiles,
    minimum: 1,
  });
  if (files.length !== sourceIds.length) errors.push("sweepBatchInput.files must contain every assigned file");
  files.forEach((file, index) => {
    if (!sourceIds.includes(file.id)) errors.push(`sweepBatchInput.files[${index}] is not assigned to this batch`);
  });
  if (!isDeepStrictEqual(files.map((file) => file.id), sourceIds)) {
    errors.push("sweepBatchInput.files must follow batch.sourceIds order");
  }
  const batchId = identifier(batch.id, "sweepBatchInput.batch.id", errors, new Set());
  const ordinal = integer(batch.ordinal, "sweepBatchInput.batch.ordinal", errors, { minimum: 1 });
  const state = batch.state;
  if (!SWEEP_INVENTORY_BATCH_STATES.includes(state)) {
    errors.push(`sweepBatchInput.batch.state must be one of ${SWEEP_INVENTORY_BATCH_STATES.join(", ")}`);
  }
  const execution = normalizeExecution(
    batch.execution,
    "sweepBatchInput.batch.execution",
    errors,
  );
  if (state !== "pending") {
    errors.push("sweepBatchInput.batch must be pending before start");
  }
  const assignments = Array.isArray(batch.assignments) && batch.assignments.length === 0
    ? []
    : normalizeAssignments(
      batch.assignments,
      "sweepBatchInput.batch.assignments",
      errors,
      new Set(sourceIds),
      execution,
    );
  const inventoryDigest = digest(
    batch.inventoryDigest,
    "sweepBatchInput.batch.inventoryDigest",
    errors,
    { optional: true },
  );
  const inputDigest = digest(
    batch.inputDigest,
    "sweepBatchInput.batch.inputDigest",
    errors,
    { optional: true },
  );
  const processedSourceIds = references(
    batch.processedSourceIds,
    "sweepBatchInput.batch.processedSourceIds",
    errors,
    new Set(sourceIds),
    { maximum: SWEEP_LIMITS.inventoryBatchFiles },
  );
  if (inventoryDigest || inputDigest || processedSourceIds.length > 0) {
    errors.push("pending sweepBatchInput.batch must not contain execution results");
  }
  const gaps = array(
    batch.gaps,
    "sweepBatchInput.batch.gaps",
    errors,
    SWEEP_LIMITS.groupItems,
  ).map((gap, index) => text(gap, `sweepBatchInput.batch.gaps[${index}]`, errors));
  invalid(errors);
  return Object.freeze({
    feature: input.feature,
    version: input.version,
    inventoryDigest: input.inventoryDigest,
    sessionId: input.sessionId,
    scope: input.scope,
    batch: Object.freeze({
      id: batchId,
      ordinal,
      sourceIds,
      state,
      execution,
      assignments,
      ...(inventoryDigest ? { inventoryDigest } : {}),
      ...(inputDigest ? { inputDigest } : {}),
      processedSourceIds,
      receipts: [],
      gaps,
    }),
    files: Object.freeze(files),
  });
}

export function sweepInventoryBatchDigest(value) {
  return hashCanonicalValue(validateSweepInventoryBatchInput(value));
}

export function createSweepInventoryBatchResult({
  batchId,
  inventoryDigest,
  inputDigest,
  state,
  execution,
  receipts = [],
} = {}) {
  const result = {
    batchId,
    inventoryDigest,
    inputDigest,
    state,
    execution,
    receipts,
  };
  return Object.freeze({
    ...result,
    receiptDigest: sweepInventoryBatchResultDigest(result),
  });
}

export function inventoryStructuredValue(value) {
  inspectStructuredValue(value);
  return value;
}
