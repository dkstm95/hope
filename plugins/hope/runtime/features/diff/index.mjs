// Generated from features/diff/index.mjs. Do not edit.
import { lstat, open, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { resolveSettings } from "../../settings/index.mjs";
import {
  createWritingStandard,
  loadWritingStandard,
} from "../write/index.mjs";
import { readBoundedJson } from "../work-snapshot/index.mjs";
import {
  ANALYSIS_VERSION,
  LIMITS,
} from "./constants.mjs";
import {
  checkpointCount,
  diffLedgerView,
  resolveContextRequestIds,
} from "./checkpoint.mjs";
import { collectGitHubContext } from "./context.mjs";
import { finalizeReview, preflightReviewOutput } from "./finalize.mjs";
import {
  collectGitHubPullRequest,
  isRetryableGitHubAccessError,
  parseGitHubPullRequestUrl,
  revalidateGitHubSnapshot,
} from "./github.mjs";
import { digestJson } from "./hash.mjs";
import {
  createDiffInvocationContract,
  createDiffPendingConfirmation,
  transitionDiffPendingConfirmation,
  transitionDiffPendingConfirmationInput,
} from "./invocation.mjs";
import {
  appendDiffRunPlan,
  checkpointDiffRun,
  claimDiffRunFinalization,
  createDiffRun,
  inspectDiffRun,
  inspectionPageView,
  loadDiffRun,
  readDiffGenerationPage,
  recordAnalysisFailure,
  removeDiffRun,
} from "./run.mjs";
import {
  discoverGitHubPullRequest,
  resolveGitHubPullRequestNumber,
} from "./target.mjs";
import {
  createMicroworldSkeleton,
  createTeachingAidContract,
} from "./teaching-aids.mjs";
import { validateAnalysis } from "./validate.mjs";

export {
  createDiffInvocationContract,
  createDiffPendingConfirmation,
  transitionDiffPendingConfirmation,
  transitionDiffPendingConfirmationInput,
} from "./invocation.mjs";

export const DIFF_MODEL_ADAPTER_CODE = "HOPE_DIFF_MODEL_ADAPTER_REQUIRED";
export const DIFF_MODEL_ADAPTER_MESSAGE =
  "Automatic Hope diff analysis currently runs through the Claude or Codex skill.";
export const DIFF_REVALIDATION_RETRYABLE_CODE =
  "HOPE_DIFF_REVALIDATION_RETRYABLE";
export const DIFF_REVALIDATION_RETRYABLE_MESSAGE =
  "Hope could not revalidate the pull request, so no review was created. "
  + "The private review run was kept. Restore GitHub access, then retry finish "
  + "with the same run.";

export async function resolveDiffTarget({
  pullRequestNumber,
  url,
} = {}, dependencies = {}) {
  if (url && pullRequestNumber !== undefined) {
    throw new TypeError("Hope diff accepts one pull request target");
  }
  if (url) return parseGitHubPullRequestUrl(url);
  if (pullRequestNumber !== undefined) {
    return await (
      dependencies.resolveNumberTarget ?? resolveGitHubPullRequestNumber
    )(pullRequestNumber, dependencies.targetOptions);
  }
  return await (dependencies.discoverTarget ?? discoverGitHubPullRequest)(
    dependencies.targetOptions,
  );
}

async function readDiffInvocationInput(inputPath, dependencies = {}) {
  return await (dependencies.readInvocationInput ?? readBoundedJson)(inputPath, {
    label: "Hope diff invocation input",
    maximumBytes: LIMITS.modelBytes,
  });
}

export async function createDiffConfirmationFromFile(
  inputPath,
  dependencies = {},
) {
  const { value } = await readDiffInvocationInput(inputPath, dependencies);
  return createDiffPendingConfirmation(value);
}

export async function transitionDiffConfirmationFromFile(
  inputPath,
  dependencies = {},
) {
  const { value } = await readDiffInvocationInput(inputPath, dependencies);
  return transitionDiffPendingConfirmationInput(value);
}

async function readPrivateJson(path, {
  label,
  maximumBytes = LIMITS.modelBytes,
} = {}) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Hope ${label} is not a regular file`);
  }
  if (info.size > maximumBytes) {
    throw new Error(`Hope ${label} exceeds ${maximumBytes} bytes`);
  }
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== info.dev
      || opened.ino !== info.ino
      || opened.size !== info.size
    ) {
      throw new Error(`Hope ${label} changed while being opened`);
    }
    const bytes = await handle.readFile();
    const completed = await handle.stat();
    if (
      !completed.isFile()
      || completed.dev !== opened.dev
      || completed.ino !== opened.ino
      || completed.size !== opened.size
      || completed.mtimeMs !== opened.mtimeMs
      || completed.ctimeMs !== opened.ctimeMs
      || bytes.length !== completed.size
    ) {
      throw new Error(`Hope ${label} changed while being read`);
    }
    if (bytes.length > maximumBytes) {
      throw new Error(`Hope ${label} exceeds ${maximumBytes} bytes`);
    }
    return Object.freeze({
      fileBytes: bytes.length,
      value: JSON.parse(bytes.toString("utf8")),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Hope ${label} is not valid JSON`, { cause: error });
    }
    throw error;
  } finally {
    await handle.close();
  }
}

async function readAnalysis(path, options = {}) {
  return await readPrivateJson(path, { ...options, label: "analysis" });
}

function assertAnalysisReady(run) {
  const analysisReady = run.manifest.phase === "inspected"
    || (
      run.manifest.phase === "analysis-invalid"
      && run.manifest.analysisAttempts === 1
    );
  if (
    !analysisReady
    || run.manifest.deliveredPage !== run.manifest.pageCount
    || checkpointCount(run.ledger, run.manifest.generation)
      !== run.manifest.pageCount
  ) {
    throw new Error(
      "Read and checkpoint every Hope inspection page before submitting analysis",
    );
  }
}

function nextNumericId(values, prefix) {
  return values.reduce((maximum, value) => {
    const match = typeof value.id === "string"
      ? value.id.match(new RegExp(`^${prefix}-([1-9][0-9]*)$`, "u"))
      : undefined;
    return match ? Math.max(maximum, Number.parseInt(match[1], 10)) : maximum;
  }, 0) + 1;
}

function snapshotWithContext(snapshot, candidates) {
  const sources = [...snapshot.sources];
  const limits = [...snapshot.limits];
  let sourceNumber = nextNumericId(sources, "source");
  let limitNumber = nextNumericId(limits, "limit");
  for (const candidate of candidates) {
    if (candidate.kind === "context-file") {
      sources.push(Object.freeze({
        id: `source-${sourceNumber}`,
        kind: candidate.kind,
        lineCount: candidate.text.split("\n").length,
        path: candidate.path,
        revision: candidate.revision,
        text: candidate.text,
      }));
      sourceNumber += 1;
    } else {
      limits.push(Object.freeze({
        id: `limit-${limitNumber}`,
        kind: candidate.kind,
        reason: candidate.reason,
        reasonKind: candidate.reasonKind,
        revision: candidate.revision,
        subject: candidate.path,
      }));
      limitNumber += 1;
    }
  }
  const { digest: _digest, ...previous } = snapshot;
  const value = {
    ...previous,
    limits: Object.freeze(limits),
    sources: Object.freeze(sources),
  };
  return Object.freeze({
    ...value,
    digest: digestJson(value),
  });
}

async function validateRunAnalysis(run, dependencies = {}) {
  const analysis = await readAnalysis(run.analysisPath, {
    maximumBytes: LIMITS.modelBytes,
  });
  return (dependencies.validate ?? validateAnalysis)(
    analysis.value,
    run.snapshot,
    {
      analysisFileBytes: analysis.fileBytes,
      runId: run.manifest.runId,
    },
  );
}

async function renderValidatedAnalysis(validated, dependencies = {}) {
  if (dependencies.render) return await dependencies.render(validated);
  const module = await (dependencies.loadRenderer ?? (() => import("./render.mjs")))();
  return await module.renderReview(validated);
}

function withCleanupFailure(error, cleanupError) {
  const original = error instanceof Error ? error : new Error(String(error));
  const combined = new Error(
    `${original.message} Hope could not remove its private review data after this failure. `
      + "It remains in restricted temporary storage and a later Hope run will retry expiry cleanup.",
    { cause: original },
  );
  combined.name = original.name;
  if (original.code !== undefined) combined.code = original.code;
  if (original.canRetry !== undefined) combined.canRetry = original.canRetry;
  if (original.command !== undefined) combined.command = original.command;
  if (original.runPath !== undefined) combined.runPath = original.runPath;
  combined.cleanupPending = true;
  Object.defineProperty(combined, "cleanupError", {
    configurable: false,
    enumerable: false,
    value: cleanupError,
    writable: false,
  });
  return combined;
}

function withFinalizationReleaseFailure(error, releaseError) {
  const original = error instanceof Error ? error : new Error(String(error));
  const combined = new Error(
    `${original.message} Hope also could not release its private finalization lease. `
      + "A later Hope run will retry expiry cleanup.",
    { cause: original },
  );
  combined.name = original.name;
  if (original.code !== undefined) combined.code = original.code;
  if (original.canRetry !== undefined) combined.canRetry = original.canRetry;
  if (original.command !== undefined) combined.command = original.command;
  if (original.runPath !== undefined) combined.runPath = original.runPath;
  combined.cleanupPending = true;
  if (original.cleanupError !== undefined) {
    Object.defineProperty(combined, "cleanupError", {
      configurable: false,
      enumerable: false,
      value: original.cleanupError,
      writable: false,
    });
  }
  Object.defineProperty(combined, "releaseError", {
    configurable: false,
    enumerable: false,
    value: releaseError,
    writable: false,
  });
  return combined;
}

function revalidationRetryable(error, runPath) {
  const original = error instanceof Error ? error : new Error(String(error));
  const retryable = new Error(
    DIFF_REVALIDATION_RETRYABLE_MESSAGE,
    { cause: original },
  );
  retryable.code = DIFF_REVALIDATION_RETRYABLE_CODE;
  retryable.canRetry = true;
  retryable.command = "finish";
  retryable.runPath = runPath;
  return retryable;
}

export async function prepareDiff({
  hostLocale,
  locale,
  outputPath,
  pullRequestNumber,
  theme,
  url,
} = {}, dependencies = {}) {
  const preparedOutputPath = await (
    dependencies.preflightOutput ?? preflightReviewOutput
  )(outputPath);
  const [settings, writingStandard] = await Promise.all([
    (dependencies.resolveSettings ?? resolveSettings)({
      hostLocale,
      locale,
      theme,
      ...(dependencies.settingsOptions ?? {}),
    }),
    (dependencies.createWritingStandard ?? createWritingStandard)({
      loadStandard: dependencies.loadWritingStandard ?? loadWritingStandard,
    }),
  ]);
  const target = await resolveDiffTarget({ pullRequestNumber, url }, dependencies);
  const snapshot = await (dependencies.collect ?? collectGitHubPullRequest)(target, {
    clock: dependencies.clock,
    gh: dependencies.gh,
    locale: settings.locale,
    localeSource: settings.localeSource,
    theme: settings.theme,
    themeSource: settings.themeSource,
  });
  const run = await (dependencies.createRun ?? createDiffRun)(snapshot, {
    clock: dependencies.clock,
    outputPath: preparedOutputPath,
    temporaryRoot: dependencies.temporaryRoot,
  });
  return Object.freeze({
    ...run,
    analysisSchemaPath: fileURLToPath(
      new URL("./analysis-v2.schema.json", import.meta.url),
    ),
    analysisSchemaVersion: ANALYSIS_VERSION,
    locale: settings.locale,
    pullRequest: snapshot.pullRequest,
    selection: target.selection ?? "explicit",
    theme: settings.theme,
    teachingAids: createTeachingAidContract(),
    writingStandard,
  });
}

export async function buildMicroworldSkeleton(inputPath, dependencies = {}) {
  if (typeof inputPath !== "string" || inputPath.length === 0) {
    throw new TypeError("Hope diff microworld skeleton needs an input path");
  }
  const input = await (
    dependencies.readMicroworldInput ?? readBoundedJson
  )(inputPath, {
    label: "Hope diff microworld controls",
    maximumBytes: 32 * 1024,
  });
  return createMicroworldSkeleton(input.value);
}

export async function readDiffPage(runPath, page, dependencies = {}) {
  return await (dependencies.inspectRun ?? inspectDiffRun)(runPath, page, {
    temporaryRoot: dependencies.temporaryRoot,
  });
}

export async function checkpointDiffPage(runPath, page, dependencies = {}) {
  const result = await (
    dependencies.checkpointRun ?? checkpointDiffRun
  )(
    runPath,
    page,
    async (checkpointPath) => {
      const input = await (
        dependencies.readCheckpoint ?? readPrivateJson
      )(checkpointPath, {
      label: "checkpoint",
      maximumBytes: LIMITS.checkpointBytes,
      });
      return input.value;
    },
    { temporaryRoot: dependencies.temporaryRoot },
  );
  if (result.consumedInput) {
    await (dependencies.removeCheckpoint ?? unlink)(result.checkpointPath)
      .catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
  }
  const pending = result.ledgerState.requests
    .filter((request) => !request.collected)
    .map(({ collected: _collected, ...request }) => Object.freeze(request));
  const checkpointed = result.ledgerState.currentPage;
  const checkpointReceipt = Object.freeze({
    generation: result.checkpoint.generation,
    observationIds: result.checkpoint.observations.map(
      (observation) => observation.id,
    ),
    page: result.checkpoint.page,
    pageDigest: result.checkpoint.pageDigest,
    requestIds: result.checkpoint.observations.flatMap(
      (observation) => observation.contextRequests.map((request) => request.id),
    ),
    snapshotDigest: result.checkpoint.snapshotDigest,
  });
  return Object.freeze({
    checkpoint: checkpointReceipt,
    checkpointCount: checkpointed,
    nextPage: result.nextPage
      ? inspectionPageView(result.nextPage)
      : undefined,
    pendingContextRequests: Object.freeze(pending),
    replayed: result.replayed,
  });
}

export async function readDiffLedger(runPath, page = 1, dependencies = {}) {
  if (page && typeof page === "object") {
    dependencies = page;
    page = 1;
  }
  const run = await (dependencies.loadRun ?? loadDiffRun)(runPath, {
    temporaryRoot: dependencies.temporaryRoot,
  });
  return diffLedgerView(run.ledger, run.snapshot, { page });
}

export async function addDiffContext(runPath, requestIds, dependencies = {}) {
  const run = await (dependencies.loadRun ?? loadDiffRun)(runPath, {
    temporaryRoot: dependencies.temporaryRoot,
  });
  const operationKey = JSON.stringify([...requestIds].sort());
  const priorOperation = run.manifest.contextOperations.find(
    (operation) => JSON.stringify([...operation.requestIds].sort())
      === operationKey,
  );
  if (priorOperation) {
    let firstPage;
    if (
      priorOperation.generation === run.manifest.generation
      && run.manifest.deliveredPage <= 1
    ) {
      firstPage = await (
        dependencies.inspectRun ?? inspectDiffRun
      )(run.path, 1, { temporaryRoot: dependencies.temporaryRoot });
    } else {
      firstPage = await (
        dependencies.readGenerationPage ?? readDiffGenerationPage
      )(run.path, {
        ...priorOperation,
        page: 1,
        temporaryRoot: dependencies.temporaryRoot,
      });
    }
    return Object.freeze({
      ...priorOperation,
      firstPage: inspectionPageView(firstPage),
      path: run.path,
      replayed: true,
      runId: run.manifest.runId,
    });
  }
  if (
    run.manifest.phase !== "inspected"
    || run.manifest.deliveredPage !== run.manifest.pageCount
    || checkpointCount(run.ledger, run.manifest.generation)
      !== run.manifest.pageCount
  ) {
    throw new Error(
      "Read and checkpoint every current Hope inspection page before requesting context",
    );
  }
  const requests = resolveContextRequestIds(
    run.ledger,
    run.snapshot,
    requestIds,
  );
  const contextSources = run.snapshot.sources.filter(
    (source) => source.kind === "context-file",
  );
  const contextLimits = run.snapshot.limits.filter(
    (limit) => limit.kind === "context-unavailable",
  );
  if (contextSources.length + contextLimits.length + requests.length > LIMITS.contextFiles) {
    throw new Error(`Hope diff supports ${LIMITS.contextFiles} context file requests per run`);
  }
  const existing = new Set([
    ...contextSources.map((source) => `${source.revision}\u0000${source.path}`),
    ...contextLimits.map((limit) => `${limit.revision}\u0000${limit.subject}`),
  ]);
  for (const request of requests) {
    const revision = request?.revision === "head"
      ? run.snapshot.snapshot.head
      : request?.revision === "merge-base"
        ? run.snapshot.snapshot.mergeBase
        : undefined;
    if (revision && existing.has(`${revision}\u0000${request.path}`)) {
      throw new Error(`Hope already collected this exact context file: ${request.path}`);
    }
  }
  const candidates = await (
    dependencies.collectContext ?? collectGitHubContext
  )(run.snapshot, requests, {
    existingBytes: contextSources.reduce(
      (sum, source) => sum + Buffer.byteLength(source.text, "utf8"),
      0,
    ),
    gh: dependencies.gh,
  });
  const previousLimitCount = run.snapshot.limits.length;
  const previousSourceCount = run.snapshot.sources.length;
  const snapshot = snapshotWithContext(run.snapshot, candidates);
  const updated = await (
    dependencies.appendRunPlan ?? appendDiffRunPlan
  )(run.path, snapshot, {
    contextOperation: {
      collected: candidates.filter(
        (candidate) => candidate.kind === "context-file",
      ).length,
      limitsAdded: candidates.filter(
        (candidate) => candidate.kind === "context-unavailable",
      ).length,
      requestIds: [...requestIds],
    },
    expectedSnapshotDigest: run.snapshot.digest,
    previousLimitCount,
    previousSourceCount,
    temporaryRoot: dependencies.temporaryRoot,
  });
  const firstPage = await (
    dependencies.inspectRun ?? inspectDiffRun
  )(updated.path, 1, { temporaryRoot: dependencies.temporaryRoot });
  return Object.freeze({
    collected: candidates.filter((candidate) => candidate.kind === "context-file").length,
    firstPage: inspectionPageView(firstPage),
    generation: updated.manifest.generation,
    limitsAdded: candidates.filter(
      (candidate) => candidate.kind === "context-unavailable"
    ).length,
    pageCount: updated.manifest.pageCount,
    path: updated.path,
    resources: updated.resources,
    runId: updated.manifest.runId,
    snapshotDigest: updated.snapshot.digest,
    retainedCheckpoints: updated.ledger.checkpoints.length,
    replayed: false,
  });
}

export async function validateDiff(runPath, dependencies = {}) {
  const run = await (dependencies.loadRun ?? loadDiffRun)(runPath, {
    temporaryRoot: dependencies.temporaryRoot,
  });
  assertAnalysisReady(run);
  let validated;
  try {
    validated = await validateRunAnalysis(run, dependencies);
  } catch (error) {
    error.code = "HOPE_ANALYSIS_INVALID";
    error.canRetry = true;
    throw error;
  }
  return Object.freeze({
    runId: run.manifest.runId,
    resources: Object.freeze({
      ...run.resources,
      ...validated.resources,
    }),
    snapshotDigest: run.snapshot.digest,
    valid: true,
  });
}

export async function finishDiff(runPath, dependencies = {}) {
  const run = await (dependencies.loadRun ?? loadDiffRun)(runPath, {
    temporaryRoot: dependencies.temporaryRoot,
  });
  let finalizationClaim;
  try {
    finalizationClaim = await (
      dependencies.claimFinalization ?? claimDiffRunFinalization
    )(run);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("This Hope diff run is already being finalized");
    }
    throw error;
  }
  let primaryError;
  try {
    assertAnalysisReady(run);

    let validated;
    try {
      validated = await validateRunAnalysis(run, dependencies);
    } catch (error) {
      await finalizationClaim.renew();
      const result = await (dependencies.recordFailure ?? recordAnalysisFailure)(run, {
        temporaryRoot: dependencies.temporaryRoot,
      });
      error.code = "HOPE_ANALYSIS_INVALID";
      error.canRetry = result.canRetry;
      throw error;
    }

    let runRemoved = false;
    let preserveRun = false;
    try {
      const rendered = await renderValidatedAnalysis(validated, dependencies);
      let revalidation;
      try {
        revalidation = await (
          dependencies.revalidate ?? revalidateGitHubSnapshot
        )(run.snapshot, {
          clock: dependencies.clock,
          gh: dependencies.gh,
        });
      } catch (error) {
        if (!isRetryableGitHubAccessError(error)) throw error;
        preserveRun = true;
        throw revalidationRetryable(error, run.path);
      }
      if (!revalidation.matches) {
        const error = new Error(
          "The pull request changed while Hope was reviewing it. No review was created.",
        );
        error.code = "HOPE_DIFF_STALE";
        throw error;
      }
      await finalizationClaim.renew();
      await (dependencies.removeRun ?? removeDiffRun)(run.path, {
        temporaryRoot: dependencies.temporaryRoot,
      });
      runRemoved = true;
      const ticket = await (dependencies.finalize ?? finalizeReview)(rendered.bytes, {
        artifactDigest: rendered.digest,
        outputPath: run.manifest.outputPath,
        revalidatedAt: revalidation.revalidatedAt,
        runId: run.manifest.runId,
        snapshotDigest: run.snapshot.digest,
        temporaryRoot: dependencies.temporaryRoot,
      });
      return Object.freeze({
        ...ticket,
        pullRequest: run.snapshot.pullRequest,
        resources: Object.freeze({
          ...run.resources,
          ...validated.resources,
          artifactBytes: rendered.bytes.length,
        }),
        result: validated.result,
      });
    } catch (error) {
      if (!runRemoved && !preserveRun) {
        try {
          await finalizationClaim.renew();
          await (dependencies.removeRun ?? removeDiffRun)(run.path, {
            temporaryRoot: dependencies.temporaryRoot,
          });
        } catch (cleanupError) {
          throw withCleanupFailure(error, cleanupError);
        }
      }
      throw error;
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await finalizationClaim.release();
    } catch (releaseError) {
      if (primaryError) {
        throw withFinalizationReleaseFailure(primaryError, releaseError);
      }
      throw releaseError;
    }
  }
}

export async function cancelDiff(runPath, dependencies = {}) {
  await (dependencies.removeRun ?? removeDiffRun)(runPath, {
    temporaryRoot: dependencies.temporaryRoot,
  });
}

export function runDiff() {
  const error = new Error(DIFF_MODEL_ADAPTER_MESSAGE);
  error.code = DIFF_MODEL_ADAPTER_CODE;
  throw error;
}
