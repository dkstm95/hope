#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { chromium } from "@playwright/test";

import {
  inspectAlignArtifact,
  sealAlignHtml,
} from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";
import { renderReview } from "../plugins/hope/skills/diff/scripts/render.mjs";
import { validateAnalysis } from "../plugins/hope/skills/diff/scripts/validate.mjs";
import {
  alternateLocale,
  makeAlignArtifactData,
  makeDiffAnalysis,
  makeDiffSnapshot,
} from "./readme-examples.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const digestPlaceholder = "0".repeat(64);

const examples = [
  { alternateLocale: "ko-KR", alternateSuffix: "ko", locale: "en-US", suffix: "en" },
  { alternateLocale: "en-US", alternateSuffix: "en", locale: "ko-KR", suffix: "ko" },
];
const captureNames = [
  "align",
  "align-directions",
  "align-decisions",
  "diff",
  "diff-core",
  "diff-microworld",
  "diff-quiz",
];
const generatedPaths = [
  ...examples.flatMap(({ suffix }) => [
    `docs/alignments/rescene-fan-calendar.${suffix}.html`,
    `docs/diffs/ky-867-retry-extend.${suffix}.html`,
  ]),
  ...examples.flatMap(({ suffix }) => captureNames
    .map((name) => `assets/readme/hope-${name}-${suffix}.png`)),
];
const mockupFontFiles = {
  bold: "HopeSansBold.woff2",
  light: "HopeSansLight.woff2",
  medium: "HopeSansMedium.woff2",
};
const visualDifferenceLimits = {
  changedPixelFraction: 0.04,
  meanChannelError: 1,
};

function exampleLocations(destinationRoot) {
  return {
    alignDirectory: join(destinationRoot, "docs", "alignments"),
    diffDirectory: join(destinationRoot, "docs", "diffs"),
    outputDirectory: join(destinationRoot, "assets", "readme"),
  };
}

async function loadMockupFonts() {
  return Object.fromEntries(await Promise.all(
    Object.entries(mockupFontFiles).map(async ([weight, filename]) => [
      weight,
      (await readFile(join(root, "plugins", "hope", "assets", "fonts", filename))).toString("base64"),
    ]),
  ));
}

function mockupHtml(locale, variant, fonts) {
  const ko = locale === "ko-KR";
  const copy = ko
    ? {
        action: "행동 마감 레이더",
        apply: "응모하기",
        calendar: "2026년 8월",
        changed: "시간 변경",
        deadline: "오늘 23:59 마감",
        event: "팬사인회 응모",
        filter: "전체 · 방송 · 공연 · 발매 · 투표 · 신청",
        live: "음악방송",
        official: "공식 출처 확인",
        sample: "공개 예시 · 샘플 데이터",
        source: "출처와 변경 내역",
        title: "RESCENE 팬 일정",
        vote: "주간 인기 투표",
        voteAction: "투표하기",
      }
    : {
        action: "Action deadline radar",
        apply: "Open application",
        calendar: "August 2026",
        changed: "Time changed",
        deadline: "Ends today · 23:59",
        event: "Fan-sign application",
        filter: "All · Broadcast · Show · Release · Vote · Apply",
        live: "Music show",
        official: "Official source checked",
        sample: "Public example · Sample data",
        source: "Sources and changes",
        title: "RESCENE fan schedule",
        vote: "Weekly popularity vote",
        voteAction: "Open voting",
      };
  const monthMap = `
    <main class="shell">
      <header><div><b>${copy.title}</b><span>${copy.sample}</span></div><button>${copy.calendar}</button></header>
      <div class="filters">${copy.filter}</div>
      <section class="month-layout">
        <div class="calendar">
          <div class="week muted"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>
          <div class="grid">
            <div class="day muted">10</div><div class="day">11<div class="event blue">${copy.live}</div></div><div class="day">12</div><div class="day selected">13<div class="event pink">${copy.event}</div><div class="event yellow">${copy.vote}</div></div><div class="day">14</div><div class="day">15</div><div class="day">16</div>
            <div class="day">17</div><div class="day">18</div><div class="day">19<div class="event blue">${copy.live}</div></div><div class="day">20</div><div class="day">21</div><div class="day">22</div><div class="day">23</div>
            <div class="day">24</div><div class="day">25</div><div class="day">26</div><div class="day">27</div><div class="day">28</div><div class="day">29</div><div class="day">30</div>
          </div>
        </div>
        <aside>
          <p class="eyebrow">AUG 13</p><h1>${copy.event}</h1><p class="deadline">${copy.deadline}</p>
          <div class="status good">● ${copy.official}</div><div class="status warn">△ ${copy.changed}</div>
          <div class="source"><b>${copy.source}</b><p>THE MUZE · 11:00 KST</p><p>Mnet Plus · 10:58 KST</p></div>
          <button class="primary">${copy.apply} ↗</button>
        </aside>
      </section>
    </main>`;
  const actionRadar = `
    <main class="shell">
      <header><div><b>${copy.title}</b><span>${copy.sample}</span></div><button>${copy.calendar}</button></header>
      <div class="filters">${copy.filter}</div>
      <section class="radar-layout">
        <div class="actions"><p class="eyebrow">${copy.action}</p>
          <article class="urgent"><div><span class="badge">D-DAY</span><h1>${copy.vote}</h1><p>${copy.deadline}</p></div><button class="primary">${copy.voteAction} ↗</button></article>
          <article><div><span class="badge soft">D-3</span><h1>${copy.event}</h1><p class="status good">● ${copy.official}</p></div><button>${copy.apply} ↗</button></article>
          <article><div><span class="badge muted-badge">UPDATED</span><h1>${copy.live}</h1><p class="status warn">△ ${copy.changed}</p></div><button>${copy.source}</button></article>
        </div>
        <aside class="mini"><h2>${copy.calendar}</h2><div class="mini-grid">${Array.from({ length: 28 }, (_, index) => `<span${[10, 12, 18].includes(index) ? ' class="marked"' : ""}>${index + 1}</span>`).join("")}</div><div class="source"><b>${copy.source}</b><p>3 ${ko ? "공식 출처" : "official sources"}</p><p>1 ${ko ? "변경 확인" : "confirmed change"}</p></div></aside>
      </section>
    </main>`;
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
    @font-face{font-family:"Hope README";src:url(data:font/woff2;base64,${fonts.light}) format("woff2");font-weight:300}@font-face{font-family:"Hope README";src:url(data:font/woff2;base64,${fonts.medium}) format("woff2");font-weight:500}@font-face{font-family:"Hope README";src:url(data:font/woff2;base64,${fonts.bold}) format("woff2");font-weight:700}*{box-sizing:border-box}body{margin:0;background:#f6f4ef;color:#171717;font-family:"Hope README",sans-serif;font-weight:300}.shell{width:850px;height:566px;padding:26px 30px;background:linear-gradient(145deg,#fff 0%,#f7f5ef 100%)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}header div{display:grid;gap:4px}header b{font-size:23px;letter-spacing:-.03em}header span,.muted{color:#777;font-size:12px}button{min-height:34px;padding:0 13px;border:1px solid #d7d2c9;border-radius:9px;background:#fff;color:#282522;font-weight:700}.filters{margin-bottom:18px;color:#625d55;font-size:12px}.month-layout,.radar-layout{display:grid;grid-template-columns:minmax(0,1fr) 244px;gap:18px}.calendar,.actions,.mini,aside{border:1px solid #ded9d0;border-radius:16px;background:rgba(255,255,255,.86);box-shadow:0 12px 30px rgba(80,65,45,.06)}.calendar{padding:16px}.week,.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.week span{text-align:center;font-size:10px}.grid{margin-top:8px}.day{min-height:91px;padding:7px;border:1px solid #eeeae2;border-radius:10px;font-size:11px}.day.selected{border:2px solid #5f57d9;background:#f3f1ff}.event{margin-top:7px;padding:5px 6px;border-radius:6px;overflow:hidden;font-size:9px;font-weight:700;white-space:nowrap}.blue{background:#e4efff;color:#285b9b}.pink{background:#ffe5ee;color:#9a3159}.yellow{background:#fff2c9;color:#775a09}aside{padding:20px}.eyebrow{margin:0 0 10px;color:#6659d8;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h1{margin:0 0 8px;font-size:19px;letter-spacing:-.025em}.deadline{color:#a33b48;font-size:13px;font-weight:700}.status{margin:10px 0;font-size:12px}.good{color:#277557}.warn{color:#9a6b18}.source{margin-top:18px;padding-top:15px;border-top:1px solid #e4dfd7;font-size:11px}.source p{margin:7px 0;color:#666}.primary{border-color:#5d55d5;background:#5d55d5;color:#fff}.radar-layout{grid-template-columns:minmax(0,1fr) 230px}.actions{padding:20px}.actions article{display:flex;min-height:105px;margin-top:12px;padding:16px;justify-content:space-between;align-items:center;border:1px solid #e4dfd7;border-radius:13px}.actions article.urgent{border-color:#ef9eac;background:#fff7f8}.badge{display:inline-block;margin-bottom:8px;padding:3px 7px;border-radius:999px;background:#d94e67;color:#fff;font-size:9px;font-weight:700}.soft{background:#6659d8}.muted-badge{background:#e8e5df;color:#6b665e}.mini h2{margin:0 0 15px;font-size:16px}.mini-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.mini-grid span{display:grid;aspect-ratio:1;place-items:center;border-radius:7px;color:#736d65;font-size:10px}.mini-grid .marked{background:#eeeaff;color:#4e45c4;font-weight:700}
  </style></head><body>${variant === "monthMap" ? monthMap : actionRadar}</body></html>`;
}

async function captureMockup(page, locale, variant, fonts) {
  await page.setViewportSize({ height: 566, width: 850 });
  await page.setContent(mockupHtml(locale, variant, fonts), { waitUntil: "load" });
  await page.evaluate(async () => await document.fonts.ready);
  const data = await page.screenshot({ animations: "disabled", type: "png" });
  return { data: data.toString("base64"), height: 566, width: 850 };
}

function generatedHtml(bytes) {
  return Buffer.from(bytes.toString("utf8").replace(/^[\t ]+$/gmu, ""));
}

async function loadPage(page, htmlPath, { height = 900, width = 1440 } = {}) {
  await page.setViewportSize({ height, width });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
}

async function assertPrimaryCaptureState(page, expectedTopSection) {
  const state = await page.evaluate((topSectionSelector) => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity) !== 0
        && bounds.height > 0
        && bounds.width > 0;
    };
    const isWithinViewport = (element) => {
      if (!isVisible(element)) return false;
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 0
        && bounds.right <= window.innerWidth
        && bounds.bottom <= window.innerHeight
        && bounds.left >= 0;
    };
    const startsWithinViewport = (element) => {
      if (!isVisible(element)) return false;
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 0
        && bounds.top < window.innerHeight
        && bounds.right > 0
        && bounds.left < window.innerWidth;
    };
    const productBar = document.querySelector(".topbar");
    const productBarParts = [
      ".brand",
      ".top-context",
      ".commit-status",
      ".topbar-actions",
    ].map((selector) => document.querySelector(selector));
    const topSection = document.querySelector(topSectionSelector);
    const firstSection = document.querySelector("main > section");

    return {
      firstSectionMatches: firstSection === topSection,
      fragment: location.hash,
      productBarContentWithinViewport: productBarParts.every(isWithinViewport),
      productBarVisible: isVisible(productBar),
      productBarWithinViewport: isWithinViewport(productBar),
      scrollY: window.scrollY,
      topSectionVisible: isVisible(topSection),
      topSectionStartsWithinViewport: startsWithinViewport(topSection),
    };
  }, expectedTopSection);

  assert.deepEqual(state, {
    firstSectionMatches: true,
    fragment: "",
    productBarContentWithinViewport: true,
    productBarVisible: true,
    productBarWithinViewport: true,
    scrollY: 0,
    topSectionVisible: true,
    topSectionStartsWithinViewport: true,
  }, `Primary README capture must show ${expectedTopSection} at the document top`);
}

async function capturePage(page, htmlPath, outputPath, options = {}) {
  const {
    expectedTopSection,
    height = 900,
    width = 1440,
  } = options;
  await loadPage(page, htmlPath, { height, width });
  if (expectedTopSection) {
    await assertPrimaryCaptureState(page, expectedTopSection);
  }
  await page.screenshot({ animations: "disabled", clip: { height, width, x: 0, y: 0 }, path: outputPath, type: "png" });
}

async function captureElement(page, outputPath, selector, { capturePadding = 16, expandDetails = false } = {}) {
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
    await element.screenshot({ animations: "disabled", path: outputPath, type: "png" });
  } finally {
    await element.evaluate((target, style) => {
      if (style === null) target.removeAttribute("style");
      else target.setAttribute("style", style);
    }, previousStyle);
  }
}

async function renderHtmlExamples(page, locations, fonts) {
  const paths = {};
  for (const example of examples) {
    const mockups = {
      actionRadar: await captureMockup(page, example.locale, "actionRadar", fonts),
      monthMap: await captureMockup(page, example.locale, "monthMap", fonts),
    };
    const alignPath = join(locations.alignDirectory, `rescene-fan-calendar.${example.suffix}.html`);
    const alignSource = renderAlignArtifact(makeAlignArtifactData(example.locale, mockups), {
      alternateLocale: alternateLocale(example.alternateLocale, `rescene-fan-calendar.${example.alternateSuffix}.html`),
      digest: digestPlaceholder,
    });
    await writeFile(alignPath, sealAlignHtml(alignSource).bytes);
    await inspectAlignArtifact(alignPath);

    const diffPath = join(locations.diffDirectory, `ky-867-retry-extend.${example.suffix}.html`);
    const snapshot = makeDiffSnapshot(example.locale);
    const review = validateAnalysis(makeDiffAnalysis(snapshot), snapshot, { runId: "86786786786786786786786786786786" });
    const rendered = await renderReview(review, {
      alternateLocale: alternateLocale(example.alternateLocale, `ky-867-retry-extend.${example.alternateSuffix}.html`),
    });
    await writeFile(diffPath, generatedHtml(rendered.bytes));
    paths[example.suffix] = { alignPath, diffPath };
  }
  return paths;
}

async function captureReadmeAssets(browser, paths, outputDirectory) {
  for (const { suffix } of examples) {
    const page = await browser.newPage();
    try {
      const { alignPath, diffPath } = paths[suffix];
      await capturePage(page, alignPath, join(outputDirectory, `hope-align-${suffix}.png`));
      await captureElement(page, join(outputDirectory, `hope-align-directions-${suffix}.png`), "#design-directions");
      await captureElement(page, join(outputDirectory, `hope-align-decisions-${suffix}.png`), "#intent");

      await capturePage(page, diffPath, join(outputDirectory, `hope-diff-${suffix}.png`), {
        expectedTopSection: "#synopsis",
        height: 820,
      });
      await page.setViewportSize({ height: 900, width: 1440 });
      await captureElement(page, join(outputDirectory, `hope-diff-core-${suffix}.png`), "#core-change");
      await page.locator(".microworld-disclosure").evaluate((details) => {
        details.open = true;
      });
      await page.locator('.microworld-control[data-control-id="child"][value="number"]').check();
      await captureElement(page, join(outputDirectory, `hope-diff-microworld-${suffix}.png`), ".microworld", { expandDetails: true });
      await captureElement(page, join(outputDirectory, `hope-diff-quiz-${suffix}.png`), "#quiz", { expandDetails: true });
    } finally {
      await page.close();
    }
  }
}

async function generateExamples(destinationRoot) {
  const locations = exampleLocations(destinationRoot);
  await Promise.all(Object.values(locations)
    .map((directory) => mkdir(directory, { recursive: true })));
  let browser;
  try {
    const fonts = await loadMockupFonts();
    browser = await chromium.launch({ headless: true });
    const renderPage = await browser.newPage();
    let paths;
    try {
      paths = await renderHtmlExamples(renderPage, locations, fonts);
    } finally {
      await renderPage.close();
    }
    await captureReadmeAssets(browser, paths, locations.outputDirectory);
  } finally {
    await browser?.close();
  }
}

function comparableAlignArtifact(artifact) {
  const {
    artifactPath: _artifactPath,
    digest: _digest,
    ...comparable
  } = artifact;
  return {
    ...comparable,
    content: {
      ...comparable.content,
      designDirections: {
        ...comparable.content.designDirections,
        options: comparable.content.designDirections.options.map((option) => ({
          ...option,
          image: {
            ...option.image,
            data: "[generated image]",
          },
        })),
      },
    },
  };
}

async function imageDifference(page, committed, generated) {
  if (committed.equals(generated)) {
    return { changedPixelFraction: 0, dimensionsMatch: true, meanChannelError: 0 };
  }
  const sources = [committed, generated]
    .map((value) => `data:image/png;base64,${value.toString("base64")}`);
  return page.evaluate(async ([committedSource, generatedSource]) => {
    const loadImage = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = source;
    });
    const [committedImage, generatedImage] = await Promise.all([
      loadImage(committedSource),
      loadImage(generatedSource),
    ]);
    const dimensionsMatch = committedImage.naturalWidth === generatedImage.naturalWidth
      && committedImage.naturalHeight === generatedImage.naturalHeight;
    const pixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const committedPixels = pixels(committedImage);
    const generatedPixels = pixels(generatedImage);
    let changedPixels = 0;
    let totalError = 0;
    for (let index = 0; index < committedPixels.length; index += 4) {
      const error = (
        Math.abs(committedPixels[index] - generatedPixels[index])
        + Math.abs(committedPixels[index + 1] - generatedPixels[index + 1])
        + Math.abs(committedPixels[index + 2] - generatedPixels[index + 2])
      ) / 3;
      totalError += error;
      if (error > 8) changedPixels += 1;
    }
    const pixelCount = committedPixels.length / 4;
    return {
      changedPixelFraction: changedPixels / pixelCount,
      dimensionsMatch,
      meanChannelError: totalError / pixelCount,
    };
  }, sources);
}

async function checkExamples(generatedRoot) {
  const mismatches = [];
  const visualComparisons = [];
  for (const { suffix } of examples) {
    const alignPath = `docs/alignments/rescene-fan-calendar.${suffix}.html`;
    const [committedAlign, generatedAlign] = await Promise.all([
      inspectAlignArtifact(join(root, alignPath)),
      inspectAlignArtifact(join(generatedRoot, alignPath)),
    ]);
    if (!isDeepStrictEqual(
      comparableAlignArtifact(committedAlign),
      comparableAlignArtifact(generatedAlign),
    )) {
      mismatches.push(alignPath);
    }
    for (const [index, option] of committedAlign.content.designDirections.options.entries()) {
      visualComparisons.push({
        committed: Buffer.from(option.image.data, "base64"),
        generated: Buffer.from(
          generatedAlign.content.designDirections.options[index].image.data,
          "base64",
        ),
        label: `${alignPath}#${option.id}`,
      });
    }

    const diffPath = `docs/diffs/ky-867-retry-extend.${suffix}.html`;
    const [committedDiff, generatedDiff] = await Promise.all([
      readFile(join(root, diffPath)),
      readFile(join(generatedRoot, diffPath)),
    ]);
    if (!committedDiff.equals(generatedDiff)) mismatches.push(diffPath);
  }

  for (const { suffix } of examples) {
    for (const name of captureNames) {
      const path = `assets/readme/hope-${name}-${suffix}.png`;
      const [committed, generated] = await Promise.all([
        readFile(join(root, path)),
        readFile(join(generatedRoot, path)),
      ]);
      visualComparisons.push({ committed, generated, label: path });
    }
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    for (const comparison of visualComparisons) {
      const difference = await imageDifference(
        page,
        comparison.committed,
        comparison.generated,
      );
      if (
        !difference.dimensionsMatch
        || difference.changedPixelFraction > visualDifferenceLimits.changedPixelFraction
        || difference.meanChannelError > visualDifferenceLimits.meanChannelError
      ) {
        mismatches.push(
          `${comparison.label} (visual difference: ${difference.meanChannelError.toFixed(3)} mean error, `
          + `${(difference.changedPixelFraction * 100).toFixed(2)}% changed pixels)`,
        );
      }
    }
  } finally {
    await browser?.close();
  }
  if (mismatches.length > 0) {
    throw new Error(`README examples need regeneration:\n${mismatches.join("\n")}`);
  }
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length > 1 || (arguments_.length === 1 && arguments_[0] !== "--check")) {
    throw new TypeError("Usage: render-readme-assets.mjs [--check]");
  }
  if (arguments_[0] !== "--check") {
    await generateExamples(root);
    process.stdout.write(`Rendered bilingual README examples in ${exampleLocations(root).outputDirectory}\n`);
    return;
  }

  const generatedRoot = await mkdtemp(join(tmpdir(), "hope-readme-check-"));
  try {
    await generateExamples(generatedRoot);
    await checkExamples(generatedRoot);
  } finally {
    await rm(generatedRoot, { force: true, recursive: true });
  }
  process.stdout.write(`README examples match ${generatedPaths.length} generated files.\n`);
}

await main();
