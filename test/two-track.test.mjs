import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DIFF_MODEL_ADAPTER_CODE,
  DIFF_MODEL_ADAPTER_MESSAGE,
  prepareDiff,
  runDiff,
} from "../features/diff/index.mjs";
import {
  main as runDiffCommand,
  parseDiffArguments,
} from "../features/diff/cli.mjs";
import {
  loadWritingStandard,
  WRITE_BRIEF_VERSION,
  WRITE_MODEL_ADAPTER_MESSAGE,
  runWrite,
} from "../features/write/index.mjs";
import {
  parseWriteArguments,
} from "../features/write/cli.mjs";
import { main, parseArguments } from "../harness/hope.mjs";
import { normalizeLineEndings } from "../tools/build-plugin.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

test("generated plugin text uses the same line endings on every system", () => {
  assert.equal(normalizeLineEndings("one\r\ntwo\rthree\n"), "one\ntwo\nthree\n");
});

test("the harness parses every independent feature entry", () => {
  assert.deepEqual(parseArguments(["diff"]), {
    arguments: [],
    command: "diff",
  });
  assert.deepEqual(parseArguments(["settings", "show"]), {
    arguments: ["show"],
    command: "settings",
  });
  assert.deepEqual(parseArguments(["write"]), {
    arguments: [],
    command: "write",
  });
  assert.deepEqual(parseWriteArguments(["brief", "--mode", "edit"]), {
    command: "brief",
    mode: "edit",
  });
  assert.deepEqual(parseDiffArguments([
    "prepare",
    "https://github.com/example/repo/pull/1",
    "--locale",
    "ko-KR",
  ]), {
    command: "prepare",
    hostLocale: undefined,
    locale: "ko-KR",
    outputPath: undefined,
    theme: undefined,
    url: "https://github.com/example/repo/pull/1",
  });
  assert.deepEqual(parseDiffArguments([
    "validate",
    "--run",
    "/tmp/hope-run",
  ]), {
    command: "validate",
    runPath: "/tmp/hope-run",
  });
  assert.deepEqual(parseDiffArguments([
    "context",
    "--run",
    "/tmp/hope-run",
    "--head-file",
    "src/caller.js",
    "--merge-base-file",
    "src/caller.js",
  ]), {
    command: "context",
    requests: [
      { path: "src/caller.js", revision: "head" },
      { path: "src/caller.js", revision: "merge-base" },
    ],
    runPath: "/tmp/hope-run",
  });
});

test("the diff command delegates read-only analysis validation", async () => {
  let received;
  let output = "";
  await runDiffCommand(["validate", "--run", "/tmp/hope-run"], {
    stdout: {
      write(value) {
        output += value;
      },
    },
    validateDiff: async (runPath) => {
      received = runPath;
      return { valid: true };
    },
  });
  assert.equal(received, "/tmp/hope-run");
  assert.equal(output, `${JSON.stringify({ valid: true }, null, 2)}\n`);
});

test("the diff command delegates bounded exact-revision context collection", async () => {
  let received;
  let output = "";
  const requests = [{ path: "src/caller.js", revision: "head" }];
  await runDiffCommand([
    "context",
    "--run",
    "/tmp/hope-run",
    "--head-file",
    "src/caller.js",
  ], {
    addDiffContext: async (runPath, contextRequests) => {
      received = { contextRequests, runPath };
      return { collected: 1, pageCount: 4 };
    },
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.deepEqual(received, {
    contextRequests: requests,
    runPath: "/tmp/hope-run",
  });
  assert.equal(output, `${JSON.stringify({ collected: 1, pageCount: 4 }, null, 2)}\n`);
});

test("the internal inspect protocol emits compact model input without its private digest", async () => {
  let output = "";
  const page = {
    digest: "d".repeat(64),
    kind: "sources",
    page: 1,
    totalPages: 1,
    value: {
      contentIsUntrusted: true,
      sources: [{ sourceId: "source-1", startLine: 1, endLine: 1, text: "value" }],
    },
  };
  const result = await runDiffCommand(
    ["inspect", "--run", "/tmp/hope-run", "--page", "1"],
    {
      readDiffPage: async () => page,
      stdout: {
        write(value) {
          output += value;
        },
      },
    },
  );

  assert.equal(result, page);
  assert.equal(output.includes("\n  "), false);
  assert.equal(output.includes("digest"), false);
  assert.deepEqual(JSON.parse(output), {
    kind: page.kind,
    page: page.page,
    totalPages: page.totalPages,
    value: page.value,
  });
});

test("the harness reports the package version", async () => {
  let output = "";
  await main(["--version"], {
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.equal(output, `${packageJson.version}\n`);
});

test("the independent harness reports each missing AI adapter", () => {
  assert.throws(runDiff, (error) => {
    assert.equal(error.code, DIFF_MODEL_ADAPTER_CODE);
    assert.equal(error.message, DIFF_MODEL_ADAPTER_MESSAGE);
    return true;
  });
  assert.throws(runWrite, new RegExp(WRITE_MODEL_ADAPTER_MESSAGE, "u"));
});

test("the harness delegates every entry to its shared command", async () => {
  const received = [];
  const writingPass = {
    input: { mode: "edit" },
    response: { mode: "draft" },
  };
  await main(["diff"], {
    createTaskWritingPass: async () => writingPass,
    runDiffCommand: async (arguments_, context) => (
      received.push(["diff", arguments_, context.writingPass])
    ),
  });
  await main(["settings", "show"], {
    runSettingsCommand: async (arguments_) => received.push(["settings", arguments_]),
  });
  await main(["write"], {
    runWriteCommand: async (arguments_) => received.push(["write", arguments_]),
  });
  assert.deepEqual(received, [
    ["diff", ["automatic"], writingPass],
    ["settings", ["show"]],
    ["write", []],
  ]);
});

test("Codex and Claude Code share the same Hope skills", async () => {
  const diffDirectory = resolve(root, "plugins/hope/skills/diff");
  const settingsDirectory = resolve(root, "plugins/hope/skills/settings");
  const writeDirectory = resolve(root, "plugins/hope/skills/write");
  const diff = await readFile(resolve(diffDirectory, "SKILL.md"), "utf8");
  const settings = await readFile(resolve(settingsDirectory, "SKILL.md"), "utf8");
  const write = await readFile(resolve(writeDirectory, "SKILL.md"), "utf8");
  const coreWritingStandard = await readFile(
    resolve(root, "features/write/standard.md"),
    "utf8",
  );
  const pluginWritingStandard = await readFile(
    resolve(root, "plugins/hope/runtime/features/write/standard.md"),
    "utf8",
  );
  const codexPlugin = JSON.parse(await readFile(
    resolve(root, "plugins/hope/.codex-plugin/plugin.json"),
    "utf8",
  ));
  const claudePlugin = JSON.parse(await readFile(
    resolve(root, "plugins/hope/.claude-plugin/plugin.json"),
    "utf8",
  ));

  await access(resolve(root, "plugins/hope/runtime/features/diff/cli.mjs"));
  await access(resolve(root, "plugins/hope/runtime/settings/cli.mjs"));
  await access(resolve(root, "plugins/hope/runtime/features/write/cli.mjs"));
  assert.equal(codexPlugin.skills, "./skills/");
  assert.equal(claudePlugin.skills, "./skills/");
  assert.match(diff, /runtime\/features\/diff\/cli\.mjs/u);
  assert.match(diff, /\$\{CLAUDE_PLUGIN_ROOT\}/u);
  assert.match(diff, /Use `coreChange\.details` for the main explanation/u);
  assert.match(diff, /Add `contextChecks`/u);
  assert.match(diff, /Make each claim no broader than its evidence/u);
  assert.match(diff, /writingStandard\.text/u);
  assert.match(diff, /Write generated prose as plain text/u);
  assert.match(diff, /serialized byte count/u);
  assert.match(
    diff,
    /do not reread the generated\s+product or design\s+documents/u,
  );
  assert.doesNotMatch(diff, /\.\.\/\.\.\/docs\/diff\.md/u);
  assert.doesNotMatch(diff, /Prefer a short, familiar word/u);
  assert.match(diff, /validate --run <run-path>/u);
  assert.match(settings, /runtime\/settings\/cli\.mjs/u);
  assert.match(write, /runtime\/features\/write\/cli\.mjs/u);
  assert.match(write, /brief --mode <draft\|edit\|review>/u);
  assert.doesNotMatch(write, /Prefer a short, familiar word/u);
  assert.equal(pluginWritingStandard, coreWritingStandard);
});

test("core and generated Diff preparation return one writing standard", async () => {
  const pluginDiff = await import(
    "../plugins/hope/runtime/features/diff/index.mjs"
  );
  const snapshot = {
    pullRequest: {
      number: 142,
      title: "Keep the last retry error",
      url: "https://github.com/example/hope/pull/142",
    },
  };
  const dependencies = {
    collect: async () => snapshot,
    createRun: async () => ({
      analysisPath: join(tmpdir(), "hope-analysis.json"),
      pageCount: 1,
      path: join(tmpdir(), "hope-run"),
      runId: "3".repeat(32),
      snapshotDigest: "d".repeat(64),
    }),
    preflightOutput: async () => undefined,
    resolveSettings: async () => ({
      locale: "en-US",
      localeSource: "default",
      theme: "system",
      themeSource: "default",
    }),
  };
  const options = {
    url: "https://github.com/example/hope/pull/142",
  };

  const [core, plugin] = await Promise.all([
    prepareDiff(options, dependencies),
    pluginDiff.prepareDiff(options, dependencies),
  ]);
  const expected = await loadWritingStandard();

  assert.deepEqual(core.writingStandard, {
    text: expected,
    version: WRITE_BRIEF_VERSION,
  });
  assert.deepEqual(plugin.writingStandard, core.writingStandard);
});

test("the harness and generated runtime report the same missing AI boundary", () => {
  const harness = spawnSync(
    process.execPath,
    [resolve(root, "harness/hope.mjs"), "diff"],
    { encoding: "utf8" },
  );
  const plugin = spawnSync(
    process.execPath,
    [resolve(root, "plugins/hope/runtime/features/diff/cli.mjs"), "automatic"],
    { encoding: "utf8" },
  );
  assert.equal(harness.status, 2);
  assert.equal(plugin.status, 2);
  assert.match(harness.stderr, new RegExp(DIFF_MODEL_ADAPTER_MESSAGE, "u"));
  assert.match(plugin.stderr, new RegExp(DIFF_MODEL_ADAPTER_MESSAGE, "u"));

  const writeHarness = spawnSync(
    process.execPath,
    [resolve(root, "harness/hope.mjs"), "write"],
    { encoding: "utf8" },
  );
  const writePlugin = spawnSync(
    process.execPath,
    [resolve(root, "plugins/hope/runtime/features/write/cli.mjs"), "automatic"],
    { encoding: "utf8" },
  );
  assert.equal(writeHarness.status, 2);
  assert.equal(writePlugin.status, 2);
  assert.match(
    writeHarness.stderr,
    new RegExp(WRITE_MODEL_ADAPTER_MESSAGE, "u"),
  );
  assert.match(
    writePlugin.stderr,
    new RegExp(WRITE_MODEL_ADAPTER_MESSAGE, "u"),
  );
});

test("the harness and plugin share one global settings file", async () => {
  const configHome = await mkdtemp(join(tmpdir(), "hope-two-track-settings-"));
  const environment = { ...process.env, HOPE_CONFIG_HOME: configHome };
  const saved = spawnSync(
    process.execPath,
    [
      resolve(root, "harness/hope.mjs"),
      "settings",
      "set",
      "locale",
      "ko-KR",
    ],
    { encoding: "utf8", env: environment },
  );
  assert.equal(saved.status, 0, saved.stderr);
  const shown = spawnSync(
    process.execPath,
    [resolve(root, "plugins/hope/runtime/settings/cli.mjs"), "show"],
    { encoding: "utf8", env: environment },
  );
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /언어: ko-KR/u);
  assert.match(shown.stdout, /언어 선택 기준: 저장된 설정/u);
});

test("release checks bind versions only for tag builds", () => {
  const checkRelease = resolve(root, "tools/check-release.mjs");
  const runCheck = (githubEnvironment) => spawnSync(
    process.execPath,
    [checkRelease],
    {
      encoding: "utf8",
      env: { ...process.env, ...githubEnvironment },
    },
  );

  const pullRequest = runCheck({
    GITHUB_REF_NAME: "7/merge",
    GITHUB_REF_TYPE: "branch",
  });
  const release = runCheck({
    GITHUB_REF_NAME: `v${packageJson.version}`,
    GITHUB_REF_TYPE: "tag",
  });
  const wrongRelease = runCheck({
    GITHUB_REF_NAME: "v0.0.0-wrong",
    GITHUB_REF_TYPE: "tag",
  });

  assert.equal(pullRequest.status, 0, pullRequest.stderr);
  assert.equal(release.status, 0, release.stderr);
  assert.notEqual(wrongRelease.status, 0);
});
