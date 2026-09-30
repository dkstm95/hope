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
  return { snapshotId: snapshot.id, explanations: snapshot.changes.map((change, index) => ({
    changeId: change.id,
    title: ["만료 시점부터 세션을 거부", "상태 이름을 유효 기간에 맞춤", "경계 조건의 회귀를 방지", "문서 이름을 세션 용어에 맞춤", "이미지 변경의 이유는 확인되지 않음"][index],
    why: ["만료 시각과 현재 시각이 같을 때도 세션이 허용되는 문제가 있었습니다. PR은 만료되는 순간부터 거부하도록 요구합니다.", "유효 기간이 남았다는 의미를 이름에 담으려는 변경으로 보입니다. 이름만으로 실제 연결 상태까지 보장하지는 않습니다.", "만료 시점의 세션은 거부하고 아직 시간이 남은 세션은 허용해야 합니다. 두 경계 사례를 고정해 같은 문제가 다시 생기는지 확인합니다.", "파일명도 코드에서 사용하는 세션 용어에 맞추려는 것으로 보입니다. 문서 본문은 바뀌지 않았습니다.", "텍스트 패치가 없는 이미지입니다. 캡처한 PR 설명에는 이미지 변경의 목적이 적혀 있지 않습니다."][index],
    basis: ["stated", "inferred", "stated", "inferred", "unknown"][index],
    effects: index === 0 ? ["만료 시각과 같은 요청도 거부됩니다."] : [],
    evidence: [0, 2].includes(index) ? [{ sourceId: "pr-description", startLine: 3, endLine: 3 }] : [],
  })) };
}
