# CHANGELOG

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
