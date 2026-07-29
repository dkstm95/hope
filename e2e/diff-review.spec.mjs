import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { digestJson } from "../features/diff/hash.mjs";
import { renderReview } from "../features/diff/render.mjs";
import { validateAnalysis } from "../features/diff/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingAidDecisions,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";

const runId = "4".repeat(32);
const viewports = {
  breakpoint: { height: 900, width: 1100 },
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
          after: {
            outcome: "성공 값이 계속 전달됩니다.",
            steps: ["마지막 시도가 성공합니다.", "성공 값을 유지합니다."],
          },
          before: {
            outcome: "성공 값이 계속 전달됩니다.",
            steps: ["마지막 시도가 성공합니다.", "성공 값을 반환합니다."],
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
  await expect(page.locator("#synopsis > h2")).toHaveText("요약");
  const synopsisLabelStyle = await page.locator("#synopsis > h2").evaluate(
    (element) => ({
      clip: getComputedStyle(element).clip,
      position: getComputedStyle(element).position,
      width: getComputedStyle(element).width,
    }),
  );
  expect(synopsisLabelStyle).toEqual({
    clip: "rect(0px, 0px, 0px, 0px)",
    position: "absolute",
    width: "1px",
  });
  await expect(page.locator("#synopsis > .synopsis-head > h1")).toBeVisible();
  await expect(page.locator(".synopsis-row > h3").first()).toHaveCSS(
    "padding-top",
    "2px",
  );
  await expect(page.locator("header .top-context")).toHaveText("example/hope · PR #142");
  await expect(page.locator(".pr-hero")).toHaveCount(0);
  await expect(page.locator("#synopsis > .synopsis-head")).not.toContainText(
    "example/hope · PR #142",
  );
  await expect(page.locator("#synopsis > .synopsis-head dt")).toHaveText([
    "커밋",
    "수집 시각",
  ]);
  await expect(page.locator("#synopsis > .synopsis-head dd")).toHaveText([
    "bbbbbbbb",
    "2026-07-23 00:00 UTC",
  ]);
  await expect(page.locator("#synopsis > .synopsis-head")).not.toContainText(
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
  const synopsisLayouts = await page.evaluate(() => {
    const purpose = document.querySelector(".synopsis-row");
    const review = document.querySelector(".synopsis-review");
    const items = [...document.querySelectorAll(".review-item-compact")];
    return {
      purpose: {
        display: getComputedStyle(purpose).display,
        columns: getComputedStyle(purpose).gridTemplateColumns,
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
  expect(synopsisLayouts.review).toEqual(synopsisLayouts.purpose);
  expect(Math.abs(synopsisLayouts.labelTop - synopsisLayouts.firstItemTop)).toBeLessThanOrEqual(
    1,
  );
  expect(synopsisLayouts.itemBorders.every((width) => width === "0px")).toBe(true);
  const changeShift = await page.locator("#synopsis .change-shift").evaluate(
    (element) => {
      const before = element.querySelector(".shift-before").getBoundingClientRect();
      const after = element.querySelector(".shift-now").getBoundingClientRect();
      const arrow = element.querySelector(".shift-arrow").getBoundingClientRect();
      return {
        afterTop: after.top,
        arrowWidth: arrow.width,
        beforeTop: before.top,
        columns: getComputedStyle(element).gridTemplateColumns,
        display: getComputedStyle(element).display,
      };
    },
  );
  expect(changeShift.display).toBe("grid");
  expect(changeShift.columns.split(" ")).toHaveLength(3);
  expect(changeShift.arrowWidth).toBe(40);
  expect(Math.abs(changeShift.beforeTop - changeShift.afterTop)).toBeLessThanOrEqual(1);
  await expect(page.locator(".topbar")).toHaveCSS("position", "sticky");
  await expect(
    page.locator('.toc-desktop a[href="#synopsis"]'),
  ).toHaveAttribute("aria-current", "location");
  const itemActionColumns = await page.locator(
    ".review-items-full .item-actions",
  ).first().evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(itemActionColumns.split(" ")).toHaveLength(3);
  await expect(page.locator("#core-change .core-narrative")).toHaveCount(0);
  await expect(page.locator("#core-change .core-detail")).toHaveCount(1);
  await expect(page.locator("#core-change")).toContainText(
    "The changed branch keeps the last error before it exits.",
  );
  await expect(page.locator("#core-change")).not.toContainText(
    "Return the final error after all retries fail.",
  );
  await expect(page.locator("#synopsis .synopsis-state")).toHaveCount(0);
  await expect(page.locator("#synopsis .scope-impact-list")).toBeVisible();
  await expect(page.locator("#explore .flow")).toHaveCount(1);
  await expect(page.locator("#explore .flow-short")).toHaveCount(1);
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
  const wideFlow = await page.locator("#explore .flow-short").evaluate((flow) => ({
    contentOverflow: [...flow.querySelectorAll(".claim p")].some(
      (content) => content.scrollWidth > content.clientWidth,
    ),
    clientWidth: flow.clientWidth,
    display: getComputedStyle(flow).display,
    scrollWidth: flow.scrollWidth,
  }));
  expect(wideFlow.display).toBe("flex");
  expect(wideFlow.scrollWidth).toBeLessThanOrEqual(wideFlow.clientWidth);
  expect(wideFlow.contentOverflow).toBe(false);

  await page.setViewportSize(viewports.mobile);
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
  const narrowFlow = await page.locator("#explore .flow-short").evaluate((flow) => ({
    clientWidth: flow.clientWidth,
    display: getComputedStyle(flow).display,
    scrollWidth: flow.scrollWidth,
  }));
  expect(narrowFlow.display).toBe("grid");
  expect(narrowFlow.scrollWidth).toBeLessThanOrEqual(narrowFlow.clientWidth);

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
  await page.locator(".synopsis-goal .claim p bdi").evaluate((element) => {
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
  await page.locator('.toc-desktop a[href="#judge"]').click();
  await expect(judge).toBeFocused();

  const currentLinks = page.locator('.toc-desktop a[aria-current="location"]');
  await expect(currentLinks).toHaveCount(1);
  await expect(currentLinks).toHaveAttribute("href", "#judge");
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

  const controls = world.locator("select.microworld-control");
  await expect(controls).toHaveCount(2);
  await expect(world.getByLabel("마지막 시도")).toHaveValue("failed");
  await expect(world.getByLabel("저장된 오류")).toHaveValue("present");
  const controlHeights = await controls.evaluateAll((items) => (
    items.map((item) => item.getBoundingClientRect().height)
  ));
  expect(controlHeights.every((height) => height >= 44)).toBe(true);

  const visibleScenario = world.locator(".microworld-scenario:not([hidden])");
  await expect(visibleScenario).toHaveCount(1);
  await expect(visibleScenario).toContainText("실패했고 저장된 오류가 있음");
  await expect(world.locator(".microworld-scenario[hidden]")).toHaveCount(3);

  const attempt = world.getByLabel("마지막 시도");
  const savedError = world.getByLabel("저장된 오류");
  await attempt.focus();
  await expect(attempt).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(savedError).toBeFocused();
  await attempt.selectOption("succeeded");
  await expect(attempt).toHaveValue("succeeded");
  await expect(visibleScenario).toContainText("성공했고 저장된 오류가 있음");
  await expect(world.locator("[data-microworld-status]")).toContainText(
    "마지막 시도: 성공",
  );

  await savedError.selectOption("missing");
  await expect(visibleScenario).toContainText("성공했고 저장된 오류가 없음");
  await expect(world.locator(".microworld-scenario[hidden]")).toHaveCount(3);

  await page.setViewportSize(viewports.mobile);
  await expectNoPageOverflow(page);
  expect(remoteRequests).toEqual([]);
});

test("the artifact explains every teaching-aid omission", async ({ page }) => {
  await page.setViewportSize(viewports.mobile);
  await page.goto(omittedArtifactUrl);

  const section = page.locator("#teaching-aids");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", {
    exact: true,
    name: "교육 보조 자료 선택",
  })).toBeVisible();
  await expect(section.locator(".teaching-aid-choice")).toHaveCount(3);
  await expect(section.locator(".teaching-aid-decision")).toHaveText([
    "생략",
    "생략",
    "생략",
  ]);
  await expect(section.locator("h3")).toHaveText([
    "시각 자료",
    "마이크로월드",
    "퀴즈",
  ]);
  await expect(section.locator("dd")).toHaveText([
    "글만으로도 이 변경을 쉽게 이해할 수 있습니다.",
    "글만으로도 이 변경을 쉽게 이해할 수 있습니다.",
    "글만으로도 이 변경을 쉽게 이해할 수 있습니다.",
  ]);
  await expectNoPageOverflow(page);
});

test("the artifact distinguishes mixed teaching-aid decisions", async ({ page }) => {
  await page.setViewportSize(viewports.mobile);
  await page.goto(visualArtifactUrls.sequence);

  const section = page.locator("#teaching-aids");
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
  await expectNoPageOverflow(page);
});

test("visual routes expose endpoints and direction to the accessibility tree", async ({
  page,
}) => {
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
});

test("theme and contents controls share one visual control family", async ({ page }) => {
  await openArtifact(page, viewports.breakpoint);
  const theme = page.locator("#theme-toggle");
  const contents = page.locator(".toc-mobile > summary");
  const [themeBox, contentsBox] = await Promise.all([
    theme.boundingBox(),
    contents.boundingBox(),
  ]);

  expect(themeBox).not.toBeNull();
  expect(contentsBox).not.toBeNull();
  expect(themeBox.height).toBe(44);
  expect(contentsBox.height).toBe(44);

  const styles = await page.evaluate(() => {
    const themeControl = document.querySelector("#theme-toggle");
    const contentsControl = document.querySelector(".toc-mobile > summary");
    return {
      contents: {
        borderRadius: getComputedStyle(contentsControl).borderRadius,
        borderStyle: getComputedStyle(contentsControl).borderStyle,
        borderWidth: getComputedStyle(contentsControl).borderWidth,
      },
      theme: {
        borderRadius: getComputedStyle(themeControl).borderRadius,
        borderStyle: getComputedStyle(themeControl).borderStyle,
        borderWidth: getComputedStyle(themeControl).borderWidth,
      },
    };
  });
  expect(styles.theme).toEqual(styles.contents);
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

test("mobile evidence controls are distinct and large enough to touch", async ({
  page,
}) => {
  await openArtifact(page, viewports.mobile);
  const summaries = page.locator("details.evidence > summary");
  const count = await summaries.count();
  expect(count).toBeGreaterThan(1);

  const names = await summaries.evaluateAll((items) => (
    items.map((item) => item.getAttribute("aria-label"))
  ));
  expect(names.every(Boolean)).toBe(true);
  expect(new Set(names).size).toBe(names.length);

  for (let index = 0; index < count; index += 1) {
    const box = await summaries.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const otherSummaries = page.locator(
    ".quiz > details > summary, .quiz-answer > summary, "
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
  const main = await page.locator("main").boundingBox();
  const synopsis = await page.locator("#synopsis").boundingBox();
  expect(main).not.toBeNull();
  expect(synopsis).not.toBeNull();
  expect(synopsis.y - main.y).toBeLessThanOrEqual(1);
  const synopsisTopBeforeOpen = synopsis.y;
  await mobileTocSummary.click();
  await expect(mobileToc).toHaveAttribute("open", "");
  const openTocBox = await mobileTocSummary.boundingBox();
  expect(openTocBox).not.toBeNull();
  expect(openTocBox.height).toBeGreaterThanOrEqual(44);
  const synopsisAfterOpen = await page.locator("#synopsis").boundingBox();
  expect(synopsisAfterOpen).not.toBeNull();
  expect(synopsisAfterOpen.y).toBe(synopsisTopBeforeOpen);
  const coreLink = mobileToc.locator('a[href="#core-change"]');
  await expect(coreLink).toHaveCount(1);
  await coreLink.click();
  await expect(mobileToc).not.toHaveAttribute("open", "");
  await expect(page.locator("#core-change")).toBeFocused();
  await expectNoPageOverflow(page);
});

test("the mobile contents panel remains bounded, scrollable, and visibly current", async ({
  page,
}) => {
  await openArtifact(page, { height: 360, width: 320 });
  await page.locator("#judge").evaluate(
    (element) => element.scrollIntoView({ block: "start" }),
  );

  const toc = page.locator(".toc-mobile");
  await toc.locator(":scope > summary").click();
  const panel = toc.locator(".toc-mobile-panel");
  const panelState = await panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(panelState.bottom).toBeLessThanOrEqual(360);
  expect(panelState.overflowY).toBe("auto");
  expect(panelState.scrollHeight).toBeGreaterThan(panelState.clientHeight);

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
  expect(currentStyle.borderLeftWidth).toBe("3px");
  expect(Number(currentStyle.fontWeight)).toBeGreaterThanOrEqual(700);

  const lastLink = toc.locator('a[href="#evidence-and-scope"]');
  await lastLink.scrollIntoViewIfNeeded();
  await lastLink.click();
  await expect(toc).not.toHaveAttribute("open", "");
  await expect(page.locator("#evidence-and-scope")).toBeFocused();
  await expectNoPageOverflow(page);
});

test("quiz separates an optional response from the answer and evidence", async ({
  page,
}) => {
  await openArtifact(page, viewports.mobile);
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
  await expect(answer.locator(".evidence-inline")).toBeVisible();
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
  await expect(answer.locator(".evidence-inline")).toBeVisible();
});

test("the evidence appendix starts open while its groups and code evidence stay closed", async ({
  page,
}) => {
  await openArtifact(page, viewports.desktop);
  const codeEvidence = page.locator("#follow-code details.evidence");
  expect(await codeEvidence.count()).toBeGreaterThan(0);
  expect(await codeEvidence.evaluateAll((items) => (
    items.every((item) => !item.hasAttribute("open"))
  ))).toBe(true);

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

test("highlighted code preserves source line breaks in the DOM", async ({ page }) => {
  await openArtifact(page, viewports.desktop);
  const code = page.locator(".syntax-code code").filter({ hasText: "+const last" }).first();
  await code.evaluate((element) => {
    const details = element.closest("details");
    if (details) details.open = true;
  });
  await expect(code).toBeVisible();
  const text = (await code.innerText()).replaceAll("\r\n", "\n");
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
  const reference = page.locator('.evidence-reference a[href^="#evidence-"]').first();
  await reference.evaluate((element) => {
    const details = element.closest("details");
    if (details) details.open = true;
  });
  await expect(reference).toBeVisible();
  const targetId = (await reference.getAttribute("href")).slice(1);

  await page.locator(`#${targetId}`).evaluate((target) => {
    const details = target.closest("details");
    if (details) details.open = false;
  });
  await reference.click();

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
    await expect(page.locator(".syntax-code code").first()).toContainText(
      "throw new Error()",
    );
    const world = page.locator("#explore .microworld");
    await expect(world).toBeVisible();
    await expect(world.locator(".microworld-noscript")).toBeVisible();
    await expect(world.locator(".microworld-noscript")).toContainText(
      "기본 상황을 표시합니다.",
    );
    await expect(world.locator(".microworld-scenario:not([hidden])")).toContainText(
      "실패했고 저장된 오류가 있음",
    );
    await expect(world.locator(".microworld-scenario[hidden]")).toHaveCount(3);
    await expect(world.locator("select.microworld-control").first()).toBeDisabled();
    const quizQuestion = page.locator(".quiz > details.quiz-question").first();
    await quizQuestion.locator(":scope > summary").click();
    await expect(quizQuestion.locator("textarea")).toBeVisible();
    const quizAnswer = quizQuestion.locator("details.quiz-answer");
    await quizAnswer.locator(":scope > summary").click();
    await expect(quizAnswer.locator(".quiz-answer-content")).toBeVisible();
    await expect(quizAnswer.locator(".evidence-inline")).toBeVisible();
    await expectNoPageOverflow(page);
    expect(externalRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
