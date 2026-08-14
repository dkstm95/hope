import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fonts = Object.freeze({
  "HopeCode.woff2": "04a13754c4b99ba06a5d98648075751ef273f532881b2c67af46b22230913307",
  "HopeSansBold.woff2": "a83f8f0286045306fedc149c0a8112d113a2f8cfc557dcb1ebee4a902d99df8a",
  "HopeSansLight.woff2": "8f46f4eb180510bd51df24201712da9919b88b706c7dfeebe3d311ed3c965766",
  "HopeSansMedium.woff2": "5362eae258ca7c2ed5388cdc36462838bf6ea4cc0e1b84385e431edd607f35ed",
});

test("bundled fonts match the renamed OFL-reviewed files", async () => {
  const source = await readFile(
    new URL(
      "../plugins/hope/assets/fonts/SOURCE.md",
      import.meta.url,
    ),
    "utf8",
  );
  for (const [filename, expected] of Object.entries(fonts)) {
    const bytes = await readFile(new URL(
      `../plugins/hope/assets/fonts/${filename}`,
      import.meta.url,
    ));
    const actual = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actual, expected, filename);
    assert.match(source, new RegExp(expected, "u"), filename);
  }
  assert.match(source, /internal primary names/u);
  assert.match(source, /rename-hope-fonts\.py/u);
});
