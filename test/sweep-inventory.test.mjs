import assert from "node:assert/strict";
import test from "node:test";

import {
  completeSweepInventoryBatch,
  createSweepInventory,
  getSweepInventoryBatch,
  startSweepInventoryBatch,
  createSweepInventoryBatchResult,
  sweepInventoryDigest,
  sweepInventoryManifestDigest,
  validateSweepInventory,
  validateSweepInventoryBatchInput,
} from "../features/sweep/inventory.mjs";
import { validateSweepPlan } from "../features/sweep/validate.mjs";
import { makeSweepPlan } from "../test-support/sweep-fixture.mjs";

const digest = (character) => `sha256:${character.repeat(64)}`;

function snapshot() {
  return {
    capturedAt: "2026-08-05T00:00:00.000Z",
    sources: [{
      id: "repo",
      kind: "git",
      label: "Repository head",
      locator: "git:example/hope",
      revision: "1".repeat(40),
    }],
  };
}

function makeInventory(fileCount = 130) {
  const files = Array.from({ length: fileCount }, (_, index) => ({
    id: `file-${index + 1}`,
    path: `src/file-${index + 1}.mjs`,
    kind: index % 2 === 0 ? "tracked" : "untracked",
    digest: digest((index % 10).toString(16)),
  }));
  const exclusions = [
    {
      path: "node_modules",
      kind: "ignored-dependency",
      reason: "Installed dependencies are not project-owned source files.",
    },
  ];
  return createSweepInventory({
    title: "Whole project inventory",
    sessionId: "sweep-example-session",
    scope: "Every project-owned worktree file",
    snapshot: snapshot(),
    discovery: {
      protocol: "git-worktree-v1",
      repository: "/tmp/hope-test",
      revision: "1".repeat(40),
      manifestDigest: sweepInventoryManifestDigest(files, exclusions),
      verifiedAt: "2026-08-05T00:00:00.000Z",
    },
    files,
    exclusions,
  });
}

test("sweep inventory partitions the whole project without hiding files", () => {
  const inventory = makeInventory();
  assert.equal(inventory.state, "ready");
  assert.equal(inventory.batches.length, 2);
  assert.equal(inventory.summary.totalFiles, 130);
  assert.equal(inventory.summary.excludedFiles, 1);
  assert.equal(inventory.batches[0].sourceIds.length, 127);
  assert.equal(inventory.batches[1].sourceIds.length, 3);

  const assigned = inventory.batches.flatMap((batch) => batch.sourceIds);
  assert.equal(new Set(assigned).size, 130);
  assert.deepEqual(
    assigned,
    inventory.files.map((file) => file.id),
  );
  assert.equal(validateSweepInventory(inventory).state, "ready");
});

test("sweep batch input preserves exact assignment order and worker mode", () => {
  const inventory = makeInventory();
  const batchInput = getSweepInventoryBatch(inventory, "batch-1");
  const validatedInput = validateSweepInventoryBatchInput(batchInput);
  assert.deepEqual(
    validatedInput.files.map((file) => file.id),
    validatedInput.batch.sourceIds,
  );

  const started = startSweepInventoryBatch(
    inventory,
    "batch-1",
    { mode: "parallel", workerIds: ["worker-a", "worker-b"] },
  );
  assert.equal(started.state, "in-progress");
  assert.deepEqual(started.batches[0].execution, {
    mode: "parallel",
    workerIds: ["worker-a", "worker-b"],
  });

  const completed = completeSweepInventoryBatch(
    started,
    "batch-1",
    {
      state: "complete",
      ...createSweepInventoryBatchResult({
        batchId: "batch-1",
        inventoryDigest: started.batches[0].inventoryDigest,
        inputDigest: started.batches[0].inputDigest,
        state: "complete",
        execution: { mode: "parallel", workerIds: ["worker-a", "worker-b"] },
        receipts: started.batches[0].assignments.map((assignment) => ({
          workerId: assignment.workerId,
          processedSourceIds: assignment.sourceIds,
          gaps: [],
        })),
      }),
    },
  );
  assert.equal(completed.summary.processedFiles, 127);
  assert.equal(completed.summary.remainingFiles, 3);
  assert.equal(completed.state, "in-progress");
});

test("sweep completion requires the started input and immutable execution", () => {
  const inventory = makeInventory(2);
  const batchInput = getSweepInventoryBatch(inventory, "batch-1");
  const result = createSweepInventoryBatchResult({
    batchId: "batch-1",
    inventoryDigest: batchInput.inventoryDigest,
    inputDigest: sweepInventoryDigest(inventory),
    state: "complete",
    execution: { mode: "single", workerIds: [] },
    receipts: [{
      workerId: "host",
      processedSourceIds: ["file-1", "file-2"],
      gaps: [],
    }],
  });
  assert.throws(
    () => completeSweepInventoryBatch(inventory, "batch-1", result),
    /must be in-progress/u,
  );

  const started = startSweepInventoryBatch(
    inventory,
    "batch-1",
    { mode: "parallel", workerIds: ["worker-a", "worker-b"] },
  );
  const validInputDigest = started.batches[0].inputDigest;
  const mismatchedExecution = createSweepInventoryBatchResult({
    batchId: "batch-1",
    inventoryDigest: started.batches[0].inventoryDigest,
    inputDigest: validInputDigest,
    state: "complete",
    execution: { mode: "sequential", workerIds: [] },
    receipts: [{
      workerId: "host",
      processedSourceIds: ["file-1", "file-2"],
      gaps: [],
    }],
  });
  assert.throws(
    () => completeSweepInventoryBatch(started, "batch-1", mismatchedExecution),
    /execution must match/u,
  );
});

test("sweep inventory has no project-wide file-count cap", () => {
  const inventory = makeInventory(4_097);
  assert.equal(inventory.summary.totalFiles, 4_097);
  assert.equal(inventory.batches.length, 33);
});

test("sweep inventory records partial worker coverage and rejects forged completion", () => {
  let inventory = makeInventory();
  inventory = startSweepInventoryBatch(
    inventory,
    "batch-1",
    { mode: "sequential", workerIds: [] },
  );
  assert.throws(
    () => completeSweepInventoryBatch(inventory, "batch-1", {
      state: "complete",
      ...createSweepInventoryBatchResult({
        batchId: "batch-1",
        inventoryDigest: inventory.batches[0].inventoryDigest,
        inputDigest: inventory.batches[0].inputDigest,
        state: "complete",
        execution: { mode: "sequential", workerIds: [] },
        receipts: [{
          workerId: "host",
          processedSourceIds: [inventory.batches[0].sourceIds[0]],
          gaps: [],
        }],
      }),
    }),
    /process every assigned file/u,
  );

  inventory = completeSweepInventoryBatch(
    inventory,
    "batch-1",
    {
      ...createSweepInventoryBatchResult({
        batchId: "batch-1",
        inventoryDigest: inventory.batches[0].inventoryDigest,
        inputDigest: inventory.batches[0].inputDigest,
        state: "partial",
        execution: { mode: "sequential", workerIds: [] },
        receipts: [{
          workerId: "host",
          processedSourceIds: [inventory.batches[0].sourceIds[0]],
          gaps: ["The worker context ended before the remaining files were checked."],
        }],
      }),
    },
  );
  assert.equal(inventory.state, "in-progress");
  assert.equal(inventory.batches[0].state, "partial");
  assert.equal(inventory.summary.processedFiles, 1);
  assert.equal(inventory.summary.remainingFiles, 129);
  assert.deepEqual(inventory.summary.remainingGaps, [
    "The worker context ended before the remaining files were checked.",
  ]);
});

test("whole-project plans bind a complete inventory and block incomplete discovery", () => {
  let completeInventory = makeInventory(1);
  completeInventory = startSweepInventoryBatch(
    completeInventory,
    "batch-1",
    { mode: "sequential", workerIds: [] },
  );
  completeInventory = completeSweepInventoryBatch(
    completeInventory,
    "batch-1",
    {
      ...createSweepInventoryBatchResult({
        batchId: "batch-1",
        inventoryDigest: completeInventory.batches[0].inventoryDigest,
        inputDigest: completeInventory.batches[0].inputDigest,
        state: "complete",
        execution: { mode: "sequential", workerIds: [] },
        receipts: [{
          workerId: "host",
          processedSourceIds: completeInventory.batches[0].sourceIds,
          gaps: [],
        }],
      }),
    },
  );
  const completePlan = makeSweepPlan();
  completePlan.session.discoveryMode = "whole-project";
  completePlan.session.inventoryDigest = sweepInventoryDigest(completeInventory);
  completePlan.inventory = completeInventory;
  const validated = validateSweepPlan(completePlan);
  assert.equal(validated.session.discoveryMode, "whole-project");
  assert.equal(validated.result.state, "awaiting-approval");
  assert.equal(validated.resources.inventoryFiles, 1);

  let incompleteInventory = startSweepInventoryBatch(
    makeInventory(1),
    "batch-1",
    { mode: "sequential", workerIds: [] },
  );
  const blockedPlan = makeSweepPlan();
  blockedPlan.session.discoveryMode = "whole-project";
  blockedPlan.session.state = "blocked";
  blockedPlan.session.inventoryDigest = sweepInventoryDigest(incompleteInventory);
  blockedPlan.inventory = incompleteInventory;
  blockedPlan.summary.remainingGaps = ["The project inventory still has an open batch."];
  assert.equal(validateSweepPlan(blockedPlan).result.state, "blocked");

  const forgedDigest = makeSweepPlan();
  forgedDigest.session.discoveryMode = "whole-project";
  forgedDigest.session.inventoryDigest = digest("f");
  forgedDigest.inventory = completeInventory;
  assert.throws(
    () => validateSweepPlan(forgedDigest),
    /inventoryDigest must match/u,
  );
});
