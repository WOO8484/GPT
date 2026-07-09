/**
 * upload-confirm-module.js
 *
 * 업로드 다이어트(v1.8.6): ZIP 선택 즉시 파싱 → 성공한 글만 자동 저장 →
 * 성공/실패 개수 + 카테고리(또는 글 제목)별 성공/실패 한 줄만 보여주는
 * 결과 카드 표시. 확인 팝업/체크리스트/저장 전 미리보기/[게시판에 N개
 * 저장] 버튼은 없앴다(상세 보기·문제 확인·경고 표시 없음).
 *
 * 흐름:
 *   ZIP 선택 → UploadModule.setZipFile()로 파싱
 *   → 파싱 실패: 오류 카드만 표시(원인 상세는 화면에 늘어놓지 않는다)
 *   → 파싱 성공: 성공한 글(들)을 즉시 자동 저장(app-core.js 콜백에 위임)
 *     → 결과 카드(전체/성공/실패 개수 + 한 줄 목록 + [글 목록으로 이동][닫기])
 *
 * 이 모듈이 호출하는 기존 공개 API(모두 수정하지 않음):
 * - UploadModule.setZipFile / getCheckStatus / buildPost / buildCategoryPosts / reset
 * - ErrorLogModule.logError (문제 발생 시 기록용 — 화면에는 노출하지 않는다)
 *
 * 실제 저장(LibraryModule.savePost 호출 등)은 app-core.js가 등록한 콜백
 * (setOnAutoSave)에 위임한다. 이 모듈은 LibraryModule/StorageModule을
 * 직접 호출하지 않는다.
 *
 * 안전 기준(신규 모듈 안전 연결 지침, 변경 없음):
 * - 기본 업로드/저장 흐름 자체는 app-core.js가 항상 보장하며, 이 모듈이
 *   정상 초기화되지 못하면 app-core.js가 자체 대체 흐름(fallback)으로
 *   zip-file-input을 대신 처리한다.
 * - bindEvents()는 필요한 DOM 요소가 없으면 예외를 던지지 않고 조용히
 *   종료하며, 성공 여부는 isReady()로 외부에 알린다.
 * - bindEvents()가 여러 번 호출되어도 이벤트가 중복 연결되지 않는다.
 */

const UploadConfirmModule = (() => {
  let onAutoSavePost = null; // async (post) => boolean(성공 시 true)
  let onGoToBoard = null; // () => void — [글 목록으로 이동] 클릭 시 호출
  let bound = false; // 이벤트 연결 성공 여부(중복 연결 방지 + 상태 조회용)

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function logSafe(message, detail, relatedId) {
    try {
      if (typeof ErrorLogModule !== "undefined") {
        ErrorLogModule.logError({ module: "upload-confirm-module", message, detail, relatedId: relatedId || null });
      }
    } catch (error) {
      // 오류 기록 자체가 실패해도 화면 동작을 막지 않는다.
    }
  }

  function setOnAutoSave(fn) {
    onAutoSavePost = fn;
  }

  function setOnGoToBoard(fn) {
    onGoToBoard = fn;
  }

  function isReady() {
    return bound;
  }

  function els() {
    return {
      overlay: document.getElementById("popup-upload-confirm-overlay"),
      errorBox: document.getElementById("upload-confirm-error"),
      errorTitle: document.getElementById("upload-confirm-error-title"),
      errorDetail: document.getElementById("upload-confirm-error-detail"),
      resultBox: document.getElementById("upload-confirm-result"),
      resultSummary: document.getElementById("upload-confirm-result-summary"),
      resultList: document.getElementById("upload-confirm-result-list"),
      resultFailNotice: document.getElementById("upload-confirm-result-fail-notice"),
      goToBoardBtn: document.getElementById("upload-confirm-goto-board-btn"),
      closeBtn: document.getElementById("upload-confirm-close-btn"),
      errorCloseBtn: document.getElementById("upload-confirm-error-close-btn"),
      resultCloseBtn: document.getElementById("upload-confirm-result-close-btn"),
      fileInput: document.getElementById("zip-file-input"),
      fileNameEl: document.getElementById("upload-filename"),
    };
  }

  // 사용자 화면에는 짧은 안내만 보여준다. 상세 원인은 ErrorLogModule에만 남는다.
  function buildFriendlyUploadError(reason) {
    return {
      title: "블로그자료 ZIP 구조가 올바르지 않습니다.",
      lines: [
        "프로그램 ZIP, Claude 작업 ZIP, 일반 압축파일은 업로드 대상이 아닙니다.",
        "GPT 공작소 블로그자료 ZIP을 업로드하세요.",
      ],
      detail: reason || "알 수 없는 오류",
    };
  }

  function showErrorState(friendly) {
    const { errorBox, errorTitle, errorDetail, resultBox } = els();
    if (!errorBox || !errorTitle || !errorDetail) return;
    errorTitle.textContent = friendly.title || "";

    let html = "";
    if (Array.isArray(friendly.lines)) {
      html += friendly.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    }
    if (friendly.detail) {
      html += `<p class="notice-text">${escapeHtml(friendly.detail)}</p>`;
    }
    errorDetail.innerHTML = html;
    errorBox.classList.remove("hidden");
    if (resultBox) resultBox.classList.add("hidden");
  }

  // 결과 카드: 성공/실패 개수 + 한 줄 목록만 보여준다("경고"/"상세 보기"/
  // "문제 확인" 없음). rows: [{ label, ok }]
  function showResultState(rows, successCount, failCount) {
    const { errorBox, resultBox, resultSummary, resultList, resultFailNotice } = els();
    if (!errorBox || !resultBox || !resultSummary || !resultList) return;
    errorBox.classList.add("hidden");
    resultBox.classList.remove("hidden");

    const total = successCount + failCount;
    resultSummary.textContent = `전체 ${total}개 · 성공 ${successCount}개 · 실패 ${failCount}개`;

    resultList.innerHTML = rows
      .map(
        (r) => `
        <li class="check-item">
          <span>${escapeHtml(r.label)}</span>
          <span class="check-item__status ${r.ok ? "check-item__status--ok" : "check-item__status--missing"}">${r.ok ? "성공" : "실패"}</span>
        </li>`
      )
      .join("");

    if (resultFailNotice) resultFailNotice.classList.toggle("hidden", failCount === 0);
  }

  function openOverlay() {
    const { overlay } = els();
    if (overlay) overlay.classList.add("popup-overlay--open");
  }

  function closeOverlay() {
    const { overlay } = els();
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function resetFileInput() {
    const { fileInput, fileNameEl } = els();
    if (fileInput) fileInput.value = "";
    if (fileNameEl) fileNameEl.textContent = "";
  }

  // 로그아웃 등 외부(app-core.js)에서 호출하는 안전한 초기화.
  function reset() {
    try {
      UploadModule.reset();
    } catch (error) {
      logSafe("업로드 임시 데이터를 정리하지 못했습니다", error && error.message, null);
    }
    try {
      resetFileInput();
      closeOverlay();
    } catch (error) {
      logSafe("업로드 확인 상태를 초기화하지 못했습니다", error && error.message, null);
    }
  }

  // post 배열을 순서대로 자동 저장한다. 저장은 app-core.js 콜백에 위임하고,
  // 이 모듈은 결과(성공/실패)만 모은다.
  async function autoSaveAll(posts, labelFor) {
    const rows = [];
    let successCount = 0;
    for (const post of posts) {
      let ok = false;
      try {
        ok = typeof onAutoSavePost === "function" ? await onAutoSavePost(post) : false;
      } catch (error) {
        ok = false;
        logSafe("자동 저장 실패", error && error.message, post ? post.id : null);
      }
      if (ok) successCount += 1;
      rows.push({ label: labelFor(post), ok });
    }
    return { rows, successCount, failCount: rows.length - successCount };
  }

  async function handleZipSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const { fileNameEl } = els();
      if (fileNameEl) fileNameEl.textContent = file.name;
    } catch (error) {
      // 파일명 표시 실패는 치명적이지 않으므로 계속 진행한다.
    }

    let result;
    try {
      result = await UploadModule.setZipFile(file);
    } catch (error) {
      logSafe("ZIP 처리에 실패했습니다", error && error.message, null);
      showErrorState(buildFriendlyUploadError(error.message));
      openOverlay();
      resetFileInput();
      return;
    }

    if (!result.success) {
      logSafe("ZIP 파싱 실패", result.reason, null);
      showErrorState(buildFriendlyUploadError(result.reason));
      openOverlay();
      resetFileInput();
      return;
    }

    try {
      if (result.isMasterBundle) {
        const checkStatus = UploadModule.getCheckStatus();
        const posts = UploadModule.buildCategoryPosts() || [];
        const saveResult = await autoSaveAll(posts, (post) => post.category || post.title);

        // 파싱 자체가 실패한 카테고리(=post가 아예 만들어지지 않음)도 실패로
        // 표시한다. checkStatus.categoryResults는 파싱 성공/실패 전체(9개)를
        // 담고 있고, posts는 파싱에 성공한 것만 담고 있다.
        let postIdx = 0;
        const rows = (checkStatus.categoryResults || []).map((r) => {
          if (!r.ok) return { label: r.categoryName, ok: false };
          const saved = saveResult.rows[postIdx];
          postIdx += 1;
          return { label: r.categoryName, ok: !!(saved && saved.ok) };
        });
        const successCount = rows.filter((r) => r.ok).length;
        showResultState(rows, successCount, rows.length - successCount);
        openOverlay();
        resetFileInput();
        return;
      }

      const post = UploadModule.buildPost();
      if (!post) {
        showErrorState(buildFriendlyUploadError("업로드 데이터를 구성하지 못했습니다."));
        openOverlay();
        resetFileInput();
        return;
      }
      const saveResult = await autoSaveAll([post], (p) => p.title);
      showResultState(saveResult.rows, saveResult.successCount, saveResult.failCount);
      openOverlay();
      resetFileInput();
    } catch (error) {
      logSafe("업로드 결과를 표시하지 못했습니다", error && error.message, null);
      showErrorState({
        title: "업로드 처리 중 문제가 발생했습니다.",
        lines: ["파일을 다시 선택해 시도해주세요."],
      });
      openOverlay();
      resetFileInput();
    } finally {
      try {
        UploadModule.reset();
      } catch (error) {
        // 무시: 내부 임시 상태 정리 실패가 화면 동작을 막지 않는다.
      }
    }
  }

  // DOM 요소가 없으면 조용히 종료하고(예외를 던지지 않음), 여러 번 호출돼도
  // 이벤트가 중복 연결되지 않는다. 성공 여부는 isReady()로 확인할 수 있다.
  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const { fileInput, closeBtn, goToBoardBtn, overlay, errorBox, resultBox } = els();
    if (!fileInput || !closeBtn || !overlay || !errorBox || !resultBox) {
      // 필요한 팝업 마크업이 없다 — 이 모듈은 기능을 켜지 않고 조용히 빠진다.
      // 기본 업로드 흐름은 app-core.js의 대체(fallback) 로직이 대신 처리한다.
      return;
    }

    try {
      closeBtn.addEventListener("click", () => closeOverlay());

      const { errorCloseBtn, resultCloseBtn } = els();
      if (errorCloseBtn) errorCloseBtn.addEventListener("click", () => closeOverlay());
      if (resultCloseBtn) resultCloseBtn.addEventListener("click", () => closeOverlay());

      if (goToBoardBtn) {
        goToBoardBtn.addEventListener("click", () => {
          closeOverlay();
          if (typeof onGoToBoard === "function") {
            try {
              onGoToBoard();
            } catch (error) {
              logSafe("게시판으로 이동하지 못했습니다", error && error.message, null);
            }
          }
        });
      }

      // 중요: zip-file-input 연결을 가장 마지막에 둔다. 이 앞에서 무언가
      // 실패하면 bound가 true로 바뀌지 않고 fileInput에도 리스너가 붙지
      // 않으므로, app-core.js의 대체(fallback) 흐름이 안전하게 대신
      // 연결된다(이벤트 중복 연결 방지).
      fileInput.addEventListener("change", handleZipSelected);

      bound = true;
    } catch (error) {
      // 이벤트 연결 도중 실패해도 상위(app-core.js)로 예외를 던지지 않는다.
      logSafe("이벤트 연결에 실패했습니다", error && error.message, null);
      bound = false;
    }
  }

  return {
    bindEvents,
    setOnAutoSave,
    setOnGoToBoard,
    isReady,
    reset,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  try {
    UploadConfirmModule.bindEvents();
  } catch (error) {
    // 최후의 방어선: 여기서도 실패하면 조용히 무시하고 다른 스크립트 실행에
    // 영향을 주지 않는다(app-core.js가 isReady()로 상태를 확인해 대체 처리한다).
  }
});
