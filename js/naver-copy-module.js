/**
 * naver-copy-module.js (v1.6.2 신규 → v6.9 지시문 반영으로 metadata 표시 보정)
 *
 * 역할:
 * - 네이버는 자동 저장/발행 대상이 아니다. 이 모듈은 게시판에서 선택된 글의
 *   제목 / 본문 / 게시판 / 네이버 주제분류 / 태그 / 지역 키워드 / 공식 링크를
 *   확인하고 클립보드로 "수동 복사"만 한다.
 * - v6.9 반영: 항목이 많아져 메인 화면에는 상태 + 여는 버튼만 두고, 실제 항목
 *   표시/복사는 팝업(#popup-naver-copy-overlay) 안에서 처리한다.
 *
 * 금지 사항 준수(변경 없음):
 * - 네이버 자동 저장/임시저장/발행을 구현하지 않는다.
 * - 네이버 API를 호출하지 않는다.
 * - Blogger 저장 흐름(blogger-save-module.js, app-core.js의 handleSaveStartClick 등)을
 *   호출하거나 개입하지 않는다. 오직 GptCoreAPI로 "읽기"만 한다.
 *
 * metadata.json에 v6.9 신규 필드(naver_board / naver_topic_category / naver_tags /
 * naver_location_keywords / official_links)가 없어도 빈칸으로 깨지지 않게
 * "정보 없음"으로 표시하고, 기능(복사 등)은 계속 동작한다.
 *
 * 연결 방식:
 * - prompt-copy-module.js와 동일하게 완전히 독립적으로 스스로 초기화한다
 *   (자체 DOMContentLoaded 리스너). app-core.js의 초기화 블록은 건드리지 않는다.
 * - 표시 대상 DOM이 하나라도 없으면 조용히 아무 것도 하지 않는다(예외를 던지지 않음).
 * - 글 선택 상태 표시는 GptCoreAPI.registerLifecycleListener("post-selected")로만
 *   갱신한다. 이 리스너가 실패해도 Blogger 저장 흐름에는 영향이 없다.
 */

const NaverCopyModule = (() => {
  const EMPTY_LABEL = "정보 없음";

  let bound = false;

  function isReady() {
    return bound;
  }

  function els() {
    return {
      statusEl: document.getElementById("naver-copy-status"),
      openBtn: document.getElementById("naver-copy-open-btn"),
      closeBtn: document.getElementById("naver-copy-close-btn"),
      overlay: document.getElementById("popup-naver-copy-overlay"),

      fieldBoard: document.getElementById("naver-field-board"),
      fieldCategory: document.getElementById("naver-field-category"),
      fieldTags: document.getElementById("naver-field-tags"),
      fieldLocation: document.getElementById("naver-field-location"),
      fieldTitle: document.getElementById("naver-field-title"),
      fieldLinks: document.getElementById("naver-field-links"),

      titleBtn: document.getElementById("naver-copy-title-btn"),
      bodyBtn: document.getElementById("naver-copy-body-btn"),
      boardCategoryBtn: document.getElementById("naver-copy-board-category-btn"),
      tagLocationBtn: document.getElementById("naver-copy-tag-location-btn"),
      linksBtn: document.getElementById("naver-copy-links-btn"),
      imageGuideBtn: document.getElementById("naver-copy-image-guide-btn"),

      resultEl: document.getElementById("naver-copy-result"),
    };
  }

  // GptCoreAPI가 없거나 실패해도 조용히 null을 반환한다(읽기 전용 접근).
  function getSelectedPost() {
    try {
      if (window.GptCoreAPI && typeof GptCoreAPI.getSelectedPost === "function") {
        return GptCoreAPI.getSelectedPost();
      }
    } catch (error) {
      // 읽기 실패는 이 모듈만의 문제로 한정한다.
    }
    return null;
  }

  function stripHtml(html) {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = html || "";
      return (tmp.textContent || tmp.innerText || "").trim();
    } catch (error) {
      return "";
    }
  }

  function getMeta(post) {
    return (post && post.metadata) || {};
  }

  function getBoard(meta) {
    const value = meta.naver_board;
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  function getCategory(meta) {
    const value = meta.naver_topic_category;
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  function getTags(meta) {
    return Array.isArray(meta.naver_tags) ? meta.naver_tags.filter(Boolean) : [];
  }

  function getLocationKeywords(meta) {
    return Array.isArray(meta.naver_location_keywords) ? meta.naver_location_keywords.filter(Boolean) : [];
  }

  // official_links: [{ name, url, type, purpose }, ...] 형태(v6.9 기준). 형식이
  // 다르거나(예: 문자열 배열) 값이 없어도 깨지지 않게 최대한 표시한다.
  function getOfficialLinks(meta) {
    if (!Array.isArray(meta.official_links)) return [];
    return meta.official_links
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return { name: "", url: item };
        const name = typeof item.name === "string" ? item.name : "";
        const url = typeof item.url === "string" ? item.url : "";
        if (!name && !url) return null;
        return { name, url };
      })
      .filter(Boolean);
  }

  function renderStatus() {
    const { statusEl } = els();
    if (!statusEl) return;
    const post = getSelectedPost();
    statusEl.textContent = post ? "현재 상태: 네이버 수동 복사 준비" : "현재 상태: 게시글 선택 필요";
  }

  // 팝업을 열 때 현재 선택된 글 기준으로 항목들을 채운다. 글이 없거나
  // metadata 필드가 없어도 "정보 없음"으로만 표시하고 예외를 던지지 않는다.
  function renderFields() {
    const {
      fieldBoard, fieldCategory, fieldTags, fieldLocation, fieldTitle, fieldLinks,
    } = els();
    const post = getSelectedPost();
    const meta = getMeta(post);

    if (fieldTitle) fieldTitle.textContent = (post && post.title) ? post.title : EMPTY_LABEL;
    if (fieldBoard) fieldBoard.textContent = getBoard(meta) || EMPTY_LABEL;
    if (fieldCategory) fieldCategory.textContent = getCategory(meta) || EMPTY_LABEL;

    const tags = getTags(meta);
    if (fieldTags) fieldTags.textContent = tags.length ? tags.join(", ") : EMPTY_LABEL;

    const location = getLocationKeywords(meta);
    if (fieldLocation) fieldLocation.textContent = location.length ? location.join(", ") : EMPTY_LABEL;

    const links = getOfficialLinks(meta);
    if (fieldLinks) {
      fieldLinks.textContent = links.length
        ? links.map((link) => (link.name ? `${link.name}: ${link.url}` : link.url)).join(" / ")
        : EMPTY_LABEL;
    }
  }

  async function copyText(text, resultEl, label) {
    if (!text || !text.trim()) {
      resultEl.textContent = `복사할 ${label} 내용이 없습니다.`;
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        resultEl.textContent = `✅ ${label} 복사 완료`;
      } else {
        resultEl.textContent = "이 환경에서는 자동 복사를 지원하지 않습니다. 직접 선택해 복사해주세요.";
      }
    } catch (error) {
      resultEl.textContent = "복사에 실패했습니다. 직접 선택해 복사해주세요.";
    }
  }

  function withSelectedPost(resultEl, handler) {
    const post = getSelectedPost();
    if (!post) {
      resultEl.textContent = "게시글을 먼저 선택해주세요.";
      return;
    }
    handler(post);
  }

  function handleCopyTitle() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => copyText(post.title || "", resultEl, "제목"));
  }

  function handleCopyBody() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const text = post.contentText && post.contentText.trim() ? post.contentText : stripHtml(post.contentHtmlRaw);
      copyText(text, resultEl, "본문");
    });
  }

  function handleCopyBoardCategory() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const meta = getMeta(post);
      const board = getBoard(meta);
      const category = getCategory(meta);
      if (!board && !category) {
        resultEl.textContent = "복사할 게시판/주제분류 정보가 없습니다(metadata에 없음).";
        return;
      }
      const lines = [];
      lines.push(`게시판: ${board || EMPTY_LABEL}`);
      lines.push(`네이버 주제분류: ${category || EMPTY_LABEL}`);
      copyText(lines.join("\n"), resultEl, "게시판/주제분류");
    });
  }

  function handleCopyTagLocation() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const meta = getMeta(post);
      const tags = getTags(meta);
      const location = getLocationKeywords(meta);
      if (!tags.length && !location.length) {
        resultEl.textContent = "복사할 태그/지역 키워드가 없습니다(metadata에 없음).";
        return;
      }
      const lines = [];
      lines.push(`태그: ${tags.length ? tags.join(", ") : EMPTY_LABEL}`);
      lines.push(`지역 키워드: ${location.length ? location.join(", ") : EMPTY_LABEL}`);
      copyText(lines.join("\n"), resultEl, "태그/지역");
    });
  }

  function handleCopyLinks() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const links = getOfficialLinks(getMeta(post));
      if (!links.length) {
        resultEl.textContent = "복사할 공식 링크가 없습니다(metadata에 없음).";
        return;
      }
      const text = links.map((link) => (link.name ? `${link.name}: ${link.url}` : link.url)).join("\n");
      copyText(text, resultEl, "공식 링크");
    });
  }

  function handleCopyImageGuide() {
    const { resultEl } = els();
    const guide = [
      "네이버 블로그는 이미지를 직접 업로드하는 방식으로 사용하세요.",
      "ZIP 안의 images 폴더에서 thumbnail.png와 body 이미지를 순서대로 업로드하세요.",
      "thumbnail.png는 대표 이미지, body-01~04는 본문 설명 이미지입니다.",
    ].join("\n");
    copyText(guide, resultEl, "이미지 업로드 안내");
  }

  function handleLifecycle(eventName) {
    if (eventName === "post-selected") renderStatus();
  }

  function openPopup() {
    const { overlay, resultEl } = els();
    if (!overlay) return;
    if (resultEl) resultEl.textContent = "";
    renderFields();
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const { overlay } = els();
    if (!overlay) return;
    overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const {
      statusEl, openBtn, closeBtn, overlay,
      titleBtn, bodyBtn, boardCategoryBtn, tagLocationBtn, linksBtn, imageGuideBtn,
      resultEl,
    } = els();

    // 표시 대상 DOM이 하나라도 없으면 조용히 종료(예외를 던지지 않음).
    if (!statusEl || !openBtn || !closeBtn || !overlay || !titleBtn || !bodyBtn
      || !boardCategoryBtn || !tagLocationBtn || !linksBtn || !imageGuideBtn || !resultEl) {
      return;
    }

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);

      titleBtn.addEventListener("click", handleCopyTitle);
      bodyBtn.addEventListener("click", handleCopyBody);
      boardCategoryBtn.addEventListener("click", handleCopyBoardCategory);
      tagLocationBtn.addEventListener("click", handleCopyTagLocation);
      linksBtn.addEventListener("click", handleCopyLinks);
      imageGuideBtn.addEventListener("click", handleCopyImageGuide);

      if (window.GptCoreAPI && typeof GptCoreAPI.registerLifecycleListener === "function") {
        GptCoreAPI.registerLifecycleListener("naver-copy-module", handleLifecycle);
      }

      renderStatus();
      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  return { bindEvents, isReady };
})();

document.addEventListener("DOMContentLoaded", () => {
  try {
    NaverCopyModule.bindEvents();
  } catch (error) {
    // 최후의 방어선: 실패해도 조용히 무시한다(다른 기본 기능/Blogger 저장 흐름에는 영향 없음).
  }
});
