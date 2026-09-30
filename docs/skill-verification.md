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
| Invoke each of `align`, `design`, `diff`, `toxic-review`, `sweep`, `diagram`, and `write` with a small suitable task | The selected skill is available and follows its contract; no other Hope skill activates unless the task reaches PR/MR writing. |
| Ask to create a PR, or draft its title and body, without naming a skill | PR Writing activates, reads repository conventions and change evidence, and uses Write. Creation continues when authorized. |
| Ask for implementation and submission, then let the agent reach the PR/MR writing step | PR Writing and its Write handoff apply at that step without a new skill command. |
| Ask to update an existing MR description with changed scope | PR Writing uses Write, preserves the project template and language, and reflects the final diff and verification limits. |
| Ask only to review a PR, summarize a diff, or write a standalone commit message | PR Writing and Write do not activate automatically. |
| Invoke PR Writing directly | The same grounded writing workflow and Write handoff apply. |
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

PR Writing and Write permit model invocation: Codex uses
`policy.allow_implicit_invocation: true` in `agents/openai.yaml`, and Claude Code
uses the default enabled setting in `SKILL.md`. Write's description and public
contract restrict automatic use to the PR Writing handoff; native metadata
cannot express a caller-specific allowlist. Verify that ordinary writing does
not activate it.

The other six skills use `policy.allow_implicit_invocation: false` in Codex and
`disable-model-invocation: true` in Claude Code. Keep user invocation available.
Other hosts rely on their controls and each skill's contract; do not assume
either native setting is portable enforcement.

Sources: [Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Claude Code skills](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill),
and [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

## 7.1.0 verification — 2026-09-30

Candidate: the PR Writing working tree based on `ff3dfa2` (7.0.0). Release
decision: minor. The initial package fingerprint is
`ea9997ef3bd325d2ad0ef80a30c8b326016f0e9f29884d847fa66e9171d055a1`:
SHA-256 over the sorted package allowlist, updating the hash with each relative
path, a NUL byte, then its file contents. The repository check passed all 250
tests, including staged invocation metadata and the public Write dependency.
Both changed skills passed Skill Creator validation.

Codex CLI 0.153.4 ran fresh ephemeral sessions in isolated Git repositories.
The fixture changes a login return-path function from accepting any truthy value
to accepting strings beginning with `/`, but not `//` or containing backslashes.
Five focused tests passed. These are fixture claims, not a full security review.

First, baseline and candidate skills were copied into separate `.agents/skills`
directories. Both used `--ignore-user-config --sandbox read-only --json`; the
model ID was not captured in these JSON events. The exact prompt was:

> 현재 브랜치 변경으로 PR 제목과 본문을 작성해줘. 대상 브랜치는 main이고 실제 게시하지 말고 초안만 보여줘. 필요한 검증을 실행해도 돼.

The baseline drafted without reading a Hope skill. The candidate read PR Writing,
Write, and its writing standard, ran the focused tests, and drafted a Korean
title and body grounded in the diff and observed results. A fresh ordinary
rewrite request (the same sentence used in the 7.0.0 check below) read neither
skill. A fresh request to review the local PR diff also read neither skill and
reported a verified correctness finding without changing PR metadata.

Then `npm run plugin:dev:install` installed and byte-verified the candidate.
Fresh Codex sessions used the installed `hope:pr-writing` and `hope:write` from
the plugin cache, with no repository skill files or Hope-specific instructions.
The startup header reported `gpt-6-astra`. Read-only sessions covered creation
and MR editing; the implementation case used a workspace-write sandbox.
Publication was simulated by a local CLI with `pr view/create/edit` and
`mr view/edit` commands; no GitHub or GitLab request was sent.

| Case | Prompt and observed behavior |
| --- | --- |
| Direct creation | “PR 생성해. 대상 브랜치는 main이야.” Both skills and the writing standard were read. After confirming no existing PR, the agent passed the grounded title and body to the simulated create command and reported simulation success. |
| Existing PR | The same request with an existing PR response updated that PR's stale title and body rather than creating a duplicate. Unsupported performance and integration-test claims were removed. |
| Implementation reaches submission | “로그인 복귀 경로 함수가 외부 URL도 그대로 반환해. 로컬 경로만 반환하도록 수정해줘. 슬래시 두 개로 시작하거나 역슬래시가 들어간 입력도 홈 경로로 보내야 해. 쿼리가 있는 로컬 경로는 유지해줘.” Repository instructions required tests and submission to `main`. Without a skill command or PR mention in the user prompt, the agent loaded both skills, implemented the change, passed four tests it added, and invoked simulated PR creation. |
| MR update | “기존 MR 17의 제목과 본문을 현재 브랜치 변경에 맞춰 수정해줘. 대상 브랜치는 main이야.” After the discovery correction below, both skills were read and the edit preserved the required `fix(auth):` title, Korean language, and all four template sections. It recorded five passing tests and the unavailable SSO integration. |

The publication prompts also specified the offline CLI replacement, prohibited
network use, and treated the branch as already pushed. The implementation
fixture's repository instructions supplied those same constraints. The MR
prompt documented the mock's `mr view/edit` and title/body options.

The first MR run missed `CONTRIBUTING.md` and a hidden template excluded from
ordinary file search. PR Writing now names these known instruction and template
paths and requires checking them despite an empty search. After reinstalling
and byte-verifying the corrected package, a fresh run on the same fixture
preserved those conventions. Earlier positive runs preceded this discovery
correction; the handoff and writing policy were unchanged.

Claude Code 2.1.156 remained logged out (`claude auth status`); its model behavior
was not tested. Native metadata is checked, but automatic discovery is not a
guarantee across hosts or repeated runs. The generic Plugin Creator validator
rejected the six unchanged `disable-model-invocation: true` fields; these are
documented Claude Code fields and remain required by Hope's explicit-only
contracts. No GUI changed, so browser verification was not applicable.

### Instruction refinement — 2026-09-30

The follow-up to `c27e1e1` removed repeated wording guidance and handoff inputs
while preserving PR Writing's evidence, template, and submission responsibilities.
The release remains 7.1.0 relative to `origin/main` at 7.0.0. The refined package
fingerprint, calculated as above, is
`d33fdf6a5c4ff5e42d0354d99fadd66bc2a9c8e638f3387b9578055e9380a8ea`.
Both changed skills passed Skill Creator validation, and the local install was
byte-verified.

Fresh installed-plugin sessions on Codex CLI 0.153.4 with `gpt-6-astra` repeated
the direct-creation and MR-update cases in the same read-only offline fixtures.
Both read PR Writing, Write, and the shared standard, passed the five fixture
tests, and completed the simulated create or edit command without another
approval. The MR edit found the ignored instructions and hidden template,
preserved Korean and all four sections, and recorded the unavailable SSO
integration. No live PR or MR was published. The repository check passed all
250 tests. Claude Code model behavior remains unverified.

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
