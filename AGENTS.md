# AI work instructions

Before changing Hope:

- Read [PRINCIPLES.md](PRINCIPLES.md).
- Follow the workflow in [CONTRIBUTING.md](CONTRIBUTING.md).
- Read [docs/architecture.md](docs/architecture.md) before changing a main
  folder, build boundary, or delivery structure.
- Read the matching `docs/<feature>.md` before changing feature behavior.
- Read [docs/design.md](docs/design.md) before changing Diff's visual language.

## Writing

Apply the shared
[writing standard](plugins/hope/skills/write/references/writing-standard.md)
to language-bearing work.

Use the Hope Write Skill for a standalone language-only draft, edit, or review.

During implementation or another Hope workflow, apply the standard directly
instead of invoking Write as a second workflow.

## Completion

Before finishing, review the full changed scope against
[Prefer simple, direct design](PRINCIPLES.md#prefer-simple-direct-design).

Remove support files, generation, packaging, documentation, and tests that no
longer serve the remaining product.

Verify changed product behavior.

Skill discovery and manifest validity alone are not evidence that behavior
works.

Run the relevant checks from [CONTRIBUTING.md](CONTRIBUTING.md) and report any
remaining verification gap.
