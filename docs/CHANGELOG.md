# CHANGELOG

## [0.0.10 fix3-repair] - 2026-07-07 - 남은 window.alert() 전체 제거(공작소 스타일 안내 카드로 교체)

### 목적
`GPT_Gongjakso_0.0.10_fix3.zip`에서 검은 `window.confirm()`은 모두 공작소 스타일 확인 팝업으로 교체했지만, 순수 안내성 `window.alert()`는 일부만 남아 있었다. 이번 보완 작업은 app-core.js에 남아 있던 나머지 `alert()`를 전부 공작소 스타일 안내 카드(전역 토스트) 또는 버튼 텍스트 피드백으로 교체한다. fix3의 다른 기능(상세 팝업, 확인 팝업, 정상 확인 카드 등)은 그대로 유지한다.

### 신규 공통 컴포넌트: 전역 안내 카드(js/app-core.js `showToast()`, index.html `#app-toast`, css/components.css `.app-toast*`)
- 검은 시스템 alert 대신 화면 하단 중앙에 뜨는 흰/연한 배경 카드. 성공은 초록(`--success`), 실패는 빨강(`--fail`), 확인 필요는 아니지만 사전 조건 미충족 등 주의 안내는 주황(`--warn`)으로 구분한다.
- 등록/미리보기/설정/백업 등 어느 팝업이 열려 있어도 그 위에 뜨도록 `z-index`를 팝업(100)보다 높은 300으로 지정했다. 약 2.6초 후 자동으로 사라진다.

### alert() → 안내 카드로 교체한 항목
```text
미리보기를 열 수 없습니다. (자료실 상세, 등록 팝업 2곳) → 실패 카드
미리보기를 표시할 수 없습니다. (미리보기 팝업) → 실패 카드
ZIP 파일을 먼저 선택해주세요. → 주의 카드
저장에 실패했습니다. (등록 팝업) → 실패 카드
자료실에 저장되었습니다. / 저장에 실패했습니다(파일 조건 안내) (GPT 업로드) → 성공/실패 카드
데이터가 초기화되었습니다. / 초기화에 실패했습니다. → 성공/실패 카드
지시서를 업로드했습니다. / 지시서 저장에 실패했습니다. → 성공/실패 카드
전체 데이터를 내보냈습니다. / 내보내기에 실패했습니다. → 성공/실패 카드
N개의 글을 가져왔습니다. / 가져오기에 실패했습니다. → 성공/실패 카드
```

### alert() → 버튼 텍스트 피드백으로 교체한 항목
```text
지시서를 클립보드에 복사했습니다. / 복사에 실패했습니다. (guideline-copy-btn)
GPT 지시서를 클립보드에 복사했습니다. / 복사에 실패했습니다. (copy-guideline-btn)
```
위 2건은 fix3에서 이미 같은 방식으로 바꾼 수정요청/문제 항목/개선내역 복사 버튼(`flashButtonFeedback()`)과 동일한 패턴(버튼 텍스트를 "✅ 복사 완료"/"❌ 복사 실패"로 잠깐 변경)을 그대로 재사용했다.

### 확인 결과
- app-core.js 전체에서 `window.alert()`/`window.confirm()` 호출이 모두 제거되었다(주석에서만 언급).

### 버전/빌드 표시
- version.json: `build`를 `flow-check-gemini-auto-fix3-repair`, `displayVersion`을 `v0.0.10-fix3-repair`로 갱신.
- 로그인 화면 버전 표시를 `v0.0.10-fix3-repair`로 갱신(index.html). `AppState.build`도 동일하게 갱신(js/app-core.js).

### 범위 제외 (이번 fix3-repair에서 다루지 않음)
- fix3에서 이미 구현한 문제 항목/개선내역 상세 팝업, 검은 confirm() 대체, 전체점검 정상 확인 카드 등은 재작업하지 않았다.
- js/auth-module.js, worker-api-module.js, storage-module.js, archive-module.js, backup-module.js, seo-module.js, error-log-module.js, gpt-upload-module.js, zip-upload-module.js, guideline-module.js, image-module.js, statistics-module.js, gemini-review-module.js, preview-module.js, blogger-module.js, schedule-module.js, vendor/zip-reader.js, css/base.css, css/layout.css는 이번에도 수정하지 않았다.

## [0.0.10 fix3] - 2026-07-07 - 문제 항목/개선내역 상세 팝업 + 검은 확인창 제거 + 정상 확인 카드 보정

### 목적
`GPT_Gongjakso_0.0.10_fix2.zip` 실기 확인 후 남은 3가지 문제만 최소 수정한다. 0.0.10-fix2의 업로드/패키지 점검/품질검수/저장 판단 흐름과 상태 배지 공통화, 모달 X 고정, 배경 스크롤 잠금, 버튼 텍스트 넘침 보정, 광고 조건부 숨김, Blogger 전송 시 CSS 노출 방지, dataUrl 안내 문구는 그대로 유지한다.

### 문제 항목/개선내역 상세 팝업(js/app-core.js, index.html, css/components.css)
- 기존에는 문제 항목/개선내역을 목록 안에서 탭하면 그 자리에서 펼치는 방식(fix2)이었으나, 실기에서 "클릭해도 상세 내용이 잘 보이지 않는다"는 문제가 확인되어 별도의 흰색 상세 팝업(`#popup-item-detail`)으로 교체했다.
- 목록은 fix2와 동일하게 1줄 요약 + 말줄임을 유지하고, 항목을 클릭하면 상세 팝업이 열린다.
- 문제 항목 상세: 구분(type)/심각도(severity)/문제 내용(message 전체)/제안(suggestion 전체)을 모두 표시.
- 개선내역 상세: 개선 번호 + 개선내역 전체 문장을 표시(데이터 구조상 개선내역과 특정 문제 항목을 연결하는 필드가 없어, 실제로 존재하지 않는 관계를 표시하지 않기 위해 "관련 문제 항목" 자동 매칭은 넣지 않았다 — 아래 KNOWN_LIMITATIONS 참고).
- 상세 팝업에는 상단 아이콘+제목, X 닫기 버튼, [내용 복사]/[닫기] 버튼이 있으며, 복사 시 말줄임 없이 전체 문구가 클립보드에 복사된다.
- 상세 팝업은 등록하기 팝업 위에 겹쳐 뜰 수 있으며, fix2에서 만든 팝업 배경 잠금 카운터(`openPopup`/`closePopup`)를 그대로 재사용하므로 뒤 배경은 스크롤되지 않고, 상세 팝업을 닫아도 등록하기 팝업 상태는 그대로 유지된다.
- 수정요청 복사(`GeminiReviewModule.buildRewriteRequestText()`)는 이번에도 변경하지 않았다 — 원래부터 말줄임 없이 전체 문제 항목/개선내역을 포함하고 있었음을 재확인했다.

### 검은 시스템 confirm() 제거 + 공작소 스타일 확인 팝업(js/app-core.js, index.html, css/components.css)
- 신규 공통 컴포넌트 `#popup-confirm-action` + `showConfirmAction()`/`bindConfirmActionEvents()`를 추가했다(아이콘+제목+설명+취소/확인 버튼, 위험한 동작은 확인 버튼을 빨강 계열로 표시).
- 아래 4곳의 검은 `window.confirm()`을 이 팝업으로 교체했다: 블로그 임시저장, 예약 저장, 지시서 기본 복구, 전체 데이터 가져오기(덮어쓰기 경고).
- 기존에는 확인창 자체가 없었던 [폐기](등록 팝업)와 [문제 있어도 보관] 버튼에도 동일한 확인 팝업을 새로 추가했다(작업지시서 6.1에 명시된 적용 대상).
- 수정요청/문제 항목/개선내역의 [내용 복사] 버튼들의 성공·실패 알림을 검은 `alert()` 대신 버튼 텍스트를 잠깐 바꿔 보여주는 방식(`flashButtonFeedback()`)으로 바꿨다(품질검수/등록 팝업의 기존 수정요청 복사 버튼 3곳 + 신규 상세 팝업 복사 버튼).
- 위 목록에 포함되지 않은 다른 `alert()`(ZIP 미선택, 저장 실패, 지시서 업로드/복사, 백업 내보내기/가져오기 결과 등 순수 안내성 알림)는 이번 작업지시서의 문제 목록·6.1 적용 대상에 해당하지 않아 손대지 않았다 — 필요하면 별도로 알려달라.

### 정상 확인 카드(index.html, js/app-core.js)
- 설정 → 전체점검에서 모든 항목이 "통과"이면 목록 위에 `✅ 확인 결과 특이사항 없음` 카드(기존 `.result-card--success` 스타일 재사용)를 표시한다. 문제가 하나라도 있으면 카드를 숨기고 기존처럼 항목별 배지만 보여준다.
- Worker 연결 확인/패키지 점검/품질검수 통과/Blogger 연결/임시저장·예약 저장 완료는 fix2에서 이미 초록 아이콘 배지 또는 초록 결과 카드로 표시되고 있어 이번에는 추가로 손대지 않았다.

### 모달 중첩/배경 스크롤(신규 컴포넌트 재사용)
- 새 상세 팝업/확인 팝업 모두 fix2의 `.popup-overlay`/`.popup-panel` 구조와 `openPopup()`/`closePopup()` 배경 잠금 카운터, `bindModalScrollLock()`의 `touchmove` 차단 로직을 그대로 재사용했다. 별도의 새 모달 프레임워크를 만들지 않았으므로 iPhone Safari 배경 터치/드래그 방지 동작도 fix2와 동일하게 적용된다.

### 버전/빌드 표시
- version.json: `build`를 `flow-check-gemini-auto-fix3`, `displayVersion`을 `v0.0.10-fix3`로 갱신.
- 로그인 화면 버전 표시를 `v0.0.10-fix3`로 갱신(index.html). `AppState.build`도 동일하게 갱신(js/app-core.js). `AppState.version`(0.0.10)과 설정 화면 "버전" 표시는 fix1/fix2와 동일한 방식으로 유지하고, "빌드" 표시로 fix3 반영 여부를 확인한다.

### 범위 제외 (이번 fix3에서 다루지 않음)
- OpenAI API 자동 글 생성, Gemini의 ZIP 직접 수정, Blogger API 핵심 로직 대규모 변경, 자료실 저장소 구조 대규모 변경, 로그인 인증 로직 전체 재작성, 새 브랜드/메뉴 추가, GitHub 직접 반영
- 6.1에 명시되지 않은 나머지 `alert()` 안내 문구(순수 정보성 알림) 전면 교체
- 개선내역-문제 항목 자동 매칭 표시(데이터 구조상 근거 없는 관계를 만들지 않기 위해 보류)

## [0.0.10 fix2] - 2026-07-07 - 실기 UI 잔여 보정(상태 표시 공통화 / 모달·버튼/Blogger 전송 보정)

### 목적
`GPT_Gongjakso_0.0.10_fix1.zip` 실기 확인 후 남은 UI/검수 표시/모달/Blogger 전송 문제를 보정한다. 0.0.10/0.0.10 fix1의 핵심 흐름(업로드 → 패키지 점검 자동 실행 → Gemini 품질검수 자동 실행 → 사용자 판단 → 저장)은 그대로 유지하며, 전체 재공사가 아니라 실기에서 확인된 항목만 최소 수정한다.

### 상태 표시 공통화
- **상태 배지 공통 헬퍼 추가(js/app-core.js)**: `applyStatusBadge()`/`classifyStatusKind()`를 추가해 통과·정상·완료류는 ✅ 초록, 주의·보완필요는 ⚠️ 주황, 실패·오류는 ❌ 빨강, 진행중은 🔄, 대기는 ⏳ 회색으로 앱 전체에서 동일하게 표시한다(css/components.css `.status-badge`, `.status-badge--*`).
- 적용 범위: 패키지 점검 카드(값+카드 배경/테두리), 품질검수 점수/상태(등록 팝업·자료실 상세), 자료실 목록/상세 상태, 블로그 등록 후보 목록 상태, Blogger 임시저장/예약 결과 카드(아이콘 접두어), 전체점검 결과 항목, 설정 Worker 연결확인/저장 결과, 설정·블로그 등록 팝업의 블로그스팟 연결 상태, 품질검수 실패 사유 카드.
- **패키지 점검 카드 색상 강조(css/components.css)**: 정상/주의/실패에 따라 카드 배경·테두리 색을 다르게 표시하는 `.card--status-ok/--warn/--fail`을 추가했다.

### 품질검수 진행 표시 한 줄화 + Gemini 명칭 노출 최소화
- **진행 표시 한 줄 축소(css/components.css `.card__value--progress`, index.html, js/app-core.js)**: "Gemini 품질검수 요청 중... 00:09"처럼 길어서 줄바꿈되던 표시를 "🛠️ 품질검수 중... 00:09" 한 줄로 줄였다.
- **일반 화면 Gemini 명칭 마스킹(js/app-core.js `maskGeminiLabel()`)**: 진행 단계 문구("Gemini 응답 대기" 등)를 "AI 응답 대기"로 치환해 화면에 노출한다. 등록 팝업 안내 문구도 "공작소 품질검수"로 변경했다(index.html). Blogger/예약 저장 조건 안내 문구에서도 "Gemini" 명칭을 제거했다(js/blogger-module.js, js/schedule-module.js). 설정/오류 상세(오류백과, 실패 사유 분류 등)는 기존과 동일하게 Gemini 명칭을 유지한다(변경하지 않음).

### Gemini 품질검수 기준 단계화
- **점수 단계/지침을 Worker 요청 payload에 포함(js/gemini-review-module.js)**: `reviewGuideline.scoreTiers`(90~100/80~89/60~79/40~59/0~39)와 "무조건 전면 재작성을 요구하지 말고 부분 보완/핵심 수정/사용 금지 수준을 구분해서 제시" 지침 문자열을 payload에 추가했다. 실제 판정/프롬프트 조립은 Worker(백엔드)가 수행하므로, 이번 변경은 참고용 안내 필드 추가에 한정된다(이 프로젝트에는 Worker 코드가 포함되어 있지 않다).

### 문제 항목/개선내역 펼쳐보기
- **탭하여 전체 보기 추가(js/app-core.js `renderIssueList`/`renderImprovementList`, css/components.css `.check-item--review`, `.check-item--expandable`, `.check-item--expanded`)**: 기본은 1줄 요약(말줄임)으로 보이고, 항목을 탭하면 message/suggestion 전체 내용이 펼쳐진다. 수정요청 복사 문구는 이전과 동일하게 항상 전체 문제 항목/개선내역을 포함한다(`GeminiReviewModule.buildRewriteRequestText()`는 변경하지 않음, 애초에 말줄임 없이 전체 텍스트를 사용하고 있었음을 확인).

### 모달 닫기/스크롤 잠금
- **X 닫기 버튼 항상 표시(js/app-core.js `setRegisterStage`)**: 기존에는 품질검수 결과 확인(저장 판단 대기) 상태에서 실수 방지를 위해 X 버튼 자체를 숨겼으나, 이 때문에 "닫기 버튼이 보이지 않는다"는 문제가 생겼다. X 버튼은 이제 모든 단계에서 항상 표시하고, 저장 판단 대기 여부는 버튼의 hidden 클래스 대신 별도 상태 변수(`currentRegisterStage`)로 추적해 기존과 동일하게 닫기 전 확인창을 띄운다.
- **배경 스크롤/터치 잠금(js/app-core.js `openPopup`/`closePopup`/`bindModalScrollLock`, css/layout.css `body.modal-open`)**: 팝업이 열려 있는 동안 `body.modal-open` 클래스를 적용하고, 모달 내부 스크롤 컨테이너가 아닌 영역에서는 `touchmove`를 막아 iPhone Safari에서 배경이 스크롤/러버밴드되는 것을 방지했다. 내부 스크롤 컨테이너에는 `-webkit-overflow-scrolling: touch`를 추가했다.

### 모바일 버튼 텍스트 넘침 보정
- **버튼 줄바꿈 허용(css/components.css `.btn`)**: `white-space: nowrap` → `normal`로 바꿔 텍스트가 버튼 밖으로 튀어나오지 않고 필요 시 2줄로 감싸지도록 했다.
- **미리보기 3버튼 좁은 화면 2열화(css/components.css, 380px 이하 미디어쿼리)**: "HTML 본문 보기/원문 보기/텍스트 보기" 버튼이 좁은 화면에서 2열로 배치되도록 폭/글자 크기를 조정했다.

### 광고 영역 조건부 숨김
- **광고 슬롯 컨테이너 추가(index.html `.preview-ad-slot`, js/app-core.js `renderPreviewAdSlots`)**: 실제 광고 설정/데이터가 아직 없으므로 기본값(`AD_DISPLAY_ENABLED = false`)으로 광고 점선 박스와 안내문을 숨긴다. 이후 실제 광고 연동이 추가되면 이 플래그(또는 조건)만 교체하면 된다.

### Blogger 전송 content 정리
- **`<style>` 태그 제거(js/preview-module.js `FORBIDDEN_TAGS`)**: `sanitizeHtml()`의 금지 태그에 `style`을 추가했다. Blogger 전송용 content(`BloggerModule.buildBloggerPayload()`)가 이 결과를 그대로 사용하므로, 본문 중간에 섞여 있던 `<style>` 블록이 Blogger 관리자 화면에 CSS 원문 텍스트로 노출되던 문제가 해결된다. 미리보기/원문 보기/텍스트 보기는 각각 다른 데이터(safeHtml/markdownContent/textContent)를 사용하므로 이번 변경의 영향을 받지 않는다.
- **dataUrl 이미지 안내 문구 보정(index.html)**: "이미지가 브라우저 임시 저장(dataUrl) 형식입니다..." → "현재 이미지는 브라우저 임시 이미지입니다. 블로그스팟 본문에 정상 표시하려면 이미지 URL 변환이 필요합니다. 임시저장은 계속 진행되지만, Blogger 화면에서는 이미지가 보이지 않을 수 있습니다."로 더 쉬운 표현으로 다듬었다.

### 버전/빌드 표시
- version.json: `build`를 `flow-check-gemini-auto-fix2`, `displayVersion`을 `v0.0.10-fix2`로 갱신.
- 로그인 화면 버전 표시를 `v0.0.10-fix2`로 갱신(index.html). `AppState.build`도 동일하게 갱신(js/app-core.js). `AppState.version`(0.0.10)과 설정 화면의 "버전" 표시는 이전과 동일하게 유지하고, "빌드" 표시로 fix2 반영 여부를 확인할 수 있게 했다(0.0.10 fix1과 동일한 방식).

### 폐기 버튼 danger 스타일 분리
- 등록 팝업의 [폐기] 버튼에 `btn--danger` 클래스를 추가해 빨강 계열로 분리했다(index.html). 자료실 상세의 [삭제 하기] 버튼은 기존에도 동일하게 적용되어 있었다.

### 범위 제외 (이번 fix2에서 다루지 않음)
- OpenAI API 자동 글 생성, Gemini의 ZIP 직접 수정, Blogger 자동 발행 로직 대규모 변경, 자료실 저장소 구조 대규모 변경, 로그인 인증 로직 전체 재작성, GitHub 직접 반영
- Worker(백엔드)의 실제 Gemini 프롬프트 조립 로직 자체(이 프로젝트에는 Worker 코드가 포함되어 있지 않으며, 프론트는 참고용 가이드 필드만 추가했다)

## [0.0.10] - 2026-07-07 - 업로드 → 패키지 점검 → Gemini 품질검수 자동 실행 → 사용자 판단 → 저장 흐름 재정리

### 목적
업로드 검증 점수/자료실 SEO 점수/Gemini 품질검수 점수가 서로 달라 사용자가 혼란을 느끼던 문제를 해결한다. 점수 체계를 Gemini 품질검수 점수 하나로 통일하고, "업로드 → 패키지 점검 자동 실행 → (문제 없으면) Gemini 품질검수 자동 실행 → 결과 확인 → 사용자가 저장/수정/폐기 판단" 흐름으로 등록 팝업을 재정리했다. 로그인 인증/Blogger 저장·발행 흐름/자료실 저장소 구조 대규모 변경/Gemini의 ZIP 직접 수정 기능은 추가하지 않았다.

### 흐름 변경
- **패키지 점검으로 명칭/기준 변경(js/zip-upload-module.js)**: 기존에는 SEO 판정이 "통과"여야만 저장이 가능했으나, 이제는 필수 파일/이미지 구조만 정상이면(패키지 점검 "정상" 또는 "주의") 저장·Gemini 품질검수 진행이 가능하다. SEO 검수는 더 이상 통과/미통과 게이트가 아니라 "주의 항목"으로만 취급되며, 화면에는 숫자 점수 대신 정상/주의/실패 상태만 표시한다(내부 계산 로직 자체는 유지)
- **업로드 즉시 자료실 저장 금지(js/app-core.js, index.html)**: ZIP 선택 → 패키지 점검 자동 실행 → (정상/주의 시) Gemini 품질검수 자동 실행 → 결과 확인 후 사용자가 [자료실 저장]/[문제 있어도 보관]을 눌렀을 때만 저장하도록 변경. 패키지 점검이 "실패"면 Gemini 품질검수를 실행하지 않고 오류 목록과 [수정요청 복사]/[다시 업로드]/[폐기]만 표시한다
- **재검증 버튼 삭제, 다시 업로드/다시 품질검수로 분리(index.html, js/app-core.js)**: 기존 "재검증" 버튼을 삭제하고 [다시 업로드](새 ZIP 선택)와 [다시 품질검수](같은 패키지로 Gemini만 재실행)로 분리했다. 패키지 점검은 ZIP 선택 즉시 자동 실행되므로 별도 버튼이 필요 없다
- **점수 체계 통일(js/app-core.js)**: 자료실 카드/상세의 "SEO 80점 통과" 같은 표시를 제거하고 "품질검수 통과 · 85점" 형태로 통일했다(`post.geminiReview`에 상태/점수/요약을 저장). Gemini 품질검수를 거치지 않은 글은 "품질검수 전"으로 표시한다

### Gemini 결과 화면
- **개선내역(improvements) 표시 추가(js/gemini-review-module.js, index.html, js/app-core.js)**: Gemini 응답의 `improvements` 배열을 화면에 표시하고, 없으면 `issues`의 `suggestion`으로 대체 생성한다. 자료실 상세의 기존 품질검수 결과 카드에도 동일하게 개선내역 목록을 추가했다
- **Worker 응답 파서**: `response.result` → `response.review` → `response.data` → `response` 자체 순서로 해석(0.0.9 fix2에서 이미 result/review/data 처리가 있었음을 확인하고 개선내역 파싱만 보강)
- **진행 표시**: "패키지 점검 완료 → Gemini 품질검수 요청 중... 00:00 → 단계: Worker 전송/Gemini 응답 대기/결과 정리" 타이머·단계 표시를 등록 팝업에도 동일하게 적용(자료실 상세와 로직 공유)

### 버전/빌드 표시
- **build 필드 추가(version.json, js/app-core.js)**: `version`/`build`/`displayVersion` 필드를 추가하고 AppState에도 `build: "flow-check-gemini-auto"`를 반영. 설정 > 버전 정보에 버전/빌드/Worker 주소를 함께 표시하도록 변경
- 로그인 화면/설정/AppState.version/version.json 버전 표시를 모두 v0.0.10으로 통일

### 버튼 간격/모바일 UI
- **등록 팝업 버튼 간격 보정(css/layout.css)**: 새로 추가된 버튼 그룹에 기존 `.quality-review-actions`(2열 grid, gap 12px) 클래스를 재사용해 버튼이 붙어 보이지 않도록 했다. 단일 버튼 행은 grid 대신 기존 `.btn-row`(flex, 전체 폭)를 사용해 반쪽 너비로 보이는 문제를 방지했다
- **등록 팝업 내부 스크롤 추가(css/layout.css)**: 패키지 점검+Gemini 결과가 추가되어 콘텐츠가 길어진 만큼, 헤더(X 버튼)는 고정하고 본문만 내부 스크롤되도록 `.register-scroll` 구조를 추가해 버튼이 화면 밖으로 밀리는 문제를 방지했다

### 범위 제외 (이번 0.0.10에서 다루지 않음)
- 로그인 인증 로직 재작성, Blogger 자동 발행 흐름 변경, 자료실 저장소 구조 대규모 변경
- OpenAI API 자동 글 생성, Gemini의 ZIP 직접 수정, GitHub 반영

## [0.0.9 fix1] - 2026-07-07 - 적용 누락 보정

- 블로그 등록 후보 목록에 `check-list--tall` 클래스가 실제 적용되지 않았던 누락을 보정했다.
- 백업 내보내기 payload의 `version` 값을 0.0.9로 일치시켰다.
- 자료실 상태 필터의 `임시저장완료` 표시 문구를 `블로그스팟 임시저장 완료`로 명확히 했다.

## [0.0.9] - 2026-07-07 - 0.0.8 실기 잔여 문제 보정 + 버전 일치화 + Worker 연결 확인

### 목적
0.0.8은 GUI 보정 이후에도 실기에서 잔여 문제가 확인되었다. 이번 작업은 대규모 기능 추가가 아니라 실기에서 확인된 문제(버전 표시, Worker 연결, 품질검수 진행 UI, 문구, 목록 표시, 예약 기본값)를 정확히 해결하는 잔여 보정이다. 로그인 인증/Blogger 저장·임시저장·예약 핵심 로직/ZIP 파싱/SEO 계산/Gemini 프롬프트/저장소 구조는 변경하지 않았다.

### 보정
- **버전 표시 전체 일치화(index.html, js/app-core.js, version.json)**: 로그인 화면이 0.0.8 배포 후에도 `v0.0.7`로 남아있던 문제(0.0.8에서 로그인 화면 버전 갱신 누락)를 발견해 수정. 로그인 화면/AppState.version/설정 > 버전 정보/version.json을 모두 `0.0.9`로 통일
- **Worker 주소 확인 및 설정 화면 관리 기능 추가(js/auth-module.js, js/worker-api-module.js, index.html, js/app-core.js)**: 실기 확인 결과 Worker 주소(`https://wooow.qudrnr84.workers.dev`)에는 오타가 없었음을 확인. Worker 주소를 하드코딩 상수에서 `localStorage` 기반 설정값(getWorkerBaseUrl/setWorkerBaseUrl, 기본값은 기존과 동일)으로 바꾸고, 설정 화면에 "Worker 연결" 항목(주소 표시/저장/`/health` 연결 확인)을 추가. 연결 확인은 기존 `callWorker()`의 401 자동 로그아웃 경로와 분리된 별도 진단 함수(`checkWorkerHealth`)로 구현해 로그인 로직에 영향을 주지 않는다
- **품질검수 진행 UI 개선(js/gemini-review-module.js, js/app-core.js, index.html)**: 품질검수 버튼 클릭 시 "Gemini 품질검수 요청 중... 00:00" 타이머와 "단계: 요청 준비/Worker 전송/Gemini 응답 대기/결과 정리" 단계 문구를 표시. 실패 시 단순 실패 안내 대신 사유를 구분(Worker 연결 실패/인증 토큰 만료/AI_API_KEY 문제/Gemini 쿼터 초과/모델명 문제/응답 JSON 파싱 실패/네트워크 오류/알 수 없는 오류)해서 표시하고 실제 호출 주소를 함께 보여주며, [다시 품질검수]/[닫기] 버튼을 추가했다. Gemini 호출 경로·페이로드·프롬프트 로직 자체는 변경하지 않았다
- **검은 alert/toast 제거(js/app-core.js, index.html, css/components.css)**: 블로그 임시저장/예약저장의 완료·실패 안내를 `alert()` 대신 블로그 등록 팝업 내부 안내 카드(`.result-card`)로 변경. 등록 저장 완료(0.0.8에서 이미 카드화)와 톤을 통일
- **자료실/블로그 등록 목록 이력 한 줄 처리(css/components.css)**: `.archive-item__meta`에 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; word-break: keep-all;`를 적용해 이력 문구가 두 줄로 내려가지 않도록 수정
- **블로그 등록 목록 표시 개수 개선(css/components.css)**: 블로그 등록 후보 목록에만 적용되는 `.check-list--tall`(최대 높이 320px)을 추가해 최소 4~5개 항목이 보이도록 수정. 등록/전체점검/품질검수에서 쓰는 기존 `.check-list--capped`(140px)는 그대로 유지해 다른 화면에 영향 없음
- **'임시저장완료' 문구 의미 분리(js/app-core.js)**: 자료실/블로그 등록 목록에 단독으로 표시되던 `임시저장완료`를 `블로그스팟 임시저장 완료`로 표시(`displayStatus()`의 표시 매핑만 변경, 실제 저장 상태값(post.status)과 blogger-module.js 로직은 그대로 유지)
- **예약 날짜/시간 기본값(js/app-core.js)**: 블로그 등록 상세 진입 시 예약 날짜/시간 입력값을 오늘 날짜·현재 시각 이후(다음 정시)로 자동 채움

### 범위 제외 (이번 0.0.9에서 다루지 않음)
- 로그인 인증 로직 재작성, Blogger 저장/임시저장/예약 핵심 로직, ZIP 파싱/저장소 데이터 구조, SEO 점수 계산 로직, Gemini 프롬프트 대규모 변경
- OpenAI API 자동 생성, Gemini의 글 생성/수정/ZIP 직접 수정, 네이버 미리보기 추가

## [0.0.8] - 2026-07-07 - 0.0.7 GUI 실기 미통과 보정

### 목적
0.0.7은 기능 로직은 반영되었으나 실기 확인 결과 GUI 기준으로 미통과였다. 이번 작업은 기능 추가가 아니라 GUI/CSS/팝업/버튼 배치/미리보기 표시만 보정한다. 로그인/Worker 인증/Blogger 연결/Gemini 호출 경로·모델 선택/SEO 판정/저장소 핵심 구조는 변경하지 않았다.

### 보정
- **GPT 지시서 복사 버튼 작업대 버튼화(index.html)**: 하단 텍스트형 보조 버튼(`dashboard-secondary-btn`)에서 등록하기/자료실/블로그 등록하기와 동일한 공작소 작업대 버튼(`desk-btn`)으로 변경(`📋 GPT 지시서 복사`)
- **자료실 상세 버튼 배치 재정리(index.html, css)**: 미리 보기/품질 검수를 2열로, 삭제 하기를 별도 줄 전체 폭으로 분리해 버튼이 한 줄에 붙어 보이던 문제 해소
- **품질검수 결과/실패 표시를 팝업에서 자료실 상세 내부 카드로 이동(index.html, js/app-core.js)**: 별도 `popup-quality-review` 팝업이 자료실 팝업 위에 겹쳐 보이던 문제를 없애기 위해, 자료실 상세보기 내부에 진행 중/완료/실패 카드로 표시하도록 변경. 다른 글의 상세로 이동하면 이전 검수 결과는 초기화된다. 품질검수 진행 중에는 버튼 문구가 "품질검수 중"으로 바뀌고 비활성화된다(중복 요청 방지)
- **저장 완료 안내 위치 보정(index.html, js/app-core.js)**: 등록 완료 시 `alert()` 대신 등록 팝업 내부 작은 성공 카드(`✅ 저장 완료`)로 표시해 팝업 중앙 내용/버튼을 가리지 않도록 수정. 저장 버튼은 클릭 즉시 비활성화해 중복 저장을 방지
- **버튼 톤/크기/간격 통일(css/components.css, css/layout.css)**: 전역 `.btn`에 `min-height: 52px`와 가로 텍스트 고정(`white-space: nowrap; word-break: keep-all;`)을 적용하고, `.btn-row` 간격을 8px→12px로 확대. 진행 중/비활성 버튼은 반투명 회색으로 표시(`.btn:disabled`)
- **자료실 상세보기 내부 스크롤 구조 보정(css/layout.css)**: 제목과 버튼 영역은 고정하고, 정보/품질검수 카드 영역만 내부 스크롤되도록 flex 구조를 명확히 해 콘텐츠가 길어져도 버튼이 화면 밖으로 밀려나지 않게 함

### 범위 제외 (이번 0.0.8에서 다루지 않음)
- 로그인/Worker 인증/Blogger 연결/Gemini 호출 경로·모델 선택/SEO 점수 계산/ZIP 파싱·저장소 핵심 구조/자료실 데이터 구조 변경
- OpenAI API 추가, Gemini 글 자동 생성, AI의 ZIP 직접 수정, 네이버 미리보기 추가

## [0.0.7] - 2026-07-07 - 실기 화면 보정 + 미리보기 이미지/가독성 보정 + Gemini 품질검수 반영

### 목적
새 화면 구조를 만드는 작업이 아니라, 실기 확인 중 발견된 GUI 문제(글자 세로 깨짐, 미리보기 이미지 깨짐, 가독성)를 좁게 보정하고, Gemini 품질검수(검수만, 생성/ZIP 수정 없음) 기능을 기존 흐름 위에 추가한다. 로그인/Worker 인증/Blogger 연결 방식/SEO 판정 로직/저장소 핵심 구조는 이번에도 변경하지 않는다.

### 보정
- **글자 세로 깨짐 방지(css/base.css, css/components.css)**: `body`에 `word-break: keep-all; overflow-wrap: break-word;`를 적용해 좁은 영역에서 한글이 한 글자씩 줄바꿈되어 세로로 보이던 문제를 해소. 전체점검/체크리스트 항목(`.check-item`)의 라벨 span에 `flex: 1; min-width: 0; white-space: nowrap; text-overflow: ellipsis;`를 적용해 라벨이 좁아질 때 줄바꿈 대신 말줄임표로 처리되도록 보정
- **미리보기 이미지 깨짐 보정(js/preview-module.js)**: `content.html` 안의 `<img src="body-01.png">` 같은 ZIP 내부 상대경로가 미리보기에서 그대로 물음표/깨진 이미지로 표시되던 문제를 `mapImageSources()` 함수로 해결. `imageList`의 `fileName`과 매칭되는 경우 실제 `dataUrl`로 치환하고, 매칭되지 않으면 깨진 아이콘 대신 대체 문구만 남긴다
- **미리보기 가독성 보정(css/layout.css)**: `#preview-html-content`(본문 주입 영역) 대상으로 문단 줄간격/문단간격/제목간격/이미지 여백/표 가로 스크롤 처리를 추가
- **미리보기 텍스트/URL 넘침 방지**: `.detail-content`(원문/텍스트 보기)에 `overflow-wrap: break-word; word-break: break-all;` 추가
- **미리보기 광고칸/관련 글 안내 문구 추가(index.html)**: 광고칸 2곳과 관련 글 박스에 "표시용 근사치" 안내 문구를 추가해 실제 블로그스팟 화면과 다를 수 있음을 명시
- **재검증 동작 안내 문구 추가(index.html)**: 등록하기 팝업에 "재검증은 현재 선택된 ZIP을 다시 검사합니다. 파일 선택창을 다시 열지 않습니다." 안내를 추가(동작 자체는 기존과 동일)
- **문구 한글화**: "Blogger 연결 상태" → "블로그스팟 연결 상태" (블로그 등록 상세화면, 설정 화면 2곳)

### 추가
- **Gemini 품질검수(js/gemini-review-module.js 신규, js/worker-api-module.js 부분 수정)**: 자료실 상세보기에 [품질 검수] 버튼과 결과 팝업(진행 중/완료/실패)을 추가. Gemini는 글을 생성하지 않고 ZIP도 수정하지 않으며, 검수 결과(점수/요약/보완 항목)와 GPT에게 다시 전달할 수정요청 문구만 제공한다. `worker-api-module.js`에는 기존 `callWorker()` 공통 호출 함수를 재사용하는 `requestGeminiReview()` 한 함수만 추가했다(신규 Worker 미작성). 본문 길이/SEO 통과 여부로 빠른 검수(gemini-2.5-flash)/정밀 검수(gemini-2.5-pro)를 자동 선택하며, 화면에는 "빠른 검수/정밀 검수/자동 선택"만 노출하고 복잡한 모델명은 노출하지 않는다. Gemini에 보내는 데이터는 제목/메타설명/본문 텍스트/FAQ/썸네일 문구/이미지 alt/SEO 점수·부족 항목으로 최소화했으며, 원본 이미지(base64)·Blogger 토큰·Worker 토큰·API Key는 전송하지 않는다. 검수 실패(API 호출 실패/응답 JSON 파싱 실패) 시 "품질검수 요청에 실패했습니다. 잠시 후 다시 시도해주세요." 안내만 표시하고, 저장된 글/자료실 데이터는 전혀 변경하지 않는다(읽기 전용 조회)

### 범위 제외 (이번 0.0.7에서 다루지 않음)
- 로그인 인증 구조, Worker API 인증 구조, Blogger Worker 연결 방식, SEO 점수 계산 로직, 저장소 핵심 구조 변경
- Gemini를 통한 글 자동 생성, ZIP 자동 수정, 자동 재업로드, 블로그 자동 발행, 네이버 미리보기 추가
- 기존 Worker(신규 Worker 구현) 추가 — Gemini 호출은 기존 `callWorker()` 경로만 재사용

## [0.0.6 repair2] - 2026-07-07 - 중앙 팝업 통일 + 등록 검증 흐름 정리 + 설정/미리보기 보정

### 목적
repair1 결과물에서 실기 확인 중 발견된 GUI/흐름 문제만 좁게 수정한다. 로그인, Worker 인증, Blogger Worker 연결, ZIP 저장 구조, SEO 판정 로직은 변경하지 않고 화면 흐름과 팝업 사용성만 정리한다.

### 변경
- **팝업 방식 중앙 고정으로 통일**: 하단 시트 방식(`align-items: flex-end`)을 중앙 고정(`align-items: center`)으로 전환. 모든 팝업의 모서리를 전체 둥근 모서리로 통일(`border-radius: 16px`)
- **X 버튼/닫기 버튼 규칙 통일**: 모든 중앙 팝업은 우측 상단 X 버튼으로만 닫는다. 등록하기/자료실/오류백과 등에 있던 하단 `[닫기]` 버튼을 제거했다
- **등록하기 팝업 자동 검증**: ZIP 선택 즉시 자동으로 인식+검증을 실행하도록 변경(별도 `[검증하기]` 버튼 제거). 파일별 인식 결과 목록 대신 가로 요약카드(`📦 전체 N개 ✅ 정상 N개 ⚠️ 실패 N개`)만 표시하고, 실패가 있을 때만 짧은 실패 항목 문구를 추가로 보여준다. 저장 조건(필수 파일 정상 + 필수 이미지 정상 + SEO 판정 "통과")은 repair1과 동일하게 유지
- **SEO 미통과 안내 문구 보강**: "현재 N점 / 수정 필요, 기준: 80점 이상 통과, 누락 항목: …" 형식으로 미통과 사유를 표시
- **등록하기 팝업 X 클릭 시 저장 전 확인**: 검증 통과 후 저장 대기 상태에서 X를 누르면 "저장하지 않고 닫을까요?" 확인 팝업을 띄운다([저장하지 않고 닫기] / [계속 작업])
- **자료실 팝업 스크롤 범위 분리**: 목록 내부에만 스크롤을 허용하고 상세보기 화면은 스크롤 없이 고정. 삭제 확인 문구를 "이 글을 삭제할까요? 삭제 후 복구할 수 없습니다."로 정리
- **미리보기 Blogspot 기준 렌더링 보강(preview-module.js)**: 목차(H2/H3 자동 추출), 요약 박스(메타설명), FAQ 박스(metadata.json의 faqList), 광고 자리 박스(본문 앞/뒤), 관련 글 박스(다른 저장 글 최대 3건)를 추가하고 [모바일 보기]/[PC 보기] 폭 전환 버튼을 추가했다
- **설정 팝업 재구성**: 스크롤 없는 메뉴 버튼 목록(블로그 지시서 관리/오류백과/전체점검/백업 복구/제한사항/버전 정보) + 항목별 중앙 하위 팝업으로 분리. 오류백과(오류 이력 패널)도 다른 팝업과 동일하게 우측 상단 X로 통일(하단 닫기 버튼 제거)
- **블로그 등록하기 팝업**: 스크롤 금지 대상으로 전환(내용은 기존과 동일하게 유지)

### 추가
- **블로그 지시서 관리(js/guideline-module.js 신규)**: GPT 블로그 자료 생성용 요청 문구를 localStorage에 저장/관리. 설정 > 블로그 지시서 관리에서 파일 업로드(.md/.txt), 현재 지시서 보기, 기본 지시서로 복구를 제공하고, 메인 대시보드의 작은 보조 버튼 [GPT 지시서 복사]로 클립보드 복사를 제공한다. OpenAI API를 자동 호출하지 않는 단순 텍스트 저장/복사 기능이다

### 정리
- CSS에서 더 이상 어떤 화면에서도 쓰이지 않는 구 자료실 오버레이 잔재 셀렉터(`detail-overlay`, `archive-detail--open`, `detail-panel`, `detail-panel__scroll`)와 이미지 관리 화면(현재 미연결) 전용 잔재 클래스(`image-item__info`, `image-item__alt-input`, `image-item__delete-btn`, `seo-issue-item`) 제거

### 범위 제외 (이번 repair2에서 다루지 않음)
- 로그인 인증 구조, Worker API 인증 구조, Blogger Worker 연결 방식, SEO 점수 계산 로직, 저장소 핵심 구조, ZIP 해제 핵심 로직 변경
- Blogger 즉시 발행(실제 공개) 기능 추가
- OpenAI API 자동 실행
- 네이버 미리보기 추가

## [0.0.6 repair1] - 2026-07-07 - 암호 로그인 + 단일 대시보드 GUI 정리 + Blogger Worker 연동

### 목적
1) 앱 진입 시 암호 로그인 화면을 거치도록 한다. 2) 하단 네비게이션과 화면별 개별 화면을 없애고 단일 고정 대시보드(최근 글 전광판 + 공작소 작업대) + 팝업(등록하기/자료실/블로그 등록하기/설정) 구조로 정리한다. 3) 기존 Blogger 연동(브라우저에서 Blog ID/Access Token을 직접 입력받아 Google Blogger API를 직접 호출하던 방식)을 제거하고, WP 0.0.10의 Worker 기반 로그인/Blogger 임시저장 연동 핵심 로직만 GPT 공작소 구조에 맞게 이식한다. WP의 UI, 글쓰기, 검색, AI 생성, 프리셋, 테스트 페이지 기능은 가져오지 않는다.

### 추가
- **암호 로그인 화면**: js/auth-module.js 신규 생성. WP 0.0.10 auth-session.js의 로그인 핵심 로직(암호 입력 → Worker `/auth/login` 호출 → 세션 토큰 저장 → 실패/만료 처리)만 이식. 세션 토큰은 sessionStorage에만 저장(`gongjakso_session_token`), 새로고침 시 세션 유지, 로그인 성공 전에는 대시보드/자료/설정/블로그 기능을 노출하지 않음
- **Worker 공통 호출 모듈**: js/worker-api-module.js 신규 생성. WP 0.0.10 api-adapter.js 중 Worker 공통 호출 함수와 `/blogger/status`, `/blogger/draft` 호출 부분만 이식. 세션 토큰을 Authorization 헤더로 첨부하고, 401 응답 시 자동으로 로그인 화면으로 전환
- **단일 대시보드 GUI**: index.html/js/app-core.js를 로그인 화면 + 고정 대시보드(헤더, 최근 글 전광판 3~5초 자동 순환, 공작소 작업대 버튼 3개) + 팝업(등록하기/자료실/블로그 등록하기/설정) 구조로 재구성. 기존 하단 네비게이션과 별도 설정 화면은 제거
- **등록하기 팝업 검증 게이트**: js/zip-upload-module.js에 runValidation() 신규 추가. ZIP 인식 후 [검증하기]를 눌러야 하며, 필수 파일(metadata.json/content.html/content.md/content.txt) 및 이미지(thumbnail, body-01~03) 8종 구조 검증과 SEO 검수를 함께 실행. 검증 실패(파일/이미지 누락) 시 저장 불가, 검증 통과 후에만 [저장] 가능. 저장 시 기본 상태값은 "등록완료"
- **자료실 팝업**: 목록에 제목/상태/수정일/SEO 결과/이미지 수량 표시. 글 선택 시 [미리 보기]/[삭제 하기]만 제공하며, 삭제 시 "정말 삭제하시겠습니까? 삭제한 글은 되돌릴 수 없습니다." 확인 팝업 필수
- **블로그 등록하기 팝업**: 제목/본문/SEO 통과 조건을 만족하는 글만 후보로 노출. [블로그 임시 저장](Worker `/blogger/draft` 호출) / [예약 저장](기존 schedule-module.js 로컬 예약) 제공. 즉시 발행/실제 공개 기능은 Worker에 실제 경로가 없으므로 추가하지 않음
- **설정 팝업**: Blogger 연결 상태, 백업/복구, 오류 확인, 전체 점검, 제한사항 안내, 버전 정보, 데이터 초기화(확인 팝업 필수), 로그아웃 제공

### 변경
- **js/blogger-module.js 전면 교체**: 브라우저에서 Blog ID/Access Token을 직접 입력받아 Google Blogger API를 직접 호출하던 기존 방식을 제거. WorkerApiModule을 통한 `/blogger/status`(연결 상태 확인), `/blogger/draft`(임시저장)만 사용. Blog ID/Client Secret/Refresh Token은 Worker가 서버 측에서 관리하며 브라우저 코드에는 두지 않음. 임시저장 성공 시 상태값을 "임시저장완료"로 설정
- **js/schedule-module.js**: 예약 가능 상태값(ALLOWED_SCHEDULE_STATUS)에 "등록완료"/"임시저장완료" 추가(기존 "발행대기"/"검수중"은 레거시 데이터 호환을 위해 유지). 예약 저장 성공 시 상태값을 "예약저장됨"으로 변경(기존 "예약됨"에서 명칭 정리)
- **js/statistics-module.js**: STATUS_LIST 및 전체 점검 집계 로직에 신규 상태값(등록완료/임시저장완료/예약저장됨) 반영

### 범위 제외 (이번 repair1에서 다루지 않음)
- WP의 UI, 글쓰기, 검색, AI 생성, 이미지 생성, 프리셋, 테스트 페이지 기능 이식
- Blogger 실제 발행(즉시 공개) 기능 신규 구현 (Worker에 실제 경로가 없어 추가하지 않음)
- 이미지 관리 화면(js/image-module.js)의 팝업 내 재노출 — 파일은 그대로 두되 이번 대시보드 구조에서는 연결하지 않음 (자세한 내용은 남은 주의사항 참고)
- 오류 백과사전의 오류번호/버전/해결방법/재발방지 등 구조화된 신규 포맷 전환 — 기존 오류 이력 화면 구조를 그대로 유지

## [0.0.6] - 2026-07-06 - ZIP 자료 패키지 자동 업로드

### 목적
GPT 공작소 자료 패키지 ZIP 파일 1개로 글/이미지 파일을 자동 인식해 자료실에 저장. 기존 개별 파일(metadata.json/content.html/content.md/content.txt) 수동 업로드는 삭제하지 않고 보조 기능으로 유지.

### 추가
- **ZIP 자동 업로드**: js/zip-upload-module.js 신규 생성. ZIP 안에서 metadata.json/content.html/content.md/content.txt를 파일명 기준(하위 폴더 포함)으로 자동 인식해 자료실에 저장. metadata.json이 없어도 HTML/Markdown/TXT 중 1개 이상만 있으면 저장 가능
- **ZIP 내부 이미지 자동 인식/저장**: thumbnail.png/jpg/jpeg/webp(1장, 확장자 우선순위 png→jpg→jpeg→webp), body-01~03.png/jpg/jpeg/webp(최대 3장)을 기존 imageList 구조에 맞춰 자동 저장. ALT 기본값 자동 생성("{제목} 썸네일 이미지" / "{제목} 본문 이미지 N"), 저장 후 이미지 관리 화면에서 ALT 수정 가능
- **ZIP 업로드 UI**: 업로드 화면 상단에 [압축파일 자동 업로드] 영역 추가(ZIP 파일 선택, 선택 파일명 표시, ZIP 인식 결과 7항목, ZIP 자료실에 저장하기 버튼)
- **기존 수동 업로드는 보조 기능으로 유지**: 기존 4개 파일 개별 업로드 영역은 삭제하지 않고 [수동 업로드 열기/닫기] 버튼으로 접고 펼 수 있는 보조 영역으로 전환(기본 접힘)
- **ZIP 읽기 전용 최소 구현**: js/vendor/zip-reader.js 신규 생성. 표준 ZIP 중앙 디렉터리 구조와 DEFLATE(RFC 1951) 압축 해제를 직접 구현(저장/Deflate만 지원). 외부 CDN을 사용하지 않음

### 보정
- **SEO 통과 시 상태 자동 전환**: js/seo-module.js의 saveSeoResult()에서 SEO 결과가 "통과"이고 현재 상태가 "작성중"이면 "검수중"으로 자동 전환(그 외 상태는 임의 변경하지 않음). Blogger 발행대기 전환이 막히던 문제 해소
- **미리보기 선택 글 없음 안내**: 선택된 글 없이 미리보기 화면에 진입하면 "선택된 글이 없습니다. 자료실에서 글을 선택한 뒤 미리보기를 열어주세요." 안내를 표시(오류 이력에는 기록하지 않음)
- **백업 버전 표기 보정**: js/backup-module.js의 전체 백업 payload 버전을 "0.0.1"에서 "0.0.6"으로 보정
- **전체 점검 오류 로그 반복 누적 방지**: js/statistics-module.js의 전체 점검에서 레거시 상태값/ dataUrl 이미지 존재/Blogger 이력/예약 불일치 같은 설계상 상태 확인 항목은 점검 결과 화면에는 계속 표시하되, 반복 실행 시 오류 이력에 중복 기록되지 않도록 수정(실제 저장/파싱/API 실패만 오류 이력에 기록)

### 범위 제외 (0.0.6에서 다루지 않음)
- Blogger OAuth 전체 로그인 플로우, Worker 신규 구현, 네이버 API/검색 API/글쓰기 프리셋 추가
- ZIP 이미지의 Blogger 서버 자동 업로드/변환(다음 Worker/Blogger 고도화 대상)
- 기존 글 덮어쓰기(ZIP 업로드는 항상 새 글로 저장), 전체 UI 재설계, 기존 화면/버튼명 임의 변경

## [0.0.5 final repair1] - 2026-07-06 - Final Repair 1

### 목적
새 기능 추가가 아니라 "업로드 화면 파일 선택 입력 오류 수정". 실기 확인 중 발견된, metadata.json 외 content.html/content.md/content.txt 파일을 선택할 수 없던 문제에 대한 좁은 범위의 repair.

### 보정
- **업로드 파일 선택 input accept 속성 수정**: index.html의 metadata/HTML/Markdown/TXT 4개 파일 선택 input의 accept 값을 각각 `.json,application/json` / `.html,.htm,text/html` / `.md,.markdown,text/markdown,text/plain` / `.txt,text/plain`으로 수정하여 4개 파일을 각각 개별적으로 선택할 수 있도록 함
- **선택된 파일명 화면 표시 추가**: 업로드 화면의 4개 파일 선택 영역 각각에 선택된 파일명(또는 "선택된 파일 없음")을 표시하는 영역을 추가(js/app-core.js, css/components.css)

### 범위 제외 (Final Repair 1에서 다루지 않음)
- ZIP 업로드/JSZip/vendor 재도입, 붙여넣기 UI 재도입, AI 글/이미지 생성
- Blogger 업로드, 예약발행, 통계 기능 수정
- 전체 UI 재설계, 화면명/버튼명 변경(파일 선택 관련 제외)
- 기존 자료실/미리보기/이미지/SEO 기능 손상 없음 확인

## [0.0.5] - 2026-07-06 - Phase E

### 목적
새 기능 확장이 아니라 "통계 + 전체 연결 검수 + 최종 마감". 1차 완성본 정리.

### 추가
- **통계 화면**: js/statistics-module.js 신규 생성. 저장된 전체 글 수, 상태별 글 수, SEO 통과 글 수, 발행대기/예약됨/발행완료 글 수, Blogger 업로드 실패·주의 글 수, 이미지 등록 글 수, ALT 누락 글 수, 문제 있는 글 목록, 최근 수정 글 목록을 읽기 전용으로 집계·표시
- **전체 점검 화면**: 저장소 상태, 자료실 글 수, SEO 통과 글 수, 이미지 ALT 누락 여부, Blogger 설정/업로드 이력, 예약 글 존재·상태 일치 여부, 오류 로그 존재 여부, 상태값 영어 잔재 여부, dataUrl 이미지 존재 여부, 현재 제한사항 안내를 통과/확인 필요/오류로 판정. 실제 외부 API는 호출하지 않음
- 설정 화면에 "통계 보기"/"전체 점검" 진입 버튼 추가(바텀 네비게이션 변경 없음)
- docs/KNOWN_LIMITATIONS.md 신규 생성: Blogger/예약발행/업로드/통계 관련 설계상 의도된 제한사항 10개 항목을 버그와 구분해 정리

### 정리
- 미리보기 화면 탭 버튼명 정리: "HTML 보기"→"HTML 본문 보기", "TXT 보기"→"텍스트 보기" (SEO 검수, Blogger 업로드 명칭은 지시에 따라 유지)
- Phase A~D 전 기능(저장/자료실/백업/오류 이력, 개별 파일 업로드, 미리보기, 이미지 관리·ALT, SEO 검수, Blogger 임시저장/발행, 예약발행, 상태값 마이그레이션, 확인 팝업, 고정 화면 구조) 손상 없음 확인

### 범위 제외 (Phase E에서 다루지 않음)
- ZIP/JSZip/vendor, AI 글/이미지 생성, Blogger 이미지 업로드, Google Drive 업로드, OAuth 전체 로그인, Worker 자동발행, 서버 연동, 외부 CDN, 그 외 대형 신규 기능

## [0.0.4 repair1] - 2026-07-06 - Phase D Repair 1

### 목적
새 기능 추가가 아니라 "발행 전 무결점 정리". Phase A~D 잔여 문제 보정.

### 보정
- **고정 화면 UI**: html/body/app-container를 100vh(iOS/Android는 100dvh) 기준 고정형으로 변경. app-header/app-nav를 flex 항목으로 전환(app-nav의 `position: fixed` 제거)하여 항상 화면 안에 유지. app-main은 더 이상 스크롤 컨테이너가 아니며, 자료실 목록/미리보기 본문/이미지 목록/SEO 문제 목록/예약 목록/오류 목록/상세 패널 내부만 개별적으로 스크롤되도록 `.section--scroll` 구조 도입
- **공통 확인 팝업**: 전체 데이터 가져오기, Blogger 임시저장/실제 발행, 발행대기 전환, 예약 저장 실행 직전에 `window.confirm()` 확인 단계 추가(삭제/예약취소는 기존 확인 팝업 유지)
- **Blogger 업로드 모드 분리**: 기존 단일 "업로드하기" 버튼을 "임시저장으로 업로드"(기본, `isDraft=true`)와 "발행하기"(확인 팝업 필수, 실제 공개)로 분리. 실패 메시지도 모드별로 구분(임시저장 업로드 실패/실제 발행 실패)
- **예약발행 조건 강화**: 예약 저장 전 제목/HTML 본문/SEO 통과/상태값(발행대기 또는 검수중)을 확인하고, 미충족 시 저장을 막고 오류 이력에 기록. 예약 취소 시 복원되는 이전 상태값이 레거시 영어값이면 한국어로 보정
- **상태값 마이그레이션**: ArchiveModule.loadPosts()에서 draft/published/scheduled/error 등 레거시 영어 상태값을 한국어로 자동 보정하여 저장(개별 글 단위 오류 처리, 실패 시 오류 이력 기록). 표시/필터 로직에도 방어적 정규화 적용
- **dataUrl 이미지 경고 문구 명확화**: Blogger 업로드 전 경고 문구를 더 구체적으로 수정(업로드는 계속 진행됨을 명시)
- **업로드 성공 + 로컬 저장 실패 대응**: 전용 오류 메시지("Blogger 업로드 성공 후 로컬 저장 실패")로 구분 기록, 사용자에게 "Blogger 업로드는 성공했지만 로컬 저장에 실패" 문구를 명확히 표시, bloggerInfo.lastError에 불일치 정보 기록

### 범위 제외 (Repair 1에서 다루지 않음)
- 통계, 서버/Cloudflare Worker 연동, ZIP/JSZip 재도입
- 로컬 저장 실패와 Blogger 실제 상태 간 자동 동기화/재시도 기능(대형 동기화 기능은 만들지 않음)
- 커스텀 인앱 모달 컴포넌트(기존과 동일하게 `window.confirm()` 사용)

## [0.0.4] - 2026-07-06 - Phase D

### 추가
- 화면 2개 추가: Blogger 업로드, 예약발행 (기존 7개 화면과 합쳐 총 9개 화면). 자료실 상세보기에서 이동
- blogger-module.js: Blog ID/Access Token 설정(세션 메모리 보관), 발행 전 검증(제목/HTML 본문/SEO 통과/상태값/설정값), 제목·HTML·태그의 Blogger 업로드용 payload 변환, `발행 준비`(검수중 → 발행대기), `업로드하기`(Blogger API v3 posts.insert 실제 호출), 업로드 성공 시 bloggerPostId/publishedUrl/publishStatus/publishedAt 저장, 실패 시 오류 이력 저장
- schedule-module.js: 예약일시 저장(상태값 → 예약됨), 예약 취소(이전 상태로 복원), 전체 예약 목록 조회, 예약 시간 경과 여부(`지남`) 표시
- 자료실 상세보기에 "발행 상태" 표시, `Blogger 업로드`/`예약발행` 이동 버튼 추가
- imageList에 dataUrl 이미지가 있으면 Blogger 업로드 화면에 변환 필요 경고 표시(HTML 본문에는 자동 삽입하지 않음)

### 보안
- Blog ID/Access Token은 세션(모듈 변수) 메모리에만 보관하며 localStorage/IndexedDB에 저장하지 않음
- Client Secret, Refresh Token은 다루지 않음(OAuth 전체 로그인 플로우는 이번 Phase 범위 밖)

### 범위 제외 (Phase D에서 미구현)
- 통계, OAuth 전체 로그인 플로우, 서버/Cloudflare Worker 연동
- Google Drive 이미지 업로드, Blogger 이미지 업로드 API
- 브라우저가 꺼져 있어도 동작하는 서버형 자동 예약발행(이번 Phase는 "예약 정보 저장/관리" 수준까지)
- AI 글/이미지 생성, ZIP 업로드/파싱 재도입, 외부 CDN

## [0.0.3] - 2026-07-06 - Phase C

### 추가
- 화면 2개 추가: 이미지 관리, SEO 검수 (기존 5개 화면과 합쳐 총 7개 화면)
- image-module.js: 썸네일/본문 이미지 선택, dataUrl 방식 저장, ALT 태그 입력, 이미지 삭제, imageList 저장
- seo-module.js: 제목/메타설명 길이, H2/H3 구조, 이미지 ALT 누락, 이미지 개수, FAQ 여부, 태그 개수, 내부/외부링크 개수 점검, seoResult 저장
- 자료실에서 글을 선택해 이미지 관리/SEO 검수로 이동하는 기능 연결
- preview-module.js에 썸네일(본문 상단)과 본문 이미지 목록(별도 영역) 표시 구조 연결 (HTML 본문에 자동 삽입하지 않음)

### 보정
- 상태값을 영어(draft/completed)에서 한국어(작성중/검수중/발행대기/예약됨/발행완료/보류/오류)로 변경. 새로 저장되는 글의 기본 상태값은 "작성중"이며, 자료실 상태 필터도 한국어 값으로 갱신됨

### 범위 제외 (Phase C에서 미구현)
- AI 이미지 생성, 외부 이미지 생성 API 연동
- Blogger 업로드, 예약발행, 통계
- 로그인 / 서버 연동 / 외부 API 연동
- ZIP 업로드/파싱 재도입, JSZip/vendor 폴더, 외부 CDN
- 이미지 자동 배치(HTML 본문에 이미지 자동 삽입)

## [0.0.2] - 2026-07-06 - Phase B (재제작)

### 안내
이전에 진행하던 "GPT 작업실 붙여넣기" 방향의 Phase B 작업은 중단되었습니다.
아래 내용은 새 방향(GPT 결과물 파일 업로드)으로 재작성된 결과입니다.

### 추가
- 화면 2개 추가: GPT 결과물 업로드, 미리보기 (기존 홈/자료실/설정과 합쳐 총 5개 화면)
- gpt-upload-module.js: metadata.json / content.html / content.md / content.txt 개별 파일 인식 및 자료실 저장
- preview-module.js: HTML 미리보기 렌더링 및 보안 필터링(script/iframe 등 금지 태그, 인라인 이벤트 제거), Markdown/TXT 원문 보기
- 자료실에서 글을 선택해 미리보기로 여는 기능 연결
- 글 데이터 구조에 metaDescription, tags, faqList, sourcePackageName, importedAt 필드 추가 (기존 필드명 유지)
- metadata.json이 없을 경우 파일명 기반 임시 제목, 빈 keyword/tags/faqList/imageList, 상태값 "draft"로 저장

### 범위 제외 (Phase B에서 미구현)
- ZIP 파일 업로드/파싱 (외부 라이브러리 확보 불가로 이번 Phase에서 보류, 개별 파일 업로드로 대체)
- images 폴더 인식 (ZIP 전용 기능이라 이번 Phase에서 제외)
- 이미지 관리, SEO 검수, Blogger 업로드, 예약발행, 통계
- 로그인 / 서버 연동 / 외부 API 연동
- 글 자동 생성, 이미지 자동 생성

## [0.0.1] - 2026-07-06 - Phase A

### 추가
- 기본 프로젝트 구조 생성 (index.html, css/, js/, docs/)
- 화면 3개 구성: 홈, 자료실, 설정
- app-core.js: 화면 전환 및 공통 렌더링 로직
- storage-module.js: IndexedDB 우선 저장, localStorage fallback 지원
- archive-module.js: 저장글 목록/검색/필터/삭제/개별 내보내기
- backup-module.js: 전체 데이터 JSON 내보내기/가져오기, 개별 글 JSON 내보내기
- error-log-module.js: 오류 발생 기록 및 조회
- version.json: 버전 및 모듈 메타 정보
- docs/ERROR_DICTIONARY.md, docs/MODULE_HISTORY.md 문서 생성

### 범위 제외 (Phase A에서 미구현)
- GPT 작업실
- 이미지 관리
- SEO 검수
- Blogger 업로드
- 예약발행
- 통계 기능
- HTML 미리보기
- 로그인 / 서버 연동 / 외부 API 연동
- ZIP 백업 실제 구현 (구조만 준비: exportFormat 필드)

### 0.0.10 fix1 - 검수 누락 보정
- 로그인 화면 displayVersion을 `v0.0.10-fix1`로 표시해 실제 반영 여부를 바로 확인할 수 있게 했다.
- 백업 내보내기 payload version을 0.0.9에서 0.0.10으로 수정했다.
- 블로그 등록 후보/임시저장/예약 가능 판단에서 남아 있던 `seoResult.result === "통과"` 게이트를 제거하고 Gemini 품질검수 통과 기준으로 변경했다.
- 블로그 등록 가능 글 없음 문구와 전체 점검 항목의 `SEO 통과` 표현을 `품질검수 통과`로 변경했다.

## 0.0.9 fix2

- 자료실 상세의 품질검수 실패 버튼 영역과 기본 상세 버튼 영역이 붙어 보이던 모바일 간격 문제를 보정했습니다.
- Gemini 품질검수 요청 payload에 Worker가 읽는 `text`, `content`, `metaDescription`, `faq`, `post`, `metadata` alias를 추가해 본문이 비어 전달되는 문제를 보정했습니다.
- Worker 응답이 `result`/`data` 객체로 내려오는 경우도 품질검수 결과로 정상 해석하도록 파서를 보강했습니다.
