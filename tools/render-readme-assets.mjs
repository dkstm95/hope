#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { validateAlignInput } from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";
import { digestJson } from "../plugins/hope/skills/diff/scripts/hash.mjs";
import { renderReview } from "../plugins/hope/skills/diff/scripts/render.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";

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

function alignInput(locale, theme, overrides = {}) {
  const ko = locale === "ko-KR";
  return {
    schemaVersion: 1,
    locale,
    theme,
    title: ko ? "실패한 업로드 복구" : "Failed upload recovery",
    intent: ko
      ? "중단된 업로드를 감지해 사용자가 데이터 손실 없이 이어서 완료하거나 안전하게 취소할 수 있게 한다."
      : "Detect interrupted uploads so people can resume without losing data or cancel safely.",
    problem: ko
      ? "업로드가 중단되면 파일이 손실되거나 불완전한 상태로 남을 수 있다."
      : "When an upload stops, the file can be lost or left incomplete.",
    success: ko
      ? [
          "중단 지점부터 이어서 업로드를 완료할 수 있다.",
          "관련 없는 데이터 손실 없이 안전하게 취소할 수 있다.",
        ]
      : [
          "Resume from the interruption point and finish the upload.",
          "Cancel safely without losing unrelated data.",
        ],
    boundary: ko
      ? "사용자 기기와 서버가 업로드를 식별할 수 있고 임시 데이터가 남아 있는 동안만 복구한다."
      : "Recovery is available only while the device and server can identify the upload and temporary data remains.",
    scope: {
      included: ko
        ? [
            "중단된 업로드 감지 및 복구 항목 제공",
            "중단 지점부터 이어 업로드",
            "보관 기간 내 임시 데이터 유지",
          ]
        : [
            "Detect interrupted uploads and show recovery items",
            "Resume from the interruption point",
            "Keep temporary data during the retention period",
          ],
      excluded: ko
        ? [
            "다른 사용자의 업로드 인계",
            "서버 보관 기간이 지난 항목 복구",
            "암호화 키 분실 시 복구",
          ]
        : [
            "Transfer an upload to another person",
            "Recover items after the server retention period",
            "Recover data after an encryption key is lost",
          ],
    },
    behavior: {
      steps: ko
        ? [
            { title: "중단 감지", detail: "업로드 중단을 감지한다." },
            { title: "복구 항목 유지", detail: "항목과 상태를 복구 목록에 유지한다." },
            { title: "사용자 선택", detail: "이어 완료하거나 안전하게 취소한다." },
          ]
        : [
            { title: "Detect interruption", detail: "Detect when an upload stops." },
            { title: "Keep recovery item", detail: "Keep the item and state in the recovery list." },
            { title: "Choose next step", detail: "Resume the upload or cancel it safely." },
          ],
      outcomes: ko
        ? [
            { title: "이어 완료", detail: "중단 지점부터 업로드를 완료한다.", kind: "complete" },
            { title: "안전하게 취소", detail: "임시 데이터를 제거하고 복구를 끝낸다.", kind: "cancel" },
          ]
        : [
            { title: "Resume upload", detail: "Finish the upload from the interruption point.", kind: "complete" },
            { title: "Cancel safely", detail: "Remove temporary data and end recovery.", kind: "cancel" },
          ],
    },
    decisions: ko
      ? [
          {
            decision: "자동 감지 기반 복구 우선",
            reason: "사용자 개입 없이 중단 항목을 찾아 복구 기회를 제공한다.",
          },
          {
            decision: "서버 측 임시 보관",
            reason: "안정적인 복구를 위해 제한된 기간 동안 임시 데이터를 유지한다.",
          },
        ]
      : [
          {
            decision: "Prefer automatic recovery detection",
            reason: "Find interrupted items without user setup and offer a recovery path.",
          },
          {
            decision: "Keep temporary data on the server",
            reason: "Retain temporary data for a limited time so recovery remains reliable.",
          },
        ],
    openChoices: ko
      ? [
          "재시도 및 백오프 정책",
          "임시 데이터 보관 기간",
          "알림 시점과 방식",
        ]
      : [
          "Retry and backoff policy",
          "Temporary data retention period",
          "Notification timing and channel",
        ],
    evidence: ko
      ? [
          { label: "업로드 복구 서비스", location: "src/upload/recovery.ts" },
          { label: "제품 요구사항", location: "docs/upload-recovery.md" },
        ]
      : [
          { label: "Upload recovery service", location: "src/upload/recovery.ts" },
          { label: "Product requirement", location: "docs/upload-recovery.md" },
        ],
    revisionSummary: ko
      ? "복구 기간과 취소 경계를 명확히 함"
      : "Clarified the recovery period and cancellation boundary",
    ...overrides,
  };
}

function alignRevision(input, number, agreedAt) {
  const validated = validateAlignInput(input);
  const {
    locale: _locale,
    revisionSummary,
    schemaVersion: _schemaVersion,
    theme: _theme,
    ...content
  } = validated;
  return {
    agreedAt,
    content,
    number,
    summary: revisionSummary,
  };
}

function alignArtifact(locale, theme) {
  const ko = locale === "ko-KR";
  const first = alignInput(locale, theme, {
    boundary: ko
      ? "사용자 기기와 서버가 업로드를 식별할 수 있는 동안만 복구한다."
      : "Recovery is available only while the device and server can identify the upload.",
    revisionSummary: ko ? "최초 합의" : "Initial agreement",
  });
  const current = alignInput(locale, theme);
  const data = {
    schemaVersion: 1,
    alignId: "11111111-1111-4111-8111-111111111111",
    repository: "acme/storage",
    locale,
    theme,
    createdAt: "2026-08-14T00:00:00.000Z",
    revisions: [
      alignRevision(first, 1, "2026-08-14T00:00:00.000Z"),
      alignRevision(current, 2, "2026-08-21T00:00:00.000Z"),
    ],
  };
  return Buffer.from(renderAlignArtifact(data, { digest: "0".repeat(64) }));
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
        detail: "두 비보안 ID 생성 방식 모두 음수 길이에서 바로 끝납니다.",
        impactOther: "핵심 변경은 자체적으로 설명되므로 수집하지 않은 호출자는 주요 설명을 제한하지 않습니다.",
        impactRun: "테스트 통과 주장은 출처에만 적혀 있어 실행으로 확인해야 합니다.",
        purpose: "음수 길이 때문에 비보안 ID 생성이 끝나지 않는 문제를 막습니다.",
        title: "음수 길이에서도 비보안 ID 생성이 바로 끝납니다.",
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
        detail: "Both non-secure ID generators now stop immediately for a negative size.",
        impactOther: "The changed branch is self-contained, so unchecked callers do not limit the main explanation.",
        impactRun: "The stated passing test result still needs execution evidence.",
        purpose: "Stop non-secure ID generation from looping forever on a negative size.",
        title: "Non-secure ID generation now stops for negative sizes.",
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
        text: t.codeGuard,
        title: ko ? "반복 종료 조건 추가" : "Add the stopping guard",
      },
      {
        basis: "code",
        evidence: [ref("source-6", 5, 13)],
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
    title: {
      basis: "code",
      evidence: [ref("source-4", 6, 8), ref("source-5", 5, 8)],
      text: t.title,
    },
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
    schemaVersion: 3,
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

async function loadPage(page, htmlPath, {
  height = 840,
  width = 1440,
} = {}) {
  await page.setViewportSize({ height, width });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(async () => await document.fonts.ready);
}

async function capturePage(page, htmlPath, outputPath, options = {}) {
  const { height = 840, width = 1440 } = options;
  await loadPage(page, htmlPath, { height, width });
  await page.screenshot({
    clip: { height, width, x: 0, y: 0 },
    path: outputPath,
    type: "png",
  });
}

async function captureElement(page, outputPath, selector, {
  capturePadding = 0,
  expandDetails = false,
  hideStickyHeader = false,
} = {}) {
  if (hideStickyHeader) {
    await page.locator(".topbar").evaluate((topbar) => {
      topbar.style.position = "absolute";
    });
  }
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  if (expandDetails) {
    await element.evaluate((target) => {
      if (target.matches("details")) target.open = true;
    });
    await element.locator("details").evaluateAll((details) => {
      for (const detail of details) detail.open = true;
    });
  }
  if (capturePadding === 0) {
    await element.screenshot({
      animations: "disabled",
      path: outputPath,
      type: "png",
    });
    return;
  }
  const previousStyle = await element.getAttribute("style");
  await element.evaluate((target, padding) => {
    const style = getComputedStyle(target);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      target.style[`padding${side}`] = `${Number.parseFloat(style[`padding${side}`]) + padding}px`;
    }
  }, capturePadding);
  try {
    await element.screenshot({
      animations: "disabled",
      path: outputPath,
      type: "png",
    });
  } finally {
    await element.evaluate((target, style) => {
      if (style === null) target.removeAttribute("style");
      else target.setAttribute("style", style);
    }, previousStyle);
  }
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const temporary = await mkdtemp(join(tmpdir(), "hope-readme-assets-"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const locale of ["en-US", "ko-KR"]) {
      const suffix = locale === "ko-KR" ? "ko" : "en";
      const alignLightPath = join(temporary, `align-light-${suffix}.html`);
      const alignDarkPath = join(temporary, `align-dark-${suffix}.html`);
      await writeFile(alignLightPath, alignArtifact(locale, "light"));
      await writeFile(alignDarkPath, alignArtifact(locale, "dark"));
      await capturePage(
        page,
        alignLightPath,
        join(outputDirectory, `hope-align-${suffix}.png`),
        { height: 900 },
      );
      await captureElement(
        page,
        join(outputDirectory, `hope-align-decisions-${suffix}.png`),
        "#agreement",
      );
      await loadPage(page, alignDarkPath, { height: 900 });
      await captureElement(
        page,
        join(outputDirectory, `hope-align-behavior-${suffix}.png`),
        "#behavior",
      );

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
      for (const [name, selector, expandDetails, capturePadding] of [
        ["core", "#core-change", false, 16],
        ["behavior", "#explore > .behavior-model", false, 16],
        ["teaching", "#teaching-aids", true, 16],
        ["code", "#implementation-details", true, 16],
        ["review", "#judge", true, 16],
        ["evidence", "#evidence-and-scope", false, 16],
      ]) {
        await captureElement(
          page,
          join(outputDirectory, `hope-diff-${name}-${suffix}.png`),
          selector,
          {
            capturePadding,
            expandDetails,
            hideStickyHeader: name === "behavior",
          },
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
