import { digest, identifyFiles, LIMITS, parsePatch, restriction, safePath, text } from "./changes.mjs";
import { buildLayout } from "./layout.mjs";
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

function array(value, name, maximum = Infinity) {
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
    return { id: source.id, kind: source.kind, label: text(source.label, "source label"), url: source.url, text: body };
  });
  if (new Set(sources.map((source) => source.id)).size !== sources.length) throw new Error("Duplicate rationale sources");
  return sources;
}

export function validateSnapshot(value) {
  record(value, "snapshot");
  if (value.schemaVersion !== 2 || !digestPattern.test(value.id)
    || ![value.base, value.head, value.mergeBase].every((sha) => shaPattern.test(sha))
    || !repositoryPattern.test(value.baseRepository)
    || (value.headRepository !== null && !repositoryPattern.test(value.headRepository))) {
    throw new Error("Invalid snapshot version, digest, or revision");
  }
  const target = parseTarget(value.target?.url);
  let totalBytes = 0;
  let changedLines = 0;
  const files = identifyFiles(array(value.files, "files", LIMITS.files).map((file) => {
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
      parsePatch(file.patch, file);
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
  }));
  if (changedLines > LIMITS.lines || totalBytes > LIMITS.totalBytes) throw new Error("Snapshot exceeds the capture limits");
  if (files.some((file, index) => file.id !== value.files[index].id)) throw new Error("Snapshot file identity was modified");
  const core = { target, base: value.base, head: value.head, mergeBase: value.mergeBase,
    baseRepository: value.baseRepository, headRepository: value.headRepository, files };
  if (digest(core) !== value.id) throw new Error("Snapshot digest does not match its files");
  if (typeof value.capturedAt !== "string" || !Number.isFinite(Date.parse(value.capturedAt))) throw new Error("Invalid capture date");
  return { schemaVersion: 2, id: value.id, ...core,
    title: text(value.title, "PR title"), capturedAt: value.capturedAt, sources: validateSources(value.sources) };
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

function explanationContext(snapshot) {
  return { files: new Set(snapshot.files.map((file) => file.id)), sources: new Map(
    [...evidenceSources(snapshot)].map(([id, source]) => [id, { kind: source.kind, lines: source.text.split("\n").length }]),
  ) };
}

function validateGroups(values, snapshot) {
  const context = explanationContext(snapshot);
  const entries = array(values, "groups", LIMITS.lines + LIMITS.files).map((value) => {
    record(value, "group");
    if (Object.keys(value).some((key) => !["id", "parts", "title", "why", "basis", "evidence"].includes(key))) {
      throw new Error("Unsupported group field");
    }
    if (typeof value.id !== "string" || !/^g-[a-z0-9][a-z0-9-]{0,63}$/u.test(value.id)) throw new Error("Invalid group ID");
    const parts = array(value.parts, "parts", LIMITS.lines + LIMITS.files).map((part) => {
      record(part, "group part");
      if (Object.keys(part).some((key) => !["fileId", "startLine", "endLine", "note"].includes(key))
        || !context.files.has(part.fileId)) throw new Error("Invalid group part or unknown file");
      const range = part.startLine !== undefined || part.endLine !== undefined;
      if (range && (!Number.isSafeInteger(part.startLine) || !Number.isSafeInteger(part.endLine))) throw new Error("Invalid group code range");
      return { fileId: part.fileId, ...(range ? { startLine: part.startLine, endLine: part.endLine } : {}),
        ...(part.note === undefined ? {} : { note: text(part.note, "part note", LIMITS.inputBytes) }) };
    });
    if (!parts.length) throw new Error("A group needs changed code or file metadata");
    if (!["stated", "inferred", "unknown"].includes(value.basis)) throw new Error("Invalid explanation basis");
    const evidence = array(value.evidence ?? [], "evidence").map((reference) => {
      const source = context.sources.get(reference.sourceId);
      if (!source || !Number.isSafeInteger(reference.startLine) || !Number.isSafeInteger(reference.endLine)
        || reference.startLine < 1 || reference.endLine < reference.startLine
        || reference.endLine > source.lines) throw new Error("Invalid explanation evidence range");
      return { sourceId: reference.sourceId, startLine: reference.startLine, endLine: reference.endLine };
    });
    if (value.basis === "stated" && !evidence.some((entry) => context.sources.get(entry.sourceId).kind === "statement")) {
      throw new Error("A stated reason needs a captured statement, not code alone");
    }
    const result = { id: value.id, parts, title: text(value.title, "reason title", LIMITS.inputBytes),
      why: text(value.why, "reason", LIMITS.inputBytes), basis: value.basis, evidence };
    if (restriction("explanation", [JSON.stringify(result)])) throw new Error("Explanation contains restricted content");
    return result;
  });
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Duplicate group IDs");
  buildLayout(snapshot, entries);
  return entries;
}

/** Validate external documents once; internal transforms preserve this contract. */
export function validateDocument(value) {
  record(value, "document");
  if ([1, 2].includes(value.schemaVersion)) throw new Error("This is an older reader. Keep it and capture a new grouped reader.");
  if (value.schemaVersion !== 3 || !["en-US", "ko-KR"].includes(value.locale)
    || !["light", "dark", "system"].includes(value.theme)) throw new Error("Invalid document settings");
  const snapshot = validateSnapshot(value.snapshot);
  return { schemaVersion: 3, snapshot, locale: value.locale, theme: value.theme,
    revision: natural(value.revision, "document revision"), groups: validateGroups(value.groups, snapshot) };
}

export function replaceGroups(document, input) {
  record(input, "input");
  if (input.snapshotId !== document.snapshot.id) throw new Error("Explanation input belongs to a different snapshot");
  const groups = validateGroups(input.groups, document.snapshot);
  return { ...document, revision: document.revision + 1, groups };
}

export function inspectDocument(document, { fileId, offset = 0 } = {}) {
  natural(offset, "offset");
  const candidates = document.snapshot.files.filter((file) => !fileId || file.id === fileId || file.path === fileId);
  if (fileId && candidates.length === 0) throw new Error("Unknown file ID or path");
  const files = [];
  let bytes = 0;
  for (const file of candidates.slice(offset)) {
    const value = file;
    const size = Buffer.byteLength(JSON.stringify(value));
    if (files.length > 0 && bytes + size > 48 * 1024) break;
    files.push(value);
    bytes += size;
  }
  return { contentIsUntrusted: true, locale: document.locale, files,
    ...(offset === 0 ? { sources: document.snapshot.sources, groups: document.groups } : {}),
    nextOffset: offset + files.length < candidates.length ? offset + files.length : null };
}
