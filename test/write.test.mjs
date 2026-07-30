import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const maintainedProsePaths = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "PRINCIPLES.md",
  "README.md",
  "README.ko.md",
  "SECURITY.md",
  "assets/brand/README.md",
  "design/fonts/SOURCE.md",
  "docs/align.md",
  "docs/architecture.md",
  "docs/design.md",
  "docs/design/baseline-v1/README.md",
  "docs/diff.md",
  "docs/polish.md",
  "docs/toxic-review.md",
  "docs/write.md",
  "plugins/hope/skills/align/SKILL.md",
  "plugins/hope/skills/diff/SKILL.md",
  "plugins/hope/skills/polish/SKILL.md",
  "plugins/hope/skills/settings/SKILL.md",
  "plugins/hope/skills/toxic-review/SKILL.md",
  "plugins/hope/skills/write/SKILL.md",
];

// Add an exact paragraph here only when keeping related sentences together
// serves meaning, flow, voice, or the target format better than splitting them.
const paragraphExceptions = new Set();

function proseParagraphs(markdown) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const paragraphs = [];
  let paragraph = [];
  let paragraphLine = 1;
  let fence = null;
  let inFrontmatter = lines[0] === "---";

  const flush = () => {
    if (paragraph.length === 0) return;

    const first = paragraph[0] ?? "";
    const structured = (
      /^(?: {2,}|\t)/u.test(first)
      || /^(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>\s?|[|<]|!\[)/u.test(first)
      || /^\[[^\]]+\]:/u.test(first)
      || /^(?:---|\*\*\*|___)$/u.test(first.trim())
    );

    if (!structured) {
      paragraphs.push({
        line: paragraphLine,
        text: paragraph.map((line) => line.trim()).join(" "),
      });
    }

    paragraph = [];
  };

  lines.forEach((line, index) => {
    if (inFrontmatter) {
      if (index > 0 && line === "---") inFrontmatter = false;
      return;
    }

    const fenceMatch = line.match(/^\s*(```+|~~~+)/u);
    if (fenceMatch) {
      flush();
      fence = fence ? null : fenceMatch[1][0];
      return;
    }

    if (fence) return;

    if (line.trim() === "") {
      flush();
      return;
    }

    if (paragraph.length === 0) paragraphLine = index + 1;
    paragraph.push(line);
  });

  flush();
  return paragraphs;
}

function sentenceCount(text) {
  return text
    .split(/(?<=[.!?])\s+(?=(?:[*_`[(]*[\p{L}\p{N}]))/u)
    .filter(Boolean)
    .length;
}

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
    /Choose target-supported headings, lists, dividers, and paragraph boundaries[\s\S]+to express semantic structure/u,
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

test("maintained prose applies the paragraph guidance or records an exception", async () => {
  const violations = [];

  for (const path of maintainedProsePaths) {
    const markdown = await readFile(resolve(root, path), "utf8");

    for (const paragraph of proseParagraphs(markdown)) {
      if (sentenceCount(paragraph.text) < 2) continue;
      if (paragraphExceptions.has(`${path}\n${paragraph.text}`)) continue;
      violations.push(`${path}:${paragraph.line}`);
    }
  }

  assert.deepEqual(violations, []);
});

test("a writing brief binds the shared standard to one mode", async () => {
  const brief = await createWritingBrief(
    { mode: "edit" },
    { loadStandard: async () => "shared standard\n" },
  );
  assert.deepEqual(brief, {
    feature: "write",
    mode: "edit",
    response: "Change the requested target and lead with the completed result.\n\nPreserve a material ambiguity instead of silently choosing a new meaning.",
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
