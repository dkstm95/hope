import assert from "node:assert/strict";
import test from "node:test";

import { LIMITS } from "../plugins/hope/skills/diff/scripts/constants.mjs";
import { collectGitHubContext } from "../plugins/hope/skills/diff/scripts/context.mjs";

function snapshot() {
  return {
    repository: {
      base: {
        name: "repo",
        owner: "example",
      },
      head: {
        name: "repo-fork",
        owner: "contributor",
      },
      name: "repo",
      owner: "example",
      provider: "github",
    },
    snapshot: {
      base: "a".repeat(40),
      head: "b".repeat(40),
      mergeBase: "c".repeat(40),
    },
  };
}

function response(value) {
  return { stdout: JSON.stringify(value) };
}

function contentResponse(value, { size, type = "file" } = {}) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return response({
    content: bytes.toString("base64"),
    encoding: "base64",
    size: size ?? bytes.length,
    type,
  });
}

function boundedLines(character, bytes) {
  assert.equal(bytes % 4096, 0);
  return `${character.repeat(4095)}\n`.repeat(bytes / 4096);
}

function fakeGitHub({
  content = "context",
  contentByPath = new Map(),
  size,
  type,
} = {}) {
  const seen = [];
  const gh = async (command, arguments_) => {
    assert.equal(command, "gh");
    const path = arguments_.at(-1);
    seen.push(path);
    const repositoryPath = decodeURIComponent(
      path.match(/\/contents\/(.+)\?ref=/u)?.[1] ?? "",
    );
    const value = contentByPath.get(repositoryPath) ?? content;
    return contentResponse(value, { size, type });
  };
  return { gh, seen };
}

test("context collection binds head and merge-base requests to exact revisions", async () => {
  const original = snapshot();
  const before = JSON.stringify(original);
  const github = fakeGitHub({
    contentByPath: new Map([
      ["src/caller.js", "caller"],
      ["src/type.js", "type"],
    ]),
  });

  const result = await collectGitHubContext(
    original,
    [
      { path: "src/caller.js", revision: "head" },
      { path: "src/type.js", revision: "merge-base" },
    ],
    { gh: github.gh },
  );

  assert.deepEqual(github.seen, [
    `/repos/contributor/repo-fork/contents/src/caller.js?ref=${"b".repeat(40)}`,
    `/repos/example/repo/contents/src/type.js?ref=${"c".repeat(40)}`,
  ]);
  assert.deepEqual(result, [
    {
      kind: "context-file",
      path: "src/caller.js",
      revision: "b".repeat(40),
      text: "caller",
    },
    {
      kind: "context-file",
      path: "src/type.js",
      revision: "c".repeat(40),
      text: "type",
    },
  ]);
  assert.equal(JSON.stringify(original), before);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.every(Object.isFrozen), true);
});

test("the same path may be requested at both exact revisions", async () => {
  const github = fakeGitHub();
  const result = await collectGitHubContext(
    snapshot(),
    [
      { path: "src/shared.js", revision: "head" },
      { path: "src/shared.js", revision: "merge-base" },
    ],
    { gh: github.gh },
  );

  assert.equal(result.length, 2);
  assert.notEqual(result[0].revision, result[1].revision);
});

test("duplicate context requests fail before collection", async () => {
  const github = fakeGitHub();
  await assert.rejects(
    collectGitHubContext(
      snapshot(),
      [
        { path: "src/caller.js", revision: "head" },
        { path: "src/caller.js", revision: "head" },
      ],
      { gh: github.gh },
    ),
    /must be unique/u,
  );
  assert.deepEqual(github.seen, []);
});

for (const path of [
  "/etc/passwd",
  "C:/Windows/system.ini",
  "C:Windows/system.ini",
  "../secret",
  "src/../secret",
  "src//caller.js",
  "src\\caller.js",
  "src/\u202Ecaller.js",
]) {
  test(`unsafe context path ${JSON.stringify(path)} fails before collection`, async () => {
    const github = fakeGitHub();
    await assert.rejects(
      collectGitHubContext(
        snapshot(),
        [{ path, revision: "head" }],
        { gh: github.gh },
      ),
      /repository-relative path/u,
    );
    assert.deepEqual(github.seen, []);
  });
}

test("more than twelve context requests fail before collection", async () => {
  const github = fakeGitHub();
  await assert.rejects(
    collectGitHubContext(
      snapshot(),
      Array.from({ length: 13 }, (_, index) => ({
        path: `src/context-${index}.js`,
        revision: "head",
      })),
      { gh: github.gh },
    ),
    /supports 12 requests/u,
  );
  assert.deepEqual(github.seen, []);
});

test("a private context path becomes unavailable without fetching its body", async () => {
  const github = fakeGitHub();
  const result = await collectGitHubContext(
    snapshot(),
    [{ path: "config/.env", revision: "head" }],
    { gh: github.gh },
  );

  assert.deepEqual(github.seen, []);
  assert.equal(result[0].kind, "context-unavailable");
  assert.equal(result[0].reasonKind, "private-path");
});

test("a credential-bearing context body becomes unavailable", async () => {
  const github = fakeGitHub({ content: `ghp_${"A".repeat(24)}` });
  const result = await collectGitHubContext(
    snapshot(),
    [{ path: "src/caller.js", revision: "head" }],
    { gh: github.gh },
  );

  assert.equal(result[0].kind, "context-unavailable");
  assert.equal(result[0].reasonKind, "credential-pattern");
  assert.equal(Object.hasOwn(result[0], "text"), false);
});

test("binary and special context bodies become unavailable", async () => {
  const binary = fakeGitHub({ content: Buffer.from([0xff]) });
  const binaryResult = await collectGitHubContext(
    snapshot(),
    [{ path: "src/binary.dat", revision: "head" }],
    { gh: binary.gh },
  );
  assert.equal(binaryResult[0].reasonKind, "invalid-text");

  const special = fakeGitHub({ type: "symlink" });
  const specialResult = await collectGitHubContext(
    snapshot(),
    [{ path: "src/link.js", revision: "head" }],
    { gh: special.gh },
  );
  assert.equal(specialResult[0].reasonKind, "special-entry");
});

test("context bodies enforce the per-file size boundary", async () => {
  const atLimit = fakeGitHub({
    content: boundedLines("a", LIMITS.safeBodyBytes),
  });
  const included = await collectGitHubContext(
    snapshot(),
    [{ path: "src/large.js", revision: "head" }],
    { gh: atLimit.gh },
  );
  assert.equal(included[0].kind, "context-file");
  assert.equal(Buffer.byteLength(included[0].text), LIMITS.safeBodyBytes);

  const overLimit = fakeGitHub({
    content: "",
    size: LIMITS.safeBodyBytes + 1,
  });
  const unavailable = await collectGitHubContext(
    snapshot(),
    [{ path: "src/too-large.js", revision: "head" }],
    { gh: overLimit.gh },
  );
  assert.equal(unavailable[0].kind, "context-unavailable");
  assert.equal(unavailable[0].reasonKind, "safe-size-limit");
});

test("a context line too long for inspection becomes an explicit limit", async () => {
  const github = fakeGitHub({ content: "a".repeat(15_000) });
  const result = await collectGitHubContext(
    snapshot(),
    [{ path: "dist/generated.js", revision: "head" }],
    { gh: github.gh },
  );

  assert.equal(result[0].kind, "context-unavailable");
  assert.equal(result[0].reasonKind, "inspection-line-limit");
  assert.equal(Object.hasOwn(result[0], "text"), false);
});

test("a missing context path at the exact revision becomes an explicit limit", async () => {
  const gh = async () => {
    const error = new Error("request failed");
    error.code = 1;
    error.stderr = "gh: Not Found (HTTP 404)\n";
    throw error;
  };
  const result = await collectGitHubContext(
    snapshot(),
    [{ path: "src/removed.js", revision: "merge-base" }],
    { gh },
  );

  assert.equal(result[0].kind, "context-unavailable");
  assert.equal(result[0].reasonKind, "not-found");
});

test("context authentication and transport failures remain fatal", async () => {
  const gh = async () => {
    const error = new Error("request failed");
    error.code = 1;
    error.stderr = "gh: authentication failed (HTTP 401)\n";
    throw error;
  };
  await assert.rejects(
    collectGitHubContext(
      snapshot(),
      [{ path: "src/caller.js", revision: "head" }],
      { gh },
    ),
    /GitHub collection failed/u,
  );
});

test("context sources enforce the total text boundary without aborting", async () => {
  const quarter = LIMITS.contextBodyTotalBytes / 4;
  const contentByPath = new Map([
    ["src/one.js", boundedLines("a", quarter)],
    ["src/two.js", boundedLines("b", quarter)],
    ["src/three.js", boundedLines("c", quarter)],
    ["src/four.js", boundedLines("d", quarter)],
    ["src/five.js", "e"],
  ]);
  const github = fakeGitHub({ contentByPath });
  const atLimit = await collectGitHubContext(
    snapshot(),
    [...contentByPath.keys()].slice(0, 4).map((path) => ({
      path,
      revision: "head",
    })),
    { gh: github.gh },
  );
  assert.equal(atLimit.every((candidate) => candidate.kind === "context-file"), true);
  assert.equal(
    atLimit.reduce((sum, candidate) => sum + Buffer.byteLength(candidate.text), 0),
    LIMITS.contextBodyTotalBytes,
  );

  const overLimit = await collectGitHubContext(
    snapshot(),
    [...contentByPath.keys()].map((path) => ({ path, revision: "head" })),
    { gh: github.gh },
  );
  assert.equal(overLimit.slice(0, 4).every((candidate) => (
    candidate.kind === "context-file"
  )), true);
  assert.equal(overLimit[4].kind, "context-unavailable");
  assert.equal(overLimit[4].reasonKind, "safe-total-limit");

  const laterRound = await collectGitHubContext(
    snapshot(),
    [{ path: "src/five.js", revision: "head" }],
    {
      existingBytes: LIMITS.contextBodyTotalBytes,
      gh: github.gh,
    },
  );
  assert.equal(laterRound[0].kind, "context-unavailable");
  assert.equal(laterRound[0].reasonKind, "safe-total-limit");
});
