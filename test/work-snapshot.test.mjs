import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readBoundedJson,
  validateWorkSnapshot,
} from "../features/work-snapshot/index.mjs";
import {
  makeWorkSnapshot,
} from "../test-support/work-snapshot-fixture.mjs";

test("work snapshots bind sources to stable identities", () => {
  const snapshot = validateWorkSnapshot(makeWorkSnapshot());
  assert.equal(snapshot.sources.length, 2);
  assert.equal(snapshot.sources[1].revision, "a".repeat(40));

  const mutable = makeWorkSnapshot();
  delete mutable.sources[1].revision;
  assert.throws(
    () => validateWorkSnapshot(mutable),
    /full Git object ID or a content digest/u,
  );

  for (const revision of ["main", "latest", "current"]) {
    const named = makeWorkSnapshot();
    named.sources[1].revision = revision;
    assert.throws(
      () => validateWorkSnapshot(named),
      /full Git object ID or a content digest/u,
    );
  }

  for (const kind of ["conversation", "file", "url", "artifact"]) {
    const undigested = makeWorkSnapshot();
    undigested.sources[0] = {
      id: "source-1",
      kind,
      label: "Mutable source",
      locator: "mutable source",
      revision: "current",
    };
    assert.throws(
      () => validateWorkSnapshot(undigested),
      /requires a content digest/u,
    );
  }

  for (const capturedAt of ["2026-07-28", "2026-02-31T00:00:00Z"]) {
    const invalidDate = makeWorkSnapshot();
    invalidDate.capturedAt = capturedAt;
    assert.throws(
      () => validateWorkSnapshot(invalidDate),
      /must be an ISO date-time/u,
    );
  }
});

test("bounded structured input rejects symlinks and oversized files", async () => {
  const root = await mkdtemp(join(tmpdir(), "hope-work-input-"));
  const target = join(root, "target.json");
  const link = join(root, "link.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  await assert.rejects(readBoundedJson(link), /regular file/u);

  const large = join(root, "large.json");
  await writeFile(large, JSON.stringify({ value: "x".repeat(200) }));
  await assert.rejects(
    readBoundedJson(large, { maximumBytes: 64 }),
    /exceeds 64 bytes/u,
  );
});

test("bounded structured input rejects excessive nesting", async () => {
  const root = await mkdtemp(join(tmpdir(), "hope-work-depth-"));
  const inputPath = join(root, "deep.json");
  const nested = `${'{"next":'.repeat(160)}null${"}".repeat(160)}`;
  await writeFile(inputPath, nested);
  await assert.rejects(
    readBoundedJson(inputPath),
    /exceeds 128 nesting levels/u,
  );
});
