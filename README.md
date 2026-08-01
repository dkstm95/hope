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

<p align="center">
  <a href="#install"><img alt="Codex supported" src="https://img.shields.io/badge/Codex-supported-000000?style=flat-square&logo=openai&logoColor=white"></a>
  <a href="#install"><img alt="Claude Code supported" src="https://img.shields.io/badge/Claude_Code-supported-D97757?style=flat-square&logo=claudecode&logoColor=white"></a>
</p>

<p align="center"><a href="README.ko.md">한국어</a></p>

AI can finish a task quickly without making its decisions, evidence, or
remaining uncertainty clear to the person responsible for it.

Hope provides a focused tool for each of those moments.

Use Hope to align before implementation, challenge a work product, understand a
code change, refine completed work, or clarify language without losing meaning.

## Start with your problem

| If this sounds familiar… | Use | Hope helps you… |
| --- | --- | --- |
| “The AI and I may not understand this task the same way.” | **Align** | Find material misunderstandings and make the current shared understanding visible before implementation |
| “This looks convincing, but I may be missing an important problem.” | **Toxic Review** | Challenge the work with relevant perspectives and return one evidence-based result |
| “AI changed the code, but I cannot explain what changed or judge it yet.” | **Diff** | Understand one exact change, make an informed judgment, and carry that understanding into later work |
| “The work is complete, but it needs refinement without changing settled behavior or meaning.” | **Polish** | Refine it once within explicit preservation conditions and a stated verification scope |
| “This language needs to be clearer without losing meaning, facts, uncertainty, citations, or voice.” | **Write** | Draft, edit, or review prose with one shared writing standard |

## Install

Install the Hope plugin in Codex or Claude Code.

You need:

- Node.js 20 or newer
- An authenticated [GitHub CLI](https://cli.github.com/) to use Diff. Run
  `gh auth login` first if needed.

The simplest option is to ask an AI:

```text
Install Hope from https://github.com/dkstm95/hope for this host.
Follow the repository README and tell me if I need to restart.
```

To install it yourself, run the commands for your host.

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

Start a new Codex or Claude Code session after installation.

### Keep Hope current

- **Claude Code:** enable auto-update for the Hope marketplace under `/plugin`
  → **Marketplaces**. Run `/reload-plugins` when Claude Code reports an update.
- **Codex:** run `codex plugin marketplace upgrade hope`, then
  `codex plugin add hope@hope`, and start a new session.

## Features

### Align

> “The AI and I may not understand this task the same way.”

Misunderstandings about a task's goal, scope, behavior, or important choices can
survive until implementation.

Align reads available evidence, asks risk-adaptive questions, and keeps facts,
decisions, proposals, assumptions, and open questions distinct.

It renders the current shared understanding as one self-contained HTML artifact
with the scope, success conditions, scenarios, and verifiable work.

Align waits for explicit approval and never implements the task.

> Example: “I want to build an upload feature. Help me clarify the requirements
> before implementation.”

![Hope Align example showing a failed-upload recovery decision, current blockers, scope, and success conditions](assets/readme/hope-align-en.png)

*An actual Align HTML artifact generated from a failed-upload recovery example.*

| Scope and success | Expected behavior |
| --- | --- |
| [![The work boundary and success conditions in an Align artifact](assets/readme/hope-align-scope-en.png)](assets/readme/hope-align-scope-en.png) | [![A representative scenario and expected behavior in an Align artifact](assets/readme/hope-align-scenarios-en.png)](assets/readme/hope-align-scenarios-en.png) |
| Shared understanding and next decision | Verifiable work |
| [![The open question, choices, recommendation, and settled decision in an Align artifact](assets/readme/hope-align-understanding-en.png)](assets/readme/hope-align-understanding-en.png) | [![The user change, scope, verification, and failure recovery in an Align artifact](assets/readme/hope-align-work-en.png)](assets/readme/hope-align-work-en.png) |

---

### Toxic Review

> “This looks convincing, but I may be missing an important problem.”

Convincing work can still hide material problems, unsupported claims, or
needless complexity.

Toxic Review selects only the perspectives that fit the target and risk.

It turns evidence-linked findings into one prioritized review rather than a
collection of reviewer voices.

It is hard on the work, respectful toward people, and does not invent criticism.

Finding no material issue is valid.

> Example: “Review this database migration plan.”

---

### Diff

> “AI changed the code, but I cannot explain what changed or judge it yet.”

A code change can be complete while its owner still cannot predict, explain, or
judge it.

That gap is cognitive debt.

Diff binds its explanation to one exact GitHub pull request snapshot, explains
behavior before code, and links important claims to evidence.

When active exploration would help, the review can use visuals, a microworld, or
an evidence-backed quiz.

The resulting local HTML file helps the reader understand the change, judge it,
and carry that understanding into follow-up decisions and work.

Diff does not recommend approval or rejection, change the pull request, inspect
discussions or CI results, or run repository code.

![Hope Diff result for nanoid pull request 601 showing the goal, before and after behavior, impact, and verification item](assets/readme/hope-diff-en.png)

*An actual Diff HTML artifact generated from [nanoid PR #601](https://github.com/ai/nanoid/pull/601).*

| Core change | Behavior model |
| --- | --- |
| [![The core change explanation in a Diff artifact](assets/readme/hope-diff-core-en.png)](assets/readme/hope-diff-core-en.png) | [![The input comparison and behavior flow in a Diff artifact](assets/readme/hope-diff-behavior-en.png)](assets/readme/hope-diff-behavior-en.png) |
| Teaching aid choices | Evidence-linked code flow |
| [![A Diff artifact explaining which teaching aids it includes and why](assets/readme/hope-diff-teaching-en.png)](assets/readme/hope-diff-teaching-en.png) | [![Code steps and supporting evidence links in a Diff artifact](assets/readme/hope-diff-code-en.png)](assets/readme/hope-diff-code-en.png) |
| Next check for an informed judgment | Evidence and checked scope |
| [![The next step and closing condition in a Diff artifact](assets/readme/hope-diff-review-en.png)](assets/readme/hope-diff-review-en.png) | [![The collected evidence and review scope in a Diff artifact](assets/readme/hope-diff-evidence-en.png)](assets/readme/hope-diff-evidence-en.png) |

With no URL, Diff selects the current branch's pull request or your latest open
pull request in the repository.

Run Diff again when the pull request changes.

---

### Polish

> “The work is complete, but I want to refine it without changing what we already settled.”

Refinement can quietly become a behavior change, a new requirement, or a matter
of taste.

Polish defines what must stay unchanged and refines the work once within a clear
scope.

It preserves settled behavior and meaning, reports what changed and what was
checked, and stops when the work needs a material decision.

> Example: “Refine the current work product.”

---

### Write

> “Make this clearer without changing what it means or inventing what we do not know.”

Write drafts, edits, or reviews language without losing meaning, facts,
uncertainty, citations, or the person's voice.

In review mode, it reports material problems with clarity, meaning, or flow
without changing files.

Hope also applies Write to prompts, documentation, responses, interface text,
errors, comments, and names in other tasks.

Write's shared standard adapts George Orwell's six rules in
[Politics and the English Language](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/).

> Example: “Make this incident update easier to understand.”

---

### Settings

> “I do not want to choose the same language and theme for every result.”

Settings stores a supported locale and initial `system`, `light`, or `dark`
theme as shared defaults for the harness and installed plugin.

Changes affect new artifacts only.

## License

[MIT](LICENSE)
