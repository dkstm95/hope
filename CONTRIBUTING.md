# Contributing

Hope welcomes focused changes that keep people able to see, understand, and
control their work with AI.

## Before changing Hope

- Read [PRINCIPLES.md](PRINCIPLES.md) for project-wide product decisions.
- Read [docs/architecture.md](docs/architecture.md) before changing
  implementation dependencies, shared code or assets, a main folder, a build
  boundary, or delivery structure.
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

- Give the final pull request an AI-readable title. The repository uses that
  title for its squash commit in `main`:

  ```text
  <type>(<scope>): <observable outcome>
  ```

  Use `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
  `revert`, or `test` as the type. Use a lowercase feature or repository area
  as the scope. Add `!` before `:` for an incompatible change.

  State the behavior or repository result in the outcome. Avoid a vague action
  such as `update`, `improve`, `simplify`, or `fix` when it hides that result.
  Add a commit body only when the reason or trade-off is not clear from the
  title.

  Validate the title before committing or opening the pull request:

  ```bash
  npm run check:title -- "feat(align): skip artifacts for same-session work"
  ```

  The checker enforces the structure and rejects unsafe control characters.
  Review owns whether the outcome is concrete. Trusted CI checks every pull
  request title before merge and audits the new `main` head after a push.
  Commit type does not determine the release decision.
- Keep product documentation aligned with implemented behavior.
- State which checks ran and any remaining verification gap in the pull
  request.
- Follow [docs/release.md](docs/release.md) to record the release decision,
  prepare any version change, and pass the completion gate before committing.
