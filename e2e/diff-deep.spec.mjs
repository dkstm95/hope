import { test, expect } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createArtifact, explainArtifact } from "../plugins/hope/skills/diff-deep/scripts/artifact.mjs";
import { fixture, reasons, providerFiles } from "../test-support/diff-deep-fixture.mjs";
import { registerTestTemporaryDirectoryCleanup } from "../test-support/temporary-directory.mjs";
let cleanup;
const temp = registerTestTemporaryDirectoryCleanup((callback) => { cleanup = callback; });
let url, snapshot;
test.beforeAll(async () => {
  const directory = await temp("hope-deep-browser-");
  snapshot = await fixture();
  const captured = await createArtifact(snapshot, { output: join(directory, "review.html"), locale: "ko-KR" });
  const input = join(directory, "reasons.json");
  await writeFile(input, JSON.stringify(reasons(snapshot)));
  await explainArtifact(captured.artifactPath, input, captured.digest);
  url = pathToFileURL(captured.artifactPath).href;
});
test.afterAll(async () => { await cleanup(); });

test("complete code, change/line navigation, explicit read undo and persistence", async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator(".file")).toHaveCount(4);
  await expect(page.locator("[data-line]")).toHaveCount(6);
  await expect(page.locator("#position")).toHaveText("01 / 5");
  await expect(page.locator("#selected-reason h3")).toHaveText("만료 시점부터 세션을 거부");
  await expect(page.locator("#read-progress")).toContainText("0/7");
  await page.locator("#next-change").click();
  await expect(page.locator("#read-progress")).toContainText("0/7");
  await page.locator("#read-change").click();
  await expect(page.locator("#read-progress")).toContainText("2/7");
  await page.reload();
  await expect(page.locator("#position")).toHaveText("02 / 5");
  await expect(page.locator("#read-change")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-mode=line]").click();
  await page.locator("#read-change").click();
  await expect(page.locator("#read-progress")).toContainText("1/7");
  await page.locator("[data-mode=change]").click();
  await expect(page.locator("#read-change")).toHaveAttribute("aria-pressed", "false");
  await page.locator("[data-select]").last().click();
  await expect(page.locator("#read-change")).toBeDisabled();
  await expect(page.locator("#selected-reason .basis")).toHaveAttribute("data-basis", "unknown");
  expect(errors).toEqual([]);
});

test("light, dark, system, evidence, keyboard and narrow layouts", async ({ page }) => {
  await page.goto(url);
  for (const theme of ["dark", "light", "system"]) {
    await page.locator(`[data-theme-choice=${theme}]`).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(`[data-theme-choice=${theme}]`)).toHaveAttribute("aria-pressed", "true");
  }
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe("rgb(16, 19, 19)");
  await page.locator("#selected-reason .evidence summary").click();
  await expect(page.locator("#selected-reason .evidence pre")).toContainText("Reject a session");
  await page.locator(".capture-info summary").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".capture-info")).not.toHaveAttribute("open", "");
  await expect(page.locator(".capture-info summary")).toBeFocused();
  for (const width of [640, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.locator("[data-select]").first().click();
    await expect(page.locator(".file .reason-aside")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("#selected-reason h3")).toBeVisible();
    await page.locator("#next-change").click();
    await expect(page.locator("#position")).toHaveText("02 / 5");
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".workspace > .reason-aside")).toHaveCount(1);
  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.locator("#read-change")).toBeVisible();
});

test("progress export/import verifies snapshot and storage failure stays usable", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("unavailable"); } }); });
  await page.goto(url);
  await expect(page.locator("#storage-warning")).not.toBeEmpty();
  await page.locator("#read-change").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-progress").click();
  const download = await downloadPromise;
  const progress = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(progress.read).toHaveLength(2);
  await page.reload();
  await expect(page.locator("#read-progress")).toContainText("0/7");
  await page.locator("#progress-file").setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(progress)) });
  await expect(page.locator("#read-progress")).toContainText("2/7");
  await page.locator("#progress-file").setInputFiles({ name: "wrong.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...progress, snapshotId: "wrong" })) });
  await expect(page.locator("#read-progress")).toContainText("2/7");
  await expect(page.locator("#storage-warning")).toContainText("다른 변경");
});

test("hostile code stays literal and document makes no external request", async ({ page }) => {
  const directory = await temp("hope-deep-hostile-");
  const hostile = '</script><img src="https://example.com/trap" onerror="window.pwned=true">';
  const data = await fixture({ files: [{ ...providerFiles[1], additions: 1, patch: `@@ -0,0 +1 @@\n+${hostile}` }] });
  const artifact = await createArtifact(data, { output: join(directory, "hostile.html") });
  const external = []; page.on("request", (request) => { if (/^https?:/u.test(request.url())) external.push(request.url()); });
  await page.goto(pathToFileURL(artifact.artifactPath).href);
  await expect(page.locator(".code-row code")).toHaveText(hostile);
  await expect(page.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(external).toEqual([]);
});

test("JavaScript-disabled and print readers retain complete code and explanations", async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(url);
  await expect(staticPage.locator(".code-row")).toHaveCount(9);
  await staticPage.locator(".inline-reason summary").first().click();
  await expect(staticPage.locator(".inline-reason").first().locator("h3")).toBeVisible();
  await context.close();
  await page.goto(url);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".inline-reason").first()).toBeVisible();
  await expect(page.locator(".inline-reason").first().locator("h3")).toBeVisible();
  await expect(page.locator(".reason-aside")).toBeHidden();
});
