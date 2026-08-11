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

test("Diff-only resources and generated-output boundaries stay explicit", async () => {
  const architecture = await readFile(
    resolve(root, "docs/architecture.md"),
    "utf8",
  );
  assert.match(architecture, /`scripts\/locales\/`/u);
  assert.doesNotMatch(architecture, /^├── locales\//mu);
  assert.match(architecture, /generates `plugins\/hope\/docs\/`/u);
  assert.match(architecture, /`plugins\/hope\/LICENSE`/u);
  assert.match(architecture, /`plugins\/hope\/THIRD_PARTY_NOTICES\.md`/u);
  assert.match(architecture, /Markdown copied as a raw notice/u);
  assert.match(architecture, /packaged directly from their editable paths/u);
  assert.match(architecture, /must not read a plugin manifest/u);
  assert.match(architecture, /Do not pre-create architectural layers/u);
  assert.match(architecture, /Markdown file at the repository root/u);
  assert.match(architecture, /definitions\s+under `docs\/`/u);
  assert.match(architecture, /one directory beside the files it governs/u);
  assert.match(architecture, /importance or file size alone/u);
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
    assert.match(instructions, /active host session/u);
    assert.doesNotMatch(
      instructions,
      /plugins\/hope|marketplace|Codex|Claude/u,
      `${skillName} behavior must use delivery-neutral host language`,
    );
  }
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

test("judgment-sensitive Skills isolate prior conversation context", async () => {
  const [diff, polish, sweep, toxicReview, architecture] = await Promise.all([
    readFile(resolve(skillsRoot, "diff/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "polish/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "sweep/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "toxic-review/SKILL.md"), "utf8"),
    readFile(resolve(root, "docs/architecture.md"), "utf8"),
  ]);

  assert.match(diff, /fresh analysis worker/u);
  assert.match(diff, /subagent with no inherited\s+conversation context/u);
  assert.match(diff, /must not inspect evidence, write analysis/u);
  assert.match(polish, /fresh worker must not inherit the conversation/u);
  assert.match(polish, /requires a fresh worker/u);
  assert.match(polish, /Do not pass previous reasoning, drafts/u);
  assert.match(
    toxicReview,
    /fresh context for every reviewer role, including a one-role review/u,
  );
  assert.match(
    toxicReview,
    /fresh context is unavailable, stop without performing the review/u,
  );
  assert.match(sweep, /Every batch inspector must use a fresh context/u);
  assert.match(
    sweep,
    /fresh contexts are unavailable, inspect sequentially in the active session/u,
  );
  assert.match(architecture, /Align and Write use the active conversation/u);
  assert.match(
    architecture,
    /When fresh context is required but unavailable,[\s\S]*stops/u,
  );
});

test("instruction-led Skills keep their product boundaries visible", async () => {
  const [align, polish, polishProduct, sweep, write] = await Promise.all([
    readFile(resolve(skillsRoot, "align/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "polish/SKILL.md"), "utf8"),
    readFile(resolve(root, "docs/polish.md"), "utf8"),
    readFile(resolve(skillsRoot, "sweep/SKILL.md"), "utf8"),
    readFile(resolve(skillsRoot, "write/SKILL.md"), "utf8"),
  ]);
  assert.match(align, /Wait for an explicit user response/u);
  assert.match(align, /Do not create HTML/u);
  assert.match(
    polish,
    /description: Use only after someone asks to polish or refine one named, completed work product/u,
  );
  assert.match(
    polish,
    /Do not use Polish to implement the work product,[\s\S]*broad restructuring/u,
  );
  assert.match(
    polish,
    /preserve existing behavior does not turn ordinary[\s\S]*into Polish/u,
  );
  assert.match(
    polishProduct,
    /Use Polish only after the work product is complete[\s\S]*asks to polish or refine it/u,
  );
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
    readFile(resolve(skillsRoot, "diff/scripts/index.mjs"), "utf8"),
    readFile(resolve(skillsRoot, "diff/scripts/teaching-aids.mjs"), "utf8"),
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
    readFile(resolve(skillsRoot, "diff/scripts/cli.mjs"), "utf8"),
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
    assert.equal(
      await exists(resolve(skillsRoot, `diff/scripts/${retired}`)),
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
