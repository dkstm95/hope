import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = resolve(root, "plugins/hope/skills");

async function exists(path) {
  return await access(path).then(() => true, () => false);
}

test("every public Skill reaches shared runtime", async () => {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skills = entries.filter((entry) => entry.isDirectory());
  assert.ok(skills.length > 0);

  for (const skill of skills) {
    const featureRuntime = resolve(
      root,
      `plugins/hope/runtime/features/${skill.name}/cli.mjs`,
    );
    const sharedRuntime = resolve(
      root,
      `plugins/hope/runtime/${skill.name}/cli.mjs`,
    );
    const runtime = await exists(featureRuntime)
      ? featureRuntime
      : await exists(sharedRuntime)
        ? sharedRuntime
        : undefined;
    assert.ok(runtime, `${skill.name} must reach shared plugin runtime`);

    const instructions = await readFile(
      resolve(skillsRoot, skill.name, "SKILL.md"),
      "utf8",
    );
    const runtimePath = relative(resolve(root, "plugins/hope"), runtime)
      .split("\\")
      .join("/");
    assert.match(
      instructions,
      new RegExp(runtimePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      `${skill.name} must call its shared runtime`,
    );
  }
});
