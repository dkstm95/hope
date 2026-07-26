<p align="center">
  <img src="plugins/hope/assets/telescope.svg" width="128" alt="Hope telescope icon">
</p>

<h1 align="center">Hope</h1>

<p align="center"><strong>Hope looks for practical ways for people and AI to work better together.</strong></p>

<p align="center"><a href="README.ko.md">한국어</a></p>

## Current state

Hope's long-term goal is an independent harness environment. Today, Hope is
available as a plugin and skills for Codex and Claude Code while the independent
harness is still being built.

## Install

Hope requires Node.js 20 or newer and an authenticated
[GitHub CLI](https://cli.github.com/). Run `gh auth login` first if needed.

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

Diff explains one exact GitHub pull request as a private, self-contained HTML
file. With no URL, it prefers a pull request for the current branch. Otherwise,
it chooses the latest open pull request created by the current GitHub user.

Use `$hope:diff` in Codex or `/hope:diff` in Claude Code. Add a GitHub pull
request URL when you want to choose the pull request yourself.

```text
$hope:diff https://github.com/owner/repository/pull/123
```

### Settings

Hope keeps one language and theme preference for its features. Choose `ko-KR`
or `en-US`, and `system`, `light`, or `dark`.

Use `$hope:settings` in Codex or `/hope:settings` in Claude Code.

## License

[MIT](LICENSE)
