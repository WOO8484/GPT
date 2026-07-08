# Claude 작업지시서 — GPT공작소 v1.6.2 카드창 제거 + 섹션형 레이아웃

## 0. Claude 작업 코멘트

```text
이번 작업은 GPT공작소 메인 페이지 레이아웃 정리 작업입니다.

기존 기능은 그대로 유지합니다.
메인 페이지의 카드창 구조를 제거하고 섹션형 배치로 다시 작성합니다.

핵심:
- 카드창 제거
- 메인 레이아웃 CSS 정리
- 더러워진 panel/min-height/max-height 덧댐 코드 삭제
- 기능 동일 유지
- JS 수정 금지

모델: Claude Sonnet 5
사고 옵션: 켬
사고 수준: 중간
```

---

## 1. 기준 파일

```text
02_기준ZIP/GPT공작소_v1.6.1_기준_루트업로드용.zip
```

---

## 2. 결과물 파일명

```text
GPT공작소 v1.6.2 카드창제거 섹션형레이아웃 루트업로드용.zip
```

---

## 3. 수정 허용 파일

아래 3개 파일만 수정합니다.

```text
index.html
css/layout.css
css/components.css
```

---

## 4. 수정 금지 파일

아래는 전부 수정 금지입니다.

```text
js 전체
data 전체
css/base.css
README.txt
version.json 제외한 기타 파일
```

단, 버전 표시가 필요하면 version.json만 `1.6.2`로 변경 가능합니다.

---

## 5. 수정 허용 위치

### 5-1. index.html

수정 허용:

```text
main.workbench 내부의 메인 화면 구조만
bottom-actions 위치/클래스만
panel 관련 class 정리만
```

수정 금지:

```text
button id 변경 금지
input id 변경 금지
ul id 변경 금지
div id 변경 금지
팝업 영역 수정 금지
script 순서 수정 금지
JS가 참조하는 id/data 속성 변경 금지
```

현재 유지해야 할 주요 id:

```text
zip-file-input
upload-filename
board-open-btn
library-list
library-empty
save-empty
save-target
save-target-title
save-target-status
post-status-line
save-start-btn
retry-save-btn
blogger-preview-open-btn
package-diagnosis-open-btn
save-progress-list
prompt-copy-open-btn
```

---

### 5-2. css/layout.css

수정 허용:

```text
.app-container
.app-header
.workbench
기존 .panel 관련 메인 화면 레이아웃 규칙
.panel--upload
.panel--library
.panel--save
.bottom-actions
.save-target
.save-target-fixed
.save-tool-row
모바일/PC 메인 화면 배치 media query
```

수정 금지:

```text
로그인 화면
공통 팝업 레이아웃
최종 미리보기 팝업
업로드 확인 팝업
설정 팝업 기본 구조
```

---

### 5-3. css/components.css

수정 허용:

```text
.file-input-label
.upload-filename
.library-list
.library-item
.library-item__title
.library-item__meta
.archive-item--empty
#library-empty
#save-empty
.save-target-title
.save-target-status
.save-progress-list
.btn--compact
.settings-error-actions
```

수정 금지:

```text
본문 미리보기 렌더링 CSS
진단 목록 CSS
오류 백과사전 CSS
팝업 내부 공통 CSS
```

---

## 6. 이번 작업에서 반드시 할 일

### 6-1. 카드창 제거

메인 화면에서 카드 박스처럼 보이는 구조를 제거합니다.

삭제/정리 대상:

```text
.panel의 border
.panel의 border-radius
.panel의 background card box 느낌
.panel__header의 카드 헤더 배경
.panel__header의 border-bottom
.panel--upload 높이 덧댐
.panel--library 높이 덧댐
.panel--save 높이 덧댐
min-height/max-height 임시 보정
```

단, class 이름은 JS 영향이 없도록 필요하면 유지해도 됩니다.  
시각적으로 카드창처럼 보이지 않게 만드는 것이 목표입니다.

---

### 6-2. 섹션형 배치로 변경

메인 화면은 아래 구조로 보이게 합니다.

```text
상단 헤더
업로드 영역
게시판 영역
블로그 저장 영역
블로그 지시서 복사 버튼
```

스타일 기준:

```text
큰 카드 박스 없음
얇은 구분선만 사용 가능
섹션 간 여백 통일
전체 화면 높이 계산 단순화
필요한 곳만 내부 스크롤
```

---

### 6-3. 업로드 영역

필수:

```text
“블로그 자료 ZIP 선택” 유지
업로드 버튼 중앙 정렬
불필요한 카드 테두리 제거
파일명 없을 때 여백 없음
```

---

### 6-4. 게시판 영역

필수:

```text
게시판 제목과 전체 게시판 버튼 유지
글 없음 상태 깔끔하게 표시
글 1개는 잘리지 않게 표시
글 여러 개는 목록 영역만 내부 스크롤
카드창 높이 보정 코드 삭제
```

---

### 6-5. 블로그 저장 영역

필수:

```text
글 미선택 상태는 작게 표시
“게시판에서 글을 선택하세요.”가 큰 빈칸 중앙에 뜨면 실패
글 선택 상태에서 저장 버튼/최종 미리보기/패키지 진단 버튼 표시
진행 로그가 길면 save-progress-list만 내부 스크롤
```

---

### 6-6. 하단 블로그 지시서 복사 버튼

필수:

```text
하단 독립 버튼 유지
굵은 가로줄 없음
카드창처럼 보이지 않게 함
다른 영역과 간격 자연스럽게 정리
```

---

## 7. 코드 정리 필수

이번 작업은 단순 추가가 아닙니다.

반드시 아래를 정리합니다.

```text
중복된 panel 높이 코드 삭제
min-height/max-height 덧댐 코드 삭제
카드 테두리/헤더 배경/둥근 박스 스타일 삭제 또는 무력화
같은 selector 중복 override 정리
!important 사용 금지
기존 CSS 아래에 새 CSS 덧붙이고 끝내기 금지
```

---

## 8. 유지해야 할 기능

아래 기능은 그대로 동작해야 합니다.

```text
로그인
ZIP 업로드
업로드 확인
게시판 저장
게시판 글 선택
전체 게시판
R2 이미지 업로드
Blogger 임시저장
최종 미리보기
패키지 진단
블로그 지시서 복사
오류 목록
설정
```

---

## 9. 실패 기준

아래 중 하나라도 해당하면 실패입니다.

```text
JS 파일 수정
버튼 id 변경
기능 삭제
새 기능 추가
카드창이 그대로 남음
기존 CSS 위에 덧댐만 함
블로그 저장 미선택 상태가 여전히 큼
게시판 글이 잘림
전체 화면이 아래로 길게 스크롤됨
```

---

## 10. 완료 보고 형식

완료 보고는 아래 형식으로만 작성하세요.

```text
1. 수정 파일
2. 수정한 index.html 영역
3. 수정한 layout.css 영역
4. 수정한 components.css 영역
5. 삭제/정리한 카드창 CSS
6. 삭제/정리한 높이 보정 CSS
7. 유지한 id 목록
8. JS 무수정 여부
9. 기능 유지 여부
10. 결과 ZIP 파일명
```
