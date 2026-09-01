<p align="center">
  <img
    src="plugins/hope/assets/hope-protected-light.png"
    width="128"
    alt="Hope Protected Light icon"
  >
</p>

<h1 align="center">Hope</h1>

<p align="center">
  <strong>
    Hope helps people work with AI while staying able to see, understand, and
    control the work.
  </strong>
</p>

<p align="center"><a href="README.ko.md">한국어</a></p>

<br>

## Features

### 🤝 Align — Share intent and consequential decisions before implementation

Align starts from the conversation, relevant code, and the project's governing
architecture, schemas, policies, and visual sources. The AI builds a decision
tree, researches facts, recommends the best path, and asks the whole
dependency-ready frontier in each round. The person decides or delegates the
choices whose consequences are worth understanding.

Data modeling and architecture enter the conversation when they shape the
goal, long-lived constraints, future decision space, or material risk.
Reversible code mechanics remain with the implementation AI. Align finishes
when the person confirms its teach-back of the shared understanding. A separate
choice authorizes implementation, which may begin now or remain for later.

When that understanding needs a durable record, Align writes one
self-contained HTML artifact inside the project. The artifact preserves the
goal and problem, intended outcomes, consequential choices, exclusions,
delegations, and relevant flow. It guides implementation at the level the
person confirmed, while implementation owns execution and completion evidence.

For a material visual choice, Align checks the project and presents two or
three image directions as evidence. The same decision frontier decides whether
that probe contributes value.

> [!IMPORTANT]
> Generated Align records are project documentation. Later version-control work
> includes them with related project changes unless the person excludes them.

**Complete example HTML:** [Open the English Align record for a fan schedule that
makes source conflicts, changes, cancellations, and judgment responsibility
explicit.](docs/alignments/rescene-fan-calendar.en.html)

The captures below come from this example. It uses sample data solely as an
illustrative `rescene.fan` concept.

![Dark Hope Align technical record showing the trusted fan-schedule goal and shared understanding](assets/readme/hope-align-en.png)

<details>
<summary>View detailed Align captures</summary>

| Light visual directions | Dark shared understanding and judgment markers |
| --- | --- |
| [![Two design directions for the trusted fan schedule in an English Align artifact](assets/readme/hope-align-directions-en.png)](assets/readme/hope-align-directions-en.png) | [![Decided outcomes, user flow, exclusions, and judgment markers in an English Align artifact](assets/readme/hope-align-decisions-en.png)](assets/readme/hope-align-decisions-en.png) |

</details>

---

### 🔎 Diff — Understand code changes and discover what to do next

AI can produce a large code change quickly. Diff gives the engineer a compact
way to understand the resulting behavior, conditions, boundaries, and evidence.

Diff creates one HTML artifact that explains behavior before code and links
important claims to evidence.

It may use visuals, a microworld, or a quiz to help the reader explore the
change.

The artifact helps the reader build a working mental model of the change and
turn that understanding into follow-up questions, decisions, and work ideas.

> [!NOTE]
> With no URL, Diff first looks for the current branch's pull request.
> If none exists, it selects your latest open pull request in the repository.
> Run Diff again when the pull request changes.

The captures below come from a fixed English Diff example based on
[Ky PR #825](https://github.com/sindresorhus/ky/pull/825).

**Complete example HTML:** [Open the English Diff artifact for Ky PR #825 with
its timeout map, microworld, and quiz.](docs/diffs/ky-825-total-timeout.en.html)

![Dark Hope Diff technical record for Ky pull request 825 showing its goal, shared timeout behavior, and review item](assets/readme/hope-diff-en.png)

<details>
<summary>View detailed Diff captures</summary>

| Light decision table | Dark interactive microworld |
| --- | --- |
| [![A shared timeout decision table in an English Diff artifact](assets/readme/hope-diff-core-en.png)](assets/readme/hope-diff-core-en.png) | [![An interactive total-timeout microworld in an English Diff artifact](assets/readme/hope-diff-microworld-en.png)](assets/readme/hope-diff-microworld-en.png) |

[![A light understanding quiz about shared timeout and retry behavior in an English Diff artifact](assets/readme/hope-diff-quiz-en.png)](assets/readme/hope-diff-quiz-en.png)

</details>

---

### ⚖️ Toxic Review — Put a work product through a rigorous Red–Blue review

Red finds. Blue challenges. The active agent judges.

Independent Red reviewers probe distinct material risks. Every high-priority
finding, every finding that proposes a broad or difficult-to-reverse action,
and every materially uncertain finding receives a fresh Blue verifier. Blue
separately challenges the issue, impact, scope, and proposed action against the
sealed finding and scoped evidence.

The active agent retains final judgment, records each candidate's disposition
and each actionable candidate's final priority, and reports findings no more
strongly than the evidence supports.

> [!TIP]
> Ask Hope to limit the Red reviewer count when you want a smaller routine run.
> Review size alone does not add Blue, but high-priority, broad-action, or
> materially uncertain findings still require it.

---

### 🧹 Sweep — Clean up a codebase

Sweep runs only when explicitly invoked. It immediately applies proven,
behavior-preserving cleanup.

Sweep uses the entire current repository unless the request names a narrower
scope inside it.

It cleans up:

- dead code and its dedicated tests, documentation, configuration, generation,
  and assets;
- duplicated implementations, unnecessary work, and needless indirection;
- abstractions that are missing, excessive, or owned by the wrong boundary;
- documentation, comments, examples, and configuration that no longer match
  the code; and
- the minimum tests or checks needed to refactor safely.

Bug fixes, behavior or public-contract changes, product decisions, and
uncertain removals remain outside Sweep.

---

### ◇ Diagram — Make relationships easier to see

Diagram creates, refines, or reviews explanatory diagrams and data charts when
position, connection, sequence, hierarchy, state, or quantitative shape
communicates more clearly than prose or a small table.

It can own a standalone diagram request or work inside another Hope task without
changing that task's scope, artifact, or completion conditions. It chooses one
primary visual grammar, removes or groups detail before shrinking it, limits
focal emphasis, keeps connectors traceable, preserves source uncertainty, and
renders the result at its intended size before calling it verified. Other Hope
features use Diagram's shared standard for visual selection and design while
retaining ownership of their evidence and artifact contracts.

**Complete example HTML:** [Open the parcel-handoff visualization created by
Diagram.](docs/visualizations/parcel-handoff.html)

![Dark Hope Diagram technical record showing an online order passing from a store to fulfillment, a courier, and the recipient](assets/readme/hope-diagram-en.png)

The design standard is adapted from Cathryn Lavery's
[Diagram Design](https://github.com/cathrynlavery/diagram-design) under the MIT
License. Hope includes the required
[upstream notice](plugins/hope/skills/diagram/LICENSE.diagram-design), but not
Diagram Design's templates, scripts, fonts, gallery, or third-party icons.

---

### ✍️ Write — Make language clearer without losing meaning

Hope also uses Write within other tasks, including implementation and other
Skills.

Write's shared standard adapts George Orwell's six rules in
[Politics and the English Language](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/).

<br>

## Install

You need:

- Node.js 22 or newer
- An authenticated [GitHub CLI](https://cli.github.com/) to use Diff. Run
  `gh auth login` first if needed.

> [!TIP]
> The simplest option is to ask an AI:
>
> ```text
> Install Hope from https://github.com/dkstm95/hope for this host.
> Follow the repository README and tell me if I need to restart.
> ```

To install it yourself, run the commands for your host.

For example:

```bash
# Codex
codex plugin marketplace add dkstm95/hope
codex plugin add hope@hope
```

```bash
# Claude Code
claude plugin marketplace add dkstm95/hope
claude plugin install hope@hope
```

## License

[MIT](LICENSE)

Diagram also carries the
[Diagram Design MIT notice](plugins/hope/skills/diagram/LICENSE.diagram-design)
for its adapted design guidance.
