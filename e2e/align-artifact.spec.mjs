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
  reviseAlignArtifact,
} from "../plugins/hope/skills/align/scripts/artifact.mjs";
import {
  makeAlignInput,
  makeLegacyAlignInputV2,
  makeDesignDirections,
  writeLegacyAlignArtifact,
} from "../test-support/align-fixture.mjs";

const execFileAsync = promisify(execFile);
let artifactUrl;
let temporaryRoot;
const directionImages = [
  fileURLToPath(new URL("../assets/readme/hope-align-ko.png", import.meta.url)),
  fileURLToPath(new URL("../assets/readme/hope-align-decisions-ko.png", import.meta.url)),
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
  const created = await writeLegacyAlignArtifact({
    artifactPath,
    content: {
      designDirections: makeDesignDirections(directionImages),
      behavior: {
        ...makeLegacyAlignInputV2().behavior,
        outcomes: [{
          title: "이전 결과 전용",
          detail: "이전 버전에서만 합의한 결과다.",
          kind: "cancel",
        }],
      },
      evidence: [{ label: "이전 근거 전용", location: "docs/previous.md" }],
    },
  });
  const currentInput = makeAlignInput();
  const secondInput = await writeInput("second.json", makeAlignInput({
    goal: {
      text: currentInput.goal,
      evidenceIds: ["customer-research", "product-requirements"],
    },
    intent: [
      {
        ...currentInput.intent[0],
        statement: {
          text: currentInput.intent[0].statement,
          evidenceIds: ["customer-research"],
        },
      },
      currentInput.intent[1],
      currentInput.intent[2],
    ],
    designDirections: {
      ...makeDesignDirections(directionImages),
      selection: {
        optionId: "direction-1",
        reason: "복구 선택에 먼저 집중하는 방향을 AI가 위임받아 선택했다.",
        decidedBy: "delegated",
      },
    },
    evidence: [
      {
        id: "customer-research",
        label: "업로드 중단 고객 문의",
        location: "docs/research/upload-interruptions.md",
      },
      { id: "product-requirements", label: "제품 요구", location: "https://example.com/requirements" },
    ],
    revisionSummary: "복구 의도와 근거를 명확히 함",
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

test("Align presents one compact current intent with secondary history", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1168 });
  await page.goto(artifactUrl);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("실패한 업로드 복구");
  await expect(page.locator("#overview-title")).toHaveText("01요약");
  const goalRow = page.locator(".overview .synopsis > div").first();
  await expect(goalRow.locator("dt")).toHaveText("목표");
  await expect(goalRow.locator("dd")).toContainText("중단된 업로드를 감지해");
  await expect(page.locator(".overview .synopsis > div")).toHaveCount(2);
  await expect(page.locator(".goal, .goal-label")).toHaveCount(0);
  await expect(page.locator("#intent-title > span:last-child")).toHaveText("결정된 의도");
  await expect(page.locator("#intent .intent-list > li")).toHaveCount(3);
  const verificationMarkers = page.locator("#intent .verification-marker");
  await expect(verificationMarkers).toHaveText(["[AI]", "[AI]", "[유저]"]);
  await expect(verificationMarkers.first()).toHaveAttribute(
    "aria-label",
    /AI 판단 가능/u,
  );
  await expect(verificationMarkers.nth(2)).toHaveAttribute("aria-label", /사용자 판단/u);
  await expect(page.locator("#intent .compact-check-verification")).toHaveCount(0);
  await expect(page.locator("#intent .intent-list")).not.toContainText(
    "원본과 같은 파일을 받을 수 있는지",
  );
  await expect(page.locator("#intent .intent-list")).not.toContainText(
    "관련 없는 업로드 항목과 파일이 그대로 남는지",
  );
  await expect(page.locator(".brand-icon")).toBeVisible();
  await expect(page.locator(".status")).toHaveText("v2 · 현재 의도");
  await expect(page.locator(".rail")).toBeVisible();
  await expect(page.locator(".rail .toc-progress")).toHaveText("1 / 4");
  const currentOverviewLink = page.locator('.rail .toc-link[href="#overview"]');
  await expect(currentOverviewLink).toHaveAttribute("aria-current", "location");
  const currentOverviewStyle = await currentOverviewLink.evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    borderLeftWidth: getComputedStyle(element).borderLeftWidth,
  }));
  expect(currentOverviewStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(currentOverviewStyle.borderLeftWidth).toBe("4px");
  await expect(page.locator(".rail .rail-history h2")).toHaveText("버전 이력");
  await expect(page.locator(".rail .rail-history .current .revision-head strong"))
    .toHaveText(/^v2 · 현재 의도/u);
  await expect(page.locator(".rail .rail-history .past .revision-head strong"))
    .toHaveText("v1");
  await expect(page.locator(".rail .rail-history .current")).toContainText("복구 의도와 근거를 명확히 함");
  await expect(page.locator("#revision-1")).not.toHaveAttribute("open", /.+/u);
  await expect(page.locator("#intent")).toContainText("중단 지점부터 이어서 완료할 수 있다");
  await expect(page.locator("#intent")).toContainText("포함하지 않음");
  await expect(page.locator("#intent")).not.toContainText("미결정 의도");
  await expect(page.locator("#intent .decision-disclosure").first()).not.toHaveAttribute("open", "");
  await expect(page.locator("#intent .decision-reason").first()).not.toBeVisible();
  await expect(page.locator("#evidence")).not.toHaveAttribute("open", "");
  await expect(page.locator("#evidence .section-disclosure-content")).not.toBeVisible();
  await expect(page.locator(".evidence-marker")).toHaveCount(3);
  const firstEvidenceMarker = page.locator('.evidence-marker[href="#evidence-customer-research"]').first();
  await expect(firstEvidenceMarker).toHaveText("[1]");
  await firstEvidenceMarker.click();
  const referencePopover = page.locator("#reference-popover");
  await expect(referencePopover).toBeVisible();
  await expect(page.locator("#reference-popover-title")).toContainText("[1] 업로드 중단 고객 문의");
  await expect(referencePopover).toContainText("docs/research/upload-interruptions.md");
  await expect(page.locator("[data-reference-popover-more]")).toHaveAttribute(
    "href",
    "#evidence-customer-research",
  );
  const anchored = await page.evaluate(() => {
    const marker = document.querySelector('.evidence-marker[href="#evidence-customer-research"]')
      .getBoundingClientRect();
    const popover = document.querySelector("#reference-popover").getBoundingClientRect();
    return {
      gap: popover.top - marker.bottom,
      placement: document.querySelector("#reference-popover").dataset.placement,
    };
  });
  expect(anchored.placement).toBe("below");
  expect(anchored.gap).toBeGreaterThanOrEqual(9);
  expect(anchored.gap).toBeLessThanOrEqual(11);
  await page.locator(".reference-popover-close").click();
  await expect(referencePopover).not.toBeVisible();

  await verificationMarkers.first().click();
  await expect(referencePopover).toBeVisible();
  await expect(page.locator("#reference-popover-title")).toContainText("[AI]");
  await expect(referencePopover).toContainText("원본과 같은 파일을 받을 수 있는지");
  await expect(page.locator("[data-reference-popover-more]")).toHaveAttribute(
    "href",
    "#verification-1",
  );
  await page.locator(".reference-popover-close").click();
  await expect(page.locator("#design-directions-title > span:last-child")).toHaveText("디자인 시안");
  const currentDirections = page.locator("#design-directions");
  await expect(currentDirections.locator(".design-direction")).toHaveCount(2);
  await expect(currentDirections.locator(".direction-image img")).toHaveCount(2);
  await expect(currentDirections.locator(".direction-status.recommended")).toHaveText("추천");
  await expect(currentDirections.locator(".direction-status.selected")).toHaveText("선택");
  await expect(currentDirections.locator(".direction-rationales")).toContainText("사용자가 AI에 선택을 위임함");
  await expect(currentDirections.locator(":scope > .direction-rationales")).toHaveCount(0);
  const directionReferences = currentDirections.locator(".direction-references");
  await expect(directionReferences).toHaveCount(1);
  await expect(directionReferences).not.toHaveAttribute("open", "");
  await expect(directionReferences.locator(".direction-reference-content")).not.toBeVisible();
  const decodedDirections = await currentDirections.locator(".direction-image img").evaluateAll(
    (images) => images.map((image) => ({ height: image.naturalHeight, width: image.naturalWidth })),
  );
  expect(decodedDirections.every((image) => image.height > 0 && image.width > 0)).toBe(true);
  await expect(page.locator("#intent-history")).toHaveCount(0);
  await expect(page.locator("#goal-history")).toHaveCount(0);
  await expect(page.getByText("현재 구현 기준", { exact: true })).toHaveCount(0);
  await expect(page.getByText("구현 계약", { exact: true })).toHaveCount(0);

  const directionTops = await currentDirections.locator(".design-direction").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(directionTops[1]).toBe(directionTops[0]);
  const directionTitleRows = await currentDirections.locator(".direction-title-line").evaluateAll(
    (items) => items.map((item) => {
      const title = item.querySelector("h3").getBoundingClientRect();
      const status = item.querySelector(".direction-status")?.getBoundingClientRect();
      return { statusTop: status?.top, titleTop: title.top };
    }),
  );
  expect(directionTitleRows[0].statusTop).toBeLessThan(
    directionTitleRows[0].titleTop + 24,
  );
  await expect(currentDirections.locator(".design-direction .direction-details")).toHaveCount(2);
  const directionDetailTops = await currentDirections.locator(
    ".design-direction .direction-details",
  ).evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(Math.max(...directionDetailTops) - Math.min(...directionDetailTops)).toBeLessThanOrEqual(1);
  await expect(currentDirections.locator(".design-direction").first()).toContainText(
    "핵심 선택을 빠르게 찾을 수 있다.",
  );
  await expect(currentDirections.locator(".design-direction").nth(1)).toContainText(
    "현재 단계가 분명하다.",
  );
  const referencePlacement = await currentDirections.locator(
    ".design-direction",
  ).first().evaluate((item) => {
    const card = item.getBoundingClientRect();
    const details = item.querySelector(".direction-details").getBoundingClientRect();
    const rationale = item.querySelector(".direction-rationales").getBoundingClientRect();
    const reference = item.querySelector(".direction-references").getBoundingClientRect();
    return {
      cardBottom: card.bottom,
      cardLeft: card.left,
      cardRight: card.right,
      detailsBottom: details.bottom,
      rationaleBottom: rationale.bottom,
      rationaleTop: rationale.top,
      referenceBottom: reference.bottom,
      referenceLeft: reference.left,
      referenceRight: reference.right,
      referenceTop: reference.top,
    };
  });
  expect(referencePlacement.rationaleTop).toBeGreaterThanOrEqual(referencePlacement.detailsBottom);
  expect(referencePlacement.referenceTop).toBeGreaterThanOrEqual(referencePlacement.rationaleBottom);
  expect(referencePlacement.referenceLeft).toBeGreaterThanOrEqual(referencePlacement.cardLeft);
  expect(referencePlacement.referenceRight).toBeLessThanOrEqual(referencePlacement.cardRight);
  expect(referencePlacement.referenceBottom).toBeLessThanOrEqual(referencePlacement.cardBottom);
  const rationaleBoundaryWidths = await currentDirections.locator(
    ".design-direction",
  ).first().evaluate((item) => {
    const rows = [...item.querySelectorAll(".direction-rationales > div")];
    return {
      referenceTop: getComputedStyle(item.querySelector(".direction-references")).borderTopWidth,
      rowBottoms: rows.map((row) => getComputedStyle(row).borderBottomWidth),
      rowTops: rows.map((row) => getComputedStyle(row).borderTopWidth),
    };
  });
  expect(rationaleBoundaryWidths).toEqual({
    referenceTop: "1px",
    rowBottoms: ["0px", "0px"],
    rowTops: ["0px", "1px"],
  });
  await directionReferences.locator(":scope > summary").click();
  await expect(directionReferences.locator(".direction-reference-content")).toBeVisible();
  await expect(directionReferences).toContainText("반영한 점");
  const directionRationalePlacement = await currentDirections.locator(
    ".direction-rationales",
  ).evaluateAll((items) => items.map((item) => ({
    optionId: item.closest(".design-direction")?.id,
    parentClass: item.parentElement?.className,
  })));
  expect(directionRationalePlacement.every((item) => (
    item.optionId?.startsWith("design-direction-")
      && item.parentClass.includes("design-direction")
  ))).toBe(true);
  const sectionBoundaryWidths = await page.evaluate(() => ({
    agreementContentTop: getComputedStyle(document.querySelector(".intent-groups")).borderTopWidth,
    agreementTitleBottom: getComputedStyle(document.querySelector("#intent-title")).borderBottomWidth,
    directionContentTop: getComputedStyle(document.querySelector(".design-direction-list")).borderTopWidth,
    directionTitleBottom: getComputedStyle(document.querySelector("#design-directions-title")).borderBottomWidth,
  }));
  expect(sectionBoundaryWidths).toEqual({
    agreementContentTop: "0px",
    agreementTitleBottom: "2px",
    directionContentTop: "0px",
    directionTitleBottom: "2px",
  });
  const behaviorTops = await page.locator(".behavior-steps > li").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(behaviorTops[1]).toBeGreaterThan(behaviorTops[0]);
  expect(behaviorTops[2]).toBeGreaterThan(behaviorTops[1]);
  const outcomeTops = await page.locator(".behavior-outcomes > li").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(outcomeTops[1]).toBeGreaterThan(outcomeTops[0]);
  const agreementTops = await page.locator(".intent-groups > .intent-group").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(agreementTops[1]).toBeGreaterThan(agreementTops[0]);
  const firstDecision = page.locator("#intent .decision-list > li").first();
  await firstDecision.locator(".decision-disclosure > summary").click();
  const proseOrder = await firstDecision.evaluate((item) => {
    const title = item.querySelector("summary > span").getBoundingClientRect();
    const reason = item.querySelector("p").getBoundingClientRect();
    return {
      reasonLeft: reason.left,
      reasonTop: reason.top,
      titleBottom: title.bottom,
      titleLeft: title.left,
    };
  });
  expect(proseOrder.reasonLeft).toBe(proseOrder.titleLeft);
  expect(proseOrder.reasonTop).toBeGreaterThanOrEqual(proseOrder.titleBottom);
  const geometry = await page.evaluate(() => ({
    brandRepositoryGap: document.querySelector(".repository").getBoundingClientRect().left
      - document.querySelector(".brand").getBoundingClientRect().right,
    firstSectionBorder: getComputedStyle(document.querySelector("#overview")).borderTopWidth,
    firstSectionMargin: getComputedStyle(document.querySelector("#overview")).marginTop,
    firstSectionPadding: getComputedStyle(document.querySelector("#overview")).paddingTop,
    railLeft: document.querySelector(".rail").getBoundingClientRect().left,
    repositoryStatusGap: document.querySelector(".status").getBoundingClientRect().left
      - document.querySelector(".repository").getBoundingClientRect().right,
    summaryLabelFontSize: getComputedStyle(document.querySelector("#overview-title > span:last-child")).fontSize,
    summaryLabelLeft: document.querySelector("#overview-title > span:last-child").getBoundingClientRect().left,
    summaryNumberFontSize: getComputedStyle(document.querySelector("#overview-title > .section-number")).fontSize,
    summaryNumberLeft: document.querySelector("#overview-title > .section-number").getBoundingClientRect().left,
    titleLeft: document.querySelector("h1").getBoundingClientRect().left,
    topbarHeight: document.querySelector(".topbar").getBoundingClientRect().height,
  }));
  expect(geometry.brandRepositoryGap).toBe(24);
  expect(geometry.repositoryStatusGap).toBe(24);
  expect(geometry.railLeft).toBe(932);
  expect(geometry.titleLeft).toBe(40);
  expect(geometry.summaryNumberLeft).toBe(40);
  expect(geometry.summaryLabelLeft).toBe(76);
  expect(geometry.summaryNumberFontSize).toBe(geometry.summaryLabelFontSize);
  expect(geometry.firstSectionBorder).toBe("0px");
  expect(geometry.firstSectionMargin).toBe("24px");
  expect(geometry.firstSectionPadding).toBe("16px");
  expect(geometry.topbarHeight).toBe(58);
  await expect(page.locator("body")).toHaveCSS("font-family", '"Hope Sans", sans-serif');
  await expect(page.locator("body")).toHaveCSS("font-weight", "500");
  await expect(page.locator("#intent > .intent-groups > .intent-record .decision-number")).toHaveText(["01", "02", "03"]);
  await page.locator("#verification > summary").click();
  await expect(page.locator("#verification .section-disclosure-content")).toBeVisible();
  await page.locator("#evidence > summary").click();
  await expect(page.locator("#evidence .section-disclosure-content")).toBeVisible();
  await page.locator("#revision-1 > summary").click();
  await expect(page.locator("#revision-1 .intent-list > li")).toHaveCount(5);
  await expect(page.locator("#revision-1")).toContainText("이전 결과 전용 (취소)");
  await expect(page.locator("#revision-1")).toContainText("이전 근거 전용");
  await expect(page.locator("#revision-1")).toContainText("docs/previous.md");
  await expect(page.locator("#revision-1 .design-direction")).toHaveCount(2);
  await expect(page.locator("#revision-1 .direction-image img")).toHaveCount(2);
  await expect(page.locator("#revision-1")).toContainText("복구 선택을 첫 화면의 주 행동으로 배치했다");
  await page.locator('.rail .toc-link[href="#intent"]').click();
  await expect(page.locator(".rail .toc-progress")).toHaveText("2 / 4");
  await expect(page.locator('.rail .toc-link[href="#intent"]')).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expectNoOverflow(page);
});

test("Align theme action is keyboard reachable and updates its label", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(artifactUrl);
  const theme = page.locator("#theme-toggle");

  await expect(theme).toHaveAttribute("aria-label", "다크 모드로 전환");
  const box = await theme.boundingBox();
  expect(box.height).toBe(42);
  expect(box.width).toBe(42);
  const displayBox = await page.locator(".display-controls").boundingBox();
  expect(displayBox.height).toBe(44);
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
  await navigation.locator('a[href="#intent"]').click();
  await expect(navigation).not.toHaveAttribute("open", "");
  await expect(page.locator("#intent")).toBeFocused();
  const behaviorTops = await page.locator(".behavior-steps > li").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(behaviorTops[1]).toBeGreaterThan(behaviorTops[0]);
  const outcomeTops = await page.locator(".behavior-outcomes > li").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(outcomeTops[1]).toBeGreaterThan(outcomeTops[0]);
  const directionTops = await page.locator("#design-directions .design-direction").evaluateAll(
    (items) => items.map((item) => item.getBoundingClientRect().top),
  );
  expect(directionTops[1]).toBeGreaterThan(directionTops[0]);
  await expect(page.locator("#design-directions .direction-rationales")).toHaveCount(1);
  await expect(page.locator("#design-directions > .direction-rationales")).toHaveCount(0);
  const disclosureHeights = await page.locator(".main").locator(
    ".direction-references > summary, .decision-disclosure > summary",
  ).evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(disclosureHeights.every((height) => height >= 44)).toBe(true);
  await expectNoOverflow(page);
});

test("Align remains useful without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(artifactUrl);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#intent")).toBeVisible();
  await expect(page.locator("#flow")).toBeVisible();
  await expect(page.locator("#design-directions")).toBeVisible();
  await expect(page.locator("#design-directions .direction-image img")).toHaveCount(2);
  await expect(page.locator("#revision-1 > summary")).toBeVisible();
  const reference = page.locator("#design-directions .direction-references");
  await reference.locator(":scope > summary").click();
  await expect(reference.locator(".direction-reference-content")).toBeVisible();
  const decision = page.locator("#intent .decision-disclosure").first();
  await decision.locator(":scope > summary").click();
  await expect(decision.locator(".decision-reason")).toBeVisible();
  const verification = page.locator('#intent .verification-marker[href="#verification-1"]');
  await verification.evaluate((element) => element.click());
  await expect(page).toHaveURL(/#verification-1$/u);
  await expect(page.locator("#verification")).toHaveAttribute("open", "");
  await expect(page.locator("#verification-1")).toBeVisible();
  const marker = page.locator('.evidence-marker[href="#evidence-customer-research"]').first();
  await marker.evaluate((element) => element.click());
  await expect(page).toHaveURL(/#evidence-customer-research$/u);
  await expect(page.locator("#evidence")).toHaveAttribute("open", "");
  await expect(page.locator("#evidence-customer-research")).toBeVisible();
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
  await expect(page.locator("#verification .section-disclosure-content")).toBeVisible();
  await expect(page.locator("#design-directions .direction-reference-content").first()).toBeVisible();
  await expect(page.locator("#intent .decision-reason").first()).toBeVisible();
  await expect(page.locator("#evidence .section-disclosure-content")).toBeVisible();
});
