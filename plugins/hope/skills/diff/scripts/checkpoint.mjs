import {
  BASIS,
  CHECKPOINT_VERSION,
  LIMITS,
} from "./constants.mjs";
import { validateContextPath } from "./context.mjs";
import { splitEvidenceRange } from "./evidence-range.mjs";
import { containsBidiControl } from "./text.mjs";

const OBSERVATION_KINDS = new Set(["fact", "risk", "question"]);
const SOURCE_BASIS = Object.freeze({
  code: new Set(["after-file", "before-file", "context-file", "patch"]),
  stated: new Set([
    "commit-title",
    "pull-request-description",
    "pull-request-title",
  ]),
});

function object(value, name, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${name} has unexpected or missing fields`);
  }
  return value;
}

function array(value, name, maximum, { minimum = 0 } = {}) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  if (value.length < minimum) {
    throw new Error(`${name} needs at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  }
  if (value.length > maximum) {
    throw new Error(`${name} has too many items`);
  }
  return value;
}

function text(value, name) {
  if (
    typeof value !== "string"
    || value.trim().length === 0
    || Buffer.byteLength(value, "utf8") > LIMITS.checkpointTextBytes
    || containsBidiControl(value)
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${name} must be short plain text`);
  }
  return value;
}

function sourceMap(snapshot) {
  return snapshot
    ? new Map(snapshot.sources.map((source) => [source.id, source]))
    : undefined;
}

function currentSourceChunks(page) {
  const chunks = page?.kind === "sources" ? page.value?.sources : [];
  return Array.isArray(chunks) ? chunks : [];
}

function pageEvidenceExcerpt(page, evidence) {
  const chunk = currentSourceChunks(page).find((value) => (
    value.sourceId === evidence.sourceId
    && evidence.startLine >= value.startLine
    && evidence.endLine <= value.endLine
  ));
  if (!chunk) return undefined;
  return chunk.text
    .split("\n")
    .slice(
      evidence.startLine - chunk.startLine,
      evidence.endLine - chunk.startLine + 1,
    )
    .join("\n");
}

function validateEvidence(values, name, snapshot, page) {
  const sources = sourceMap(snapshot);
  const chunks = currentSourceChunks(page);
  const evidence = array(
    values,
    name,
    LIMITS.checkpointEvidenceReferences,
    { minimum: 1 },
  ).flatMap((value, index) => {
    const itemName = `${name}[${index}]`;
    object(value, itemName, ["sourceId", "startLine", "endLine"]);
    const source = sources?.get(value.sourceId);
    const deliveredChunk = chunks.find((chunk) => (
      chunk.sourceId === value.sourceId
      && value.startLine >= chunk.startLine
      && value.endLine <= chunk.endLine
    ));
    if (!source && !deliveredChunk) {
      throw new Error(`${itemName} refers to an unknown source`);
    }
    const lineCount = Number.isSafeInteger(value.startLine)
      && Number.isSafeInteger(value.endLine)
      ? value.endLine - value.startLine + 1
      : undefined;
    if (
      !Number.isSafeInteger(value.startLine)
      || !Number.isSafeInteger(value.endLine)
      || value.startLine < 1
      || value.endLine < value.startLine
      || lineCount > LIMITS.authoredEvidenceLines
      || value.endLine > (source?.lineCount ?? deliveredChunk.endLine)
    ) {
      const range = typeof value.sourceId === "string"
        && Number.isSafeInteger(value.startLine)
        && Number.isSafeInteger(value.endLine)
        ? ` (${value.sourceId}:${value.startLine}-${value.endLine}, ${lineCount} lines; maximum ${LIMITS.authoredEvidenceLines})`
        : "";
      throw new Error(`${itemName} has an invalid line range${range}`);
    }
    if (!deliveredChunk) {
      throw new Error(`${itemName} must cite the current inspection page`);
    }
    return splitEvidenceRange(value, LIMITS.checkpointEvidenceLines);
  });
  if (evidence.length > LIMITS.checkpointEvidenceReferences) {
    throw new Error(`${name} expands to too many evidence references`);
  }
  return Object.freeze(evidence);
}

function requestKey(value) {
  return `${value.revision}\u0000${value.path}`;
}

function ledgerCounts(ledger) {
  let observations = 0;
  let requests = 0;
  for (const checkpoint of ledger.checkpoints) {
    observations += checkpoint.observations.length;
    for (const observation of checkpoint.observations) {
      requests += observation.contextRequests.length;
    }
  }
  return { observations, requests };
}

function existingRequestKeys(ledger) {
  const keys = new Set();
  for (const checkpoint of ledger.checkpoints) {
    for (const observation of checkpoint.observations) {
      for (const request of observation.contextRequests) {
        keys.add(requestKey(request));
      }
    }
  }
  return keys;
}

function evidenceKey(value) {
  return `${value.sourceId}:${value.startLine}:${value.endLine}`;
}

function evidenceExcerpt(source, evidence) {
  return source.text
    .split("\n")
    .slice(evidence.startLine - 1, evidence.endLine)
    .join("\n");
}

function validateLedgerEvidenceBudget(checkpoints, snapshot) {
  if (!snapshot) return;
  const sources = sourceMap(snapshot);
  const unique = new Map();
  for (const checkpoint of checkpoints) {
    for (const observation of checkpoint.observations) {
      for (const evidence of observation.evidence) {
        unique.set(evidenceKey(evidence), evidence);
      }
    }
  }
  let bytes = 0;
  let lines = 0;
  for (const evidence of unique.values()) {
    const source = sources.get(evidence.sourceId);
    const excerpt = evidenceExcerpt(source, evidence);
    if (
      Buffer.byteLength(excerpt, "utf8")
      > LIMITS.checkpointEvidenceExcerptBytes
    ) {
      throw new Error(
        "One Hope diff checkpoint evidence excerpt exceeds the durable ledger limit",
      );
    }
    bytes += Buffer.byteLength(excerpt, "utf8");
    lines += evidence.endLine - evidence.startLine + 1;
  }
  if (
    bytes > LIMITS.checkpointEvidenceTotalBytes
    || lines > LIMITS.checkpointEvidenceTotalLines
  ) {
    throw new Error("Hope diff checkpoint evidence exceeds the durable ledger budget");
  }
}

function validateLedgerTextBudget(checkpoints) {
  const bytes = checkpoints.reduce((total, checkpoint) => (
    total + checkpoint.observations.reduce(
      (checkpointTotal, observation) => (
        checkpointTotal + Buffer.byteLength(observation.text, "utf8")
      ),
      0,
    )
  ), 0);
  if (bytes > LIMITS.checkpointTextTotalBytes) {
    throw new Error("Hope diff checkpoint notes exceed the durable ledger budget");
  }
}

function validateContextGrounding(request, evidence, snapshot, name, page) {
  const sources = sourceMap(snapshot);
  const grounded = evidence.some((item) => (
    (
      sources
        ? evidenceExcerpt(sources.get(item.sourceId), item)
        : pageEvidenceExcerpt(page, item)
    )?.includes(request.path)
  ));
  if (!grounded) {
    throw new Error(
      `${name}.path must appear in the question's cited evidence`,
    );
  }
}

function validateBasis(basis, evidence, snapshot, name, page) {
  if (!BASIS.includes(basis) || basis === "unknown") {
    throw new Error(`${name}.basis must be stated, code, or inferred`);
  }
  if (basis === "inferred") return;
  const sources = sourceMap(snapshot);
  const chunks = currentSourceChunks(page);
  if (evidence.some((item) => {
    const kind = sources?.get(item.sourceId)?.kind
      ?? chunks.find((chunk) => chunk.sourceId === item.sourceId)?.sourceKind;
    return !SOURCE_BASIS[basis].has(kind);
  })) {
    throw new Error(`${name} uses evidence that does not match its basis`);
  }
}

export function validateDiffLedger(value, snapshot, runId) {
  object(value, "ledger", ["schemaVersion", "runId", "checkpoints"]);
  if (value.schemaVersion !== CHECKPOINT_VERSION) {
    throw new Error("Hope diff ledger version is unsupported");
  }
  if (value.runId !== runId) throw new Error("Hope diff ledger run does not match");
  const checkpoints = array(value.checkpoints, "ledger.checkpoints", 512);
  let observationNumber = 0;
  let requestNumber = 0;
  let previousGeneration = 0;
  let previousPage = 0;
  const requestKeys = new Set();
  const sources = sourceMap(snapshot);
  const normalized = checkpoints.map((checkpoint, checkpointIndex) => {
    const name = `ledger.checkpoints[${checkpointIndex}]`;
    object(checkpoint, name, [
      "generation",
      "observations",
      "page",
      "pageDigest",
      "snapshotDigest",
    ]);
    if (
      !Number.isSafeInteger(checkpoint.generation)
      || checkpoint.generation < 1
      || !Number.isSafeInteger(checkpoint.page)
      || checkpoint.page < 1
      || !/^[a-f0-9]{64}$/u.test(checkpoint.pageDigest)
      || !/^[a-f0-9]{64}$/u.test(checkpoint.snapshotDigest)
    ) {
      throw new Error(`${name} identity is invalid`);
    }
    if (checkpoint.generation === previousGeneration) {
      if (checkpoint.page !== previousPage + 1) {
        throw new Error("Hope diff ledger pages are out of order");
      }
    } else if (
      checkpoint.generation !== previousGeneration + 1
      || checkpoint.page !== 1
    ) {
      throw new Error("Hope diff ledger generations are out of order");
    }
    previousGeneration = checkpoint.generation;
    previousPage = checkpoint.page;
    const observations = array(
      checkpoint.observations,
      `${name}.observations`,
      LIMITS.checkpointObservations,
    ).map((observation, observationIndex) => {
      const observationName = `${name}.observations[${observationIndex}]`;
      object(observation, observationName, [
        "basis",
        "contextRequests",
        "evidence",
        "id",
        "kind",
        "text",
      ]);
      observationNumber += 1;
      if (observation.id !== `observation-${observationNumber}`) {
        throw new Error(`${observationName}.id is out of order`);
      }
      if (!OBSERVATION_KINDS.has(observation.kind)) {
        throw new Error(`${observationName}.kind is invalid`);
      }
      text(observation.text, `${observationName}.text`);
      const evidence = array(
        observation.evidence,
        `${observationName}.evidence`,
        LIMITS.checkpointEvidenceReferences,
        { minimum: 1 },
      );
      for (const [evidenceIndex, item] of evidence.entries()) {
        const evidenceName = `${observationName}.evidence[${evidenceIndex}]`;
        object(item, evidenceName, ["sourceId", "startLine", "endLine"]);
        const source = sources?.get(item.sourceId);
        if (
          typeof item.sourceId !== "string"
          || !/^source-[1-9][0-9]*$/u.test(item.sourceId)
          || !Number.isSafeInteger(item.startLine)
          || !Number.isSafeInteger(item.endLine)
          || item.startLine < 1
          || item.endLine < item.startLine
          || item.endLine - item.startLine + 1 > LIMITS.checkpointEvidenceLines
          || (source && item.endLine > source.lineCount)
          || (snapshot && !source)
        ) {
          throw new Error(`${evidenceName} is invalid`);
        }
      }
      validateBasis(
        observation.basis,
        evidence,
        snapshot,
        observationName,
      );
      const contextRequests = array(
        observation.contextRequests,
        `${observationName}.contextRequests`,
        4,
      );
      if (observation.kind !== "question" && contextRequests.length > 0) {
        throw new Error(`${observationName} is not a question`);
      }
      for (const [requestIndex, request] of contextRequests.entries()) {
        const requestName = `${observationName}.contextRequests[${requestIndex}]`;
        object(request, requestName, ["id", "path", "revision"]);
        requestNumber += 1;
        if (request.id !== `context-request-${requestNumber}`) {
          throw new Error(`${requestName}.id is out of order`);
        }
        validateContextPath(request.path);
        validateContextGrounding(
          request,
          evidence,
          snapshot,
          requestName,
        );
        if (!["head", "merge-base"].includes(request.revision)) {
          throw new Error(`${requestName}.revision is invalid`);
        }
        const key = requestKey(request);
        if (requestKeys.has(key)) {
          throw new Error("Hope diff ledger repeats a context request");
        }
        requestKeys.add(key);
      }
      return observation;
    });
    return Object.freeze({ ...checkpoint, observations: Object.freeze(observations) });
  });
  if (observationNumber > LIMITS.checkpointTotalObservations) {
    throw new Error("Hope diff ledger has too many observations");
  }
  if (requestNumber > LIMITS.checkpointTotalRequests) {
    throw new Error("Hope diff ledger has too many context requests");
  }
  validateLedgerTextBudget(normalized);
  validateLedgerEvidenceBudget(normalized, snapshot);
  return Object.freeze({
    checkpoints: Object.freeze(normalized),
    runId,
    schemaVersion: CHECKPOINT_VERSION,
  });
}

export function createDiffCheckpoint(input, {
  generation,
  ledger,
  ledgerState,
  page,
  pageDigest,
  pageValue,
  runId,
  snapshot,
  snapshotDigest = snapshot?.digest,
}) {
  object(input, "checkpoint", [
    "generation",
    "observations",
    "page",
    "runId",
    "schemaVersion",
    "snapshotDigest",
  ]);
  if (
    input.schemaVersion !== CHECKPOINT_VERSION
    || input.runId !== runId
    || input.snapshotDigest !== snapshotDigest
    || input.generation !== generation
    || input.page !== page
  ) {
    throw new Error("Hope diff checkpoint identity does not match the current page");
  }
  const counts = ledgerState ?? ledgerCounts(ledger);
  const keys = new Set(
    ledgerState?.requestKeys ?? existingRequestKeys(ledger),
  );
  let observationNumber = counts.observations;
  let requestNumber = counts.requests;
  const observations = array(
    input.observations,
    "checkpoint.observations",
    LIMITS.checkpointObservations,
  ).map((observation, index) => {
    const name = `checkpoint.observations[${index}]`;
    object(observation, name, [
      "basis",
      "contextRequests",
      "evidence",
      "kind",
      "text",
    ]);
    if (!OBSERVATION_KINDS.has(observation.kind)) {
      throw new Error(`${name}.kind is invalid`);
    }
    const evidence = validateEvidence(
      observation.evidence,
      `${name}.evidence`,
      snapshot,
      pageValue,
    );
    validateBasis(observation.basis, evidence, snapshot, name, pageValue);
    const contextRequests = array(
      observation.contextRequests,
      `${name}.contextRequests`,
      4,
    ).map((request, requestIndex) => {
      const requestName = `${name}.contextRequests[${requestIndex}]`;
      object(request, requestName, ["path", "revision"]);
      const normalized = {
        path: validateContextPath(request.path),
        revision: request.revision,
      };
      if (!["head", "merge-base"].includes(normalized.revision)) {
        throw new Error(`${requestName}.revision is invalid`);
      }
      validateContextGrounding(
        normalized,
        evidence,
        snapshot,
        requestName,
        pageValue,
      );
      const key = requestKey(normalized);
      if (keys.has(key)) {
        throw new Error(`${requestName} repeats an existing context request`);
      }
      keys.add(key);
      requestNumber += 1;
      return Object.freeze({
        id: `context-request-${requestNumber}`,
        ...normalized,
      });
    });
    if (observation.kind !== "question" && contextRequests.length > 0) {
      throw new Error(`${name} is not a question`);
    }
    observationNumber += 1;
    return Object.freeze({
      basis: observation.basis,
      contextRequests: Object.freeze(contextRequests),
      evidence,
      id: `observation-${observationNumber}`,
      kind: observation.kind,
      text: text(observation.text, `${name}.text`),
    });
  });
  if (observationNumber > LIMITS.checkpointTotalObservations) {
    throw new Error("Hope diff ledger would contain too many observations");
  }
  if (requestNumber > LIMITS.checkpointTotalRequests) {
    throw new Error("Hope diff ledger would contain too many context requests");
  }
  const checkpoint = Object.freeze({
    generation,
    observations: Object.freeze(observations),
    page,
    pageDigest,
    snapshotDigest,
  });
  if (ledgerState) {
    const addedTextBytes = observations.reduce(
      (sum, observation) => sum + Buffer.byteLength(observation.text, "utf8"),
      0,
    );
    let addedEvidenceBytes = 0;
    let addedEvidenceLines = 0;
    for (const observation of observations) {
      for (const evidence of observation.evidence) {
        const excerpt = pageEvidenceExcerpt(pageValue, evidence);
        if (
          excerpt === undefined
          || Buffer.byteLength(excerpt, "utf8")
            > LIMITS.checkpointEvidenceExcerptBytes
        ) {
          throw new Error(
            "One Hope diff checkpoint evidence excerpt exceeds the durable ledger limit",
          );
        }
        addedEvidenceBytes += Buffer.byteLength(excerpt, "utf8");
        addedEvidenceLines += evidence.endLine - evidence.startLine + 1;
      }
    }
    if (
      ledgerState.textBytes + addedTextBytes > LIMITS.checkpointTextTotalBytes
      || ledgerState.evidenceBytes + addedEvidenceBytes
        > LIMITS.checkpointEvidenceTotalBytes
      || ledgerState.evidenceLines + addedEvidenceLines
        > LIMITS.checkpointEvidenceTotalLines
    ) {
      throw new Error("Hope diff checkpoint exceeds the durable ledger budget");
    }
  } else {
    validateLedgerTextBudget([...ledger.checkpoints, checkpoint]);
    validateLedgerEvidenceBudget(
      [...ledger.checkpoints, checkpoint],
      snapshot,
    );
  }
  return checkpoint;
}

export function checkpointCount(ledger, generation) {
  return ledger.checkpoints.filter(
    (checkpoint) => checkpoint.generation === generation,
  ).length;
}

function requestCollected(snapshot, request) {
  const revision = request.revision === "head"
    ? snapshot.snapshot.head
    : snapshot.snapshot.mergeBase;
  return snapshot.sources.some((source) => (
    source.kind === "context-file"
    && source.path === request.path
    && source.revision === revision
  )) || snapshot.limits.some((limit) => (
    limit.kind === "context-unavailable"
    && limit.subject === request.path
    && limit.revision === revision
  ));
}

export function pendingContextRequests(ledger, snapshot) {
  const requests = [];
  for (const checkpoint of ledger.checkpoints) {
    for (const observation of checkpoint.observations) {
      for (const request of observation.contextRequests) {
        if (!requestCollected(snapshot, request)) {
          requests.push(Object.freeze({
            ...request,
            observationId: observation.id,
            question: observation.text,
          }));
        }
      }
    }
  }
  return Object.freeze(requests);
}

export function resolveContextRequestIds(ledger, snapshot, requestIds) {
  const pending = new Map(
    pendingContextRequests(ledger, snapshot).map((request) => [request.id, request]),
  );
  const ids = array(
    requestIds,
    "context request IDs",
    LIMITS.contextFiles,
    { minimum: 1 },
  );
  if (new Set(ids).size !== ids.length) {
    throw new Error("Hope diff context request IDs must be unique");
  }
  return Object.freeze(ids.map((id) => {
    const request = pending.get(id);
    if (!request) {
      throw new Error(`Hope diff context request is unknown or already collected: ${id}`);
    }
    return Object.freeze({
      path: request.path,
      revision: request.revision,
    });
  }));
}

function ledgerCoverage(ledger) {
  const generations = [];
  let emptyCheckpoints = 0;
  for (const checkpoint of ledger.checkpoints) {
    if (checkpoint.observations.length === 0) emptyCheckpoints += 1;
    let generation = generations.at(-1);
    if (!generation || generation.generation !== checkpoint.generation) {
      generation = {
        firstPage: checkpoint.page,
        generation: checkpoint.generation,
        lastPage: checkpoint.page,
        pageCount: 0,
        snapshotDigest: checkpoint.snapshotDigest,
      };
      generations.push(generation);
    }
    generation.lastPage = checkpoint.page;
    generation.pageCount += 1;
  }
  return Object.freeze({
    checkpointCount: ledger.checkpoints.length,
    emptyCheckpointCount: emptyCheckpoints,
    generations: Object.freeze(generations.map((value) => Object.freeze(value))),
    observationCheckpointCount: ledger.checkpoints.length - emptyCheckpoints,
  });
}

function reviewContextGroups(snapshot) {
  const fileLimits = new Map(snapshot.limits
    .filter((limit) => limit.kind === "file-unavailable")
    .map((limit) => [limit.subject, limit]));
  const matchedLimitIds = new Set();
  const groups = [[{
    kind: "review-context",
    value: Object.freeze({
      kind: "overview",
      pullRequest: snapshot.pullRequest,
      repository: snapshot.repository,
      settings: snapshot.settings,
      snapshot: snapshot.snapshot,
    }),
  }]];
  for (const file of snapshot.files) {
    if (file.bodyState === "included") {
      groups.push([{
        kind: "review-context",
        value: Object.freeze({
          file: Object.freeze({
            additions: file.additions,
            deletions: file.deletions,
            id: file.id,
            path: file.path,
            previousPath: file.previousPath,
            providerStatus: file.providerStatus,
            sourceIds: file.sourceIds,
          }),
          kind: "classifiable-file",
        }),
      }]);
    } else {
      const limit = fileLimits.get(file.path);
      const group = [{
        kind: "review-context",
        value: Object.freeze({
          file: Object.freeze(limit ? {
            bodyState: file.bodyState,
            id: file.id,
            limitId: limit.id,
            previousPath: file.previousPath,
            providerStatus: file.providerStatus,
          } : {
            bodyReason: file.bodyReason,
            bodyReasonKind: file.bodyReasonKind,
            bodyState: file.bodyState,
            id: file.id,
            path: file.path,
            previousPath: file.previousPath,
            providerStatus: file.providerStatus,
          }),
          kind: "automatic-file",
        }),
      }];
      if (limit) {
        matchedLimitIds.add(limit.id);
        group.push({
          kind: "review-context",
          value: Object.freeze({ kind: "limit", limit }),
        });
      }
      groups.push(group);
    }
  }
  for (const limit of snapshot.limits) {
    if (matchedLimitIds.has(limit.id)) continue;
    groups.push([{
      kind: "review-context",
      value: Object.freeze({ kind: "limit", limit }),
    }]);
  }
  return groups;
}

function reviewNote(checkpoint, observation) {
  return Object.freeze({
    ...observation,
    generation: checkpoint.generation,
    page: checkpoint.page,
    pageDigest: checkpoint.pageDigest,
    snapshotDigest: checkpoint.snapshotDigest,
  });
}

function ledgerPageEnvelope(ledger, snapshot, page, totalPages, entries) {
  return {
    contentIsUntrusted: true,
    coverage: ledgerCoverage(ledger),
    evidenceExcerpts: entries
      .filter((entry) => entry.kind === "evidence-excerpt")
      .map((entry) => entry.value),
    notes: entries
      .filter((entry) => entry.kind === "note")
      .map((entry) => entry.value),
    page,
    pendingContextRequests: entries
      .filter((entry) => entry.kind === "pending-context-request")
      .map((entry) => entry.value),
    reviewContext: entries
      .filter((entry) => entry.kind === "review-context")
      .map((entry) => entry.value),
    runId: ledger.runId,
    schemaVersion: ledger.schemaVersion,
    snapshotDigest: snapshot.digest,
    totalPages,
    warning: "Checkpoint notes are model-authored memory aids. Hope extracted the cited evidence excerpts from the bound snapshot; verify final claims against those excerpts.",
  };
}

function dedupeLedgerEvidence(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (entry.kind !== "evidence-excerpt") return true;
    if (seen.has(entry.value.key)) return false;
    seen.add(entry.value.key);
    return true;
  });
}

function ledgerEnvelopeBytes(ledger, snapshot, entries) {
  return Buffer.byteLength(JSON.stringify(
    ledgerPageEnvelope(ledger, snapshot, 1, 1, entries),
  ), "utf8");
}

function paginateLedgerEntryGroups(ledger, snapshot, groups) {
  const pages = [];
  let current = [];
  for (const group of groups) {
    const candidate = dedupeLedgerEvidence([...current, ...group]);
    if (
      ledgerEnvelopeBytes(ledger, snapshot, candidate)
      <= LIMITS.ledgerPageBytes
    ) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      pages.push(current);
      current = [];
    }
    const standalone = dedupeLedgerEvidence(group);
    if (
      ledgerEnvelopeBytes(ledger, snapshot, standalone)
      <= LIMITS.ledgerPageBytes
    ) {
      current = standalone;
      continue;
    }
    for (const entry of standalone) {
      const partial = dedupeLedgerEvidence([...current, entry]);
      if (
        current.length > 0
        && ledgerEnvelopeBytes(ledger, snapshot, partial) > LIMITS.ledgerPageBytes
      ) {
        pages.push(current);
        current = [entry];
      } else {
        current = partial;
      }
      if (
        ledgerEnvelopeBytes(ledger, snapshot, current)
        > LIMITS.ledgerPageBytes
      ) {
        throw new Error("One Hope diff ledger entry exceeds the page limit");
      }
    }
  }
  if (current.length > 0 || pages.length === 0) pages.push(current);
  return pages;
}

export function diffLedgerView(ledger, snapshot, { page = 1 } = {}) {
  const pending = pendingContextRequests(ledger, snapshot);
  const sources = sourceMap(snapshot);
  const groups = reviewContextGroups(snapshot);
  for (const checkpoint of ledger.checkpoints) {
    if (checkpoint.observations.length === 0) continue;
    for (const observation of checkpoint.observations) {
      const entries = [{
        kind: "note",
        value: reviewNote(checkpoint, observation),
      }];
      for (const evidence of observation.evidence) {
        const key = evidenceKey(evidence);
        const source = sources.get(evidence.sourceId);
        entries.push({
          kind: "evidence-excerpt",
          value: Object.freeze({
            ...evidence,
            fileId: source.fileId,
            key,
            path: source.path,
            revision: source.revision,
            sourceKind: source.kind,
            text: evidenceExcerpt(source, evidence),
          }),
        });
      }
      groups.push(entries);
    }
  }
  groups.push(...pending.map((value) => [{
    kind: "pending-context-request",
    value,
  }]));
  const pages = paginateLedgerEntryGroups(ledger, snapshot, groups);
  const outputBytes = pages.reduce((sum, values, index) => (
    sum + Buffer.byteLength(JSON.stringify(
      ledgerPageEnvelope(
        ledger,
        snapshot,
        index + 1,
        pages.length,
        values,
      ),
    ), "utf8")
  ), 0);
  if (outputBytes > LIMITS.ledgerBytes) {
    throw new Error("Hope diff ledger exceeds its total output limit");
  }
  if (!Number.isSafeInteger(page) || page < 1 || page > pages.length) {
    throw new RangeError(`Ledger page must be from 1 to ${pages.length}`);
  }
  return Object.freeze(
    ledgerPageEnvelope(ledger, snapshot, page, pages.length, pages[page - 1]),
  );
}
