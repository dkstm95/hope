#!/usr/bin/env node
// Re-render the Align examples in docs/alignments/ with the current renderer.
// Each example embeds its artifact data, so the record itself is the input; a
// language link to a sibling example is kept. Diff examples embed no review
// input and cannot be regenerated this way.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { sealAlignHtml } from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";

const directory = fileURLToPath(new URL("../docs/alignments/", import.meta.url));
const dataPattern = /<script id="hope-align-data" type="application\/json">([\s\S]*?)<\/script>/u;
const alternatePattern = /<a class="locale-option" href="([^"]+)" hreflang="([^"]+)"/u;

for (const name of (await readdir(directory)).filter((file) => file.endsWith(".html")).sort()) {
  const path = join(directory, name);
  const html = await readFile(path, "utf8");
  const data = dataPattern.exec(html);
  if (!data) throw new Error(`${name} has no embedded Align data`);
  const alternate = alternatePattern.exec(html);
  const { bytes } = sealAlignHtml(renderAlignArtifact(JSON.parse(data[1]), {
    alternateLocale: alternate ? { href: alternate[1], locale: alternate[2] } : undefined,
    digest: "0".repeat(64),
  }));
  await writeFile(path, bytes);
  console.log(`rendered docs/alignments/${name}`);
}
