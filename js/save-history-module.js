/**
 * save-history-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할: Blogger 임시저장 시도 이력을 기록/표시한다.
 * - 마지막 저장 시각, 성공/실패, 실패 사유 요약, 최근 이력 목록
 *
 * 저장 방식:
 * - blogger-save-module.js 내부 저장 흐름은 전혀 수정하지 않는다.
 * - 별도 localStorage key(gptWorkshop.saveHistory.v1)에 배열로만 기록한다
 *   (최근 50건까지만 보관, 오래된 기록은 자동으로 정리됨).
 *
 * 연결 방식:
 * - app-core.js가 handleSaveStartClick()에서 BloggerSaveModule.runSaveFlow()
 *   결과를 받은 "직후"(팝업/게시판 갱신과는 무관하게) GptCoreAPI로 등록해둔
 *   이 모듈의 콜백을 안전하게(safeInit) 호출해준다. 이 모듈이 실패해도 저장
 *   결과 자체(성공/실패 팝업, 게시판 갱신)는 이미 처리된 뒤이므로 영향이 없다.
 * - 저장 실패 이력이 쌓여도 다음 저장 시도를 막지 않는다(이 모듈은 오직 기록만
 *   하며, 저장 버튼/저장 흐름에 관여하지 않는다).
 */

const SaveHistoryModule = (() => {
  const LS_KEY = "gptWorkshop.saveHistory.v1";
  const MAX_ENTRIES = 50;
  let bound = false;

  function isReady() {
    return bound;
  }

  function readHistory() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function writeHistory(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
    } catch (error) {
      // 저장 실패는 조용히 무시한다(다음 저장 시도에는 영향 없음).
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return iso;
    }
  }

  function recordResult(post, result) {
    const list = readHistory();
    list.push({
      id: "hist_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      postId: post ? post.id : null,
      postTitle: post ? post.title : "(제목 없음)",
      success: !!(result && result.success),
      reason: result && !result.success ? (Array.isArray(result.reasons) ? result.reasons.join(" / ") : "알 수 없는 오류") : "",
      createdAt: new Date().toISOString(),
    });
    writeHistory(list);
    renderLastSummary();
  }

  function getLastEntry() {
    const list = readHistory();
    return list.length ? list[list.length - 1] : null;
  }

  function renderLastSummary() {
    const last = getLastEntry();
    const text = last ? `${formatDate(last.createdAt)} (${last.success ? "성공" : "실패"})` : "-";
    const settingsEl = document.getElementById("settings-save-history-last");
    const popupEl = document.getElementById("save-history-last");
    if (settingsEl) settingsEl.textContent = text;
    if (popupEl) popupEl.textContent = text;
  }

  function renderList() {
    const listEl = document.getElementById("save-history-list");
    if (!listEl) return;
    const list = readHistory().slice().reverse().slice(0, 20);
    if (!list.length) {
      listEl.innerHTML = `<li class="archive-item--empty">저장 이력이 없습니다.</li>`;
      return;
    }
    listEl.innerHTML = list
      .map(
        (e) => `
        <li class="error-item">
          <div class="error-item__title" style="color:${e.success ? "var(--color-success)" : "var(--color-danger)"};">
            ${e.success ? "✅ 성공" : "⚠️ 실패"} · ${escapeHtml(e.postTitle)}
          </div>
          ${e.reason ? `<div class="error-item__detail">${escapeHtml(e.reason)}</div>` : ""}
          <div class="error-item__meta">${formatDate(e.createdAt)}</div>
        </li>`
      )
      .join("");
  }

  function handleLifecycle(eventName, payload) {
    if (eventName !== "blogger-save-result") return;
    payload = payload || {};
    recordResult(payload.post || null, payload.result || {});
  }

  function openPopup() {
    const overlay = document.getElementById("popup-save-history-overlay");
    if (!overlay) return;
    try {
      renderLastSummary();
      renderList();
    } catch (error) {
      // 렌더링 실패해도 팝업은 연다.
    }
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const overlay = document.getElementById("popup-save-history-overlay");
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function handleClear() {
    writeHistory([]);
    renderLastSummary();
    renderList();
  }

  function bindEvents() {
    if (bound) return;
    const openBtn = document.getElementById("settings-save-history-btn");
    const closeBtn = document.getElementById("save-history-close-btn");
    const overlay = document.getElementById("popup-save-history-overlay");
    const clearBtn = document.getElementById("save-history-clear-btn");
    if (!openBtn || !closeBtn || !overlay || !clearBtn) return;
    if (!window.GptCoreAPI || typeof GptCoreAPI.registerLifecycleListener !== "function") return;

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);
      clearBtn.addEventListener("click", handleClear);
      GptCoreAPI.registerLifecycleListener("save-history-module", handleLifecycle);
      renderLastSummary();
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

window.SaveHistoryModule = SaveHistoryModule;
