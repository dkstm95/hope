# Interaction, state, and UI language

## Navigation and task continuity

Choose navigation around the work and information relationships. Tabs switch
peer views, hierarchy needs a way back, and list/detail layouts should preserve
the context of comparison. Keep current location and selected state legible.
Use links for navigation so open-in-new-tab and browser history still work.

Preserve filters, pagination, selection, and scroll when returning to a task.
Use URLs for state people need to share, bookmark, or restore; do not put private
or transient input into a URL just because it is state. Search should explain
no results and how to broaden the query. Batch actions must make their selection
scope and consequences clear, including across pages or hidden filters.

Reveal advanced controls when useful without hiding required actions behind
undiscoverable gestures. Use inline work, a side panel, a new page, or a modal
according to continuity and focus needs. A modal should earn the interruption.
Honor Cancel, Back, Escape, dismissal, and unsaved work within the chosen pattern.

## Controls and forms

Reuse native elements or the project's accessible primitives before building
menus, dialogs, selects, or comboboxes. A familiar appearance is not proof of
keyboard behavior. Design applicable default, hover, focus, active, selected,
disabled, loading, error, and success states; not every component needs every
state, and one state must not accidentally erase another's necessary cue.

Label inputs persistently. Placeholders can show examples but disappear while
typing. Choose input type, input mode, autocomplete, and names for the actual
data; a numeric-looking identifier is not necessarily a numeric quantity.
Preserve paste, autofill, password managers, and one-time-code entry. Do not
clear focus or values during hydration or rerendering.

Validate at a useful point without punishing incomplete typing. On failed
submission, associate actionable errors with their fields and move focus to a
useful error target. Prevent duplicate in-flight actions while retaining the
button's action name and feedback. A disabled submit button with no explanation
can hide the path to recovery. Test keyboard submission, including composition
input; Enter during an IME composition must not accidentally submit the form.

## Asynchronous work and recovery

Make the difference between saved, saving, unsaved, failed, and unavailable
observable when it matters. Give immediate acknowledgement, truthful progress
when known, and a result or recovery. Avoid flashing indicators on fast work,
but do not delay actual completion to stage an animation. Skeletons should
reserve useful geometry rather than advertise a shape the content never takes.

Optimistic updates fit likely, recoverable actions only when reconciliation and
failure behavior are clear. Preserve input on failure and offer retry, undo, or
a reliable way back as appropriate. Do not represent a simulated mockup as
proof of server idempotency, data persistence, or recovery guarantees.

Distinguish first use, no search results, deliberately empty content, lack of
permission, failed loading, partial results, offline, and stale data. Show what
the person can do next without inventing privileges or promising absent data.
Critical errors and actions need a persistent path; a timed toast cannot be
the only way to recover. Toasts should not steal focus.

For streaming or AI-assisted work, make generation, completion, cancellation,
failure, and retry distinguishable. Preserve the user's input and control over
the result. Don't invent progress percentages, source claims, or human review.
Decide how updates affect reading and selection rather than constantly moving
content out from under the person.

## First use and language

Help people reach the first useful result with real examples and contextual
guidance. Distinguish new and returning users; respect dismissed guidance and
offer skipping when appropriate. Do not make a tour mandatory for familiar UI.
Empty-state imagery can help, but every empty state does not need a mascot,
essay, and several competing actions.

Name buttons by their action, links by their destination, and settings by the
state being controlled. Keep vocabulary consistent through navigation, fields,
errors, and completion. Describe the problem and a possible recovery where it
occurred. Use the product's voice with tone suited to success, waiting, or loss.
Never rewrite facts or claims just to fit a layout.

Remove prose that repeats the surrounding structure; retain information needed
to act and interpret data. Visual labels and accessible names have different
jobs. Prefer timely inline help to hiding essential instructions in a tooltip.
Use locale-aware dates, numbers, units, and shortcuts. Generic writing mechanics
belong to Hope Write's shared standard.

Sources: `sources.md` (Jakub writing and accessibility, Design Lab, Vercel,
Impeccable harden/onboard/clarify, UI/UX app and UX data).
