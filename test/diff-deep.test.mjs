import assert from "node:assert/strict";
import { writeFile, readFile, symlink, link } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parsePatch } from "../plugins/hope/skills/diff-deep/scripts/changes.mjs";
import { collectPullRequest, diffText, parseTarget } from "../plugins/hope/skills/diff-deep/scripts/github.mjs";
import { validateDocument, mergeExplanations, inspectDocument } from "../plugins/hope/skills/diff-deep/scripts/model.mjs";
import { createArtifact, readArtifact, explainArtifact, artifactStatus } from "../plugins/hope/skills/diff-deep/scripts/artifact.mjs";
import { main } from "../plugins/hope/skills/diff-deep/scripts/cli.mjs";
import { fixture, provider, providerFiles, reasons, target, head, mergeBase } from "../test-support/diff-deep-fixture.mjs";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";
const temp = (context) => registerTestTemporaryDirectoryCleanup((cleanup) => context.after(cleanup))("hope-deep-test-");
const documentFor = (snapshot) => ({ schemaVersion: 1, snapshot, locale: "ko-KR", theme: "system", revision: 0, explanations: [] });

test("patch parser preserves sign-like content, multiple hunks, and no-newline markers", async () => {
  const patch = "@@ -1 +1 @@\n---a\n+++b\n\\ No newline at end of file\n@@ -8,0 +9 @@\n+last";
  const result = parsePatch(patch, { additions: 2, deletions: 1 });
  assert.equal(result.hunks[0].rows[1].text, "++b");
  assert.equal(result.hunks[0].rows[1].noNewline, true);
  assert.equal(result.hunks[1].rows[0].newLine, 9);
  assert.throws(() => parsePatch("@@ -1,2 +1 @@\n-a\n+b"), /incomplete/);
  assert.throws(() => parsePatch("@@ -1 +1 @@\n-a\n+b", { additions: 2, deletions: 1 }), /every reported/);
  assert.throws(() => parsePatch("@@ -1 +1 @@\n-a\n+b\n@@ -1 +1 @@\n-a\n+b"), /overlap/);
  assert.equal((await diffText("a", "b")).includes("No newline"), true);
});

test("capture inventories every line and retains metadata and unavailable files", async () => {
  const snapshot = await fixture();
  assert.equal(snapshot.files.length, 4);
  assert.equal(snapshot.changes.length, 5);
  assert.equal(snapshot.changes.flatMap((change) => change.lineIds).length, 6);
  assert.equal(snapshot.files[2].availability, "metadata");
  assert.equal(snapshot.files[3].availability, "unavailable");
  assert.deepEqual(validateDocument(documentFor(snapshot)).snapshot, snapshot);
  assert.throws(() => validateDocument(documentFor({ ...snapshot, head: "d".repeat(40) })), /digest/);
  assert.throws(() => parseTarget("https://github.com/example/session/pull/42?redirect=evil"), /canonical/);
});

test("capture paginates all files, rejects missing pages and changed heads", async () => {
  const files = Array.from({ length: 101 }, (_, i) => ({ filename: `f${i}.txt`, status: "added", additions: 1, deletions: 0, patch: "@@ -0,0 +1 @@\n+x" }));
  const api = provider({ files });
  const snapshot = await collectPullRequest(target, api);
  assert.equal(snapshot.files.length, 101);
  assert.ok(api.calls.some((path) => path.endsWith("page=2")));
  await assert.rejects(collectPullRequest(target, provider({ mutate: (pull) => { pull.head.sha = "d".repeat(40); } })), /changed during/);
  const broken = provider({ files });
  const exec = broken.exec;
  broken.exec = async (...args) => args[1].at(-1).endsWith("page=2") ? { stdout: "[]" } : exec(...args);
  await assert.rejects(collectPullRequest(target, broken), /every changed file/);
});

test("missing or truncated patches reconstruct from merge base and fork head", async () => {
  const files = [{ filename: "new.txt", previous_filename: "old.txt", status: "renamed", additions: 1, deletions: 1, patch: "@@ -1 +1 @@\n-a" }];
  const api = provider({ files, content: {
    [`/repos/example/session/contents/old.txt?ref=${mergeBase}`]: "a\n",
    [`/repos/contributor/session/contents/new.txt?ref=${head}`]: "b\n",
  } });
  const snapshot = await collectPullRequest(target, api);
  assert.equal(snapshot.files[0].availability, "text");
  assert.match(snapshot.files[0].patch, /\+b/u);
  assert.equal(snapshot.mergeBase, mergeBase);
  const unavailable = await collectPullRequest(target, provider({ files }));
  assert.equal(unavailable.files[0].reason, "source-unavailable");
});

test("restricted content is represented without publishing or fetching it", async () => {
  const files = [{ filename: ".env", status: "added", additions: 1, deletions: 0, patch: "@@ -0,0 +1 @@\n+SECRET=hidden" },
    { filename: "config.txt", status: "added", additions: 1, deletions: 0, patch: `@@ -0,0 +1 @@\n+${"ghp_"}${"a".repeat(24)}` }];
  const api = provider({ files });
  const snapshot = await collectPullRequest(target, api);
  assert.deepEqual(snapshot.files.map((file) => file.reason), ["private-file", "credential"]);
  assert.equal(JSON.stringify(snapshot).includes("SECRET=hidden"), false);
  assert.equal(api.calls.some((path) => path.includes("/contents/")), false);
});

test("explanations require exact identities and statement evidence for stated intent", async () => {
  const snapshot = await fixture();
  const document = documentFor(snapshot);
  const input = reasons(snapshot);
  const merged = mergeExplanations(document, input);
  assert.equal(merged.explanations.length, 5);
  const changed = structuredClone(input); changed.explanations[0].evidence = [];
  assert.throws(() => mergeExplanations(document, changed), /stated reason/);
  changed.explanations[0].basis = "inferred";
  changed.explanations[4].basis = "inferred";
  assert.throws(() => mergeExplanations(document, changed), /unavailable/);
  assert.throws(() => mergeExplanations(document, { ...input, snapshotId: "wrong" }), /different snapshot/);
  const invalid = structuredClone(input); invalid.explanations[0].evidence[0].endLine = 999;
  assert.throws(() => mergeExplanations(document, invalid), /evidence range/);
  assert.throws(() => mergeExplanations(document, { ...input, explanations: [input.explanations[0], input.explanations[0]] }), /Repeated/);
  assert.equal(inspectDocument(merged, { fileId: "src/session.ts" }).changes.length, 2);
  const many = await fixture({ files: Array.from({ length: 15 }, (_, i) => ({ ...providerFiles[1], filename: `test/${i}.ts` })) });
  assert.equal(inspectDocument(documentFor(many)).nextOffset, 12);
  assert.equal(inspectDocument(documentFor(many), { offset: 12 }).changes.length, 3);
});

test("CLI capture-inspect-explain roundtrip seals output and rejects stale updates", async (context) => {
  const directory = await temp(context);
  const output = join(directory, "review.html");
  const captured = await main(["capture", target, "--output", output, "--locale", "ko-KR"], provider());
  const inspected = await main(["inspect", output]);
  assert.equal(inspected.pending, 5);
  const { document } = await readArtifact(output);
  const input = join(directory, "reasons.json");
  await writeFile(input, JSON.stringify(reasons(document.snapshot)));
  const updated = await main(["explain", output, "--input", input, "--expected-digest", captured.digest]);
  assert.equal(updated.pending, 0);
  assert.notEqual(updated.digest, inspected.digest);
  await assert.rejects(explainArtifact(output, input, captured.digest), /stale/);
  const current = await artifactStatus(output, { current: true, ...provider() });
  assert.equal(current.matchesCurrentPR, true);
  await assert.rejects(createArtifact(document.snapshot, { output }), /existing file/);
  const content = await readFile(output, "utf8");
  await writeFile(output, content.replace("diff<span>", "edited<span>"));
  await assert.rejects(readArtifact(output), /outside Diff Deep/);
});

test("artifact rejects linked paths and preserves intervening writes", async (context) => {
  const directory = await temp(context);
  const output = join(directory, "review.html");
  const snapshot = await fixture();
  const captured = await createArtifact(snapshot, { output });
  const symbolic = join(directory, "symbolic.html");
  await symlink(output, symbolic);
  await assert.rejects(readArtifact(symbolic), /regular file/);
  const input = join(directory, "reasons.json");
  await writeFile(input, JSON.stringify(reasons(snapshot)));
  await assert.rejects(explainArtifact(output, input, captured.digest, { beforePublish: async () => { await writeFile(output, "user edit"); } }), /digest marker/);
  assert.equal(await readFile(output, "utf8"), "user edit");
  const second = join(directory, "second.html");
  await createArtifact(snapshot, { output: second });
  await link(second, join(directory, "hard.html"));
  await assert.rejects(readArtifact(second), /regular file/);
});
