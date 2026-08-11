#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import {
  expectedPluginFile,
  normalizeLineEndings,
  pluginBuildEntries,
} from "./build-plugin.mjs";
import { pluginPackageFiles } from "./plugin-files.mjs";

const root = new URL("../", import.meta.url);
const fromRoot = (path) => new URL(path, root);
const read = async (path) => await readFile(fromRoot(path), "utf8");
const readBytes = async (path) => await readFile(fromRoot(path));
const readJson = async (path) => JSON.parse(await read(path));
const packageJson = await readJson("package.json");
const currentVersion = packageJson.version;

const requiredFiles = [
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  "AGENTS.md",
  "CHANGELOG.md",
  "CLAUDE.md",
  "assets/readme/hope-diff-behavior-en.png",
  "assets/readme/hope-diff-behavior-ko.png",
  "assets/readme/hope-diff-code-en.png",
  "assets/readme/hope-diff-code-ko.png",
  "assets/readme/hope-diff-core-en.png",
  "assets/readme/hope-diff-core-ko.png",
  "assets/readme/hope-diff-en.png",
  "assets/readme/hope-diff-evidence-en.png",
  "assets/readme/hope-diff-evidence-ko.png",
  "assets/readme/hope-diff-ko.png",
  "assets/readme/hope-diff-review-en.png",
  "assets/readme/hope-diff-review-ko.png",
  "assets/readme/hope-diff-teaching-en.png",
  "assets/readme/hope-diff-teaching-ko.png",
  "docs/align.md",
  "docs/architecture.md",
  "docs/design.md",
  "docs/diff.md",
  "docs/polish.md",
  "docs/release.md",
  "docs/sweep.md",
  "docs/toxic-review.md",
  "docs/write.md",
  "plugins/hope/skills/diff/assets/HopeFavicon.png",
  "plugins/hope/skills/diff/assets/fonts/HopeCode.woff2",
  "plugins/hope/skills/diff/assets/fonts/HopeSansBold.woff2",
  "plugins/hope/skills/diff/assets/fonts/HopeSansLight.woff2",
  "plugins/hope/skills/diff/assets/fonts/HopeSansMedium.woff2",
  "plugins/hope/skills/diff/assets/fonts/OFL-D2Coding.txt",
  "plugins/hope/skills/diff/assets/fonts/OFL-Gmarket.txt",
  "plugins/hope/skills/diff/assets/fonts/SOURCE.md",
  "plugins/hope/skills/diff/scripts/analysis-v2.schema.json",
  "plugins/hope/skills/diff/scripts/artifact.mjs",
  "plugins/hope/skills/diff/scripts/cli.mjs",
  "plugins/hope/skills/diff/scripts/code-evidence.mjs",
  "plugins/hope/skills/diff/scripts/command-options.mjs",
  "plugins/hope/skills/diff/scripts/design/tokens.mjs",
  "plugins/hope/skills/diff/scripts/index.mjs",
  "plugins/hope/skills/diff/scripts/locales/index.mjs",
  "plugins/hope/skills/diff/scripts/structured-input.mjs",
  "tools/plugin-files.mjs",
  "tools/plugin-package-files.txt",
  "tools/check-plugin-version.mjs",
  "tools/install-plugin-dev.mjs",
  "tools/entrypoint.mjs",
  "tools/prepare-release.mjs",
  "tools/rename-diff-fonts.py",
  "tools/render-readme-assets.mjs",
  "tools/stage-plugin.mjs",
  "PRINCIPLES.md",
  "README.md",
  "README.ko.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "LICENSE",
];

const retiredPaths = [
  "DESIGN.md",
  "assets/readme/hope-align-en.png",
  "assets/readme/hope-align-ko.png",
  "assets/readme/hope-align-preview-en.png",
  "assets/readme/hope-align-preview-ko.png",
  "assets/readme/hope-align-scope-en.png",
  "assets/readme/hope-align-scope-ko.png",
  "assets/readme/hope-align-understanding-en.png",
  "assets/readme/hope-align-understanding-ko.png",
  "assets/readme/hope-align-work-en.png",
  "assets/readme/hope-align-work-ko.png",
  "docs/design-research.md",
  "docs/model-evaluation.md",
  "design",
  "e2e/align-artifact.spec.mjs",
  "entrypoint",
  "features",
  "features/align",
  "features/artifact",
  "features/command-options",
  "features/diff/analysis-v1.schema.json",
  "features/diff/highlight.mjs",
  "features/diff/invocation-evaluation.mjs",
  "features/diff/invocation.mjs",
  "features/diff/teaching-aid-evaluation.mjs",
  "features/diff/work-snapshot.mjs",
  "features/model-evaluation",
  "features/polish",
  "features/record-compat",
  "features/result-validation",
  "features/sweep",
  "features/toxic-review",
  "features/work-snapshot",
  "features/write",
  "harness",
  "locales",
  "plugins/hope/agents/toxic-reviewer.md",
  "plugins/hope/runtime/cleanup",
  "plugins/hope/runtime/diff",
  "plugins/hope/runtime/features/align",
  "plugins/hope/runtime/features/artifact",
  "plugins/hope/runtime/features/command-options",
  "plugins/hope/runtime/features/diff/analysis-v1.schema.json",
  "plugins/hope/runtime/features/diff/highlight.mjs",
  "plugins/hope/runtime/features/diff/invocation-evaluation.mjs",
  "plugins/hope/runtime/features/diff/invocation.mjs",
  "plugins/hope/runtime/features/diff/teaching-aid-evaluation.mjs",
  "plugins/hope/runtime/features/diff/work-snapshot.mjs",
  "plugins/hope/runtime/features/model-evaluation",
  "plugins/hope/runtime/features/polish",
  "plugins/hope/runtime/features/record-compat",
  "plugins/hope/runtime/features/result-validation",
  "plugins/hope/runtime/features/sweep",
  "plugins/hope/runtime/features/toxic-review",
  "plugins/hope/runtime/features/work-snapshot",
  "plugins/hope/runtime/features/write",
  "plugins/hope/runtime/locales",
  "plugins/hope/runtime/settings",
  "plugins/hope/runtime",
  "plugins/hope/skills/cleanup",
  "plugins/hope/skills/diff/references/change-request-v1.schema.json",
  "plugins/hope/skills/diff/references/review-model-v1.schema.json",
  "plugins/hope/skills/settings",
  "plugins/hope/skills/write/references/plain-writing.md",
  "settings",
  "tools/next-release-version.mjs",
  "tools/run-sweep-model-evaluation.mjs",
];

await Promise.all([
  ...requiredFiles,
  ...pluginPackageFiles.map((path) => `plugins/hope/${path}`),
].map(async (path) => await access(fromRoot(path))));
await Promise.all(retiredPaths.map(async (path) => {
  await assert.rejects(access(fromRoot(path)), undefined, `${path} must not ship`);
}));

for (const entry of pluginBuildEntries) {
  const expected = await expectedPluginFile(entry);
  const actual = await readBytes(entry.destination);
  if (Buffer.isBuffer(expected)) {
    assert.deepEqual(
      actual,
      expected,
      `${entry.destination} must be rebuilt from ${entry.source}`,
    );
  } else {
    assert.equal(
      actual.toString("utf8").replace(/\r\n?/gu, "\n"),
      expected,
      `${entry.destination} must be rebuilt from ${entry.source}`,
    );
  }
}

const [
  codexPlugin,
  claudePlugin,
  codexMarketplace,
  claudeMarketplace,
  alignSkill,
  skill,
  toxicReviewSkill,
  writeSkill,
  writingStandard,
  architecture,
  align,
  diff,
  toxicReview,
  write,
  releaseDefinition,
  changelog,
  release,
  verify,
  packageLock,
  readme,
  readmeKo,
  agentInstructions,
  claudeInstructions,
] =
  await Promise.all([
    readJson("plugins/hope/.codex-plugin/plugin.json"),
    readJson("plugins/hope/.claude-plugin/plugin.json"),
    readJson(".agents/plugins/marketplace.json"),
    readJson(".claude-plugin/marketplace.json"),
    read("plugins/hope/skills/align/SKILL.md"),
    read("plugins/hope/skills/diff/SKILL.md"),
    read("plugins/hope/skills/toxic-review/SKILL.md"),
    read("plugins/hope/skills/write/SKILL.md"),
    read("plugins/hope/skills/write/references/writing-standard.md"),
    read("docs/architecture.md"),
    read("docs/align.md"),
    read("docs/diff.md"),
    read("docs/toxic-review.md"),
    read("docs/write.md"),
    read("docs/release.md"),
    read("CHANGELOG.md"),
    read(".github/workflows/release.yml"),
    read(".github/workflows/verify.yml"),
    readJson("package-lock.json"),
    read("README.md"),
    read("README.ko.md"),
    read("AGENTS.md"),
    read("CLAUDE.md"),
  ]);

assert.equal(packageJson.version, currentVersion);
assert.equal(packageLock.version, currentVersion);
assert.equal(packageLock.packages[""].version, currentVersion);
assert.equal(packageJson.bin, undefined);
assert.equal(packageJson.scripts.hope, undefined);
assert.equal(codexPlugin.name, "hope");
assert.equal(codexPlugin.version, currentVersion);
assert.equal(codexPlugin.interface.defaultPrompt.length, 3);
assert.equal(claudePlugin.name, "hope");
assert.equal(claudePlugin.version, currentVersion);
if (process.env.GITHUB_REF_TYPE === "tag") {
  assert.equal(process.env.GITHUB_REF_NAME, `v${currentVersion}`);
}
assert.equal(codexPlugin.skills, "./skills/");
assert.equal(claudePlugin.skills, "./skills/");
assert.equal(
  codexPlugin.interface.composerIcon,
  "./skills/diff/assets/HopeFavicon.png",
);
assert.equal(
  codexPlugin.interface.logo,
  "./assets/hope-protected-light.png",
);
assert.ok(codexMarketplace.plugins.some(
  (entry) => entry.name === "hope" && entry.source.path === "./plugins/hope",
));
const claudeMarketplaceEntry = claudeMarketplace.plugins.find(
  (entry) => entry.name === "hope",
);
assert.equal(claudeMarketplaceEntry.source, "./plugins/hope");
assert.equal(claudeMarketplaceEntry.version, undefined);
assert.doesNotMatch(claudeMarketplaceEntry.description, /rebuild status/u);
assert.match(alignSkill, /^---\r?\nname: align\r?\ndescription: /u);
assert.match(alignSkill, /Wait for an explicit user response/u);
assert.doesNotMatch(alignSkill, /runtime\/features\//u);
assert.match(skill, /^---\r?\nname: diff\r?\ndescription: /u);
assert.match(skill, /skills\/diff\/scripts\/cli\.mjs/u);
assert.match(skill, /\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/diff\/scripts\/cli\.mjs/u);
assert.match(skill, /<skill-dir>\/scripts\/cli\.mjs/u);
assert.doesNotMatch(skill, /runtime\/features\//u);
assert.match(skill, /references\/analysis\.md/u);
assert.match(skill, /\.\.\/write\/references\/writing-standard\.md/u);
assert.match(skill, /teaching-aid rules/u);
assert.doesNotMatch(skill, /teaching-aid contract/u);
assert.match(skill, /microworld-skeleton/u);
assert.doesNotMatch(skill, /Add at most one `behavior\.microworld`/u);
assert.doesNotMatch(skill, /Prefer a short, familiar word/u);
assert.match(
  toxicReviewSkill,
  /^---\r?\nname: toxic-review\r?\ndescription: /u,
);
assert.match(toxicReviewSkill, /references\/causal-review\.md/u);
assert.match(toxicReviewSkill, /Do not count reviewer votes/u);
assert.doesNotMatch(toxicReviewSkill, /runtime\/features\//u);
assert.match(writeSkill, /^---\r?\nname: write\r?\ndescription: /u);
assert.match(writeSkill, /references\/writing-standard\.md/u);
assert.doesNotMatch(writeSkill, /runtime\/features\//u);
assert.doesNotMatch(writeSkill, /Prefer a short, familiar word/u);
assert.match(writingStandard, /^# Plain writing standard\r?\n/u);
assert.match(writingStandard, /Politics and the English Language/u);
assert.match(architecture, /\.codex-plugin\/plugin\.json/u);
assert.match(architecture, /\.claude-plugin\/plugin\.json/u);
assert.match(align, /^# Hope Align\r?\n/u);
assert.match(align, /explicit approval/u);
assert.match(diff, /^# Hope Diff\r?\n/u);
assert.match(diff, /Use the conversation language/u);
assert.match(toxicReview, /^# Hope Toxic Review\r?\n/u);
assert.match(toxicReview, /Do not count reviewer votes/u);
assert.match(write, /^# Hope Write\r?\n/u);
assert.match(write, /Write feature's[\s\S]*references\/writing-standard\.md/u);
assert.match(write, /They do not need a runtime brief/u);
assert.match(releaseDefinition, /^# Hope releases\r?$/mu);
assert.match(releaseDefinition, /Conventional Commit/u);
assert.match(releaseDefinition, /`BREAKING CHANGE` footer selects major/u);
assert.match(releaseDefinition, /`feat` selects minor/u);
assert.match(releaseDefinition, /every other commit selects patch/u);
assert.match(releaseDefinition, /promotes `Unreleased`/u);
assert.match(
  releaseDefinition,
  /person starting the run does not choose a version or increase type/u,
);
assert.match(
  changelog,
  new RegExp(
    `^## ${currentVersion.replaceAll(".", "\\.")} - \\d{4}-\\d{2}-\\d{2}$`,
    "mu",
  ),
);
assert.match(agentInstructions, /Use the Hope Write Skill whenever/u);
assert.match(agentInstructions, /again before sending any response/u);
assert.match(claudeInstructions, /@AGENTS\.md/u);
assert.match(release, /npm run release:prepare/u);
assert.doesNotMatch(release, /run: npm run check\s*$/mu);
assert.match(release, /workflow_dispatch/u);
assert.match(release, /push:\s+branches:\s+- main/su);
assert.match(release, /publish=\$\{PUBLISH\}/u);
assert.match(
  release,
  /github\.event_name == 'workflow_dispatch' && 'main' \|\| github\.sha/u,
);
assert.match(release, /MODE=increment/u);
assert.match(release, /BASE_TAG="\$\{CURRENT_TAG\}"/u);
assert.match(release, /npm run release:prepare -- --automatic "\$\{BASE_TAG\}"/u);
assert.doesNotMatch(release, /workflow_dispatch:\s+inputs:/su);
assert.match(release, /echo "current-version=\$\{CURRENT_VERSION\}"/u);
assert.match(release, /echo "version=\$\{RELEASE_VERSION\}"/u);
assert.match(release, /gh release view/u);
assert.match(release, /git checkout --detach/u);
assert.match(release, /git rev-parse HEAD\)" = "\$\{EVENT_SHA\}"/u);
assert.match(release, /git push --atomic origin HEAD:main/u);
assert.doesNotMatch(release, /--prerelease/u);
assert.match(release, /npx playwright install --with-deps chromium/u);
assert.match(release, /npm run test:browser/u);
assert.match(release, /fetch-depth: 0/u);
assert.match(release, /test "\$\{GITHUB_REF\}" = "refs\/heads\/main"/u);
assert.match(
  release,
  /git diff --exit-code -- plugins\/hope tools\/plugin-package-files\.txt/u,
);
assert.match(
  release,
  /git add CHANGELOG\.md [^\n]*tools\/plugin-package-files\.txt/u,
);
assert.match(release, /node tools\/stage-plugin\.mjs/u);
assert.match(release, /diff -u tools\/plugin-package-files\.txt/u);
assert.match(release, /unzip -p [^\n]* \.claude-plugin\/plugin\.json/u);
assert.match(release, /unzip -p [^\n]* \.codex-plugin\/plugin\.json/u);
assert.match(release, /unzip -p [^\n]* skills\/write\/SKILL\.md/u);
assert.match(
  release,
  /unzip -p [^\n]* skills\/write\/references\/writing-standard\.md/u,
);
assert.match(release, /--generate-notes/u);
assert.match(release, /--fail-on-no-commits/u);
assert.match(release, /--latest/u);
assert.match(verify, /name: Verify/u);
assert.equal((verify.match(/fetch-depth: 0/gu) ?? []).length, 3);
assert.match(verify, /needs: \[check, platform-smoke, browser\]/u);
assert.match(verify, /CHECK_RESULT: \$\{\{ needs\.check\.result \}\}/u);
assert.match(
  verify,
  /PLATFORM_SMOKE_RESULT: \$\{\{ needs\.platform-smoke\.result \}\}/u,
);
assert.match(verify, /BROWSER_RESULT: \$\{\{ needs\.browser\.result \}\}/u);
assert.match(verify, /npm run test:browser/u);
assert.match(readme, /src="plugins\/hope\/assets\/hope-protected-light\.png"/u);
assert.match(readmeKo, /src="plugins\/hope\/assets\/hope-protected-light\.png"/u);
for (const [file, text] of [
  ["README.md", readme],
  ["README.ko.md", readmeKo],
]) {
  const locale = file === "README.md" ? "en" : "ko";
  assert.match(text, /https:\/\/github\.com\/dkstm95\/hope/u);
  assert.match(text, /img\.shields\.io\/badge\/Codex-supported-/u);
  assert.match(text, /img\.shields\.io\/badge\/Claude_Code-supported-/u);
  assert.match(text, /logo=claudecode/u);
  assert.match(text, /codex plugin marketplace add dkstm95\/hope/u);
  assert.match(text, /codex plugin marketplace upgrade hope/u);
  assert.match(text, /codex plugin add hope@hope/u);
  assert.match(text, /claude plugin marketplace add dkstm95\/hope/u);
  assert.match(text, /\/reload-plugins/u);
  assert.doesNotMatch(text, /\$hope:|```mermaid/iu);
  for (const asset of [
    "diff",
    "diff-core",
    "diff-behavior",
    "diff-teaching",
    "diff-code",
    "diff-review",
    "diff-evidence",
  ]) {
    assert.match(
      text,
      new RegExp(`assets/readme/hope-${asset}-${locale}\\.png`, "u"),
      `${file} must show the ${asset} artifact image`,
    );
  }
  assert.doesNotMatch(
    text,
    /assets\/readme\/hope-(?:align|toxic-review|polish|write|settings)-/u,
  );
}
assert.equal(packageJson.scripts["check:plugin-version"], "node tools/check-plugin-version.mjs");
assert.equal(packageJson.scripts["plugin:dev:install"], "node tools/install-plugin-dev.mjs");
assert.equal(
  packageJson.scripts["render:readme-assets"],
  "node tools/render-readme-assets.mjs",
);
assert.match(packageJson.scripts.check, /check:plugin-version/u);
assert.equal(
  normalizeLineEndings(await read("tools/plugin-package-files.txt")),
  `${pluginPackageFiles.join("\n")}\n`,
);

console.log(`Hope ${currentVersion} package structure is consistent.`);
