import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { renderAlignArtifact } from "./render.mjs";

const execFileAsync = promisify(execFile);
const INPUT_MAXIMUM_BYTES = 256 * 1024;
const ARTIFACT_MAXIMUM_BYTES = 4 * 1024 * 1024;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const DIGEST_PLACEHOLDER = "0".repeat(64);
const DIGEST_META_PATTERN = /(<meta name="hope-align-digest" content=")[a-f0-9]{64}(">)/u;
const ALIGN_ID_META_PATTERN = /<meta name="hope-align-id" content="([a-f0-9-]{36})">/u;
const DATA_PATTERN = /<script id="hope-align-data" type="application\/json">([\s\S]*?)<\/script>/u;

const contentKeys = Object.freeze([
  "title",
  "intent",
  "problem",
  "success",
  "boundary",
  "scope",
  "behavior",
  "decisions",
  "openChoices",
  "evidence",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(value, allowed, path) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new TypeError(`${path} contains unsupported field: ${extras[0]}`);
  }
}

function text(value, path, maximumLength = 4_000) {
  if (typeof value !== "string") throw new TypeError(`${path} must be text`);
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(`${path} must not be empty`);
  if (normalized.length > maximumLength) {
    throw new TypeError(`${path} exceeds ${maximumLength} characters`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`${path} contains unsupported control characters`);
  }
  return normalized;
}

function textList(value, path, maximumItems = 30) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length > maximumItems) {
    throw new TypeError(`${path} exceeds ${maximumItems} items`);
  }
  return value.map((item, index) => text(item, `${path}[${index}]`));
}

function titledItems(value, path, { maximumItems, minimumItems = 0 } = {}) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  if (value.length < minimumItems || value.length > maximumItems) {
    throw new TypeError(
      `${path} must contain between ${minimumItems} and ${maximumItems} items`,
    );
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["title", "detail"], itemPath);
    return Object.freeze({
      title: text(item.title, `${itemPath}.title`, 160),
      ...(item.detail === undefined
        ? {}
        : { detail: text(item.detail, `${itemPath}.detail`) }),
    });
  });
}

function outcomeItems(value, path, { maximumItems } = {}) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new TypeError(`${path} must be an array with at most ${maximumItems} items`);
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["title", "detail", "kind"], itemPath);
    if (item.kind !== undefined && !["complete", "cancel"].includes(item.kind)) {
      throw new TypeError(`${itemPath}.kind must be complete or cancel`);
    }
    return Object.freeze({
      title: text(item.title, `${itemPath}.title`, 160),
      ...(item.detail === undefined
        ? {}
        : { detail: text(item.detail, `${itemPath}.detail`) }),
      ...(item.kind === undefined ? {} : { kind: item.kind }),
    });
  });
}

export function validateAlignInput(value, defaults = {}) {
  if (!isRecord(value)) throw new TypeError("Align input must be an object");
  const allowed = [
    "schemaVersion",
    "locale",
    "theme",
    ...contentKeys,
    "revisionSummary",
  ];
  assertKeys(value, allowed, "$");
  if (value.schemaVersion !== 1) {
    throw new TypeError("$.schemaVersion must be 1");
  }

  const locale = value.locale ?? defaults.locale ?? "en-US";
  const theme = value.theme ?? defaults.theme ?? "system";
  if (!["en-US", "ko-KR"].includes(locale)) {
    throw new TypeError("$.locale must be en-US or ko-KR");
  }
  if (!["system", "light", "dark"].includes(theme)) {
    throw new TypeError("$.theme must be system, light, or dark");
  }
  if (!isRecord(value.scope)) throw new TypeError("$.scope must be an object");
  assertKeys(value.scope, ["included", "excluded"], "$.scope");

  let behavior;
  if (value.behavior !== undefined) {
    if (!isRecord(value.behavior)) {
      throw new TypeError("$.behavior must be an object");
    }
    assertKeys(value.behavior, ["steps", "outcomes"], "$.behavior");
    behavior = Object.freeze({
      steps: titledItems(value.behavior.steps, "$.behavior.steps", {
        maximumItems: 8,
        minimumItems: 2,
      }),
      outcomes: outcomeItems(value.behavior.outcomes, "$.behavior.outcomes", {
        maximumItems: 6,
      }),
    });
  }

  if (!Array.isArray(value.decisions) || value.decisions.length > 20) {
    throw new TypeError("$.decisions must be an array with at most 20 items");
  }
  const decisions = value.decisions.map((item, index) => {
    const itemPath = `$.decisions[${index}]`;
    if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
    assertKeys(item, ["decision", "reason"], itemPath);
    return Object.freeze({
      decision: text(item.decision, `${itemPath}.decision`, 160),
      reason: text(item.reason, `${itemPath}.reason`),
    });
  });

  let evidence = [];
  if (value.evidence !== undefined) {
    if (!Array.isArray(value.evidence) || value.evidence.length > 30) {
      throw new TypeError("$.evidence must be an array with at most 30 items");
    }
    evidence = value.evidence.map((item, index) => {
      const itemPath = `$.evidence[${index}]`;
      if (!isRecord(item)) throw new TypeError(`${itemPath} must be an object`);
      assertKeys(item, ["label", "location"], itemPath);
      return Object.freeze({
        label: text(item.label, `${itemPath}.label`, 160),
        location: text(item.location, `${itemPath}.location`),
      });
    });
  }

  const success = textList(value.success, "$.success", 12);
  if (success.length === 0) throw new TypeError("$.success must not be empty");
  return Object.freeze({
    schemaVersion: 1,
    locale,
    theme,
    title: text(value.title, "$.title", 160),
    intent: text(value.intent, "$.intent"),
    problem: text(value.problem, "$.problem"),
    success,
    boundary: text(value.boundary, "$.boundary"),
    scope: Object.freeze({
      included: textList(value.scope.included, "$.scope.included"),
      excluded: textList(value.scope.excluded, "$.scope.excluded"),
    }),
    ...(behavior === undefined ? {} : { behavior }),
    decisions: Object.freeze(decisions),
    openChoices: Object.freeze(textList(value.openChoices, "$.openChoices")),
    evidence: Object.freeze(evidence),
    revisionSummary: text(value.revisionSummary, "$.revisionSummary"),
  });
}

async function readStableFile(path, maximumBytes, label) {
  const first = await lstat(path);
  if (!first.isFile() || first.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  if (first.size > maximumBytes) {
    throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  }
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (!sameFile(first, opened)) throw new Error(`${label} changed while opening`);
    const bytes = await handle.readFile();
    const completed = await handle.stat();
    if (
      !sameFile(opened, completed)
      || completed.size !== bytes.length
      || completed.mtimeMs !== opened.mtimeMs
      || completed.ctimeMs !== opened.ctimeMs
    ) {
      throw new Error(`${label} changed while reading`);
    }
    return { bytes, identity: completed };
  } finally {
    await handle.close();
  }
}

export async function readAlignInput(path, defaults) {
  const { bytes } = await readStableFile(path, INPUT_MAXIMUM_BYTES, "Align input");
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error("Align input is not valid JSON", { cause: error });
  }
  return validateAlignInput(value, defaults);
}

function sameFile(actual, expected) {
  return actual.isFile()
    && !actual.isSymbolicLink()
    && actual.dev === expected.dev
    && actual.ino === expected.ino
    && actual.size === expected.size;
}

function artifactContent(input) {
  return Object.freeze(Object.fromEntries(
    contentKeys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]),
  ));
}

function artifactRevision(number, agreedAt, input) {
  return Object.freeze({
    number,
    agreedAt,
    summary: input.revisionSummary,
    content: artifactContent(input),
  });
}

function sealHtml(source) {
  const matches = source.match(new RegExp(DIGEST_META_PATTERN.source, "gu")) ?? [];
  if (matches.length !== 1 || !source.includes(DIGEST_PLACEHOLDER)) {
    throw new Error("Align renderer did not produce one digest placeholder");
  }
  const digest = sha256(Buffer.from(source, "utf8"));
  return Object.freeze({
    bytes: Buffer.from(source.replace(DIGEST_META_PATTERN, `$1${digest}$2`), "utf8"),
    digest,
  });
}

export function verifyAlignHtml(source) {
  const match = source.match(DIGEST_META_PATTERN);
  if (!match || !DIGEST_PATTERN.test(match[0].slice(match[1].length, -match[2].length))) {
    throw new Error("This file is not a Hope Align artifact");
  }
  const digest = match[0].slice(match[1].length, -match[2].length);
  const normalized = source.replace(DIGEST_META_PATTERN, `$1${DIGEST_PLACEHOLDER}$2`);
  if (sha256(Buffer.from(normalized, "utf8")) !== digest) {
    throw new Error(
      "Hope did not revise this Align artifact because it was changed outside Hope",
    );
  }
  return digest;
}

function validateArtifactData(value) {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Align artifact data has an unsupported schema");
  }
  if (typeof value.alignId !== "string" || !/^[a-f0-9-]{36}$/u.test(value.alignId)) {
    throw new Error("Align artifact identity is invalid");
  }
  if (typeof value.repository !== "string" || value.repository.length === 0) {
    throw new Error("Align artifact repository is invalid");
  }
  if (!["en-US", "ko-KR"].includes(value.locale)) {
    throw new Error("Align artifact locale is invalid");
  }
  if (!["system", "light", "dark"].includes(value.theme)) {
    throw new Error("Align artifact theme is invalid");
  }
  if (!Array.isArray(value.revisions) || value.revisions.length === 0) {
    throw new Error("Align artifact has no revisions");
  }
  for (const [index, revision] of value.revisions.entries()) {
    if (
      !isRecord(revision)
      || revision.number !== index + 1
      || typeof revision.agreedAt !== "string"
      || typeof revision.summary !== "string"
      || !isRecord(revision.content)
    ) {
      throw new Error("Align artifact revision history is invalid");
    }
  }
  return value;
}

async function readAlignArtifactFile(path) {
  const absolutePath = isAbsolute(path) ? path : resolve(path);
  const { bytes, identity } = await readStableFile(
    absolutePath,
    ARTIFACT_MAXIMUM_BYTES,
    "Align artifact",
  );
  const source = bytes.toString("utf8");
  const digest = verifyAlignHtml(source);
  const alignId = source.match(ALIGN_ID_META_PATTERN)?.[1];
  const dataSource = source.match(DATA_PATTERN)?.[1];
  if (!alignId || dataSource === undefined) {
    throw new Error("This file is not a complete Hope Align artifact");
  }
  let data;
  try {
    data = validateArtifactData(JSON.parse(dataSource));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Align artifact data is not valid JSON", { cause: error });
    }
    throw error;
  }
  if (data.alignId !== alignId) throw new Error("Align artifact identity does not match");
  return Object.freeze({ absolutePath, data, digest, identity });
}

function gitEnvironment(environment = process.env) {
  return Object.fromEntries(Object.entries(environment).filter(
    ([name, value]) => !name.toUpperCase().startsWith("GIT_") && value !== undefined,
  ));
}

async function runGit(root, argumentsList) {
  return await execFileAsync("git", ["-c", "core.hooksPath=/dev/null", ...argumentsList], {
    cwd: root,
    encoding: "utf8",
    env: gitEnvironment(),
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 10_000,
  });
}

async function repositoryRoot(requestedRoot) {
  const requested = await realpath(requestedRoot);
  const { stdout } = await runGit(requested, ["rev-parse", "--show-toplevel"]);
  return await realpath(stdout.trim());
}

function repositoryFromRemote(remote, root) {
  const normalized = remote.trim().replace(/\.git$/u, "");
  const scp = normalized.match(/^[^@]+@[^:]+:(.+)$/u)?.[1];
  let path = scp;
  if (!path) {
    try {
      path = new URL(normalized).pathname;
    } catch {
      path = normalized;
    }
  }
  const parts = String(path).split(/[\\/]/u).filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join("/") : basename(root);
}

async function repositoryLabel(root) {
  try {
    const { stdout } = await runGit(root, ["remote", "get-url", "origin"]);
    return repositoryFromRemote(stdout, root);
  } catch {
    return basename(root);
  }
}

function insideRoot(root, target) {
  const fromRoot = relative(root, target);
  return fromRoot !== ".."
    && !fromRoot.startsWith(`..${sep}`)
    && !isAbsolute(fromRoot);
}

async function ensureSafeParent(root, target, { create = false } = {}) {
  const parent = dirname(target);
  if (!insideRoot(root, parent)) {
    throw new Error("Align artifact output must stay inside the target repository");
  }
  const fromRoot = relative(root, parent);
  let current = root;
  for (const part of fromRoot.split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("Align artifact output path contains a non-directory or link");
      }
    } catch (error) {
      if (error?.code !== "ENOENT" || !create) throw error;
      await mkdir(current, { mode: 0o755 });
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("Hope could not verify the Align artifact directory");
      }
    }
  }
  return parent;
}

async function resolveArtifactTarget(root, requested, options, requestedRoot = root) {
  let target;
  if (isAbsolute(requested)) {
    const unresolvedRoot = resolve(requestedRoot);
    const unresolvedTarget = resolve(requested);
    const fromRequestedRoot = relative(unresolvedRoot, unresolvedTarget);
    target = insideRoot(unresolvedRoot, unresolvedTarget)
      ? resolve(root, fromRequestedRoot)
      : unresolvedTarget;
  } else {
    target = resolve(root, requested);
  }
  if (extname(target).toLowerCase() !== ".html") {
    throw new Error("Align artifact output must use an .html extension");
  }
  await ensureSafeParent(root, target, options);
  return target;
}

async function syncDirectory(path) {
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    if (
      process.platform !== "win32"
      && !["EINVAL", "ENOTSUP", "EISDIR"].includes(error?.code)
    ) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
}

async function writeStaging(path, bytes) {
  const handle = await open(path, "wx", 0o644);
  let identity;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    identity = await handle.stat();
  } finally {
    await handle.close();
  }
  return identity;
}

async function unlinkIfOwned(path, expected) {
  if (!expected) return;
  try {
    const current = await lstat(path);
    if (sameFile(current, expected)) await unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishNew(target, bytes) {
  try {
    await lstat(target);
    throw new Error(`Hope did not replace the existing file: ${target}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const staging = join(
    dirname(target),
    `.${basename(target)}.hope-${randomBytes(12).toString("hex")}.tmp`,
  );
  let identity;
  let linked = false;
  try {
    identity = await writeStaging(staging, bytes);
    await link(staging, target);
    linked = true;
    const published = await lstat(target);
    if (!sameFile(published, identity) || published.nlink !== 2) {
      throw new Error("The Align artifact changed during publication");
    }
    await unlink(staging);
    const final = await lstat(target);
    if (!sameFile(final, identity) || final.nlink !== 1) {
      throw new Error("The Align artifact changed during publication");
    }
    await syncDirectory(dirname(target));
  } catch (error) {
    if (linked) await unlinkIfOwned(target, identity).catch(() => {});
    await unlinkIfOwned(staging, identity).catch(() => {});
    throw error;
  }
}

async function replaceOwned(target, original, bytes) {
  const staging = join(
    dirname(target),
    `.${basename(target)}.hope-${randomBytes(12).toString("hex")}.tmp`,
  );
  let stagingIdentity;
  try {
    stagingIdentity = await writeStaging(staging, bytes);
    const current = await readAlignArtifactFile(target);
    if (!sameFile(current.identity, original.identity) || current.digest !== original.digest) {
      throw new Error("Align artifact changed before Hope could revise it");
    }
    await rename(staging, target);
    const final = await lstat(target);
    if (!sameFile(final, stagingIdentity) || final.nlink !== 1) {
      throw new Error("Hope could not verify the revised Align artifact");
    }
    await syncDirectory(dirname(target));
  } catch (error) {
    await unlinkIfOwned(staging, stagingIdentity).catch(() => {});
    throw error;
  }
}

function resultFor(path, data, digest) {
  const current = data.revisions.at(-1);
  return Object.freeze({
    alignId: data.alignId,
    artifactPath: path,
    digest,
    repository: data.repository,
    revision: current.number,
    title: current.content.title,
  });
}

export async function createAlignArtifact({ inputPath, outputPath, root }, dependencies = {}) {
  if (!inputPath || !outputPath) throw new TypeError("inputPath and outputPath are required");
  const requestedRoot = root ?? process.cwd();
  const resolvedRoot = await repositoryRoot(requestedRoot);
  const input = await readAlignInput(inputPath);
  const target = await resolveArtifactTarget(
    resolvedRoot,
    outputPath,
    { create: true },
    requestedRoot,
  );
  const now = dependencies.now?.() ?? new Date();
  const agreedAt = now.toISOString();
  const data = Object.freeze({
    schemaVersion: 1,
    alignId: (dependencies.randomUUID ?? randomUUID)(),
    repository: await repositoryLabel(resolvedRoot),
    locale: input.locale,
    theme: input.theme,
    createdAt: agreedAt,
    revisions: Object.freeze([artifactRevision(1, agreedAt, input)]),
  });
  const sealed = sealHtml(renderAlignArtifact(data, { digest: DIGEST_PLACEHOLDER }));
  await publishNew(target, sealed.bytes);
  return resultFor(target, data, sealed.digest);
}

export async function inspectAlignArtifact(artifactPath) {
  if (!artifactPath) throw new TypeError("artifactPath is required");
  const artifact = await readAlignArtifactFile(artifactPath);
  const current = artifact.data.revisions.at(-1);
  return Object.freeze({
    ...resultFor(artifact.absolutePath, artifact.data, artifact.digest),
    agreedAt: current.agreedAt,
    content: current.content,
    history: Object.freeze(artifact.data.revisions.map((revision) => Object.freeze({
      agreedAt: revision.agreedAt,
      number: revision.number,
      summary: revision.summary,
    }))),
    locale: artifact.data.locale,
    theme: artifact.data.theme,
  });
}

export async function reviseAlignArtifact({
  artifactPath,
  expectedDigest,
  inputPath,
  root,
}, dependencies = {}) {
  if (!artifactPath || !inputPath || !expectedDigest) {
    throw new TypeError("artifactPath, expectedDigest, and inputPath are required");
  }
  if (!DIGEST_PATTERN.test(expectedDigest)) {
    throw new TypeError("expectedDigest must be a lowercase SHA-256 digest");
  }
  const requestedRoot = root ?? process.cwd();
  const resolvedRoot = await repositoryRoot(requestedRoot);
  const target = await resolveArtifactTarget(
    resolvedRoot,
    artifactPath,
    { create: false },
    requestedRoot,
  );
  const original = await readAlignArtifactFile(target);
  if (original.identity.nlink !== 1) {
    throw new Error("Hope did not revise a hard-linked Align artifact");
  }
  if (original.digest !== expectedDigest) {
    throw new Error("Align artifact digest does not match the inspected revision");
  }
  const currentRepository = await repositoryLabel(resolvedRoot);
  if (original.data.repository !== currentRepository) {
    throw new Error("Align artifact belongs to a different repository");
  }
  const input = await readAlignInput(inputPath, {
    locale: original.data.locale,
    theme: original.data.theme,
  });
  const now = dependencies.now?.() ?? new Date();
  const revision = artifactRevision(
    original.data.revisions.length + 1,
    now.toISOString(),
    input,
  );
  const data = Object.freeze({
    ...original.data,
    locale: input.locale,
    theme: input.theme,
    revisions: Object.freeze([...original.data.revisions, revision]),
  });
  const sealed = sealHtml(renderAlignArtifact(data, { digest: DIGEST_PLACEHOLDER }));
  await replaceOwned(target, original, sealed.bytes);
  return resultFor(target, data, sealed.digest);
}
