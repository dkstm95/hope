import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { readPngImages } from "./image.mjs";
import { renderAlignArtifact } from "./render.mjs";
import { validateAlignInput, validateAlignRecord } from "./validate.mjs";

const execFileAsync = promisify(execFile);
const INPUT_MAXIMUM_BYTES = 256 * 1024;
const RECORD_MAXIMUM_BYTES = 1024 * 1024;

function gitEnvironment(environment = process.env) {
  return Object.fromEntries(Object.entries(environment).filter(
    ([name, value]) => !name.toUpperCase().startsWith("GIT_") && value !== undefined,
  ));
}

async function runGit(cwd, argumentsList) {
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "core.hooksPath=/dev/null", ...argumentsList],
    { cwd, encoding: "utf8", env: gitEnvironment(), maxBuffer: 1024 * 1024, timeout: 10_000 },
  );
  return stdout.trim();
}

export async function repositoryRoot(path) {
  return await realpath(await runGit(await realpath(path), ["rev-parse", "--show-toplevel"]));
}

function exposeControls(value) {
  return String(value).replace(
    /[\u0000-\u001f\u007f؜‎‏‪-‮⁦-⁩]/gu,
    (character) => `\\u${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
  );
}

/** The `owner/name` shown in the rail: the origin remote's last two segments, or the folder. */
async function repositoryLabel(root) {
  let remote;
  try {
    remote = await runGit(root, ["remote", "get-url", "origin"]);
  } catch {
    return exposeControls(basename(root));
  }
  const parts = remote.replace(/\.git$/iu, "").split(/[\\/:]/u).filter(Boolean);
  return exposeControls(parts.length >= 2 ? parts.slice(-2).join("/") : basename(root));
}

function insideRoot(root, target) {
  const fromRoot = relative(root, target);
  return fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
}

function outsideRepository(label) {
  return new Error(`${label} must stay inside the repository`);
}

/** Resolve a requested path against the repository, keeping `.json` and the root boundary. */
function resolveRecordTarget(root, requested, requestedRoot = root) {
  let target = resolve(root, requested);
  if (isAbsolute(requested)) {
    // An absolute path written against an unresolved root (for example /var on
    // macOS) maps onto the resolved root it names.
    const unresolvedRoot = resolve(requestedRoot);
    target = insideRoot(unresolvedRoot, requested)
      ? resolve(root, relative(unresolvedRoot, requested))
      : resolve(requested);
  }
  if (extname(target).toLowerCase() !== ".json") {
    throw new Error("Align record path must use a .json extension");
  }
  if (!insideRoot(root, target)) throw outsideRepository("Align record");
  return target;
}

/** Check, before and after creating it, that the parent resolves inside the root. */
async function safeParent(root, target, { create = false } = {}) {
  const parent = dirname(target);
  let existing = parent;
  for (;;) {
    try {
      await lstat(existing);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT" || !create) throw error;
      existing = dirname(existing);
    }
  }
  if (!insideRoot(root, await realpath(existing))) throw outsideRepository("Align record");
  if (create) await mkdir(parent, { recursive: true });
  if (!insideRoot(root, await realpath(parent))) throw outsideRepository("Align record");
  return parent;
}

export async function assertAbsent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Hope did not replace the existing file: ${path}`);
}

export async function readBoundedFile(path, maximumBytes, label) {
  const info = await lstat(path);
  if (!info.isFile()) throw new Error(`${label} must be a regular file`);
  if (info.size > maximumBytes) throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  return await readFile(path);
}

async function readJson(path, maximumBytes, label) {
  const bytes = await readBoundedFile(path, maximumBytes, label);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

/** Write through a temporary sibling and a rename so readers never see a partial file. */
export async function writeAtomic(path, bytes, { exclusive = false } = {}) {
  if (exclusive) await assertAbsent(path);
  const temporary = join(dirname(path), `.${basename(path)}.hope-${randomBytes(8).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o644 });
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export function htmlPathFor(recordPath) {
  return `${recordPath.slice(0, -extname(recordPath).length)}.html`;
}

/**
 * Resolve each design-direction image (absolute, or relative to the record) to a
 * real file inside the repository, and return the content with record-relative paths.
 */
async function resolveImages(content, recordDirectory, root) {
  const options = content.designDirections?.options ?? [];
  const base = await realpath(recordDirectory);
  const absolutePaths = [];
  const stored = [];
  for (const [index, option] of options.entries()) {
    const label = `Design direction image ${index + 1}`;
    let real;
    try {
      real = await realpath(resolve(base, option.imagePath));
    } catch (error) {
      throw new Error(`${label} was not found: ${option.imagePath}`, { cause: error });
    }
    if (!insideRoot(root, real)) throw outsideRepository(label);
    absolutePaths.push(real);
    stored.push(Object.freeze({
      ...option,
      imagePath: relative(base, real).split(sep).join("/"),
    }));
  }
  if (options.length === 0) return { absolutePaths, content };
  return {
    absolutePaths,
    content: Object.freeze({
      ...content,
      designDirections: Object.freeze({ ...content.designDirections, options: Object.freeze(stored) }),
    }),
  };
}

async function readRecord(recordPath) {
  return validateAlignRecord(await readJson(recordPath, RECORD_MAXIMUM_BYTES, "Align record"));
}

function resultFor(recordPath, record) {
  return Object.freeze({
    alignId: record.alignId,
    recordPath,
    htmlPath: htmlPathFor(recordPath),
    revision: record.history.length,
    title: record.content.title,
  });
}

/** Render the record's sibling HTML with its images embedded, then write JSON and HTML. */
export async function writeRecordFiles(root, recordPath, record, { writeJson = true } = {}) {
  const directory = dirname(recordPath);
  const { absolutePaths } = await resolveImages(record.content, directory, root);
  const html = renderAlignArtifact(record, {
    images: await readPngImages(absolutePaths),
    recordHref: basename(recordPath),
  });
  if (writeJson) {
    await writeAtomic(recordPath, Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8"));
  }
  await writeAtomic(htmlPathFor(recordPath), Buffer.from(html, "utf8"));
  return resultFor(recordPath, record);
}

async function readInput(inputPath, defaults) {
  return validateAlignInput(await readJson(inputPath, INPUT_MAXIMUM_BYTES, "Align input"), defaults);
}

async function locateRecord(requested) {
  const absolute = resolve(requested);
  const recordPath = join(await realpath(dirname(absolute)), basename(absolute));
  const root = await repositoryRoot(dirname(recordPath));
  if (extname(recordPath).toLowerCase() !== ".json") {
    throw new Error("Align record path must use a .json extension");
  }
  if (!insideRoot(root, recordPath)) throw outsideRepository("Align record");
  return { recordPath, root };
}

export async function createAlignRecord({ inputPath, outputPath, root }, dependencies = {}) {
  if (!inputPath || !outputPath) throw new TypeError("inputPath and outputPath are required");
  const requestedRoot = root ?? process.cwd();
  const resolvedRoot = await repositoryRoot(requestedRoot);
  const input = await readInput(inputPath);
  const recordPath = resolveRecordTarget(resolvedRoot, outputPath, requestedRoot);
  const directory = await safeParent(resolvedRoot, recordPath, { create: true });
  await assertAbsent(recordPath);
  await assertAbsent(htmlPathFor(recordPath));
  const now = (dependencies.now?.() ?? new Date()).toISOString();
  const { content } = await resolveImages(input.content, directory, resolvedRoot);
  const record = validateAlignRecord({
    schemaVersion: 1,
    alignId: (dependencies.randomUUID ?? randomUUID)(),
    repository: await repositoryLabel(resolvedRoot),
    locale: input.locale,
    theme: input.theme,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, summary: input.revisionSummary }],
    content,
  });
  return await writeRecordFiles(resolvedRoot, recordPath, record);
}

export async function inspectAlignRecord(recordPath) {
  if (!recordPath) throw new TypeError("recordPath is required");
  const absolute = resolve(recordPath);
  const record = await readRecord(absolute);
  return Object.freeze({
    ...resultFor(absolute, record),
    repository: record.repository,
    locale: record.locale,
    theme: record.theme,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    history: record.history,
    content: record.content,
  });
}

export async function reviseAlignRecord({ inputPath, recordPath, root }, dependencies = {}) {
  if (!inputPath || !recordPath) throw new TypeError("inputPath and recordPath are required");
  const requestedRoot = root ?? process.cwd();
  const resolvedRoot = await repositoryRoot(requestedRoot);
  const target = resolveRecordTarget(resolvedRoot, recordPath, requestedRoot);
  const directory = await safeParent(resolvedRoot, target);
  const current = await readRecord(target);
  const input = await readInput(inputPath, { locale: current.locale, theme: current.theme });
  const now = (dependencies.now?.() ?? new Date()).toISOString();
  const { content } = await resolveImages(input.content, directory, resolvedRoot);
  const record = validateAlignRecord({
    ...current,
    locale: input.locale,
    theme: input.theme,
    updatedAt: now,
    history: [...current.history, { at: now, summary: input.revisionSummary }],
    content,
  });
  return await writeRecordFiles(resolvedRoot, target, record);
}

export async function renderAlignRecord(recordPath) {
  if (!recordPath) throw new TypeError("recordPath is required");
  const located = await locateRecord(recordPath);
  await safeParent(located.root, located.recordPath);
  const record = await readRecord(located.recordPath);
  return await writeRecordFiles(located.root, located.recordPath, record, { writeJson: false });
}
