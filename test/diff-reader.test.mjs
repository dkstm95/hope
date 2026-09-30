import assert from "node:assert/strict";
import test from "node:test";
import { rename, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";
import { parsePatch } from "../plugins/hope/skills/diff/scripts/patch.mjs";
import { diffText } from "../plugins/hope/skills/diff/scripts/reconstruct-patch.mjs";
import { buildLayout } from "../plugins/hope/skills/diff/scripts/reader/layout.mjs";
import { readerSnapshot } from "../plugins/hope/skills/diff/scripts/reader/snapshot.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import { renderReview } from "../plugins/hope/skills/diff/scripts/render.mjs";
import { fixture, reasons, analysisFor, runId } from "../test-support/diff-reader-fixture.mjs";
const validate = (snapshot, groups) => validateAnalysis({ ...analysisFor(snapshot), groups }, snapshot, { runId });
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

test("semantic groups reorder files and split hunks without duplicating or dropping source rows", async () => {
  const snapshot = await fixture();
  const input = reasons(snapshot);
  input.groups = [input.groups[1], input.groups[0], ...input.groups.slice(2)];
  const { reader } = validate(snapshot, input.groups);
  const layout = reader.layout;
  assert.equal(layout.pendingLines, 0);
  assert.equal(layout.pendingFiles, 0);
  assert.equal(layout.groups[0].id, "g-label");
  assert.deepEqual(layout.groups[1].parts.map((part) => part.file.path), ["src/session.ts", "test/session.test.ts"]);
  const displayed = layout.groups.flatMap((group) => group.parts.flatMap((part) => part.segments.flatMap((segment) => segment.rows.map((row) => [part.fileId, row]))));
  const source = reader.snapshot.files.filter((file) => file.patch).flatMap((file) => parsePatch(file.patch).hunks.flatMap((hunk) => hunk.rows.map((row) => [file.id, row])));
  const sort = (values) => values.sort((a, b) => a[0].localeCompare(b[0]) || a[1].sourceLine - b[1].sourceLine);
  assert.deepEqual(sort(displayed), sort(source));
  const incomplete = buildLayout(reader.snapshot, input.groups.slice(0, 1));
  assert.equal(incomplete.pendingLines, 4);
  assert.equal(incomplete.pendingFiles, 4);
  assert.equal(incomplete.groups.filter((group) => group.pending).length, 4);
  const overlapping = structuredClone(input); overlapping.groups[1].parts[0].endLine = 7;
  assert.throws(() => validate(snapshot, overlapping.groups), /overlap/);
  const outOfBounds = structuredClone(input); outOfBounds.groups[0].parts[0].endLine = 999;
  assert.throws(() => validate(snapshot, outOfBounds.groups), /code range/);
  const contextOnly = structuredClone(input); contextOnly.groups[0].parts[0] = { fileId: snapshot.files[0].id, startLine: 2, endLine: 2 };
  assert.throws(() => validate(snapshot, contextOnly.groups), /changed line/);
  const metadataRange = structuredClone(input); metadataRange.groups[2].parts[0].startLine = 1; metadataRange.groups[2].parts[0].endLine = 1;
  assert.throws(() => validate(snapshot, metadataRange.groups), /cannot have code ranges/);
});

test("groups are required, complete, and grounded in the same captured sources", async () => {
  const snapshot = fixture();
  const groups = reasons(snapshot).groups;
  assert.throws(() => validate(snapshot, undefined), /groups/);
  assert.throws(() => validate(snapshot, groups.slice(1)), /unassigned/);
  const stated = structuredClone(groups); stated[0].evidence = stated[0].evidence.slice(1);
  assert.throws(() => validate(snapshot, stated), /stated-source/);
  const duplicate = structuredClone(groups); duplicate[1].id = duplicate[0].id;
  assert.throws(() => validate(snapshot, duplicate), /Duplicate group/);
  const halfRange = structuredClone(groups); delete halfRange[0].parts[0].endLine;
  assert.throws(() => validate(snapshot, halfRange), /endpoints/);
  const review = validate(snapshot, groups);
  const output = (await renderReview(review)).bytes.toString();
  assert.equal((output.match(/class="code-row (?:add|del)"/gu) ?? []).length, 6);
  const state = JSON.parse(output.match(/id="diff-reader-document" type="application\/json">(.*?)<\/script>/su)[1]);
  assert.equal("patch" in state.snapshot.files[0], false);
  assert.equal("groups" in state, false);
});

test("split groups preserve no-newline markers and zero-count coordinates", () => {
  const snapshot = fixture({ files: [{ filename: "example.txt", status: "modified", additions: 2, deletions: 1,
    patch: "@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file\n@@ -8,0 +9 @@\n+last" }] });
  const layout = buildLayout(readerSnapshot(snapshot), [{ id: "g-end", parts: [{ fileId: snapshot.files[0].id, startLine: 6, endLine: 6 }] }]);
  const segment = layout.groups[0].parts[0].segments[0];
  assert.equal(segment.oldStart, 9);
  assert.equal(segment.rows[0].newLine, 9);
  assert.equal(layout.pendingLines, 2);
  assert.equal(layout.groups[1].parts[0].segments[0].rows[1].noNewline, true);
});

test("patch reconstruction preserves replacement files and reports cleanup ownership failure", async (context) => {
  const directory = await registerTestTemporaryDirectoryCleanup((cleanup) => context.after(cleanup))("hope-patch-ownership-");
  let replaced;
  await assert.rejects(diffText("old", "new", {
    temporaryRoot: directory,
    execute: async (_command, _arguments, options) => {
      replaced = join(options.cwd, "before");
      await rename(replaced, join(options.cwd, "owned-before"));
      await writeFile(replaced, "replacement");
      return { stdout: "@@ -1 +1 @@\n-old\n+new\n" };
    },
  }), (error) => error.code === "HOPE_PATCH_CLEANUP_FAILED" && error.preservedPath.startsWith(directory));
  assert.equal(await readFile(replaced, "utf8"), "replacement");
});
