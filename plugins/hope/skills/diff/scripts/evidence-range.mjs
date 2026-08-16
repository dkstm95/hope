export function splitEvidenceRange(value, maximumLines) {
  const ranges = [];
  for (
    let startLine = value.startLine;
    startLine <= value.endLine;
    startLine += maximumLines
  ) {
    ranges.push(Object.freeze({
      endLine: Math.min(value.endLine, startLine + maximumLines - 1),
      sourceId: value.sourceId,
      startLine,
    }));
  }
  return Object.freeze(ranges);
}
