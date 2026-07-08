/**
 * worker-status-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할:
 * - Worker 연결 가능 여부 표시
 * - 로그인 상태 표시
 * - R2 업로드 API 접근 가능 여부 표시(추정, 실제 업로드는 하지 않음)
 * - Blogger API는 실제 저장 전까지 제한적으로만 표시
 *
 * 금지 사항 준수:
 * - 상태 점검을 위해 실제 게시글을 저장하지 않는다(WorkerApiModule.saveBloggerDraft를
 *   호출하지 않음).
 * - 상태 점검을 위해 실제 R2 파일을 업로드하지 않는다(R2ImageModule을 호출하지 않음).
 * - 이 모듈의 점검 결과가 실패해도 기본 저장 버튼(#save-start-btn)을 비활성화하지
 *   않는다(완전히 별도 화면, 별도 상태일 뿐 core 버튼에는 관여하지 않음).
 *
 * worker-api-module.js/auth-module.js 내부는 전혀 수정하지 않는다. 이미 공개된
 * getWorkerBaseUrl()/AuthModule.isLoggedIn()만 읽기 전용으로 호출하고, Worker
 * 연결 여부는 이 모듈 안에서 순수 fetch 도달성만 가볍게 확인한다.
 */

const WorkerStatusModule = (() => {
  let bound = false;

  function isReady() {
    return bound;
  }

  function statusClass(status) {
    if (status === "ok") return "check-item__status--ok";
    if (status === "danger") return "check-item__status--missing";
    return "check-item__status--warn";
  }

  function statusLabel(status) {
    if (status === "ok") return "정상";
    if (status === "danger") return "확인 필요";
    return "제한적";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  async function runChecks() {
    const items = [];

    let loggedIn = false;
    try {
      loggedIn = typeof AuthModule !== "undefined" && AuthModule.isLoggedIn();
    } catch (error) {
      loggedIn = false;
    }
    items.push({ label: "로그인 상태", status: loggedIn ? "ok" : "danger", detail: loggedIn ? "로그인됨" : "로그인이 필요합니다" });

    let base = "";
    try {
      base = typeof getWorkerBaseUrl === "function" ? getWorkerBaseUrl() : "";
    } catch (error) {
      base = "";
    }
    items.push({ label: "Worker 주소", status: base ? "ok" : "danger", detail: base || "주소를 확인할 수 없습니다" });

    let reachable = false;
    if (base) {
      try {
        await fetch(base, { method: "GET", mode: "no-cors", cache: "no-store" });
        reachable = true;
      } catch (error) {
        reachable = false;
      }
    }
    items.push({
      label: "Worker 연결",
      status: reachable ? "ok" : "warn",
      detail: reachable ? "연결 가능(네트워크 도달 확인됨)" : "연결을 확인할 수 없습니다(네트워크 상태 확인 필요)",
    });

    const r2Guess = loggedIn && reachable;
    items.push({
      label: "R2 업로드 API(추정)",
      status: r2Guess ? "ok" : "warn",
      detail: r2Guess
        ? "로그인 상태 + Worker 연결이 확인되었습니다(실제 업로드는 저장 시에만 실행됩니다)"
        : "로그인 또는 Worker 연결을 먼저 확인해주세요",
    });

    items.push({
      label: "Blogger API",
      status: "warn",
      detail: "실제 임시저장을 실행하기 전까지는 확인하지 않습니다(제한적 표시)",
    });

    return items;
  }

  function renderItems(items) {
    const listEl = document.getElementById("worker-status-list");
    if (!listEl) return;
    listEl.innerHTML = items
      .map(
        (item) => `
        <li class="check-item">
          <span>${escapeHtml(item.label)} <span style="color:var(--color-text-soft);font-weight:400;">(${escapeHtml(item.detail)})</span></span>
          <span class="check-item__status ${statusClass(item.status)}">${statusLabel(item.status)}</span>
        </li>`
      )
      .join("");
  }

  async function refresh() {
    const listEl = document.getElementById("worker-status-list");
    if (listEl) listEl.innerHTML = `<li class="check-item"><span>점검 중...</span></li>`;
    try {
      const items = await runChecks();
      renderItems(items);
    } catch (error) {
      if (listEl) listEl.innerHTML = `<li class="check-item"><span>점검 중 문제가 발생했습니다.</span></li>`;
    }
  }

  function openPopup() {
    const overlay = document.getElementById("popup-worker-status-overlay");
    if (!overlay) return;
    overlay.classList.add("popup-overlay--open");
    refresh();
  }

  function closePopup() {
    const overlay = document.getElementById("popup-worker-status-overlay");
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return;
    const openBtn = document.getElementById("settings-worker-detail-btn");
    const closeBtn = document.getElementById("worker-status-close-btn");
    const overlay = document.getElementById("popup-worker-status-overlay");
    const recheckBtn = document.getElementById("worker-status-recheck-btn");
    if (!openBtn || !closeBtn || !overlay || !recheckBtn) return;

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);
      recheckBtn.addEventListener("click", refresh);
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

window.WorkerStatusModule = WorkerStatusModule;
