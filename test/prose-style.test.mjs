import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  "docs/sweep.md",
  "docs/release.md",
  "docs/toxic-review.md",
  "docs/write.md",
  "plugins/hope/skills/align/SKILL.md",
  "plugins/hope/skills/diff/SKILL.md",
  "plugins/hope/skills/polish/SKILL.md",
  "plugins/hope/skills/sweep/SKILL.md",
  "plugins/hope/skills/settings/SKILL.md",
  "plugins/hope/skills/toxic-review/SKILL.md",
  "plugins/hope/skills/write/SKILL.md",
];

// This repository uses a stricter convention for top-level prose paragraphs
// than the shared Write standard. Structured Markdown blocks keep their native
// semantics and are outside this check. Add an exact paragraph here only when
// keeping related sentences together better serves meaning, flow, voice, or
// the target format.
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

test("maintained top-level prose follows the project paragraph convention", async () => {
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
