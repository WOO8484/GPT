/**
 * app-core.js
 * 이벤트 바인딩 + 중앙 팝업 제어
 *
 * v1.1: 화면 전환(탭) 없이 업로드/자료실/미리보기/Blogger 저장 4개 패널을
 * 한 화면에 동시에 표시하는 통합 작업대 구조로 정리했다. 패널을 채우는 각
 * 함수는 UploadModule/LibraryModule/PreviewModule/R2ImageModule/
 * BloggerSaveModule/WorkerApiModule/AuthModule을 v1.0과 동일하게 호출한다.
 */

let pendingUploadPost = null; // 업로드에서 파싱했지만 아직 자료실에 저장하지 않은 글
let selectedPostId = null; // 미리보기/Blogger 저장 패널에 표시 중인 자료실 글 id

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

/* ----------------------------------------------------------
   중앙 팝업 공통 제어 (업로드 확인/실패, 자료실 저장 완료,
   R2 이미지 변환 진행, Blogger 임시저장 완료/실패)
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
  if (!errors.length) {
    list.innerHTML = `<div class="archive-item--empty">기록된 오류가 없습니다.</div>`;
    return;
  }
  list.innerHTML = errors
    .map(
      (e) => `
      <div class="error-item">
        <div class="error-item__title">[${escapeHtml(e.module)}] ${escapeHtml(e.message)}</div>
        ${e.detail ? `<div class="error-item__detail">${escapeHtml(e.detail)}</div>` : ""}
        <div class="error-item__meta">${formatDate(e.createdAt)}</div>
      </div>`
    )
    .join("");
}

function showErrorsPopup() {
  renderErrorsPopup();
  document.getElementById("popup-errors-overlay").classList.add("popup-overlay--open");
}

function closeErrorsPopup() {
  document.getElementById("popup-errors-overlay").classList.remove("popup-overlay--open");
}

/* ----------------------------------------------------------
   👁 미리보기 패널 (업로드 직후 글 / 자료실 선택 글 공용)
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

/* ----------------------------------------------------------
   📦 업로드 패널
   ---------------------------------------------------------- */
function renderUploadChecklist(status) {
  const checklistEl = document.getElementById("upload-checklist");
  checklistEl.innerHTML = status.checklist
    .map((item) => {
      const stateClass = item.ok ? "check-item__status--ok" : item.optional ? "check-item__status--warn" : "check-item__status--missing";
      const stateLabel = item.ok ? "확인" : item.optional ? "없음" : "누락";
      return `<li class="check-item"><span>${escapeHtml(item.label)}</span><span class="check-item__status ${stateClass}">${stateLabel}</span></li>`;
    })
    .join("");
  checklistEl.classList.remove("hidden");
}

async function handleZipSelected(event) {
  const file = event.target.files && event.target.files[0];
  resetUploadForm(false);
  if (!file) return;

  document.getElementById("upload-filename").textContent = file.name;

  const result = await UploadModule.setZipFile(file);
  if (!result.success) {
    showPopup("⚠️ 업로드 실패", `<p>${escapeHtml(result.reason)}</p>`);
    return;
  }

  const status = UploadModule.getCheckStatus();
  renderUploadChecklist(status);

  const warningLines = status.unresolvedImageRefs.length
    ? `<p class="notice-text notice-text--warning">본문에서 참조하지만 ZIP 안에 없는 이미지: ${status.unresolvedImageRefs
        .map((s) => escapeHtml(s))
        .join(", ")}</p>`
    : "";

  showPopup("✅ 업로드 확인", `<p>ZIP 파일 확인이 끝났습니다. 오른쪽 미리보기에서 본문을 확인해주세요.</p>${warningLines}`);

  pendingUploadPost = UploadModule.buildPost();
  renderPreviewPanel(pendingUploadPost);
  document.getElementById("upload-save-btn").classList.remove("hidden");
}

async function handleUploadSaveClick() {
  if (!pendingUploadPost) return;
  const btn = document.getElementById("upload-save-btn");
  btn.disabled = true;
  try {
    const res = await LibraryModule.savePost(pendingUploadPost);
    if (res.success) {
      showPopup("✅ 자료실 저장 완료", `<p>"${escapeHtml(pendingUploadPost.title)}" 글을 자료실에 저장했습니다.</p>`);
      selectedPostId = pendingUploadPost.id;
      await renderLibraryList();
      renderSavePanel();
      resetUploadForm(true);
    } else {
      showPopup("⚠️ 자료실 저장 실패", `<p>자료실 저장 중 오류가 발생했습니다. 오류 목록을 확인해주세요.</p>`);
    }
  } finally {
    btn.disabled = false;
  }
}

function resetUploadForm(clearFileInput) {
  pendingUploadPost = null;
  UploadModule.reset();
  if (clearFileInput) {
    document.getElementById("zip-file-input").value = "";
    document.getElementById("upload-filename").textContent = "";
  }
  document.getElementById("upload-checklist").classList.add("hidden");
  document.getElementById("upload-checklist").innerHTML = "";
  document.getElementById("upload-save-btn").classList.add("hidden");
}

/* ----------------------------------------------------------
   📚 자료실 패널
   ---------------------------------------------------------- */
async function renderLibraryList() {
  await LibraryModule.loadPosts();
  const posts = LibraryModule.getFilteredPosts();
  const listEl = document.getElementById("library-list");
  const emptyEl = document.getElementById("library-empty");

  if (!posts.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  listEl.innerHTML = posts
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

  listEl.querySelectorAll(".library-item").forEach((li) => {
    li.addEventListener("click", () => {
      selectedPostId = li.dataset.id;
      const post = LibraryModule.getPostById(selectedPostId);
      renderPreviewPanel(post);
      renderSavePanel();
      renderLibraryList();
    });
  });
}

/* ----------------------------------------------------------
   📝 Blogger 저장 패널 (R2 이미지 변환 후 Blogger 임시저장 + 진행 상태)
   ---------------------------------------------------------- */
function renderSavePanel() {
  const emptyEl = document.getElementById("save-empty");
  const targetEl = document.getElementById("save-target");

  const post = selectedPostId ? LibraryModule.getPostById(selectedPostId) : null;
  if (!post) {
    emptyEl.classList.remove("hidden");
    targetEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  targetEl.classList.remove("hidden");
  document.getElementById("save-target-title").textContent = post.title;
  document.getElementById("save-target-status").innerHTML = `<span class="status-badge ${statusBadgeClass(post.saveStatus)}">${escapeHtml(post.saveStatus)}</span>`;
  document.getElementById("save-progress-list").innerHTML = "";
  document.getElementById("save-start-btn").disabled = false;
}

async function handleSaveStartClick() {
  const post = selectedPostId ? LibraryModule.getPostById(selectedPostId) : null;
  if (!post) return;

  const btn = document.getElementById("save-start-btn");
  const progressListEl = document.getElementById("save-progress-list");
  btn.disabled = true;
  progressListEl.innerHTML = "";

  const progressLines = [];
  const renderProgress = () => {
    const html = progressLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    progressListEl.innerHTML = html;
    updatePopupBody(`<ul class="save-progress-list">${html}</ul>`);
  };

  showPopup("🔄 R2 이미지 변환 진행", `<ul class="save-progress-list"></ul>`);

  const onProgress = (step, total, message) => {
    progressLines.push(`${step}/${total} ${message}`);
    renderProgress();
  };

  let result;
  try {
    result = await BloggerSaveModule.runSaveFlow(post, onProgress);
  } catch (error) {
    result = { success: false, reasons: [error.message || "알 수 없는 오류"] };
  }

  btn.disabled = false;
  renderSavePanel();
  renderPreviewPanel(post);
  await renderLibraryList();

  if (result.success) {
    const warningHtml = result.warnings && result.warnings.length
      ? `<p class="notice-text notice-text--warning">${result.warnings.map((w) => escapeHtml(w)).join("<br/>")}</p>`
      : "";
    showPopup(
      "✅ 블로그스팟 임시저장 완료",
      `<p>블로그스팟 임시저장 완료</p><p>Blogger 관리자에서 임시글을 확인하세요.</p>${warningHtml}`
    );
  } else {
    const reasonsHtml = (result.reasons || ["알 수 없는 오류"]).map((r) => `<p>${escapeHtml(r)}</p>`).join("");
    showPopup("⚠️ 임시저장 실패", reasonsHtml);
  }
}

/* ----------------------------------------------------------
   초기화
   ---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await StorageModule.init();
  AuthModule.bindEvents();

  AuthModule.setOnLoginSuccess(async () => {
    await renderLibraryList();
    renderSavePanel();
    renderPreviewPanel(null);
  });
  AuthModule.setOnLogout(() => {
    pendingUploadPost = null;
    selectedPostId = null;
  });

  if (AuthModule.isLoggedIn()) {
    AuthModule.showAppScreen();
    await renderLibraryList();
    renderSavePanel();
  } else {
    AuthModule.showLoginScreen();
  }

  document.getElementById("logout-btn").addEventListener("click", () => AuthModule.logout());

  document.getElementById("zip-file-input").addEventListener("change", handleZipSelected);
  document.getElementById("upload-save-btn").addEventListener("click", handleUploadSaveClick);

  document.getElementById("save-start-btn").addEventListener("click", handleSaveStartClick);

  document.getElementById("popup-close-btn").addEventListener("click", closePopup);

  document.getElementById("open-errors-btn").addEventListener("click", showErrorsPopup);
  document.getElementById("errors-close-btn").addEventListener("click", closeErrorsPopup);
});
