import assert from "node:assert/strict";
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
  const firstInput = await inputFile(root, "first.json", makeAlignInput({
    behavior: {
      ...makeAlignInput().behavior,
      outcomes: [{
        title: "이전 결과 전용",
        detail: "이전 리비전에서만 합의한 결과다.",
        kind: "cancel",
      }],
    },
    evidence: [{ label: "이전 근거 전용", location: "docs/previous.md" }],
  }));
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
  assert.match(html, /이전 결과 전용 \(취소\)/u);
  assert.match(html, /이전 리비전에서만 합의한 결과다/u);
  assert.match(html, /이전 근거 전용/u);
  assert.match(html, /docs\/previous\.md/u);

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

test("revision rejects an artifact that would exceed the readable size", async () => {
  const root = await repository();
  const prose = "x".repeat(4_000);
  const largeInput = makeAlignInput({
    behavior: undefined,
    decisions: [],
    evidence: undefined,
    intent: prose,
    problem: prose,
    success: Array.from({ length: 4 }, () => prose),
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

  for (let attempt = 0; attempt < 12; attempt += 1) {
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
      assert.match(error.message, /exceeds 4194304 bytes/u);
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
