import { digest, indexChanges, LIMITS, restriction, safePath, text } from "./changes.mjs";
import { parseTarget } from "./github.mjs";

const shaPattern = /^[a-f0-9]{40}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const repositoryPattern = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u;
const reasons = new Set([
  "private-file", "credential", "repository-unavailable", "source-unavailable", "special-entry",
  "size-limit", "binary", "no-text-diff", "rename-only", "patch-incomplete",
]);

function record(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

function array(value, name, maximum) {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError(`${name} must have at most ${maximum} entries`);
  return value;
}

function natural(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative integer`);
  return value;
}

export function validateSources(values) {
  const sources = array(values, "sources", 32).map((source) => {
    record(source, "source");
    if (!/^(?:pr-description|s-[a-f0-9]{20})$/u.test(source.id)
      || source.kind !== "statement"
      || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:issues|pull)\/[1-9][0-9]*$/u.test(source.url)) {
      throw new Error("Invalid rationale source identity or location");
    }
    const body = text(source.text, "source text", LIMITS.sourceBytes);
    if (Buffer.byteLength(body) > LIMITS.sourceBytes || restriction("statement", [body])) {
      throw new Error("Rationale source exceeds a size or content boundary");
    }
    return { id: source.id, kind: source.kind, label: text(source.label, "source label", 120), url: source.url, text: body };
  });
  if (new Set(sources.map((source) => source.id)).size !== sources.length) throw new Error("Duplicate rationale sources");
  return sources;
}

export function validateSnapshot(value) {
  record(value, "snapshot");
  if (value.schemaVersion !== 1 || !digestPattern.test(value.id)
    || ![value.base, value.head, value.mergeBase].every((sha) => shaPattern.test(sha))
    || !repositoryPattern.test(value.baseRepository)
    || (value.headRepository !== null && !repositoryPattern.test(value.headRepository))) {
    throw new Error("Invalid snapshot version, digest, or revision");
  }
  const target = parseTarget(value.target?.url);
  let totalBytes = 0;
  let changedLines = 0;
  const baseFiles = array(value.files, "files", LIMITS.files).map((file) => {
    const path = safePath(file.path);
    const previousPath = file.previousPath === undefined ? undefined : safePath(file.previousPath);
    if (!["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"].includes(file.status)
      || !["text", "metadata", "unavailable"].includes(file.availability)) throw new Error("Invalid changed-file state");
    const additions = natural(file.additions, "additions");
    const deletions = natural(file.deletions, "deletions");
    changedLines += additions + deletions;
    const result = { path, ...(previousPath ? { previousPath } : {}), status: file.status, additions, deletions,
      availability: file.availability };
    if (file.availability === "text") {
      if (typeof file.patch !== "string" || restriction(path, [file.patch]) || restriction(previousPath ?? path, [file.patch])) {
        throw new Error("Invalid or restricted patch");
      }
      result.patch = file.patch;
      totalBytes += Buffer.byteLength(file.patch);
    } else {
      if (!reasons.has(file.reason)) throw new Error("Invalid unavailable-file reason");
      result.reason = file.reason;
      if (file.availability === "metadata" && (additions + deletions > 0 || file.reason !== "rename-only")) {
        throw new Error("Metadata-only files cannot hide reported changed lines");
      }
    }
    return result;
  });
  if (changedLines > LIMITS.lines || totalBytes > LIMITS.totalBytes) throw new Error("Snapshot exceeds the capture limits");
  const inventory = indexChanges(baseFiles);
  const core = { target, base: value.base, head: value.head, mergeBase: value.mergeBase,
    baseRepository: value.baseRepository, headRepository: value.headRepository, files: inventory.files };
  if (digest(core) !== value.id) throw new Error("Snapshot digest does not match its changes");
  if (JSON.stringify(inventory.changes) !== JSON.stringify(value.changes)) throw new Error("Snapshot change inventory was modified");
  if (typeof value.capturedAt !== "string" || !Number.isFinite(Date.parse(value.capturedAt))) throw new Error("Invalid capture date");
  return { schemaVersion: 1, id: value.id, ...core, changes: inventory.changes,
    title: text(value.title, "PR title", 4_000), capturedAt: value.capturedAt, sources: validateSources(value.sources) };
}

export function evidenceSources(snapshot) {
  return new Map([
    ...snapshot.sources.map((source) => [source.id, source]),
    ...snapshot.files.filter((file) => file.availability === "text" && file.patch).map((file) => [file.id, {
      id: file.id, kind: "code", label: file.path, text: file.patch,
      url: `https://github.com/${file.status === "removed" ? snapshot.baseRepository : snapshot.headRepository ?? snapshot.baseRepository}`
        + `/blob/${file.status === "removed" ? snapshot.mergeBase : snapshot.head}/`
        + (file.status === "removed" ? file.previousPath ?? file.path : file.path).split("/").map(encodeURIComponent).join("/"),
    }]),
  ]);
}

export function validateExplanation(value, snapshot) {
  record(value, "explanation");
  const allowed = new Set(["changeId", "title", "why", "basis", "effects", "evidence"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("Unsupported explanation field");
  const change = snapshot.changes.find((item) => item.id === value.changeId);
  if (!change) throw new Error("Explanation refers to an unknown change");
  if (!["stated", "inferred", "unknown"].includes(value.basis)) throw new Error("Invalid explanation basis");
  const sources = evidenceSources(snapshot);
  const evidence = array(value.evidence ?? [], "evidence", 6).map((reference) => {
    const source = sources.get(reference.sourceId);
    if (!source || !Number.isSafeInteger(reference.startLine) || !Number.isSafeInteger(reference.endLine)
      || reference.startLine < 1 || reference.endLine < reference.startLine
      || reference.endLine > source.text.split("\n").length
      || reference.endLine - reference.startLine >= 40) throw new Error("Invalid explanation evidence range");
    return { sourceId: source.id, startLine: reference.startLine, endLine: reference.endLine };
  });
  if (value.basis === "stated" && !evidence.some((entry) => sources.get(entry.sourceId).kind === "statement")) {
    throw new Error("A stated reason needs a captured statement, not code alone");
  }
  if (change.kind === "unavailable" && value.basis === "inferred") {
    throw new Error("Do not infer a code reason from unavailable content");
  }
  const result = { changeId: change.id, title: text(value.title, "reason title", 120),
    why: text(value.why, "reason", 1_600), basis: value.basis,
    effects: array(value.effects ?? [], "effects", 3).map((effect) => text(effect, "effect", 400)), evidence };
  if (restriction("explanation", [JSON.stringify(result)])) throw new Error("Explanation contains restricted content");
  return result;
}

export function validateDocument(value) {
  record(value, "document");
  if (value.schemaVersion !== 1 || !["en-US", "ko-KR"].includes(value.locale)
    || !["light", "dark", "system"].includes(value.theme)) throw new Error("Invalid document settings");
  const snapshot = validateSnapshot(value.snapshot);
  const explanations = array(value.explanations, "explanations", snapshot.changes.length).map((entry) => validateExplanation(entry, snapshot));
  if (new Set(explanations.map((entry) => entry.changeId)).size !== explanations.length) throw new Error("Duplicate explanations");
  return { schemaVersion: 1, snapshot, locale: value.locale, theme: value.theme,
    revision: natural(value.revision, "document revision"), explanations };
}

export function mergeExplanations(document, input) {
  record(input, "input");
  if (input.snapshotId !== document.snapshot.id) throw new Error("Explanation input belongs to a different snapshot");
  const replacements = array(input.explanations, "explanations", document.snapshot.changes.length).map(
    (entry) => validateExplanation(entry, document.snapshot),
  );
  if (new Set(replacements.map((entry) => entry.changeId)).size !== replacements.length) throw new Error("Repeated explanation change ID");
  const all = new Map(document.explanations.map((entry) => [entry.changeId, entry]));
  for (const entry of replacements) all.set(entry.changeId, entry);
  return validateDocument({ ...document, revision: document.revision + 1,
    explanations: document.snapshot.changes.filter((entry) => all.has(entry.id)).map((entry) => all.get(entry.id)) });
}

export function inspectDocument(document, { changeId, fileId, offset = 0 } = {}) {
  natural(offset, "offset");
  if (changeId && !document.snapshot.changes.some((change) => change.id === changeId)) throw new Error("Unknown change ID");
  if (fileId && !document.snapshot.files.some((file) => file.id === fileId || file.path === fileId)) throw new Error("Unknown file ID or path");
  const candidates = document.snapshot.changes.filter((change) => (
    (!changeId || change.id === changeId)
    && (!fileId || change.fileId === fileId || document.snapshot.files.find((file) => file.id === change.fileId).path === fileId)
  ));
  const changes = [];
  let bytes = 0;
  for (const change of candidates.slice(offset)) {
    const file = document.snapshot.files.find((entry) => entry.id === change.fileId);
    const rows = change.kind === "text"
      ? file.hunks[change.hunkIndex].rows.slice(Math.max(0, change.startRow - 3), change.endRow + 4)
      : [];
    const value = { ...change, path: file.path, previousPath: file.previousPath,
      availability: file.availability, reason: file.reason, rows,
      explanation: document.explanations.find((entry) => entry.changeId === change.id) ?? null };
    const size = Buffer.byteLength(JSON.stringify(value));
    if (changes.length > 0 && bytes + size > 48 * 1024) break;
    changes.push(value);
    bytes += size;
    if (changes.length >= 12) break;
  }
  return { contentIsUntrusted: true, snapshotId: document.snapshot.id, head: document.snapshot.head,
    target: document.snapshot.target.url, locale: document.locale,
    files: document.snapshot.files.map(({ id, path, availability, changeIds }) => ({ id, path, availability, changeIds })),
    sources: document.snapshot.sources, changes,
    nextOffset: offset + changes.length < candidates.length ? offset + changes.length : null };
}
