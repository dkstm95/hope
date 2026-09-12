# Verify the design that exists

Use the actual scope and risk to choose checks. Do not run every possible
viewport, state, persona, and platform for each local edit. Reuse evidence from
the same render and batch related fixes. Look again when changes, failures,
or unresolved concerns justify it.

## Observe before judging

For visual claims, inspect a render at the intended size. For behavior, perform
the interaction. For contrast or timing, measure the relevant result. For human
preference, obtain the person's decision or use their delegation. Keep these
different kinds of evidence distinct.

Verify that captures show the intended view, content, viewport, and state after
fonts, images, and relevant entrance motion settle. A blank, wrong, clipped,
or half-loaded capture needs recapturing, not a speculative redesign. Never
claim a check passed because the source contains an appropriate class or ARIA
attribute. A clean automated scan is evidence of its own scope only.

## Walk through the whole affected path

Start with the person's task and follow it to completion, cancellation, or
recovery. Check that the needed content and actions are present, the visual
order expresses their priority, and states are truthful. Switch perspective
from author to a relevant user: newcomer, repeat operator, keyboard user, or
someone on a narrow screen. No fictional persona dossier is needed.

Prioritize blocked actions, lost data/context, misleading states, and inaccessible
paths; then hierarchy, adaptation, consistency, and detail. Fix the shared cause
at the narrowest correct level rather than reporting the same token problem
for every component. Don't perfect an isolated button while leaving the main
flow broken.

## Stress what the component supports

Use real components in a fixture when possible. A lookalike copy tests a different
implementation. Derive cases from their inputs and supported behaviors:

| Axis | Useful cases when applicable |
|---|---|
| Length and shape | Short/long Korean text, long unbroken URLs or IDs, mixed scripts, emoji, line breaks, large and negative numbers, missing media |
| Quantity | Zero, one, typical, many items; sparse and dense content; selections across filtered or paged results |
| State | Loading, partial, success, error, validation, empty, disabled, permission-limited, offline or stale |
| Space | Intermediate widths, narrow containers, expanded text, zoom, landscape, keyboard and safe-area insets |
| Input and timing | Keyboard, touch, rapid repeat, interrupted transition, cancellation, delayed result, composition input |
| Appearance | Required themes, loaded/fallback fonts, reduced motion, increased contrast or forced colors |

A fixed-width container is not a viewport media-query test. A browser is not
a native simulator. A screenshot does not test focus restoration. Name what
was observed and what remains unverified rather than overstating the fixture.

## Check change and fidelity

For refinement, compare with the baseline and explicit instructions. Preserve
accepted composition, content, behavior, and neighboring conventions. Distinguish
introduced defects, regressions, and pre-existing issues. Trace changed shared
tokens or primitives to representative consumers; a diff alone is not a surface.
An attribute removed in a refactor may have an equivalent native replacement.

For a chosen comp, compare the same viewport and inspect salient regions:
geometry, content emphasis, imagery, type character, and controls. Then test
adaptation beyond that viewport. Numeric or pixel similarity can locate drift,
but is not a substitute for semantic fidelity or usable responsive behavior.
Do not claim an untested image recreation exactly matches its source.

Finish when the requested result is inspectable, relevant material defects are
resolved, and remaining limitations are explicit. An accepted design can still
have untested implementation behavior. Conversely, a mechanically valid result
can still fail the person's intent. Stop broadening checks after relevant ones
pass unless new evidence warrants it.

Sources: `sources.md` (better-interface, interface-review, break, Impeccable
critique/polish/harden, Emil animation audits).
