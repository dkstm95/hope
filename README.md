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

The simplest option is to ask Codex or Claude Code:

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

## Features

### Align

Align finds important misunderstandings before implementation. It adapts its
questions to the task's risk, separates user decisions from repository facts
and AI proposals, and waits for explicit approval before the next step.

```text
Codex
$hope:align Help us align on this feature before implementation.

Claude Code
/hope:align Help us align on this feature before implementation.
```

Each round starts with a short teach-back of the goal, scope, expected behavior,
and material assumptions. Align reads available repository evidence instead of
asking the person to repeat facts, and it keeps open questions and assumptions
visible. It proposes readiness when scope, success conditions, scenarios, and
verifiable pieces of work are settled, but the person still approves the next
step.

Align can create a self-contained HTML snapshot of the current shared
understanding. The snapshot shows scope, examples, assumptions, open questions,
design perspectives, and verifiable pieces of work.

### Toxic Review

Toxic Review challenges an idea, requirement, UI, plan, implementation, PR, or
other work product without attacking people. It selects only the review roles
that match the current risk, adjudicates their findings, and presents one
result ordered by priority.

```text
Codex
$hope:toxic-review Challenge this plan before we commit to it.

Claude Code
/hope:toxic-review Challenge this plan before we commit to it.
```

Each finding identifies the issue, practical impact, proposed action,
confidence, and supporting evidence. The main reviewer accepts, partially
accepts, rejects, defers, or marks every finding as a duplicate before
presenting one prioritized result. Deferred risks remain visible as unresolved
work.

Finding no material issue in the checked scope is a valid result. Toxic Review
does not manufacture criticism to fill a quota.

### Diff

Diff explains code changes with evidence, helping you make your own decisions
and carry that understanding into later work.

Diff creates one local HTML file.

> With no URL, Diff looks for an open pull request created by the current user
> in the target repository. To choose a specific pull request, add its GitHub
> URL.

```text
$hope:diff https://github.com/owner/repository/pull/123
```

<p align="center">
  <img
    src="assets/readme/hope-diff-light-horizontal.png"
    alt="Hope Diff result in light mode showing the summary, behavior flow, code flow, review items, and comprehension prompts"
  >
</p>

<p align="center">
  <img
    src="assets/readme/hope-diff-dark-horizontal.png"
    alt="Hope Diff result in dark mode showing the summary, behavior flow, code flow, review items, and comprehension prompts"
  >
</p>

Diff reads the pull request text, commit titles, and available text from changed
files. If a source identifies a related path, Diff can also read a limited set
of files from the exact reviewed head or merge-base revision.

It does not search unrelated repository files or inspect pull request discussions,
review comments, or CI results.

It does not run tests, build or lint commands, or other repository code.

> Run Diff again when the pull request changes.

### Write

Write applies George Orwell's writing principles wherever clearer language
would improve the work. It can help with prompts, documentation, responses,
interface text, errors, comments, names, and other text inside an
implementation. It uses familiar words and direct sentences while preserving
meaning, facts, uncertainty, citations, and voice.

```text
Codex
$hope:write Rewrite this wiki page so it is clear on the first read.

Claude Code
/hope:write Rewrite this wiki page so it is clear on the first read.
```

Write follows the current language and any more specific project rules. It can
run as its own task or as a writing pass inside other work:

- `draft` creates new prose from the request and available context.
- `edit` changes the requested prose or files.
- `review` reports material clarity, meaning, or flow problems without changing
  files.

### Settings

Save the language and theme preferences Hope should use.

Without a saved preference, Hope follows the current host or operating system
language and uses the system theme.

## License

[MIT](LICENSE)
