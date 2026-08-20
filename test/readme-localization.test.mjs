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
];

const read = (path) => readFile(new URL(path, root), "utf8");

function readmeImages(source) {
  return [...source.matchAll(/!\[[^\]]*\]\((assets\/readme\/hope-(?:align|diff)[^)]+\.png)\)/gu)]
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
  assert.match(english, /docs\/diffs\/ky-867-retry-extend\.en\.html/u);
  assert.match(korean, /docs\/alignments\/rescene-fan-calendar\.ko\.html/u);
  assert.match(korean, /docs\/diffs\/ky-867-retry-extend\.ko\.html/u);
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
      images.slice(4),
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
      english: "docs/diffs/ky-867-retry-extend.en.html",
      korean: "docs/diffs/ky-867-retry-extend.ko.html",
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
    author: "chatman-media",
    number: 867,
    state: "closed",
    title: "Fix `extend()` dropping numeric `retry` limit when merging with an object",
    url: "https://github.com/sindresorhus/ky/pull/867",
  });
  assert.equal(snapshot.capturedAt, "2026-08-17T06:08:16.951Z");
  assert.deepEqual(snapshot.snapshot, {
    base: "61d6d66d27911001b9b4d57ab93139f9ad61384b",
    head: "61b90ed1cab2756b095facc5b3c7ccac9bc5f487",
    mergeBase: "61d6d66d27911001b9b4d57ab93139f9ad61384b",
  });
  assert.deepEqual(snapshot.files.map(({ additions, deletions, path }) => ({
    additions,
    deletions,
    path,
  })), [
    { additions: 14, deletions: 2, path: "source/utils/merge.ts" },
    { additions: 33, deletions: 0, path: "test/retry.ts" },
  ]);
  assert.deepEqual(snapshot.sources.map(({
    id,
    kind,
    lineCount,
    path,
    revision,
  }) => [id, kind, lineCount, path ?? null, revision ?? null]), [
    ["source-1", "pull-request-title", 1, null, null],
    ["source-2", "pull-request-description", 37, null, null],
    ["source-3", "commit-title", 1, null, "61b90ed1cab2756b095facc5b3c7ccac9bc5f487"],
    ["source-4", "patch", 35, "source/utils/merge.ts", "61b90ed1cab2756b095facc5b3c7ccac9bc5f487"],
    ["source-5", "patch", 39, "test/retry.ts", "61b90ed1cab2756b095facc5b3c7ccac9bc5f487"],
  ]);
  assert.equal(sources["source-2"].lineCount, 37);
  assert.match(sources["source-2"].text, /### Problem[\s\S]+### Cause[\s\S]+### Fix[\s\S]+### Test/u);
  assert.equal(sources["source-3"].text, "Scope retry shorthand expansion to root options merge");
  assert.match(sources["source-4"].text, /const deepMergeInternal = <T>\(isRoot: boolean/u);
  assert.match(sources["source-5"].text, /retry - extending a numeric `retry` with an object keeps the limit/u);
});
