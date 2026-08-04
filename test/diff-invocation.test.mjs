import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createDiffInvocationContract,
  createDiffInvocationEvaluationBaselineContract,
  createDiffPendingConfirmation,
  DIFF_INVOCATION_DECISIONS,
  DIFF_INVOCATION_EVALUATION_CASES,
  transitionDiffPendingConfirmation,
} from "../features/diff/invocation.mjs";
import * as pluginInvocation from "../plugins/hope/runtime/features/diff/invocation.mjs";
import {
  main as runDiffCommand,
  parseDiffArguments,
} from "../features/diff/cli.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const confirmationSourceRequest = "이 PR 리뷰해줘";

function runJson(path, prefixArguments = [], arguments_ = ["invocation-brief"]) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, path), ...prefixArguments, ...arguments_],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("Diff publishes one bounded invocation contract", () => {
  const contract = createDiffInvocationContract();
  assert.equal(contract.feature, "diff");
  assert.equal(contract.version, 4);
  assert.equal(contract.confirmation.maximumQuestions, 1);
  assert.match(contract.confirmation.retarget, /newly authorized target/u);
  assert.match(contract.modelPolicy.plugin, /active Claude or Codex host model/u);
  assert.match(contract.modelPolicy.harness, /replaceable model adapter/u);
  assert.match(contract.modelPolicy.modelSelection, /frontier model is not required/iu);
  assert.match(contract.targetResolution.beforeConfirmation, /resolve-target/u);
  assert.match(contract.targetResolution.prepare, /canonical URL/u);
  assert.match(contract.pendingState.commands.create, /confirmation-create/u);
  assert.match(
    contract.pendingState.commands.transition,
    /confirmation-transition/u,
  );
  assert.match(contract.pendingState.sourceRequest, /re-hashes/u);
  assert.deepEqual(contract.pendingState.fields, [
    "version",
    "feature",
    "sourceRequestDigest",
    "target",
    "targetDigest",
    "questionsAsked",
  ]);
  assert.deepEqual(Object.keys(contract.decisions).sort(), [
    ...DIFF_INVOCATION_DECISIONS,
  ].sort());
  assert.equal(contract.evaluationCases, undefined);
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.confirmation), true);
  const baseline = createDiffInvocationEvaluationBaselineContract();
  assert.equal(baseline.version, 3);
  assert.equal(baseline.evaluationCases, DIFF_INVOCATION_EVALUATION_CASES);
  assert.equal(Object.isFrozen(baseline.evaluationCases), true);
});

test("Diff invocation cases preserve execution and non-execution boundaries", () => {
  const decisions = Object.fromEntries(
    DIFF_INVOCATION_EVALUATION_CASES.map((entry) => [
      entry.id,
      entry.expectedDecision,
    ]),
  );
  assert.deepEqual(decisions, {
    "capability-question": "answer",
    "clear-natural-request": "execute",
    "compound-delegation": "execute",
    "confirmation-affirmative": "execute",
    "confirmation-explicit-retarget": "execute",
    "confirmation-negative": "cancel",
    "confirmation-superseded": "cancel",
    "confirmation-target-only-retarget": "cancel",
    "confirmation-unclear": "cancel",
    "direct-invocation": "execute",
    "direct-invocation-question": "answer",
    "direct-invocation-with-narrow-request": "answer",
    "direct-invocation-with-url": "execute",
    "explicit-non-execution": "answer",
    "feature-question": "answer",
    "generic-review": "confirm",
    "generic-url-review": "confirm",
    "narrow-request": "answer",
    "polite-delegation": "execute",
    "quoted-request": "answer",
    "target-only": "answer",
    "whole-pr-request": "execute",
  });
  for (const entry of DIFF_INVOCATION_EVALUATION_CASES) {
    assert.ok(DIFF_INVOCATION_DECISIONS.includes(entry.expectedDecision));
    assert.ok(entry.request.length > 0);
    assert.ok(entry.reason.length > 0);
  }
  const confirmationCases = DIFF_INVOCATION_EVALUATION_CASES.filter(
    (entry) => entry.pending,
  );
  for (const entry of confirmationCases) {
    assert.equal(entry.pending.feature, "diff");
    assert.match(entry.pending.sourceRequestDigest, /^sha256:[a-f0-9]{64}$/u);
    assert.match(entry.pending.targetDigest, /^sha256:[a-f0-9]{64}$/u);
    assert.equal(entry.pending.questionsAsked, 1);
    assert.equal(entry.pending.target.url, "https://github.com/example/repo/pull/123");
  }
  const retarget = DIFF_INVOCATION_EVALUATION_CASES.find(
    (entry) => entry.id === "confirmation-explicit-retarget",
  );
  assert.equal(retarget.expectedTarget.url, "https://github.com/example/repo/pull/456");
});

test("Diff confirmation state binds the request and exact target", () => {
  const pending = createDiffPendingConfirmation({
    sourceRequest: confirmationSourceRequest,
    target: { url: "https://github.com/example/repo/pull/123" },
  });
  assert.deepEqual(pending.target, {
    number: 123,
    owner: "example",
    repository: "repo",
    url: "https://github.com/example/repo/pull/123",
  });
  assert.match(pending.sourceRequestDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.match(pending.targetDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(pending.questionsAsked, 1);
  assert.equal(Object.isFrozen(pending), true);
});

test("Diff confirmation transitions clear pending state deterministically", () => {
  const pending = createDiffPendingConfirmation({
    sourceRequest: confirmationSourceRequest,
    target: { url: "https://github.com/example/repo/pull/123" },
  });
  assert.deepEqual(
    transitionDiffPendingConfirmation(pending, {
      decision: "execute",
      sourceRequest: confirmationSourceRequest,
    }),
    {
      decision: "execute",
      pending: null,
      target: pending.target,
      transition: "affirmative-execute",
    },
  );
  assert.deepEqual(
    transitionDiffPendingConfirmation(pending, {
      decision: "execute",
      sourceRequest: confirmationSourceRequest,
      target: { number: 456 },
    }),
    {
      decision: "execute",
      pending: null,
      target: {
        number: 456,
        owner: "example",
        repository: "repo",
        url: "https://github.com/example/repo/pull/456",
      },
      transition: "retarget-execute",
    },
  );
  assert.throws(
    () => transitionDiffPendingConfirmation(pending, {
      decision: "execute",
      sourceRequest: confirmationSourceRequest,
      target: { number: 0 },
    }),
    /canonical URL or positive pull request number/u,
  );
  assert.throws(
    () => transitionDiffPendingConfirmation(pending, {
      decision: "execute",
      sourceRequest: "다른 요청",
    }),
    /source request changed/u,
  );
  for (const decision of ["answer", "cancel", "confirm"]) {
    const result = transitionDiffPendingConfirmation(pending, {
      decision,
      sourceRequest: confirmationSourceRequest,
    });
    assert.equal(result.pending, null);
    assert.equal(result.target, null);
    assert.equal(result.decision, decision === "confirm" ? "cancel" : decision);
  }
});

test("generated plugin uses the same confirmation state boundary", () => {
  const input = {
    sourceRequest: confirmationSourceRequest,
    target: { url: "https://github.com/example/repo/pull/123" },
  };
  const corePending = createDiffPendingConfirmation(input);
  const pluginPending = pluginInvocation.createDiffPendingConfirmation(input);
  assert.deepEqual(pluginPending, corePending);
  assert.deepEqual(
    pluginInvocation.transitionDiffPendingConfirmation(pluginPending, {
      decision: "execute",
      sourceRequest: confirmationSourceRequest,
      target: { number: 456 },
    }),
    transitionDiffPendingConfirmation(corePending, {
      decision: "execute",
      sourceRequest: confirmationSourceRequest,
      target: { number: 456 },
    }),
  );
});

test("Diff parses only an exact invocation brief command", () => {
  assert.deepEqual(parseDiffArguments(["invocation-brief"]), {
    command: "invocation-brief",
  });
  assert.throws(
    () => parseDiffArguments(["invocation-brief", "extra"]),
    /Internal skill protocol/u,
  );
});

test("Diff parses confirmation commands only with one private input", () => {
  for (const command of ["confirmation-create", "confirmation-transition"]) {
    assert.deepEqual(parseDiffArguments([
      command,
      "--input",
      "/private/input.json",
    ]), {
      command,
      inputPath: "/private/input.json",
    });
    assert.throws(
      () => parseDiffArguments([command]),
      /Internal skill protocol/u,
    );
    assert.throws(
      () => parseDiffArguments([
        command,
        "--input",
        "/private/input.json",
        "--locale",
        "ko-KR",
      ]),
      /Internal skill protocol/u,
    );
  }
});

test("core, harness, and generated plugin apply the same confirmation commands", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "hope-diff-invocation-"));
  try {
    const createInput = join(temporary, "create.json");
    await writeFile(createInput, JSON.stringify({
      sourceRequest: confirmationSourceRequest,
      target: { url: "https://github.com/example/repo/pull/123" },
    }), { mode: 0o600 });
    const commands = [
      ["features/diff/cli.mjs", []],
      ["harness/hope.mjs", ["diff"]],
      ["plugins/hope/runtime/features/diff/cli.mjs", []],
    ];
    const pendingStates = commands.map(([path, prefix]) => runJson(
      path,
      prefix,
      ["confirmation-create", "--input", createInput],
    ));
    assert.deepEqual(pendingStates[1], pendingStates[0]);
    assert.deepEqual(pendingStates[2], pendingStates[0]);

    const transitionInput = join(temporary, "transition.json");
    await writeFile(transitionInput, JSON.stringify({
      decision: "execute",
      pending: pendingStates[0],
      sourceRequest: confirmationSourceRequest,
      target: { number: 456 },
    }), { mode: 0o600 });
    const transitions = commands.map(([path, prefix]) => runJson(
      path,
      prefix,
      ["confirmation-transition", "--input", transitionInput],
    ));
    assert.deepEqual(transitions[1], transitions[0]);
    assert.deepEqual(transitions[2], transitions[0]);
    assert.equal(
      transitions[0].target.url,
      "https://github.com/example/repo/pull/456",
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("Diff parses read-only target resolution without review options", () => {
  assert.deepEqual(parseDiffArguments(["resolve-target"]), {
    command: "resolve-target",
    url: undefined,
  });
  assert.deepEqual(parseDiffArguments(["resolve-target", "#123"]), {
    command: "resolve-target",
    pullRequestNumber: 123,
    url: undefined,
  });
  assert.deepEqual(parseDiffArguments([
    "resolve-target",
    "https://github.com/example/repo/pull/123",
  ]), {
    command: "resolve-target",
    url: "https://github.com/example/repo/pull/123",
  });
  assert.throws(
    () => parseDiffArguments(["resolve-target", "123", "--locale", "ko-KR"]),
    /Internal skill protocol/u,
  );
});

test("Diff resolves a confirmation target without preparing a review", async () => {
  const target = {
    number: 123,
    owner: "example",
    repository: "repo",
    selection: "explicit-number",
    url: "https://github.com/example/repo/pull/123",
  };
  let received;
  let output = "";
  await runDiffCommand(["resolve-target", "123"], {
    prepareDiff: () => assert.fail("resolve-target must not prepare a review"),
    resolveDiffTarget: async (options) => {
      received = options;
      return target;
    },
    stdout: { write: (value) => { output += value; } },
  });
  assert.deepEqual(received, {
    command: "resolve-target",
    pullRequestNumber: 123,
    url: undefined,
  });
  assert.deepEqual(JSON.parse(output), target);
});

test("core, harness, and generated plugin expose the same invocation contract", () => {
  const core = runJson("features/diff/cli.mjs");
  const harness = runJson("harness/hope.mjs", ["diff"]);
  const plugin = runJson("plugins/hope/runtime/features/diff/cli.mjs");
  assert.deepEqual(harness, core);
  assert.deepEqual(plugin, core);
});
