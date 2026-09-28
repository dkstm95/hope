# Skill invocation and completion checks

Use these scenarios when changing skill selection, handoffs, or stopping rules.
Run affected cases in fresh sessions against the candidate package. Use isolated
fixtures and record the host, model, package revision, prompt, tools or skills
actually used, result, and any limitation. Keep follow-up cases in the same
session. Compare with the previous package when behavior changes.

The deterministic suite checks delivered invocation metadata and runtime
contracts. It does not establish model behavior. A reasoned walkthrough or a
test with pasted instructions does not prove the host's native skill discovery.

## Invocation

Run the command cases with `$hope:<name>` in Codex and `/hope:<name>` in Claude
Code. On another host, use its actual skill command or picker. Test both native
hosts before claiming native invocation works on both.

| Request or setup | Expected behavior |
| --- | --- |
| “Fix this typo”, “review this plan”, “draw this flow”, or “clean up this code” without a skill command | Complete the ordinary request without activating a Hope skill. |
| Invoke each of `align`, `design`, `diff`, `toxic-review`, `sweep`, `diagram`, and `write` with a small suitable task | The selected skill is available and follows its contract; no other Hope skill activates automatically. |
| Invoke Align for an already agreed implementation with no unresolved consequential choice | Continue authorized implementation without a new approval round or unnecessary artifact. |
| Invoke Align for a visual decision without invoking Design | Use available evidence and ordinary tools; do not invoke Design or stop solely to request it. |
| Invoke Align and Design for the same visual decision | Use their public handoff and preserve settled choices without a second product interview. |
| Invoke Design for a dashboard without invoking Diagram | Complete the authorized design without automatically invoking Diagram. |
| Invoke Write on a paragraph, then say “Make it shorter” | Continue the same writing task without requiring another invocation. |
| After that task ends, ask for unrelated code cleanup | Use the ordinary workflow; previous invocation does not activate Sweep or extend Write to unrelated work. |
| Invoke Diff with a narrow PR question, such as its timeout value | Answer from relevant evidence without starting the full artifact run. |

## Diff repairs

Use a captured fixture and validation results; no live publication is needed.

| Validation sequence | Expected behavior |
| --- | --- |
| Same error code, with several invalid fields reduced to one | Repair the remaining field and continue the same run. |
| Same unresolved cause after a repair, with no concrete progress | Cancel once and report the failure. |
| A retryable access failure whose prerequisite was restored | Retry the returned command on the same run. |
| A nonretryable error, or cleanup failure after publication | Follow the terminal-error contract; do not republish. |

## Platform references

Codex uses `policy.allow_implicit_invocation: false` in `agents/openai.yaml`;
Claude Code uses `disable-model-invocation: true` in `SKILL.md` frontmatter.
Keep user invocation available. Other hosts rely on their own controls and the
explicit-invocation rule in each skill; do not assume either native setting is
portable enforcement.

Sources: [Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Claude Code skills](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill),
and [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

## 7.0.0 verification — 2026-09-28

Compared the candidate working tree with `bfac0cb` (6.5.0). All seven packaged
skills retain user invocation and declare both native invocation controls. The
250 deterministic tests passed. Parsed YAML confirms boolean values, not strings.
Skill Creator's generic validator rejects the documented Claude Code extension;
that field was checked separately and its remaining standard fields and body
passed validation for every skill.

Codex CLI 0.153.4 ran fresh, ephemeral, read-only sessions with skill copies in
an isolated `.agents/skills` directory, using its default model without user
configuration; the model ID was not captured. The exact prompt was “Rewrite
this sentence clearly, preserving its meaning: Due to the fact that the build
failed, we are unable to ship today.” Both baseline and candidate answered the
ordinary request without a skill read. Prefixing the same prompt with `$write`
activated Write and read its writing standard in both versions. This checks
explicit invocation and a negative case, not a measured reduction in false
activations or installed-plugin namespace resolution.

Claude Code 2.1.156 loaded the candidate with `--plugin-dir` and listed all seven
`hope:` slash commands. The same ordinary prompt and its `/hope:write` version
both stopped at “Not logged in”; authentication status confirmed no login.
Claude model behavior and a baseline comparison remain unverified.

An independent instruction-level pass checked the settled Align correction,
Align without Design, Design without Diagram, Write's follow-up and unrelated
task boundary, and Diff's progressing repair, stalled repair, and post-publication
cleanup failure. Its next actions matched the contracts with no contradiction.
These were reasoned scenarios, not executed artifact runs or native host tests.
