import { test, expect } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderReview } from "../plugins/hope/skills/diff/scripts/render.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import { fixture, reasons, providerFiles, analysisFor, runId } from "../test-support/diff-reader-fixture.mjs";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";
let cleanup;
const temp = registerTestTemporaryDirectoryCleanup((callback) => { cleanup = callback; });
let url, snapshot;
async function writeReview(path, data, groups = reasons(data).groups) {
  const review = validateAnalysis({ ...analysisFor(data), groups }, data, { runId });
  await writeFile(path, (await renderReview(review)).bytes);
  return pathToFileURL(path).href;
}
test.beforeAll(async () => {
  const directory = await temp("hope-reader-browser-");
  snapshot = fixture();
  url = await writeReview(join(directory, "review.html"), snapshot);
});
test.afterAll(async () => { await cleanup(); });

test("keyboard group navigation preserves focus until an endpoint", async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const next = page.locator("#next-group");
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#position")).toHaveText("02 / 4");
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#position")).toHaveText("03 / 4");
    await expect(next).toBeFocused();
    await expect(page.locator("#read-group")).toBeDisabled();
    await page.keyboard.press("Enter");
    await expect(page.locator("#position")).toHaveText("04 / 4");
    await expect(page.locator("#g-image .group-heading")).toBeFocused();
    const previous = page.locator("#previous-group");
    await previous.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#position")).toHaveText("03 / 4");
    await expect(previous).toBeFocused();
  }
});

test("keyboard line selection keeps one tab stop per code part and the exact follow-up anchor", async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator("#g-expiration .group-heading").click();
    const part = page.locator('#g-expiration .diff-part[data-file="file-1"]');
    const first = part.locator(".code-row").first();
    const target = part.locator('[data-source-line="3"]');
    await part.locator(".part-select").focus();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#selected-reason .reason-location")).toContainText("변경 전 L2");
    await expect(part.locator('.code-row[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("End");
    await expect(part.locator(".code-row").last()).toBeFocused();
    await page.keyboard.press("Space");
    await expect(part.locator(".code-row").last()).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
    await page.locator("#copy-request").click();
    await expect(page.locator("#request-text")).toHaveValue(/"fileId":"file-1","sourceLine":3/u);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("complete code, group navigation, explicit read undo and persistence", async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator(".change-group")).toHaveCount(4);
  await expect(page.locator(".code-row.add, .code-row.del")).toHaveCount(6);
  await expect(page.locator("#position")).toHaveText("01 / 4");
  await expect(page.locator("#selected-reason h3")).toHaveText("만료 시점부터 세션을 거부");
  await expect(page.locator("#read-progress")).toContainText("0/2");
  await page.locator("#next-group").click();
  await expect(page.locator("#read-progress")).toContainText("0/2");
  await page.locator("#read-group").click();
  await expect(page.locator("#read-progress")).toContainText("1/2");
  await page.reload();
  await expect(page.locator("#position")).toHaveText("02 / 4");
  await expect(page.locator("#read-group")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#read-group").click();
  await expect(page.locator("#read-progress")).toContainText("0/2");
  await expect(page.locator("#read-group")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-mode]")).toHaveCount(0);
  await page.locator(".group-select").last().click();
  await expect(page.locator("#read-group")).toBeDisabled();
  await expect(page.locator("#selected-reason .basis")).toHaveAttribute("data-basis", "unknown");
  expect(errors).toEqual([]);
});

test("light, dark, system, evidence, keyboard and narrow layouts", async ({ page }) => {
  await page.goto(url);
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.locator("#diff-reader").evaluate((element) => getComputedStyle(element).colorScheme)).toBe("dark");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  for (const width of [640, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.locator(".group-select").first().click();
    await expect(page.locator(".change-group .reason-aside")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("#selected-reason h3")).toBeVisible();
    await page.locator("#next-group").click();
    await expect(page.locator("#position")).toHaveText("02 / 4");
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".workspace > .reason-aside")).toHaveCount(1);
  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.locator("#read-group")).toBeVisible();
});

test("progress export/import verifies snapshot and storage failure stays usable", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("unavailable"); } }); });
  await page.goto(url);
  await expect(page.locator("#storage-warning")).not.toBeEmpty();
  await page.locator("#read-group").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-progress").click();
  const download = await downloadPromise;
  const progress = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(progress.read).toHaveLength(1);
  await page.reload();
  await expect(page.locator("#read-progress")).toContainText("0/2");
  await page.locator("#progress-file").setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(progress)) });
  await expect(page.locator("#read-progress")).toContainText("1/2");
  await page.locator("#progress-file").setInputFiles({ name: "wrong.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...progress, snapshotId: "wrong" })) });
  await expect(page.locator("#read-progress")).toContainText("1/2");
  await expect(page.locator("#storage-warning")).toContainText("다른 변경");
});

test("hostile code stays literal and document makes no external request", async ({ page }) => {
  const directory = await temp("hope-deep-hostile-");
  const hostile = '</script><img src="https://example.com/trap" onerror="window.pwned=true">';
  const data = await fixture({ files: [{ ...providerFiles[1], additions: 1, patch: `@@ -0,0 +1 @@\n+${hostile}` }] });
  const analysis = analysisFor(data);
  analysis.groups = [{ id: "g-hostile", title: "Literal source", text: "Source text", basis: "unknown", evidence: [], parts: [{ fileId: data.files[0].id }] }];
  // This fixture has one source line: bound the existing macro claims to it too.
  const trim = (value) => { if (!value || typeof value !== "object") return; if (value.sourceId === "source-3") { value.startLine = 2; value.endLine = 2; } for (const child of Object.values(value)) trim(child); };
  trim(analysis);
  const path = join(directory, "hostile.html");
  await writeFile(path, (await renderReview(validateAnalysis(analysis, data, { runId }))).bytes);
  const external = []; page.on("request", (request) => { if (/^https?:/u.test(request.url())) external.push(request.url()); });
  await page.goto(pathToFileURL(path).href);
  await expect(page.locator(".code-row code")).toHaveText(hostile);
  await expect(page.locator("#diff-reader img")).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(external).toEqual([]);
});

test("JavaScript-disabled and print readers retain complete code and explanations", async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(url);
  await expect(staticPage.locator(".code-row")).toHaveCount(9);
  await staticPage.locator(".group-select").first().click();
  await staticPage.locator(".inline-reason summary").first().click();
  await expect(staticPage.locator(".inline-reason").first().locator("h3")).toBeVisible();
  await context.close();
  await page.goto(url);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".inline-reason").first()).toBeVisible();
  await expect(page.locator(".inline-reason").first().locator("h3")).toBeVisible();
  await expect(page.locator(".reason-aside")).toBeHidden();
});


test("follow-up uses Diff and identifies the selected group", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("disabled"); } } });
  });
  await page.goto(url);
  await page.locator(".group-select").nth(1).click();
  await page.locator("#copy-request").click();
  await expect(page.locator("#request-text")).toBeVisible();
  await expect(page.locator("#request-text")).toHaveValue(/g-label/u);
  await expect(page.locator("#request-text")).toHaveValue(/before\/after line numbers/u);
  await expect(page.locator("#request-text")).toHaveValue(/\$hope:diff /u);
  await expect(page.locator("#request-text")).not.toHaveValue(/diff-deep/u);
});


test("code selection shows group details and code evidence links across groups", async ({ page }) => {
  const directory = await temp("hope-deep-selection-");
  const input = reasons(snapshot);
  input.groups[1].evidence = [{ sourceId: snapshot.files[0].sourceIds[0], startLine: 3, endLine: 4 }];
  await page.goto(await writeReview(join(directory, "reader.html"), snapshot, input.groups));
  await page.locator("#g-expiration .group-select").click();
  await page.locator('#g-expiration .code-row[data-source-line="3"]').first().click();
  await expect(page.locator("#selected-reason .selected-context")).toContainText("만료 시각과 같은 경우");
  await expect(page.locator("#selected-reason .related-evidence")).toHaveCount(1);
  await expect(page.locator(".selected-code")).toHaveCount(1);
  await page.locator("#g-expiration .group-select").click();
  await page.locator("#g-label .group-select").click();
  await page.locator('#g-label .part-select').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#selected-reason h3")).toHaveText(input.groups[1].title);
  await expect(page.locator("#selected-reason .selected-context")).not.toContainText("변경되지 않은 맥락");
  await page.locator("#selected-reason .evidence summary").click();
  await page.locator("#selected-reason .source-jump").click();
  await expect(page.locator(".selected-group")).toHaveAttribute("id", "g-expiration");
  await expect(page.locator(".selected-code")).toHaveAttribute("data-source-line", "3");
  await expect(page.locator(".selected-code")).toBeFocused();
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator("#selected-reason .evidence summary").click();
  await page.locator("#selected-reason .source-jump").click();
  expect(await page.locator(".selected-code").evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(58);
  await expect(page.locator(".code-row")).toHaveCount(9);
});

test("regrouping follows selected code and viewport while invalidating revised read markers", async ({ page }) => {
  const directory = await temp("hope-deep-regroup-");
  const path = join(directory, "reader.html");
  const input = reasons(snapshot);
  await page.setViewportSize({ width: 1280, height: 450 });
  await page.goto(await writeReview(path, snapshot, input.groups));
  for (const heading of await page.locator(".group-select").all()) await heading.click();
  const selected = page.locator('#g-label .code-row[data-source-line="6"]');
  await selected.click();
  await page.locator("#read-group").click();
  await selected.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 24));
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem(`hope.diff.reader.v1:${JSON.parse(document.getElementById("diff-reader-document").textContent).snapshot.id}`)).viewport?.anchor.sourceLine)).toBe(6);
  input.groups = [input.groups[2], input.groups[3], input.groups[1], input.groups[0]];
  await writeReview(path, snapshot, input.groups);
  await page.reload();
  await expect(page.locator(".selected-group")).toHaveAttribute("id", "g-label");
  await expect(page.locator(".selected-code")).toHaveAttribute("data-source-line", "6");
  await expect(page.locator("#read-group")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => Math.abs(await selected.evaluate((element) => element.getBoundingClientRect().top) - 24)).toBeLessThan(2);
  input.groups[2].text += " 설명을 보완했습니다.";
  await writeReview(path, snapshot, input.groups);
  await page.reload();
  await expect(page.locator("#read-group")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#read-progress")).toContainText("0/2");
  await expect(page.locator(".code-row")).toHaveCount(9);

});


test("groups start collapsed, toggle independently by keyboard, and retain detail selection", async ({ page }) => {
  await page.goto(url);
  await expect(page.locator(".group-disclosure[open]")).toHaveCount(0);
  await expect(page.locator(".code-row:visible")).toHaveCount(0);
  const heading = page.locator("#g-label .group-select");
  await heading.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#g-label .group-disclosure")).toHaveAttribute("open", "");
  await expect(page.locator(".group-disclosure[open]")).toHaveCount(1);
  await expect(page.locator("#selected-reason h3")).toHaveText("유효 기간이 남았다는 뜻을 이름에 반영");
  await expect(page.locator("#read-progress")).toContainText("0/2");
  await page.reload();
  await expect(page.locator(".group-disclosure[open]")).toHaveCount(1);
  await heading.click();
  await expect(page.locator(".group-disclosure[open]")).toHaveCount(0);
  await expect(page.locator("#selected-reason h3")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator("#selected-reason h3")).toBeVisible();
  await heading.click();
  await expect(page.locator("#g-label .code-row").first()).toBeVisible();
  await heading.click();
  await expect(page.locator("#selected-reason h3")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".code-row:visible")).toHaveCount(9);
});
