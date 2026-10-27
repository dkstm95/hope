import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { finalizeReview, preflightReviewOutput } from "./artifact.mjs";
import { bundleIndex, bundleParts } from "./bundle.mjs";
import { ANALYSIS_VERSION, LIMITS } from "./constants.mjs";
import {
  collectContext,
  githubContextSource,
  snapshotWithContext,
} from "./context.mjs";
import {
  collectGitHubPullRequest,
  isRetryableGitHubAccessError,
  parseGitHubPullRequestUrl,
  revalidateGitHubSnapshot,
} from "./github.mjs";
import {
  collectLocalChange,
  findRepositoryRoot,
  isRetryableLocalAccessError,
  localContextSource,
  revalidateLocalSnapshot,
} from "./local.mjs";
import { resolveDisplayOptions } from "./locales/index.mjs";
import {
  createRun,
  loadRun,
  removeRun,
  replaceRunFile,
  writeRunFile,
} from "./run.mjs";
import { readBoundedJson } from "./structured-input.mjs";
import {
  discoverGitHubPullRequest,
  resolveGitHubPullRequestNumber,
} from "./target.mjs";
import { validateAnalysis } from "./validate.mjs";

export const DIFF_REVALIDATION_RETRYABLE_CODE = "HOPE_DIFF_REVALIDATION_RETRYABLE";
export const DIFF_PUBLICATION_RETRYABLE_CODE = "HOPE_DIFF_PUBLICATION_RETRYABLE";
export const DIFF_CLEANUP_FAILED_CODE = "HOPE_DIFF_CLEANUP_FAILED";
export const DIFF_RENDER_FAILED_CODE = "HOPE_DIFF_RENDER_FAILED";

const analysisSchemaPath = fileURLToPath(new URL("./analysis-v6.schema.json", import.meta.url));
const MINIMUM_BUNDLE_BYTES = 4 * 1024;

function nextSteps(run, analysisPath) {
  return Object.freeze({
    read: "Read bundle/index.json and every bundle part it lists before writing analysis.",
    write: analysisPath,
    validate: Object.freeze(["validate", "--run", run]),
    publish: Object.freeze(["publish", "--run", run]),
  });
}

function bundlePaths(runPath, parts) {
  return Object.freeze(parts.map((part) => join(runPath, "bundle", part.name)));
}

/** Choose the change source and report which rule selected it. */
export async function resolveCaptureTarget({
  base,
  pullRequestNumber,
  untracked,
  url,
} = {}, dependencies = {}) {
  if (url && pullRequestNumber !== undefined) throw new TypeError("Hope diff accepts one pull request target");
  const explicitPullRequest = url !== undefined || pullRequestNumber !== undefined;
  if (explicitPullRequest && (base !== undefined || untracked)) {
    throw new TypeError("--base and --untracked apply only to local changes, not a pull request");
  }
  if (url) return Object.freeze({ kind: "github", selection: "explicit-url", target: parseGitHubPullRequestUrl(url) });
  if (pullRequestNumber !== undefined) {
    const target = await (dependencies.resolveNumberTarget ?? resolveGitHubPullRequestNumber)(
      pullRequestNumber,
      dependencies.targetOptions,
    );
    return Object.freeze({ kind: "github", selection: "explicit-number", target });
  }
  if (base !== undefined) return Object.freeze({ base, kind: "local", selection: "explicit-base", untracked: Boolean(untracked) });
  try {
    const target = await (dependencies.discoverTarget ?? discoverGitHubPullRequest)(dependencies.targetOptions);
    if (untracked) throw new TypeError("--untracked applies only to local changes, not a pull request");
    return Object.freeze({ kind: "github", selection: target.selection, target });
  } catch (error) {
    if (error instanceof TypeError) throw error;
    const root = await (dependencies.findRepositoryRoot ?? findRepositoryRoot)(dependencies.cwd);
    if (!root) throw error;
    return Object.freeze({
      discovery: error.message,
      kind: "local",
      selection: "local-default-base",
      untracked: Boolean(untracked),
    });
  }
}

function bundleBytes(value) {
  if (value === undefined) return LIMITS.bundleBytes;
  if (!Number.isSafeInteger(value) || value < MINIMUM_BUNDLE_BYTES || value > LIMITS.snapshotBytes) {
    throw new RangeError(`--bundle-bytes must be an integer from ${MINIMUM_BUNDLE_BYTES} to ${LIMITS.snapshotBytes}`);
  }
  return value;
}

async function removeAfterFailure(run, error, options) {
  try {
    await removeRun(run, options);
  } catch (cleanupError) {
    error.cleanupError = cleanupError;
    if (cleanupError?.code === "HOPE_DIFF_RUN_REPLACED") error.preservedPath = cleanupError.preservedPath;
    else error.cleanupPending = true;
  }
  return error;
}

export async function captureDiff({
  base,
  bundleBytes: requestedBundleBytes,
  hostLocale,
  locale,
  outputPath,
  pullRequestNumber,
  theme,
  untracked,
  url,
} = {}, dependencies = {}) {
  const maxBytes = bundleBytes(requestedBundleBytes);
  const preparedOutputPath = await (dependencies.preflightOutput ?? preflightReviewOutput)(outputPath);
  const display = await resolveDisplayOptions({ hostLocale, locale, theme });
  const selected = await resolveCaptureTarget({ base, pullRequestNumber, untracked, url }, dependencies);
  const settings = {
    clock: dependencies.clock,
    locale: display.locale,
    localeSource: display.localeSource,
    theme: display.theme,
    themeSource: display.themeSource,
  };
  let snapshot;
  let workingTree;
  if (selected.kind === "github") {
    snapshot = await (dependencies.collect ?? collectGitHubPullRequest)(selected.target, { ...settings, gh: dependencies.gh });
  } else {
    ({ snapshot, workingTree } = await (dependencies.collectLocal ?? collectLocalChange)({
      ...settings,
      base: selected.base,
      cwd: dependencies.cwd,
      untracked: selected.untracked,
    }));
  }
  const parts = bundleParts(snapshot.sources, { maxBytes });
  const run = await createRun({
    analysisVersion: ANALYSIS_VERSION,
    bundleBytes: maxBytes,
    outputPath: preparedOutputPath,
    parts: parts.map(({ bytes, name, sourceIds }) => ({ bytes, name, sourceIds })),
    source: selected.kind,
    ...(workingTree ? { workingTree } : {}),
  }, { clock: dependencies.clock, temporaryRoot: dependencies.temporaryRoot });
  try {
    await writeRunFile(run.path, "snapshot.json", snapshot);
    await mkdir(join(run.path, "bundle"), { mode: 0o700 });
    for (const part of parts) await writeRunFile(run.path, join("bundle", part.name), part.text);
    await writeRunFile(run.path, join("bundle", "index.json"), bundleIndex(snapshot, { parts, runId: run.runId }));
    await writeRunFile(run.path, "notes.md", "");
  } catch (error) {
    throw await removeAfterFailure(run, error, dependencies);
  }
  const analysisPath = join(run.path, "analysis.json");
  return Object.freeze({
    analysisPath,
    analysisSchemaPath,
    analysisSchemaVersion: ANALYSIS_VERSION,
    bundleIndexPath: join(run.path, "bundle", "index.json"),
    bundleParts: bundlePaths(run.path, parts),
    change: snapshot.change,
    ...(selected.discovery ? { discovery: selected.discovery } : {}),
    locale: display.locale,
    next: nextSteps(run.path, analysisPath),
    notesPath: join(run.path, "notes.md"),
    preservedRunPaths: run.preservedRunPaths,
    runId: run.runId,
    runPath: run.path,
    selection: selected.selection,
    snapshotDigest: snapshot.digest,
    theme: display.theme,
  });
}

export async function addDiffContext(runPath, requests, dependencies = {}) {
  const run = await loadRun(runPath, dependencies);
  const readSource = run.manifest.source === "local"
    ? localContextSource(run.manifest.workingTree)
    : githubContextSource(run.snapshot, { gh: dependencies.gh });
  const candidates = await collectContext(run.snapshot, requests, { readSource });
  const snapshot = snapshotWithContext(run.snapshot, candidates);
  const parts = bundleParts(snapshot.sources.slice(run.snapshot.sources.length), {
    firstNumber: run.manifest.parts.length + 1,
    maxBytes: run.manifest.bundleBytes,
  });
  const allParts = [...run.manifest.parts, ...parts.map(({ bytes, name, sourceIds }) => ({ bytes, name, sourceIds }))];
  for (const part of parts) await writeRunFile(run.path, join("bundle", part.name), part.text);
  await replaceRunFile(run.path, "run.json", { ...run.manifest, parts: allParts });
  await replaceRunFile(run.path, "snapshot.json", snapshot);
  await replaceRunFile(run.path, join("bundle", "index.json"), bundleIndex(snapshot, { parts: allParts, runId: run.manifest.runId }));
  const analysisPath = join(run.path, "analysis.json");
  return Object.freeze({
    added: Object.freeze(candidates.map((candidate) => Object.freeze(candidate.kind === "context-file"
      ? { kind: candidate.kind, path: candidate.path, revision: candidate.revision }
      : { kind: candidate.kind, path: candidate.path, reasonKind: candidate.reasonKind, revision: candidate.revision }))),
    bundleIndexPath: join(run.path, "bundle", "index.json"),
    bundleParts: bundlePaths(run.path, parts),
    next: nextSteps(run.path, analysisPath),
    runPath: run.path,
    snapshotDigest: snapshot.digest,
  });
}

async function validateRunAnalysis(run, dependencies = {}) {
  try {
    const analysis = await readBoundedJson(join(run.path, "analysis.json"), {
      label: "Hope diff analysis",
      maximumBytes: LIMITS.modelBytes,
    });
    return await (dependencies.validate ?? validateAnalysis)(analysis.value, run.snapshot, {
      analysisFileBytes: analysis.fileBytes,
      runId: run.manifest.runId,
    });
  } catch (error) {
    error.code = "HOPE_ANALYSIS_INVALID";
    error.canRetry = true;
    error.runPath = run.path;
    throw error;
  }
}

export async function validateDiff(runPath, dependencies = {}) {
  const run = await loadRun(runPath, dependencies);
  const validated = await validateRunAnalysis(run, dependencies);
  return Object.freeze({
    next: Object.freeze({ publish: Object.freeze(["publish", "--run", run.path]) }),
    resources: validated.resources,
    runId: run.manifest.runId,
    snapshotDigest: run.snapshot.digest,
    valid: true,
  });
}

function retryable(error, code, message, runPath) {
  const original = error instanceof Error ? error : new Error(String(error));
  const failure = new Error(message ?? original.message, { cause: original });
  failure.code = code;
  failure.canRetry = true;
  failure.command = "publish";
  failure.runPath = runPath;
  return failure;
}

async function revalidate(run, dependencies) {
  try {
    return run.manifest.source === "local"
      ? await (dependencies.revalidateLocal ?? revalidateLocalSnapshot)(run.snapshot, run.manifest.workingTree, { clock: dependencies.clock })
      : await (dependencies.revalidate ?? revalidateGitHubSnapshot)(run.snapshot, { clock: dependencies.clock, gh: dependencies.gh });
  } catch (error) {
    if (!isRetryableGitHubAccessError(error) && !isRetryableLocalAccessError(error)) throw error;
    throw retryable(
      error,
      DIFF_REVALIDATION_RETRYABLE_CODE,
      `Hope could not recheck the reviewed change, so no review was created. ${error.message} `
        + "The private review run was kept. Restore access, then retry publish with the same run.",
      run.path,
    );
  }
}

export async function publishDiff(runPath, dependencies = {}) {
  const run = await loadRun(runPath, dependencies);
  const validated = await validateRunAnalysis(run, dependencies);
  let rendered;
  try {
    rendered = dependencies.render
      ? await dependencies.render(validated)
      : await (await import("./render.mjs")).renderReview(validated);
  } catch (error) {
    error.code ??= DIFF_RENDER_FAILED_CODE;
    error.canRetry = false;
    error.runPath = run.path;
    throw error;
  }
  const revalidation = await revalidate(run, dependencies);
  if (!revalidation.matches) {
    const error = new Error("The change moved while Hope was reviewing it. No review was created; capture it again.");
    error.code = "HOPE_DIFF_STALE";
    throw await removeAfterFailure(run, error, dependencies);
  }
  let ticket;
  try {
    ticket = await (dependencies.finalize ?? finalizeReview)(rendered.bytes, {
      artifactDigest: rendered.digest,
      outputPath: run.manifest.outputPath,
      revalidatedAt: revalidation.revalidatedAt,
      runId: run.manifest.runId,
      snapshotDigest: run.snapshot.digest,
      temporaryRoot: dependencies.temporaryRoot,
    });
  } catch (error) {
    throw retryable(
      error,
      DIFF_PUBLICATION_RETRYABLE_CODE,
      `${error.message} The private review run was kept. Fix the publication problem, then retry publish with the same run.`,
      run.path,
    );
  }
  try {
    await removeRun(run, dependencies);
  } catch (error) {
    const failure = new Error(
      `Hope created the review at ${ticket.outputPath}, but could not remove its private review data. Do not retry publish.`,
      { cause: error },
    );
    failure.code = DIFF_CLEANUP_FAILED_CODE;
    failure.outputPath = ticket.outputPath;
    failure.runPath = run.path;
    if (error?.preservedPath !== undefined) failure.preservedPath = error.preservedPath;
    throw failure;
  }
  return Object.freeze({
    ...ticket,
    change: run.snapshot.change,
    resources: Object.freeze({ ...validated.resources, artifactBytes: rendered.bytes.length }),
    result: validated.result,
  });
}

export async function cancelDiff(runPath, dependencies = {}) {
  await removeRun(await loadRun(runPath, dependencies), dependencies);
}
