# CHANGELOG

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
