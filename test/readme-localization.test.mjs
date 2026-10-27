import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function readmeAssets(source) {
  return [...source.matchAll(/assets\/readme\/[^\s"')]+/gu)].map((match) => match[0]);
}

function relativeTargets(source) {
  const targets = [
    ...source.matchAll(/\]\(([^)\s]+)\)/gu),
    ...source.matchAll(/(?:href|src|srcset)="([^"]+)"/gu),
  ].map((match) => match[1].split("#")[0]);
  return targets.filter((target) => target && !/^[a-z]+:/u.test(target));
}

test("README locales use the same assets in their own language", async () => {
  const [english, korean] = await Promise.all([
    read("README.md"),
    read("README.ko.md"),
  ]);
  const englishAssets = readmeAssets(english);

  assert.ok(englishAssets.length > 0);
  assert.deepEqual(
    readmeAssets(korean),
    englishAssets.map((path) => path.replace("-en-", "-ko-")),
  );
  assert.match(english, /href="README\.ko\.md"/u);
  assert.match(korean, /href="README\.md"/u);
});

test("README links and images resolve and pictures carry both themes", async () => {
  for (const name of ["README.md", "README.ko.md"]) {
    const source = await read(name);
    await Promise.all(relativeTargets(source)
      .map((target) => access(new URL(target, root))
        .catch(() => assert.fail(`${name}: missing ${target}`))));

    for (const [picture] of source.matchAll(/<picture>[\s\S]*?<\/picture>/gu)) {
      const dark = picture.match(/media="\(prefers-color-scheme: dark\)" srcset="([^"]+)"/u);
      const light = picture.match(/<img src="([^"]+)"[^>]* alt="[^"]+"/u);
      assert.ok(dark && light, `${name}: ${picture}`);
      assert.notEqual(dark[1], light[1]);
    }
  }
});
