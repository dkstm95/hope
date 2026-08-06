import assert from "node:assert/strict";
import { realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test, { after } from "node:test";

import {
  completeAlignPolish,
  createAlignBrief,
  prepareAlignPolishCandidate,
  renderAlignFile,
  runAlign,
  ALIGN_MODEL_ADAPTER_CODE,
} from "../features/align/index.mjs";
import { ALIGN_LIMITS } from "../features/align/constants.mjs";
import { renderAlignSession } from "../features/align/render.mjs";
import {
  alignCandidateDigest,
  validateAlignState,
} from "../features/align/validate.mjs";
import {
  parseAlignArguments,
} from "../features/align/cli.mjs";
import {
  makeAlignApproval,
  makeAlignPreviewState,
  makeAlignState,
  makeLegacyAlignState,
  makePreviewV2AlignState,
} from "../test-support/align-fixture.mjs";
import { makePolishRun } from "../test-support/polish-fixture.mjs";
import {
  registerTestTemporaryDirectoryCleanup,
} from "../test-support/temporary-directory.mjs";

const createTestTemporaryDirectory = registerTestTemporaryDirectoryCleanup(after);

function makeAlignPolishRun({
  beforePath,
  candidateDigest,
  resultDigest = candidateDigest,
  status = "revised",
}) {
  const run = makePolishRun();
  const source = {
    id: "align-candidate",
    kind: "artifact",
    label: "Align approval candidate",
    locator: beforePath,
    digest: candidateDigest,
  };
  run.snapshot.sources = [
    source,
    {
      id: "request-1",
      kind: "conversation",
      label: "Polish authority",
      locator: "conversation turn 1",
      digest: `sha256:${"b".repeat(64)}`,
    },
  ];
  run.target.sourceIds = ["align-candidate"];
  run.preservation[0].sourceIds = ["align-candidate", "request-1"];
  run.plan[0].sourceIds = ["align-candidate"];
  run.outcome.changes[0].sourceIds = ["align-candidate"];
  run.verification[0].sourceIds = ["align-candidate"];
  run.outcome.outputSnapshot.sources = [{
    ...source,
    digest: resultDigest,
  }];
  if (status !== "revised") {
    run.plan = [];
    run.outcome.changes = [];
    run.application = {
      status: "not-needed",
      authoritySourceIds: [],
      beforeIdentityChecked: false,
      finalIdentityChecked: false,
    };
  }
  if (status === "no-change") {
    run.outcome.status = "no-change";
  }
  if (status === "needs-alignment") {
    run.verification = [];
    run.preservation[0].verificationIds = [];
    run.outcome = {
      status: "needs-alignment",
      outputSnapshot: null,
      removedSourceIds: [],
      changes: [],
      unresolved: ["A material wording choice needs user input."],
    };
  }
  return run;
}

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
  state.preview = {
    disposition: "required",
    rationale: "The dense UI fixture still needs its preview.",
    changedAspects: ["layout"],
    screens: [],
    frames: [],
  };
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
  assert.doesNotMatch(html, /class="phase-track"/u);
  assert.match(html, /id="theme-toggle"/u);
  assert.match(html, /class="toc"/u);
  assert.match(html, /Agreed understanding/u);
  assert.match(html, /Evidence/u);
  assert.doesNotMatch(html, />Risk</u);
  assert.doesNotMatch(html, />Resource use</u);
  assert.doesNotMatch(html, /sha256:cccc/u);
  assert.match(html, /id="theme-toggle" type="button" hidden/u);
  assert.equal(first.rendererVersion, 5);
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
    /Review and approve the shared understanding/u,
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
    /The work can move forward from this understanding/u,
  );
  assert.doesNotMatch(html, /before approving/u);
  assert.match(overviewMarkup(html), /href="#work">Review the work plan/u);
});

test("align namespaces authored fragment IDs", async () => {
  const state = makeAlignState({
    readiness: {
      state: "interviewing",
      rationale: "One question remains.",
    },
  });
  state.snapshot.sources[1].id = "agreement";
  state.records.facts[0].sourceIds = ["agreement"];
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
  assert.match(html, /id="agreement"/u);
  assert.match(html, /id="question-records"/u);
  assert.match(html, /href="#question-records"/u);
  assert.equal(html.match(/id="agreement"/gu)?.length, 1);
  assert.doesNotMatch(html, /id="source-agreement"/u);
});

test("align version 3 renders one canonical preview at wide and narrow viewports", async () => {
  const session = validateAlignState(makeAlignPreviewState());
  assert.equal(session.result.contractReady, true);
  assert.equal(session.resources.previewScreens, 1);
  assert.equal(session.resources.previewFrames, 2);
  const rendered = await renderAlignSession(session);
  const html = rendered.bytes.toString("utf8");
  assert.match(html, /class="preview-frame preview-frame-wide"/u);
  assert.match(html, /class="preview-frame preview-frame-narrow"/u);
  assert.equal(html.match(/Approve or revise this understanding/gu)?.length, 5);
  assert.match(html, /Text view/u);
  assert.match(html, /Alignment mockup · not the implementation/u);
  assert.match(html, /class="preview-frames preview-desktop"/u);
  assert.match(html, /class="preview-mobile"/u);
  assert.match(html, /Show desktop preview/u);
  assert.equal(
    html.match(/Repository architecture source: docs\/architecture\.md/gu)?.length,
    5,
  );
  assert.match(html, /class="preview-canvas" aria-hidden="true"/u);
  assert.doesNotMatch(html, /role="heading"/u);
});

test("align uses explicit primary agreements and keeps supporting detail available", async () => {
  const state = makeAlignPreviewState();
  state.records.decisions.push(
    {
      id: "decision-2",
      text: "Keep secondary evidence collapsed.",
      rationale: "The first reading path stays short.",
      sourceIds: ["conversation-1"],
    },
    {
      id: "decision-3",
      text: "Reveal every detail in print.",
      rationale: "Printed artifacts must preserve content.",
      sourceIds: ["conversation-1"],
    },
  );
  state.presentation.primaryAgreementIds = ["decision-1", "decision-2"];
  const session = validateAlignState(state);
  assert.equal(session.resources.primaryAgreements, 2);
  const rendered = await renderAlignSession(session);
  const html = rendered.bytes.toString("utf8");
  assert.match(html, /class="agreement-detail" id="agreement-decision-1"/u);
  assert.match(html, /class="agreement-detail" id="agreement-decision-2"/u);
  assert.match(
    overviewMarkup(html),
    /class="overview-agreements"[\s\S]*agreement-decision-1[\s\S]*agreement-decision-2/u,
  );
  assert.match(html, /User decision/u);
  assert.match(html, /AI proposals · Accepted/u);
  assert.match(html, /class="secondary-group additional-agreements"/u);
  assert.match(html, /Additional agreements<\/span><small>2<\/small>/u);
  assert.match(html, /id="agreement-decision-3"/u);
  assert.match(html, /class="secondary-group evidence-group" id="evidence"/u);
  assert.match(html, /class="work-item" id="work-slice-1"/u);
  assert.doesNotMatch(
    html,
    /class="secondary-group evidence-group" id="evidence" open/u,
  );

  const urgent = makeAlignState();
  urgent.assumptions[0].status = "open";
  urgent.uncertainties[0].classification = "research";
  urgent.readiness = {
    state: "interviewing",
    rationale: "An assumption and research question remain.",
  };
  const urgentHtml = (await renderAlignSession(
    validateAlignState(urgent),
  )).bytes.toString("utf8");
  assert.match(
    urgentHtml,
    /class="secondary-group assumption-group" id="assumptions" open/u,
  );
  assert.match(
    urgentHtml,
    /class="secondary-group uncertainty-group" id="uncertainties" open/u,
  );

  const unknown = makeAlignState();
  unknown.presentation.primaryAgreementIds = ["decision-missing"];
  assert.throws(
    () => validateAlignState(unknown),
    /must reference a settled decision or proposal/u,
  );

  const openOnly = makeAlignState({
    readiness: {
      state: "interviewing",
      rationale: "An open proposal remains.",
    },
  });
  openOnly.records.proposals[0].status = "open";
  openOnly.presentation.primaryAgreementIds = ["proposal-1"];
  assert.throws(
    () => validateAlignState(openOnly),
    /must reference a settled decision or proposal|must identify at least one settled agreement/u,
  );

  openOnly.presentation.primaryAgreementIds = ["decision-1"];
  const openHtml = (await renderAlignSession(
    validateAlignState(openOnly),
  )).bytes.toString("utf8");
  assert.match(openHtml, /class="unresolved-proposals"/u);
  assert.match(openHtml, /AI proposals · Open/u);
  assert.doesNotMatch(
    openHtml,
    /class="agreement-detail" id="agreement-proposal-1"/u,
  );
});

test("align preview readiness and safe node contract block incomplete UI work", () => {
  const required = makeAlignPreviewState({
    readiness: {
      state: "interviewing",
      rationale: "The visual preview is still missing.",
    },
    preview: {
      disposition: "required",
      rationale: "Layout changes need a preview.",
      changedAspects: ["layout"],
      screens: [],
      frames: [],
    },
  });
  assert.deepEqual(
    validateAlignState(required).result.blockers,
    ["preview-required"],
  );
  assert.throws(
    () => validateAlignState({
      ...required,
      readiness: { state: "ready-proposed", rationale: "Ready." },
    }),
    /preview-required/u,
  );

  const unsafe = makeAlignPreviewState();
  unsafe.preview.screens[0].root.style = "display:none";
  assert.throws(() => validateAlignState(unsafe), /root\.style is not allowed/u);

  const missingViewport = makeAlignPreviewState();
  missingViewport.preview.frames.pop();
  assert.throws(
    () => validateAlignState(missingViewport),
    /requires exactly one narrow frame/u,
  );
});

test("align keeps version 1 states readable without implicit preview migration", async () => {
  const state = makeLegacyAlignState();
  const session = validateAlignState(state);
  assert.equal(session.version, 1);
  assert.equal(session.preview, undefined);
  const rendered = await renderAlignSession(session);
  assert.doesNotMatch(rendered.bytes.toString("utf8"), /Visual preview/u);
});

test("align keeps version 2 preview states readable without presentation data", async () => {
  const state = makePreviewV2AlignState();
  const session = validateAlignState(state);
  assert.equal(session.version, 2);
  assert.equal(session.presentation, undefined);
  const html = (await renderAlignSession(session)).bytes.toString("utf8");
  assert.match(html, /Visual preview/u);
  assert.doesNotMatch(html, /Additional agreements/u);
  assert.equal(html.match(/class="agreement-detail"/gu)?.length, 2);
  assert.match(html, /AI proposals · Accepted/u);
  assert.throws(
    () => validateAlignState({
      ...state,
      presentation: { primaryAgreementIds: ["decision-1"] },
    }),
    /versions 1 and 2 cannot contain presentation data/u,
  );
});

test("align renders a dense valid state within the artifact ceiling", async () => {
  const session = validateAlignState(makeDenseAlignState());
  assert.ok(session.resources.jsonBytes < ALIGN_LIMITS.inputBytes);
  assert.ok(session.resources.authoredStringBytes < ALIGN_LIMITS.proseBytes);
  const rendered = await renderAlignSession(session);
  assert.ok(rendered.bytes.length > 1024 * 1024);
  assert.ok(rendered.bytes.length <= ALIGN_LIMITS.artifactBytes);
});

test("align publishes a new artifact without replacing an existing path", async () => {
  const root = await createTestTemporaryDirectory("hope-align-test-");
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
  assert.match(brief.polishing[0], /before asking for approval/u);
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

test("align prepares one exact contract-ready target for Polish", async () => {
  const state = makeAlignState();
  const digest = alignCandidateDigest(validateAlignState(state));
  const candidate = await prepareAlignPolishCandidate(
    "/tmp/align-candidate.json",
    {
      readInput: async () => ({
        digest,
        fileBytes: 1,
        value: state,
      }),
    },
  );
  assert.equal(candidate.feature, "align-polish-candidate");
  assert.equal(candidate.source.digest, digest);
  assert.equal(candidate.source.kind, "artifact");
  assert.match(candidate.next, /Run Hope Polish once/u);
  assert.deepEqual(
    parseAlignArguments([
      "polish-candidate",
      "--input",
      "/tmp/align-candidate.json",
    ]),
    {
      command: "polish-candidate",
      inputPath: "/tmp/align-candidate.json",
    },
  );

  await assert.rejects(
    prepareAlignPolishCandidate("/tmp/align-candidate.json", {
      readInput: async () => ({
        digest,
        fileBytes: 1,
        value: makeAlignState({
          readiness: {
            state: "interviewing",
            rationale: "The candidate is not ready.",
          },
        }),
      }),
    }),
    /contract-ready, ready-proposed candidate/u,
  );
});

test("align consumes one revised Polish result and rejects a repeat", async () => {
  const root = await createTestTemporaryDirectory("hope-align-polish-");
  const beforePath = join(root, "before.json");
  const afterPath = join(root, "after.json");
  const polishPath = join(root, "polish.json");
  const before = makeAlignState();
  const after = makeAlignState({
    revision: before.revision + 1,
    changes: [
      ...before.changes,
      {
        round: before.interviewRounds,
        summary: "Polish removed repeated wording without changing the contract.",
      },
    ],
  });
  const candidateDigest = alignCandidateDigest(validateAlignState(before));
  const resultDigest = alignCandidateDigest(validateAlignState(after));
  const polish = makeAlignPolishRun({
    beforePath,
    candidateDigest,
    resultDigest,
  });
  await Promise.all([
    writeFile(beforePath, JSON.stringify(before), { mode: 0o600 }),
    writeFile(afterPath, JSON.stringify(after), { mode: 0o600 }),
    writeFile(polishPath, JSON.stringify(polish), { mode: 0o600 }),
  ]);
  const completed = await completeAlignPolish({
    beforePath,
    afterPath,
    polishPath,
  });
  assert.equal(completed.record.outcome, "revised");
  assert.equal(completed.state.polish.resultDigest, resultDigest);
  assert.equal(validateAlignState(completed.state).polish.outcome, "revised");

  await writeFile(beforePath, JSON.stringify(completed.state), { mode: 0o600 });
  await assert.rejects(
    prepareAlignPolishCandidate(beforePath),
    (error) => error.code === "HOPE_ALIGN_POLISH_ALREADY_COMPLETED",
  );
  assert.deepEqual(
    parseAlignArguments([
      "complete-polish",
      "--before",
      beforePath,
      "--polish",
      polishPath,
      "--after",
      afterPath,
    ]),
    {
      command: "complete-polish",
      beforePath,
      polishPath,
      afterPath,
    },
  );
});

test("align consumes no-change and needs-alignment Polish results", async () => {
  const root = await createTestTemporaryDirectory("hope-align-polish-outcomes-");
  const beforePath = join(root, "before.json");
  const noChangePath = join(root, "no-change.json");
  const needsPath = join(root, "needs-alignment.json");
  const afterPath = join(root, "after.json");
  const before = makeAlignState();
  const candidateDigest = alignCandidateDigest(validateAlignState(before));
  await writeFile(beforePath, JSON.stringify(before), { mode: 0o600 });

  const noChange = makeAlignPolishRun({
    beforePath,
    candidateDigest,
    status: "no-change",
  });
  await writeFile(noChangePath, JSON.stringify(noChange), { mode: 0o600 });
  const unchanged = await completeAlignPolish({
    beforePath,
    polishPath: noChangePath,
  });
  assert.equal(unchanged.record.outcome, "no-change");
  assert.equal(unchanged.record.candidateDigest, unchanged.record.resultDigest);

  const after = makeAlignState({
    revision: before.revision + 1,
    records: {
      ...before.records,
      openQuestions: [
        {
          id: "question-polish",
          question: "Which meaning should the repeated sentence preserve?",
          whyItMatters: "Removing it could change the product contract.",
          recommendation: "Ask the person before revising.",
          options: [
            { label: "Keep", effect: "Preserves the current wording." },
            { label: "Remove", effect: "Treats it as accidental repetition." },
          ],
        },
      ],
    },
    readiness: {
      state: "interviewing",
      rationale: "Polish found a material ambiguity.",
    },
  });
  await writeFile(afterPath, JSON.stringify(after), { mode: 0o600 });
  const needsAlignment = makeAlignPolishRun({
    beforePath,
    candidateDigest,
    status: "needs-alignment",
  });
  await writeFile(needsPath, JSON.stringify(needsAlignment), { mode: 0o600 });
  const stopped = await completeAlignPolish({
    beforePath,
    afterPath,
    polishPath: needsPath,
  });
  assert.equal(stopped.record.outcome, "needs-alignment");
  assert.equal(stopped.state.readiness.state, "interviewing");
});
