<p align="center">
  <img
    src="plugins/hope/assets/telescope.svg"
    width="128"
    alt="Hope telescope icon"
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

Diff helps you understand code changes and provides the explanations and evidence you need to make your own decision.

The result is one local HTML file.

> With no URL, Diff looks for an open pull request created by the current user in the target repository. Add a GitHub pull request URL to choose one.

```text
$hope:diff https://github.com/owner/repository/pull/123
```

<p align="center">
  <img
    src="assets/readme/hope-diff-playwright-41939.png"
    alt="Hope Diff result for Microsoft Playwright pull request 41939"
  >
</p>

<p align="center">
  <img
    src="assets/readme/hope-diff-playwright-41939-details.png"
    alt="Behavior flow, code flow, and a review item in a Hope Diff result"
  >
</p>

Diff reads the pull request text, commit titles, and available text from changed files.

It does not inspect unchanged repository files, pull request discussions, review comments, or CI results.

It does not run tests, build or lint commands, or other repository code.

> Run Diff again when the pull request changes.

### Settings

Save the language and theme preferences Hope should use.

Without a saved preference, Hope follows the current host or operating system language and uses the system theme.

## License

[MIT](LICENSE)
