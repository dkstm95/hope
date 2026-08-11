# Contributing

Hope welcomes focused changes that keep people able to see, understand, and
control their work with AI.

## Before changing Hope

- Read [PRINCIPLES.md](PRINCIPLES.md) for project-wide product decisions.
- Read [docs/architecture.md](docs/architecture.md) before changing a main
  folder or implementation boundary.
- Read the matching file under `docs/` before changing feature behavior.
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

- Add a concise item under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).
- Use a Conventional Commit subject as defined in
  [docs/release.md](docs/release.md).
- Keep product documentation aligned with implemented behavior.
- State which checks ran and any remaining verification gap in the pull
  request.

Do not change public version files for a normal contribution.

The release workflow selects the version increase and prepares those files.
