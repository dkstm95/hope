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

test("Diff parses every internal Skill command", () => {
  assert.deepEqual(parseDiffArguments([]), { command: "help" });
  assert.deepEqual(parseDiffArguments([
    "prepare",
    "https://github.com/example/repo/pull/1",
    "--host-locale",
    "ko-KR",
    "--locale",
    "en-US",
    "--theme",
    "dark",
    "--output",
    "review.html",
  ]), {
    command: "prepare",
    hostLocale: "ko-KR",
    locale: "en-US",
    outputPath: "review.html",
    theme: "dark",
    url: "https://github.com/example/repo/pull/1",
  });
  assert.deepEqual(parseDiffArguments(["resolve-target", "#123"]), {
    command: "resolve-target",
    pullRequestNumber: 123,
    url: undefined,
  });

  for (const command of [
    "inspect-window",
    "checkpoint-window",
    "ledger",
  ]) {
    assert.deepEqual(
      parseDiffArguments([command, "--run", "run-path", "--page", "2"]),
      { command, page: 2, runPath: "run-path" },
    );
  }

  assert.deepEqual(parseDiffArguments([
    "context",
    "--run",
    "run-path",
    "--request",
    "first",
    "--request",
    "second",
  ]), {
    command: "context",
    requestIds: ["first", "second"],
    runPath: "run-path",
  });
  assert.deepEqual(parseDiffArguments([
    "microworld-skeleton",
    "--input",
    "controls.json",
  ]), {
    command: "microworld-skeleton",
    inputPath: "controls.json",
  });

  for (const command of ["validate", "finish", "cancel"]) {
    assert.deepEqual(
      parseDiffArguments([command, "--run", "run-path"]),
      { command, runPath: "run-path" },
    );
  }
});

test("Diff help describes the private adapter without advertising a binary", async () => {
  let output = "";
  await runDiffCommand(["--help"], {
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.match(output, /^Use Hope Diff through its private Skill adapter\.\n/u);
  assert.match(output, /Internal Skill subcommands:\n  resolve-target /u);
  assert.doesNotMatch(output, /^  hope diff /mu);
});

test("Diff rejects malformed internal Skill commands", () => {
  for (const argv of [
    ["unknown"],
    ["prepare", "#1", "--run", "run-path"],
    ["resolve-target", "#1", "--locale", "ko-KR"],
    ["microworld-skeleton"],
    ["context", "--run", "run-path"],
    ["inspect-window", "--run", "run-path", "--page", "01"],
    ["validate", "--run", "run-path", "--page", "1"],
  ]) {
    assert.throws(
      () => parseDiffArguments(argv),
      /Use Hope Diff through its private Skill adapter/u,
    );
  }

  assert.throws(
    () => parseDiffArguments(["validate", "--unknown", "value"]),
    /Unknown Hope diff option/u,
  );
});

test("Diff dispatches every internal Skill command", async () => {
  const rows = [
    {
      argv: ["resolve-target", "#7"],
      dependency: "resolveDiffTarget",
      expectedArguments: [{
        command: "resolve-target",
        pullRequestNumber: 7,
        url: undefined,
      }],
    },
    {
      argv: ["prepare", "#7"],
      dependency: "prepareDiff",
      expectedArguments: [{
        command: "prepare",
        hostLocale: undefined,
        locale: undefined,
        outputPath: undefined,
        pullRequestNumber: 7,
        theme: undefined,
        url: undefined,
      }],
    },
    {
      argv: ["inspect-window", "--run", "run-path", "--page", "1"],
      compact: true,
      dependency: "readDiffWindow",
      expectedArguments: ["run-path", 1],
    },
    {
      argv: ["checkpoint-window", "--run", "run-path", "--page", "1"],
      compact: true,
      dependency: "checkpointDiffWindow",
      expectedArguments: ["run-path", 1],
    },
    {
      argv: ["ledger", "--run", "run-path", "--page", "1"],
      dependency: "readDiffLedger",
      expectedArguments: ["run-path", 1],
    },
    {
      argv: ["context", "--run", "run-path", "--request", "request-1"],
      dependency: "addDiffContext",
      expectedArguments: ["run-path", ["request-1"]],
    },
    {
      argv: ["microworld-skeleton", "--input", "controls.json"],
      dependency: "buildMicroworldSkeleton",
      expectedArguments: ["controls.json"],
    },
    {
      argv: ["validate", "--run", "run-path"],
      dependency: "validateDiff",
      expectedArguments: ["run-path"],
    },
    {
      argv: ["finish", "--run", "run-path"],
      dependency: "finishDiff",
      expectedArguments: ["run-path"],
    },
    {
      argv: ["cancel", "--run", "run-path"],
      dependency: "cancelDiff",
      expectedArguments: ["run-path"],
    },
  ];

  for (const row of rows) {
    let output = "";
    let received;
    const result = row.result ?? { command: row.argv[0] };
    const dependencies = {
      [row.dependency]: async (...values) => {
        received = values;
        return result;
      },
      stdout: {
        write(value) {
          output += value;
        },
      },
    };

    assert.equal(await runDiffCommand(row.argv, dependencies), result);
    assert.equal(received.at(-1), dependencies);
    assert.deepEqual(received.slice(0, -1), row.expectedArguments);
    assert.deepEqual(JSON.parse(output), row.output ?? result);
    assert.equal(output.includes("\n  "), !row.compact);
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
  assert.deepEqual(JSON.parse(diffErrorDetails(analysisError).trim()), {
    canRetry: true,
    code: "HOPE_ANALYSIS_INVALID",
    issues: analysisError.issues,
  });

  const retryable = new Error("GitHub access failed");
  retryable.code = DIFF_REVALIDATION_RETRYABLE_CODE;
  retryable.canRetry = true;
  retryable.command = "finish";
  retryable.runPath = "run-path";
  assert.equal(diffExitCode(retryable), 5);
  assert.deepEqual(
    diffErrorReport(retryable, { prefix: "hope" }),
    {
      exitCode: 5,
      message: `hope: GitHub access failed\n${JSON.stringify({
        canRetry: true,
        code: DIFF_REVALIDATION_RETRYABLE_CODE,
        command: "finish",
        runPath: "run-path",
      })}\n`,
    },
  );

  const publication = new Error("Publication failed");
  publication.code = DIFF_PUBLICATION_RETRYABLE_CODE;
  publication.canRetry = true;
  publication.command = "finish";
  publication.runPath = "run-path";
  assert.equal(diffExitCode(publication), 6);
  assert.deepEqual(JSON.parse(diffErrorDetails(publication).trim()), {
    canRetry: true,
    code: DIFF_PUBLICATION_RETRYABLE_CODE,
    command: "finish",
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
