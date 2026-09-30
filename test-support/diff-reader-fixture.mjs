import { makeSnapshot, makeAnalysis } from "./diff-fixture.mjs";
import { digestJson } from "../plugins/hope/skills/diff/scripts/hash.mjs";
export const runId = "d".repeat(32);
export const providerFiles = [
  { filename: "src/session.ts", status: "modified", additions: 2, deletions: 2,
    patch: "@@ -1,5 +1,5 @@\n export function valid(exp, now) {\n-  return exp >= now;\n+  return exp > now;\n }\n-export const label = 'active';\n+export const label = 'unexpired';\n // session boundary" },
  { filename: "test/session.test.ts", status: "added", additions: 2, deletions: 0,
    patch: "@@ -0,0 +1,2 @@\n+expect(valid(100, 100)).toBe(false);\n+expect(valid(101, 100)).toBe(true);" },
  { filename: "docs/session.md", previous_filename: "docs/token.md", status: "renamed", additions: 0, deletions: 0 },
  { filename: "assets/session.png", status: "modified", additions: 0, deletions: 0 },
];


export function fixture({ files = providerFiles, locale = "ko-KR", theme = "system" } = {}) {
  const base = makeSnapshot({ locale, theme });
  const sources = base.sources.slice(0, 2);
  const records = files.map((file, index) => {
    const id = `file-${index + 1}`;
    const sourceIds = [];
    if (file.patch) {
      const sourceId = `source-${sources.length + 1}`;
      sourceIds.push(sourceId);
      sources.push({ id: sourceId, kind: "patch", fileId: id, path: file.filename, text: file.patch, lineCount: file.patch.split("\n").length, revision: base.snapshot.head });
    }
    return { id, path: file.filename, previousPath: file.previous_filename, additions: file.additions, deletions: file.deletions,
      providerStatus: file.status, sourceIds, bodyState: file.patch ? "included" : "metadata-only", ...(file.patch ? {} : { bodyReasonKind: "no-text-diff", bodyReason: "No text diff" }) };
  });
  const { digest: _digest, ...value } = base;
  const snapshot = { ...value, files: records, sources };
  return { ...snapshot, digest: digestJson(snapshot) };
}

export function analysisFor(snapshot) {
  const analysis = makeAnalysis(snapshot, runId);
  analysis.fileDispositions = snapshot.files.filter((file) => file.bodyState === "included").map((file) => ({ fileId: file.id, disposition: "explained" }));
  return analysis;
}

export function reasons(snapshot) {
  const [implementation, tests, docs, image] = snapshot.files;
  return { groups: [
    { id: "g-expiration", title: "만료 시점부터 세션을 거부", basis: "stated",
      text: "만료 시각과 현재 시각이 같을 때도 세션이 허용되는 문제가 있었습니다. 비교 조건과 두 경계 테스트를 함께 바꿔 만료되는 순간부터 거부합니다.",
      parts: [{ fileId: implementation.id, startLine: 3, endLine: 4, note: "변경 후 2줄에서 만료 시각과 같은 경우를 제외합니다." },
        { fileId: tests.id, note: "거부해야 할 경계와 허용해야 할 경계를 함께 확인합니다." }],
      evidence: [{ sourceId: "source-2", startLine: 1, endLine: 1 }, { sourceId: implementation.sourceIds[0], startLine: 3, endLine: 4 }] },
    { id: "g-label", title: "유효 기간이 남았다는 뜻을 이름에 반영", basis: "inferred",
      text: "active 대신 unexpired로 바꿔 이름이 실제 비교 조건을 표현하게 하려는 것으로 보입니다.",
      parts: [{ fileId: implementation.id, startLine: 6, endLine: 7 }], evidence: [{ sourceId: implementation.sourceIds[0], startLine: 6, endLine: 7 }] },
    { id: "g-docs", title: "문서 이름을 세션 용어에 맞춤", basis: "inferred",
      text: "파일명도 코드에서 사용하는 세션 용어에 맞추려는 것으로 보입니다. 텍스트 패치가 없어 본문 변경 여부는 확인할 수 없습니다.",
      parts: [{ fileId: docs.id }], evidence: [{ sourceId: "source-2", startLine: 1, endLine: 1 }] },
    { id: "g-image", title: "이미지 변경의 이유는 확인되지 않음", basis: "unknown",
      text: "텍스트 패치가 없는 이미지입니다. 캡처한 PR 설명에는 이미지 변경의 목적이 적혀 있지 않습니다.",
      parts: [{ fileId: image.id }], evidence: [] },
  ] };
}
