import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createToxicReviewBrief,
  TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE,
} from "../features/toxic-review/index.mjs";
import {
  validateToxicReview,
} from "../features/toxic-review/validate.mjs";
import { main, parseArguments } from "../harness/hope.mjs";
import {
  makeToxicReview,
} from "../test-support/toxic-review-fixture.mjs";
import {
  makeToxicReviewAdjudication,
  makeToxicReviewRoleResult,
  makeToxicReviewRunPlan,
} from "../test-support/toxic-review-run-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runJson(script, arguments_) {
  const run = spawnSync(process.execPath, [resolve(root, script), ...arguments_], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

function withoutSchemaPath(value) {
  const { schemaPath, roleRun, ...rest } = value;
  assert.ok(schemaPath);
  const {
    adjudicationSchemaPath,
    planSchemaPath,
    roleResultSchemaPath,
    ...portableRoleRun
  } = roleRun;
  assert.ok(adjudicationSchemaPath);
  assert.ok(planSchemaPath);
  assert.ok(roleResultSchemaPath);
  return { ...rest, roleRun: portableRoleRun };
}

test("the harness parses and delegates Toxic Review", async () => {
  assert.deepEqual(parseArguments(["toxic-review"]), {
    arguments: [],
    command: "toxic-review",
  });
  const writingPass = {
    input: { mode: "edit" },
    response: { mode: "draft" },
  };
  let received;
  await main(["toxic-review"], {
    createTaskWritingPass: async () => writingPass,
    runToxicReviewCommand: async (arguments_, context) => {
      received = [arguments_, context.writingPass];
    },
  });
  assert.deepEqual(received, [["automatic"], writingPass]);
});

test("core and generated Toxic Review reach the same brief and validator", async () => {
  const plugin = await import(
    "../plugins/hope/runtime/features/toxic-review/index.mjs"
  );
  const pluginValidator = await import(
    "../plugins/hope/runtime/features/toxic-review/validate.mjs"
  );
  const dependencies = {
    loadWritingStandard: async () => "shared standard\n",
  };
  const options = { risk: "medium", stage: "design", target: "requirements" };
  const [coreBrief, pluginBrief] = await Promise.all([
    createToxicReviewBrief(options, dependencies),
    plugin.createToxicReviewBrief(options, dependencies),
  ]);
  const { schemaPath: coreSchemaPath } = coreBrief;
  const { schemaPath: pluginSchemaPath } = pluginBrief;
  const schemaSuffix = join(
    "features",
    "toxic-review",
    "review-v1.schema.json",
  );
  assert.ok(coreSchemaPath.endsWith(schemaSuffix));
  assert.ok(pluginSchemaPath.endsWith(schemaSuffix));
  assert.deepEqual(
    withoutSchemaPath(pluginBrief),
    withoutSchemaPath(coreBrief),
  );
  assert.deepEqual(
    pluginValidator.validateToxicReview(makeToxicReview()),
    validateToxicReview(makeToxicReview()),
  );
});

test("harness and generated Toxic Review report the same missing AI boundary", () => {
  const harness = spawnSync(
    process.execPath,
    [resolve(root, "harness/hope.mjs"), "toxic-review"],
    { encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [
      resolve(root, "plugins/hope/runtime/features/toxic-review/cli.mjs"),
      "automatic",
    ],
    { encoding: "utf8" },
  );
  assert.equal(harness.status, 2, harness.stderr);
  assert.equal(plugin.status, 2, plugin.stderr);
  assert.match(
    harness.stderr,
    new RegExp(TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE, "u"),
  );
  assert.match(
    plugin.stderr,
    new RegExp(TOXIC_REVIEW_MODEL_ADAPTER_MESSAGE, "u"),
  );
});

test("exact harness and generated Toxic Review commands stay equivalent", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-toxic-two-track-");
  const input = join(temporaryRoot, "toxic-review.json");
  await writeFile(input, JSON.stringify(makeToxicReview()), { mode: 0o600 });
  const brief = [
    "brief",
    "--target",
    "implementation",
    "--stage",
    "completed",
    "--risk",
    "high",
  ];
  const harnessBrief = runJson(
    "harness/hope.mjs",
    ["toxic-review", ...brief],
  );
  const pluginBrief = runJson(
    "plugins/hope/runtime/features/toxic-review/cli.mjs",
    brief,
  );
  assert.deepEqual(
    withoutSchemaPath(pluginBrief),
    withoutSchemaPath(harnessBrief),
  );

  const harnessEvaluationPlan = runJson(
    "harness/hope.mjs",
    ["toxic-review", "evaluation-plan"],
  );
  const pluginEvaluationPlan = runJson(
    "plugins/hope/runtime/features/toxic-review/cli.mjs",
    ["evaluation-plan"],
  );
  assert.deepEqual(pluginEvaluationPlan, harnessEvaluationPlan);

  const evaluationRun = harnessEvaluationPlan.runs.find(
    (run) => run.caseId === "critical-path-ablation"
      && run.variant === "rules-only"
      && run.run === 1,
  );
  const evaluationArguments = [
    "evaluation-prepare",
    "--case",
    evaluationRun.caseId,
    "--variant",
    evaluationRun.variant,
    "--run",
    String(evaluationRun.run),
  ];
  const harnessEvaluation = runJson(
    "harness/hope.mjs",
    ["toxic-review", ...evaluationArguments],
  );
  const pluginEvaluation = runJson(
    "plugins/hope/runtime/features/toxic-review/cli.mjs",
    evaluationArguments,
  );
  assert.deepEqual(
    withoutSchemaPath(pluginEvaluation.brief),
    withoutSchemaPath(harnessEvaluation.brief),
  );
  assert.deepEqual(
    { ...pluginEvaluation, brief: undefined },
    { ...harnessEvaluation, brief: undefined },
  );

  const oracleArguments = [
    "evaluation-oracle",
    "--case",
    evaluationRun.caseId,
  ];
  assert.deepEqual(
    runJson(
      "plugins/hope/runtime/features/toxic-review/cli.mjs",
      oracleArguments,
    ),
    runJson(
      "harness/hope.mjs",
      ["toxic-review", ...oracleArguments],
    ),
  );

  const harnessResult = runJson(
    "harness/hope.mjs",
    ["toxic-review", "validate", "--input", input],
  );
  const pluginResult = runJson(
    "plugins/hope/runtime/features/toxic-review/cli.mjs",
    ["validate", "--input", input],
  );
  assert.deepEqual(pluginResult, harnessResult);
});

test("harness and generated plugin complete the same role-run transitions", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-toxic-role-run-");
  const planPath = join(temporaryRoot, "plan.json");
  const statePath = join(temporaryRoot, "state.json");
  const resultPath = join(temporaryRoot, "role-result.json");
  const decisionPath = join(temporaryRoot, "decision.json");
  await writeFile(planPath, JSON.stringify(makeToxicReviewRunPlan()), {
    mode: 0o600,
  });
  const harnessPrepared = runJson(
    "harness/hope.mjs",
    ["toxic-review", "run-prepare", "--input", planPath],
  );
  const pluginPrepared = runJson(
    "plugins/hope/runtime/features/toxic-review/cli.mjs",
    ["run-prepare", "--input", planPath],
  );
  assert.deepEqual(pluginPrepared, harnessPrepared);
  await writeFile(statePath, JSON.stringify(harnessPrepared), { mode: 0o600 });

  const roleArguments = [
    "role-input",
    "--state",
    statePath,
    "--role",
    "role-1",
  ];
  const harnessRoleInput = runJson(
    "harness/hope.mjs",
    ["toxic-review", ...roleArguments],
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/toxic-review/cli.mjs", roleArguments),
    harnessRoleInput,
  );
  await writeFile(
    resultPath,
    JSON.stringify(makeToxicReviewRoleResult(harnessRoleInput)),
    { mode: 0o600 },
  );
  const completeArguments = [
    "role-complete",
    "--state",
    statePath,
    "--input",
    resultPath,
    "--invocation",
    "host-role-1",
  ];
  const harnessCompleted = runJson(
    "harness/hope.mjs",
    ["toxic-review", ...completeArguments],
  );
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/toxic-review/cli.mjs", completeArguments),
    harnessCompleted,
  );
  await writeFile(statePath, JSON.stringify(harnessCompleted), { mode: 0o600 });
  await writeFile(
    decisionPath,
    JSON.stringify(makeToxicReviewAdjudication(harnessCompleted)),
    { mode: 0o600 },
  );
  const finalizeArguments = [
    "run-finalize",
    "--state",
    statePath,
    "--input",
    decisionPath,
  ];
  assert.deepEqual(
    runJson("plugins/hope/runtime/features/toxic-review/cli.mjs", finalizeArguments),
    runJson("harness/hope.mjs", ["toxic-review", ...finalizeArguments]),
  );
});
