#!/usr/bin/env node
// Re-render the Align examples in docs/alignments/ from their JSON records with
// the current renderer. Diff examples embed no review input and cannot be
// regenerated this way.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderAlignRecord } from "../plugins/hope/skills/align/scripts/artifact.mjs";

const directory = fileURLToPath(new URL("../docs/alignments/", import.meta.url));

for (const name of (await readdir(directory)).filter((file) => file.endsWith(".json")).sort()) {
  await renderAlignRecord(join(directory, name));
  console.log(`rendered docs/alignments/${name.replace(/\.json$/u, ".html")}`);
}
