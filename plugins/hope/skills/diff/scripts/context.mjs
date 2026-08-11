import { LIMITS } from "./constants.mjs";
import {
  githubUnavailableReason,
  readGitHubContent,
} from "./github.mjs";
import { redactionKind } from "./redact.mjs";
import { containsBidiControl } from "./text.mjs";

const revisionKinds = new Set(["head", "merge-base"]);

function validateRepository(snapshot) {
  const repository = snapshot?.repository;
  if (
    repository?.provider !== "github"
    || typeof repository.owner !== "string"
    || typeof repository.name !== "string"
    || !/^[A-Za-z0-9_.-]+$/u.test(repository.owner)
    || !/^[A-Za-z0-9_.-]+$/u.test(repository.name)
    || [repository.owner, repository.name].includes(".")
    || [repository.owner, repository.name].includes("..")
  ) {
    throw new Error("Hope context needs a valid GitHub snapshot repository");
  }
  const nested = (value, name) => {
    const candidate = value ?? repository;
    if (
      typeof candidate.owner !== "string"
      || typeof candidate.name !== "string"
      || !/^[A-Za-z0-9_.-]+$/u.test(candidate.owner)
      || !/^[A-Za-z0-9_.-]+$/u.test(candidate.name)
      || [candidate.owner, candidate.name].includes(".")
      || [candidate.owner, candidate.name].includes("..")
    ) {
      throw new Error(`Hope context needs a valid GitHub ${name} repository`);
    }
    return Object.freeze({ name: candidate.name, owner: candidate.owner });
  };
  return Object.freeze({
    base: nested(repository.base, "base"),
    head: nested(repository.head, "head"),
  });
}

function validateRevision(snapshot, kind) {
  const revision = kind === "head"
    ? snapshot?.snapshot?.head
    : snapshot?.snapshot?.mergeBase;
  if (typeof revision !== "string" || !/^[a-f0-9]{40}$/iu.test(revision)) {
    throw new Error(`Hope context needs an immutable ${kind} revision`);
  }
  return revision;
}

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
  const segments = value.split("/");
  if (
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Hope context needs a normal repository-relative path");
  }
  return value;
}

function validateRequests(snapshot, requests) {
  if (!Array.isArray(requests)) {
    throw new TypeError("Hope context requests must be an array");
  }
  if (requests.length > LIMITS.contextFiles) {
    throw new Error(`Hope context supports ${LIMITS.contextFiles} requests`);
  }
  const seen = new Set();
  return Object.freeze(requests.map((request) => {
    if (
      !request
      || typeof request !== "object"
      || Array.isArray(request)
      || Object.keys(request).some((key) => !["path", "revision"].includes(key))
      || !Object.hasOwn(request, "path")
      || !Object.hasOwn(request, "revision")
    ) {
      throw new Error("Hope context received an invalid request");
    }
    const path = validateContextPath(request.path);
    if (!revisionKinds.has(request.revision)) {
      throw new Error("Hope context revision must be head or merge-base");
    }
    const revision = validateRevision(snapshot, request.revision);
    const key = `${request.revision}\u0000${path}`;
    if (seen.has(key)) {
      throw new Error("Hope context requests must be unique");
    }
    seen.add(key);
    return Object.freeze({
      path,
      repositoryKind: request.revision === "head" ? "head" : "base",
      revision,
    });
  }));
}

function unavailable(path, revision, reasonKind, reason) {
  return Object.freeze({
    kind: "context-unavailable",
    path,
    reason,
    reasonKind,
    revision,
  });
}

function included(path, revision, text) {
  return Object.freeze({
    kind: "context-file",
    path,
    revision,
    text,
  });
}

function exceedsInspectionLineLimit(text) {
  return text.split("\n").some((line) => (
    Buffer.byteLength(JSON.stringify(line), "utf8") + 2
      > LIMITS.contextLineJsonBytes
  ));
}

function contentUnavailable(path, revision, content) {
  return unavailable(
    path,
    revision,
    content.reasonKind,
    content.reason,
  );
}

export async function collectGitHubContext(snapshot, requests, {
  existingBytes = 0,
  gh,
} = {}) {
  if (
    !Number.isSafeInteger(existingBytes)
    || existingBytes < 0
    || existingBytes > LIMITS.contextBodyTotalBytes
  ) {
    throw new Error("Hope context has an invalid existing byte count");
  }
  const repository = validateRepository(snapshot);
  const values = validateRequests(snapshot, requests);
  const options = gh ? { exec: gh } : {};
  const collected = await Promise.all(values.map(async ({
    path,
    repositoryKind,
    revision,
  }) => {
    const privateKind = redactionKind(path, []);
    if (privateKind) {
      return unavailable(
        path,
        revision,
        privateKind,
        githubUnavailableReason(privateKind),
      );
    }
    let content;
    try {
      content = await readGitHubContent(
        repository[repositoryKind].owner,
        repository[repositoryKind].name,
        path,
        revision,
        options,
      );
    } catch (error) {
      if (error?.githubStatus === 404) {
        return unavailable(
          path,
          revision,
          "not-found",
          "GitHub did not find this path at the captured revision",
        );
      }
      throw error;
    }
    if (content.state !== "text") {
      return contentUnavailable(path, revision, content);
    }
    const redaction = redactionKind(path, [content.text]);
    if (redaction) {
      return unavailable(
        path,
        revision,
        redaction,
        githubUnavailableReason(redaction),
      );
    }
    if (exceedsInspectionLineLimit(content.text)) {
      return unavailable(
        path,
        revision,
        "inspection-line-limit",
        "The requested context has a line too long for Hope's bounded inspection pages",
      );
    }
    return included(path, revision, content.text);
  }));

  let total = existingBytes;
  return Object.freeze(collected.map((candidate) => {
    if (candidate.kind !== "context-file") return candidate;
    const bytes = Buffer.byteLength(candidate.text, "utf8");
    if (total + bytes > LIMITS.contextBodyTotalBytes) {
      return unavailable(
        candidate.path,
        candidate.revision,
        "safe-total-limit",
        `Context text exceeds Hope's ${LIMITS.contextBodyTotalBytes}-byte total limit`,
      );
    }
    total += bytes;
    return candidate;
  }));
}
