import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";

import {
  createAlignArtifact,
  inspectAlignArtifact,
  reviseAlignArtifact,
  validateAlignInput,
  verifyAlignHtml,
} from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";
import {
  makeAlignInput,
  makeDesignDirections,
  writeLegacyAlignArtifact,
} from "../test-support/align-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const execFileAsync = promisify(execFile);
const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const now = new Date("2026-08-14T00:00:00.000Z");
const sampleImage = fileURLToPath(new URL("../plugins/hope/assets/hope-icon.png", import.meta.url));
const alignDataPattern = /<script id="hope-align-data" type="application\/json">([\s\S]*?)<\/script>/u;
const alignDigestPattern = /(<meta name="hope-align-digest" content=")[a-f0-9]{64}(">)/u;

function resealAlignArtifact(source, mutate) {
  const dataSource = source.match(alignDataPattern)?.[1];
  assert.notEqual(dataSource, undefined);
  const data = JSON.parse(dataSource);
  mutate(data);
  const changed = source.replace(
    alignDataPattern,
    `<script id="hope-align-data" type="application/json">${JSON.stringify(data)}</script>`,
  );
  const normalized = changed.replace(alignDigestPattern, `$1${"0".repeat(64)}$2`);
  const digest = createHash("sha256").update(normalized).digest("hex");
  return normalized.replace(alignDigestPattern, `$1${digest}$2`);
}

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

function boundedLargePng() {
  const width = 480;
  const height = 256;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) rows[row * (width * 4 + 1)] = 0;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 0 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

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

test("Align input keeps optional detail conditional and rejects unknown fields", () => {
  const minimal = makeAlignInput({
    behavior: undefined,
    decisions: [],
    evidence: undefined,
    openChoices: [],
  });
  const value = validateAlignInput(minimal);
  assert.equal(value.behavior, undefined);
  assert.deepEqual(value.decisions, []);
  assert.deepEqual(value.evidence, []);

  assert.throws(
    () => validateAlignInput({ ...makeAlignInput(), progress: 50 }),
    /unsupported field: progress/u,
  );
  assert.throws(
    () => validateAlignInput({ ...makeAlignInput(), checks: [] }),
    /must contain between 1 and 12 items/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      checks: [{ condition: "완료", by: "agent" }],
    })),
    /verify must be text/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      checks: [{ condition: "완료", verify: "테스트한다.", by: "model" }],
    })),
    /by must be agent or human/u,
  );
  const current = makeAlignInput();
  const {
    goal,
    checks,
    schemaVersion: _schemaVersion,
    ...legacyShared
  } = current;
  assert.throws(
    () => validateAlignInput({
      ...legacyShared,
      schemaVersion: 1,
      intent: goal,
      success: checks.map((check) => check.condition),
    }),
    /schemaVersion must be 2/u,
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      behavior: {
        ...makeAlignInput().behavior,
        outcomes: [{ title: "보류", kind: "unknown" }],
      },
    })),
    /kind must be complete or cancel/u,
  );

  assert.equal(
    [...validateAlignInput(makeAlignInput({ title: "😀".repeat(160) })).title].length,
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

test("design direction images are validated, embedded, and kept off the network", async () => {
  const root = await repository();
  const firstImage = join(root, "direction-one.png");
  const secondImage = join(root, "direction-two.png");
  await copyFile(sampleImage, firstImage);
  await copyFile(sampleImage, secondImage);
  const inputPath = await inputFile(root, "input.json", makeAlignInput({
    designDirections: makeDesignDirections([firstImage, secondImage]),
  }));
  const outputPath = join(root, "docs", "alignments", "visual-agreement.html");
  const created = await createAlignArtifact({ inputPath, outputPath, root });
  const inspected = await inspectAlignArtifact(outputPath);
  const directions = inspected.content.designDirections;

  assert.equal(directions.options.length, 2);
  assert.equal(directions.options[0].image.mimeType, "image/png");
  assert.equal(directions.options[0].image.width, 128);
  assert.equal(directions.options[0].image.height, 128);
  assert.equal(directions.recommendation.optionId, "direction-1");
  assert.equal(directions.selection.optionId, "direction-2");
  const html = await readFile(outputPath, "utf8");
  assert.equal(verifyAlignHtml(html), created.digest);
  assert.equal((html.match(/class="direction-image"><img src="data:image\/png;base64,/gu) ?? []).length, 2);
  assert.match(html, /id="design-directions"/u);
  assert.match(html, />AI 추천</u);
  assert.match(html, />사용자가 선택함</u);
  assert.match(html, /href="https:\/\/example\.com\/recovery-reference"/u);
  assert.match(html, /복구 선택을 첫 화면의 주 행동으로 배치했다/u);
  assert.doesNotMatch(html, new RegExp(firstImage.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.doesNotMatch(html, /<img[^>]+https?:/u);
});

test("design direction input rejects unsafe images and inconsistent choices", async () => {
  const root = await repository();
  const unsupported = join(root, "direction.svg");
  await writeFile(unsupported, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "utf8");
  const unsupportedInput = await inputFile(root, "unsupported.json", makeAlignInput({
    designDirections: makeDesignDirections([unsupported, unsupported]),
  }));
  await assert.rejects(
    createAlignArtifact({
      inputPath: unsupportedInput,
      outputPath: join(root, "docs", "alignments", "unsupported.html"),
      root,
    }),
    /must be a PNG image/u,
  );

  const oversized = join(root, "oversized.png");
  await writeFile(oversized, Buffer.alloc((512 * 1024) + 1));
  const oversizedInput = await inputFile(root, "oversized.json", makeAlignInput({
    designDirections: makeDesignDirections([sampleImage, oversized]),
  }));
  await assert.rejects(
    createAlignArtifact({
      inputPath: oversizedInput,
      outputPath: join(root, "docs", "alignments", "oversized-image.html"),
      root,
    }),
    /exceeds 524288 bytes/u,
  );

  const hugeDimensions = join(root, "huge-dimensions.png");
  const hugeBytes = await readFile(sampleImage);
  hugeBytes.writeUInt32BE(5_000, 16);
  hugeBytes.writeUInt32BE(crc32(hugeBytes.subarray(12, 29)), 29);
  await writeFile(hugeDimensions, hugeBytes);
  const hugeInput = await inputFile(root, "huge.json", makeAlignInput({
    designDirections: makeDesignDirections([sampleImage, hugeDimensions]),
  }));
  await assert.rejects(
    createAlignArtifact({
      inputPath: hugeInput,
      outputPath: join(root, "docs", "alignments", "huge-image.html"),
      root,
    }),
    /exceeds the supported image dimensions/u,
  );

  const truncated = join(root, "truncated.png");
  await writeFile(truncated, (await readFile(sampleImage)).subarray(0, 24));
  const truncatedInput = await inputFile(root, "truncated.json", makeAlignInput({
    designDirections: makeDesignDirections([sampleImage, truncated]),
  }));
  await assert.rejects(
    createAlignArtifact({
      inputPath: truncatedInput,
      outputPath: join(root, "docs", "alignments", "truncated-image.html"),
      root,
    }),
    /is not a valid PNG image/u,
  );

  const corrupt = join(root, "corrupt.png");
  const corruptBytes = await readFile(sampleImage);
  corruptBytes[corruptBytes.length - 5] ^= 0xff;
  await writeFile(corrupt, corruptBytes);
  const corruptInput = await inputFile(root, "corrupt.json", makeAlignInput({
    designDirections: makeDesignDirections([sampleImage, corrupt]),
  }));
  await assert.rejects(
    createAlignArtifact({
      inputPath: corruptInput,
      outputPath: join(root, "docs", "alignments", "corrupt-image.html"),
      root,
    }),
    /is not a valid PNG image/u,
  );

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
      .designDirections.options[0].references[0].url,
    "HTTPS://example.com/reference",
  );
  assert.throws(
    () => validateAlignInput(makeAlignInput({
      designDirections: makeDesignDirections(["relative.png", sampleImage]),
    })),
    /must be an absolute path/u,
  );
  const missingInfluence = makeDesignDirections([sampleImage, sampleImage]);
  delete missingInfluence.options[0].references[0].influence;
  assert.throws(
    () => validateAlignInput(makeAlignInput({ designDirections: missingInfluence })),
    /influence must be text/u,
  );
});

test("two image-rich revisions remain complete within the artifact boundary", async () => {
  const root = await repository();
  const firstImage = join(root, "large-one.png");
  const secondImage = join(root, "large-two.png");
  const image = boundedLargePng();
  assert.ok(image.length < 512 * 1024);
  assert.ok(image.length * 2 < 1024 * 1024);
  await writeFile(firstImage, image);
  await writeFile(secondImage, image);
  const directions = makeDesignDirections([firstImage, secondImage]);
  const firstInput = await inputFile(root, "visual-one.json", makeAlignInput({
    designDirections: directions,
  }));
  const outputPath = join(root, "docs", "alignments", "visual-history.html");
  const created = await createAlignArtifact({ inputPath: firstInput, outputPath, root });
  const revisedDirections = makeDesignDirections([firstImage, secondImage]);
  revisedDirections.selection = {
    optionId: "direction-1",
    reason: "첫 번째 시안이 작업 집중도에 더 잘 맞는다.",
    decidedBy: "delegated",
  };
  const secondInput = await inputFile(root, "visual-two.json", makeAlignInput({
    designDirections: revisedDirections,
    revisionSummary: "시안 선택 변경",
  }));
  const revised = await reviseAlignArtifact({
    artifactPath: outputPath,
    expectedDigest: created.digest,
    inputPath: secondInput,
    root,
  });
  const html = await readFile(outputPath, "utf8");
  assert.ok(Buffer.byteLength(html) < 12 * 1024 * 1024);
  assert.equal(verifyAlignHtml(html), revised.digest);
  assert.match(html, /id="revision-1"/u);
  assert.match(html, /revision-1-design-direction-direction-1/u);
  assert.match(html, /복구 선택을 첫 화면의 주 행동으로 배치했다/u);
  assert.equal((await inspectAlignArtifact(outputPath)).history.length, 2);

  const tooManyImages = await inputFile(root, "visual-over-total.json", makeAlignInput({
    designDirections: makeDesignDirections([firstImage, secondImage, firstImage]),
  }));
  await assert.rejects(
    createAlignArtifact({
      inputPath: tooManyImages,
      outputPath: join(root, "docs", "alignments", "visual-over-total.html"),
      root,
    }),
    /images exceed 1048576 bytes/u,
  );
});

test("renderer is deterministic, self-contained, and keeps authored text inert", () => {
  const input = validateAlignInput(makeAlignInput({
    title: '</title><script src="https://evil.example/x.js"></script>',
    goal: "Keep <img src=x onerror=alert(1)> as text.\nKeep the second idea distinct.",
  }));
  const { revisionSummary, locale, theme, schemaVersion: _schemaVersion, ...content } = input;
  const data = {
    schemaVersion: 1,
    alignId: "11111111-1111-4111-8111-111111111111",
    repository: "acme/storage",
    locale,
    theme,
    createdAt: now.toISOString(),
    revisions: [{
      number: 1,
      agreedAt: now.toISOString(),
      summary: revisionSummary,
      content,
    }],
  };
  const options = { digest: "0".repeat(64) };
  const first = renderAlignArtifact(data, options);
  const second = renderAlignArtifact(data, options);

  assert.equal(first, second);
  assert.match(first, /<img class="brand-icon" src="data:image\/png;base64,/u);
  assert.match(first, /<span>HOPE<\/span><span class="brand-product">· ALIGN<\/span>/u);
  assert.match(first, /font-family: "Hope Sans"/u);
  assert.match(first, /font-src data:/u);
  assert.match(first, /name="hope-align-design-version" content="7"/u);
  assert.match(first, /v1 · 현재 합의/u);
  assert.match(first, />버전 이력</u);
  assert.doesNotMatch(first, /의도 이력/u);
  assert.match(first, /aria-label="다크 모드로 전환"/u);
  assert.match(first, /class="outcome-mark" aria-hidden="true">×</u);
  assert.match(first, />판정 결과</u);
  assert.match(first, /<ol class="decision-list">/u);
  assert.match(first, />결정 사항</u);
  assert.doesNotMatch(first, /id="intent-history"/u);
  assert.doesNotMatch(first, /id="goal-history"/u);
  assert.match(first, />목표</u);
  assert.match(first, />완료 기준</u);
  assert.match(first, />확정 사항</u);
  assert.match(first, />구현 시 결정 사항</u);
  assert.match(first, />AI 에이전트 확인</u);
  assert.match(first, />사용자 확인</u);
  assert.match(first, /<ol class="check-list">/u);
  assert.match(first, /<span class="check-condition">/u);
  assert.doesNotMatch(first, /<ul class="check-list">/u);
  assert.doesNotMatch(first, /<ol class="check-list"><li><strong>/u);
  assert.match(first, /list-style: decimal-leading-zero/u);
  assert.match(first, /prefers-color-scheme: dark/u);
  assert.match(first, /@media print/u);
  assert.match(first, /Content-Security-Policy/u);
  assert.doesNotMatch(first, /[ \t]+$/mu);
  assert.match(first, /default-src &#39;none&#39;|default-src 'none'/u);
  assert.match(first, /&lt;script src=/u);
  assert.match(first, /&lt;img src=x onerror=alert\(1\)&gt;/u);
  assert.match(
    first,
    /<div class="goal"><p><bdi dir="auto">Keep &lt;img src=x onerror=alert\(1\)&gt; as text\.<\/bdi><\/p><p><bdi dir="auto">Keep the second idea distinct\.<\/bdi><\/p><\/div>/u,
  );
  assert.doesNotMatch(first, /<script src="https:\/\/evil/u);
  assert.doesNotMatch(first, /localStorage/u);
  assert.doesNotMatch(first, /현재 구현 기준|구현 계약/u);
  assert.match(first, /<script id="hope-align-data" type="application\/json">/u);
  assert.doesNotMatch(first, /target="_blank"/u);
  assert.doesNotMatch(first, /class="locale-link"/u);

  const withAlternateLocale = renderAlignArtifact(data, {
    alternateLocale: { href: "upload-recovery.en.html", locale: "en-US" },
    digest: "0".repeat(64),
  });
  assert.match(
    withAlternateLocale,
    /<a class="locale-link" href="upload-recovery\.en\.html" hreflang="en-US" lang="en-US">English<\/a>/u,
  );
  assert.throws(
    () => renderAlignArtifact(data, {
      alternateLocale: { href: "..\/outside.html", locale: "en-US" },
      digest: "0".repeat(64),
    }),
    /alternateLocale must name a supported locale and sibling HTML file/u,
  );
});

test("renderer omits empty optional sections instead of filling the screen", () => {
  const input = validateAlignInput(makeAlignInput({
    behavior: undefined,
    decisions: [],
    evidence: undefined,
    openChoices: [],
  }));
  const { revisionSummary, locale, theme, schemaVersion: _schemaVersion, ...content } = input;
  const data = {
    schemaVersion: 1,
    alignId: "11111111-1111-4111-8111-111111111111",
    repository: "acme/storage",
    locale,
    theme,
    createdAt: now.toISOString(),
    revisions: [{
      number: 1,
      agreedAt: now.toISOString(),
      summary: revisionSummary,
      content,
    }],
  };
  const html = renderAlignArtifact(data, { digest: "0".repeat(64) });
  assert.doesNotMatch(html, /id="behavior"|id="agreement"|id="evidence"/u);
  assert.doesNotMatch(html, /class="toc"|class="toc-mobile"/u);

  const decisionInput = validateAlignInput(makeAlignInput({
    behavior: undefined,
    evidence: undefined,
    openChoices: [],
  }));
  const {
    revisionSummary: decisionSummary,
    locale: decisionLocale,
    theme: decisionTheme,
    schemaVersion: _decisionSchemaVersion,
    ...decisionContent
  } = decisionInput;
  const decisionHtml = renderAlignArtifact({
    ...data,
    locale: decisionLocale,
    theme: decisionTheme,
    revisions: [{
      number: 1,
      agreedAt: now.toISOString(),
      summary: decisionSummary,
      content: decisionContent,
    }],
  }, { digest: "0".repeat(64) });
  assert.match(decisionHtml, /class="agreement-groups"/u);
  assert.doesNotMatch(decisionHtml, /agreement-grid/u);
  assert.doesNotMatch(decisionHtml, />구현 시 결정 사항</u);
});

test("create publishes one owned project artifact without replacing a path", async () => {
  const root = await repository();
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  const outputPath = join(root, "docs", "alignments", "upload-recovery.html");
  const result = await createAlignArtifact(
    { inputPath, outputPath, root },
    { now: () => now, randomUUID: () => "11111111-1111-4111-8111-111111111111" },
  );
  assert.equal(result.artifactPath, outputPath);
  assert.equal(result.repository, "acme/storage");
  assert.equal(result.revision, 1);
  assert.match(result.digest, /^[a-f0-9]{64}$/u);

  const html = await readFile(outputPath, "utf8");
  assert.equal(verifyAlignHtml(html), result.digest);
  const inspected = await inspectAlignArtifact(outputPath);
  assert.equal(inspected.digest, result.digest);
  assert.equal(inspected.content.title, "실패한 업로드 복구");
  assert.deepEqual(inspected.history, [{
    agreedAt: now.toISOString(),
    number: 1,
    summary: "최초 합의",
  }]);

  await assert.rejects(
    createAlignArtifact({ inputPath, outputPath, root }),
    /did not replace the existing file/u,
  );
  assert.equal(await readFile(outputPath, "utf8"), html);
});

test("revise appends a current goal contract to a legacy artifact", async () => {
  const root = await repository();
  const outputPath = join(root, "docs", "alignments", "upload-recovery.html");
  const created = await writeLegacyAlignArtifact({
    artifactPath: outputPath,
    content: {
      behavior: {
        ...makeAlignInput().behavior,
        outcomes: [{
          title: "이전 결과 전용",
          detail: "이전 버전에서만 합의한 결과다.",
          kind: "cancel",
        }],
      },
      evidence: [{ label: "이전 근거 전용", location: "docs/previous.md" }],
    },
  });
  const legacy = await inspectAlignArtifact(outputPath);
  assert.equal(legacy.digest, created.digest);
  assert.equal(legacy.revision, 1);
  assert.equal(legacy.content.intent, makeAlignInput().goal);
  assert.deepEqual(
    legacy.content.success,
    makeAlignInput().checks.map((check) => check.condition),
  );
  const revisedAt = new Date("2026-08-15T00:00:00.000Z");
  const secondInput = await inputFile(root, "second.json", makeAlignInput({
    boundary: "복구 기간은 24시간이며 만료된 항목은 복구하지 않는다.",
    revisionSummary: "복구 기간과 경계를 명확히 함",
  }));
  const revised = await reviseAlignArtifact(
    {
      artifactPath: outputPath,
      expectedDigest: created.digest,
      inputPath: secondInput,
      root,
    },
    { now: () => revisedAt },
  );

  assert.equal(revised.alignId, created.alignId);
  assert.equal(revised.artifactPath, created.artifactPath);
  assert.equal(revised.revision, 2);
  assert.notEqual(revised.digest, created.digest);
  const inspected = await inspectAlignArtifact(outputPath);
  assert.equal(inspected.revision, 2);
  assert.equal(inspected.content.goal, makeAlignInput().goal);
  assert.deepEqual(inspected.content.checks, makeAlignInput().checks);
  assert.equal(
    inspected.content.boundary,
    "복구 기간은 24시간이며 만료된 항목은 복구하지 않는다.",
  );
  assert.equal(inspected.history.length, 2);
  const html = await readFile(outputPath, "utf8");
  assert.match(html, /v2 · 현재 합의/u);
  assert.match(html, /v1 · <bdi dir="auto">최초 합의/u);
  assert.match(html, /id="revision-1"/u);
  assert.match(html, /변경 내용 보기/u);
  assert.match(html, /이전 결과 전용 \(취소\)/u);
  assert.match(html, /이전 버전에서만 합의한 결과다/u);
  assert.match(html, /이전 근거 전용/u);
  assert.match(html, /docs\/previous\.md/u);
  assert.match(html, /중단 지점부터 이어서 완료할 수 있다/u);
  assert.match(html, /재개 요청의 시작 위치/u);

  await assert.rejects(
    reviseAlignArtifact({
      artifactPath: outputPath,
      expectedDigest: created.digest,
      inputPath: secondInput,
      root,
    }),
    /does not match the inspected revision/u,
  );

  await writeFile(outputPath, `${html}\n<!-- user edit -->\n`, "utf8");
  const edited = await readFile(outputPath, "utf8");
  await assert.rejects(
    inspectAlignArtifact(outputPath),
    /changed outside Hope/u,
  );
  await assert.rejects(
    reviseAlignArtifact({
      artifactPath: outputPath,
      expectedDigest: revised.digest,
      inputPath: secondInput,
      root,
    }),
    /changed outside Hope/u,
  );
  assert.equal(await readFile(outputPath, "utf8"), edited);
});

test("inspect rejects resealed artifacts with invalid revision content", async () => {
  const root = await repository();
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  const outputPath = join(root, "docs", "alignments", "upload-recovery.html");
  await createAlignArtifact({ inputPath, outputPath, root });
  const original = await readFile(outputPath, "utf8");
  const invalidChanges = [
    (data) => { data.revisions[0].content.scope.included = "not a list"; },
    (data) => { data.revisions[0].content.progress = 50; },
    (data) => { delete data.revisions[0].content.checks; },
    (data) => { data.revisions[0].content.intent = data.revisions[0].content.goal; },
  ];

  for (const change of invalidChanges) {
    await writeFile(outputPath, resealAlignArtifact(original, change), "utf8");
    await assert.rejects(inspectAlignArtifact(outputPath), /content|goal contract/u);
  }
});

test("revision rejects an artifact that would exceed the readable size", async () => {
  const root = await repository();
  const prose = "x".repeat(4_000);
  const largeInput = makeAlignInput({
    behavior: undefined,
    decisions: [],
    evidence: undefined,
    goal: prose,
    problem: prose,
    checks: Array.from({ length: 4 }, () => ({
      condition: prose,
      verify: prose,
      by: "agent",
    })),
    boundary: prose,
    scope: {
      included: Array.from({ length: 25 }, () => prose),
      excluded: Array.from({ length: 25 }, () => prose),
    },
    openChoices: [],
  });
  const inputPath = await inputFile(root, "large.json", largeInput);
  const outputPath = join(root, "docs", "alignments", "large.html");
  let current = await createAlignArtifact({ inputPath, outputPath, root });
  let rejection;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const before = await readFile(outputPath);
    try {
      current = await reviseAlignArtifact({
        artifactPath: outputPath,
        expectedDigest: current.digest,
        inputPath,
        root,
      });
    } catch (error) {
      rejection = error;
      assert.match(error.message, /exceeds 12582912 bytes/u);
      assert.deepEqual(await readFile(outputPath), before);
      const inspected = await inspectAlignArtifact(outputPath);
      assert.equal(inspected.digest, current.digest);
      break;
    }
  }

  assert.ok(rejection, "a bounded artifact must reject history before it becomes unreadable");
});

test("revision compares canonical repository identity instead of its display label", async () => {
  const sourceRoot = await repository("git@github.com:acme/storage.git");
  const inputPath = await inputFile(sourceRoot, "input.json", makeAlignInput());
  const sourceArtifact = join(sourceRoot, "docs", "alignments", "intent.html");
  const created = await createAlignArtifact({ inputPath, outputPath: sourceArtifact, root: sourceRoot });

  await execFileAsync("git", [
    "-C",
    sourceRoot,
    "remote",
    "set-url",
    "origin",
    "https://github.com/acme/storage.git",
  ]);
  const sameRepositoryInput = await inputFile(sourceRoot, "same.json", makeAlignInput({
    revisionSummary: "같은 저장소의 HTTPS 주소",
  }));
  const revised = await reviseAlignArtifact({
    artifactPath: sourceArtifact,
    expectedDigest: created.digest,
    inputPath: sameRepositoryInput,
    root: sourceRoot,
  });
  assert.equal(revised.revision, 2);

  const otherRoot = await repository("git@gitlab.com:acme/storage.git");
  const otherArtifact = join(otherRoot, "docs", "alignments", "intent.html");
  await mkdir(dirname(otherArtifact), { recursive: true });
  await copyFile(sourceArtifact, otherArtifact);
  const otherInput = await inputFile(otherRoot, "other.json", makeAlignInput());
  const copiedBytes = await readFile(otherArtifact);
  await assert.rejects(
    reviseAlignArtifact({
      artifactPath: otherArtifact,
      expectedDigest: revised.digest,
      inputPath: otherInput,
      root: otherRoot,
    }),
    /belongs to a different repository/u,
  );
  assert.deepEqual(await readFile(otherArtifact), copiedBytes);

  const firstParent = await createTestTemporaryDirectory("hope-align-local-a-");
  const secondParent = await createTestTemporaryDirectory("hope-align-local-b-");
  const firstLocal = join(firstParent, "project");
  const secondLocal = join(secondParent, "project");
  await mkdir(firstLocal);
  await mkdir(secondLocal);
  await execFileAsync("git", ["init", "-q", firstLocal]);
  await execFileAsync("git", ["init", "-q", secondLocal]);
  const localInput = await inputFile(firstLocal, "input.json", makeAlignInput());
  const firstLocalArtifact = join(firstLocal, "docs", "alignments", "intent.html");
  const localCreated = await createAlignArtifact({
    inputPath: localInput,
    outputPath: firstLocalArtifact,
    root: firstLocal,
  });
  const secondLocalArtifact = join(secondLocal, "docs", "alignments", "intent.html");
  await mkdir(dirname(secondLocalArtifact), { recursive: true });
  await copyFile(firstLocalArtifact, secondLocalArtifact);
  const secondInput = await inputFile(secondLocal, "input.json", makeAlignInput());
  await assert.rejects(
    reviseAlignArtifact({
      artifactPath: secondLocalArtifact,
      expectedDigest: localCreated.digest,
      inputPath: secondInput,
      root: secondLocal,
    }),
    /belongs to a different repository/u,
  );
});

test("publication stops when an ancestor changes after validation", {
  skip: process.platform === "win32",
}, async () => {
  const root = await repository();
  const outside = await createTestTemporaryDirectory("hope-align-race-outside-");
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  const outputPath = join(root, "docs", "alignments", "agreement.html");
  const parent = dirname(outputPath);
  const moved = join(root, "validated-alignments");
  let swapped = false;

  await assert.rejects(
    createAlignArtifact(
      { inputPath, outputPath, root },
      {
        publicationCheckpoint: async (step) => {
          if (!swapped && step === "before-link") {
            swapped = true;
            await rename(parent, moved);
            await symlink(outside, parent);
          }
        },
      },
    ),
    /non-directory or link|directory changed during publication/u,
  );
  await assert.rejects(readFile(join(outside, "agreement.html")), { code: "ENOENT" });
});

test("revision stops when its verified parent changes before replacement", {
  skip: process.platform === "win32",
}, async () => {
  const root = await repository();
  const outside = await createTestTemporaryDirectory("hope-align-revise-race-outside-");
  const firstInput = await inputFile(root, "first.json", makeAlignInput());
  const secondInput = await inputFile(root, "second.json", makeAlignInput({
    revisionSummary: "두 번째 합의",
  }));
  const outputPath = join(root, "docs", "alignments", "agreement.html");
  const created = await createAlignArtifact({ inputPath: firstInput, outputPath, root });
  const parent = dirname(outputPath);
  const moved = join(root, "validated-alignments");
  let swapped = false;

  await assert.rejects(
    reviseAlignArtifact(
      {
        artifactPath: outputPath,
        expectedDigest: created.digest,
        inputPath: secondInput,
        root,
      },
      {
        publicationCheckpoint: async (step) => {
          if (!swapped && step === "before-replace") {
            swapped = true;
            await rename(parent, moved);
            await symlink(outside, parent);
          }
        },
      },
    ),
    /non-directory or link|directory changed during publication/u,
  );
  await assert.rejects(readFile(join(outside, "agreement.html")), { code: "ENOENT" });
  await unlink(parent);
  await rename(moved, parent);
  assert.equal((await inspectAlignArtifact(outputPath)).digest, created.digest);
});

test("create refuses a linked output directory", {
  skip: process.platform === "win32",
}, async () => {
  const root = await repository();
  const outside = await createTestTemporaryDirectory("hope-align-outside-");
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  await symlink(outside, join(root, "linked-docs"));
  await assert.rejects(
    createAlignArtifact({
      inputPath,
      outputPath: join(root, "linked-docs", "agreement.html"),
      root,
    }),
    /non-directory or link/u,
  );
});
