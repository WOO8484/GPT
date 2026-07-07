/**
 * app-core.js
 * 화면 전환, 이벤트 바인딩, 중앙 팝업 제어
 *
 * 이 파일이 다루는 화면은 4모듈뿐이다: 로그인 / 업로드-미리보기 / 자료실 / 저장.
 * Gemini 품질검수, 점수, SEO, 예약, 통계, 백업 화면은 만들지 않는다.
 */

let pendingUploadPost = null; // 업로드 탭에서 파싱했지만 아직 자료실에 저장하지 않은 글
let selectedPostId = null; // 저장 탭에서 사용할, 자료실에서 선택된 글 id
let currentDetailPostId = null; // 상세 미리보기 팝업이 보여주고 있는 글 id

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
   중앙 팝업 공통 제어
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

function showDetailPopup(post) {
  if (!post) return;
  currentDetailPostId = post.id;
  const preview = PreviewModule.renderPreview(post);
  document.getElementById("detail-title").textContent = post.title || "(제목 없음)";

  if (!preview) {
    document.getElementById("detail-body").innerHTML = `<p class="notice-text">미리보기를 표시할 수 없습니다.</p>`;
  } else {
    const tocHtml = preview.tableOfContents.length
      ? `<div class="detail-toc">${preview.tableOfContents
          .map((t) => `<div class="detail-toc__item detail-toc__item--${t.level}">${escapeHtml(t.text)}</div>`)
          .join("")}</div>`
      : "";

    document.getElementById("detail-body").innerHTML = `
      <div class="detail-meta">
        <div class="detail-row"><span class="detail-row__label">키워드</span><span>${escapeHtml(preview.keyword)}</span></div>
        <div class="detail-row"><span class="detail-row__label">태그</span><span>${escapeHtml(preview.tags)}</span></div>
        <div class="detail-row"><span class="detail-row__label">상태</span><span class="status-badge ${statusBadgeClass(post.saveStatus)}">${escapeHtml(post.saveStatus)}</span></div>
      </div>
      ${tocHtml}
      <div class="preview-content">${preview.safeHtml}</div>
    `;
  }

  document.getElementById("popup-detail-overlay").classList.add("popup-overlay--open");
}

function closeDetailPopup() {
  document.getElementById("popup-detail-overlay").classList.remove("popup-overlay--open");
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
   탭 전환
   ---------------------------------------------------------- */
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("tab-btn--active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("tab-panel--active", panel.id === "panel-" + name);
  });

  if (name === "library") renderLibraryList();
  if (name === "save") renderSavePanel();
}

/* ----------------------------------------------------------
   2. 업로드 - 미리보기 모듈
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
    showPopup("업로드 실패", `<p>${escapeHtml(result.reason)}</p>`);
    return;
  }

  const status = UploadModule.getCheckStatus();
  renderUploadChecklist(status);

  const warningLines = status.unresolvedImageRefs.length
    ? `<p class="notice-text notice-text--warning">본문에서 참조하지만 ZIP 안에 없는 이미지: ${status.unresolvedImageRefs
        .map((s) => escapeHtml(s))
        .join(", ")}</p>`
    : "";

  showPopup(
    "업로드 확인",
    `<p>ZIP 파일 확인이 끝났습니다. 확인을 누르면 미리보기가 표시됩니다.</p>${warningLines}`
  );

  pendingUploadPost = UploadModule.buildPost();
  pendingUploadPost.previewHtml = null;

  const preview = PreviewModule.renderPreview(pendingUploadPost);
  if (preview) {
    document.getElementById("upload-preview-content").innerHTML = `
      <div class="detail-row"><span class="detail-row__label">제목</span><span>${escapeHtml(preview.title)}</span></div>
      <div class="detail-row"><span class="detail-row__label">키워드</span><span>${escapeHtml(preview.keyword)}</span></div>
      <div class="detail-row"><span class="detail-row__label">태그</span><span>${escapeHtml(preview.tags)}</span></div>
      <div class="preview-content">${preview.safeHtml}</div>
    `;
    document.getElementById("upload-preview-wrap").classList.remove("hidden");
    document.getElementById("upload-save-btn").classList.remove("hidden");
  }
}

async function handleUploadSaveClick() {
  if (!pendingUploadPost) return;
  const btn = document.getElementById("upload-save-btn");
  btn.disabled = true;
  try {
    const res = await LibraryModule.savePost(pendingUploadPost);
    if (res.success) {
      showPopup("자료실 저장 완료", `<p>"${escapeHtml(pendingUploadPost.title)}" 글을 자료실에 저장했습니다.</p>`);
      resetUploadForm(true);
    } else {
      showPopup("자료실 저장 실패", `<p>자료실 저장 중 오류가 발생했습니다. 오류 목록을 확인해주세요.</p>`);
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
  document.getElementById("upload-preview-wrap").classList.add("hidden");
  document.getElementById("upload-preview-content").innerHTML = "";
  document.getElementById("upload-save-btn").classList.add("hidden");
}

/* ----------------------------------------------------------
   3. 자료실 / 게시판 모듈
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
      <li class="library-item" data-id="${escapeHtml(p.id)}">
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
      const post = LibraryModule.getPostById(li.dataset.id);
      showDetailPopup(post);
    });
  });
}

/* ----------------------------------------------------------
   4. 저장 모듈: R2 이미지 변환 후 Blogger 임시저장
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

  showPopup("R2 이미지 변환 진행", `<ul class="save-progress-list"></ul>`);

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
  await renderLibraryList();

  if (result.success) {
    const warningHtml = result.warnings && result.warnings.length
      ? `<p class="notice-text notice-text--warning">${result.warnings.map((w) => escapeHtml(w)).join("<br/>")}</p>`
      : "";
    showPopup(
      "블로그스팟 임시저장 완료",
      `<p>블로그스팟 임시저장 완료</p><p>Blogger 관리자에서 임시글을 확인하세요.</p>${warningHtml}`
    );
  } else {
    const reasonsHtml = (result.reasons || ["알 수 없는 오류"]).map((r) => `<p>${escapeHtml(r)}</p>`).join("");
    showPopup("임시저장 실패", reasonsHtml);
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
    switchTab("upload");
  });
  AuthModule.setOnLogout(() => {
    pendingUploadPost = null;
    selectedPostId = null;
    currentDetailPostId = null;
  });

  if (AuthModule.isLoggedIn()) {
    AuthModule.showAppScreen();
    await renderLibraryList();
  } else {
    AuthModule.showLoginScreen();
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("logout-btn").addEventListener("click", () => AuthModule.logout());

  document.getElementById("zip-file-input").addEventListener("change", handleZipSelected);
  document.getElementById("upload-save-btn").addEventListener("click", handleUploadSaveClick);

  document.getElementById("save-start-btn").addEventListener("click", handleSaveStartClick);

  document.getElementById("popup-close-btn").addEventListener("click", closePopup);
  document.getElementById("detail-close-btn").addEventListener("click", closeDetailPopup);
  document.getElementById("detail-goto-save-btn").addEventListener("click", () => {
    selectedPostId = currentDetailPostId;
    closeDetailPopup();
    switchTab("save");
  });

  document.getElementById("open-errors-btn").addEventListener("click", showErrorsPopup);
  document.getElementById("errors-close-btn").addEventListener("click", closeErrorsPopup);
});
