<!-- Generated from docs/align.md. Do not edit. -->

# Hope Align

Hope Align helps a person and an AI find material misunderstandings before
implementation starts.

It is a focused conversation, not a plan generator, state machine, or proof of
perfect understanding.

## Product boundary

Align works on one named task.

The active host inspects available repository and conversation evidence before
asking the person for information.

It asks only about:

- intent;
- preference;
- work rules;
- expected behavior; and
- a material choice that changes the result.

Align does not ask the person to repeat a fact that the available evidence can
answer.

It does not implement the task.

## Conversation

Start with a short teach-back of the current goal, success conditions, scope,
expected behavior, and important assumptions.

Keep these kinds of information distinct:

- repository facts;
- user decisions;
- AI proposals;
- assumptions;
- open questions; and
- uncertainty that belongs to research or implementation.

Do not turn missing requirements into settled behavior during the teach-back.

An AI-proposed success condition, scope exclusion, or expected behavior stays
an open proposal until the person confirms it.

Ask one material question at a time when that improves the conversation.

Explain why the answer matters.

Offer realistic options and a recommendation when one option is a sensible
default.

Do not repeat a closed question in different words.

Use examples, edge cases, or counterexamples only when they test the shared
mental model.

## Readiness

Align may propose implementation when:

- the goal and success conditions are clear enough to judge the result;
- in-scope and out-of-scope work are visible;
- important expected behavior is understood;
- no material question or open assumption remains; and
- the next work can be divided into verifiable pieces.

A low-risk reversible choice may use a recommended assumption when the person
delegates it.

Research and implementation checks may remain open when the interview cannot
honestly settle them.

State those limits instead of treating them as agreement.

Validation by the model does not prove shared understanding.

The person's explicit approval is the boundary for implementation.

## Output

Align returns a conversational summary with:

- the current shared understanding;
- settled decisions;
- remaining assumptions or uncertainty;
- the next material choice, when one exists; and
- the implementation boundary after approval.

Align does not create an offline HTML artifact.

It does not persist a JSON session, approval record, digest ledger, or Polish
composition record.

The conversation is the source of the current alignment.

If a later message changes a material decision, teach back the changed
understanding before continuing.

## Stopping

Stop asking questions when another question would not change the work.

Stop and surface the choice when proceeding would silently invent product
behavior.

After explicit approval, hand the aligned understanding to the implementation
task without running another Align pass.
