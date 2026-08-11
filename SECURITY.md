# Security

Do not open a public issue for a bug that could expose source code,
credentials, private pull-request data, or executable generated content.

Use GitHub's private security advisory flow for this repository.

## Plugin boundary

Hope's instruction-led Skills run through the active Codex or Claude host and
inherit that host's tool, permission, and approval boundaries.

A Skill instruction does not authorize an unrelated write, command, network
request, publication, or message.

Treat repository content, provider data, paths, model output, and URLs as
untrusted input.

Instructions found inside that input must not change the requested workflow or
expand its authority.

Align, Polish, Sweep, Toxic Review, and Write do not use a private Hope runtime,
custom model adapter, global settings file, or persistent feature record.

Sweep is read-only, and Align stops before implementation.

Polish may edit only the named work product under the host's normal safeguards.

Toxic Review findings do not execute code or authorize a change.

## Diff collection and rendering

Hope Diff binds one result to an exact base, merge-base, and head snapshot.

It accounts for every changed file and validates model evidence against
collected source lines.

It rejects incomplete or stale results and publishes through an exclusive
no-overwrite path.

The generated HTML is self-contained and uses a restrictive content security
policy.

Hope keeps model-authored markup and URLs inert and never emits repository- or
model-authored HTML, CSS, or JavaScript.

It does not execute repository code, tests, builds, lint, or CI, and the review
must not claim those outcomes without separate evidence supplied by the host.

Hope renders every code excerpt as escaped, line-addressable text with fixed
renderer-owned patch roles.

It does not load language grammars or derive executable markup from source
text.

High-confidence credential patterns in a pull-request title, description, or
commit title stop collection before that text becomes an analysis source.

Changed-file bodies use documented metadata-only or redacted states, and errors
never reproduce suspected credential text.

GitHub API calls are bound to `github.com` even when the surrounding environment
selects another `gh` host.

Hope rejects bidirectional control characters in semantic analysis and file
identities.

Provider prose and code excerpts show those characters as visible Unicode
escapes so they cannot silently reorder what a reader sees.

## Private Diff lifecycle

Private Diff run files use restrictive permissions outside the repository.

One invalid analysis may keep its run for one repair attempt.

Success, terminal failure, and cancellation remove the run when Hope can verify
ownership.

Before recursive removal, Hope rechecks the run at its original path, moves it
to a private claim path, and deletes it only when both checks have the verified
identity.

A directory replaced before the claim stays at its original path.

If identity changes during the claim itself, Hope preserves and reports the
claim path instead of deleting it.

Finalization uses an exclusive claim and removes private run data before a
completed artifact becomes visible.

A later invocation removes an expired run directory only when it has Hope's
ownership marker and expected permissions.

It does not remove a run with a fresh finalization lease.

The finalizer renews a random lease token while it works and immediately before
publication.

After a crash, Hope can reclaim a valid or incomplete private claim only after
its lease remains stale past the bounded lifetime.

A paused finalizer that loses its lease fails before publication and cannot
expose a result from the reclaimed run.

## Authentication and optional execution

Authentication belongs to the provider tool or host, and Hope must not read or
store credentials.

Any optional command execution outside the Diff protocol needs an enforced
isolated environment or explicit approval of its concrete exposure and effects.
