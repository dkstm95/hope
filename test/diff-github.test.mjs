import assert from "node:assert/strict";
import test from "node:test";

import {
  collectGitHubPullRequest,
  parseGitHubPullRequestUrl,
  revalidateGitHubSnapshot,
} from "../plugins/hope/skills/diff/scripts/github.mjs";
import { LIMITS } from "../plugins/hope/skills/diff/scripts/constants.mjs";

function response(value) {
  return { stdout: JSON.stringify(value) };
}

function smallChangedFiles(count) {
  return Array.from({ length: count }, (_, index) => ({
    additions: 1,
    deletions: 1,
    filename: `src/generated/file-${index + 1}.js`,
    patch: "@@ -1 +1 @@\n-old\n+new",
    status: "modified",
  }));
}

function fakeGitHub({
  afterContent = "new",
  beforeContent = "old",
  body = "Keep the real error.",
  commitMessage = "Keep the error\n\nBody",
  contentSize,
  headFullName = "example/repo",
  incompletePatch = false,
  missingFiles = false,
  providerFile,
  providerFiles,
  secretFile = false,
  title = "Keep the error",
} = {}) {
  const changedFile = providerFile ?? {
    additions: 1,
    deletions: 1,
    filename: secretFile ? ".env" : "src/error.js",
    patch: incompletePatch ? undefined : "@@ -1 +1 @@\n-old\n+new",
    status: "modified",
  };
  const changedFiles = providerFiles ?? [changedFile];
  return async (command, arguments_) => {
    assert.equal(command, "gh");
    assert.deepEqual(arguments_.slice(0, 3), ["api", "--hostname", "github.com"]);
    const path = arguments_.at(-1);
    if (path === "/repos/example/repo/pulls/1") {
      return response({
        additions: changedFiles.reduce((sum, file) => sum + file.additions, 0),
        base: {
          repo: { full_name: "example/repo" },
          sha: "a".repeat(40),
        },
        body,
        changed_files: changedFiles.length,
        commits: 1,
        deletions: changedFiles.reduce((sum, file) => sum + file.deletions, 0),
        head: {
          repo: { full_name: headFullName },
          sha: "b".repeat(40),
        },
        number: 1,
        state: "open",
        title,
        user: { login: "octocat" },
      });
    }
    if (path.includes("/compare/")) {
      return response({ merge_base_commit: { sha: "c".repeat(40) } });
    }
    if (path.includes("/pulls/1/files?")) {
      const page = Number.parseInt(
        new URL(path, "https://github.com").searchParams.get("page") ?? "1",
        10,
      );
      const values = missingFiles ? [] : changedFiles;
      return response(values.slice((page - 1) * 100, page * 100));
    }
    if (path.includes("/pulls/1/commits?")) {
      return response([{
        commit: { message: commitMessage },
        sha: "b".repeat(40),
      }]);
    }
    if (path.includes("/contents/")) {
      const text = path.endsWith(`ref=${"c".repeat(40)}`)
        ? beforeContent
        : afterContent;
      return response({
        content: Buffer.from(text).toString("base64"),
        encoding: "base64",
        size: contentSize ?? Buffer.byteLength(text),
        type: "file",
      });
    }
    throw new Error(`Unexpected GitHub path: ${path}`);
  };
}

test("GitHub URL parsing is canonical and rejects lookalikes", () => {
  assert.deepEqual(
    parseGitHubPullRequestUrl("https://github.com/example/repo/pull/1"),
    {
      number: 1,
      owner: "example",
      repository: "repo",
      url: "https://github.com/example/repo/pull/1",
    },
  );
  assert.throws(
    () => parseGitHubPullRequestUrl("https://evil.example/example/repo/pull/1"),
    /canonical/u,
  );
  assert.throws(
    () => parseGitHubPullRequestUrl("https://github.com/example/repo/pull/1?diff=1"),
    /canonical/u,
  );
  assert.throws(
    () => parseGitHubPullRequestUrl(
      `https://github.com/example/repo/pull/${BigInt(Number.MAX_SAFE_INTEGER) + 1n}`,
    ),
    /safe positive/u,
  );
});

test("GitHub collection binds the exact snapshot and all changed files", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      clock: () => new Date("2026-07-23T00:00:00.000Z"),
      gh: fakeGitHub(),
      locale: "en-US",
      localeSource: "override",
      theme: "system",
      themeSource: "default",
    },
  );
  assert.equal(snapshot.files.length, 1);
  assert.equal(snapshot.files[0].bodyState, "included");
  assert.equal(snapshot.files[0].sourceIds.length, 1);
  assert.equal(snapshot.snapshot.mergeBase, "c".repeat(40));
  assert.deepEqual(snapshot.repository.base, {
    name: "repo",
    owner: "example",
  });
  assert.deepEqual(snapshot.repository.head, {
    name: "repo",
    owner: "example",
  });
  assert.match(snapshot.digest, /^[a-f0-9]{64}$/u);
});

test("GitHub collection accepts 500 small changed files", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: fakeGitHub({ providerFiles: smallChangedFiles(500) }),
      locale: "en-US",
      theme: "system",
    },
  );

  assert.equal(snapshot.files.length, 500);
  assert.equal(snapshot.sources.filter((source) => source.kind === "patch").length, 500);
});

test("GitHub collection rejects 501 changed files before pagination", async () => {
  const requests = [];
  const github = fakeGitHub({ providerFiles: smallChangedFiles(501) });

  await assert.rejects(
    collectGitHubPullRequest(
      "https://github.com/example/repo/pull/1",
      {
        gh: async (command, arguments_) => {
          requests.push(arguments_.at(-1));
          return await github(command, arguments_);
        },
        locale: "en-US",
        theme: "system",
      },
    ),
    /has 501 files; Hope supports 500/u,
  );
  assert.deepEqual(requests, ["/repos/example/repo/pulls/1"]);
});

test("GitHub collection preserves a fork head repository identity", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: fakeGitHub({ headFullName: "contributor/repo-fork" }),
      locale: "en-US",
      theme: "system",
    },
  );

  assert.deepEqual(snapshot.repository.head, {
    name: "repo-fork",
    owner: "contributor",
  });
  assert.deepEqual(snapshot.repository.base, {
    name: "repo",
    owner: "example",
  });
});

test("ordinary pull request metadata becomes model sources", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: fakeGitHub({
        body: "A safe description.",
        commitMessage: "A safe commit title\n\nDetails",
        title: "A safe pull request title",
      }),
      locale: "en-US",
      theme: "system",
    },
  );

  assert.deepEqual(
    snapshot.sources
      .filter((item) => [
        "pull-request-title",
        "pull-request-description",
        "commit-title",
      ].includes(item.kind))
      .map((item) => [item.kind, item.text]),
    [
      ["pull-request-title", "A safe pull request title"],
      ["pull-request-description", "A safe description."],
      ["commit-title", "A safe commit title"],
    ],
  );
});

for (const [metadataKind, githubOptions] of [
  ["title", { title: "Rotate ghp_AAAAAAAAAAAAAAAAAAAAAAAA now" }],
  ["body", { body: "Leaked github_pat_AAAAAAAAAAAAAAAAAAAAAAAA" }],
  ["commit title", { commitMessage: "Remove sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA\n\nDetails" }],
]) {
  test(`a suspected credential in the pull request ${metadataKind} fails closed`, async () => {
    let error;
    try {
      await collectGitHubPullRequest(
        "https://github.com/example/repo/pull/1",
        {
          gh: fakeGitHub(githubOptions),
          locale: "en-US",
          theme: "system",
        },
      );
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof Error);
    assert.equal(
      error.message,
      "GitHub pull request metadata contains a suspected credential; "
        + "Hope did not create a review.",
    );
    assert.doesNotMatch(error.message, /ghp_|github_pat_|sk-proj-/u);
  });
}

test("a complete patch does not fetch full changed files", async () => {
  const seen = [];
  const github = fakeGitHub();
  await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: async (command, arguments_) => {
        seen.push(arguments_.at(-1));
        return await github(command, arguments_);
      },
      locale: "en-US",
      theme: "system",
    },
  );
  assert.equal(seen.some((path) => path.includes("/contents/")), false);
});

test("an incomplete patch falls back to exact before and after files", async () => {
  const seen = [];
  const github = fakeGitHub({ incompletePatch: true });
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: async (command, arguments_) => {
        seen.push(arguments_.at(-1));
        return await github(command, arguments_);
      },
      locale: "en-US",
      theme: "system",
    },
  );
  const contentRequests = seen.filter((path) => path.includes("/contents/"));
  assert.deepEqual(
    [...contentRequests].sort(),
    [
      `/repos/example/repo/contents/src/error.js?ref=${"b".repeat(40)}`,
      `/repos/example/repo/contents/src/error.js?ref=${"c".repeat(40)}`,
    ].sort(),
  );
  assert.equal(snapshot.files[0].sourceIds.length, 2);
  const beforeSource = snapshot.sources.find((source) => source.kind === "before-file");
  const afterSource = snapshot.sources.find((source) => source.kind === "after-file");
  assert.equal(beforeSource.revision, "c".repeat(40));
  assert.equal(beforeSource.text, "old");
  assert.equal(afterSource.revision, "b".repeat(40));
  assert.equal(afterSource.text, "new");
});

test("independent GitHub collection requests start concurrently", async () => {
  const github = fakeGitHub();
  const started = new Set();
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const gh = async (command, arguments_) => {
    const path = arguments_.at(-1);
    const kind = path.includes("/compare/")
      ? "compare"
      : path.includes("/files?")
        ? "files"
        : path.includes("/commits?")
          ? "commits"
          : undefined;
    if (kind) {
      started.add(kind);
      if (started.size === 3) release();
      await barrier;
    }
    return await github(command, arguments_);
  };

  await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    { gh, locale: "en-US", theme: "system" },
  );
  assert.deepEqual([...started].sort(), ["commits", "compare", "files"]);
});

test("fallback before and after bodies are fetched concurrently", async () => {
  const github = fakeGitHub({ incompletePatch: true });
  let contentRequests = 0;
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const gh = async (command, arguments_) => {
    const path = arguments_.at(-1);
    if (path.includes("/contents/")) {
      contentRequests += 1;
      if (contentRequests === 2) release();
      await barrier;
    }
    return await github(command, arguments_);
  };

  await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    { gh, locale: "en-US", theme: "system" },
  );
  assert.equal(contentRequests, 2);
});

test("a provider file without text changes stays metadata-only without a body request", async () => {
  const seen = [];
  const github = fakeGitHub({
    providerFile: {
      additions: 0,
      deletions: 0,
      filename: "design/fonts/HopeCode.woff2",
      status: "added",
    },
  });
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: async (command, arguments_) => {
        seen.push(arguments_.at(-1));
        return await github(command, arguments_);
      },
      locale: "en-US",
      theme: "system",
    },
  );

  assert.equal(seen.some((path) => path.includes("/contents/")), false);
  assert.equal(snapshot.files[0].bodyState, "metadata-only");
  assert.equal(snapshot.files[0].bodyReasonKind, "no-text-diff");
  assert.equal(snapshot.limits.at(-1).reasonKind, "no-text-diff");
});

test("an oversized safe-text body becomes a visible metadata-only limit", async () => {
  const seen = [];
  const github = fakeGitHub({
    contentSize: 300_000,
    providerFile: {
      additions: 4_000,
      deletions: 0,
      filename: "dist/generated-bundle.js",
      status: "added",
    },
  });
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: async (command, arguments_) => {
        seen.push(arguments_.at(-1));
        return await github(command, arguments_);
      },
      locale: "en-US",
      theme: "system",
    },
  );

  assert.equal(seen.filter((path) => path.includes("/contents/")).length, 1);
  assert.equal(snapshot.files[0].bodyState, "metadata-only");
  assert.equal(snapshot.files[0].bodyReasonKind, "safe-size-limit");
  assert.equal(snapshot.limits.at(-1).reasonKind, "safe-size-limit");
});

for (const [side, providerFile, sourceKind, revision] of [
  [
    "before",
    {
      additions: 0,
      deletions: 1,
      filename: "src/error.js",
      status: "removed",
    },
    "before-file",
    "c".repeat(40),
  ],
  [
    "after",
    {
      additions: 1,
      deletions: 0,
      filename: "src/error.js",
      status: "added",
    },
    "after-file",
    "b".repeat(40),
  ],
]) {
  test(`the ${side} fallback body at the safe-text boundary remains included`, async () => {
    const snapshot = await collectGitHubPullRequest(
      "https://github.com/example/repo/pull/1",
      {
        gh: fakeGitHub({
          afterContent: "n".repeat(LIMITS.safeBodyBytes),
          beforeContent: "o".repeat(LIMITS.safeBodyBytes),
          providerFile,
        }),
        locale: "en-US",
        theme: "system",
      },
    );

    assert.equal(snapshot.files[0].bodyState, "included");
    assert.equal(snapshot.files[0].sourceIds.length, 1);
    const fileSource = snapshot.sources.find((source) => source.kind === sourceKind);
    assert.equal(fileSource.revision, revision);
  });
}

test("fallback bodies at the combined safe-text boundary remain included", async () => {
  const halfLimit = LIMITS.safeBodyBytes / 2;
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: fakeGitHub({
        afterContent: "n".repeat(halfLimit),
        beforeContent: "o".repeat(halfLimit),
        incompletePatch: true,
      }),
      locale: "en-US",
      theme: "system",
    },
  );

  assert.equal(snapshot.files[0].bodyState, "included");
  assert.equal(snapshot.files[0].sourceIds.length, 2);
});

test("fallback bodies over the combined safe-text limit become metadata-only", async () => {
  const halfLimit = LIMITS.safeBodyBytes / 2;
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: fakeGitHub({
        afterContent: "n".repeat(halfLimit + 1),
        beforeContent: "o".repeat(halfLimit),
        incompletePatch: true,
      }),
      locale: "en-US",
      theme: "system",
    },
  );

  assert.equal(snapshot.files[0].bodyState, "metadata-only");
  assert.deepEqual(snapshot.files[0].sourceIds, []);
  assert.equal(snapshot.files[0].bodyReasonKind, "safe-size-limit");
  assert.equal(snapshot.limits.at(-1).reasonKind, "safe-size-limit");
});

test("fallback body redaction takes precedence over the combined safe-text limit", async () => {
  const halfLimit = LIMITS.safeBodyBytes / 2;
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: fakeGitHub({
        afterContent: "n".repeat(halfLimit),
        beforeContent: `${"o".repeat(halfLimit)} ghp_${"A".repeat(24)}`,
        incompletePatch: true,
      }),
      locale: "en-US",
      theme: "system",
    },
  );

  assert.equal(snapshot.files[0].bodyState, "redacted");
  assert.deepEqual(snapshot.files[0].sourceIds, []);
  assert.equal(snapshot.files[0].bodyReasonKind, "credential-pattern");
  assert.equal(snapshot.limits.at(-1).reasonKind, "credential-pattern");
});

test("fallback metadata-only bodies still enforce the global safe-text limit", async () => {
  const halfLimit = LIMITS.safeBodyBytes / 2;
  const providerFiles = Array.from({ length: 3 }, (_, index) => ({
    additions: 1,
    deletions: 1,
    filename: `src/error-${index + 1}.js`,
    status: "modified",
  }));

  await assert.rejects(
    collectGitHubPullRequest(
      "https://github.com/example/repo/pull/1",
      {
        gh: fakeGitHub({
          afterContent: "n".repeat(halfLimit + 1),
          beforeContent: "o".repeat(halfLimit),
          providerFiles,
        }),
        locale: "en-US",
        theme: "system",
      },
    ),
    new RegExp(`${LIMITS.safeBodyTotalBytes}-byte limit`, "u"),
  );
});

test("a private path is redacted before Hope fetches its body", async () => {
  const seen = [];
  const github = fakeGitHub({ secretFile: true });
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    {
      gh: async (command, arguments_) => {
        seen.push(arguments_.at(-1));
        return await github(command, arguments_);
      },
      locale: "en-US",
      theme: "system",
    },
  );
  assert.equal(seen.some((path) => path.includes("/contents/")), false);
  assert.equal(snapshot.files[0].bodyState, "redacted");
  assert.deepEqual(snapshot.files[0].sourceIds, []);
  assert.equal(snapshot.limits.length, 3);
  assert.equal(snapshot.limits[2].reasonKind, "private-path");
});

test("GitHub collection fails when pagination is incomplete", async () => {
  await assert.rejects(
    collectGitHubPullRequest(
      "https://github.com/example/repo/pull/1",
      {
        gh: fakeGitHub({ missingFiles: true }),
        locale: "en-US",
        theme: "system",
      },
    ),
    /reported 1 items but Hope collected 0/u,
  );
});

test("provider control characters stay inert without changing line coordinates", async () => {
  const base = fakeGitHub();
  const gh = async (command, arguments_) => {
    const path = arguments_.at(-1);
    if (path.includes("/pulls/1/files?")) {
      return response([{
        additions: 1,
        deletions: 1,
        filename: "src/control.js",
        patch: "@@ -1 +1 @@\n-old\n+safe\u001bunsafe\u202Ehidden",
        status: "modified",
      }]);
    }
    return await base(command, arguments_);
  };
  const snapshot = await collectGitHubPullRequest(
    parseGitHubPullRequestUrl("https://github.com/example/repo/pull/1"),
    {
      gh,
      locale: "en-US",
      localeSource: "override",
      theme: "system",
      themeSource: "default",
    },
  );
  const source = snapshot.sources.find((item) => item.kind === "patch");

  assert.match(source.text, /safe\uFFFDunsafe/u);
  assert.match(source.text, /\\u202Ehidden/u);
  assert.doesNotMatch(source.text, /\u202E/u);
  assert.equal(source.lineCount, 3);
});

test("revalidation confirms an unchanged exact snapshot", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    { gh: fakeGitHub(), locale: "en-US", theme: "system" },
  );

  const result = await revalidateGitHubSnapshot(snapshot, {
    clock: () => new Date("2026-07-23T00:01:00.000Z"),
    gh: fakeGitHub(),
  });

  assert.deepEqual(result, {
    current: {
      base: "a".repeat(40),
      head: "b".repeat(40),
      mergeBase: "c".repeat(40),
    },
    matches: true,
    revalidatedAt: "2026-07-23T00:01:00.000Z",
  });
});

test("revalidation detects a changed merge base", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    { gh: fakeGitHub(), locale: "en-US", theme: "system" },
  );
  const github = fakeGitHub();
  const changedMergeBase = "d".repeat(40);
  const gh = async (command, arguments_) => {
    const path = arguments_.at(-1);
    if (path.includes("/compare/")) {
      return response({ merge_base_commit: { sha: changedMergeBase } });
    }
    return await github(command, arguments_);
  };

  const result = await revalidateGitHubSnapshot(snapshot, { gh });

  assert.deepEqual(result.current, {
    base: snapshot.snapshot.base,
    head: snapshot.snapshot.head,
    mergeBase: changedMergeBase,
  });
  assert.equal(result.matches, false);
});

test("revalidation skips the comparison after the base or head changes", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    { gh: fakeGitHub(), locale: "en-US", theme: "system" },
  );
  const github = fakeGitHub();
  let compareRequests = 0;
  const gh = async (command, arguments_) => {
    const path = arguments_.at(-1);
    if (path.includes("/compare/")) compareRequests += 1;
    const result = await github(command, arguments_);
    if (path === "/repos/example/repo/pulls/1") {
      const pull = JSON.parse(result.stdout);
      pull.head.sha = "d".repeat(40);
      return response(pull);
    }
    return result;
  };

  const result = await revalidateGitHubSnapshot(snapshot, { gh });
  assert.equal(result.matches, false);
  assert.equal(result.current.head, "d".repeat(40));
  assert.equal(result.current.mergeBase, undefined);
  assert.equal(compareRequests, 0);
});

test("revalidation rejects a malformed comparison instead of reporting staleness", async () => {
  const snapshot = await collectGitHubPullRequest(
    "https://github.com/example/repo/pull/1",
    { gh: fakeGitHub(), locale: "en-US", theme: "system" },
  );
  const github = fakeGitHub();
  const gh = async (command, arguments_) => {
    const path = arguments_.at(-1);
    if (path.includes("/compare/")) return response({});
    return await github(command, arguments_);
  };

  await assert.rejects(
    revalidateGitHubSnapshot(snapshot, { gh }),
    /invalid comparison during revalidation/u,
  );
});
