import { collectPullRequest } from "../plugins/hope/skills/diff-deep/scripts/github.mjs";

export const target = "https://github.com/example/session/pull/42";
export const head = "b".repeat(40);
export const base = "a".repeat(40);
export const mergeBase = "c".repeat(40);
export const providerFiles = [
  { filename: "src/session.ts", status: "modified", additions: 2, deletions: 2,
    patch: "@@ -1,5 +1,5 @@\n export function valid(exp, now) {\n-  return exp >= now;\n+  return exp > now;\n }\n-export const label = 'active';\n+export const label = 'unexpired';\n // session boundary" },
  { filename: "test/session.test.ts", status: "added", additions: 2, deletions: 0,
    patch: "@@ -0,0 +1,2 @@\n+expect(valid(100, 100)).toBe(false);\n+expect(valid(101, 100)).toBe(true);" },
  { filename: "docs/session.md", previous_filename: "docs/token.md", status: "renamed", additions: 0, deletions: 0 },
  { filename: "assets/session.png", status: "modified", additions: 0, deletions: 0 },
];

export function provider({ files = providerFiles, body = "Reject a session from the instant it expires. This includes equality at the boundary.", mutate, content = {} } = {}) {
  const calls = [];
  let pullReads = 0;
  const pull = { number: 42, title: "Reject expired sessions at the boundary", body,
    base: { sha: base, repo: { full_name: "example/session" } },
    head: { sha: head, repo: { full_name: "contributor/session" } },
    changed_files: files.length, additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0) };
  return { calls, exec: async (name, args, options) => {
    if (name !== "gh" || options.shell !== false) throw new Error("Unexpected executable");
    const path = args.at(-1); calls.push(path);
    let value;
    if (path === "/repos/example/session/pulls/42") {
      value = structuredClone(pull); pullReads += 1;
      if (pullReads > 1) mutate?.(value);
    } else if (path.includes("/files?")) {
      const page = Number(path.match(/page=(\d+)$/u)[1]);
      value = files.slice((page - 1) * 100, page * 100);
    } else if (path.includes("/compare/")) value = { merge_base_commit: { sha: mergeBase } };
    else if (Object.hasOwn(content, path)) {
      const bytes = Buffer.from(content[path]);
      value = { type: "file", encoding: "base64", size: bytes.length, content: bytes.toString("base64") };
    } else throw new Error(`Unexpected request ${path}`);
    return { stdout: JSON.stringify(value) };
  } };
}

export async function fixture(options) {
  return await collectPullRequest(target, { ...provider(options), now: () => new Date("2026-09-30T00:00:00Z") });
}

export function reasons(snapshot) {
  const [implementation, tests, docs, image] = snapshot.files;
  return { snapshotId: snapshot.id, groups: [
    { id: "g-expiration", title: "만료 시점부터 세션을 거부", basis: "stated",
      why: "만료 시각과 현재 시각이 같을 때도 세션이 허용되는 문제가 있었습니다. 비교 조건과 두 경계 테스트를 함께 바꿔 만료되는 순간부터 거부합니다.",
      parts: [{ fileId: implementation.id, startLine: 3, endLine: 4, note: "변경 후 2줄에서 만료 시각과 같은 경우를 제외합니다." },
        { fileId: tests.id, note: "거부해야 할 경계와 허용해야 할 경계를 함께 확인합니다." }],
      evidence: [{ sourceId: "pr-description", startLine: 3, endLine: 3 }, { sourceId: implementation.id, startLine: 3, endLine: 4 }] },
    { id: "g-label", title: "유효 기간이 남았다는 뜻을 이름에 반영", basis: "inferred",
      why: "active 대신 unexpired로 바꿔 이름이 실제 비교 조건을 표현하게 하려는 것으로 보입니다.",
      parts: [{ fileId: implementation.id, startLine: 6, endLine: 7 }], evidence: [] },
    { id: "g-docs", title: "문서 이름을 세션 용어에 맞춤", basis: "inferred",
      why: "파일명도 코드에서 사용하는 세션 용어에 맞추려는 것으로 보입니다. 문서 본문은 바뀌지 않았습니다.",
      parts: [{ fileId: docs.id }], evidence: [] },
    { id: "g-image", title: "이미지 변경의 이유는 확인되지 않음", basis: "unknown",
      why: "텍스트 패치가 없는 이미지입니다. 캡처한 PR 설명에는 이미지 변경의 목적이 적혀 있지 않습니다.",
      parts: [{ fileId: image.id }], evidence: [] },
  ] };
}
