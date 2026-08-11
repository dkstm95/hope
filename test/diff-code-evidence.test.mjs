import assert from "node:assert/strict";
import test from "node:test";

import { renderCodeEvidence } from "../plugins/hope/skills/diff/scripts/code-evidence.mjs";

test("code evidence stays escaped and line-addressable", () => {
  const rendered = renderCodeEvidence({
    excerpt: 'const answer = "<script>alert(1)</script>";\nreturn answer;',
    sourceKind: "after-file",
  });

  assert.equal((rendered.match(/class="code-line"/gu) ?? []).length, 2);
  assert.match(rendered, /&lt;script&gt;/u);
  assert.doesNotMatch(rendered, /<script>|style=/u);
  assert.match(rendered, /<\/span><\/span>\n<span class="code-line"/u);
});

test("patch evidence marks changed lines and exact coordinates", () => {
  const patch = renderCodeEvidence({
    excerpt: "@@ -10,2 +20,2 @@\n-const oldValue = true;\n+const newValue = false;\n unchanged();",
    sourceKind: "patch",
  });

  assert.match(patch, /code-line-removed/u);
  assert.match(patch, /code-line-added/u);
  assert.match(patch, /data-old-line="10" data-new-line=""/u);
  assert.match(patch, /data-old-line="" data-new-line="20"/u);
  assert.match(patch, /data-old-line="11" data-new-line="21"/u);
  assert.match(patch, /<span class="code-prefix">\+<\/span>/u);
});

test("patch evidence without coordinates does not reserve a number column", () => {
  const patch = renderCodeEvidence({
    excerpt: "+const safe = true;\n-const old = false;",
    sourceKind: "patch",
  });

  assert.equal((patch.match(/code-line-unlocated/gu) ?? []).length, 2);
  assert.doesNotMatch(patch, /data-old-line=/u);
});

test("bidirectional controls are shown instead of changing visual order", () => {
  const rendered = renderCodeEvidence({
    excerpt: "const safe = true; // \u202E } hidden",
    sourceKind: "after-file",
  });

  assert.match(rendered, /\\u202E/u);
  assert.doesNotMatch(rendered, /\u202E/u);
});
