GPT 공작소 v1.4
====================

v1.4 신규 모듈 안전 연결 기준
- 신규 모듈은 선택 기능입니다.
- 신규 모듈 오류가 기본 업로드/게시판 저장/R2/Blogger 임시저장을 막으면 실패입니다.
- 신규 모듈은 독립 try/catch(safeInit)로 초기화됩니다.
- DOM 요소가 없으면 해당 모듈만 종료됩니다.
- 문제 발생 시 신규 모듈 제거 또는 v1.3 안정본 롤백이 가능합니다.

이번 v1.4는 v1.3 안정본을 기준으로 한 "대통합 모듈형 고도화"입니다. 아래
기본 흐름은 v1.3과 100% 동일하게 보호됩니다.

  블로그자료 ZIP 업로드 → 게시판 저장 → 글 선택 → R2 이미지 업로드
  → Blogger 임시저장

====================

v1.4 신규 기능 (전부 선택형 모듈, 기본 화면 흐름 뒤에 보조 버튼/설정 팝업으로 배치)

1. 🔍 Blogger 최종 HTML 미리보기 (js/blogger-final-preview-module.js)
   - 블로그 저장 패널의 [🔍 최종 미리보기] 버튼(선택된 글 기준)
   - R2 이미지 URL 치환 상태(이미 확보된 URL이 있으면 표시, 없으면 "저장 시
     R2 URL로 치환 예정"으로 표시), 광고 placeholder(ADSENSE_PLACEHOLDER_TOP/
     MIDDLE/BOTTOM) 위치 확인, Blogger-safe HTML 상태(script/style/iframe/
     form/table) 확인, 본문 예상 미리보기를 보여줍니다.
   - 이 화면에서는 실제 저장이나 R2 업로드가 절대 일어나지 않습니다(읽기
     전용). blogger-save-module.js의 저장 흐름은 그대로 두고, 이 모듈
     안에서 같은 판정 로직을 읽기 전용으로 다시 계산해 보여주는 방식입니다.

2. 🩺 블로그자료 패키지 진단 (js/package-diagnosis-module.js)
   - 블로그 저장 패널의 [🩺 패키지 진단] 버튼(선택된 글 기준)
   - metadata.json / content.html / content.md·content.txt / images 폴더 /
     이미지 5장(썸네일 1 + 본문 4) / href="#" / table·script·style 위험
     요소 / 공식 출처(metadata.official_sources)를 점검합니다.
   - 결과는 점수가 아니라 정상 / 주의 / 수정 필요 3단계로만 표시합니다.
   - upload-module.js의 내부 파싱 로직은 호출도, 수정도 하지 않습니다.

3. 게시글 상태 표시 (js/post-status-module.js)
   - 블로그 저장 패널 안(선택된 글의 상태·저장 버튼 위)에 "현재 상태: ..."
     한 줄로 표시됩니다.
   - 업로드 확인 완료 / 게시판 저장 완료 / Blogger 임시저장 완료 / 저장
     실패 / 이미지 업로드 실패 상태를 별도 localStorage(gptWorkshop.postStatus.v1)에
     기록합니다. library-module.js의 저장 구조는 건드리지 않습니다.

4. 💾 백업/복원 (js/backup-module.js)
   - 설정 → 데이터 관리 → [💾 백업/복원]
   - 게시판 데이터 전체를 JSON으로 내보내고, 다시 불러와 복원할 수
     있습니다. 사용자 등록 지시서(있는 경우)도 백업 파일에 함께 포함됩니다.
   - 복원 전에는 반드시 확인 팝업("정말 이 백업 파일로 복원할까요?")을
     거칩니다. 불러오기 화면에는 먼저 내보내기로 현재 데이터를 백업해두라는
     안내 문구가 있습니다. 게시판 데이터 초기화 확인 팝업에도 백업 안내가
     추가되었습니다.
   - 백업 파일에서 posts 배열과 customPrompt만 읽고 반영합니다. 알 수 없는
     localStorage key를 무단으로 덮어쓰지 않으며, localStorage를 통째로
     지우는 동작도 없습니다.

5. 🩹 오류 백과사전 / 로그 복사 (js/error-dictionary-module.js)
   - 설정 → 오류 목록 → [🩹 오류 백과사전 / 로그 복사]
   - 기본 에러코드 5종(E-UPLOAD-001/E-R2-001/E-BLOGGER-001/E-WORKER-001/
     E-STORAGE-001)에 대한 쉬운 설명·원인·조치 방법을 안내합니다.
   - [오류 로그 복사] 버튼으로 현재 기록된 오류 목록을 복사하기 좋은 텍스트
     형식으로 클립보드에 복사합니다(실패 시 화면에 텍스트로 표시).
   - error-log-module.js는 재작성하지 않았고, v1.4에서 선택 항목 code
     필드와 log()/getErrorsByCode() 공개 함수만 추가했습니다(기존 호출부는
     변경 없이 그대로 동작).

6. 📡 Worker 상태 상세 점검 (js/worker-status-module.js)
   - 설정 → 작업 서버 → [📡 상세 상태 점검]
   - 로그인 상태, Worker 주소, Worker 연결 가능 여부(가벼운 fetch 도달성
     확인), R2 업로드 API 접근 가능 여부(추정치 — 로그인+연결 확인 기반),
     Blogger API(실제 임시저장 전까지는 "제한적"으로만 표시)를 보여줍니다.
   - 상태 점검을 위해 실제 게시글을 저장하거나 실제 이미지를 업로드하지
     않습니다. 이 점검 결과가 나빠도 기본 저장 버튼은 비활성화되지 않습니다.

7. 🕘 저장 이력 (js/save-history-module.js)
   - 설정 → 저장 이력 → [🕘 저장 이력 보기]
   - 마지막 Blogger 임시저장 시각, 성공/실패, 실패 사유 요약, 최근 이력
     (최대 20건 표시, 최근 50건까지 저장)을 보여줍니다.
   - 별도 localStorage(gptWorkshop.saveHistory.v1)에만 기록하며,
     blogger-save-module.js 내부 저장 흐름은 수정하지 않았습니다. 저장
     실패 이력이 쌓여도 다음 저장 시도를 막지 않습니다.

8. 🔁 단순 다시 저장 (js/retry-module.js)
   - 블로그 저장 패널에서 선택한 글의 saveStatus가 "임시저장실패"일 때만
     [🔁 다시 저장] 버튼이 나타납니다.
   - 클릭하면 기존 Blogger 임시저장 흐름(app-core.js의 handleSaveStartClick,
     기존 저장 버튼과 완전히 동일한 함수)을 1회만 다시 실행합니다. R2만
     재업로드하거나 Blogger만 따로 재저장하는 기능은 없습니다(저장 흐름을
     분해하지 않음).
   - 버튼 disabled 처리 + 메인 저장 버튼 진행 여부 확인으로 중복 클릭을
     방지합니다.

====================

신규 모듈 연결 구조 (app-core.js, GptCoreAPI)

- app-core.js는 위 8개 신규 모듈을 각각 독립된 safeInit(try/catch)으로
  연결합니다. 한 모듈의 초기화 실패가 다른 모듈이나 기본 흐름 초기화를
  막지 않습니다.
- 각 신규 모듈은 자신에게 필요한 DOM 요소(트리거 버튼/팝업 등)가 없으면
  예외를 던지지 않고 조용히 종료하며, bound 플래그로 이벤트 중복 연결을
  스스로 방지합니다. app-core.js는 이 결과를 isReady()로 확인할 수 있습니다.
- 신규 모듈은 window.GptCoreAPI(선택된 글 조회, 게시판 새로고침, 저장
  트리거, 공용 팝업, 생애주기 이벤트 등록)를 통해서만 core 상태에
  접근합니다. app-core.js 내부 변수를 직접 참조하지 않습니다.
- 생애주기 이벤트(post-selected/upload-confirmed/board-saved/
  board-save-failed/blogger-save-result/data-reset)는 core 처리(팝업 표시,
  게시판 갱신)가 이미 끝난 뒤에 통지되며, 리스너 하나가 예외를 던져도
  다른 리스너 호출이나 기본 흐름에는 영향이 없습니다(각 리스너 호출도
  safeInit으로 개별 격리됨).
- 업로드 확인 팝업(v1.3, upload-confirm-module.js)이 정상 연결되지 못하면
  app-core.js 자체의 대체(fallback) 업로드 흐름이 zip-file-input을 대신
  담당합니다(v1.3부터 있던 구조, v1.4에서 재검증만 했습니다).

롤백 방법
- 특정 v1.4 신규 기능 하나만 제거하려면: 해당 js 파일, index.html의 해당
  script 태그, app-core.js의 newModules 목록에서 해당 항목, 관련 팝업
  마크업, 전용 CSS(components.css/layout.css 중 관련 규칙)를 함께
  제거하면 됩니다. 다른 신규 모듈이나 기본 흐름에는 영향이 없습니다.
- 문제가 심각하면 v1.4 신규 모듈 8개를 모두 제거해 v1.3 수준으로
  되돌리거나, 그래도 해결되지 않으면 GPT공작소 v1.3 루트업로드용.zip으로
  완전히 롤백하세요(v1.3은 이번 작업에서 별도로 보관되어 있어야 합니다).

건드리지 않은 핵심 로직 (v1.3과 100% 동일, diff로 확인됨)
- 로그인 인증 (auth-module.js) — 수정 없음
- Worker 호출 / Worker 주소(https://wooow.qudrnr84.workers.dev) (worker-api-module.js) — 수정 없음
- R2 이미지 업로드 (r2-image-module.js) — 수정 없음
- Blogger 임시저장 핵심 흐름(runSaveFlow/saveBloggerDraft, 이미지 R2 업로드,
  URL 치환, table→카드 변환 등) (blogger-save-module.js) — 수정 없음
- ZIP 파싱 / 블로그자료 필수 파일 점검 (upload-module.js) — 수정 없음
- 게시판 저장/불러오기, 브라우저 저장소 구조 (library-module.js,
  storage-module.js) — 수정 없음
- 미리보기 렌더링 핵심 / 보안 필터링 (preview-module.js) — 수정 없음
- js/vendor/zip-reader.js — 수정 없음
- js/settings-module.js, js/upload-confirm-module.js,
  js/prompt-copy-module.js — v1.4에서 코드 변경 없음(byte 단위로 v1.3과
  동일). index.html에 이 모듈들이 사용하지 않는 새 버튼(설정 팝업 안,
  다른 신규 모듈이 직접 바인딩)만 추가되었습니다.

이번 v1.4에서 수정한 파일
- index.html: 신규 팝업 6개(최종 미리보기/패키지 진단/백업·복원+복원확인/
  오류 백과사전/Worker 상세 상태/저장 이력) 마크업 추가, 저장 패널에 보조
  버튼 행·다시 저장 버튼·게시글 상태 표시줄 추가, 설정 팝업에 신규 진입
  버튼 4개 추가, 게시판 데이터 초기화 확인 팝업에 백업 안내 문구 추가,
  8개 신규 모듈 script 태그 추가
- css/layout.css: save-tool-row(보조 버튼 가로 배치), 다시 저장 버튼 여백
- css/components.css: 패키지 진단 리스트(정상/주의/수정 필요 배지), 오류
  백과사전 리스트, 게시글 상태 표시줄 스타일 추가
- js/app-core.js: GptCoreAPI 공개 표면 + 생애주기 이벤트 통지 추가,
  8개 신규 모듈을 각각 독립 safeInit으로 연결. 업로드/게시판/저장/대체
  업로드 흐름 등 기존 v1.3 로직 자체는 수정하지 않음(통지 호출 추가만)
- js/error-log-module.js: code(선택) 필드, log()/getErrorsByCode() 공개
  함수 추가(기존 logError/getAllErrors/resolveError/clearErrors 구조는
  그대로 유지, 하위 호환)
- version.json, README.txt: v1.4 기준 갱신

이번 v1.4에서 추가한 신규 파일 (8개, 전부 선택 기능)
- js/blogger-final-preview-module.js
- js/package-diagnosis-module.js
- js/post-status-module.js
- js/backup-module.js
- js/error-dictionary-module.js
- js/worker-status-module.js
- js/save-history-module.js
- js/retry-module.js

앱 구조(v1.4)
```
GPT 공작소
├─ 상단: 이름 / 오류 아이콘 / 설정 아이콘(settings-module.js)
├─ 업로드: upload-module.js + upload-confirm-module.js
├─ 게시판: library-module.js + storage-module.js + preview-module.js
├─ 블로그 저장: blogger-save-module.js + r2-image-module.js + worker-api-module.js
│   ├─ 🔍 최종 미리보기: blogger-final-preview-module.js (선택)
│   ├─ 🩺 패키지 진단: package-diagnosis-module.js (선택)
│   ├─ 게시글 상태: post-status-module.js (선택)
│   └─ 🔁 다시 저장: retry-module.js (선택)
├─ 블로그 지시서 복사: prompt-copy-module.js
└─ 설정: settings-module.js
    ├─ 💾 백업/복원: backup-module.js (선택)
    ├─ 🩹 오류 백과사전: error-dictionary-module.js (선택)
    ├─ 📡 Worker 상세 상태: worker-status-module.js (선택)
    └─ 🕘 저장 이력: save-history-module.js (선택)
```
app-core.js(+ GptCoreAPI)는 위 모듈들을 연결(wiring)하는 역할만 담당합니다.

계속 제외한 기능(이번 v1.4에도 포함하지 않음)
- 자동 글 생성, Gemini/GPT API 연결, 품질점수, SEO 점수, 자동 발행,
  예약 발행, 게시판 검색/필터, 복잡한 검수 시스템, R2만 재업로드,
  Blogger만 재저장

설치 방법
- 이 ZIP의 압축을 풀면 나오는 index.html / css / js / data / version.json을
  그대로 GitHub Pages 저장소 루트에 덮어씁니다(상위 폴더를 한 번 더
  만들지 않습니다).
- v1.3 파일을 미리 백업해두는 것을 강력히 권장합니다(롤백 대비).

실기 테스트 필요 항목
1. 로그인 → 설정 아이콘 표시 확인(로그아웃 버튼 자리 대체)
2. 설정 팝업 열림/닫힘, [계정] 로그아웃 정상 동작
3. 설정 팝업에서 작업 서버 주소 표시, [서버 상태 확인] 버튼 동작
4. 블로그 지시서 관리: 상태 표시, TXT 지시서 불러오기, 기본 지시서로 초기화
5. 지시서 등록 후 [블로그 지시서 복사]가 사용자 지시서를 우선 복사하는지 확인
6. 게시판 기본 화면 최신 글 1개 표시 + [전체 게시판] 버튼 정상 동작
7. 모바일 폭에서 블로그 저장 버튼/상태가 잘리지 않는지 확인(내부 스크롤 확인)
8. ZIP 업로드 → 바로 저장되지 않고 업로드 확인 팝업(요약/체크리스트/미리보기)이
   뜨는지 확인
9. 업로드 확인 팝업에서 [취소] 시 게시판에 저장되지 않는지, [게시판에 저장]
   클릭 시 저장되고 최신 글로 반영되는지 확인
10. 잘못된 ZIP(예: 일반 압축파일) 업로드 시 개선된 오류 문구가 표시되는지 확인
11. 팝업 닫기 버튼 시인성, 안내문/버튼 간격 확인
12. Blogger 임시저장/이미지 반영이 v1.2와 동일하게 정상 동작하는지 확인
13. 설정 팝업의 [게시판 데이터 초기화] 확인 팝업 → [취소]/[초기화] 동작 확인
14. index.html을 file://로 직접 열었을 때 기본 지시서 fetch 실패 여부(CORS)
    확인 — 반드시 HTTP(S) 환경에서 최종 확인
15. (안전 연결 검증) upload-confirm-module.js의 script 태그를 임시로
    지운 상태로 열어, ZIP 업로드 시 app-core.js의 대체(fallback) 확인
    팝업이 뜨고 [게시판에 저장]으로 정상 저장되는지 확인. 되돌린 뒤 재확인.
16. (안전 연결 검증) 브라우저 개발자 도구 콘솔에서 오류 없이 로그인 →
    업로드 → 저장 → Blogger 임시저장까지 끝까지 진행되는지 확인
17. 신규 모듈 하나(예: js/backup-module.js)를 제거해도 기본 업로드/저장
    흐름이 동작하는지 확인
18. 오류 백과사전/백업/Worker 상태/저장 이력 팝업이 기본 저장을 막지
    않는지 확인(팝업을 연 채로도 기본 화면 뒤 저장 버튼 자체는 별도
    화면이라 서로 간섭하지 않음을 확인)
19. 단순 다시 저장(🔁)이 기존 Blogger 임시저장 흐름을 1회만 호출하는지,
    연속 클릭 시 중복 실행되지 않는지 확인
20. 콘솔 오류 없이 업로드→게시판 저장→Blogger 임시저장까지 진행되는지 확인
21. 🔍 최종 미리보기 / 🩺 패키지 진단이 실제 저장·업로드를 실행하지
    않는지(네트워크 탭에 요청이 없는지) 확인
22. 💾 백업 내보내기로 받은 JSON 파일을 다시 불러오기 → 복원 확인 팝업
    → [복원하기] 클릭 시 게시판에 정상 반영되는지 확인
23. 게시글 상태 표시줄이 업로드 확인/게시판 저장/Blogger 저장 단계에 맞춰
    갱신되는지 확인

자동 검증 완료 사항 (jsdom 기반 시뮬레이션, 이번 작업에서 실행함)
- v1.4 신규 모듈 8개 + v1.3 신규 모듈 2개 전부 정상 초기화(isReady) 확인
- 업로드→확인→게시판 저장→글 선택→Blogger 임시저장(mock) 전체 흐름이
  콘솔 오류 없이 1회씩만 실행됨을 확인
- v1.4 신규 모듈 관련 DOM(팝업/버튼) 전체를 제거해도 기본 흐름이
  예외 없이 끝까지 동작함을 확인
- 다시 저장(retry) 버튼이 실패 시에만 노출되고, 3연속 클릭해도
  runSaveFlow가 정확히 1회만 추가 호출됨을 확인(중복 클릭 방지 확인)
- 저장 결과 리스너 중 하나가 강제로 예외를 던져도, 이후 등록된 다른
  리스너 호출과 게시판 저장 자체가 정상적으로 완료됨을 확인
- 패키지 진단(href="#" 감지)과 최종 미리보기(광고 placeholder 감지)가
  실제로 올바른 값을 표시함을 확인
- 백업 팝업이 저장된 글 개수를 정확히 표시함을 확인

다음 업데이트(v1.5) 후보
- 오류 코드 체계 확장(더 많은 E-XXX 코드), 실제 로그와의 자동 매칭 강화
- 게시판 정렬/검색 옵션
- 저장 전 HTML 정리 옵션
- 화면 표시 옵션
