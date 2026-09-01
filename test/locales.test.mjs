import assert from "node:assert/strict";
import test from "node:test";

import {
  checkLocaleParity,
  label,
  loadLocale,
  normalizeLocale,
  resolveDisplayOptions,
} from "../plugins/hope/skills/diff/scripts/locales/index.mjs";
import { pluginPackageFiles } from "../tools/plugin-files.mjs";

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
  assert.ok(keys.includes("section.teachingAids"));
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
