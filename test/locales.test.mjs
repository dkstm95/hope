import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FILE_DISPOSITIONS,
  IMPORTANCE,
  REVIEW_KINDS,
} from "../plugins/hope/skills/diff/scripts/constants.mjs";
import { githubFileStatuses } from "../plugins/hope/skills/diff/scripts/github.mjs";
import {
  checkLocaleParity,
  label,
  loadLocale,
  normalizeLocale,
  resolveDisplayOptions,
  SUPPORTED_LOCALES,
  THEMES,
} from "../plugins/hope/skills/diff/scripts/locales/index.mjs";
import { dictionary as readerDictionary } from "../plugins/hope/skills/diff/scripts/reader/locales.mjs";
import { readerSnapshot } from "../plugins/hope/skills/diff/scripts/reader/snapshot.mjs";
import { pluginPackageFiles } from "../tools/plugin-files.mjs";

const scripts = new URL("../plugins/hope/skills/diff/scripts/", import.meta.url);

// Reason kinds the runtime records on file-unavailable and context-unavailable limits.
const fileReasonKinds = [
  "credential-pattern",
  "invalid-text",
  "no-text-diff",
  "patch-incomplete",
  "private-path",
  "safe-size-limit",
  "special-entry",
];
const contextReasonKinds = [
  "credential-pattern",
  "inspection-line-limit",
  "invalid-text",
  "not-found",
  "private-path",
  "safe-size-limit",
  "safe-total-limit",
  "special-entry",
];

// Every value each dynamic `label(dictionary, `<prefix>.${value}`)` call in render.mjs can receive.
const dynamicLabels = {
  context: ["checked", "notApplicable", "limited"],
  "file.status": [...githubFileStatuses],
  "file.use": FILE_DISPOSITIONS,
  importance: IMPORTANCE,
  item: REVIEW_KINDS,
  "scope.contextUnavailable": contextReasonKinds,
  "scope.fileUnavailable": fileReasonKinds,
  source: [
    "patch",
    "context-file",
    "pull-request-title",
    "pull-request-description",
    "commit-title",
    "override",
    "host",
    "system",
    "default",
  ],
  theme: THEMES,
};

async function scriptSource(path) {
  return await readFile(new URL(path, scripts), "utf8");
}

function captured(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  return source.slice(start, source.indexOf("\n}\n", start));
}

function sortedSet(values) {
  return [...new Set(values)].sort();
}

test("Diff owns its locale sources and packaged locale paths", () => {
  const sources = [
    "skills/diff/scripts/locales/en-US/common.json",
    "skills/diff/scripts/locales/en-US/diff.json",
    "skills/diff/scripts/locales/index.mjs",
    "skills/diff/scripts/locales/ko-KR/common.json",
    "skills/diff/scripts/locales/ko-KR/diff.json",
  ];

  assert.deepEqual(
    pluginPackageFiles.filter((path) => path.includes("/locales/")),
    sources,
  );
});

test("the supported locale dictionaries have identical keys", async () => {
  const keys = await checkLocaleParity();
  assert.ok(keys.includes("section.explore"));
  assert.ok(keys.includes("theme.system"));
});

test("display options use explicit values before the host locale", () => {
  assert.deepEqual(resolveDisplayOptions({
    hostLocale: "en-US",
    locale: "ko-KR",
    theme: "dark",
  }), {
    locale: "ko-KR",
    localeSource: "override",
    theme: "dark",
    themeSource: "override",
  });
  assert.deepEqual(resolveDisplayOptions({ hostLocale: "ko" }), {
    locale: "ko-KR",
    localeSource: "host",
    theme: "system",
    themeSource: "default",
  });
  assert.throws(
    () => resolveDisplayOptions({ locale: "ja-JP" }),
    /Unsupported Hope locale/u,
  );
  assert.throws(
    () => resolveDisplayOptions({ theme: "sepia" }),
    /Unsupported Hope theme/u,
  );
});

test("locale normalization is narrow and labels fail closed", async () => {
  assert.equal(normalizeLocale("ko"), "ko-KR");
  assert.equal(normalizeLocale("en_US"), "en-US");
  assert.equal(normalizeLocale("ja-JP"), undefined);
  const dictionary = await loadLocale("ko-KR");
  assert.equal(label(dictionary, "item.resolve"), "해결 필요");
  assert.throws(() => label(dictionary, "missing.value"), /Missing locale key/u);
});

test("every dynamic renderer label exists in the en-US dictionary", async () => {
  const render = await scriptSource("render.mjs");
  assert.deepEqual(
    sortedSet(captured(render, /label\(dictionary, `([a-zA-Z.]+)\.\$\{/gu)),
    Object.keys(dynamicLabels).sort(),
  );
  const dictionary = await loadLocale("en-US");
  const missing = Object.entries(dynamicLabels)
    .flatMap(([prefix, values]) => values.map((value) => `${prefix}.${value}`))
    .filter((key) => !(key in dictionary));
  assert.deepEqual(missing, []);
});

test("the covered reason kinds match the kinds the runtime records", async () => {
  const [github, context, redact] = await Promise.all(
    ["github.mjs", "context.mjs", "redact.mjs"].map(scriptSource),
  );
  const redactionKinds = captured(redact, /return "([a-z-]+)";/gu);
  const recordedKind = /(?:[rR]easonKind: |unavailableReason\()"([a-z-]+)"/gu;
  assert.deepEqual(
    sortedSet([...captured(github, recordedKind), ...redactionKinds]),
    fileReasonKinds,
  );
  assert.deepEqual(
    sortedSet([
      ...captured(functionSource(github, "readContent"), recordedKind),
      ...redactionKinds,
      ...captured(context, /unavailable\(\s*[\w.]+,\s*[\w.]+,\s*"([a-z-]+)"/gu),
    ]),
    contextReasonKinds,
  );
});

test("the reader explains every file reason kind in each supported locale", () => {
  const { files } = readerSnapshot({
    digest: "digest",
    files: fileReasonKinds.map((bodyReasonKind, index) => ({
      bodyReasonKind,
      bodyState: "metadata-only",
      id: `file-${index + 1}`,
      sourceIds: [],
    })),
    snapshot: { head: "head" },
    sources: [],
  });
  for (const locale of SUPPORTED_LOCALES) {
    const { reasons } = readerDictionary(locale);
    assert.deepEqual(files.map((file) => file.reason).filter((reason) => !(reason in reasons)), [], locale);
  }
});
