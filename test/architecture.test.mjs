import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = resolve(root, "plugins/hope/skills");
const instructionLedSkills = Object.freeze([
  "polish",
  "sweep",
  "toxic-review",
  "write",
]);

async function exists(path) {
  return await access(path).then(() => true, () => false);
}

test("each feature has one editable Skill boundary", async () => {
  assert.equal(await exists(resolve(root, "features")), false);
  assert.equal(await exists(resolve(root, "design")), false);
  assert.equal(await exists(resolve(root, "plugins/hope/runtime")), false);
  assert.equal(await exists(resolve(root, "harness")), false);
  assert.equal(await exists(resolve(root, "settings")), false);

  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skillNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(skillNames, ["align", "diff", ...instructionLedSkills]);

  const alignScript = resolve(skillsRoot, "align/scripts/cli.mjs");
  const diffScript = resolve(skillsRoot, "diff/scripts/cli.mjs");
  assert.equal(await exists(alignScript), true);
  assert.equal(await exists(diffScript), true);
  const align = await readFile(resolve(skillsRoot, "align/SKILL.md"), "utf8");
  const diff = await readFile(resolve(skillsRoot, "diff/SKILL.md"), "utf8");
  assert.match(align, /scripts\/cli\.mjs/u);
  assert.match(diff, /scripts\/cli\.mjs/u);
  assert.doesNotMatch(align, /runtime\/features\//u);
  assert.doesNotMatch(diff, /runtime\/features\//u);

  for (const skillName of instructionLedSkills) {
    assert.equal(
      await exists(resolve(skillsRoot, skillName, "scripts")),
      false,
      `${skillName} must remain instruction-led`,
    );
    const instructions = await readFile(
      resolve(skillsRoot, skillName, "SKILL.md"),
      "utf8",
    );
    assert.doesNotMatch(
      instructions,
      /runtime\/features\//u,
      `${skillName} must not call a private feature runtime`,
    );
  }
});

test("feature scripts depend only on their owning Skill", async () => {
  for (const skillName of ["align", "diff"]) {
    const featureRoot = resolve(skillsRoot, skillName);
    const pending = [resolve(featureRoot, "scripts")];
    const scripts = [];
    while (pending.length > 0) {
      const directory = pending.pop();
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        if (entry.isFile() && entry.name.endsWith(".mjs")) scripts.push(path);
      }
    }

    for (const path of scripts) {
      const source = await readFile(path, "utf8");
      assert.doesNotMatch(
        source,
        /(?:CLAUDE_)?PLUGIN_ROOT|plugins\/hope|runtime\/features/u,
        `${relative(root, path)} must stay independent of plugin packaging`,
      );
      for (const match of source.matchAll(
        /(?:from\s+|import\()\s*["'](\.\.?\/[^"']+)["']/gu,
      )) {
        const dependency = resolve(dirname(path), match[1]);
        const fromFeature = relative(featureRoot, dependency);
        const insideFeature = !isAbsolute(fromFeature)
          && fromFeature !== ".."
          && !fromFeature.startsWith(`..${sep}`);
        assert.equal(
          insideFeature,
          true,
          `${relative(root, path)} imports outside its Skill: ${match[1]}`,
        );
      }
    }
  }

  const [alignRender, diffRender] = await Promise.all([
    readFile(resolve(skillsRoot, "align/scripts/render.mjs"), "utf8"),
    readFile(resolve(skillsRoot, "diff/scripts/render.mjs"), "utf8"),
  ]);
  assert.match(alignRender, /\.\/design\/tokens\.mjs/u);
  assert.match(diffRender, /\.\/design\/tokens\.mjs/u);
  assert.doesNotMatch(alignRender, /skills\/diff|shared\/visual/u);
  assert.doesNotMatch(diffRender, /skills\/align|shared\/visual/u);
});

test("instruction-led feature guidance stays delivery-neutral", async () => {
  for (const skillName of instructionLedSkills) {
    const instructions = await readFile(
      resolve(skillsRoot, skillName, "SKILL.md"),
      "utf8",
    );
    assert.doesNotMatch(
      instructions,
      /plugins\/hope|marketplace|Codex|Claude/u,
      `${skillName} behavior must use delivery-neutral host language`,
    );
  }
});
