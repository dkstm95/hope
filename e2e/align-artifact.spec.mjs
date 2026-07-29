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
let artifactUrl;

test.beforeAll(async () => {
  artifactDirectory = await mkdtemp(join(tmpdir(), "hope-align-browser-"));
  const state = makeAlignState({
    locale: "ko-KR",
    theme: "dark",
    title: "구현 전에 사람과 AI의 이해를 맞춥니다",
    readiness: {
      state: "approved",
      rationale: "사용자가 현재 이해와 다음 단계를 명시적으로 승인했습니다.",
    },
  });
  state.understanding.goal =
    "중요한 오해를 구현 뒤가 아니라 구현 전에 찾고, 긴 내용도 화면에서 편하게 읽을 수 있게 합니다.";
  state.records.facts[0].text =
    "저장소에서 확인한 사실과 사용자 결정, AI 제안은 서로 다른 그룹으로 보입니다.";
  const rendered = await renderAlignSession(validateAlignState(state, {
    approval: makeAlignApproval(),
  }));
  const artifactPath = join(artifactDirectory, "hope-alignment.html");
  await writeFile(artifactPath, rendered.bytes);
  artifactUrl = pathToFileURL(artifactPath).href;
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
  await page.goto(artifactUrl);
  await expect(page.locator("h1")).toHaveText(
    "구현 전에 사람과 AI의 이해를 맞춥니다",
  );
  await expect(page.locator(".phase")).toHaveText("사용자 승인 완료");
  await expect(page.locator("#records h3")).toHaveText([
    "사용자 결정",
    "저장소에서 확인한 사실",
    "AI 제안",
    "남은 질문",
  ]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("color-scheme", "dark");
  await expectNoOverflow(page);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".record-grid")).toHaveCSS(
    "grid-template-columns",
    "343px",
  );
  await expectNoOverflow(page);
  expect(remoteRequests).toEqual([]);
});

test("alignment has one heading path and visible keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(artifactUrl);
  await expect(page.locator("h1")).toHaveCount(1);
  const headingLevels = await page.locator("h1,h2,h3").evaluateAll(
    (headings) => headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  expect(headingLevels[0]).toBe(1);
  expect(headingLevels.includes(2)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await expect(page.locator(".skip")).toBeVisible();
});
