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
- AI agents also follow [AGENTS.md](AGENTS.md) for collaboration guidance.

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

Verify changed behavior with representative prompts or direct runtime checks.
Skill discovery and package validity alone do not prove behavior. Add tests
only for meaningful risks; once relevant checks pass, repeat or broaden them
only for new changes, failures, or unresolved concerns.

Before finishing, review the full changed scope against
[Prefer simple, direct design](PRINCIPLES.md#prefer-simple-direct-design),
follow [release preparation](docs/release.md), and run `npm run check`.
Do not finish a file-changing task while that check fails. Report the checks
and any remaining verification gap.

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

  Use the same final title for the commit and pull request. Validate it before
  committing, opening a pull request, or pushing:

  ```bash
  npm run check:title -- "feat(align): skip artifacts for same-session work"
  ```

  Do not submit while the title check fails.

  The checker enforces the structure and rejects unsafe control characters.
  Review owns whether the outcome is concrete. Trusted CI checks every pull
  request title before merge and audits the new `main` head after a push.
  Commit type does not determine the release decision.
- Keep product documentation aligned with implemented behavior.
- Include validation and the release decision in the pull request.
