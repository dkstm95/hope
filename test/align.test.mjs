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
import { ALIGN_LIMITS } from "../features/align/constants.mjs";
import { renderAlignSession } from "../features/align/render.mjs";
import { validateAlignState } from "../features/align/validate.mjs";
import {
  parseAlignArguments,
} from "../features/align/cli.mjs";
import {
  makeAlignApproval,
  makeAlignState,
} from "../test-support/align-fixture.mjs";

function overviewMarkup(html) {
  const start = html.indexOf('<section class="overview"');
  const end = html.indexOf("</section>", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return html.slice(start, end);
}

function makeDenseAlignState() {
  const state = makeAlignState();
  const many = (count, create) => Array.from({ length: count }, (_, index) => (
    create(index)
  ));
  state.ui = true;
  state.readiness = {
    state: "interviewing",
    rationale: "Material questions remain.",
  };
  state.understanding = {
    ...state.understanding,
    goal: "x".repeat(16_000),
    success: many(64, (index) => `success ${index}`),
    inScope: many(64, (index) => `in ${index}`),
    outOfScope: many(64, (index) => `out ${index}`),
    scenarios: many(48, (index) => ({
      id: `scenario-${index + 1}`,
      kind: "edge",
      situation: `situation ${index}`,
      expected: `expected ${index}`,
    })),
  };
  state.records = {
    facts: many(64, (index) => ({
      id: `fact-${index + 1}`,
      text: `fact ${index}`,
      sourceIds: ["repository-1"],
    })),
    decisions: many(64, (index) => ({
      id: `decision-${index + 1}`,
      text: `decision ${index}`,
      rationale: `rationale ${index}`,
      sourceIds: ["conversation-1"],
    })),
    proposals: many(64, (index) => ({
      id: `proposal-${index + 1}`,
      text: `proposal ${index}`,
      rationale: `rationale ${index}`,
      status: "accepted",
    })),
    openQuestions: many(64, (index) => ({
      id: `question-${index + 1}`,
      question: `question ${index}`,
      whyItMatters: `impact ${index}`,
      recommendation: `recommendation ${index}`,
      options: many(8, (option) => ({
        label: `option ${option}`,
        effect: `effect ${option}`,
      })),
    })),
  };
  state.assumptions = many(64, (index) => ({
    id: `assumption-${index + 1}`,
    text: `assumption ${index}`,
    origin: "ai",
    status: "confirmed",
    sourceIds: [],
  }));
  state.uncertainties = many(64, (index) => ({
    id: `uncertainty-${index + 1}`,
    text: `uncertainty ${index}`,
    classification: "deferred",
    nextStep: `next ${index}`,
  }));
  state.perspectives = state.perspectives.map((perspective, perspectiveIndex) => ({
    ...perspective,
    state: "active",
    items: many(64, (index) => ({
      title: `perspective ${perspectiveIndex} item ${index}`,
      detail: `detail ${index}`,
    })),
  }));
  state.slices = many(48, (index) => ({
    id: `slice-${index + 1}`,
    title: `slice ${index}`,
    userChange: `change ${index}`,
    scope: `scope ${index}`,
    verification: `verify ${index}`,
    failureRecovery: `recover ${index}`,
  }));
  state.changes = many(64, (index) => ({
    round: 1,
    summary: `change ${index}`,
  }));
  return state;
}

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
  assert.match(html, /script-src 'sha256-/u);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(html, /<img src=x/u);
  assert.match(html, /data:font\/woff2;base64/u);
  assert.match(html, /id="overview"/u);
  assert.match(html, /class="phase-track"/u);
  assert.match(html, /id="theme-toggle"/u);
  assert.match(html, /class="toc-desktop"/u);
  assert.match(html, /User decisions/u);
  assert.match(html, /Repository facts/u);
  assert.match(html, /AI proposals/u);
  assert.equal(first.rendererVersion, 2);
});

test("align puts the next material decision on the first screen", async () => {
  const state = makeAlignState({
    locale: "ko-KR",
    readiness: {
      state: "interviewing",
      rationale: "실행 시점을 정해야 합니다.",
    },
  });
  state.records.openQuestions.push({
    id: "question-1",
    question: "첫 버전은 언제 실행할까요?",
    whyItMatters: "완료 시점을 잘못 추측하면 불필요한 결과가 생깁니다.",
    recommendation: "사용자가 요청할 때만 실행합니다.",
    options: [
      { label: "수동 실행", effect: "완료 시점을 사용자가 정합니다." },
      { label: "자동 실행", effect: "변경마다 새 결과를 만듭니다." },
    ],
  });
  const rendered = await renderAlignSession(validateAlignState(state));
  const html = rendered.bytes.toString("utf8");
  const overview = overviewMarkup(html);
  assert.match(overview, /결정 필요/u);
  assert.match(overview, /첫 버전은 언제 실행할까요\?/u);
  assert.match(overview, /href="#question-question-1"/u);
  assert.match(overview, /답할 질문이 남아 있음/u);
  assert.doesNotMatch(overview, />open-questions</u);
  assert.doesNotMatch(overview, /JSON 크기/u);
});

test("align sends a no-question next action to the material blocker", async () => {
  const base = makeAlignState();
  const state = makeAlignState({
    understanding: {
      ...base.understanding,
      success: [],
    },
    readiness: {
      state: "interviewing",
      rationale: "Success is not measurable yet.",
    },
  });
  const rendered = await renderAlignSession(validateAlignState(state));
  const overview = overviewMarkup(rendered.bytes.toString("utf8"));
  assert.match(overview, /Add measurable success conditions/u);
  assert.match(overview, /href="#scope"/u);
  assert.doesNotMatch(overview, /href="#records">Review this gap/u);
});

test("align copy follows the approval phase", async () => {
  const ready = await renderAlignSession(validateAlignState(makeAlignState()));
  assert.match(
    ready.bytes.toString("utf8"),
    /Review the recorded decisions, then approve or revise this understanding/u,
  );

  const approvedState = makeAlignState({
    readiness: {
      state: "approved",
      rationale: "The person approved the current state.",
    },
  });
  const approved = await renderAlignSession(validateAlignState(approvedState, {
    approval: makeAlignApproval(),
  }));
  const html = approved.bytes.toString("utf8");
  assert.match(
    html,
    /Approval is recorded\. Use these decisions as the implementation contract/u,
  );
  assert.doesNotMatch(html, /before approving/u);
  assert.match(overviewMarkup(html), /href="#slices">Review the work plan/u);
});

test("align namespaces authored fragment IDs", async () => {
  const state = makeAlignState({
    readiness: {
      state: "interviewing",
      rationale: "One question remains.",
    },
  });
  state.snapshot.sources[1].id = "sources";
  state.records.facts[0].sourceIds = ["sources"];
  state.records.openQuestions.push({
    id: "records",
    question: "Which record should lead?",
    whyItMatters: "It changes the reading order.",
    recommendation: "Keep user decisions first.",
    options: [
      { label: "Decisions", effect: "Keeps user authority visible." },
      { label: "Facts", effect: "Leads with repository evidence." },
    ],
  });
  const rendered = await renderAlignSession(validateAlignState(state));
  const html = rendered.bytes.toString("utf8");
  assert.match(html, /id="records"/u);
  assert.match(html, /id="question-records"/u);
  assert.match(html, /href="#question-records"/u);
  assert.match(html, /id="sources"/u);
  assert.match(html, /id="source-sources"/u);
  assert.equal(html.match(/id="records"/gu)?.length, 1);
  assert.equal(html.match(/id="sources"/gu)?.length, 1);
});

test("align renders a dense valid state within the artifact ceiling", async () => {
  const session = validateAlignState(makeDenseAlignState());
  assert.ok(session.resources.jsonBytes < ALIGN_LIMITS.inputBytes);
  assert.ok(session.resources.authoredStringBytes < ALIGN_LIMITS.proseBytes);
  const rendered = await renderAlignSession(session);
  assert.ok(rendered.bytes.length > 4 * 1024 * 1024);
  assert.ok(rendered.bytes.length <= ALIGN_LIMITS.artifactBytes);
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
