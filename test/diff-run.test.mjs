import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
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
import { digestJson } from "../features/diff/hash.mjs";
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
  replaceDiffRunPlan,
  serializeInspectionPage,
} from "../features/diff/run.mjs";
import { makeAnalysis, makeSnapshot } from "../test-support/diff-fixture.mjs";

function revisedSnapshot(snapshot, marker) {
  const value = JSON.parse(JSON.stringify(snapshot));
  delete value.digest;
  value.sources[1].text = `${value.sources[1].text} ${marker}`;
  return Object.freeze({
    ...value,
    digest: digestJson(value),
  });
}

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

test("an inspected current run atomically adopts a new inspection plan", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-plan-replace-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page, { temporaryRoot });
  }
  const revised = revisedSnapshot(snapshot, "Context was added.");
  const inspected = await loadDiffRun(created.path, { temporaryRoot });

  const replaced = await replaceDiffRunPlan(inspected, revised, {
    temporaryRoot,
  });

  assert.equal(replaced.snapshot.digest, revised.digest);
  assert.equal(replaced.manifest.snapshotDigest, revised.digest);
  assert.equal(replaced.manifest.snapshotFile, `snapshot.${revised.digest}.json`);
  assert.equal(replaced.manifest.pagesFile, `pages.${revised.digest}.json`);
  assert.equal(replaced.manifest.phase, "prepared");
  assert.deepEqual(replaced.manifest.deliveredPages, []);
  assert.equal(replaced.manifest.pageCount, replaced.pages.length);
  assert.deepEqual(replaced.manifest.resources, replaced.resources);
  await access(join(created.path, replaced.manifest.snapshotFile));
  await access(join(created.path, replaced.manifest.pagesFile));

  const first = await inspectDiffRun(created.path, 1, { temporaryRoot });
  assert.equal(first.page, 1);
  const resumed = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(resumed.manifest.deliveredPages.length, 1);
  assert.equal(resumed.snapshot.digest, revised.digest);
});

test("inspection-plan pointers reject traversal and symlinked generation files", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-plan-pointer-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  const revised = revisedSnapshot(snapshot, "Pointer validation.");
  const replaced = await replaceDiffRunPlan(created.path, revised, {
    temporaryRoot,
  });
  const manifestPath = join(created.path, "run.json");
  const snapshotPath = join(created.path, replaced.manifest.snapshotFile);
  const originalManifest = await readFile(manifestPath, "utf8");
  context.after(async () => {
    await writeFile(manifestPath, originalManifest, "utf8").catch(() => {});
    await unlink(snapshotPath).catch(() => {});
    await writeFile(
      snapshotPath,
      `${JSON.stringify(revised, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    ).catch(() => {});
    await removeDiffRun(created.path, { temporaryRoot }).catch(() => {});
  });

  const traversing = JSON.parse(originalManifest);
  traversing.snapshotFile = "../snapshot.json";
  await writeFile(manifestPath, `${JSON.stringify(traversing, null, 2)}\n`, "utf8");
  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /plan pointers are unsafe/u,
  );

  await writeFile(manifestPath, originalManifest, "utf8");
  await unlink(snapshotPath);
  await symlink(join(created.path, "snapshot.json"), snapshotPath);
  await assert.rejects(
    loadDiffRun(created.path, { temporaryRoot }),
    /snapshot is not a regular file/u,
  );
});

test("a failed inspection-plan write leaves the previous manifest authoritative", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-plan-write-failure-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const revised = revisedSnapshot(snapshot, "This plan will not commit.");
  let writes = 0;

  await assert.rejects(
    replaceDiffRunPlan(created.path, revised, {
      temporaryRoot,
      writeJson: async (path, value) => {
        writes += 1;
        if (writes === 2) throw new Error("new pages could not be written");
        await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
          flag: "wx",
          mode: 0o600,
        });
      },
    }),
    /new pages could not be written/u,
  );

  const resumed = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(resumed.snapshot.digest, snapshot.digest);
  assert.equal(resumed.manifest.snapshotFile, undefined);
  assert.equal(resumed.manifest.pagesFile, undefined);
  assert.equal(resumed.manifest.phase, "prepared");
});

test("forced termination during inspection-plan generation preserves the previous plan", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-plan-forced-stop-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const revised = revisedSnapshot(snapshot, "The process will stop before commit.");
  const runModule = new URL("../features/diff/run.mjs", import.meta.url).href;
  const childScript = [
    'import { open } from "node:fs/promises";',
    'import { basename } from "node:path";',
    `const { replaceDiffRunPlan } = await import(${JSON.stringify(runModule)});`,
    `const runPath = ${JSON.stringify(created.path)};`,
    `const temporaryRoot = ${JSON.stringify(temporaryRoot)};`,
    `const snapshot = ${JSON.stringify(revised)};`,
    "const writeJson = async (path, value) => {",
    '  const handle = await open(path, "wx", 0o600);',
    "  try {",
    '    await handle.writeFile(`${JSON.stringify(value, null, 2)}\\n`, "utf8");',
    "    await handle.sync();",
    "  } finally {",
    "    await handle.close();",
    "  }",
    '  if (basename(path).startsWith("snapshot.")) {',
    '    process.stdout.write("snapshot-written\\n");',
    "    setInterval(() => {}, 1_000);",
    "    await new Promise(() => {});",
    "  }",
    "};",
    "await replaceDiffRunPlan(runPath, snapshot, {",
    "  temporaryRoot,",
    "  writeJson,",
    "});",
  ].join("\n");
  const child = spawn(
    process.execPath,
    ["--input-type=module", "--eval", childScript],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.setEncoding("utf8");
  await new Promise((resolve, reject) => {
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes("snapshot-written\n")) resolve();
    });
    child.once("exit", (code) => {
      reject(new Error(`plan child exited early (${code}): ${stderr}`));
    });
  });
  const exit = once(child, "exit");
  child.kill("SIGKILL");
  await exit;

  const resumed = await loadDiffRun(created.path, { temporaryRoot });
  assert.equal(resumed.snapshot.digest, snapshot.digest);
  assert.equal(resumed.manifest.snapshotFile, undefined);
  assert.equal(resumed.manifest.pagesFile, undefined);
  await access(join(created.path, `snapshot.${revised.digest}.json`));
  await assert.rejects(
    access(join(created.path, `pages.${revised.digest}.json`)),
    /ENOENT/u,
  );

  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(join(created.path, ".finish.lock"), stale, stale);
  const recovered = await replaceDiffRunPlan(created.path, revised, {
    temporaryRoot,
  });
  assert.equal(recovered.snapshot.digest, revised.digest);
  assert.equal(recovered.manifest.phase, "prepared");
  await access(join(created.path, recovered.manifest.pagesFile));
});

test("a stale analysis or finalization claim blocks inspection-plan replacement", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-plan-state-"));
  const snapshot = makeSnapshot();
  const withAnalysis = await createDiffRun(snapshot, { temporaryRoot });
  const finalizing = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => {
    await removeDiffRun(withAnalysis.path, { temporaryRoot }).catch(() => {});
    await removeDiffRun(finalizing.path, { temporaryRoot }).catch(() => {});
  });
  await writeFile(withAnalysis.analysisPath, "{}\n", {
    flag: "wx",
    mode: 0o600,
  });
  await assert.rejects(
    replaceDiffRunPlan(
      withAnalysis.path,
      revisedSnapshot(snapshot, "Stale analysis."),
      { temporaryRoot },
    ),
    /after an analysis file exists/u,
  );

  const run = await loadDiffRun(finalizing.path, { temporaryRoot });
  const claim = await claimDiffRunFinalization(run);
  try {
    await assert.rejects(
      replaceDiffRunPlan(
        finalizing.path,
        revisedSnapshot(snapshot, "Finalization started."),
        { temporaryRoot },
      ),
      /already being finalized/u,
    );
  } finally {
    await claim.release();
  }
});

test("a legacy run cannot adopt a generation-based inspection plan", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-plan-legacy-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
  const manifestPath = join(created.path, "run.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.runVersion = LEGACY_RUN_VERSION;
  delete manifest.resources;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    replaceDiffRunPlan(
      created.path,
      revisedSnapshot(snapshot, "Legacy run."),
      { temporaryRoot },
    ),
    /Only a current Hope diff run/u,
  );
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

test("a newer lease generation fences a suspended expiry cleanup", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-cleanup-fence-"));
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const created = await createDiffRun(makeSnapshot(), {
    clock: () => old,
    temporaryRoot,
  });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  let continueCleanup;
  let cleanupClaimed;
  const claimed = new Promise((resolve) => {
    cleanupClaimed = resolve;
  });
  const blocked = new Promise((resolve) => {
    continueCleanup = resolve;
  });
  const cleanup = cleanupExpiredRuns({
    onCleanupClaimed: async ({ path }) => {
      assert.equal(path, created.path);
      cleanupClaimed();
      await blocked;
    },
    temporaryRoot,
  });
  await claimed;

  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(join(created.path, ".finish.lock"), stale, stale);
  const replacement = await claimDiffRunFinalization(run);
  await replacement.assertOwned();
  continueCleanup();

  assert.deepEqual(await cleanup, []);
  await access(created.path);
  await replacement.assertOwned();
  await replacement.release();
  await removeDiffRun(created.path, { temporaryRoot });
});

test("expiry cleanup reclaims a run terminated between private source writes", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-forced-stop-"));
  const runModule = new URL("../features/diff/run.mjs", import.meta.url).href;
  const fixtureModule = new URL("../test-support/diff-fixture.mjs", import.meta.url).href;
  const childScript = [
    'import { open } from "node:fs/promises";',
    'import { basename, dirname } from "node:path";',
    `const { createDiffRun } = await import(${JSON.stringify(runModule)});`,
    `const { makeSnapshot } = await import(${JSON.stringify(fixtureModule)});`,
    `const temporaryRoot = ${JSON.stringify(temporaryRoot)};`,
    "const writeJson = async (path, value) => {",
    '  const handle = await open(path, "wx", 0o600);',
    "  try {",
    '    await handle.writeFile(`${JSON.stringify(value, null, 2)}\\n`, "utf8");',
    "    await handle.sync();",
    "  } finally {",
    "    await handle.close();",
    "  }",
    '  if (basename(path) === "snapshot.json") {',
    '    process.stdout.write(`${dirname(path)}\\n`);',
    "    setInterval(() => {}, 1_000);",
    "    await new Promise(() => {});",
    "  }",
    "};",
    "await createDiffRun(makeSnapshot(), {",
    '  clock: () => new Date("2026-07-20T00:00:00.000Z"),',
    "  temporaryRoot,",
    "  writeJson,",
    "});",
  ].join("\n");
  const child = spawn(
    process.execPath,
    ["--input-type=module", "--eval", childScript],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.setEncoding("utf8");
  const runPath = await new Promise((resolve, reject) => {
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newline = stdout.indexOf("\n");
      if (newline >= 0) resolve(stdout.slice(0, newline));
    });
    child.once("exit", (code) => {
      reject(new Error(`forced-stop child exited early (${code}): ${stderr}`));
    });
  });
  const exit = once(child, "exit");
  child.kill("SIGKILL");
  await exit;

  const manifest = JSON.parse(await readFile(join(runPath, "run.json"), "utf8"));
  assert.equal(manifest.owner, "hope-diff-run");
  await access(join(runPath, "snapshot.json"));
  await assert.rejects(access(join(runPath, "pages.json")), /ENOENT/u);

  const removed = await cleanupExpiredRuns({
    clock: () => new Date("2026-07-22T00:00:00.000Z"),
    temporaryRoot,
  });
  assert.deepEqual(removed, [runPath]);
  await assert.rejects(access(runPath), /ENOENT/u);
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

test("concurrent stale-lease recovery elects only one new owner", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-stale-race-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  const original = await claimDiffRunFinalization(run, {
    scheduleHeartbeat: () => undefined,
  });
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(join(created.path, ".finish.lock"), stale, stale);

  const attempts = await Promise.allSettled([
    claimDiffRunFinalization(run),
    claimDiffRunFinalization(run),
  ]);
  const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
  const rejected = attempts.filter((attempt) => attempt.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason?.code, "EEXIST");

  const winner = fulfilled[0].value;
  await winner.assertOwned();
  await Promise.all([original.release(), winner.release()]);
  await assert.rejects(winner.assertOwned(), /lease was lost/u);
  await removeDiffRun(created.path, { temporaryRoot });
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

test("a fresh run recovers an abandoned next-generation lease after expiry", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-lease-generation-"));
  const created = await createDiffRun(makeSnapshot(), { temporaryRoot });
  const run = await loadDiffRun(created.path, { temporaryRoot });
  await claimDiffRunFinalization(run, {
    scheduleHeartbeat: () => undefined,
  });
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(join(created.path, ".finish.lock"), stale, stale);

  // A force-kill can leave a newly created generation empty before its JSON
  // body is written. The immutable generation remains a fencing record and a
  // later claimant advances without deleting or replacing it.
  const abandonedPath = join(created.path, ".finish.lock.1");
  await writeFile(abandonedPath, "", { flag: "wx", mode: 0o600 });
  await utimes(abandonedPath, stale, stale);

  const recovered = await claimDiffRunFinalization(run);
  await recovered.assertOwned();
  await access(join(created.path, ".finish.lock.2"));
  await recovered.release();
  await assert.rejects(access(join(created.path, ".finish.lock.2")), /ENOENT/u);
  await removeDiffRun(created.path, { temporaryRoot });
});

test("expiry cleanup reclaims an old run with an abandoned lease generation", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-lease-cleanup-"));
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const created = await createDiffRun(makeSnapshot(), {
    clock: () => old,
    temporaryRoot,
  });
  const initialPath = join(created.path, ".finish.lock");
  const abandonedPath = join(created.path, ".finish.lock.1");
  await writeFile(initialPath, "", { flag: "wx", mode: 0o600 });
  await writeFile(abandonedPath, "", { flag: "wx", mode: 0o600 });
  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(initialPath, stale, stale);
  await utimes(abandonedPath, stale, stale);

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

test("a publication failure after successful run removal is not a cleanup failure", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-publication-failure-"));
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

  await assert.rejects(
    finishDiff(created.path, {
      finalize: async () => {
        throw new Error("publication stopped");
      },
      render: async () => ({ bytes: Buffer.from("review"), digest: "digest" }),
      revalidate: async () => ({
        matches: true,
        revalidatedAt: "2026-07-23T00:01:00.000Z",
      }),
      temporaryRoot,
    }),
    (error) => {
      assert.equal(error.message, "publication stopped");
      assert.equal(error.cleanupPending, undefined);
      return true;
    },
  );
  await assert.rejects(access(created.path), /ENOENT/u);
});

test("a normal failure reports when its private run cleanup also fails", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-cleanup-diagnostic-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
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
      removeRun: async () => {
        throw new Error("cleanup storage is unavailable");
      },
      render: async () => {
        throw new Error("renderer stopped");
      },
      temporaryRoot,
    }),
    (error) => {
      assert.match(error.message, /^renderer stopped/u);
      assert.match(error.message, /could not remove its private review data/u);
      assert.match(error.message, /later Hope run will retry expiry cleanup/u);
      assert.equal(error.cause?.message, "renderer stopped");
      assert.equal(error.cleanupError?.message, "cleanup storage is unavailable");
      assert.equal(error.cleanupPending, true);
      return true;
    },
  );
  await access(created.path);
});

test("a lease release failure preserves the primary and cleanup diagnostics", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-run-release-diagnostic-"));
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot, { temporaryRoot });
  context.after(async () => await removeDiffRun(
    created.path,
    { temporaryRoot },
  ).catch(() => {}));
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
      claimFinalization: async () => ({
        release: async () => {
          throw new Error("lease release failed");
        },
      }),
      removeRun: async () => {
        throw new Error("cleanup storage is unavailable");
      },
      render: async () => {
        throw new Error("renderer stopped");
      },
      temporaryRoot,
    }),
    (error) => {
      assert.match(error.message, /^renderer stopped/u);
      assert.match(error.message, /could not remove its private review data/u);
      assert.match(error.message, /could not release its private finalization lease/u);
      assert.equal(error.cause?.cause?.message, "renderer stopped");
      assert.equal(error.cleanupError?.message, "cleanup storage is unavailable");
      assert.equal(error.releaseError?.message, "lease release failed");
      assert.equal(error.cleanupPending, true);
      return true;
    },
  );
  await access(created.path);
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
