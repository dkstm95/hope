import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the GUI guide keeps all 86 conditional guidelines addressable", async () => {
  const markdown = await readFile(resolve(root, "docs/design.md"), "utf8");
  const identifiers = [...markdown.matchAll(/\*\*GUI-(\d{2}) —/gu)].map(
    (match) => match[1],
  );
  const expected = Array.from(
    { length: 86 },
    (_, index) => String(index + 1).padStart(2, "0"),
  );

  assert.deepEqual(identifiers, expected);
});
