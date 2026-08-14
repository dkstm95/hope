import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";
import { promisify } from "node:util";

import {
  createAlignArtifact,
  inspectAlignArtifact,
  reviseAlignArtifact,
  validateAlignInput,
  verifyAlignHtml,
} from "../plugins/hope/skills/align/scripts/artifact.mjs";
import { renderAlignArtifact } from "../plugins/hope/skills/align/scripts/render.mjs";
import { makeAlignInput } from "../test-support/align-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const execFileAsync = promisify(execFile);
const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const now = new Date("2026-08-14T00:00:00.000Z");

async function repository() {
  const root = await createTestTemporaryDirectory("hope-align-test-");
  await execFileAsync("git", ["init", "-q", root]);
  await execFileAsync("git", ["-C", root, "remote", "add", "origin", "git@github.com:acme/storage.git"]);
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
    () => validateAlignInput({ ...makeAlignInput(), success: [] }),
    /must not be empty/u,
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
});

test("renderer is deterministic, self-contained, and keeps authored text inert", () => {
  const input = validateAlignInput(makeAlignInput({
    title: '</title><script src="https://evil.example/x.js"></script>',
    intent: "Keep <img src=x onerror=alert(1)> as text.",
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
  assert.match(first, /name="hope-align-design-version" content="2"/u);
  assert.match(first, /r1 · 현재 합의/u);
  assert.match(first, /aria-label="다크 모드로 전환"/u);
  assert.match(first, /class="outcome-mark" aria-hidden="true">×</u);
  assert.match(first, /class="behavior-connector"/u);
  assert.match(first, /<ol class="decision-list">/u);
  assert.match(first, />결정과 구현 선택</u);
  assert.doesNotMatch(first, /id="intent-history"/u);
  assert.match(first, /prefers-color-scheme: dark/u);
  assert.match(first, /@media print/u);
  assert.match(first, /Content-Security-Policy/u);
  assert.match(first, /default-src &#39;none&#39;|default-src 'none'/u);
  assert.match(first, /&lt;script src=/u);
  assert.match(first, /&lt;img src=x onerror=alert\(1\)&gt;/u);
  assert.doesNotMatch(first, /<script src="https:\/\/evil/u);
  assert.doesNotMatch(first, /localStorage/u);
  assert.doesNotMatch(first, /현재 구현 기준|구현 계약/u);
  assert.match(first, /<script id="hope-align-data" type="application\/json">/u);
  assert.doesNotMatch(first, /target="_blank"/u);
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
  assert.match(decisionHtml, /agreement-grid agreement-grid-single/u);
  assert.doesNotMatch(decisionHtml, />구현 중 선택</u);
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

test("revise appends intent in the same artifact and rejects stale or edited state", async () => {
  const root = await repository();
  const firstInput = await inputFile(root, "first.json", makeAlignInput());
  const outputPath = join(root, "docs", "alignments", "upload-recovery.html");
  const created = await createAlignArtifact(
    { inputPath: firstInput, outputPath, root },
    { now: () => now, randomUUID: () => "11111111-1111-4111-8111-111111111111" },
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
  assert.equal(
    inspected.content.boundary,
    "복구 기간은 24시간이며 만료된 항목은 복구하지 않는다.",
  );
  assert.equal(inspected.history.length, 2);
  const html = await readFile(outputPath, "utf8");
  assert.match(html, /r2 · 현재 합의/u);
  assert.match(html, /id="revision-1"/u);
  assert.match(html, /변경 내용 보기/u);

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
