import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { digestJson } from "../plugins/hope/skills/diff/scripts/hash.mjs";
import { renderReview } from "../plugins/hope/skills/diff/scripts/render.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingAidDecisions,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";

const runId = "4".repeat(32);
const viewports = {
  breakpoint: { height: 900, width: 1099 },
  desktop: { height: 900, width: 1440 },
  mobile: { height: 812, width: 375 },
  wide: { height: 1440, width: 2560 },
};

let artifactDirectory;
let artifactUrl;
let omittedArtifactUrl;
const visualArtifactUrls = {};

test.beforeAll(async () => {
  artifactDirectory = await mkdtemp(join(tmpdir(), "hope-browser-review-"));
  const baseSnapshot = makeSnapshot({
    locale: "ko-KR",
    title: "마지막 재시도 오류를 보존하고 아주 긴 경로에서도 화면 너비를 유지합니다",
  });
  const snapshotValue = {
    ...baseSnapshot,
    sources: baseSnapshot.sources.map((source) => (
      source.id === "source-3"
        ? {
          ...source,
          text: "@@ -1 +1,2 @@\n-throw new Error()\n+const last = error\n"
            + `+throw ${"veryLongIdentifier".repeat(120)}`,
        }
        : source
    )),
  };
  delete snapshotValue.digest;
  const snapshot = Object.freeze({
    ...snapshotValue,
    digest: digestJson(snapshotValue),
  });
  const analysis = makeAnalysis(snapshot, runId);
  analysis.title = {
    basis: "code",
    evidence: [{ endLine: 4, sourceId: "source-3", startLine: 2 }],
    text: "마지막 재시도 오류가 호출자에게 그대로 전달됩니다.",
  };
  analysis.beginnerPrimer = [{
    basis: "code",
    evidence: [{
      endLine: 4,
      sourceId: "source-3",
      startLine: 2,
    }],
    text: "재시도 경계는 마지막 오류가 호출자에게 전달되는 지점입니다.",
    title: "처음 보는 독자를 위한 재시도 경계",
  }];
  const behaviorRanges = [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ];
  analysis.behavior = {
    microworld: {
      basis: "code",
      controls: [
        {
          defaultOptionId: "failed",
          id: "attempt",
          kind: "input",
          label: "마지막 시도",
          options: [
            { id: "failed", label: "실패" },
            { id: "succeeded", label: "성공" },
          ],
        },
        {
          defaultOptionId: "present",
          id: "saved-error",
          kind: "state",
          label: "저장된 오류",
          options: [
            { id: "missing", label: "없음" },
            { id: "present", label: "있음" },
          ],
        },
      ],
      evidence: [{
        endLine: 4,
        sourceId: "source-3",
        startLine: 2,
      }],
      instructions: "마지막 시도와 저장 상태를 바꿔 호출자에게 전달되는 결과를 비교하세요.",
      omits: "변경된 분기 밖의 호출자별 복구와 로깅",
      scenarios: [
        {
          after: {
            outcome: "일반 오류가 전달됩니다.",
            steps: ["마지막 시도가 실패합니다.", "일반 오류를 사용합니다."],
          },
          before: {
            outcome: "일반 오류가 전달됩니다.",
            steps: ["마지막 시도가 실패합니다.", "일반 오류를 만듭니다."],
          },
          id: "failed-missing",
          lesson: "저장된 오류가 없으면 보이는 결과가 같습니다.",
          title: "실패했고 저장된 오류가 없음",
          when: [
            { controlId: "attempt", optionId: "failed" },
            { controlId: "saved-error", optionId: "missing" },
          ],
        },
        {
          after: {
            outcome: "저장된 마지막 오류가 전달됩니다.",
            steps: ["마지막 시도가 실패합니다.", "저장된 오류를 사용합니다."],
          },
          before: {
            outcome: "일반 오류가 전달됩니다.",
            steps: ["마지막 시도가 실패합니다.", "마지막 오류를 버립니다."],
          },
          id: "failed-present",
          lesson: "저장된 마지막 오류가 있을 때만 변경 결과가 드러납니다.",
          title: "실패했고 저장된 오류가 있음",
          when: [
            { controlId: "attempt", optionId: "failed" },
            { controlId: "saved-error", optionId: "present" },
          ],
        },
        {
          after: "unchanged",
          before: {
            outcome: "성공 값이 계속 전달됩니다.",
            steps: ["마지막 시도가 성공합니다.", "성공 값을 유지합니다."],
          },
          id: "succeeded-missing",
          lesson: "성공 경로의 보이는 결과는 바뀌지 않습니다.",
          title: "성공했고 저장된 오류가 없음",
          when: [
            { controlId: "attempt", optionId: "succeeded" },
            { controlId: "saved-error", optionId: "missing" },
          ],
        },
        {
          after: {
            outcome: "성공 값이 계속 전달됩니다.",
            steps: ["마지막 시도가 성공합니다.", "저장된 오류를 사용하지 않습니다."],
          },
          before: {
            outcome: "성공 값이 계속 전달됩니다.",
            steps: ["마지막 시도가 성공합니다.", "성공 값을 반환합니다."],
          },
          id: "succeeded-present",
          lesson: "성공하면 저장된 오류 상태가 결과를 바꾸지 않습니다.",
          title: "성공했고 저장된 오류가 있음",
          when: [
            { controlId: "attempt", optionId: "succeeded" },
            { controlId: "saved-error", optionId: "present" },
          ],
        },
      ],
      simplifies: "재시도 완료를 마지막 한 번의 분기로 표현함",
      title: "재시도 결과 실험",
    },
    steps: Array.from({ length: 4 }, (_, index) => ({
      ...analysis.coreChange.after,
      evidence: [{
        endLine: behaviorRanges[index][1],
        sourceId: "source-3",
        startLine: behaviorRanges[index][0],
      }],
      text: index === 0 ? "x".repeat(80) : `동작 단계 ${index + 1}`,
    })),
    summary: {
      ...analysis.coreChange.after,
      text: "네 단계로 이어지는 변경 동작입니다.",
    },
    visual: {
      basis: "code",
      caption: "저장된 오류의 유무에 따라 실패 결과를 비교합니다.",
      columns: ["이전", "이후"],
      evidence: [{
        endLine: 4,
        sourceId: "source-3",
        startLine: 2,
      }],
      kind: "decision-table",
      rows: [
        { case: "저장된 오류 없음", cells: ["일반 오류", "일반 오류"] },
        { case: "저장된 오류 있음", cells: ["일반 오류", "마지막 오류"] },
      ],
      title: "실패 결과 비교",
    },
  };
  analysis.reviewItems = [
    {
      ...analysis.reviewItems[0],
      importance: "high",
      kind: "decide",
      title: "긴 호환성 정책을 유지할지 담당자와 결정",
    },
    {
      ...analysis.reviewItems[0],
      importance: "high",
      kind: "verify",
      title: "재시도 경로를 다시 검증",
    },
    {
      ...analysis.reviewItems[0],
      importance: "medium",
      kind: "verify",
      title: "기존 호출자의 동작을 확인",
    },
    {
      ...analysis.reviewItems[0],
      importance: "low",
      kind: "resolve",
      title: "첫 화면에서 숨겨진 해결 항목",
    },
  ];
  analysis.quiz = Array.from({ length: 3 }, (_, index) => ({
    answer: `마지막 재시도 오류가 호출자에게 전달됩니다. ${index + 1}`,
    evidence: [{
      endLine: 4,
      sourceId: "source-3",
      startLine: 2,
    }],
    question: `모든 재시도가 실패하면 어떤 오류가 전달되나요? ${index + 1}`,
  }));
  analysis.teachingAids = makeTeachingAidDecisions({
    microworld: true,
    quiz: true,
    visual: true,
  });
  const review = validateAnalysis(analysis, snapshot, { runId });
  const rendered = await renderReview(review);
  const artifactPath = join(artifactDirectory, "hope-review.html");
  await writeFile(artifactPath, rendered.bytes);
  artifactUrl = pathToFileURL(artifactPath).href;

  const omittedSnapshot = makeSnapshot({ locale: "ko-KR" });
  const omittedAnalysis = makeAnalysis(omittedSnapshot, runId);
  for (const choice of Object.values(omittedAnalysis.teachingAids)) {
    choice.reason = "글만으로도 이 변경을 쉽게 이해할 수 있습니다.";
  }
  const omittedReview = validateAnalysis(omittedAnalysis, omittedSnapshot, { runId });
  const omittedRendered = await renderReview(omittedReview);
  const omittedPath = join(artifactDirectory, "all-aids-omitted.html");
  await writeFile(omittedPath, omittedRendered.bytes);
  omittedArtifactUrl = pathToFileURL(omittedPath).href;

  const visualSnapshot = makeSnapshot();
  for (const kind of ["sequence", "component-map"]) {
    const visualAnalysis = makeAnalysis(visualSnapshot, runId);
    visualAnalysis.behavior = makeTeachingBehavior({
      includeMicroworld: false,
      visualKind: kind,
    });
    visualAnalysis.teachingAids = makeTeachingAidDecisions({ visual: true });
    visualAnalysis.teachingAids.microworld = {
      decision: "not-applicable",
      reason: "This change has no bounded state to explore.",
    };
    const visualReview = validateAnalysis(visualAnalysis, visualSnapshot, { runId });
    const visualRendered = await renderReview(visualReview);
    const visualPath = join(artifactDirectory, `${kind}.html`);
    await writeFile(visualPath, visualRendered.bytes);
    visualArtifactUrls[kind] = pathToFileURL(visualPath).href;
  }
});

test.afterAll(async () => {
  if (artifactDirectory) {
    await rm(artifactDirectory, { force: true, recursive: true });
  }
});

async function openArtifact(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(artifactUrl);
}

async function expectNoPageOverflow(page) {
  const overflow = await page.evaluate(() => ({
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
    rootClient: document.documentElement.clientWidth,
    rootScroll: document.documentElement.scrollWidth,
  }));
  expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient);
  expect(overflow.rootScroll).toBeLessThanOrEqual(overflow.rootClient);
}

test("desktop and mobile keep wide content inside the document", async ({ page }) => {
  const remoteRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) remoteRequests.push(request.url());
  });
  await openArtifact(page, viewports.desktop);
  await expect(page.locator(".claim-meta")).toHaveCount(0);
  await expect(page.locator("#core-change .claim-basis")).toHaveCount(0);
  const microworldInstruction = page.locator(".microworld > header > p").filter({
    hasText: "마지막 시도와 저장 상태를 바꿔 호출자에게 전달되는 결과를 비교하세요.",
  });
  await expect(microworldInstruction.locator(".evidence-marker")).toHaveCount(1);
  await expect(page.locator(".review-items-full .item-basis")).toHaveText([
    "근거에서 추론",
    "근거에서 추론",
    "근거에서 추론",
    "근거에서 추론",
  ]);
  await expect(page.locator("#synopsis-title")).toHaveText("01요약");
  const synopsisLabelStyle = await page.locator("#synopsis-title").evaluate(
    (element) => ({
      display: getComputedStyle(element).display,
      position: getComputedStyle(element).position,
      width: getComputedStyle(element).width,
    }),
  );
  expect(synopsisLabelStyle.display).toBe("grid");
  expect(synopsisLabelStyle.position).toBe("static");
  expect(Number.parseFloat(synopsisLabelStyle.width)).toBeGreaterThan(100);
  await expect(page.locator(".document-title > h1")).toBeVisible();
  await expect(page.locator(".synopsis-row > h3").first()).toHaveCSS(
    "padding-top",
    "2px",
  );
  await expect(page.locator("header .top-context")).toHaveText("example/hope");
  await expect(page.locator("header .brand-icon")).toBeVisible();
  const pullRequestLink = page.locator("header .pull-request-link");
  await expect(pullRequestLink).toHaveText("PR #142");
  await expect(pullRequestLink).toHaveAttribute(
    "href",
    "https://github.com/example/hope/pull/142",
  );
  await expect(pullRequestLink).toHaveAttribute("aria-label", "PR #142 열기");
  await expect(page.locator(".pr-hero")).toHaveCount(0);
  await expect(page.locator(".document-title")).not.toContainText(
    "example/hope · PR #142",
  );
  await expect(page.locator("header .commit-status")).toHaveText("bbbbbbbb");
  await expect(page.locator("header .commit-status")).toHaveAttribute(
    "title",
    `검토 커밋 ${"b".repeat(40)}`,
  );
  const synopsisPurpose = page.locator("#synopsis .synopsis-purpose");
  await expect(synopsisPurpose.locator(":scope > h3")).toHaveText("목표");
  await expect(synopsisPurpose).toContainText("Return the final error after all retries fail.");
  const stackedSummaryLabels = page.locator("#synopsis .summary-label-stacked");
  await expect(stackedSummaryLabels).toHaveText(["검토 결과", "검토 제한"]);
  const stackedSummaryLabelTops = await stackedSummaryLabels.evaluateAll(
    (labels) => labels.map((summaryLabel) => [...summaryLabel.children].map(
      (line) => line.getBoundingClientRect().top,
    )),
  );
  expect(stackedSummaryLabelTops.every(
    ([firstLine, secondLine]) => secondLine > firstLine,
  )).toBe(true);
  await expect(page.locator("#synopsis > .goal-label, #synopsis > .goal")).toHaveCount(0);
  await expect(page.locator("#synopsis > dt")).toHaveCount(0);
  await expect(page.locator("#synopsis")).not.toContainText(
    "이 오프라인 파일은 이후 PR 변경을 자동으로 반영하지 않습니다.",
  );
  await expect(page.locator("#synopsis .review-result")).toHaveCount(0);
  await expect(page.locator("#synopsis .review-count")).toHaveCount(0);
  await expect(page.locator("#synopsis .review-kind-counts")).toHaveCount(0);
  await expect(page.locator("#synopsis .more-link").first()).toHaveText(
    "그 외 검토 항목 1개",
  );
  await expect(page.locator("#synopsis ul.review-items-compact > li")).toHaveCount(3);
  await expect(page.locator("#synopsis .review-item-compact .status")).toHaveText([
    "결정 필요",
    "검증 필요",
    "검증 필요",
  ]);
  const compactReviewStyle = await page.locator(
    "#synopsis .review-item-compact .status",
  ).first().evaluate((element) => ({
    borderStyle: getComputedStyle(element).borderStyle,
    paddingLeft: getComputedStyle(element).paddingLeft,
  }));
  expect(compactReviewStyle).toEqual({
    borderStyle: "none",
    paddingLeft: "0px",
  });
  await expect(
    page.locator("#synopsis .review-item-compact h4 a").first(),
  ).toHaveCSS("text-decoration-line", "underline");
  await expect(page.locator('a[target="_blank"]')).toHaveCount(0);
  const synopsisLayouts = await page.evaluate(() => {
    const purpose = document.querySelector(".synopsis-purpose");
    const impact = document.querySelector(".synopsis-impact");
    const review = document.querySelector(".synopsis-review");
    const items = [...document.querySelectorAll(".review-item-compact")];
    return {
      purpose: {
        display: getComputedStyle(purpose).display,
        columns: getComputedStyle(purpose).gridTemplateColumns,
      },
      impact: {
        display: getComputedStyle(impact).display,
        columns: getComputedStyle(impact).gridTemplateColumns,
      },
      review: {
        display: getComputedStyle(review).display,
        columns: getComputedStyle(review).gridTemplateColumns,
      },
      firstItemTop: document.querySelector(
        ".review-items-compact > li:first-child .item-head",
      ).getBoundingClientRect().top,
      itemBorders: items.map((item) => getComputedStyle(item).borderBottomWidth),
      labelTop: document.querySelector(
        ".synopsis-review > h3",
      ).getBoundingClientRect().top,
    };
  });
  expect(synopsisLayouts.purpose).toEqual(synopsisLayouts.impact);
  expect(synopsisLayouts.review).toEqual(synopsisLayouts.purpose);
  expect(Math.abs(synopsisLayouts.labelTop - synopsisLayouts.firstItemTop)).toBeLessThanOrEqual(
    1,
  );
  expect(synopsisLayouts.itemBorders.every((width) => width === "0px")).toBe(true);
  const changeShift = await page.locator("#synopsis .change-shift").evaluate(
    (element) => {
      const before = element.querySelector(".shift-before").getBoundingClientRect();
      const after = element.querySelector(".shift-now").getBoundingClientRect();
      const beforeTitle = element.querySelector(".shift-before h3").getBoundingClientRect();
      const beforeValue = element.querySelector(
        ".shift-before .synopsis-value",
      ).getBoundingClientRect();
      const afterTitle = element.querySelector(".shift-now h3").getBoundingClientRect();
      const afterValue = element.querySelector(
        ".shift-now .synopsis-value",
      ).getBoundingClientRect();
      return {
        afterTop: after.top,
        afterContentLeft: afterValue.left,
        afterTitleBottom: afterTitle.bottom,
        afterTitleLeft: afterTitle.left,
        afterValueTop: afterValue.top,
        beforeBottom: before.bottom,
        beforeContentLeft: beforeValue.left,
        beforeTop: before.top,
        beforeTitleBottom: beforeTitle.bottom,
        beforeTitleLeft: beforeTitle.left,
        beforeValueTop: beforeValue.top,
        columns: getComputedStyle(element).gridTemplateColumns,
        display: getComputedStyle(element).display,
        pseudoContent: getComputedStyle(
          element.querySelector(".shift-now"),
          "::before",
        ).content,
      };
    },
  );
  expect(changeShift.display).toBe("grid");
  expect(changeShift.columns.split(" ")).toHaveLength(2);
  expect(changeShift.afterTop).toBe(changeShift.beforeTop);
  expect(changeShift.beforeTitleLeft).toBe(changeShift.beforeContentLeft);
  expect(changeShift.afterTitleLeft).toBe(changeShift.afterContentLeft);
  expect(changeShift.beforeValueTop).toBeGreaterThan(changeShift.beforeTitleBottom);
  expect(changeShift.afterValueTop).toBeGreaterThan(changeShift.afterTitleBottom);
  expect(changeShift.pseudoContent).toBe("none");
  await expect(page.locator("#synopsis .shift-arrow")).toHaveCount(0);
  await expect(page.locator("#synopsis .change-shift")).toHaveAccessibleName(
    "AS-IS TO-BE",
  );
  await expect(page.locator(".topbar")).toHaveCSS("position", "sticky");
  await expect(page.locator("body")).toHaveCSS("font-size", "14px");
  await expect(page.locator("body")).toHaveCSS("font-weight", "500");
  await expect(page.locator("#review-title")).toHaveCSS("font-size", "32px");
  await expect(page.locator(".synopsis-purpose > h3")).toHaveCSS(
    "font-size",
    await page.locator(".synopsis-impact > h3").evaluate(
      (element) => getComputedStyle(element).fontSize,
    ),
  );
  await expect(page.locator(".section-heading h2").first()).toHaveCSS(
    "font-size",
    "18px",
  );
  const baselineGeometry = await page.evaluate(() => ({
    brandRepositoryGap: document.querySelector(".top-context").getBoundingClientRect().left
      - document.querySelector(".brand").getBoundingClientRect().right,
    firstSectionBorder: getComputedStyle(document.querySelector("#synopsis")).borderTopWidth,
    firstSectionMargin: getComputedStyle(document.querySelector("#synopsis")).marginTop,
    firstSectionPadding: getComputedStyle(document.querySelector("#synopsis")).paddingTop,
    railLeft: document.querySelector(".toc-desktop").getBoundingClientRect().left,
    repositoryCommitGap: document.querySelector(".commit-status").getBoundingClientRect().left
      - document.querySelector(".top-context").getBoundingClientRect().right,
    summaryLabelFontSize: getComputedStyle(document.querySelector("#synopsis-title > span:last-child")).fontSize,
    summaryLabelLeft: document.querySelector("#synopsis-title > span:last-child").getBoundingClientRect().left,
    summaryNumberFontSize: getComputedStyle(document.querySelector("#synopsis-title > .section-number")).fontSize,
    summaryNumberLeft: document.querySelector("#synopsis-title > .section-number").getBoundingClientRect().left,
    titleLeft: document.querySelector("#review-title").getBoundingClientRect().left,
    topbarHeight: document.querySelector(".topbar").getBoundingClientRect().height,
  }));
  expect(baselineGeometry).toEqual({
    brandRepositoryGap: 24,
    firstSectionBorder: "0px",
    firstSectionMargin: "24px",
    firstSectionPadding: "16px",
    railLeft: 1204,
    repositoryCommitGap: 24,
    summaryLabelFontSize: "18px",
    summaryLabelLeft: 76,
    summaryNumberFontSize: "18px",
    summaryNumberLeft: 40,
    titleLeft: 40,
    topbarHeight: 58,
  });
  await expect(
    page.locator('.toc-desktop a[href="#synopsis"]'),
  ).toHaveAttribute("aria-current", "location");
  expect(await page.locator(".toc-desktop a").evaluateAll(
    (links) => links.map((link) => link.getAttribute("href")),
  )).toEqual([
    "#synopsis",
    "#explore",
    "#judge",
    "#evidence-and-scope",
  ]);
  await expect(page.locator(".main > [id]")).toHaveCount(4);
  await expect(page.locator("#review-title")).toContainText(
    "마지막 재시도 오류가 호출자에게 그대로 전달됩니다.",
  );
  await expect(page.locator("#review-title .evidence-marker")).toHaveText("[1]");
  const judge = page.locator("#judge");
  await expect(judge).not.toHaveAttribute("open", "");
  await expect(judge.locator(".section-content")).not.toBeVisible();
  await judge.locator(":scope > summary").click();
  await expect(judge.locator(".section-content")).toBeVisible();
  const itemActionColumns = await page.locator(
    ".review-items-full .item-actions",
  ).first().evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(itemActionColumns.split(" ")).toHaveLength(1);
  const itemActionTops = await page.locator(
    ".review-items-full .item-actions",
  ).first().locator(":scope > div").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(itemActionTops[1]).toBeGreaterThan(itemActionTops[0]);
  expect(itemActionTops[2]).toBeGreaterThan(itemActionTops[1]);
  await expect(page.locator("#core-change .core-narrative")).toHaveCount(0);
  await expect(page.locator("#core-change .core-detail")).toHaveCount(1);
  await expect(page.locator("#core-change")).toContainText(
    "The changed branch keeps the last error before it exits.",
  );
  await expect(page.locator("#core-change")).not.toContainText(
    "Return the final error after all retries fail.",
  );
  await expect(page.locator("#behavior-flow > .subsection-heading > h3")).toHaveText(
    "적용 조건과 흐름",
  );
  await expect(page.locator("#behavior-flow")).toContainText(
    "네 단계로 이어지는 변경 동작입니다.",
  );
  await expect(page.locator("#core-change")).not.toContainText(
    "네 단계로 이어지는 변경 동작입니다.",
  );
  const behaviorSectionOrder = await page.locator("#explore").evaluate((section) => ({
    behaviorTop: section.querySelector("#behavior-flow").getBoundingClientRect().top,
    coreBottom: section.querySelector("#core-change").getBoundingClientRect().bottom,
    headingTop: section.querySelector("#behavior-flow h3").getBoundingClientRect().top,
    summaryTop: section.querySelector("#behavior-flow .behavior-summary").getBoundingClientRect().top,
  }));
  expect(behaviorSectionOrder.behaviorTop).toBeGreaterThanOrEqual(
    behaviorSectionOrder.coreBottom,
  );
  expect(behaviorSectionOrder.summaryTop).toBeGreaterThan(
    behaviorSectionOrder.headingTop,
  );
  await expect(page.locator("#synopsis .synopsis-state")).toHaveCount(0);
  await expect(page.locator("#synopsis .scope-impact-list")).toBeVisible();
  await expect(page.locator("#explore .flow")).toHaveCount(1);
  await expect(page.locator("#explore .flow-short")).toHaveCount(0);
  const primer = page.locator("#beginner-primer");
  await expect(primer).toHaveCount(1);
  await expect(primer).not.toHaveAttribute("open", "");
  await expect(primer.locator(".beginner-primer-content")).not.toBeVisible();
  await primer.locator(":scope > summary").click();
  await expect(primer).toHaveAttribute("open", "");
  await expect(primer.locator(".beginner-primer-content")).toBeVisible();
  await primer.locator(":scope > summary").click();
  await expect(primer).not.toHaveAttribute("open", "");
  await expect(page.locator(".code-step-list > li")).toHaveCount(1);
  const itemHeadAlignment = await page.locator(
    ".review-items-full .item-head",
  ).evaluateAll((heads) => heads.map((head) => {
    const items = [...head.children];
    const centers = items.map((item) => {
      const box = item.getBoundingClientRect();
      return box.top + (box.height / 2);
    });
    return Math.max(...centers) - Math.min(...centers);
  }));
  expect(itemHeadAlignment.every((difference) => difference <= 1)).toBe(true);
  const itemHeadTitleGaps = await page.locator(
    ".review-items-full .review-item",
  ).evaluateAll((items) => items.map((item) => {
    const head = item.querySelector(".item-head").getBoundingClientRect();
    const title = item.querySelector("h3").getBoundingClientRect();
    return title.top - head.bottom;
  }));
  expect(itemHeadTitleGaps.every((gap) => gap >= 8)).toBe(true);
  await expectNoPageOverflow(page);

  await page.setViewportSize(viewports.breakpoint);
  const wideFlow = await page.locator("#explore .flow").evaluate((flow) => ({
    contentOverflow: [...flow.querySelectorAll(".claim p")].some(
      (content) => content.scrollWidth > content.clientWidth,
    ),
    clientWidth: flow.clientWidth,
    display: getComputedStyle(flow).display,
    scrollWidth: flow.scrollWidth,
  }));
  expect(wideFlow.display).toBe("grid");
  expect(wideFlow.scrollWidth).toBeLessThanOrEqual(wideFlow.clientWidth);
  expect(wideFlow.contentOverflow).toBe(false);
  const flowTops = await page.locator("#explore .flow > li").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(flowTops[1]).toBeGreaterThan(flowTops[0]);
  expect(flowTops[2]).toBeGreaterThan(flowTops[1]);

  await page.setViewportSize(viewports.mobile);
  await expect(page.locator("#review-title")).toHaveCSS("font-size", "28px");
  await expect(page.locator(".synopsis-purpose > h3")).toHaveCSS(
    "font-size",
    await page.locator(".synopsis-impact > h3").evaluate(
      (element) => getComputedStyle(element).fontSize,
    ),
  );
  await expect(page.locator(".section-heading h2").first()).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(page.locator(".synopsis-row > h3").first()).toHaveCSS(
    "padding-top",
    "0px",
  );
  const narrowShift = await page.locator("#synopsis .change-shift").evaluate(
    (element) => {
      const before = element.querySelector(".shift-before").getBoundingClientRect();
      const after = element.querySelector(".shift-now").getBoundingClientRect();
      return {
        afterTop: after.top,
        beforeBottom: before.bottom,
        columns: getComputedStyle(element).gridTemplateColumns,
      };
    },
  );
  expect(narrowShift.columns.split(" ")).toHaveLength(1);
  expect(narrowShift.afterTop).toBeGreaterThanOrEqual(narrowShift.beforeBottom);
  const narrowActionColumns = await page.locator(
    ".review-items-full .item-actions",
  ).first().evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(narrowActionColumns.split(" ")).toHaveLength(1);
  const narrowFlow = await page.locator("#explore .flow").evaluate((flow) => ({
    clientWidth: flow.clientWidth,
    display: getComputedStyle(flow).display,
    scrollWidth: flow.scrollWidth,
  }));
  expect(narrowFlow.display).toBe("grid");
  expect(narrowFlow.scrollWidth).toBeLessThanOrEqual(narrowFlow.clientWidth);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#beginner-primer .beginner-primer-content")).toBeVisible();
  await expect(page.locator("#judge .section-content")).toBeVisible();
  await expect(page.locator(".microworld-content")).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  for (const viewport of [
    viewports.breakpoint,
    viewports.mobile,
    viewports.wide,
  ]) {
    await page.setViewportSize(viewport);
    await expectNoPageOverflow(page);
  }
  await page.locator("#review-title").evaluate((element) => {
    element.textContent = "LongUnbrokenPullRequestTitle".repeat(24);
  });
  await page.locator(".behavior-visual > header > p").evaluate((element) => {
    element.textContent = "LongUnbrokenTeachingAidCaption".repeat(80);
  });
  await page.locator(".synopsis-purpose .claim p bdi").evaluate((element) => {
    element.textContent = "LongUnbrokenGoal".repeat(120);
  });
  await page.locator(".shift-before .claim p bdi").evaluate((element) => {
    element.textContent = "LongUnbrokenBefore".repeat(120);
  });
  await page.locator(".shift-now .claim p bdi").evaluate((element) => {
    element.textContent = "LongUnbrokenAfter".repeat(120);
  });
  await page.locator(".review-items-full .review-item h3 bdi").first().evaluate(
    (element) => {
      element.textContent = "LongUnbrokenReviewTitle".repeat(120);
    },
  );
  await page.locator(".review-items-full .review-item > p bdi").first().evaluate(
    (element) => {
      element.textContent = "LongUnbrokenReviewExplanation".repeat(120);
    },
  );
  await page.setViewportSize({ height: 640, width: 320 });
  await expectNoPageOverflow(page);
  expect(remoteRequests).toEqual([]);
});

test("contents tracks the current section and keeps sticky navigation clear", async ({
  page,
}) => {
  await openArtifact(page, viewports.desktop);
  const judge = page.locator("#judge");
  await expect(page.locator(".toc-desktop .toc-progress")).toHaveText("1 / 4");
  await expect(judge).not.toHaveAttribute("open", "");
  await page.locator('.toc-desktop a[href="#judge"]').click();
  await expect(judge).toBeFocused();
  await expect(judge).toHaveAttribute("open", "");

  const currentLinks = page.locator('.toc-desktop a[aria-current="location"]');
  await expect(currentLinks).toHaveCount(1);
  await expect(currentLinks).toHaveAttribute("href", "#judge");
  await expect(page.locator(".toc-desktop .toc-progress")).toHaveText("3 / 4");
  const currentStyle = await currentLinks.evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    borderLeftWidth: getComputedStyle(element).borderLeftWidth,
  }));
  expect(currentStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(currentStyle.borderLeftWidth).toBe("4px");
  const clearance = await page.evaluate(() => ({
    headerBottom: document.querySelector(".topbar").getBoundingClientRect().bottom,
    targetTop: document.querySelector("#judge").getBoundingClientRect().top,
  }));
  expect(clearance.targetTop).toBeGreaterThanOrEqual(clearance.headerBottom);
});

test("the microworld switches fixed scenarios with accessible native controls", async ({
  page,
}) => {
  const remoteRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) remoteRequests.push(request.url());
  });
  await openArtifact(page, viewports.desktop);
  const world = page.locator("#explore .microworld");
  await expect(world).toBeVisible();
  await expect(world.locator(".microworld-eyebrow")).toHaveText("직접 해보기");
  await expect(world.locator(".microworld-notice")).toContainText(
    "저장소 코드를 실행하거나 테스트 결과를 보여주지 않습니다.",
  );
  await expect(page.locator("#explore .behavior-visual")).toBeVisible();
  await expect(page.locator("#explore .decision-table")).toBeVisible();
  const disclosure = world.locator(".microworld-disclosure");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(disclosure.locator(".microworld-content")).not.toBeVisible();
  await disclosure.locator(":scope > summary").click();
  await expect(disclosure.locator(".microworld-content")).toBeVisible();

  const groups = world.locator(".microworld-control-group");
  await expect(groups).toHaveCount(2);
  const controls = world.locator('input[type="radio"].microworld-control');
  await expect(controls).toHaveCount(4);
  const attemptGroup = world.getByRole("group", {
    exact: true,
    name: "마지막 시도",
  });
  const savedErrorGroup = world.getByRole("group", {
    exact: true,
    name: "저장된 오류",
  });
  const failed = attemptGroup.getByRole("radio", { name: "실패" });
  const succeeded = attemptGroup.getByRole("radio", { name: "성공" });
  const present = savedErrorGroup.getByRole("radio", { name: "있음" });
  const missing = savedErrorGroup.getByRole("radio", { name: "없음" });
  await expect(failed).toBeChecked();
  await expect(present).toBeChecked();
  const controlHeights = await world.locator(".microworld-option").evaluateAll((items) => (
    items.map((item) => item.getBoundingClientRect().height)
  ));
  expect(controlHeights.every((height) => height >= 44)).toBe(true);
  const controlGroupTops = await groups.evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(controlGroupTops[1]).toBe(controlGroupTops[0]);

  const visibleScenario = world.locator(".microworld-scenario:not([hidden])");
  await expect(visibleScenario).toHaveCount(1);
  await expect(visibleScenario).toContainText("실패했고 저장된 오류가 있음");
  await expect(world.locator(".microworld-scenario[hidden]")).toHaveCount(3);
  const traceTops = await visibleScenario.locator(".microworld-trace").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(traceTops[1]).toBe(traceTops[0]);
  const boundaryTops = await world.locator(".microworld-boundary > div").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(boundaryTops[1]).toBe(boundaryTops[0]);

  await failed.focus();
  await expect(failed).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(present).toBeFocused();
  await succeeded.check();
  await expect(succeeded).toBeChecked();
  await expect(visibleScenario).toContainText("성공했고 저장된 오류가 있음");
  await expect(world.locator("[data-microworld-status]")).toContainText(
    "마지막 시도: 성공",
  );

  await missing.check();
  await expect(missing).toBeChecked();
  await expect(visibleScenario).toContainText("성공했고 저장된 오류가 없음");
  await expect(visibleScenario.locator(".microworld-unchanged")).toHaveText(
    "이전과 같습니다.",
  );
  await expect(world.locator("[data-microworld-status]")).toContainText(
    "이후: 이전과 같습니다.",
  );
  await expect(world.locator(".microworld-scenario[hidden]")).toHaveCount(3);

  await page.setViewportSize(viewports.mobile);
  const narrowControlTops = await groups.evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(narrowControlTops[1]).toBeGreaterThan(narrowControlTops[0]);
  const narrowTraceTops = await visibleScenario.locator(
    ".microworld-trace",
  ).evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(narrowTraceTops[1]).toBeGreaterThan(narrowTraceTops[0]);
  await expectNoPageOverflow(page);
  expect(remoteRequests).toEqual([]);
});

test("the artifact explains every teaching-aid omission", async ({ page }) => {
  await page.setViewportSize(viewports.desktop);
  await page.goto(omittedArtifactUrl);

  const section = page.locator("#teaching-aids");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", {
    exact: true,
    name: "교육 보조 자료 선택",
  })).toBeVisible();
  await expect(section).not.toHaveAttribute("open", "");
  await section.locator(":scope > summary").click();
  await expect(section).toHaveAttribute("open", "");
  await expect(section.locator(".teaching-aid-choice")).toHaveCount(3);
  await expect(section.locator(".teaching-aid-decision")).toHaveText([
    "생략",
    "생략",
    "생략",
  ]);
  await expect(section.locator(".teaching-aid-choice h3")).toHaveText([
    "시각 자료",
    "마이크로월드",
    "퀴즈",
  ]);
  await expect(section.locator("dd")).toHaveText([
    "글만으로도 이 변경을 쉽게 이해할 수 있습니다.",
    "글만으로도 이 변경을 쉽게 이해할 수 있습니다.",
    "글만으로도 이 변경을 쉽게 이해할 수 있습니다.",
  ]);
  const choiceTops = await section.locator(".teaching-aid-choice").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(choiceTops[1]).toBe(choiceTops[0]);
  expect(choiceTops[2]).toBe(choiceTops[1]);
  await expectNoPageOverflow(page);
});

test("the artifact distinguishes mixed teaching-aid decisions", async ({ page }) => {
  await page.setViewportSize(viewports.mobile);
  await page.goto(visualArtifactUrls.sequence);

  const section = page.locator("#teaching-aids");
  await section.locator(":scope > summary").click();
  const cards = section.locator(".teaching-aid-choice");
  await expect(cards).toHaveCount(3);
  await expect(section.locator(".teaching-aid-decision")).toHaveText([
    "Included",
    "Not applicable",
    "Omitted",
  ]);
  await expect(cards.nth(0)).toContainText(
    "Show the retry branch and outcome relationship.",
  );
  await expect(cards.nth(1)).toContainText(
    "This change has no bounded state to explore.",
  );
  await expect(cards.nth(2)).toContainText(
    "The prose and selected aids already explain this behavior.",
  );
  await expect(cards.nth(1).getByText("Teaching job", { exact: true })).toHaveCount(0);
  await expect(cards.nth(2).getByText("Teaching job", { exact: true })).toHaveCount(0);
  const cardTops = await cards.evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(cardTops[1]).toBeGreaterThan(cardTops[0]);
  expect(cardTops[2]).toBeGreaterThan(cardTops[1]);
  await expectNoPageOverflow(page);
});

test("visual routes expose endpoints and direction to the accessibility tree", async ({
  page,
}) => {
  await page.setViewportSize(viewports.desktop);
  await page.goto(visualArtifactUrls.sequence);
  const sequenceRoute = await page.locator(
    ".visual-sequence > li",
  ).first().ariaSnapshot();
  expect(sequenceRoute).toContain("Attempt to Retry branch");

  await page.goto(visualArtifactUrls["component-map"]);
  const componentRoute = await page.locator(
    ".visual-connections li",
  ).first().ariaSnapshot();
  expect(componentRoute).toContain("Retry branch to Caller");
  const componentTops = await page.locator(".visual-components > article").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(componentTops[1]).toBe(componentTops[0]);
  await page.setViewportSize(viewports.mobile);
  const narrowComponentTops = await page.locator(
    ".visual-components > article",
  ).evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(narrowComponentTops[1]).toBeGreaterThan(narrowComponentTops[0]);
});

test("display and contents controls share one visual control family", async ({ page }) => {
  await openArtifact(page, viewports.breakpoint);
  const theme = page.locator("#theme-toggle");
  const display = page.locator(".display-controls");
  const contents = page.locator(".toc-mobile > summary");
  const [themeBox, displayBox, contentsBox] = await Promise.all([
    theme.boundingBox(),
    display.boundingBox(),
    contents.boundingBox(),
  ]);

  expect(themeBox).not.toBeNull();
  expect(displayBox).not.toBeNull();
  expect(contentsBox).not.toBeNull();
  expect(themeBox.height).toBe(42);
  expect(displayBox.height).toBe(44);
  expect(contentsBox.height).toBe(44);
  expect(contentsBox.x - (displayBox.x + displayBox.width)).toBe(8);

  const styles = await page.evaluate(() => {
    const displayControl = document.querySelector(".display-controls");
    const contentsControl = document.querySelector(".toc-mobile > summary");
    const topbar = document.querySelector(".topbar-inner");
    return {
      contents: {
        borderRadius: getComputedStyle(contentsControl).borderRadius,
        borderStyle: getComputedStyle(contentsControl).borderStyle,
        borderWidth: getComputedStyle(contentsControl).borderWidth,
      },
      display: {
        borderRadius: getComputedStyle(displayControl).borderRadius,
        borderStyle: getComputedStyle(displayControl).borderStyle,
        borderWidth: getComputedStyle(displayControl).borderWidth,
      },
      topbarGap: getComputedStyle(topbar).columnGap,
    };
  });
  expect(styles.display).toEqual(styles.contents);
  expect(styles.topbarGap).toBe("24px");
});

test("the theme control works from the keyboard and describes its next action", async ({
  page,
}) => {
  await openArtifact(page, viewports.desktop);
  const theme = page.locator("#theme-toggle");

  await expect(theme).toHaveAttribute("aria-label", "다크 모드로 전환");
  await expect(theme).not.toHaveAttribute("aria-pressed", /.+/u);

  await theme.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(theme).toHaveAttribute("aria-label", "라이트 모드로 전환");
  await expect(theme).not.toHaveAttribute("aria-pressed", /.+/u);

  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(theme).toHaveAttribute("aria-label", "다크 모드로 전환");
});

test("mobile evidence markers open a bounded preview", async ({
  page,
}) => {
  await openArtifact(page, viewports.mobile);
  const pullRequestLink = page.locator("header .pull-request-link");
  await expect(pullRequestLink).toBeVisible();
  await expect(pullRequestLink).toHaveAttribute("aria-label", "PR #142 열기");
  const pullRequestLinkBox = await pullRequestLink.boundingBox();
  expect(pullRequestLinkBox).not.toBeNull();
  expect(pullRequestLinkBox.height).toBeGreaterThanOrEqual(44);
  const markers = page.locator(".evidence-marker");
  const count = await markers.count();
  expect(count).toBeGreaterThan(1);
  const names = await markers.evaluateAll((items) => (
    items.map((item) => item.getAttribute("aria-label"))
  ));
  expect(names.every(Boolean)).toBe(true);
  const markerBox = await markers.first().boundingBox();
  await markers.first().click();
  const popover = page.locator("#evidence-popover");
  await expect(popover).toBeVisible();
  await expect(popover.locator(".code-evidence, .source-text")).toBeVisible();
  const popoverBox = await popover.boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(popoverBox.x).toBeGreaterThanOrEqual(0);
  expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(viewports.mobile.width);
  const placement = await popover.getAttribute("data-placement");
  expect(["above", "below", "sheet"]).toContain(placement);
  if (placement === "below") {
    expect(popoverBox.y - (markerBox.y + markerBox.height)).toBeGreaterThanOrEqual(9);
    expect(popoverBox.y - (markerBox.y + markerBox.height)).toBeLessThanOrEqual(11);
  } else if (placement === "above") {
    expect(markerBox.y - (popoverBox.y + popoverBox.height)).toBeGreaterThanOrEqual(9);
    expect(markerBox.y - (popoverBox.y + popoverBox.height)).toBeLessThanOrEqual(11);
  }
  const closeBox = await popover.locator(".evidence-popover-close").boundingBox();
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  await popover.locator(".evidence-popover-close").click();
  await expect(popover).not.toBeVisible();

  const otherSummaries = page.locator(
    ".quiz-question > summary, "
      + "#evidence-and-scope > summary, .toc-mobile > summary",
  );
  const otherCount = await otherSummaries.count();
  expect(otherCount).toBeGreaterThanOrEqual(2);
  for (let index = 0; index < otherCount; index += 1) {
    const box = await otherSummaries.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const mobileToc = page.locator(".toc-mobile");
  const mobileTocSummary = mobileToc.locator(":scope > summary");
  await expect(mobileToc.locator("xpath=ancestor::header[1]")).toHaveCount(1);
  const { contentTop, synopsisTop, titleBottom, titleTop } = await page.evaluate(() => {
    const main = document.querySelector("main");
    const synopsis = document.querySelector("#synopsis");
    const title = document.querySelector(".document-title").getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    return {
      contentTop: mainBox.top + Number.parseFloat(getComputedStyle(main).paddingTop),
      synopsisTop: synopsis.getBoundingClientRect().top,
      titleBottom: title.bottom,
      titleTop: title.top,
    };
  });
  expect(Math.abs(titleTop - contentTop)).toBeLessThanOrEqual(1);
  expect(synopsisTop).toBeGreaterThan(titleBottom);
  const synopsis = await page.locator("#synopsis").boundingBox();
  expect(synopsis).not.toBeNull();
  const synopsisTopBeforeOpen = synopsis.y;
  await mobileTocSummary.click();
  await expect(mobileToc).toHaveAttribute("open", "");
  const openTocBox = await mobileTocSummary.boundingBox();
  expect(openTocBox).not.toBeNull();
  expect(openTocBox.height).toBeGreaterThanOrEqual(44);
  const synopsisAfterOpen = await page.locator("#synopsis").boundingBox();
  expect(synopsisAfterOpen).not.toBeNull();
  expect(synopsisAfterOpen.y).toBe(synopsisTopBeforeOpen);
  const behaviorLink = mobileToc.locator('a[href="#explore"]');
  await expect(behaviorLink).toHaveCount(1);
  await behaviorLink.click();
  await expect(mobileToc).not.toHaveAttribute("open", "");
  await expect(page.locator("#explore")).toBeFocused();
  await expectNoPageOverflow(page);
});

test("the mobile contents panel remains bounded, scrollable, and visibly current", async ({
  page,
}) => {
  await openArtifact(page, { height: 220, width: 320 });
  await page.locator("#judge").evaluate(
    (element) => {
      element.open = true;
      element.scrollIntoView({ behavior: "instant", block: "start" });
    },
  );

  const toc = page.locator(".toc-mobile");
  await toc.locator(":scope > summary").click();
  const panel = toc.locator(".toc-mobile-panel");
  const panelState = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      listStyleType: getComputedStyle(element.querySelector("ol")).listStyleType,
      overflowY: getComputedStyle(element).overflowY,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(panelState.bottom).toBeLessThanOrEqual(220);
  expect(panelState.listStyleType).toBe("none");
  expect(panelState.overflowY).toBe("auto");
  expect(panelState.scrollWidth).toBeLessThanOrEqual(panelState.clientWidth);
  expect(panelState.scrollHeight).toBeGreaterThan(panelState.clientHeight);

  const pageScrollBefore = await page.evaluate(() => scrollY);
  await panel.hover();
  await page.mouse.wheel(0, 180);
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(pageScrollBefore);

  const linkHeights = await toc.locator("a").evaluateAll(
    (links) => links.map((link) => link.getBoundingClientRect().height),
  );
  expect(linkHeights.every((height) => height >= 44)).toBe(true);

  const current = toc.locator('a[href="#judge"]');
  await expect(current).toHaveAttribute("aria-current", "location");
  const currentStyle = await current.evaluate((element) => ({
    borderLeftWidth: getComputedStyle(element).borderLeftWidth,
    fontWeight: getComputedStyle(element).fontWeight,
  }));
  expect(currentStyle.borderLeftWidth).toBe("4px");
  expect(Number(currentStyle.fontWeight)).toBeGreaterThanOrEqual(700);

  await page.keyboard.press("Escape");
  await expect(toc).not.toHaveAttribute("open", "");
  await expect(toc.locator(":scope > summary")).toBeFocused();
  await toc.locator(":scope > summary").click();

  const lastLink = toc.locator('a[href="#evidence-and-scope"]');
  await lastLink.scrollIntoViewIfNeeded();
  await lastLink.click();
  await expect(toc).not.toHaveAttribute("open", "");
  await expect(page.locator("#evidence-and-scope")).toBeFocused();
  await expectNoPageOverflow(page);
});

test("mobile product-bar actions fit without hiding the pull request", async ({ page }) => {
  await openArtifact(page, { height: 568, width: 320 });

  const selectors = [
    ".brand-icon",
    ".pull-request-link",
    "#theme-toggle",
    ".toc-mobile > summary",
  ];
  await expect(page.locator(".brand-product")).toBeHidden();
  const boxes = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    await expect(locator).toBeVisible();
    boxes.push(await locator.boundingBox());
  }
  expect(boxes.every(Boolean)).toBe(true);
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].x).toBeGreaterThanOrEqual(boxes[index - 1].x + boxes[index - 1].width);
  }
  expect(boxes.at(-1).x + boxes.at(-1).width).toBeLessThanOrEqual(320);
  await expectNoPageOverflow(page);
});

test("quiz separates an optional response from the answer and evidence", async ({
  page,
}) => {
  await openArtifact(page, viewports.mobile);
  const quizSection = page.locator("#quiz");
  await expect(quizSection).toBeVisible();
  await expect(quizSection.locator(":scope > summary")).toHaveCount(0);
  const questions = page.locator(".quiz > details.quiz-question");
  await expect(questions).toHaveCount(3);

  const first = questions.nth(0);
  const response = first.locator("textarea");
  const answer = first.locator("details.quiz-answer");
  await expect(first).not.toHaveAttribute("open", "");
  await expect(response).not.toBeVisible();

  await first.locator(":scope > summary").click();
  await expect(first).toHaveAttribute("open", "");
  await expect(response).toBeVisible();
  await expect(response).toHaveAttribute(
    "aria-labelledby",
    "quiz-1-question quiz-1-response-label",
  );
  await expect(response).toHaveAttribute(
    "placeholder",
    "답을 먼저 적어보세요. 입력 내용은 저장되지 않습니다.",
  );
  const responseLabel = first.locator(
    'label#quiz-1-response-label[for="quiz-1-response"]',
  );
  await expect(responseLabel).toHaveText("이해 확인 답변");
  await expect(first.getByRole("textbox", {
    name: /모든 재시도가 실패하면 어떤 오류가 전달되나요\? 1 이해 확인 답변/u,
  })).toHaveCount(1);
  const responseLabelStyle = await responseLabel.evaluate((element) => ({
    clip: getComputedStyle(element).clip,
    height: getComputedStyle(element).height,
    overflow: getComputedStyle(element).overflow,
    position: getComputedStyle(element).position,
    width: getComputedStyle(element).width,
  }));
  expect(responseLabelStyle).toEqual({
    clip: "rect(0px, 0px, 0px, 0px)",
    height: "1px",
    overflow: "hidden",
    position: "absolute",
    width: "1px",
  });
  await expect(answer).not.toHaveAttribute("open", "");
  await expect(answer.locator(".quiz-answer-content")).not.toBeVisible();
  const answerNames = await questions.locator(
    "details.quiz-answer > summary",
  ).evaluateAll((summaries) => summaries.map(
    (summary) => summary.getAttribute("aria-label"),
  ));
  expect(answerNames.every(Boolean)).toBe(true);
  expect(new Set(answerNames).size).toBe(answerNames.length);

  await response.fill("마지막 오류가 전달됩니다.");
  await answer.locator(":scope > summary").click();
  await expect(answer).toHaveAttribute("open", "");
  await expect(answer.locator(".quiz-answer-content")).toBeVisible();
  await expect(answer.locator(".evidence-markers")).toBeVisible();
  await expect(answer.locator("details.evidence")).toHaveCount(0);
  await expect(answer).toContainText("마지막 재시도 오류가 호출자에게 전달됩니다.");

  await first.locator(":scope > summary").click();
  await first.locator(":scope > summary").click();
  await expect(response).toHaveValue("마지막 오류가 전달됩니다.");
  await expectNoPageOverflow(page);

  await answer.locator(":scope > summary").click();
  await first.locator(":scope > summary").click();
  await expect(answer).not.toHaveAttribute("open", "");
  await expect(first).not.toHaveAttribute("open", "");
  await page.emulateMedia({ media: "print" });
  await expect(response).not.toBeVisible();
  await expect(first.locator(":scope > summary")).toBeVisible();
  await expect(answer.locator(".quiz-answer-content")).toBeVisible();
  await expect(answer.locator(".evidence-markers")).toBeVisible();
});

test("closed disclosures stay compact", async ({
  page,
}) => {
  await openArtifact(page, viewports.desktop);

  expect(await page.locator("#evidence-references > summary").evaluate(
    (summary) => summary.getBoundingClientRect().height,
  )).toBeGreaterThanOrEqual(44);

  for (const selector of [
    "#judge",
    ".microworld-disclosure",
    "#teaching-aids",
    ".quiz-question:first-child",
    ".artifact-details",
  ]) {
    const disclosure = page.locator(selector);
    await expect(disclosure).not.toHaveAttribute("open", "");
    const dimensions = await disclosure.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        chrome: [
          style.borderTopWidth,
          style.borderBottomWidth,
          style.paddingTop,
          style.paddingBottom,
        ].reduce((total, value) => total + Number.parseFloat(value), 0),
        disclosure: element.getBoundingClientRect().height,
        summary: element.querySelector(":scope > summary").getBoundingClientRect().height,
      };
    });
    expect(Math.abs(dimensions.disclosure - dimensions.summary - dimensions.chrome))
      .toBeLessThanOrEqual(1);
  }

  const artifactDetails = page.locator(".artifact-details");
  await expect(artifactDetails).toHaveClass(/evidence-group/u);
  await expect(artifactDetails.locator(":scope > summary > h3")).toHaveText("리뷰 정보");

  const endGap = await page.locator("#evidence-and-scope").evaluate((section) => {
    const summary = section.querySelector("#evidence-references > summary");
    return section.getBoundingClientRect().bottom - summary.getBoundingClientRect().bottom;
  });
  expect(endGap).toBeLessThanOrEqual(32);

  const evidence = page.locator("#evidence-and-scope");
  await evidence.locator(":scope > summary").click();
  const collapsedDimensions = await evidence.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      chrome: [
        style.borderTopWidth,
        style.borderBottomWidth,
        style.paddingTop,
        style.paddingBottom,
      ].reduce((total, value) => total + Number.parseFloat(value), 0),
      disclosure: element.getBoundingClientRect().height,
      summary: element.querySelector(":scope > summary").getBoundingClientRect().height,
    };
  });
  expect(Math.abs(
    collapsedDimensions.disclosure - collapsedDimensions.summary - collapsedDimensions.chrome,
  )).toBeLessThanOrEqual(1);
});

test("the evidence appendix starts open while its groups and evidence list stay closed", async ({
  page,
}) => {
  await openArtifact(page, viewports.desktop);
  const section = page.locator("details#evidence-and-scope");
  await expect(section).toHaveAttribute("open", "");

  const nested = section.locator(
    "details.evidence-group, details.context-check, details.scope-limit, "
      + "details.scope-limit-item, details.artifact-details",
  );
  expect(await nested.count()).toBeGreaterThan(4);
  expect(await nested.evaluateAll((items) => (
    items.every((item) => !item.hasAttribute("open"))
  ))).toBe(true);
  const references = page.locator("#evidence-references");
  await expect(references).not.toHaveAttribute("open", "");
  await expect(references.locator(".evidence-footnote-list")).not.toBeVisible();

  const sourceGroup = section.locator("details.evidence-group").filter({
    has: page.getByRole("heading", {
      exact: true,
      name: "그 밖의 수집 출처",
    }),
  });
  await sourceGroup.locator(":scope > summary").click();
  await expect(sourceGroup).toHaveAttribute("open", "");
  await expect(sourceGroup.locator("table")).toBeVisible();
  const changedFilesGroup = section.locator("details.evidence-group").filter({
    has: page.getByRole("heading", {
      exact: true,
      name: "변경 파일",
    }),
  });
  await expect(changedFilesGroup).not.toHaveAttribute("open", "");
  await expect(sourceGroup).not.toContainText("src/retry.js");

  await changedFilesGroup.locator(":scope > summary").click();
  await expect(changedFilesGroup).toHaveAttribute("open", "");
  await expect(changedFilesGroup).toContainText("src/retry.js");
  await expect(changedFilesGroup).toContainText("변경 조각 · 4줄");
});

test("code evidence preserves source line breaks in the DOM", async ({ page }) => {
  await openArtifact(page, viewports.desktop);
  const text = await page.locator(".code-evidence code").evaluateAll((codes) => (
    codes.map((code) => code.textContent.replaceAll("\r\n", "\n")).find(
      (content) => content.includes("-throw new Error()")
        && content.includes("+const last = error")
        && content.includes("+throw veryLongIdentifier"),
    )
  ));
  expect(text).toBeTruthy();
  const lines = text.split("\n");
  expect(lines).toHaveLength(3);
  expect(lines.slice(0, 2)).toEqual([
    "-throw new Error()",
    "+const last = error",
  ]);
  expect(lines[2]).toMatch(/^\+throw veryLongIdentifier/u);
});

test("fragment navigation opens details that contain the target", async ({ page }) => {
  await openArtifact(page, viewports.desktop);
  await page.goto(`${artifactUrl}#beginner-primer`);
  await expect(page.locator("#beginner-primer")).toHaveAttribute("open", "");
  await expect(page.locator("#beginner-primer")).toBeFocused();

  await openArtifact(page, viewports.desktop);
  const reference = page.locator(
    '.code-step-list .evidence-marker[href^="#evidence-"]',
  ).first();
  await reference.evaluate((element) => {
    let details = element.closest("details");
    while (details) {
      details.open = true;
      details = details.parentElement?.closest("details");
    }
  });
  await expect(reference).toBeVisible();
  const targetId = (await reference.getAttribute("href")).slice(1);

  await page.locator(`#${targetId}`).evaluate((target) => {
    const details = target.closest("details");
    if (details) details.open = false;
  });
  await reference.click();
  await expect(page.locator("#evidence-popover")).toBeVisible();
  await page.locator("[data-evidence-popover-more]").click();

  await expect(page.locator(`#${targetId}`).locator("xpath=ancestor::details[1]")).toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(`#${targetId}`)).toBeFocused();
  const evidenceClearance = await page.evaluate((id) => ({
    headerBottom: document.querySelector(".topbar").getBoundingClientRect().bottom,
    targetTop: document.getElementById(id).getBoundingClientRect().top,
  }), targetId);
  expect(evidenceClearance.targetTop).toBeGreaterThanOrEqual(
    evidenceClearance.headerBottom,
  );

  const scopeReference = page.locator('a[href="#scope-limit-1"]').first();
  await scopeReference.click();
  await expect(page.locator("#evidence-and-scope")).toHaveAttribute("open", "");
  await expect(page.locator("#scope-limit-1")).toHaveAttribute("open", "");
  await expect(page.locator("#scope-limit-1")).toBeFocused();
  const scopeClearance = await page.evaluate(() => ({
    headerBottom: document.querySelector(".topbar").getBoundingClientRect().bottom,
    targetTop: document.querySelector("#scope-limit-1").getBoundingClientRect().top,
  }));
  expect(scopeClearance.targetTop).toBeGreaterThanOrEqual(scopeClearance.headerBottom);
});

test("the offline artifact remains readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: viewports.mobile,
  });
  const page = await context.newPage();
  const externalRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) externalRequests.push(request.url());
  });
  try {
    await page.goto(artifactUrl);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#synopsis")).toBeVisible();
    const primer = page.locator("#beginner-primer");
    await expect(primer).toBeVisible();
    await expect(primer).not.toHaveAttribute("open", "");
    await expect(primer.locator(".beginner-primer-content")).not.toBeVisible();
    await primer.locator(":scope > summary").click();
    await expect(primer.locator(".beginner-primer-content")).toBeVisible();
    const evidenceSection = page.locator("#evidence-and-scope");
    await expect(evidenceSection).toHaveAttribute("open", "");
    const sourceGroup = evidenceSection.locator("details.evidence-group").filter({
      has: page.getByRole("heading", {
        exact: true,
        name: "그 밖의 수집 출처",
      }),
    });
    await sourceGroup.locator(":scope > summary").click();
    await expect(sourceGroup.locator("table")).toBeVisible();
    await expect(evidenceSection).toContainText("그 밖의 수집 출처");
    await expect(evidenceSection).toContainText("관련 맥락");
    await expect(evidenceSection).toContainText("변경 파일");
    const judge = page.locator("#judge");
    await expect(judge).not.toHaveAttribute("open", "");
    await judge.locator(":scope > summary").click();
    await expect(judge.locator(".review-items-full")).toBeVisible();
    await expect(page.locator(
      '.code-evidence code[aria-label*="throw new Error()"]',
    ).first()).toContainText(
      "throw new Error()",
    );
    const world = page.locator("#explore .microworld");
    await expect(world).toBeVisible();
    await world.locator(".microworld-disclosure > summary").click();
    await expect(world.locator(".microworld-noscript")).toBeVisible();
    await expect(world.locator(".microworld-noscript")).toContainText(
      "기본 상황을 표시합니다.",
    );
    await expect(world.locator(".microworld-scenario:not([hidden])")).toContainText(
      "실패했고 저장된 오류가 있음",
    );
    await expect(world.locator(".microworld-scenario[hidden]")).toHaveCount(3);
    const defaultControl = world.locator('input[type="radio"].microworld-control').first();
    await expect(defaultControl).toBeDisabled();
    await expect(defaultControl).toBeChecked();
    const quizQuestion = page.locator(".quiz > details.quiz-question").first();
    await quizQuestion.locator(":scope > summary").click();
    await expect(quizQuestion.locator("textarea")).toBeVisible();
    const quizAnswer = quizQuestion.locator("details.quiz-answer");
    await quizAnswer.locator(":scope > summary").click();
    await expect(quizAnswer.locator(".quiz-answer-content")).toBeVisible();
    const evidenceMarker = quizAnswer.locator(".evidence-marker").first();
    await expect(evidenceMarker).toBeVisible();
    const evidenceTargetId = (await evidenceMarker.getAttribute("href")).slice(1);
    await evidenceMarker.click();
    await expect(page).toHaveURL(new RegExp(`#${evidenceTargetId}$`, "u"));
    await expect(page.locator("#evidence-references")).toHaveAttribute("open", "");
    await expect(page.locator(`#${evidenceTargetId}`)).toBeVisible();
    await expectNoPageOverflow(page);
    expect(externalRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
