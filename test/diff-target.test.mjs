import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverGitHubPullRequest,
  parsePullRequestTargetArgument,
  resolveGitHubPullRequestNumber,
} from "../plugins/hope/skills/diff/scripts/target.mjs";

function discoveryExec({ branch = "feature", pullRequests }) {
  return async (command, arguments_) => {
    if (command === "git") return { stdout: `${branch}\n` };
    assert.equal(command, "gh");
    if (arguments_[0] === "repo") {
      return { stdout: JSON.stringify({ nameWithOwner: "example/repo" }) };
    }
    return { stdout: JSON.stringify(pullRequests) };
  };
}

test("URL-free discovery prefers the current branch pull request", async () => {
  const target = await discoverGitHubPullRequest({
    exec: discoveryExec({
      pullRequests: [
        {
          createdAt: "2026-07-23T02:00:00Z",
          headRefName: "other",
          number: 9,
          url: "https://github.com/example/repo/pull/9",
        },
        {
          createdAt: "2026-07-23T01:00:00Z",
          headRefName: "feature",
          number: 7,
          url: "https://github.com/example/repo/pull/7",
        },
      ],
    }),
  });
  assert.equal(target.number, 7);
  assert.equal(target.selection, "current-branch");
});

test("URL-free discovery falls back to the latest authored pull request", async () => {
  const target = await discoverGitHubPullRequest({
    exec: discoveryExec({
      branch: "unpublished",
      pullRequests: [
        {
          createdAt: "2026-07-22T01:00:00Z",
          headRefName: "old",
          number: 7,
          url: "https://github.com/example/repo/pull/7",
        },
        {
          createdAt: "2026-07-23T01:00:00Z",
          headRefName: "new",
          number: 9,
          url: "https://github.com/example/repo/pull/9",
        },
      ],
    }),
  });
  assert.equal(target.number, 9);
  assert.equal(target.selection, "latest-authored");
});

test("an explicit pull request number resolves in the current repository", async () => {
  const target = await resolveGitHubPullRequestNumber(123, {
    exec: discoveryExec({ pullRequests: [] }),
  });
  assert.deepEqual(target, {
    number: 123,
    owner: "example",
    repository: "repo",
    selection: "explicit-number",
    url: "https://github.com/example/repo/pull/123",
  });
  await assert.rejects(
    resolveGitHubPullRequestNumber(0, {
      exec: discoveryExec({ pullRequests: [] }),
    }),
    /positive pull request number/u,
  );
});

test("pull request target arguments fail closed at numeric boundaries", () => {
  assert.deepEqual(parsePullRequestTargetArgument("1"), {
    pullRequestNumber: 1,
    url: undefined,
  });
  assert.deepEqual(parsePullRequestTargetArgument("#123"), {
    pullRequestNumber: 123,
    url: undefined,
  });
  assert.deepEqual(
    parsePullRequestTargetArgument(String(Number.MAX_SAFE_INTEGER)),
    {
      pullRequestNumber: Number.MAX_SAFE_INTEGER,
      url: undefined,
    },
  );
  for (const value of [
    "0",
    "#0",
    "-1",
    "+1",
    "1.2",
    "01",
    "#abc",
    String(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
  ]) {
    assert.throws(
      () => parsePullRequestTargetArgument(value),
      /pull request number|GitHub pull request URL/u,
      value,
    );
  }
  assert.deepEqual(
    parsePullRequestTargetArgument("https://github.com/example/repo/pull/7"),
    { url: "https://github.com/example/repo/pull/7" },
  );
});
