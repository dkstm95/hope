import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function makeTrackedDirectories() {
  let cleanup;
  const create = registerTestTemporaryDirectoryCleanup((registered) => {
    assert.equal(cleanup, undefined);
    cleanup = registered;
  });
  return {
    cleanup: async () => await cleanup(),
    create,
  };
}

test("test temporary directories are removed with their contents", async () => {
  const tracked = makeTrackedDirectories();
  const path = await tracked.create("hope-temporary-directory-test-");
  await writeFile(join(path, "owned.txt"), "owned\n", "utf8");

  await tracked.cleanup();

  await assert.rejects(access(path), /ENOENT/u);
});

test("test temporary directory prefixes cannot contain a path", async () => {
  await assert.rejects(
    createTestTemporaryDirectory("../hope-outside-"),
    /must be one name ending in '-'/u,
  );
});

test("cleanup preserves a replaced path and continues with other owned directories", async () => {
  const tracked = makeTrackedDirectories();
  const replaced = await tracked.create("hope-temporary-directory-replaced-");
  const removable = await tracked.create("hope-temporary-directory-removable-");
  const marker = join(replaced, "replacement.txt");

  try {
    await rm(replaced, { recursive: true });
    await mkdir(replaced);
    await writeFile(marker, "keep\n", "utf8");

    await assert.rejects(tracked.cleanup(), (error) => {
      assert(error instanceof AggregateError);
      assert.match(error.errors[0].message, /changed before cleanup/u);
      return true;
    });
    assert.equal(await readFile(marker, "utf8"), "keep\n");
    await assert.rejects(access(removable), /ENOENT/u);
  } finally {
    await rm(replaced, { force: true, recursive: true });
  }
});

test("separate registrations clean only their own directories", async () => {
  const first = makeTrackedDirectories();
  const second = makeTrackedDirectories();
  const firstPath = await first.create("hope-temporary-directory-first-");
  const secondPath = await second.create("hope-temporary-directory-second-");

  try {
    await first.cleanup();
    await assert.rejects(access(firstPath), /ENOENT/u);
    await access(secondPath);
  } finally {
    await second.cleanup();
  }
  await assert.rejects(access(secondPath), /ENOENT/u);
});

for (const shouldFail of [false, true]) {
  test(`registered cleanup runs after a ${shouldFail ? "failing" : "passing"} child test`, async () => {
    const fixture = await createTestTemporaryDirectory(
      `hope-temporary-directory-child-${shouldFail ? "fail" : "pass"}-`,
    );
    const childTest = join(fixture, "child.test.mjs");
    const recordPath = join(fixture, "created-path.txt");
    const helperUrl = pathToFileURL(
      resolve(root, "test-support/temporary-directory.mjs"),
    ).href;
    await writeFile(
      childTest,
      `import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test, { after } from "node:test";
import { registerTestTemporaryDirectoryCleanup } from ${JSON.stringify(helperUrl)};

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

test("child lifecycle", async () => {
  const path = await createTestTemporaryDirectory("hope-temporary-directory-lifecycle-");
  await writeFile(process.env.HOPE_TEMP_RECORD, path, "utf8");
  assert.equal(${JSON.stringify(shouldFail)}, false);
});
`,
      "utf8",
    );

    const childEnvironment = {
      ...process.env,
      HOPE_TEMP_RECORD: recordPath,
    };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      ["--test", childTest],
      {
        encoding: "utf8",
        env: childEnvironment,
      },
    );
    assert.equal(result.status, shouldFail ? 1 : 0, result.stderr || result.stdout);
    const createdPath = await readFile(recordPath, "utf8");
    await assert.rejects(access(createdPath), /ENOENT/u);
  });
}
