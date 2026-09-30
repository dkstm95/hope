import { isUtf8 } from "node:buffer";
import { execFile as execFileCallback } from "node:child_process";
import { lstat, mkdtemp, realpath, rmdir, unlink, writeFile } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { digest, indexChanges, LIMITS, parsePatch, restriction, safePath, text } from "./changes.mjs";

const execFile = promisify(execFileCallback);
const shaPattern = /^[a-f0-9]{40}$/u;
const repositoryPattern = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u;

export function parseTarget(value) {
  const match = typeof value === "string" && value.match(
    /^https:\/\/github\.com\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)\/pull\/([1-9][0-9]*)\/?$/u,
  );
  if (!match || !Number.isSafeInteger(Number(match[3]))) {
    throw new TypeError("Use a canonical https://github.com/owner/repo/pull/123 URL");
  }
  return { owner: match[1], repo: match[2], number: Number(match[3]), url: value.replace(/\/$/u, "") };
}

async function command(name, args, options = {}) {
  try {
    return await (options.exec ?? execFile)(name, args, {
      cwd: options.cwd,
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`${name} read failed. Check installation, authentication, and access.`, { cause: error });
  }
}

export async function resolveTarget(value, options = {}) {
  if (value?.startsWith("https://")) return parseTarget(value);
  if (value !== undefined && !/^[1-9][0-9]*$/u.test(value)) {
    throw new TypeError("Expected a PR URL or positive PR number");
  }
  const args = ["pr", "view", ...(value ? [value] : []), "--json", "url"];
  const result = await command("gh", args, options);
  return parseTarget(JSON.parse(result.stdout).url);
}

export async function api(path, options = {}) {
  const response = await command("gh", [
    "api", "--hostname", "github.com", "--method", "GET",
    "-H", "Accept: application/vnd.github+json", path,
  ], options);
  return JSON.parse(response.stdout);
}

function validatePull(pull, target) {
  if (pull.number !== target.number
    || !shaPattern.test(pull.base?.sha) || !shaPattern.test(pull.head?.sha)
    || !repositoryPattern.test(pull.base?.repo?.full_name)
    || (pull.head?.repo !== null && !repositoryPattern.test(pull.head?.repo?.full_name))
    || !["changed_files", "additions", "deletions"].every((key) => (
      Number.isSafeInteger(pull[key]) && pull[key] >= 0
    ))) throw new Error("GitHub returned invalid PR identity or accounting");
  if (pull.changed_files > LIMITS.files || pull.additions + pull.deletions > LIMITS.lines) {
    throw new Error(`Diff Deep supports up to ${LIMITS.files} files and ${LIMITS.lines} changed lines`);
  }
}

export async function currentTarget(target, options = {}) {
  const pull = await api(`/repos/${target.owner}/${target.repo}/pulls/${target.number}`, options);
  validatePull(pull, target);
  return pull;
}

async function filePages(target, count, options) {
  const values = [];
  for (let page = 1; values.length < count; page += 1) {
    const result = await api(
      `/repos/${target.owner}/${target.repo}/pulls/${target.number}/files?per_page=100&page=${page}`, options,
    );
    if (!Array.isArray(result) || result.length > 100) throw new Error("Invalid changed-file page");
    values.push(...result);
    if (result.length < 100) break;
  }
  if (values.length !== count) throw new Error("GitHub did not return every changed file");
  return values;
}

async function body(repository, path, revision, options) {
  if (!repository) return { reason: "repository-unavailable" };
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  let value;
  try { value = await api(`/repos/${repository}/contents/${encoded}?ref=${revision}`, options); }
  catch { return { reason: "source-unavailable" }; }
  if (value?.type !== "file") return { reason: "special-entry" };
  if (!Number.isSafeInteger(value.size) || value.size < 0) throw new Error("Invalid source size");
  if (value.size > LIMITS.fileBytes) return { reason: "size-limit" };
  if (value.encoding !== "base64" || typeof value.content !== "string") return { reason: "source-unavailable" };
  const bytes = Buffer.from(value.content.replace(/\s/gu, ""), "base64");
  if (bytes.length !== value.size) throw new Error("GitHub returned an incomplete file body");
  if (!isUtf8(bytes) || bytes.includes(0)) return { reason: "binary" };
  return { text: bytes.toString("utf8") };
}

/** Reconstruct only missing/truncated patches, without cloning or running repository code. */
export async function diffText(before, after) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "hope-deep-patch-"));
  const directoryIdentity = await lstat(directory);
  const identities = new Map();
  try {
    for (const [name, value] of [["before", before], ["after", after]]) {
      const path = join(directory, name);
      await writeFile(path, value, { flag: "wx", mode: 0o600 });
      identities.set(path, await lstat(path));
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith("GIT_")));
    env.GIT_CONFIG_NOSYSTEM = "1";
    env.GIT_CONFIG_GLOBAL = devNull;
    let output;
    try {
      output = await execFile("git", [
        "-c", `core.attributesFile=${devNull}`, "-c", "diff.algorithm=myers",
        "diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--text", "--unified=3",
        "--", "before", "after",
      ], { cwd: directory, env, encoding: "utf8", shell: false, timeout: 10_000, maxBuffer: LIMITS.fileBytes * 4 });
    } catch (error) {
      if (error.code !== 1 || typeof error.stdout !== "string") throw new Error("Cannot reconstruct this patch");
      output = error;
    }
    const start = output.stdout.indexOf("@@ ");
    return start === -1 ? "" : output.stdout.slice(start).replace(/\n$/u, "");
  } finally {
    // Remove only the exact files this invocation created; preserve replacements.
    const actual = await lstat(directory);
    if (actual.dev !== directoryIdentity.dev || actual.ino !== directoryIdentity.ino || actual.isSymbolicLink()) {
      throw new Error(`Temporary patch directory changed; preserved ${directory}`);
    }
    for (const [path, expected] of identities) {
      const current = await lstat(path);
      if (current.dev !== expected.dev || current.ino !== expected.ino || current.isSymbolicLink()) {
        throw new Error(`Temporary patch file changed; preserved ${directory}`);
      }
      await unlink(path);
    }
    await rmdir(directory);
  }
}

async function collectFile(provider, pull, mergeBase, options) {
  const path = safePath(provider.filename);
  const previousPath = provider.previous_filename === undefined ? undefined : safePath(provider.previous_filename);
  if (!["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"].includes(provider.status)
    || ![provider.additions, provider.deletions].every((number) => Number.isSafeInteger(number) && number >= 0)) {
    throw new Error("GitHub returned invalid file accounting");
  }
  const file = { path, ...(previousPath ? { previousPath } : {}), status: provider.status,
    additions: provider.additions, deletions: provider.deletions };
  const blocked = restriction(path) ?? restriction(previousPath ?? path);
  if (blocked) return { ...file, availability: "unavailable", reason: blocked };
  let patch = provider.patch;
  if (typeof patch === "string" && Buffer.byteLength(patch) <= LIMITS.fileBytes) {
    const secret = restriction(path, [patch]);
    if (secret) return { ...file, availability: "unavailable", reason: secret };
    try {
      parsePatch(patch, file);
      return { ...file, availability: "text", patch };
    } catch { /* A partial provider patch is reconstructed from exact revisions. */ }
  }
  if (file.additions === 0 && file.deletions === 0) {
    return { ...file, availability: file.status === "renamed" ? "metadata" : "unavailable",
      reason: file.status === "renamed" ? "rename-only" : "no-text-diff" };
  }
  const [before, after] = await Promise.all([
    file.status === "added" ? { text: "" }
      : body(pull.base.repo.full_name, previousPath ?? path, mergeBase, options),
    file.status === "removed" ? { text: "" }
      : body(pull.head.repo?.full_name, path, pull.head.sha, options),
  ]);
  const reason = before.reason ?? after.reason;
  if (reason) return { ...file, availability: "unavailable", reason };
  const secret = restriction(path, [before.text, after.text]);
  if (secret) return { ...file, availability: "unavailable", reason: secret };
  try {
    patch = await (options.diffText ?? diffText)(before.text, after.text);
    parsePatch(patch, file);
  } catch {
    return { ...file, availability: "unavailable", reason: "patch-incomplete" };
  }
  return { ...file, availability: "text", patch };
}

function source(id, kind, label, url, bodyText) {
  const content = String(bodyText ?? "");
  if (!content.trim() || Buffer.byteLength(content) > LIMITS.sourceBytes || restriction("statement", [content])) return undefined;
  return { id, kind, label, url, text: content };
}

export async function collectPullRequest(targetValue, options = {}) {
  const target = typeof targetValue === "string" ? parseTarget(targetValue) : parseTarget(targetValue.url);
  const pull = await currentTarget(target, options);
  const prefix = `/repos/${target.owner}/${target.repo}`;
  const [providerFiles, comparison] = await Promise.all([
    filePages(target, pull.changed_files, options),
    api(`${prefix}/compare/${pull.base.sha}...${pull.head.sha}`, options),
  ]);
  const mergeBase = comparison?.merge_base_commit?.sha;
  if (!shaPattern.test(mergeBase)) throw new Error("GitHub did not provide an exact merge base");
  const files = [];
  let totalBytes = 0;
  // Bound parallel reads, especially for PRs with many missing patches.
  for (let index = 0; index < providerFiles.length; index += 4) {
    const batch = await Promise.all(providerFiles.slice(index, index + 4).map(
      (file) => collectFile(file, pull, mergeBase, options),
    ));
    for (const file of batch) {
      totalBytes += Buffer.byteLength(file.patch ?? "");
      if (totalBytes > LIMITS.totalBytes) throw new Error("Changed text exceeds the capture limit; no partial artifact was created");
      files.push(file);
    }
  }
  if (files.reduce((sum, file) => sum + file.additions, 0) !== pull.additions
    || files.reduce((sum, file) => sum + file.deletions, 0) !== pull.deletions) {
    throw new Error("Changed-file totals do not match the pull request");
  }
  const latest = await currentTarget(target, options);
  if (latest.base.sha !== pull.base.sha || latest.head.sha !== pull.head.sha) {
    throw new Error("The PR changed during capture; capture it again");
  }
  const title = restriction("title", [String(pull.title)]) ? "Pull request" : text(pull.title, "PR title", 4_000);
  const sources = [source("pr-description", "statement", "PR", target.url, `${title}\n\n${pull.body ?? ""}`)].filter(Boolean);
  const inventory = indexChanges(files);
  const core = { target, base: pull.base.sha, head: pull.head.sha, mergeBase,
    baseRepository: pull.base.repo.full_name, headRepository: pull.head.repo?.full_name ?? null,
    files: inventory.files };
  const snapshot = { schemaVersion: 1, id: digest(core), ...core, changes: inventory.changes,
    title, capturedAt: (options.now ?? (() => new Date()))().toISOString(), sources };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > LIMITS.snapshotBytes) throw new Error("Snapshot exceeds its size limit");
  return snapshot;
}

/** Read a specifically selected issue/PR as rationale; never follow repository instructions. */
export async function collectStatement(url, options = {}) {
  const match = String(url).match(/^https:\/\/github\.com\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)\/([A-Za-z0-9_-][A-Za-z0-9_.-]*)\/(issues|pull)\/([1-9][0-9]*)$/u);
  if (!match || !Number.isSafeInteger(Number(match[4]))) throw new TypeError("Use an exact GitHub issue or PR URL");
  const entry = await api(`/repos/${match[1]}/${match[2]}/${match[3] === "pull" ? "pulls" : "issues"}/${match[4]}`, options);
  const result = source(`s-${digest(url).slice(0, 20)}`, "statement", `#${match[4]}`, url, `${entry.title ?? ""}\n\n${entry.body ?? ""}`);
  if (!result) throw new Error("The requested rationale source is empty, restricted, or too large");
  return result;
}
