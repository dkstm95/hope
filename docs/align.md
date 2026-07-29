# Hope align

Hope align helps a person and an AI find important misunderstandings before
implementation starts. It is an adaptive interview with a visible shared
understanding, not a long-form plan generator and not a proof of perfect
understanding.

## Product boundary

Align works on one named task and one captured set of sources. A source can be
a conversation turn, repository revision, file, URL, or another artifact. A
Git source needs a full object ID or content digest. Every other source needs a
content digest. Names such as `main`, `latest`, and `current` are not stable
identities. Changing the source set creates a new Align revision.

Align asks about intent, preference, work rules, and material choices. It reads
available project evidence instead of asking the person to repeat facts that
the repository can answer. It does not implement the task, change project
files, or claim that a prototype proves production behavior.

Align and Diff are independent. A later Diff may use an Align artifact as
captured context, but neither feature requires the other.

Align composes with Polish at one narrow point. After the runtime reports a
contract-ready approval candidate, the host prepares an exact candidate digest
and invokes Polish once before asking for approval. Polish must preserve every
fact, source, decision, uncertainty, and meaning in the Align state. If it
revises the candidate, Align increments its revision, records the change, and
validates readiness again. If Polish finds a material ambiguity, Align resumes
the interview. Polish never invokes Align.

## Adaptive interview

Each round starts with a short teach-back of the current goal, scope, expected
behavior, and material assumptions. A useful question includes:

- the current understanding;
- why the decision matters;
- the realistic choices and effects;
- Hope's recommendation; and
- how the person may delegate the choice.

There is no fixed question count. Do not repeat a closed question with new
wording. Give a recommended default for a reversible, low-impact choice. Leave
an item for research, implementation-time checking, or deliberate deferral
when an interview cannot honestly settle it.

Use representative examples, edge cases, and counterexamples when they test
the shared mental model. Do not use trivia or ask the person to repeat the
generated document.

## Perspectives

Every session considers these perspectives, but activates only the ones that
reduce a material risk:

- Shared understanding
- Product requirements
- Experience design
- System architecture
- Program design
- Verifiable pieces of work

The state records why a perspective is active or skipped. Experience design is
active only when the work changes a user interface. System architecture is
active only when boundaries, APIs, state, storage, or data flow may change.
Small fixes may skip most perspectives.

An active perspective records concrete decisions or checks. Each verifiable
piece of work names the user-visible change, bounded scope, verification, and
failure or recovery behavior. A list of file edits by itself is not such a
piece.

## Recorded state

The structured state separates:

- the current goal, success conditions, scope, and scenarios;
- repository facts and their source;
- user decisions and their captured conversation sources;
- AI proposals;
- important assumptions and whether they are confirmed, delegated, or open;
- open questions;
- classified uncertainty;
- changes since earlier interview rounds;
- active and skipped perspectives;
- implementation slices.

Hope derives resource counts and readiness blockers from this state. A host
must not invent token, time, test, or source measurements that it did not
observe. Trusted host integrations may attach observed cost measurements
outside the authored state.

## Readiness

The state moves through three phases:

1. `interviewing` — a material question or assumption remains open.
2. `ready-proposed` — Hope finds no current contract blocker and proposes that
   implementation may start.
3. `approved` — the person explicitly approves the next step.

The runtime checks that a proposed or approved state has a goal, success
conditions, explicit in-scope and out-of-scope boundaries, scenarios, no open
question, no open assumption, and at least one verifiable slice. Medium- and
high-risk work also needs active product-requirement and vertical-slice
perspectives. These checks find contradictions in the record. They do not
prove complete understanding.

Before showing a contract-ready candidate for approval, the host runs
`polish-candidate` on the private state. The command rejects an interviewing or
blocked state and returns an artifact source bound to the canonical candidate
digest. The digest excludes derived metrics and the prior Polish receipt.

After Polish returns, the host runs `complete-polish`. The shared transition
checks that the run targeted the prepared digest, revalidates the resulting
Align state, records the outcome and verification status, and binds a receipt
to the resulting candidate. A revised state must increment its revision,
remain contract-ready, and record the cleanup. `needs-alignment` must increment
the revision and return to interviewing with a recorded blocker. A completed
receipt prevents another pass over the same candidate. A user change removes
the stale receipt, creates a new digest, and may receive one new pass.

Model-authored state cannot approve itself. The `approved` phase requires a
trusted approval record from the host, supplied outside the structured state.
The record names a user decision and a conversation source with a content
digest. The runtime checks both against the captured snapshot. When only the
CLI is available, the Skill keeps the runtime state at `ready-proposed`. After
an explicit user response, the host session may continue the work, but it must
not claim runtime approval unless the host can supply the trusted record.

## Shared-understanding artifact

The runtime renders the structured state into deterministic, self-contained
HTML. The HTML shows the current shared understanding during the interview; it
is not a separate final report. Render after several related decisions are
settled or when the person asks to inspect the current state. Do not regenerate
it after every sentence.

### First screen

The first screen helps the person answer four questions in about 30 seconds:

1. What work are we aligning on?
2. Which alignment phase are we in?
3. What goal and success conditions are already shared?
4. What is the next material choice or approval action?

Show the three readiness phases as one compact path. Mark the current phase and
completed earlier phases with text as well as shape. Do not turn interview
rounds, source counts, byte counts, or other internal resource measurements
into a first-screen dashboard.

When an open question exists, show the first question and Hope's recommendation
as the primary next action. Link to the full choices instead of repeating every
choice on the first screen. When no question remains, show the readiness
rationale and the next approval or implementation action.

Translate blocker codes into actions a person can recognize. Keep the exact
codes in structured state, but do not use them as the main interface language.

### Reading order

Keep this order across Align artifacts. Omit a conditional section when it has
no content.

| Order | Section | Job |
| --- | --- | --- |
| 1 | Alignment at a glance | Show phase, goal, readiness, and the next action. |
| 2 | Scope | Make included work, excluded work, and success conditions easy to compare. |
| 3 | Expected behavior | Test the shared model with representative cases and boundaries. |
| 4 | Current shared understanding | Put open questions first, then decisions, proposals, and repository facts. |
| 5 | Assumptions and uncertainty | Keep unconfirmed claims and implementation-time checks visible. |
| 6 | Verifiable pieces of work | Show the path from user-visible change to verification and recovery. |
| 7 | Design perspectives | Explain why perspectives were active or skipped. |
| 8 | History, sources, and resource use | Preserve audit detail without dominating the main reading path. |

Keep open questions, scope, expected behavior, and verifiable work visible.
Start design perspectives, change history, sources, and resource use collapsed.
A direct fragment link opens every disclosure needed to reveal its target.

The artifact shows:

- the goal, phase, risk, source basis, and current blockers;
- scope, success conditions, and expected scenarios;
- user decisions, repository facts, AI proposals, and open items as distinct
  groups;
- assumptions, uncertainty, and changes since earlier rounds;
- active and skipped perspectives;
- verifiable pieces of work; and
- deterministic resource and optional trusted host metrics.

For UI work, an active experience-design perspective may include low-fidelity
HTML descriptions of flows and states. Version 1 does not accept authored HTML,
CSS, JavaScript, SVG, or executable prototypes in the state. Repository and
model text is escaped. A future interactive prototype must earn its own safe
declarative contract.

The renderer uses Hope design tokens, embeds the fixed fonts, supports light
and dark themes, offers the same theme and responsive contents controls as
other Hope artifacts, and remains useful with JavaScript disabled. It never
replaces an existing output path.

## Resource limits

Version 1 accepts at most 128 KiB of structured input, 64 KiB of generated
prose, 64 source references, 64 decisions or facts per group, 48 scenarios,
24 perspectives, and 48 slices. Structured input may contain at most 128
nesting levels and 65,536 values. The artifact is limited to 8 MiB.

These are safety ceilings, not targets. The brief asks the host to keep only
the evidence, decisions, and questions that can change the work.

## Two entry paths

The Claude and Codex Skills use the active host session for repository
inspection and the interview. It asks the generated runtime for the complete
host workflow, validates one structured state, prepares one exact Polish
candidate when ready, and asks the runtime to render HTML. Normative interview,
state, Polish composition, readiness, and lifecycle rules live in that runtime
brief rather than in the Skill.

The independent harness exposes the same feature as `hope align`. Its internal
`brief`, `validate`, `polish-candidate`, `complete-polish`, and `render`
commands reach the shared core. Automatic interviewing reports that the
harness model adapter is unavailable until one exists.
