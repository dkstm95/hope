import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateChangeTitle } from "../tools/check-change-title.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tool = join(root, "tools/check-change-title.mjs");

test("change titles return the validated title line", () => {
  assert.equal(
    validateChangeTitle("feat(align): skip artifacts for same-session work"),
    "feat(align): skip artifacts for same-session work",
  );
  assert.equal(
    validateChangeTitle(
      "fix(release)!: reject versions that hide package changes\n\nWhy: keep release intent visible.",
    ),
    "fix(release)!: reject versions that hide package changes",
  );
  assert.equal(
    validateChangeTitle("ci(repo): enforce AI-readable change titles (#96)"),
    "ci(repo): enforce AI-readable change titles (#96)",
  );
  assert.equal(
    validateChangeTitle("docs(readme): README links the release policy"),
    "docs(readme): README links the release policy",
  );
  assert.equal(
    validateChangeTitle("test(repo): change-title cases cover suffixes."),
    "test(repo): change-title cases cover suffixes.",
  );
});

test("change titles reject inconsistent or unsafe subjects", () => {
  const invalid = [
    ["feat: skip artifacts for same-session work", /<type>\(<scope>\)/u],
    ["feature(align): skip artifacts for same-session work", /type must be one of/u],
    ["feat(Align): skip artifacts for same-session work", /<type>\(<scope>\)/u],
    [" feat(align): skip artifacts for same-session work", /whitespace/u],
    ["feat(align):  skip artifacts for same-session work", /<type>\(<scope>\)/u],
    ["feat(align): \u00a0skip artifacts for same-session work", /<type>\(<scope>\)/u],
    ["feat(align): ship output\twith a tab", /control/u],
    ["feat(align): ship output\u001b[31m", /control/u],
    ["feat(align): ship\u2028output", /control/u],
    ["feat(align): ship\u2029output", /control/u],
    ["feat(align): ship output\u202ereversed", /bidirectional/u],
  ];

  for (const [title, expected] of invalid) {
    assert.throws(() => validateChangeTitle(title), expected, title);
  }
});

test("the title checker reads positional and CI input and fails closed", () => {
  const positionalTitle = "ci(repo): validate a supplied change title";
  const positional = spawnSync(process.execPath, [tool, positionalTitle], {
    encoding: "utf8",
  });
  assert.equal(positional.status, 0);
  assert.equal(positional.stdout, `Change title is valid: ${positionalTitle}\n`);

  const valid = spawnSync(process.execPath, [tool], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOPE_CHANGE_TITLE: "ci(verify): reject malformed change titles",
    },
  });
  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /Change title is valid/u);

  const invalid = spawnSync(process.execPath, [tool], {
    encoding: "utf8",
    env: { ...process.env, HOPE_CHANGE_TITLE: "update checks" },
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /change-title:/u);

  const missing = spawnSync(process.execPath, [tool], {
    encoding: "utf8",
    env: { ...process.env, HOPE_CHANGE_TITLE: "" },
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /required/u);
});

test("the title workflow runs trusted code for pull request titles", async () => {
  const workflow = await readFile(
    join(root, ".github/workflows/change-title.yml"),
    "utf8",
  );
  const verify = await readFile(join(root, ".github/workflows/verify.yml"), "utf8");
  const trustedCheckout = workflow.indexOf(
    "ref: ${{ github.event.pull_request.base.sha || github.sha }}",
  );
  const titleCheck = workflow.indexOf("node tools/check-change-title.mjs");

  assert.match(workflow, /pull_request_target:/u);
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited\]/u);
  assert.match(
    workflow,
    /HOPE_CHANGE_TITLE:.*pull_request\.title.*head_commit\.message/u,
  );
  assert.equal(
    workflow.match(/uses: actions\/checkout@/gu)?.length,
    1,
    "title workflow must have one checkout",
  );
  assert.ok(trustedCheckout >= 0, "title workflow must check out trusted code");
  assert.ok(titleCheck > trustedCheckout, "title workflow must run the trusted checker");
  assert.doesNotMatch(
    workflow,
    /github\.event\.pull_request\.head|github\.head_ref|refs\/pull\//u,
  );
  assert.doesNotMatch(verify, /check-change-title|pull_request:\s+types:/u);
});
