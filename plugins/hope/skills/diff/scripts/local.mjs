import { isUtf8 } from "node:buffer";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import { promisify } from "node:util";

import { BASE_LIMITS, CONTRACT_VERSION, LIMITS } from "./constants.mjs";
import { digestJson } from "./hash.mjs";
import { parsePatch } from "./patch.mjs";
import { diffText } from "./reconstruct-patch.mjs";
import { redactionKind } from "./redact.mjs";
import { cleanText, containsBidiControl, unavailableReason } from "./text.mjs";

const execFile = promisify(execFileCallback);
const GIT_TIMEOUT_MS = 30_000;
const statuses = { A: "added", D: "removed", M: "modified", T: "changed" };

class RetryableLocalAccessError extends Error {}

export function isRetryableLocalAccessError(error) {
  return error instanceof RetryableLocalAccessError;
}

function gitEnvironment() {
  const env = { ...process.env };
  for (const name of ["GIT_EXTERNAL_DIFF", "GIT_DIFF_OPTS", "GIT_PAGER"]) delete env[name];
  // Literal pathspecs keep a file named "*.js" from matching other files; optional
  // locks keep Hope from rewriting the index while it reads.
  return { ...env, GIT_LITERAL_PATHSPECS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
}

async function git(cwd, args, { encoding = "utf8", exec = execFile, maxBuffer = 16 * 1024 * 1024 } = {}) {
  try {
    const { stdout } = await exec("git", ["-c", "core.fsmonitor=false", "-c", "core.quotePath=false", ...args], {
      cwd, encoding, env: gitEnvironment(), maxBuffer, shell: false, timeout: GIT_TIMEOUT_MS,
    });
    return stdout;
  } catch (error) {
    const failure = new Error(`git ${args[0]} failed${error?.code === "ENOENT" ? ": Git is not installed" : ""}`, { cause: error });
    failure.gitExitCode = error?.code;
    throw failure;
  }
}

const nulFields = (value) => value.split("\0").filter((field) => field !== "");

function validRef(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 256
    || value.startsWith("-") || /[\u0000-\u0020\u007f:?*[\\]/u.test(value) || containsBidiControl(value)) {
    throw new TypeError("Hope diff needs --base to name a branch, tag, or commit");
  }
  return value;
}

async function resolveCommit(root, ref, options) {
  try {
    return (await git(root, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`], options)).trim();
  } catch {
    throw new Error(`Hope could not find the commit ${ref} in this repository`);
  }
}

export async function findRepositoryRoot(cwd = process.cwd(), options = {}) {
  try {
    return await realpath((await git(cwd, ["rev-parse", "--show-toplevel"], options)).trim());
  } catch {
    return undefined;
  }
}

async function defaultBaseRef(root, options) {
  try {
    return (await git(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], options)).trim();
  } catch {
    throw new Error("Hope could not find the upstream default branch (origin/HEAD). Pass --base <ref>.");
  }
}

function githubRemote(url) {
  const match = String(url).trim().match(
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/u,
  );
  if (!match || [match[1], match[2]].some((part) => part === "." || part === "..")) return undefined;
  return Object.freeze({ name: match[2], owner: match[1], provider: "github" });
}

/** Read a working-tree file without following a symlink in any path component. */
async function readWorkingFile(root, path) {
  const full = join(root, path);
  let info;
  try {
    info = await lstat(full);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return { state: "absent" };
    throw error;
  }
  const special = (kind) => ({ reason: unavailableReason("special-entry", kind), reasonKind: "special-entry", state: "special" });
  if (info.isSymbolicLink()) return special("symlink");
  if (!info.isFile()) return special(info.isDirectory() ? "directory" : "non-file");
  if (await realpath(full) !== full || !full.startsWith(`${root}${sep}`)) return special("symlinked path");
  if (info.size > LIMITS.safeBodyBytes) {
    return { reason: unavailableReason("safe-size-limit"), reasonKind: "safe-size-limit", state: "oversized" };
  }
  const handle = await open(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (opened.ino !== info.ino || opened.dev !== info.dev) return special("replaced");
    return { bytes: await handle.readFile(), state: "bytes" };
  } finally {
    await handle.close();
  }
}

async function baseEntries(root, revision, paths, options) {
  const entries = new Map();
  if (paths.length === 0) return entries;
  const output = await git(root, ["ls-tree", "-l", "-z", "--full-tree", revision, "--", ...paths], options);
  for (const record of nulFields(output)) {
    const match = record.match(/^(\d+) (\w+) ([0-9a-f]+) +(-|\d+)\t(.*)$/su);
    if (match) entries.set(match[5], { mode: match[1], oid: match[3], size: Number(match[4]), type: match[2] });
  }
  return entries;
}

async function readBaseFile(root, entry, options) {
  if (!entry) return { state: "absent" };
  if (entry.mode === "160000" || entry.mode === "120000" || entry.type !== "blob") {
    const kind = entry.mode === "160000" ? "submodule" : entry.mode === "120000" ? "symlink" : entry.type;
    return { reason: unavailableReason("special-entry", kind), reasonKind: "special-entry", state: "special" };
  }
  if (entry.size > LIMITS.safeBodyBytes) {
    return { reason: unavailableReason("safe-size-limit"), reasonKind: "safe-size-limit", state: "oversized" };
  }
  return { bytes: await git(root, ["cat-file", "blob", entry.oid], { ...options, encoding: "buffer" }), state: "bytes" };
}

function asText(content) {
  if (content.state !== "bytes") return content;
  if (!isUtf8(content.bytes) || content.bytes.includes(0)) {
    return { reason: unavailableReason("invalid-text"), reasonKind: "invalid-text", state: "binary" };
  }
  return { state: "text", text: cleanText(content.bytes.toString("utf8")) };
}

async function changedPaths(root, mergeBase, untracked, options) {
  const diffArgs = ["--no-ext-diff", "--no-textconv", "--no-renames", "-z", mergeBase, "--"];
  const [nameStatus, numstat, others] = await Promise.all([
    git(root, ["diff", "--name-status", ...diffArgs], options),
    git(root, ["diff", "--numstat", ...diffArgs], options),
    untracked ? git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--full-name"], options) : "",
  ]);
  const fields = nulFields(nameStatus);
  const changes = new Map();
  for (let index = 0; index < fields.length; index += 2) {
    const status = statuses[fields[index]];
    if (!status) throw new Error(`Hope cannot review a ${fields[index]} entry; resolve conflicts first`);
    changes.set(fields[index + 1], { providerStatus: status });
  }
  for (const record of nulFields(numstat)) {
    const match = record.match(/^(-|\d+)\t(-|\d+)\t(.*)$/su);
    const change = match && changes.get(match[3]);
    if (!change) continue;
    change.binary = match[1] === "-";
    change.additions = change.binary ? 0 : Number(match[1]);
    change.deletions = change.binary ? 0 : Number(match[2]);
  }
  for (const path of nulFields(others)) changes.set(path, { additions: 0, deletions: 0, providerStatus: "added", untracked: true });
  for (const path of changes.keys()) {
    if (containsBidiControl(path) || /[\u0000-\u001f\u007f]/u.test(path) || path.split("/").includes("..")) {
      throw new Error("The working tree has a changed path Hope cannot display safely");
    }
  }
  return changes;
}

// Hash any size of file, including ones too large or binary to review, so a later edit is detected.
async function pathFingerprint(root, path) {
  const full = join(root, path);
  let info;
  try {
    info = await lstat(full);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return "absent";
    throw error;
  }
  if (info.isSymbolicLink()) return `symlink:${await readlink(full)}`;
  if (!info.isFile()) return info.isDirectory() ? "directory" : "non-file";
  const hash = createHash("sha256");
  const handle = await open(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return `file:${(info.mode & 0o111) === 0 ? "" : "x"}:${hash.digest("hex")}`;
}

/** A digest of each captured path's current working-tree bytes, used to detect later edits. */
export async function workingTreeDigest(root, paths) {
  const entries = [];
  for (const path of [...paths].sort()) entries.push([path, await pathFingerprint(root, path)]);
  return digestJson(entries);
}

async function commitTitles(root, mergeBase, options) {
  const output = await git(root, ["log", "--no-show-signature", `--max-count=${LIMITS.commits + 1}`, "--format=%H%x00%s%x00", `${mergeBase}..HEAD`, "--"], options);
  const fields = nulFields(output.replaceAll("\n", ""));
  const commits = [];
  for (let index = 0; index < fields.length; index += 2) commits.push({ revision: fields[index], title: cleanText(fields[index + 1] ?? "") });
  if (commits.length > LIMITS.commits) throw new Error(`The change has more than ${LIMITS.commits} commits; Hope supports ${LIMITS.commits}`);
  if (redactionKind("commit-titles.txt", commits.map((commit) => commit.title)) === "credential-pattern") {
    throw new Error("A commit title contains a suspected credential; Hope did not create a review.");
  }
  return commits.reverse();
}

async function collectFile(root, path, change, base, options) {
  const record = { additions: change.additions ?? 0, deletions: change.deletions ?? 0, path, providerStatus: change.providerStatus };
  const unavailableFile = (bodyState, reasonKind, reason = unavailableReason(reasonKind)) => ({ ...record, bodyReason: reason, bodyReasonKind: reasonKind, bodyState });
  const privateKind = redactionKind(path, []);
  if (privateKind) return { file: unavailableFile("redacted", privateKind), bytes: 0 };
  if (change.binary) return { file: unavailableFile("metadata-only", "invalid-text"), bytes: 0 };
  const [before, after] = await Promise.all([
    change.providerStatus === "added" ? { state: "absent" } : readBaseFile(root, base.get(path), options).then(asText),
    change.providerStatus === "removed" ? { state: "absent" } : readWorkingFile(root, path).then(asText),
  ]);
  const texts = [before.text, after.text].filter((text) => text !== undefined);
  const redaction = redactionKind(path, texts);
  if (redaction) return { file: unavailableFile("redacted", redaction), bytes: 0 };
  const unavailable = [before, after].find((item) => !["text", "absent"].includes(item.state));
  if (unavailable) return { file: unavailableFile("metadata-only", unavailable.reasonKind, unavailable.reason), bytes: 0 };
  const bytes = texts.reduce((sum, text) => sum + Buffer.byteLength(text, "utf8"), 0);
  if (bytes > LIMITS.safeBodyBytes) return { file: unavailableFile("metadata-only", "safe-size-limit"), bytes: 0 };
  let patch;
  try {
    patch = await diffText(before.text ?? "", after.text ?? "");
  } catch (error) {
    if (error.code === "HOPE_PATCH_CLEANUP_FAILED") throw error;
    return { file: unavailableFile("metadata-only", "patch-incomplete", "A complete patch could not be reconstructed and verified"), bytes: 0 };
  }
  // Mode-only or line-ending-only edits leave no text change to show.
  if (patch === "") return { file: unavailableFile("metadata-only", "no-text-diff"), bytes: 0 };
  let parsed;
  try {
    parsed = parsePatch(patch);
  } catch {
    return { file: unavailableFile("metadata-only", "patch-incomplete", "A complete patch could not be reconstructed and verified"), bytes: 0 };
  }
  return {
    bytes: Buffer.byteLength(patch, "utf8"),
    file: { ...record, additions: parsed.additions, bodyState: "included", deletions: parsed.deletions, patch },
  };
}

/** Capture the working tree (committed, staged, and unstaged) against merge-base HEAD <base>. */
export async function collectLocalChange({
  base,
  clock = () => new Date(),
  cwd = process.cwd(),
  exec,
  locale,
  localeSource,
  theme,
  themeSource,
  untracked = false,
} = {}) {
  const options = exec ? { exec } : {};
  const root = await findRepositoryRoot(cwd, options);
  if (!root) throw new Error("Hope Diff needs a GitHub pull request or a Git repository with local changes");
  const baseRef = base === undefined ? await defaultBaseRef(root, options) : validRef(base);
  const baseTip = await resolveCommit(root, baseRef, options);
  const headRevision = await resolveCommit(root, "HEAD", options);
  const mergeBase = (await git(root, ["merge-base", headRevision, baseTip], options).catch(() => {
    throw new Error(`HEAD and ${baseRef} share no merge base`);
  })).trim();
  const changes = await changedPaths(root, mergeBase, untracked, options);
  if (changes.size === 0) throw new Error(`The working tree has no changes against ${baseRef}`);
  if (changes.size > LIMITS.changedFiles) throw new Error(`The change has ${changes.size} files; Hope supports ${LIMITS.changedFiles}`);
  const paths = [...changes.keys()].sort((left, right) => left.localeCompare(right, "en"));
  // Fingerprint before reading so an edit during capture cannot match the review later.
  const digest = await workingTreeDigest(root, paths);
  const baseFiles = await baseEntries(root, mergeBase, paths.filter((path) => !changes.get(path).untracked), options);
  const commits = await commitTitles(root, mergeBase, options);
  const collected = [];
  let total = 0;
  let changedLines = 0;
  for (const path of paths) {
    const { bytes, file } = await collectFile(root, path, changes.get(path), baseFiles, options);
    total += bytes;
    changedLines += file.additions + file.deletions;
    if (total > LIMITS.safeBodyTotalBytes) throw new Error(`Safe changed-file text exceeds Hope's ${LIMITS.safeBodyTotalBytes}-byte limit`);
    if (changedLines > LIMITS.changedLines) throw new Error(`The change has more than ${LIMITS.changedLines} changed lines; Hope supports ${LIMITS.changedLines}`);
    collected.push(file);
  }
  if (await workingTreeDigest(root, paths) !== digest) {
    throw new Error("The working tree changed while Hope was capturing it; capture again");
  }
  const sources = commits.map((commit, index) => Object.freeze({
    id: `source-${index + 1}`, kind: "commit-title", lineCount: commit.title.split("\n").length, revision: commit.revision, text: commit.title,
  }));
  const limits = BASE_LIMITS.map((limit) => ({ ...limit }));
  const files = collected.map((file, index) => {
    const id = `file-${index + 1}`;
    const sourceIds = [];
    if (file.patch) {
      sourceIds.push(`source-${sources.length + 1}`);
      sources.push(Object.freeze({
        fileId: id, id: sourceIds[0], kind: "patch", lineCount: file.patch.split("\n").length, path: file.path, revision: headRevision, text: file.patch,
      }));
    } else {
      limits.push({ id: `limit-${limits.length + 1}`, kind: "file-unavailable", reason: file.bodyReason, reasonKind: file.bodyReasonKind, subject: file.path });
    }
    const { patch: _patch, ...metadata } = file;
    return Object.freeze({ ...metadata, id, sourceIds });
  });
  const remote = await git(root, ["remote", "get-url", "origin"], options).catch(() => "");
  const repository = githubRemote(remote);
  const dirty = (await git(root, ["diff", "--no-ext-diff", "--no-textconv", "--name-only", "-z", "HEAD", "--"], options)) !== ""
    || [...changes.values()].some((change) => change.untracked);
  const value = {
    schemaVersion: CONTRACT_VERSION,
    capturedAt: clock().toISOString(),
    change: {
      baseRef,
      baseRevision: mergeBase,
      dirty,
      headRevision,
      kind: "local",
      repositoryLabel: repository ? `${repository.owner}/${repository.name}` : basename(root),
    },
    files,
    limits,
    ...(repository ? { repository } : {}),
    settings: { locale, localeSource, theme, themeSource },
    snapshot: { base: mergeBase, head: headRevision, mergeBase },
    sources,
  };
  return Object.freeze({
    snapshot: Object.freeze({ ...value, digest: digestJson(value) }),
    workingTree: Object.freeze({
      digest,
      paths: Object.freeze(paths),
      root,
      untracked,
    }),
  });
}

// Head context is working-tree text, so it must still read the same at publication.
async function headContextMatches(snapshot, root) {
  for (const source of snapshot.sources) {
    if (source.kind !== "context-file" || source.revision !== snapshot.snapshot.head) continue;
    const content = asText(await readWorkingFile(root, source.path));
    if (content.state !== "text" || content.text !== source.text) return false;
  }
  return true;
}

/** The review is current while the merge base, changed paths, their bytes, and head context are unchanged. */
export async function revalidateLocalSnapshot(snapshot, workingTree, { clock = () => new Date(), exec } = {}) {
  const options = exec ? { exec } : {};
  try {
    if (await realpath(workingTree.root) !== workingTree.root) throw new Error("The reviewed repository path was replaced");
    const baseTip = await resolveCommit(workingTree.root, snapshot.change.baseRef, options);
    const mergeBase = (await git(workingTree.root, ["merge-base", "HEAD", baseTip], options)).trim();
    const paths = [...(await changedPaths(workingTree.root, snapshot.snapshot.mergeBase, workingTree.untracked, options)).keys()].sort();
    const matches = mergeBase === snapshot.snapshot.mergeBase
      && JSON.stringify(paths) === JSON.stringify([...workingTree.paths].sort())
      && await workingTreeDigest(workingTree.root, workingTree.paths) === workingTree.digest
      && await headContextMatches(snapshot, workingTree.root);
    return Object.freeze({ matches, revalidatedAt: clock().toISOString() });
  } catch (error) {
    throw new RetryableLocalAccessError(`Hope could not recheck the local repository: ${error.message}`, { cause: error });
  }
}

/** Context adapter: head reads the working tree, merge-base reads Git objects. */
export function localContextSource(workingTree, options = {}) {
  return async ({ path, revision, revisionKind }) => {
    const content = revisionKind === "head"
      ? await readWorkingFile(workingTree.root, path)
      : await readBaseFile(workingTree.root, (await baseEntries(workingTree.root, revision, [path], options)).get(path), options);
    return content.state === "absent" ? { state: "not-found" } : asText(content);
  };
}
