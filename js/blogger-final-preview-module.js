/**
 * blogger-final-preview-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할:
 * - 선택된 게시글 기준 Blogger 저장 전 HTML 미리보기 표시
 * - R2 이미지 URL 치환 상태 확인(이미 확보된 URL이 있으면 표시, 없으면 "저장 시
 *   R2 URL로 치환 예정"으로 표시)
 * - 광고 placeholder(ADSENSE_PLACEHOLDER_TOP/MIDDLE/BOTTOM) 위치 확인
 * - Blogger-safe HTML 상태 확인(script/style/iframe/form, table 등)
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
    const { emptyEl, bodyEl, imageStatusEl, adStatusEl, safeStatusEl, contentEl } = els();
    if (!post) {
      emptyEl.classList.remove("hidden");
      bodyEl.classList.add("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    bodyEl.classList.remove("hidden");

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
    const { openBtn, closeBtn, overlay, emptyEl, bodyEl } = els();
    if (!openBtn || !closeBtn || !overlay || !emptyEl || !bodyEl) return;

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
