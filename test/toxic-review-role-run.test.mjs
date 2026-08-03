import assert from "node:assert/strict";
import test from "node:test";

import {
  completeToxicReviewRole,
  createToxicReviewBrief,
  failToxicReviewRole,
  finalizeToxicReviewRun,
  getToxicReviewRoleInput,
  loadToxicReviewModelAdapter,
  prepareToxicReviewRun,
  retryToxicReviewRole,
  runToxicReview,
  validateToxicReviewRunPlan,
  validateToxicReviewRunState,
} from "../features/toxic-review/index.mjs";
import {
  makeMultiRoleToxicReviewRunPlan,
  makeToxicReviewAdjudication,
  makeToxicReviewRoleResult,
  makeToxicReviewRunPlan,
} from "../test-support/toxic-review-run-fixture.mjs";
import {
  makeCausalToxicReview,
} from "../test-support/toxic-review-fixture.mjs";

const writingDependencies = {
  loadWritingStandard: async () => "shared standard\n",
};

async function prepare(plan = makeToxicReviewRunPlan()) {
  const brief = await createToxicReviewBrief({
    risk: plan.risk,
    stage: plan.target.stage,
    target: plan.target.kind,
  }, writingDependencies);
  return prepareToxicReviewRun(plan, { brief });
}

test("one role keeps an exact binding through completion and adjudication", async () => {
  let run = await prepare();
  assert.equal(run.status, "prepared");
  assert.equal(run.roleStates.length, 1);
  const input = getToxicReviewRoleInput(run, "role-1");
  assert.deepEqual(
    input.snapshot.sources.map((source) => source.id),
    ["repository-1"],
  );
  assert.equal(input.roleId, "role-1");
  assert.match(input.bindingDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.match(input.inputDigest, /^sha256:[a-f0-9]{64}$/u);

  run = completeToxicReviewRole(
    run,
    makeToxicReviewRoleResult(input),
    { hostInvocationId: "host-role-1" },
  );
  assert.equal(run.status, "ready-for-adjudication");
  const result = finalizeToxicReviewRun(
    run,
    makeToxicReviewAdjudication(run),
  );
  assert.equal(result.status, "completed");
  assert.equal(result.review.result.actionable.length, 1);
  assert.equal(result.execution.roles[0].hostInvocationId, "host-role-1");
  assert.equal(
    result.execution.roles[0].bindingDigest,
    input.bindingDigest,
  );
  assert.match(
    result.execution.adjudication.decisionDigest,
    /^sha256:[a-f0-9]{64}$/u,
  );
});

test("a stale or mismatched role result cannot complete a run", async () => {
  const run = await prepare();
  const input = getToxicReviewRoleInput(run, "role-1");
  const result = makeToxicReviewRoleResult(input);
  result.inputDigest = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => completeToxicReviewRole(run, result, {
      hostInvocationId: "host-role-1",
    }),
    /inputDigest does not match/u,
  );
});

test("failure blocks a no-issue result and retry preserves the binding", async () => {
  let run = await prepare();
  const first = getToxicReviewRoleInput(run, "role-1");
  run = failToxicReviewRole(run, {
    roleId: "role-1",
    status: "failed",
    code: "MODEL_TIMEOUT",
    message: "The reviewer timed out.",
    retryable: true,
    hostInvocationId: "host-role-1-attempt-1",
  });
  assert.equal(run.status, "incomplete");
  assert.throws(
    () => finalizeToxicReviewRun(run, {
      version: 1,
      runId: run.runId,
      adjudications: [],
      summary: {
        assessment: "No issue.",
        noMaterialIssueFound: true,
        scopeLimits: ["The reviewer failed."],
      },
    }),
    /every selected role must succeed/u,
  );

  run = retryToxicReviewRole(run, "role-1");
  const second = getToxicReviewRoleInput(run, "role-1");
  assert.equal(second.bindingDigest, first.bindingDigest);
  assert.notEqual(second.attemptId, first.attemptId);
  assert.equal(second.attempt, 2);
  run = completeToxicReviewRole(
    run,
    makeToxicReviewRoleResult(second, { findings: [] }),
    { hostInvocationId: "host-role-1-attempt-2" },
  );
  const result = finalizeToxicReviewRun(
    run,
    makeToxicReviewAdjudication(run, { empty: true }),
  );
  assert.equal(result.review.result.noMaterialIssueFound, true);
  assert.equal(run.roleStates[0].attempts.length, 2);
  const executionRole = result.execution.roles[0];
  assert.equal(executionRole.attempt, 2);
  assert.deepEqual(
    executionRole.attempts.map((attempt) => attempt.status),
    ["failed", "succeeded"],
  );
  assert.deepEqual(executionRole.attempts[0].error, {
    code: "MODEL_TIMEOUT",
    message: "The reviewer timed out.",
    retryable: true,
  });
  assert.equal(
    executionRole.attempts[0].hostInvocationId,
    "host-role-1-attempt-1",
  );
  assert.equal(
    executionRole.attempts[1].hostInvocationId,
    "host-role-1-attempt-2",
  );
  assert.match(
    executionRole.attempts[1].outputDigest,
    /^sha256:[a-f0-9]{64}$/u,
  );
});

test("multiple roles require fresh contexts and complete independently", async () => {
  const invalid = makeMultiRoleToxicReviewRunPlan({
    execution: { mode: "isolated-sequential", independentContexts: false },
  });
  assert.throws(
    () => validateToxicReviewRunPlan(invalid),
    /requires fresh independent contexts/u,
  );

  let run = await prepare(makeMultiRoleToxicReviewRunPlan());
  const first = getToxicReviewRoleInput(run, "role-1");
  const second = getToxicReviewRoleInput(run, "role-2");
  assert.deepEqual(
    first.snapshot.sources.map((source) => source.id),
    ["repository-1"],
  );
  assert.deepEqual(
    second.snapshot.sources.map((source) => source.id),
    ["conversation-1"],
  );
  run = completeToxicReviewRole(
    run,
    makeToxicReviewRoleResult(second),
    { hostInvocationId: "host-role-2" },
  );
  assert.equal(run.status, "prepared");
  run = completeToxicReviewRole(
    run,
    makeToxicReviewRoleResult(first),
    { hostInvocationId: "host-role-1" },
  );
  const completed = finalizeToxicReviewRun(
    run,
    makeToxicReviewAdjudication(run),
  );
  assert.deepEqual(
    completed.execution.roles.map((role) => role.status),
    ["succeeded", "succeeded"],
  );
  assert.equal(completed.review.findings.length, 2);
});

test("a causal reviewer keeps its causal analysis with its role result", async () => {
  const plan = makeToxicReviewRunPlan();
  plan.selection.roles[0].method = "causal-completeness";
  let run = await prepare(plan);
  const input = getToxicReviewRoleInput(run, "role-1");
  run = completeToxicReviewRole(
    run,
    makeToxicReviewRoleResult(input, {
      causalAnalysis: makeCausalToxicReview().causalAnalysis,
    }),
    { hostInvocationId: "host-causal-role" },
  );
  const completed = finalizeToxicReviewRun(
    run,
    makeToxicReviewAdjudication(run),
  );
  assert.equal(completed.review.causalAnalysis.roleId, "role-1");
  assert.equal(completed.review.causalAnalysis.candidateCount, 2);
});

test("automatic harness review uses the same role-run boundary", async () => {
  const plan = makeToxicReviewRunPlan();
  const adapter = {
    capabilities: { independentContexts: true, parallel: true },
    async plan() {
      return plan;
    },
    async review({ roleInput }) {
      return {
        invocationId: `adapter-${roleInput.roleId}`,
        result: makeToxicReviewRoleResult(roleInput),
      };
    },
    async adjudicate({ run }) {
      return makeToxicReviewAdjudication(run);
    },
  };
  const result = await runToxicReview(["review", "the", "plan"], {
    ...writingDependencies,
    modelAdapter: adapter,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.review.result.actionable.length, 1);
});

test("automatic harness review preserves partial failure instead of finalizing", async () => {
  const adapter = {
    capabilities: { independentContexts: true, parallel: true },
    async plan() {
      return makeToxicReviewRunPlan();
    },
    async review() {
      const error = new Error("The model call timed out.");
      error.code = "MODEL_TIMEOUT";
      error.retryable = true;
      throw error;
    },
    async adjudicate() {
      assert.fail("adjudication must not run after role failure");
    },
  };
  const result = await runToxicReview(["review"], {
    ...writingDependencies,
    modelAdapter: adapter,
  });
  assert.equal(result.status, "incomplete");
  assert.equal(result.run.status, "incomplete");
  assert.equal(result.run.roleStates[0].status, "failed");
});

test("automatic harness review starts independent roles in parallel", async () => {
  let active = 0;
  let maximumActive = 0;
  const sourcesByRole = new Map();
  const adapter = {
    capabilities: { independentContexts: true, parallel: true },
    async plan() {
      return makeMultiRoleToxicReviewRunPlan();
    },
    async review({ roleInput }) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      sourcesByRole.set(
        roleInput.roleId,
        roleInput.snapshot.sources.map((source) => source.id),
      );
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return {
        invocationId: `adapter-${roleInput.roleId}`,
        result: makeToxicReviewRoleResult(roleInput),
      };
    },
    async adjudicate({ run }) {
      return makeToxicReviewAdjudication(run);
    },
  };
  const result = await runToxicReview(["review"], {
    ...writingDependencies,
    modelAdapter: adapter,
  });
  assert.equal(result.status, "completed");
  assert.equal(maximumActive, 2);
  assert.deepEqual(sourcesByRole.get("role-1"), ["repository-1"]);
  assert.deepEqual(sourcesByRole.get("role-2"), ["conversation-1"]);
});

test("automatic harness review rejects unsupported multi-role execution", async () => {
  const adapter = {
    capabilities: { independentContexts: true, parallel: false },
    async plan() {
      return makeMultiRoleToxicReviewRunPlan();
    },
    async review() {
      assert.fail("review must not start without the required capability");
    },
    async adjudicate() {
      assert.fail("adjudication must not start without completed roles");
    },
  };
  await assert.rejects(
    () => runToxicReview(["review"], {
      ...writingDependencies,
      modelAdapter: adapter,
    }),
    /supports parallel calls/u,
  );
});

test("run-state validation detects a changed prepared input", async () => {
  const run = structuredClone(await prepare());
  run.roleStates[0].attempts[0].input.role.target = "Changed target";
  assert.throws(
    () => validateToxicReviewRunState(run),
    /inputDigest does not match/u,
  );
});

test("the harness loads only an explicitly configured adapter module", async () => {
  const adapter = {
    capabilities: { independentContexts: true, parallel: false },
    async plan() {},
    async review() {},
    async adjudicate() {},
  };
  let loadedSpecifier;
  const loaded = await loadToxicReviewModelAdapter({
    cwd: "/tmp/hope-adapter-test",
    environment: {
      HOPE_TOXIC_REVIEW_ADAPTER_MODULE: "adapter.mjs",
    },
    importModule: async (specifier) => {
      loadedSpecifier = specifier;
      return { default: adapter };
    },
  });
  assert.match(loadedSpecifier, /^file:\/\/\/tmp\/hope-adapter-test\/adapter\.mjs$/u);
  assert.equal(loaded.capabilities.independentContexts, true);
  assert.equal(loaded.capabilities.parallel, false);
  await assert.rejects(
    () => loadToxicReviewModelAdapter({ environment: {} }),
    (error) => error.code === "HOPE_TOXIC_REVIEW_MODEL_ADAPTER_REQUIRED",
  );
});
