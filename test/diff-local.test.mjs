import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { lstat, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";

import {
  addDiffContext,
  captureDiff,
  publishDiff,
} from "../plugins/hope/skills/diff/scripts/index.mjs";
import { collectLocalChange, revalidateLocalSnapshot } from "../plugins/hope/skills/diff/scripts/local.mjs";
import { loadRun } from "../plugins/hope/skills/diff/scripts/run.mjs";
import { makeAnalysisFor } from "../test-support/diff-fixture.mjs";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";

const execFile = promisify(execFileCallback);
const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const token = `ghp_${"a".repeat(36)}`;

async function git(cwd, ...args) {
  const { stdout } = await execFile("git", [
    "-c", "user.name=Hope Test", "-c", "user.email=hope@example.test", "-c", "commit.gpgsign=false",
    "-c", "init.defaultBranch=main", ...args,
  ], { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  return stdout.trim();
}

async function write(root, path, value) {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), value);
}

/** A repository whose working tree has committed, staged, unstaged, and untracked changes. */
async function repository({ upstream = true } = {}) {
  const parent = await createTestTemporaryDirectory("hope-diff-local-");
  const root = join(parent, "work");
  await mkdir(root);
  await git(root, "init", "--quiet");
  await write(root, "src/app.js", "one\ntwo\nthree\n");
  await write(root, "src/old-name.js", "renamed content\n");
  await write(root, "src/removed.js", "bye\n");
  await write(root, "docs/keep.md", "keep\n");
  await write(root, "config/settings.js", "export const key = null;\n");
  await writeFile(join(root, "assets.bin"), Buffer.from([0, 1, 2, 3]));
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "Base");
  const base = await git(root, "rev-parse", "HEAD");
  if (upstream) {
    await git(root, "remote", "add", "origin", "https://github.com/example/repo.git");
    await git(root, "update-ref", "refs/remotes/origin/main", base);
    await git(root, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  }
  await write(root, "src/app.js", "one\nTWO\nthree\n");
  await git(root, "commit", "--quiet", "-am", "Shout the second line");
  await git(root, "mv", "src/old-name.js", "src/new-name.js");
  await write(root, "config/settings.js", `export const key = "${token}";\n`);
  await git(root, "add", "config/settings.js");
  await write(root, "docs/keep.md", "keep\nmore\n");
  await rm(join(root, "src/removed.js"));
  await writeFile(join(root, "assets.bin"), Buffer.from([0, 9, 9, 9]));
  await write(root, "notes/todo.txt", "write tests\n");
  await write(root, ".env", "SECRET=1\n");
  await writeFile(join(parent, "outside.txt"), "outside secret\n");
  await symlink(join(parent, "outside.txt"), join(root, "linked.txt"));
  await symlink(parent, join(root, "linked-dir"));
  return { base, parent, root };
}

const display = { locale: "en-US", localeSource: "override", theme: "system", themeSource: "default" };

test("the local source captures committed, staged, unstaged, and opt-in untracked changes", async () => {
  const { base, root } = await repository();
  const tracked = await collectLocalChange({ ...display, cwd: root });
  assert.deepEqual(tracked.snapshot.files.map((file) => file.path), [
    "assets.bin", "config/settings.js", "docs/keep.md", "src/app.js", "src/new-name.js", "src/old-name.js", "src/removed.js",
  ]);

  const { snapshot, workingTree } = await collectLocalChange({ ...display, cwd: join(root, "src"), untracked: true });
  const files = Object.fromEntries(snapshot.files.map((file) => [file.path, file]));
  assert.deepEqual(snapshot.change, {
    baseRef: "origin/main",
    baseRevision: base,
    dirty: true,
    headRevision: await git(root, "rev-parse", "HEAD"),
    kind: "local",
    repositoryLabel: "example/repo",
  });
  assert.deepEqual(snapshot.repository, { name: "repo", owner: "example", provider: "github" });
  assert.deepEqual(snapshot.snapshot, { base, head: snapshot.change.headRevision, mergeBase: base });
  assert.equal(workingTree.root, root.replace(/^\/var\//u, "/private/var/"));
  assert.equal(workingTree.untracked, true);

  assert.equal(files["src/app.js"].providerStatus, "modified");
  assert.equal(files["src/old-name.js"].providerStatus, "removed");
  assert.equal(files["src/new-name.js"].providerStatus, "added");
  assert.equal(files["src/removed.js"].providerStatus, "removed");
  assert.equal(files["notes/todo.txt"].providerStatus, "added");
  assert.equal(files["docs/keep.md"].bodyState, "included");
  assert.deepEqual([files["assets.bin"].bodyState, files["assets.bin"].bodyReasonKind], ["metadata-only", "invalid-text"]);
  assert.deepEqual([files[".env"].bodyState, files[".env"].bodyReasonKind], ["redacted", "private-path"]);
  assert.deepEqual([files["config/settings.js"].bodyState, files["config/settings.js"].bodyReasonKind], ["redacted", "credential-pattern"]);
  assert.deepEqual([files["linked.txt"].bodyState, files["linked.txt"].bodyReasonKind], ["metadata-only", "special-entry"]);

  const patch = snapshot.sources.find((source) => source.fileId === files["src/app.js"].id);
  assert.equal(patch.text, "@@ -1,3 +1,3 @@\n one\n-two\n+TWO\n three");
  assert.deepEqual(snapshot.sources.filter((source) => source.kind === "commit-title").map((source) => source.text), ["Shout the second line"]);
  const serialized = JSON.stringify(snapshot);
  for (const secret of [token, "SECRET=1", "outside secret"]) assert.equal(serialized.includes(secret), false, secret);
  assert.ok(snapshot.limits.some((limit) => limit.kind === "file-unavailable" && limit.subject === ".env"));
});

test("the local source needs a default branch or an explicit, option-safe --base", async () => {
  const { root } = await repository({ upstream: false });
  await assert.rejects(collectLocalChange({ ...display, cwd: root }), /Pass --base <ref>/u);
  await assert.rejects(collectLocalChange({ ...display, base: "--output=/tmp/x", cwd: root }), /--base to name a branch/u);
  await assert.rejects(collectLocalChange({ ...display, base: "missing-branch", cwd: root }), /could not find the commit missing-branch/u);
  const { snapshot } = await collectLocalChange({ ...display, base: "HEAD~1", cwd: root });
  assert.equal(snapshot.change.baseRef, "HEAD~1");
  assert.equal(snapshot.change.repositoryLabel, "work");
  assert.equal("repository" in snapshot, false);
});

test("capture falls back to the local source when no pull request is found", async () => {
  const { parent, root } = await repository();
  const result = await captureDiff({ hostLocale: "en-US" }, {
    cwd: root,
    discoverTarget: async () => { throw new Error("No open pull request authored by you was found"); },
    temporaryRoot: parent,
  });
  assert.equal(result.selection, "local-default-base");
  assert.match(result.discovery, /No open pull request/u);
  assert.equal(result.change.kind, "local");
  await assert.rejects(
    captureDiff({ untracked: true, url: "https://github.com/example/repo/pull/1" }, { temporaryRoot: parent }),
    /apply only to local changes/u,
  );
});

test("a file saved during capture fails the capture instead of matching later", async () => {
  const { root } = await repository();
  let edited = false;
  const exec = async (command, args, options) => {
    if (!edited && args.includes("cat-file")) {
      edited = true;
      await write(root, "docs/keep.md", "saved mid-capture\n");
    }
    return await execFile(command, args, options);
  };
  await assert.rejects(
    collectLocalChange({ ...display, cwd: root, exec }),
    /working tree changed while Hope was capturing it/u,
  );
  assert.equal(edited, true);
});

test("local context reads the working tree at head and Git objects at the merge base", async () => {
  const { parent, root } = await repository();
  const dependencies = { cwd: root, temporaryRoot: parent };
  const captured = await captureDiff({ base: "origin/main", hostLocale: "en-US" }, dependencies);
  const added = await addDiffContext(captured.runPath, [
    { path: "docs/keep.md", revision: "head" },
    { path: "src/old-name.js", revision: "merge-base" },
    { path: "linked-dir/outside.txt", revision: "head" },
    { path: "src/missing.js", revision: "merge-base" },
  ], dependencies);
  assert.deepEqual(added.added.map((entry) => entry.reasonKind ?? entry.kind), [
    "context-file", "context-file", "special-entry", "not-found",
  ]);
  const { snapshot } = await loadRun(captured.runPath, dependencies);
  const context = snapshot.sources.filter((source) => source.kind === "context-file");
  assert.deepEqual(context.map((source) => source.text), ["keep\nmore\n", "renamed content\n"]);
  assert.equal(JSON.stringify(snapshot).includes("outside secret"), false);
  assert.match(await readFile(added.bundleParts[0], "utf8"), /^source-\d+:2 more$/mu);
});

test("local revalidation detects a working file edited after capture", async () => {
  const { parent, root } = await repository();
  const dependencies = { cwd: root, temporaryRoot: parent };
  const captured = await captureDiff({ base: "origin/main", hostLocale: "en-US", outputPath: join(parent, "review.html") }, dependencies);
  const run = await loadRun(captured.runPath, dependencies);
  assert.equal((await revalidateLocalSnapshot(run.snapshot, run.manifest.workingTree)).matches, true);
  await writeFile(captured.analysisPath, JSON.stringify(makeAnalysisFor(run.snapshot, captured.runId)));

  await write(root, "docs/keep.md", "keep\nmore\nand more\n");
  assert.equal((await revalidateLocalSnapshot(run.snapshot, run.manifest.workingTree)).matches, false);
  await write(root, "docs/keep.md", "keep\nmore\n");
  await write(root, "src/brand-new.js", "x\n");
  await git(root, "add", "src/brand-new.js");
  assert.equal((await revalidateLocalSnapshot(run.snapshot, run.manifest.workingTree)).matches, false);
  await git(root, "rm", "--cached", "--quiet", "src/brand-new.js");
  await writeFile(join(root, "assets.bin"), Buffer.from([0, 7, 7, 7]));
  assert.equal((await revalidateLocalSnapshot(run.snapshot, run.manifest.workingTree)).matches, false);
  await writeFile(join(root, "assets.bin"), Buffer.from([0, 9, 9, 9]));

  const published = await publishDiff(captured.runPath, dependencies);
  const html = await readFile(published.outputPath, "utf8");
  assert.match(html, new RegExp(`<span class="brand-record">LOCAL-${run.snapshot.change.baseRevision.slice(0, 7)}</span>`, "u"));
  assert.doesNotMatch(html, /class="pull-request-link/u);
  await assert.rejects(lstat(captured.runPath), { code: "ENOENT" });

  const second = await captureDiff({ base: "origin/main", hostLocale: "en-US" }, dependencies);
  const secondRun = await loadRun(second.runPath, dependencies);
  await writeFile(second.analysisPath, JSON.stringify(makeAnalysisFor(secondRun.snapshot, second.runId)));
  await write(root, "src/app.js", "changed again\n");
  await assert.rejects(publishDiff(second.runPath, dependencies), { code: "HOPE_DIFF_STALE" });
});

test("editing a head context file after it was collected makes the local review stale", async () => {
  const { parent, root } = await repository();
  const dependencies = { cwd: root, temporaryRoot: parent };
  const captured = await captureDiff({ base: "origin/main", hostLocale: "en-US" }, dependencies);
  // An untracked file is outside the captured paths, so only the context recheck sees its edit.
  await addDiffContext(captured.runPath, [{ path: "notes/todo.txt", revision: "head" }], dependencies);
  const run = await loadRun(captured.runPath, dependencies);
  await writeFile(captured.analysisPath, JSON.stringify(makeAnalysisFor(run.snapshot, captured.runId)));
  assert.equal((await revalidateLocalSnapshot(run.snapshot, run.manifest.workingTree)).matches, true);
  await write(root, "notes/todo.txt", "write more tests\n");
  await assert.rejects(publishDiff(captured.runPath, dependencies), { code: "HOPE_DIFF_STALE" });
});
