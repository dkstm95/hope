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

## Prepare a release

Use semantic versioning.

Use patch for compatible fixes, minor for compatible capability changes, and
major for incompatible public changes.

Prepare the version and update its Changelog entry in the same pull request:

```bash
npm run release:prepare -- 2.0.0
```

The preparation command updates the public version files, builds the plugin,
checks the package, and runs the deterministic test suite.

Merging the public version files into `main` starts the Release workflow.

The workflow publishes the version already recorded in the repository when
that version has no GitHub Release.

A later manual run increases an already released version.

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
