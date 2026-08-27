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
  makeLegacyAlignInputV2,
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
    flow: undefined,
    evidence: undefined,
    exclusions: [],
  });
  const value = validateAlignInput(minimal);
  assert.equal(value.flow, undefined);
  assert.deepEqual(value.exclusions, []);
  assert.deepEqual(value.evidence, []);

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

test("Align accepts only the canonical v3 intent model", () => {
  const current = validateAlignInput(makeAlignInput());
  assert.equal(current.schemaVersion, 3);
  assert.equal(current.intent.length, 3);
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
  assert.equal(validateAlignInput(makeAlignInput({ intent: broadIntent })).intent.length, 13);
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

test("create and revise reject direct v2 input", async () => {
  const root = await repository();
  const legacyInput = await inputFile(root, "legacy-v2.json", makeLegacyAlignInputV2());
  const outputPath = join(root, "docs", "alignments", "upload-recovery.html");

  await assert.rejects(
    createAlignArtifact({ inputPath: legacyInput, outputPath, root }),
    /schemaVersion must be 3/u,
  );

  const currentInput = await inputFile(root, "current-v3.json", makeAlignInput());
  const created = await createAlignArtifact({ inputPath: currentInput, outputPath, root });
  await assert.rejects(
    reviseAlignArtifact({
      artifactPath: outputPath,
      expectedDigest: created.digest,
      inputPath: legacyInput,
      root,
    }),
    /schemaVersion must be 3/u,
  );
  assert.equal((await inspectAlignArtifact(outputPath)).revision, 1);
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
  assert.deepEqual(value.goal.evidenceIds, ["upload-service", "product-requirements"]);
  assert.equal(value.goal.text, "중단된 업로드를 안전하게 복구한다.");

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

test("inspect keeps exact duplicates in retained history readable", async () => {
  const root = await repository();
  const inputPath = await inputFile(root, "input.json", makeAlignInput());
  const outputPath = join(root, "docs", "alignments", "retained-duplicate.html");
  await createAlignArtifact({ inputPath, outputPath, root });
  const original = await readFile(outputPath, "utf8");
  const retained = resealAlignArtifact(original, (data) => {
    const evidence = data.revisions[0].content.evidence;
    evidence.push(structuredClone(evidence[0]));
  });
  await writeFile(outputPath, retained, "utf8");

  const inspected = await inspectAlignArtifact(outputPath);
  assert.equal(inspected.content.evidence.length, 3);
});

test("design direction images are validated, embedded, and kept off the network", async () => {
  const root = await repository();
  const firstImage = join(root, "direction-one.png");
  const secondImage = join(root, "direction-two.png");
  await copyFile(sampleImage, firstImage);
  await copyFile(sampleImage, secondImage);
  const designDirections = makeDesignDirections([firstImage, secondImage]);
  designDirections.options[0].references[0] = {
    evidenceId: "recovery-reference",
    influence: "복구 선택을 첫 화면의 주 행동으로 배치했다.",
  };
  const inputPath = await inputFile(root, "input.json", makeAlignInput({
    designDirections,
    evidence: [{
      id: "recovery-reference",
      label: "복구 요구 참고",
      location: "https://example.com/recovery-reference",
    }],
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
  assert.equal(directions.options[0].references[0].evidenceId, "recovery-reference");
  const html = await readFile(outputPath, "utf8");
  assert.equal(verifyAlignHtml(html), created.digest);
  assert.equal((html.match(/class="direction-image"><img src="data:image\/png;base64,/gu) ?? []).length, 2);
  assert.match(html, /id="design-directions"/u);
  assert.match(html, />AI 추천</u);
  assert.match(html, />사용자가 선택함</u);
  assert.match(html, /href="https:\/\/example\.com\/recovery-reference"/u);
  assert.match(html, /복구 선택을 첫 화면의 주 행동으로 배치했다/u);
  const firstDirection = html.indexOf('id="design-direction-direction-1"');
  const secondDirection = html.indexOf('id="design-direction-direction-2"');
  const firstStrength = html.indexOf("핵심 선택을 빠르게 찾을 수 있다.");
  const firstRecommendation = html.indexOf(">AI 추천<", firstDirection);
  const firstReference = html.indexOf("복구 요구 참고");
  assert.ok(firstDirection < firstStrength);
  assert.ok(firstStrength < firstRecommendation);
  assert.ok(firstRecommendation < firstReference);
  assert.ok(firstReference < secondDirection);
  const secondStrength = html.indexOf("현재 단계가 분명하다.");
  const secondSelection = html.indexOf(">선택 결과<", secondDirection);
  assert.ok(secondDirection < secondStrength);
  assert.ok(secondStrength < secondSelection);
  assert.match(html, /<details class="direction-references">[\s\S]*?<summary>참고 자료 · 1<\/summary>/u);
  assert.doesNotMatch(html, /direction-reference-list|class="direction-reference"/u);
  assert.doesNotMatch(html, /design-direction-detail-list/u);
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
    validated.designDirections.options[0].references[0],
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
    goal: {
      text: "Keep <img src=x onerror=alert(1)> as text.\nKeep the second idea distinct.",
      evidenceIds: ["upload-service"],
    },
    evidence: [
      { id: "upload-service", label: "Upload service", location: "src/upload/recovery.ts" },
    ],
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
  assert.match(first, /<path d="M3 7\.5h6l2 2h10v9\.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"><\/path><path d="M3 9\.5v-3a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"><\/path>/u);
  assert.match(first, /font-family: "Hope Sans"/u);
  assert.match(first, /font-src data:/u);
  assert.match(first, /name="hope-align-design-version" content="22"/u);
  assert.match(
    first,
    /<h2 class="toc-heading"><span>목차<\/span><span class="toc-progress"><span data-toc-current>1<\/span> \/ \d+<\/span><\/h2>/u,
  );
  assert.match(first, /v1 · 현재 의도/u);
  assert.match(first, />버전 이력</u);
  assert.doesNotMatch(first, /의도 이력/u);
  assert.match(first, /aria-label="다크 모드로 전환"/u);
  assert.match(first, /class="outcome-mark" aria-hidden="true">×</u);
  assert.match(first, />기대 결과</u);
  assert.match(first, /<ol class="decision-list intent-list">/u);
  assert.match(first, /<details class="decision-disclosure intent-reason">/u);
  assert.match(
    first,
    /id="intent-title"><span class="section-number">\d{2}<\/span><span>결정된 의도<\/span><\/h2>/u,
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
    /<header class="document-head">\s*<h1 id="artifact-title">[\s\S]*?<\/h1>\s*<\/header><section class="overview document-section" id="overview" aria-labelledby="overview-title">\s*<h2 class="section-title" id="overview-title"><span class="section-number">01<\/span><span>요약<\/span><\/h2>/u,
  );
  assert.doesNotMatch(first, /artifact-title-line/u);
  assert.match(first, />결정된 의도</u);
  assert.doesNotMatch(first, />미결정 의도</u);
  assert.match(first, />AI 판단 가능</u);
  assert.match(first, />사용자 판단</u);
  assert.match(first, /<span class="intent-statement">/u);
  assert.match(first, /class="reference-marker evidence-marker" href="#evidence-upload-service"/u);
  assert.match(first, /<ol class="evidence-list"><li id="evidence-upload-service" data-evidence-entry>/u);
  assert.match(first, /id="reference-popover" popover="auto" role="dialog"/u);
  assert.match(first, /class="reference-marker verification-marker"[^>]*>\[AI\]<\/a>/u);
  assert.match(first, /class="reference-marker verification-marker"[^>]*>\[유저\]<\/a>/u);
  assert.match(first, /<details class="intent-group section-disclosure intent-verification" id="verification">/u);
  assert.doesNotMatch(first, /<details class="check-verification">/u);
  assert.match(first, /<details class="body-section document-section section-disclosure" id="evidence">/u);
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
  assert.match(first, /<script id="hope-align-data" type="application\/json">/u);
  assert.doesNotMatch(first, /target="_blank"/u);
  assert.doesNotMatch(first, /class="locale-menu"/u);
  assert.match(first, /<div class="display-controls">[\s\S]*?<button class="theme-button"/u);
  const main = first.match(/<main class="main"[^>]*>([\s\S]*?)<\/main>/u)?.[1] ?? "";
  assert.deepEqual(
    [...main.matchAll(/class="section-number">(\d{2})<\/span>/gu)].map((match) => match[1]),
    ["01", "02", "03"],
  );
  const toc = first.match(/<nav class="toc"[\s\S]*?<ol class="toc-list">([\s\S]*?)<\/ol>/u)?.[1] ?? "";
  assert.deepEqual(
    [...toc.matchAll(/class="toc-number">(\d{2})<\/span>/gu)].map((match) => match[1]),
    ["01", "02", "03"],
  );

  const withAlternateLocale = renderAlignArtifact(data, {
    alternateLocale: { href: "upload-recovery.en.html", locale: "en-US" },
    digest: "0".repeat(64),
  });
  assert.match(
    withAlternateLocale,
    /<a class="locale-option" href="upload-recovery\.en\.html" hreflang="en-US" lang="en-US">English<\/a>/u,
  );
  assert.match(withAlternateLocale, /<div class="display-controls has-locale-menu">[\s\S]*?<details class="locale-menu">[\s\S]*?<button class="theme-button"/u);
  assert.throws(
    () => renderAlignArtifact(data, {
      alternateLocale: { href: "..\/outside.html", locale: "en-US" },
      digest: "0".repeat(64),
    }),
    /alternateLocale must name a supported locale and sibling HTML file/u,
  );
});

test("evidence marker groups follow document number order", () => {
  const input = validateAlignInput(makeAlignInput({
    goal: {
      text: "근거 순서와 관계없이 번호를 읽기 쉽게 표시한다.",
      evidenceIds: ["third", "first", "second"],
    },
    evidence: [
      { id: "first", label: "첫 근거", location: "docs/first.md" },
      { id: "second", label: "둘째 근거", location: "docs/second.md" },
      { id: "third", label: "셋째 근거", location: "docs/third.md" },
    ],
  }));
  const { revisionSummary, locale, theme, schemaVersion: _schemaVersion, ...content } = input;
  const html = renderAlignArtifact({
    alignId: "11111111-1111-4111-8111-111111111111",
    createdAt: now.toISOString(),
    locale,
    repository: "acme/storage",
    revisions: [{
      agreedAt: now.toISOString(),
      content,
      number: 1,
      summary: revisionSummary,
    }],
    schemaVersion: 1,
    theme,
  }, { digest: "0".repeat(64) });
  const goal = html.match(/<dt>목표<\/dt><dd>[\s\S]*?<\/dd>/u)?.[0] ?? "";

  assert.deepEqual(
    [...goal.matchAll(/class="reference-marker evidence-marker"[^>]*>\[([0-9]+)\]<\/a>/gu)]
      .map((match) => Number(match[1])),
    [1, 2, 3],
  );
  assert.deepEqual(input.goal.evidenceIds, ["third", "first", "second"]);
});

test("renderer omits empty optional sections instead of filling the screen", () => {
  const input = validateAlignInput(makeAlignInput({
    exclusions: [],
    flow: undefined,
    evidence: undefined,
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
  assert.doesNotMatch(html, /id="flow"|id="evidence"/u);
  assert.match(html, /id="intent"/u);
  assert.match(html, /id="verification"/u);
  assert.doesNotMatch(html, /class="toc"/u);
  assert.doesNotMatch(html, />미결정 의도</u);
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
  assert.equal(inspected.content.intent.length, 3);
  assert.equal(inspected.content.exclusions.length, 3);
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

test("revise appends a current intent record to a legacy artifact", async () => {
  const root = await repository();
  const outputPath = join(root, "docs", "alignments", "upload-recovery.html");
  const created = await writeLegacyAlignArtifact({
    artifactPath: outputPath,
    content: {
      behavior: {
        ...makeLegacyAlignInputV2().behavior,
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
  assert.equal(legacy.content.intent, makeLegacyAlignInputV2().goal);
  assert.deepEqual(
    legacy.content.success,
    makeLegacyAlignInputV2().checks.map((check) => check.condition),
  );
  const revisedAt = new Date("2026-08-15T00:00:00.000Z");
  const secondInput = await inputFile(root, "second.json", makeAlignInput({
    exclusions: [
      ...makeAlignInput().exclusions,
      "복구 기간이 24시간을 지난 항목",
    ],
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
  assert.deepEqual(inspected.content.intent, makeAlignInput().intent);
  assert.match(inspected.content.exclusions.at(-1), /24시간/u);
  assert.equal(inspected.history.length, 2);
  const html = await readFile(outputPath, "utf8");
  assert.match(html, /v2 · 현재 의도/u);
  assert.match(html, /<strong>v1<\/strong>/u);
  assert.equal((html.match(/<p><bdi dir="auto">최초 합의<\/bdi><\/p>/gu) ?? []).length, 2);
  assert.match(html, /id="revision-1"/u);
  assert.match(html, /변경 내용 보기/u);
  assert.match(html, /이전 결과 전용 \(취소\)/u);
  assert.match(html, /이전 버전에서만 합의한 결과다/u);
  assert.match(html, /이전 근거 전용/u);
  assert.match(html, /docs\/previous\.md/u);
  assert.match(html, /중단 지점부터 이어서 완료할 수 있다/u);
  assert.match(html, /원본과 같은 파일을 받을 수 있는지/u);

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
    (data) => { data.revisions[0].content.exclusions = "not a list"; },
    (data) => { data.revisions[0].content.progress = 50; },
    (data) => { delete data.revisions[0].content.intent; },
    (data) => { data.revisions[0].content.intent = data.revisions[0].content.goal; },
  ];

  for (const change of invalidChanges) {
    await writeFile(outputPath, resealAlignArtifact(original, change), "utf8");
    await assert.rejects(inspectAlignArtifact(outputPath), /content|intent record/u);
  }
});

test("revision rejects an artifact that would exceed the readable size", async () => {
  const root = await repository();
  const prose = "x".repeat(3_980);
  const largeInput = makeAlignInput({
    flow: undefined,
    evidence: undefined,
    goal: prose,
    problem: prose,
    intent: Array.from({ length: 4 }, (_, index) => ({
      statement: `${prose} condition ${index}`,
      verify: `${prose} verify ${index}`,
      by: "agent",
    })),
    exclusions: Array.from({ length: 25 }, (_, index) => `${prose} excluded ${index}`),
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
