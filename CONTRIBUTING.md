# Contributing

Hope welcomes focused changes that keep people able to see, understand, and
control their work with AI.

## Before changing Hope

- Read [PRINCIPLES.md](PRINCIPLES.md) for project-wide product decisions.
- Read [docs/architecture.md](docs/architecture.md) before changing a main
  folder or implementation boundary.
- Read the matching `plugins/hope/skills/<feature>/SKILL.md` before changing
  feature behavior.
- Read [docs/release.md](docs/release.md) before changing packaging, versions,
  or release automation.
- Follow [AGENTS.md](AGENTS.md) when an AI agent performs the work.

Do not edit files marked as generated.

Change their editable source and run the documented build instead.

## Work locally

Use Node.js 22 or newer.

```bash
npm install
npm run check
```

Run `npm run test:browser` when Diff layout or interaction changes.

Run `npm run render:readme-assets` and inspect the updated captures when a Diff
rendering change affects the README examples.

Install the current delivery for an end-to-end development smoke test with:

```bash
npm run plugin:dev:install
```

The command rebuilds, validates, installs, and byte-checks the local plugin.

Start a new Codex task after installation.

## Record and submit the change

- Use a concise, outcome-focused Conventional Commit subject as defined in
  [docs/release.md](docs/release.md). Add a commit body only when the reason or
  trade-off is not clear from the change.
- Keep product documentation aligned with implemented behavior.
- State which checks ran and any remaining verification gap in the pull
  request.
- Decide whether the completed work needs no release, a patch, a minor, or a
  major release. Record the decision in the pull request.

When the decision changes the version, update from the latest `main` and run:

```bash
npm run release:prepare -- <version>
```

Commit its version and generated package changes with the work.

See [docs/release.md](docs/release.md) for the decision criteria and recovery
process.
