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

test("Toxic Review leaves normative rules in its runtime brief", async () => {
  const toxicReview = await readFile(
    resolve(skillsRoot, "toxic-review", "SKILL.md"),
    "utf8",
  );
  assert.match(
    toxicReview,
    /`roleSelection`.*`adjudication`.*`resultPreparation`/su,
  );
  assert.match(toxicReview, /`causalCompleteness`/u);
  assert.match(toxicReview, /`causalCompleteness\.activation`/u);
  assert.match(toxicReview, /`evaluation-plan`/u);
  assert.match(toxicReview, /`evaluation-prepare`/u);
  assert.match(toxicReview, /`evaluation-receipt`/u);
  assert.match(toxicReview, /`evaluation-validate-set`/u);
  assert.match(toxicReview, /`stopping`.*`finalVoice`/su);
  assert.doesNotMatch(toxicReview, /one to six roles/u);
  assert.doesNotMatch(toxicReview, /partially-accepted/u);
  assert.doesNotMatch(toxicReview, /critical-path-ablation/u);
});

test("Align leaves normative rules in its runtime brief", async () => {
  const align = await readFile(
    resolve(skillsRoot, "align", "SKILL.md"),
    "utf8",
  );
  assert.match(align, /`snapshot`.*`interview`.*`state`.*`polishing`/su);
  assert.match(align, /`approval`.*`lifecycle`/su);
  assert.match(align, /runtime\/features\/polish\/cli\.mjs/u);
  assert.doesNotMatch(align, /Do not repeat a closed question/u);
  assert.doesNotMatch(align, /Medium- and high-risk tasks activate/u);
});

test("Diff leaves teaching-aid decisions in its runtime contract", async () => {
  const [diff, teachingAids] = await Promise.all([
    readFile(resolve(skillsRoot, "diff", "SKILL.md"), "utf8"),
    readFile(resolve(root, "features", "diff", "teaching-aids.mjs"), "utf8"),
  ]);
  assert.match(diff, /`teachingAids`/u);
  assert.match(diff, /microworld-skeleton/u);
  assert.doesNotMatch(diff, /Add at most one `behavior\.microworld`/u);
  assert.doesNotMatch(diff, /three to five evidence-backed questions/u);
  assert.match(teachingAids, /selectionOrder/u);
  assert.match(teachingAids, /TEACHING_AID_DECISIONS/u);
  assert.match(teachingAids, /authoring/u);
  assert.match(teachingAids, /Never claim.*ran repository code.*test result/u);
});

test("project work requires Hope Write wherever clearer language helps", async () => {
  const [claudeInstructions, instructions] = await Promise.all([
    readFile(resolve(root, "CLAUDE.md"), "utf8"),
    readFile(resolve(root, "AGENTS.md"), "utf8"),
  ]);
  assert.match(claudeInstructions, /^# Claude Code instructions\r?\n/u);
  assert.match(claudeInstructions, /@AGENTS\.md/u);
  assert.match(instructions, /Use the Hope Write Skill whenever/u);
  assert.match(instructions, /the person's input prompt/u);
  assert.match(instructions, /intermediate updates, and final responses/u);
  assert.match(instructions, /implementation code when Write can improve/u);
  assert.match(instructions, /again before sending any response/u);
  assert.match(instructions, /If the Skill is unavailable/u);
});
