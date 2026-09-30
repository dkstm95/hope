import assert from "node:assert/strict";
import { writeFile, readFile, symlink, link } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { renderArtifact } from "../plugins/hope/skills/diff-deep/scripts/render.mjs";
import { buildLayout } from "../plugins/hope/skills/diff-deep/scripts/layout.mjs";
import { parsePatch } from "../plugins/hope/skills/diff-deep/scripts/changes.mjs";
import { collectPullRequest, diffText, parseTarget } from "../plugins/hope/skills/diff-deep/scripts/github.mjs";
import { validateDocument, replaceGroups, inspectDocument } from "../plugins/hope/skills/diff-deep/scripts/model.mjs";
import { createArtifact, readArtifact, explainArtifact, artifactStatus } from "../plugins/hope/skills/diff-deep/scripts/artifact.mjs";
import { main } from "../plugins/hope/skills/diff-deep/scripts/cli.mjs";
import { fixture, provider, providerFiles, reasons, target, head, mergeBase } from "../test-support/diff-deep-fixture.mjs";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";
const temp = (context) => registerTestTemporaryDirectoryCleanup((cleanup) => context.after(cleanup))("hope-deep-test-");
const documentFor = (snapshot) => ({ schemaVersion: 3, snapshot, locale: "ko-KR", theme: "system", revision: 0, groups: [] });

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
  assert.equal(snapshot.files.reduce((total, file) => total + file.additions + file.deletions, 0), 6);
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

test("groups require exact identities and statement evidence for stated intent", async () => {
  const snapshot = await fixture();
  const document = documentFor(snapshot);
  const input = reasons(snapshot);
  const merged = replaceGroups(document, input);
  assert.equal(merged.groups.length, 4);
  const changed = structuredClone(input); changed.groups[0].evidence = [];
  assert.throws(() => replaceGroups(document, changed), /stated reason/);
  const metadataInference = structuredClone(input);
  metadataInference.groups[3].basis = "inferred";
  metadataInference.groups[3].why = "The filename suggests this is a session illustration; its contents were not captured.";
  assert.equal(replaceGroups(document, metadataInference).groups[3].basis, "inferred");
  assert.throws(() => replaceGroups(document, { ...input, snapshotId: "wrong" }), /different snapshot/);
  const invalid = structuredClone(input); invalid.groups[0].evidence[0].endLine = 999;
  assert.throws(() => replaceGroups(document, invalid), /evidence range/);
  assert.throws(() => replaceGroups(document, { ...input, groups: [input.groups[0], input.groups[0]] }), /Duplicate/);
  assert.equal(inspectDocument(merged, { fileId: "src/session.ts" }).files.length, 1);
  const many = await fixture({ files: Array.from({ length: 3 }, (_, i) => ({ ...providerFiles[1], filename: `test/${i}.ts`, additions: 1, patch: "@@ -0,0 +1 @@\n+" + "x".repeat(30_000) })) });
  const first = inspectDocument(documentFor(many));
  assert.equal(first.nextOffset, 1);
  assert.equal(first.sources.length, 1);
  const next = inspectDocument(documentFor(many), { offset: 1 });
  assert.equal(next.files.length, 1);
  assert.equal(Object.hasOwn(next, "sources"), false);
  assert.equal(Object.hasOwn(first.files[0], "hunks"), false);

});

test("CLI capture-inspect-explain roundtrip seals output and rejects stale updates", async (context) => {
  const directory = await temp(context);
  const output = join(directory, "review.html");
  const captured = await main(["capture", target, "--output", output, "--locale", "ko-KR"], provider());
  const inspected = await main(["inspect", output]);
  assert.equal(inspected.pending, 4);
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


test("group explanations allow needed detail without editorial length or excerpt limits", async () => {
  const snapshot = await fixture({ body: Array.from({ length: 60 }, (_, index) => `Statement ${index}`).join("\n") });
  const input = { snapshotId: snapshot.id, groups: [{ id: "g-detail", parts: [{ fileId: snapshot.files[0].id }],
    title: "t".repeat(121), why: "Reason ".repeat(250), basis: "stated",
    evidence: [{ sourceId: "pr-description", startLine: 1, endLine: 50 }] }] };
  assert.equal(replaceGroups(documentFor(snapshot), input).groups.length, 1);
  assert.throws(() => validateDocument({ ...documentFor(snapshot), schemaVersion: 1 }), /older reader/);
  const wrongId = structuredClone(snapshot); wrongId.files[0].id = "f-invalid";
  assert.throws(() => validateDocument(documentFor(wrongId)), /file identity/);
});

test("large repeated excerpts stop before replacing the readable artifact", async (context) => {
  const directory = await temp(context);
  const snapshot = await fixture({ body: "x".repeat(60_000) });
  const captured = await createArtifact(snapshot, { output: join(directory, "review.html") });
  const input = join(directory, "reasons.json");
  await writeFile(input, JSON.stringify({ snapshotId: snapshot.id, groups: [{
    id: "g-detail", parts: [{ fileId: snapshot.files[0].id }], title: "Reason", why: "Captured statement", basis: "stated",
    evidence: Array.from({ length: 500 }, () => ({ sourceId: "pr-description", startLine: 3, endLine: 3 })),
  }] }));
  await assert.rejects(explainArtifact(captured.artifactPath, input, captured.digest), /artifact size limit/);
  assert.equal((await readArtifact(captured.artifactPath)).digest, captured.digest);
});


test("semantic groups reorder files and split hunks without duplicating or dropping source rows", async () => {
  const snapshot = await fixture();
  const input = reasons(snapshot);
  input.groups = [input.groups[1], input.groups[0], ...input.groups.slice(2)];
  const document = replaceGroups(documentFor(snapshot), input);
  const layout = buildLayout(snapshot, document.groups);
  assert.equal(layout.pendingLines, 0);
  assert.equal(layout.pendingFiles, 0);
  assert.equal(layout.groups[0].id, "g-label");
  assert.deepEqual(layout.groups[1].parts.map((part) => part.file.path), ["src/session.ts", "test/session.test.ts"]);
  const displayed = layout.groups.flatMap((group) => group.parts.flatMap((part) => part.segments.flatMap((segment) => segment.rows.map((row) => [part.fileId, row]))));
  const source = snapshot.files.filter((file) => file.patch).flatMap((file) => parsePatch(file.patch).hunks.flatMap((hunk) => hunk.rows.map((row) => [file.id, row])));
  const sort = (values) => values.sort((a, b) => a[0].localeCompare(b[0]) || a[1].sourceLine - b[1].sourceLine);
  assert.deepEqual(sort(displayed), sort(source));
  const incomplete = buildLayout(snapshot, document.groups.slice(0, 1));
  assert.equal(incomplete.pendingLines, 4);
  assert.equal(incomplete.pendingFiles, 4);
  assert.equal(incomplete.groups.filter((group) => group.pending).length, 4);
  const overlapping = structuredClone(input); overlapping.groups[1].parts[0].endLine = 7;
  assert.throws(() => replaceGroups(documentFor(snapshot), overlapping), /overlap/);
  const outOfBounds = structuredClone(input); outOfBounds.groups[0].parts[0].endLine = 999;
  assert.throws(() => replaceGroups(documentFor(snapshot), outOfBounds), /code range/);
  const contextOnly = structuredClone(input); contextOnly.groups[0].parts[0] = { fileId: snapshot.files[0].id, startLine: 2, endLine: 2 };
  assert.throws(() => replaceGroups(documentFor(snapshot), contextOnly), /changed line/);
  const metadataRange = structuredClone(input); metadataRange.groups[2].parts[0].startLine = 1; metadataRange.groups[2].parts[0].endLine = 1;
  assert.throws(() => replaceGroups(documentFor(snapshot), metadataRange), /cannot have code ranges/);
});

test("split groups keep no-newline markers and exact before/after coordinates", async () => {
  const snapshot = await fixture({ files: [{ filename: "example.txt", status: "modified", additions: 2, deletions: 1,
    patch: "@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file\n@@ -8,0 +9 @@\n+last" }] });
  const group = { id: "g-end", title: "End", why: "Last line", basis: "inferred", parts: [{ fileId: snapshot.files[0].id, startLine: 6, endLine: 6 }] };
  const layout = buildLayout(snapshot, replaceGroups(documentFor(snapshot), { snapshotId: snapshot.id, groups: [group] }).groups);
  assert.equal(layout.groups[0].parts[0].segments[0].rows[0].newLine, 9);
  assert.equal(layout.pendingLines, 2);
  const remaining = layout.groups[1].parts[0].segments[0].rows;
  assert.equal(remaining[1].noNewline, true);
  assert.equal(remaining[0].oldLine, 1);
  const output = await renderArtifact(replaceGroups(documentFor(snapshot), { snapshotId: snapshot.id, groups: [group] }));
  assert.match(output, /@@ -8,0 \+9,1 @@/u);
});
