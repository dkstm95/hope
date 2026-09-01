import { expect, test } from "@playwright/test";

import {
  ARTIFACT_COLORS,
  ARTIFACT_LAYOUT,
  ARTIFACT_TYPE,
} from "../plugins/hope/assets/artifact-theme.mjs";

const examples = [
  {
    english: "docs/alignments/rescene-fan-calendar.en.html",
    korean: "docs/alignments/rescene-fan-calendar.ko.html",
    name: "Align",
  },
  {
    english: "docs/diffs/ky-825-total-timeout.en.html",
    korean: "docs/diffs/ky-825-total-timeout.ko.html",
    name: "Diff",
  },
];

function localUrl(path) {
  return new URL(`../${path}`, import.meta.url).href;
}

function rgb(hex) {
  const value = hex.slice(1);
  return `rgb(${[0, 2, 4].map((offset) => (
    Number.parseInt(value.slice(offset, offset + 2), 16)
  )).join(", ")})`;
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

test("Diagram README example switches language, responds to input, and fits narrow screens", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ height: 760, width: 1100 });
  await page.goto(localUrl("docs/visualizations/parcel-handoff.html"));
  const root = page.locator("#parcel-handoff-diagram");

  await expect(root).toBeVisible();
  await expect(page.locator(".topbar .brand")).toContainText("HOPE");
  await expect(page.locator(".topbar .brand-product")).toHaveText("/ DIAGRAM");
  await expect(page.locator(".brand-icon")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("font-family", '"Hope Sans", sans-serif');
  await expect(page.locator("body")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.body.wide.fontSize}px`,
  );
  await expect(page.locator(".brand")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.brand.wide.fontSize}px`,
  );
  await expect(page.locator("h1")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.pageTitle.wide.fontSize}px`,
  );
  await expect(page.locator(".section-title")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.sectionTitle.wide.fontSize}px`,
  );
  const displayControls = await page.locator(".display-controls").boundingBox();
  expect(displayControls.height).toBe(44);
  await expect(page.locator(".topbar")).toHaveCSS(
    "min-height",
    `${ARTIFACT_LAYOUT.topbarHeight}px`,
  );
  await expect(page.locator(".handoff").first()).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".handoff-line").first()).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByText("Order details", { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="generator"]')).toHaveAttribute("content", "Hope Diagram");
  await page.locator("#locale-en").check();
  await expect(root).toHaveAttribute("data-locale", "en");
  await expect(page.locator("#parcel-title")).toContainText("How does my parcel");

  await page.locator('[data-stage="1"]').click();
  await expect(page.locator('[data-stage="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-selected-title]")).toHaveText("Parcel prepared");

  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#theme-toggle")).toHaveAttribute(
    "aria-label",
    "Switch to light theme",
  );
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#theme-toggle")).toHaveAttribute(
    "aria-label",
    "Switch to dark theme",
  );

  await page.setViewportSize({ height: 844, width: 390 });
  await page.reload();
  await expect(root).toBeVisible();
  await expect(page.locator(".brand")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.brand.narrow.fontSize}px`,
  );
  await expect(page.locator("h1")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.pageTitle.narrow.fontSize}px`,
  );
  await expect(page.locator(".section-title")).toHaveCSS(
    "font-size",
    `${ARTIFACT_TYPE.sectionTitle.narrow.fontSize}px`,
  );
  const narrowSectionType = await page.locator(".section-title").evaluate((heading) => ({
    labelLineHeight: getComputedStyle(heading).lineHeight,
    numberFontSize: getComputedStyle(heading.querySelector(".section-number")).fontSize,
    numberLineHeight: getComputedStyle(heading.querySelector(".section-number")).lineHeight,
  }));
  const narrowSectionLineHeight = `${
    ARTIFACT_TYPE.sectionTitle.narrow.fontSize
    * ARTIFACT_TYPE.sectionTitle.narrow.lineHeight
  }px`;
  expect(narrowSectionType).toEqual({
    labelLineHeight: narrowSectionLineHeight,
    numberFontSize: `${ARTIFACT_TYPE.sectionTitle.narrow.fontSize}px`,
    numberLineHeight: narrowSectionLineHeight,
  });
  const dimensions = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("Diagram README example preserves readable geometry and contrast", async ({ page }) => {
  const textPairs = [
    [".deck", "body"],
    ['[data-stage="0"] .stage-action', '[data-stage="0"]'],
    ['[data-stage="1"] .stage-action', '[data-stage="1"]'],
    [".handoff-label", "body"],
    ['[data-stage="1"] .selected-marker', '[data-stage="1"]'],
    [".detail-label", ".selected-detail"],
    [".detail-copy p", ".selected-detail"],
    [".scope-note", "body"],
  ];

  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1100, 760, 390, 320]) {
      await page.setViewportSize({ height: 900, width });
      await page.goto(localUrl("docs/visualizations/parcel-handoff.html"));
      for (const locale of ["en", "ko"]) {
        await page.locator(`#locale-${locale}`).check();
        for (const stage of [0, 1, 2, 3]) {
          await page.locator(`[data-stage="${stage}"]`).click();
          await expectNoOverflow(page);

          const geometry = await page.locator("#parcel-handoff-diagram").evaluate((root) => {
            const visible = [...root.querySelectorAll(
              ".diagram-header, .stage-button, .handoff, .selected-detail, .scope-note",
            )].filter((element) => getComputedStyle(element).visibility !== "hidden");
            const clipped = visible.filter((element) => (
              element.scrollWidth > element.clientWidth + 1
              || element.getBoundingClientRect().right > document.documentElement.clientWidth + 1
              || element.getBoundingClientRect().left < -1
            ));
            const targets = [...document.querySelectorAll(".language label, .theme-button, .stage-button")]
              .map((element) => element.getBoundingClientRect());
            return {
              clipped: clipped.map((element) => ({
                className: element.className,
                clientWidth: element.clientWidth,
                left: element.getBoundingClientRect().left,
                right: element.getBoundingClientRect().right,
                scrollWidth: element.scrollWidth,
              })),
              minimumTargetHeight: Math.min(...targets.map((bounds) => bounds.height)),
            };
          });
          expect(geometry.clipped).toEqual([]);
          expect(geometry.minimumTargetHeight).toBeGreaterThanOrEqual(44);
        }
      }
    }

    await page.setViewportSize({ height: 760, width: 1100 });
    await page.goto(localUrl("docs/visualizations/parcel-handoff.html"));
    const technicalRecordColors = await page.evaluate(() => ({
      accent: getComputedStyle(document.querySelector(".section-number")).color,
      ink: getComputedStyle(document.body).color,
      paper: getComputedStyle(document.body).backgroundColor,
    }));
    const colors = ARTIFACT_COLORS[colorScheme];
    expect(technicalRecordColors).toEqual({
      accent: rgb(colors.accent),
      ink: rgb(colors.text),
      paper: rgb(colors.background),
    });
    const ratios = await page.evaluate((pairs) => {
      function channels(value) {
        return value.match(/[\d.]+/gu).slice(0, 3).map(Number);
      }
      function luminance(value) {
        const components = channels(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * components[0] + 0.7152 * components[1] + 0.0722 * components[2];
      }
      return pairs.map(([foregroundSelector, backgroundSelector]) => {
        const foreground = getComputedStyle(document.querySelector(foregroundSelector)).color;
        const background = getComputedStyle(document.querySelector(backgroundSelector)).backgroundColor;
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        return { foregroundSelector, ratio: (lighter + 0.05) / (darker + 0.05) };
      });
    }, textPairs);
    for (const { foregroundSelector, ratio } of ratios) {
      expect(ratio, `${foregroundSelector} in ${colorScheme}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("Diagram README example keeps a useful static frame without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(localUrl("docs/visualizations/parcel-handoff.html"));
  await expect(page.locator("#parcel-handoff-diagram")).toBeVisible();
  await expect(page.locator(".topbar-actions")).toBeHidden();
  await expect(page.locator(".stage-button").first()).toBeDisabled();
  await expect(page.getByText("Order details", { exact: true })).toBeVisible();
  await context.close();
});

test("Diagram README example prints on a light surface from a dark system theme", async ({ page }) => {
  await page.goto(localUrl("docs/visualizations/parcel-handoff.html"));
  await page.emulateMedia({ colorScheme: "dark", media: "print" });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".topbar-actions")).toBeHidden();
});
