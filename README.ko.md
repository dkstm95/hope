<p align="center">
  <img src="plugins/hope/assets/telescope.svg" width="128" alt="Hope 망원경 아이콘">
</p>

<h1 align="center">Hope</h1>

<p align="center"><strong>Hope는 사람과 AI가 더 잘 협업하는 실용적인 방법을 찾습니다.</strong></p>

<p align="center"><a href="README.md">English</a></p>

## 현재 상태

Hope의 최종 목표는 독립적인 하네스 환경이다. 현재는 독립 하네스를 만드는 동안
Codex와 Claude Code에서 사용할 수 있는 플러그인과 스킬을 제공한다.

## 설치

Hope를 사용하려면 Node.js 20 이상과 인증된
[GitHub CLI](https://cli.github.com/)가 필요하다. 필요하다면 먼저
`gh auth login`을 실행한다.

가장 간단한 방법은 Codex나 Claude Code에 다음과 같이 요청하는 것이다.

```text
https://github.com/dkstm95/hope 저장소의 Hope를 현재 AI 도구에 설치해줘.
저장소의 README를 따르고, 다시 시작해야 한다면 알려줘.
```

Codex에 직접 설치하려면 다음 명령을 실행한다.

```bash
codex plugin marketplace add dkstm95/hope
codex plugin add hope@hope
```

Claude Code에 직접 설치하려면 다음 명령을 실행한다.

```bash
claude plugin marketplace add dkstm95/hope
claude plugin install hope@hope
```

설치한 뒤 새 Codex 또는 Claude Code 세션을 시작한다.

## 기능

### Diff

Diff는 하나의 정확한 GitHub PR을 설명하는 비공개 단일 HTML 파일을 만든다.
URL을 생략하면 현재 브랜치의 PR을 우선 고른다. 그런 PR이 없으면 현재 GitHub
사용자가 만든 최신 열린 PR을 고른다.

Codex에서는 `$hope:diff`, Claude Code에서는 `/hope:diff`를 사용한다.
특정 PR을 고르려면 GitHub PR URL을 함께 입력한다.

```text
$hope:diff https://github.com/owner/repository/pull/123
```

### Settings

Hope 기능에서 함께 사용할 언어와 테마를 한 번 정한다. 언어는 `ko-KR` 또는
`en-US`, 테마는 `system`, `light`, `dark` 중에서 고른다.

Codex에서는 `$hope:settings`, Claude Code에서는 `/hope:settings`를 사용한다.

## 라이선스

[MIT](LICENSE)
