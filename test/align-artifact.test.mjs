import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  createAlignRecord,
  inspectAlignRecord,
  renderAlignRecord,
  reviseAlignRecord,
} from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { migrateAlignArtifact } from "../plugins/hope/skills/align/scripts/migrate.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";
import {
  validateAlignInput,
  validateAlignRecord,
} from "../plugins/hope/skills/align/scripts/validate.mjs";
import {
  makeAlignInput,
  makeDesignDirections,
  makeLegacyAlignInputV2,
  makeLegacyContent,
  makeLegacyData,
  readRealLegacyData,
  writeLegacyAlignArtifact,
} from "../test-support/align-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const execFileAsync = promisify(execFile);
const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const now = new Date("2026-08-14T00:00:00.000Z");
const sampleImage = fileURLToPath(new URL("../plugins/hope/assets/hope-icon.png", import.meta.url));

async function repository(remote = "git@github.com:acme/storage.git") {
  const root = await createTestTemporaryDirectory("hope-align-test-");
  await execFileAsync("git", ["init", "-q", root]);
  if (remote) {
    await execFileAsync("git", ["-C", root, "remote", "add", "origin", remote]);
  }
  return root;
}

async function inputFile(root, name, value) {
  const path = join(root, name);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** A PNG header with the given size and dimensions; the runtime checks no more. */
function pngHeader(width, height, bytes = 64) {
  const png = Buffer.alloc(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}

function recordFor(value, overrides = {}) {
  const input = validateAlignInput(value);
  return validateAlignRecord({
    schemaVersion: 1,
    alignId: "11111111-1111-4111-8111-111111111111",
    repository: "acme/storage",
    locale: input.locale,
    theme: input.theme,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history: [{ at: now.toISOString(), summary: input.revisionSummary }],
    content: input.content,
    ...overrides,
  });
}

test("repository display exposes bidirectional controls from remotes and local names", async () => {
  const remoteRoot = await repository("git@github.com:acme/storage‮name.git");
  const localParent = await createTestTemporaryDirectory("hope-align-repository-label-");
  const localRoot = join(localParent, "storage‮name");
  await mkdir(localRoot);
  await execFileAsync("git", ["init", "-q", localRoot]);

  for (const [root, expected] of [
    [remoteRoot, "acme/storage\\u202Ename"],
    [localRoot, "storage\\u202Ename"],
  ]) {
    const inputPath = await inputFile(root, "align-input.json", makeAlignInput());
    const outputPath = join(root, "docs", "alignments", "repository-label.json");
    await createAlignRecord({ inputPath, outputPath, root });
    const html = await readFile(outputPath.replace(/json$/u, "html"), "utf8");

    assert.equal((await readJson(outputPath)).repository, expected);
    assert.equal(html.includes(expected), true);
    assert.equal(html.includes("‮"), false);
  }
});

test("Align input keeps optional detail conditional and rejects unknown fields", () => {
  const minimal = makeAlignInput({
    flow: undefined,
    evidence: undefined,
    exclusions: [],
  });
  const value = validateAlignInput(minimal);
  assert.equal(value.content.flow, undefined);
  assert.deepEqual(value.content.exclusions, []);
  assert.deepEqual(value.content.evidence, []);

  assert.throws(
    () => validateAlignInput({ ...makeAlignInput(), progress: 50 }),
    /unsupported field: progress/u,
  );
  assert.throws(
    () => validateAlignInput({ ...makeAlignInput(), intent: [] }),
    /must contain at least 1 item/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      intent: [{ statement: "완료", by: "agent" }],
    })),
    /verify must be text/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      intent: [{ statement: "완료", verify: "테스트한다.", by: "model" }],
    })),
    /by must be agent or human/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      intent: [{
        statement: "완료",
        verify: "테스트한다.",
        by: "agent",
        decidedBy: "model",
      }],
    })),
    /decidedBy must be user or delegated/u,
  );
  assert.throws(
    () => validateAlignInput(makeLegacyAlignInputV2()),
    /schemaVersion must be 3/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      flow: {
        ...makeAlignInput().flow,
        outcomes: [{ title: "보류", kind: "unknown" }],
      },
    })),
    /kind must be complete or cancel/u,
  );

  assert.equal(
    [...validateAlignInput(makeAlignInput({ title: "😀".repeat(160) })).content.title].length,
    160,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({ title: "😀".repeat(161) })),
    /exceeds 160 characters/u,
  );
  for (const control of ["\u061c", "\u200e", "\u200f", "\u202a", "\u202e", "\u2066", "\u2069"]) {
    assert.throws(
      () => validateAlignInput(makeAlignInput({ title: `safe${control}name` })),
      /bidirectional control character/u,
    );
  }
  assert.throws(
    () => validateAlignInput(makeAlignInput({ title: "broken\ud800" })),
    /malformed Unicode/u,
  );
});

test("Align accepts the v3 shared-understanding model", () => {
  const { content: current } = validateAlignInput(makeAlignInput());
  assert.equal(current.intent.length, 4);
  assert.equal(current.intent[3].decidedBy, "user");
  assert.equal(current.intent[0].reason, "중단된 작업을 처음부터 반복하지 않고도 데이터 손실을 피해야 한다.");
  assert.equal(current.flow.steps.length, 3);
  assert.equal(current.exclusions.length, 3);

  assert.throws(
    () => validateAlignInput(makeAlignInput({ intent: [] })),
    /\$\.intent must contain at least 1 item/u,
  );
  const broadIntent = Array.from({ length: 13 }, (_, index) => ({
    statement: `관찰 가능한 결과 ${index + 1}`,
    verify: `결과 ${index + 1}을 확인한다.`,
    by: "agent",
  }));
  assert.equal(validateAlignInput(makeAlignInput({ intent: broadIntent })).content.intent.length, 13);
  assert.throws(
    () => validateAlignInput(makeAlignInput({ scope: { included: [], excluded: [] } })),
    /unsupported field: scope/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      intent: [
        makeAlignInput().intent[0],
        structuredClone(makeAlignInput().intent[0]),
      ],
    })),
    /\$\.intent\[1\] duplicates \$\.intent\[0\]/u,
  );
});
test("Align input binds cited claims to unique evidence ids", () => {
  const value = validateAlignInput(makeAlignInput({
    goal: {
      text: "중단된 업로드를 안전하게 복구한다.",
      evidenceIds: ["upload-service", "product-requirements"],
    },
    evidence: [
      { id: "upload-service", label: "업로드 서비스", location: "src/upload/recovery.ts" },
      { id: "product-requirements", label: "제품 요구", location: "https://example.com/requirements" },
    ],
  }));
  assert.deepEqual(value.content.goal.evidenceIds, ["upload-service", "product-requirements"]);
  assert.equal(value.content.goal.text, "중단된 업로드를 안전하게 복구한다.");

  assert.throws(
    () => validateAlignInput(makeAlignInput({
      goal: { text: "근거가 없는 주장", evidenceIds: ["missing"] },
    })),
    /refers to unknown evidence id: missing/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      evidence: [
        { id: "same", label: "첫 근거", location: "docs/first.md" },
        { id: "same", label: "둘째 근거", location: "docs/second.md" },
      ],
    })),
    /unique evidence ids/u,
  );
});

test("Align input rejects exact evidence and sibling-item duplicates", () => {
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      evidence: [
        { id: "first", label: "제품 요구", location: "docs/requirements.md" },
        { id: "second", label: "제품 요구", location: "docs/requirements.md" },
      ],
    })),
    /\$\.evidence\[1\] duplicates \$\.evidence\[0\]/u,
  );

  assert.throws(
    () => validateAlignInput(makeAlignInput({
      evidence: [
        { id: "first", label: "첫 근거", location: "docs/first.md" },
        { id: "second", label: "둘째 근거", location: "docs/second.md" },
      ],
      exclusions: [
        { text: "같은 제외", evidenceIds: ["first", "second"] },
        { text: "같은 제외", evidenceIds: ["second", "first"] },
      ],
    })),
    /\$\.exclusions\[1\] duplicates \$\.exclusions\[0\]/u,
  );

  const duplicateCases = [
    ["$.intent", (input) => input.intent.push(structuredClone(input.intent[0]))],
    ["$.exclusions", (input) => input.exclusions.push(input.exclusions[0])],
    ["$.flow.steps", (input) => input.flow.steps.push(
      structuredClone(input.flow.steps[0]),
    )],
    ["$.flow.outcomes", (input) => input.flow.outcomes.push(
      structuredClone(input.flow.outcomes[0]),
    )],
  ];
  for (const [path, duplicate] of duplicateCases) {
    const input = makeAlignInput();
    duplicate(input);
    assert.throws(
      () => validateAlignInput(input),
      new RegExp(`${path.replace(/[.$[\]]/gu, "\\$&")}\\[\\d+\\] duplicates`, "u"),
    );
  }
});

test("design directions reuse evidence-backed sources instead of copying URLs", () => {
  const directions = makeDesignDirections([sampleImage, sampleImage]);
  directions.options[0].references[0] = {
    evidenceId: "recovery-reference",
    influence: "복구 선택을 첫 화면의 주 행동으로 배치했다.",
  };
  const validated = validateAlignInput(makeAlignInput({
    designDirections: directions,
    evidence: [{
      id: "recovery-reference",
      label: "복구 요구 참고",
      location: "https://example.com/recovery-reference",
    }],
  }));
  assert.deepEqual(
    validated.content.designDirections.options[0].references[0],
    {
      evidenceId: "recovery-reference",
      influence: "복구 선택을 첫 화면의 주 행동으로 배치했다.",
    },
  );

  const copied = makeDesignDirections([sampleImage, sampleImage]);
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      designDirections: copied,
      evidence: [{
        id: "recovery-reference",
        label: "복구 요구 참고",
        location: "https://example.com/recovery-reference",
      }],
    })),
    /use evidenceId: recovery-reference/u,
  );

  const unknown = makeDesignDirections([sampleImage, sampleImage]);
  unknown.options[0].references[0] = {
    evidenceId: "missing",
    influence: "복구 선택을 첫 화면의 주 행동으로 배치했다.",
  };
  assert.throws(
    () => validateAlignInput(makeAlignInput({ designDirections: unknown })),
    /refers to unknown evidence id: missing/u,
  );
});


test("design direction input rejects inconsistent choices and unsafe references", () => {
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      designDirections: {
        ...makeDesignDirections([sampleImage, sampleImage]),
        selection: { optionId: "missing", reason: "없는 안", decidedBy: "user" },
      },
    })),
    /selection\.optionId must name an option/u,
  );
  const credentials = makeDesignDirections([sampleImage, sampleImage]);
  credentials.options[0].references[0].url = "https://user:secret@example.com/reference";
  assert.throws(
    () => validateAlignInput(makeAlignInput({ designDirections: credentials })),
    /without credentials/u,
  );
  const uppercaseScheme = makeDesignDirections([sampleImage, sampleImage]);
  uppercaseScheme.options[0].references[0].url = "HTTPS://example.com/reference";
  assert.equal(
    validateAlignInput(makeAlignInput({ designDirections: uppercaseScheme }))
      .content.designDirections.options[0].references[0].url,
    "HTTPS://example.com/reference",
  );
  const missingInfluence = makeDesignDirections([sampleImage, sampleImage]);
  delete missingInfluence.options[0].references[0].influence;
  assert.throws(
    () => validateAlignInput(makeAlignInput({ designDirections: missingInfluence })),
    /influence must be text/u,
  );
});

test("renderer is deterministic, self-contained, and keeps authored text inert", () => {
  const record = recordFor(makeAlignInput({
    title: '</title><script src="https://evil.example/x.js"></script>',
    goal: {
      text: "Keep <img src=x onerror=alert(1)> as text.\nKeep the second idea distinct.",
      evidenceIds: ["upload-service"],
    },
    evidence: [
      { id: "upload-service", label: "Upload service", location: "src/upload/recovery.ts" },
    ],
  }));
  const options = { recordHref: "upload-recovery.json" };
  const first = renderAlignArtifact(record, options);
  const second = renderAlignArtifact(record, options);

  assert.equal(first, second);
  assert.match(first, /<span class="brand-product">ALIGN<\/span><span class="brand-separator">\/<\/span><span class="brand-record">SPEC-001<\/span>/u);
  assert.match(
    first,
    /<header class="print-identity">[\s\S]*?<strong>ALIGN \/ SPEC-001<\/strong>[\s\S]*?<span><bdi dir="auto">acme\/storage<\/bdi><\/span>[\s\S]*?<span>v1 · 현재 합의 · <time datetime="2026-08-14T00:00:00\.000Z">2026-08-14<\/time><\/span>[\s\S]*?<\/header>/u,
  );
  assert.match(first, /<path d="M3 7\.5h6l2 2h10v9\.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><\/path><path d="M3 9\.5v-3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"><\/path>/u);
  assert.match(first, /@font-face\{font-family:"Hope Sans"/u);
  assert.match(first, /@font-face\{font-family:"Hope Code"/u);
  assert.equal((first.match(/@font-face/gu) ?? []).length, 3);
  assert.match(first, /font-src data:/u);
  assert.match(first, /name="hope-align-design-version" content="35"/u);
  assert.match(
    first,
    /<h2 class="toc-heading"><span>문서 목차<\/span><span class="toc-progress"><span data-toc-current>1<\/span> \/ \d+<\/span><\/h2>/u,
  );
  assert.match(first, /v1 · 현재 합의/u);
  assert.match(first, />버전 이력</u);
  assert.doesNotMatch(first, /의도 이력/u);
  assert.match(first, /aria-label="다크 모드로 전환"/u);
  assert.match(first, /<ul class="decision-list intent-list">/u);
  assert.match(first, /<div class="decision-reason">/u);
  assert.match(first, /<span class="decision-source">사용자가 선택함<\/span>/u);
  assert.match(
    first,
    /id="intent-title"><span class="section-number">01<\/span><span>의도<\/span><\/h2>/u,
  );
  assert.match(
    first,
    /id="decisions-title"><span class="section-number">02<\/span><span>결정<\/span><\/h2>/u,
  );
  assert.doesNotMatch(first, /id="intent-history"/u);
  assert.doesNotMatch(first, /id="goal-history"/u);
  assert.match(first, />목표</u);
  assert.match(
    first,
    /<dl class="synopsis">\s*<div><dt>목표<\/dt><dd><p><bdi dir="auto">/u,
  );
  assert.doesNotMatch(first, /class="goal(?:-label)?"/u);
  assert.match(
    first,
    /<header class="document-head">\s*<h1 id="artifact-title">[\s\S]*?<\/h1>\s*<p class="document-state">[\s\S]*?<\/p>\s*<\/header><section class="overview document-section" id="intent" aria-labelledby="intent-title">\s*<h2 class="section-title" id="intent-title"><span class="section-number">01<\/span><span>의도<\/span><\/h2>/u,
  );
  assert.doesNotMatch(first, /artifact-title-line/u);
  assert.match(first, />결정</u);
  assert.doesNotMatch(first, />미결정 의도</u);
  assert.match(first, />AI 판단 가능</u);
  assert.match(first, />사용자 판단</u);
  assert.match(first, /<span class="intent-statement">/u);
  assert.match(first, /각 원본 업로드에는 하나의 복구 기록이 연결되고/u);
  assert.match(first, /class="reference-marker evidence-marker" href="#evidence-upload-service"/u);
  assert.match(first, /<ol class="evidence-list"><li id="evidence-upload-service" data-evidence-entry>/u);
  assert.match(first, /id="reference-popover" popover="auto" role="dialog"/u);
  assert.match(first, /class="reference-marker verification-marker"[^>]*>\[AI\]<\/a>/u);
  assert.match(first, /class="reference-marker verification-marker"[^>]*>\[유저\]<\/a>/u);
  assert.match(first, /<details class="intent-group section-disclosure intent-verification" id="verification">/u);
  assert.doesNotMatch(first, /<details class="check-verification">/u);
  assert.match(first, /<details class="intent-group section-disclosure" id="evidence">/u);
  assert.doesNotMatch(first, /class="check-list"/u);
  assert.doesNotMatch(first, /list-style: decimal-leading-zero/u);
  assert.match(first, /prefers-color-scheme: dark/u);
  assert.match(first, /@media print/u);
  assert.match(first, /Content-Security-Policy/u);
  assert.doesNotMatch(first, /[ \t]+$/mu);
  assert.match(first, /default-src &#39;none&#39;|default-src 'none'/u);
  assert.match(first, /&lt;script src=/u);
  assert.match(first, /&lt;img src=x onerror=alert\(1\)&gt;/u);
  assert.match(
    first,
    /<dt>목표<\/dt><dd><p><bdi dir="auto">Keep &lt;img src=x onerror=alert\(1\)&gt; as text\.<\/bdi><\/p><p><bdi dir="auto">Keep the second idea distinct\.<\/bdi><sup class="reference-markers evidence-markers">[\s\S]*?<\/sup><\/p><\/dd>/u,
  );
  assert.doesNotMatch(first, /<script src="https:\/\/evil/u);
  assert.doesNotMatch(first, /localStorage/u);
  assert.doesNotMatch(first, /현재 구현 기준|구현 계약/u);
  assert.doesNotMatch(first, /<script id="hope-align-data"|hope-align-digest/u);
  assert.match(first, /<meta name="hope-align-record" content="upload-recovery\.json">/u);
  assert.doesNotMatch(first, /target="_blank"/u);
  assert.doesNotMatch(first, /class="locale-menu"/u);
  assert.match(first, /<div class="display-controls">[\s\S]*?<button class="theme-button"/u);
  const main = first.match(/<main class="main"[^>]*>([\s\S]*?)<\/main>/u)?.[1] ?? "";
  assert.deepEqual(
    [...main.matchAll(/class="section-number">(\d{2})<\/span>/gu)].map((match) => match[1]),
    ["01", "02", "03"],
  );
  const toc = first.match(/<nav class="toc toc-desktop"[\s\S]*?<ol class="toc-list">([\s\S]*?)<\/ol>/u)?.[1] ?? "";
  assert.deepEqual(
    [...toc.matchAll(/class="toc-number">(\d{2})<\/span>/gu)].map((match) => match[1]),
    ["01", "02", "03"],
  );

  const withAlternateLocale = renderAlignArtifact({
    ...record,
    alternateLocale: { href: "upload-recovery.en.html", locale: "en-US" },
  }, options);
  assert.match(
    withAlternateLocale,
    /<a class="locale-option" href="upload-recovery\.en\.html" hreflang="en-US" lang="en-US">English<\/a>/u,
  );
  assert.match(withAlternateLocale, /<div class="display-controls has-locale-menu">[\s\S]*?<details class="locale-menu"[\s\S]*?<button class="theme-button"/u);
  assert.throws(
    () => renderAlignArtifact({
      ...record,
      alternateLocale: { href: "../outside.html", locale: "en-US" },
    }, options),
    /alternateLocale must name a supported locale and sibling HTML file/u,
  );
});

test("evidence marker groups follow document number order", () => {
  const input = makeAlignInput({
    goal: {
      text: "근거 순서와 관계없이 번호를 읽기 쉽게 표시한다.",
      evidenceIds: ["third", "first", "second"],
    },
    evidence: [
      { id: "first", label: "첫 근거", location: "docs/first.md" },
      { id: "second", label: "둘째 근거", location: "docs/second.md" },
      { id: "third", label: "셋째 근거", location: "docs/third.md" },
    ],
  });
  const html = renderAlignArtifact(recordFor(input), { recordHref: "work.json" });
  const goal = html.match(/<dt>목표<\/dt><dd>[\s\S]*?<\/dd>/u)?.[0] ?? "";

  assert.deepEqual(
    [...goal.matchAll(/class="reference-marker evidence-marker"[^>]*>\[([0-9]+)\]<\/a>/gu)]
      .map((match) => Number(match[1])),
    [1, 2, 3],
  );
  assert.deepEqual(input.goal.evidenceIds, ["third", "first", "second"]);
});

test("renderer omits empty optional sections instead of filling the screen", () => {
  const html = renderAlignArtifact(recordFor(makeAlignInput({
    exclusions: [],
    flow: undefined,
    evidence: undefined,
  })), { recordHref: "work.json" });
  assert.doesNotMatch(html, /id="flow"|id="evidence"/u);
  assert.match(html, /id="intent"/u);
  assert.match(html, /id="decisions"/u);
  assert.match(html, /id="verification"/u);
  assert.match(html, /class="toc toc-desktop"/u);
  assert.doesNotMatch(html, />미결정 의도</u);
});


test("create writes one record and its rendered HTML without replacing a path", async () => {
  const root = await repository();
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  const outputPath = join(root, "docs", "alignments", "upload-recovery.json");
  const htmlPath = join(root, "docs", "alignments", "upload-recovery.html");
  const result = await createAlignRecord(
    { inputPath, outputPath, root },
    { now: () => now, randomUUID: () => "11111111-1111-4111-8111-111111111111" },
  );
  assert.equal(result.recordPath, outputPath);
  assert.equal(result.htmlPath, htmlPath);
  assert.equal(result.revision, 1);

  const record = await readJson(outputPath);
  assert.deepEqual(Object.keys(record), [
    "schemaVersion", "alignId", "repository", "locale", "theme",
    "createdAt", "updatedAt", "history", "content",
  ]);
  assert.equal(record.repository, "acme/storage");
  assert.deepEqual(record.history, [{ at: now.toISOString(), summary: "최초 합의" }]);
  assert.equal(record.content.title, "실패한 업로드 복구");
  assert.equal(record.content.revisionSummary, undefined);

  const html = await readFile(htmlPath, "utf8");
  assert.match(html, /<meta name="hope-align-id" content="11111111-1111-4111-8111-111111111111">/u);
  assert.match(html, /<meta name="hope-align-record" content="upload-recovery\.json">/u);
  assert.doesNotMatch(html, /hope-align-data|hope-align-digest/u);

  const inspected = await inspectAlignRecord(outputPath);
  assert.equal(inspected.alignId, result.alignId);
  assert.equal(inspected.repository, "acme/storage");
  assert.equal(inspected.updatedAt, now.toISOString());
  assert.deepEqual(inspected.history, record.history);
  assert.deepEqual(inspected.content, record.content);

  await assert.rejects(
    createAlignRecord({ inputPath, outputPath, root }),
    /did not replace the existing file/u,
  );
  const htmlOnly = join(root, "docs", "alignments", "existing.html");
  await writeFile(htmlOnly, "<p>someone else's page</p>\n", "utf8");
  await assert.rejects(
    createAlignRecord({ inputPath, outputPath: htmlOnly.replace(/html$/u, "json"), root }),
    /did not replace the existing file/u,
  );
  assert.equal(await readFile(htmlOnly, "utf8"), "<p>someone else's page</p>\n");
  assert.equal(await readFile(htmlPath, "utf8"), html);
});

test("create keeps the record a .json file inside the repository", async () => {
  const root = await repository();
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  await assert.rejects(
    createAlignRecord({ inputPath, outputPath: "docs/alignments/work.html", root }),
    /must use a \.json extension/u,
  );
  await assert.rejects(
    createAlignRecord({ inputPath, outputPath: "../outside.json", root }),
    /must stay inside the repository/u,
  );
  if (process.platform !== "win32") {
    const outside = await createTestTemporaryDirectory("hope-align-outside-");
    await symlink(outside, join(root, "linked-docs"));
    await assert.rejects(
      createAlignRecord({ inputPath, outputPath: "linked-docs/agreement.json", root }),
      /must stay inside the repository/u,
    );
    await assert.rejects(readFile(join(outside, "agreement.json")), { code: "ENOENT" });
  }
});

test("revise replaces the content, appends history, and rewrites both files", async () => {
  const root = await repository();
  const firstInput = await inputFile(root, "first.json", makeAlignInput());
  const recordPath = join(root, "docs", "alignments", "upload-recovery.json");
  const created = await createAlignRecord(
    { inputPath: firstInput, outputPath: recordPath, root },
    { now: () => now },
  );
  const revisedAt = new Date("2026-08-15T00:00:00.000Z");
  const secondInput = await inputFile(root, "second.json", makeAlignInput({
    exclusions: [...makeAlignInput().exclusions, "복구 기간이 24시간을 지난 항목"],
    revisionSummary: "복구 기간과 경계를 명확히 함",
  }));
  const revised = await reviseAlignRecord(
    { inputPath: secondInput, recordPath, root },
    { now: () => revisedAt },
  );

  assert.equal(revised.alignId, created.alignId);
  assert.equal(revised.revision, 2);
  const record = await readJson(recordPath);
  assert.equal(record.createdAt, now.toISOString());
  assert.equal(record.updatedAt, revisedAt.toISOString());
  assert.deepEqual(record.history, [
    { at: now.toISOString(), summary: "최초 합의" },
    { at: revisedAt.toISOString(), summary: "복구 기간과 경계를 명확히 함" },
  ]);
  assert.match(record.content.exclusions.at(-1), /24시간/u);

  const html = await readFile(created.htmlPath, "utf8");
  assert.match(html, /<span class="brand-record">SPEC-002<\/span>/u);
  assert.match(html, /<strong>v2 · 현재 합의<\/strong><time datetime="2026-08-15T00:00:00\.000Z">2026-08-15<\/time>/u);
  assert.match(html, /<strong>v1<\/strong><time datetime="2026-08-14T00:00:00\.000Z">2026-08-14<\/time><\/div>\s*<p><bdi dir="auto">최초 합의<\/bdi><\/p>/u);
  assert.match(html, /24시간을 지난 항목/u);
  assert.doesNotMatch(html, /revision-disclosure|revision-popup/u);

  await assert.rejects(
    reviseAlignRecord({ inputPath: await inputFile(root, "v2.json", makeLegacyAlignInputV2()), recordPath, root }),
    /schemaVersion must be 3/u,
  );
  assert.equal((await inspectAlignRecord(recordPath)).revision, 2);
});

test("older history entries fold below the two newest", async () => {
  const history = ["첫 합의", "둘째 합의", "셋째 합의", "넷째 합의"].map((summary, index) => ({
    at: `2026-08-1${index + 1}T00:00:00.000Z`,
    summary,
  }));
  const html = renderAlignArtifact(recordFor(makeAlignInput(), { history }), {
    recordHref: "work.json",
  });
  const rail = html.match(/<section class="rail-history" aria-labelledby="rail-history-title">[\s\S]*?<\/section>/u)[0];
  assert.deepEqual(
    [...rail.matchAll(/<strong>(v\d)/gu)].map((match) => match[1]),
    ["v4", "v3", "v2", "v1"],
  );
  assert.match(rail, /<\/ol>\s*<details class="older-history"><summary>2 개의 이전 버전<\/summary>/u);
  assert.match(rail, /<li class="current">[\s\S]*?넷째 합의/u);
});

test("render rebuilds the HTML after a manual record edit and rejects invalid records", async () => {
  const root = await repository();
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  const recordPath = join(root, "docs", "alignments", "upload-recovery.json");
  const created = await createAlignRecord({ inputPath, outputPath: recordPath, root });
  const record = await readJson(recordPath);
  record.content.title = "손으로 고친 제목";
  record.alternateLocale = { locale: "en-US", href: "upload-recovery.en.html" };
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const rendered = await renderAlignRecord(recordPath);
  assert.equal(rendered.htmlPath, created.htmlPath);
  const html = await readFile(created.htmlPath, "utf8");
  assert.match(html, /<h1 id="artifact-title"><bdi dir="auto">손으로 고친 제목<\/bdi><\/h1>/u);
  assert.match(html, /<a class="locale-option" href="upload-recovery\.en\.html" hreflang="en-US"/u);
  assert.equal((await readJson(recordPath)).content.title, "손으로 고친 제목");

  const invalidChanges = [
    [(value) => { value.progress = 50; }, /unsupported field: progress/u],
    [(value) => { value.history = []; }, /history must contain at least 1 entry/u],
    [(value) => { value.history[0].at = "yesterday"; }, /ISO 8601/u],
    [(value) => { value.content.exclusions = "not a list"; }, /exclusions must be an array/u],
    [(value) => { value.alternateLocale = { locale: "ko-KR", href: "x.html" }; }, /other locale/u],
  ];
  for (const [change, expected] of invalidChanges) {
    const value = structuredClone(record);
    change(value);
    await writeFile(recordPath, JSON.stringify(value), "utf8");
    await assert.rejects(inspectAlignRecord(recordPath), expected);
    await assert.rejects(renderAlignRecord(recordPath), expected);
  }
});

test("design direction images live in the repository and are embedded at render time", async () => {
  const root = await repository();
  const imageDirectory = join(root, "docs", "alignments", "visual-agreement");
  await mkdir(imageDirectory, { recursive: true });
  const firstImage = join(imageDirectory, "direction-one.png");
  const secondImage = join(imageDirectory, "direction-two.png");
  await copyFile(sampleImage, firstImage);
  await copyFile(sampleImage, secondImage);
  const designDirections = makeDesignDirections([firstImage, secondImage]);
  designDirections.options[0].references[0] = {
    evidenceId: "recovery-reference",
    influence: "복구 선택을 첫 화면의 주 행동으로 배치했다.",
  };
  const evidence = [{
    id: "recovery-reference",
    label: "복구 요구 참고",
    location: "https://example.com/recovery-reference",
  }];
  const inputPath = await inputFile(root, "input.json", makeAlignInput({ designDirections, evidence }));
  const recordPath = join(root, "docs", "alignments", "visual-agreement.json");
  const created = await createAlignRecord({ inputPath, outputPath: recordPath, root });

  const record = await readJson(recordPath);
  assert.deepEqual(
    record.content.designDirections.options.map((option) => option.imagePath),
    ["visual-agreement/direction-one.png", "visual-agreement/direction-two.png"],
  );
  const html = await readFile(created.htmlPath, "utf8");
  assert.equal(
    (html.match(/class="direction-image"><img src="data:image\/png;base64,[^"]+" alt="[^"]+" width="128" height="128">/gu) ?? []).length,
    2,
  );
  assert.match(html, /id="design-directions"/u);
  assert.match(html, />AI 추천</u);
  assert.match(html, />사용자가 선택함</u);
  assert.match(html, /href="https:\/\/example\.com\/recovery-reference"/u);
  const firstDirection = html.indexOf('id="design-direction-direction-1"');
  const secondDirection = html.indexOf('id="design-direction-direction-2"');
  const firstStrength = html.indexOf("핵심 선택을 빠르게 찾을 수 있다.");
  const firstRecommendation = html.indexOf(">AI 추천<", firstDirection);
  const firstReference = html.indexOf("복구 요구 참고");
  assert.ok(firstDirection < firstStrength);
  assert.ok(firstStrength < firstRecommendation);
  assert.ok(firstRecommendation < firstReference);
  assert.ok(firstReference < secondDirection);
  assert.doesNotMatch(html, /direction-one\.png|visual-agreement\//u);
  assert.doesNotMatch(html, /<img[^>]+https?:/u);

  // A revision may reuse the record-relative paths that inspect reports.
  const inspected = await inspectAlignRecord(recordPath);
  const reviseInput = await inputFile(root, "revise.json", makeAlignInput({
    designDirections: inspected.content.designDirections,
    evidence,
    revisionSummary: "같은 시안 유지",
  }));
  await reviseAlignRecord({ inputPath: reviseInput, recordPath, root });
  assert.deepEqual(
    (await readJson(recordPath)).content.designDirections,
    record.content.designDirections,
  );

  await writeFile(secondImage, "not a png", "utf8");
  await assert.rejects(renderAlignRecord(recordPath), /Design direction image 2 must be a PNG image/u);
  await copyFile(sampleImage, secondImage);
  const edited = await readJson(recordPath);
  edited.content.designDirections.options[1].imagePath = "visual-agreement/missing.png";
  await writeFile(recordPath, JSON.stringify(edited), "utf8");
  await assert.rejects(renderAlignRecord(recordPath), /Design direction image 2 was not found/u);
  edited.content.designDirections.options[1].imagePath = "/tmp/direction.png";
  await writeFile(recordPath, JSON.stringify(edited), "utf8");
  await assert.rejects(renderAlignRecord(recordPath), /must be a relative path/u);
});

test("design direction images stay inside the repository and the PNG limits", async () => {
  const root = await repository();
  const outside = await createTestTemporaryDirectory("hope-align-image-outside-");
  const outsideImage = join(outside, "direction.png");
  await copyFile(sampleImage, outsideImage);
  const inside = join(root, "inside.png");
  await copyFile(sampleImage, inside);
  const attempt = async (name, imagePaths) => {
    const inputPath = await inputFile(root, `${name}.json`, makeAlignInput({
      designDirections: makeDesignDirections(imagePaths),
    }));
    return createAlignRecord({
      inputPath,
      outputPath: join(root, "docs", "alignments", `${name}.json`),
      root,
    });
  };

  await assert.rejects(attempt("outside", [inside, outsideImage]), /image 2 must stay inside the repository/u);
  if (process.platform !== "win32") {
    await symlink(outsideImage, join(root, "linked.png"));
    await assert.rejects(attempt("linked", [inside, join(root, "linked.png")]), /must stay inside the repository/u);
  }
  const svg = join(root, "direction.svg");
  await writeFile(svg, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "utf8");
  await assert.rejects(attempt("svg", [inside, svg]), /must be a PNG image/u);
  const oversized = join(root, "oversized.png");
  await writeFile(oversized, pngHeader(64, 64, 512 * 1024 + 1));
  await assert.rejects(attempt("oversized", [inside, oversized]), /exceeds 524288 bytes/u);
  const huge = join(root, "huge.png");
  await writeFile(huge, pngHeader(5_000, 10));
  await assert.rejects(attempt("huge", [inside, huge]), /exceeds the supported image dimensions/u);
  const tooManyPixels = join(root, "pixels.png");
  await writeFile(tooManyPixels, pngHeader(4_000, 4_000));
  await assert.rejects(attempt("pixels", [inside, tooManyPixels]), /exceeds the supported image dimensions/u);
  const large = join(root, "large.png");
  await writeFile(large, pngHeader(64, 64, 400 * 1024));
  await assert.rejects(attempt("total", [large, large, large]), /images exceed 1048576 bytes/u);
  await assert.rejects(readFile(join(root, "docs", "alignments", "total.json")), { code: "ENOENT" });
});

test("migrate turns each legacy schema into a record and re-renders the legacy path", async () => {
  const root = await repository();
  const imageDirectory = join(root, "source-images");
  await mkdir(imageDirectory);
  const directionImages = [join(imageDirectory, "one.png"), join(imageDirectory, "two.png")];
  for (const path of directionImages) await copyFile(sampleImage, path);
  const v1 = await makeLegacyContent(1);
  const v2 = await makeLegacyContent(2);
  const v3 = await makeLegacyContent(3, { designDirections: makeDesignDirections(directionImages) });
  const artifactPath = join(root, "docs", "alignments", "upload-recovery.html");
  await writeLegacyAlignArtifact(artifactPath, makeLegacyData({
    revisions: [
      { agreedAt: "2026-08-14T00:00:00.000Z", summary: "최초 합의", content: v1 },
      { agreedAt: "2026-08-15T00:00:00.000Z", summary: "검증 방법 추가", content: v2 },
      { agreedAt: "2026-08-16T00:00:00.000Z", summary: "시안 선택", content: v3 },
    ],
  }), { alternateLocale: { locale: "en-US", href: "upload-recovery.en.html" } });

  const result = await migrateAlignArtifact({ artifactPath });
  const recordPath = join(root, "docs", "alignments", "upload-recovery.json");
  assert.equal(result.recordPath, recordPath);
  assert.equal(result.htmlPath, artifactPath);
  assert.equal(result.legacySchema, 3);
  assert.equal(result.revision, 3);
  assert.deepEqual(result.images, [
    join(root, "docs", "alignments", "upload-recovery.direction-1.png"),
    join(root, "docs", "alignments", "upload-recovery.direction-2.png"),
  ]);
  assert.deepEqual(await readFile(result.images[0]), await readFile(sampleImage));

  const record = await readJson(recordPath);
  assert.equal(record.alignId, "11111111-1111-4111-8111-111111111111");
  assert.equal(record.createdAt, "2026-08-14T00:00:00.000Z");
  assert.equal(record.updatedAt, "2026-08-16T00:00:00.000Z");
  assert.deepEqual(record.alternateLocale, { locale: "en-US", href: "upload-recovery.en.html" });
  assert.deepEqual(record.history.map((entry) => entry.summary), ["최초 합의", "검증 방법 추가", "시안 선택"]);
  assert.deepEqual(record.content.intent, makeAlignInput().intent);
  assert.equal(record.content.designDirections.options[0].imagePath, "upload-recovery.direction-1.png");
  assert.equal(record.content.designDirections.options[0].image, undefined);

  const html = await readFile(artifactPath, "utf8");
  assert.doesNotMatch(html, /hope-align-data|hope-align-digest/u);
  assert.match(html, /<meta name="hope-align-record" content="upload-recovery\.json">/u);
  assert.equal((html.match(/<img src="data:image\/png;base64,/gu) ?? []).length, 2);
  assert.match(html, /<strong>v3 · 현재 합의<\/strong>/u);
  assert.match(html, /hreflang="en-US"/u);

  await assert.rejects(migrateAlignArtifact({ artifactPath }), /not a sealed legacy/u);
});

test("migrate maps v1 and v2 fields without inventing provenance", async () => {
  const root = await repository();
  for (const schema of [1, 2]) {
    const artifactPath = join(root, "docs", "alignments", `schema-${schema}.html`);
    await writeLegacyAlignArtifact(artifactPath, makeLegacyData({
      revisions: [{
        agreedAt: "2026-08-14T00:00:00.000Z",
        summary: "최초 합의",
        content: await makeLegacyContent(schema),
      }],
    }));
    const result = await migrateAlignArtifact({ artifactPath });
    const { content } = await readJson(result.recordPath);
    const legacy = makeLegacyAlignInputV2();

    assert.equal(result.legacySchema, schema);
    assert.equal(content.goal, legacy.goal);
    assert.deepEqual(content.exclusions, [...legacy.scope.excluded, ...legacy.openChoices]);
    assert.deepEqual(content.flow, legacy.behavior);
    assert.deepEqual(
      content.intent.map((item) => item.statement),
      [
        ...legacy.checks.map((check) => check.condition),
        legacy.boundary,
        ...legacy.scope.included,
        ...legacy.decisions.map((decision) => decision.decision),
      ],
    );
    assert.equal(content.intent.some((item) => item.decidedBy !== undefined), false);
    const unjudged = content.intent.slice(schema === 2 ? legacy.checks.length : 0);
    assert.equal(unjudged.every((item) => item.by === "human" && /판단 방법이 없어/u.test(item.verify)), true);
    if (schema === 2) {
      assert.deepEqual(content.intent[0], {
        statement: legacy.checks[0].condition,
        verify: legacy.checks[0].verify,
        by: "agent",
      });
    }
    assert.equal(content.intent.at(-1).reason, legacy.decisions.at(-1).reason);
    assert.deepEqual(Object.keys(result.moved).sort(), [
      ...(schema === 1 ? ["intent", "success"] : ["checks"]),
      "behavior", "boundary", "decisions", "openChoices", "scope.excluded", "scope.included",
    ].sort());
  }
});

test("migrate reads a real legacy example and refuses changed or occupied targets", async () => {
  const root = await repository();
  const artifactPath = join(root, "docs", "alignments", "ui-design-directions.html");
  const data = await readRealLegacyData();
  await writeLegacyAlignArtifact(artifactPath, data);

  const result = await migrateAlignArtifact({ artifactPath });
  const record = await readJson(result.recordPath);
  assert.equal(result.legacySchema, 1);
  assert.equal(record.alignId, data.alignId);
  assert.equal(record.repository, "dkstm95/hope");
  assert.deepEqual(record.history, data.revisions.map((revision) => ({
    at: revision.agreedAt,
    summary: revision.summary,
  })));
  assert.equal(record.content.goal, data.revisions.at(-1).content.intent);
  assert.equal(record.alternateLocale, undefined);
  const html = await readFile(artifactPath, "utf8");
  assert.match(html, /<span class="brand-record">SPEC-002<\/span>/u);
  assert.match(html, /UI 디자인 시안 탐색을 포함하는 Align/u);

  const edited = join(root, "docs", "alignments", "edited.html");
  await writeLegacyAlignArtifact(edited, { ...data, alignId: "22222222-2222-4222-8222-222222222222" });
  const source = await readFile(edited, "utf8");
  await writeFile(edited, source.replace("<main>", "<main>hand edit "), "utf8");
  await assert.rejects(migrateAlignArtifact({ artifactPath: edited }), /changed outside Hope/u);

  const occupied = join(root, "docs", "alignments", "occupied.html");
  await writeLegacyAlignArtifact(occupied, data);
  await writeFile(occupied.replace(/html$/u, "json"), "{}\n", "utf8");
  const before = await readFile(occupied, "utf8");
  await assert.rejects(migrateAlignArtifact({ artifactPath: occupied }), /did not replace the existing file/u);
  assert.equal(await readFile(occupied, "utf8"), before);
});
