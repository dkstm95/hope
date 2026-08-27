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
      "docs/alignments/work.html",
      "--root",
      "/repo",
    ]),
    {
      command: "create",
      inputPath: "/tmp/input.json",
      outputPath: "docs/alignments/work.html",
      root: "/repo",
    },
  );
  assert.deepEqual(
    parseAlignArguments([
      "revise",
      "--artifact",
      "/repo/work.html",
      "--expect",
      "1".repeat(64),
      "--input",
      "/tmp/input.json",
    ]),
    {
      artifactPath: "/repo/work.html",
      command: "revise",
      expectedDigest: "1".repeat(64),
      inputPath: "/tmp/input.json",
      root: undefined,
    },
  );
  assert.deepEqual(
    parseAlignArguments(["inspect", "--artifact", "/repo/work.html"]),
    { artifactPath: "/repo/work.html", command: "inspect" },
  );
  assert.throws(() => parseAlignArguments(["create", "--input", "x"]), /Internal Skill/u);
  assert.throws(
    () => parseAlignArguments(["inspect", "--artifact", "x", "--root", "y"]),
    /Internal Skill/u,
  );
  assert.throws(() => parseAlignArguments(["migrate-input", "--input", "x"]), /Internal Skill/u);
});

test("Align CLI writes structured results", async () => {
  let output = "";
  const expected = { artifactPath: "/repo/work.html", revision: 1 };
  const result = await main(
    ["inspect", "--artifact", "/repo/work.html"],
    {
      inspectAlignArtifact: async () => expected,
      stdout: { write: (value) => { output += value; } },
    },
  );
  assert.equal(result, expected);
  assert.deepEqual(JSON.parse(output), expected);
});
