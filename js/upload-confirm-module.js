/**
 * upload-confirm-module.js (신규 모듈)
 * 업로드 성공 후 저장 전 확인 팝업 + 미리보기를 전담한다.
 *
 * 흐름(작업지침서 8장):
 *   ZIP 선택 → UploadModule.setZipFile()로 점검
 *   → 점검 실패: 이 팝업 안에서 오류 상태만 표시
 *   → 점검 통과: 요약(제목/날짜/이미지 수/필수 파일 확인) + 체크리스트
 *     + 저장 전 미리보기를 같은 팝업 안에 표시
 *   → [취소]: 임시 데이터 폐기, 게시판 상태 변화 없음
 *   → [게시판에 저장]: app-core.js가 등록한 콜백(setOnConfirmSave)을 호출해
 *     실제 저장/게시판 갱신을 위임한다. 이 모듈은 LibraryModule/StorageModule을
 *     직접 호출하지 않는다(연결은 app-core.js 담당).
 *
 * 이 모듈이 직접 호출하는 기존 공개 API(모두 수정하지 않음):
 * - UploadModule.setZipFile / getCheckStatus / buildPost / reset
 * - PreviewModule.renderPreview (렌더링 핵심 로직은 그대로 재사용, 재작성하지 않음)
 * - ErrorLogModule.logError (문제 발생 시 기록용)
 *
 * 안전 기준(신규 모듈 안전 연결 지침):
 * - 이 모듈은 "선택 기능(확인 팝업 + 미리보기)"만 담당한다. 기본 업로드/저장
 *   흐름 자체는 app-core.js가 항상 보장하며, 이 모듈이 정상 초기화되지 못하면
 *   app-core.js가 자체 대체 흐름(fallback)으로 zip-file-input을 대신 처리한다.
 * - bindEvents()는 필요한 DOM 요소가 없으면 예외를 던지지 않고 조용히 종료하며,
 *   성공 여부는 isReady()로 외부(app-core.js)에 알린다.
 * - bindEvents()가 여러 번 호출되어도 이벤트가 중복 연결되지 않는다.
 */

const UploadConfirmModule = (() => {
  let pendingPost = null;
  let onConfirmSave = null; // async (post) => boolean(성공 시 true)
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

  function logSafe(message, detail, relatedId) {
    try {
      if (typeof ErrorLogModule !== "undefined") {
        ErrorLogModule.logError({ module: "upload-confirm-module", message, detail, relatedId: relatedId || null });
      }
    } catch (error) {
      // 오류 기록 자체가 실패해도 화면 동작을 막지 않는다.
    }
  }

  function setOnConfirmSave(fn) {
    onConfirmSave = fn;
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
      body: document.getElementById("upload-confirm-body"),
      summary: document.getElementById("upload-confirm-summary"),
      checklist: document.getElementById("upload-confirm-checklist"),
      warning: document.getElementById("upload-confirm-warning"),
      preview: document.getElementById("upload-confirm-preview"),
      cancelBtn: document.getElementById("upload-confirm-cancel-btn"),
      saveBtn: document.getElementById("upload-confirm-save-btn"),
      closeBtn: document.getElementById("upload-confirm-close-btn"),
      fileInput: document.getElementById("zip-file-input"),
      fileNameEl: document.getElementById("upload-filename"),
    };
  }

  // 오류 문구 개선(작업지침서 12장): 모듈명 + 쉬운 한글 설명을 기본으로 하고,
  // 실제 원인은 "상세"로 덧붙인다. upload-module.js 내부 메시지는 수정하지 않는다.
  function buildFriendlyUploadError(reason) {
    return {
      title: "[upload-module] 블로그자료 ZIP 구조가 올바르지 않습니다.",
      lines: [
        "블로그자료 ZIP만 업로드할 수 있습니다.",
        "프로그램 ZIP, Claude 전달용 ZIP, 일반 압축파일은 업로드 대상이 아닙니다.",
        "ZIP 루트에 metadata.json, content.html, images/가 있어야 합니다.",
        "상세: " + (reason || "알 수 없는 오류"),
      ],
    };
  }

  function showErrorState(friendly) {
    const { errorBox, errorTitle, errorDetail, body } = els();
    if (!errorBox || !errorTitle || !errorDetail || !body) return;
    errorTitle.textContent = friendly.title;
    errorDetail.innerHTML = friendly.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    errorBox.classList.remove("hidden");
    body.classList.add("hidden");
  }

  function renderChecklist(checklist) {
    const { checklist: listEl } = els();
    if (!listEl) return;
    listEl.innerHTML = (checklist || [])
      .map((item) => {
        const stateClass = item.ok ? "check-item__status--ok" : item.optional ? "check-item__status--warn" : "check-item__status--missing";
        const stateLabel = item.ok ? "확인" : item.optional ? "없음" : "누락";
        return `<li class="check-item"><span>${escapeHtml(item.label)}</span><span class="check-item__status ${stateClass}">${stateLabel}</span></li>`;
      })
      .join("");
  }

  function renderSummary(post) {
    const { summary } = els();
    if (!summary) return;
    const meta = post.metadata || {};
    const imageCount = Object.keys(post.imageFiles || {}).length;
    const dateValue = meta.updatedAt || meta.date || post.createdAt;

    summary.innerHTML = `
      <div class="detail-row"><span class="detail-row__label">제목</span><span>${escapeHtml(post.title)}</span></div>
      <div class="detail-row"><span class="detail-row__label">날짜</span><span>${escapeHtml(formatDate(dateValue))}</span></div>
      <div class="detail-row"><span class="detail-row__label">이미지</span><span>${imageCount}개</span></div>
    `;
  }

  function renderWarning(unresolvedImageRefs) {
    const { warning } = els();
    if (!warning) return;
    if (!unresolvedImageRefs || !unresolvedImageRefs.length) {
      warning.innerHTML = "";
      return;
    }
    warning.innerHTML = `<p class="notice-text notice-text--warning">본문에서 참조하지만 ZIP 안에 없는 이미지: ${unresolvedImageRefs
      .map((s) => escapeHtml(s))
      .join(", ")}</p>`;
  }

  // preview-module.js의 공개 렌더링 API(renderPreview)를 그대로 호출해 결과만 표시한다.
  // 핵심 렌더링/보안 필터링 로직은 이 모듈에서 재작성하지 않는다.
  function renderPreview(post) {
    const { preview } = els();
    if (!preview) return;
    try {
      const rendered = PreviewModule.renderPreview(post);
      preview.innerHTML = rendered ? rendered.safeHtml : "<p class=\"notice-text\">미리보기를 표시할 수 없습니다.</p>";
    } catch (error) {
      logSafe("저장 전 미리보기를 표시하지 못했습니다", error && error.message, post ? post.id : null);
      preview.innerHTML = "<p class=\"notice-text\">미리보기를 표시하지 못했습니다.</p>";
    }
  }

  function showConfirmState(post, checkStatus) {
    const { errorBox, body } = els();
    if (!errorBox || !body) return;
    errorBox.classList.add("hidden");
    body.classList.remove("hidden");
    renderSummary(post);
    renderChecklist(checkStatus.checklist);
    renderWarning(checkStatus.unresolvedImageRefs);
    renderPreview(post);
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

  // 취소 또는 저장 완료 후 임시 업로드 데이터를 폐기한다(게시판 상태는 그대로 유지).
  function discardPending() {
    pendingPost = null;
    try {
      UploadModule.reset();
    } catch (error) {
      logSafe("업로드 임시 데이터를 정리하지 못했습니다", error && error.message, null);
    }
  }

  // 로그아웃 등 외부(app-core.js)에서 호출하는 안전한 초기화. 팝업/입력 요소가
  // 없어도 예외를 던지지 않는다.
  function reset() {
    discardPending();
    try {
      resetFileInput();
      closeOverlay();
    } catch (error) {
      logSafe("업로드 확인 상태를 초기화하지 못했습니다", error && error.message, null);
    }
  }

  async function handleZipSelected(event) {
    const file = event.target.files && event.target.files[0];
    discardPending();
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
      logSafe("업로드 확인 팝업을 표시하지 못했습니다", error && error.message, null);
      showErrorState(buildFriendlyUploadError(error.message));
      openOverlay();
      return;
    }

    if (!result.success) {
      showErrorState(buildFriendlyUploadError(result.reason));
      openOverlay();
      return;
    }

    try {
      const checkStatus = UploadModule.getCheckStatus();
      pendingPost = UploadModule.buildPost();
      if (!pendingPost) {
        showErrorState(buildFriendlyUploadError("업로드 데이터를 구성하지 못했습니다."));
        openOverlay();
        return;
      }
      showConfirmState(pendingPost, checkStatus);
      openOverlay();
    } catch (error) {
      // 확인/미리보기 화면 렌더링 실패 — 기본 업로드 점검 자체는 이미 통과했으므로
      // 오류 상태로 안내하고, 사용자가 파일을 다시 선택해 재시도할 수 있게 한다.
      logSafe("업로드 확인 팝업을 표시하지 못했습니다", error && error.message, null);
      pendingPost = null;
      showErrorState({
        title: "[upload-confirm-module] 업로드 확인 팝업을 표시하지 못했습니다.",
        lines: ["파일을 다시 선택해 시도해주세요.", "문제가 반복되면 오류 목록을 확인해주세요."],
      });
      openOverlay();
    }
  }

  // DOM 요소가 없으면 조용히 종료하고(예외를 던지지 않음), 여러 번 호출돼도
  // 이벤트가 중복 연결되지 않는다. 성공 여부는 isReady()로 확인할 수 있다.
  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const { fileInput, cancelBtn, saveBtn, closeBtn, overlay, body, errorBox } = els();
    if (!fileInput || !cancelBtn || !saveBtn || !closeBtn || !overlay || !body || !errorBox) {
      // 필요한 팝업/버튼 마크업이 없다 — 이 모듈은 기능을 켜지 않고 조용히 빠진다.
      // 기본 업로드 흐름은 app-core.js의 대체(fallback) 로직이 대신 처리한다.
      return;
    }

    try {
      // 중요: zip-file-input 연결을 가장 마지막에 둔다. 이 앞에서 무언가
      // 실패하면 bound가 true로 바뀌지 않고 fileInput에도 리스너가 붙지
      // 않으므로, app-core.js의 대체(fallback) 흐름이 안전하게 대신
      // 연결된다(이벤트 중복 연결 방지).
      cancelBtn.addEventListener("click", () => {
        reset();
      });

      closeBtn.addEventListener("click", () => {
        closeOverlay();
      });

      saveBtn.addEventListener("click", async () => {
        if (!pendingPost || typeof onConfirmSave !== "function") return;
        saveBtn.disabled = true;
        try {
          const ok = await onConfirmSave(pendingPost);
          if (ok) reset();
        } catch (error) {
          logSafe("게시판 저장 콜백 실행에 실패했습니다", error && error.message, pendingPost ? pendingPost.id : null);
        } finally {
          saveBtn.disabled = false;
        }
      });

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
    setOnConfirmSave,
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
