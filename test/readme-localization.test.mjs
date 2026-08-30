import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { makeDiffSnapshot } from "../tools/readme-examples.mjs";

const root = new URL("../", import.meta.url);
const captureNames = [
  "align",
  "align-directions",
  "align-decisions",
  "diff",
  "diff-core",
  "diff-microworld",
  "diff-quiz",
  "visualize",
];

const read = (path) => readFile(new URL(path, root), "utf8");

function readmeImages(source) {
  return [...source.matchAll(/!\[[^\]]*\]\((assets\/readme\/hope-(?:align|diff|visualize)[^)]+\.png)\)/gu)]
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

  assert.match(english, /docs\/alignments\/rescene-fan-calendar\.en\.html/u);
  assert.match(english, /docs\/diffs\/ky-825-total-timeout\.en\.html/u);
  assert.match(english, /docs\/visualizations\/parcel-handoff\.html/u);
  assert.match(korean, /docs\/alignments\/rescene-fan-calendar\.ko\.html/u);
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
      images.slice(4, 7),
    ]);
  }
});

test("generated README HTML links each locale to its sibling", async () => {
  const pairs = [
    {
      english: "docs/alignments/rescene-fan-calendar.en.html",
      korean: "docs/alignments/rescene-fan-calendar.ko.html",
    },
    {
      english: "docs/diffs/ky-825-total-timeout.en.html",
      korean: "docs/diffs/ky-825-total-timeout.ko.html",
    },
  ];

  for (const pair of pairs) {
    const [english, korean] = await Promise.all([
      read(pair.english),
      read(pair.korean),
    ]);
    const englishSibling = pair.korean.split("/").at(-1);
    const koreanSibling = pair.english.split("/").at(-1);

    assert.match(english, /<html lang="en-US">/u);
    assert.match(
      english,
      new RegExp(`href="${englishSibling.replaceAll(".", "\\.")}" hreflang="ko-KR" lang="ko-KR">한국어</a>`, "u"),
    );
    assert.match(korean, /<html lang="ko-KR">/u);
    assert.match(
      korean,
      new RegExp(`href="${koreanSibling.replaceAll(".", "\\.")}" hreflang="en-US" lang="en-US">English</a>`, "u"),
    );

    const englishWithoutLocaleLink = english.replace(/<a class="locale-option"[^>]*>한국어<\/a>/u, "");
    assert.doesNotMatch(englishWithoutLocaleLink, /[가-힣]/u);
    assert.match(korean, /[가-힣]/u);
    assert.doesNotMatch(english, /^[\t ]+$/mu);
    assert.doesNotMatch(korean, /^[\t ]+$/mu);
  }
});

test("the fixed Ky example preserves captured pull request provenance", () => {
  const snapshot = makeDiffSnapshot("en-US");
  const sources = Object.fromEntries(snapshot.sources
    .map((source) => [source.id, source]));

  assert.deepEqual(snapshot.pullRequest, {
    author: "sindresorhus",
    number: 825,
    state: "closed",
    title: "Fix timeout to apply to total operation including retries",
    url: "https://github.com/sindresorhus/ky/pull/825",
  });
  assert.equal(snapshot.capturedAt, "2026-08-30T05:43:00.000Z");
  assert.deepEqual(snapshot.snapshot, {
    base: "ecdd45eeaa48cbcbabaa53898dd4a39d1296a694",
    head: "2a33b80dbcd0efb5a08b39d141c86ddd6ef90ae6",
    mergeBase: "ecdd45eeaa48cbcbabaa53898dd4a39d1296a694",
  });
  assert.deepEqual(snapshot.files.map(({ additions, deletions, path }) => ({
    additions,
    deletions,
    path,
  })), [
    { additions: 75, deletions: 7, path: "source/core/Ky.ts" },
    { additions: 148, deletions: 1, path: "test/hooks.ts" },
    { additions: 10, deletions: 7, path: "test/http-error.ts" },
    { additions: 191, deletions: 47, path: "test/retry.ts" },
  ]);
  assert.equal(sources["source-2"].lineCount, 3);
  assert.match(sources["source-2"].text, /entire operation[\s\S]+Fixes #784/u);
  assert.equal(sources["source-3"].text, "Fix timeout to apply to total operation including retries");
  assert.match(sources["source-4"].text, /#getRemainingTimeout/u);
  assert.match(sources["source-5"].text, /beforeRetry hook respects total timeout budget/u);
  assert.match(sources["source-7"].text, /timeout: false does not throw TimeoutError during retries/u);
});
