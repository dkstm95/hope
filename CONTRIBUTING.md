# Contributing

Hope welcomes focused changes that keep people able to see, understand, and
control their work with AI.

## Before changing Hope

- Read [PRINCIPLES.md](PRINCIPLES.md) for project-wide product decisions.
- Read [docs/architecture.md](docs/architecture.md) before changing a main
  folder or implementation boundary.
- Read the matching `plugins/hope/skills/<feature>/SKILL.md` before changing
  feature behavior.
- Read [docs/design.md](docs/design.md) before changing a Hope GUI.
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

`npm run check` validates the current working tree's package, release impact,
and deterministic tests.

Run `npm run test:browser` when a Hope GUI layout or interaction changes.

Run `npm run render:readme-assets` and inspect the updated captures when an
artifact rendering change affects the README examples.

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
- Follow [docs/release.md](docs/release.md) to record the release decision,
  prepare any version change, and pass the completion gate before committing.
