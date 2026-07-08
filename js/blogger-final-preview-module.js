/**
 * blogger-final-preview-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할:
 * - 선택된 게시글 기준 Blogger 저장 전 HTML 미리보기 표시
 * - R2 이미지 URL 치환 상태 확인(이미 확보된 URL이 있으면 표시, 없으면 "저장 시
 *   R2 URL로 치환 예정"으로 표시)
 * - 광고 placeholder(ADSENSE_PLACEHOLDER_TOP/MIDDLE/BOTTOM) 위치 확인
 * - Blogger-safe HTML 상태 확인(script/style/iframe/form, table 등)
 * - v1.6(16/17장): 발행 전 체크리스트 6항목(제목 중복/대표 이미지 위치/첫
 *   이미지=대표 이미지/문단 길이/박스형 구성/공식 링크·FAQ)과, 본문 미리보기를
 *   실제 Blogger 모바일 발행 화면과 더 비슷하게 보여주는 모바일 프레임을 추가했다.
 *
 * 금지 사항 준수:
 * - Blogger 저장을 직접 실행하지 않는다(WorkerApiModule/BloggerSaveModule.runSaveFlow를
 *   호출하지 않음).
 * - R2 업로드를 직접 실행하지 않는다(R2ImageModule을 호출하지 않음).
 * - blogger-save-module.js의 기존 저장 흐름/저장 버튼 이벤트를 건드리지 않는다.
 *   이 모듈은 GptCoreAPI.getSelectedPost()로 읽기만 하고, 화면에 표시만 한다.
 * - blogger-save-module.js는 이번 모듈을 위해서도 수정하지 않았다(작업지침서
 *   3장 예외 조항의 "helper 함수 추가가 어렵거나 위험하면 예상 미리보기로 구현"
 *   선택지를 따름). 아래 이미지/광고/Blogger-safe 판정은 이 모듈 안에서 읽기
 *   전용으로 다시 계산한 "예상" 값이며, PreviewModule.renderPreview()가 만드는
 *   안전한 렌더링 결과를 본문 미리보기로 그대로 사용한다.
 */

const BloggerFinalPreviewModule = (() => {
  let bound = false;

  function isReady() {
    return bound;
  }

  function els() {
    return {
      openBtn: document.getElementById("blogger-preview-open-btn"),
      closeBtn: document.getElementById("blogger-preview-close-btn"),
      overlay: document.getElementById("popup-blogger-final-preview-overlay"),
      emptyEl: document.getElementById("blogger-preview-empty"),
      bodyEl: document.getElementById("blogger-preview-body"),
      checklistEl: document.getElementById("blogger-preview-checklist"),
      imageStatusEl: document.getElementById("blogger-preview-image-status"),
      adStatusEl: document.getElementById("blogger-preview-ad-status"),
      safeStatusEl: document.getElementById("blogger-preview-safe-status"),
      contentEl: document.getElementById("blogger-preview-content"),
    };
  }

  function statusClass(status) {
    if (status === "ok") return "check-item__status--ok";
    if (status === "danger") return "check-item__status--missing";
    return "check-item__status--warn";
  }

  function statusLabel(status) {
    if (status === "ok") return "정상";
    if (status === "danger") return "수정 필요";
    return "주의";
  }

  // R2 URL 치환 상태를 읽기 전용으로 다시 판정한다(실제 업로드는 하지 않음).
  function classifyImages(post) {
    try {
      const html = post.contentHtmlRaw || "";
      const imageFiles = post.imageFiles || {};
      const r2Map = post.r2ImageMap || {};
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const imgs = [...doc.body.querySelectorAll("img")];

      if (!imgs.length) {
        return [{ label: "본문 이미지", status: "warn", detail: "본문에서 <img> 태그를 찾지 못했습니다." }];
      }

      return imgs.map((img, idx) => {
        const src = (img.getAttribute("src") || "").trim();
        const label = `이미지 ${idx + 1}`;
        if (/^https?:\/\//i.test(src)) {
          return { label, status: "ok", detail: "이미 URL 있음(그대로 사용)" };
        }
        if (/^data:/i.test(src)) {
          return { label, status: "warn", detail: "저장 시 R2 URL로 치환 예정(인라인 이미지)" };
        }
        const baseName = (src.split("/").pop() || "").split("?")[0].toLowerCase();
        if (r2Map[baseName]) {
          return { label, status: "ok", detail: "이전 저장에서 확보된 R2 URL 있음" };
        }
        if (imageFiles[baseName]) {
          return { label, status: "warn", detail: "저장 시 R2 URL로 치환 예정" };
        }
        return { label, status: "danger", detail: "ZIP 안에서 이미지를 찾을 수 없음(저장 시 실패 가능)" };
      });
    } catch (error) {
      return [{ label: "이미지 상태", status: "warn", detail: "확인 중 문제가 발생했습니다." }];
    }
  }

  function checkAdPlaceholders(html) {
    const markers = [
      { pattern: /<!--\s*ADSENSE_PLACEHOLDER_TOP\s*-->/i, label: "상단 광고 위치" },
      { pattern: /<!--\s*ADSENSE_PLACEHOLDER_MIDDLE\s*-->/i, label: "중단 광고 위치" },
      { pattern: /<!--\s*ADSENSE_PLACEHOLDER_BOTTOM\s*-->/i, label: "하단 광고 위치" },
    ];
    return markers.map((m) => {
      const found = m.pattern.test(html || "");
      return { label: m.label, status: found ? "ok" : "warn", detail: found ? "placeholder 확인됨" : "이 위치의 placeholder를 찾지 못했습니다(선택 사항)" };
    });
  }

  function checkBloggerSafeHtml(html) {
    const src = html || "";
    const items = [];
    [
      { tag: "script", label: "<script> 태그" },
      { tag: "style", label: "<style> 태그" },
      { tag: "iframe", label: "<iframe> 태그" },
      { tag: "form", label: "<form> 태그" },
    ].forEach((f) => {
      const found = new RegExp("<" + f.tag + "[\\s>]", "i").test(src);
      items.push({ label: f.label, status: found ? "danger" : "ok", detail: found ? "저장 전 제거가 필요합니다" : "없음(정상)" });
    });
    const hasTable = /<table[\s>]/i.test(src);
    items.push({
      label: "표(<table>)",
      status: hasTable ? "warn" : "ok",
      detail: hasTable ? "저장 시 자동으로 카드형으로 정리됩니다(3열 이상 기준)" : "없음(정상)",
    });
    return items;
  }

  // v1.6(17장): "발행 전 체크리스트" 6항목. package-diagnosis-module.js와 별개로
  // 이 모듈 안에서 읽기 전용으로 다시 계산한다(모듈 간 직접 의존을 만들지 않음).
  function checkPrePublishChecklist(post) {
    const html = post.contentHtmlRaw || "";
    const items = [];

    // 1. 제목이 한 번만 보이나?
    const hasH1 = /<h1[\s>]/i.test(html);
    items.push({
      label: "제목이 한 번만 보이나요?",
      status: hasH1 ? "danger" : "ok",
      detail: hasH1 ? "본문에 <h1>이 있어 Blogger 제목과 중복될 수 있습니다" : "본문에 <h1>이 없어 제목이 한 번만 표시됩니다",
    });

    let doc = null;
    try {
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch (error) {
      doc = null;
    }

    if (!doc) {
      items.push({ label: "본문 구조 확인", status: "warn", detail: "본문 구조를 분석하지 못했습니다" });
      return items;
    }

    // 2/3. 대표 이미지 위치 + 첫 이미지가 대표 이미지인지
    const orderedEls = [...doc.body.querySelectorAll("img, p")];
    const firstImgIdx = orderedEls.findIndex((el) => el.tagName === "IMG");
    if (firstImgIdx === -1) {
      items.push({ label: "대표 이미지가 본문 첫 글자보다 위에 있나요?", status: "warn", detail: "본문에서 이미지를 찾지 못했습니다" });
      items.push({ label: "첫 번째 이미지가 대표 이미지인가요?", status: "warn", detail: "본문에서 이미지를 찾지 못했습니다" });
    } else {
      const pBefore = orderedEls.slice(0, firstImgIdx).filter((el) => el.tagName === "P").length;
      items.push({
        label: "대표 이미지가 본문 첫 글자보다 위에 있나요?",
        status: pBefore <= 1 ? "ok" : pBefore === 2 ? "warn" : "danger",
        detail: pBefore <= 1 ? "이미지가 도입문보다 앞에 배치되어 있습니다" : "문단이 이미지보다 먼저 나옵니다",
      });

      const firstImg = orderedEls[firstImgIdx];
      const src = (firstImg.getAttribute("src") || "").toLowerCase();
      const baseName = (src.split("/").pop() || "").split("?")[0];
      const imageFiles = post.imageFiles || {};
      const isThumb = baseName.indexOf("thumbnail") !== -1 || (imageFiles[baseName] && imageFiles[baseName].role === "thumbnail");
      items.push({
        label: "첫 번째 이미지가 대표 이미지인가요?",
        status: isThumb ? "ok" : "danger",
        detail: isThumb ? "첫 번째 이미지가 대표(썸네일) 이미지입니다" : "첫 번째 이미지가 대표 이미지가 아닌 것으로 보입니다",
      });
    }

    // 4. 모바일에서 문단이 길지 않나?
    const paragraphs = [...doc.body.querySelectorAll("p")];
    const longCount = paragraphs.filter((p) => {
      const text = (p.textContent || "").trim();
      const sentenceCount = (text.match(/[.!?。]/g) || []).length;
      return sentenceCount > 4 || text.length > 220;
    }).length;
    items.push({
      label: "모바일에서 문단이 길지 않나요?",
      status: !paragraphs.length ? "warn" : longCount === 0 ? "ok" : longCount / paragraphs.length <= 0.2 ? "warn" : "danger",
      detail: !paragraphs.length ? "문단(<p>)을 찾지 못했습니다" : longCount === 0 ? "과도하게 긴 문단이 없습니다" : `긴 문단 ${longCount}개가 있습니다(2~3문장 권장)`,
    });

    // 5. 박스형 구성 요소가 보이나?
    const boxes = [...doc.body.querySelectorAll("div[style]")].filter((d) => /background|border/i.test(d.getAttribute("style") || ""));
    items.push({
      label: "오늘 핵심/신청 전 확인/주의사항/공식 링크 박스가 보이나요?",
      status: boxes.length >= 3 ? "ok" : boxes.length >= 1 ? "warn" : "danger",
      detail: `박스형 요소 ${boxes.length}개가 확인되었습니다`,
    });

    // 6. 공식 링크와 FAQ가 정상 표시되나?
    const hasRealLink = [...doc.body.querySelectorAll("a[href]")].some((a) => /^https?:\/\//i.test(a.getAttribute("href") || ""));
    const hasFaq = /FAQ|자주\s*묻는\s*질문/i.test(html);
    items.push({
      label: "공식 링크와 FAQ가 정상 표시되나요?",
      status: hasRealLink && hasFaq ? "ok" : hasRealLink || hasFaq ? "warn" : "danger",
      detail: `공식 링크 ${hasRealLink ? "있음" : "없음"} · FAQ ${hasFaq ? "있음" : "없음"}`,
    });

    return items;
  }

  function renderList(container, items) {
    if (!container) return;
    container.innerHTML = items
      .map(
        (item) => `
        <li class="check-item">
          <span>${escapeAttr(item.label)}${item.detail ? ` <span style="color:var(--color-text-soft);font-weight:400;">(${escapeAttr(item.detail)})</span>` : ""}</span>
          <span class="check-item__status ${statusClass(item.status)}">${statusLabel(item.status)}</span>
        </li>`
      )
      .join("");
  }

  function escapeAttr(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function renderForPost(post) {
    const { emptyEl, bodyEl, checklistEl, imageStatusEl, adStatusEl, safeStatusEl, contentEl } = els();
    if (!post) {
      emptyEl.classList.remove("hidden");
      bodyEl.classList.add("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    bodyEl.classList.remove("hidden");

    renderList(checklistEl, checkPrePublishChecklist(post));
    renderList(imageStatusEl, classifyImages(post));
    renderList(adStatusEl, checkAdPlaceholders(post.contentHtmlRaw));
    renderList(safeStatusEl, checkBloggerSafeHtml(post.contentHtmlRaw));

    try {
      const rendered = window.PreviewModule && PreviewModule.renderPreview(post);
      contentEl.innerHTML = rendered ? rendered.safeHtml : "<p class=\"notice-text\">미리보기를 표시할 수 없습니다.</p>";
    } catch (error) {
      contentEl.innerHTML = "<p class=\"notice-text\">미리보기를 표시하지 못했습니다.</p>";
    }
  }

  function openPopup() {
    const { overlay } = els();
    if (!overlay) return;
    let post = null;
    try {
      post = window.GptCoreAPI ? GptCoreAPI.getSelectedPost() : null;
    } catch (error) {
      post = null;
    }
    try {
      renderForPost(post);
    } catch (error) {
      // 렌더링 실패해도 팝업 자체는 열어서 닫기 버튼을 쓸 수 있게 한다.
    }
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const { overlay } = els();
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return;
    const { openBtn, closeBtn, overlay, emptyEl, bodyEl, checklistEl } = els();
    if (!openBtn || !closeBtn || !overlay || !emptyEl || !bodyEl || !checklistEl) return;

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

window.BloggerFinalPreviewModule = BloggerFinalPreviewModule;
