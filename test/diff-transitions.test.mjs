import assert from "node:assert/strict";
import test from "node:test";

import {
  readDiffWindow,
} from "../plugins/hope/skills/diff/scripts/index.mjs";
import {
  nextAfterCheckpoint,
  nextAfterInspection,
  nextAfterLedger,
  nextAfterPrepare,
  nextAfterValidation,
} from "../plugins/hope/skills/diff/scripts/transitions.mjs";

const runPath = "/private/run";

test("Diff runtime directs the mandatory inspection and checkpoint sequence", () => {
  assert.deepEqual(nextAfterPrepare(runPath), {
    kind: "required",
    transition: {
      command: "inspect-window",
      page: 1,
      runPath,
    },
  });

  const window = {
    checkpointPath: "/private/run/checkpoint.1.4.json",
    startPage: 4,
  };
  const expectedCheckpoint = {
    kind: "required",
    transition: {
      checkpointPath: window.checkpointPath,
      kind: "write-checkpoint",
      then: {
        command: "checkpoint-window",
        page: 4,
        runPath,
      },
    },
  };
  assert.deepEqual(nextAfterInspection(runPath, window), expectedCheckpoint);
  assert.deepEqual(
    nextAfterCheckpoint(runPath, window, []),
    expectedCheckpoint,
  );
});

test("Diff inspection responses expose their runtime-owned checkpoint transition", async () => {
  const window = {
    checkpointPath: "/private/run/checkpoint.2.6.json",
    endPage: 7,
    pages: [],
    startPage: 6,
  };
  const response = await readDiffWindow(runPath, 6, {
    inspectRunWindow: async () => window,
  });

  assert.deepEqual(response.next, nextAfterInspection(runPath, window));
  assert.equal(response.startPage, 6);
});

test("Diff runtime exposes grounded context as a choice rather than a required detour", () => {
  const next = nextAfterCheckpoint(runPath, undefined, [
    { id: "request-2" },
    { id: "request-4" },
  ]);

  assert.equal(next.kind, "choose");
  assert.deepEqual(next.transitions.map((transition) => transition.command), [
    "context",
    "ledger",
  ]);
  assert.deepEqual(next.transitions[0].eligibleRequestIds, [
    "request-2",
    "request-4",
  ]);
  assert.equal(Object.isFrozen(next.transitions[0].eligibleRequestIds), true);

  assert.deepEqual(nextAfterCheckpoint(runPath, undefined, []), {
    kind: "required",
    transition: {
      command: "ledger",
      page: 1,
      runPath,
    },
  });
});

test("Diff runtime carries the ledger through analysis, validation, and finish", () => {
  assert.deepEqual(nextAfterLedger(runPath, {
    page: 1,
    totalPages: 3,
  }, "/private/run/analysis.json"), {
    kind: "required",
    transition: {
      command: "ledger",
      page: 2,
      runPath,
    },
  });

  assert.deepEqual(nextAfterLedger(runPath, {
    page: 3,
    totalPages: 3,
  }, "/private/run/analysis.json"), {
    kind: "required",
    transition: {
      analysisPath: "/private/run/analysis.json",
      kind: "write-analysis",
      then: {
        command: "validate",
        runPath,
      },
    },
  });

  assert.deepEqual(nextAfterValidation(runPath), {
    kind: "required",
    transition: {
      command: "finish",
      runPath,
    },
  });
});
