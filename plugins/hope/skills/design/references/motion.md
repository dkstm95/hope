# Motion and direct manipulation

## Decide the purpose first

Motion can explain a state change, spatial relationship, feedback, progress, or
an intentional expressive moment. Repeated work needs quick, predictable
responses; don't animate every keyboard action or replay a page entrance on
every visit. Deliberate personality can fit first use, a meaningful completion,
or an expressive surface. Do not delay work, fake progress, or add celebration
to routine saves just to make polish visible.

Translate descriptions into observable behavior. "Snappy" may mean earlier
feedback or less settling; "floaty" may mean too much travel or weak damping;
"jumpy" may mean a restart, layout shift, or lost velocity. Distinguish actual
latency from timing and easing. Use a short demonstration when those interpretations
would lead to different changes. The full motion vocabulary is in `sources.md`.

Choose duration from travel, size, purpose, frequency, and platform conventions.
Keep comparable motion coherent. Treat source timing tables and spring values
as starting points. Entering, exiting, and continuous movement have different
jobs; an exit need not replay an entrance in reverse at the same speed.

## Choose a mechanism that can respond

CSS transitions work well for simple changes between current and target values.
Keyframes suit authored sequences; ensure they do not reset interactive motion
unexpectedly. Use WAAPI for programmatic browser animation and an existing
motion library for springs, shared layout, exits, or gestures when warranted.
Do not introduce a library for a simple hover treatment.

Keep input responsive during animation. Retarget from the current position and,
for physical motion, carry velocity rather than restarting from rest. Avoid
unnecessary React state updates for every pointer frame. Name animated
properties explicitly. Prefer inexpensive properties, but judge blur, masks,
shadows, and layout animation by measured runtime cost rather than a universal
ban. Use will-change only for an observed need and remove needless layers.

## Element recipes

| Element or effect | Construction and checks |
|---|---|
| Button feedback | Respond on press; retain focus and readability. A subtle color or scale change may work, but don't require a fixed shrink value or animate every repeated keyboard action |
| Popover, menu, tooltip | Anchor transform origin to the trigger. Avoid a scale-from-zero entrance. In a tooltip group, reduce repeated delay without making the first tooltip accidental |
| Dialog or drawer | Preserve focus and dismissal; coordinate overlay and panel without blocking input. Test interrupted open/close and reduced motion |
| Accordion | Preserve content flow and accessibility. Use layout-aware height/grid or the project's primitive; test long content and reversal before completion |
| Tab indicator | Let selection and focus remain immediate. Animate the indicator or shared layer without making the content wait or exposing duplicated text to assistive tech |
| Toast and status | Keep action names, reading time, dismiss/undo paths, and announcements. Animate entry/exit without stealing focus or stacking over work |
| List entrance | Stagger only where sequence helps. Avoid long accumulated delays and replay on every filter or navigation |
| Image or state crossfade | Keep a stable container. Separate changing layers, inspect interrupted blending and text clarity, and avoid blur as a blanket cure |
| Scroll reveal | Keep content reachable and visible if scripting or animation support fails. Use progressive enhancement; do not hijack ordinary scrolling |
| Hold-to-confirm | Make progress and cancellation explicit and provide an appropriate alternative. Do not use animation alone as confirmation of a consequential action |
| Shared-element transition | Preserve the spatial relationship, content identity, and navigation semantics; verify both directions and cancellation |

Load the pinned recipes in `sources.md` for implementation detail relevant to
the chosen runtime, then verify its current API. Do not paste every recipe or
its preferred parameters into the project.

## Gestures and native response

During direct manipulation, track input continuously. Capture the intended
pointer, handle cancellation and lost capture, distinguish click from drag,
and avoid a second touch hijacking the first. Contain gesture handling to the
surface; preserve page scrolling and system navigation elsewhere. Constrain
text selection only while the gesture needs it.

Use release velocity and distance to determine dismissal or settling when the
interaction calls for momentum. Boundary resistance should communicate limits
without leaving the object unreachable. Keep direction and spatial metaphors
consistent. Provide discoverable alternate controls and keyboard operation.

On native, use platform animation and gesture mechanisms. Account for the
keyboard and safe areas. Haptics should confirm a meaningful event, not fire
every frame or ignore preferences. Avoid assuming a JS-driven web technique
transfers to the native rendering thread. Expo/SwiftUI and platform sources are
indexed in `sources.md`.

## Observe the result

Try rapid repeated input, reversal midway, slow content arrival, low-end devices
when available, touch, and reduced motion. Slow playback or frame inspection
can expose discontinuities; normal-speed use determines whether it feels right.
Record what device/runtime was actually observed. Never claim a screenshot
verifies motion, gesture performance, or haptic behavior.
