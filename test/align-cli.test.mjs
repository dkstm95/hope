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
  assert.deepEqual(
    parseAlignArguments(["migrate-input", "--input", "/tmp/legacy-v2.json"]),
    { command: "migrate-input", inputPath: "/tmp/legacy-v2.json" },
  );
  assert.throws(() => parseAlignArguments(["create", "--input", "x"]), /Internal Skill/u);
  assert.throws(
    () => parseAlignArguments(["inspect", "--artifact", "x", "--root", "y"]),
    /Internal Skill/u,
  );
  assert.throws(
    () => parseAlignArguments(["migrate-input", "--input", "x", "--root", "y"]),
    /Internal Skill/u,
  );
});

test("Align CLI exposes v2 migration as a separate structured result", async () => {
  let output = "";
  const expected = {
    inputSchemaVersion: 2,
    targetSchemaVersion: 3,
    ready: false,
    draft: { schemaVersion: 3 },
    review: { boundary: "Review this" },
  };
  const result = await main(
    ["migrate-input", "--input", "/tmp/legacy-v2.json"],
    {
      migrateAlignInputFile: async () => expected,
      stdout: { write: (value) => { output += value; } },
    },
  );
  assert.equal(result, expected);
  assert.deepEqual(JSON.parse(output), expected);
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
