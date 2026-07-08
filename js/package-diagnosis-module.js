/**
 * package-diagnosis-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할: 업로드된 블로그자료(게시판에 저장된 post 객체) 구조를 진단한다.
 * - metadata.json / content.html / content.md·content.txt / images 폴더 확인
 * - 이미지 5장(썸네일 1 + 본문 4) 확인
 * - href="#" 확인
 * - table / script / style 위험 요소 확인
 * - 공식 링크(metadata.official_sources) 여부 확인
 * - v1.5(B-5, 블로그자료 생성 기준 v6.2 반영): 본문 최상단 H1 제목 중복 여부 /
 *   대표 이미지가 본문 첫 문단보다 위에 있는지 / 첫 번째 img가 대표 이미지인지 /
 *   긴 문단이 과하게 이어지는지 / 포스트잇·카드·주의 박스 등 박스형 구성
 *   요소가 있는지
 * - v1.6(14/15장): 최종 업데이트 날짜가 본문 상단 근처에 있는지 / 소제목(h2/h3)
 *   사이에 내용 없이 바로 이어지는 곳은 없는지
 *
 * 결과는 점수가 아니라 "정상 / 주의 / 수정 필요" 3단계로만 표시한다.
 * 이 진단은 품질점수나 SEO 점수가 아니라 단순 구조 진단이다.
 *
 * 이 모듈은 upload-module.js의 내부 파싱 로직을 호출하거나 수정하지 않는다.
 * GptCoreAPI.getSelectedPost()로 이미 완성된 post 객체(contentHtmlRaw/
 * imageFiles/metadata 등)를 읽기 전용으로 다시 검사할 뿐이다.
 */

const PackageDiagnosisModule = (() => {
  let bound = false;

  function isReady() {
    return bound;
  }

  function els() {
    return {
      openBtn: document.getElementById("package-diagnosis-open-btn"),
      closeBtn: document.getElementById("package-diagnosis-close-btn"),
      overlay: document.getElementById("popup-package-diagnosis-overlay"),
      emptyEl: document.getElementById("package-diagnosis-empty"),
      listEl: document.getElementById("package-diagnosis-list"),
    };
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function levelClass(level) {
    if (level === "정상") return "diagnosis-level--ok";
    if (level === "수정 필요") return "diagnosis-level--danger";
    return "diagnosis-level--warn";
  }

  function diagnose(post) {
    const items = [];
    const html = post.contentHtmlRaw || "";
    const meta = post.metadata || {};
    const imageFiles = post.imageFiles || {};

    // 1. metadata.json
    items.push(
      meta && Object.keys(meta).length
        ? { label: "metadata.json", level: "정상", detail: "확인됨" }
        : { label: "metadata.json", level: "수정 필요", detail: "없거나 비어 있습니다" }
    );

    // 2. content.html
    items.push(
      html.trim()
        ? { label: "content.html", level: "정상", detail: "확인됨" }
        : { label: "content.html", level: "수정 필요", detail: "본문 HTML이 없습니다" }
    );

    // 3. content.md / content.txt (선택 파일)
    const hasMdOrTxt = (post.contentMd && post.contentMd.trim()) || (post.contentText && post.contentText.trim());
    items.push(
      hasMdOrTxt
        ? { label: "content.md / content.txt", level: "정상", detail: "확인됨" }
        : { label: "content.md / content.txt", level: "주의", detail: "둘 다 없습니다(선택 파일)" }
    );

    // 4. images 폴더
    const imageCount = Object.keys(imageFiles).length;
    items.push(
      imageCount > 0
        ? { label: "images 폴더", level: "정상", detail: `이미지 ${imageCount}개 인식` }
        : { label: "images 폴더", level: "수정 필요", detail: "인식된 이미지가 없습니다" }
    );

    // 5. 이미지 5장(썸네일 1 + 본문 4)
    const hasThumbnail = Object.values(imageFiles).some((img) => img.role === "thumbnail");
    const bodyCount = Object.values(imageFiles).filter((img) => (img.role || "").indexOf("body-") === 0).length;
    let imgLevel = "수정 필요";
    let imgDetail = `썸네일 ${hasThumbnail ? "있음" : "없음"}, 본문 이미지 ${bodyCount}개`;
    if (hasThumbnail && bodyCount >= 4) imgLevel = "정상";
    else if (hasThumbnail || bodyCount > 0) imgLevel = "주의";
    items.push({ label: "이미지 5장(썸네일 1 + 본문 4)", level: imgLevel, detail: imgDetail });

    // 6. href="#"
    const hasHashHref = /href\s*=\s*["']#["']/i.test(html);
    items.push(
      hasHashHref
        ? { label: 'href="#" 링크', level: "수정 필요", detail: "금지된 빈 링크가 발견되었습니다" }
        : { label: 'href="#" 링크', level: "정상", detail: "발견되지 않았습니다" }
    );

    // 7. table / script / style 위험 요소
    const hasScript = /<script[\s>]/i.test(html);
    const hasStyle = /<style[\s>]/i.test(html);
    const hasTable = /<table[\s>]/i.test(html);
    if (hasScript || hasStyle) {
      items.push({
        label: "table / script / style",
        level: "수정 필요",
        detail: `${hasScript ? "<script> " : ""}${hasStyle ? "<style>" : ""} 태그가 발견되었습니다`.trim(),
      });
    } else if (hasTable) {
      items.push({ label: "table / script / style", level: "주의", detail: "<table>이 있습니다(저장 시 카드형으로 자동 변환됨)" });
    } else {
      items.push({ label: "table / script / style", level: "정상", detail: "위험 요소가 발견되지 않았습니다" });
    }

    // 8. 공식 링크(공식 출처) 여부
    const officialSources = Array.isArray(meta.official_sources) ? meta.official_sources : [];
    items.push(
      officialSources.length > 0
        ? { label: "공식 출처(official_sources)", level: "정상", detail: `${officialSources.length}건 등록됨` }
        : { label: "공식 출처(official_sources)", level: "주의", detail: "metadata에 공식 출처가 비어 있습니다" }
    );

    // v1.5(B-5): 블로그자료 생성 기준 v6.2 구조 점검. 품질점수/SEO점수가 아니라
    // 정상/주의/수정 필요 3단계로만 표시하는 단순 구조 진단이다.
    diagnoseV62Structure(html, meta, imageFiles).forEach((item) => items.push(item));

    return items;
  }

  // preview-module.js/blogger-save-module.js는 호출/수정하지 않는다. DOMParser로
  // 읽기 전용 파싱만 수행한다(화면에 삽입하지 않으므로 안전하다).
  function diagnoseV62Structure(html, meta, imageFiles) {
    const items = [];
    let doc = null;
    try {
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch (error) {
      doc = null;
    }

    if (!doc) {
      return [{ label: "v6.2 구조 점검", level: "주의", detail: "본문 구조를 분석하지 못했습니다" }];
    }

    // 9. 본문 최상단 H1 제목 중복 여부
    const hasH1 = /<h1[\s>]/i.test(html);
    if (hasH1) {
      items.push({ label: "제목(H1) 중복", level: "수정 필요", detail: "본문에 <h1> 태그가 있습니다. Blogger가 제목을 자동 표시하므로 중복될 수 있습니다." });
    } else {
      const firstHeading = doc.body.querySelector("h2, h3, strong");
      const headingText = firstHeading ? (firstHeading.textContent || "").trim() : "";
      const titleText = (meta.title || "").trim();
      if (headingText.length > 4 && titleText.length > 4 && (headingText.includes(titleText) || titleText.includes(headingText))) {
        items.push({ label: "제목(H1) 중복", level: "주의", detail: "본문 첫 소제목이 글 제목과 비슷합니다. 중복처럼 보일 수 있습니다." });
      } else {
        items.push({ label: "제목(H1) 중복", level: "정상", detail: "<h1> 태그가 없고, 제목 중복도 발견되지 않았습니다." });
      }
    }

    // 10/11. 대표 이미지 위치 + 첫 번째 img가 대표 이미지인지
    // v6.2 구조상 "최종 업데이트 날짜" 한 줄(<p>) 정도는 이미지보다 앞에 와도
    // 정상이다(6-5 순서: 날짜 → 대표 이미지 → 포스트잇 → 도입문). 이미지 앞에
    // 오는 <p> 개수로 "도입문이 이미지보다 먼저 나오는지"를 가늠한다.
    const orderedEls = [...doc.body.querySelectorAll("img, p")];
    const firstImgIdx = orderedEls.findIndex((el) => el.tagName === "IMG");

    if (firstImgIdx === -1) {
      items.push({ label: "대표 이미지 위치", level: "주의", detail: "본문에서 이미지를 찾지 못했습니다." });
      items.push({ label: "첫 번째 이미지 = 대표 이미지", level: "주의", detail: "본문에서 이미지를 찾지 못했습니다." });
    } else {
      const pBeforeImgCount = orderedEls.slice(0, firstImgIdx).filter((el) => el.tagName === "P").length;
      let imgPosLevel = "정상";
      let imgPosDetail = "대표 이미지가 본문 상단(도입문보다 앞)에 배치되어 있습니다.";
      if (pBeforeImgCount === 2) {
        imgPosLevel = "주의";
        imgPosDetail = "이미지 앞에 문단이 2개 있습니다. 최종 업데이트 날짜 정도만 남기고 이미지를 앞으로 옮기는 것을 권장합니다.";
      } else if (pBeforeImgCount >= 3) {
        imgPosLevel = "수정 필요";
        imgPosDetail = "도입문이 이미지보다 먼저 나옵니다. 대표 이미지를 도입문보다 앞(최종 업데이트 날짜 다음)에 배치하세요.";
      }
      items.push({ label: "대표 이미지 위치", level: imgPosLevel, detail: imgPosDetail });

      const firstImg = orderedEls[firstImgIdx];
      const src = (firstImg.getAttribute("src") || "").toLowerCase();
      const baseName = (src.split("/").pop() || "").split("?")[0];
      const isThumbnail = baseName.indexOf("thumbnail") !== -1 || (imageFiles[baseName] && imageFiles[baseName].role === "thumbnail");
      items.push(
        isThumbnail
          ? { label: "첫 번째 이미지 = 대표 이미지", level: "정상", detail: "본문의 첫 번째 이미지가 대표(썸네일) 이미지입니다." }
          : { label: "첫 번째 이미지 = 대표 이미지", level: "수정 필요", detail: "본문의 첫 번째 이미지가 대표(썸네일) 이미지가 아닌 것으로 보입니다." }
      );
    }

    // 12. 긴 문단이 과하게 이어지는지
    const paragraphs = [...doc.body.querySelectorAll("p")];
    if (!paragraphs.length) {
      items.push({ label: "문단 길이", level: "주의", detail: "본문에서 <p> 문단을 찾지 못했습니다." });
    } else {
      const longCount = paragraphs.filter((p) => {
        const text = (p.textContent || "").trim();
        const sentenceCount = (text.match(/[.!?。]/g) || []).length;
        return sentenceCount > 4 || text.length > 220;
      }).length;
      const ratio = longCount / paragraphs.length;
      if (ratio === 0) {
        items.push({ label: "문단 길이", level: "정상", detail: `문단 ${paragraphs.length}개 중 과도하게 긴 문단이 없습니다.` });
      } else if (ratio <= 0.2) {
        items.push({ label: "문단 길이", level: "주의", detail: `문단 ${paragraphs.length}개 중 ${longCount}개가 다소 깁니다(2~3문장 권장).` });
      } else {
        items.push({ label: "문단 길이", level: "수정 필요", detail: `문단 ${paragraphs.length}개 중 ${longCount}개가 너무 깁니다(2~3문장 이하로 나눠주세요).` });
      }
    }

    // 13. 핵심 요약/주의/신청/공식 링크가 박스로 구분되어 있는지(포스트잇/카드/주의박스 등)
    const styledBoxes = [...doc.body.querySelectorAll("div[style]")].filter((d) => {
      const style = d.getAttribute("style") || "";
      return /background|border/i.test(style);
    });
    const boxCount = styledBoxes.length;
    if (boxCount >= 3) {
      items.push({ label: "박스형 구성 요소", level: "정상", detail: `포스트잇/카드/주의 박스 등 ${boxCount}개가 확인되었습니다.` });
    } else if (boxCount >= 1) {
      items.push({ label: "박스형 구성 요소", level: "주의", detail: `박스형 요소가 ${boxCount}개뿐입니다(핵심 포스트잇/확인 카드/주의 박스/공식 링크 박스 중 3개 이상 권장).` });
    } else {
      items.push({ label: "박스형 구성 요소", level: "수정 필요", detail: "포스트잇/카드/체크리스트/주의 박스 형태의 구성 요소를 찾지 못했습니다." });
    }

    // 14. v1.6: 최종 업데이트 날짜 위치 확인(본문 최상단 근처에 있는지)
    const topText = doc.body.textContent ? doc.body.textContent.slice(0, 400) : "";
    const hasDateNearTop = /(최종\s*업데이트|업데이트\s*일|기준\s*일)/.test(topText) && /\d{4}[.\-년]\s?\d{1,2}[.\-월]/.test(topText);
    const hasDateAnywhere = /(최종\s*업데이트|업데이트\s*일|기준\s*일)/.test(html);
    if (hasDateNearTop) {
      items.push({ label: "최종 업데이트 날짜 위치", level: "정상", detail: "본문 상단 근처에서 최종 업데이트 날짜가 확인되었습니다." });
    } else if (hasDateAnywhere) {
      items.push({ label: "최종 업데이트 날짜 위치", level: "주의", detail: "최종 업데이트 날짜가 있지만 본문 상단(도입부 이전)에서는 확인되지 않았습니다." });
    } else {
      items.push({ label: "최종 업데이트 날짜 위치", level: "수정 필요", detail: "본문에서 최종 업데이트 날짜를 찾지 못했습니다." });
    }

    // 15. v1.6: 소제목(h2/h3) 간격 확인 - 소제목이 내용 없이 바로 이어지면 "주의/수정 필요"
    const headings = [...doc.body.querySelectorAll("h2, h3")];
    if (headings.length < 2) {
      items.push({ label: "소제목 간격", level: "주의", detail: "비교할 소제목이 2개 미만입니다." });
    } else {
      let backToBackCount = 0;
      for (let i = 0; i < headings.length - 1; i++) {
        if (headings[i].nextElementSibling === headings[i + 1]) backToBackCount++;
      }
      if (backToBackCount === 0) {
        items.push({ label: "소제목 간격", level: "정상", detail: "소제목 사이마다 내용이 배치되어 있습니다." });
      } else if (backToBackCount === 1) {
        items.push({ label: "소제목 간격", level: "주의", detail: "소제목이 내용 없이 바로 이어지는 곳이 1곳 있습니다." });
      } else {
        items.push({ label: "소제목 간격", level: "수정 필요", detail: `소제목이 내용 없이 바로 이어지는 곳이 ${backToBackCount}곳입니다. 사이에 설명을 추가하세요.` });
      }
    }

    return items;
  }

  function renderItems(items) {
    const { listEl } = els();
    if (!listEl) return;
    listEl.innerHTML = items
      .map(
        (item) => `
        <li class="diagnosis-item">
          <div class="diagnosis-item__head">
            <span class="diagnosis-item__label">${escapeHtml(item.label)}</span>
            <span class="diagnosis-level ${levelClass(item.level)}">${escapeHtml(item.level)}</span>
          </div>
          <div class="diagnosis-item__detail">${escapeHtml(item.detail)}</div>
        </li>`
      )
      .join("");
  }

  function openPopup() {
    const { overlay, emptyEl, listEl } = els();
    if (!overlay) return;

    let post = null;
    try {
      post = window.GptCoreAPI ? GptCoreAPI.getSelectedPost() : null;
    } catch (error) {
      post = null;
    }

    if (!post) {
      if (emptyEl) emptyEl.classList.remove("hidden");
      if (listEl) listEl.innerHTML = "";
    } else {
      if (emptyEl) emptyEl.classList.add("hidden");
      try {
        renderItems(diagnose(post));
      } catch (error) {
        if (listEl) listEl.innerHTML = `<li class="diagnosis-item"><div class="diagnosis-item__detail">진단 중 문제가 발생했습니다.</div></li>`;
      }
    }

    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const { overlay } = els();
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return;
    const { openBtn, closeBtn, overlay, emptyEl, listEl } = els();
    if (!openBtn || !closeBtn || !overlay || !emptyEl || !listEl) return;

    try {
      closeBtn.addEventListener("click", closePopup);
      openBtn.addEventListener("click", openPopup);
      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  function init() {
    bindEvents();
  }

  return { init, isReady };
})();

window.PackageDiagnosisModule = PackageDiagnosisModule;
