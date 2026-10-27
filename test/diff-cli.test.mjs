import assert from "node:assert/strict";
import test from "node:test";

import {
  DIFF_CLEANUP_FAILED_CODE,
  DIFF_PUBLICATION_RETRYABLE_CODE,
  DIFF_REVALIDATION_RETRYABLE_CODE,
} from "../plugins/hope/skills/diff/scripts/index.mjs";
import {
  diffErrorDetails,
  diffErrorReport,
  diffExitCode,
  main as runDiffCommand,
  parseDiffArguments,
} from "../plugins/hope/skills/diff/scripts/cli.mjs";

const captureDefaults = {
  base: undefined,
  bundleBytes: undefined,
  command: "capture",
  hostLocale: undefined,
  locale: undefined,
  outputPath: undefined,
  theme: undefined,
  untracked: false,
  url: undefined,
};

test("Diff parses every internal Skill command", () => {
  assert.deepEqual(parseDiffArguments([]), { command: "help" });
  assert.deepEqual(parseDiffArguments([
    "capture",
    "https://github.com/example/repo/pull/1",
    "--host-locale", "ko-KR",
    "--locale", "en-US",
    "--theme", "dark",
    "--output", "review.html",
    "--bundle-bytes", "65536",
  ]), {
    ...captureDefaults,
    bundleBytes: 65536,
    hostLocale: "ko-KR",
    locale: "en-US",
    outputPath: "review.html",
    theme: "dark",
    url: "https://github.com/example/repo/pull/1",
  });
  assert.deepEqual(parseDiffArguments(["capture", "#123"]), { ...captureDefaults, pullRequestNumber: 123 });
  assert.deepEqual(
    parseDiffArguments(["capture", "--base", "origin/main", "--untracked"]),
    { ...captureDefaults, base: "origin/main", untracked: true },
  );
  assert.deepEqual(parseDiffArguments([
    "context", "--run", "run-path",
    "--path", "src/a.js", "--revision", "head",
    "--path", "src/b.js", "--revision", "merge-base",
  ]), {
    command: "context",
    requests: [
      { path: "src/a.js", revision: "head" },
      { path: "src/b.js", revision: "merge-base" },
    ],
    runPath: "run-path",
  });
  for (const command of ["validate", "publish", "cancel"]) {
    assert.deepEqual(parseDiffArguments([command, "--run", "run-path"]), { command, runPath: "run-path" });
  }
});

test("Diff help lists the capture, context, validate, publish, and cancel commands", async () => {
  let output = "";
  await runDiffCommand(["--help"], { stdout: { write(value) { output += value; } } });
  assert.match(output, /^Use Hope Diff through its private Skill adapter\.\n/u);
  assert.deepEqual(
    [...output.matchAll(/^ {2}([a-z-]+) /gmu)].map((match) => match[1]),
    ["capture", "context", "validate", "publish", "cancel"],
  );
});

test("Diff rejects malformed and removed internal Skill commands", () => {
  for (const argv of [
    ["unknown"],
    ["prepare", "#1"],
    ["resolve-target", "#1"],
    ["inspect-window", "--run", "run-path"],
    ["checkpoint-window", "--run", "run-path"],
    ["ledger", "--run", "run-path"],
    ["microworld-skeleton"],
    ["finish", "--run", "run-path"],
    ["capture", "#1", "#2"],
    ["capture", "#1", "--run", "run-path"],
    ["validate", "--run", "run-path", "--base", "main"],
    ["publish"],
  ]) {
    assert.throws(() => parseDiffArguments(argv), /Use Hope Diff through its private Skill adapter|Unknown Hope diff option/u, argv.join(" "));
  }
  assert.throws(() => parseDiffArguments(["capture", "--untracked", "--untracked"]), /repeated/u);
  assert.throws(() => parseDiffArguments(["capture", "--bundle-bytes", "64k"]), /needs an integer/u);
  assert.throws(
    () => parseDiffArguments(["context", "--run", "run-path", "--path", "a.js"]),
    /matching --path and --revision pairs/u,
  );
  assert.throws(
    () => parseDiffArguments(["context", "--run", "run-path", "--path", "a.js", "--revision", "head", "--revision", "head"]),
    /matching --path and --revision pairs/u,
  );
});

test("Diff dispatches every internal Skill command", async () => {
  const rows = [
    { argv: ["capture", "#7"], dependency: "captureDiff", expectedArguments: [{ ...captureDefaults, pullRequestNumber: 7 }] },
    {
      argv: ["context", "--run", "run-path", "--path", "src/a.js", "--revision", "head"],
      dependency: "addDiffContext",
      expectedArguments: ["run-path", [{ path: "src/a.js", revision: "head" }]],
    },
    { argv: ["validate", "--run", "run-path"], dependency: "validateDiff", expectedArguments: ["run-path"] },
    { argv: ["publish", "--run", "run-path"], dependency: "publishDiff", expectedArguments: ["run-path"] },
    { argv: ["cancel", "--run", "run-path"], dependency: "cancelDiff", expectedArguments: ["run-path"], result: undefined },
  ];
  for (const row of rows) {
    let output = "";
    let received;
    const result = Object.hasOwn(row, "result") ? row.result : { command: row.argv[0] };
    const dependencies = {
      [row.dependency]: async (...values) => {
        received = values;
        return result;
      },
      stdout: { write(value) { output += value; } },
    };
    assert.equal(await runDiffCommand(row.argv, dependencies), result);
    assert.equal(received.at(-1), dependencies);
    assert.deepEqual(received.slice(0, -1), row.expectedArguments);
    assert.equal(output, result === undefined ? "" : `${JSON.stringify(result, null, 2)}\n`);
  }
});

test("Diff emits structured repair, retry, and cleanup errors", () => {
  const analysisError = new Error("Analysis needs repair");
  analysisError.code = "HOPE_ANALYSIS_INVALID";
  analysisError.canRetry = true;
  analysisError.issues = [{
    code: "CHANGE_GROUNDING",
    message: "coreChange.before must be grounded in collected code",
    path: "coreChange.before",
  }];
  assert.equal(diffExitCode(analysisError), 3);
  analysisError.runPath = "run-path";
  assert.deepEqual(JSON.parse(diffErrorDetails(analysisError).trim()), {
    canRetry: true,
    code: "HOPE_ANALYSIS_INVALID",
    issues: analysisError.issues,
    runPath: "run-path",
  });

  const render = new Error("Renderer failed");
  render.code = "HOPE_DIFF_RENDER_FAILED";
  render.canRetry = false;
  render.runPath = "run-path";
  assert.equal(diffExitCode(render), 1);
  assert.deepEqual(JSON.parse(diffErrorDetails(render).trim()), {
    code: "HOPE_DIFF_RENDER_FAILED",
    runPath: "run-path",
  });

  const retryable = new Error("GitHub access failed");
  retryable.code = DIFF_REVALIDATION_RETRYABLE_CODE;
  retryable.canRetry = true;
  retryable.command = "publish";
  retryable.runPath = "run-path";
  assert.equal(diffExitCode(retryable), 5);
  assert.deepEqual(
    diffErrorReport(retryable, { prefix: "hope" }),
    {
      exitCode: 5,
      message: `hope: GitHub access failed\n${JSON.stringify({
        canRetry: true,
        code: DIFF_REVALIDATION_RETRYABLE_CODE,
        command: "publish",
        runPath: "run-path",
      })}\n`,
    },
  );

  const publication = new Error("Publication failed");
  publication.code = DIFF_PUBLICATION_RETRYABLE_CODE;
  publication.canRetry = true;
  publication.command = "publish";
  publication.runPath = "run-path";
  assert.equal(diffExitCode(publication), 6);
  assert.deepEqual(JSON.parse(diffErrorDetails(publication).trim()), {
    canRetry: true,
    code: DIFF_PUBLICATION_RETRYABLE_CODE,
    command: "publish",
    runPath: "run-path",
  });

  const cleanup = new Error("Cleanup failed");
  cleanup.code = DIFF_CLEANUP_FAILED_CODE;
  cleanup.outputPath = "/tmp/review.html";
  cleanup.runPath = "run-path";
  assert.deepEqual(JSON.parse(diffErrorDetails(cleanup).trim()), {
    code: DIFF_CLEANUP_FAILED_CODE,
    outputPath: "/tmp/review.html",
    runPath: "run-path",
  });

  assert.equal(diffExitCode({ code: "HOPE_DIFF_STALE" }), 4);
  assert.equal(diffExitCode(new Error("ordinary failure")), 1);
  assert.equal(diffErrorDetails(new Error("ordinary failure")), "");
  assert.deepEqual(diffErrorReport(new Error("ordinary failure")), {
    exitCode: 1,
    message: "Hope Diff: ordinary failure\n",
  });

  const preserved = new Error("private write failed");
  preserved.preservedPath = "preserved-run-path";
  assert.deepEqual(JSON.parse(diffErrorDetails(preserved).trim()), {
    preservedPath: "preserved-run-path",
  });
  assert.deepEqual(diffErrorReport(preserved), {
    exitCode: 1,
    message: "Hope Diff: private write failed\n"
      + `${JSON.stringify({ preservedPath: "preserved-run-path" })}\n`,
  });
});
