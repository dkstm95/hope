import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { renderAlignSession } from "../features/align/render.mjs";
import { validateAlignState } from "../features/align/validate.mjs";
import {
  makeAlignApproval,
  makeAlignPreviewState,
  makeLegacyAlignState,
  makePreviewV2AlignState,
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

  const approved = makeAlignPreviewState({
    locale: "ko-KR",
    theme: "dark",
    title: "구현 전에 사람과 AI의 이해를 맞춥니다",
    readiness: {
      state: "approved",
      rationale: "사용자가 현재 이해와 다음 단계를 명시적으로 승인했습니다.",
    },
  });
  approved.understanding.goal =
    "중요한 오해를 구현 전에 찾고, 긴 내용도 한 방향으로 편하게 읽습니다.";
  await renderArtifact("approved", approved, {
    approval: makeAlignApproval(),
  });

  await renderArtifact("ready", makeAlignPreviewState({
    locale: "ko-KR",
    theme: "dark",
  }));

  const blocked = makeAlignPreviewState({
    locale: "ko-KR",
    theme: "dark",
    readiness: {
      state: "interviewing",
      rationale: "성공 여부를 판단할 기준이 필요합니다.",
    },
  });
  blocked.understanding.success = [];
  await renderArtifact("blocked", blocked);

  const longContent = makeAlignPreviewState({
    locale: "ko-KR",
    theme: "dark",
  });
  longContent.understanding.goal =
    `https://example.com/${"unbroken-path-segment".repeat(80)}`;
  await renderArtifact("long-content", longContent);

  await renderArtifact("legacy-v1", makeLegacyAlignState({
    locale: "ko-KR",
    theme: "dark",
  }));
  await renderArtifact("preview-v2", makePreviewV2AlignState({
    locale: "ko-KR",
    theme: "dark",
  }));

  const agreementStates = makeAlignPreviewState({
    locale: "ko-KR",
    theme: "dark",
    readiness: {
      state: "interviewing",
      rationale: "결정할 제안이 남아 있습니다.",
    },
  });
  agreementStates.records.proposals.push({
    id: "proposal-open",
    text: "미결 제안은 합의와 분리해 보여 줍니다.",
    rationale: "결정되지 않은 상태를 숨기지 않습니다.",
    status: "open",
  });
  await renderArtifact("agreement-states", agreementStates);
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

test("alignment shows one decision path and embeds controlled previews", async ({ page }) => {
  const remoteRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) remoteRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(artifactUrls.approved);

  await expect(page.locator("h1")).toHaveText(
    "구현 전에 사람과 AI의 이해를 맞춥니다",
  );
  await expect(page.locator("#overview .status")).toHaveText("사용자 승인 완료");
  await expect(page.locator(".status")).toHaveCount(1);
  await expect(page.locator("#overview .goal")).toContainText("중요한 오해를 구현 전에 찾고");
  await expect(page.locator("#overview .next-action")).toContainText(
    "이 이해를 바탕으로 작업을 시작할 수 있습니다",
  );
  await expect(page.locator("#overview .overview-agreements")).toContainText(
    "The person approved implementation.",
  );
  const overviewBox = await page.locator("#overview").boundingBox();
  expect(overviewBox.y + overviewBox.height).toBeLessThanOrEqual(900);

  await expect(page.locator(".preview-desktop")).toBeVisible();
  await expect(page.locator(".preview-mobile")).toBeHidden();
  await expect(page.locator(".preview-desktop .preview-frame-wide")).toBeVisible();
  await expect(page.locator(".preview-desktop .preview-frame-narrow")).toBeVisible();
  await expect(page.locator(".preview-desktop .preview-frame-wide .preview-action")).toHaveText(
    "Approve or revise this understanding",
  );
  await expect(page.locator(".preview-desktop .preview-frame-narrow .preview-action")).toHaveText(
    "Approve or revise this understanding",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".preview-canvas").first()).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".preview-desktop")).toContainText(
    "Repository architecture source: docs/architecture.md",
  );
  await expect(page.locator(".preview-description")).toContainText("텍스트로 보기");
  await expect(page.locator(".agreement-detail")).not.toHaveAttribute("open", "");
  await expect(page.locator(".additional-agreements")).not.toHaveAttribute("open", "");
  await expect(page.locator(".evidence-group")).not.toHaveAttribute("open", "");
  await expect(page.locator(".assumption-group")).not.toHaveAttribute("open", "");
  await expect(page.locator(".uncertainty-group")).not.toHaveAttribute("open", "");
  await expect(page.locator(".work-item")).not.toHaveAttribute("open", "");
  await expect(page.locator(".agreement-detail > summary").first()).toHaveAccessibleName(
    /사용자 결정.*The person approved implementation\./u,
  );
  expect(
    await page.locator(".agreement-detail > summary").first().ariaSnapshot(),
  ).not.toContain("›");

  await expect(page.locator("#perspectives,#history,#sources,#metrics")).toHaveCount(0);
  await expect(page.getByText("위험도", { exact: true })).toHaveCount(0);
  await expect(page.getByText("기준 시각", { exact: true })).toHaveCount(0);
  await expect(page.locator("code")).toHaveCount(0);

  await expect(page.locator(".toc")).toBeVisible();
  await expect(page.locator(".toc-mobile")).toBeHidden();
  await expect(page.locator(".toc ol a")).toHaveText([
    "범위와 성공 조건",
    "예상 동작",
    "시각적 미리보기",
    "합의된 이해",
    "검증 가능한 작업 단위",
  ]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('[data-theme-icon="light"]')).toBeVisible();
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('[data-theme-icon="dark"]')).toBeVisible();
  await page.locator('.toc a[href="#work"]').click();
  await expect(page.locator('.toc a[href="#work"]')).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expectNoOverflow(page);
  expect(remoteRequests).toEqual([]);
});

test("alignment keeps the same order without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(artifactUrls.approved);
  await expect(page.locator(".toc")).toBeHidden();
  await expect(page.locator(".toc-mobile")).toBeVisible();
  await expect(page.locator(".toc-mobile > summary")).toHaveCSS("min-height", "44px");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const overviewBox = await page.locator("#overview").boundingBox();
  expect(overviewBox.y + overviewBox.height).toBeLessThanOrEqual(812);

  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await expect(page.locator(".skip")).toBeVisible();

  await expect(page.locator(".preview-desktop")).toBeHidden();
  await expect(page.locator(".preview-mobile")).toBeVisible();
  await expect(page.locator(".preview-mobile > .preview-frame-narrow")).toBeVisible();
  await expect(page.locator(".preview-other")).not.toHaveAttribute("open", "");
  await expect(page.locator(".preview-other .preview-frame-wide")).toBeHidden();
  await page.locator(".preview-other > summary").click();
  await expect(page.locator(".preview-other .preview-frame-wide")).toBeVisible();
  await expectNoOverflow(page);

  await page.locator(".toc-mobile > summary").focus();
  await page.keyboard.press("Enter");
  await page.locator('.toc-mobile-panel a[href="#preview"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".toc-mobile")).not.toHaveAttribute("open", "");
});

test("first-screen action follows interviewing, approval, and approved states", async ({ page }) => {
  await page.goto(artifactUrls.blocked);
  await expect(page.locator("#overview .next-action h2")).toHaveText(
    "측정 가능한 성공 조건을 추가하세요",
  );
  await expect(page.locator("#overview .next-action a")).toHaveAttribute("href", "#scope");

  await page.goto(artifactUrls.ready);
  await expect(page.locator("#overview .next-action h2")).toHaveText(
    "공유된 이해를 확인하고 승인하세요",
  );
  await expect(page.locator("#overview .next-action > a")).toHaveAttribute("href", "#agreement");

  await page.goto(artifactUrls.approved);
  await expect(page.locator("#overview .next-action > a")).toHaveAttribute("href", "#work");

  await page.goto(`${artifactUrls.ready}#fact-fact-1`);
  await expect(page.locator(".evidence-group")).toHaveAttribute("open", "");
  await expect(page.locator("#fact-fact-1")).toBeFocused();
  await expect.poll(async () => page.locator("#fact-fact-1").evaluate(
    (node) => node.getBoundingClientRect().top,
  )).toBeGreaterThanOrEqual(64);
});

test("alignment preserves version fallbacks and separates unresolved proposals", async ({ page }) => {
  await page.goto(artifactUrls["legacy-v1"]);
  await expect(page.locator(".agreement-list-primary .agreement-detail")).toHaveCount(2);
  await expect(page.locator(".additional-agreements")).toHaveCount(0);
  await expect(page.locator(".preview-screen-group")).toHaveCount(0);

  await page.goto(artifactUrls["preview-v2"]);
  await expect(page.locator(".agreement-list-primary .agreement-detail")).toHaveCount(2);
  await expect(page.locator(".additional-agreements")).toHaveCount(0);
  await expect(page.locator(".preview-screen-group")).toHaveCount(1);

  await page.goto(artifactUrls["agreement-states"]);
  await expect(page.locator(".agreement-list-primary .agreement-detail")).toHaveCount(1);
  await expect(page.locator(".additional-agreements")).toContainText("AI 제안 · 수락");
  await expect(page.locator(".unresolved-proposals")).toContainText("AI 제안 · 열림");
  await expect(page.locator(".unresolved-proposals")).toContainText(
    "미결 제안은 합의와 분리해 보여 줍니다.",
  );
  await expect(page.locator(".unresolved-proposals details")).toHaveCount(0);
});

test("long text reflows at narrow and enlarged text sizes", async ({ page }) => {
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
  const enlarged = await page.evaluate(() => {
    const contents = document.querySelector(".toc-mobile > summary");
    const goal = document.querySelector("#overview .goal");
    const header = document.querySelector(".topbar").getBoundingClientRect();
    const layout = document.querySelector(".layout").getBoundingClientRect();
    return {
      contentsClientHeight: contents.clientHeight,
      contentsScrollHeight: contents.scrollHeight,
      goalFontSize: Number.parseFloat(getComputedStyle(goal).fontSize),
      headerBottom: header.bottom,
      layoutTop: layout.top,
    };
  });
  expect(enlarged.contentsClientHeight).toBeGreaterThanOrEqual(
    enlarged.contentsScrollHeight,
  );
  expect(enlarged.goalFontSize).toBeGreaterThanOrEqual(32);
  expect(enlarged.layoutTop).toBeGreaterThanOrEqual(enlarged.headerBottom);
  await page.locator(".toc-mobile > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".toc-mobile")).toHaveAttribute("open", "");
});

test("native disclosures work without JavaScript and print keeps content", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(artifactUrls.approved);
  await expect(page.locator("#theme-toggle")).toBeHidden();
  await expect(page.locator(".preview-mobile > .preview-frame-narrow")).toBeVisible();
  await expect(page.locator(".preview-other .preview-frame-wide")).toBeHidden();
  await page.locator(".preview-other > summary").click();
  await expect(page.locator(".preview-other .preview-frame-wide")).toBeVisible();
  await page.locator(".preview-description > summary").click();
  await expect(page.locator(".preview-description ol")).toBeVisible();
  await page.locator(".work-item > summary").click();
  await expect(page.locator(".work-item .disclosure-content")).toBeVisible();
  await page.locator(".work-item > summary").click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".work-item .disclosure-content")).toBeVisible();
  await expect(page.locator(".evidence-group .disclosure-content")).toBeVisible();
  await expect(page.locator(".preview-desktop")).toBeVisible();
  await expect(page.locator(".preview-mobile")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.goto(`${artifactUrls.approved}#scope`);
  await expect.poll(async () => page.locator("#scope").evaluate(
    (node) => node.getBoundingClientRect().top,
  )).toBeGreaterThanOrEqual(64);
  await context.close();
});
