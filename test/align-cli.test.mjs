import assert from "node:assert/strict";
import test from "node:test";

import {
  main,
  parseAlignArguments,
} from "../plugins/hope/skills/align/scripts/cli.mjs";

test("Align CLI accepts only complete private adapter commands", () => {
  assert.deepEqual(
    parseAlignArguments([
      "create",
      "--input",
      "/tmp/input.json",
      "--output",
      "docs/alignments/work.json",
      "--root",
      "/repo",
    ]),
    {
      command: "create",
      inputPath: "/tmp/input.json",
      outputPath: "docs/alignments/work.json",
      root: "/repo",
    },
  );
  assert.deepEqual(
    parseAlignArguments(["revise", "--record", "/repo/work.json", "--input", "/tmp/input.json"]),
    {
      command: "revise",
      inputPath: "/tmp/input.json",
      recordPath: "/repo/work.json",
      root: undefined,
    },
  );
  assert.deepEqual(
    parseAlignArguments(["inspect", "--record", "/repo/work.json"]),
    { command: "inspect", recordPath: "/repo/work.json" },
  );
  assert.deepEqual(
    parseAlignArguments(["render", "--record", "/repo/work.json"]),
    { command: "render", recordPath: "/repo/work.json" },
  );
  assert.deepEqual(
    parseAlignArguments(["migrate", "--artifact", "/repo/work.html"]),
    { artifactPath: "/repo/work.html", command: "migrate" },
  );
  assert.throws(() => parseAlignArguments(["create", "--input", "x"]), /Internal Skill/u);
  assert.throws(
    () => parseAlignArguments(["inspect", "--record", "x", "--root", "y"]),
    /Unknown Hope Align option: --root/u,
  );
  assert.throws(
    () => parseAlignArguments(["revise", "--record", "x", "--input", "y", "--expect", "z"]),
    /Unknown Hope Align option: --expect/u,
  );
  assert.throws(() => parseAlignArguments(["inspect", "--artifact", "x"]), /Unknown/u);
  assert.throws(() => parseAlignArguments(["toString"]), /Internal Skill/u);
});

test("Align CLI writes structured results", async () => {
  let output = "";
  const expected = { recordPath: "/repo/work.json", revision: 1 };
  const result = await main(
    ["render", "--record", "/repo/work.json"],
    {
      renderAlignRecord: async (path) => ({ ...expected, recordPath: path }),
      stdout: { write: (value) => { output += value; } },
    },
  );
  assert.deepEqual(result, expected);
  assert.deepEqual(JSON.parse(output), expected);
});
