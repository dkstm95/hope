const generatedText = (source, destination, banner = "") => Object.freeze({
  banner,
  binary: false,
  bundle: false,
  destination,
  source,
});

const generatedBinary = (source, destination) => Object.freeze({
  banner: "",
  binary: true,
  bundle: false,
  destination,
  source,
});

const generatedBundle = (source, destination, banner = "") => Object.freeze({
  banner,
  binary: false,
  bundle: true,
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
    "docs/model-evaluation.md",
    "plugins/hope/docs/model-evaluation.md",
    "<!-- Generated from docs/model-evaluation.md. Do not edit. -->\n\n",
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
  generatedText(
    "features/command-options/index.mjs",
    "plugins/hope/runtime/features/command-options/index.mjs",
    "// Generated from features/command-options/index.mjs. Do not edit.\n",
  ),
  generatedText(
    "features/artifact/index.mjs",
    "plugins/hope/runtime/features/artifact/index.mjs",
    "// Generated from features/artifact/index.mjs. Do not edit.\n",
  ),
  ...[
    "cli.mjs",
    "evidence.mjs",
    "feature-selection.mjs",
    "index.mjs",
    "polish-preservation.mjs",
    "write-examples.mjs",
  ].map((name) =>
    generatedText(
      `features/model-evaluation/${name}`,
      `plugins/hope/runtime/features/model-evaluation/${name}`,
      `// Generated from features/model-evaluation/${name}. Do not edit.\n`,
    )
  ),
  ...[
    "cli.mjs",
    "constants.mjs",
    "index.mjs",
    "receipt-v1.schema.json",
    "run-v1.schema.json",
    "run-v2.schema.json",
    "validate.mjs",
  ].map((name) => generatedText(
    `features/polish/${name}`,
    `plugins/hope/runtime/features/polish/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/polish/${name}. Do not edit.\n`
      : "",
  )),
  ...[
    "approval-v1.schema.json",
    "batch-capabilities-v1.schema.json",
    "batch-mode-selection-v1.schema.json",
    "batch-merge-v1.schema.json",
    "batch-report-set-v1.schema.json",
    "batch-report-v1.schema.json",
    "batch.mjs",
    "cli.mjs",
    "completion-v1.schema.json",
    "constants.mjs",
    "evaluation-output-v1.schema.json",
    "host-adapter.mjs",
    "index.mjs",
    "inventory-v1.schema.json",
    "inventory.mjs",
    "model-evaluation.mjs",
    "plan-v1.schema.json",
    "session-result-v1.schema.json",
    "validate.mjs",
  ].map((name) => generatedText(
    `features/sweep/${name}`,
    `plugins/hope/runtime/features/sweep/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/sweep/${name}. Do not edit.\n`
      : "",
  )),
  ...[
    "cli.mjs",
    "constants.mjs",
    "index.mjs",
    "render.mjs",
    "session-v1.schema.json",
    "session-v2.schema.json",
    "session-v3.schema.json",
    "validate.mjs",
  ].map((name) => generatedText(
    `features/align/${name}`,
    `plugins/hope/runtime/features/align/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/align/${name}. Do not edit.\n`
      : "",
  )),
  generatedBundle(
    "features/diff/highlight.mjs",
    "plugins/hope/runtime/features/diff/highlight.mjs",
    "// Generated from features/diff/highlight.mjs and bundled dependencies. Do not edit.\n",
  ),
  ...[
    "analysis-v2.schema.json",
    "checkpoint-v1.schema.json",
    "checkpoint-window-v1.schema.json",
    "checkpoint.mjs",
    "cli.mjs",
    "constants.mjs",
    "context.mjs",
    "derive.mjs",
    "finalize.mjs",
    "github.mjs",
    "hash.mjs",
    "index.mjs",
    "invocation.mjs",
    "invocation-evaluation.mjs",
    "redact.mjs",
    "render.mjs",
    "run.mjs",
    "target.mjs",
    "teaching-aids.mjs",
    "text.mjs",
    "validate.mjs",
  ].map((name) => generatedText(
    `features/diff/${name}`,
    `plugins/hope/runtime/features/diff/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/diff/${name}. Do not edit.\n`
      : "",
  )),
  ...["cli.mjs", "index.mjs", "standard.md"].map((name) => generatedText(
    `features/write/${name}`,
    `plugins/hope/runtime/features/write/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/write/${name}. Do not edit.\n`
      : "",
  )),
  ...[
    "adjudication-v1.schema.json",
    "causal-evaluation.mjs",
    "cli.mjs",
    "constants.mjs",
    "index.mjs",
    "model-adapter.mjs",
    "review-v1.schema.json",
    "role-result-v1.schema.json",
    "role-run.mjs",
    "run-plan-v1.schema.json",
    "validate.mjs",
  ].map((name) => generatedText(
    `features/toxic-review/${name}`,
    `plugins/hope/runtime/features/toxic-review/${name}`,
    name.endsWith(".mjs")
      ? `// Generated from features/toxic-review/${name}. Do not edit.\n`
      : "",
  )),
  generatedText(
    "features/result-validation/index.mjs",
    "plugins/hope/runtime/features/result-validation/index.mjs",
    "// Generated from features/result-validation/index.mjs. Do not edit.\n",
  ),
  generatedText(
    "features/work-snapshot/index.mjs",
    "plugins/hope/runtime/features/work-snapshot/index.mjs",
    "// Generated from features/work-snapshot/index.mjs. Do not edit.\n",
  ),
  generatedText(
    "locales/index.mjs",
    "plugins/hope/runtime/locales/index.mjs",
    "// Generated from locales/index.mjs. Do not edit.\n",
  ),
  ...["en-US", "ko-KR"].flatMap((locale) => ["align", "common", "diff"].map(
    (name) => generatedText(
      `locales/${locale}/${name}.json`,
      `plugins/hope/runtime/locales/${locale}/${name}.json`,
    ),
  )),
  generatedText(
    "settings/cli.mjs",
    "plugins/hope/runtime/settings/cli.mjs",
    "// Generated from settings/cli.mjs. Do not edit.\n",
  ),
  generatedText(
    "settings/index.mjs",
    "plugins/hope/runtime/settings/index.mjs",
    "// Generated from settings/index.mjs. Do not edit.\n",
  ),
]);

export const staticPluginFiles = Object.freeze([
  "plugins/hope/.claude-plugin/plugin.json",
  "plugins/hope/.codex-plugin/plugin.json",
  "plugins/hope/assets/hope-protected-light-128.png",
  "plugins/hope/assets/hope-protected-light.png",
  "plugins/hope/agents/toxic-reviewer.md",
  "plugins/hope/skills/align/SKILL.md",
  "plugins/hope/skills/align/agents/openai.yaml",
  "plugins/hope/skills/diff/SKILL.md",
  "plugins/hope/skills/diff/agents/openai.yaml",
  "plugins/hope/skills/diff/assets/hope-protected-light.png",
  "plugins/hope/skills/settings/SKILL.md",
  "plugins/hope/skills/settings/agents/openai.yaml",
  "plugins/hope/skills/settings/assets/hope-protected-light.png",
  "plugins/hope/skills/polish/SKILL.md",
  "plugins/hope/skills/polish/agents/openai.yaml",
  "plugins/hope/skills/sweep/SKILL.md",
  "plugins/hope/skills/sweep/agents/openai.yaml",
  "plugins/hope/skills/toxic-review/SKILL.md",
  "plugins/hope/skills/toxic-review/agents/openai.yaml",
  "plugins/hope/skills/write/SKILL.md",
  "plugins/hope/skills/write/agents/openai.yaml",
  "plugins/hope/skills/write/assets/hope-protected-light.png",
]);

export const pluginPackageFiles = Object.freeze([
  ...generatedPluginFiles.map((entry) => entry.destination),
  ...staticPluginFiles,
].map((path) => path.replace(/^plugins\/hope\//u, "")).sort());
