// Rasterize the brand SVGs in assets/brand to PNG with Playwright Chromium.
// Run through render.py, or alone after it: node assets/brand/source/rasterize.mjs

import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const brand = new URL("../", import.meta.url);
const plugin = new URL("../../../plugins/hope/", import.meta.url);

// [source SVG, output PNG, width, height]
const exports = [
  ["hope-icon.svg", new URL("hope-icon-128.png", brand), 128, 128],
  ["hope-icon.svg", new URL("hope-icon-256.png", brand), 256, 256],
  ["hope-icon.svg", new URL("hope-icon-512.png", brand), 512, 512],
  ["hope-icon.svg", new URL("hope-icon-1024.png", brand), 1024, 1024],
  ["hope-icon-small.svg", new URL("hope-favicon-32.png", brand), 32, 32],
  ["hope-social-preview.svg", new URL("hope-social-preview.png", brand), 1280, 640],
  // Plugin icons keep the paths and sizes the manifests and renderers expect.
  ["hope-icon.svg", new URL("assets/hope-icon.png", plugin), 128, 128],
  ["hope-icon.svg", new URL("assets/hope-protected-light.png", plugin), 512, 512],
  ["hope-icon.svg", new URL("skills/diff/assets/hope-protected-light.png", plugin), 256, 256],
  ["hope-icon.svg", new URL("skills/write/assets/hope-protected-light.png", plugin), 256, 256],
];

const browser = await chromium.launch();
try {
  for (const [source, output, width, height] of exports) {
    const markup = await readFile(new URL(source, brand), "utf8");
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${markup}`,
    );
    await page.screenshot({ path: fileURLToPath(output), omitBackground: true });
    await page.close();
    console.log(`${fileURLToPath(output).replace(fileURLToPath(new URL("../../../", import.meta.url)), "")}  ${width}x${height}`);
  }
} finally {
  await browser.close();
}
