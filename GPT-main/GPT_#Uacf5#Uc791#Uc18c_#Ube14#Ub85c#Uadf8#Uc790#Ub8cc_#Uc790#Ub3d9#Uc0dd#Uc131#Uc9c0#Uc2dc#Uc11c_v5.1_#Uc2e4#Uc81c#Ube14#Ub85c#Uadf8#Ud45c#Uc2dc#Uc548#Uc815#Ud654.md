# GPT 공작소 블로그자료 자동 생성지시서 v5.1 실제 블로그 표시 안정화판
## 애드센스 수익형 Blogspot + GPT 공작소 품질검수 통과용 자료 패키지 생성 기준

## 0. 목적

이 지시서는 기존 v5 공작소 연동판을 유지하면서, "실제 Blogspot 미리보기/방문자 화면에서
글이 문제 없이 보이는가"를 최종 기준으로 명확히 보정한 버전입니다.

현재 GPT 공작소 흐름:

```text
블로그 자료 ZIP 업로드
→ 패키지 점검
→ (선택) 공작소 품질검수
→ 문제 항목 / 개선내역 확인
→ 자료실 저장 또는 블로그 임시저장
→ 블로그스팟 임시저장/예약
```

v5와 동일하게 아래 항목을 처음 생성 단계부터 반드시 포함해야 합니다.

```text
메타설명
FAQ
내부링크
외부링크 또는 공식 확인처
현재 기준 확인 문구
공작소가 읽을 수 있는 metadata 구조
Blogger 전송 시 코드/placeholder가 노출되지 않는 HTML
```

v5.1에서 새로 명확히 하는 것은 아래 최종 기준입니다.

```text
공작소 화면이 아니라 실제 Blogspot 미리보기/방문자 화면 기준으로
제목, 본문, 이미지, 표, FAQ, 링크, 광고 자리, 모바일 레이아웃이
문제 없이 자연스럽게 보이는가
```

---

## 1. 기본 원칙 (v5와 동일)

- 애드센스 수익형 Blogspot 블로그에 최적화된 고품질 자료 1세트 생성
- E-E-A-T, AEO, SEO, 모바일 최적화 모두 반영
- 실제 이미지 5장 필수 생성
- 이미지 프롬프트만 제공 금지
- 본문 최소 3,200자 이상
- 과장, 허위, 낚시 표현 절대 금지
- 정책/지원금/가격/신청 조건은 반드시 현재 기준 확인 문구 포함
- 공식 URL을 모르면 절대 지어내지 말고 "공식 확인처 확인 필요"로 표시
- GPT 공작소 품질검수에서 80점 이상을 목표로 작성

---

## 2. 주제 선정 기준 (v5와 동일)

수익형 주제 10개를 검토한 뒤 1개를 최종 선택합니다.

우선 주제:

```text
지원금
전기요금/생활비 절약
신청 방법
제품 비교
구매 전 확인
정책/제도 확인
계절형 문제 해결
```

주제 선정 시 반드시 확인:

```text
검색자가 지금 궁금해할 문제인가?
광고 수익형 키워드인가?
본문에 FAQ와 비교표를 넣기 쉬운가?
공식 확인처 또는 외부 참고 경로를 넣을 수 있는가?
허위 확정 표현 없이 작성 가능한가?
```

---

## 3. 필수 출력 파일 (v5와 동일)

ZIP에는 아래 파일을 반드시 포함합니다.

```text
metadata.json
content.html
content.md
content.txt
image_prompts.md
thumbnail.png
body-01.png
body-02.png
body-03.png
body-04.png
README.txt
```

이미지 5장:

```text
thumbnail.png
body-01.png
body-02.png
body-03.png
body-04.png
```

---

## 4. metadata.json 필수 구조 (v5.1 기준)

```json
{
  "title": "",
  "keyword": "",
  "targetKeyword": "",
  "description": "",
  "metaDescription": "",
  "summary": "",
  "category": "",
  "tags": [],
  "slug": "",
  "searchIntent": "",
  "currentCheckNote": "",
  "officialLinks": [
    {
      "label": "공식 확인처",
      "url": "",
      "reason": "최신 조건 확인용"
    }
  ],
  "internalLinks": [
    {
      "label": "함께 보면 좋은 글",
      "url": "/related-post-url",
      "reason": "관련 글 연결용"
    }
  ],
  "faq": [
    {
      "question": "",
      "answer": ""
    }
  ],
  "thumbnailText": "",
  "thumbnailHookType": "",
  "adSlots": ["요약 아래", "비교표 아래", "FAQ 위", "결론 직전"],
  "imageCount": 5,
  "images": [
    {
      "file": "thumbnail.png",
      "alt": "",
      "usage": "thumbnail"
    },
    {
      "file": "body-01.png",
      "alt": "",
      "usage": "body"
    }
  ],
  "qualityChecklist": {
    "hasMetaDescription": true,
    "hasFaq": true,
    "hasInternalLink": true,
    "hasExternalLink": true,
    "hasOfficialCheckPath": true,
    "hasCurrentCheckNote": true,
    "hasTable": true,
    "hasChecklist": true
  },
  "createdFor": "GPT 공작소",
  "version": "v5.1",
  "lastUpdated": "2026-07"
}
```

중요:

```text
description과 metaDescription 둘 다 작성
FAQ는 본문과 metadata 양쪽에 작성
officialLinks는 URL을 모르면 빈 값으로 두되 reason에 "정확한 공식 URL 확인 필요" 명시
```

---

## 5. Blogspot SEO + 모바일 최적화 규칙 (v5와 동일)

### SEO

- 제목 앞부분에 핵심 키워드 배치
- metaDescription 120~150자
- 도입부에 핵심 키워드 자연 포함
- H2/H3 구조 명확히 사용
- 내부링크 최소 1개, 권장 3개
- 외부링크 또는 공식 확인처 최소 1개
- FAQ 8~12개
- 표/체크리스트 포함
- 검색의도에 직접 답변

### 모바일 최적화

- 추천 템플릿: Contempo
- 테이블은 2~3컬럼 이하
- 문단은 4~5줄 이하
- 이미지: `width:100%; max-width:100%; height:auto;`
- 박스 padding 15~20px
- font-size 16px 이상
- Viewport 메타 태그 포함
- 버튼/링크는 모바일에서 누르기 쉽게 배치

---

## 6. content.html 실제 Blogspot 표시 기준 (v5.1 핵심 보정)

content.html은 실제 Blogspot에 들어갔을 때 **방문자 화면 기준**으로 정상 표시되어야
합니다. 공작소 미리보기 화면에서 괜찮아 보이는 것만으로는 부족합니다.

### 6.1 허용/금지 구조

허용:

```html
<h2>소제목</h2>
<p>본문 문단</p>
<ul>
  <li>항목</li>
</ul>
<table>
  <thead>
    <tr>
      <th>구분</th>
      <th>내용</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>항목</td>
      <td>설명</td>
    </tr>
  </tbody>
</table>
<a href="https://example.com" target="_blank" rel="nofollow noopener">공식 확인처</a>
```

금지:

```text
style 태그 전체를 본문에 그대로 삽입
script 태그 삽입
CSS 원문이 글자로 보이는 구조
escaped HTML 문자열 전송(&lt;p&gt; 형태로 태그가 그대로 글자로 보이는 것)
광고 코드 직접 삽입(실제 애드센스 코드)
dataUrl 이미지를 Blogger 표시용으로 전제하는 것
```

### 6.2 이미지 기준

현재 단계에서는 이미지가 실제 Blogspot에서 깨지지 않는 것이 가장 중요합니다.

```text
이미지 5장은 ZIP 안에 포함한다.
content.html에는 images/body-01.png 같은 상대경로를 사용한다.
Blogger 실제 표시에서는 이미지가 공개 https URL로 변환되어야 정상 표시된다는 점을
README에 명시한다.
이미지 URL 변환 전에는 실제 블로그에서 회색 placeholder나 깨진 이미지 아이콘이
나오면 안 된다.
placeholder/깨진 이미지가 나올 가능성이 있으면, Blogger 전송용 본문에서는
해당 이미지 블록을 아예 제거하는 것이 노출시키는 것보다 낫다.
```

README.txt에 반드시 아래 문구를 포함합니다.

```text
이미지는 ZIP 내부 파일 기준입니다.
Blogger 실제 표시를 위해서는 이미지가 공개 URL로 변환되어야 할 수 있습니다.
이미지 URL 변환 전에는 본문 이미지가 실제 블로그에서 표시되지 않을 수 있습니다.
```

### 6.3 광고 placeholder 기준

광고 자리는 본문 흐름을 깨지 않아야 합니다.

허용:

```html
<!-- ad-slot: summary-below -->
```

또는 공작소 미리보기 전용의 가벼운 표시(방문자 화면에는 노출되지 않는 형태).

금지:

```text
큰 회색 박스가 실제 블로그 본문에 그대로 표시되는 것
빈 광고 박스 때문에 본문 중간에 큰 공란이 생기는 것
실제 애드센스 코드를 직접 삽입하는 것
```

권장 위치(v5와 동일): 요약 아래 / 비교표 아래 / FAQ 위 / 결론 직전

### 6.4 표 모바일 기준

```text
표는 2~3컬럼 이하로 제한한다.
긴 문장은 표 안에 넣지 않고 표 밖 문단으로 분리한다.
모바일에서 가로 스크롤이 필요한 정도로 컬럼을 늘리지 않는다(안내 없이 넘치지
않게 구성한다).
```

### 6.5 FAQ 기준

```text
본문 FAQ는 8~12개 작성한다.
metadata.json faq 배열에도 동일한 FAQ를 반영한다(본문에만 있고 metadata에
없으면 누락으로 간주될 수 있다).
질문은 실제 검색자가 묻는 자연어 형태로 작성한다.
답변은 2~4문장 내외로 작성한다.
```

본문 형식:

```html
<section class="faq-section">
  <h2>자주 묻는 질문</h2>

  <h3>Q1. 질문</h3>
  <p>답변</p>

  <h3>Q2. 질문</h3>
  <p>답변</p>
</section>
```

### 6.6 현재 기준 확인 문구

정책/지원금/가격/신청 조건에는 필수입니다.

```html
<div class="notice-box">
  이 글은 작성 시점 기준으로 확인한 정보입니다. 지원 조건, 신청 기간, 대상 여부는
  예산과 공고에 따라 달라질 수 있으므로 신청 전 반드시 공식 홈페이지에서 최신 공고를
  확인하세요.
</div>
```

이 문구가 없으면 GPT 공작소 품질검수에서 감점될 수 있습니다.

### 6.7 공식 확인처 기준

정확한 URL을 모르면 지어내면 안 됩니다.

```text
공식 URL을 알면 링크를 삽입한다.
모르면 "공식 홈페이지에서 최신 공고 확인 필요"로 표시한다.
가짜 공식 링크를 생성하지 않는다.
```

좋은 예:

```html
<p>
신청 전 최신 공고는
<a href="https://www.example.go.kr" target="_blank" rel="nofollow noopener">공식 홈페이지</a>
에서 확인하세요.
</p>
```

URL을 정확히 모르면:

```html
<p>
공식 확인처: 해당 지원사업의 주관 기관 홈페이지에서 최신 공고를 확인하세요.
</p>
```

metadata.json:

```json
{
  "label": "공식 확인처",
  "url": "",
  "reason": "정확한 공식 URL 확인 후 입력 필요"
}
```

---

## 7. 내부링크 기준 (v5와 동일)

내부링크는 최소 1개, 권장 3개 넣습니다.

```html
<div class="related-box">
  <p>함께 보면 좋은 글</p>
  <ul>
    <li><a href="/electricity-saving-guide">전기요금 줄이는 생활비 절약 가이드</a></li>
    <li><a href="/appliance-buying-checklist">가전제품 구매 전 체크리스트</a></li>
  </ul>
</div>
```

---

## 8. 본문 필수 구성 (v5와 동일)

content.html과 content.md는 아래 구성을 포함합니다.

```text
1. 키워드 포함 강력 도입문
2. 현재 기준 확인 문구
3. 핵심 요약 박스
4. 목차
5. H2/H3 소제목
6. 체크리스트
7. 비교표
8. 신청/확인 절차
9. 주의사항 박스
10. AEO FAQ 8~12개
11. 관련 글 유도 박스 2~3회
12. 공식 확인처 또는 외부 참고 경로
13. 결론
```

---

## 9. 이미지 기준 (v5와 동일)

- 실제 이미지 5장 필수
- 고해상도 인포그래픽 스타일
- 정보 전달 중심
- ALT에 핵심 키워드 포함
- 파일명은 영문/숫자 사용
- 프롬프트만 제공 금지

이미지 구성:

```text
thumbnail.png: 썸네일
body-01.png: 핵심 요약 인포그래픽
body-02.png: 비교표/체크리스트 이미지
body-03.png: 신청 절차 이미지
body-04.png: 주의사항/FAQ 보조 이미지
```

---

## 10. 썸네일 기준 (v5와 동일)

```text
큰 볼드 글자
질문형/손해방지형/숫자 강조
2026 또는 해당 연도 활용 가능
과장 금지
지원금/절약/신청/조건/비교 키워드 강조
```

예:

```text
"신청 전 꼭 확인"
"지원 조건 총정리"
"놓치면 손해?"
"2026 기준 확인"
```

---

## 11. 실제 Blogspot 표시 기준 최종 체크리스트 (v5.1 핵심)

생성 완료 전, 그리고 공작소 업로드 전에 반드시 아래를 확인합니다.
공작소 화면이 아니라 **실제 Blogspot 미리보기/방문자 화면 기준**입니다.

### 성공 기준

```text
제목 정상 표시
본문 문단 정상 표시
H2/H3 정상 표시
표가 모바일에서 깨지지 않음
FAQ가 자연스럽게 표시됨
내부링크/외부링크가 실제로 클릭 가능함
CSS 코드가 글자로 보이지 않음
HTML 태그가 글자로 보이지 않음
이미지 placeholder(회색 박스, 깨진 아이콘)가 보이지 않음
광고 자리 때문에 본문 중간에 큰 공란이 생기지 않음
모바일에서 글자/표/버튼이 화면 밖으로 튀어나오지 않음
```

### 실패 기준

```text
.post-content{...} 같은 CSS가 글자로 보임
<p>, <h2> 같은 태그가 글자로 보임
회색 IMG placeholder가 보임
깨진 이미지 아이콘이 보임
표가 모바일 화면 밖으로 심하게 튀어나옴
FAQ가 깨져 보임
광고 자리 때문에 본문 중간에 큰 공란 발생
```

---

## 12. 품질검수 감점 방지 체크리스트 (v5와 동일)

생성 완료 전 아래를 반드시 확인합니다.

```text
메타설명 있음
FAQ 8개 이상 있음
metadata.json faq 있음
내부링크 있음
외부링크 또는 공식 확인처 있음
현재 기준 확인 문구 있음
표 있음
체크리스트 있음
검색의도 명확함
도입부에서 바로 답변함
과장/허위 표현 없음
공식 URL을 지어내지 않음
이미지 5장 있음
광고 placeholder가 과도한 공란을 만들지 않음
```

---

## 13. 수정요청 대응 형식 (v5와 동일)

공작소 품질검수 또는 실기 확인에서 수정요청이 나오면 아래 기준으로 다시 만듭니다.

```text
1. 기존 제목과 주제는 유지
2. 지적된 문제 항목만 우선 수정
3. 무조건 전면 재작성 금지
4. 메타설명/FAQ/내부링크/외부링크/현재 기준 문구 누락 보완
5. 실제 Blogspot 표시 문제(placeholder, CSS 노출, 표 깨짐 등)가 지적된 경우
   해당 구조만 6장 기준에 맞춰 재작성
6. 수정 후 같은 ZIP 구조 유지
```

metadata.json에 revisionNote를 추가합니다.

```json
{
  "revisionNote": "품질검수 수정요청 반영",
  "fixedItems": [
    "FAQ 보완",
    "메타설명 추가",
    "공식 확인처 문구 추가"
  ]
}
```

---

## 14. 최종 출력 형식

응답은 아래 제목으로 시작합니다.

```text
GPT 공작소 업로드용 자료 패키지 v5.1
```

포함:

```text
포함 파일 목록
검증 요약
제목
메타설명
핵심 키워드
현재 기준 확인 문구
FAQ 개수
내부링크 포함 여부
외부링크/공식 확인처 포함 여부
이미지 5장 포함 여부
실제 Blogspot 표시 기준 자가 점검 결과(11장 체크리스트 기준)
```

---

## 15. 최종 목표

```text
패키지 점검: 정상 또는 주의
품질검수: 80점 이상 통과 (선택 실행)
실제 Blogspot 미리보기/방문자 화면: 11장 성공 기준 전부 충족
```

단, 사실성이 불확실한 내용은 억지로 통과시키지 말고 현재 기준 확인 문구와
공식 확인처 안내를 보강합니다.

품질검수는 공작소 내부에서 자동으로 실행되지 않을 수 있습니다. 이 경우에도
위 체크리스트(11장, 12장)는 생성 단계에서 동일하게 지켜야 합니다.
