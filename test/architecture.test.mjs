import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

test("only Diff exposes a deterministic feature runtime", async () => {
  const featureEntries = await readdir(resolve(root, "features"), {
    withFileTypes: true,
  });
  assert.deepEqual(
    featureEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    ["diff"],
  );
  assert.equal(await exists(resolve(root, "harness")), false);
  assert.equal(await exists(resolve(root, "settings")), false);

  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skillNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(skillNames, ["align", "diff", ...instructionLedSkills.slice(1)]);

  const diffRuntime = resolve(
    root,
    "plugins/hope/runtime/features/diff/cli.mjs",
  );
  assert.equal(await exists(diffRuntime), true);
  const diff = await readFile(resolve(skillsRoot, "diff/SKILL.md"), "utf8");
  assert.match(diff, /runtime\/features\/diff\/cli\.mjs/u);

  for (const skillName of instructionLedSkills) {
    assert.equal(
      await exists(resolve(
        root,
        `plugins/hope/runtime/features/${skillName}/cli.mjs`,
      )),
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

test("Diff-only locale and generated-output boundaries stay explicit", async () => {
  const architecture = await readFile(
    resolve(root, "docs/architecture.md"),
    "utf8",
  );
  assert.match(architecture, /`features\/diff\/locales\/` contains/u);
  assert.doesNotMatch(architecture, /^├── locales\//mu);
  assert.match(architecture, /generates `plugins\/hope\/docs\/`/u);
  assert.match(architecture, /`plugins\/hope\/LICENSE`/u);
  assert.match(architecture, /`plugins\/hope\/THIRD_PARTY_NOTICES\.md`/u);
  assert.match(architecture, /Markdown copied as a raw notice or source record/u);
  assert.match(architecture, /`design\/fonts\/SOURCE\.md`/u);
  assert.match(architecture, /copied without\s+banners/su);
});

test("Toxic Review keeps its conditional causal method in a reference", async () => {
  const [toxicReview, causalReview] = await Promise.all([
    readFile(resolve(skillsRoot, "toxic-review/SKILL.md"), "utf8"),
    readFile(
      resolve(skillsRoot, "toxic-review/references/causal-review.md"),
      "utf8",
    ),
  ]);
  assert.match(toxicReview, /fresh context/u);
  assert.match(toxicReview, /references\/causal-review\.md/u);
  assert.match(toxicReview, /Accept, partly accept, reject, defer, or merge/u);
  assert.match(toxicReview, /Do not count reviewer votes/u);
  assert.match(toxicReview, /Do not create a custom model adapter/u);
  assert.match(causalReview, /^# Causal-completeness review\r?$/mu);
  assert.match(causalReview, /material causal\s+claim/u);
});

test("instruction-led Skills keep their product boundaries visible", async () => {
  const [align, polish, sweep, write] = await Promise.all([
    readFile(resolve(skillsRoot, "align/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "polish/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "sweep/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "write/SKILL.md"), "utf8"),
  ]);
  assert.match(align, /Wait for an explicit user response/u);
  assert.match(align, /Do not create HTML/u);
  assert.match(polish, /Perform at most one bounded modification round/u);
  assert.match(polish, /Do not create a private JSON run/u);
  assert.match(sweep, /Do not edit files during Sweep/u);
  assert.match(sweep, /Do not create approval records/u);
  assert.match(write, /references\/writing-standard\.md/u);
  assert.match(write, /preserve meaning, facts, uncertainty/u);
});

test("Diff keeps teaching-aid judgment in its analysis reference", async () => {
  const [diff, analysisRules, diffRuntime, teachingAids] = await Promise.all([
    readFile(resolve(skillsRoot, "diff/SKILL.md"), "utf8"),
    readFile(
      resolve(skillsRoot, "diff/references/analysis.md"),
      "utf8",
    ),
    readFile(resolve(root, "features/diff/index.mjs"), "utf8"),
    readFile(resolve(root, "features/diff/teaching-aids.mjs"), "utf8"),
  ]);
  assert.match(diff, /teaching-aid rules/u);
  assert.doesNotMatch(diff, /teaching-aid contract/u);
  assert.match(diff, /references\/analysis\.md/u);
  assert.match(diff, /microworld-skeleton/u);
  assert.doesNotMatch(diff, /Add at most one `behavior\.microworld`/u);
  assert.doesNotMatch(diff, /three to five evidence-backed questions/u);
  assert.match(analysisRules, /Keep each claim no broader than its evidence/u);
  assert.match(analysisRules, /Identify the distinct teaching job/u);
  assert.match(analysisRules, /Use `not-applicable`/u);
  assert.match(analysisRules, /Use `component-map`/u);
  assert.match(
    analysisRules,
    /Never claim that it ran\s+repository code or produced a test result/u,
  );
  assert.match(analysisRules, /128 KiB/u);
  assert.doesNotMatch(diffRuntime, /createTeachingAidContract/u);
  assert.doesNotMatch(diffRuntime, /teachingAids:\s*create/u);
  assert.match(teachingAids, /TEACHING_AID_NAMES/u);
  assert.match(teachingAids, /TEACHING_AID_DECISIONS/u);
  assert.match(teachingAids, /createMicroworldSkeleton/u);
  assert.doesNotMatch(teachingAids, /selectionOrder/u);
  assert.doesNotMatch(teachingAids, /authoring/u);
  assert.doesNotMatch(teachingAids, /distinct teaching job/u);
});

test("Diff keeps conversational invocation policy out of its runtime", async () => {
  const [diff, cli] = await Promise.all([
    readFile(resolve(skillsRoot, "diff/SKILL.md"), "utf8"),
    readFile(resolve(root, "features/diff/cli.mjs"), "utf8"),
  ]);
  assert.match(diff, /full review is plausible but ambiguous/u);
  assert.match(diff, /one short confirmation/u);
  assert.doesNotMatch(cli, /invocation-brief/u);
  assert.doesNotMatch(cli, /confirmation-create/u);
  for (const retired of [
    "invocation-evaluation.mjs",
    "invocation.mjs",
    "teaching-aid-evaluation.mjs",
  ]) {
    assert.equal(await exists(resolve(root, `features/diff/${retired}`)), false);
    assert.equal(
      await exists(resolve(
        root,
        `plugins/hope/runtime/features/diff/${retired}`,
      )),
      false,
    );
  }
});

test("project work requires Hope Write wherever clearer language helps", async () => {
  const [claudeInstructions, instructions, writingStandard] = await Promise.all([
    readFile(resolve(root, "CLAUDE.md"), "utf8"),
    readFile(resolve(root, "AGENTS.md"), "utf8"),
    readFile(
      resolve(skillsRoot, "write/references/writing-standard.md"),
      "utf8",
    ),
  ]);
  assert.match(claudeInstructions, /^# Claude Code instructions\r?\n/u);
  assert.match(claudeInstructions, /@AGENTS\.md/u);
  assert.match(instructions, /Use the Hope Write Skill whenever/u);
  assert.match(instructions, /the person's input prompt/u);
  assert.match(instructions, /intermediate updates, and final responses/u);
  assert.match(instructions, /implementation code when Write can improve/u);
  assert.match(instructions, /again before sending any response/u);
  assert.match(instructions, /If the Skill is unavailable/u);
  assert.match(writingStandard, /^# Plain writing standard\r?$/mu);
});
