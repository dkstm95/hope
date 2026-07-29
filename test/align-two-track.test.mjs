import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALIGN_MODEL_ADAPTER_MESSAGE,
  createAlignBrief,
} from "../features/align/index.mjs";
import { validateAlignState } from "../features/align/validate.mjs";
import { main, parseArguments } from "../harness/hope.mjs";
import { makeAlignState } from "../test-support/align-fixture.mjs";

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

test("the harness parses and delegates Align", async () => {
  assert.deepEqual(parseArguments(["align"]), {
    arguments: [],
    command: "align",
  });
  const writingPass = {
    input: { mode: "edit" },
    response: { mode: "draft" },
  };
  let received;
  await main(["align"], {
    createTaskWritingPass: async () => writingPass,
    runAlignCommand: async (arguments_, context) => {
      received = [arguments_, context.writingPass];
    },
  });
  assert.deepEqual(received, [["automatic"], writingPass]);
});

test("core and generated Align reach the same brief and validator", async () => {
  const plugin = await import(
    "../plugins/hope/runtime/features/align/index.mjs"
  );
  const pluginValidator = await import(
    "../plugins/hope/runtime/features/align/validate.mjs"
  );
  const dependencies = {
    loadWritingStandard: async () => "shared standard\n",
    resolveSettings: async () => ({ locale: "en-US", theme: "system" }),
  };
  const options = { risk: "high", ui: false };
  const [coreBrief, pluginBrief] = await Promise.all([
    createAlignBrief(options, dependencies),
    plugin.createAlignBrief(options, dependencies),
  ]);
  const { schemaPath: coreSchemaPath, ...coreContract } = coreBrief;
  const { schemaPath: pluginSchemaPath, ...pluginContract } = pluginBrief;
  const schemaSuffix = join("features", "align", "session-v1.schema.json");
  assert.ok(coreSchemaPath.endsWith(schemaSuffix));
  assert.ok(pluginSchemaPath.endsWith(schemaSuffix));
  assert.deepEqual(pluginContract, coreContract);
  assert.deepEqual(
    pluginValidator.validateAlignState(makeAlignState()),
    validateAlignState(makeAlignState()),
  );
});

test("harness and generated Align report the same missing AI boundary", () => {
  const harness = spawnSync(
    process.execPath,
    [resolve(root, "harness/hope.mjs"), "align"],
    { encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [resolve(root, "plugins/hope/runtime/features/align/cli.mjs"), "automatic"],
    { encoding: "utf8" },
  );
  assert.equal(harness.status, 2, harness.stderr);
  assert.equal(plugin.status, 2, plugin.stderr);
  assert.match(harness.stderr, new RegExp(ALIGN_MODEL_ADAPTER_MESSAGE, "u"));
  assert.match(plugin.stderr, new RegExp(ALIGN_MODEL_ADAPTER_MESSAGE, "u"));
});

test("exact harness and generated Align commands stay equivalent", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "hope-align-two-track-"));
  const input = join(temporaryRoot, "align.json");
  await writeFile(input, JSON.stringify(makeAlignState()), { mode: 0o600 });
  const brief = ["brief", "--risk", "high", "--ui", "no"];
  const harnessBrief = runJson("harness/hope.mjs", ["align", ...brief]);
  const pluginBrief = runJson(
    "plugins/hope/runtime/features/align/cli.mjs",
    brief,
  );
  assert.deepEqual(
    withoutSchemaPath(pluginBrief),
    withoutSchemaPath(harnessBrief),
  );

  const harnessResult = runJson(
    "harness/hope.mjs",
    ["align", "validate", "--input", input],
  );
  const pluginResult = runJson(
    "plugins/hope/runtime/features/align/cli.mjs",
    ["validate", "--input", input],
  );
  assert.deepEqual(pluginResult, harnessResult);
});
