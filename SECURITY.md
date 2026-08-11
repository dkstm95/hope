# Security

## Supported versions

Security fixes target the latest published release.

Older releases and unreleased commits may not receive a separate fix.

## Report a vulnerability

Do not include credentials, private source, private pull-request data, or an
exploit in a public issue.

Use GitHub's [private vulnerability report](https://github.com/dkstm95/hope/security/advisories/new).

If that form is unavailable, open a public issue without sensitive details and
ask for a private contact method.

Include the affected version, practical impact, reproduction steps, and any
known mitigation in the private report.

## Security model

Hope inherits the active host's tool, permission, and approval boundaries.

Repository content, provider data, paths, model output, and URLs are untrusted
input.

[Hope principles](PRINCIPLES.md) define authority and ownership.

[Diff's runtime contract](plugins/hope/skills/diff/references/runtime.md)
defines its source, rendering, temporary-state, and publication guarantees.
