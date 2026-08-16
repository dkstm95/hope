import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  createAlignArtifact,
  reviseAlignArtifact,
} from "../plugins/hope/skills/align/scripts/artifact.mjs";
import {
  makeAlignInput,
  makeDesignDirections,
  makeLegacyAlignInput,
} from "../test-support/align-fixture.mjs";

const execFileAsync = promisify(execFile);
let artifactUrl;
let temporaryRoot;
const directionImages = [
  fileURLToPath(new URL("../assets/readme/hope-align-en.png", import.meta.url)),
  fileURLToPath(new URL("../assets/readme/hope-align-behavior-en.png", import.meta.url)),
];

async function writeInput(name, value) {
  const path = join(temporaryRoot, name);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

async function expectNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
}

test.beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), "hope-align-browser-"));
  await execFileAsync("git", ["init", "-q", temporaryRoot]);
  await execFileAsync("git", [
    "-C",
    temporaryRoot,
    "remote",
    "add",
    "origin",
    "git@github.com:acme/storage.git",
  ]);
  const artifactPath = join(temporaryRoot, "docs", "alignments", "upload-recovery.html");
  const firstInput = await writeInput("first.json", makeLegacyAlignInput({
    designDirections: makeDesignDirections(directionImages),
    behavior: {
      ...makeAlignInput().behavior,
      outcomes: [{
        title: "이전 결과 전용",
        detail: "이전 버전에서만 합의한 결과다.",
        kind: "cancel",
      }],
    },
    evidence: [{ label: "이전 근거 전용", location: "docs/previous.md" }],
  }));
  const created = await createAlignArtifact(
    { inputPath: firstInput, outputPath: artifactPath, root: temporaryRoot },
    {
      now: () => new Date("2026-08-14T00:00:00.000Z"),
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    },
  );
  const secondInput = await writeInput("second.json", makeAlignInput({
    boundary: "복구 기간은 24시간이며 만료된 항목은 복구하지 않는다.",
    designDirections: {
      ...makeDesignDirections(directionImages),
      selection: {
        optionId: "direction-1",
        reason: "복구 선택에 먼저 집중하는 방향을 AI가 위임받아 선택했다.",
        decidedBy: "delegated",
      },
    },
    revisionSummary: "복구 기간과 경계를 명확히 함",
  }));
  await reviseAlignArtifact(
    {
      artifactPath,
      expectedDigest: created.digest,
      inputPath: secondInput,
      root: temporaryRoot,
    },
    { now: () => new Date("2026-08-15T00:00:00.000Z") },
  );
  artifactUrl = pathToFileURL(artifactPath).href;
});

test.afterAll(async () => {
  await rm(temporaryRoot, { force: true, recursive: true });
});

test("Align presents one compact current agreement with secondary history", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1168 });
  await page.goto(artifactUrl);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("실패한 업로드 복구");
  await expect(page.locator(".goal-label")).toHaveText("목표");
  await expect(page.locator(".goal")).toContainText("중단된 업로드를 감지해");
  await expect(page.locator(".synopsis dt").filter({ hasText: "확인 조건" })).toHaveCount(1);
  await expect(page.locator(".overview .check-list > li")).toHaveCount(3);
  await expect(page.locator(".overview .check-by")).toHaveText([
    "AI 에이전트 확인",
    "AI 에이전트 확인",
    "사용자 확인",
  ]);
  await expect(page.locator(".overview .check-list")).toContainText("재개 요청의 시작 위치");
  await expect(page.locator(".overview .check-list")).toContainText("취소 전후의 관련 없는 데이터 스냅샷");
  await expect(page.locator(".brand-icon")).toBeVisible();
  await expect(page.locator(".status")).toHaveText("v2 · 현재 합의");
  await expect(page.locator(".rail")).toBeVisible();
  await expect(page.locator(".rail .rail-history h2")).toHaveText("버전 이력");
  await expect(page.locator(".rail .rail-history .current .revision-head strong"))
    .toHaveText(/^v2 · 현재 합의/u);
  await expect(page.locator(".rail .rail-history .past .revision-head strong"))
    .toHaveText(/^v1 ·/u);
  await expect(page.locator(".rail .rail-history .current")).toContainText("복구 기간과 경계를 명확히 함");
  await expect(page.locator("#revision-1")).not.toHaveAttribute("open", /.+/u);
  await expect(page.locator("#agreement")).toContainText("자동 감지 기반 복구 우선");
  await expect(page.locator("#agreement")).toContainText("사용자 개입 없이");
  await expect(page.locator("#agreement-title")).toHaveText("결정과 구현 선택");
  await expect(page.locator("#design-directions-title")).toHaveText("디자인 시안");
  const currentDirections = page.locator("#design-directions");
  await expect(currentDirections.locator(".design-direction")).toHaveCount(2);
  await expect(currentDirections.locator(".direction-image img")).toHaveCount(2);
  await expect(currentDirections.locator(".direction-status.recommended")).toHaveText("추천");
  await expect(currentDirections.locator(".direction-status.selected")).toHaveText("선택");
  await expect(currentDirections.locator(".direction-decisions")).toContainText("사용자가 AI에 선택을 위임함");
  await expect(currentDirections).toContainText("반영한 점");
  const decodedDirections = await currentDirections.locator(".direction-image img").evaluateAll(
    (images) => images.map((image) => ({ height: image.naturalHeight, width: image.naturalWidth })),
  );
  expect(decodedDirections.every((image) => image.height > 0 && image.width > 0)).toBe(true);
  await expect(page.locator("#intent-history")).toHaveCount(0);
  await expect(page.locator("#goal-history")).toHaveCount(0);
  await expect(page.getByText("현재 구현 기준", { exact: true })).toHaveCount(0);
  await expect(page.getByText("구현 계약", { exact: true })).toHaveCount(0);

  const scopeTops = await page.locator(".scope-column").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(scopeTops[0]).toBe(scopeTops[1]);
  const directionTops = await currentDirections.locator(".design-direction").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(directionTops[0]).toBe(directionTops[1]);
  const geometry = await page.evaluate(() => ({
    brandRepositoryGap: document.querySelector(".repository").getBoundingClientRect().left
      - document.querySelector(".brand").getBoundingClientRect().right,
    connectorRight: document.querySelector(".behavior-connector").getBoundingClientRect().right,
    outcomeLeft: document.querySelector(".outcome-mark").getBoundingClientRect().left,
    railLeft: document.querySelector(".rail").getBoundingClientRect().left,
    repositoryStatusGap: document.querySelector(".status").getBoundingClientRect().left
      - document.querySelector(".repository").getBoundingClientRect().right,
    titleLeft: document.querySelector("h1").getBoundingClientRect().left,
    topbarHeight: document.querySelector(".topbar").getBoundingClientRect().height,
  }));
  expect(geometry.brandRepositoryGap).toBe(24);
  expect(geometry.repositoryStatusGap).toBe(24);
  expect(geometry.connectorRight).toBe(geometry.outcomeLeft);
  expect(geometry.railLeft).toBe(932);
  expect(geometry.titleLeft).toBe(40);
  expect(geometry.topbarHeight).toBe(58);
  await expect(page.locator("body")).toHaveCSS("font-family", '"Hope Sans", sans-serif');
  await expect(page.locator(".decision-number")).toHaveText(["01", "02"]);
  await page.locator("#revision-1 > summary").click();
  await expect(page.locator("#revision-1 .check-list > li")).toHaveCount(3);
  await expect(page.locator("#revision-1 .check-by")).toHaveCount(0);
  await expect(page.locator("#revision-1")).toContainText("이전 결과 전용 (취소)");
  await expect(page.locator("#revision-1")).toContainText("이전 근거 전용");
  await expect(page.locator("#revision-1")).toContainText("docs/previous.md");
  await expect(page.locator("#revision-1 .design-direction")).toHaveCount(2);
  await expect(page.locator("#revision-1 .direction-image img")).toHaveCount(2);
  await expect(page.locator("#revision-1")).toContainText("복구 선택을 첫 화면의 주 행동으로 배치했다");
  await expectNoOverflow(page);
});

test("Align theme action is keyboard reachable and updates its label", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(artifactUrl);
  const theme = page.locator("#theme-toggle");

  await expect(theme).toHaveAttribute("aria-label", "다크 모드로 전환");
  const box = await theme.boundingBox();
  expect(box.height).toBe(44);
  expect(box.width).toBe(44);
  await theme.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(theme).toHaveAttribute("aria-label", "라이트 모드로 전환");
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(theme).toHaveAttribute("aria-label", "다크 모드로 전환");
});

test("Align keeps one reading order and useful navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto(artifactUrl);

  await expect(page.locator(".rail")).toBeHidden();
  await expect(page.locator(".repository")).toBeHidden();
  await expect(page.locator(".brand-icon")).toBeVisible();
  await expect(page.locator(".brand-product")).toBeHidden();
  await expect(page.locator(".status")).toBeVisible();
  await expect(page.locator("#theme-toggle")).toBeVisible();
  const navigation = page.locator(".mobile-navigation");
  await expect(navigation).toBeVisible();
  const navigationButton = navigation.locator(":scope > summary");
  const navigationBox = await navigationButton.boundingBox();
  expect(navigationBox.height).toBe(44);
  expect(navigationBox.width).toBe(44);
  await navigationButton.click();
  await expect(navigation).toHaveAttribute("open", "");
  await expect(navigation.locator(".mobile-repository")).toBeVisible();
  await expect(navigation.locator(".mobile-repository")).toContainText("acme/storage");
  await expect(navigation.locator(".rail-history")).toContainText("버전 이력");
  await navigation.locator('a[href="#agreement"]').click();
  await expect(navigation).not.toHaveAttribute("open", "");
  await expect(page.locator("#agreement")).toBeFocused();

  const scopeTops = await page.locator(".scope-column").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(scopeTops[1]).toBeGreaterThan(scopeTops[0]);
  const behaviorTops = await page.locator(".behavior-steps > li").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(behaviorTops[1]).toBeGreaterThan(behaviorTops[0]);
  const directionTops = await page.locator("#design-directions .design-direction").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(directionTops[1]).toBeGreaterThan(directionTops[0]);
  await expectNoOverflow(page);
});

test("Align remains useful without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(artifactUrl);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#scope")).toBeVisible();
  await expect(page.locator("#behavior")).toBeVisible();
  await expect(page.locator("#design-directions")).toBeVisible();
  await expect(page.locator("#design-directions .direction-image img")).toHaveCount(2);
  await expect(page.locator("#revision-1 > summary")).toBeVisible();
  await context.close();
});

test("Align print uses the light surface and omits navigation", async ({ page }) => {
  await page.goto(artifactUrl);
  await page.emulateMedia({ colorScheme: "dark", media: "print" });
  const styles = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    rail: getComputedStyle(document.querySelector(".rail")).display,
    topbar: getComputedStyle(document.querySelector(".topbar")).display,
  }));
  expect(styles.background).toBe("rgb(251, 250, 247)");
  expect(styles.rail).toBe("none");
  expect(styles.topbar).toBe("none");
});
