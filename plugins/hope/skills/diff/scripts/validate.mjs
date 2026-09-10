import {
  ANALYSIS_VERSION,
  BASIS,
  CONTRACT_VERSION,
  FILE_DISPOSITIONS,
  IMPORTANCE,
  LIMITS,
  REVIEW_KINDS,
} from "./constants.mjs";
import { splitEvidenceRange } from "./evidence-range.mjs";
import { deriveReviewResult, sortReviewItems } from "./derive.mjs";
import {
  microworldSelections,
  normalizeMicroworldControls,
} from "./teaching-aids.mjs";
import { containsBidiControl } from "./text.mjs";

const changeSources = new Set(["patch", "before-file", "after-file"]);
const codeSources = new Set([...changeSources, "context-file"]);
const statedSources = new Set([
  "pull-request-title",
  "pull-request-description",
  "commit-title",
]);
const contextStatuses = ["checked", "not-applicable", "limited"];
const aidBases = ["stated", "code", "inferred"];
const visualKinds = ["flow", "decision-table", "sequence", "component-map"];
const proseFields = new Set([
  "answer",
  "caption",
  "case",
  "cells",
  "columns",
  "components",
  "doneWhen",
  "detail",
  "effect",
  "explanation",
  "impact",
  "instructions",
  "items",
  "label",
  "lesson",
  "nextStep",
  "omits",
  "outcome",
  "question",
  "reason",
  "simplifies",
  "steps",
  "subject",
  "text",
  "title",
]);
const analysisFields = Object.freeze([
  "schemaVersion",
  "runId",
  "snapshotDigest",
  "locale",
  "title",
  "purpose",
  "coreChange",
  "contextChecks",
  "background",
  "beginnerPrimer",
  "behavior",
  "codeSteps",
  "reviewItems",
  "fileDispositions",
  "limitImpacts",
  "quiz",
]);

function comparableTitle(value) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/[.!?。？！]+$/gu, "")
    .trim()
    .toLowerCase();
}

function validateReviewTitle(value, snapshot, sourceMap) {
  const validated = claim(value, "title", sourceMap);
  if ([...validated.text].length > LIMITS.reviewTitleCharacters) {
    throw new RangeError(
      `title.text must not exceed ${LIMITS.reviewTitleCharacters} characters`,
    );
  }
  if (
    validated.basis === "unknown"
    || !validated.evidence.some((item) => changeSources.has(item.sourceKind))
  ) {
    throw new Error("title must be grounded in collected code");
  }
  if (
    comparableTitle(validated.text)
    === comparableTitle(snapshot.pullRequest.title)
  ) {
    throw new Error("title must explain the change instead of copying the pull request title");
  }
  return validated;
}

function object(value, name, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${name} has an unknown field: ${key}`);
  }
  return value;
}

function array(value, name, maximum = LIMITS.reviewItems) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  if (value.length > maximum) throw new RangeError(`${name} has too many items`);
  return value;
}

function text(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  if ([...value].length > LIMITS.modelString) {
    throw new RangeError(`${name} is too long`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${name} contains a control character`);
  }
  if (containsBidiControl(value)) {
    throw new TypeError(`${name} contains a bidirectional control character`);
  }
  if (value.includes("`")) {
    throw new TypeError(
      `${name} contains a Markdown backtick; write plain text without formatting`,
    );
  }
  return value.replace(/\r\n?/gu, "\n");
}

function evidenceRange(value) {
  return `${value.sourceId}:${value.startLine}:${value.endLine}`;
}

function evidenceSetIdentity(values) {
  return [...values].map(evidenceRange).sort();
}

function claimIdentity(value) {
  return JSON.stringify([
    value.title ?? null,
    value.text,
    value.basis,
    evidenceSetIdentity(value.evidence),
  ]);
}

function assertUniqueSiblings(values, name, identity) {
  const firstIndexByIdentity = new Map();
  for (const [index, value] of values.entries()) {
    const key = identity(value);
    const firstIndex = firstIndexByIdentity.get(key);
    if (firstIndex !== undefined) {
      throw new Error(`${name}[${index}] duplicates ${name}[${firstIndex}]`);
    }
    firstIndexByIdentity.set(key, index);
  }
}

function enumeration(value, name, values) {
  if (!values.includes(value)) {
    throw new RangeError(`${name} must be one of ${values.join(", ")}`);
  }
  return value;
}

function identifier(value, name) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) {
    throw new TypeError(`${name} must be a lowercase identifier`);
  }
  return value;
}

function boundedArray(value, name, minimum, maximum) {
  const values = array(value, name, maximum);
  if (values.length < minimum) {
    throw new RangeError(`${name} needs at least ${minimum} item${minimum === 1 ? "" : "s"}`);
  }
  return values;
}

function evidenceReferences(value, name, sourceMap) {
  object(value, name, ["sourceId", "startLine", "endLine"]);
  if (typeof value.sourceId !== "string") throw new TypeError(`${name}.sourceId is invalid`);
  const source = sourceMap.get(value.sourceId);
  if (!source) throw new Error(`${name} refers to an unknown source: ${value.sourceId}`);
  if (
    !Number.isSafeInteger(value.startLine)
    || !Number.isSafeInteger(value.endLine)
    || value.startLine < 1
    || value.endLine < value.startLine
    || value.endLine > source.lineCount
  ) {
    throw new RangeError(`${name} has an invalid line range`);
  }
  const lineCount = value.endLine - value.startLine + 1;
  if (lineCount > LIMITS.authoredEvidenceLines) {
    throw new RangeError(
      `${name} selects ${lineCount} evidence lines; the maximum authored range is ${LIMITS.authoredEvidenceLines}`,
    );
  }
  const authoredExcerpt = source.lines
    .slice(value.startLine - 1, value.endLine)
    .join("\n");
  if (authoredExcerpt.trim().length === 0) {
    throw new Error(`${name} refers only to empty source text`);
  }
  return splitEvidenceRange(value, LIMITS.evidenceLines).map((range) => {
    const key = `${range.startLine}:${range.endLine}`;
    const cached = source.referenceCache.get(key);
    if (cached) return cached;
    const validated = Object.freeze({
      endLine: range.endLine,
      excerpt: source.lines
        .slice(range.startLine - 1, range.endLine)
        .join("\n"),
      fileId: source.fileId,
      path: source.path,
      revision: source.revision,
      sourceId: source.id,
      sourceKind: source.kind,
      startLine: range.startLine,
    });
    source.referenceCache.set(key, validated);
    return validated;
  });
}

function proseBytes(value, field) {
  if (typeof value === "string") {
    return proseFields.has(field) ? Buffer.byteLength(value, "utf8") : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + proseBytes(item, field), 0);
  }
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value).reduce(
    (sum, [key, item]) => sum + proseBytes(item, key),
    0,
  );
}

function analysisResources(analysis, roots, {
  analysisFileBytes,
  enforceLimits,
}) {
  const analysisCanonicalBytes = Buffer.byteLength(
    JSON.stringify(analysis),
    "utf8",
  );
  const actualAnalysisFileBytes = analysisFileBytes ?? analysisCanonicalBytes;
  if (enforceLimits && actualAnalysisFileBytes > LIMITS.modelBytes) {
    throw new RangeError(`Analysis file exceeds ${LIMITS.modelBytes} bytes`);
  }
  if (enforceLimits && analysisCanonicalBytes > LIMITS.modelBytes) {
    throw new RangeError(`Analysis exceeds ${LIMITS.modelBytes} bytes`);
  }
  const authoredProseBytes = proseBytes(analysis);
  if (enforceLimits && authoredProseBytes > LIMITS.analysisProseBytes) {
    throw new RangeError(
      `Analysis prose exceeds ${LIMITS.analysisProseBytes} bytes`,
    );
  }

  let evidenceReferences = 0;
  let evidenceBytes = 0;
  const evidenceLines = new Set();
  let codeEvidenceLines = 0;
  const ranges = new Set();
  const codeRanges = [];
  const codeLinesByField = new Map();
  const visit = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (
      typeof value.sourceId === "string"
      && Number.isSafeInteger(value.startLine)
      && Number.isSafeInteger(value.endLine)
      && typeof value.excerpt === "string"
    ) {
      evidenceReferences += 1;
      const range = `${value.sourceId}:${value.startLine}:${value.endLine}`;
      if (!ranges.has(range)) {
        ranges.add(range);
        evidenceBytes += Buffer.byteLength(value.excerpt, "utf8");
        for (let line = value.startLine; line <= value.endLine; line += 1) {
          const coordinate = `${value.sourceId}:${line}`;
          evidenceLines.add(coordinate);
        }
        if (codeSources.has(value.sourceKind)) {
          const lines = value.endLine - value.startLine + 1;
          const field = path.match(/^[^.[]+/u)?.[0] ?? "analysis";
          codeEvidenceLines += lines;
          codeLinesByField.set(field, (codeLinesByField.get(field) ?? 0) + lines);
          codeRanges.push(Object.freeze({
            endLine: value.endLine,
            field,
            lines,
            path,
            sourceId: value.sourceId,
            sourcePath: value.path,
            startLine: value.startLine,
          }));
        }
      }
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      visit(item, `${path}.${key}`);
    }
  };
  for (const [path, root] of roots) visit(root, path);

  if (enforceLimits && evidenceReferences > LIMITS.evidenceReferences) {
    throw new RangeError(
      `Analysis uses more than ${LIMITS.evidenceReferences} evidence references`,
    );
  }
  if (enforceLimits && ranges.size > LIMITS.uniqueEvidenceRanges) {
    throw new RangeError(
      `Analysis uses more than ${LIMITS.uniqueEvidenceRanges} unique evidence ranges`,
    );
  }
  if (enforceLimits && evidenceLines.size > LIMITS.evidenceTotalLines) {
    throw new RangeError(
      `Analysis evidence exceeds ${LIMITS.evidenceTotalLines} unique lines`,
    );
  }
  if (enforceLimits && evidenceBytes > LIMITS.evidenceBytes) {
    throw new RangeError(
      `Analysis evidence exceeds ${LIMITS.evidenceBytes} bytes`,
    );
  }
  if (enforceLimits && codeEvidenceLines > LIMITS.codeEvidenceLines) {
    const overlaps = [];
    for (let index = 0; index < codeRanges.length && overlaps.length < 8; index += 1) {
      const first = codeRanges[index];
      for (
        let comparison = index + 1;
        comparison < codeRanges.length && overlaps.length < 8;
        comparison += 1
      ) {
        const second = codeRanges[comparison];
        if (
          first.sourceId !== second.sourceId
          || Math.max(first.startLine, second.startLine)
            > Math.min(first.endLine, second.endLine)
        ) continue;
        overlaps.push(Object.freeze({
          first: Object.freeze({
            endLine: first.endLine,
            path: first.path,
            startLine: first.startLine,
          }),
          overlapLines: Math.min(first.endLine, second.endLine)
            - Math.max(first.startLine, second.startLine) + 1,
          second: Object.freeze({
            endLine: second.endLine,
            path: second.path,
            startLine: second.startLine,
          }),
          sourceId: first.sourceId,
          sourcePath: first.sourcePath,
        }));
      }
    }
    const error = new RangeError(
      `Analysis renders ${codeEvidenceLines} code evidence lines; limit is ${LIMITS.codeEvidenceLines}`,
    );
    error.resource = Object.freeze({
      actual: codeEvidenceLines,
      byField: Object.freeze([...codeLinesByField].map(
        ([field, lines]) => Object.freeze({ field, lines }),
      ).sort((first, second) => second.lines - first.lines)),
      largestRanges: Object.freeze([...codeRanges].sort(
        (first, second) => second.lines - first.lines,
      ).slice(0, 8)),
      limit: LIMITS.codeEvidenceLines,
      overlappingRanges: Object.freeze(overlaps),
      target: Math.floor(LIMITS.codeEvidenceLines * 0.8),
    });
    throw error;
  }

  return Object.freeze({
    analysisCanonicalBytes,
    analysisFileBytes: actualAnalysisFileBytes,
    authoredProseBytes,
    evidenceBytes,
    evidenceLines: evidenceLines.size,
    evidenceReferences,
    codeEvidenceLines,
    uniqueEvidenceRanges: ranges.size,
  });
}

function evidenceList(
  value,
  name,
  sourceMap,
  { allowEmpty = false, maximum = 12 } = {},
) {
  const values = array(value, name, maximum);
  if (!allowEmpty && values.length === 0) {
    throw new Error(`${name} must include evidence`);
  }
  const seen = new Set();
  return values.flatMap((item, index) => {
    const validated = evidenceReferences(item, `${name}[${index}]`, sourceMap);
    for (const reference of validated) {
      const key = `${reference.sourceId}:${reference.startLine}:${reference.endLine}`;
      if (seen.has(key)) throw new Error(`${name} contains duplicate evidence`);
      seen.add(key);
    }
    return validated;
  });
}

function claim(value, name, sourceMap, { title = false } = {}) {
  const keys = title
    ? ["title", "text", "basis", "evidence"]
    : ["text", "basis", "evidence"];
  object(value, name, keys);
  const basis = enumeration(value.basis, `${name}.basis`, BASIS);
  const evidence = evidenceList(value.evidence, `${name}.evidence`, sourceMap, {
    allowEmpty: basis === "unknown",
  });
  if (basis === "unknown" && evidence.length > 0) {
    throw new Error(`${name} cannot use evidence with an unknown basis`);
  }
  if (basis !== "unknown" && evidence.length === 0) {
    throw new Error(`${name} needs evidence for its basis`);
  }
  if (
    basis === "stated"
    && evidence.some((item) => !statedSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses code as a stated-source basis`);
  }
  if (
    basis === "code"
    && evidence.some((item) => !codeSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses non-code evidence as a code basis`);
  }
  return Object.freeze({
    basis,
    evidence,
    text: text(value.text, `${name}.text`),
    ...(title ? { title: text(value.title, `${name}.title`) } : {}),
  });
}

function primerClaim(value, name, sourceMap) {
  object(value, name, ["title", "text", "basis", "evidence"]);
  const basis = enumeration(value.basis, `${name}.basis`, aidBases);
  const evidence = evidenceList(value.evidence, `${name}.evidence`, sourceMap);
  if (
    basis === "stated"
    && evidence.some((item) => !statedSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses code as a stated-source basis`);
  }
  if (
    basis === "code"
    && evidence.some((item) => !codeSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses non-code evidence as a code basis`);
  }
  return Object.freeze({
    basis,
    evidence,
    text: text(value.text, `${name}.text`),
    title: text(value.title, `${name}.title`),
  });
}

function groundedAid(value, name, sourceMap) {
  const basis = enumeration(value.basis, `${name}.basis`, aidBases);
  const evidence = evidenceList(value.evidence, `${name}.evidence`, sourceMap);
  if (
    basis === "stated"
    && evidence.some((item) => !statedSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses code as a stated-source basis`);
  }
  if (
    basis === "code"
    && evidence.some((item) => !codeSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses non-code evidence as a code basis`);
  }
  return { basis, evidence };
}

function validateVisual(value, sourceMap) {
  const name = "behavior.visual";
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  const kind = enumeration(value.kind, `${name}.kind`, visualKinds);
  const shared = [
    "kind",
    "title",
    "caption",
    "basis",
    "evidence",
  ];
  const specific = {
    "component-map": ["components", "connections"],
    "decision-table": ["columns", "rows"],
    flow: ["items"],
    sequence: ["participants", "messages"],
  }[kind];
  object(value, name, [...shared, ...specific]);
  const grounded = groundedAid(value, name, sourceMap);
  const common = {
    ...grounded,
    caption: text(value.caption, `${name}.caption`),
    kind,
    title: text(value.title, `${name}.title`),
  };

  if (kind === "flow") {
    const items = boundedArray(value.items, `${name}.items`, 2, 12).map(
      (item, index) => {
        const itemName = `${name}.items[${index}]`;
        object(item, itemName, ["label", "detail"]);
        return Object.freeze({
          detail: text(item.detail, `${itemName}.detail`),
          label: text(item.label, `${itemName}.label`),
        });
      },
    );
    return Object.freeze({ ...common, items: Object.freeze(items) });
  }

  if (kind === "decision-table") {
    const columns = boundedArray(value.columns, `${name}.columns`, 1, 6).map(
      (entry, index) => text(entry, `${name}.columns[${index}]`),
    );
    const rows = boundedArray(value.rows, `${name}.rows`, 1, 12).map(
      (row, index) => {
        const rowName = `${name}.rows[${index}]`;
        object(row, rowName, ["case", "cells"]);
        const cells = boundedArray(row.cells, `${rowName}.cells`, 1, 6).map(
          (entry, cellIndex) => text(entry, `${rowName}.cells[${cellIndex}]`),
        );
        if (cells.length !== columns.length) {
          throw new Error(`${rowName}.cells must match the decision-table column count`);
        }
        return Object.freeze({
          case: text(row.case, `${rowName}.case`),
          cells: Object.freeze(cells),
        });
      },
    );
    return Object.freeze({
      ...common,
      columns: Object.freeze(columns),
      rows: Object.freeze(rows),
    });
  }

  const nodeField = kind === "sequence" ? "participants" : "components";
  const edgeField = kind === "sequence" ? "messages" : "connections";
  const nodes = boundedArray(
    value[nodeField],
    `${name}.${nodeField}`,
    2,
    kind === "sequence" ? 8 : 12,
  ).map((node, index) => {
    const nodeName = `${name}.${nodeField}[${index}]`;
    const keys = kind === "sequence" ? ["id", "label"] : ["id", "label", "detail"];
    object(node, nodeName, keys);
    return Object.freeze({
      id: identifier(node.id, `${nodeName}.id`),
      label: text(node.label, `${nodeName}.label`),
      ...(kind === "component-map"
        ? { detail: text(node.detail, `${nodeName}.detail`) }
        : {}),
    });
  });
  const nodeIds = new Set();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      throw new Error(`${name}.${nodeField} contains a duplicate id`);
    }
    nodeIds.add(node.id);
  }
  const edges = boundedArray(
    value[edgeField],
    `${name}.${edgeField}`,
    1,
    kind === "sequence" ? 16 : 20,
  ).map((edge, index) => {
    const edgeName = `${name}.${edgeField}[${index}]`;
    object(edge, edgeName, ["from", "to", "label"]);
    const from = identifier(edge.from, `${edgeName}.from`);
    const to = identifier(edge.to, `${edgeName}.to`);
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw new Error(`${edgeName} refers to an unknown ${kind === "sequence" ? "participant" : "component"}`);
    }
    return Object.freeze({
      from,
      label: text(edge.label, `${edgeName}.label`),
      to,
    });
  });
  return Object.freeze({
    ...common,
    [edgeField]: Object.freeze(edges),
    [nodeField]: Object.freeze(nodes),
  });
}

function validateMicroworldTrace(value, name) {
  object(value, name, ["steps", "outcome"]);
  const steps = boundedArray(value.steps, `${name}.steps`, 1, 8).map(
    (entry, index) => text(entry, `${name}.steps[${index}]`),
  );
  return Object.freeze({
    outcome: text(value.outcome, `${name}.outcome`),
    steps: Object.freeze(steps),
  });
}

function sameMicroworldTrace(first, second) {
  return first.outcome === second.outcome
    && first.steps.length === second.steps.length
    && first.steps.every((step, index) => step === second.steps[index]);
}

function selectionKey(controls, pairs) {
  return controls.map((control) => {
    const pair = pairs.find((entry) => entry.controlId === control.id);
    return `${control.id}=${pair.optionId}`;
  }).join("|");
}

function validateMicroworld(value, sourceMap) {
  const name = "behavior.microworld";
  object(value, name, [
    "title",
    "instructions",
    "simplifies",
    "omits",
    "basis",
    "evidence",
    "controls",
    "scenarios",
  ]);
  const grounded = groundedAid(value, name, sourceMap);
  const controls = normalizeMicroworldControls(value.controls, {
    name: `${name}.controls`,
  });
  const controlsById = new Map();
  for (const control of controls) {
    if (controlsById.has(control.id)) {
      throw new Error(`${name}.controls contains a duplicate id`);
    }
    controlsById.set(control.id, control);
  }
  const expected = microworldSelections(controls);
  const expectedKeys = new Set(expected.map((pairs) => selectionKey(controls, pairs)));
  const actualKeys = new Set();
  const scenarioIds = new Set();
  const scenarios = boundedArray(value.scenarios, `${name}.scenarios`, 2, 12).map(
    (scenario, index) => {
      const scenarioName = `${name}.scenarios[${index}]`;
      object(scenario, scenarioName, [
        "id",
        "title",
        "when",
        "before",
        "after",
        "lesson",
      ]);
      const id = identifier(scenario.id, `${scenarioName}.id`);
      if (scenarioIds.has(id)) {
        throw new Error(`${name}.scenarios contains a duplicate id`);
      }
      scenarioIds.add(id);
      const when = boundedArray(
        scenario.when,
        `${scenarioName}.when`,
        1,
        3,
      ).map((condition, conditionIndex) => {
        const conditionName = `${scenarioName}.when[${conditionIndex}]`;
        object(condition, conditionName, ["controlId", "optionId"]);
        const controlId = identifier(condition.controlId, `${conditionName}.controlId`);
        const optionId = identifier(condition.optionId, `${conditionName}.optionId`);
        const control = controlsById.get(controlId);
        if (!control) {
          throw new Error(`${conditionName} refers to an unknown control`);
        }
        if (!control.options.some((option) => option.id === optionId)) {
          throw new Error(`${conditionName} refers to an unknown option`);
        }
        return Object.freeze({ controlId, optionId });
      });
      if (new Set(when.map((entry) => entry.controlId)).size !== when.length) {
        throw new Error(`${scenarioName}.when repeats a control`);
      }
      if (
        when.length !== controls.length
        || controls.some((control) => !when.some((entry) => entry.controlId === control.id))
      ) {
        throw new Error(`${scenarioName}.when must bind every control exactly once`);
      }
      const key = selectionKey(controls, when);
      if (actualKeys.has(key)) {
        throw new Error(`${name}.scenarios repeats a control combination`);
      }
      actualKeys.add(key);
      const before = validateMicroworldTrace(scenario.before, `${scenarioName}.before`);
      const unchanged = scenario.after === "unchanged";
      const after = unchanged
        ? before
        : validateMicroworldTrace(scenario.after, `${scenarioName}.after`);
      if (!unchanged && sameMicroworldTrace(before, after)) {
        throw new Error(`${scenarioName}.after repeats before; use "unchanged"`);
      }
      return Object.freeze({
        after,
        before,
        id,
        lesson: text(scenario.lesson, `${scenarioName}.lesson`),
        selectionKey: key,
        title: text(scenario.title, `${scenarioName}.title`),
        unchanged,
        when: Object.freeze(controls.map(
          (control) => when.find((entry) => entry.controlId === control.id),
        )),
      });
    },
  );
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) {
      throw new Error(`${name}.scenarios is missing a control combination`);
    }
  }
  return Object.freeze({
    ...grounded,
    controls: Object.freeze(controls),
    instructions: text(value.instructions, `${name}.instructions`),
    omits: text(value.omits, `${name}.omits`),
    scenarios: Object.freeze(scenarios),
    simplifies: text(value.simplifies, `${name}.simplifies`),
    title: text(value.title, `${name}.title`),
  });
}

function reviewItem(value, index, sourceMap, limitMap) {
  const name = `reviewItems[${index}]`;
  object(value, name, [
    "kind",
    "importance",
    "basis",
    "title",
    "explanation",
    "effect",
    "nextStep",
    "doneWhen",
    "evidence",
    "limitIds",
  ]);
  const basis = enumeration(value.basis, `${name}.basis`, BASIS);
  const evidence = evidenceList(value.evidence, `${name}.evidence`, sourceMap);
  if (
    basis === "stated"
    && evidence.some((item) => !statedSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses code as a stated-source basis`);
  }
  if (
    basis === "code"
    && evidence.some((item) => !codeSources.has(item.sourceKind))
  ) {
    throw new Error(`${name} uses non-code evidence as a code basis`);
  }
  const limitIds = value.limitIds === undefined
    ? []
    : array(value.limitIds, `${name}.limitIds`, 12);
  if (new Set(limitIds).size !== limitIds.length) {
    throw new Error(`${name}.limitIds contains a duplicate`);
  }
  for (const limitId of limitIds) {
    if (!limitMap.has(limitId)) {
      throw new Error(`${name}.limitIds refers to an unknown limit`);
    }
  }
  return {
    basis,
    doneWhen: text(value.doneWhen, `${name}.doneWhen`),
    effect: text(value.effect, `${name}.effect`),
    evidence,
    explanation: text(value.explanation, `${name}.explanation`),
    importance: enumeration(value.importance, `${name}.importance`, IMPORTANCE),
    kind: enumeration(value.kind, `${name}.kind`, REVIEW_KINDS),
    limitIds: Object.freeze([...limitIds]),
    nextStep: text(value.nextStep, `${name}.nextStep`),
    originalIndex: index,
    title: text(value.title, `${name}.title`),
  };
}

function validateFileDispositions(values, snapshot) {
  const entries = array(values, "fileDispositions", LIMITS.changedFiles);
  const files = new Map(snapshot.files.map((file) => [file.id, file]));
  const selected = new Map();
  for (const [index, entry] of entries.entries()) {
    const name = `fileDispositions[${index}]`;
    object(entry, name, ["fileId", "disposition"]);
    const file = files.get(entry.fileId);
    if (!file) throw new Error(`${name} refers to an unknown file`);
    if (file.bodyState !== "included") {
      throw new Error(`${name} cannot classify a ${file.bodyState} file`);
    }
    if (selected.has(entry.fileId)) {
      throw new Error(`${name} repeats ${entry.fileId}`);
    }
    const disposition = enumeration(
      entry.disposition,
      `${name}.disposition`,
      FILE_DISPOSITIONS.slice(0, 3),
    );
    selected.set(entry.fileId, disposition);
  }
  for (const file of snapshot.files) {
    if (file.bodyState === "included" && !selected.has(file.id)) {
      throw new Error(`No semantic disposition was provided for ${file.path}`);
    }
  }
  return snapshot.files.map((file) => Object.freeze({
    ...file,
    disposition: file.bodyState === "redacted"
      ? "redacted"
      : file.bodyState === "metadata-only"
        ? "metadata-only"
        : selected.get(file.id),
  }));
}

function validateLimitImpacts(values, snapshot) {
  const entries = array(
    values,
    "limitImpacts",
    LIMITS.changedFiles + 2 + LIMITS.contextFiles,
  );
  const limits = new Map(snapshot.limits.map((limit) => [limit.id, limit]));
  const selected = new Map();
  for (const [index, entry] of entries.entries()) {
    const name = `limitImpacts[${index}]`;
    object(entry, name, ["limitId", "material", "impact"]);
    if (!limits.has(entry.limitId)) throw new Error(`${name} refers to an unknown limit`);
    if (selected.has(entry.limitId)) throw new Error(`${name} repeats ${entry.limitId}`);
    if (typeof entry.material !== "boolean") {
      throw new TypeError(`${name}.material must be a boolean`);
    }
    selected.set(entry.limitId, Object.freeze({
      impact: text(entry.impact, `${name}.impact`),
      material: entry.material,
    }));
  }
  for (const limit of snapshot.limits) {
    if (!selected.has(limit.id)) {
      throw new Error(`No impact was provided for ${limit.subject}`);
    }
  }
  return snapshot.limits.map((limit) => Object.freeze({
    ...limit,
    ...selected.get(limit.id),
  }));
}

function validateMaterialVerificationLimits(limits, reviewItems) {
  for (const limit of limits) {
    if (limit.kind !== "verification" || !limit.material) continue;
    const linked = reviewItems.some((item) => (
      item.kind === "verify" && item.limitIds.includes(limit.id)
    ));
    if (!linked) {
      throw new Error(
        `A material execution or CI limit needs a linked verify review item: ${limit.id}`,
      );
    }
  }
}

function validateContextChecks(values, sourceMap, limitMap) {
  const entries = array(values, "contextChecks", 20);
  const subjects = new Set();
  const linkedLimits = new Set();
  const checks = entries.map((value, index) => {
    const name = `contextChecks[${index}]`;
    object(value, name, [
      "subject",
      "status",
      "basis",
      "explanation",
      "evidence",
      "limitIds",
    ]);
    const subject = text(value.subject, `${name}.subject`);
    if (subjects.has(subject)) throw new Error(`${name} repeats its subject`);
    subjects.add(subject);
    const status = enumeration(
      value.status,
      `${name}.status`,
      contextStatuses,
    );
    const basis = enumeration(value.basis, `${name}.basis`, BASIS);
    const evidence = evidenceList(
      value.evidence,
      `${name}.evidence`,
      sourceMap,
      { allowEmpty: true },
    );
    const limitIds = array(value.limitIds, `${name}.limitIds`, 12);
    if (new Set(limitIds).size !== limitIds.length) {
      throw new Error(`${name}.limitIds contains a duplicate`);
    }
    for (const limitId of limitIds) {
      if (!limitMap.has(limitId)) {
        throw new Error(`${name}.limitIds refers to an unknown limit`);
      }
    }
    if (status === "checked" && evidence.length === 0) {
      throw new Error(`${name} needs evidence when checked`);
    }
    if (status === "checked" && basis === "unknown") {
      throw new Error(`${name} needs a grounded basis when checked`);
    }
    if (basis === "unknown" && evidence.length > 0) {
      throw new Error(`${name} cannot use evidence with an unknown basis`);
    }
    if (basis !== "unknown" && evidence.length === 0) {
      throw new Error(`${name} needs evidence for its basis`);
    }
    if (
      basis === "stated"
      && evidence.some((item) => !statedSources.has(item.sourceKind))
    ) {
      throw new Error(`${name} uses code as a stated-source basis`);
    }
    if (
      basis === "code"
      && evidence.some((item) => !codeSources.has(item.sourceKind))
    ) {
      throw new Error(`${name} uses non-code evidence as a code basis`);
    }
    if (status === "checked" && limitIds.length > 0) {
      throw new Error(`${name} cannot link limits when checked`);
    }
    if (status === "limited" && limitIds.length === 0) {
      throw new Error(`${name} needs at least one limit when limited`);
    }
    if (status === "not-applicable" && limitIds.length > 0) {
      throw new Error(`${name} cannot link limits when not applicable`);
    }
    if (status === "limited") {
      for (const limitId of limitIds) linkedLimits.add(limitId);
    }
    return Object.freeze({
      basis,
      evidence,
      explanation: text(value.explanation, `${name}.explanation`),
      limitIds: Object.freeze([...limitIds]),
      status,
      subject,
    });
  });
  for (const limitId of limitMap.keys()) {
    if (!linkedLimits.has(limitId)) {
      throw new Error(`No context check accounts for ${limitId}`);
    }
  }
  return checks;
}

function validateCodeStep(value, index, sourceMap, fileMap) {
  const name = `codeSteps[${index}]`;
  object(value, name, ["title", "text", "basis", "evidence"]);
  const validatedClaim = claim({
    basis: value.basis,
    evidence: value.evidence,
    text: value.text,
    title: value.title,
  }, name, sourceMap, { title: true });
  const evidenceFiles = new Set(
    validatedClaim.evidence.map((item) => item.fileId).filter(Boolean),
  );
  if (evidenceFiles.size === 0) {
    throw new Error(`${name} needs code evidence`);
  }
  const fileIds = [...evidenceFiles];
  for (const fileId of fileIds) {
    if (!fileMap.has(fileId)) throw new Error(`${name} refers to an unknown file`);
  }
  return Object.freeze({ ...validatedClaim, fileIds: Object.freeze([...fileIds]) });
}

function validateAnalysisIdentity(analysis, snapshot, runId) {
  if (snapshot?.schemaVersion !== CONTRACT_VERSION) {
    throw new RangeError("Unsupported Hope snapshot schema");
  }
  object(analysis, "analysis", analysisFields);
  if (analysis.schemaVersion !== ANALYSIS_VERSION) {
    throw new RangeError("Unsupported Hope analysis schema");
  }
  if (analysis.runId !== runId) throw new Error("Analysis runId does not match");
  if (analysis.snapshotDigest !== snapshot.digest) {
    throw new Error("Analysis snapshot digest does not match");
  }
  if (analysis.locale !== snapshot.settings.locale) {
    throw new Error("Analysis locale does not match the prepared review");
  }
}

function validateAnalysisValue(analysis, snapshot, {
  analysisFileBytes,
  enforceResourceLimits = true,
  runId,
} = {}) {
  validateAnalysisIdentity(analysis, snapshot, runId);

  const sourceMap = new Map(snapshot.sources.map((source) => {
    if (typeof source.text !== "string") {
      throw new TypeError(`Hope source ${source.id} is not text`);
    }
    const lines = Object.freeze(source.text.split("\n"));
    if (lines.length !== source.lineCount) {
      throw new Error(`Hope source ${source.id} line count does not match`);
    }
    return [source.id, { ...source, lines, referenceCache: new Map() }];
  }));
  const fileMap = new Map(snapshot.files.map((file) => [file.id, file]));
  const limitMap = new Map(snapshot.limits.map((limit) => [limit.id, limit]));
  const errors = [];
  const capture = (path, operation) => {
    try {
      return operation();
    } catch (error) {
      errors.push({ error, issue: analysisIssue(error, path) });
      return undefined;
    }
  };
  // Validate each field once. Only checks that need invalid values are skipped.
  const items = (values, name, minimum, maximum, validate, identity) => {
    const entries = capture(name, () => boundedArray(
      values, name, minimum, maximum,
    ));
    if (!entries) return undefined;
    const validated = entries.map((value, index) => capture(
      `${name}[${index}]`, () => validate(value, index),
    ));
    if (validated.some((value) => value === undefined)) return undefined;
    if (identity) {
      capture(name, () => assertUniqueSiblings(validated, name, identity));
    }
    return validated;
  };
  const groundedChange = (value, name) => {
    const validated = claim(value, name, sourceMap);
    if (
      validated.basis === "unknown"
      || !validated.evidence.some((item) => changeSources.has(item.sourceKind))
    ) {
      throw new Error(`${name} must be grounded in collected code`);
    }
    return validated;
  };

  const title = capture(undefined, () => validateReviewTitle(
    analysis.title, snapshot, sourceMap,
  ));
  const purpose = capture("purpose", () => {
    const value = claim(analysis.purpose, "purpose", sourceMap);
    if (!["stated", "inferred", "unknown"].includes(value.basis)) {
      throw new Error("purpose basis must be stated, inferred, or unknown");
    }
    return value;
  });
  const core = capture("coreChange", () => object(
    analysis.coreChange, "coreChange", ["before", "after", "why", "details"],
  ));
  let coreChange;
  if (core) {
    coreChange = Object.freeze({
      before: capture("coreChange.before", () => groundedChange(
        core.before, "coreChange.before",
      )),
      after: capture("coreChange.after", () => groundedChange(
        core.after, "coreChange.after",
      )),
      why: capture("coreChange.why", () => claim(
        core.why, "coreChange.why", sourceMap,
      )),
      details: items(
        core.details, "coreChange.details", 1, 4,
        (value, index) => claim(value, `coreChange.details[${index}]`, sourceMap),
        claimIdentity,
      ),
    });
    if (title && Object.values(coreChange).every((value) => value !== undefined)) {
      capture("title.evidence", () => {
        const renderedEvidence = new Set([
          coreChange.before, coreChange.after, coreChange.why, ...coreChange.details,
        ].flatMap((value) => value.evidence.map(evidenceRange)));
        if (title.evidence.some((item) => !renderedEvidence.has(evidenceRange(item)))) {
          throw new Error("title.evidence must reuse evidence rendered by coreChange");
        }
      });
    }
  }
  const background = analysis.background === undefined ? [] : items(
    analysis.background, "background", 0, 1,
    (value, index) => claim(value, `background[${index}]`, sourceMap, { title: true }),
    claimIdentity,
  );
  const beginnerPrimer = analysis.beginnerPrimer === undefined ? [] : items(
    analysis.beginnerPrimer, "beginnerPrimer", 1, 8,
    (value, index) => primerClaim(value, `beginnerPrimer[${index}]`, sourceMap),
    claimIdentity,
  );
  let behavior;
  if (analysis.behavior !== undefined) {
    const value = capture("behavior", () => object(
      analysis.behavior, "behavior", ["summary", "steps", "visual", "microworld"],
    ));
    if (value) {
      behavior = Object.freeze({
        summary: capture("behavior.summary", () => claim(
          value.summary, "behavior.summary", sourceMap,
        )),
        steps: items(
          value.steps, "behavior.steps", 2, 12,
          (item, index) => claim(item, `behavior.steps[${index}]`, sourceMap),
          claimIdentity,
        ),
        visual: value.visual === undefined ? undefined : capture(
          "behavior.visual", () => validateVisual(value.visual, sourceMap),
        ),
        microworld: value.microworld === undefined ? undefined : capture(
          "behavior.microworld", () => validateMicroworld(value.microworld, sourceMap),
        ),
      });
    }
  }
  const authoredReviewItems = items(
    analysis.reviewItems, "reviewItems", 0, LIMITS.reviewItems,
    (value, index) => reviewItem(value, index, sourceMap, limitMap),
    (item) => JSON.stringify([
      item.kind, item.importance, item.basis, item.title, item.explanation,
      item.effect, item.nextStep, item.doneWhen,
      evidenceSetIdentity(item.evidence), [...item.limitIds].sort(),
    ]),
  );
  const limits = capture("limitImpacts", () => validateLimitImpacts(
    analysis.limitImpacts, snapshot,
  ));
  if (limits && authoredReviewItems) {
    capture("limitImpacts", () => validateMaterialVerificationLimits(
      limits, authoredReviewItems,
    ));
  }
  const contextChecks = capture("contextChecks", () => validateContextChecks(
    analysis.contextChecks, sourceMap, limitMap,
  ));
  const files = capture("fileDispositions", () => validateFileDispositions(
    analysis.fileDispositions, snapshot,
  ));
  capture("coreChange", () => {
    if (!snapshot.files.some((file) => file.bodyState === "included")) {
      throw new Error("The core change cannot be grounded without an included file");
    }
  });
  const codeSteps = items(
    analysis.codeSteps, "codeSteps", 0, 20,
    (value, index) => validateCodeStep(value, index, sourceMap, fileMap),
    claimIdentity,
  );

  let quiz = [];
  if (analysis.quiz !== undefined) {
    const values = capture("quiz", () => boundedArray(analysis.quiz, "quiz", 1, 5));
    quiz = values?.map((value, index) => capture(undefined, () => {
      const name = `quiz[${index}]`;
      object(value, name, ["question", "answer", "evidence"]);
      return Object.freeze({
        answer: text(value.answer, `${name}.answer`),
        evidence: evidenceList(value.evidence, `${name}.evidence`, sourceMap, {
          maximum: 8,
        }),
        id: `quiz-${index + 1}`,
        question: text(value.question, `${name}.question`),
      });
    }));
    if (quiz?.every((value) => value !== undefined)) {
      capture("quiz", () => assertUniqueSiblings(
        quiz, "quiz", (item) => JSON.stringify([
          item.question, item.answer, evidenceSetIdentity(item.evidence),
        ]),
      ));
    }
  }
  const resources = capture("analysis.resources", () => analysisResources(
    analysis,
    [
      ["background", background],
      ["behavior", behavior],
      ["codeSteps", codeSteps],
      ["contextChecks", contextChecks],
      ["coreChange", coreChange],
      ["beginnerPrimer", beginnerPrimer],
      ["purpose", purpose],
      ["quiz", quiz],
      ["reviewItems", authoredReviewItems],
      ["title", title],
    ],
    { analysisFileBytes, enforceLimits: enforceResourceLimits },
  ));
  if (errors.length > 0) {
    const first = errors[0].error;
    const issues = Object.freeze(errors.map(({ issue }) => issue));
    if (issues.length === 1) {
      first.issues = issues;
      throw first;
    }
    const combined = new Error(
      `${first.message} (${issues.length - 1} additional independent contract issue${issues.length === 2 ? "" : "s"}; fix them together)`,
      { cause: first },
    );
    combined.issues = issues;
    throw combined;
  }
  const reviewItems = sortReviewItems(authoredReviewItems).map(
    (item, index) => Object.freeze({
      ...item,
      id: `review-item-${index + 1}`,
      originalIndex: undefined,
    }),
  );
  return Object.freeze({
    analysisSchemaVersion: ANALYSIS_VERSION,
    background: Object.freeze(background),
    beginnerPrimer: Object.freeze(beginnerPrimer),
    behavior,
    codeSteps: Object.freeze(codeSteps),
    contextChecks: Object.freeze(contextChecks),
    coreChange: Object.freeze({
      ...coreChange, details: Object.freeze(coreChange.details),
    }),
    files: Object.freeze(files),
    limits: Object.freeze(limits),
    purpose,
    quiz: Object.freeze(quiz),
    resources,
    result: deriveReviewResult(reviewItems, limits),
    reviewItems: Object.freeze(reviewItems),
    runId,
    sourceIndex: Object.freeze(snapshot.sources.map((source) => Object.freeze({
      fileId: source.fileId,
      kind: source.kind,
      lineCount: source.lineCount,
      path: source.path,
      revision: source.revision,
    }))),
    snapshot: Object.freeze({
      capturedAt: snapshot.capturedAt,
      digest: snapshot.digest,
      pullRequest: snapshot.pullRequest,
      repository: snapshot.repository,
      settings: snapshot.settings,
      snapshot: snapshot.snapshot,
    }),
    title,
  });
}

function analysisIssue(error, path) {
  const message = error instanceof Error ? error.message : String(error);
  const inferredPath = message.match(
    /^(?:analysis|background|beginnerPrimer|behavior|codeSteps|contextChecks|coreChange|fileDispositions|limitImpacts|purpose|quiz|reviewItems|title)(?:\[[0-9]+\])?(?:\.[A-Za-z][A-Za-z0-9]*)*/u,
  )?.[0] ?? "analysis";
  let code = "ANALYSIS_CONTRACT";
  if (
    message.includes("evidence limit")
    || message.includes("maximum authored range")
  ) code = "EVIDENCE_RANGE_LIMIT";
  else if (message.includes("unknown source")) code = "EVIDENCE_SOURCE_UNKNOWN";
  else if (message.includes("invalid line range")) code = "EVIDENCE_RANGE_INVALID";
  else if (message.includes("evidence does not match its files")) {
    code = "CODE_STEP_FILE_MISMATCH";
  } else if (message.includes("code evidence lines")) {
    code = "RESOURCE_CODE_EVIDENCE_LINES";
  } else if (message.includes("evidence references")) {
    code = "RESOURCE_EVIDENCE_REFERENCES";
  } else if (message.includes("unique evidence ranges")) {
    code = "RESOURCE_EVIDENCE_RANGES";
  } else if (message.includes("evidence exceeds")) {
    code = "RESOURCE_EVIDENCE";
  } else if (message.includes("must be grounded")) {
    code = "CHANGE_GROUNDING";
  }
  return Object.freeze({
    code,
    ...(error?.resource === undefined ? {} : { details: error.resource }),
    message,
    path: path ?? inferredPath,
  });
}

export function validateAnalysis(analysis, snapshot, options = {}) {
  try {
    return validateAnalysisValue(analysis, snapshot, options);
  } catch (error) {
    error.issues ??= Object.freeze([analysisIssue(error)]);
    throw error;
  }
}
