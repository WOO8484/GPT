/**
 * package-diagnosis-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할: 업로드된 블로그자료(게시판에 저장된 post 객체) 구조를 진단한다.
 * - metadata.json / content.html / content.md·content.txt / images 폴더 확인
 * - 이미지 5장(썸네일 1 + 본문 4) 확인
 * - href="#" 확인
 * - table / script / style 위험 요소 확인
 * - 공식 링크(metadata.official_sources) 여부 확인
 *
 * 결과는 점수가 아니라 "정상 / 주의 / 수정 필요" 3단계로만 표시한다.
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
