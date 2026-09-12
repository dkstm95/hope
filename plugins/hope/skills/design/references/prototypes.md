# Inspectable mockups

## Match the medium to the decision

Use images for composition, imagery, material, and visual direction. Use code
when the person must judge navigation, editing, disclosure, scrolling, feedback,
responsive behavior, or motion. An image can be a direction reference for a
working prototype, but cannot prove it works. Honor the requested medium.

For an image mockup, specify the actual surface and viewport, its regions and
relative emphasis, realistic content, and the chosen visual system. Anchor an
extension with a representative existing screen when the tool accepts references.
Inspect the generated image: a poster about the subject is not necessarily a
usable interface. Treat generated text, control geometry, and missing states as
potential defects. Keep semantic UI text and controls editable in implementation.

For working UI, use the existing project runtime and components where practical.
An isolated fixture or preview can reuse real components without changing the
live product. For a new project, choose the smallest runnable surface that can
answer the question. Label sample data and simulate the necessary outcomes;
do not connect destructive or externally mutating actions merely to make a
mockup feel real. Preserve any explicit product implementation authorization.

Keep exploration separate from shipped routes. Track the files and processes
created for it, including an exact directory or file list and server identity.
Use an isolated directory when imports permit it; where a temporary project
route is necessary, make its temporary status and exact changes clear. Do not
delete by guessed prefix or kill a server you did not identify as yours.

## Present a useful comparison

Show images together at a readable size or provide working variants at their
actual size with a simple switch. Do not shrink a dense desktop screen into a
thumbnail and ask the person to judge its type or controls. Use the same content
and task across alternatives. Keep comparison controls visually distinct from
the subject and clear of the region being judged.

Only add controls the comparison needs: variant switching, relevant content or
state examples, viewport adjustment, or replay for motion. Keyboard access and
unambiguous active state are required for the controls you add. Avoid stealing
typing or navigation keys from the prototype. Switching options should not add
an unrelated animation or unintentionally change the test data.

Use available element-selection or annotation tools for local feedback. Otherwise
provide clear region names or temporary numbered markers outside the final
design. Accept "the top block" and inspect it yourself. A feedback overlay is
optional, not a prerequisite to showing a mockup. If one is useful, ensure each
note identifies its option and state and can actually reach the conversation
through the host or an explicit export. Do not promise automatic feedback
delivery from browser-local storage or an unconnected page.

Open the result with the available preview/browser tool and verify the actual
view. If the host cannot display it, give the precise artifact or runnable path
and viewing instructions, naming what remains unobserved. Do not claim the
person saw, tried, or accepted an artifact merely because you created a file.

## Preserve the result

Keep the chosen prototype, images, and required assets usable for the promised
handoff. Record paths, runtime/start instructions when needed, and which controls
are simulated. A localhost URL is temporary; retain source and a static capture
when another session will rely on it. Clean up only identified, unneeded
exploration within the task's authority, keeping accepted evidence.

For an image-led implementation, carry over region relationships, proportions,
content emphasis, and chosen assets. Use semantic layout and responsive rules;
an exact pixel arrangement at one width is not a responsive design. Compare
captures at the reference's dimensions and inspect important regions. Do not
quietly substitute generic CSS decoration for a selected illustration or recompose
the page while claiming fidelity. Fix rendering mistakes; resolve material
changes to the selected direction with the person.

Sources: `sources.md` (variant, prototype, Design Lab, Impeccable visualize).
