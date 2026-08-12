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

AI can finish a task quickly without making its decisions, evidence, or
remaining uncertainty clear to the person responsible for it.

Hope provides a focused tool for each of those moments.

Use Hope to align before implementation, challenge a work product, understand a
code change, sweep codebase maintenance, refine completed work, or clarify
language without losing meaning.

The current supported delivery is a plugin for Codex and Claude Code.

## Install

Install the current Hope distribution in Codex or Claude Code.

GitHub [Releases](https://github.com/dkstm95/hope/releases) provide version
history and downloadable packages.

<p>
  <img alt="Codex supported" src="https://img.shields.io/badge/Codex-supported-000000?style=flat-square&logo=openai&logoColor=white">
  <img alt="Claude Code supported" src="https://img.shields.io/badge/Claude_Code-supported-D97757?style=flat-square&logo=claudecode&logoColor=white">
</p>

You need:

- Node.js 22 or newer
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

Choose the work you need.

<details>
<summary><strong>Align</strong> — Reach shared understanding before implementation</summary>

Align brings the person and AI to a shared understanding.

It explains its current understanding based on verifiable evidence, such as the
codebase, then asks about choices that can change the result.

> [!NOTE]
> Align waits for explicit approval and never implements the task.

> Example: “I want to add a failed-upload recovery screen. Help me clarify the
> retry behavior and layout before implementation.”

</details>

<details>
<summary><strong>Diff</strong> — Understand what changed and how to judge it</summary>

A code change can be complete while its owner still cannot predict, explain, or
judge it, and that gap is cognitive debt.

Diff explains behavior before code and links important claims to evidence.

Diff uses visuals, a microworld, or a quiz to help the reader explore the change.

The resulting HTML artifact helps the reader understand the change, judge it,
and use that understanding in follow-up decisions and work.

> [!NOTE]
> Diff does not recommend approval or rejection or change the pull request.
> It does not inspect discussions or CI results or run tests, builds, linters,
> or repository code.

![Hope Diff result for nanoid pull request 601 showing the goal, before and after behavior, impact, and verification item](assets/readme/hope-diff-en.png)

*An actual Diff HTML artifact generated from [nanoid PR #601](https://github.com/ai/nanoid/pull/601).*

| Core change | Behavior model |
| --- | --- |
| [![The core change explanation in a Diff artifact](assets/readme/hope-diff-core-en.png)](assets/readme/hope-diff-core-en.png) | [![The input comparison and behavior flow in a Diff artifact](assets/readme/hope-diff-behavior-en.png)](assets/readme/hope-diff-behavior-en.png) |
| Teaching aid choices | Evidence-linked code flow |
| [![A Diff artifact explaining which teaching aids it includes and why](assets/readme/hope-diff-teaching-en.png)](assets/readme/hope-diff-teaching-en.png) | [![Code steps and supporting evidence links in a Diff artifact](assets/readme/hope-diff-code-en.png)](assets/readme/hope-diff-code-en.png) |
| Next check for an informed judgment | Evidence and checked scope |
| [![The next step and closing condition in a Diff artifact](assets/readme/hope-diff-review-en.png)](assets/readme/hope-diff-review-en.png) | [![The collected evidence and review scope in a Diff artifact](assets/readme/hope-diff-evidence-en.png)](assets/readme/hope-diff-evidence-en.png) |

> [!NOTE]
> With no URL, Diff first looks for the current branch's pull request.
> If none exists, it selects your latest open pull request in the repository.
> Run Diff again when the pull request changes.

</details>

<details>
<summary><strong>Toxic Review</strong> — Find important risks you may have missed</summary>

Toxic Review examines the work rigorously and critically, then organizes
evidence-backed findings into one prioritized review.

> [!NOTE]
> Every reviewer runs in a fresh context, including a one-reviewer pass.
> Toxic Review uses multiple independent reviewers only for distinct material
> risks.
>
> Every reviewer makes a separate model call.
>
> Ask Hope to limit the reviewer count when you want a smaller run.

> Example: “Review this database migration plan.”

</details>

<details>
<summary><strong>Polish</strong> — Refine completed work</summary>

Polish reviews a completed result or the current repository change set, then
applies bounded improvements.

Independent review agents look only for useful improvements. For code, they
check reuse of existing helpers, simplicity, efficiency, and abstraction fit.
A finisher weighs their evidence, rejects speculative or risky changes, applies
the improvements that work together, and verifies the result.

Polish does not hunt for bugs, develop features, perform migrations, or handle
broad maintenance.

> [!NOTE]
> Polish edits the local target by default. Ask for a review-only pass when you
> want adjudicated candidates without changes.
>
> Each reviewer and the finisher runs in a fresh context and makes a separate
> model call.

> Example: “Simplify the current changes without changing behavior.”

</details>

<details>
<summary><strong>Sweep</strong> — Clean up and maintain a codebase safely</summary>

Sweep performs a read-only review of a codebase.

It looks for broken references, stale code, unsupported abstractions,
verification gaps, dependency or license risk, delivery waste, unclear
ownership, and similar maintenance risks.

Select a candidate from the review results to start work.

> Example: “Sweep this codebase.”

</details>

<details>
<summary><strong>Write</strong> — Make language clearer without losing meaning</summary>

Write drafts, edits, or reviews language without losing meaning, facts,
uncertainty, citations, or the person's voice.

Hope also uses Write within other tasks, including implementation and other
Skills. It applies the shared standard without creating a second workflow or
changing the task's scope.

Write's shared standard adapts George Orwell's six rules in
[Politics and the English Language](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/).

> Example: “Make this incident update easier to understand.”

</details>

## License

[MIT](LICENSE)
