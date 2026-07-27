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
- An authenticated [GitHub CLI](https://cli.github.com/) to use Diff. Run `gh auth login` first if needed.

The simplest option is to ask Codex or Claude Code:

```text
Install Hope from https://github.com/dkstm95/hope for this host.
Follow the repository README and tell me if I need to restart.
```

To install it yourself in Codex:

```bash
codex plugin marketplace add dkstm95/hope
codex plugin add hope@hope
```

To install it yourself in Claude Code:

```bash
claude plugin marketplace add dkstm95/hope
claude plugin install hope@hope
```

Start a new Codex or Claude Code session after installation.

## Features

### Diff

Diff explains code changes with evidence, helping you make your own decisions
and carry that understanding into later work.

The result is one local HTML file.

> With no URL, Diff looks for an open pull request created by the current user in the target repository. Add a GitHub pull request URL to choose one.

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

Diff reads the pull request text, commit titles, and available text from changed files.
When a collected source identifies a concrete related path, Diff can add a bounded
set of files from the exact reviewed head or merge-base revision.

It does not search unrelated repository files or inspect pull request discussions,
review comments, or CI results.

It does not run tests, build or lint commands, or other repository code.

> Run Diff again when the pull request changes.

### Write

Write helps you draft, edit, or review prose with one shared plain-writing
standard. It favors familiar words, direct sentences, and visible conclusions
while preserving meaning, facts, uncertainty, citations, and voice.

```text
$hope:write Rewrite this wiki page so it is clear on the first read.
```

Use `/hope:write` in Claude Code. Write follows the current language and any
more specific project rules. It can draft new text, change a requested file, or
give concrete revisions when you ask only for a review.

The independent harness exposes the same core as `hope write`. Automatic
writing currently needs the Claude or Codex Skill because the harness does not
have its own model adapter yet.

### Settings

Save the language and theme preferences Hope should use.

Without a saved preference, Hope follows the current host or operating system language and uses the system theme.

## License

[MIT](LICENSE)
