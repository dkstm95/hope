import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createPolishBrief,
  POLISH_MODEL_ADAPTER_MESSAGE,
} from "../features/polish/index.mjs";
import { validatePolishRun } from "../features/polish/validate.mjs";
import { main, parseArguments } from "../harness/hope.mjs";
import { makePolishRun } from "../test-support/polish-fixture.mjs";
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

test("the harness parses and delegates Polish", async () => {
  assert.deepEqual(parseArguments(["polish"]), {
    arguments: [],
    command: "polish",
  });
  const writingPass = {
    input: { mode: "edit" },
    response: { mode: "draft" },
  };
  let received;
  await main(["polish"], {
    createTaskWritingPass: async () => writingPass,
    runPolishCommand: async (arguments_, context) => {
      received = [arguments_, context.writingPass];
    },
  });
  assert.deepEqual(received, [["automatic"], writingPass]);
});

test("core and generated Polish reach the same brief and validator", async () => {
  const plugin = await import(
    "../plugins/hope/runtime/features/polish/index.mjs"
  );
  const pluginValidator = await import(
    "../plugins/hope/runtime/features/polish/validate.mjs"
  );
  const dependencies = {
    loadWritingStandard: async () => "shared standard\n",
  };
  const [coreBrief, pluginBrief] = await Promise.all([
    createPolishBrief({ risk: "medium" }, dependencies),
    plugin.createPolishBrief({ risk: "medium" }, dependencies),
  ]);
  const { schemaPath: coreSchemaPath, ...coreContract } = coreBrief;
  const { schemaPath: pluginSchemaPath, ...pluginContract } = pluginBrief;
  const schemaSuffix = join("features", "polish", "run-v1.schema.json");
  assert.ok(coreSchemaPath.endsWith(schemaSuffix));
  assert.ok(pluginSchemaPath.endsWith(schemaSuffix));
  assert.deepEqual(pluginContract, coreContract);
  assert.deepEqual(
    pluginValidator.validatePolishRun(makePolishRun()),
    validatePolishRun(makePolishRun()),
  );
});

test("harness and generated Polish report the same missing AI boundary", () => {
  const harness = spawnSync(
    process.execPath,
    [resolve(root, "harness/hope.mjs"), "polish"],
    { encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [resolve(root, "plugins/hope/runtime/features/polish/cli.mjs"), "automatic"],
    { encoding: "utf8" },
  );
  assert.equal(harness.status, 2, harness.stderr);
  assert.equal(plugin.status, 2, plugin.stderr);
  assert.match(harness.stderr, new RegExp(POLISH_MODEL_ADAPTER_MESSAGE, "u"));
  assert.match(plugin.stderr, new RegExp(POLISH_MODEL_ADAPTER_MESSAGE, "u"));
});

test("exact harness and generated Polish commands stay equivalent", async () => {
  const temporaryRoot = await createTestTemporaryDirectory("hope-polish-two-track-");
  const input = join(temporaryRoot, "polish.json");
  await writeFile(input, JSON.stringify(makePolishRun()), { mode: 0o600 });
  const brief = ["brief", "--risk", "high"];
  const harnessBrief = runJson("harness/hope.mjs", ["polish", ...brief]);
  const pluginBrief = runJson(
    "plugins/hope/runtime/features/polish/cli.mjs",
    brief,
  );
  assert.deepEqual(
    withoutSchemaPath(pluginBrief),
    withoutSchemaPath(harnessBrief),
  );

  const harnessResult = runJson(
    "harness/hope.mjs",
    ["polish", "validate", "--input", input],
  );
  const pluginResult = runJson(
    "plugins/hope/runtime/features/polish/cli.mjs",
    ["validate", "--input", input],
  );
  assert.deepEqual(pluginResult, harnessResult);
});
