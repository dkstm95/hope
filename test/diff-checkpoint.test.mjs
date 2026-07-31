import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  checkpointDiffPage,
  readDiffLedger,
} from "../features/diff/index.mjs";
import { diffLedgerView } from "../features/diff/checkpoint.mjs";
import { LIMITS } from "../features/diff/constants.mjs";
import {
  checkpointDiffRun,
  createDiffRun,
  inspectDiffRun,
  inspectLoadedDiffRun,
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
    title: "Inspect src/caller.js before changing retry behavior",
  });
}

function checkpointInput(run, page, observations = []) {
  return {
    generation: run.manifest.generation,
    observations,
    page,
    runId: run.manifest.runId,
    schemaVersion: 1,
    snapshotDigest: run.snapshot.digest,
  };
}

test("inspection checkpoints persist grounded memory before the next page", async (context) => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-");
  const created = await createDiffRun(makeGroundedSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));

  const first = await inspectDiffRun(created.path, 1, { temporaryRoot });
  await assert.rejects(
    inspectDiffRun(created.path, 2, { temporaryRoot }),
    /Checkpoint inspection page 1/u,
  );
  let run = await loadDiffRun(created.path, { temporaryRoot });
  await writeFile(
    run.checkpointPath,
    `${JSON.stringify(checkpointInput(run, first.page), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  let highLevelLoads = 0;
  let loadedInspections = 0;
  const firstCheckpoint = await checkpointDiffPage(
    created.path,
    first.page,
    {
      loadRun: async (...arguments_) => {
        highLevelLoads += 1;
        return await loadDiffRun(...arguments_);
      },
      inspectLoadedRun: async (...arguments_) => {
        loadedInspections += 1;
        return await inspectLoadedDiffRun(...arguments_);
      },
      temporaryRoot,
    },
  );
  assert.equal(highLevelLoads, 0);
  assert.equal(loadedInspections, 0);
  assert.equal(firstCheckpoint.nextPage.page, 2);
  await assert.rejects(access(run.checkpointPath), /ENOENT/u);
  const replayedFirst = await checkpointDiffPage(
    created.path,
    first.page,
    { temporaryRoot },
  );
  assert.equal(replayedFirst.replayed, true);
  assert.equal(replayedFirst.nextPage.page, 2);

  let grounded;
  let inspected = replayedFirst.nextPage;
  for (let page = 2; page <= created.pageCount; page += 1) {
    assert.equal(inspected.page, page);
    run = await loadDiffRun(created.path, { temporaryRoot });
    const source = inspected.kind === "sources"
      ? inspected.value.sources.find((value) => (
        value.text.includes("src/caller.js")
      ))
      : undefined;
    const requestLineOffset = source
      ? source.text.split("\n").findIndex(
        (line) => line.includes("src/caller.js"),
      )
      : -1;
    const requestLine = requestLineOffset >= 0
      ? source.startLine + requestLineOffset
      : undefined;
    const observations = !grounded && source && requestLine !== undefined
      ? [{
          basis: "inferred",
          contextRequests: [{
            path: "src/caller.js",
            revision: "head",
          }],
          evidence: [{
            endLine: requestLine,
            sourceId: source.sourceId,
            startLine: requestLine,
          }],
          kind: "question",
          text: "Does the direct caller preserve this behavior?",
        }]
      : [];
    if (source && observations.length > 0) {
      grounded = { ...source, requestLine };
    }
    await writeFile(
      run.checkpointPath,
      `${JSON.stringify(checkpointInput(run, page, observations), null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    const result = await checkpointDiffPage(
      created.path,
      page,
      { temporaryRoot },
    );
    inspected = result.nextPage;
  }
  assert.equal(inspected, undefined);

  assert.ok(grounded);
  const ledger = await readDiffLedger(created.path, { temporaryRoot });
  assert.equal(ledger.checkpoints.length, created.pageCount);
  assert.deepEqual(
    ledger.pendingContextRequests.map((request) => request.id),
    ["context-request-1"],
  );
  assert.deepEqual(ledger.evidenceExcerpts[0], {
    endLine: grounded.requestLine,
    fileId: grounded.fileId,
    key: `${grounded.sourceId}:${grounded.requestLine}:${grounded.requestLine}`,
    path: grounded.path,
    revision: grounded.revision,
    sourceId: grounded.sourceId,
    sourceKind: grounded.sourceKind,
    startLine: grounded.requestLine,
    text: grounded.text.split("\n")[
      grounded.requestLine - grounded.startLine
    ],
  });

  const manifestPath = join(created.path, "run.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.phase = "inspecting";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const replay = await checkpointDiffPage(
    created.path,
    created.pageCount,
    { temporaryRoot },
  );
  assert.equal(replay.replayed, true);
  const repaired = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(repaired.manifest.phase, "inspected");
});

test("a checkpoint cannot cite source text from another page", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-page-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const inspected = await inspectDiffRun(created.path, 1, { temporaryRoot });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  await writeFile(
    run.checkpointPath,
    `${JSON.stringify(checkpointInput(run, inspected.page, [{
      basis: "inferred",
      contextRequests: [],
      evidence: [{ endLine: 1, sourceId: "source-1", startLine: 1 }],
      kind: "fact",
      text: "This did not appear on the current page.",
    }]), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  await assert.rejects(
    checkpointDiffPage(created.path, inspected.page, { temporaryRoot }),
    /unknown source|must cite the current inspection page/u,
  );
  await removeDiffRun(created.path, { temporaryRoot });
});

test("replaying a checkpoint does not remove the next page input", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-replay-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const first = await inspectDiffRun(created.path, 1, { temporaryRoot });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  await writeFile(
    first.checkpointPath,
    `${JSON.stringify(checkpointInput(run, 1), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  const advanced = await checkpointDiffPage(
    created.path,
    1,
    { temporaryRoot },
  );
  await writeFile(
    advanced.nextPage.checkpointPath,
    `${JSON.stringify(checkpointInput(run, 2), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  const replayed = await checkpointDiffPage(
    created.path,
    1,
    { temporaryRoot },
  );

  assert.equal(replayed.replayed, true);
  await access(advanced.nextPage.checkpointPath);
  await removeDiffRun(created.path, { temporaryRoot });
});

test("a context path must appear in the cited source excerpt", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-grounding-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  let rejected = false;
  for (let page = 1; page <= created.pageCount; page += 1) {
    const inspected = await inspectDiffRun(created.path, page, { temporaryRoot });
    const source = inspected.kind === "sources"
      ? inspected.value.sources[0]
      : undefined;
    const observations = source && !rejected
      ? [{
          basis: "inferred",
          contextRequests: [{
            path: "src/unrelated.js",
            revision: "head",
          }],
          evidence: [{
            endLine: source.startLine,
            sourceId: source.sourceId,
            startLine: source.startLine,
          }],
          kind: "question",
          text: "Should this unrelated file be collected?",
        }]
      : [];
    const input = {
      generation: 1,
      observations,
      page,
      runId: created.runId,
      schemaVersion: 1,
      snapshotDigest: created.snapshotDigest,
    };
    if (observations.length > 0) {
      await assert.rejects(
        checkpointDiffRun(created.path, page, input, { temporaryRoot }),
        /path must appear in the question's cited evidence/u,
      );
      rejected = true;
      await checkpointDiffRun(created.path, page, {
        ...input,
        observations: [],
      }, { temporaryRoot });
    } else {
      await checkpointDiffRun(created.path, page, input, { temporaryRoot });
    }
  }
  assert.equal(rejected, true);
  await removeDiffRun(created.path, { temporaryRoot });
});

test("checkpoint records are bound to the ledger digest chain", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-chain-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  await inspectDiffRun(created.path, 1, { temporaryRoot });
  await checkpointDiffRun(created.path, 1, {
    generation: 1,
    observations: [],
    page: 1,
    runId: created.runId,
    schemaVersion: 1,
    snapshotDigest: created.snapshotDigest,
  }, { temporaryRoot });
  const checkpointPath = join(created.path, "checkpoint.1.1.json");
  const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
  checkpoint.pageDigest = "f".repeat(64);
  await writeFile(
    checkpointPath,
    `${JSON.stringify(checkpoint, null, 2)}\n`,
    "utf8",
  );

  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /digest chain/u,
  );
});

test("checkpoint state is rejected before parsing when it exceeds its bound", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-checkpoint-bound-");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const manifest = JSON.parse(
    await readFile(join(created.path, "run.json"), "utf8"),
  );
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

test("the final ledger is split into bounded deterministic pages", () => {
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
  assert.ok(first.totalPages > 1);
  const pages = Array.from(
    { length: first.totalPages },
    (_, index) => diffLedgerView(ledger, snapshot, { page: index + 1 }),
  );
  assert.equal(
    pages.flatMap((page) => page.checkpoints).length,
    ledger.checkpoints.length,
  );
  for (const page of pages) {
    assert.ok(
      Buffer.byteLength(JSON.stringify(page), "utf8")
        <= LIMITS.ledgerPageBytes,
    );
  }
});
