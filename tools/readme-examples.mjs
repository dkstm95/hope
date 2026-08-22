import { digestJson } from "../plugins/hope/skills/diff/scripts/hash.mjs";

const ALIGN_ID = "e9b3bc09-256a-4240-aa8d-0436a3e1aed1";
const ALIGN_CREATED_AT = "2026-08-17T03:52:43.056Z";
const DIFF_RUN_ID = "86786786786786786786786786786786";

function text(locale, english, korean) {
  return locale === "ko-KR" ? korean : english;
}

function claim(locale, english, korean, evidence, basis = "code") {
  return {
    basis,
    evidence,
    text: text(locale, english, korean),
  };
}

function reference(sourceId, startLine, endLine = startLine) {
  return { endLine, sourceId, startLine };
}

export function makeAlignArtifactData(locale, images) {
  const local = (english, korean) => text(locale, english, korean);
  const image = (key) => ({
    data: images[key].data,
    height: images[key].height,
    mimeType: "image/png",
    width: images[key].width,
  });
  const content = {
    title: local("Trusted fan schedule", "신뢰할 수 있는 팬 일정"),
    goal: {
      text: local(
        "Give fans one reliable place to check schedules, voting and application deadlines, source conflicts, and the next safe action.",
        "팬이 일정, 투표와 신청 마감, 출처 충돌, 다음 안전한 행동을 한곳에서 신뢰할 수 있게 확인하도록 한다.",
      ),
      evidenceIds: ["rescene-go", "mnet-plus", "blip-event"],
    },
    problem: local(
      "Broadcasts, performances, releases, votes, and applications use different dates and sources. Fans can miss a deadline or act on stale information while moving between them.",
      "방송, 공연, 발매, 투표, 신청은 날짜와 출처가 서로 다르다. 팬이 여러 곳을 오가는 동안 마감을 놓치거나 오래된 정보로 행동할 수 있다.",
    ),
    checks: [
      {
        condition: local(
          "Desktop shows the monthly schedule beside the selected date, while mobile presents the same events in date order.",
          "데스크톱은 월간 일정과 선택한 날짜를 함께 보여 주고, 모바일은 같은 일정을 날짜순으로 보여 준다.",
        ),
        verify: local(
          "Compare event order, selected-date details, and missing information at 1440px and 390px in a browser.",
          "브라우저의 1440px와 390px 화면에서 일정 순서, 선택 날짜 상세, 정보 누락을 비교한다.",
        ),
        by: "agent",
      },
      {
        condition: {
          text: local(
            "Every event shows its KST time, primary source, last checked time, and a direct action link when action is required.",
            "각 일정은 KST 시각, 우선 출처, 마지막 확인 시각을 보여 주고 행동이 필요하면 원본 링크를 제공한다.",
          ),
          evidenceIds: ["rescene-go", "mnet-plus", "blip-event"],
        },
        verify: local(
          "Check representative event details and reject fixtures that omit a required time or source.",
          "대표 일정 상세를 확인하고 필수 시각이나 출처가 없는 입력이 거부되는지 테스트한다.",
        ),
        by: "agent",
      },
      {
        condition: local(
          "Source conflicts, schedule changes, and cancellations remain visible until an authoritative source resolves them.",
          "출처 충돌, 일정 변경, 취소는 권위 있는 출처가 해소할 때까지 화면에 남는다.",
        ),
        verify: local(
          "Load conflict, change, and cancellation fixtures and compare the shown state, source order, and available actions.",
          "충돌, 변경, 취소 예시를 불러와 표시 상태, 출처 순서, 가능한 행동을 비교한다.",
        ),
        by: "agent",
      },
      {
        condition: local(
          "The chosen direction fits the existing fan site and makes monthly context and urgent actions easy to distinguish.",
          "선택한 방향이 기존 팬 사이트와 어울리고 월간 맥락과 긴급 행동을 쉽게 구분하게 한다.",
        ),
        verify: local(
          "The person compares the two directions and judges the selected information hierarchy and responsive transition.",
          "사용자가 두 방향을 비교하고 선택안의 정보 위계와 반응형 전환을 판단한다.",
        ),
        by: "human",
      },
    ],
    boundary: local(
      "This is an unofficial fan schedule built from public sources. Final participation decisions stay with the linked official source.",
      "공개 출처를 정리한 비공식 팬 일정이다. 최종 참여 판단은 연결된 공식 원본에서 한다.",
    ),
    scope: {
      included: [
        local("Broadcast, performance, release, anniversary, vote, and application events", "방송, 공연, 발매, 기념일, 투표, 신청 일정"),
        local("Monthly desktop view and date-ordered mobile view", "데스크톱 월간 보기와 모바일 날짜순 보기"),
        local("Source priority, conflicts, changes, cancellations, and freshness", "출처 우선순위, 충돌, 변경, 취소, 최신성"),
        local("Deadline state and links to official actions", "마감 상태와 공식 행동 링크"),
      ],
      excluded: [
        local("Push, email, or text notifications", "푸시, 이메일, 문자 알림"),
        local("Personal calendar synchronization", "개인 캘린더 동기화"),
        local("Voting or applying inside the fan site", "팬 사이트 안에서 직접 투표하거나 신청하는 기능"),
        local("A guarantee that every official announcement is collected", "모든 공식 공지를 수집한다는 보장"),
      ],
    },
    designDirections: {
      options: [
        {
          id: "month-map",
          title: local("Monthly trust map", "월간 신뢰 지도"),
          alt: local(
            "Monthly fan schedule with a selected-date source panel and visible deadline states",
            "선택 날짜 출처 패널과 마감 상태를 보여 주는 월간 팬 일정",
          ),
          summary: local(
            "Keep the monthly rhythm primary and reveal source confidence and actions for the selected date.",
            "월간 흐름을 중심에 두고 선택한 날짜의 출처 신뢰도와 행동을 보여 준다.",
          ),
          strengths: [
            local("Fans can scan activity density and overlapping events quickly.", "팬이 활동 밀도와 겹치는 일정을 빠르게 살필 수 있다."),
            local("The selected-date panel keeps evidence beside the event.", "선택 날짜 패널이 일정 옆에 근거를 둔다."),
          ],
          tradeoffs: [
            local("Urgent actions are less prominent before a date is selected.", "날짜를 선택하기 전에는 긴급 행동이 덜 두드러진다."),
          ],
          references: [{
            evidenceId: "rescene-go",
            influence: local(
              "Its monthly desktop rhythm and mobile list informed the responsive structure.",
              "데스크톱 월간 흐름과 모바일 목록을 반응형 구조에 반영했다.",
            ),
          }],
          image: image("monthMap"),
        },
        {
          id: "action-radar",
          title: local("Action deadline radar", "행동 마감 레이더"),
          alt: local(
            "Fan action planner that prioritizes voting and application deadlines beside a compact calendar",
            "작은 달력 옆에서 투표와 신청 마감을 우선하는 팬 행동 플래너",
          ),
          summary: local(
            "Put urgent voting and application actions first while retaining a compact monthly reference.",
            "긴급한 투표와 신청 행동을 먼저 보여 주면서 작은 월간 참고 화면을 유지한다.",
          ),
          strengths: [
            local("Near-term deadlines and their official links are hard to miss.", "가까운 마감과 공식 링크를 놓치기 어렵다."),
            local("Conflict and cancellation warnings sit beside each action.", "충돌과 취소 경고가 각 행동 옆에 놓인다."),
          ],
          tradeoffs: [
            local("The month-wide activity pattern takes longer to understand.", "한 달 전체의 활동 흐름을 파악하는 데 더 오래 걸린다."),
          ],
          references: [{
            label: "RESCENE STREAM",
            url: "https://rescene.stream/",
            influence: local(
              "Its separation of schedules and fan actions informed the action-first grouping.",
              "일정과 팬 행동을 나누는 방식에서 행동 우선 그룹을 참고했다.",
            ),
          }],
          image: image("actionRadar"),
        },
      ],
      recommendation: {
        optionId: "month-map",
        reason: local(
          "It meets the original monthly-schedule goal while keeping source conflicts and action links beside the selected date.",
          "원래의 월간 일정 목표를 충족하면서 출처 충돌과 행동 링크를 선택 날짜 옆에 유지한다.",
        ),
      },
      selection: {
        optionId: "month-map",
        reason: local(
          "The person delegated the reversible choice and accepted the direction that preserves monthly context.",
          "사용자가 되돌릴 수 있는 선택을 위임하고 월간 맥락을 보존하는 방향을 확정했다.",
        ),
        decidedBy: "delegated",
      },
    },
    behavior: {
      steps: [
        { title: local("Choose a view", "보기 선택"), detail: local("Choose today, week, or month and filter event types.", "오늘, 주, 월 보기를 고르고 일정 종류를 필터링한다.") },
        { title: local("Compare time and urgency", "시각과 긴급도 비교"), detail: local("Scan the monthly rhythm together with deadlines, changes, and cancellations.", "월간 흐름과 함께 마감, 변경, 취소를 살핀다.") },
        { title: local("Check the source", "출처 확인"), detail: local("Open an event to compare its primary source, other values, and last check.", "일정을 열어 우선 출처, 다른 값, 마지막 확인 시각을 비교한다.") },
        { title: local("Act at the original", "원본에서 행동"), detail: local("Follow a verified official link or wait when a conflict is unresolved.", "확인된 공식 링크로 이동하거나 충돌이 해결되지 않았으면 기다린다.") },
      ],
      outcomes: [
        { title: local("Reliable schedule", "신뢰 가능한 일정"), detail: local("The fan understands the event, source, and freshness.", "팬이 일정, 출처, 최신성을 이해한다."), kind: "complete" },
        { title: local("Safe action", "안전한 행동"), detail: local("The fan continues at the verified official source.", "팬이 확인된 공식 원본에서 계속한다."), kind: "complete" },
        { title: local("Action held", "행동 보류"), detail: local("An unresolved conflict remains visible and blocks an unsafe action.", "해결되지 않은 충돌이 보이고 안전하지 않은 행동을 막는다."), kind: "cancel" },
      ],
    },
    decisions: [
      { decision: { text: local("Official organizers and artists have highest priority", "공식 주최사와 아티스트를 가장 높은 출처로 둔다"), evidenceIds: ["mnet-plus"] }, reason: local("They can confirm changes and cancellations directly.", "변경과 취소를 직접 확정할 수 있다.") },
      { decision: local("Do not hide or merge source conflicts", "출처 충돌을 숨기거나 합치지 않는다"), reason: local("Visible evidence is safer than presenting one uncertain value as final.", "하나의 불확실한 값을 확정 정보로 보여 주는 것보다 근거를 보이는 편이 안전하다.") },
      { decision: local("Action links require a recent check", "행동 링크에는 최근 확인이 필요하다"), reason: local("Voting and application deadlines can change within hours.", "투표와 신청 마감은 몇 시간 안에도 바뀔 수 있다.") },
      { decision: local("Keep previous values and cancellation reasons", "이전 값과 취소 근거를 남긴다"), reason: { text: local("Fans can understand why an action they saw earlier is no longer safe.", "팬이 이전에 본 행동이 더는 안전하지 않은 이유를 이해할 수 있다."), evidenceIds: ["rescene-go", "blip-event"] } },
    ],
    openChoices: [],
    evidence: [
      { id: "rescene-go", label: "RESCENE go", location: "https://www.rescene.org/schedule" },
      { id: "mnet-plus", label: local("RESCENE official Mnet Plus", "RESCENE 공식 Mnet Plus"), location: "https://artist.mnetplus.world/main/stg/rescene-official/home" },
      { id: "blip-event", label: local("Fan-sign event date example", "팬사인회 일정 예시"), location: "https://s.blip.kr/s/9d3b7f37" },
    ],
  };

  return {
    schemaVersion: 1,
    alignId: ALIGN_ID,
    repository: "dkstm95/hope",
    repositoryIdentity: "remote://github.com/dkstm95/hope",
    locale,
    theme: "system",
    createdAt: ALIGN_CREATED_AT,
    revisions: [{
      number: 1,
      agreedAt: ALIGN_CREATED_AT,
      summary: local(
        "Agreed on the source policy and selected the monthly trust map.",
        "출처 정책에 합의하고 월간 신뢰 지도를 선택했다.",
      ),
      content,
    }],
  };
}

export function makeDiffSnapshot(locale) {
  const pullRequestTitle = "Fix `extend()` dropping numeric `retry` limit when merging with an object";
  const baseRevision = "61d6d66d27911001b9b4d57ab93139f9ad61384b";
  const headRevision = "61b90ed1cab2756b095facc5b3c7ccac9bc5f487";
  const mergePatch = [
    "@@ -204,7 +204,7 @@ const appendSearchParameters = (target: any, source: any): URLSearchParams => {",
    " };",
    " ",
    " // TODO: Make this strongly-typed (no `any`).",
    "-export const deepMerge = <T>(...sources: Array<Partial<T> | undefined>): T => {",
    "+const deepMergeInternal = <T>(isRoot: boolean, ...sources: Array<Partial<T> | undefined>): T => {",
    " \tlet returnValue: any = {};",
    " \tlet headers: KyHeadersInit = {};",
    " \tlet hooks = {};",
    "@@ -264,8 +264,17 @@ export const deepMerge = <T>(...sources: Array<Partial<T> | undefined>): T => {",
    " \t\t\t\t\tcontinue;",
    " \t\t\t\t}",
    " ",
    "+\t\t\t\t// `retry` accepts a number as shorthand for `{limit: number}`. Expand it before",
    "+\t\t\t\t// merging so extending a numeric `retry` with an object keeps the limit instead",
    "+\t\t\t\t// of dropping it (e.g. `ky.create({retry: 3}).extend({retry: {methods: ['get']}})`).",
    "+\t\t\t\t// Scoped to the root options level so it never rewrites nested user data that",
    "+\t\t\t\t// happens to contain a `retry` key (e.g. a `json` request body).",
    "+\t\t\t\tif (isRoot && key === 'retry' && isObject(value) && !isReplace && typeof returnValue[key] === 'number') {",
    "+\t\t\t\t\treturnValue = {...returnValue, [key]: {limit: returnValue[key]}};",
    "+\t\t\t\t}",
    "+",
    " \t\t\t\tif (isObject(value) && !isReplace && key in returnValue) {",
    "-\t\t\t\t\tvalue = deepMerge(returnValue[key], value);",
    "+\t\t\t\t\tvalue = deepMergeInternal(false, returnValue[key], value);",
    " \t\t\t\t}",
    " ",
    " \t\t\t\treturnValue = {...returnValue, [key]: value};",
    "@@ -310,3 +319,6 @@ export const deepMerge = <T>(...sources: Array<Partial<T> | undefined>): T => {",
    " ",
    " \treturn returnValue;",
    " };",
    "+",
    "+export const deepMerge = <T>(...sources: Array<Partial<T> | undefined>): T =>",
    "+\tdeepMergeInternal<T>(true, ...sources);",
  ].join("\n");
  const testPatch = [
    "@@ -433,6 +433,39 @@ test('retry - can provide retry as number', async t => {",
    " \tt.is(requestCount, 5);",
    " });",
    " ",
    "+test('retry - extending a numeric `retry` with an object keeps the limit', async t => {",
    "+\tlet requestCount = 0;",
    "+",
    "+\tconst server = await createHttpTestServer(t);",
    "+\tserver.get('/', async (_request, response) => {",
    "+\t\trequestCount++;",
    "+\t\tresponse.sendStatus(408);",
    "+\t});",
    "+",
    "+\t// `retry: 3` is shorthand for `{limit: 3}`. Extending it with an object",
    "+\t// should preserve that limit instead of falling back to the default.",
    "+\tconst extended = ky.create({retry: 3}).extend({retry: {methods: ['get']}});",
    "+",
    "+\tawait t.throwsAsync(extended(server.url).text(), {",
    "+\t\tmessage: /Request Timeout/",
    "+\t});",
    "+\tt.is(requestCount, 4);",
    "+});",
    "+",
    "+test('retry - shorthand expansion does not rewrite nested user data with a `retry` key', async t => {",
    "+\tconst server = await createHttpTestServer(t);",
    "+\tserver.post('/', (request, response) => {",
    "+\t\tresponse.json({body: request.body});",
    "+\t});",
    "+",
    "+\t// A `retry` key inside the `json` body is user data, not the `retry` option,",
    "+\t// so the number-to-`{limit}` shorthand must not touch it.",
    "+\tconst client = ky.create({json: {retry: 3}}).extend({json: {retry: {foo: 'bar'}}});",
    "+",
    "+\tconst {body} = await client.post(server.url).json<{body: {retry: unknown}}>();",
    "+\tt.deepEqual(body.retry, {foo: 'bar'});",
    "+});",
    "+",
    " test('doesn\\'t retry on 413 with empty statusCodes and methods', async t => {",
    " \tlet requestCount = 0;",
  ].join("\n");
  const description = [
    "### Problem",
    "",
    "`retry` accepts a number as shorthand for `{limit: number}` (per the docs: *\"If `retry` is a number, it will be used as `limit` and other defaults will remain in place.\"*).",
    "",
    "However, when a numeric `retry` is set on a parent instance and then extended with an **object**, the numeric limit is silently dropped and falls back to the default (`2`):",
    "",
    "```js",
    "import ky from 'ky';",
    "",
    "const api = ky.create({retry: 3});",
    "",
    "// Intent: keep limit 3, only narrow the retriable methods.",
    "const extended = api.extend({retry: {methods: ['get']}});",
    "",
    "// Bug: `extended` retries with the default limit of 2, not 3.",
    "```",
    "",
    "The reverse direction (object on the parent, number on the child) and the all-object case both work correctly — only the *number → object* merge loses data.",
    "",
    "### Cause",
    "",
    "In `deepMerge`, `retry` is merged like any other nested object. When the parent value is the numeric shorthand (`3`) and the incoming value is an object, the recursion ends up as `deepMerge(3, {methods: ['get']})`. A non-object source is skipped entirely by `deepMerge`, so the `3` is discarded and only `{methods: ['get']}` survives — the limit is lost.",
    "",
    "### Fix",
    "",
    "Expand the numeric `retry` shorthand to `{limit: number}` before the deep merge, so extending it with an object preserves the limit. This mirrors the documented shorthand semantics and leaves every other case (object → object, object → number replacement, `replaceOption`) unchanged.",
    "",
    "```js",
    "deepMerge({retry: 3}, {retry: {methods: ['get']}})",
    "// before: {retry: {methods: ['get']}}",
    "// after:  {retry: {limit: 3, methods: ['get']}}",
    "```",
    "",
    "### Test",
    "",
    "Added a test in `test/retry.ts` that sets `retry: 3` on a parent, extends it with `retry: {methods: ['get']}`, and asserts the request is attempted `limit + 1` times. It fails on `main` (3 attempts) and passes with the fix (4 attempts).",
    "",
  ].join("\n");
  const value = {
    capturedAt: "2026-08-17T06:08:16.951Z",
    files: [
      { additions: 14, bodyState: "included", deletions: 2, id: "file-1", path: "source/utils/merge.ts", providerStatus: "modified", sourceIds: ["source-4"] },
      { additions: 33, bodyState: "included", deletions: 0, id: "file-2", path: "test/retry.ts", providerStatus: "modified", sourceIds: ["source-5"] },
    ],
    limits: [{
      id: "limit-1",
      kind: "verification",
      reason: text(locale, "The fixed example does not include CI or command results.", "고정된 예시에는 CI나 명령 실행 결과가 포함되지 않았다."),
      subject: text(locale, "Full retry-suite result", "전체 재시도 테스트 결과"),
    }],
    pullRequest: {
      author: "chatman-media",
      number: 867,
      state: "closed",
      title: pullRequestTitle,
      url: "https://github.com/sindresorhus/ky/pull/867",
    },
    repository: { name: "ky", owner: "sindresorhus", provider: "github" },
    schemaVersion: 1,
    settings: { locale, localeSource: "override", theme: "system", themeSource: "override" },
    snapshot: {
      base: baseRevision,
      head: headRevision,
      mergeBase: baseRevision,
    },
    sources: [
      { id: "source-1", kind: "pull-request-title", lineCount: 1, text: pullRequestTitle },
      { id: "source-2", kind: "pull-request-description", lineCount: description.split("\n").length, text: description },
      { id: "source-3", kind: "commit-title", lineCount: 1, revision: headRevision, text: "Scope retry shorthand expansion to root options merge" },
      { fileId: "file-1", id: "source-4", kind: "patch", lineCount: mergePatch.split("\n").length, path: "source/utils/merge.ts", revision: headRevision, text: mergePatch },
      { fileId: "file-2", id: "source-5", kind: "patch", lineCount: testPatch.split("\n").length, path: "test/retry.ts", revision: headRevision, text: testPatch },
    ],
  };
  return Object.freeze({ ...value, digest: digestJson(value) });
}

function makeRetryMicroworld(locale, evidence) {
  const combinations = [
    ["number", "object"],
    ["number", "number"],
    ["object", "object"],
    ["object", "number"],
  ];
  return {
    basis: "code",
    evidence,
    title: text(locale, "Retry merge explorer", "재시도 병합 탐색기"),
    instructions: text(locale, "Change the parent and child retry forms to compare the merge result.", "부모와 자식의 재시도 형식을 바꿔 병합 결과를 비교하세요."),
    controls: [
      {
        defaultOptionId: "number",
        id: "parent",
        kind: "input",
        label: text(locale, "Parent retry", "부모 재시도"),
        options: [
          { id: "number", label: text(locale, "Number", "숫자") },
          { id: "object", label: text(locale, "Object", "객체") },
        ],
      },
      {
        defaultOptionId: "object",
        id: "child",
        kind: "state",
        label: text(locale, "Child retry", "자식 재시도"),
        options: [
          { id: "object", label: text(locale, "Object", "객체") },
          { id: "number", label: text(locale, "Number", "숫자") },
        ],
      },
    ],
    scenarios: combinations.map(([parent, child]) => {
      const changed = parent === "number" && child === "object";
      const title = text(
        locale,
        `${parent === "number" ? "Number" : "Object"} parent and ${child === "number" ? "number" : "object"} child`,
        `${parent === "number" ? "숫자" : "객체"} 부모와 ${child === "number" ? "숫자" : "객체"} 자식`,
      );
      return {
        id: `${parent}-${child}`,
        title,
        when: [{ controlId: "parent", optionId: parent }, { controlId: "child", optionId: child }],
        before: {
          outcome: changed
            ? text(locale, "The numeric limit is replaced, so the default limit applies.", "숫자 한도가 사라져 기본 한도가 적용된다.")
            : text(locale, "The child value keeps the existing merge behavior.", "자식 값이 기존 병합 동작을 유지한다."),
          steps: changed
            ? [text(locale, "Read retry limit 3.", "재시도 한도 3을 읽는다."), text(locale, "Replace it with the child object.", "자식 객체로 대체한다.")]
            : [text(locale, "Read both retry values.", "두 재시도 값을 읽는다."), text(locale, "Apply the ordinary merge rule.", "일반 병합 규칙을 적용한다.")],
        },
        after: changed
          ? {
              outcome: text(locale, "Limit 3 remains while the child conditions are added.", "한도 3을 유지하면서 자식 조건을 추가한다."),
              steps: [text(locale, "Expand 3 to an object with limit 3.", "3을 한도 3인 객체로 펼친다."), text(locale, "Merge the child conditions into it.", "그 안에 자식 조건을 병합한다.")],
            }
          : "unchanged",
        lesson: changed
          ? text(locale, "Only a root number-to-object retry merge needs the new preservation rule.", "최상위 숫자에서 객체로 가는 재시도 병합만 새 보존 규칙이 필요하다.")
          : text(locale, "This combination does not use the new special case.", "이 조합은 새 예외 규칙을 사용하지 않는다."),
      };
    }),
    simplifies: text(locale, "The model shows retry forms and the resulting limit, not the full request lifecycle.", "이 모델은 전체 요청 수명 주기 대신 재시도 형식과 최종 한도만 보여 준다."),
    omits: text(locale, "Backoff, hooks, network failures, and method-specific retry decisions.", "백오프, 훅, 네트워크 실패, 메서드별 재시도 판단."),
  };
}

export function makeDiffAnalysis(snapshot) {
  const locale = snapshot.settings.locale;
  const mergeEvidence = [reference("source-4", 14, 25)];
  const retrySetupEvidence = [reference("source-5", 14, 16)];
  const testEvidence = [reference("source-5", 14, 21)];
  return {
    schemaVersion: 3,
    runId: DIFF_RUN_ID,
    snapshotDigest: snapshot.digest,
    locale,
    title: claim(locale, "Extending retry conditions now keeps the numeric limit", "재시도 조건을 확장해도 숫자 한도를 유지한다", mergeEvidence),
    purpose: claim(
      locale,
      "Keep a numeric retry limit when an extended instance adds detailed retry conditions.",
      "확장된 인스턴스가 세부 재시도 조건을 추가해도 숫자 재시도 한도를 유지한다.",
      [reference("source-2", 3, 5)],
      "stated",
    ),
    coreChange: {
      before: claim(locale, "Adding object conditions replaced the parent's numeric retry limit.", "객체 조건을 추가하면 부모의 숫자 재시도 한도가 사라졌다.", mergeEvidence),
      after: claim(locale, "A root numeric retry value becomes a limit field before the child conditions are merged.", "최상위 숫자 재시도 값을 한도 필드로 펼친 뒤 자식 조건을 병합한다.", mergeEvidence),
      why: claim(locale, "The extended instance keeps the requested retry count and the added conditions.", "확장된 인스턴스가 요청한 재시도 횟수와 추가 조건을 함께 유지한다.", [reference("source-2", 24, 26)], "stated"),
      details: [
        claim(locale, "A retry limit of 3 still produces four total attempts after methods are added.", "재시도 한도 3에 메서드 조건을 추가해도 전체 요청은 네 번이다.", testEvidence),
        claim(locale, "Nested request data with a retry key keeps ordinary object merging.", "재시도 키가 있는 중첩 요청 데이터는 일반 객체 병합을 유지한다.", [reference("source-4", 17, 25), reference("source-5", 24, 35)]),
      ],
    },
    behavior: {
      summary: claim(locale, "The special preservation rule applies only when a root numeric retry value meets child object conditions.", "특별 보존 규칙은 최상위 숫자 재시도 값과 자식 객체 조건이 만날 때만 적용된다.", mergeEvidence),
      steps: [
        claim(locale, "The parent sets retry as a number.", "부모가 재시도를 숫자로 정한다.", retrySetupEvidence),
        claim(locale, "The child adds detailed retry conditions as an object.", "자식이 세부 재시도 조건을 객체로 추가한다.", retrySetupEvidence),
        claim(locale, "The root merge expands the number into a limit and then merges the child object.", "최상위 병합이 숫자를 한도로 펼친 뒤 자식 객체를 병합한다.", mergeEvidence),
      ],
      microworld: makeRetryMicroworld(locale, mergeEvidence),
    },
    contextChecks: [
      {
        subject: text(locale, "Root retry merge and nested-data boundary", "최상위 재시도 병합과 중첩 데이터 경계"),
        status: "checked",
        basis: "code",
        explanation: text(locale, "The changed merge branch and focused tests cover both boundaries.", "변경된 병합 분기와 집중 테스트가 두 경계를 모두 확인한다."),
        evidence: [reference("source-4", 14, 25), reference("source-5", 14, 35)],
        limitIds: [],
      },
      {
        subject: text(locale, "Full retry-suite result", "전체 재시도 테스트 결과"),
        status: "limited",
        basis: "unknown",
        explanation: text(locale, "The fixed example contains no CI or command result.", "고정된 예시에는 CI나 명령 실행 결과가 없다."),
        evidence: [],
        limitIds: ["limit-1"],
      },
    ],
    codeSteps: [
      { title: text(locale, "Separate root and recursive merging", "최상위 병합과 재귀 병합 분리"), text: text(locale, "Pass root state through the internal merge function.", "내부 병합 함수에 최상위 상태를 전달한다."), basis: "code", evidence: [reference("source-4", 5, 6), reference("source-4", 23, 35)] },
      { title: text(locale, "Expand numeric retry shorthand", "숫자 재시도 축약형 펼치기"), text: text(locale, "Convert the existing number to a limit field before merging child conditions.", "자식 조건을 병합하기 전에 기존 숫자를 한도 필드로 바꾼다."), basis: "code", evidence: [reference("source-4", 14, 21)] },
      { title: text(locale, "Cover request count and nested data", "요청 횟수와 중첩 데이터 확인"), text: text(locale, "Focused tests check four attempts and preserve a nested retry key as request data.", "집중 테스트가 요청 네 번과 중첩 재시도 키의 요청 데이터 보존을 확인한다."), basis: "code", evidence: [...testEvidence, reference("source-5", 24, 35)] },
    ],
    reviewItems: [{
      kind: "verify",
      importance: "medium",
      basis: "unknown",
      title: text(locale, "Confirm the full retry suite", "전체 재시도 테스트 확인"),
      explanation: text(locale, "The focused code and expectations are visible, but the fixed example has no execution result.", "집중 코드와 기대 조건은 보이지만 고정된 예시에는 실행 결과가 없다."),
      effect: text(locale, "A failure in another retry path would remain unknown.", "다른 재시도 경로의 실패는 확인되지 않은 채 남는다."),
      nextStep: text(locale, "Run the repository's full retry test suite at the reviewed commit.", "검토한 커밋에서 저장소의 전체 재시도 테스트를 실행한다."),
      doneWhen: text(locale, "The full retry suite passes at the reviewed commit.", "검토한 커밋에서 전체 재시도 테스트가 통과한다."),
      evidence: [reference("source-2", 36), reference("source-5", 5, 21)],
      limitIds: ["limit-1"],
    }],
    fileDispositions: [
      { fileId: "file-1", disposition: "explained" },
      { fileId: "file-2", disposition: "supporting" },
    ],
    limitImpacts: [{
      limitId: "limit-1",
      material: true,
      impact: text(locale, "The example cannot claim that the complete retry suite passes.", "예시는 전체 재시도 테스트 통과를 주장할 수 없다."),
    }],
    teachingAids: {
      visual: { decision: "omitted", reason: text(locale, "The core before-and-after explanation already shows the fixed merge.", "핵심 이전·이후 설명이 수정된 병합을 이미 보여 준다.") },
      microworld: { decision: "included", reason: text(locale, "The bounded combinations make the one changed merge direction easy to predict.", "제한된 조합으로 바뀐 한 가지 병합 방향을 쉽게 예측할 수 있다."), teachingJob: text(locale, "Compare retry results across parent and child value forms.", "부모와 자식 값 형식에 따른 재시도 결과를 비교한다.") },
      quiz: { decision: "included", reason: text(locale, "The retry limit and total attempt count are easy to confuse.", "재시도 한도와 전체 요청 횟수는 혼동하기 쉽다."), teachingJob: text(locale, "Check the total attempts produced by retry limit 3.", "재시도 한도 3이 만드는 전체 요청 횟수를 확인한다.") },
    },
    quiz: [{
      question: text(locale, "If the retry limit is 3 and every attempt times out, how many requests run in total?", "재시도 한도가 3이고 모든 시도가 시간 초과라면 전체 요청은 몇 번인가?"),
      answer: text(locale, "Four. The limit counts retries after the first request.", "네 번이다. 한도는 첫 요청 뒤의 재시도 횟수를 센다."),
      evidence: testEvidence,
    }],
  };
}

export function alternateLocale(locale, href) {
  return { href, locale };
}
