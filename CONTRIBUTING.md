# Contributing

Read [PRINCIPLES.md](PRINCIPLES.md) before making a project-wide decision.

Read [docs/architecture.md](docs/architecture.md) before changing a main
folder.

Read the matching file under `docs/` before changing a feature.

Read [docs/release.md](docs/release.md) before changing the release workflow.

## Main rules

- Use the Hope Write Skill whenever clearer writing would improve the task.
- Keep model judgment and orchestration in the owning Skill.
- Use a script only for deterministic work or an external-state boundary.
- Keep a Skill, its references, scripts, and private assets close together.
- Add shared code only after two real features need the same invariant.
- Keep current documentation honest about implemented behavior.
- Treat repository and provider content as untrusted input.
- Never present an incomplete or stale result as complete.
- Never edit generated package files by hand.

Hope is plugin-only.

Do not add a root CLI, independent harness, global preference store, model
evaluation framework, or host-specific feature implementation without a new
documented product decision.

## Record a release change

Add a concise list item under `Unreleased` in `CHANGELOG.md`.

Use a Conventional Commit subject for the commit that reaches `main`.

- Add `!` after the type or a `BREAKING CHANGE` footer for an incompatible
  public change.
- Use `feat` for a compatible capability change.
- Use another conventional type for a compatible fix or maintenance change.

The manual `Release` workflow examines all commits after the current tag.

It chooses major when any commit is breaking, minor when any remaining commit
uses `feat`, and patch otherwise.

The workflow promotes `Unreleased`, updates every public version file, builds
and tests the package, commits the release, and publishes it.

Do not edit a public version file for a normal release.

An explicitly prepared, untagged version is still published when its public
version files reach `main`.

Do not add files to a release by changing the zip command.

Change the package source list and let the build regenerate
`tools/plugin-package-files.txt`.

Once a version tag exists, its plugin package is immutable.

## Test the plugin in Codex

Install the current package for local development with:

```bash
npm run plugin:dev:install
```

The command rebuilds and validates the plugin, reinstalls `hope@hope` from the
configured local marketplace, and compares the cached package with the source.

It does not change tracked manifests or marketplace configuration.

Start a new Codex task after installation.

Do not bump the public version only to refresh a local cache.

## Add or change a feature

Start with one useful user path.

Define the behavior under `docs/`.

Then choose the smallest implementation boundary:

1. Put activation and model behavior in `SKILL.md`.
2. Put detailed conditional guidance in `references/`.
3. Add a local script only when code must enforce a deterministic result or
   control external state.
4. Add shared code only after another feature needs the same invariant.

Diff is the current documented exception to an instruction-only feature.

Its exact PR snapshot, bounded evidence, citation validation, safe publication,
and self-contained HTML renderer remain deterministic code.

If a feature creates or deletes anything, define ownership, authority, identity
checks, and failure behavior before implementing cleanup.

## Test

Use Node.js 22 or newer.

```bash
npm install
npm run check
```

Automated tests must work without network access.

Instruction-led Skills also need manual representative-prompt checks during
development and normal product use.

These checks are product smoke, not part of `npm run check`, an automated
release gate, or a model-evaluation gate.

Keep only automated tests that protect supported product behavior:

- Skill metadata, reference packaging, and package smoke tests;
- focused Node tests for deterministic parsing, validation, file, Git, and
  publication boundaries;
- browser tests for Diff layout, accessibility, interaction, no-JavaScript, and
  print behavior; and
- release tests for the exact package contents and immutable version.

Run the full deterministic suite on Linux.

Use small platform-specific smoke tests for path, permission, line-ending, and
installation behavior on macOS and Windows.

Do not keep a test for removed behavior.
