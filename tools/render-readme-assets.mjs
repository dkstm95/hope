#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { renderAlignSession } from "../features/align/render.mjs";
import { validateAlignState } from "../features/align/validate.mjs";
import { digestJson } from "../features/diff/hash.mjs";
import { renderReview } from "../features/diff/render.mjs";
import { validateAnalysis } from "../features/diff/validate.mjs";
import { makeAlignState } from "../test-support/align-fixture.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, "assets", "readme");
const runId = "6".repeat(32);

const pullRequest = Object.freeze({
  author: "mahirhir",
  base: "ba0bc3b6b95a7e8fb97efa248306e0512b340ace",
  body: [
    "On the `v3` branch the non-secure `nanoid` and `customAlphabet` still use `while (i--)`, which never terminates for a negative `size`. `nanoid(-1)` keeps appending to the string and grows until the process runs out of memory.",
    "",
    "This was already fixed on main in #600 (released in 5.1.16) by changing the guard to `while (i-- > 0)`, but the `v3` branch (latest 3.3.15) didn't get it.",
    "",
    "This backports the same guard to both `non-secure/index.js` and `non-secure/index.cjs`, and adds the negative-size tests from #600 in v3's uvu style.",
    "",
    "For non-negative sizes the loop runs the exact same number of iterations as before, so there is no behavior change for normal input.",
    "",
    "Test plan: `npx uvu . \"non-secure.test.cjs$\"` passes 11/11. Without the guard the two new negative-size tests hang the runner; with it `nanoid(-1)` and `customAlphabet('abcdef')(-1)` return an empty string.",
  ].join("\n"),
  head: "19327bed5502dded510ca941cbd35c49155cdc94",
  mergedAt: "2026-07-12T08:21:54Z",
  number: 601,
  title: "fix(non-secure): clamp negative size to prevent infinite loop",
  url: "https://github.com/ai/nanoid/pull/601",
});

const changedFiles = Object.freeze([
  Object.freeze({
    additions: 4,
    deletions: 2,
    path: "non-secure/index.cjs",
    patch: [
      "@@ -11,8 +11,9 @@ let customAlphabet = (alphabet, defaultSize = 21) => {",
      "   return (size = defaultSize) => {",
      "     let id = ''",
      "     // A compact alternative for `for (var i = 0; i < step; i++)`.",
      "+    // `> 0` stops a negative size from looping forever.",
      "     let i = size | 0",
      "-    while (i--) {",
      "+    while (i-- > 0) {",
      "       // `| 0` is more compact and faster than `Math.floor()`.",
      "       id += alphabet[(Math.random() * alphabet.length) | 0]",
      "     }",
      "@@ -23,8 +24,9 @@ let nanoid = (size = 21) => {",
      " let nanoid = (size = 21) => {",
      "   let id = ''",
      "   // A compact alternative for `for (var i = 0; i < step; i++)`.",
      "+  // `> 0` stops a negative size from looping forever.",
      "   let i = size | 0",
      "-  while (i--) {",
      "+  while (i-- > 0) {",
      "     // `| 0` is more compact and faster than `Math.floor()`.",
      "     id += urlAlphabet[(Math.random() * 64) | 0]",
      "   }",
    ].join("\n"),
  }),
  Object.freeze({
    additions: 4,
    deletions: 2,
    path: "non-secure/index.js",
    patch: [
      "@@ -11,8 +11,9 @@ let customAlphabet = (alphabet, defaultSize = 21) => {",
      "   return (size = defaultSize) => {",
      "     let id = ''",
      "     // A compact alternative for `for (var i = 0; i < step; i++)`.",
      "+    // `> 0` stops a negative size from looping forever.",
      "     let i = size | 0",
      "-    while (i--) {",
      "+    while (i-- > 0) {",
      "       // `| 0` is more compact and faster than `Math.floor()`.",
      "       id += alphabet[(Math.random() * alphabet.length) | 0]",
      "     }",
      "@@ -23,8 +24,9 @@ let nanoid = (size = 21) => {",
      " let nanoid = (size = 21) => {",
      "   let id = ''",
      "   // A compact alternative for `for (var i = 0; i < step; i++)`.",
      "+  // `> 0` stops a negative size from looping forever.",
      "   let i = size | 0",
      "-  while (i--) {",
      "+  while (i-- > 0) {",
      "     // `| 0` is more compact and faster than `Math.floor()`.",
      "     id += urlAlphabet[(Math.random() * 64) | 0]",
      "   }",
    ].join("\n"),
  }),
  Object.freeze({
    additions: 10,
    deletions: 0,
    path: "test/non-secure.test.cjs",
    patch: [
      "@@ -104,4 +104,14 @@ test('customAlphabet / avoids pool pollution, infinite loop', () => {",
      "   not.equal(second, third)",
      " })",
      " ",
      "+test('nanoid / does not hang on negative size', () => {",
      "+  is(nanoid(-1), '')",
      "+  is(nanoid(-100), '')",
      "+})",
      "+",
      "+test('customAlphabet / does not hang on negative size', () => {",
      "+  is(customAlphabet('abcdef')(-1), '')",
      "+  is(customAlphabet('abcdef', -5)(), '')",
      "+})",
      "+",
      " test.run()",
    ].join("\n"),
  }),
]);

const words = Object.freeze({
  "en-US": Object.freeze({
    align: Object.freeze({
      assumption: "The server keeps an idempotency key for 24 hours.",
      change: "The retry policy became the next explicit decision.",
      decision: "Version 1 keeps retry as a person-initiated action.",
      decisionReason: "Automatic retry needs separate background-work rules.",
      expected: "The second request resumes the same upload without another object.",
      fact: "The upload API already accepts an idempotency key.",
      goal: "Let a person retry a failed upload without creating a duplicate.",
      inScope: ["Interrupted uploads", "Manual retry", "Duplicate prevention"],
      openQuestion: "How long should a failed upload remain retryable?",
      optionA: "24 hours",
      optionADetail: "Matches the current idempotency-key lifetime.",
      optionB: "7 days",
      optionBDetail: "Helps long-running work but needs longer server state.",
      outOfScope: ["Automatic background retry", "Cross-device recovery"],
      rationale: "The retry window still changes storage and recovery behavior.",
      recommendation: "Start with 24 hours.",
      scenario: "A network failure interrupts an upload after half the file is sent.",
      sliceFailure: "Keep the failed upload visible and allow a fresh attempt.",
      sliceScope: "One failed upload and its manual retry action.",
      sliceTitle: "Retry one interrupted upload",
      sliceUserChange: "A person can retry without creating a duplicate.",
      sliceVerification: "Interrupt an upload, retry it, and confirm one stored object.",
      success: [
        "Retry continues the same logical upload.",
        "A repeated retry never creates a second stored object.",
      ],
      title: "Define failed upload recovery",
    }),
  }),
  "ko-KR": Object.freeze({
    align: Object.freeze({
      assumption: "서버는 멱등성 키를 24시간 보관합니다.",
      change: "재시도 가능 기간을 다음 명시적 결정으로 정했습니다.",
      decision: "첫 버전은 사용자가 직접 재시도합니다.",
      decisionReason: "자동 재시도에는 별도의 백그라운드 작업 규칙이 필요합니다.",
      expected: "두 번째 요청은 새 객체를 만들지 않고 같은 업로드를 이어갑니다.",
      fact: "업로드 API는 이미 멱등성 키를 받습니다.",
      goal: "중복 파일을 만들지 않고 실패한 업로드를 다시 시도할 수 있게 합니다.",
      inScope: ["중단된 업로드", "수동 재시도", "중복 방지"],
      openQuestion: "실패한 업로드를 얼마 동안 다시 시도할 수 있어야 하나요?",
      optionA: "24시간",
      optionADetail: "현재 멱등성 키 보관 기간과 같습니다.",
      optionB: "7일",
      optionBDetail: "오래 걸리는 작업에는 유리하지만 서버 상태를 더 오래 보관해야 합니다.",
      outOfScope: ["자동 백그라운드 재시도", "기기 간 복구"],
      rationale: "재시도 가능 기간은 저장과 복구 동작을 바꿉니다.",
      recommendation: "24시간으로 시작하세요.",
      scenario: "파일의 절반을 보낸 뒤 네트워크 오류로 업로드가 중단됩니다.",
      sliceFailure: "실패한 업로드를 표시하고 새 업로드를 시작할 수 있게 합니다.",
      sliceScope: "하나의 실패한 업로드와 수동 재시도 동작입니다.",
      sliceTitle: "중단된 업로드 한 건 재시도",
      sliceUserChange: "중복 파일 없이 업로드를 다시 시도할 수 있습니다.",
      sliceVerification: "업로드를 중단한 뒤 재시도하고 저장된 객체가 하나인지 확인합니다.",
      success: [
        "재시도는 같은 논리적 업로드를 이어갑니다.",
        "재시도를 반복해도 저장 객체가 하나만 생깁니다.",
      ],
      title: "실패한 업로드 복구 방식 정하기",
    }),
  }),
});

function alignState(locale) {
  const text = words[locale].align;
  const base = makeAlignState();
  const perspectiveText = locale === "ko-KR"
    ? {
        "experience-design": ["건너뜀", "화면 구조는 이번 결정의 핵심이 아닙니다."],
        "product-requirements": ["활성", "실패와 재시도 동작을 확정해야 합니다."],
        "program-design": ["활성", "재시도 상태와 멱등성 키의 관계를 정해야 합니다."],
        "shared-understanding": ["활성", "재시도라는 말이 여러 동작을 뜻할 수 있습니다."],
        "system-architecture": ["활성", "서버가 재시도 상태를 보관해야 합니다."],
        "vertical-slices": ["활성", "실패부터 복구까지 한 경로로 검증해야 합니다."],
      }
    : {
        "experience-design": ["skipped", "Screen structure is not the material decision here."],
        "product-requirements": ["active", "Failure and retry behavior must be settled."],
        "program-design": ["active", "Retry state and the idempotency key need one rule."],
        "shared-understanding": ["active", "Retry can describe several different behaviors."],
        "system-architecture": ["active", "The server must retain retry state."],
        "vertical-slices": ["active", "One path must verify failure through recovery."],
      };
  const stateByLabel = locale === "ko-KR"
    ? { "건너뜀": "skipped", "활성": "active" }
    : { active: "active", skipped: "skipped" };
  return {
    ...base,
    changes: [{ round: 2, summary: text.change }],
    interviewRounds: 2,
    locale,
    readiness: {
      rationale: text.rationale,
      state: "interviewing",
    },
    records: {
      decisions: [{
        id: "decision-1",
        rationale: text.decisionReason,
        sourceIds: ["conversation-1"],
        text: text.decision,
      }],
      facts: [{
        id: "fact-1",
        sourceIds: ["repository-1"],
        text: text.fact,
      }],
      openQuestions: [{
        id: "question-1",
        options: [
          { effect: text.optionADetail, label: text.optionA },
          { effect: text.optionBDetail, label: text.optionB },
        ],
        question: text.openQuestion,
        recommendation: text.recommendation,
        whyItMatters: text.rationale,
      }],
      proposals: [],
    },
    revision: 2,
    slices: [{
      failureRecovery: text.sliceFailure,
      id: "slice-1",
      scope: text.sliceScope,
      title: text.sliceTitle,
      userChange: text.sliceUserChange,
      verification: text.sliceVerification,
    }],
    taskRisk: "medium",
    theme: "light",
    title: text.title,
    ui: false,
    understanding: {
      goal: text.goal,
      inScope: text.inScope,
      outOfScope: text.outOfScope,
      scenarios: [{
        expected: text.expected,
        id: "scenario-1",
        kind: "edge",
        situation: text.scenario,
      }],
      success: text.success,
    },
    assumptions: [{
      id: "assumption-1",
      origin: "repository",
      sourceIds: ["repository-1"],
      status: "open",
      text: text.assumption,
    }],
    uncertainties: [],
    perspectives: base.perspectives.map((perspective) => {
      const [stateLabel, reason] = perspectiveText[perspective.kind];
      const state = stateByLabel[stateLabel];
      return {
        ...perspective,
        items: state === "active"
          ? [{ detail: reason, title: perspective.kind }]
          : [],
        reason,
        state,
      };
    }),
  };
}

function diffSnapshot(locale) {
  const sources = [
    {
      id: "source-1",
      kind: "pull-request-title",
      lineCount: 1,
      text: pullRequest.title,
    },
    {
      id: "source-2",
      kind: "pull-request-description",
      lineCount: pullRequest.body.split("\n").length,
      text: pullRequest.body,
    },
    {
      id: "source-3",
      kind: "commit-title",
      lineCount: 1,
      revision: pullRequest.head,
      text: pullRequest.title,
    },
    ...changedFiles.map((file, index) => ({
      fileId: `file-${index + 1}`,
      id: `source-${index + 4}`,
      kind: "patch",
      lineCount: file.patch.split("\n").length,
      path: file.path,
      revision: pullRequest.head,
      text: file.patch,
    })),
  ];
  const value = {
    capturedAt: "2026-07-29T10:00:00.000Z",
    files: changedFiles.map((file, index) => ({
      additions: file.additions,
      bodyState: "included",
      deletions: file.deletions,
      id: `file-${index + 1}`,
      path: file.path,
      providerStatus: "modified",
      sourceIds: [`source-${index + 4}`],
    })),
    limits: [
      {
        id: "limit-1",
        kind: "unchanged-context",
        reason: "Other unchanged code was not collected.",
        subject: "Other unchanged code outside collected context",
      },
      {
        id: "limit-2",
        kind: "verification",
        reason: "Hope did not run tests, builds, lint, or CI.",
        subject: "Execution and CI results",
      },
    ],
    pullRequest: {
      author: pullRequest.author,
      number: pullRequest.number,
      state: "closed",
      title: pullRequest.title,
      url: pullRequest.url,
    },
    repository: {
      name: "nanoid",
      owner: "ai",
      provider: "github",
    },
    schemaVersion: 1,
    settings: {
      locale,
      localeSource: "override",
      theme: "light",
      themeSource: "override",
    },
    snapshot: {
      base: pullRequest.base,
      head: pullRequest.head,
      mergeBase: pullRequest.base,
    },
    sources,
  };
  return Object.freeze({ ...value, digest: digestJson(value) });
}

function ref(sourceId, startLine, endLine = startLine) {
  return { endLine, sourceId, startLine };
}

function diffAnalysis(snapshot) {
  const ko = snapshot.settings.locale === "ko-KR";
  const t = ko
    ? {
        after: "음수 길이는 반복을 시작하지 않고 빈 문자열을 반환합니다.",
        before: "음수 길이는 감소 조건이 끝나지 않아 문자열을 계속 늘릴 수 있었습니다.",
        codeGuard: "두 비보안 모듈의 반복 조건에 양수 검사를 추가했습니다.",
        codeTest: "음수 길이가 빈 문자열을 반환하는 회귀 테스트를 추가했습니다.",
        contextChanged: "변경된 두 반복문과 음수 입력 테스트를 확인했습니다.",
        contextOther: "수집하지 않은 기존 호출자는 확인하지 않았습니다.",
        contextRun: "PR에는 테스트 결과가 적혀 있지만 Hope가 직접 실행하지는 않았습니다.",
        detail: "변경은 일반 nanoid와 customAlphabet의 비보안 구현에 같은 종료 조건을 적용합니다.",
        impactOther: "핵심 변경은 자체적으로 설명되므로 수집하지 않은 호출자는 주요 설명을 제한하지 않습니다.",
        impactRun: "테스트 통과 주장은 출처에만 적혀 있어 실행으로 확인해야 합니다.",
        purpose: "음수 길이 때문에 비보안 ID 생성이 끝나지 않는 문제를 막습니다.",
        reviewDone: "v3 브랜치에서 음수 길이 테스트를 실행해 모두 끝나고 빈 문자열을 반환합니다.",
        reviewEffect: "코드와 테스트는 의도를 보여 주지만 실제 v3 테스트 결과는 확인하지 못했습니다.",
        reviewExplanation: "PR 설명은 11개 테스트가 통과했다고 말하지만 이번 Diff는 명령을 실행하지 않습니다.",
        reviewNext: "v3 브랜치에서 제시된 uvu 명령을 실행하세요.",
        reviewTitle: "v3 테스트 결과 확인",
        why: "정상 길이의 반복 횟수는 유지하면서 음수 입력의 무한 반복만 막습니다.",
      }
    : {
        after: "A negative size skips the loop and returns an empty string.",
        before: "A negative size could keep decrementing and grow the string without ending.",
        codeGuard: "Both non-secure modules add a positive-value guard to the loop.",
        codeTest: "Regression tests expect negative sizes to return an empty string.",
        contextChanged: "The two changed loops and negative-size tests were checked.",
        contextOther: "Other unchanged callers were not collected.",
        contextRun: "The PR states a test result, but Hope did not run it.",
        detail: "The change applies the same stopping condition to nanoid and customAlphabet.",
        impactOther: "The changed branch is self-contained, so unchecked callers do not limit the main explanation.",
        impactRun: "The stated passing test result still needs execution evidence.",
        purpose: "Stop non-secure ID generation from looping forever on a negative size.",
        reviewDone: "The stated v3 test command finishes and every negative-size case returns an empty string.",
        reviewEffect: "The code and tests show the intended behavior, but the v3 result was not observed.",
        reviewExplanation: "The PR says 11 tests pass, while this Diff does not execute commands.",
        reviewNext: "Run the stated uvu command on the v3 branch.",
        reviewTitle: "Confirm the v3 test result",
        why: "Normal sizes keep the same iteration count while negative input can no longer loop forever.",
      };
  return {
    behavior: {
      steps: [
        {
          basis: "code",
          evidence: [ref("source-4", 6, 8)],
          text: ko ? "입력 길이를 32비트 정수로 바꿉니다." : "The requested size becomes a 32-bit integer.",
        },
        {
          basis: "code",
          evidence: [ref("source-4", 7, 8)],
          text: ko ? "값이 0보다 클 때만 반복합니다." : "The loop runs only while the value is greater than zero.",
        },
      ],
      summary: {
        basis: "code",
        evidence: [ref("source-4", 5, 8), ref("source-6", 5, 13)],
        text: ko ? "음수 길이는 즉시 빈 문자열로 끝납니다." : "A negative size now finishes immediately with an empty string.",
      },
      visual: {
        basis: "code",
        caption: ko
          ? "입력 길이에 따라 이전과 이후 동작을 비교합니다."
          : "The loop outcome changes only for negative input.",
        columns: ko ? ["이전", "이후"] : ["Before", "After"],
        evidence: [ref("source-4", 5, 8), ref("source-6", 5, 13)],
        kind: "decision-table",
        rows: [
          {
            case: ko ? "음수" : "Negative",
            cells: ko
              ? ["감소를 계속함", "반복하지 않고 종료"]
              : ["Keeps decrementing", "Skips the loop"],
          },
          {
            case: ko ? "0" : "Zero",
            cells: ko ? ["반복하지 않음", "반복하지 않음"] : ["Skips the loop", "Skips the loop"],
          },
          {
            case: ko ? "양수" : "Positive",
            cells: ko ? ["요청한 횟수만큼 반복", "같은 횟수만큼 반복"] : ["Runs requested times", "Runs the same times"],
          },
        ],
        title: ko ? "길이별 반복 결과" : "Loop result by size",
      },
    },
    codeSteps: [
      {
        basis: "code",
        evidence: [ref("source-4", 5, 8), ref("source-5", 5, 8)],
        fileIds: ["file-1", "file-2"],
        text: t.codeGuard,
        title: ko ? "반복 종료 조건 추가" : "Add the stopping guard",
      },
      {
        basis: "code",
        evidence: [ref("source-6", 5, 13)],
        fileIds: ["file-3"],
        text: t.codeTest,
        title: ko ? "음수 입력 회귀 테스트" : "Cover negative input",
      },
    ],
    contextChecks: [
      {
        basis: "code",
        evidence: [ref("source-4", 5, 8), ref("source-6", 5, 13)],
        explanation: t.contextChanged,
        limitIds: [],
        status: "checked",
        subject: ko ? "변경된 반복 동작과 테스트" : "Changed loop behavior and tests",
      },
      {
        basis: "unknown",
        evidence: [],
        explanation: t.contextOther,
        limitIds: ["limit-1"],
        status: "limited",
        subject: ko ? "수집 범위 밖의 기존 코드" : "Other unchanged code",
      },
      {
        basis: "unknown",
        evidence: [],
        explanation: t.contextRun,
        limitIds: ["limit-2"],
        status: "limited",
        subject: ko ? "실행과 CI 결과" : "Execution and CI results",
      },
    ],
    coreChange: {
      after: {
        basis: "code",
        evidence: [ref("source-4", 5, 8), ref("source-6", 5, 13)],
        text: t.after,
      },
      before: {
        basis: "code",
        evidence: [ref("source-4", 6, 8)],
        text: t.before,
      },
      details: [{
        basis: "code",
        evidence: [ref("source-4", 5, 8), ref("source-5", 5, 8)],
        text: t.detail,
      }],
      why: {
        basis: "inferred",
        evidence: [ref("source-2", 1), ref("source-4", 5, 8)],
        text: t.why,
      },
    },
    fileDispositions: [
      { disposition: "explained", fileId: "file-1" },
      { disposition: "supporting", fileId: "file-2" },
      { disposition: "supporting", fileId: "file-3" },
    ],
    limitImpacts: [
      {
        impact: t.impactOther,
        limitId: "limit-1",
        material: false,
      },
      {
        impact: t.impactRun,
        limitId: "limit-2",
        material: true,
      },
    ],
    locale: snapshot.settings.locale,
    purpose: {
      basis: "stated",
      evidence: [ref("source-2", 1)],
      text: t.purpose,
    },
    reviewItems: [{
      basis: "stated",
      doneWhen: t.reviewDone,
      effect: t.reviewEffect,
      evidence: [ref("source-2", 9)],
      explanation: t.reviewExplanation,
      importance: "medium",
      kind: "verify",
      limitIds: ["limit-2"],
      nextStep: t.reviewNext,
      title: t.reviewTitle,
    }],
    runId,
    schemaVersion: 2,
    snapshotDigest: snapshot.digest,
    teachingAids: {
      microworld: {
        decision: "omitted",
        reason: ko ? "결정표로 모든 입력 범주를 설명할 수 있습니다." : "The decision table covers every input category.",
      },
      quiz: {
        decision: "omitted",
        reason: ko ? "핵심 예측은 결정표에서 바로 확인할 수 있습니다." : "The main prediction is already visible in the table.",
      },
      visual: {
        decision: "included",
        reason: ko ? "입력 범주별 동작 차이를 한눈에 보여 줍니다." : "It makes the one changed input category easy to compare.",
        teachingJob: ko ? "음수, 0, 양수 입력의 결과 비교" : "Compare negative, zero, and positive input.",
      },
    },
  };
}

async function capturePage(page, htmlPath, outputPath, {
  height = 840,
  width = 1440,
} = {}) {
  await page.setViewportSize({ height, width });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(async () => await document.fonts.ready);
  await page.screenshot({
    clip: { height, width, x: 0, y: 0 },
    path: outputPath,
    type: "png",
  });
}

async function captureElement(page, outputPath, selector, {
  expandDetails = false,
} = {}) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  if (expandDetails) {
    await element.locator("details").evaluateAll((details) => {
      for (const detail of details) detail.open = true;
    });
  }
  await element.screenshot({
    animations: "disabled",
    path: outputPath,
    type: "png",
  });
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const temporary = await mkdtemp(join(tmpdir(), "hope-readme-assets-"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const locale of ["en-US", "ko-KR"]) {
      const suffix = locale === "ko-KR" ? "ko" : "en";
      const align = await renderAlignSession(validateAlignState(alignState(locale)));
      const alignPath = join(temporary, `align-${suffix}.html`);
      await writeFile(alignPath, align.bytes);
      await capturePage(
        page,
        alignPath,
        join(outputDirectory, `hope-align-${suffix}.png`),
        { height: 820 },
      );
      for (const [name, selector, expandDetails] of [
        ["scope", "#scope", false],
        ["scenarios", "#scenarios", false],
        ["understanding", "#records", true],
        ["work", "#slices", false],
      ]) {
        await captureElement(
          page,
          join(outputDirectory, `hope-align-${name}-${suffix}.png`),
          selector,
          { expandDetails },
        );
      }

      const snapshot = diffSnapshot(locale);
      const review = validateAnalysis(diffAnalysis(snapshot), snapshot, { runId });
      const diff = await renderReview(review);
      const diffPath = join(temporary, `diff-${suffix}.html`);
      await writeFile(diffPath, diff.bytes);
      await capturePage(
        page,
        diffPath,
        join(outputDirectory, `hope-diff-${suffix}.png`),
        { height: 820 },
      );
      for (const [name, selector, expandDetails] of [
        ["core", "#core-change", false],
        ["behavior", "#explore", false],
        ["teaching", "#teaching-aids", false],
        ["code", "#follow-code", true],
        ["review", "#judge", true],
        ["evidence", "#evidence-and-scope", false],
      ]) {
        await captureElement(
          page,
          join(outputDirectory, `hope-diff-${name}-${suffix}.png`),
          selector,
          { expandDetails },
        );
      }
    }
  } finally {
    await browser.close();
    await rm(temporary, { force: true, recursive: true });
  }
  process.stdout.write(`Rendered README assets in ${outputDirectory}\n`);
}

await main();
