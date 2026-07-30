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
  const { schemaPath, ...rest } = value;
  assert.ok(schemaPath);
  return rest;
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
  const { schemaPath: coreSchemaPath, ...coreContract } = coreBrief;
  const { schemaPath: pluginSchemaPath, ...pluginContract } = pluginBrief;
  const schemaSuffix = join(
    "features",
    "toxic-review",
    "review-v1.schema.json",
  );
  assert.ok(coreSchemaPath.endsWith(schemaSuffix));
  assert.ok(pluginSchemaPath.endsWith(schemaSuffix));
  assert.deepEqual(pluginContract, coreContract);
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
