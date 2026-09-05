# Hope principles

Hope helps people work with AI while staying able to see, understand, and
control the work. These principles guide the product; outside references and
delivery tools support them.

## Keep delivery secondary

User goals, behavior, safety boundaries, and results define Hope's features.
The current distribution delivers Skills in one plugin for Codex and Claude
Code, with no independent CLI or harness. Add another delivery path only when
a real user need earns its product and maintenance cost.

## Start with instructions

Put model judgment, conversation flow, and writing guidance in a short
`SKILL.md`. Load detailed references only when needed. Use code for external
state or deterministic guarantees, such as exact Git revisions, bounded input,
validated citations, safe publication, and self-contained HTML. Do not wrap
prose in code merely to return it to the model.

## Keep each feature close together

Keep a feature's editable instructions, references, scripts, and private assets
inside its Skill directory. Feature behavior must not depend on a manifest,
marketplace, installed-cache path, or host brand. Shared code needs two real
consumers with the same invariant. Generated files must name their editable
source and must not be edited by hand.

## Keep the person in control

Make important choices, state, and results visible so the person can understand,
guide, stop, or clean up the work. Show reasons and evidence when they matter;
do not present generated claims as verified facts.

## Follow explicit agreements

An explicitly approved result, scope, or design governs implementation.
Existing code, removed implementations, and another feature's conventions do
not override it. Honor decisions and delegation already given. If the work
must differ materially, explain why and agree on that change before dependent
work continues.

## Own what Hope creates

Record the files and private state Hope creates; never infer ownership from a
name or prefix. Destructive work requires a clear target, authority, and a
final identity check. Preserve uncertain items. Creating a similar artifact
does not authorize replacing an existing one.

## Build from real work

Start with a clear user goal and the smallest useful feature. Improve it through
use. Add no state machine, compatibility layer, evaluation framework, or
abstraction for a hypothetical need. Compatibility is a product choice.

## Close material frontiers

Resolve ready questions or decisions that could change the result or prevent
material harm before dependent work. Use evidence, a decision, deliberate
exclusion, or explicit delegation; revisit only when new evidence changes the
basis. Routine implementation choices need no separate approval.

Support material claims with evidence or state the limitation. Finish when no
material issue remains and one proportionate pass finds no new one. This is a
decision rule, not a required tree, checklist, artifact, or automation.

## Prefer simple, direct design

Keep only parts that define behavior, serve a real consumer, meet an obligation,
or preserve information needed to reproduce the work. Prefer a direct path
from editable source to consumer.

Keep one authoritative statement and link to it. Another description needs a
distinct contract, consumer, or obligation demonstrated by its actual content
and use. A different folder or audience alone does not justify a copy.

Remove obsolete behavior with its dedicated generation, packaging,
documentation, assets, and tests. Fewer files are not inherently simpler; keep
separate parts when they clarify ownership, behavior, or independent delivery.

## Test the remaining risks

Verify feature behavior with representative prompts and deterministic boundaries
with relevant tests. Use browser tests for relationships only a browser can
verify. Test the promised behavior rather than freezing wording, file names,
screenshots, or CSS values as a proxy for judgment.

Add checks only for concrete failures they can reliably detect without
rejecting valid designs. Skill discovery tests verify delivery, not behavior.
Remove obsolete tests with the implementation they supported. Once relevant
checks pass, expand or repeat them only for new evidence or changes.

## Use plain language and clear boundaries

Use familiar words and name things by their job or data. Keep facts, user
decisions, AI proposals, assumptions, and uncertainty distinct. Apply the
[writing standard](plugins/hope/skills/write/references/writing-standard.md).

## Learn without copying

Record useful sources near the feature or decision they influenced. Outside
work informs Hope but does not govern it. Change these principles only when
the whole project's direction changes.
