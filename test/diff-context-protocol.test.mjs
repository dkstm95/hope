import assert from "node:assert/strict";
import test, { after } from "node:test";

import { addDiffContext } from "../features/diff/index.mjs";
import {
  checkpointDiffRun,
  createDiffRun,
  inspectDiffRun,
  loadDiffRun,
  removeDiffRun,
} from "../features/diff/run.mjs";
import { makeSnapshot } from "../test-support/diff-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

function makeGroundedSnapshot() {
  return makeSnapshot({
    title: "Inspect src/caller.js, src/another-caller.js, and src/private.js",
  });
}

async function inspectAll(run, temporaryRoot, request) {
  let requested = false;
  for (let page = 1; page <= run.pageCount; page += 1) {
    const inspected = await inspectDiffRun(run.path, page, { temporaryRoot });
    const current = await loadDiffRun(run.path, { temporaryRoot });
    const source = inspected.kind === "sources"
      ? inspected.value.sources.find((value) => (
        request ? value.text.includes(request.path) : true
      ))
      : undefined;
    const requestLineOffset = source && request
      ? source.text.split("\n").findIndex((line) => line.includes(request.path))
      : -1;
    const requestLine = requestLineOffset >= 0
      ? source.startLine + requestLineOffset
      : undefined;
    const observations = request && !requested && source
      && requestLine !== undefined
      ? [{
          basis: "inferred",
          contextRequests: [{
            path: request.path,
            revision: request.revision,
          }],
          evidence: [{
            endLine: requestLine,
            sourceId: source.sourceId,
            startLine: requestLine,
          }],
          kind: "question",
          text: request.question ?? `Inspect ${request.path} to resolve this call path.`,
        }]
      : [];
    if (observations.length > 0) requested = true;
    await checkpointDiffRun(run.path, page, {
      generation: current.manifest.generation,
      observations,
      page,
      runId: current.manifest.runId,
      schemaVersion: 1,
      snapshotDigest: current.snapshot.digest,
    }, { temporaryRoot });
  }
  if (request && !requested) throw new Error("Test run did not deliver a source page");
  if (!request) return undefined;
  const completed = await loadDiffRun(run.path, { temporaryRoot });
  return completed.ledger.checkpoints
    .flatMap((checkpoint) => checkpoint.observations)
    .flatMap((observation) => observation.contextRequests)
    .find((candidate) => candidate.path === request.path)?.id;
}

test("context collection atomically refreshes the snapshot and inspection plan", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-context-protocol-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const requestId = await inspectAll(created, temporaryRoot, {
    path: "src/caller.js",
    revision: "head",
  });

  const result = await addDiffContext(
    created.path,
    [requestId],
    {
      collectContext: async (_snapshot, requests) => {
        assert.deepEqual(requests, [
          { path: "src/caller.js", revision: "head" },
        ]);
        return Object.freeze([
          Object.freeze({
            kind: "context-file",
            path: "src/caller.js",
            revision: "b".repeat(40),
            text: "export function callRetry() {\n  return retry()\n}\n// src/another-caller.js",
          }),
        ]);
      },
      temporaryRoot,
    },
  );

  assert.equal(result.collected, 1);
  assert.equal(result.firstPage.page, 1);
  assert.equal(result.limitsAdded, 0);
  assert.notEqual(result.snapshotDigest, created.snapshotDigest);
  const updated = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(updated.manifest.phase, "inspecting");
  assert.equal(updated.manifest.deliveredPage, 1);
  assert.equal(updated.manifest.generation, 2);
  assert.equal(updated.ledger.checkpoints.length, created.pageCount);
  assert.equal(updated.manifest.pageCount, result.pageCount);
  assert.equal(updated.snapshot.digest, result.snapshotDigest);
  assert.deepEqual(
    updated.snapshot.sources.at(-1),
    {
      id: "source-4",
      kind: "context-file",
      lineCount: 4,
      path: "src/caller.js",
      revision: "b".repeat(40),
      text: "export function callRetry() {\n  return retry()\n}\n// src/another-caller.js",
    },
  );

  const secondRequestId = await inspectAll({
    pageCount: result.pageCount,
    path: created.path,
  }, temporaryRoot, {
    path: "src/another-caller.js",
    revision: "head",
  });
  const inspected = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(inspected.manifest.phase, "inspected");

  const second = await addDiffContext(
    created.path,
    [secondRequestId],
    {
      collectContext: async () => [{
        kind: "context-unavailable",
        path: "src/another-caller.js",
        reason: "GitHub did not find this path at the captured revision",
        reasonKind: "not-found",
        revision: "b".repeat(40),
      }],
      temporaryRoot,
    },
  );
  assert.equal(second.generation, 3);
  assert.equal(second.limitsAdded, 1);
  assert.equal(second.retainedCheckpoints, created.pageCount + result.pageCount);
});

test("context collection records an unavailable exact path as a visible limit", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-context-limit-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const requestId = await inspectAll(created, temporaryRoot, {
    path: "src/private.js",
    revision: "head",
  });

  const result = await addDiffContext(
    created.path,
    [requestId],
    {
      collectContext: async () => Object.freeze([
        Object.freeze({
          kind: "context-unavailable",
          path: "src/private.js",
          reason: "The file body matched a credential pattern",
          reasonKind: "credential-pattern",
          revision: "b".repeat(40),
        }),
      ]),
      temporaryRoot,
    },
  );

  assert.equal(result.collected, 0);
  assert.equal(result.limitsAdded, 1);
  const updated = await loadDiffRun(created.path, { temporaryRoot });
  assert.deepEqual(updated.snapshot.limits.at(-1), {
    id: "limit-2",
    kind: "context-unavailable",
    reason: "The file body matched a credential pattern",
    reasonKind: "credential-pattern",
    revision: "b".repeat(40),
    subject: "src/private.js",
  });
});

test("context collection requires the current plan to be fully inspected", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-context-order-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  let collected = false;

  await assert.rejects(
    addDiffContext(
      created.path,
      ["context-request-1"],
      {
        collectContext: async () => {
          collected = true;
          return [];
        },
        temporaryRoot,
      },
    ),
    /Read and checkpoint every current Hope inspection page/u,
  );
  assert.equal(collected, false);
});

test("context plan replacement is bound to the inspected snapshot digest", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-context-race-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  const requestId = await inspectAll(created, temporaryRoot, {
    path: "src/caller.js",
    revision: "head",
  });
  let replacementOptions;

  const result = await addDiffContext(
    created.path,
    [requestId],
    {
      collectContext: async () => [{
        kind: "context-file",
        path: "src/caller.js",
        revision: "b".repeat(40),
        text: "caller",
      }],
      appendRunPlan: async (_path, snapshot, options) => {
        replacementOptions = options;
        return {
          ledger: { checkpoints: [] },
          manifest: {
            generation: 2,
            pageCount: 7,
            runId: created.runId,
          },
          path: created.path,
          resources: {},
          snapshot,
        };
      },
      inspectRun: async () => ({
        digest: "d".repeat(64),
        generation: 2,
        kind: "sources",
        page: 1,
        totalPages: 7,
        value: { contentIsUntrusted: true, sources: [] },
      }),
      temporaryRoot,
    },
  );

  assert.equal(
    replacementOptions.expectedSnapshotDigest,
    created.snapshotDigest,
  );
  assert.equal(result.pageCount, 7);
  await removeDiffRun(created.path, { temporaryRoot });
});

test("a committed context operation replays without recollecting", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-context-replay-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  const requestId = await inspectAll(created, temporaryRoot, {
    path: "src/caller.js",
    revision: "head",
  });
  let collections = 0;
  const dependencies = {
    collectContext: async () => {
      collections += 1;
      return [{
        kind: "context-file",
        path: "src/caller.js",
        revision: "b".repeat(40),
        text: "export const caller = true",
      }];
    },
    temporaryRoot,
  };

  const first = await addDiffContext(
    created.path,
    [requestId],
    dependencies,
  );
  const replay = await addDiffContext(
    created.path,
    [requestId],
    dependencies,
  );

  assert.equal(collections, 1);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.generation, first.generation);
  assert.equal(replay.snapshotDigest, first.snapshotDigest);
  assert.deepEqual(replay.firstPage, first.firstPage);
  await removeDiffRun(created.path, { temporaryRoot });
});

test("a delayed checkpoint cannot roll back a context generation", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-context-fence-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  const requestId = await inspectAll(created, temporaryRoot, {
    path: "src/caller.js",
    revision: "head",
  });
  const staleCheckpoint = {
    generation: 1,
    observations: [],
    page: 1,
    runId: created.runId,
    schemaVersion: 1,
    snapshotDigest: created.snapshotDigest,
  };

  const results = await Promise.allSettled([
    checkpointDiffRun(
      created.path,
      1,
      staleCheckpoint,
      { temporaryRoot },
    ),
    addDiffContext(
      created.path,
      [requestId],
      {
        collectContext: async () => [{
          kind: "context-file",
          path: "src/caller.js",
          revision: "b".repeat(40),
          text: "export const caller = true",
        }],
        temporaryRoot,
      },
    ),
  ]);

  assert.ok(results.some((result) => result.status === "fulfilled"));
  if (results[1].status === "rejected") {
    await addDiffContext(
      created.path,
      [requestId],
      {
        collectContext: async () => [{
          kind: "context-file",
          path: "src/caller.js",
          revision: "b".repeat(40),
          text: "export const caller = true",
        }],
        temporaryRoot,
      },
    );
  }
  const run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.manifest.generation, 2);
  assert.equal(run.snapshot.sources.at(-1).path, "src/caller.js");
  await removeDiffRun(created.path, { temporaryRoot });
});
