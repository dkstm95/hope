import { constants } from "node:fs";
import { link, lstat, mkdtemp, open, realpath, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

import { digest, LIMITS } from "./changes.mjs";
import { collectPullRequest, collectStatement, currentTarget, resolveTarget } from "./github.mjs";
import { inspectDocument, mergeExplanations, validateDocument, validateSources } from "./model.mjs";
import { renderArtifact } from "./render.mjs";

const digestMeta = /(<meta name="hope-diff-deep-digest" content=")([a-f0-9]{64})(">)/gu;
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size
  && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const sameNode = (a, b) => a.dev === b.dev && a.ino === b.ino;

async function regularFile(path, maximum) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximum) {
    throw new Error("Expected a bounded regular file with no links");
  }
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!sameFile(before, opened)) throw new Error("File changed before reading");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.length > maximum || !sameFile(opened, after) || !sameFile(after, await lstat(path))) {
      throw new Error("File changed during reading");
    }
    return { bytes, identity: after };
  } finally { await handle.close(); }
}

function sealed(source) {
  const matches = [...source.matchAll(digestMeta)];
  if (matches.length !== 1) throw new Error("Artifact has no unique digest marker");
  const neutral = source.replace(digestMeta, (_, before, hash, after) => `${before}${"0".repeat(64)}${after}`);
  const hash = digest(neutral);
  return { html: neutral.replace(digestMeta, (_, before, old, after) => `${before}${hash}${after}`), digest: hash, stored: matches[0][2] };
}

export async function readArtifact(pathValue) {
  const path = resolve(pathValue);
  const file = await regularFile(path, LIMITS.artifactBytes);
  const source = file.bytes.toString("utf8");
  const seal = sealed(source);
  if (seal.digest !== seal.stored) throw new Error("Artifact was changed outside Diff Deep");
  const blocks = [...source.matchAll(/<script id="diff-deep-document" type="application\/json">([\s\S]*?)<\/script>/gu)];
  if (blocks.length !== 1) throw new Error("Artifact has no unique captured document");
  const document = validateDocument(JSON.parse(blocks[0][1]));
  return { path, identity: file.identity, document, digest: seal.digest };
}

async function parentFor(path) {
  const parent = dirname(path);
  const canonical = await realpath(parent);
  const identity = await lstat(parent);
  if (canonical !== parent || !identity.isDirectory() || identity.isSymbolicLink()) {
    throw new Error("Artifact output parent must be a real directory, not a symbolic link");
  }
  return { path: parent, identity };
}

async function verifyParent(parent) {
  const current = await lstat(parent.path);
  if (!sameNode(current, parent.identity) || current.isSymbolicLink() || await realpath(parent.path) !== parent.path) {
    throw new Error("Artifact output directory changed");
  }
}

export async function preflightOutput(value) {
  const path = resolve(value);
  if (extname(path).toLowerCase() !== ".html") throw new Error("Artifact output must have an .html extension");
  await parentFor(path);
  try {
    await lstat(path);
    throw new Error(`Will not replace an existing file: ${path}`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return path;
}

async function writeArtifact(path, document, original, options = {}) {
  const parent = await parentFor(path);
  const output = sealed(await renderArtifact(document, { artifactPath: path }));
  const staging = join(parent.path, `.diff-deep-${randomUUID()}.tmp`);
  let stagingIdentity;
  const handle = await open(staging, "wx", 0o600);
  try {
    try {
      stagingIdentity = await handle.stat();
      await handle.writeFile(output.html, "utf8");
      await handle.sync();
    } finally { await handle.close(); }
    await options.beforePublish?.();
    await verifyParent(parent);
    if (original) {
      const current = await readArtifact(path);
      if (!sameFile(current.identity, original.identity) || current.digest !== original.digest) {
        throw new Error("Artifact changed before the explanation update");
      }
      await rename(staging, path);
    } else {
      // link is atomic and fails if another file appeared at the output path.
      await link(staging, path);
      await unlink(staging);
    }
    const published = await lstat(path);
    if (!sameNode(published, stagingIdentity) || published.nlink !== 1) {
      throw new Error("Cannot verify the published artifact identity");
    }
    return { ...result(path, document), digest: output.digest };
  } finally {
    try {
      const current = await lstat(staging);
      if (stagingIdentity && sameNode(current, stagingIdentity) && !current.isSymbolicLink()) await unlink(staging);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function result(path, document) {
  const { snapshot } = document;
  return { artifactPath: path, target: snapshot.target.url, head: snapshot.head, mergeBase: snapshot.mergeBase,
    snapshotId: snapshot.id, revision: document.revision, files: snapshot.files.length,
    changes: snapshot.changes.length, explained: document.explanations.length,
    pending: snapshot.changes.length - document.explanations.length,
    unavailableFiles: snapshot.files.filter((file) => file.availability === "unavailable").length };
}

export async function createArtifact(snapshot, { output, locale = "en-US", theme = "system", ...options } = {}) {
  const document = validateDocument({ schemaVersion: 1, snapshot, locale, theme, revision: 0, explanations: [] });
  const path = output
    ? await preflightOutput(output)
    : join(await mkdtemp(join(await realpath(tmpdir()), "hope-diff-deep-")), "review.html");
  return await writeArtifact(path, document, undefined, options);
}

export async function captureArtifact(value, options = {}) {
  if (options.output) await preflightOutput(options.output);
  const target = await resolveTarget(value, options);
  const snapshot = await collectPullRequest(target, options);
  return await createArtifact(snapshot, options);
}

async function updateArtifact(path, expectedDigest, transform, options) {
  if (!/^[a-f0-9]{64}$/u.test(expectedDigest ?? "")) throw new Error("An inspected expected digest is required");
  const original = await readArtifact(path);
  if (original.digest !== expectedDigest) throw new Error("Artifact digest is stale; inspect it before updating");
  const document = await transform(original.document);
  return await writeArtifact(original.path, validateDocument(document), original, options);
}

export async function explainArtifact(path, inputPath, expectedDigest, options = {}) {
  const file = await regularFile(resolve(inputPath), LIMITS.inputBytes);
  const input = JSON.parse(file.bytes.toString("utf8"));
  return await updateArtifact(path, expectedDigest, (document) => mergeExplanations(document, input), options);
}

export async function addStatement(path, url, expectedDigest, options = {}) {
  return await updateArtifact(path, expectedDigest, async (document) => {
    const source = await collectStatement(url, options);
    const existing = document.snapshot.sources.find((entry) => entry.id === source.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(source)) throw new Error("A captured source cannot change under an existing ID");
    return { ...document, revision: document.revision + 1, snapshot: { ...document.snapshot,
      sources: validateSources(existing ? document.snapshot.sources : [...document.snapshot.sources, source]) } };
  }, options);
}

export async function inspectArtifact(path, options = {}) {
  const artifact = await readArtifact(path);
  return { ...result(artifact.path, artifact.document), digest: artifact.digest,
    ...inspectDocument(artifact.document, options) };
}

export async function artifactStatus(path, { current = false, ...options } = {}) {
  const artifact = await readArtifact(path);
  const status = { ...result(artifact.path, artifact.document), digest: artifact.digest };
  if (current) {
    const latest = await currentTarget(artifact.document.snapshot.target, options);
    status.matchesCurrentPR = latest.base.sha === artifact.document.snapshot.base
      && latest.head.sha === artifact.document.snapshot.head;
    status.currentHead = latest.head.sha;
  }
  return status;
}
