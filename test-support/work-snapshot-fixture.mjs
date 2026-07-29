export function makeWorkSnapshot() {
  return {
    capturedAt: "2026-07-28T00:00:00.000Z",
    sources: [
      {
        id: "conversation-1",
        kind: "conversation",
        label: "Task request",
        locator: "conversation turn 1",
        digest: `sha256:${"c".repeat(64)}`,
      },
      {
        id: "repository-1",
        kind: "git",
        label: "Repository baseline",
        locator: "example/hope",
        revision: "a".repeat(40),
      },
    ],
  };
}
