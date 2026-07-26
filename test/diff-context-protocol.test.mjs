import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { addDiffContext } from "../features/diff/index.mjs";
import {
  createDiffRun,
  inspectDiffRun,
  loadDiffRun,
  removeDiffRun,
} from "../features/diff/run.mjs";
import { makeSnapshot } from "../test-support/diff-fixture.mjs";

async function inspectAll(run, temporaryRoot) {
  for (let page = 1; page <= run.pageCount; page += 1) {
    await inspectDiffRun(run.path, page, { temporaryRoot });
  }
}

test("context collection atomically refreshes the snapshot and inspection plan", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-context-protocol-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  await inspectAll(created, temporaryRoot);

  const result = await addDiffContext(
    created.path,
    [{ path: "src/caller.js", revision: "head" }],
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
            text: "export function callRetry() {\n  return retry()\n}",
          }),
        ]);
      },
      temporaryRoot,
    },
  );

  assert.equal(result.collected, 1);
  assert.equal(result.limitsAdded, 0);
  assert.notEqual(result.snapshotDigest, created.snapshotDigest);
  const updated = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(updated.manifest.phase, "prepared");
  assert.deepEqual(updated.manifest.deliveredPages, []);
  assert.equal(updated.manifest.pageCount, result.pageCount);
  assert.equal(updated.snapshot.digest, result.snapshotDigest);
  assert.deepEqual(
    updated.snapshot.sources.at(-1),
    {
      id: "source-4",
      kind: "context-file",
      lineCount: 3,
      path: "src/caller.js",
      revision: "b".repeat(40),
      text: "export function callRetry() {\n  return retry()\n}",
    },
  );

  await inspectAll({
    pageCount: result.pageCount,
    path: created.path,
  }, temporaryRoot);
  const inspected = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(inspected.manifest.phase, "inspected");

  let collectedAgain = false;
  await assert.rejects(
    addDiffContext(
      created.path,
      [{ path: "src/another-caller.js", revision: "head" }],
      {
        collectContext: async () => {
          collectedAgain = true;
          return [];
        },
        temporaryRoot,
      },
    ),
    /only once per run/u,
  );
  assert.equal(collectedAgain, false);
});

test("context collection records an unavailable exact path as a visible limit", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-context-limit-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  await inspectAll(created, temporaryRoot);

  const result = await addDiffContext(
    created.path,
    [{ path: "src/private.js", revision: "head" }],
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
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-context-order-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  let collected = false;

  await assert.rejects(
    addDiffContext(
      created.path,
      [{ path: "src/caller.js", revision: "head" }],
      {
        collectContext: async () => {
          collected = true;
          return [];
        },
        temporaryRoot,
      },
    ),
    /Read every current Hope inspection page/u,
  );
  assert.equal(collected, false);
});

test("context plan replacement is bound to the inspected snapshot digest", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-context-race-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  await inspectAll(created, temporaryRoot);
  let replacementOptions;

  const result = await addDiffContext(
    created.path,
    [{ path: "src/caller.js", revision: "head" }],
    {
      collectContext: async () => [{
        kind: "context-file",
        path: "src/caller.js",
        revision: "b".repeat(40),
        text: "caller",
      }],
      replaceRunPlan: async (_path, snapshot, options) => {
        replacementOptions = options;
        return {
          manifest: {
            pageCount: 7,
            runId: created.runId,
          },
          path: created.path,
          resources: {},
          snapshot,
        };
      },
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
