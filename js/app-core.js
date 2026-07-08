/**
 * app-core.js
 * 연결(wiring) 전담 계층 + 신규 모듈 안전 연결.
 *
 * 이 파일이 직접 소유하는 것:
 * - 공용 팝업 유틸(showPopup/closePopup 등) — 여러 모듈이 함께 쓰는 UI 인프라
 * - 게시판(board) 목록 렌더링 — 기본 화면은 최신 글 1개만, 전체 게시판 팝업은 전체 목록
 * - 미리보기 팝업 — 게시판 글 클릭 시 표시
 * - 블로그 저장 확인 팝업 → BloggerSaveModule.runSaveFlow 트리거
 * - 기본 업로드 흐름의 "최후 보루"(fallback) — 아래 안전 기준 참고
 * - v1.4: GptCoreAPI(신규 모듈 전용 공개 표면) + 생애주기 이벤트 통지
 *   (post-selected/upload-confirmed/board-saved/board-save-failed/
 *   blogger-save-result/data-reset)
 *
 * 이 파일이 소유하지 않는 것(각 전용 모듈이 자체적으로 이벤트 바인딩까지 담당):
 * - 업로드 확인/미리보기 팝업(선택 기능) → UploadConfirmModule
 * - 설정(계정/작업 서버/지시서 관리/오류 목록/데이터 관리, 선택 기능) → SettingsModule
 * - 블로그 지시서 복사(선택 기능) → PromptCopyModule
 * - v1.4 신규 8개 모듈(전부 선택 기능, GptCoreAPI를 통해서만 core와 통신):
 *   BloggerFinalPreviewModule / PackageDiagnosisModule / PostStatusModule /
 *   BackupModule / ErrorDictionaryModule / WorkerStatusModule /
 *   SaveHistoryModule / RetryModule
 *
 * ------------------------------------------------------------------
 * 신규 모듈 안전 연결 기준
 * ------------------------------------------------------------------
 * 1. 기본 기능(블로그자료 업로드 / 게시판 저장 / 글 선택 / R2 이미지 업로드 /
 *    Blogger 임시저장)은 신규 모듈이 죽어도 항상 살아 있어야 한다.
 * 2. 설정창 / 업로드 확인 팝업 / 지시서 관리 / 오류 목록 / v1.4의 8개 신규
 *    모듈은 모두 "선택 기능"이다. 오류가 나도 기본 업로드/저장 흐름은 계속
 *    써야 한다.
 * 3. 신규 모듈 초기화(setOnConfirmSave/setOnDataReset 연결, v1.4 신규
 *    모듈의 init() 호출 등)는 각각 독립된 safeInit()(try/catch)로 감싼다.
 *    한 모듈 실패가 다른 초기화를 막지 않는다.
 * 4. 신규 모듈 자신도 DOM 요소가 없으면 예외를 던지지 않고 조용히 종료하도록
 *    만들어져 있다(각 모듈 파일 참고). app-core.js는 그 결과를 isReady()로 확인한다.
 * 5. 이벤트 중복 연결 방지: 신규 업로드 확인 모듈이 정상 연결됐을 때만 그 모듈이
 *    zip-file-input을 담당하고, 그렇지 않을 때만 아래 "대체 업로드 흐름"이
 *    zip-file-input을 담당한다 — 항상 둘 중 하나만 연결된다. v1.4 신규
 *    모듈도 각자 bound 플래그로 자기 자신의 중복 바인딩을 막는다.
 * 6. 기존 안정화 모듈(AuthModule/UploadModule/LibraryModule/StorageModule/
 *    PreviewModule/R2ImageModule/WorkerApiModule/BloggerSaveModule 등) 내부
 *    로직은 이 파일에서 수정하지 않는다. 공개 함수 호출/콜백 연결만 한다.
 * 7. 신규 모듈(js 파일 + index.html script 태그 + 아래 safeInit 연결 + 팝업
 *    마크업 + 전용 CSS)을 통째로 제거해도, "대체 업로드 흐름"이 core 요소만
 *    사용하므로 블로그자료 업로드 → 게시판 저장은 계속 동작한다. v1.4의 8개
 *    신규 모듈은 각각 독립적으로 제거 가능하다(GptCoreAPI 호출부만 정리하면
 *    되고, 서로 다른 신규 모듈끼리는 직접 의존하지 않는다).
 * ------------------------------------------------------------------
 */

let selectedPostId = null; // 미리보기/블로그 저장 패널에 표시 중인 게시판 글 id

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

function statusBadgeClass(status) {
  if (status === "임시저장완료") return "status-badge--ok";
  if (status === "임시저장실패") return "status-badge--fail";
  return "status-badge--pending"; // 등록됨
}

// 신규 모듈 초기화 전용 안전 래퍼. 실패해도 예외를 밖으로 던지지 않고, 가능하면
// 오류 목록에 기록한 뒤 false를 돌려준다(호출부가 대체 동작을 선택할 수 있게).
function safeInit(moduleName, fn) {
  try {
    fn();
    return true;
  } catch (error) {
    try {
      if (typeof ErrorLogModule !== "undefined") {
        ErrorLogModule.logError({
          module: moduleName,
          message: "신규 모듈 초기화에 실패했습니다",
          detail: error && error.message,
          relatedId: null,
        });
      }
    } catch (logError) {
      // 오류 기록 자체가 실패해도 앱 진행을 막지 않는다.
    }
    return false;
  }
}

/* ----------------------------------------------------------
   v1.4: GptCoreAPI — 신규 모듈 전용 공개 연결 표면.
   ------------------------------------------------------------
   v1.4의 8개 신규 모듈(blogger-final-preview/package-diagnosis/post-status/
   backup/error-dictionary/worker-status/save-history/retry)은 이 객체를
   통해서만 core 상태(선택된 글/게시판 새로고침/저장 트리거/공용 팝업)에
   접근한다. 각 모듈은 app-core.js 내부 변수(selectedPostId 등)를 직접
   참조하지 않는다 — app-core.js 쪽 구현이 바뀌어도 신규 모듈은 영향을
   받지 않도록 하기 위한 안정된 경계다.

   registerLifecycleListener(moduleName, fn)로 등록해두면, 아래 이벤트가
   발생할 때마다 fn(eventName, payload)가 safeInit으로 감싸져 호출된다.
   한 리스너가 실패해도 다른 리스너 호출과 기본 흐름에는 영향이 없다.

   이벤트 목록:
   - "post-selected"      payload: { post }         글 선택/해제될 때마다
   - "upload-confirmed"   payload: { post }         업로드 확인 후 저장 시도 직전
   - "board-saved"        payload: { post }         게시판 저장 성공
   - "board-save-failed"  payload: { post }         게시판 저장 실패
   - "blogger-save-result"payload: { post, result } Blogger 임시저장 시도 결과
   - "data-reset"         payload: {}               게시판 데이터 초기화 완료
   ---------------------------------------------------------- */
const lifecycleListeners = [];

function registerLifecycleListener(moduleName, fn) {
  if (typeof fn !== "function") return;
  lifecycleListeners.push({ moduleName, fn });
}

function notifyLifecycle(eventName, payload) {
  lifecycleListeners.forEach(({ moduleName, fn }) => {
    safeInit(moduleName + ":" + eventName, () => fn(eventName, payload || {}));
  });
}

/* ----------------------------------------------------------
   공용 중앙 팝업 (업로드 대체 확인, 게시판 저장 완료/실패, R2 이미지 변환 진행,
   블로그 임시저장 완료/실패). 여러 모듈이 함께 쓰는 공용 UI 인프라다.
   ---------------------------------------------------------- */
function showPopup(title, bodyHtml) {
  document.getElementById("popup-title").textContent = title;
  document.getElementById("popup-body").innerHTML = bodyHtml;
  document.getElementById("popup-overlay").classList.add("popup-overlay--open");
}

function updatePopupBody(bodyHtml) {
  document.getElementById("popup-body").innerHTML = bodyHtml;
}

function closePopup() {
  document.getElementById("popup-overlay").classList.remove("popup-overlay--open");
}

function renderErrorsPopup() {
  const errors = ErrorLogModule.getAllErrors().slice().reverse();
  const list = document.getElementById("errors-list");
  // v1.5(A-6 추가 후보): 오류 상세 원인/조치는 오류 백과사전(선택 기능)에서 확인할
  // 수 있음을 안내하고, 오래된 오류는 정리해도 된다는 점을 함께 알린다.
  const hintHtml = `<p class="notice-text">오류의 원인/조치 방법은 설정 → 오류 목록 → 🩹 오류 백과사전에서 확인할 수 있습니다. 문제를 해결했다면 오래된 오류는 설정에서 초기화해도 됩니다.</p>`;
  if (!errors.length) {
    list.innerHTML = `<div class="archive-item--empty">기록된 오류가 없습니다.</div>${hintHtml}`;
    return;
  }
  list.innerHTML =
    errors
      .map(
        (e) => `
      <div class="error-item">
        <div class="error-item__title">[${escapeHtml(e.module)}] ${escapeHtml(e.message)}</div>
        ${e.detail ? `<div class="error-item__detail">${escapeHtml(e.detail)}</div>` : ""}
        <div class="error-item__meta">${formatDate(e.createdAt)}</div>
      </div>`
      )
      .join("") + hintHtml;
}

function showErrorsPopup() {
  try {
    renderErrorsPopup();
  } catch (error) {
    // 오류 목록 렌더링 실패는 팝업을 여는 것 자체를 막지 않는다.
  }
  document.getElementById("popup-errors-overlay").classList.add("popup-overlay--open");
}

function closeErrorsPopup() {
  document.getElementById("popup-errors-overlay").classList.remove("popup-overlay--open");
}

/* ----------------------------------------------------------
   👁 미리보기 팝업 (게시판 글 클릭 시 사용).
   PreviewModule.renderPreview()의 결과만 표시하고, 렌더링 핵심 로직/보안
   필터링은 그대로 재사용한다(재작성하지 않음).
   ---------------------------------------------------------- */
function renderPreviewPanel(post) {
  const emptyEl = document.getElementById("preview-empty");
  const wrapEl = document.getElementById("preview-content-wrap");

  if (!post) {
    emptyEl.classList.remove("hidden");
    wrapEl.classList.add("hidden");
    return;
  }

  const preview = PreviewModule.renderPreview(post);
  if (!preview) {
    emptyEl.classList.remove("hidden");
    wrapEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  wrapEl.classList.remove("hidden");

  document.getElementById("preview-meta").innerHTML = `
    <div class="detail-row"><span class="detail-row__label">제목</span><span>${escapeHtml(preview.title)}</span></div>
    <div class="detail-row"><span class="detail-row__label">키워드</span><span>${escapeHtml(preview.keyword)}</span></div>
    <div class="detail-row"><span class="detail-row__label">태그</span><span>${escapeHtml(preview.tags)}</span></div>
    ${post.saveStatus ? `<div class="detail-row"><span class="detail-row__label">상태</span><span class="status-badge ${statusBadgeClass(post.saveStatus)}">${escapeHtml(post.saveStatus)}</span></div>` : ""}
  `;

  const tocEl = document.getElementById("preview-toc");
  if (preview.tableOfContents.length) {
    tocEl.innerHTML = preview.tableOfContents
      .map((t) => `<div class="detail-toc__item detail-toc__item--${t.level}">${escapeHtml(t.text)}</div>`)
      .join("");
    tocEl.classList.remove("hidden");
  } else {
    tocEl.innerHTML = "";
    tocEl.classList.add("hidden");
  }

  document.getElementById("preview-content").innerHTML = preview.safeHtml;
}

function openPreviewPopup(post, noticeHtml) {
  const noticeEl = document.getElementById("preview-popup-notice");
  if (noticeEl) noticeEl.innerHTML = noticeHtml || "";
  renderPreviewPanel(post);
  document.getElementById("popup-preview-overlay").classList.add("popup-overlay--open");
}

function closePreviewPopup() {
  document.getElementById("popup-preview-overlay").classList.remove("popup-overlay--open");
}

/* ----------------------------------------------------------
   📚 게시판 패널 + 전체 게시판 팝업 (기본 기능: 글 선택)
   기본 화면(panel--library)에는 최신 글 1개만 표시한다(모바일 배치 안정화).
   전체 목록은 [전체 게시판] 팝업에서만 보여준다. 정렬(최신순)과 저장 구조는
   LibraryModule.getFilteredPosts()를 그대로 사용한다.
   ---------------------------------------------------------- */
const BOARD_MAIN_VISIBLE_COUNT = 1;

function buildPostListHtml(posts) {
  return posts
    .map(
      (p) => `
      <li class="library-item${p.id === selectedPostId ? " library-item--selected" : ""}" data-id="${escapeHtml(p.id)}">
        <div class="library-item__title">${escapeHtml(p.title)}</div>
        <div class="library-item__meta">
          ${formatDate(p.createdAt)}
          <span class="status-badge ${statusBadgeClass(p.saveStatus)}">${escapeHtml(p.saveStatus)}</span>
        </div>
      </li>`
    )
    .join("");
}

function bindPostListClicks(listEl) {
  listEl.querySelectorAll(".library-item").forEach((li) => {
    li.addEventListener("click", () => {
      selectedPostId = li.dataset.id;
      const post = LibraryModule.getPostById(selectedPostId);
      renderSavePanel();
      renderLibraryList();
      openPreviewPopup(post);
    });
  });
}

async function renderLibraryList() {
  await LibraryModule.loadPosts();
  const posts = LibraryModule.getFilteredPosts();
  const latestPosts = posts.slice(0, BOARD_MAIN_VISIBLE_COUNT);
  const listEl = document.getElementById("library-list");
  const emptyEl = document.getElementById("library-empty");

  if (!latestPosts.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  listEl.innerHTML = buildPostListHtml(latestPosts);
  bindPostListClicks(listEl);
}

function renderBoardPopupList() {
  const posts = LibraryModule.getFilteredPosts();
  const listEl = document.getElementById("board-full-list");
  const emptyEl = document.getElementById("board-full-empty");

  if (!posts.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");
  listEl.innerHTML = buildPostListHtml(posts);
  bindPostListClicks(listEl);
}

function openBoardPopup() {
  renderBoardPopupList();
  document.getElementById("popup-board-overlay").classList.add("popup-overlay--open");
}

function closeBoardPopup() {
  document.getElementById("popup-board-overlay").classList.remove("popup-overlay--open");
}

/* ----------------------------------------------------------
   📝 블로그 저장 패널 (기본 기능: R2 이미지 업로드 / Blogger 임시저장)
   저장 시작 버튼은 바로 저장하지 않고 확인 팝업을 먼저 띄운다. 확인 팝업의
   [저장하기]가 눌렸을 때만 handleSaveStartClick(runSaveFlow 포함)이
   실행되며, 그 내부 구현은 기존과 동일하다(수정하지 않음). 이 흐름 전체는
   신규 모듈과 무관하게 항상 연결된다.
   ---------------------------------------------------------- */
function renderSavePanel() {
  const emptyEl = document.getElementById("save-empty");
  const targetEl = document.getElementById("save-target");

  const post = selectedPostId ? LibraryModule.getPostById(selectedPostId) : null;
  if (!post) {
    emptyEl.classList.remove("hidden");
    targetEl.classList.add("hidden");
    notifyLifecycle("post-selected", { post: null });
    return;
  }

  emptyEl.classList.add("hidden");
  targetEl.classList.remove("hidden");
  document.getElementById("save-target-title").textContent = post.title;
  document.getElementById("save-target-status").innerHTML = `<span class="status-badge ${statusBadgeClass(post.saveStatus)}">${escapeHtml(post.saveStatus)}</span>`;
  document.getElementById("save-progress-list").innerHTML = "";
  document.getElementById("save-start-btn").disabled = false;

  // v1.4: 신규 모듈(post-status-module/retry-module 등)에게 선택된 글이
  // 바뀌었음을 안전하게 알린다. 리스너가 없거나 실패해도 위 core 렌더링에는
  // 이미 아무 영향이 없다(이 통지는 항상 core 렌더링이 끝난 뒤에 이뤄진다).
  notifyLifecycle("post-selected", { post });
}

function openSaveConfirmPopup() {
  const post = selectedPostId ? LibraryModule.getPostById(selectedPostId) : null;
  if (!post) return;
  document.getElementById("popup-save-confirm-overlay").classList.add("popup-overlay--open");
}

function closeSaveConfirmPopup() {
  document.getElementById("popup-save-confirm-overlay").classList.remove("popup-overlay--open");
}

async function handleSaveStartClick() {
  const post = selectedPostId ? LibraryModule.getPostById(selectedPostId) : null;
  if (!post) return;

  const btn = document.getElementById("save-start-btn");
  const progressListEl = document.getElementById("save-progress-list");
  btn.disabled = true;
  progressListEl.innerHTML = "";

  // v1.5(A-3): 진행 팝업 자체 높이가 로그 줄 수에 따라 계속 커지지 않도록,
  // "현재 단계 요약"(한 줄, 매번 덮어씀)과 "상세 진행 로그"(누적, 고정 높이
  // 내부 스크롤)를 분리했다. 저장 패널 안의 #save-progress-list(팝업을 닫은
  // 뒤에도 남는 이력)는 기존과 동일하게 계속 누적 표시한다.
  const progressLines = [];
  let currentSummary = "저장 준비 중";

  const renderPanelProgress = () => {
    progressListEl.innerHTML = progressLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  };

  const renderPopupProgress = () => {
    const logHtml = progressLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    updatePopupBody(
      `<div class="save-progress-summary" id="save-progress-summary">${escapeHtml(currentSummary)}</div>
       <ul class="save-progress-log" id="save-progress-log">${logHtml}</ul>`
    );
    const logEl = document.getElementById("save-progress-log");
    if (logEl) logEl.scrollTop = logEl.scrollHeight; // 항상 최신 로그가 보이게 스크롤
  };

  showPopup(
    "🔄 블로그 저장 진행 중",
    `<div class="save-progress-summary" id="save-progress-summary">${escapeHtml(currentSummary)}</div>
     <ul class="save-progress-log" id="save-progress-log"></ul>`
  );

  const onProgress = (step, total, message) => {
    currentSummary = `현재 단계: ${message} (${step}/${total})`;
    progressLines.push(`${step}/${total} ${message}`);
    renderPanelProgress();
    renderPopupProgress();
  };

  let result;
  try {
    result = await BloggerSaveModule.runSaveFlow(post, onProgress);
  } catch (error) {
    result = { success: false, reasons: [error.message || "알 수 없는 오류"] };
  }

  btn.disabled = false;
  renderSavePanel();
  await renderLibraryList();

  // v1.4: 저장 결과를 신규 모듈(save-history-module/post-status-module/
  // retry-module 등)에게 안전하게 알린다. 이 통지는 위 core 팝업/게시판
  // 갱신이 이미 끝난 뒤에 이뤄지므로, 신규 모듈이 실패해도 저장 결과 자체의
  // 사용자 안내에는 아무 영향이 없다.
  notifyLifecycle("blogger-save-result", { post, result });

  if (result.success) {
    const warningHtml = result.warnings && result.warnings.length
      ? `<p class="notice-text notice-text--warning">${result.warnings.map((w) => escapeHtml(w)).join("<br/>")}</p>`
      : "";
    showPopup(
      "✅ 블로그스팟 임시저장 완료",
      `<p>블로그스팟 임시저장 완료</p><p>Blogger 관리자에서 임시글을 확인하세요.</p>${warningHtml}`
    );
  } else {
    // 오류 문구 개선: 모듈명 + 쉬운 설명을 앞세우고, 구체적인 사유는
    // BloggerSaveModule.runSaveFlow가 돌려준 그대로 아래에 붙인다.
    const reasonsHtml = (result.reasons || ["알 수 없는 오류"]).map((r) => `<p>${escapeHtml(r)}</p>`).join("");
    showPopup("⚠️ 임시저장 실패", `<p>[blogger-save-module] Blogger 임시저장에 실패했습니다.</p>${reasonsHtml}`);
  }
}

/* ----------------------------------------------------------
   연결 콜백: 신규 모듈(UploadConfirmModule/SettingsModule)과 아래 대체
   업로드 흐름이 게시판 상태를 바꿔야 할 때 공통으로 호출한다. 실제 저장/삭제는
   기존 공개 API(LibraryModule/StorageModule)만 사용한다.
   ---------------------------------------------------------- */
async function handleUploadConfirmed(post) {
  // v1.4: 저장을 실제로 시도하기 전, "업로드 확인 완료" 시점을 신규 모듈에 알린다.
  notifyLifecycle("upload-confirmed", { post });

  try {
    const res = await LibraryModule.savePost(post);
    if (res.success) {
      selectedPostId = post.id;
      await renderLibraryList();
      renderSavePanel();
      showPopup("✅ 게시판 저장 완료", `<p>"${escapeHtml(post.title)}" 글을 게시판에 저장했습니다.</p>`);
      notifyLifecycle("board-saved", { post });
      return true;
    }
    showPopup("⚠️ 게시판 저장 실패", `<p>[library-module] 게시판 저장 중 오류가 발생했습니다. 오류 목록에서 자세한 내용을 확인해주세요.</p>`);
    notifyLifecycle("board-save-failed", { post });
    return false;
  } catch (error) {
    showPopup("⚠️ 게시판 저장 실패", `<p>[library-module] 게시판 저장 중 오류가 발생했습니다. 오류 목록에서 자세한 내용을 확인해주세요.</p>`);
    notifyLifecycle("board-save-failed", { post });
    return false;
  }
}

async function handleDataResetConfirmed() {
  const posts = await StorageModule.getAllPosts();
  for (const post of posts) {
    await StorageModule.deletePost(post.id);
  }
  selectedPostId = null;
  await renderLibraryList();
  renderSavePanel();
  renderPreviewPanel(null);
  notifyLifecycle("data-reset", {});
}

/* ----------------------------------------------------------
   ⛑ 대체(fallback) 업로드 흐름 — 기본 기능의 "최후 보루"
   ------------------------------------------------------------
   UploadConfirmModule을 쓸 수 없을 때(파일 자체가 없거나, DOM 요소가
   없거나, 초기화 중 오류가 났을 때)만 활성화된다. zip-file-input,
   upload-filename, 공용 popup-overlay처럼 index.html 기본 구조에 항상 있는
   요소만 사용하므로, 신규 모듈(js 파일/스크립트 태그/팝업 마크업/전용 CSS)을
   통째로 지워도 "ZIP 업로드 → 확인 → 게시판에 저장"은 계속 동작한다.
   실제 저장은 handleUploadConfirmed()를 그대로 재사용해 로직이 중복되지 않는다.
   ---------------------------------------------------------- */
let fallbackUploadPost = null;

function resetFallbackUploadState() {
  fallbackUploadPost = null;
  try {
    UploadModule.reset();
  } catch (error) {
    // 무시: 초기화 실패가 화면 동작을 막지 않는다.
  }
  const fileInput = document.getElementById("zip-file-input");
  const fileNameEl = document.getElementById("upload-filename");
  if (fileInput) fileInput.value = "";
  if (fileNameEl) fileNameEl.textContent = "";
}

// v1.5(A-6): 업로드 오류 문구 개선. 사용자에게는 [upload-module] 같은 내부
// 모듈명을 노출하지 않고 쉬운 설명 + 필수 구성 목록으로 안내한다(오류 목록에
// 남는 내부 로그의 모듈명 표기는 건드리지 않는다).
function buildFriendlyUploadErrorHtml(reason) {
  return `
    <p class="notice-text notice-text--warning">블로그자료 ZIP 구조가 올바르지 않습니다.</p>
    <p class="notice-text">프로그램 ZIP, Claude 작업 ZIP, 일반 압축파일은 업로드 대상이 아닙니다.<br/>GPT 공작소 블로그자료 ZIP을 업로드하세요.</p>
    <div class="popup-subheading">필수 구성</div>
    <ul class="check-list">
      <li class="check-item"><span>metadata.json</span></li>
      <li class="check-item"><span>content.html</span></li>
      <li class="check-item"><span>images 폴더</span></li>
    </ul>
    <p class="notice-text">상세: ${escapeHtml(reason || "알 수 없는 오류")}</p>
  `;
}

async function handleZipSelectedFallback(event) {
  const file = event.target.files && event.target.files[0];
  resetFallbackUploadState();
  if (!file) return;

  const fileNameEl = document.getElementById("upload-filename");
  if (fileNameEl) fileNameEl.textContent = file.name;

  let result;
  try {
    result = await UploadModule.setZipFile(file);
  } catch (error) {
    showPopup("⚠️ 업로드 실패", buildFriendlyUploadErrorHtml(error.message));
    return;
  }

  if (!result.success) {
    showPopup("⚠️ 업로드 실패", buildFriendlyUploadErrorHtml(result.reason));
    return;
  }

  let post = null;
  try {
    post = UploadModule.buildPost();
  } catch (error) {
    post = null;
  }
  if (!post) {
    showPopup("⚠️ 업로드 실패", `<p>업로드 데이터를 구성하지 못했습니다.</p>`);
    return;
  }

  fallbackUploadPost = post;

  // 신규 업로드 확인 팝업(체크리스트/미리보기)을 쓸 수 없는 상태이므로, 항상
  // 존재하는 공용 팝업으로 최소한의 확인만 거친 뒤 저장한다.
  showPopup(
    "📦 업로드 확인",
    `<p>"${escapeHtml(post.title)}" 글을 게시판에 저장할까요?</p>
     <div class="popup-actions">
       <button id="fallback-upload-cancel-btn" class="btn btn--block" type="button">취소</button>
       <button id="fallback-upload-save-btn" class="btn btn--primary btn--block" type="button">게시판에 저장</button>
     </div>`
  );

  const cancelBtn = document.getElementById("fallback-upload-cancel-btn");
  const saveBtn = document.getElementById("fallback-upload-save-btn");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      resetFallbackUploadState();
      closePopup();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!fallbackUploadPost) return;
      saveBtn.disabled = true;
      const target = fallbackUploadPost;
      let ok = false;
      try {
        ok = await handleUploadConfirmed(target);
      } finally {
        if (ok) {
          resetFallbackUploadState();
        } else {
          saveBtn.disabled = false;
        }
      }
    });
  }
}

let fallbackUploadBound = false; // 중복 연결 방지(업로드 확인 모듈과 동시에 켜지지 않도록)

function bindFallbackUploadFlow() {
  if (fallbackUploadBound) return;
  const fileInput = document.getElementById("zip-file-input");
  if (!fileInput) return;
  fileInput.addEventListener("change", handleZipSelectedFallback);
  fallbackUploadBound = true;
}

/* ----------------------------------------------------------
   v1.4: GptCoreAPI 공개 — 신규 모듈(js/blogger-final-preview-module.js 등
   8개)이 core 상태/공용 팝업에 접근하는 유일한 통로다. 각 모듈은 이 객체가
   없거나 필요한 함수가 없으면 스스로 조용히 종료하도록 만들어져 있다.
   ---------------------------------------------------------- */
window.GptCoreAPI = {
  getSelectedPost: () => (selectedPostId ? LibraryModule.getPostById(selectedPostId) : null),
  getSelectedPostId: () => selectedPostId,
  refreshBoard: async () => {
    await renderLibraryList();
    renderSavePanel();
  },
  // retry-module.js 전용: 기존 저장 버튼과 동일한 handleSaveStartClick()을
  // 그대로 재사용한다(저장 흐름을 분해하거나 다시 구현하지 않음).
  triggerBloggerSave: () => handleSaveStartClick(),
  showPopup,
  closePopup,
  updatePopupBody,
  escapeHtml,
  formatDate,
  statusBadgeClass,
  registerLifecycleListener,
  safeInit,
};

/* ----------------------------------------------------------
   초기화 — 각 모듈을 연결한다.
   ---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.__gptGongjakSoAppCoreBooted) return; // 중복 초기화 방지
  window.__gptGongjakSoAppCoreBooted = true;

  // 1) 필수 초기화(저장소/로그인). 이 부분은 기존 v1.2와 동일하다.
  await StorageModule.init();
  AuthModule.bindEvents();

  AuthModule.setOnLoginSuccess(async () => {
    await renderLibraryList();
    renderSavePanel();
    renderPreviewPanel(null);
  });
  AuthModule.setOnLogout(() => {
    selectedPostId = null;
    resetFallbackUploadState();
    safeInit("upload-confirm-module", () => {
      if (typeof UploadConfirmModule !== "undefined") UploadConfirmModule.reset();
    });
  });

  if (AuthModule.isLoggedIn()) {
    AuthModule.showAppScreen();
    await renderLibraryList();
    renderSavePanel();
  } else {
    AuthModule.showLoginScreen();
  }

  // 2) 기본 화면 이벤트 연결(게시판/미리보기/저장 확인/공용 팝업). 신규 모듈과
  //    무관하게 항상 연결되는 기본 기능이다.
  try {
    document.getElementById("open-errors-btn").addEventListener("click", showErrorsPopup);
    document.getElementById("errors-close-btn").addEventListener("click", closeErrorsPopup);

    document.getElementById("board-open-btn").addEventListener("click", openBoardPopup);
    document.getElementById("board-close-btn").addEventListener("click", closeBoardPopup);
    document.getElementById("preview-close-btn").addEventListener("click", closePreviewPopup);

    document.getElementById("save-start-btn").addEventListener("click", openSaveConfirmPopup);
    document.getElementById("save-confirm-cancel-btn").addEventListener("click", closeSaveConfirmPopup);
    document.getElementById("save-confirm-close-btn").addEventListener("click", closeSaveConfirmPopup);
    document.getElementById("save-confirm-ok-btn").addEventListener("click", async () => {
      closeSaveConfirmPopup();
      await handleSaveStartClick();
    });

    document.getElementById("popup-close-btn").addEventListener("click", closePopup);
  } catch (error) {
    // 기본 화면 요소 중 하나가 없어도 아래 신규 모듈 연결/대체 업로드 흐름은
    // 계속 진행한다.
  }

  // 3) 신규 모듈 연결 — 각각 독립 try/catch(safeInit)로 감싼다. 한 모듈이
  //    실패해도 다른 모듈 초기화와 기본 업로드/저장 흐름은 계속 진행된다.
  let uploadConfirmActive = false;
  safeInit("upload-confirm-module", () => {
    if (typeof UploadConfirmModule === "undefined") return;
    UploadConfirmModule.setOnConfirmSave(handleUploadConfirmed);
    uploadConfirmActive = typeof UploadConfirmModule.isReady === "function" && UploadConfirmModule.isReady();
  });

  // 업로드 확인 모듈이 정상 연결되지 않았을 때만 대체 흐름을 켠다(이벤트 중복
  // 연결 방지 — zip-file-input change는 항상 둘 중 하나만 담당한다).
  if (!uploadConfirmActive) {
    safeInit("upload-fallback", bindFallbackUploadFlow);
  }

  safeInit("settings-module", () => {
    if (typeof SettingsModule === "undefined") return;
    SettingsModule.setOnDataReset(handleDataResetConfirmed);
    SettingsModule.setOnViewAllErrors(showErrorsPopup);
  });

  // prompt-copy-module.js는 완전히 독립적으로 스스로 초기화하므로(자체
  // DOMContentLoaded 리스너) 여기서 연결할 것이 없다.

  // 4) v1.4 신규 모듈(전부 선택 기능) — 각각 독립 safeInit으로 연결한다.
  //    모두 자체 init()에서 필요한 DOM 요소를 먼저 확인하고, 없으면 조용히
  //    아무 것도 하지 않는다(예외를 던지지 않음). 한 모듈이 실패해도 다른
  //    모듈 초기화와 위 1~3단계(기본 업로드/게시판/Blogger 저장 흐름)에는
  //    전혀 영향이 없다 — 이미 그 단계들은 이 지점 이전에 전부 끝나 있다.
  const newModules = [
    ["blogger-final-preview-module", () => window.BloggerFinalPreviewModule],
    ["package-diagnosis-module", () => window.PackageDiagnosisModule],
    ["post-status-module", () => window.PostStatusModule],
    ["backup-module", () => window.BackupModule],
    ["error-dictionary-module", () => window.ErrorDictionaryModule],
    ["worker-status-module", () => window.WorkerStatusModule],
    ["save-history-module", () => window.SaveHistoryModule],
    ["retry-module", () => window.RetryModule],
  ];

  newModules.forEach(([name, getModule]) => {
    safeInit(name, () => {
      const mod = getModule();
      if (!mod || typeof mod.init !== "function") return;
      mod.init();
    });
  });
});
