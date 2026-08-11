const generatedText = (source, destination, banner = "") => Object.freeze({
  banner,
  binary: false,
  destination,
  source,
});

const generatedBinary = (source, destination) => Object.freeze({
  banner: "",
  binary: true,
  destination,
  source,
});

export const generatedPluginFiles = Object.freeze([
  generatedText("LICENSE", "plugins/hope/LICENSE"),
  generatedText(
    "THIRD_PARTY_NOTICES.md",
    "plugins/hope/THIRD_PARTY_NOTICES.md",
  ),
  generatedText(
    "docs/align.md",
    "plugins/hope/docs/align.md",
    "<!-- Generated from docs/align.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "docs/design.md",
    "plugins/hope/docs/design.md",
    "<!-- Generated from docs/design.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "docs/diff.md",
    "plugins/hope/docs/diff.md",
    "<!-- Generated from docs/diff.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "docs/polish.md",
    "plugins/hope/docs/polish.md",
    "<!-- Generated from docs/polish.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "docs/sweep.md",
    "plugins/hope/docs/sweep.md",
    "<!-- Generated from docs/sweep.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "docs/toxic-review.md",
    "plugins/hope/docs/toxic-review.md",
    "<!-- Generated from docs/toxic-review.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "docs/write.md",
    "plugins/hope/docs/write.md",
    "<!-- Generated from docs/write.md. Do not edit. -->\n\n",
  ),
  generatedText(
    "design/fonts/OFL-D2Coding.txt",
    "plugins/hope/runtime/design/fonts/OFL-D2Coding.txt",
  ),
  generatedText(
    "design/fonts/OFL-Gmarket.txt",
    "plugins/hope/runtime/design/fonts/OFL-Gmarket.txt",
  ),
  generatedText(
    "design/fonts/SOURCE.md",
    "plugins/hope/runtime/design/fonts/SOURCE.md",
  ),
  generatedBinary(
    "design/HopeFavicon.png",
    "plugins/hope/assets/hope-protected-light-128.png",
  ),
  generatedBinary(
    "design/HopeFavicon.png",
    "plugins/hope/runtime/design/HopeFavicon.png",
  ),
  generatedBinary(
    "design/fonts/HopeCode.woff2",
    "plugins/hope/runtime/design/fonts/HopeCode.woff2",
  ),
  generatedBinary(
    "design/fonts/HopeSansBold.woff2",
    "plugins/hope/runtime/design/fonts/HopeSansBold.woff2",
  ),
  generatedBinary(
    "design/fonts/HopeSansLight.woff2",
    "plugins/hope/runtime/design/fonts/HopeSansLight.woff2",
  ),
  generatedBinary(
    "design/fonts/HopeSansMedium.woff2",
    "plugins/hope/runtime/design/fonts/HopeSansMedium.woff2",
  ),
  generatedText(
    "design/tokens.mjs",
    "plugins/hope/runtime/design/tokens.mjs",
    "// Generated from design/tokens.mjs. Do not edit.\n",
  ),
  generatedText(
    "entrypoint/index.mjs",
    "plugins/hope/runtime/entrypoint/index.mjs",
    "// Generated from entrypoint/index.mjs. Do not edit.\n",
  ),
  ...[
    "analysis-v2.schema.json",
    "artifact.mjs",
    "checkpoint-v1.schema.json",
    "checkpoint-window-v1.schema.json",
    "checkpoint.mjs",
    "cli.mjs",
    "code-evidence.mjs",
    "command-options.mjs",
    "constants.mjs",
    "context.mjs",
    "derive.mjs",
    "finalize.mjs",
    "github.mjs",
    "hash.mjs",
    "index.mjs",
    "redact.mjs",
    "render.mjs",
    "run.mjs",
    "target.mjs",
    "teaching-aids.mjs",
    "text.mjs",
    "validate.mjs",
    "structured-input.mjs",
  ].map((name) => generatedText(
    `features/diff/${name}`,
    `plugins/hope/runtime/features/diff/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/diff/${name}. Do not edit.\n`
      : "",
  )),
  generatedText(
    "features/diff/locales/index.mjs",
    "plugins/hope/runtime/features/diff/locales/index.mjs",
    "// Generated from features/diff/locales/index.mjs. Do not edit.\n",
  ),
  ...["en-US", "ko-KR"].flatMap((locale) => ["common", "diff"].map(
    (name) => generatedText(
      `features/diff/locales/${locale}/${name}.json`,
      `plugins/hope/runtime/features/diff/locales/${locale}/${name}.json`,
    ),
  )),
]);

export const staticPluginFiles = Object.freeze([
  "plugins/hope/.claude-plugin/plugin.json",
  "plugins/hope/.codex-plugin/plugin.json",
  "plugins/hope/assets/hope-protected-light.png",
  "plugins/hope/skills/align/SKILL.md",
  "plugins/hope/skills/align/agents/openai.yaml",
  "plugins/hope/skills/diff/SKILL.md",
  "plugins/hope/skills/diff/agents/openai.yaml",
  "plugins/hope/skills/diff/assets/hope-protected-light.png",
  "plugins/hope/skills/diff/references/analysis.md",
  "plugins/hope/skills/polish/SKILL.md",
  "plugins/hope/skills/polish/agents/openai.yaml",
  "plugins/hope/skills/sweep/SKILL.md",
  "plugins/hope/skills/sweep/agents/openai.yaml",
  "plugins/hope/skills/toxic-review/SKILL.md",
  "plugins/hope/skills/toxic-review/agents/openai.yaml",
  "plugins/hope/skills/toxic-review/references/causal-review.md",
  "plugins/hope/skills/write/SKILL.md",
  "plugins/hope/skills/write/agents/openai.yaml",
  "plugins/hope/skills/write/assets/hope-protected-light.png",
  "plugins/hope/skills/write/references/writing-standard.md",
]);

export const pluginPackageFiles = Object.freeze([
  ...generatedPluginFiles.map((entry) => entry.destination),
  ...staticPluginFiles,
].map((path) => path.replace(/^plugins\/hope\//u, "")).sort());
