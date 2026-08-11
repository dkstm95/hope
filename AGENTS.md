# AI work instructions

Read [PRINCIPLES.md](PRINCIPLES.md) before changing Hope.

Read [docs/architecture.md](docs/architecture.md) before adding a feature or
changing a main folder.

## Required Hope Write pass

Use the Hope Write Skill whenever a task would benefit from clearer writing.

When unsure, use it.

This rule applies throughout the task, not only to a final prose cleanup.

It includes:

- documentation, READMEs, product copy, prompts, instructions, schemas, and
  release notes;
- plans, explanations, reviews, intermediate updates, and final responses in
  any format;
- implementation code when Write can improve names, comments, errors,
  user-facing strings, model-facing text, or other language-bearing structure;
  and
- the person's input prompt when clarifying its wording would improve the work.

Choose the Write mode from the action and follow the current writing standard.

Preserve the person's meaning, facts, uncertainty, citations, exact text, and
intended voice.

Do not silently resolve a material ambiguity while rewriting an input prompt.

Apply the standard while doing the work and again before sending any response.

If the Skill is unavailable, say so and use
`plugins/hope/skills/write/references/writing-standard.md` as the explicit
fallback.

## Feature completion

A feature is Hope's product boundary.

While the plugin is the only supported delivery, its Skill directory is the
editable implementation boundary.

Before calling a feature complete:

1. Define its product behavior under `docs/`.
2. Keep model judgment and workflow guidance in a concise `SKILL.md`.
3. Put long or conditional guidance in `references/`.
4. Add `scripts/` only for deterministic work or external state that
   instructions cannot enforce.
5. Keep generated files out of the editable source boundary and document every
   generation step.
6. Test Skill discovery and every deterministic promise that remains.

Do not add another delivery adapter, global settings system, model-evaluation
framework, or compatibility layer without a new documented product decision.

Do not let manifests, marketplaces, host brands, or installed paths define
feature behavior.

Do not use Skill or manifest validation as evidence that product behavior works.

## Task references

- Repository and release workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release behavior: [docs/release.md](docs/release.md)
- System structure: [docs/architecture.md](docs/architecture.md)
- Align behavior: [docs/align.md](docs/align.md)
- Diff behavior: [docs/diff.md](docs/diff.md)
- Sweep behavior: [docs/sweep.md](docs/sweep.md)
- Toxic Review behavior: [docs/toxic-review.md](docs/toxic-review.md)
- Polish behavior: [docs/polish.md](docs/polish.md)
- Write behavior: [docs/write.md](docs/write.md)
- Shared design language: [docs/design.md](docs/design.md)
