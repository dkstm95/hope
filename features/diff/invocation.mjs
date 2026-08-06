import { createHash } from "node:crypto";

import {
  DIFF_INVOCATION_CONTRACT_VERSION,
  LIMITS,
} from "./constants.mjs";
import { parseGitHubPullRequestUrl } from "./github.mjs";

export const DIFF_INVOCATION_DECISIONS = Object.freeze([
  "answer",
  "confirm",
  "execute",
  "cancel",
]);

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function exactObject(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`${label} has an unknown field: ${key}`);
    }
  }
  return value;
}

function sourceRequest(value) {
  if (
    typeof value !== "string"
    || !value.trim()
    || [...value].length > LIMITS.modelString
  ) {
    throw new TypeError(
      `Hope diff confirmation needs a source request within ${LIMITS.modelString} characters`,
    );
  }
  return value;
}

function canonicalTarget(target) {
  if (!target || typeof target !== "object") {
    throw new TypeError("Hope diff confirmation needs an exact pull request target");
  }
  return parseGitHubPullRequestUrl(target.url);
}

function retargetedTarget(target, boundTarget) {
  if (target?.url) return canonicalTarget(target);
  if (!Number.isSafeInteger(target?.number) || target.number < 1) {
    throw new TypeError("Hope diff retargeting needs a canonical URL or positive pull request number");
  }
  return parseGitHubPullRequestUrl(
    `https://github.com/${boundTarget.owner}/${boundTarget.repository}/pull/${target.number}`,
  );
}

export function createDiffPendingConfirmation(input = {}) {
  exactObject(input, ["sourceRequest", "target"], "Hope diff confirmation input");
  const request = sourceRequest(input.sourceRequest);
  const { target } = input;
  const canonical = canonicalTarget(target);
  return Object.freeze({
    feature: "diff",
    questionsAsked: 1,
    sourceRequestDigest: sha256(request),
    target: canonical,
    targetDigest: sha256(canonical.url),
    version: 1,
  });
}

function validatePendingConfirmation(pending) {
  exactObject(
    pending,
    [
      "feature",
      "questionsAsked",
      "sourceRequestDigest",
      "target",
      "targetDigest",
      "version",
    ],
    "Hope diff pending confirmation",
  );
  if (
    pending.version !== 1
    || pending.feature !== "diff"
    || pending.questionsAsked !== 1
    || !/^sha256:[a-f0-9]{64}$/u.test(pending.sourceRequestDigest)
  ) {
    throw new TypeError("Hope diff needs a valid pending confirmation");
  }
  const target = canonicalTarget(pending.target);
  if (pending.targetDigest !== sha256(target.url)) {
    throw new TypeError("Hope diff pending confirmation target changed");
  }
  return target;
}

export function transitionDiffPendingConfirmation(pending, options = {}) {
  exactObject(
    options,
    ["decision", "sourceRequest", "target"],
    "Hope diff confirmation transition",
  );
  const {
    decision,
    sourceRequest: expectedSourceRequest,
    target,
  } = options;
  const boundTarget = validatePendingConfirmation(pending);
  const request = sourceRequest(expectedSourceRequest);
  if (pending.sourceRequestDigest !== sha256(request)) {
    throw new TypeError("Hope diff pending confirmation source request changed");
  }
  if (!DIFF_INVOCATION_DECISIONS.includes(decision)) {
    throw new TypeError("Hope diff needs a valid invocation decision");
  }
  if (decision === "execute") {
    const selectedTarget = target
      ? retargetedTarget(target, boundTarget)
      : boundTarget;
    return Object.freeze({
      decision,
      pending: null,
      target: selectedTarget,
      transition: selectedTarget.url === boundTarget.url
        ? "affirmative-execute"
        : "retarget-execute",
    });
  }
  return Object.freeze({
    decision: decision === "confirm" ? "cancel" : decision,
    pending: null,
    target: null,
    transition: decision === "confirm"
      ? "maximum-confirmation-reached"
      : `${decision}-clear`,
  });
}

export function transitionDiffPendingConfirmationInput(input = {}) {
  exactObject(
    input,
    ["decision", "pending", "sourceRequest", "target"],
    "Hope diff confirmation transition input",
  );
  return transitionDiffPendingConfirmation(input.pending, {
    decision: input.decision,
    sourceRequest: input.sourceRequest,
    ...(input.target === undefined ? {} : { target: input.target }),
  });
}

function examplePullRequest(number) {
  return Object.freeze({
    number,
    owner: "example",
    repository: "repo",
    url: `https://github.com/example/repo/pull/${number}`,
  });
}

const pullRequest123 = examplePullRequest(123);
const pullRequest456 = examplePullRequest(456);

const pendingDiff = createDiffPendingConfirmation({
  sourceRequest: "이 PR 리뷰해줘",
  target: pullRequest123,
});

// Version 3 is a historical evaluation fixture. Keep these cases unchanged so
// retained records continue to describe the exact brief that produced them.
export const DIFF_INVOCATION_EVALUATION_CASES = Object.freeze([
  Object.freeze({
    expectedDecision: "execute",
    id: "direct-invocation",
    reason: "A direct invocation alone selects and starts Hope Diff.",
    request: "$hope:diff",
  }),
  Object.freeze({
    expectedDecision: "execute",
    id: "direct-invocation-with-url",
    reason: "The direct invocation authorizes the review and the URL identifies its target.",
    request: "$hope:diff https://github.com/example/repo/pull/123",
  }),
  Object.freeze({
    expectedDecision: "execute",
    id: "clear-natural-request",
    reason: "The person clearly delegates a Hope Diff review.",
    request: "Hope Diff로 리뷰해줘",
  }),
  Object.freeze({
    expectedDecision: "execute",
    id: "whole-pr-request",
    reason: "The person clearly requests a complete pull-request review.",
    request: "현재 PR 전체를 리뷰해줘",
  }),
  Object.freeze({
    expectedDecision: "execute",
    id: "polite-delegation",
    reason: "Question grammar can still carry a clear task delegation.",
    request: "PR #123을 Hope Diff로 리뷰해줄 수 있어?",
  }),
  Object.freeze({
    expectedDecision: "execute",
    id: "compound-delegation",
    reason: "The final instruction explicitly asks Hope Diff to run.",
    request: "지원하면 PR #123을 Hope Diff로 리뷰해줘",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "feature-question",
    reason: "The person asks for information about Hope Diff.",
    request: "Hope Diff가 뭐야?",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "direct-invocation-question",
    reason: "Mentioning the direct invocation inside a question does not authorize a review.",
    request: "$hope:diff는 어떻게 동작해?",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "capability-question",
    reason: "The person asks whether the feature can review the target rather than delegating the work.",
    request: "PR #123도 Hope Diff로 리뷰할 수 있어?",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "quoted-request",
    reason: "Quoted example text is not execution authority.",
    request: "‘PR #123을 Diff로 리뷰해줘’라고 말하면 실행돼?",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "explicit-non-execution",
    reason: "An explicit instruction not to run overrides other execution signals.",
    request: "PR #123은 Hope Diff로 리뷰하지 마",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "narrow-request",
    reason: "A narrow request does not authorize a complete Hope Diff review.",
    request: "이 PR에서 바뀐 파일 이름만 알려줘",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "direct-invocation-with-narrow-request",
    reason: "The whole request asks for a narrow answer rather than a complete review.",
    request: "$hope:diff 이 PR에서 바뀐 파일 이름만 알려줘",
  }),
  Object.freeze({
    expectedDecision: "answer",
    id: "target-only",
    reason: "A pull-request target without a review delegation does not authorize execution.",
    request: "https://github.com/example/repo/pull/123",
  }),
  Object.freeze({
    expectedDecision: "confirm",
    id: "generic-review",
    reason: "A generic review request does not clearly select Hope Diff or a complete review.",
    request: "이 PR 리뷰해줘",
  }),
  Object.freeze({
    expectedDecision: "confirm",
    id: "generic-url-review",
    reason: "The URL identifies a target but does not by itself authorize Hope Diff.",
    request: "https://github.com/example/repo/pull/123 이거 검토해줘",
  }),
  Object.freeze({
    expectedDecision: "execute",
    id: "confirmation-affirmative",
    pending: pendingDiff,
    reason: "The reply clearly accepts the pending Hope Diff review.",
    request: "응, Hope Diff로 해줘",
  }),
  Object.freeze({
    expectedDecision: "cancel",
    id: "confirmation-negative",
    pending: pendingDiff,
    reason: "The reply rejects the pending Hope Diff review.",
    request: "아니, 일반 리뷰만 해줘",
  }),
  Object.freeze({
    expectedDecision: "cancel",
    id: "confirmation-unclear",
    pending: pendingDiff,
    reason: "An unclear reply does not authorize execution and the confirmation is not repeated.",
    request: "적당히 봐줘",
  }),
  Object.freeze({
    expectedDecision: "cancel",
    id: "confirmation-superseded",
    pending: pendingDiff,
    reason: "A new topic clears the pending confirmation without running Hope Diff.",
    request: "그보다 테스트 실패부터 고쳐줘",
  }),
  Object.freeze({
    expectedDecision: "execute",
    expectedTarget: pullRequest456,
    id: "confirmation-explicit-retarget",
    pending: pendingDiff,
    reason: "A clear new Hope Diff delegation replaces the pending target and authorizes only the new target.",
    request: "아니, PR #456을 Hope Diff로 리뷰해줘",
  }),
  Object.freeze({
    expectedDecision: "cancel",
    id: "confirmation-target-only-retarget",
    pending: pendingDiff,
    reason: "Changing only the target does not supply fresh execution authority, and the confirmation is not repeated.",
    request: "그럼 PR #456",
  }),
]);

const evaluationBaselineRulesV3 = Object.freeze({
  boundary: Object.freeze({
    activation: "Loading the Hope Diff Skill does not by itself authorize a review.",
    harness: "A structured hope diff command explicitly selects its documented operation. A natural-language harness entry may classify only through a real model adapter that uses this contract.",
    prepare: "Do not call prepare or another review protocol command until the decision is execute. Resolve-target is the only target-selection command allowed before confirmation.",
  }),
  classification: Object.freeze([
    "Classify the whole request and relevant conversation state by meaning rather than matching a keyword or question mark.",
    "Treat an explicit instruction not to run as controlling even when the request also names Hope Diff, a pull request, or a direct invocation.",
    "Treat quoted text, examples, documentation edits, and questions about the invocation as information rather than execution authority.",
    "Distinguish a capability question from a polite task delegation even when both use question grammar.",
    "Treat a pull-request number or URL as a target identifier, not as execution authority.",
    "Treat a direct Hope Diff invocation alone, a direct invocation with a target, a clear Hope Diff delegation, or a clear complete pull-request review request as execute.",
    "Answer a narrower request within its stated scope instead of expanding it into a complete Hope Diff review.",
    "Use confirm only when the request plausibly asks for a pull-request review but does not clearly select Hope Diff or a complete review.",
  ]),
  classificationResult: Object.freeze({
    decision: "Return exactly one of answer, confirm, execute, or cancel.",
    reason: "Give one short reason grounded in the whole request and relevant conversation state.",
    target: "Return only a target stated or implied by the request. A target never supplies execution authority.",
  }),
  confirmation: Object.freeze({
    affirmative: "Execute only when the reply clearly accepts the bound Hope Diff review.",
    binds: Object.freeze([
      "feature",
      "exact pull-request target",
      "source-request digest",
    ]),
    maximumQuestions: 1,
    negative: "Cancel the pending review when the reply rejects Hope Diff or selects another kind of review.",
    retarget: "A clear new Hope Diff delegation clears the pending review and executes only the newly authorized target. A new number alone stays in the bound repository. A target-only reply cancels without another confirmation.",
    superseded: "Cancel the pending review when the person changes topic or selects another feature.",
    unclear: "Cancel the pending review without asking the same confirmation again when the reply remains unclear.",
  }),
  decisions: Object.freeze({
    answer: "Respond to the information or narrow-scope request without starting a Hope Diff run.",
    cancel: "Do not start Hope Diff and clear any pending confirmation.",
    confirm: "Resolve the exact target, bind it to the source request, and ask one short question that names Hope Diff and that pull request.",
    execute: "Start the complete Hope Diff workflow for the selected target.",
  }),
  feature: "diff",
  modelPolicy: Object.freeze({
    failure: "When meaning remains uncertain, choose confirm for a plausible full review and otherwise choose answer or cancel. Do not guess execute.",
    harness: "Use a replaceable model adapter for natural-language classification. Keep structured commands explicit and report a missing adapter honestly.",
    modelSelection: "A frontier model is not required. Establish a frontier-quality baseline, then use the least costly model that passes independent multilingual and conversational evaluations.",
    plugin: "Use the active Claude or Codex host model and do not add a separate classifier call.",
    privacy: "Classify from the request, relevant conversation state, pending state, and target metadata. Do not send pull-request code for invocation classification.",
  }),
  pendingState: Object.freeze({
    commands: Object.freeze({
      create: "Use confirmation-create with a private JSON input containing the exact source request and canonical target.",
      transition: "Use confirmation-transition with the returned pending state, the same exact source request, the host decision, and any explicitly authorized new target.",
    }),
    fields: Object.freeze([
      "version",
      "feature",
      "sourceRequestDigest",
      "target",
      "targetDigest",
      "questionsAsked",
    ]),
    sourceRequest: "The shared transition re-hashes the exact source request and rejects a pending state from another request.",
    transition: "Use the shared deterministic transition command after the host classifies a reply. Every transition clears the pending state.",
  }),
  targetResolution: Object.freeze({
    beforeConfirmation: "Resolve an exact pull-request target with the read-only resolve-target operation before asking for confirmation.",
    failure: "If the target cannot be resolved, do not ask the execution confirmation or start Diff. Ask for a new explicit request with a PR URL or number.",
    prepare: "After an affirmative reply, pass the bound canonical URL to prepare so automatic discovery cannot substitute another pull request.",
    retarget: "For an authorized retarget with only a PR number, combine that number with the pending target repository and pass one canonical URL. Do not retry a failed prepare with another selector or repository.",
  }),
});

const evaluationBaselineContract = Object.freeze({
  ...evaluationBaselineRulesV3,
  evaluationCases: DIFF_INVOCATION_EVALUATION_CASES,
  version: 3,
});

// The active contract starts from the frozen version 3 rules. Future active
// changes belong here as explicit overrides, never in the historical fixture.
const contract = Object.freeze({
  ...evaluationBaselineRulesV3,
  version: DIFF_INVOCATION_CONTRACT_VERSION,
});

export function createDiffInvocationContract() {
  return contract;
}

export function createDiffInvocationEvaluationBaselineContract() {
  return evaluationBaselineContract;
}
