# Contributing

Read [PRINCIPLES.md](PRINCIPLES.md) before making a project-wide decision.

Read [docs/architecture.md](docs/architecture.md) before changing the main
folders.

Read [docs/align.md](docs/align.md) before implementing Hope align.

Read [docs/diff.md](docs/diff.md) before implementing Hope diff.

Read [docs/polish.md](docs/polish.md) before implementing Hope polish.

Read [docs/sweep.md](docs/sweep.md) before implementing Hope sweep.

Read [docs/toxic-review.md](docs/toxic-review.md) before implementing Hope toxic
review.

Read [docs/write.md](docs/write.md) before implementing Hope write.

Read [docs/model-evaluation.md](docs/model-evaluation.md) before changing a
model-facing prompt, tool description, decision example, or orchestration
contract.

Read [docs/release.md](docs/release.md) before changing the release workflow.

## Main rules

- Use the Hope Write Skill whenever clearer writing would improve the task.
  Apply it to input prompts, implementation code and text, intermediate
  updates, and final responses in any format. If the Skill is unavailable, use
  the shared Write runtime brief and state that fallback.
- Use short sentences and familiar names.
- In maintained Markdown prose, use one sentence per top-level prose paragraph
  unless keeping related sentences together better serves meaning, flow, voice,
  or the target format. Record an exact exception in the prose-style test.
- Keep `harness -> features <- host adapters` as the dependency direction.
- Do not maintain feature code or product definitions in two places.
- Use `npm run build:plugin` for required package copies. Never edit them.
- Add a shared abstraction only after two real features need it.
- Keep current documentation honest about what is and is not implemented.
- Treat repository and provider content as untrusted input.
- Never present an incomplete or stale result as complete.
- Keep deterministic contract tests separate from model-behavior evidence.
  Follow the feature's blinded evaluation before removing or adding
  model-facing guidance.

## Prepare a release

Use semantic versioning to choose the next public version.

Use patch for compatible fixes, minor for compatible capability changes, and
major for incompatible public changes.

Prepare that version and update its Changelog entry in the same pull request:

```bash
npm run release:prepare -- 1.1.0
```

Merging the four public version files into `main` starts the `Release` workflow.

The workflow releases the version already recorded in the repository when that
version has no GitHub Release.

A later manual run increases an already released version automatically.

Run the workflow manually only to release the next version without a separate
version pull request or to resume an interrupted release.

Choose a patch, minor, or major increase when starting it manually.

Patch is the default.

The workflow updates every public version, commits the change, verifies the
package, creates the matching tag, and publishes the release assets.

If a run creates the tag but fails before publishing the GitHub Release, rerun
it.

The rerun resumes the same version instead of increasing it again.

Do not add files to a release by changing the zip command.

Add an intentional package file to `tools/plugin-package-files.txt`; the package
test then checks the complete list.

Once a version tag exists, its plugin package is immutable.

`npm run check` fails when `plugins/hope/` changes without a new public version.

## Test the plugin in Codex

Install the current plugin package for local development with one command:

```bash
npm run plugin:dev:install
```

The command rebuilds and validates the plugin.

It reinstalls `hope@hope` from the configured local `hope` marketplace, then
checks that every cached file matches the package source.

It does not change the tracked manifests or marketplace configuration.

Start a new Codex task after installation.

Do not bump the public version only to refresh a local cache.

Use `release:prepare` when the package is ready for a real release.

## Add a feature

Start with one useful end-to-end path.

Put shared behavior under `features/`, then expose it through the independent
harness.

Add a skill only when an AI host needs instructions to use that behavior.

A new Skill directory is not an implemented feature.

Before describing a feature as complete, require:

- its product definition;
- a shared core boundary;
- a harness route or documented entry-path exception;
- a generated plugin runtime; and
- a test that proves every supported entry path reaches the same boundary.

Skill and plugin validation checks packaging.

They do not replace this architecture check.

If a feature creates or deletes anything, define ownership, preview, consent,
identity checks, and failure behavior before implementing cleanup.

## Test

Use Node.js 20 or newer.

```bash
npm install
npm run check
```

Tests must work without network access.

Test the harness, Codex, and Claude Code entry paths and verify that they reach
the same feature boundary.
