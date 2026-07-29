import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { publishArtifact } from "../features/artifact/index.mjs";

test("artifact failure cleanup never removes a replaced directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "hope-artifact-cleanup-"));
  let replacementDirectory;
  let ownedDirectory;
  await assert.rejects(
    publishArtifact(Buffer.from("review"), {
      temporaryRoot: root,
      linkFile: async (source) => {
        replacementDirectory = dirname(source);
        ownedDirectory = `${replacementDirectory}-moved`;
        await rename(replacementDirectory, ownedDirectory);
        await mkdir(replacementDirectory);
        await writeFile(
          join(replacementDirectory, "unrelated.txt"),
          "keep me",
          "utf8",
        );
        throw new Error("publication failed after a directory swap");
      },
    }),
    /publication failed after a directory swap/u,
  );

  assert.equal(
    await readFile(join(replacementDirectory, "unrelated.txt"), "utf8"),
    "keep me",
  );
  await access(ownedDirectory);
});
