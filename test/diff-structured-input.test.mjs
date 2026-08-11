import assert from "node:assert/strict";
import { symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  readBoundedJson,
} from "../plugins/hope/skills/diff/scripts/structured-input.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

test("bounded structured input rejects symlinks and oversized files", async () => {
  const root = await createTestTemporaryDirectory("hope-work-input-");
  const target = join(root, "target.json");
  const link = join(root, "link.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  await assert.rejects(readBoundedJson(link), /regular file/u);

  const large = join(root, "large.json");
  await writeFile(large, JSON.stringify({ value: "x".repeat(200) }));
  await assert.rejects(
    readBoundedJson(large, { maximumBytes: 64 }),
    /exceeds 64 bytes/u,
  );
});

test("bounded structured input rejects excessive nesting", async () => {
  const root = await createTestTemporaryDirectory("hope-work-depth-");
  const inputPath = join(root, "deep.json");
  const nested = `${'{"next":'.repeat(160)}null${"}".repeat(160)}`;
  await writeFile(inputPath, nested);
  await assert.rejects(
    readBoundedJson(inputPath),
    /exceeds 128 nesting levels/u,
  );
});

test("bounded structured input returns the parsed value and file size", async () => {
  const root = await createTestTemporaryDirectory("hope-work-input-");
  const inputPath = join(root, "input.json");
  const source = '{"ready":true}\n';
  await writeFile(inputPath, source);
  const input = await readBoundedJson(inputPath);
  assert.deepEqual(input.value, { ready: true });
  assert.equal(input.fileBytes, Buffer.byteLength(source));
});
