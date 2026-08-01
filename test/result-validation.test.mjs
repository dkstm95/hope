import assert from "node:assert/strict";
import test from "node:test";

import { createResultValidation } from "../features/result-validation/index.mjs";

function validation() {
  return createResultValidation({
    groupItems: 2,
    referenceItems: 3,
    referenceNoun: "source ID",
    stringCharacters: 4,
  });
}

test("shared result validation accumulates scalar and structure issues", () => {
  const errors = [];
  const helpers = validation();

  assert.deepEqual(helpers.object(null, "item", errors), {});
  helpers.unknownKeys({ extra: true }, [], "item", errors);
  assert.equal(helpers.text("     ", "name", errors), "");
  assert.equal(helpers.text("😀😀😀😀😀", "emoji", errors), "");
  assert.equal(helpers.text(undefined, "optional", errors, { optional: true }), undefined);
  assert.equal(helpers.choice("later", ["now"], "timing", errors), "later");
  assert.equal(helpers.integer(-1, "count", errors), 0);
  assert.equal(
    helpers.integer(undefined, "optionalCount", errors, { optional: true }),
    undefined,
  );
  assert.equal(helpers.boolean("true", "enabled", errors), false);
  assert.deepEqual(helpers.array("items", "items", errors), []);

  assert.deepEqual(errors, [
    "item must be an object",
    "item.extra is not allowed",
    "name must be a non-empty string within 4 characters",
    "emoji must be a non-empty string within 4 characters",
    "timing must be one of now",
    "count must be an integer of at least 0",
    "enabled must be a boolean",
    "items must be an array",
  ]);
});

test("shared result validation preserves item and reference limits", () => {
  const errors = [];
  const helpers = validation();
  const ids = new Set();

  assert.deepEqual(helpers.array([1, 2, 3], "items", errors), [1, 2]);
  assert.deepEqual(
    helpers.stringList(["ok", ""], "names", errors, { minimum: 3 }),
    ["ok", ""],
  );
  assert.equal(helpers.identifier("Bad", "firstId", errors, ids), "Bad");
  assert.equal(helpers.identifier("good", "secondId", errors, ids), "good");
  assert.equal(helpers.identifier("good", "thirdId", errors, ids), "good");
  assert.deepEqual(
    helpers.references(
      ["repo", "repo", "gone", "ignored"],
      "sourceIds",
      errors,
      new Set(["repo"]),
    ),
    ["repo", "repo", "gone"],
  );

  assert.deepEqual(errors, [
    "items must have at most 2 items",
    "names must contain at least 3 items",
    "names[1] must be a non-empty string within 4 characters",
    "firstId is invalid",
    "thirdId repeats ID good",
    "sourceIds must have at most 3 items",
    "sourceIds repeats source ID repo",
    "sourceIds references unknown source ID gone",
  ]);
});
