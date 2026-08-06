import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverSweepInventory,
  verifySweepInventoryRepository,
} from "../features/sweep/discovery.mjs";

test("sweep discovery binds the inventory to the current Git worktree", async () => {
  const inventory = await discoverSweepInventory({
    root: process.cwd(),
    sessionId: "discovery-test-session",
  });
  assert.equal(inventory.discovery.protocol, "git-worktree-v1");
  assert.ok(inventory.discovery.revision.length >= 40);
  assert.ok(inventory.files.length > 0);
  assert.equal(inventory.summary.totalFiles, inventory.files.length);
  assert.match(inventory.discovery.manifestDigest, /^sha256:[a-f0-9]{64}$/u);
  await verifySweepInventoryRepository(inventory, { root: process.cwd() });
});
