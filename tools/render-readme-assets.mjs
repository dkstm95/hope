#!/usr/bin/env node

import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, "assets", "readme");
const alignExample = join(
  root,
  "docs",
  "alignments",
  "rescene-fan-calendar.html",
);
const diffExample = join(
  root,
  "docs",
  "diffs",
  "ky-867-retry-extend.html",
);

async function loadPage(page, htmlPath, {
  height = 900,
  width = 1440,
} = {}) {
  await page.setViewportSize({ height, width });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(async () => await document.fonts.ready);
}

async function capturePage(page, htmlPath, outputPath, options = {}) {
  const { height = 900, width = 1440 } = options;
  await loadPage(page, htmlPath, { height, width });
  await page.screenshot({
    animations: "disabled",
    clip: { height, width, x: 0, y: 0 },
    path: outputPath,
    type: "png",
  });
}

async function captureElement(page, htmlPath, outputPath, selector, {
  capturePadding = 16,
  expandDetails = false,
} = {}) {
  await loadPage(page, htmlPath);
  await page.locator(".topbar").evaluate((topbar) => {
    topbar.style.position = "absolute";
  });
  await page.locator(".skip").evaluate((skipLink) => {
    skipLink.style.display = "none";
  });
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  if (expandDetails) {
    await element.evaluate((target) => {
      if (target.matches("details")) target.open = true;
    });
    await element.locator("details").evaluateAll((details) => {
      for (const detail of details) detail.open = true;
    });
  }
  const previousStyle = await element.getAttribute("style");
  await element.evaluate((target, padding) => {
    const style = getComputedStyle(target);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const current = Number.parseFloat(style[`padding${side}`]);
      target.style[`padding${side}`] = `${current + padding}px`;
    }
  }, capturePadding);
  try {
    await element.screenshot({
      animations: "disabled",
      path: outputPath,
      type: "png",
    });
  } finally {
    await element.evaluate((target, style) => {
      if (style === null) target.removeAttribute("style");
      else target.setAttribute("style", style);
    }, previousStyle);
  }
}

async function main() {
  await Promise.all([access(alignExample), access(diffExample)]);
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await capturePage(
      page,
      alignExample,
      join(outputDirectory, "hope-align.png"),
    );
    await captureElement(
      page,
      alignExample,
      join(outputDirectory, "hope-align-directions.png"),
      "#design-directions",
    );
    await captureElement(
      page,
      alignExample,
      join(outputDirectory, "hope-align-decisions.png"),
      "#agreement",
    );

    await capturePage(
      page,
      diffExample,
      join(outputDirectory, "hope-diff.png"),
      { height: 820 },
    );
    await captureElement(
      page,
      diffExample,
      join(outputDirectory, "hope-diff-core.png"),
      "#core-change",
    );
    await captureElement(
      page,
      diffExample,
      join(outputDirectory, "hope-diff-microworld.png"),
      ".microworld",
    );
    await captureElement(
      page,
      diffExample,
      join(outputDirectory, "hope-diff-quiz.png"),
      "#quiz",
      { expandDetails: true },
    );
  } finally {
    await browser.close();
  }
  process.stdout.write(`Rendered README assets in ${outputDirectory}\n`);
}

await main();
