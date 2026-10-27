---
name: whiplash
description: Critically review a work product, fix supported material issues, and repeat verification and review until no material issue remains; or, as a sweep, apply proven behavior-preserving cleanup across a codebase. Use only when explicitly invoked.
disable-model-invocation: true
---

# Hope Whiplash

Use only when the person invokes `$hope:whiplash`, `/hope:whiplash`, or the
host's equivalent skill command or picker. Continue follow-ups within that
invoked task without requiring another invocation. Ordinary requests and calls
from another skill do not activate this skill; continue authorized work through
the ordinary workflow. Reading a shared reference does not invoke its skill.

Critically examine whether the work achieves the person's intended state after
the change in real use, fix supported material issues, and review the result
again. Be strict about the work and respectful toward people.

Read `../write/references/writing-standard.md` for user-facing language.

## Scope

Use the named target or the active work established in the conversation. Read
the original request and subsequent changes to distinguish which purposes,
requirements, and contracts the latest request replaces and which still apply.
Earlier agreements do not override a request to change the purpose itself.
The authored diff is evidence to review for errors and omissions, not a
requirement or the boundary of the work.

Follow affected behavior through existing implementation, tests, contracts,
documentation, and call paths. Include related parts that conflict with or
prevent the intended state, even outside the diff or initial change list.
Extend scope as needed to complete the change; leave unrelated cleanup out.
Invocation authorizes reversible local edits within that scope. Carry forward
existing authority for other actions; invocation alone does not authorize
commits, pushes, publication, or changes to external systems.

Honor a review-only request by reporting checked findings without edits. Ask
only when missing information or a consequential decision changes the result,
or an action needs authority not already given. Continue independent authorized
work while an answer is pending.

## Review, fix, and repeat

Use the conversation, relevant sources, and the person's constraints to choose
the review's focus, depth, and format. Do not fill a fixed checklist, require a
finding count, or impose a report template.

Test important claims in concrete situations, including design choices that
may prevent the intended result. Do not change the person's intent to fit the
existing implementation. Apply the same evidence standard to your findings,
prior conclusions, and user criticism; seek evidence that could overturn each.
Distinguish confirmed defects, design choices, and unverified claims. Do not
reverse a conclusion without checking or invent a defect to agree with a
criticism. Reject unsupported findings with reasons; reopen settled decisions
when new requests or evidence change their basis.

When a test fails or a contract conflicts, use the requests and evidence to
decide whether the implementation is defective, the expectation is obsolete,
or a requirement that still applies has been violated. Preserve valid checks
and update obsolete expectations. Neither weakening the intended change to
pass tests nor deleting valid verification to hide failures is a repair.
Distinguish records, permissions, and failure conditions that must survive from
past execution mechanisms that the request replaces.

Fix supported issues in coherent batches and verify affected behavior with
appropriate checks and required project verification. Derive checks from the
requested outcome and retained requirements; code and documents or tests edited
alongside it cannot alone establish success. After each batch, review the
latest result for fulfillment of changed requirements, preservation of retained
requirements, and consistency across affected parts, including omissions and
regressions outside the diff.

Use independent reviewers when their perspective is worth the time or the
person requests them. Give fresh contexts the original and subsequent requests,
still-valid constraints, and relevant artifacts and evidence. Label the author's
interpretations and assumptions rather than passing them as established facts.
Judge findings by evidence, not reviewer agreement. Disclose any limit on
requested independence.

## Sweep mode

When the person asks Whiplash for a sweep, or for cleanup rather than a review
of a change, the intended state is a smaller codebase with unchanged public
behavior. Use the named repository or the current one, and the whole repository
unless the person narrows the scope. Record the revision and working-tree state
and preserve unrelated edits.

Establish current behavior from running code and configuration, then remove
dead code, duplication, needless branches or wrappers, misplaced abstractions,
and repeated work. Share logic only when behavior, ownership, and reasons to
change match. Prove a removal has no remaining consumer, including external or
dynamic use; a missing text reference alone does not prove safety. Remove
dedicated tests, documentation, generation, configuration, and assets with
their obsolete consumer, and retain support for remaining paths.

Leave bugs, public-contract or behavior changes, product and compatibility
decisions, migrations, dependency changes, and uncertain removals outside the
sweep, and do not turn them into unsolicited findings. Verify affected
consumers with the narrowest useful checks plus required project verification,
and correct or revert regressions the sweep introduced without repairing
pre-existing failures. If no proven cleanup exists, say so.

## Finish

Continue under existing decisions and authority until the final result has
been checked against the intended state, no material issue remains in the
affected scope, and required verification is complete. Passing tests or reviewer
agreement cannot substitute for that judgment. A review of an earlier version
does not clear later edits. One clear review of the latest result is enough;
do not repeat unchanged reviews or invent work to fill a round.

If fixes cycle, the same unresolved cause persists without concrete progress,
or a required decision, evidence, access, or user-specified budget prevents
completion, report the remaining issue and what would unblock it. Complete
independent work first. Do not describe an interrupted or blocked run as clean.

Report consequential fixes, verification, and remaining limits concisely. For
review-only work, lead with the most consequential supported findings, their
evidence, and useful next actions, then finish once they have been checked. If
no material issue is found, say so without implying the work is defect-free.
