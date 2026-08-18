import { expect, test } from "@playwright/test";

const examples = [
  {
    english: "docs/alignments/rescene-fan-calendar.en.html",
    korean: "docs/alignments/rescene-fan-calendar.ko.html",
    name: "Align",
  },
  {
    english: "docs/diffs/ky-867-retry-extend.en.html",
    korean: "docs/diffs/ky-867-retry-extend.ko.html",
    name: "Diff",
  },
];

function localUrl(path) {
  return new URL(`../${path}`, import.meta.url).href;
}

async function expectNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

for (const example of examples) {
  test(`${example.name} README example switches between complete locales`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1168 });
    await page.goto(localUrl(example.english));

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page.locator(".brand-icon")).toBeVisible();
    await expect(page.locator(".locale-link")).toHaveText("한국어");
    await expect(page.locator(".locale-link")).toHaveAttribute(
      "href",
      example.korean.split("/").at(-1),
    );
    await expectNoOverflow(page);

    await page.locator(".locale-link").click();
    await expect(page).toHaveURL(localUrl(example.korean));
    await expect(page.locator("html")).toHaveAttribute("lang", "ko-KR");
    await expect(page.locator(".brand-icon")).toBeVisible();
    await expect(page.locator(".locale-link")).toHaveText("English");
    await expect(page.locator(".locale-link")).toHaveAttribute(
      "href",
      example.english.split("/").at(-1),
    );
    await expectNoOverflow(page);

    for (const width of [390, 320]) {
      await page.setViewportSize({ height: 844, width });
      await page.reload();
      await expect(page.locator(".locale-link")).toBeVisible();
      await expectNoOverflow(page);
    }
  });
}
