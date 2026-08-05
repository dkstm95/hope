import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import {
  createSweepInventory,
  sweepInventoryDigest,
  validateSweepInventory,
} from "../features/sweep/inventory.mjs";
import { validateSweepPlan } from "../features/sweep/validate.mjs";
import { makeSweepPlan } from "../test-support/sweep-fixture.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);

test("Sweep inventory captures the complete tracked and unignored codebase", async () => {
  const inventory = await createSweepInventory({ cwd: root });
  const paths = new Set(
    inventory.snapshot.sources
      .filter((source) => source.kind === "file")
      .map((source) => source.locator),
  );
  assert.ok(inventory.fileSourceIds.length > 100);
  assert.equal(inventory.fileSourceIds.length, paths.size);
  assert.ok(paths.has(".gitignore"));
  assert.ok(paths.has("features/sweep/inventory.mjs"));
  assert.ok(paths.has("plugins/hope/skills/sweep/SKILL.md"));
  assert.equal(inventory.digest, sweepInventoryDigest(inventory.snapshot));
  assert.deepEqual(validateSweepInventory(inventory), inventory);
});

test("full-codebase plans cannot hide an incomplete inventory batch", () => {
  const missingCoverage = makeSweepPlan();
  delete missingCoverage.coverage;
  assert.throws(
    () => validateSweepPlan(missingCoverage),
    /coverage is required/u,
  );

  const plan = makeSweepPlan();
  plan.candidates[0].disposition = "report-only";
  plan.candidates[0].behaviorImpact = "uncertain";
  plan.candidates[0].gaps = ["The remaining inventory batch needs inspection."];
  plan.coverage.batches[0].inspection = "partial";
  plan.coverage.batches[0].gaps = ["The remaining inventory batch needs inspection."];
  plan.summary.remainingGaps = ["The remaining inventory batch needs inspection."];
  plan.session.state = "blocked";
  const result = validateSweepPlan(plan);
  assert.equal(result.result.state, "blocked");
  assert.equal(result.resources.coverageState, "partial");
  assert.throws(
    () => validateSweepPlan({
      ...plan,
      coverage: {
        ...plan.coverage,
        inventoryDigest: `sha256:${"0".repeat(64)}`,
      },
    }),
    /inventoryDigest must match/u,
  );
});
