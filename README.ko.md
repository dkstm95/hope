<p align="center">
  <img
    src="plugins/hope/assets/telescope.svg"
    width="128"
    alt="Hope 망원경 아이콘"
  >
</p>

<h1 align="center">Hope</h1>

<p align="center">
  <strong>
    Hope는 사람과 AI가 더 잘 협업하는 실용적인 방법을 찾습니다.
  </strong>
</p>

<p align="center"><a href="README.md">English</a></p>

## 설치

Hope 플러그인은 Codex와 Claude Code에 설치할 수 있습니다. Node.js 20 이상이
필요합니다. Diff에는 인증된
[GitHub CLI](https://cli.github.com/)도 필요합니다. 필요하다면 먼저
`gh auth login`을 실행하세요.

가장 간단한 방법은 Codex나 Claude Code에 다음과 같이 요청하는 것입니다.

```text
https://github.com/dkstm95/hope 저장소의 Hope를 현재 AI 도구에 설치해 주세요.
저장소의 README에 따라 설치하고, 다시 시작해야 한다면 알려 주세요.
```

Codex에 직접 설치하려면 다음 명령을 실행하세요.

```bash
codex plugin marketplace add dkstm95/hope
codex plugin add hope@hope
```

Claude Code에 직접 설치하려면 다음 명령을 실행하세요.

```bash
claude plugin marketplace add dkstm95/hope
claude plugin install hope@hope
```

설치한 뒤 새 Codex 또는 Claude Code 세션을 시작하세요.

## 기능

### Diff

Diff는 `github.com` PR의 변경을 특정 커밋 기준으로 이해하도록 돕습니다. 결과는
하나의 로컬 단일 HTML 파일로 만듭니다.

<p align="center">
  <img
    src="assets/readme/hope-diff-playwright-41939.png"
    alt="Microsoft Playwright PR 41939를 분석한 Hope Diff 결과"
  >
</p>

Codex에서는 `$hope:diff`, Claude Code에서는 `/hope:diff`를 사용합니다.
특정 PR을 고르려면 GitHub PR URL을 함께 입력하세요.

```text
$hope:diff https://github.com/owner/repository/pull/123
```

URL 없이 실행할 때는 대상 저장소 안에서 Hope를 실행하세요. Hope는 그
저장소에서 현재 GitHub 사용자가 만든 열린 PR을 찾습니다. 현재 브랜치의 PR을
먼저 고르고, 없으면 가장 최근 PR을 고릅니다.

Hope는 PR 설명, 커밋 제목, 수집할 수 있는 변경 파일의 본문을 읽습니다. 변경되지
않은 저장소 파일, PR 토론, 리뷰 댓글, CI 결과는 확인하지 않습니다. 테스트,
빌드, 린트 명령이나 그 밖의 저장소 코드도 실행하지 않습니다.

리뷰는 현재 Codex 또는 Claude Code 세션에서 해당 도구와 계정의 정책에 따라
처리됩니다. 완성된 HTML 파일은 로컬에 저장되며 오프라인에서도 열립니다. 파일에
표시된 커밋을 기록하며 이후 PR 변경은 반영하지 않습니다. PR이 바뀌면 Diff를
다시 실행하세요.

Diff는 사용자의 판단에 필요한 설명과 근거를 제공합니다. 승인이나 반려를
추천하지 않습니다. PR을 병합하거나 수정하거나 댓글을 작성하지 않습니다.

<p align="center">
  <img
    src="assets/readme/hope-diff-playwright-41939-details.png"
    alt="Hope Diff 결과의 동작 흐름, 코드 흐름, 검토 항목"
  >
</p>

### Settings

Settings로 Hope의 모든 경로에서 사용할 언어와 테마 설정을 저장할 수 있습니다.

Codex에서는 `$hope:settings`, Claude Code에서는 `/hope:settings`를 사용해
설정을 확인하거나 바꾸거나 초기화합니다.

저장된 설정이 없으면 Hope는 현재 도구나 운영체제의 언어를 따르고 시스템 테마를
사용합니다.

## 라이선스

[MIT](LICENSE)
