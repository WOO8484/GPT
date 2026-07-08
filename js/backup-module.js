/**
 * backup-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할:
 * - 게시판 데이터(저장된 글 전체) JSON 내보내기
 * - JSON 백업 파일 다시 불러오기(복원)
 * - 사용자 등록 지시서(localStorage) 내보내기/불러오기(백업 파일에 함께 포함)
 * - 데이터 초기화 전 백업 안내(설정 팝업의 초기화 확인 문구에서 이 모듈을 안내)
 *
 * 안전 기준:
 * - 복원 전 반드시 확인 팝업을 표시한다(내용 요약 + [취소]/[복원하기]).
 * - 알 수 없는 key를 무단으로 덮어쓰지 않는다 — 백업 JSON에서 posts 배열과
 *   customPrompt(선택) 외의 필드는 읽지도, 쓰지도 않는다.
 * - localStorage를 통째로 지우는 동작은 전혀 하지 않는다.
 *
 * storage-module.js 내부 구조는 재작성하지 않는다. 이미 공개된
 * StorageModule.getAllPosts()/savePost()만 반복 호출해서 내보내기/복원을
 * 구현한다(단건 저장 API를 여러 번 호출하는 것은 기존 계약을 벗어나지 않는다).
 */

const BackupModule = (() => {
  const LS_KEY_TEXT = "gptWorkshop.blogPrompt.customText";
  const LS_KEY_NAME = "gptWorkshop.blogPrompt.customName";
  const LS_KEY_UPDATED = "gptWorkshop.blogPrompt.updatedAt";

  let bound = false;
  let pendingImportPayload = null;

  function isReady() {
    return bound;
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

  function formatFileStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function readCustomPrompt() {
    try {
      const text = localStorage.getItem(LS_KEY_TEXT) || "";
      if (!text.trim()) return null;
      return {
        text,
        name: localStorage.getItem(LS_KEY_NAME) || "",
        updatedAt: localStorage.getItem(LS_KEY_UPDATED) || "",
      };
    } catch (error) {
      return null;
    }
  }

  async function renderCounts() {
    const countEl = document.getElementById("backup-post-count");
    const promptEl = document.getElementById("backup-prompt-status");
    try {
      const posts = await StorageModule.getAllPosts();
      if (countEl) countEl.textContent = (Array.isArray(posts) ? posts.length : 0) + "개";
    } catch (error) {
      if (countEl) countEl.textContent = "-";
    }
    const custom = readCustomPrompt();
    if (promptEl) promptEl.textContent = custom ? `등록됨(${custom.name || "이름 없음"})` : "기본 지시서 사용 중";
  }

  async function handleExportClick() {
    const resultEl = document.getElementById("backup-export-result");
    if (resultEl) resultEl.textContent = "내보내는 중...";

    let posts = [];
    try {
      posts = await StorageModule.getAllPosts();
    } catch (error) {
      if (resultEl) resultEl.textContent = "[backup-module] 게시판 데이터를 불러오지 못했습니다.";
      return;
    }

    const payload = {
      app: "GPT공작소",
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      posts: Array.isArray(posts) ? posts : [],
      customPrompt: readCustomPrompt(),
    };

    try {
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gpt-gongjakso-backup-${formatFileStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (resultEl) resultEl.textContent = `✅ 글 ${payload.posts.length}개를 내보냈습니다.`;
    } catch (error) {
      if (resultEl) resultEl.textContent = "[backup-module] 내보내기에 실패했습니다. 브라우저 다운로드 설정을 확인해주세요.";
    }
  }

  function handleImportFileChange(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;

    const resultEl = document.getElementById("backup-import-result");
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || !Array.isArray(parsed.posts)) {
          if (resultEl) resultEl.textContent = "[backup-module] 올바른 백업 파일이 아닙니다(posts 배열이 없습니다).";
          return;
        }
        pendingImportPayload = parsed;
        openRestoreConfirm(parsed);
      } catch (error) {
        if (resultEl) resultEl.textContent = "[backup-module] JSON 파일을 읽지 못했습니다(형식 오류).";
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      if (resultEl) resultEl.textContent = "[backup-module] 파일을 읽지 못했습니다.";
      input.value = "";
    };
    reader.readAsText(file, "utf-8");
  }

  function openRestoreConfirm(parsed) {
    const overlay = document.getElementById("popup-backup-restore-confirm-overlay");
    const summaryEl = document.getElementById("backup-restore-summary");
    if (!overlay) return;
    if (summaryEl) {
      const promptNote = parsed.customPrompt && parsed.customPrompt.text ? ", 사용자 등록 지시서 1개" : "";
      summaryEl.textContent = `이 백업 파일에는 글 ${parsed.posts.length}개${promptNote}가 들어 있습니다. 내보낸 시각: ${formatDate(parsed.exportedAt)}`;
    }
    overlay.classList.add("popup-overlay--open");
  }

  function closeRestoreConfirm() {
    const overlay = document.getElementById("popup-backup-restore-confirm-overlay");
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  async function handleRestoreConfirmed() {
    if (!pendingImportPayload) {
      closeRestoreConfirm();
      return;
    }
    const okBtn = document.getElementById("backup-restore-ok-btn");
    const resultEl = document.getElementById("backup-import-result");
    if (okBtn) okBtn.disabled = true;

    try {
      let savedCount = 0;
      for (const post of pendingImportPayload.posts) {
        if (post && post.id) {
          await StorageModule.savePost(post);
          savedCount += 1;
        }
      }

      // 알 수 없는 key는 건드리지 않는다 - customPrompt가 실제로 있을 때만 정해진
      // 3개 key에만 반영한다.
      if (pendingImportPayload.customPrompt && pendingImportPayload.customPrompt.text) {
        try {
          localStorage.setItem(LS_KEY_TEXT, pendingImportPayload.customPrompt.text);
          localStorage.setItem(LS_KEY_NAME, pendingImportPayload.customPrompt.name || "");
          localStorage.setItem(LS_KEY_UPDATED, pendingImportPayload.customPrompt.updatedAt || new Date().toISOString());
        } catch (error) {
          // 지시서 복원 실패는 게시글 복원 결과에 영향을 주지 않는다.
        }
      }

      if (resultEl) resultEl.textContent = `✅ 글 ${savedCount}개를 복원했습니다.`;
      pendingImportPayload = null;
      closeRestoreConfirm();
      await renderCounts();

      // 게시판 화면 갱신은 app-core.js가 제공하는 안전한 공개 API로만 수행한다.
      try {
        if (window.GptCoreAPI && typeof GptCoreAPI.refreshBoard === "function") {
          await GptCoreAPI.refreshBoard();
        }
      } catch (error) {
        // 화면 갱신 실패해도 데이터 복원 자체는 이미 끝난 뒤이므로 별도 처리하지 않는다.
      }
    } catch (error) {
      if (resultEl) resultEl.textContent = "[backup-module] 복원 중 오류가 발생했습니다. 오류 목록을 확인해주세요.";
    } finally {
      if (okBtn) okBtn.disabled = false;
    }
  }

  function openPopup() {
    const overlay = document.getElementById("popup-backup-overlay");
    if (!overlay) return;
    const exportResultEl = document.getElementById("backup-export-result");
    const importResultEl = document.getElementById("backup-import-result");
    if (exportResultEl) exportResultEl.textContent = "";
    if (importResultEl) importResultEl.textContent = "";
    renderCounts();
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const overlay = document.getElementById("popup-backup-overlay");
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return;
    const openBtn = document.getElementById("settings-backup-open-btn");
    const closeBtn = document.getElementById("backup-close-btn");
    const overlay = document.getElementById("popup-backup-overlay");
    const exportBtn = document.getElementById("backup-export-btn");
    const importInput = document.getElementById("backup-import-file-input");
    const restoreOverlay = document.getElementById("popup-backup-restore-confirm-overlay");
    const restoreCloseBtn = document.getElementById("backup-restore-confirm-close-btn");
    const restoreCancelBtn = document.getElementById("backup-restore-cancel-btn");
    const restoreOkBtn = document.getElementById("backup-restore-ok-btn");

    if (!openBtn || !closeBtn || !overlay || !exportBtn || !importInput || !restoreOverlay || !restoreCloseBtn || !restoreCancelBtn || !restoreOkBtn) {
      return;
    }

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);
      exportBtn.addEventListener("click", handleExportClick);
      importInput.addEventListener("change", handleImportFileChange);
      restoreCloseBtn.addEventListener("click", () => {
        pendingImportPayload = null;
        closeRestoreConfirm();
      });
      restoreCancelBtn.addEventListener("click", () => {
        pendingImportPayload = null;
        closeRestoreConfirm();
      });
      restoreOkBtn.addEventListener("click", handleRestoreConfirmed);
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

window.BackupModule = BackupModule;
