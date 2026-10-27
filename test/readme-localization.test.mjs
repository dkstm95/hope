import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const captureNames = [
  "align",
  "align-directions",
  "align-decisions",
  "diff",
  "diff-core",
  "diff-microworld",
  "diff-reader",
  "diagram",
];

const read = (path) => readFile(new URL(path, root), "utf8");

function readmeImages(source) {
  return [...source.matchAll(/!\[[^\]]*\]\((assets\/readme\/hope-(?:align|diff|diagram)[^)]+\.png)\)/gu)]
    .map((match) => match[1]);
}

function collapsedExampleImages(source) {
  return [...source.matchAll(/<details>([\s\S]*?)<\/details>/gu)]
    .map((match) => readmeImages(match[1]))
    .filter((images) => images.length > 0);
}

function expectedImages(suffix) {
  return captureNames.map((name) => `assets/readme/hope-${name}-${suffix}.png`);
}

test("README examples keep English and Korean assets separate", async () => {
  const [english, korean] = await Promise.all([
    read("README.md"),
    read("README.ko.md"),
  ]);
  const englishImages = readmeImages(english);
  const koreanImages = readmeImages(korean);

  assert.deepEqual(englishImages, expectedImages("en"));
  assert.deepEqual(koreanImages, expectedImages("ko"));
  await Promise.all([...englishImages, ...koreanImages]
    .map((path) => access(new URL(path, root))));

  assert.match(english, /docs\/alignments\/rescene-fan-calendar-default-run\.en\.html/u);
  assert.match(english, /docs\/diffs\/ky-825-total-timeout\.en\.html/u);
  assert.match(english, /docs\/visualizations\/parcel-handoff\.html/u);
  assert.match(korean, /docs\/alignments\/rescene-fan-calendar-default-run\.ko\.html/u);
  assert.match(korean, /docs\/diffs\/ky-825-total-timeout\.ko\.html/u);
  assert.match(korean, /docs\/visualizations\/parcel-handoff\.html/u);
  await access(new URL("docs/visualizations/parcel-handoff.html", root));
});

test("README examples show overviews and collapse detailed captures by default", async () => {
  const [english, korean] = await Promise.all([
    read("README.md"),
    read("README.ko.md"),
  ]);

  for (const [source, suffix] of [[english, "en"], [korean, "ko"]]) {
    const images = expectedImages(suffix);
    assert.deepEqual(collapsedExampleImages(source), [
      images.slice(1, 3),
      images.slice(4, 6),
    ]);
  }
});
