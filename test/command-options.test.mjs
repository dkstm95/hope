import assert from "node:assert/strict";
import test from "node:test";

import { parseAlignArguments } from "../features/align/cli.mjs";
import { takeOptions } from "../features/command-options/index.mjs";
import { parseDiffArguments } from "../features/diff/cli.mjs";
import { parsePolishArguments } from "../features/polish/cli.mjs";
import { parseToxicReviewArguments } from "../features/toxic-review/cli.mjs";

test("shared command options keep positionals and repeatable values", () => {
  assert.deepEqual(
    takeOptions(["target", "--label", "first", "--label", "second"], {
      allowed: ["label"],
      prefix: "Hope test",
      repeatable: ["label"],
    }),
    {
      options: { label: ["first", "second"] },
      positionals: ["target"],
    },
  );
});

test("shared command options preserve unknown, missing, and repeated errors", () => {
  const configuration = { allowed: ["label"], prefix: "Hope test" };

  assert.throws(
    () => takeOptions(["--unknown", "value"], configuration),
    /Unknown Hope test option: --unknown/u,
  );
  assert.throws(
    () => takeOptions(["--label"], configuration),
    /Hope test option --label needs a value/u,
  );
  assert.throws(
    () => takeOptions(["--label", "one", "--label", "two"], configuration),
    /Hope test option --label was repeated/u,
  );
});

test("feature parsers keep their existing option contracts", () => {
  assert.throws(
    () => parseAlignArguments(["brief", "--unknown", "value"]),
    /Unknown Hope align option: --unknown/u,
  );
  assert.throws(
    () => parsePolishArguments(["brief", "--risk"]),
    /Hope polish option --risk needs a value/u,
  );
  assert.throws(
    () => parseToxicReviewArguments([
      "brief",
      "--risk",
      "low",
      "--risk",
      "high",
    ]),
    /Hope toxic review option --risk was repeated/u,
  );
  assert.deepEqual(
    parseDiffArguments([
      "context",
      "--run",
      "run",
      "--request",
      "one",
      "--request",
      "two",
    ]),
    {
      command: "context",
      requestIds: ["one", "two"],
      runPath: "run",
    },
  );
});
