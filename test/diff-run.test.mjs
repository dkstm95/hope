import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  LEGACY_RUN_VERSION,
  LIMITS,
} from "../features/diff/constants.mjs";
import {
  finishDiff,
  prepareDiff,
  validateDiff,
} from "../features/diff/index.mjs";
import {
  buildInspectionPages,
  claimDiffRunFinalization,
  cleanupExpiredRuns,
  createDiffRun,
  inspectDiffRun,
  loadDiffRun,
  removeDiffRun,
  serializeInspectionPage,
} from "../features/diff/run.mjs";
import { makeAnalysis, makeSnapshot } from "../test-support/diff-fixture.mjs";

test("an invalid explicit output fails before GitHub collection", async () => {
  let collected = false;
  await assert.rejects(
    prepareDiff(
      {
        outputPath: "existing.html",
        url: "https://github.com/example/hope/pull/142",
      },
      {
        collect: async () => {
          collected = true;
          return makeSnapshot();
        },
        preflightOutput: async () => {
          throw new Error("output already exists");
        },
        resolveSettings: async () => ({
          locale: "en-US",
          localeSource: "default",
          theme: "system",
          themeSource: "default",
        }),
      },
    ),
    /output already exists/u,
  );
  assert.equal(collected, false);
});

test("a DiffRun requires every page and publishes one review", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-test-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });

  await assert.rejects(
    finishDiff(created.path, { temporaryRoot }),
    /Read every Hope inspection page/u,
  );
  for (let page = 1; page <= created.pageCount; page += 1) {
    const value = await inspectDiffRun(created.path, page, { temporaryRoot });
    assert.equal(value.page, page);
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  const result = await finishDiff(created.path, {
    revalidate: async () => ({
      matches: true,
      revalidatedAt: "2026-07-23T00:01:00.000Z",
    }),
    temporaryRoot,
  });
  assert.match(result.outputPath, /hope-review\.html$/u);
  await assert.rejects(loadDiffRun(created.path, { temporaryRoot }), /ENOENT/u);
});

test("snapshot revalidation starts only after rendering completes", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-order-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  let renderFinished = false;
  await finishDiff(created.path, {
    finalize: async () => ({ outputPath: join(temporaryRoot, "review.html") }),
    render: async () => {
      await Promise.resolve();
      renderFinished = true;
      return { bytes: Buffer.from("review"), digest: "d".repeat(64) };
    },
    revalidate: async () => {
      assert.equal(renderFinished, true);
      return {
        matches: true,
        revalidatedAt: "2026-07-23T00:01:00.000Z",
      };
    },
    temporaryRoot,
  });
});

test("an in-flight v1 run can resume with the original analysis contract", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-v1-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  const manifestPath = join(created.path, "run.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.runVersion = LEGACY_RUN_VERSION;
  delete manifest.resources;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  const analysis = makeAnalysis(snapshot, created.runId);
  analysis.reviewItems = Array.from({ length: 80 }, (_, index) => ({
    ...analysis.reviewItems[0],
    explanation: `Legacy explanation ${index + 1} ${"x".repeat(1_800)}`,
    title: `Legacy review item ${index + 1}`,
  }));
  const serialized = `${JSON.stringify(analysis, null, 2)}\n`;
  assert.ok(Buffer.byteLength(serialized) > LIMITS.modelBytes);
  assert.ok(Buffer.byteLength(serialized) <= LIMITS.legacyModelBytes);
  await writeFile(created.analysisPath, serialized, { flag: "wx", mode: 0o600 });

  let validatedReview;
  const result = await finishDiff(created.path, {
    finalize: async () => ({ outputPath: join(temporaryRoot, "review.html") }),
    render: async (review) => {
      validatedReview = review;
      return { bytes: Buffer.from("review"), digest: "d".repeat(64) };
    },
    revalidate: async () => ({
      matches: true,
      revalidatedAt: "2026-07-23T00:01:00.000Z",
    }),
    temporaryRoot,
  });

  assert.equal(validatedReview.reviewItems.length, 80);
  assert.equal(validatedReview.resources.analysisFileBytes, Buffer.byteLength(serialized));
  assert.equal(result.resources.analysisFileBytes, Buffer.byteLength(serialized));
});

test("a v2 run cannot drop its resource policy", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-v2-policy-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const manifestPath = join(created.path, "run.json");
  const original = await readFile(manifestPath, "utf8");
  context.after(async () => {
    await writeFile(manifestPath, original, "utf8").catch(() => {});
    await removeDiffRun(created.path, { temporaryRoot }).catch(() => {});
  });
  const manifest = JSON.parse(original);
  delete manifest.resources;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /inspection page plan is invalid/u,
  );
});

test("analysis preflight preserves the run and final repair attempt", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-validate-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));

  await assert.rejects(
    validateDiff(created.path, { temporaryRoot }),
    /Read every Hope inspection page/u,
  );
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }

  const invalid = makeAnalysis(snapshot, created.runId);
  invalid.snapshotDigest = "0".repeat(64);
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(invalid, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      validateDiff(created.path, { temporaryRoot }),
      (error) => {
        assert.match(error.message, /snapshot digest/iu);
        assert.equal(error.code, "HOPE_ANALYSIS_INVALID");
        assert.equal(error.canRetry, true);
        return true;
      },
    );
  }
  let run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.manifest.phase, "inspected");
  assert.equal(run.manifest.analysisAttempts, 0);

  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { mode: 0o600 },
  );
  const validated = await validateDiff(created.path, {
    finalize: async () => assert.fail("preflight must not publish"),
    render: async () => assert.fail("preflight must not render"),
    revalidate: async () => assert.fail("preflight must not revalidate"),
    temporaryRoot,
  });
  assert.equal(validated.runId, created.runId);
  assert.equal(validated.snapshotDigest, snapshot.digest);
  assert.equal(validated.valid, true);
  assert.equal(validated.resources.plannedInspectionPages, created.pageCount);
  assert.equal(
    validated.resources.analysisFileBytes,
    Buffer.byteLength(await readFile(created.analysisPath)),
  );
  assert.ok(
    validated.resources.analysisFileBytes
      > validated.resources.analysisCanonicalBytes,
  );
  run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.manifest.phase, "inspected");
  assert.equal(run.manifest.analysisAttempts, 0);

  const result = await finishDiff(created.path, {
    revalidate: async () => ({
      matches: true,
      revalidatedAt: "2026-07-23T00:01:00.000Z",
    }),
    temporaryRoot,
  });
  assert.match(result.outputPath, /hope-review\.html$/u);
  await assert.rejects(loadDiffRun(created.path, { temporaryRoot }), /ENOENT/u);
});

test("one invalid analysis can be repaired without rereading inspection pages", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-retry-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }

  const invalid = makeAnalysis(snapshot, created.runId);
  invalid.snapshotDigest = "0".repeat(64);
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(invalid, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  await assert.rejects(
    finishDiff(created.path, { temporaryRoot }),
    (error) => {
      assert.equal(error.code, "HOPE_ANALYSIS_INVALID");
      assert.equal(error.canRetry, true);
      return true;
    },
  );
  await assert.rejects(
    validateDiff(created.path, { temporaryRoot }),
    (error) => {
      assert.equal(error.code, "HOPE_ANALYSIS_INVALID");
      assert.equal(error.canRetry, true);
      return true;
    },
  );
  await assert.rejects(
    validateDiff(created.path, { temporaryRoot }),
    (error) => {
      assert.equal(error.code, "HOPE_ANALYSIS_INVALID");
      assert.equal(error.canRetry, true);
      return true;
    },
  );
  let run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.manifest.phase, "analysis-invalid");
  assert.equal(run.manifest.analysisAttempts, 1);

  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { mode: 0o600 },
  );
  await validateDiff(created.path, { temporaryRoot });
  run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.manifest.phase, "analysis-invalid");
  assert.equal(run.manifest.analysisAttempts, 1);
  const result = await finishDiff(created.path, {
    revalidate: async () => ({
      matches: true,
      revalidatedAt: "2026-07-23T00:01:00.000Z",
    }),
    temporaryRoot,
  });

  assert.match(result.outputPath, /hope-review\.html$/u);
  await assert.rejects(loadDiffRun(created.path, { temporaryRoot }), /ENOENT/u);
});

test("a second final analysis failure removes the private run", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-final-invalid-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }

  const invalid = makeAnalysis(snapshot, created.runId);
  invalid.snapshotDigest = "0".repeat(64);
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(invalid, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  await assert.rejects(
    finishDiff(created.path, { temporaryRoot }),
    (error) => error.code === "HOPE_ANALYSIS_INVALID" && error.canRetry === true,
  );
  await assert.rejects(
    finishDiff(created.path, { temporaryRoot }),
    (error) => error.code === "HOPE_ANALYSIS_INVALID" && error.canRetry === false,
  );
  await assert.rejects(loadDiffRun(created.path, { temporaryRoot }), /ENOENT/u);
});

test("only one finalization can claim a run", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-concurrent-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );

  let continueRendering;
  let renderingStarted;
  const started = new Promise((resolve) => {
    renderingStarted = resolve;
  });
  const blocked = new Promise((resolve) => {
    continueRendering = resolve;
  });
  const dependencies = {
    finalize: async () => ({ outputPath: "review.html" }),
    removeRun: async (path) => await removeDiffRun(path, { temporaryRoot }),
    render: async () => {
      renderingStarted();
      await blocked;
      return { bytes: Buffer.from("review"), digest: "digest" };
    },
    revalidate: async () => ({
      matches: true,
      revalidatedAt: "2026-07-23T00:01:00.000Z",
    }),
    temporaryRoot,
  };

  const first = finishDiff(created.path, dependencies);
  await started;
  await assert.rejects(
    finishDiff(created.path, dependencies),
    /already being finalized/u,
  );
  continueRendering();
  await first;
});

test("a lost finalization lease prevents publication", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-lost-lease-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(created.path, { temporaryRoot }).catch(() => {}));
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  let published = false;

  await assert.rejects(
    finishDiff(created.path, {
      finalize: async () => {
        published = true;
        return {};
      },
      render: async () => {
        await unlink(join(created.path, ".finish.lock"));
        return { bytes: Buffer.from("review"), digest: "digest" };
      },
      revalidate: async () => ({
        matches: true,
        revalidatedAt: "2026-07-23T00:01:00.000Z",
      }),
      temporaryRoot,
    }),
    /finalization lease was lost/u,
  );
  assert.equal(published, false);
});

test("an expired finalization lease prevents publication", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-expired-lease-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(created.path, { temporaryRoot }).catch(() => {}));
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  let published = false;

  await assert.rejects(
    finishDiff(created.path, {
      finalize: async () => {
        published = true;
        return {};
      },
      render: async () => {
        const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
        await utimes(join(created.path, ".finish.lock"), stale, stale);
        return { bytes: Buffer.from("review"), digest: "digest" };
      },
      revalidate: async () => ({
        matches: true,
        revalidatedAt: "2026-07-23T00:01:00.000Z",
      }),
      temporaryRoot,
    }),
    /finalization lease expired/u,
  );
  assert.equal(published, false);
});

test("expiry cleanup leaves an actively finalized old run in place", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-active-expiry-"));
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const created = await createDiffRun(makeSnapshot(), {
    clock: () => old,
    temporaryRoot,
  });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  const claim = await claimDiffRunFinalization(run);
  try {
    const removed = await cleanupExpiredRuns({ temporaryRoot });
    assert.deepEqual(removed, []);
    await access(created.path);
  } finally {
    await claim.release();
    await removeDiffRun(created.path, { temporaryRoot });
  }
});

test("a heartbeat keeps a long finalization lease active", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-stale-expiry-"));
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const created = await createDiffRun(makeSnapshot(), {
    clock: () => old,
    temporaryRoot,
  });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  const claim = await claimDiffRunFinalization(run);
  const dueForHeartbeat = new Date(Date.now() - 30 * 60 * 1000);
  await utimes(join(created.path, ".finish.lock"), dueForHeartbeat, dueForHeartbeat);
  await claim.renew();

  const removed = await cleanupExpiredRuns({ temporaryRoot });
  assert.deepEqual(removed, []);
  await access(created.path);
  await claim.release();
  await removeDiffRun(created.path, { temporaryRoot });
});

test("expiry cleanup reclaims a stale lease even when its PID is reused", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-reused-pid-"));
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const created = await createDiffRun(makeSnapshot(), {
    clock: () => old,
    temporaryRoot,
  });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  const claim = await claimDiffRunFinalization(run, {
    scheduleHeartbeat: () => undefined,
  });
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(join(created.path, ".finish.lock"), stale, stale);
  await assert.rejects(claim.renew(), /lease expired/u);

  const removed = await cleanupExpiredRuns({ temporaryRoot });
  assert.deepEqual(removed, [created.path]);
  await assert.rejects(access(created.path), /ENOENT/u);
  await claim.release();
});

test("expiry cleanup reclaims an old incomplete finalization claim", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-incomplete-claim-"));
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const created = await createDiffRun(makeSnapshot(), {
    clock: () => old,
    temporaryRoot,
  });
  const claimPath = join(created.path, ".finish.lock");
  await writeFile(claimPath, "", { flag: "wx", mode: 0o600 });
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(claimPath, stale, stale);

  const removed = await cleanupExpiredRuns({ temporaryRoot });
  assert.deepEqual(removed, [created.path]);
  await assert.rejects(access(created.path), /ENOENT/u);
});

test("a failed finalization claim initialization removes its lock", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-claim-failure-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  let removedPath;

  await assert.rejects(
    claimDiffRunFinalization(run, {
      openFile: async () => ({
        close: async () => {},
        sync: async () => {},
        writeFile: async () => {
          throw new Error("claim write failed");
        },
      }),
      unlinkFile: async (path) => {
        removedPath = path;
      },
    }),
    /claim write failed/u,
  );
  assert.equal(removedPath, join(created.path, ".finish.lock"));
  await removeDiffRun(created.path, { temporaryRoot });
});

test("a run is cleaned before its review becomes visible", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-cleanup-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(created.path, { temporaryRoot }).catch(() => {}));
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  let published = false;

  await assert.rejects(
    finishDiff(created.path, {
      finalize: async () => {
        published = true;
        return {};
      },
      loadRenderer: async () => assert.fail("an injected renderer must stay lazy"),
      removeRun: async () => {
        throw new Error("cleanup failed");
      },
      render: async () => ({ bytes: Buffer.from("review"), digest: "digest" }),
      revalidate: async () => ({
        matches: true,
        revalidatedAt: "2026-07-23T00:01:00.000Z",
      }),
      temporaryRoot,
    }),
    /cleanup failed/u,
  );
  assert.equal(published, false);
});

test("inspection pages must be read in order and the last handoff is replayable", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-order-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  await assert.rejects(
    inspectDiffRun(created.path, 2, { temporaryRoot }),
    /page 1 next/u,
  );
  const first = await inspectDiffRun(created.path, 1, { temporaryRoot });
  const replay = await inspectDiffRun(created.path, 1, { temporaryRoot });
  assert.deepEqual(replay, first);
  const run = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(run.manifest.deliveredPages.length, 1);
});

test("a canonical temporary-root alias can resume a DiffRun", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-canonical-"));
  const alias = `${temporaryRoot}-alias`;
  await symlink(temporaryRoot, alias, "dir");
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const aliasPath = created.path.replace(temporaryRoot, alias);
  const loaded = await loadDiffRun(aliasPath, { temporaryRoot: alias });
  assert.equal(loaded.manifest.runId, created.runId);
});

test("UTF-8 inspection chunks reconstruct the exact source text", () => {
  const snapshot = makeSnapshot();
  const text = Array.from(
    { length: 2_000 },
    (_, index) => `${index + 1}: 모델 복원 상태를 확인합니다.`,
  ).join("\n");
  const source = {
    ...snapshot.sources[2],
    lineCount: 2_000,
    text,
  };
  const pages = buildInspectionPages({
    ...snapshot,
    sources: [...snapshot.sources.slice(0, 2), source],
  });
  const reconstructed = pages
    .filter((page) => page.kind === "sources")
    .flatMap((page) => page.value.sources)
    .filter((item) => item.sourceId === source.id)
    .map((item) => item.text)
    .join("\n");
  assert.equal(reconstructed, text);
});

test("inspection chunks account for JSON escaping", () => {
  const snapshot = makeSnapshot();
  const text = Array.from(
    { length: 200 },
    (_, index) => `${index + 1}: ${String.raw`"quoted\\path"`.repeat(8)}`,
  ).join("\n");
  const source = {
    ...snapshot.sources[2],
    lineCount: 200,
    text,
  };
  const pages = buildInspectionPages({
    ...snapshot,
    sources: [...snapshot.sources.slice(0, 2), source],
  });
  const reconstructed = pages
    .filter((page) => page.kind === "sources")
    .flatMap((page) => page.value.sources)
    .filter((item) => item.sourceId === source.id)
    .map((item) => item.text)
    .join("\n");

  assert.equal(reconstructed, text);
  for (const page of pages) {
    assert.ok(
      Buffer.byteLength(JSON.stringify(page), "utf8")
        <= LIMITS.inspectionPageBytes,
    );
  }
});

test("short source bodies share bounded inspection pages", () => {
  const snapshot = makeSnapshot();
  const sources = Array.from({ length: 652 }, (_, index) => ({
    id: `source-${index + 1}`,
    kind: "commit-title",
    lineCount: 1,
    revision: String(index).padStart(40, "0"),
    text: "x",
  }));
  const pages = buildInspectionPages({ ...snapshot, sources });
  const sourcePages = pages.filter((page) => page.kind === "sources");
  const delivered = sourcePages.flatMap((page) => page.value.sources);

  assert.equal(delivered.length, sources.length);
  assert.ok(sourcePages.length < 20);
  assert.deepEqual(
    delivered.map((item) => [
      item.sourceId,
      item.sourceKind,
      item.fileId,
      item.path,
      item.revision,
      item.startLine,
      item.endLine,
      item.text,
    ]),
    sources.map((source) => [
      source.id,
      source.kind,
      source.fileId,
      source.path,
      source.revision,
      1,
      1,
      source.text,
    ]),
  );
  for (const page of pages) {
    assert.ok(
      Buffer.byteLength(JSON.stringify(page), "utf8")
        <= LIMITS.inspectionPageBytes,
    );
  }
});

test("a prepared run reports exact content-free resource counters", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-resources-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  const pages = JSON.parse(await readFile(join(created.path, "pages.json"), "utf8"));
  const expectedInspectionBytes = pages.reduce(
    (sum, page) => sum + Buffer.byteLength(serializeInspectionPage(page), "utf8"),
    0,
  );

  assert.deepEqual(created.resources, {
    plannedInspectionBytes: expectedInspectionBytes,
    plannedInspectionPages: created.pageCount,
    sourceBytes: snapshot.sources.reduce(
      (sum, source) => sum + Buffer.byteLength(source.text, "utf8"),
      0,
    ),
  });
  await removeDiffRun(created.path, { temporaryRoot });
});

test("large file maps stay within the inspection page limit", () => {
  const snapshot = makeSnapshot();
  const files = Array.from({ length: LIMITS.changedFiles }, (_, index) => ({
    ...snapshot.files[0],
    id: `file-${index + 1}`,
    path: `src/features/${String(index + 1).padStart(3, "0")}-${"context-".repeat(10)}.mjs`,
    sourceIds: [],
  }));
  const pages = buildInspectionPages({
    ...snapshot,
    files,
  });
  const collectedFiles = pages
    .filter((page) => page.kind === "files")
    .flatMap((page) => page.value.files);

  assert.equal(collectedFiles.length, files.length);
  for (const page of pages) {
    assert.ok(
      Buffer.byteLength(JSON.stringify(page), "utf8")
        <= LIMITS.inspectionPageBytes,
    );
  }
});

test("tampered inspection pages fail closed", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-tamper-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const pagesPath = join(created.path, "pages.json");
  const pages = JSON.parse(await readFile(pagesPath, "utf8"));
  pages[0].value.warning = "changed";
  await writeFile(pagesPath, `${JSON.stringify(pages, null, 2)}\n`, "utf8");
  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /inspection page plan is invalid/u,
  );
});

test("inspection validates the requested page without rehashing future pages", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-target-page-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const pagesPath = join(created.path, "pages.json");
  const pages = JSON.parse(await readFile(pagesPath, "utf8"));
  const originalWarning = pages[1].value.warning;
  pages[1].value.warning = "changed";
  await writeFile(pagesPath, `${JSON.stringify(pages, null, 2)}\n`, "utf8");

  const first = await inspectDiffRun(created.path, 1, { temporaryRoot });
  assert.equal(first.page, 1);
  await assert.rejects(
    inspectDiffRun(created.path, 2, { temporaryRoot }),
    /inspection page plan is invalid/u,
  );

  pages[1].value.warning = originalWarning;
  await writeFile(pagesPath, `${JSON.stringify(pages, null, 2)}\n`, "utf8");
  await removeDiffRun(created.path, { temporaryRoot });
});

test("a stale snapshot creates no review artifact", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-stale-"));
  const outputPath = join(temporaryRoot, "stale.html");
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { outputPath, temporaryRoot });
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  await assert.rejects(
    finishDiff(created.path, {
      revalidate: async () => ({
        matches: false,
        revalidatedAt: "2026-07-23T00:01:00.000Z",
      }),
      temporaryRoot,
    }),
    /changed while Hope was reviewing/u,
  );
  await assert.rejects(access(outputPath), /ENOENT/u);
  await assert.rejects(loadDiffRun(created.path, { temporaryRoot }), /ENOENT/u);
});
