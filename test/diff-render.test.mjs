import assert from "node:assert/strict";
import test from "node:test";

import {
  CODE_THEME,
  COLORS,
  LAYOUT,
  TYPE,
} from "../design/tokens.mjs";
import { digestJson } from "../features/diff/hash.mjs";
import { renderReview } from "../features/diff/render.mjs";
import { validateAnalysis } from "../features/diff/validate.mjs";
import {
  makeAnalysis,
  makeSnapshot,
  makeTeachingBehavior,
} from "../test-support/diff-fixture.mjs";

const runId = "3".repeat(32);

function withLocaleSource(snapshot, localeSource) {
  const { digest: _digest, ...value } = snapshot;
  const updated = {
    ...value,
    settings: {
      ...value.settings,
      localeSource,
    },
  };
  return Object.freeze({
    ...updated,
    digest: digestJson(updated),
  });
}

test("rendering is byte-identical and keeps untrusted content inert", async () => {
  const snapshot = makeSnapshot({
    title: '</title><script src="https://evil.example/x.js"></script>',
  });
  const analysis = makeAnalysis(snapshot, runId);
  analysis.coreChange.details[0].text = "<img src=x onerror=alert(1)>";
  analysis.coreChange.details.push({
    ...analysis.coreChange.details[0],
    text: "A second parallel claim stays easy to scan.",
  });
  analysis.background = [
    {
      ...analysis.coreChange.details[0],
      title: "Existing behavior",
    },
    {
      ...analysis.coreChange.details[0],
      title: "Required context",
    },
  ];
  const review = validateAnalysis(analysis, snapshot, { runId });
  const [first, second] = await Promise.all([
    renderReview(review),
    renderReview(review),
  ]);
  assert.deepEqual(first.bytes, second.bytes);
  const html = first.bytes.toString("utf8");
  assert.doesNotMatch(html, /<script src="https:\/\/evil/u);
  assert.match(html, /&lt;script src=/u);
  assert.match(html, /Content-Security-Policy/u);
  assert.match(html, /default-src &#39;none&#39;|default-src 'none'/u);
  assert.match(html, /data:font\/woff2;base64/u);
  assert.match(html, new RegExp(`--accent:${COLORS.light.accent}`, "u"));
  assert.match(
    html,
    new RegExp(`--component-border:${COLORS.light.componentBorder}`, "u"),
  );
  assert.match(html, new RegExp(`--code-bg:${CODE_THEME.light.background}`, "u"));
  assert.match(html, new RegExp(`--code-fg:${CODE_THEME.dark.foreground}`, "u"));
  assert.match(html, new RegExp(`max-width: ${LAYOUT.contentWidth}px`, "u"));
  assert.match(
    html,
    new RegExp(`font: 300 ${TYPE.body.wide.fontSize}px/${TYPE.body.wide.lineHeight}`, "u"),
  );
  assert.match(html, /font-family: "Hope Sans"/u);
  assert.match(html, /font-family: "Hope Code"/u);
  assert.match(html, /font-weight: 400;/u);
  assert.equal((html.match(/@font-face/gu) ?? []).length, 4);
  assert.match(html, /\.status\.kind-verify \{/u);
  assert.doesNotMatch(html, /\n\.kind-verify,/u);
  assert.match(html, /aria-label="Switch to dark mode"/u);
  assert.doesNotMatch(html, /aria-pressed=/u);
  assert.match(html, /\.theme-icon\[hidden\] \{ display: none; \}/u);
  assert.match(html, /toggleAttribute\("hidden"/u);
  assert.doesNotMatch(html, /data-copy-section/u);
  assert.doesNotMatch(html, /class="copy-link"/u);
  assert.doesNotMatch(html, />Change theme</u);
  const header = html.match(/<header class="topbar">[\s\S]*?<\/header>/u)?.[0] ?? "";
  assert.doesNotMatch(html, /class="pr-hero"/u);
  assert.match(
    html,
    /<section class="synopsis" id="synopsis"[\s\S]*?<header class="synopsis-head">[\s\S]*?<h1 id="review-title">/u,
  );
  assert.match(html, /rel="noreferrer noopener" target="_blank"/u);
  assert.doesNotMatch(header, /<h1>/u);
  assert.match(header, /<details class="toc-mobile">/u);
  assert.match(header, /class="toc-mobile-panel"/u);
  assert.match(header, /class="toc-icon"/u);
  assert.match(header, />example\/hope · PR #142</u);
  const synopsisHead = html.match(
    /<header class="synopsis-head">[\s\S]*?<\/header>/u,
  )?.[0] ?? "";
  assert.doesNotMatch(synopsisHead, /example\/hope · PR #142/u);
  assert.doesNotMatch(synopsisHead, /<a /u);
  assert.match(synopsisHead, /<dt>Commit<\/dt>\s*<dd><code>bbbbbbbb<\/code><\/dd>/u);
  assert.match(
    synopsisHead,
    /<dt>Captured<\/dt>\s*<dd><time[^>]+>2026-07-23 00:00 UTC<\/time><\/dd>/u,
  );
  assert.match(
    html,
    /<h2 class="sr-only" id="synopsis-title">Summary<\/h2>/u,
  );
  assert.doesNotMatch(html, /class="pr-freshness"/u);
  assert.doesNotMatch(
    html,
    /This offline file does not track later pull request changes\./u,
  );
  assert.doesNotMatch(
    html.match(/<main class="main"[\s\S]*?<\/main>/u)?.[0] ?? "",
    /<details class="toc-mobile">/u,
  );
  assert.match(html, /\.toc-mobile-panel \{[\s\S]*?position: absolute;/u);
  assert.match(html, /if\(event\.target\.closest\("a"\)\)toc\.open=false/u);
  assert.match(html, /<section class="synopsis" id="synopsis"/u);
  assert.match(html, /class="toc-synopsis"><a href="#synopsis"/u);
  assert.match(html, /\.section-heading h2::before/u);
  assert.match(html, /content: counter\(review-section\)/u);
  assert.doesNotMatch(html, /<details class="evidence" open>/u);
  assert.match(html, /<pre class="syntax-code"><code aria-label=/u);
  assert.match(html, /class="syntax-token-[a-f0-9]{16}"/u);
  assert.doesNotMatch(html, /\/blob\/[^"]+\/src\/retry\.js#L/u);
  assert.match(html, /:root\[data-theme="dark"\] \.syntax-token-[a-f0-9]{16}/u);
  assert.doesNotMatch(html, /<span[^>]+style=/u);
  assert.match(html, /class="review-item kind-verify review-item-compact"/u);
  assert.doesNotMatch(html, /class="review-result/u);
  assert.doesNotMatch(html, /class="review-count/u);
  assert.doesNotMatch(html, /class="review-kind-counts/u);
  assert.match(html, /<ul class="review-items review-items-compact" role="list"><li><article/u);
  assert.match(html, /<ul class="review-items review-items-full" role="list"><li><article/u);
  assert.match(html, /id="summary-review-item-1"/u);
  assert.match(html, /id="summary-review-item-1"[\s\S]*?<h4><a href="#review-item-1">/u);
  const compactItem = html.match(
    /<article class="review-item kind-verify review-item-compact"[\s\S]*?<\/article>/u,
  )?.[0] ?? "";
  assert.doesNotMatch(compactItem, /class="item-basis"/u);
  assert.doesNotMatch(compactItem, /The changed error reaches callers/u);
  assert.match(
    compactItem,
    /<span class="status kind-verify">Verification needed<\/span>/u,
  );
  assert.match(compactItem, /<span class="importance">Medium<\/span>/u);
  assert.match(html, /\.review-item-compact \.status::before/u);
  assert.match(html, /\.review-item-compact \.importance::before/u);
  assert.match(
    html,
    /\.review-item:not\(\.review-item-compact\) \.item-head \{\s*margin-bottom: 8px;/u,
  );
  assert.match(
    html,
    /\.review-items-compact > li \+ li \{ margin-top: [^;]+; \}/u,
  );
  assert.match(
    html,
    /\.review-items-compact > li:first-child \.review-item-compact \{ padding-top: 0; \}/u,
  );
  const compactItemRule = html.match(/\.review-item-compact \{([^}]*)\}/u)?.[1] ?? "";
  assert.doesNotMatch(compactItemRule, /border-bottom:/u);
  assert.match(
    html,
    /<div class="synopsis-row synopsis-review">\s*<h3>Review result<\/h3>\s*<div class="synopsis-value synopsis-review-value">/u,
  );
  assert.match(html, /<ul class="claim-list core-detail-list">/u);
  assert.match(html, /<ul class="titled-claim-list"><li><article/u);
  assert.match(html, /<ol class="code-step-list">/u);
  assert.match(html, /<ul class="scope-impact-list"><li><a href="#scope-limit-1">/u);
  assert.match(html, /counter\(code-step, decimal-leading-zero\)/u);
  assert.equal((html.match(/id="review-item-1"/gu) ?? []).length, 1);
  assert.match(html, /class="item-basis"/u);
  assert.match(html, /class="related-limits"/u);
  assert.match(html, /href="#scope-limit-1"/u);
  assert.match(html, /<details class="scope-limit" id="scope-limit-1">/u);
  assert.match(
    html,
    /<details class="review-section review-section-collapsible" id="evidence-and-scope" open>/u,
  );
  assert.doesNotMatch(
    html,
    /<details class="evidence-group(?: [^"]*)?" open>/u,
  );
  assert.ok((html.match(/<details class="evidence-group(?: [^"]*)?">/gu) ?? []).length >= 4);
  assert.equal(
    (html.match(/<details class="context-check">/gu) ?? []).length,
    review.contextChecks.filter((check) => check.status !== "limited").length,
  );
  assert.match(html, /if\(target\.tagName==="DETAILS"\)target\.open=true/u);
  assert.match(html, /<summary aria-label="[^"]+ · Evidence · \d+">Evidence · \d+<\/summary>/u);
  assert.match(html, /\.evidence > summary \{[\s\S]*?min-height: 32px;/u);
  assert.match(html, /\.evidence > summary::before,/u);
  assert.match(html, /\.syntax-line-patch\.syntax-line-unlocated/u);
  assert.match(html, /\.syntax-line-patch\.syntax-line-unlocated::before \{ display: none; \}/u);
  assert.match(html, /class="evidence-reference"/u);
  assert.equal((html.match(/id="evidence-[a-f0-9]{12}"/gu) ?? []).length > 0, true);
  assert.match(html, /<caption class="sr-only">/u);
  assert.match(html, /<time datetime="[^"]+" title="[^"]+">/u);
  assert.match(html, />Other captured sources</u);
  assert.match(html, />Relevant context</u);
  assert.match(html, />Changed files</u);
  assert.match(html, />Checked</u);
  assert.doesNotMatch(html, />Check limited</u);
  assert.match(html, />Not applicable</u);
  assert.match(html, /href="#scope-limit-1"/u);
  assert.match(html, />pull request description</u);
  const otherSources = html.match(
    /<details class="evidence-group">\s*<summary><h3>Other captured sources<\/h3><\/summary>[\s\S]*?<\/details>/u,
  )?.[0] ?? "";
  assert.doesNotMatch(otherSources, /src\/retry\.js/u);
  assert.doesNotMatch(otherSources, />change excerpt</u);
  const changedFiles = html.match(
    /<details class="evidence-group">\s*<summary><h3>Changed files<\/h3><\/summary>[\s\S]*?<\/details>/u,
  )?.[0] ?? "";
  assert.match(changedFiles, /src\/retry\.js/u);
  assert.match(changedFiles, /change excerpt · 4 lines/u);
  assert.doesNotMatch(html, />source-[0-9]+</u);
  const synopsis = html.match(/<section class="synopsis"[\s\S]*?<\/section>/u)?.[0] ?? "";
  assert.ok(synopsis.indexOf("synopsis.why") === -1);
  assert.ok(synopsis.indexOf("synopsis-review") > synopsis.indexOf("Impact"));
  assert.equal((synopsis.match(/>1 item</gu) ?? []).length, 0);
  assert.doesNotMatch(synopsis, /class="status summary-/u);
  assert.equal((synopsis.match(/Scope limited/gu) ?? []).length, 0);
  assert.equal((synopsis.match(/>Limited</gu) ?? []).length, 0);
  assert.match(html, /\.flow-short > li:not\(:last-child\)::after/u);
  assert.match(html, /\.theme-button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/u);
  assert.match(html, new RegExp(`@media \\(max-width: ${LAYOUT.tocBreakpoint}px\\)`, "u"));
  assert.match(html, /\.syntax-line \{[\s\S]*?display: inline;/u);
  assert.match(html, /<\/span>\n<span class="syntax-line/u);
  assert.match(html, /\.syntax-line-patch \{[\s\S]*?display: inline;/u);
});

test("Korean and dark theme are reflected without a header language badge", async () => {
  const snapshot = makeSnapshot({ locale: "ko-KR", theme: "dark" });
  const review = validateAnalysis(makeAnalysis(snapshot, runId), snapshot, { runId });
  const rendered = await renderReview(review);
  const html = rendered.bytes.toString("utf8");
  assert.match(html, /<html lang="ko-KR" data-theme="dark">/u);
  assert.match(html, /핵심 변경/u);
  assert.equal((html.match(/>요약</gu) ?? []).length, 3);
  assert.match(html, /<h2 class="sr-only" id="synopsis-title">요약<\/h2>/u);
  assert.match(html, />목표</u);
  assert.match(html, />AS-IS</u);
  assert.match(html, />TO-BE</u);
  assert.match(html, />영향</u);
  assert.doesNotMatch(html, /한눈에 보기/u);
  assert.match(html, /<dt>커밋<\/dt>\s*<dd><code>bbbbbbbb<\/code><\/dd>/u);
  assert.match(
    html,
    /<dt>수집 시각<\/dt>\s*<dd><time[^>]+>2026-07-23 00:00 UTC<\/time><\/dd>/u,
  );
  assert.doesNotMatch(html, /class="review-result/u);
  assert.doesNotMatch(html, /class="review-count/u);
  assert.match(html, /2026-07-23 00:00 UTC/u);
  assert.match(html, new RegExp("a".repeat(40), "u"));
  assert.match(html, new RegExp("c".repeat(40), "u"));
  assert.match(html, /핵심 설명/u);
  assert.match(html, /그 밖의 수집 출처/u);
  assert.match(html, /관련 맥락/u);
  assert.match(html, /변경 파일/u);
  assert.match(html, /주요 설명·판단을 제한함/u);
  assert.match(html, /수집한 맥락 밖의 기존 코드/u);
  assert.match(html, /src\/retry\.js · 변경 조각 2–4/u);
  assert.match(html, /aria-label="라이트 모드로 전환"/u);
  assert.doesNotMatch(html, /aria-pressed=/u);
  assert.match(html, /data-theme-icon="dark"[^>]* hidden/u);
  assert.match(html, /data-theme-icon="light"[^>]*>/u);
  assert.doesNotMatch(html, />테마 변경</u);
  assert.doesNotMatch(html, />#<\/button>/u);
  assert.doesNotMatch(html, /class="language-badge"/u);
  assert.doesNotMatch(html, />modified</u);
  assert.doesNotMatch(html, />explained</u);
});

test("the artifact visibly warns about an English or Korean locale fallback", async () => {
  const cases = [
    {
      locale: "en-US",
      warning:
        "Hope could not resolve a supported language, so this review uses the default language.",
    },
    {
      locale: "ko-KR",
      warning:
        "Hope가 지원되는 언어를 확인하지 못해 이 리뷰를 기본 언어로 표시합니다.",
    },
  ];
  for (const { locale, warning } of cases) {
    const snapshot = withLocaleSource(makeSnapshot({ locale }), "default");
    const review = validateAnalysis(makeAnalysis(snapshot, runId), snapshot, { runId });
    const html = (await renderReview(review)).bytes.toString("utf8");
    assert.match(
      html,
      new RegExp(`<aside class="locale-warning" role="note">${warning}</aside>`, "u"),
    );
  }

  const explicit = makeSnapshot();
  const explicitReview = validateAnalysis(
    makeAnalysis(explicit, runId),
    explicit,
    { runId },
  );
  const explicitHtml = (await renderReview(explicitReview)).bytes.toString("utf8");
  assert.doesNotMatch(explicitHtml, /class="locale-warning"/u);
});

test("quiz responses stay visually unlabeled and separate from the answer", async () => {
  const snapshot = makeSnapshot({ locale: "ko-KR" });
  const analysis = makeAnalysis(snapshot, runId);
  analysis.quiz = Array.from({ length: 3 }, (_, index) => ({
    answer: `마지막 오류가 호출자에게 전달됩니다. ${index + 1}`,
    evidence: [{
      endLine: 4,
      sourceId: "source-3",
      startLine: 2,
    }],
    question: `모든 재시도가 실패하면 어떤 오류가 전달되나요? ${index + 1}`,
  }));
  const review = validateAnalysis(analysis, snapshot, { runId });
  const html = (await renderReview(review)).bytes.toString("utf8");

  assert.equal((html.match(/<details class="quiz-question"/gu) ?? []).length, 3);
  assert.equal((html.match(/<textarea/gu) ?? []).length, 3);
  assert.equal((html.match(/class="quiz-answer"/gu) ?? []).length, 3);
  assert.equal((html.match(/>답과 근거 보기<\/summary>/gu) ?? []).length, 3);
  assert.match(
    html,
    /<label class="sr-only" id="quiz-1-response-label" for="quiz-1-response">이해 확인 답변<\/label>/u,
  );
  assert.match(
    html,
    /<summary id="quiz-1-question">[\s\S]*?<\/summary>[\s\S]*?<textarea[\s\S]*?aria-labelledby="quiz-1-question quiz-1-response-label"[\s\S]*?id="quiz-1-response"/u,
  );
  assert.match(
    html,
    /placeholder="답을 먼저 적어보세요\. 입력 내용은 저장되지 않습니다\."/u,
  );
  assert.doesNotMatch(html, /<label[^>]*>[^<]*(?:내 생각|선택)/u);
  assert.equal((html.match(/class="evidence evidence-inline"/gu) ?? []).length, 3);
  assert.match(
    html,
    /aria-label="모든 재시도가 실패하면 어떤 오류가 전달되나요\? 1 · 답과 근거 보기"/u,
  );
  assert.match(html, /\.quiz textarea,[\s\S]*?\.quiz-answer > summary \{[\s\S]*?display: none !important;/u);
  assert.match(
    html,
    /\.quiz-question > \.quiz-workspace,[\s\S]*?\.quiz-answer > \.quiz-answer-content \{[\s\S]*?display: block !important;/u,
  );
  assert.doesNotMatch(
    html.match(/<details class="quiz-answer">[\s\S]*?<\/details>/u)?.[0] ?? "",
    /<details class="evidence">/u,
  );
  assert.doesNotMatch(html, /<details class="quiz-question"[^>]* open/u);
  assert.doesNotMatch(html, /<details class="quiz-answer"[^>]* open/u);
});

test("the synopsis shows top mixed-kind items without a dashboard summary", async () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.reviewItems = [
    { ...analysis.reviewItems[0], importance: "high", kind: "decide", title: "Decide first" },
    { ...analysis.reviewItems[0], importance: "high", kind: "verify", title: "Verify first" },
    { ...analysis.reviewItems[0], importance: "medium", kind: "verify", title: "Verify second" },
    { ...analysis.reviewItems[0], importance: "low", kind: "resolve", title: "Hidden resolve" },
    { ...analysis.reviewItems[0], importance: "low", kind: "verify", title: "Hidden verify" },
  ];
  const review = validateAnalysis(analysis, snapshot, { runId });
  const extendedReview = {
    ...review,
    limits: [
      ...review.limits,
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `extra-limit-${index + 1}`,
        impact: `Scope impact ${index + 1}`,
        kind: "unchanged-context",
        material: true,
        reason: "Not collected",
        subject: `Context ${index + 1}`,
      })),
    ],
  };
  const rendered = await renderReview(extendedReview);
  const html = rendered.bytes.toString("utf8");
  const synopsis = html.match(/<section class="synopsis"[\s\S]*?<\/section>/u)?.[0] ?? "";

  assert.match(html, />2 more review items</u);
  assert.match(html, />2 more scope notes</u);
  assert.doesNotMatch(synopsis, /class="review-result/u);
  assert.doesNotMatch(synopsis, /class="review-count/u);
  assert.doesNotMatch(synopsis, /class="review-kind-counts/u);
  assert.doesNotMatch(synopsis, /Hidden resolve/u);
  assert.equal(
    (html.match(/class="review-item kind-[a-z]+"/gu) ?? []).length,
    5,
  );
  assert.equal(
    (html.match(/class="review-item kind-[a-z]+ review-item-compact"/gu) ?? []).length,
    3,
  );
});

test("a review with no items states the result once", async () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.reviewItems = [];
  analysis.limitImpacts = analysis.limitImpacts.map((limit) => ({
    ...limit,
    material: false,
  }));
  const review = validateAnalysis(analysis, snapshot, { runId });
  const html = (await renderReview(review)).bytes.toString("utf8");
  const synopsis = html.match(/<section class="synopsis"[\s\S]*?<\/section>/u)?.[0] ?? "";

  assert.equal(
    (synopsis.match(/No important item was found in the checked scope\./gu) ?? []).length,
    1,
  );
  assert.match(synopsis, /class="review-empty"/u);
  assert.doesNotMatch(synopsis, />Scope</u);
  assert.doesNotMatch(synopsis, /review-items-compact/u);
});

test("only two to four brief behavior steps use the responsive flow", async () => {
  const snapshot = makeSnapshot();
  const shortAnalysis = makeAnalysis(snapshot, runId);
  shortAnalysis.behavior = {
    steps: Array.from({ length: 4 }, (_, index) => ({
      ...shortAnalysis.coreChange.after,
      text: `${index + 1}. ${"x".repeat(77)}`,
    })),
    summary: shortAnalysis.coreChange.after,
  };
  const shortReview = validateAnalysis(shortAnalysis, snapshot, { runId });
  const shortHtml = (await renderReview(shortReview)).bytes.toString("utf8");
  assert.match(shortHtml, /<ol class="flow flow-short">/u);
  assert.match(shortHtml, /overflow-wrap: anywhere/u);

  const numerousAnalysis = makeAnalysis(snapshot, runId);
  numerousAnalysis.behavior = {
    steps: Array.from({ length: 5 }, (_, index) => ({
      ...numerousAnalysis.coreChange.after,
      text: `Step ${index + 1}`,
    })),
    summary: numerousAnalysis.coreChange.after,
  };
  const numerousReview = validateAnalysis(numerousAnalysis, snapshot, { runId });
  const numerousHtml = (await renderReview(numerousReview)).bytes.toString("utf8");
  assert.match(numerousHtml, /<ol class="flow">/u);
  assert.doesNotMatch(numerousHtml, /<ol class="flow flow-short">/u);

  const longAnalysis = makeAnalysis(snapshot, runId);
  longAnalysis.behavior = {
    steps: [
      { ...longAnalysis.coreChange.after, text: "Keep the final error." },
      { ...longAnalysis.coreChange.after, text: "x".repeat(81) },
    ],
    summary: longAnalysis.coreChange.after,
  };
  const longReview = validateAnalysis(longAnalysis, snapshot, { runId });
  const longHtml = (await renderReview(longReview)).bytes.toString("utf8");
  assert.match(longHtml, /<ol class="flow">/u);
  assert.doesNotMatch(longHtml, /<ol class="flow flow-short">/u);
});

test("behavior renders a grounded visual and a separate fixed microworld safely", async () => {
  const snapshot = makeSnapshot();
  const analysis = makeAnalysis(snapshot, runId);
  analysis.behavior = makeTeachingBehavior();
  analysis.behavior.visual.title = "<img src=x onerror=alert(1)>";
  analysis.behavior.microworld.instructions = "</script><script>alert(1)</script>";
  const review = validateAnalysis(analysis, snapshot, { runId });
  const html = (await renderReview(review)).bytes.toString("utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1] ?? "";

  assert.match(
    html,
    /id="explore"[\s\S]*?class="behavior-visual visual-decision-table"/u,
  );
  assert.match(html, /<table class="decision-table">/u);
  assert.match(html, />Case<\/th>/u);
  assert.match(html, /class="microworld" data-microworld/u);
  assert.match(html, /class="microworld-eyebrow">Try it<\/p>/u);
  assert.match(
    html,
    /Explanation model only\. It does not run repository code or report a test result\./u,
  );
  assert.equal((html.match(/class="microworld-control"/gu) ?? []).length, 2);
  assert.equal((html.match(/class="microworld-scenario"/gu) ?? []).length, 4);
  assert.equal(
    (html.match(/data-status="[^"]+"\s+hidden>/gu) ?? []).length,
    3,
  );
  assert.match(html, /<dt>This model simplifies<\/dt>/u);
  assert.match(html, /<dt>This model leaves out<\/dt>/u);
  assert.match(html, /class="claim-meta teaching-aid-meta"/u);
  assert.match(html, /src\/retry\.js · change excerpt 2–4/u);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/u);
  assert.match(
    html,
    /&lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/u,
  );
  assert.doesNotMatch(html, /<img src=x/u);
  assert.match(script, /querySelectorAll\("\[data-microworld\]"\)/u);
  assert.match(script, /scenario\.hidden=!selected/u);
  assert.match(script, /control\.disabled=false/u);
  assert.equal(
    (html.match(/class="microworld-control"[\s\S]*?disabled>/gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(
    script,
    /\beval\s*\(|new Function|fetch\s*\(|WebSocket|import\s*\(/u,
  );
  assert.match(
    html,
    /connect-src &#39;none&#39;|connect-src 'none'/u,
  );
});

test("all visual kinds use typed, fixed renderer structures", async () => {
  const markers = {
    "component-map": /class="visual-components"/u,
    "decision-table": /<table class="decision-table">/u,
    flow: /<ol class="visual-flow">/u,
    sequence: /class="visual-participants"/u,
  };
  const snapshot = makeSnapshot();
  for (const [kind, marker] of Object.entries(markers)) {
    const analysis = makeAnalysis(snapshot, runId);
    analysis.behavior = makeTeachingBehavior({
      includeMicroworld: false,
      visualKind: kind,
    });
    const review = validateAnalysis(analysis, snapshot, { runId });
    const html = (await renderReview(review)).bytes.toString("utf8");
    assert.match(
      html,
      new RegExp(`class="behavior-visual visual-${kind}"`, "u"),
    );
    assert.match(html, marker);
    assert.match(html, /<ol class="flow flow-short">/u);
    if (kind === "sequence") {
      assert.match(
        html,
        /class="visual-route">\s*<span class="sr-only">Attempt to Retry branch<\/span>/u,
      );
    }
    if (kind === "component-map") {
      assert.match(
        html,
        /class="visual-route">\s*<span class="sr-only">Retry branch to Caller<\/span>/u,
      );
    }
  }
});

test("unavailable-file reasons use the review language", async () => {
  const original = makeSnapshot({ locale: "ko-KR" });
  const { digest: _digest, ...value } = original;
  value.files = [
    ...value.files,
    {
      additions: 1,
      bodyReason: "The file name commonly contains private configuration",
      bodyReasonKind: "private-path",
      bodyState: "redacted",
      deletions: 0,
      id: "file-2",
      path: ".env",
      providerStatus: "added",
      sourceIds: [],
    },
  ];
  value.limits = [
    ...value.limits,
    {
      id: "limit-2",
      kind: "file-unavailable",
      reason: "The file name commonly contains private configuration",
      reasonKind: "private-path",
      subject: ".env",
    },
  ];
  const snapshot = { ...value, digest: digestJson(value) };
  const analysis = makeAnalysis(snapshot, runId);
  analysis.limitImpacts.push({
    impact: "실제 환경 설정 값은 판단할 수 없습니다.",
    limitId: "limit-2",
    material: true,
  });
  analysis.contextChecks.push({
    basis: "unknown",
    evidence: [],
    explanation: "환경 설정 파일 본문을 확인하지 않았습니다.",
    limitIds: ["limit-2"],
    status: "limited",
    subject: "실제 환경 설정 값",
  });
  const review = validateAnalysis(analysis, snapshot, { runId });
  const rendered = await renderReview(review);
  const html = rendered.bytes.toString("utf8");

  assert.match(html, /파일 이름이 일반적으로 비공개 설정에 사용됩니다/u);
  assert.doesNotMatch(
    html,
    /The file name commonly contains private configuration/u,
  );
  assert.match(html, /본문 제외/u);
});

test("unavailable exact context uses a trusted localized reason", async () => {
  const original = makeSnapshot({ locale: "ko-KR" });
  const { digest: _digest, ...value } = original;
  value.limits = [
    ...value.limits,
    {
      id: "limit-2",
      kind: "context-unavailable",
      reason: "Untrusted provider reason",
      reasonKind: "safe-total-limit",
      revision: original.snapshot.head,
      subject: "src/caller.js",
    },
  ];
  const snapshot = { ...value, digest: digestJson(value) };
  const analysis = makeAnalysis(snapshot, runId);
  analysis.limitImpacts.push({
    impact: "직접 호출자의 동작은 판단할 수 없습니다.",
    limitId: "limit-2",
    material: true,
  });
  analysis.contextChecks.push({
    basis: "unknown",
    evidence: [],
    explanation: "요청한 호출자 맥락을 수집 한도 안에서 가져오지 못했습니다.",
    limitIds: ["limit-2"],
    status: "limited",
    subject: "직접 호출자",
  });

  const html = (
    await renderReview(validateAnalysis(analysis, snapshot, { runId }))
  ).bytes.toString("utf8");
  assert.match(html, /요청한 맥락이 Hope의 전체 맥락 수집 한도를 넘습니다/u);
  assert.doesNotMatch(html, /Untrusted provider reason/u);
});

test("exact-revision context renders as highlighted code from its fork repository", async () => {
  const original = makeSnapshot();
  const { digest: _digest, ...value } = original;
  value.repository = {
    ...value.repository,
    base: { name: "hope", owner: "example" },
    head: { name: "hope-fork", owner: "contributor" },
  };
  value.sources = [
    ...value.sources,
    {
      id: "source-4",
      kind: "context-file",
      lineCount: 2,
      path: "src/caller.js",
      revision: original.snapshot.head,
      text: "export function callRetry() {\n  return retry()",
    },
  ];
  const snapshot = { ...value, digest: digestJson(value) };
  const analysis = makeAnalysis(snapshot, runId);
  analysis.contextChecks.push({
    basis: "code",
    evidence: [{ endLine: 2, sourceId: "source-4", startLine: 1 }],
    explanation: "The exact head caller was checked.",
    limitIds: [],
    status: "checked",
    subject: "Head caller",
  });

  const html = (
    await renderReview(validateAnalysis(analysis, snapshot, { runId }))
  ).bytes.toString("utf8");
  const contextUrl = `https://github.com/contributor/hope-fork/blob/${
    "b".repeat(40)
  }/src/caller.js#L1-L2`;
  const contextStart = html.indexOf(contextUrl);
  assert.ok(contextStart >= 0);
  const contextEvidence = html.slice(contextStart - 200, contextStart + 2_000);
  assert.match(contextEvidence, /<pre class="syntax-code">/u);
  assert.match(contextEvidence, /class="syntax-token-[a-f0-9]{16}"/u);
});

test("scope limits with one reason are grouped without losing member links", async () => {
  const original = makeSnapshot();
  const { digest: _digest, ...value } = original;
  value.files = [
    ...value.files,
    {
      additions: 1,
      bodyReason: "The file name commonly contains private configuration",
      bodyReasonKind: "private-path",
      bodyState: "redacted",
      deletions: 0,
      id: "file-2",
      path: ".env.production",
      providerStatus: "added",
      sourceIds: [],
    },
    {
      additions: 1,
      bodyReason: "The file name commonly contains private configuration",
      bodyReasonKind: "private-path",
      bodyState: "redacted",
      deletions: 0,
      id: "file-3",
      path: ".env.staging",
      providerStatus: "added",
      sourceIds: [],
    },
  ];
  value.limits = [
    ...value.limits,
    {
      id: "limit-2",
      kind: "file-unavailable",
      reason: "The file name commonly contains private configuration",
      reasonKind: "private-path",
      subject: ".env.production",
    },
    {
      id: "limit-3",
      kind: "file-unavailable",
      reason: "The file name commonly contains private configuration",
      reasonKind: "private-path",
      subject: ".env.staging",
    },
  ];
  const snapshot = { ...value, digest: digestJson(value) };
  const analysis = makeAnalysis(snapshot, runId);
  analysis.limitImpacts.push(
    {
      impact: "Production values were not inspected.",
      limitId: "limit-2",
      material: false,
    },
    {
      impact: "Staging values were not inspected.",
      limitId: "limit-3",
      material: false,
    },
  );
  analysis.contextChecks.push({
    basis: "unknown",
    evidence: [],
    explanation: "Deployment secret values were deliberately excluded.",
    limitIds: ["limit-2", "limit-3"],
    status: "limited",
    subject: "Deployment secret values",
  });
  const review = validateAnalysis(analysis, snapshot, { runId });
  const html = (await renderReview(review)).bytes.toString("utf8");

  assert.equal((html.match(/Unchecked for the same reason · 2/gu) ?? []).length, 1);
  assert.equal(
    (html.match(/The file name commonly contains private configuration\./gu) ?? []).length,
    1,
  );
  assert.match(html, /<details class="scope-limit-item" id="scope-limit-2">/u);
  assert.match(html, /<details class="scope-limit-item" id="scope-limit-3">/u);
  assert.equal((html.match(/Deployment secret values were deliberately excluded\./gu) ?? []).length, 1);
  assert.match(html, /Other unchecked inputs · 2/u);
});

test("equal base and merge-base revisions share one artifact row", async () => {
  const original = makeSnapshot({ locale: "ko-KR" });
  const { digest: _digest, ...value } = original;
  value.snapshot = {
    ...value.snapshot,
    mergeBase: value.snapshot.base,
  };
  const snapshot = { ...value, digest: digestJson(value) };
  const review = validateAnalysis(makeAnalysis(snapshot, runId), snapshot, { runId });
  const html = (await renderReview(review)).bytes.toString("utf8");

  assert.equal((html.match(/기준·공통 기준 커밋/gu) ?? []).length, 1);
  assert.doesNotMatch(html, />기준 커밋</u);
  assert.doesNotMatch(html, />공통 기준 커밋</u);
});

test("a captured file source cannot point outside the represented file map", async () => {
  const snapshot = makeSnapshot();
  const review = validateAnalysis(makeAnalysis(snapshot, runId), snapshot, { runId });
  const invalidReview = {
    ...review,
    sourceIndex: [
      ...review.sourceIndex,
      {
        fileId: "missing-file",
        kind: "patch",
        lineCount: 1,
        path: "src/missing.js",
        revision: snapshot.snapshot.head,
      },
    ],
  };

  await assert.rejects(
    () => renderReview(invalidReview),
    /Source index refers to an unknown file/u,
  );
});
