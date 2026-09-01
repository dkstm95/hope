<p align="center">
  <img
    src="plugins/hope/assets/hope-protected-light.png"
    width="128"
    alt="Hope 프로텍티드 라이트 아이콘"
  >
</p>

<h1 align="center">Hope</h1>

<p align="center">
  <strong>
    Hope는 사람이 AI와 함께 일하면서도 작업을 보고, 이해하고, 통제할 수 있도록 돕습니다.
  </strong>
</p>

<p align="center"><a href="README.md">English</a></p>

<br>

## 기능

### 🤝 Align — 구현 전에 의도와 중요한 결정을 함께 이해합니다

Align은 대화, 관련 코드, 프로젝트의 아키텍처·스키마·정책·디자인 권위에서 시작합니다. AI가 결정 트리를 만들고 사실을 조사하며 최선의 방향을 추천한 뒤, 의존 관계가 준비된 질문 전체를 한 라운드에 묻습니다. 사용자는 결과를 이해할 가치가 있는 선택을 직접 결정하거나 AI에 위임합니다.

데이터 모델링과 아키텍처가 목표, 장기 제약, 미래 선택지, 중요한 위험을 바꾸는 순간 Align의 대화에 들어옵니다. 되돌리기 쉬운 코드 메커니즘은 구현 AI가 맡습니다. 사용자가 되가르친 이해를 확인하면 Align이 끝나고, 별도의 선택으로 지금 구현을 시작하거나 이후로 남겨 둡니다.

그 이해를 오래 보존할 가치가 있으면 Align은 프로젝트 안에 하나의 독립형 HTML 산출물을 만듭니다. 산출물에는 목표와 문제, 의도한 결과, 중요한 결정, 제외·위임한 결정, 관련 흐름이 담깁니다. 구현은 사용자가 확인한 수준을 기준으로 삼고 실행과 완료 근거를 이어서 소유합니다.

중요한 시각 선택에는 프로젝트를 바탕으로 만든 2~3개의 이미지 방향을 근거로 제시합니다. 같은 결정 frontier가 이 탐색의 가치를 판단합니다.

> [!IMPORTANT]
> 생성된 Align 문서는 프로젝트 문서입니다. 관련 변경과 함께 버전 관리에
> 포함하는 방식을 기본으로 삼습니다.

**전체 HTML 예시:** [출처 충돌·변경·취소와 판단 책임을 합의한 한국어 팬 일정 Align 기록을 엽니다.](docs/alignments/rescene-fan-calendar.ko.html)

![신뢰 가능한 팬 일정의 목표와 공유된 이해를 보여 주는 다크 Hope Align 기술 기록](assets/readme/hope-align-ko.png)

<details>
<summary>Align 세부 이미지 보기</summary>

| 라이트 시각 시안 | 다크 공유 이해와 판단 기준 |
| --- | --- |
| [![한국어 Align 문서에서 비교한 신뢰 가능한 팬 일정 UI 두 가지](assets/readme/hope-align-directions-ko.png)](assets/readme/hope-align-directions-ko.png) | [![한국어 Align 문서의 출처 우선순위, 충돌, 최신성, 취소 결정](assets/readme/hope-align-decisions-ko.png)](assets/readme/hope-align-decisions-ko.png) |

</details>

---

### 🔎 Diff — 코드 변경을 이해하고 다음 작업을 발견합니다

AI는 큰 코드 변경을 빠르게 만들 수 있습니다. Diff는 엔지니어가 그 결과의 동작, 조건, 경계, 근거를 간결하게 이해하도록 돕습니다.

Diff는 하나의 HTML 문서를 만들어 코드보다 동작을 먼저 설명하고 중요한 주장에 근거를 연결합니다.

능동적인 이해를 돕기 위해 시각 자료, 마이크로월드, 퀴즈를 활용하기도 합니다.

이를 통해 변경의 작동 모델을 세우고 후속 질문, 결정, 작업 아이디어로 이어 갑니다.

> [!NOTE]
> URL 없이 실행하면 먼저 현재 브랜치의 PR을 찾습니다.
> 없으면 저장소에서 사용자가 만든 최신 열린 PR을 선택합니다.
> PR이 바뀌면 Diff를 다시 실행하세요.

아래 이미지는 [Ky PR #825](https://github.com/sindresorhus/ky/pull/825)을 바탕으로
고정된 한국어 Diff 예시에서 만들었습니다.

**전체 HTML 예시:** [Ky PR #825의 전체 시간 제한을 결정표, 마이크로월드, 퀴즈로 설명한 한국어 Diff 결과물을 엽니다.](docs/diffs/ky-825-total-timeout.ko.html)

![Ky PR 825의 목표, 공유 시간 제한 동작, 검토 항목을 보여 주는 다크 Hope Diff 기술 기록](assets/readme/hope-diff-ko.png)

<details>
<summary>Diff 세부 이미지 보기</summary>

| 라이트 결정표 | 다크 인터랙티브 마이크로월드 |
| --- | --- |
| [![한국어 Diff 문서의 공유 시간 제한 결정표](assets/readme/hope-diff-core-ko.png)](assets/readme/hope-diff-core-ko.png) | [![한국어 Diff 문서의 인터랙티브 전체 시간 제한 마이크로월드](assets/readme/hope-diff-microworld-ko.png)](assets/readme/hope-diff-microworld-ko.png) |

[![한국어 Diff 라이트 문서의 공유 시간 제한과 재시도 이해 퀴즈](assets/readme/hope-diff-quiz-ko.png)](assets/readme/hope-diff-quiz-ko.png)

</details>

---

### ⚖️ Toxic Review — Red–Blue 방식으로 결과물을 냉정하게 검토합니다

Red가 찾고, Blue가 검증하고, 메인 에이전트가 판정합니다.

Red 리뷰어들은 서로 독립적으로 서로 다른 중요한 위험을 파고듭니다. 우선순위가
높거나 광범위하고 되돌리기 어려운 조치를 제안하거나 실질적으로 불확실한 모든 지적
사항에는 새로운 Blue 검증 에이전트가 붙습니다. Blue는 봉인된 지적 사항과 범위 안의
근거를 바탕으로 문제, 영향, 범위, 제안 조치를 각각 반증합니다.

메인 에이전트는 각 후보의 최종 판정과 실행 가능한 후보의 최종 우선순위를 기록하고,
근거가 뒷받침하는 수준을 넘지 않는 지적 사항만 실행 항목으로 보고합니다.

> [!TIP]
> 일상적인 실행 규모를 줄이려면 Hope에 Red 리뷰어 수를 제한해 달라고 요청하세요.
> 규모만으로 Blue를 추가하지는 않지만, 우선순위가 높거나 광범위한 조치를 제안하거나
> 실질적으로 불확실한 지적 사항에는 반드시 Blue가 붙습니다.

---

### 🧹 Sweep — 코드베이스를 청소합니다

Sweep은 명시적으로 호출할 때만 시작하며, 근거가 있고 기존 동작을 유지하는
정리를 바로 적용합니다.

사용자가 저장소 안의 더 좁은 범위를 지정하지 않으면 현재 저장소 전체를
대상으로 합니다.

다음 항목을 정리합니다.

- 데드 코드와 그 코드만을 위한 테스트, 문서, 설정, 생성 단계, 자산
- 중복 구현, 불필요한 작업과 간접 계층
- 부족하거나 과도한 추상화와 잘못된 책임 경계
- 코드와 맞지 않는 문서, 주석, 예시, 설정
- 안전한 리팩터링에 필요한 최소한의 테스트와 검사

버그 수정, 동작이나 공개 계약 변경, 제품 결정, 불확실한 제거는 Sweep의
범위에 포함하지 않습니다.

---

### ◇ Diagram — 관계를 더 쉽게 이해할 수 있게 보여 줍니다

Diagram은 위치, 연결, 순서, 계층, 상태, 수량의 형태가 글이나 작은 표보다
의미를 더 분명하게 전달할 때 설명용 다이어그램과 차트를 만들고, 다듬고,
검토합니다.

독립적인 다이어그램 요청을 맡을 수도 있고, 다른 Hope 작업의 범위·산출물·완료
조건을 바꾸지 않은 채 그 작업 안에서 함께 사용할 수도 있습니다. 하나의 주요 시각
문법을 고르고, 글자를 줄이기 전에 세부 내용을 삭제하거나 묶으며, 강조 요소를
제한하고, 연결선을 끝까지 추적할 수 있게 합니다. 출처의 불확실성을 보존하고 실제
사용 크기로 렌더링한 뒤에야 검증됐다고 판단합니다. 다른 Hope 기능은 근거와 산출물
계약을 계속 소유하면서 시각화 선택과 디자인에는 Diagram의 공통 기준을 사용합니다.

**전체 HTML 예시:** [Diagram이 만든 택배 인계 다이어그램을 엽니다.](docs/visualizations/parcel-handoff.html)

![온라인 주문이 쇼핑몰, 물류센터, 배송기사, 수령자에게 인계되는 과정을 보여 주는 다크 Hope Diagram 기술 기록](assets/readme/hope-diagram-ko.png)

디자인 기준은 Cathryn Lavery의
[Diagram Design](https://github.com/cathrynlavery/diagram-design)을 MIT
라이선스에 따라 각색했습니다. Hope에는 필요한
[원본 고지](plugins/hope/skills/diagram/LICENSE.diagram-design)를 포함하지만,
Diagram Design의 템플릿·스크립트·글꼴·갤러리·제3자 아이콘은 포함하지 않습니다.

---

### ✍️ Write — 의미를 보존하며 명확하게 글을 작성합니다

Hope는 구현과 다른 Skill을 포함한 작업 안에서도 Write를 사용합니다.

Write의 공통 기준은 조지 오웰의
[「Politics and the English Language」](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/)에
담긴 여섯 가지 원칙을 바탕으로 합니다.

<br>

## 설치

다음 항목들이 필요합니다.
- Node.js 22 이상
- Diff를 사용하려면 인증된 [GitHub CLI](https://cli.github.com/)가 필요합니다. 필요하다면 먼저 `gh auth login`을 실행하세요.

> [!TIP]
> 가장 간단한 설치 방법은 AI에게 다음과 같이 요청하는 것입니다.
>
> ```text
> https://github.com/dkstm95/hope 저장소의 Hope를 현재 AI 도구에 설치해 주세요.
> 저장소의 README에 따라 설치하고, 다시 시작해야 한다면 알려 주세요.
> ```

직접 설치하려면 사용 중인 도구의 명령을 실행하세요.

예시:
```bash
# Codex
codex plugin marketplace add dkstm95/hope
codex plugin add hope@hope
```

```bash
# Claude Code
claude plugin marketplace add dkstm95/hope
claude plugin install hope@hope
```

## 라이선스

[MIT](LICENSE)

Diagram에서 각색한 디자인 지침에는
[Diagram Design MIT 고지](plugins/hope/skills/diagram/LICENSE.diagram-design)도
적용됩니다.
