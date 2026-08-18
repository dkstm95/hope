import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const read = (path) => readFile(new URL(path, root), "utf8");

function readmeImages(source) {
  return [...source.matchAll(/\]\((assets\/readme\/hope-(?:align|diff)[^)]+\.png)\)/gu)]
    .map((match) => match[1]);
}

test("README examples keep English and Korean assets separate", async () => {
  const [english, korean] = await Promise.all([
    read("README.md"),
    read("README.ko.md"),
  ]);
  const englishImages = readmeImages(english);
  const koreanImages = readmeImages(korean);
  const uniqueEnglishImages = [...new Set(englishImages)];
  const uniqueKoreanImages = [...new Set(koreanImages)];

  assert.equal(uniqueEnglishImages.length, 7);
  assert.equal(uniqueKoreanImages.length, 7);
  assert.ok(englishImages.every((path) => path.endsWith("-en.png")));
  assert.ok(koreanImages.every((path) => path.endsWith("-ko.png")));
  await Promise.all([...uniqueEnglishImages, ...uniqueKoreanImages]
    .map((path) => access(new URL(path, root))));

  assert.match(english, /docs\/alignments\/rescene-fan-calendar\.en\.html/u);
  assert.match(english, /docs\/diffs\/ky-867-retry-extend\.en\.html/u);
  assert.match(korean, /docs\/alignments\/rescene-fan-calendar\.ko\.html/u);
  assert.match(korean, /docs\/diffs\/ky-867-retry-extend\.ko\.html/u);
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

    const englishWithoutLocaleLink = english.replace(/<a class="locale-link"[^>]*>한국어<\/a>/u, "");
    assert.doesNotMatch(englishWithoutLocaleLink, /[가-힣]/u);
    assert.match(korean, /[가-힣]/u);
    assert.doesNotMatch(english, /^[\t ]+$/mu);
    assert.doesNotMatch(korean, /^[\t ]+$/mu);
  }
});
