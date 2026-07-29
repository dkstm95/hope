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
    Hope looks for practical ways for people and AI to work better together.
  </strong>
</p>

<p align="center"><a href="README.ko.md">한국어</a></p>

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

## Choose a feature

| When you need to… | Use | What you get |
| --- | --- | --- |
| Settle a task before implementation | **Align** | A visible shared understanding and approval boundary |
| Critically assess work | **Toxic Review** | One evidence-based result ordered by priority |
| Understand changes and use that understanding in decisions or later work | **Diff** | One local HTML review with evidence and next checks |
| Refine a work product | **Polish** | One bounded cleanup pass with a stated verification scope |
| Draft, edit, or review language | **Write** | A clear draft, edit, or review that preserves meaning |
| Keep language and theme preferences | **Settings** | Defaults shared by supported Hope artifacts |

## Features

### Align

Align finds important misunderstandings before implementation begins.
It reads available evidence, adapts its questions to risk, and keeps unresolved choices visible.

> Example: “Help us settle the upload recovery behavior before implementation.”

![Hope Align example showing a failed-upload recovery decision, current blockers, scope, and success conditions](assets/readme/hope-align-en.png)

*An actual Align HTML artifact generated from a failed-upload recovery example.*

| Scope and success | Expected behavior |
| --- | --- |
| [![The work boundary and success conditions in an Align artifact](assets/readme/hope-align-scope-en.png)](assets/readme/hope-align-scope-en.png) | [![A representative scenario and expected behavior in an Align artifact](assets/readme/hope-align-scenarios-en.png)](assets/readme/hope-align-scenarios-en.png) |
| Shared understanding and next decision | Verifiable work |
| [![The open question, choices, recommendation, and settled decision in an Align artifact](assets/readme/hope-align-understanding-en.png)](assets/readme/hope-align-understanding-en.png) | [![The user change, scope, verification, and failure recovery in an Align artifact](assets/readme/hope-align-work-en.png)](assets/readme/hope-align-work-en.png) |

Align separates repository facts, user decisions, AI proposals, assumptions, and open questions.
It records scope, success conditions, representative scenarios, and verifiable pieces of work.
When the candidate is ready, Align invokes Polish once and checks the result again.
Align waits for explicit approval and never implements the task itself.

The current shared understanding can be rendered as one self-contained HTML file.
The artifact remains useful during the interview instead of acting only as a final report.

---

### Toxic Review

Toxic Review challenges a named work product without attacking the people who made it.
It selects only the perspectives that match the target, stage, evidence, and risk.

> Example: “Find the material risks in this migration plan.”

> **Output:** Returns one adjudicated review in the current conversation instead of creating a separate HTML file.

Each finding names the issue, practical impact, proposed action, confidence, and evidence.
The main reviewer accepts, partially accepts, rejects, defers, or deduplicates every finding.
The final result contains one adjudicated voice instead of pasted reviewer opinions.
Finding no material issue in the checked scope is a valid result.

Toxic Review does not automatically invoke Align or Diff.
It can use their exact artifacts as evidence when you provide them.

---

### Diff

Diff explains a GitHub pull request with evidence from one exact snapshot.
It helps you understand the change before you decide what to do with it.

![Hope Diff result for nanoid pull request 601 showing the goal, before and after behavior, impact, and verification item](assets/readme/hope-diff-en.png)

*An actual Diff HTML artifact generated from [nanoid PR #601](https://github.com/ai/nanoid/pull/601).*

| Core change | Behavior model |
| --- | --- |
| [![The core change explanation in a Diff artifact](assets/readme/hope-diff-core-en.png)](assets/readme/hope-diff-core-en.png) | [![The input comparison and behavior flow in a Diff artifact](assets/readme/hope-diff-behavior-en.png)](assets/readme/hope-diff-behavior-en.png) |
| Teaching aid choices | Evidence-linked code flow |
| [![A Diff artifact explaining which teaching aids it includes and why](assets/readme/hope-diff-teaching-en.png)](assets/readme/hope-diff-teaching-en.png) | [![Code steps and supporting evidence links in a Diff artifact](assets/readme/hope-diff-code-en.png)](assets/readme/hope-diff-code-en.png) |
| Next check for an informed judgment | Evidence and checked scope |
| [![The next step and closing condition in a Diff artifact](assets/readme/hope-diff-review-en.png)](assets/readme/hope-diff-review-en.png) | [![The collected evidence and review scope in a Diff artifact](assets/readme/hope-diff-evidence-en.png)](assets/readme/hope-diff-evidence-en.png) |

Diff reads the pull request text, commit titles, changed text files, and a bounded set of grounded context paths.
It produces one self-contained local HTML file with light and dark themes.
The artifact can include a behavior model or understanding check when either helps explain the change.

With no URL, Diff selects the current branch's pull request or your latest open pull request in the repository.
Run Diff again when the pull request changes.

<details>
<summary><strong>What Diff deliberately does not inspect or run</strong></summary>

- It does not search unrelated repository files.
- It does not inspect pull request discussions, review comments, or CI results.
- It does not run tests, builds, linters, or other repository code.
- It does not approve, reject, merge, comment on, or change the pull request.

</details>

---

### Polish

Polish makes one bounded cleanup pass over a named completed work product.
It protects settled behavior and meaning while improving the result.

> Example: “Shorten this completed guideline without changing its requirement.”

> **Output:** Leaves the revised work product and verification result in the current workflow instead of creating a separate HTML file.

Polish creates a plan for the exact target instead of applying a fixed checklist.
It may simplify, refactor, consolidate, or remove content when captured evidence supports the change.
It preserves public contracts, behavior, meaning, facts, uncertainty, citations, and voice.
A no-change result is valid.

Polish returns `needs-alignment` when cleanup requires a material product decision.
It does not invoke Align automatically.
For language-bearing changes, Polish uses the shared Write standard directly.

---

### Write

Write drafts, edits, or reviews language without losing meaning, facts, uncertainty, citations, or voice.
Its standard also keeps language consistent across other Hope features.

> Example: “Make this save error clear without inventing a cause.”

> **Output:** Applies the draft, edit, or review to the current conversation or target file instead of creating a separate HTML file.

| Mode | Use it to |
| --- | --- |
| `draft` | Create new prose from the request and available context. |
| `edit` | Change the requested prose or files. |
| `review` | Report material clarity, meaning, or flow problems without changing files. |

Use Write for a language-only task.
Use Polish for a bounded revision of a completed work product that may also change its structure.

---

### Settings

Settings stores the language and initial theme used by supported Hope artifacts.
The same preferences are available through the harness and installed plugin.

> **Output:** Saves a global configuration file instead of creating a visual artifact.

Without a saved language, Hope follows the host, operating system, and default fallback in that order.
Without a saved theme, Hope uses the system theme.
Changing Settings affects new artifacts and does not rewrite an existing offline file.

## License

[MIT](LICENSE)
