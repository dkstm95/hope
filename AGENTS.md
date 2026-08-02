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
- implementation code when Write can improve its names, comments, errors,
  user-facing strings, model-facing text, or other language-bearing structure;
  and
- the person's input prompt when clarifying its wording would improve the work.

Choose the Write mode from the action, get the current brief from the shared
runtime, and follow its writing standard.

Preserve the person's meaning, facts, uncertainty, citations, exact text, and
intended voice.

Do not silently resolve a material ambiguity while rewriting an input prompt.

Apply the standard while doing the work and again before sending any response.

Do not claim that reading the writing standard alone is the same as using the
Write Skill.

If the Skill is unavailable, say so and use the shared Write runtime brief as
the explicit fallback.

## Feature completion

A plugin or Skill is an entry point, not a feature implementation.

Before calling a feature complete:

1. Define its product behavior under `docs/`.
2. Put shared behavior under `features/<name>/` or another documented core
   boundary.
3. Expose that boundary through `harness/`, unless the product definition
   records why the feature intentionally belongs to one entry path.
4. Generate any plugin runtime from the same source.
5. Keep each Skill as a thin adapter to that runtime.
6. Test that every supported entry path reaches the same boundary.

Do not use successful Skill or plugin validation as evidence that these steps
are complete.

## Task references

- Repository and release workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release behavior: [docs/release.md](docs/release.md)
- System structure: [docs/architecture.md](docs/architecture.md)
- Align behavior: [docs/align.md](docs/align.md)
- Diff behavior: [docs/diff.md](docs/diff.md)
- Toxic Review behavior: [docs/toxic-review.md](docs/toxic-review.md)
- Write behavior: [docs/write.md](docs/write.md)
- Shared design language: [docs/design.md](docs/design.md)
