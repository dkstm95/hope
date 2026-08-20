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

async function expectNarrowLayouts(page) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.reload();
    await expect(page.locator(".locale-menu")).toBeVisible();
    await expectNoOverflow(page);
  }
}

for (const example of examples) {
  test(`${example.name} README example switches between complete locales`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1168 });
    await page.goto(localUrl(example.english));

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page.locator(".brand-icon")).toBeVisible();
    await page.locator(".locale-menu > summary").click();
    await expect(page.locator(".locale-option")).toHaveText("한국어");
    await expect(page.locator(".locale-option")).toHaveAttribute(
      "href",
      example.korean.split("/").at(-1),
    );
    await expectNoOverflow(page);
    await expectNarrowLayouts(page);

    await page.setViewportSize({ height: 900, width: 1168 });
    await page.reload();
    await page.locator(".locale-menu > summary").click();
    await page.locator(".locale-option").click();
    await expect(page).toHaveURL(localUrl(example.korean));
    await expect(page.locator("html")).toHaveAttribute("lang", "ko-KR");
    await expect(page.locator(".brand-icon")).toBeVisible();
    await page.locator(".locale-menu > summary").click();
    await expect(page.locator(".locale-option")).toHaveText("English");
    await expect(page.locator(".locale-option")).toHaveAttribute(
      "href",
      example.english.split("/").at(-1),
    );
    await expectNoOverflow(page);
    await expectNarrowLayouts(page);
  });
}

test("Align and Diff share product-bar and numbered contents geometry", async ({ page }) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  const metrics = [];
  for (const example of examples) {
    await page.goto(localUrl(example.english));
    const repositorySelector = example.name === "Align" ? ".repository" : ".top-context";
    const tocSelector = example.name === "Align" ? ".rail .toc" : ".toc-desktop";
    const product = await page.locator(repositorySelector).evaluate((element) => {
      const style = getComputedStyle(element);
      const icon = element.querySelector(".repository-icon");
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        iconHeight: icon?.getBoundingClientRect().height,
        iconWidth: icon?.getBoundingClientRect().width,
        paths: [...(icon?.querySelectorAll("path") ?? [])].map((path) => path.getAttribute("d")),
      };
    });
    const controls = await page.locator(".display-controls").evaluate((element) => {
      const style = getComputedStyle(element);
      const theme = element.querySelector(".theme-button");
      return {
        borderRadius: style.borderRadius,
        borderWidth: style.borderTopWidth,
        height: element.getBoundingClientRect().height,
        themeHeight: theme?.getBoundingClientRect().height,
        themeWidth: theme?.getBoundingClientRect().width,
      };
    });
    const toc = await page.locator(`${tocSelector} .toc-link`).first().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        columns: style.gridTemplateColumns,
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
      };
    });
    const tocEntries = await page.locator(`${tocSelector} .toc-link`).evaluateAll((links) => links.map((link) => ({
      id: link.getAttribute("href")?.slice(1),
      number: link.querySelector(".toc-number")?.textContent,
      title: link.querySelector("span:last-child")?.textContent,
    })));
    const bodyEntries = await page.locator(".main > [id]").evaluateAll((sections) => sections.flatMap((section) => {
      const heading = section.querySelector(":scope > .section-title, :scope > .section-heading > h2, :scope > summary > h2");
      const number = heading?.querySelector(".section-number");
      const title = heading?.querySelector("span:last-child");
      return number ? [{
        id: section.id,
        number: number.textContent,
        title: title?.textContent?.split(" · ")[0].trim(),
      }] : [];
    }));
    expect(tocEntries).toEqual(bodyEntries);
    expect(tocEntries.map((entry) => entry.number)).toEqual(
      tocEntries.map((_, index) => String(index + 1).padStart(2, "0")),
    );
    expect(tocEntries[0].title).toBe("Summary");
    const titleSelector = example.name === "Align" ? ".document-head > h1" : ".document-title > h1";
    const firstSectionSelector = example.name === "Align" ? "#overview" : "#synopsis";
    const firstHeadingSelector = example.name === "Align" ? "#overview-title" : "#synopsis-title";
    await expect(page.locator(titleSelector)).toBeVisible();
    await expect(page.locator(`${titleSelector} .section-number`)).toHaveCount(0);
    const readingRhythm = await page.evaluate(({ firstHeadingSelector, firstSectionSelector, titleSelector }) => {
      const firstSection = document.querySelector(firstSectionSelector);
      const heading = document.querySelector(firstHeadingSelector);
      const number = heading.querySelector(".section-number");
      const label = heading.querySelector("span:last-child");
      return {
        border: getComputedStyle(firstSection).borderTopWidth,
        labelFontSize: getComputedStyle(label).fontSize,
        margin: getComputedStyle(firstSection).marginTop,
        numberFontSize: getComputedStyle(number).fontSize,
        padding: getComputedStyle(firstSection).paddingTop,
        titleLeft: document.querySelector(titleSelector).getBoundingClientRect().left,
      };
    }, { firstHeadingSelector, firstSectionSelector, titleSelector });
    expect(readingRhythm).toMatchObject({
      border: "0px",
      labelFontSize: "18px",
      margin: "24px",
      numberFontSize: "18px",
      padding: "16px",
      titleLeft: 40,
    });
    await expect(page.locator(".display-controls > .locale-menu")).toHaveCount(1);
    await expect(page.locator(".display-controls > .theme-button")).toHaveCount(1);
    if (example.name === "Diff") {
      await expect(page.locator(".display-controls .pull-request-link")).toHaveCount(0);
      await expect(page.locator(".topbar-actions > .pull-request-link")).toHaveCount(1);
    }
    metrics.push({ controls, product, readingRhythm, toc });
  }
  expect(metrics[0].product).toEqual(metrics[1].product);
  expect(metrics[0].controls).toEqual(metrics[1].controls);
  expect(metrics[0].readingRhythm).toEqual(metrics[1].readingRhythm);
  expect(metrics[0].toc).toEqual(metrics[1].toc);
  expect(metrics[0].controls).toMatchObject({
    borderRadius: "6px",
    borderWidth: "1px",
    height: 44,
    themeHeight: 42,
    themeWidth: 42,
  });
});
