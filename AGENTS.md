# AI work instructions

Read [PRINCIPLES.md](PRINCIPLES.md) before changing Hope. Read
[docs/architecture.md](docs/architecture.md) before adding a feature or changing
a main folder.

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
- System structure: [docs/architecture.md](docs/architecture.md)
- Diff behavior: [docs/diff.md](docs/diff.md)
- Write behavior: [docs/write.md](docs/write.md)
- Shared design language: [docs/design.md](docs/design.md)
