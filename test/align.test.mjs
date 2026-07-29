import assert from "node:assert/strict";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createAlignBrief,
  renderAlignFile,
  runAlign,
  ALIGN_MODEL_ADAPTER_CODE,
} from "../features/align/index.mjs";
import { renderAlignSession } from "../features/align/render.mjs";
import { validateAlignState } from "../features/align/validate.mjs";
import {
  parseAlignArguments,
} from "../features/align/cli.mjs";
import {
  makeAlignApproval,
  makeAlignState,
} from "../test-support/align-fixture.mjs";

test("align derives readiness without claiming perfect understanding", () => {
  const session = validateAlignState(makeAlignState());
  assert.equal(session.result.contractReady, true);
  assert.equal(session.result.readyToImplement, false);
  assert.deepEqual(session.result.blockers, []);
  assert.equal(session.resources.interviewRounds, 2);

  const interviewing = makeAlignState({
    records: {
      ...makeAlignState().records,
      openQuestions: [
        {
          id: "question-1",
          question: "Which recovery policy should apply?",
          whyItMatters: "It changes failure behavior.",
          recommendation: "Use the existing policy.",
          options: [
            { label: "Existing", effect: "Preserves current behavior." },
            { label: "New", effect: "Adds a new recovery path." },
          ],
        },
      ],
    },
    readiness: {
      state: "interviewing",
      rationale: "A material policy question remains.",
    },
  });
  assert.deepEqual(
    validateAlignState(interviewing).result.blockers,
    ["open-questions"],
  );
});

test("align rejects a premature Ready state and invented approval", () => {
  const state = makeAlignState({
    readiness: {
      state: "approved",
      rationale: "The person approved the current state.",
    },
  });
  state.records.openQuestions.push({
    id: "question-1",
    question: "Which option?",
    whyItMatters: "It changes the product.",
    recommendation: "Choose A.",
    options: [
      { label: "A", effect: "Small." },
      { label: "B", effect: "Large." },
    ],
  });
  assert.throws(
    () => validateAlignState(state, { approval: makeAlignApproval() }),
    /cannot be approved while blockers remain: open-questions/u,
  );

  const authoredApproval = makeAlignState({
    readiness: {
      state: "approved",
      rationale: "Hope proposed readiness.",
    },
    approval: makeAlignApproval(),
  });
  assert.throws(
    () => validateAlignState(authoredApproval),
    /approval is not allowed|trusted approval record/u,
  );

  const approved = validateAlignState(
    makeAlignState({
      readiness: {
        state: "approved",
        rationale: "The person approved the current state.",
      },
    }),
    { approval: makeAlignApproval() },
  );
  assert.equal(approved.result.readyToImplement, true);
  assert.equal(approved.readiness.approval.sourceId, "conversation-1");

  assert.throws(
    () => validateAlignState(
      makeAlignState({
        readiness: {
          state: "approved",
          rationale: "The person approved the current state.",
        },
      }),
      {
        approval: {
          ...makeAlignApproval(),
          sourceDigest: `sha256:${"d".repeat(64)}`,
        },
      },
    ),
    /must match the captured source/u,
  );
});

test("align rendering is deterministic and keeps authored content inert", async () => {
  const state = makeAlignState({ title: "</title><script>alert(1)</script>" });
  state.understanding.goal = "<img src=x onerror=alert(1)>";
  const session = validateAlignState(state);
  const [first, second] = await Promise.all([
    renderAlignSession(session),
    renderAlignSession(session),
  ]);
  assert.deepEqual(first.bytes, second.bytes);
  const html = first.bytes.toString("utf8");
  assert.match(html, /HOPE · ALIGN/u);
  assert.match(html, /Content-Security-Policy/u);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(html, /<img src=x/u);
  assert.match(html, /data:font\/woff2;base64/u);
  assert.match(html, /User decisions/u);
  assert.match(html, /Repository facts/u);
  assert.match(html, /AI proposals/u);
});

test("align publishes a new artifact without replacing an existing path", async () => {
  const root = await mkdtemp(join(tmpdir(), "hope-align-test-"));
  const inputPath = join(root, "align.json");
  const outputPath = join(root, "alignment.html");
  await writeFile(inputPath, `${JSON.stringify(makeAlignState(), null, 2)}\n`);
  const result = await renderAlignFile({ inputPath, outputPath });
  assert.equal(result.outputPath, await realpath(outputPath));
  assert.equal(result.result.readyToImplement, false);
  await assert.rejects(
    renderAlignFile({ inputPath, outputPath }),
    /did not replace/u,
  );
});

test("align brief and CLI keep risk-adaptive behavior in the core", async () => {
  const brief = await createAlignBrief(
    { risk: "high", ui: true },
    {
      loadWritingStandard: async () => "shared standard\n",
      resolveSettings: async () => ({ locale: "en-US", theme: "dark" }),
    },
  );
  assert.equal(brief.feature, "align");
  assert.equal(brief.risk, "high");
  assert.equal(brief.ui, true);
  assert.equal(brief.writingStandard.text, "shared standard\n");
  assert.match(brief.rendering, /related decisions are settled/u);
  assert.deepEqual(
    parseAlignArguments(["brief", "--risk", "low", "--ui", "no"]),
    {
      command: "brief",
      hostLocale: undefined,
      locale: undefined,
      risk: "low",
      theme: undefined,
      ui: false,
    },
  );
  assert.throws(runAlign, (error) => error.code === ALIGN_MODEL_ADAPTER_CODE);
});
