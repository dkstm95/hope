import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskWritingPass,
  createWritingBrief,
  loadWritingStandard,
  runWrite,
  WRITE_BRIEF_VERSION,
  WRITE_MODEL_ADAPTER_CODE,
  WRITE_MODEL_ADAPTER_MESSAGE,
} from "../features/write/index.mjs";
import {
  main as runWriteCommand,
  parseWriteArguments,
} from "../features/write/cli.mjs";

test("the writing standard has one normalized core source", async () => {
  assert.equal(
    await loadWritingStandard({ read: async () => "one\r\ntwo\r" }),
    "one\ntwo\n",
  );
  await assert.rejects(
    loadWritingStandard({ read: async () => " \n" }),
    /standard is empty/u,
  );
});

test("the writing standard rejects prose shaped by another language", async () => {
  const standard = await loadWritingStandard();
  assert.match(standard, /Write each language as original prose/u);
  assert.match(standard, /without copying[\s\S]+word order, idioms, or sentence shape/u);
  assert.match(standard, /use two passes[\s\S]+meaning drift/u);
  assert.match(standard, /Does any phrase sound translated/u);

  const brief = await createWritingBrief({ mode: "edit" });
  assert.equal(brief.standard, standard);
});

test("a writing brief binds the shared standard to one mode", async () => {
  const brief = await createWritingBrief(
    { mode: "edit" },
    { loadStandard: async () => "shared standard\n" },
  );
  assert.deepEqual(brief, {
    feature: "write",
    mode: "edit",
    response: "Change the requested target and lead with the completed result. Preserve a material ambiguity instead of silently choosing a new meaning.",
    standard: "shared standard\n",
    version: WRITE_BRIEF_VERSION,
  });
  await assert.rejects(
    createWritingBrief({ mode: "polish" }),
    /Unknown Hope write mode/u,
  );
});

test("a task writing pass covers input and response language", async () => {
  const modes = [];
  const pass = await createTaskWritingPass({
    createBrief: async ({ mode }) => {
      modes.push(mode);
      return { mode };
    },
  });
  assert.deepEqual(modes.sort(), ["draft", "edit"]);
  assert.deepEqual(pass, {
    input: { mode: "edit" },
    response: { mode: "draft" },
  });
});

test("the write command returns the core brief", async () => {
  assert.deepEqual(parseWriteArguments(["brief", "--mode", "review"]), {
    command: "brief",
    mode: "review",
  });
  assert.deepEqual(parseWriteArguments(["some text"]), {
    arguments: ["some text"],
    command: "automatic",
  });
  assert.throws(
    () => parseWriteArguments(["brief", "--mode", "polish"]),
    /Internal host protocol/u,
  );

  let output = "";
  const expected = { feature: "write", mode: "draft", version: 1 };
  const result = await runWriteCommand(["brief", "--mode", "draft"], {
    createWritingBrief: async () => expected,
    stdout: {
      write(value) {
        output += value;
      },
    },
  });
  assert.equal(result, expected);
  assert.equal(output, `${JSON.stringify(expected, null, 2)}\n`);
});

test("automatic writing reports the missing harness model adapter", () => {
  assert.throws(runWrite, (error) => {
    assert.equal(error.code, WRITE_MODEL_ADAPTER_CODE);
    assert.equal(error.message, WRITE_MODEL_ADAPTER_MESSAGE);
    return true;
  });
});
