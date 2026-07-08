/**
 * naver-copy-module.js (v1.6.2 신규, 단독 기능)
 *
 * 역할:
 * - 네이버는 자동 저장/발행 대상이 아니다. 이 모듈은 게시판에서 선택된 글의
 *   제목 / 본문 / 이미지 URL / 태그를 클립보드로 "수동 복사"만 한다.
 *
 * 금지 사항 준수:
 * - 네이버 자동 저장/임시저장/발행을 구현하지 않는다.
 * - 네이버 API를 호출하지 않는다.
 * - Blogger 저장 흐름(blogger-save-module.js, app-core.js의 handleSaveStartClick 등)을
 *   호출하거나 개입하지 않는다. 오직 GptCoreAPI로 "읽기"만 한다.
 *
 * 연결 방식:
 * - prompt-copy-module.js와 동일하게 완전히 독립적으로 스스로 초기화한다
 *   (자체 DOMContentLoaded 리스너). app-core.js의 초기화 블록은 건드리지 않는다.
 * - 표시 대상 DOM이 하나라도 없으면 조용히 아무 것도 하지 않는다(예외를 던지지 않음).
 * - 글 선택 상태 표시는 GptCoreAPI.registerLifecycleListener("post-selected")로만
 *   갱신한다. 이 리스너가 실패해도 Blogger 저장 흐름에는 영향이 없다.
 */

const NaverCopyModule = (() => {
  let bound = false;

  function isReady() {
    return bound;
  }

  function els() {
    return {
      statusEl: document.getElementById("naver-copy-status"),
      titleBtn: document.getElementById("naver-copy-title-btn"),
      bodyBtn: document.getElementById("naver-copy-body-btn"),
      imageBtn: document.getElementById("naver-copy-image-btn"),
      tagBtn: document.getElementById("naver-copy-tag-btn"),
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

  function renderStatus() {
    const { statusEl } = els();
    if (!statusEl) return;
    const post = getSelectedPost();
    statusEl.textContent = post ? "현재 상태: 네이버 수동 복사 준비" : "현재 상태: 게시글 선택 필요";
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

  function handleCopyImages() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const map = post.r2ImageMap || {};
      const urls = Object.values(map).filter(Boolean);
      if (!urls.length) {
        resultEl.textContent = "복사할 이미지 URL이 없습니다(블로그 임시저장 이후 이용 가능).";
        return;
      }
      copyText(urls.join("\n"), resultEl, "이미지 URL");
    });
  }

  function handleCopyTags() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const meta = post.metadata || {};
      const tags = Array.isArray(meta.tags) ? meta.tags : [];
      if (!tags.length) {
        resultEl.textContent = "복사할 태그가 없습니다.";
        return;
      }
      copyText(tags.join(", "), resultEl, "태그");
    });
  }

  function handleLifecycle(eventName) {
    if (eventName === "post-selected") renderStatus();
  }

  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const { statusEl, titleBtn, bodyBtn, imageBtn, tagBtn, resultEl } = els();
    if (!statusEl || !titleBtn || !bodyBtn || !imageBtn || !tagBtn || !resultEl) return; // DOM 없으면 조용히 종료

    try {
      titleBtn.addEventListener("click", handleCopyTitle);
      bodyBtn.addEventListener("click", handleCopyBody);
      imageBtn.addEventListener("click", handleCopyImages);
      tagBtn.addEventListener("click", handleCopyTags);

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
