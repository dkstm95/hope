import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { isEntrypoint } from "../entrypoint/index.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

test("isEntrypoint resolves links and fails closed for invalid paths", async () => {
  const modulePath = fileURLToPath(import.meta.url);
  const root = await createTestTemporaryDirectory("hope-entrypoint-test-");
  const linkedModulePath = join(root, "entrypoint.test.mjs");
  await symlink(modulePath, linkedModulePath);

  assert.equal(isEntrypoint(import.meta.url, modulePath), true);
  assert.equal(isEntrypoint(import.meta.url, linkedModulePath), true);
  assert.equal(isEntrypoint(import.meta.url, ""), false);
  assert.equal(isEntrypoint(import.meta.url, "/not-a-real-hope-entrypoint"), false);
});
