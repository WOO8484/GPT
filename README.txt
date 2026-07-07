GPT 공작소 Lite v1.0
====================

구성 (4모듈)
1. 로그인            - 기존 Cloudflare Worker /auth/login 세션 로그인 그대로 사용
2. 업로드 - 미리보기  - 블로그자료 ZIP 업로드 → metadata.json/content.html 읽기 → 본문 미리보기
3. 자료실 / 게시판    - 업로드한 글 목록 (브라우저 IndexedDB, 실패 시 localStorage)
4. 저장               - 자료실 글 선택 → ZIP 내부 이미지 R2 업로드 → img src를 R2 HTTPS URL로 교체
                        → Blogger 임시저장(/blogger/draft)

설치 방법
- 이 ZIP의 압축을 풀면 나오는 index.html / css / js / version.json 을 그대로
  GitHub Pages 저장소 루트에 덮어씁니다(상위 폴더를 한 번 더 만들지 않습니다).

실기 확인 순서
1. 로그인 (기존 암호)
2. 업로드 탭에서 블로그자료 ZIP 선택 → 체크리스트/미리보기 확인 → "자료실에 저장"
3. 자료실 탭에서 방금 저장한 글 선택 → 미리보기 팝업에서 "저장 모듈로 이동"
4. 저장 탭에서 "Blogger 임시저장 시작" → 진행 상태(1/5~5/5) 확인
5. Blogger 관리자에서 임시글 생성 여부 및 이미지 표시 확인
6. iPhone Safari / Android Chrome / PC Chrome에서 전체 페이지 스크롤 없이
   한 화면에 고정되는지, 자료실 목록·미리보기·오류 목록만 내부 스크롤되는지 확인

이미지 처리 기준
- PNG / JPG / JPEG 만 Blogger 최종 저장용으로 사용합니다.
- ZIP 내부 이미지(예: images/body-01.png)는 저장 시점에 Worker "/images/upload"로
  R2 업로드되고, 반환된 https://pub-....r2.dev/... URL로 교체됩니다.
- WEBP 이미지는 브라우저 canvas로 JPG 변환 후 업로드합니다. 변환에 실패하면
  저장을 중단하고 팝업으로 실패 이미지를 안내합니다(실패를 성공으로 처리하지 않음).
- 이미 https/http로 시작하는 이미지 URL은 그대로 유지합니다(WEBP 확장자면 경고만 표시).
- 최종 Blogger 전송 HTML에 내부 경로(images/..., data:, blob:)가 하나라도 남으면
  저장을 중단합니다.

주의사항
- Worker 주소, R2 공개 URL, R2 바인딩 이름은 코드에 하드코딩하지 않았습니다.
  Worker 주소는 auth-module.js의 DEFAULT_WORKER_BASE_URL 기본값을 사용하며
  필요 시 localStorage(gongjakso_worker_base_url)로 덮어쓸 수 있습니다.
- Gemini 품질검수/SEO 점수/후보 판정/예약/통계/백업 화면과 조건은 포함하지 않았습니다.
  Worker 쪽에 해당 endpoint가 남아 있어도 이 웹 UI는 호출하지 않습니다.
- 자료실 데이터는 브라우저(IndexedDB/localStorage)에만 저장됩니다. 브라우저 데이터를
  지우면 자료실 목록도 함께 사라집니다(별도 서버 DB 없음).
