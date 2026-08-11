# Hope principles

Hope helps people work with AI while staying able to see, understand, and
control the work.

These principles guide the whole project.

A feature, interface, or outside reference may support them, but does not define
Hope by itself.

## Be a focused plugin

Hope is a plugin made of focused Skills.

Codex and Claude may expose the package differently, but they use the same Skill
instructions and the same packaged deterministic code.

Hope does not maintain an independent CLI or harness.

Add another entry path only after a real user need justifies its product and
maintenance cost.

## Start with instructions

Put model judgment, conversation flow, and writing guidance in a short
`SKILL.md`.

Move detailed guidance to a reference that the Skill reads only when needed.

Use code only when Hope must control external state or produce a deterministic
result.

Examples include exact Git revisions, bounded input, source citations, safe file
publication, and self-contained HTML.

Do not wrap prose in JavaScript merely to return it to the model.

## Keep each feature close together

A Skill directory is the default feature boundary.

Keep its instructions, references, scripts, and private assets together.

Shared code needs two real consumers with the same invariant.

Generated package files must name their editable source and must never be edited
by hand.

## Keep the person in control

Hope can automate work, but must not hide important choices, state, or results.

The person should be able to understand what Hope did, guide what happens next,
and stop or clean up the work safely.

Show the reason and evidence when they matter.

Do not present a generated claim as a verified fact.

## Own what Hope creates

Hope records the files or private state it creates.

It never guesses ownership from a name or prefix.

Destructive work needs a clear target, the person's authority, and a final
identity check.

When Hope is uncertain, it leaves the item in place.

Diff never replaces an existing HTML artifact.

## Build from real work

Start with a clear user goal and the smallest useful feature.

Use the feature, learn from it, and then improve it.

Do not add a state machine, compatibility layer, evaluation framework, or
abstraction for a possible future need.

Compatibility is a product choice, not a default cost.

## Test the remaining risks

Test Skill discovery with representative prompts.

Test deterministic code at the boundaries it promises to enforce.

Use browser tests for behavior that only a browser can verify.

Do not preserve implementation complexity only because tests already exist.

Remove obsolete behavior and its tests together.

## Use plain language and clear boundaries

Use short sentences and familiar words in code, commands, and documents.

Name a thing after the job it does or the data it holds.

Keep facts, user decisions, AI proposals, assumptions, and uncertainty distinct.

## Test a new decision

Before adding a feature or layer, ask:

- What clear user goal does it serve?
- Can instructions handle it honestly?
- What external state or deterministic result requires code?
- Can the person see and control important choices?
- Does Hope know exactly what it created and may clean up?
- What smallest test would catch a real failure?
- Has the complexity earned its place through use?

## Learn without copying

Hope may learn from research, tools, videos, and other projects.

Record useful sources near the feature or decision they influenced.

An outside source is context, not Hope's authority.

Hope owns these principles and changes them only when the direction of the whole
project changes.
