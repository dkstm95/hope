import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fonts = Object.freeze([
  ["assets/fonts/HopeSansBold.woff2", "a83f8f0286045306fedc149c0a8112d113a2f8cfc557dcb1ebee4a902d99df8a"],
  ["assets/fonts/HopeSansLight.woff2", "8f46f4eb180510bd51df24201712da9919b88b706c7dfeebe3d311ed3c965766"],
  ["assets/fonts/HopeSansMedium.woff2", "5362eae258ca7c2ed5388cdc36462838bf6ea4cc0e1b84385e431edd607f35ed"],
  ["skills/diff/assets/fonts/HopeCode.woff2", "04a13754c4b99ba06a5d98648075751ef273f532881b2c67af46b22230913307"],
  ["skills/diff/assets/fonts/HopeSansBold.woff2", "a83f8f0286045306fedc149c0a8112d113a2f8cfc557dcb1ebee4a902d99df8a"],
  ["skills/diff/assets/fonts/HopeSansLight.woff2", "8f46f4eb180510bd51df24201712da9919b88b706c7dfeebe3d311ed3c965766"],
  ["skills/diff/assets/fonts/HopeSansMedium.woff2", "5362eae258ca7c2ed5388cdc36462838bf6ea4cc0e1b84385e431edd607f35ed"],
]);

test("bundled fonts match the renamed OFL-reviewed files", async () => {
  const sources = await Promise.all([
    readFile(new URL("../plugins/hope/assets/fonts/SOURCE.md", import.meta.url), "utf8"),
    readFile(
      new URL("../plugins/hope/skills/diff/assets/fonts/SOURCE.md", import.meta.url),
      "utf8",
    ),
  ]);
  for (const [path, expected] of fonts) {
    const bytes = await readFile(new URL(
      `../plugins/hope/${path}`,
      import.meta.url,
    ));
    const actual = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actual, expected, path);
    assert.ok(sources.some((source) => source.includes(expected)), path);
  }
  for (const source of sources) {
    assert.match(source, /internal primary names/u);
    assert.match(source, /rename-hope-fonts\.py/u);
  }
});
