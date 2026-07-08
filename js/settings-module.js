/**
 * settings-module.js (v1.3 신규 모듈)
 * 설정 팝업 전담: 계정 / 작업 서버 / 블로그 지시서 관리 / 오류 목록 / 데이터 관리 / 버전 정보.
 *
 * 원칙:
 * - 로그인/로그아웃 실제 처리, Worker 호출, 저장소 구조는 여기서 새로 구현하지 않고
 *   기존 공개 API(AuthModule.logout, StorageModule.getAllPosts/deletePost,
 *   ErrorLogModule.getAllErrors/clearErrors)만 호출한다.
 * - 게시판 데이터 초기화처럼 여러 모듈에 걸친 후처리(화면 갱신)는 app-core.js가
 *   setOnDataReset()으로 등록한 콜백에 위임한다. 이 모듈은 저장소 삭제까지만 하고,
 *   화면(게시판 목록/선택 상태 등) 갱신은 app-core.js가 담당한다.
 * - 블로그 지시서 등록/초기화는 localStorage에 아래 키로 저장한다(README/prompt-copy-module.js와
 *   동일한 계약):
 *     gptWorkshop.blogPrompt.customText
 *     gptWorkshop.blogPrompt.customName
 *     gptWorkshop.blogPrompt.updatedAt
 */

const SettingsModule = (() => {
  const LS_KEY_TEXT = "gptWorkshop.blogPrompt.customText";
  const LS_KEY_NAME = "gptWorkshop.blogPrompt.customName";
  const LS_KEY_UPDATED = "gptWorkshop.blogPrompt.updatedAt";

  let onDataReset = null; // async () => void  (실제 삭제 후 화면 갱신은 app-core가 담당)
  let onViewAllErrors = null; // () => void (기존 오류 목록 팝업을 열도록 app-core가 연결)
  let bound = false; // 이벤트 연결 성공 여부(중복 연결 방지 + 상태 조회용)

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

  function setOnDataReset(fn) {
    onDataReset = fn;
  }

  function setOnViewAllErrors(fn) {
    onViewAllErrors = fn;
  }

  function isReady() {
    return bound;
  }

  function els() {
    return {
      overlay: document.getElementById("popup-settings-overlay"),
      openBtn: document.getElementById("settings-open-btn"),
      closeBtn: document.getElementById("settings-close-btn"),
      loginStatus: document.getElementById("settings-login-status"),
      logoutBtn: document.getElementById("settings-logout-btn"),
      workerUrl: document.getElementById("settings-worker-url"),
      workerStatus: document.getElementById("settings-worker-status"),
      workerCheckBtn: document.getElementById("settings-worker-check-btn"),
      promptCurrent: document.getElementById("settings-prompt-current"),
      promptStatus: document.getElementById("settings-prompt-status"),
      promptFileInput: document.getElementById("settings-prompt-file-input"),
      promptResetBtn: document.getElementById("settings-prompt-reset-btn"),
      errorList: document.getElementById("settings-error-list"),
      errorsViewBtn: document.getElementById("settings-errors-view-btn"),
      errorsClearBtn: document.getElementById("settings-errors-clear-btn"),
      postCount: document.getElementById("settings-post-count"),
      dataResetOpenBtn: document.getElementById("settings-data-reset-open-btn"),
      resetOverlay: document.getElementById("popup-settings-reset-confirm-overlay"),
      resetCloseBtn: document.getElementById("settings-data-reset-close-btn"),
      resetCancelBtn: document.getElementById("settings-data-reset-cancel-btn"),
      resetOkBtn: document.getElementById("settings-data-reset-ok-btn"),
    };
  }

  /* ---------------------------------------------------------- 계정 ---------------------------------------------------------- */
  function renderAccountStatus() {
    const { loginStatus } = els();
    try {
      loginStatus.textContent = AuthModule.isLoggedIn() ? "로그인됨" : "로그인 필요";
    } catch (error) {
      loginStatus.textContent = "-";
    }
  }

  function handleLogout() {
    closePopup();
    // 로그아웃 실제 처리(세션 정리/화면 전환)는 기존 AuthModule.logout()을 그대로 호출한다.
    AuthModule.logout();
  }

  /* ---------------------------------------------------------- 작업 서버 ---------------------------------------------------------- */
  function renderWorkerAddress() {
    const { workerUrl, workerStatus } = els();
    try {
      workerUrl.textContent = typeof getWorkerBaseUrl === "function" ? getWorkerBaseUrl() : "-";
    } catch (error) {
      workerUrl.textContent = "-";
    }
    workerStatus.textContent = "";
  }

  // worker-api-module.js는 수정하지 않는다. 기존 로직만으로 상태 확인이 어려우므로
  // 여기서는 주소가 실제로 응답 가능한지(네트워크 도달 여부)만 가볍게 확인한다.
  // 실패해도 주소 표시 자체는 항상 정상 동작한다.
  async function handleWorkerCheck() {
    const { workerStatus, workerCheckBtn } = els();
    workerCheckBtn.disabled = true;
    workerStatus.textContent = "확인 중...";
    try {
      const base = typeof getWorkerBaseUrl === "function" ? getWorkerBaseUrl() : "";
      if (!base) throw new Error("주소 없음");
      await fetch(base, { method: "GET", mode: "no-cors", cache: "no-store" });
      workerStatus.textContent = "✅ 서버에 연결할 수 있습니다.";
    } catch (error) {
      workerStatus.textContent = "⚠️ 서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.";
    } finally {
      workerCheckBtn.disabled = false;
    }
  }

  /* ---------------------------------------------------------- 블로그 지시서 관리 ---------------------------------------------------------- */
  function hasCustomPrompt() {
    try {
      return !!(localStorage.getItem(LS_KEY_TEXT) || "").trim();
    } catch (error) {
      return false;
    }
  }

  function renderPromptStatus() {
    const { promptCurrent, promptStatus } = els();
    try {
      if (hasCustomPrompt()) {
        const name = localStorage.getItem(LS_KEY_NAME) || "이름 없음";
        const updatedAt = localStorage.getItem(LS_KEY_UPDATED) || "";
        promptCurrent.textContent = `사용자 등록 지시서 (${name})`;
        promptStatus.textContent = updatedAt ? `등록일: ${formatDate(updatedAt)}` : "";
      } else {
        promptCurrent.textContent = "기본 최신 지시서";
        promptStatus.textContent = "";
      }
    } catch (error) {
      ErrorLogModule.logError({
        module: "settings-module",
        message: "지시서 상태를 확인하지 못했습니다",
        detail: error.message,
        relatedId: null,
      });
      promptCurrent.textContent = "-";
      promptStatus.textContent = "[settings-module] 지시서 상태를 확인하지 못했습니다.";
    }
  }

  function handlePromptFileChange(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        if (!text.trim()) {
          els().promptStatus.textContent = "[settings-module] 선택한 TXT 파일 내용이 비어 있습니다.";
          return;
        }
        localStorage.setItem(LS_KEY_TEXT, text);
        localStorage.setItem(LS_KEY_NAME, file.name);
        localStorage.setItem(LS_KEY_UPDATED, new Date().toISOString());
        renderPromptStatus();
      } catch (error) {
        ErrorLogModule.logError({
          module: "settings-module",
          message: "지시서 등록에 실패했습니다",
          detail: error.message,
          relatedId: null,
        });
        els().promptStatus.textContent = "[settings-module] 지시서 등록에 실패했습니다.";
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      els().promptStatus.textContent = "[settings-module] TXT 파일을 읽지 못했습니다.";
      input.value = "";
    };
    reader.readAsText(file, "utf-8");
  }

  function handlePromptReset() {
    try {
      localStorage.removeItem(LS_KEY_TEXT);
      localStorage.removeItem(LS_KEY_NAME);
      localStorage.removeItem(LS_KEY_UPDATED);
    } catch (error) {
      // localStorage 접근 불가 시에도 화면 갱신은 계속 진행한다.
    }
    renderPromptStatus();
  }

  /* ---------------------------------------------------------- 오류 목록 ---------------------------------------------------------- */
  // v1.6(7장): 설정창 오류 목록 카드에도 사용자 친화 문구를 적용한다.
  // app-core.js의 friendlyErrorTitle과 동일한 규칙을 이 모듈 안에 독립적으로
  // 둔다(모듈 간 직접 의존을 만들지 않기 위해 — 다른 신규 모듈과 동일한 패턴).
  function friendlyErrorTitle(e) {
    if (e.module === "upload-module" && e.message === "필수 파일 누락") {
      return "블로그자료 ZIP 구조 오류";
    }
    return `[${e.module}] ${e.message}`;
  }

  function renderErrorList() {
    const { errorList } = els();
    let errors = [];
    try {
      errors = ErrorLogModule.getAllErrors().slice().reverse().slice(0, 5);
    } catch (error) {
      errorList.innerHTML = `<div class="archive-item--empty">최근 오류를 불러오지 못했습니다.</div>`;
      return;
    }
    if (!errors.length) {
      errorList.innerHTML = `<li class="archive-item--empty">최근 오류 없음<br />오류 발생 시 이곳에 표시 예정입니다.</li>`;
      return;
    }
    errorList.innerHTML = errors
      .map(
        (e) => `
        <li class="error-item">
          <div class="error-item__title">${escapeHtml(friendlyErrorTitle(e))}</div>
          <div class="error-item__meta">${formatDate(e.createdAt)}</div>
        </li>`
      )
      .join("");
  }

  function handleClearErrors() {
    try {
      ErrorLogModule.clearErrors();
    } catch (error) {
      // 오류 기록 초기화 실패는 화면을 막지 않는다.
    }
    renderErrorList();
  }

  function handleViewAllErrors() {
    if (typeof onViewAllErrors === "function") onViewAllErrors();
  }

  /* ---------------------------------------------------------- 데이터 관리 ---------------------------------------------------------- */
  async function renderPostCount() {
    const { postCount } = els();
    try {
      const posts = await StorageModule.getAllPosts();
      postCount.textContent = (Array.isArray(posts) ? posts.length : 0) + "개";
    } catch (error) {
      postCount.textContent = "-";
    }
  }

  function openResetConfirm() {
    els().resetOverlay.classList.add("popup-overlay--open");
  }

  function closeResetConfirm() {
    els().resetOverlay.classList.remove("popup-overlay--open");
  }

  async function handleResetConfirmed() {
    const { resetOkBtn } = els();
    resetOkBtn.disabled = true;
    try {
      if (typeof onDataReset === "function") {
        await onDataReset();
      }
    } catch (error) {
      ErrorLogModule.logError({
        module: "settings-module",
        message: "게시판 데이터 초기화에 실패했습니다",
        detail: error.message,
        relatedId: null,
      });
    } finally {
      resetOkBtn.disabled = false;
    }
    closeResetConfirm();
    await renderPostCount();
  }

  /* ---------------------------------------------------------- 팝업 열기/닫기 ---------------------------------------------------------- */
  function safeRender(fn) {
    try {
      fn();
    } catch (error) {
      // 섹션 하나가 실패해도 다른 섹션 렌더링/팝업 자체는 계속 진행한다.
    }
  }

  function openPopup() {
    const { overlay } = els();
    if (!overlay) return;
    safeRender(renderAccountStatus);
    safeRender(renderWorkerAddress);
    safeRender(renderPromptStatus);
    safeRender(renderErrorList);
    safeRender(renderPostCount);
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const { overlay } = els();
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  // DOM 요소가 없으면 조용히 종료하고(예외를 던지지 않음), 여러 번 호출돼도
  // 이벤트가 중복 연결되지 않는다. 성공 여부는 isReady()로 확인할 수 있다.
  // 이 모듈이 켜지지 않아도(설정 아이콘이 반응하지 않아도) 업로드/게시판/저장
  // 같은 기본 기능에는 영향이 없다(app-core.js가 별도로 처리).
  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const e = els();
    const required = [
      e.overlay, e.openBtn, e.closeBtn, e.logoutBtn, e.workerCheckBtn,
      e.promptFileInput, e.promptResetBtn, e.errorsViewBtn, e.errorsClearBtn,
      e.dataResetOpenBtn, e.resetOverlay, e.resetCloseBtn, e.resetCancelBtn, e.resetOkBtn,
    ];
    if (required.some((el) => !el)) return;

    try {
      e.openBtn.addEventListener("click", openPopup);
      e.closeBtn.addEventListener("click", closePopup);

      e.logoutBtn.addEventListener("click", handleLogout);

      e.workerCheckBtn.addEventListener("click", handleWorkerCheck);

      e.promptFileInput.addEventListener("change", handlePromptFileChange);
      e.promptResetBtn.addEventListener("click", handlePromptReset);

      e.errorsViewBtn.addEventListener("click", handleViewAllErrors);
      e.errorsClearBtn.addEventListener("click", handleClearErrors);

      e.dataResetOpenBtn.addEventListener("click", openResetConfirm);
      e.resetCloseBtn.addEventListener("click", closeResetConfirm);
      e.resetCancelBtn.addEventListener("click", closeResetConfirm);
      e.resetOkBtn.addEventListener("click", handleResetConfirmed);

      bound = true;
    } catch (error) {
      // 이벤트 연결 도중 실패해도 상위(app-core.js)로 예외를 던지지 않는다.
      bound = false;
    }
  }

  return {
    bindEvents,
    setOnDataReset,
    setOnViewAllErrors,
    isReady,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  try {
    SettingsModule.bindEvents();
  } catch (error) {
    // 최후의 방어선: 여기서도 실패하면 조용히 무시한다(설정 기능만 비활성화되고
    // 업로드/게시판/저장 같은 기본 기능에는 영향이 없다).
  }
});
