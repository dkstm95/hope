# AI work instructions

Before changing Hope:

- Read [PRINCIPLES.md](PRINCIPLES.md).
- Follow the workflow in [CONTRIBUTING.md](CONTRIBUTING.md).
- Read [docs/architecture.md](docs/architecture.md) before changing
  implementation dependencies, shared code or assets, a main folder, a build
  boundary, or delivery structure.
- Read the matching `plugins/hope/skills/<feature>/SKILL.md` before changing
  feature behavior.
- Read [docs/design.md](docs/design.md) before changing a Hope GUI.

## Writing

Use the Hope Write Skill whenever clearer language would improve the work.

Write applies the shared
[writing standard](plugins/hope/skills/write/references/writing-standard.md)
inside the active task.

When implementation or another Skill owns the task, Write remains
cross-cutting. It does not create another workflow, worker, result, scope, or
completion condition.

## Completion

Before finishing, review the full changed scope against
[Prefer simple, direct design](PRINCIPLES.md#prefer-simple-direct-design).

Remove support files, generation, packaging, documentation, and tests that no
longer serve the remaining product.

Link to one authority instead of keeping parallel behavior descriptions unless
another file owns a distinct contract or obligation.

Verify changed product behavior.

Skill discovery and manifest validity alone are not evidence that behavior
works.

Run the relevant checks from [CONTRIBUTING.md](CONTRIBUTING.md) and report any
remaining verification gap.

Before completing any file-changing task, follow the release decision and
preparation steps in [docs/release.md](docs/release.md), then run
`npm run check`.

Before committing or opening a pull request, choose one final title that follows
[the contribution rule](CONTRIBUTING.md#record-and-submit-the-change). Validate
it with `npm run check:title -- "<title>"`, then use it for both the commit and
pull request.

Do not finish while `npm run check` fails. Do not commit, open a pull request,
or push while the selected title fails `npm run check:title -- "<title>"`.
