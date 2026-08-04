import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskWritingPass,
  createWritingBrief,
  createWritingStandard,
  loadWritingStandard,
  runWrite,
  WRITE_BRIEF_VERSION,
  WRITE_MODEL_ADAPTER_CODE,
  WRITE_MODEL_ADAPTER_MESSAGE,
  WRITE_STANDARD_VERSION,
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

test("the writing standard prefers one sentence per prose paragraph", async () => {
  const standard = await loadWritingStandard();
  assert.match(
    standard,
    /Prefer one sentence per prose paragraph when it improves meaning, readability,[\s\S]+or rhythm/u,
  );
  assert.match(
    standard,
    /Keep related sentences together when splitting them would harm meaning, flow,[\s\S]+or voice, or conflict with the target format/u,
  );
  assert.match(
    standard,
    /In Markdown and plain text, separate consecutive prose paragraphs with one[\s\S]+blank line/u,
  );
  assert.match(
    standard,
    /In other formats, use the format's native paragraph structure/u,
  );
  assert.match(
    standard,
    /Choose headings, lists, dividers, callouts, and paragraph boundaries that[\s\S]+target and project support/u,
  );
  assert.match(
    standard,
    /Leave visible spacing, typography, and styling to the renderer/u,
  );
  assert.match(
    standard,
    /Does the target need a heading, list, or divider for stronger semantic[\s\S]+separation/u,
  );
  assert.doesNotMatch(
    standard,
    /Use one sentence per prose paragraph unless preserving exact text or format/u,
  );
});

test("the writing standard covers document-level information structure", async () => {
  const standard = await loadWritingStandard();
  assert.match(
    standard,
    /amount and local order of non-material supporting detail[\s\S]+target's purpose, intended reader, and next action/u,
  );
  assert.match(standard, /Consolidate repeated framing only when/u);
  assert.match(standard, /Preserve[\s\S]+standalone comprehension/u);
  assert.match(standard, /target and project's established semantic structure/u);
  assert.match(standard, /Use a callout[\s\S]+only when that convention already exists/u);
  assert.match(
    standard,
    /Do not delete, demote, or reorder a material claim unless the request or[\s\S]+explicitly permits that content change/u,
  );
  assert.match(standard, /Route[\s\S]+section-level restructuring[\s\S]+to Polish/u);
  assert.match(standard, /Did the revision delete, demote, or reorder/u);
});

test("the writing standard keeps semantic rules without decision examples", async () => {
  const standard = await createWritingStandard({
    loadStandard: async () => "shared standard\n",
  });
  assert.deepEqual(standard, {
    text: "shared standard\n",
    version: WRITE_STANDARD_VERSION,
  });
  assert.equal(Object.hasOwn(standard, "decisionExamples"), false);
});

test("a writing brief passes through the standard contract independently of its version", async () => {
  const writingStandard = Object.freeze({
    text: "sentinel standard\n",
    version: 73,
  });
  const brief = await createWritingBrief(
    { mode: "edit" },
    {
      createStandard: async ({ loadStandard }) => {
        assert.equal(await loadStandard(), "shared standard\n");
        return writingStandard;
      },
      loadStandard: async () => "shared standard\n",
    },
  );
  assert.deepEqual(brief, {
    feature: "write",
    mode: "edit",
    response: "Change the requested target and lead with the completed result.\n\nPreserve a material ambiguity instead of silently choosing a new meaning.",
    standard: "sentinel standard\n",
    standardVersion: 73,
    version: WRITE_BRIEF_VERSION,
  });
  assert.equal(Object.hasOwn(brief, "decisionExamples"), false);
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
