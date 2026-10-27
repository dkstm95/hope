import assert from "node:assert/strict";
import { lstat, mkdir, readdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  addDiffContext,
  cancelDiff,
  captureDiff,
  DIFF_PUBLICATION_RETRYABLE_CODE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
  publishDiff,
  validateDiff,
} from "../plugins/hope/skills/diff/scripts/index.mjs";
import { isRetryableGitHubAccessError } from "../plugins/hope/skills/diff/scripts/github.mjs";
import { loadRun, removeRun } from "../plugins/hope/skills/diff/scripts/run.mjs";
import { makeAnalysisFor } from "../test-support/diff-fixture.mjs";
import { fakeGitHub, response } from "../test-support/diff-github-fake.mjs";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const url = "https://github.com/example/repo/pull/1";

async function captured({ gh = fakeGitHub(), output = true, ...options } = {}) {
  const root = await createTestTemporaryDirectory("hope-diff-runtime-");
  const dependencies = { gh, temporaryRoot: root };
  const result = await captureDiff({
    hostLocale: "en-US",
    outputPath: output ? join(root, "review.html") : undefined,
    url,
    ...options,
  }, dependencies);
  return { dependencies, result, root };
}

async function writeAnalysis(result, dependencies) {
  const run = await loadRun(result.runPath, dependencies);
  await writeFile(result.analysisPath, JSON.stringify(makeAnalysisFor(run.snapshot, result.runId)));
}

test("capture writes a private run with a bundle the model can cite from alone", async () => {
  const { result } = await captured();
  assert.equal(result.selection, "explicit-url");
  assert.equal(result.change.kind, "github");
  assert.equal(result.change.number, 1);
  assert.deepEqual(result.next.validate, ["validate", "--run", result.runPath]);
  assert.deepEqual(result.next.publish, ["publish", "--run", result.runPath]);
  assert.match(result.analysisSchemaPath, /analysis-v6\.schema\.json$/u);
  for (const path of [result.runPath, join(result.runPath, "bundle")]) {
    assert.equal((await lstat(path)).mode & 0o777, 0o700);
  }
  assert.deepEqual((await readdir(result.runPath)).sort(), ["bundle", "notes.md", "run.json", "snapshot.json"]);
  assert.equal(await readFile(result.notesPath, "utf8"), "");
  const index = JSON.parse(await readFile(result.bundleIndexPath, "utf8"));
  assert.equal(index.runId, result.runId);
  assert.equal(index.snapshotDigest, result.snapshotDigest);
  assert.deepEqual(index.files.map((file) => [file.id, file.path, file.sourceIds]), [["file-1", "src/error.js", ["source-4"]]]);
  const part = await readFile(result.bundleParts[0], "utf8");
  assert.match(part, /^source-4:2 -old$/mu);
  assert.match(part, /^source-4:3 \+new$/mu);
});

test("capture and publish produce one artifact and remove the run", async () => {
  const { dependencies, result, root } = await captured();
  await writeAnalysis(result, dependencies);
  const validated = await validateDiff(result.runPath, dependencies);
  assert.equal(validated.valid, true);
  const published = await publishDiff(result.runPath, dependencies);
  assert.equal(published.outputPath, join(await realpath(root), "review.html"));
  const html = await readFile(published.outputPath, "utf8");
  assert.match(html, /<span class="brand-record">PR-1<\/span>/u);
  await assert.rejects(lstat(result.runPath), { code: "ENOENT" });
});

test("an invalid analysis keeps the run for repair", async () => {
  const { dependencies, result } = await captured();
  await writeFile(result.analysisPath, JSON.stringify({ schemaVersion: 5 }));
  await assert.rejects(publishDiff(result.runPath, dependencies), (error) => {
    assert.equal(error.code, "HOPE_ANALYSIS_INVALID");
    assert.equal(error.canRetry, true);
    return true;
  });
  assert.ok((await lstat(result.runPath)).isDirectory());
});

test("a render failure keeps the run instead of deleting it", async () => {
  const { dependencies, result } = await captured();
  await writeAnalysis(result, dependencies);
  await assert.rejects(
    publishDiff(result.runPath, { ...dependencies, render: async () => { throw new Error("renderer broke"); } }),
    (error) => {
      assert.equal(error.code, "HOPE_DIFF_RENDER_FAILED");
      assert.equal(error.runPath, result.runPath);
      return true;
    },
  );
  assert.ok((await lstat(result.runPath)).isDirectory());
});

test("revalidation and publication failures stay retryable with the same run", async () => {
  const { dependencies, result } = await captured();
  await writeAnalysis(result, dependencies);
  const offline = async () => {
    const error = new Error("offline");
    error.code = 1;
    throw error;
  };
  await assert.rejects(publishDiff(result.runPath, { ...dependencies, gh: offline }), (error) => {
    assert.equal(error.code, DIFF_REVALIDATION_RETRYABLE_CODE);
    assert.equal(error.command, "publish");
    assert.ok(isRetryableGitHubAccessError(error.cause));
    return true;
  });
  await assert.rejects(
    publishDiff(result.runPath, { ...dependencies, finalize: async () => { throw new Error("disk full"); } }),
    { code: DIFF_PUBLICATION_RETRYABLE_CODE },
  );
  assert.ok((await lstat(result.runPath)).isDirectory());
  assert.ok((await publishDiff(result.runPath, dependencies)).outputPath);
});

test("a moved pull request head stops publication and removes the run", async () => {
  const { dependencies, result } = await captured();
  await writeAnalysis(result, dependencies);
  const original = fakeGitHub();
  const moved = async (command, arguments_) => {
    const value = await original(command, arguments_);
    if (arguments_.at(-1) !== "/repos/example/repo/pulls/1") return value;
    const pull = JSON.parse(value.stdout);
    return response({ ...pull, head: { ...pull.head, sha: "d".repeat(40) } });
  };
  await assert.rejects(publishDiff(result.runPath, { ...dependencies, gh: moved }), { code: "HOPE_DIFF_STALE" });
  await assert.rejects(lstat(result.runPath), { code: "ENOENT" });
});

test("GitHub context appends a source, a limit, and a new bundle part", async () => {
  const { dependencies, result } = await captured();
  const added = await addDiffContext(result.runPath, [
    { path: "src/caller.js", revision: "head" },
    { path: ".env", revision: "merge-base" },
  ], dependencies);
  assert.notEqual(added.snapshotDigest, result.snapshotDigest);
  assert.deepEqual(added.added.map((entry) => entry.kind), ["context-file", "context-unavailable"]);
  assert.equal(added.bundleParts.length, 1);
  assert.match(added.bundleParts[0], /part-02\.md$/u);
  assert.match(await readFile(added.bundleParts[0], "utf8"), /^source-5:1 new$/mu);
  const run = await loadRun(result.runPath, dependencies);
  assert.equal(run.snapshot.digest, added.snapshotDigest);
  assert.deepEqual(run.snapshot.limits.at(-1), {
    id: "limit-3",
    kind: "context-unavailable",
    reason: "The file name commonly contains private configuration",
    reasonKind: "private-path",
    revision: "c".repeat(40),
    subject: ".env",
  });
  const index = JSON.parse(await readFile(result.bundleIndexPath, "utf8"));
  assert.deepEqual(index.parts.map((part) => part.name), ["part-01.md", "part-02.md"]);
  await assert.rejects(
    addDiffContext(result.runPath, [{ path: "src/caller.js", revision: "head" }], dependencies),
    /already collected this exact context file/u,
  );
});

test("run removal checks identity and preserves a replaced directory", async () => {
  const { dependencies, result } = await captured();
  const run = await loadRun(result.runPath, dependencies);
  const moved = `${result.runPath}-original`;
  await rename(result.runPath, moved);
  await mkdir(result.runPath, { mode: 0o700 });
  await assert.rejects(removeRun(run), (error) => {
    assert.equal(error.code, "HOPE_DIFF_RUN_REPLACED");
    assert.equal(error.preservedPath, result.runPath);
    return true;
  });
  assert.ok((await lstat(result.runPath)).isDirectory());
  assert.ok((await lstat(moved)).isDirectory());
});

test("only Hope-owned run directories can be loaded or cancelled", async () => {
  const { dependencies, result, root } = await captured();
  const outside = join(root, "run-outside");
  await mkdir(outside, { mode: 0o700 });
  await assert.rejects(cancelDiff(outside, dependencies), /outside Hope's private run storage/u);
  const manifest = JSON.parse(await readFile(join(result.runPath, "run.json"), "utf8"));
  await writeFile(join(result.runPath, "run.json.forged"), JSON.stringify({ ...manifest, owner: "someone" }), { mode: 0o600 });
  await rename(join(result.runPath, "run.json.forged"), join(result.runPath, "run.json"));
  await assert.rejects(cancelDiff(result.runPath, dependencies), /ownership does not match/u);
  assert.ok((await lstat(result.runPath)).isDirectory());
});

test("cancel removes the run it captured", async () => {
  const { dependencies, result } = await captured();
  await cancelDiff(result.runPath, dependencies);
  await assert.rejects(lstat(result.runPath), { code: "ENOENT" });
});
