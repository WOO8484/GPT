# ERROR DICTIONARY

이 문서는 GPT 공작소에서 사용하는 오류 항목을 정의합니다.
오류는 `error-log-module.js`를 통해 기록되며, 아래 구조를 따릅니다.

## 오류 데이터 구조
- id: 오류 고유 ID
- module: 오류가 발생한 모듈명
- message: 오류 메시지 (사용자 노출용)
- detail: 상세 오류 내용 (개발/디버깅용)
- relatedId: 관련 데이터 ID (있는 경우)
- createdAt: 발생 시각 (ISO 8601)
- resolved: 해결 여부 (boolean)

## 기본 오류 항목 (Phase A)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| 저장소 초기화 실패 | 앱 시작 시 저장소(IndexedDB/localStorage) 초기화에 실패한 경우 | storage-module |
| IndexedDB 접근 실패 | IndexedDB 오픈 또는 트랜잭션 처리 중 오류가 발생한 경우 | storage-module |
| localStorage fallback 전환 | IndexedDB 사용 불가로 localStorage로 전환된 경우 | storage-module |
| JSON 가져오기 실패 | 백업 JSON 파일 파싱 또는 적용 중 오류가 발생한 경우 | backup-module |
| 데이터 구조 불일치 | 가져온 데이터 또는 저장된 데이터가 정의된 글 구조와 다른 경우 | backup-module, storage-module |
| 자료실 목록 렌더링 실패 | 자료실 목록을 불러오거나 화면에 표시하는 중 오류가 발생한 경우 | archive-module |

## GPT 결과물 업로드 오류 항목 (Phase B)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| metadata.json 파싱 실패 | 선택한 metadata.json 파일의 JSON 형식이 올바르지 않은 경우 | gpt-upload-module |
| content.html 누락 | HTML/Markdown/TXT 중 인식된 본문이 하나도 없어 저장할 내용이 없는 경우 | gpt-upload-module |
| HTML 파일 인식 실패 | content.html 파일을 읽는 중 오류가 발생한 경우 | gpt-upload-module |
| Markdown 파일 인식 실패 | content.md 파일을 읽는 중 오류가 발생한 경우 | gpt-upload-module |
| TXT 파일 인식 실패 | content.txt 파일을 읽는 중 오류가 발생한 경우 | gpt-upload-module |
| 자료실 저장 실패 | 인식된 파일을 자료실(저장소)에 저장하는 중 오류가 발생한 경우 | gpt-upload-module |
| 미리보기 렌더링 실패 | 미리보기 화면에 글 데이터를 표시하는 중 오류가 발생한 경우 | preview-module |
| HTML 보안 필터링 실패 | HTML 본문의 금지 태그/인라인 이벤트 제거 처리 중 오류가 발생한 경우 | preview-module |

## 이미지/SEO 오류 항목 (Phase C)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| 이미지 파일 읽기 실패 | 이미지 관리 화면에서 선택한 파일이 없거나 읽을 수 없는 경우 | image-module |
| 이미지 dataUrl 생성 실패 | 이미지 파일을 dataUrl로 변환하는 중 오류가 발생한 경우 | image-module |
| imageList 저장 실패 | 이미지 목록을 글 데이터에 저장하는 중 오류가 발생한 경우 | image-module |
| SEO 검수 실패 | 현재 글 정보가 없거나 검수 로직 실행 중 오류가 발생한 경우 | seo-module |
| HTML heading 파싱 실패 | SEO 검수를 위해 HTML 본문을 파싱하는 중 오류가 발생한 경우 | seo-module |
| SEO 결과 저장 실패 | 검수 결과(seoResult)를 글 데이터에 저장하는 중 오류가 발생한 경우 | seo-module |
| 미리보기 이미지 표시 실패 | 미리보기 화면에서 썸네일/본문 이미지 데이터를 표시하는 중 오류가 발생한 경우 | preview-module |

참고: ALT 태그 누락은 오류로 기록하지 않고, SEO 검수 결과(issues)에 점검 항목으로만 표시됩니다.

## Blogger 업로드/예약발행 오류 항목 (Phase D)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| Blogger 설정값 누락 | 설정 저장 시도 시 Blog ID와 Access Token이 모두 비어 있는 경우 | blogger-module |
| Access Token 누락 | 설정 저장 또는 업로드 시도 시 Access Token이 없는 경우 | blogger-module |
| Blog ID 누락 | 설정 저장 또는 업로드 시도 시 Blog ID가 없는 경우 | blogger-module |
| SEO 미통과 상태에서 발행 시도 | seoResult.result가 "통과"가 아닌 상태에서 발행대기 전환 또는 업로드를 시도한 경우 | blogger-module |
| HTML 본문 누락 | 업로드 시도 시 htmlContent가 비어 있는 경우 | blogger-module |
| Blogger 응답 파싱 실패 | Blogger API 응답 본문을 JSON으로 해석하는 중 오류가 발생한 경우 | blogger-module |
| 발행 결과 저장 실패 | 발행대기 전환, 예약 저장/취소 결과를 글 데이터에 저장하는 중 오류가 발생한 경우 (Blogger 업로드 성공 후 저장 실패는 별도 항목 참고) | blogger-module, schedule-module |
| dataUrl 이미지 변환 필요 | imageList에 dataUrl 형식 이미지가 포함된 상태로 업로드를 시도한 경우(업로드 자체는 계속 진행됨) | blogger-module |
| 예약일시 누락 | 예약 저장 시도 시 예약일시 입력값이 없는 경우 | schedule-module |
| 예약일시 형식 오류 | 입력한 예약일시를 날짜로 해석할 수 없는 경우 | schedule-module |
| 예약 취소 실패 | 취소할 예약 정보가 없거나 취소 결과 저장 중 오류가 발생한 경우 | schedule-module |
| 예약 목록 조회 실패 | 전체 예약 목록을 저장소에서 불러오는 중 오류가 발생한 경우 | schedule-module |

참고: Blogger 업로드/예약 저장 실패 시에도 글의 상태값과 이전 데이터는 되돌려지며, 실패 자체는 오류 이력에 기록됩니다.

> **repair1 안내**: 위 Phase D 항목 중 "Blogger 설정값 누락", "Access Token 누락", "Blog ID 누락"은 브라우저에서 Blog ID/Access Token을 직접 입력받아 Google Blogger API를 호출하던 방식(0.0.6 repair1 이전)에서 발생하던 오류입니다. 0.0.6 repair1부터는 Worker 기반 로그인/세션 방식으로 대체되어 더 이상 발생하지 않으며, 과거 이력 확인용으로만 남겨둡니다.

## Repair 1 오류 항목 (Phase D Repair 1)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| 임시저장 업로드 실패 | "임시저장으로 업로드"(isDraft=true) 호출이 네트워크 오류 또는 비정상(OK 아닌) 응답으로 실패한 경우 | blogger-module |
| 실제 발행 실패 | "발행하기"(실제 공개) 호출이 네트워크 오류 또는 비정상(OK 아닌) 응답으로 실패한 경우 | blogger-module |
| Blogger 업로드 성공 후 로컬 저장 실패 | Blogger API 호출은 성공했지만 그 결과를 글 데이터에 저장하는 중 오류가 발생하여 자료실 데이터와 실제 Blogger 상태가 다를 수 있는 경우 | blogger-module |
| 발행 전 사용자 확인 취소 | "발행하기" 실행 전 확인 팝업에서 사용자가 취소를 선택한 경우 | blogger-module |
| 예약 조건 미충족 | 예약 저장 시도 시 제목/HTML 본문/SEO 통과/상태값(발행대기 또는 검수중) 중 하나 이상을 만족하지 못한 경우 | schedule-module |
| 예약 전 사용자 확인 취소 | 예약 저장 실행 전 확인 팝업에서 사용자가 취소를 선택한 경우 | schedule-module |
| 기존 영어 상태값 마이그레이션 실패 | 자료실 로딩 시 레거시 영어 상태값(draft/published/scheduled/error)을 한국어로 보정하여 저장하는 중 오류가 발생한 경우(글 단위로 개별 처리되며, 한 건 실패가 나머지 항목 처리를 막지 않음) | archive-module |

> **repair1 안내**: 위 항목 중 "실제 발행 실패", "발행 전 사용자 확인 취소"는 즉시 공개(실제 발행) 기능이 있던 시절의 오류입니다. 0.0.6 repair1의 Worker에는 실제 발행 경로가 없어 해당 기능 자체를 제공하지 않으며(블로그 임시 저장/예약 저장만 제공), 과거 이력 확인용으로만 남겨둡니다. "예약 조건 미충족"의 허용 상태값은 repair1부터 "등록완료", "임시저장완료"가 추가되었습니다(자세한 내용은 docs/CHANGELOG.md 0.0.6 repair1 항목 참고).

참고(코드로 자동 기록되지 않는 항목 - QA/시각적 확인 대상):
- 기본 화면 고정 레이아웃 깨짐: 헤더/하단 네비가 고정되지 않거나 전체 페이지가 스크롤되는 경우. 레이아웃 문제이므로 error-log-module에 자동 기록되지 않으며, 화면 확인으로 발견합니다.
- 내부 스크롤 영역 렌더링 실패: 자료실 목록/이미지 목록/SEO 문제 목록/예약 목록/오류 목록/상세 패널 등 지정된 영역이 내부 스크롤되지 않고 잘리거나 전체 스크롤을 유발하는 경우. 마찬가지로 화면 확인으로 발견합니다.

## Phase E 오류 항목 (통계/전체 점검)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| 통계 계산 실패 | 통계 화면에서 전체 글 데이터를 집계하는 중 오류가 발생한 경우 | statistics-module |
| 전체 점검 실패 | 전체 점검 실행 중 데이터 조회/집계 자체가 실패한 경우 | statistics-module |
| 상태값 영어 잔재 발견 | 전체 점검 중 레거시 영어 상태값(draft/published/scheduled/error)이 남아있는 글을 발견한 경우 | statistics-module |
| dataUrl 이미지 미변환 항목 발견 | 전체 점검 중 dataUrl 형식 이미지가 포함된 글을 발견한 경우 | statistics-module |
| Blogger 상태 불일치 발견 | 전체 점검 중 bloggerInfo.lastError가 기록된(업로드 성공/저장 불일치 등) 글을 발견한 경우 | statistics-module |
| 예약 상태 불일치 발견 | 전체 점검 중 status와 scheduleInfo(예약일시/취소여부)가 서로 맞지 않는 글을 발견한 경우 | statistics-module |

참고(코드로 자동 기록되지 않는 항목 - QA/시각적 확인 또는 정보 표시 대상):
- 고정 화면 레이아웃 깨짐: 헤더/하단 네비가 고정되지 않거나 전체 페이지가 스크롤되는 경우. 화면 확인으로 발견합니다.
- 내부 스크롤 영역 초과: 지정된 목록/본문 영역(자료실 목록·이미지 목록·SEO 문제 목록·예약 목록·통계 목록·오류 목록·상세 패널 등)이 내부 스크롤 대신 화면을 밀어내거나 잘리는 경우. 화면 확인으로 발견합니다.
- 제한사항 확인 필요: 전체 점검 화면의 "현재 제한사항 안내" 항목 자체를 가리키는 안내성 문구이며, 매 점검마다 자동으로 오류 이력에 기록되지는 않습니다. 상세 내용은 docs/KNOWN_LIMITATIONS.md를 참고합니다.

## Final Repair 1 오류 항목 (업로드 파일 선택)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| 업로드 파일 accept 설정 오류 | 파일 선택 input의 accept 속성이 실제 허용해야 할 확장자/MIME 목록과 일치하지 않아 특정 파일이 선택되지 않는 경우 | gpt-upload-module |
| HTML 파일 선택 불가 | content.html 선택 영역에서 accept 속성 오류로 인해 .html(.htm 포함) 파일을 선택할 수 없는 경우 | gpt-upload-module |
| Markdown 파일 선택 불가 | content.md 선택 영역에서 accept 속성 오류로 인해 .md(.markdown 포함) 파일을 선택할 수 없는 경우 | gpt-upload-module |
| TXT 파일 선택 불가 | content.txt 선택 영역에서 accept 속성 오류로 인해 .txt 파일을 선택할 수 없는 경우 | gpt-upload-module |
| 업로드 파일 인식 결과 불일치 | 파일을 선택했음에도 인식 결과 목록(인식됨/없음)이 실제 선택 상태와 다르게 표시되는 경우 | gpt-upload-module |

참고(코드 예외가 아닌 입력 속성/화면 확인 대상): 위 항목은 JS 런타임 오류가 아니라 index.html의 input accept 속성 설정 문제로 발생하며, error-log-module에 자동 기록되지 않고 화면 확인(파일 선택 다이얼로그 테스트)으로 발견합니다. Final Repair 1에서 metadata/HTML/Markdown/TXT 4개 입력의 accept 속성을 각각 `.json,application/json` / `.html,.htm,text/html` / `.md,.markdown,text/markdown,text/plain` / `.txt,text/plain`으로 수정하고, 각 선택 영역에 선택된 파일명 표시를 추가하여 해결했습니다.

## 0.0.6 오류 항목 (ZIP 자동 업로드)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| ZIP 파일 인식 실패 | 선택한 ZIP 파일이 올바른 ZIP 구조가 아니거나 읽는 중 오류가 발생한 경우 | zip-upload-module |
| ZIP 내 metadata.json 파싱 실패 | ZIP 안의 metadata.json 파일 내용이 올바른 JSON 형식이 아닌 경우(metadata.json 없이도 저장은 계속 진행됨) | zip-upload-module |
| ZIP 글 파일 누락 | ZIP 안에서 content.html/content.md/content.txt 중 인식된 파일이 하나도 없어 저장할 내용이 없는 경우 | zip-upload-module |
| ZIP 자료실 저장 실패 | 인식된 ZIP 내용을 자료실(저장소)에 저장하는 중 오류가 발생한 경우 | zip-upload-module |

참고: ZIP 안의 `__MACOSX/`, `.DS_Store`, 숨김 파일, 폴더, 지원하지 않는 확장자는 오류로 기록하지 않고 조용히 건너뜁니다. 썸네일/본문 이미지 후보가 여러 개인 경우 우선순위(png→jpg→jpeg→webp)로 1개만 선택하며, 이 또한 오류가 아닙니다.

## 0.0.6 repair1 오류 항목 (암호 로그인 + Blogger Worker 연동)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| 로그인 실패 | 입력한 비밀번호로 Worker `/auth/login` 호출 결과가 실패(정상 응답이 아니거나 토큰 없음)로 온 경우 | auth-module |
| 로그인 연결 오류 | 로그인 시도 중 네트워크 오류로 Worker에 연결하지 못한 경우 | auth-module |
| 세션 저장 실패 | 로그인 성공 후 세션 토큰을 sessionStorage에 저장하는 중 오류가 발생한 경우 | auth-module |
| Blogger 상태 확인 실패 | Worker `/blogger/status` 호출이 네트워크 오류 또는 비정상 응답으로 실패한 경우 | blogger-module |
| 블로그 임시저장 조건 미충족 | 임시저장 시도 시 제목/HTML 본문/SEO 통과/상태값 중 하나 이상을 만족하지 못한 경우 | blogger-module |
| 임시저장 업로드 실패 | Worker `/blogger/draft` 호출이 네트워크 오류 또는 비정상 응답으로 실패한 경우 | blogger-module |
| ZIP 검증 실패 | 등록하기 팝업의 [검증하기] 실행 시 필수 파일/이미지 8종 중 하나 이상이 인식되지 않은 경우(구조 검증 실패, 저장 불가) | zip-upload-module |
| 검증 전 저장 시도 | 등록하기 팝업에서 검증하기를 통과하지 않은 상태로 저장이 호출된 경우(정상 사용 흐름에서는 발생하지 않으며, 방어 로직으로만 기록됨) | zip-upload-module |

참고: 401(세션 만료/미인증) 응답은 오류 이력에 별도로 기록하지 않고, 즉시 로그인 화면으로 전환하는 것으로 처리합니다. Worker 연결 자체가 안 되는 경우(네트워크 오류)는 위 표의 각 실패 항목으로 기록됩니다.

## 0.0.7 오류 항목 (Gemini 품질검수)

| 오류 메시지 | 발생 상황 | 관련 모듈 |
|---|---|---|
| Gemini API 호출 실패 | 품질검수 요청(Worker `/gemini/review` 호출)이 네트워크 오류 또는 비정상 응답으로 실패한 경우 | gemini-review-module |
| Gemini 응답 파싱 실패 | Gemini/Worker 응답을 정해진 JSON 형식(status/score/summary/issues/rewriteRequest)으로 해석할 수 없는 경우 | gemini-review-module |

참고: 위 두 오류는 자료실 저장/삭제, ZIP 등록, 블로그 등록 기능에 영향을 주지 않으며, 실패 시에도 저장된 글 데이터는 그대로 유지됩니다. 401(세션 만료)은 기존과 동일하게 `callWorker()`가 즉시 로그인 화면 전환으로 처리하며 별도 오류로 기록하지 않습니다.

## 향후 확장 예정 (Phase E 이후)
- 서버/Worker 기반 자동 예약발행 관련 오류 (여전히 보류 상태)
