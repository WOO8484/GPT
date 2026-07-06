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

## 향후 확장 예정 (Phase E 이후)
- ZIP 파일 업로드/파싱 관련 오류 (여전히 보류 상태)
- 서버/Worker 기반 자동 예약발행 관련 오류 (여전히 보류 상태)
