import assert from "node:assert/strict";
import test from "node:test";

import {
  ARTIFACT_COLORS,
  ARTIFACT_LAYOUT,
  ARTIFACT_SPACE,
  ARTIFACT_TYPE,
} from "../plugins/hope/assets/artifact-theme.mjs";

import {
  COLORS as ALIGN_COLORS,
  LAYOUT as ALIGN_LAYOUT,
  SPACE as ALIGN_SPACE,
  TYPE as ALIGN_TYPE,
} from "../plugins/hope/skills/align/scripts/design/tokens.mjs";
import {
  COLORS as DIFF_COLORS,
  LAYOUT as DIFF_LAYOUT,
  SPACE as DIFF_SPACE,
  TYPE as DIFF_TYPE,
} from "../plugins/hope/skills/diff/scripts/design/tokens.mjs";

test("Align and Diff share the agreed artifact visual baseline", () => {
  const sharedColors = [
    "accent",
    "background",
    "border",
    "componentBorder",
    "link",
    "muted",
    "panel",
    "text",
    "visited",
  ];
  for (const theme of ["light", "dark"]) {
    assert.deepEqual(ALIGN_COLORS[theme], ARTIFACT_COLORS[theme]);
    assert.deepEqual(
      Object.fromEntries(sharedColors.map((key) => [key, DIFF_COLORS[theme][key]])),
      Object.fromEntries(sharedColors.map((key) => [key, ALIGN_COLORS[theme][key]])),
    );
  }

  assert.deepEqual(DIFF_SPACE, ALIGN_SPACE);
  assert.strictEqual(ALIGN_SPACE, ARTIFACT_SPACE);
  for (const role of [
    "brand",
    "body",
    "menu",
    "micro",
    "pageTitle",
    "sectionTitle",
    "supporting",
    "subsectionTitle",
  ]) {
    assert.deepEqual(DIFF_TYPE[role], ALIGN_TYPE[role]);
    assert.deepEqual(ALIGN_TYPE[role], ARTIFACT_TYPE[role]);
  }
  for (const role of [
    "compactBreakpoint",
    "documentWidth",
    "narrowBreakpoint",
    "proseWidth",
    "tableOfContentsWidth",
    "tocBreakpoint",
    "topbarHeight",
    "topbarInnerHeight",
    "topbarWideGutter",
  ]) {
    assert.equal(DIFF_LAYOUT[role], ALIGN_LAYOUT[role]);
    assert.equal(ALIGN_LAYOUT[role], ARTIFACT_LAYOUT[role]);
  }
});
