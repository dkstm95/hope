import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = resolve(root, "plugins/hope/skills");
const instructionLedSkills = Object.freeze([
  "align",
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
  assert.deepEqual(skillNames, ["align", "diff", ...instructionLedSkills.slice(1)]);

  const diffScript = resolve(skillsRoot, "diff/scripts/cli.mjs");
  assert.equal(await exists(diffScript), true);
  const diff = await readFile(resolve(skillsRoot, "diff/SKILL.md"), "utf8");
  assert.match(diff, /scripts\/cli\.mjs/u);
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

test("Diff scripts do not depend on the plugin package boundary", async () => {
  const diffRoot = resolve(skillsRoot, "diff");
  const scriptsRoot = resolve(diffRoot, "scripts");
  const pending = [scriptsRoot];
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
      const fromDiff = relative(diffRoot, dependency);
      assert.equal(
        isAbsolute(fromDiff)
          || fromDiff === ".."
          || fromDiff.startsWith(`..${sep}`),
        false,
        `${relative(root, path)} imports outside its Skill: ${match[1]}`,
      );
    }
  }
});

test("feature definitions stay independent of delivery adapters", async () => {
  const featureDocuments = [
    "align",
    "diff",
    "polish",
    "sweep",
    "toxic-review",
    "write",
  ];

  for (const featureName of featureDocuments) {
    const definition = await readFile(
      resolve(root, `docs/${featureName}.md`),
      "utf8",
    );
    assert.doesNotMatch(
      definition,
      /plugins\/hope|marketplace|Codex|Claude/u,
      `${featureName} product behavior must not depend on a delivery adapter`,
    );
  }

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
