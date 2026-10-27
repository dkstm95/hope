import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  CODE_THEME,
  COLORS as DIFF_COLORS,
  LAYOUT as DIFF_LAYOUT,
  SPACE as DIFF_SPACE,
  TYPE as DIFF_TYPE,
} from "../plugins/hope/skills/diff/scripts/design/tokens.mjs";

const plugin = new URL("../plugins/hope/", import.meta.url);
const stylesheets = [
  "assets/artifact-shell/shell.css",
  "skills/align/scripts/design/align.css",
  "skills/diff/scripts/design/diff.css",
  "skills/diff/scripts/reader/style.css",
];
const clientScripts = [
  "assets/artifact-shell/client.mjs",
  "skills/diff/scripts/reader/client.mjs",
];

function luminance(hex) {
  const [red, green, blue] = hex.match(/[\dA-F]{2}/giu).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test("Align and Diff render from the one shared token source", () => {
  for (const theme of ["light", "dark"]) {
    assert.deepEqual(ALIGN_COLORS[theme], ARTIFACT_COLORS[theme]);
    for (const [role, value] of Object.entries(ARTIFACT_COLORS[theme])) {
      assert.equal(DIFF_COLORS[theme][role], value, `${theme}.${role}`);
    }
  }
  assert.strictEqual(ALIGN_SPACE, ARTIFACT_SPACE);
  assert.strictEqual(DIFF_SPACE, ARTIFACT_SPACE);
  assert.strictEqual(ALIGN_TYPE, ARTIFACT_TYPE);
  assert.strictEqual(DIFF_TYPE, ARTIFACT_TYPE);
  assert.strictEqual(ALIGN_LAYOUT, ARTIFACT_LAYOUT);
  assert.strictEqual(DIFF_LAYOUT, ARTIFACT_LAYOUT);
});

test("text and component colors meet WCAG 2.2 AA on every surface in both themes", () => {
  const surfaces = ["background", "panel", "rail", "accentSoft"];
  const text = ["text", "muted", "accent", "link", "visited"];
  const status = ["decide", "resolve", "scope", "verify"];
  const failures = [];
  for (const theme of ["light", "dark"]) {
    const colors = DIFF_COLORS[theme];
    for (const surface of surfaces) {
      for (const role of [...text, ...status]) {
        const ratio = contrast(colors[role], colors[surface]);
        if (ratio < 4.5) failures.push(`${theme} ${role} on ${surface}: ${ratio.toFixed(2)}`);
      }
      const boundary = contrast(colors.componentBorder, colors[surface]);
      if (boundary < 3) failures.push(`${theme} componentBorder on ${surface}: ${boundary.toFixed(2)}`);
    }
    // Selected controls and the current index entry put the panel color on accent.
    if (contrast(colors.panel, colors.accent) < 4.5) failures.push(`${theme} panel on accent`);
    const code = CODE_THEME[theme];
    for (const background of ["background", "addedBackground", "removedBackground", "hunkBackground"]) {
      const ratio = contrast(code.foreground, code[background]);
      if (ratio < 4.5) failures.push(`${theme} code on ${background}: ${ratio.toFixed(2)}`);
    }
    for (const mark of ["addedMark", "removedMark"]) {
      const ratio = contrast(code[mark], code.background);
      if (ratio < 3) failures.push(`${theme} code ${mark}: ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("stylesheet and client breakpoints use the shared layout values", async () => {
  const allowed = new Set([
    ARTIFACT_LAYOUT.compactBreakpoint,
    ARTIFACT_LAYOUT.narrowBreakpoint,
    ARTIFACT_LAYOUT.railBreakpoint,
  ]);
  const found = [];
  for (const path of [...stylesheets, ...clientScripts]) {
    const source = await readFile(new URL(path, plugin), "utf8");
    for (const match of source.matchAll(/\((?:max|min)-width:\s*(\d+)px\)/gu)) {
      const value = Number(match[1]);
      // A min-width query starts one pixel above a shared max-width breakpoint.
      const breakpoint = match[0].startsWith("(min") ? value - 1 : value;
      found.push([path, breakpoint]);
    }
    for (const match of source.matchAll(/innerWidth\s*<\s*(\d+)/gu)) {
      found.push([path, Number(match[1])]);
    }
  }
  assert.ok(found.length > 0);
  assert.deepEqual(found.filter(([, value]) => !allowed.has(value)), []);
});
