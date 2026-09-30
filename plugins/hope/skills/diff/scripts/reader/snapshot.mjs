/** A view over Diff's single captured source inventory, never a second capture. */
export function readerSnapshot(snapshot) {
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  const files = snapshot.files.map((file) => {
    const patch = file.sourceIds.map((id) => sources.get(id)).find((source) => source?.kind === "patch");
    if (file.bodyState === "included" && !patch) throw new Error(`Included file ${file.id} has no complete patch`);
    const reason = ({ "private-path": "private-file", "credential-pattern": "credential", "safe-size-limit": "size-limit", "invalid-text": "binary" })[file.bodyReasonKind] ?? file.bodyReasonKind ?? "no-text-diff";
    return { id: file.id, path: file.path, previousPath: file.previousPath, additions: file.additions, deletions: file.deletions,
      availability: patch ? "text" : "unavailable",
      ...(patch ? { patch: patch.text } : { reason }) };
  });
  return { id: snapshot.digest, head: snapshot.snapshot.head, files };
}
