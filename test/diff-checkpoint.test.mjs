import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  checkpointDiffWindow,
  readDiffLedger,
} from "../plugins/hope/skills/diff/scripts/index.mjs";
import {
  createDiffCheckpoint,
  diffLedgerView,
} from "../plugins/hope/skills/diff/scripts/checkpoint.mjs";
import { LIMITS } from "../plugins/hope/skills/diff/scripts/constants.mjs";
import { digestJson } from "../plugins/hope/skills/diff/scripts/hash.mjs";
import {
  checkpointDiffRunWindow,
  createDiffRun,
  inspectDiffRunWindow,
  loadDiffRun,
  removeDiffRun,
} from "../plugins/hope/skills/diff/scripts/run.mjs";
import { makeSnapshot } from "../test-support/diff-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

function windowInput(window, observations = new Map()) {
  return {
    endPage: window.endPage,
    generation: window.generation,
    notes: window.pages.flatMap((page) => (
      observations.get(page.page) ?? []
    ).map((observation) => ({ page: page.page, ...observation }))),
    processedPages: window.pages.map((page) => page.page),
    runId: window.runId,
    schemaVersion: 2,
    snapshotDigest: window.snapshotDigest,
    startPage: window.startPage,
  };
}

async function writeWindowInput(window, observations) {
  await writeFile(
    window.checkpointPath,
    `${JSON.stringify(windowInput(window, observations), null, 2)}\n`,
    { flag: "w", mode: 0o600 },
  );
}

async function checkpointAll(created, temporaryRoot, observationForPage) {
  let window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  let windows = 0;
  while (window) {
    windows += 1;
    const observations = new Map();
    for (const page of window.pages) {
      const value = observationForPage?.(page);
      if (value) observations.set(page.page, value);
    }
    await writeWindowInput(window, observations);
    const result = await checkpointDiffWindow(
      created.path,
      window.startPage,
      { temporaryRoot },
    );
    window = result.nextWindow;
  }
  return windows;
}

test("inspection prepares a sparse checkpoint input", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-input-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));

  const window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  const input = JSON.parse(await readFile(window.checkpointPath, "utf8"));
  assert.equal(input.schemaVersion, 2);
  assert.deepEqual(input.processedPages, window.pages.map((page) => page.page));
  assert.deepEqual(input.notes, []);
});

test("checkpointing splits one authored evidence interval into bounded excerpts", () => {
  const runId = "a".repeat(32);
  const snapshotDigest = "b".repeat(64);
  const pageDigest = "c".repeat(64);
  const checkpoint = createDiffCheckpoint({
    generation: 1,
    observations: [{
      basis: "code",
      contextRequests: [],
      evidence: [{ endLine: 32, sourceId: "source-1", startLine: 1 }],
      kind: "fact",
      text: "The interval describes one continuous implementation behavior.",
    }],
    page: 1,
    runId,
    schemaVersion: 1,
    snapshotDigest,
  }, {
    generation: 1,
    ledger: { checkpoints: [] },
    page: 1,
    pageDigest,
    pageValue: {
      kind: "sources",
      value: {
        sources: [{
          endLine: 40,
          sourceId: "source-1",
          sourceKind: "patch",
          startLine: 1,
          text: Array.from(
            { length: 40 },
            (_, index) => `line ${index + 1}`,
          ).join("\n"),
        }],
      },
    },
    runId,
    snapshotDigest,
  });

  assert.deepEqual(checkpoint.observations[0].evidence, [
    { endLine: 24, sourceId: "source-1", startLine: 1 },
    { endLine: 32, sourceId: "source-1", startLine: 25 },
  ]);
});

test("inspection windows persist grounded memory before advancing", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-");
  const created = await createDiffRun(makeSnapshot({
    title: "Inspect src/caller.js before changing retry behavior",
  }), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));

  const first = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  await assert.rejects(
    inspectDiffRunWindow(created.path, first.endPage + 1, { temporaryRoot }),
    /Read inspection window 1 next/u,
  );

  let grounded;
  const windows = await checkpointAll(
    created,
    temporaryRoot,
    (page) => {
      if (grounded || page.kind !== "sources") return undefined;
      const source = page.value.sources.find((value) => (
        value.text.includes("src/caller.js")
      ));
      if (!source) return undefined;
      const offset = source.text.split("\n").findIndex(
        (line) => line.includes("src/caller.js"),
      );
      const line = source.startLine + offset;
      grounded = { ...source, line };
      return [{
        basis: "inferred",
        contextRequests: [{ path: "src/caller.js", revision: "head" }],
        evidence: [{ endLine: line, sourceId: source.sourceId, startLine: line }],
        kind: "question",
        text: "Does the direct caller preserve this behavior?",
      }];
    },
  );

  assert.ok(grounded);
  assert.ok(windows < created.pageCount);
  const ledger = await readDiffLedger(created.path, { temporaryRoot });
  assert.equal(ledger.coverage.checkpointCount, created.pageCount);
  assert.equal(ledger.coverage.emptyCheckpointCount, created.pageCount - 1);
  assert.deepEqual(
    ledger.pendingContextRequests.map((request) => request.id),
    ["context-request-1"],
  );
  assert.equal(ledger.evidenceExcerpts[0].sourceId, grounded.sourceId);
  assert.equal(ledger.evidenceExcerpts[0].startLine, grounded.line);
});

test("a window checkpoint cannot cite source text from another page", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-page-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  const observations = new Map([[window.startPage, [{
    basis: "inferred",
    contextRequests: [],
    evidence: [{ endLine: 1, sourceId: "source-1", startLine: 1 }],
    kind: "fact",
    text: "This source was not delivered on the current page.",
  }]]]);

  await assert.rejects(
    checkpointDiffRunWindow(
      created.path,
      window.startPage,
      windowInput(window, observations),
      { temporaryRoot },
    ),
    /unknown source|must cite the current inspection page/u,
  );
});

test("replaying a window keeps the next checkpoint input", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-replay-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const first = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  await writeWindowInput(first);
  const advanced = await checkpointDiffWindow(
    created.path,
    first.startPage,
    { temporaryRoot },
  );
  assert.ok(advanced.nextWindow);
  await writeWindowInput(advanced.nextWindow);

  const replayed = await checkpointDiffWindow(
    created.path,
    first.startPage,
    { temporaryRoot },
  );

  assert.equal(replayed.replayed, true);
  await access(advanced.nextWindow.checkpointPath);
});

test("replaying a committed non-final window repairs manifest progress", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-manifest-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  assert.ok(window.endPage < created.pageCount);

  await assert.rejects(
    checkpointDiffRunWindow(
      created.path,
      window.startPage,
      windowInput(window),
      {
        replaceManifest: async () => {
          throw new Error("simulated manifest interruption");
        },
        temporaryRoot,
      },
    ),
    /simulated manifest interruption/u,
  );

  const interrupted = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(interrupted.ledgerState.currentPage, window.endPage);
  assert.equal(interrupted.manifest.deliveredPage, window.endPage);

  const resumed = await checkpointDiffRunWindow(
    created.path,
    window.startPage,
    windowInput(window),
    { temporaryRoot },
  );
  assert.equal(resumed.replayed, true);
  assert.ok(resumed.nextWindow);
  assert.ok(resumed.manifest.deliveredPage > window.endPage);
});

test("replaying a committed final window repairs the inspected phase", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-final-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  let window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  while (window.endPage < created.pageCount) {
    const result = await checkpointDiffRunWindow(
      created.path,
      window.startPage,
      windowInput(window),
      { temporaryRoot },
    );
    window = result.nextWindow;
  }

  await assert.rejects(
    checkpointDiffRunWindow(
      created.path,
      window.startPage,
      windowInput(window),
      {
        replaceManifest: async () => {
          throw new Error("simulated final manifest interruption");
        },
        temporaryRoot,
      },
    ),
    /simulated final manifest interruption/u,
  );

  const interrupted = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(interrupted.ledgerState.currentPage, created.pageCount);
  assert.equal(interrupted.manifest.phase, "inspecting");

  const resumed = await checkpointDiffRunWindow(
    created.path,
    window.startPage,
    windowInput(window),
    { temporaryRoot },
  );
  assert.equal(resumed.replayed, true);
  assert.equal(resumed.nextWindow, undefined);
  assert.equal(resumed.manifest.phase, "inspected");
  assert.equal(
    (await loadDiffRun(created.path, { temporaryRoot })).manifest.phase,
    "inspected",
  );
});

test("a context path must appear in its cited window excerpt", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-grounding-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  let window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  let rejected = false;
  while (window) {
    const observations = new Map();
    const page = window.pages.find((value) => value.kind === "sources");
    const source = page?.value.sources[0];
    if (source && !rejected) {
      observations.set(page.page, [{
        basis: "inferred",
        contextRequests: [{ path: "src/unrelated.js", revision: "head" }],
        evidence: [{
          endLine: source.startLine,
          sourceId: source.sourceId,
          startLine: source.startLine,
        }],
        kind: "question",
        text: "Should this unrelated file be collected?",
      }]);
      await assert.rejects(
        checkpointDiffRunWindow(
          created.path,
          window.startPage,
          windowInput(window, observations),
          { temporaryRoot },
        ),
        /path must appear in the question's cited evidence/u,
      );
      rejected = true;
    }
    await writeWindowInput(window);
    const result = await checkpointDiffWindow(
      created.path,
      window.startPage,
      { temporaryRoot },
    );
    window = result.nextWindow;
  }
  assert.equal(rejected, true);
});

test("checkpoint records remain bound to their inspection pages", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-page-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  await writeWindowInput(window);
  await checkpointDiffWindow(created.path, window.startPage, { temporaryRoot });
  const checkpointPath = join(created.path, "checkpoint.1.1.json");
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  checkpoint.pageDigest = "f".repeat(64);
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /checkpoint ledger does not match the inspection plan/u,
  );
});

test("checkpoint state is rejected before parsing when it exceeds its bound", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-bound-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const manifest = JSON.parse(await readFile(join(created.path, "run.json"), "utf8"));
  await writeFile(
    join(created.path, manifest.ledgerStateFile),
    " ".repeat(64 * 1024 + 1),
    "utf8",
  );

  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /checkpoint state exceeds 65536 bytes/u,
  );
});

test("ledger pages stay bounded and carry their cited evidence", () => {
  const snapshot = makeSnapshot();
  const ledger = {
    checkpoints: Array.from({ length: 20 }, (_, index) => ({
      generation: 1,
      observations: [{
        basis: "inferred",
        contextRequests: [],
        evidence: [{ endLine: 1, sourceId: "source-1", startLine: 1 }],
        id: `observation-${index + 1}`,
        kind: "fact",
        text: `${index + 1}:${"x".repeat(3_000)}`,
      }],
      page: index + 1,
      pageDigest: "a".repeat(64),
      snapshotDigest: snapshot.digest,
    })),
    runId: "b".repeat(32),
    schemaVersion: 1,
  };
  const first = diffLedgerView(ledger, snapshot, { page: 1 });
  const pages = Array.from(
    { length: first.totalPages },
    (_, index) => diffLedgerView(ledger, snapshot, { page: index + 1 }),
  );
  assert.equal(
    pages.flatMap((page) => page.notes).length,
    ledger.checkpoints.flatMap((checkpoint) => checkpoint.observations).length,
  );
  assert.ok(
    pages.flatMap((page) => page.reviewContext)
      .some((entry) => entry.kind === "overview"),
  );
  assert.ok(
    pages.flatMap((page) => page.reviewContext)
      .some((entry) => entry.kind === "classifiable-file"),
  );
  assert.ok(
    pages.flatMap((page) => page.reviewContext)
      .some((entry) => entry.kind === "limit"),
  );
  for (const page of pages) {
    assert.ok(
      Buffer.byteLength(JSON.stringify(page), "utf8")
        <= LIMITS.ledgerPageBytes,
    );
  }
});

test("the largest automatic-file review context stays within the ledger bound", () => {
  const original = makeSnapshot();
  const { digest: _digest, ...base } = original;
  const files = Array.from({ length: LIMITS.changedFiles }, (_, index) => {
    const path = `generated/${String(index).padStart(3, "0")}-${"x".repeat(800)}.json`;
    return {
      additions: 0,
      bodyReason: "The provider reported no textual diff.",
      bodyReasonKind: "no-text-diff",
      bodyState: "metadata-only",
      deletions: 0,
      id: `file-${index + 1}`,
      path,
      providerStatus: "modified",
      sourceIds: [],
    };
  });
  const fileLimits = files.map((file, index) => ({
    id: `limit-${index + 2}`,
    kind: "file-unavailable",
    reason: file.bodyReason,
    reasonKind: file.bodyReasonKind,
    subject: file.path,
  }));
  const limits = [...original.limits, ...fileLimits];
  const value = { ...base, files, limits };
  const snapshot = { ...value, digest: digestJson(value) };
  const ledger = {
    checkpoints: [],
    runId: "b".repeat(32),
    schemaVersion: 1,
  };
  const first = diffLedgerView(ledger, snapshot, { page: 1 });
  const pages = Array.from(
    { length: first.totalPages },
    (_, index) => diffLedgerView(ledger, snapshot, { page: index + 1 }),
  );
  const context = pages.flatMap((page) => page.reviewContext);

  assert.equal(
    context.filter((entry) => entry.kind === "automatic-file").length,
    LIMITS.changedFiles,
  );
  assert.equal(
    context.filter((entry) => entry.kind === "limit").length,
    limits.length,
  );
  for (const page of pages) {
    const pageLimitIds = new Set(page.reviewContext
      .filter((entry) => entry.kind === "limit")
      .map((entry) => entry.limit.id));
    for (const entry of page.reviewContext) {
      if (entry.kind === "automatic-file") {
        assert.ok(pageLimitIds.has(entry.file.limitId));
      }
    }
  }
  assert.equal(context.at(-1).limit.id, original.limits[0].id);
});

test("checkpoint windows reduce host round trips", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-window-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));

  const windows = await checkpointAll(created, temporaryRoot);
  const completed = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(completed.manifest.phase, "inspected");
  assert.equal(completed.ledger.checkpoints.length, created.pageCount);
  assert.ok(windows < created.pageCount);
});

test("a checkpoint window validates every page before committing", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-window-atomic-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  assert.ok(window.pages.length > 1);
  const observations = new Map([[window.pages[1].page, [{
    basis: "inferred",
    contextRequests: [],
    evidence: [{ endLine: 1, sourceId: "source-999", startLine: 1 }],
    kind: "fact",
    text: "This evidence was not delivered.",
  }]]]);

  await assert.rejects(
    checkpointDiffRunWindow(
      created.path,
      window.startPage,
      windowInput(window, observations),
      { temporaryRoot },
    ),
    /unknown source|must cite the current inspection page/u,
  );
  const run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.ledgerState.currentPage, 0);
});

test("a checkpoint window resumes after a committed prefix", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-window-prefix-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const window = await inspectDiffRunWindow(created.path, 1, { temporaryRoot });
  let writes = 0;
  await assert.rejects(
    checkpointDiffRunWindow(
      created.path,
      window.startPage,
      windowInput(window),
      {
        temporaryRoot,
        writeCheckpoint: async (path, value) => {
          writes += 1;
          if (writes === 2) throw new Error("simulated checkpoint interruption");
          await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
            flag: "wx",
            mode: 0o600,
          });
        },
      },
    ),
    /simulated checkpoint interruption/u,
  );
  assert.equal((await loadDiffRun(created.path, { temporaryRoot })).ledgerState.currentPage, 1);

  const resumed = await checkpointDiffRunWindow(
    created.path,
    window.startPage,
    windowInput(window),
    { temporaryRoot },
  );
  assert.equal(resumed.ledgerState.currentPage, window.endPage);
});
