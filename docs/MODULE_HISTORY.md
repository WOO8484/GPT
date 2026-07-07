# MODULE HISTORY

GPT 공작소 프로젝트의 모듈별 생성 이력을 기록합니다.

## 0.0.9 - 0.0.8 실기 잔여 문제 보정 + 버전 일치화 + Worker 연결 확인 - 2026-07-07

새 모듈 없음. 표시/설정값 보정 위주로 7개 파일만 수정했다(css/base.css, css/layout.css 및 Blogger/Schedule/SEO/Storage/Archive 등 핵심 로직 파일은 수정하지 않음).

| 파일 | 변경 내용 | 상태 |
|---|---|---|
| index.html | 로그인 화면 버전 0.0.9, 설정에 "Worker 연결" 메뉴/하위 팝업 추가, 품질검수 진행 UI(타이머/단계/실패사유/호출주소/재시도) 마크업 추가, 블로그 등록 결과 카드 추가 | 부분 수정 |
| js/app-core.js | AppState.version 0.0.9, displayStatus()에 '임시저장완료'→'블로그스팟 임시저장 완료' 표시 매핑 추가, 품질검수 타이머/단계/재시도 로직 추가, 블로그 임시저장/예약저장 alert() 제거 후 결과카드로 전환, 예약 날짜/시간 기본값 자동 채움, 설정 Worker 연결 이벤트 바인딩 추가 | 부분 수정 |
| js/auth-module.js | Worker 주소를 고정 상수에서 `getWorkerBaseUrl()`/`setWorkerBaseUrl()`(localStorage 기반, 기본값 동일)로 변경. 로그인 호출 경로 자체는 변경 없음 | 부분 수정 |
| js/worker-api-module.js | `callWorker()`가 `getWorkerBaseUrl()`을 사용하도록 변경, `/health` 진단 전용 `checkWorkerHealth()` 추가(401 자동 로그아웃과 무관한 별도 fetch) | 부분 수정 |
| js/gemini-review-module.js | 실패 사유 분류(`classifyReviewError`)와 진행 단계 콜백(`onStage`), 호출 주소 노출(`getReviewEndpointUrl`) 추가. 페이로드 구성/프롬프트 로직은 변경 없음 | 부분 수정 |
| css/components.css | `.archive-item__meta` 한 줄 고정, `.check-list--tall`(블로그 등록 목록 전용, 다른 목록 영향 없음), `.result-card`(성공/실패 공통 안내 카드) 추가 | 부분 수정 |
| version.json | 버전/설명 갱신 | 부분 수정 |

### 이번 0.0.9에서 다루지 않은 기존 모듈
- css/base.css, css/layout.css, js/storage-module.js, js/archive-module.js, js/backup-module.js, js/seo-module.js, js/error-log-module.js, js/gpt-upload-module.js, js/zip-upload-module.js, js/preview-module.js, js/blogger-module.js, js/schedule-module.js, js/statistics-module.js, js/guideline-module.js, js/image-module.js, js/vendor/zip-reader.js: 코드 수정 없음. Blogger 저장/임시저장/예약 저장 핵심 로직(blogger-module.js, schedule-module.js)과 Gemini 호출 경로/모델 선택 로직은 이번에도 그대로 유지했다.

### 참고
- Worker 주소는 설정 화면에서 저장한 값이 있으면 그 값을 우선 사용하고, 없으면 기존과 동일한 기본값(`https://wooow.qudrnr84.workers.dev`)을 사용한다.
- `/health` 연결 확인은 인증 토큰 유무와 무관하게 동작하도록 `callWorker()`를 거치지 않는 별도 함수로 구현했다(로그인 여부에 따른 자동 로그아웃 부작용 방지).

## 0.0.8 - 0.0.7 GUI 실기 미통과 보정 - 2026-07-07

새 모듈 없음. 기능 로직 변경 없이 GUI/CSS/HTML 표시 구조만 보정했다. index.html, css/components.css, css/layout.css, js/app-core.js 4개 파일만 수정했다.

| 파일 | 변경 내용 | 상태 |
|---|---|---|
| index.html | GPT 지시서 복사를 작업대 버튼으로 변경, 자료실 상세 버튼 2열+1열 재배치, 별도 품질검수 팝업 제거 후 자료실 상세 내부 카드로 대체, 등록 팝업에 저장 완료 성공 카드 추가 | 부분 수정 |
| js/app-core.js | 품질검수 표시 로직을 팝업 open/close에서 자료실 상세 내부 카드 show/hide로 변경(진행 중 버튼 문구 전환 포함), 등록 저장 완료 처리에서 `alert()` 제거 후 성공 카드 표시로 변경, 저장 버튼 클릭 즉시 비활성화 추가 | 부분 수정 |
| css/components.css | `.btn` 최소 높이(52px)/가로 텍스트 고정, `.btn-row` 간격(12px), `.btn:disabled` 회색 처리, `.register-success-card` 스타일 추가 | 부분 수정 |
| css/layout.css | `.desk-btn` 높이/간격 보정, `#archive-detail-view` 내부 스크롤(본문만 스크롤, 버튼 고정) 구조 추가, `.quality-review-panel` 여백 추가 | 부분 수정 |

### 이번 0.0.8에서 다루지 않은 기존 모듈
- js/auth-module.js, js/worker-api-module.js, js/gemini-review-module.js, js/preview-module.js, js/storage-module.js, js/archive-module.js, js/backup-module.js, js/seo-module.js, js/error-log-module.js, js/gpt-upload-module.js, js/zip-upload-module.js, js/blogger-module.js, js/schedule-module.js, js/statistics-module.js, js/guideline-module.js, js/vendor/zip-reader.js, js/image-module.js, css/base.css: 코드 수정 없음. Gemini 호출 경로/모델 선택 로직(gemini-review-module.js, worker-api-module.js)은 이번 GUI 보정 대상에서 제외했다.

### 품질검수 표시 구조 변경 메모
- 0.0.7에서는 `popup-quality-review`라는 별도 중앙 팝업으로 표시했으나, 실기에서 자료실 팝업 위에 겹쳐 보이는 문제가 확인되어 0.0.8부터는 자료실 상세보기(`archive-detail-view`) 내부의 `#quality-review-panel` 카드로 표시 방식만 바꿨다. 진행 중/완료/실패 상태 판단 로직과 `GeminiReviewModule`/`WorkerApiModule` 호출 자체는 변경하지 않았다.

## 0.0.7 - 실기 화면 보정 + 미리보기 이미지/가독성 보정 + Gemini 품질검수 반영 - 2026-07-07

새 모듈 1개 추가(gemini-review-module.js). worker-api-module.js는 함수 1개 추가(기존 함수 변경 없음). preview-module.js는 이미지 src 매핑 함수 1개 추가. app-core.js는 품질검수 팝업 관련 함수/이벤트 바인딩만 추가. css 3개 파일은 세로 텍스트 깨짐 방지/미리보기 가독성/오버플로 방지 규칙만 추가. index.html은 품질검수 버튼/팝업, 안내 문구, 스크립트 태그만 추가. 로그인/Worker 인증/Blogger 연결/SEO 로직/저장소 핵심 구조는 변경하지 않았다.

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Gemini Review Module | js/gemini-review-module.js | Gemini 품질검수 요청 데이터 구성(최소 항목), 본문 길이/SEO 통과 여부 기준 빠른 검수·정밀 검수 자동 선택, 응답 JSON 파싱, 수정요청 문구 생성. 글 생성/ZIP 수정은 하지 않음 | 생성 완료 |
| Worker API Module | js/worker-api-module.js | (부분 수정) 기존 `callWorker()` 공통 호출 함수를 재사용하는 `requestGeminiReview()` 추가. 기존 `checkBloggerStatus()`/`saveBloggerDraft()`는 변경 없음 | 부분 수정 |
| Preview Module | js/preview-module.js | (부분 수정) `mapImageSources()` 추가 — content.html의 img src(ZIP 내부 상대경로)를 imageList의 dataUrl로 치환해 미리보기 이미지 깨짐을 보정. 기존 sanitizeHtml()/renderPreview() 반환 필드 구조는 변경 없음 | 부분 수정 |
| App Core | js/app-core.js | (부분 수정) 품질검수 팝업 렌더링(`runQualityReview`, `renderQualityReviewIssues`, `showQualityReviewState`)과 이벤트 바인딩(`bindQualityReviewEvents`) 추가. 기존 등록/자료실/미리보기/블로거/설정 로직은 변경 없음 | 부분 수정 |

### 이번 0.0.7에서 다루지 않은 기존 모듈
- js/storage-module.js, js/archive-module.js, js/backup-module.js, js/seo-module.js, js/error-log-module.js, js/gpt-upload-module.js, js/zip-upload-module.js, js/blogger-module.js, js/schedule-module.js, js/statistics-module.js, js/auth-module.js, js/guideline-module.js, js/vendor/zip-reader.js, js/image-module.js: 코드 수정 없음(삭제 금지 목록 그대로 유지).

### Gemini 품질검수 설계 메모
- Gemini 호출은 기존 `WorkerApiModule.callWorker()` 공통 함수를 그대로 통과하므로, 세션 토큰 첨부·401 자동 로그아웃 처리가 기존과 동일하게 적용된다.
- 실제 Worker 엔드포인트 경로는 `/gemini/review`로 가정했다. 실제 Worker 구현의 경로가 다르면 `worker-api-module.js`의 `requestGeminiReview()` 안의 경로 문자열만 맞춰 조정하면 된다(신규 Worker 코드 자체를 작성하지 않았으므로 이 프로젝트 파일만으로는 실제 응답을 확인할 수 없다).
- Gemini 요청 payload는 `title/description/bodyText/faqList/thumbnailText/imageAltTexts/seoScore/seoIssues`로 최소화했으며, 원본 이미지 base64·Blogger 토큰·Worker 토큰·API Key는 포함하지 않는다.
- 품질검수 결과는 자료실(글 데이터)에 저장하지 않는 읽기 전용 표시로 구현했다(저장소 핵심 구조 변경 없음, 실패해도 자료실 데이터에 영향 없음).

## 0.0.6 repair2 - 중앙 팝업 통일 + 등록 검증 흐름 정리 + 설정/미리보기 보정 - 2026-07-07

새 모듈 1개 추가(guideline-module.js). preview-module.js는 부분 수정(목차/FAQ 반환값 추가). app-core.js는 등록하기/미리보기/설정 팝업 로직을 중심으로 부분 재구성. index.html/css는 팝업 방식 통일 및 스크롤 영역 재정리. 로그인/Worker/Blogger 연결/SEO 로직/저장소 핵심 구조는 변경하지 않았다.

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Guideline Module | js/guideline-module.js | 블로그 지시서(GPT 요청 문구) localStorage 저장/조회/기본값 복구/클립보드 복사. OpenAI API를 호출하지 않는 단순 텍스트 보조 기능 | 생성 완료 |
| Preview Module | js/preview-module.js | (부분 수정) renderPreview() 반환값에 목차(tableOfContents, H2/H3 자동 추출)와 faqList를 추가. 기존 sanitizeHtml()/기본 반환 필드는 변경 없음 | 부분 수정 |
| App Core | js/app-core.js | (부분 재구성) 등록하기(자동 검증 + 요약카드 + X 클릭 확인), 미리보기(Blogspot 스타일 렌더링 + 모바일/PC 전환), 설정(기본화면 + 하위 팝업), 블로그 지시서 관리 이벤트 추가 | 부분 재구성 |

### 이번 repair2에서 다루지 않은 기존 모듈
- js/storage-module.js, js/archive-module.js, js/backup-module.js, js/seo-module.js, js/error-log-module.js, js/gpt-upload-module.js, js/zip-upload-module.js, js/blogger-module.js, js/schedule-module.js, js/statistics-module.js, js/auth-module.js, js/worker-api-module.js, js/vendor/zip-reader.js, js/image-module.js: 코드 수정 없음(삭제 금지 목록 그대로 유지).

### 정리한 잔재
- css/layout.css: 어떤 화면에서도 더 이상 쓰이지 않는 구 자료실 오버레이 셀렉터(`detail-overlay`, `archive-detail--open`, `detail-panel`, `detail-panel__scroll`) 제거
- css/components.css: 이미지 관리 화면(현재 미연결) 전용 잔재 클래스(`image-item__info`, `image-item__alt-input`, `image-item__delete-btn`) 및 구 SEO 상세화면 전용 잔재 클래스(`seo-issue-item`) 제거

## 0.0.6 repair1 - 암호 로그인 + 단일 대시보드 GUI 정리 + Blogger Worker 연동 - 2026-07-07

새 모듈 2개 추가(auth-module.js, worker-api-module.js). blogger-module.js는 전면 교체. schedule-module.js/statistics-module.js는 신규 상태값 반영을 위한 부분 수정. index.html/app-core.js는 단일 대시보드+팝업 구조로 재구성.

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Auth Module | js/auth-module.js | 암호 로그인 화면 제어, Worker `/auth/login` 호출, 세션 토큰(sessionStorage) 저장/삭제, 401 발생 시 강제 로그아웃 | 생성 완료 |
| Worker API Module | js/worker-api-module.js | Worker 공통 호출(세션 토큰 Authorization 헤더 첨부, 401 처리), `/blogger/status`, `/blogger/draft` 호출 | 생성 완료 |
| Blogger Module | js/blogger-module.js | (전면 교체) Blog ID/Access Token 수동 입력 후 Google Blogger API 직접 호출하던 기존 방식 제거. WorkerApiModule을 통한 연결 상태 확인/임시저장만 제공 | 교체 완료 |
| Schedule Module | js/schedule-module.js | (부분 수정) 예약 가능 상태값에 "등록완료"/"임시저장완료" 추가, 예약 성공 시 상태값을 "예약저장됨"으로 변경 | 부분 수정 |
| Statistics Module | js/statistics-module.js | (부분 수정) STATUS_LIST 및 예약 글 수 집계에 신규 상태값 반영 | 부분 수정 |
| Zip Upload Module | js/zip-upload-module.js | (부분 수정) runValidation() 추가 — 구조 검증(8종 필수 파일/이미지) + SEO 검수를 통과해야만 저장 가능하도록 게이트 추가. 저장 시 기본 상태값 "등록완료" | 부분 수정 |
| App Core | js/app-core.js | (전면 교체) 로그인 연동, 단일 대시보드(최근 글 전광판+공작소 작업대) 렌더링, 팝업(등록하기/자료실/블로그 등록하기/설정) 이벤트 바인딩으로 재구성 | 교체 완료 |

### WP 0.0.10 이식 관련 참고사항(출처/제약)
- js/auth-module.js, js/worker-api-module.js는 WP 0.0.10의 `assets/js/wp/auth/auth-session.js`, `assets/js/wp/common/api-adapter.js`, `assets/js/wp/common/constants.js`, `assets/js/wp/publish/blogger-adapter.js` 중 로그인/세션/Worker 공통 호출/Blogger 상태 확인·임시저장 부분만 GPT 공작소 구조와 명명 규칙에 맞게 새로 작성했다. WP의 화면 마크업, 문구, 글쓰기/검색/AI 생성/프리셋/테스트 페이지 관련 코드는 가져오지 않았다.
- Worker 주소(`WORKER_BASE_URL`)는 WP 0.0.10과 동일한 값을 그대로 사용했다. API Key, Client Secret, Refresh Token, 관리자 비밀번호 등 민감정보는 이번 작업의 어떤 파일에도 포함하지 않았으며, 전부 Worker(서버) 측이 관리하는 것을 전제로 한다.
- Worker에 실제 발행(즉시 공개) 경로가 없어, 이번 repair1의 Blogger 기능은 "블로그 임시 저장"과 "예약 저장"(로컬 예약 정보)만 제공한다. mock으로 발행 성공을 흉내 내지 않았다.

### 이번 repair1에서 다루지 않은 기존 모듈
- js/image-module.js, js/gpt-upload-module.js, js/seo-module.js, js/storage-module.js, js/backup-module.js, js/preview-module.js, js/error-log-module.js, js/vendor/zip-reader.js: 코드 수정 없음.
- 다만 index.html에서 js/image-module.js의 이미지 관리 화면은 이번 대시보드/팝업 구조에 새 진입점을 만들지 않아 더 이상 로드되지 않는다(파일 자체는 삭제하지 않고 그대로 둠). 자세한 내용은 docs/KNOWN_LIMITATIONS.md 참고.

## 0.0.6 - ZIP 자료 패키지 자동 업로드 - 2026-07-06

새 모듈 2개 추가. 기존 gpt-upload-module.js는 삭제하지 않고 수동 업로드 보조 모듈로 그대로 유지한다.

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Zip Reader(벤더) | js/vendor/zip-reader.js | 표준 ZIP 중앙 디렉터리/로컬 헤더 파싱과 DEFLATE(RFC 1951) 압축 해제를 순수 JS로 구현한 최소 ZIP 리더. 저장(Stored)/Deflate 압축만 지원 | 생성 완료 |
| Zip Upload Module | js/zip-upload-module.js | ZIP 안에서 metadata.json/content.html/content.md/content.txt와 thumbnail/body-01~03 이미지를 파일명 기준(하위 폴더 포함)으로 인식, 글 데이터·imageList 구성 후 `StorageModule.savePost()`로 저장 | 생성 완료 |

### gpt-upload-module.js(기존 수동 업로드)
- 코드 수정 없음. UI에서 [수동 업로드 열기/닫기] 버튼으로 접고 펼 수 있는 보조 영역으로 재배치되었을 뿐, 개별 파일 인식/저장 로직과 공개 함수는 이전과 동일하다.

### ZIP 읽기 구현 관련 참고사항(출처/제약)
- 이번 작업 환경에서는 JSZip 등 외부 라이브러리를 네트워크로 내려받을 수 없어(sandbox 네트워크 제약), `js/vendor/zip-reader.js`를 공개된 ZIP 포맷 규격과 DEFLATE(RFC 1951) 알고리즘 명세를 바탕으로 이번 작업에서 직접 작성했다. 외부 라이브러리 코드를 가져오거나 재배포한 것이 아니다.
- Node.js 환경에서 Python `zipfile`로 생성한 실제 ZIP(저장/Deflate 혼합, 하위 폴더, 한글 경로, `__MACOSX`/`.DS_Store`/디렉터리 항목 포함, 20KB~ 바이너리 이미지 포함)로 원본과 바이트 단위 일치를 검증했다.
- 암호화된 ZIP, ZIP64(초대형 ZIP), BZIP2/LZMA 등 그 외 압축 방식은 지원 범위 밖이며 해당 항목은 건너뛴다.

### Zip Upload Module 설계 메모
- 공개 함수: `setZipFile(file)`, `getCheckStatus()`, `saveToArchive()`, `reset()` (작업지시서 9.1 권장 함수와 동일)
- 이미지 후보가 여러 확장자로 겹치는 경우 png→jpg→jpeg→webp 우선순위로 1개만 선택(썸네일 1장, 본문 이미지는 01~03 번호별로 각 1장)
- metadata.json이 없어도 저장 가능하며, 이 경우 제목은 ZIP 파일명에서 확장자를 제거한 값을 사용
- 상태값은 항상 `작성중`으로 저장(기존 gpt-upload-module.js와 달리 metadata의 status 값을 신뢰하지 않음 — 작업지시서 7.4 "상태값은 기본 작성중으로 저장" 기준)
- ZIP 업로드는 항상 새 글로 저장하며, 같은 제목 글이 있어도 덮어쓰지 않는다(이번 작업 범위에서 덮어쓰기 기능은 만들지 않음)

### index.html / App Core / CSS
| 영역 | 파일 | 변경 내용 | 상태 |
|---|---|---|---|
| 업로드 화면(HTML) | index.html | 상단에 ZIP 자동 업로드 영역(ZIP 파일 선택/선택 파일명/ZIP 인식 결과/ZIP 자료실에 저장하기) 추가. 기존 4개 파일 수동 업로드 영역은 `#manual-upload-panel`로 감싸 `manual-upload-panel--collapsed` 클래스로 기본 접힘 처리하고 `[수동 업로드 열기/닫기]` 토글 버튼 추가. `js/vendor/zip-reader.js`, `js/zip-upload-module.js` script 태그를 `gpt-upload-module.js` 다음, `image-module.js` 이전에 추가(작업지시서 9.3 로딩 순서 기준). 미리보기 화면에 `#preview-empty-message` 안내 영역 추가 | 보정 완료 |
| App Core | js/app-core.js | ZIP 파일 선택/저장 이벤트 바인딩, `renderZipCheckList()`(ZIP 인식 결과 7항목: metadata/html/md/txt/썸네일/본문 이미지 장수/image_prompts) 추가. `[수동 업로드 열기/닫기]` 토글 바인딩 추가. `renderPreviewView()`가 선택된 글이 없을 때 안내 메시지를 보여주고 나머지 영역을 숨기도록 보정(기존에는 아무 것도 렌더링하지 않고 그대로 반환해 빈 화면처럼 보였음) | 보정 완료 |
| 스타일(CSS) | css/components.css | ZIP 안내 텍스트(`.upload-desc`), 수동 업로드 접힘 상태(`.manual-upload-panel--collapsed`), 미리보기 안내 텍스트(`.preview-empty-text`) 최소 스타일 추가 | 보정 완료 |

### SEO / Backup / Statistics 보정
| 모듈 | 파일 | 보정 내용 | 상태 |
|---|---|---|---|
| SEO Module | js/seo-module.js | `saveSeoResult()`에서 SEO 결과가 "통과"이고 현재 상태가 "작성중"이면 "검수중"으로 자동 전환하는 조건 추가(그 외 상태는 변경하지 않음) | 보정 완료 |
| Backup Module | js/backup-module.js | 전체 백업 payload의 하드코딩된 `version` 값을 `"0.0.1"`에서 `"0.0.6"`으로 보정 | 보정 완료 |
| Statistics Module | js/statistics-module.js | 전체 점검(`runFullCheck`)에서 레거시 상태값/dataUrl 이미지/Blogger 이력/예약 불일치 발견 시 매번 `ErrorLogModule.logError()`를 호출하던 부분을 제거. 점검 결과 항목(items) 표시는 그대로 유지하고, 실제 실패(저장/파싱/API 등)만 오류 이력에 남도록 보정 | 보정 완료 |

### 범위 제외 (0.0.6에서 다루지 않음)
- Blogger OAuth 전체 로그인, Worker 신규 구현, 네이버 API/검색 API/글쓰기 프리셋
- ZIP 이미지의 Blogger 서버 자동 업로드/변환
- 기존 글 덮어쓰기, 전체 UI 재설계, js/storage-module.js·js/archive-module.js·js/image-module.js·js/preview-module.js·js/blogger-module.js·js/schedule-module.js 로직 변경(연결에 필요한 최소 변경 없음)

## Final Repair 1 (0.0.5 final repair1) - 2026-07-06

새 모듈 생성 없음. 새 기능 추가가 아니라 "업로드 화면 파일 선택 입력 오류 수정" 목적의 좁은 범위 repair.

| 모듈/영역 | 파일 | 보정 내용 | 상태 |
|---|---|---|---|
| 업로드 화면(HTML) | index.html | metadata/HTML/Markdown/TXT 4개 파일 선택 input의 accept 속성을 `.json,application/json` / `.html,.htm,text/html` / `.md,.markdown,text/markdown,text/plain` / `.txt,text/plain`으로 수정. 각 선택 영역에 선택된 파일명 표시용 요소(`upload-*-filename`) 추가 | 보정 완료 |
| App Core | js/app-core.js | 업로드 4개 input의 change 이벤트에서 선택된 파일명을 화면에 표시하는 `renderUploadFileName()` 추가 및 각 change 핸들러/저장 후 초기화 로직에 연결 | 보정 완료 |
| 스타일(CSS) | css/components.css | 선택된 파일명 표시 요소(`.upload-filename`)에 대한 최소 스타일 추가 | 보정 완료 |
| GPT Upload Module | js/gpt-upload-module.js | 수정 없음(파일 인식/저장 로직은 기존 그대로 정상 동작 확인) | 변경 없음 |

### 보정이 필요했던 이유
- 기존 index.html은 4개 파일 선택 input이 각각 분리되어 있었으나, accept 속성이 실제 허용해야 할 확장자 조합(.json/.html·.htm/.md·.markdown/.txt)과 일치하지 않아 실기 확인 중 content.html/content.md/content.txt 선택이 막히는 문제가 있었다. 4개 input의 accept 값을 작업지시서 기준에 맞춰 수정했다.
- 선택된 파일명이 화면에 표시되지 않아 사용자가 어떤 파일이 실제로 선택되었는지 확인하기 어려웠다. 각 선택 영역에 파일명 표시 요소를 추가해 확인 가능하도록 했다.

### 범위 제외
- js/storage-module.js, js/archive-module.js, js/backup-module.js, js/error-log-module.js, js/preview-module.js, js/image-module.js, js/seo-module.js, js/blogger-module.js, js/schedule-module.js, js/statistics-module.js는 수정하지 않음
- ZIP/JSZip/vendor 재도입, 붙여넣기 UI 재도입, AI 글/이미지 생성, Blogger/예약발행/통계 기능 수정 없음

## Phase E (0.0.5) - 2026-07-06

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Statistics Module | js/statistics-module.js | 전체 글 수/상태별 글 수/SEO 통과 글 수/Blogger 문제 글 수/이미지 등록·ALT 누락 글 수/최근 수정 글 목록 집계(읽기 전용), 전체 점검(저장소 상태·오류 로그·레거시 상태값·dataUrl 이미지·Blogger/예약 불일치 등 10개 항목 판정) | 생성 완료 |

새 화면 2개: 통계, 전체 점검 (모두 설정 화면에서 진입, 바텀 네비 변경 없음)

### Phase A~D 데이터와 연결된 방식
- statistics-module.js는 `ArchiveModule.loadPosts()`가 반환하는, 이미 레거시 영어 상태값이 보정된 데이터를 그대로 사용한다(별도 정규화 로직을 중복 구현하지 않음).
- `post.seoResult`(Phase C), `post.imageList`(Phase C), `post.bloggerInfo`/`post.scheduleInfo`(Phase D)를 그대로 읽어 집계하며, 이 필드들의 구조를 변경하지 않는다.
- 통계/전체 점검 모두 `StorageModule.savePost()`를 호출하지 않는 완전한 읽기 전용 모듈이다.

### 이번 Phase에서 보정한 기존 화면
- 미리보기 화면의 탭 버튼명 정리: "HTML 보기"→"HTML 본문 보기", "TXT 보기"→"텍스트 보기" (기능/이벤트 바인딩은 변경 없음, 표시 텍스트만 수정)
- 나머지 9개 화면(홈/업로드/자료실/미리보기/이미지 관리/SEO 검수/Blogger 업로드/예약발행/설정)의 고정 화면 구조(Phase D Repair 1에서 적용)는 변경 없이 유지 확인

### Phase E 이후(차기) 연결 참고사항
- 통계 화면의 `problemPosts`(Blogger 문제/ALT 누락) 목록은 자료실의 필터·상세보기와 동일한 post.id를 사용하므로, 차후 "문제 있는 글 목록"을 자료실 상세보기로 바로 연결하는 기능을 얹기 쉬운 구조다(이번 Phase에서는 읽기 전용 표시만 구현).
- 전체 점검의 판정 항목(통과/확인 필요/오류)은 배열 구조(`items[]`)로 구성되어 있어, 향후 항목을 추가하거나 알림/배지 기능과 연결하기 쉽다.

## Phase D Repair 1 (0.0.4 repair1) - 2026-07-06

새 모듈 생성 없음. 새 기능 추가가 아니라 "발행 전 무결점 정리" 목적의 보정 작업.

| 모듈/영역 | 파일 | 보정 내용 | 상태 |
|---|---|---|---|
| Blogger Module | js/blogger-module.js | `uploadToBlogger()`가 mode 인자(draft/publish)를 받아 isDraft 쿼리 파라미터를 구분 전송. 실패 메시지를 임시저장/실제발행으로 분리. 업로드 성공 후 로컬 저장 실패 시 lastError에 불일치 정보를 남기고 전용 오류 메시지로 기록 | 보정 완료 |
| Schedule Module | js/schedule-module.js | 예약 저장 전 제목/HTML본문/SEO통과/상태값(발행대기·검수중) 조건 검사(`checkScheduleReadiness`, 모듈 내부 전용) 추가, 미충족 시 "예약 조건 미충족" 기록. 예약 취소 시 복원값 레거시 상태 정규화 | 보정 완료 |
| Archive Module | js/archive-module.js | `loadPosts()`에 레거시 영어 상태값(draft/published/scheduled/error) 자동 보정 마이그레이션 추가(글 단위 개별 처리, 실패 시 개별 기록). `getFilteredPosts()` 상태 필터에 방어적 정규화 적용 | 보정 완료 |
| App Core | js/app-core.js | 전체 데이터 가져오기/Blogger 업로드(임시저장·발행)/발행대기 전환/예약 저장 실행 전 확인 팝업 추가. 상태값 표시 지점에 방어적 `displayStatus()` 정규화 적용. Blogger 업로드 버튼을 임시저장/발행 2종으로 분리 대응 | 보정 완료 |
| 레이아웃(CSS/HTML) | css/layout.css, css/base.css, css/components.css, index.html | app-container를 100vh(dvh) 고정형으로 전환, app-nav의 `position:fixed` 제거(flex 항목화), app-main을 스크롤 컨테이너에서 높이 고정 컨테이너로 전환. 자료실 목록/미리보기 본문/이미지 목록/SEO 문제 목록/예약 목록에 `.section--scroll`, 상세 패널/오류 패널에 `.detail-panel__scroll`/`.error-panel__scroll` 도입 | 보정 완료 |

### 보정이 필요했던 이유
- 기존 layout.css는 `.app-container{min-height:100vh}` + `.app-nav{position:fixed}` 조합으로, 콘텐츠가 길어지면 컨테이너 자체가 100vh를 넘어 자라면서 문서(body) 전체가 스크롤되는 구조였다. `min-height`를 `height`(+`100dvh`)로, `app-main`에 `min-height:0`을 주고 nav를 일반 flex 항목으로 바꿔 헤더/네비가 항상 고정되고 지정된 목록 영역만 내부 스크롤되도록 정리했다.
- Blogger 업로드는 Phase D에서 임시저장/발행 구분이 payload 수준에서 명확하지 않았다. Repair 1에서 `isDraft` 쿼리 파라미터와 버튼 분리로 명확히 구분하고, 실제 발행에는 확인 팝업을 필수로 두어 오발행을 방지했다.
- 예약발행은 Phase D에서 날짜 형식만 검증했으나, 발행 흐름과 연결되는 기능이므로 Repair 1에서 글 자체의 발행 가능 여부(제목/본문/SEO/상태)도 함께 검증하도록 강화했다.

### Phase E 연결 시 참고사항 갱신
- `bloggerInfo.lastError`에 "로컬 저장 실패로 인한 불일치" 케이스가 별도로 표시되므로, Phase E 통계/전체 검수 화면에서 이 필드를 통해 "Blogger와 실제 동기화가 어긋난 글" 목록을 만들 수 있다.
- 상태값 마이그레이션이 archive-module.js 한 곳에 있으므로, Phase E에서 통계를 낼 때는 항상 `ArchiveModule.loadPosts()`를 거친 `cachedPosts` 기준으로 집계하면 레거시 상태값 문제가 없다.

## Phase D (0.0.4) - 2026-07-06

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Blogger Module | js/blogger-module.js | Blog ID/Access Token 설정(세션 메모리 보관), 발행 전 검증, 제목·HTML·태그의 Blogger 업로드용 payload 변환, 발행대기 상태 전환, Blogger API v3 실제 업로드 호출, 성공/실패 결과 저장 | 생성 완료 |
| Schedule Module | js/schedule-module.js | 예약일시 저장(상태값 → 예약됨), 예약 취소(이전 상태 복원), 전체 예약 목록 조회, 예약 시간 경과 여부 판별 | 생성 완료 |

### Phase C image/seo 모듈과 연결된 방식
- blogger-module.js는 seo-module.js가 저장한 `post.seoResult.result === "통과"` 조건을 발행 전 검증의 핵심 게이트로 그대로 사용한다(별도 재계산 없음).
- blogger-module.js는 image-module.js가 관리하는 `post.imageList`를 읽어 dataUrl 형식 이미지 여부만 확인하고, HTML 본문에는 자동 삽입하지 않는다(이미지 자체 업로드는 이번 Phase 범위 밖).
- blogger-module.js의 업로드 payload 생성 시 preview-module.js의 `sanitizeHtml()`을 재사용하여 금지 태그/인라인 이벤트가 제거된 HTML을 Blogger에 전송한다.
- blogger-module.js, schedule-module.js 모두 image/seo 모듈과 동일한 패턴(`loadPost()`/`getCurrentPost()` + `StorageModule.savePost()` + `ArchiveModule.loadPosts()`)을 따른다.

### Phase E 통계/전체 검수와 연결할 준비사항
- 각 글에 `bloggerInfo`(업로드 성공/실패, publishedUrl, publishedAt)와 `scheduleInfo`(예약일시, 취소 여부)가 필드로 준비되어 있어, Phase E 통계 모듈이 발행 성공률/예약 준수율 등을 별도 구조 변경 없이 집계할 수 있다.
- ErrorLogModule에 기록되는 Blogger/예약발행 오류가 이미 module 필드(`blogger-module`, `schedule-module`)로 구분되어 있어, 전체 검수(오류 현황판) 화면에서 모듈별 집계가 바로 가능하다.
- 상태값 전이(검수중→발행대기→발행완료/예약됨)가 모두 한 곳(각 모듈의 저장 함수)에서 이루어지므로, Phase E에서 상태값 기준 통계를 낼 때 정합성이 보장된다.

## Phase C (0.0.3) - 2026-07-06

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| Image Module | js/image-module.js | 썸네일/본문 이미지 선택 및 dataUrl(base64) 저장, ALT 태그 입력, 이미지 삭제, article.imageList 관리 | 생성 완료 |
| SEO Module | js/seo-module.js | 제목/메타설명 길이, H2/H3 구조, 이미지 ALT 누락, 이미지 개수, FAQ 여부, 태그 개수, 내부/외부링크 개수 점검 후 article.seoResult 저장 | 생성 완료 |

### preview-module.js와 연결 방식
- preview-module.js의 `renderPreview()`가 글 데이터의 `imageList`에서 `type: "thumbnail"`인 이미지를 찾아 본문 상단에 표시하고, `type: "body"`인 이미지 목록을 별도 영역에 표시하도록 반환값에 `thumbnail`, `bodyImages`를 추가했다.
- HTML 본문 자체에는 이미지를 자동 삽입하지 않으며, 이미지 자동 배치는 이번 Phase 범위 밖이다.

### Phase B 조건부 보정
- gpt-upload-module.js의 기본 상태값을 영어 "draft"에서 한국어 "작성중"으로 수정했다.
- 자료실 상태 필터(index.html)를 한국어 상태값(작성중/검수중/발행대기/예약됨/발행완료/보류/오류) 기준으로 갱신했다.
- 기존에 "draft"로 저장된 데이터는 자동 변환되지 않으며, 상태 필터에서 별도로 노출되지 않을 수 있다(알려진 문제 참고).

### Phase D에서 Blogger 업로드와 연결할 준비사항
- `seoResult.result`가 "통과"인 글만 발행 대상으로 필터링하는 방식으로 Blogger 연동 전 검증 단계를 구성할 수 있음
- 상태값에 이미 "발행대기", "예약됨", "발행완료" 등 Blogger/예약발행 흐름에 대응하는 값이 준비되어 있어, Phase D에서 실제 발행 로직과 상태 전이만 연결하면 됨
- `imageList`의 dataUrl은 Blogger 업로드 시 실제 이미지 업로드 API로 변환하는 별도 로직이 필요함 (이번 Phase에서는 브라우저 내부 저장 형태로만 존재)

## Phase B (0.0.2) - 2026-07-06

### 진행 방향 변경 안내
Phase B는 최초 "GPT 작업실 붙여넣기" 방향으로 진행되다 중단되었고,
"GPT 결과물 파일 업로드" 방향으로 새로 재작성되었습니다.
붙여넣기 방향에서 사용하던 gpt-workspace-module.js와 관련 UI(작업실 입력 폼)는
이번 결과물에 포함되지 않습니다.

또한 애초 계획했던 ZIP 업로드 방식은 ZIP 파싱에 필요한 외부 라이브러리(JSZip)를
실제 파일로 확보할 수 없어 이번 Phase에서 보류되었고,
metadata.json / content.html / content.md / content.txt 개별 파일 업로드 방식으로 축소되었습니다.

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| GPT Upload Module | js/gpt-upload-module.js | metadata.json/HTML/Markdown/TXT 개별 파일 인식, 글 데이터 구성, 자료실 저장 | 생성 완료 |
| Preview Module | js/preview-module.js | HTML 본문 보안 필터링(금지 태그/인라인 이벤트 제거) 및 HTML/Markdown/TXT 미리보기 렌더링 | 생성 완료 |

### Phase A storage/archive/backup과 연결된 방식
- gpt-upload-module.js는 인식된 파일로 글 데이터를 구성한 뒤 Phase A의 `StorageModule.savePost()`를 그대로 호출하여 저장한다.
- 저장 후 `ArchiveModule.loadPosts()`로 자료실 목록을 갱신하며, 자료실 화면에서 정상적으로 조회/검색/필터/삭제가 가능하다.
- 백업(backup-module.js)의 JSON 전체 내보내기/가져오기 구조는 변경 없이 유지되며, 업로드 기능과는 별개로 동작한다.
- 글 데이터 구조는 Phase A의 9개 필드를 그대로 유지하며 metaDescription, tags, faqList, sourcePackageName, importedAt 5개 필드만 추가되었다(필드명 변경 없음).

### Phase C image/seo 모듈과 연결할 준비사항
- 글 데이터의 `imageList`, `seoResult` 필드가 이미 존재하므로 image-module, seo-module 연결 시 필드 재정의 없이 값만 채우면 됨
- metadata.json의 imageList 필드를 그대로 받아오는 구조라, Phase C에서 이미지 파일 자체를 다루는 기능을 얹기 용이함
- ZIP 업로드 기능이 필요해지면 Phase C 이후 별도 모듈(zip 파싱 전용)로 재설계 예정이며, 그 경우에도 자료실 저장은 gpt-upload-module.js가 사용하는 것과 동일한 `StorageModule.savePost()` 경로를 따르게 설계하면 연결이 쉬움

## Phase A (0.0.1) - 2026-07-06

| 모듈 | 파일 | 역할 | 상태 |
|---|---|---|---|
| App Core | js/app-core.js | 화면 전환, 공통 렌더링, 이벤트 바인딩, 앱 초기화 | 생성 완료 |
| Storage Module | js/storage-module.js | IndexedDB 우선 저장, localStorage fallback | 생성 완료 |
| Archive Module | js/archive-module.js | 저장글 목록 조회, 검색, 필터, 삭제, 개별 내보내기 | 생성 완료 |
| Backup Module | js/backup-module.js | 전체 데이터 JSON 백업/복구, 개별 글 내보내기 | 생성 완료 |
| Error Log Module | js/error-log-module.js | 오류 기록, 조회, 사용자 메시지 제공 | 생성 완료 |

## 생성하지 않은 모듈 (금지 목록)
- gpt-workspace-module.js (붙여넣기 방향, Phase B 재제작 과정에서 폐기됨)
- image-module.js (Phase C에서 생성됨)
- seo-module.js (Phase C에서 생성됨)
- blogger-module.js (Phase D에서 생성됨)
- schedule-module.js (Phase D에서 생성됨)
- statistics-module.js

## Phase E 연결 예정 모듈 (참고용, 미생성)
- statistics-module.js: 통계
- zip-import-module.js(가칭): ZIP 업로드/파싱 전용, 외부 라이브러리 확보 후 별도 설계 예정
