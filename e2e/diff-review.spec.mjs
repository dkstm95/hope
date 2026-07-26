import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { digestJson } from "../features/diff/hash.mjs";
import { renderReview } from "../features/diff/render.mjs";
import { validateAnalysis } from "../features/diff/validate.mjs";
import { makeAnalysis, makeSnapshot } from "../test-support/diff-fixture.mjs";

const runId = "4".repeat(32);
const viewports = {
  breakpoint: { height: 900, width: 1100 },
  desktop: { height: 900, width: 1440 },
  mobile: { height: 812, width: 375 },
  wide: { height: 1440, width: 2560 },
};

let artifactDirectory;
let artifactUrl;

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
  const review = validateAnalysis(analysis, snapshot, { runId });
  const rendered = await renderReview(review);
  const artifactPath = join(artifactDirectory, "hope-review.html");
  await writeFile(artifactPath, rendered.bytes);
  artifactUrl = pathToFileURL(artifactPath).href;
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
  await expect(page.locator("#synopsis h2")).toHaveText("변경 요약");
  await expect(page.locator("header .top-context")).toHaveText("example/hope · PR #142");
  await expect(page.locator(".pr-hero")).not.toContainText("example/hope · PR #142");
  await expect(page.locator(".pr-hero")).toContainText("커밋 bbbbbbbb");
  await expect(page.locator(".pr-hero")).not.toContainText(
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
    "추가 검증",
    "추가 검증",
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
  await expect(page.locator("#synopsis .synopsis-state")).toHaveCount(0);
  await expect(page.locator("#synopsis .scope-impact-list")).toBeVisible();
  await expect(page.locator(".code-step-list > li")).toHaveCount(1);
  await expectNoPageOverflow(page);

  for (const viewport of [
    viewports.breakpoint,
    viewports.mobile,
    viewports.wide,
  ]) {
    await page.setViewportSize(viewport);
    await expectNoPageOverflow(page);
  }
  expect(remoteRequests).toEqual([]);
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
    ".quiz > details > summary, #evidence-and-scope > summary, .toc-mobile > summary",
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
  const hero = await page.locator(".pr-hero").boundingBox();
  const synopsis = await page.locator("#synopsis").boundingBox();
  expect(hero).not.toBeNull();
  expect(synopsis).not.toBeNull();
  expect(synopsis.y - (hero.y + hero.height)).toBeLessThanOrEqual(24);
  const synopsisTopBeforeOpen = synopsis.y;
  await mobileTocSummary.click();
  await expect(mobileToc).toHaveAttribute("open", "");
  const openTocBox = await mobileTocSummary.boundingBox();
  expect(openTocBox).not.toBeNull();
  expect(openTocBox.height).toBeGreaterThanOrEqual(44);
  const synopsisAfterOpen = await page.locator("#synopsis").boundingBox();
  expect(synopsisAfterOpen).not.toBeNull();
  expect(synopsisAfterOpen.y).toBe(synopsisTopBeforeOpen);
  await expectNoPageOverflow(page);
});

test("evidence and checked scope disclosures start closed and open independently", async ({
  page,
}) => {
  await openArtifact(page, viewports.desktop);
  const section = page.locator("details#evidence-and-scope");
  const sectionSummary = section.locator(":scope > summary");

  await expect(section).not.toHaveAttribute("open", "");
  await expect(sectionSummary).toBeVisible();
  await sectionSummary.click();
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

  const scopeReference = page.locator('a[href="#scope-limit-1"]').first();
  await scopeReference.click();
  await expect(page.locator("#evidence-and-scope")).toHaveAttribute("open", "");
  await expect(page.locator("#scope-limit-1")).toHaveAttribute("open", "");
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
    await expect(evidenceSection).not.toHaveAttribute("open", "");
    await evidenceSection.locator(":scope > summary").click();
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
    await expectNoPageOverflow(page);
    expect(externalRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
