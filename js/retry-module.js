/**
 * retry-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할: v1.4에서 허용하는 유일한 재시도인 "단순 다시 저장"만 제공한다.
 * - 선택된 글을 기존 Blogger 임시저장 흐름(app-core.js의 handleSaveStartClick,
 *   GptCoreAPI.triggerBloggerSave로 노출됨)으로 다시 1회 실행한다.
 * - R2만 재업로드하거나 Blogger 저장만 따로 재실행하지 않는다(저장 흐름을
 *   분해하지 않음). blogger-save-module.js는 전혀 수정하지 않았다.
 * - 중복 클릭 방지: 버튼 자체의 disabled 상태 + 메인 저장 버튼이 이미 진행
 *   중인지 함께 확인한다.
 *
 * 표시 조건: 선택된 글의 saveStatus가 "임시저장실패"일 때만 버튼을 노출한다.
 * (버튼 자체가 index.html 기본 저장 패널 안에 있지만, 신규 기능이므로 이 모듈이
 * 죽어도 항상 hidden 상태로 남을 뿐 기본 저장 버튼/흐름에는 영향이 없다.)
 */

const RetryModule = (() => {
  let bound = false;

  function isReady() {
    return bound;
  }

  function updateVisibility(post) {
    const btn = document.getElementById("retry-save-btn");
    if (!btn) return;
    if (post && post.saveStatus === "임시저장실패") {
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }

  async function handleRetryClick() {
    const btn = document.getElementById("retry-save-btn");
    if (!btn || btn.disabled) return; // 중복 클릭 방지

    const mainBtn = document.getElementById("save-start-btn");
    if (mainBtn && mainBtn.disabled) return; // 이미 저장이 진행 중이면 무시한다.

    if (!window.GptCoreAPI || typeof GptCoreAPI.triggerBloggerSave !== "function") return;

    btn.disabled = true;
    try {
      await GptCoreAPI.triggerBloggerSave();
    } catch (error) {
      // 성공/실패 안내 팝업은 기존 저장 흐름(handleSaveStartClick)이 이미 처리한다.
      // 여기서는 추가 팝업을 띄우지 않는다(중복 안내 방지).
    } finally {
      btn.disabled = false;
    }
  }

  function handleLifecycle(eventName, payload) {
    if (eventName !== "post-selected" && eventName !== "blogger-save-result") return;
    const fallbackPost = (payload && payload.post) || null;
    try {
      // blogger-save-result 직후에는 payload.post가 저장 시도 시점 스냅샷일 수
      // 있으므로, 최신 saveStatus 반영을 위해 다시 조회한다.
      const current = window.GptCoreAPI ? GptCoreAPI.getSelectedPost() : fallbackPost;
      updateVisibility(current || fallbackPost);
    } catch (error) {
      updateVisibility(fallbackPost);
    }
  }

  function bindEvents() {
    if (bound) return;
    const btn = document.getElementById("retry-save-btn");
    if (!btn) return;
    if (!window.GptCoreAPI || typeof GptCoreAPI.registerLifecycleListener !== "function") return;

    try {
      btn.addEventListener("click", handleRetryClick);
      GptCoreAPI.registerLifecycleListener("retry-module", handleLifecycle);
      updateVisibility(GptCoreAPI.getSelectedPost());
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

window.RetryModule = RetryModule;
