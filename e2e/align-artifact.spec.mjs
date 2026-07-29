import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { renderAlignSession } from "../features/align/render.mjs";
import { validateAlignState } from "../features/align/validate.mjs";
import {
  makeAlignApproval,
  makeAlignState,
} from "../test-support/align-fixture.mjs";

let artifactDirectory;
let artifactUrls;

test.beforeAll(async () => {
  artifactDirectory = await mkdtemp(join(tmpdir(), "hope-align-browser-"));
  artifactUrls = {};
  const renderArtifact = async (name, state, options) => {
    const rendered = await renderAlignSession(validateAlignState(state, options));
    const artifactPath = join(artifactDirectory, `${name}.html`);
    await writeFile(artifactPath, rendered.bytes);
    artifactUrls[name] = pathToFileURL(artifactPath).href;
  };

  const approved = makeAlignState({
    locale: "ko-KR",
    theme: "dark",
    title: "구현 전에 사람과 AI의 이해를 맞춥니다",
    readiness: {
      state: "approved",
      rationale: "사용자가 현재 이해와 다음 단계를 명시적으로 승인했습니다.",
    },
  });
  approved.understanding.goal =
    "중요한 오해를 구현 뒤가 아니라 구현 전에 찾고, 긴 내용도 화면에서 편하게 읽을 수 있게 합니다.";
  approved.records.facts[0].text =
    "저장소에서 확인한 사실과 사용자 결정, AI 제안은 서로 다른 그룹으로 보입니다.";
  await renderArtifact("approved", approved, {
    approval: makeAlignApproval(),
  });

  const ready = makeAlignState({
    locale: "ko-KR",
    theme: "dark",
  });
  await renderArtifact("ready", ready);

  const blocked = makeAlignState({
    locale: "ko-KR",
    theme: "dark",
    readiness: {
      state: "interviewing",
      rationale: "성공 여부를 판단할 기준이 필요합니다.",
    },
  });
  blocked.understanding.success = [];
  await renderArtifact("blocked", blocked);

  const longContent = makeAlignState({
    locale: "ko-KR",
    theme: "dark",
  });
  longContent.understanding.goal =
    `https://example.com/${"unbroken-path-segment".repeat(80)}`;
  longContent.snapshot.sources[0].label =
    `conversation-${"long-identifier".repeat(80)}`;
  await renderArtifact("long-content", longContent);
});

test.afterAll(async () => {
  if (artifactDirectory) {
    await rm(artifactDirectory, { recursive: true, force: true });
  }
});

async function expectNoOverflow(page) {
  const overflow = await page.evaluate(() => ({
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
    rootClient: document.documentElement.clientWidth,
    rootScroll: document.documentElement.scrollWidth,
  }));
  expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient);
  expect(overflow.rootScroll).toBeLessThanOrEqual(overflow.rootClient);
}

test("alignment stays readable and offline on desktop and mobile", async ({ page }) => {
  const remoteRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) remoteRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(artifactUrls.approved);
  await expect(page.locator("h1")).toHaveText(
    "구현 전에 사람과 AI의 이해를 맞춥니다",
  );
  await expect(page.locator(".phase-badge")).toHaveText("사용자 승인 완료");
  await expect(page.locator('.phase-step[aria-current="step"]')).toContainText(
    "시작 준비",
  );
  await expect(page.locator(".goal-card")).toContainText(
    "중요한 오해를 구현 뒤가 아니라 구현 전에 찾고",
  );
  await expect(page.locator(".next-card")).toContainText(
    "이 이해를 바탕으로 작업을 시작할 수 있습니다",
  );
  await expect(page.locator("#records .record-primary .eyebrow")).toHaveText(
    "사용자 결정",
  );
  await expect(page.locator("#records h3 > span:first-child")).toHaveText([
    "AI 제안",
    "저장소에서 확인한 사실",
  ]);
  await expect(page.locator("#records .decision-clear")).toBeVisible();
  expect(await page.locator("#records .record-disclosure").evaluateAll(
    (items) => items.every((item) => !item.hasAttribute("open")),
  )).toBe(true);
  await expect(page.locator("#perspectives")).not.toHaveAttribute("open", "");
  await expect(page.locator("#history")).not.toHaveAttribute("open", "");
  await expect(page.locator("#sources")).not.toHaveAttribute("open", "");
  await expect(page.locator(".toc-desktop")).toBeVisible();
  await expect(page.locator(".toc-mobile")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("color-scheme", "dark");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("color-scheme", "light");
  await expect(page.locator(".toc-desktop ol a")).toHaveText([
    "범위",
    "예상 동작",
    "현재 공유된 이해",
    "가정과 불확실성",
    "검증 가능한 작업 단위",
    "설계 관점",
    "변경 이력, 근거 출처와 사용량",
  ]);
  await expectNoOverflow(page);

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.locator(".overview-grid").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(/\s+/u),
  )).toHaveLength(1);
  expect(await page.locator(".record-secondary").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(/\s+/u),
  )).toHaveLength(1);
  await expect(page.locator(".toc-desktop")).toBeHidden();
  await expect(page.locator(".toc-mobile")).toBeVisible();
  await expect(page.locator(".toc-mobile > summary")).toHaveCSS(
    "height",
    "44px",
  );
  const sectionTargetHeights = await page.locator(
    "details.section > summary",
  ).evaluateAll((summaries) => summaries.map(
    (summary) => summary.getBoundingClientRect().height,
  ));
  expect(sectionTargetHeights.every((height) => height >= 44)).toBe(true);
  await page.locator("#history > summary").click();
  await page.locator("#sources > summary").click();
  const nestedTargetHeights = await page.locator(
    "#records .record-disclosure > summary,"
      + "#history .audit-disclosure > summary,"
      + "#sources .source > summary",
  ).evaluateAll((summaries) => summaries
    .filter((summary) => summary.getBoundingClientRect().height > 0)
    .map((summary) => summary.getBoundingClientRect().height));
  expect(nestedTargetHeights.length).toBeGreaterThan(0);
  expect(nestedTargetHeights.every((height) => height >= 44)).toBe(true);
  await expectNoOverflow(page);
  expect(remoteRequests).toEqual([]);
});

test("alignment has one heading path and visible keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(artifactUrls.approved);
  await expect(page.locator("h1")).toHaveCount(1);
  const headingLevels = await page.locator("h1,h2,h3").evaluateAll(
    (headings) => headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  expect(headingLevels[0]).toBe(1);
  expect(headingLevels.includes(2)).toBe(true);
  for (let index = 1; index < headingLevels.length; index += 1) {
    expect(headingLevels[index]).toBeLessThanOrEqual(headingLevels[index - 1] + 1);
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await expect(page.locator(".skip")).toBeVisible();

  await page.locator(".toc-mobile > summary").focus();
  await page.keyboard.press("Enter");
  await page.locator('.toc-mobile-panel a[href="#scope"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".toc-mobile")).not.toHaveAttribute("open", "");
  await expect(page.locator("#scope")).toBeFocused();

  await page.goto(`${artifactUrls.approved}#source-repository-1`);
  await expect(page.locator("#history")).toHaveAttribute("open", "");
  await expect(page.locator("#sources")).toHaveAttribute("open", "");
  await expect(page.locator("#source-repository-1")).toHaveAttribute("open", "");
});

test("first-screen actions follow interviewing, approval, and approved states", async ({
  page,
}) => {
  await page.goto(artifactUrls.blocked);
  await expect(page.locator("#overview .next-card h3")).toHaveText(
    "측정 가능한 성공 조건을 추가하세요",
  );
  await expect(page.locator("#overview .next-link")).toHaveAttribute(
    "href",
    "#scope",
  );
  await expect(page.locator("#overview .metric-grid")).toHaveCount(0);

  await page.goto(artifactUrls.ready);
  await expect(page.locator("#overview .next-card h3")).toHaveText(
    "공유된 이해를 확인하고 승인하세요",
  );
  await expect(page.locator("#overview .next-link")).toHaveAttribute(
    "href",
    "#records",
  );
  await expect(page.locator("#records .decision-clear")).toContainText(
    "기록된 결정을 확인한 뒤 이 이해를 승인하거나 수정하세요.",
  );

  await page.goto(artifactUrls.approved);
  await expect(page.locator("#overview .next-link")).toHaveAttribute(
    "href",
    "#slices",
  );
  await expect(page.locator("#records .decision-clear")).toContainText(
    "승인이 기록되었습니다. 이 결정을 구현 계약으로 사용하세요.",
  );
});

test("long authored text reflows at narrow and enlarged text sizes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(artifactUrls["long-content"]);
  await expectNoOverflow(page);
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("DOM.enable");
  await devtools.send("CSS.enable");
  const { frameTree } = await devtools.send("Page.getFrameTree");
  const { styleSheetId } = await devtools.send("CSS.createStyleSheet", {
    frameId: frameTree.frame.id,
  });
  await devtools.send("CSS.setStyleSheetText", {
    styleSheetId,
    text: "body{font-size:32px!important}",
  });
  await expectNoOverflow(page);
});

test("native disclosures remain useful without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(artifactUrls.approved);
  await expect(page.locator("#history")).not.toHaveAttribute("open", "");
  await page.locator("#history > summary").click();
  await expect(page.locator("#history")).toHaveAttribute("open", "");
  await page.locator("#sources > summary").click();
  await expect(page.locator("#sources")).toHaveAttribute("open", "");
  await page.locator("#source-repository-1 > summary").click();
  await expect(page.locator("#source-repository-1 .source-content")).toBeVisible();
  await context.close();
});

test("print reveals content inside every disclosure", async ({ page }) => {
  await page.goto(artifactUrls.approved);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#history .metric-grid")).toBeVisible();
  await expect(
    page.locator("#source-repository-1 .source-content"),
  ).toBeVisible();
  await expect(page.locator("#records .record-disclosure-content").first())
    .toBeVisible();
});
