import { LIMITS } from "./constants.mjs";
import { readGitHubContent } from "./github.mjs";
import { digestJson } from "./hash.mjs";
import { redactionKind } from "./redact.mjs";
import { containsBidiControl, unavailableReason } from "./text.mjs";

const revisionKinds = new Set(["head", "merge-base"]);
const gitIdentifier = /^[A-Za-z0-9_.-]+$/u;

export function validateContextPath(value) {
  if (
    typeof value !== "string"
    || value.length === 0
    || Buffer.byteLength(JSON.stringify(value), "utf8") > LIMITS.contextPathJsonBytes
    || value.startsWith("/")
    || /^[A-Za-z]:/u.test(value)
    || value.includes("\\")
    || containsBidiControl(value)
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error("Hope context needs a normal repository-relative path");
  }
  if (value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Hope context needs a normal repository-relative path");
  }
  return value;
}

function validateRevision(snapshot, kind) {
  const revision = kind === "head" ? snapshot?.snapshot?.head : snapshot?.snapshot?.mergeBase;
  if (typeof revision !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/iu.test(revision)) {
    throw new Error(`Hope context needs an immutable ${kind} revision`);
  }
  return revision;
}

/** Validate requested paths before any source is read; each pair must be new to this run. */
export function validateContextRequests(snapshot, requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new TypeError("Hope context needs at least one --path and --revision pair");
  }
  const existing = new Set([
    ...snapshot.sources.filter((source) => source.kind === "context-file")
      .map((source) => `${source.revision}\u0000${source.path}`),
    ...snapshot.limits.filter((limit) => limit.kind === "context-unavailable")
      .map((limit) => `${limit.revision}\u0000${limit.subject}`),
  ]);
  if (existing.size + requests.length > LIMITS.contextFiles) {
    throw new Error(`Hope diff supports ${LIMITS.contextFiles} context file requests per run`);
  }
  const seen = new Set();
  return Object.freeze(requests.map((request) => {
    const path = validateContextPath(request?.path);
    if (!revisionKinds.has(request?.revision)) {
      throw new Error("Hope context revision must be head or merge-base");
    }
    const revision = validateRevision(snapshot, request.revision);
    const key = `${revision}\u0000${path}`;
    if (existing.has(key)) throw new Error(`Hope already collected this exact context file: ${path}`);
    if (seen.has(key)) throw new Error("Hope context requests must be unique");
    seen.add(key);
    return Object.freeze({ path, revision, revisionKind: request.revision });
  }));
}

function unavailable(path, revision, reasonKind, reason) {
  return Object.freeze({ kind: "context-unavailable", path, reason, reasonKind, revision });
}

/**
 * Collect validated requests through a source adapter. The adapter reads one
 * file and returns { state: "text", text }, { state: "not-found" }, or an
 * unavailable state with reason and reasonKind. Redaction and budgets stay here.
 */
export async function collectContext(snapshot, requests, { readSource }) {
  const values = validateContextRequests(snapshot, requests);
  let total = snapshot.sources.filter((source) => source.kind === "context-file")
    .reduce((sum, source) => sum + Buffer.byteLength(source.text, "utf8"), 0);
  const collected = [];
  for (const { path, revision, revisionKind } of values) {
    const privateKind = redactionKind(path, []);
    if (privateKind) {
      collected.push(unavailable(path, revision, privateKind, unavailableReason(privateKind)));
      continue;
    }
    const content = await readSource({ path, revision, revisionKind });
    if (content.state === "not-found") {
      collected.push(unavailable(path, revision, "not-found", "The path was not found at the captured revision"));
      continue;
    }
    if (content.state !== "text") {
      collected.push(unavailable(path, revision, content.reasonKind, content.reason));
      continue;
    }
    const redaction = redactionKind(path, [content.text]);
    if (redaction) {
      collected.push(unavailable(path, revision, redaction, unavailableReason(redaction)));
      continue;
    }
    const bytes = Buffer.byteLength(content.text, "utf8");
    if (total + bytes > LIMITS.contextBodyTotalBytes) {
      collected.push(unavailable(
        path,
        revision,
        "safe-total-limit",
        `Context text exceeds Hope's ${LIMITS.contextBodyTotalBytes}-byte total limit`,
      ));
      continue;
    }
    total += bytes;
    collected.push(Object.freeze({ kind: "context-file", path, revision, text: content.text }));
  }
  return Object.freeze(collected);
}

function githubRepository(snapshot, revisionKind) {
  const repository = snapshot.repository;
  const candidate = (revisionKind === "head" ? repository?.head : repository?.base) ?? repository;
  if (
    repository?.provider !== "github"
    || !gitIdentifier.test(candidate?.owner ?? "")
    || !gitIdentifier.test(candidate?.name ?? "")
    || [candidate.owner, candidate.name].some((part) => part === "." || part === "..")
  ) {
    throw new Error("Hope context needs a valid GitHub snapshot repository");
  }
  return candidate;
}

export function githubContextSource(snapshot, { gh } = {}) {
  const options = gh ? { exec: gh } : {};
  return async ({ path, revision, revisionKind }) => {
    const { owner, name } = githubRepository(snapshot, revisionKind);
    try {
      return await readGitHubContent(owner, name, path, revision, options);
    } catch (error) {
      if (error?.githubStatus === 404) return { state: "not-found" };
      throw error;
    }
  };
}

/** Append collected context as new sources and limits, and recompute the digest. */
export function snapshotWithContext(snapshot, candidates) {
  const sources = [...snapshot.sources];
  const limits = [...snapshot.limits];
  for (const candidate of candidates) {
    if (candidate.kind === "context-file") {
      sources.push(Object.freeze({
        id: `source-${sources.length + 1}`,
        kind: candidate.kind,
        lineCount: candidate.text.split("\n").length,
        path: candidate.path,
        revision: candidate.revision,
        text: candidate.text,
      }));
    } else {
      limits.push(Object.freeze({
        id: `limit-${limits.length + 1}`,
        kind: candidate.kind,
        reason: candidate.reason,
        reasonKind: candidate.reasonKind,
        revision: candidate.revision,
        subject: candidate.path,
      }));
    }
  }
  const { digest: _digest, ...previous } = snapshot;
  const value = { ...previous, limits, sources };
  return Object.freeze({ ...value, digest: digestJson(value) });
}
