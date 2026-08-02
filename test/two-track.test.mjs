import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  chmod,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createAlignBrief } from "../features/align/index.mjs";
import {
  DIFF_MODEL_ADAPTER_CODE,
  DIFF_MODEL_ADAPTER_MESSAGE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
  prepareDiff,
  runDiff,
} from "../features/diff/index.mjs";
import {
  diffErrorDetails,
  diffExitCode,
  diffErrorReport,
  main as runDiffCommand,
  parseDiffArguments,
} from "../features/diff/cli.mjs";
import { createPolishBrief } from "../features/polish/index.mjs";
import { createToxicReviewBrief } from "../features/toxic-review/index.mjs";
import {
  loadWritingStandard,
  WRITE_BRIEF_VERSION,
  WRITE_DECISION_EXAMPLES,
  WRITE_MODEL_ADAPTER_MESSAGE,
  WRITE_STANDARD_VERSION,
  runWrite,
} from "../features/write/index.mjs";
import {
  parseWriteArguments,
} from "../features/write/cli.mjs";
import {
  harnessErrorReport,
  main,
  parseArguments,
} from "../harness/hope.mjs";
import {
  checkpointDiffRun,
  createDiffRun,
  inspectDiffRun,
  loadDiffRun,
  removeDiffRun,
} from "../features/diff/run.mjs";
import { makeAnalysis, makeSnapshot } from "../test-support/diff-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";
import { normalizeLineEndings } from "../tools/build-plugin.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

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
    "--request",
    "context-request-1",
    "--request",
    "context-request-2",
  ]), {
    command: "context",
    requestIds: ["context-request-1", "context-request-2"],
    runPath: "/tmp/hope-run",
  });
  assert.deepEqual(parseDiffArguments([
    "ledger",
    "--run",
    "/tmp/hope-run",
    "--page",
    "2",
  ]), {
    command: "ledger",
    page: 2,
    runPath: "/tmp/hope-run",
  });
  assert.deepEqual(parseDiffArguments([
    "microworld-skeleton",
    "--input",
    "/tmp/hope-controls.json",
  ]), {
    command: "microworld-skeleton",
    inputPath: "/tmp/hope-controls.json",
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

test("the diff command delegates microworld skeleton generation", async () => {
  let received;
  let output = "";
  await runDiffCommand([
    "microworld-skeleton",
    "--input",
    "/tmp/hope-controls.json",
  ], {
    buildMicroworldSkeleton: async (inputPath) => {
      received = inputPath;
      return { scenarios: [], version: 1 };
    },
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.equal(received, "/tmp/hope-controls.json");
  assert.equal(
    output,
    `${JSON.stringify({ scenarios: [], version: 1 }, null, 2)}\n`,
  );
});

test("the diff command delegates bounded exact-revision context collection", async () => {
  let received;
  let output = "";
  const requestIds = ["context-request-1"];
  await runDiffCommand([
    "context",
    "--run",
    "/tmp/hope-run",
    "--request",
    "context-request-1",
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
    contextRequests: requestIds,
    runPath: "/tmp/hope-run",
  });
  assert.equal(output, `${JSON.stringify({ collected: 1, pageCount: 4 }, null, 2)}\n`);
});

test("the diff command identifies a retryable revalidation failure", () => {
  const error = new Error("GitHub access failed");
  error.code = DIFF_REVALIDATION_RETRYABLE_CODE;
  error.canRetry = true;
  error.command = "finish";
  error.runPath = "/tmp/hope-run";
  assert.equal(diffExitCode(error), 5);
  assert.equal(
    diffErrorDetails(error),
    `\n${JSON.stringify({
      canRetry: true,
      code: DIFF_REVALIDATION_RETRYABLE_CODE,
      command: "finish",
      runPath: "/tmp/hope-run",
    })}`,
  );
  assert.deepEqual(
    harnessErrorReport(error),
    diffErrorReport(error, { prefix: "hope" }),
  );
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
  const align = await readFile(
    resolve(root, "plugins/hope/skills/align/SKILL.md"),
    "utf8",
  );
  const diffDirectory = resolve(root, "plugins/hope/skills/diff");
  const polish = await readFile(
    resolve(root, "plugins/hope/skills/polish/SKILL.md"),
    "utf8",
  );
  const settingsDirectory = resolve(root, "plugins/hope/skills/settings");
  const toxicReview = await readFile(
    resolve(root, "plugins/hope/skills/toxic-review/SKILL.md"),
    "utf8",
  );
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
  assert.match(diff, /writingStandard\.decisionExamples/u);
  assert.match(diff, /Write generated prose as plain text/u);
  assert.match(diff, /serialized byte count/u);
  assert.match(
    diff,
    /do not\s+reread the generated\s+product or design\s+documents/u,
  );
  assert.doesNotMatch(diff, /\.\.\/\.\.\/docs\/diff\.md/u);
  assert.doesNotMatch(diff, /Prefer a short, familiar word/u);
  assert.match(diff, /validate --run <run-path>/u);
  assert.match(diff, /HOPE_DIFF_REVALIDATION_RETRYABLE/u);
  assert.match(diff, /structured error's\s+`command` and\s+`runPath` fields/u);
  assert.match(diff, /before the\s+first `finish` attempt/u);
  assert.match(settings, /runtime\/settings\/cli\.mjs/u);
  assert.match(write, /runtime\/features\/write\/cli\.mjs/u);
  assert.match(write, /brief --mode <draft\|edit\|review>/u);
  assert.match(write, /`standard`, `decisionExamples`/u);
  for (const skill of [align, diff, polish, toxicReview, write]) {
    assert.match(skill, /not\s+evaluation results/u);
  }
  assert.doesNotMatch(write, /Prefer a short, familiar word/u);
  assert.equal(pluginWritingStandard, coreWritingStandard);
});

test("every Write entry path returns the same brief", async () => {
  const expectedStandard = await loadWritingStandard();
  const entries = [
    {
      name: "core",
      path: resolve(root, "features/write/cli.mjs"),
      prefixArguments: [],
    },
    {
      name: "harness",
      path: resolve(root, "harness/hope.mjs"),
      prefixArguments: ["write"],
    },
    {
      name: "generated plugin",
      path: resolve(root, "plugins/hope/runtime/features/write/cli.mjs"),
      prefixArguments: [],
    },
  ];

  for (const mode of ["draft", "edit", "review"]) {
    const briefs = entries.map((entry) => {
      const result = spawnSync(
        process.execPath,
        [
          entry.path,
          ...entry.prefixArguments,
          "brief",
          "--mode",
          mode,
        ],
        { encoding: "utf8" },
      );
      assert.equal(
        result.status,
        0,
        `${entry.name} Write brief failed: ${result.stderr}`,
      );
      return JSON.parse(result.stdout);
    });

    for (const brief of briefs) {
      assert.equal(brief.mode, mode);
      assert.equal(brief.standard, expectedStandard);
      assert.equal(brief.standardVersion, WRITE_STANDARD_VERSION);
      assert.equal(brief.version, WRITE_BRIEF_VERSION);
      assert.deepEqual(brief.decisionExamples, WRITE_DECISION_EXAMPLES);
    }
    assert.deepEqual(briefs[1], briefs[0]);
    assert.deepEqual(briefs[2], briefs[0]);
  }
});

test("every cross-feature consumer passes through the exact writing standard contract", async () => {
  const [pluginAlign, pluginDiff, pluginPolish, pluginToxicReview] = await Promise.all([
    import("../plugins/hope/runtime/features/align/index.mjs"),
    import("../plugins/hope/runtime/features/diff/index.mjs"),
    import("../plugins/hope/runtime/features/polish/index.mjs"),
    import("../plugins/hope/runtime/features/toxic-review/index.mjs"),
  ]);
  const decisionExamples = Object.freeze([
    Object.freeze({
      expectedDecision: "Keep the sentinel.",
      id: "sentinel",
      situation: "A consumer contract test needs a distinguishable example.",
    }),
  ]);
  const writingStandard = Object.freeze({
    decisionExamples,
    text: "sentinel standard\n",
    version: 73,
  });
  const snapshot = {
    pullRequest: {
      number: 142,
      title: "Keep the last retry error",
      url: "https://github.com/example/hope/pull/142",
    },
  };
  let standardCalls = 0;
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
    createWritingStandard: async ({ loadStandard }) => {
      assert.equal(typeof loadStandard, "function");
      standardCalls += 1;
      return writingStandard;
    },
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

  const [
    coreAlign,
    generatedAlign,
    coreDiff,
    generatedDiff,
    corePolish,
    generatedPolish,
    coreToxicReview,
    generatedToxicReview,
  ] = await Promise.all([
    createAlignBrief({ risk: "low" }, dependencies),
    pluginAlign.createAlignBrief({ risk: "low" }, dependencies),
    prepareDiff(options, dependencies),
    pluginDiff.prepareDiff(options, dependencies),
    createPolishBrief({ risk: "low" }, dependencies),
    pluginPolish.createPolishBrief({ risk: "low" }, dependencies),
    createToxicReviewBrief(
      { risk: "low", stage: "implementation", target: "patch" },
      dependencies,
    ),
    pluginToxicReview.createToxicReviewBrief(
      { risk: "low", stage: "implementation", target: "patch" },
      dependencies,
    ),
  ]);

  for (const consumer of [
    coreAlign,
    generatedAlign,
    coreDiff,
    generatedDiff,
    corePolish,
    generatedPolish,
    coreToxicReview,
    generatedToxicReview,
  ]) {
    assert.strictEqual(consumer.writingStandard, writingStandard);
    assert.deepEqual(consumer.writingStandard, {
      decisionExamples,
      text: "sentinel standard\n",
      version: 73,
    });
  }
  assert.equal(standardCalls, 8);
  assert.equal(coreDiff.analysisSchemaVersion, 2);
  assert.match(coreDiff.analysisSchemaPath, /analysis-v2\.schema\.json$/u);
  assert.deepEqual(generatedDiff.teachingAids, coreDiff.teachingAids);
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

test("the harness and generated runtime expose the same context-free Diff retry", {
  skip: process.platform === "win32",
}, async (context) => {
  const fakeBin = await createTestTemporaryDirectory("hope-fake-gh-");
  const fakeGh = join(fakeBin, "gh");
  await writeFile(
    fakeGh,
    [
      "#!/usr/bin/env node",
      "process.stderr.write(\"network unavailable\\n\");",
      "process.exitCode = 1;",
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  await chmod(fakeGh, 0o700);
  const snapshot = makeSnapshot();
  const created = await createDiffRun(snapshot);
  context.after(async () => await removeDiffRun(created.path).catch(() => {}));
  for (let page = 1; page <= created.pageCount; page += 1) {
    await inspectDiffRun(created.path, page);
    const run = await loadDiffRun(created.path);
    await checkpointDiffRun(created.path, page, {
      generation: run.manifest.generation,
      observations: [],
      page,
      runId: run.manifest.runId,
      schemaVersion: 1,
      snapshotDigest: run.snapshot.digest,
    });
  }
  await writeFile(
    created.analysisPath,
    `${JSON.stringify(makeAnalysis(snapshot, created.runId), null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  const environment = {
    ...process.env,
    PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
  };
  const commands = [
    [resolve(root, "harness/hope.mjs"), "diff", "finish", "--run", created.path],
    [
      resolve(root, "plugins/hope/runtime/features/diff/cli.mjs"),
      "finish",
      "--run",
      created.path,
    ],
  ];

  for (const arguments_ of commands) {
    const result = spawnSync(process.execPath, arguments_, {
      encoding: "utf8",
      env: environment,
    });
    assert.equal(result.status, 5, result.stderr);
    const details = JSON.parse(result.stderr.trim().split("\n").at(-1));
    assert.deepEqual(details, {
      canRetry: true,
      code: DIFF_REVALIDATION_RETRYABLE_CODE,
      command: "finish",
      runPath: created.path,
    });
    await loadDiffRun(created.path);
  }
});

test("the harness and plugin share one global settings file", async () => {
  const configHome = await createTestTemporaryDirectory("hope-two-track-settings-");
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
