import assert from "node:assert/strict";

/** A fake gh for one pull request: example/repo#1 at base a…, head b…, merge base c…. */
export function response(value) {
  return { stdout: JSON.stringify(value) };
}

export function fakeGitHub({
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
