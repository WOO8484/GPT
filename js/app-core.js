/**
 * app-core.js
 * 앱 초기화, 로그인 연동, 단일 대시보드/팝업 렌더링 및 이벤트 바인딩 담당
 *
 * repair1 변경사항:
 * - 첫 진입 시 로그인 화면(AuthModule)을 거친 뒤에만 대시보드를 보여준다.
 * - 하단 네비게이션과 화면별 개별 뷰 전환을 제거하고, 단일 고정 대시보드 +
 *   팝업(등록하기/자료실/블로그 등록하기/설정) 구조로 정리했다.
 */

const AppCore = (() => {
  // 레거시(영어) 상태값 표시 방어용 매핑. 실제 데이터 보정은 ArchiveModule.loadPosts()에서 수행된다.
  const LEGACY_STATUS_MAP = {
    draft: "작성중",
    published: "발행완료",
    scheduled: "예약됨",
    error: "오류",
  };

  const BLOGGER_FORBIDDEN_STATUS = ["작성중", "보류", "오류", "발행완료"];
  const TICKER_INTERVAL_MS = 4000;
  const TICKER_MAX_ITEMS = 5;

  function displayStatus(status) {
    return LEGACY_STATUS_MAP[status] || status || "-";
  }

  function generateId() {
    return "post_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  function formatDate(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function openPopup(id) {
    document.getElementById(id).classList.add("popup-overlay--open");
  }

  function closePopup(id) {
    document.getElementById(id).classList.remove("popup-overlay--open");
  }

  function renderCheckListItems(containerId, items) {
    const listEl = document.getElementById(containerId);
    listEl.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const labelEl = document.createElement("span");
      labelEl.textContent = item.label;

      const statusEl = document.createElement("span");
      statusEl.className =
        "check-item__status " + (item.ok ? "check-item__status--ok" : "check-item__status--missing");
      statusEl.textContent = item.text ? item.text : item.ok ? "인식됨" : "없음";

      li.appendChild(labelEl);
      li.appendChild(statusEl);
      listEl.appendChild(li);
    });
  }

  function renderUploadFileName(displayId, file) {
    const el = document.getElementById(displayId);
    if (!el) return;
    el.textContent = file ? file.name : "선택된 파일 없음";
  }

  /* ============================================================
     대시보드 (최근 글 전광판 + 공작소 작업대)
     ============================================================ */

  let tickerPosts = [];
  let tickerIndex = 0;
  let tickerTimer = null;

  function stopTicker() {
    if (tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }

  function renderTickerFrame() {
    const titleEl = document.getElementById("ticker-title");
    const metaEl = document.getElementById("ticker-meta");
    if (tickerPosts.length === 0) {
      titleEl.textContent = "저장된 글이 없습니다.";
      metaEl.textContent = "자료실에서 첫 글을 등록해보세요.";
      return;
    }
    const post = tickerPosts[tickerIndex % tickerPosts.length];
    titleEl.textContent = post.title || "(제목 없음)";
    metaEl.textContent = `${displayStatus(post.status)} · ${formatDate(post.updatedAt)}`;
  }

  function startTicker() {
    stopTicker();
    if (tickerPosts.length <= 1) return;
    tickerTimer = setInterval(() => {
      tickerIndex = (tickerIndex + 1) % tickerPosts.length;
      renderTickerFrame();
    }, TICKER_INTERVAL_MS);
  }

  async function refreshDashboard() {
    const posts = await ArchiveModule.loadPosts();
    const sorted = [...posts].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
    tickerPosts = sorted.slice(0, TICKER_MAX_ITEMS);
    tickerIndex = 0;
    renderTickerFrame();
    startTicker();
  }

  function bindDashboardEvents() {
    document.getElementById("open-register-btn").addEventListener("click", openRegisterPopup);
    document.getElementById("open-archive-btn").addEventListener("click", () => openArchivePopup());
    document.getElementById("open-archive-from-ticker-btn").addEventListener("click", () => openArchivePopup());
    document.getElementById("open-blogger-btn").addEventListener("click", openBloggerPopup);
    document.getElementById("open-settings-btn").addEventListener("click", openSettingsPopup);

    document.getElementById("ticker-content").addEventListener("click", () => {
      if (tickerPosts.length === 0) {
        openArchivePopup();
        return;
      }
      const post = tickerPosts[tickerIndex % tickerPosts.length];
      openArchivePopup(post.id);
    });
  }

  /* ============================================================
     팝업: 자료실
     ============================================================ */

  let selectedArchivePostId = null;

  function showArchiveListView() {
    document.getElementById("archive-list-view").classList.remove("hidden");
    document.getElementById("archive-detail-view").classList.add("hidden");
  }

  function showArchiveDetailView() {
    document.getElementById("archive-list-view").classList.add("hidden");
    document.getElementById("archive-detail-view").classList.remove("hidden");
  }

  function renderArchiveList() {
    const listEl = document.getElementById("archive-list");
    const posts = ArchiveModule.getFilteredPosts();
    listEl.innerHTML = "";

    if (posts.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "archive-item archive-item--empty";
      emptyEl.textContent = "저장된 글이 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    posts.forEach((post) => {
      const itemEl = document.createElement("li");
      itemEl.className = "archive-item";

      const titleEl = document.createElement("div");
      titleEl.className = "archive-item__title";
      titleEl.textContent = post.title || "(제목 없음)";

      const imgCount = Array.isArray(post.imageList) ? post.imageList.length : 0;
      const seoText = post.seoResult && post.seoResult.result ? `SEO ${post.seoResult.result}` : "SEO 미검수";

      const metaEl = document.createElement("div");
      metaEl.className = "archive-item__meta";
      metaEl.textContent = `${displayStatus(post.status)} · ${formatDate(post.updatedAt)} · ${seoText} · 이미지 ${imgCount}장`;

      itemEl.appendChild(titleEl);
      itemEl.appendChild(metaEl);
      itemEl.addEventListener("click", () => openArchiveDetail(post.id));

      listEl.appendChild(itemEl);
    });
  }

  function openArchiveDetail(id) {
    const post = ArchiveModule.getPostById(id);
    if (!post) return;
    selectedArchivePostId = id;

    document.getElementById("archive-detail-title").textContent = post.title || "(제목 없음)";
    document.getElementById("archive-detail-status").textContent = displayStatus(post.status);
    document.getElementById("archive-detail-updated").textContent = formatDate(post.updatedAt);
    document.getElementById("archive-detail-seo").textContent =
      post.seoResult && post.seoResult.result
        ? `${post.seoResult.result} (${post.seoResult.totalScore}점)`
        : "미검수";
    const imgCount = Array.isArray(post.imageList) ? post.imageList.length : 0;
    document.getElementById("archive-detail-images").textContent = `${imgCount}장`;

    resetQualityReviewPanel();
    showArchiveDetailView();
  }

  function openArchivePopup(focusPostId) {
    renderArchiveList();
    if (focusPostId) {
      openArchiveDetail(focusPostId);
    } else {
      showArchiveListView();
    }
    openPopup("popup-archive");
  }

  function bindArchiveEvents() {
    document.getElementById("archive-close-btn").addEventListener("click", () => closePopup("popup-archive"));

    document.getElementById("archive-search").addEventListener("input", (e) => {
      ArchiveModule.setSearchText(e.target.value);
      renderArchiveList();
    });

    document.getElementById("archive-status-filter").addEventListener("change", (e) => {
      ArchiveModule.setStatusFilter(e.target.value);
      renderArchiveList();
    });

    document.getElementById("archive-detail-back-btn").addEventListener("click", () => {
      showArchiveListView();
      renderArchiveList();
    });

    document.getElementById("archive-detail-preview-btn").addEventListener("click", () => {
      const post = ArchiveModule.getPostById(selectedArchivePostId);
      if (!post) {
        alert("미리보기를 열 수 없습니다.");
        return;
      }
      openPreviewPopup(post);
    });

    document.getElementById("archive-detail-delete-btn").addEventListener("click", () => {
      if (!selectedArchivePostId) return;
      openPopup("popup-confirm-delete");
    });

    document.getElementById("confirm-delete-cancel-btn").addEventListener("click", () => {
      closePopup("popup-confirm-delete");
    });

    document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
      if (!selectedArchivePostId) return;
      await ArchiveModule.deletePost(selectedArchivePostId);
      closePopup("popup-confirm-delete");
      showArchiveListView();
      renderArchiveList();
      await refreshDashboard();
    });
  }

  /* ============================================================
     팝업: 미리보기
     ============================================================ */

  let currentPreviewPost = null;

  function showPreviewTab(tab) {
    const frames = {
      html: document.getElementById("preview-html-frame"),
      markdown: document.getElementById("preview-markdown-frame"),
      text: document.getElementById("preview-text-frame"),
    };
    const buttons = {
      html: document.getElementById("preview-view-html-btn"),
      markdown: document.getElementById("preview-view-markdown-btn"),
      text: document.getElementById("preview-view-text-btn"),
    };

    Object.keys(frames).forEach((key) => {
      frames[key].classList.toggle("hidden", key !== tab);
      buttons[key].classList.toggle("nav-btn--active", key === tab);
    });
  }

  function renderPreviewBodyImageList(bodyImages) {
    const listEl = document.getElementById("preview-body-image-list");
    listEl.innerHTML = "";

    if (!bodyImages || bodyImages.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "check-item";
      emptyEl.textContent = "등록된 본문 이미지가 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    bodyImages.forEach((img) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const row = document.createElement("div");
      row.className = "image-item__row";

      const thumb = document.createElement("img");
      thumb.className = "image-item__thumb";
      thumb.src = img.dataUrl;
      thumb.alt = img.altText || "";

      const info = document.createElement("span");
      info.className = "image-item__filename";
      info.textContent = img.fileName;

      row.appendChild(thumb);
      row.appendChild(info);
      li.appendChild(row);
      listEl.appendChild(li);
    });
  }

  function renderPreviewTocBox(tableOfContents) {
    const boxEl = document.getElementById("preview-toc-box");
    const listEl = document.getElementById("preview-toc-list");
    listEl.innerHTML = "";

    if (!tableOfContents || tableOfContents.length === 0) {
      boxEl.classList.add("hidden");
      return;
    }

    boxEl.classList.remove("hidden");
    tableOfContents.forEach((item) => {
      const div = document.createElement("div");
      div.className = "blogspot-toc-box__item" + (item.level === "h3" ? " blogspot-toc-box__item--h3" : "");
      div.textContent = item.text;
      listEl.appendChild(div);
    });
  }

  function renderPreviewFaqBox(faqList) {
    const boxEl = document.getElementById("preview-faq-box");
    const listEl = document.getElementById("preview-faq-list");
    listEl.innerHTML = "";

    if (!faqList || faqList.length === 0) {
      boxEl.classList.add("hidden");
      return;
    }

    boxEl.classList.remove("hidden");
    faqList.forEach((faq) => {
      const item = document.createElement("div");
      item.className = "blogspot-faq-item";

      const q = document.createElement("div");
      q.className = "blogspot-faq-item__q";
      q.textContent = "Q. " + (faq.question || "");

      const a = document.createElement("div");
      a.className = "blogspot-faq-item__a";
      a.textContent = "A. " + (faq.answer || "");

      item.appendChild(q);
      item.appendChild(a);
      listEl.appendChild(item);
    });
  }

  function renderPreviewRelatedBox(currentPostId) {
    const boxEl = document.getElementById("preview-related-box");
    const listEl = document.getElementById("preview-related-list");
    listEl.innerHTML = "";

    const posts = ArchiveModule.getFilteredPosts().filter((p) => p.id !== currentPostId);
    if (posts.length === 0) {
      boxEl.classList.add("hidden");
      return;
    }

    boxEl.classList.remove("hidden");
    posts.slice(0, 3).forEach((post) => {
      const item = document.createElement("div");
      item.className = "blogspot-related-item";
      item.textContent = post.title || "(제목 없음)";
      listEl.appendChild(item);
    });
  }

  function setPreviewWidthMode(mode) {
    const frameEl = document.getElementById("preview-body-frame");
    frameEl.classList.toggle("blogspot-body-frame--mobile", mode === "mobile");
    frameEl.classList.toggle("blogspot-body-frame--pc", mode === "pc");
    document.getElementById("preview-mobile-btn").classList.toggle("nav-btn--active", mode === "mobile");
    document.getElementById("preview-pc-btn").classList.toggle("nav-btn--active", mode === "pc");
  }

  function renderPreviewPopup() {
    const emptyEl = document.getElementById("preview-empty-message");
    const contentEl = document.getElementById("preview-content-area");

    if (!currentPreviewPost) {
      emptyEl.classList.remove("hidden");
      contentEl.classList.add("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    contentEl.classList.remove("hidden");

    const rendered = PreviewModule.renderPreview(currentPreviewPost);
    if (!rendered) {
      alert("미리보기를 표시할 수 없습니다.");
      return;
    }

    document.getElementById("preview-title").textContent = rendered.title;
    document.getElementById("preview-keyword").textContent = rendered.keyword;
    document.getElementById("preview-tags").textContent = rendered.tags;
    document.getElementById("preview-html-content").innerHTML = rendered.safeHtml;
    document.getElementById("preview-markdown-content").textContent = rendered.markdownContent;
    document.getElementById("preview-text-content").textContent = rendered.textContent;

    const summaryBoxEl = document.getElementById("preview-summary-box");
    if (rendered.metaDescription && rendered.metaDescription !== "-") {
      summaryBoxEl.textContent = rendered.metaDescription;
      summaryBoxEl.classList.remove("hidden");
    } else {
      summaryBoxEl.classList.add("hidden");
    }

    const thumbnailArea = document.getElementById("preview-thumbnail-area");
    const thumbnailImg = document.getElementById("preview-thumbnail-img");
    if (rendered.thumbnail) {
      thumbnailImg.src = rendered.thumbnail.dataUrl;
      thumbnailImg.alt = rendered.thumbnail.altText || "";
      thumbnailArea.classList.remove("hidden");
    } else {
      thumbnailArea.classList.add("hidden");
    }

    renderPreviewBodyImageList(rendered.bodyImages);
    renderPreviewTocBox(rendered.tableOfContents);
    renderPreviewFaqBox(rendered.faqList);
    renderPreviewRelatedBox(currentPreviewPost.id);
    setPreviewWidthMode("mobile");
    showPreviewTab("html");
  }

  function openPreviewPopup(post) {
    currentPreviewPost = post || null;
    renderPreviewPopup();
    openPopup("popup-preview");
  }

  function bindPreviewEvents() {
    document.getElementById("preview-view-html-btn").addEventListener("click", () => showPreviewTab("html"));
    document.getElementById("preview-view-markdown-btn").addEventListener("click", () => showPreviewTab("markdown"));
    document.getElementById("preview-view-text-btn").addEventListener("click", () => showPreviewTab("text"));
    document.getElementById("preview-close-btn").addEventListener("click", () => closePopup("popup-preview"));
    document.getElementById("preview-mobile-btn").addEventListener("click", () => setPreviewWidthMode("mobile"));
    document.getElementById("preview-pc-btn").addEventListener("click", () => setPreviewWidthMode("pc"));
  }

  /* ============================================================
     품질 검수 (Gemini, 0.0.7 도입 / 0.0.8: 별도 팝업 대신 자료실 상세 내부 카드로 표시)
     Gemini는 글을 생성/수정하지 않으며 검수 결과와 수정 제안만 표시한다.
     실패해도 자료실 데이터는 그대로 유지되며, 실패 안내만 표시한다.
     ============================================================ */

  let lastQualityReviewRewriteText = "";

  function resetQualityReviewPanel() {
    document.getElementById("quality-review-panel").classList.add("hidden");
    document.getElementById("quality-review-status").classList.add("hidden");
    document.getElementById("quality-review-result").classList.add("hidden");
    document.getElementById("quality-review-fail").classList.add("hidden");
  }

  function showQualityReviewState(state) {
    document.getElementById("quality-review-panel").classList.remove("hidden");
    document.getElementById("quality-review-status").classList.toggle("hidden", state !== "loading");
    document.getElementById("quality-review-result").classList.toggle("hidden", state !== "done");
    document.getElementById("quality-review-fail").classList.toggle("hidden", state !== "fail");
  }

  function renderQualityReviewIssues(issues) {
    const listEl = document.getElementById("quality-review-issue-list");
    listEl.innerHTML = "";

    if (!issues || issues.length === 0) {
      const li = document.createElement("li");
      li.className = "check-item";
      li.textContent = "보완이 필요한 항목이 없습니다.";
      listEl.appendChild(li);
      return;
    }

    issues.forEach((issue) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const labelEl = document.createElement("span");
      labelEl.textContent = `[${issue.type || "기타"}] ${issue.message || ""}`;

      const statusEl = document.createElement("span");
      statusEl.className = "check-item__status";
      statusEl.textContent = issue.severity || "-";

      li.appendChild(labelEl);
      li.appendChild(statusEl);
      listEl.appendChild(li);
    });
  }

  async function runQualityReview(postId) {
    const post = ArchiveModule.getPostById(postId);
    if (!post) return;

    const triggerBtn = document.getElementById("archive-detail-quality-btn");
    triggerBtn.disabled = true;
    triggerBtn.textContent = "품질검수 중";

    showQualityReviewState("loading");
    document.getElementById("quality-review-status-value").textContent = "품질검수 진행 중";

    const result = await GeminiReviewModule.requestReview(post);

    if (!result.success) {
      showQualityReviewState("fail");
      triggerBtn.disabled = false;
      triggerBtn.textContent = "품질 검수";
      return;
    }

    const review = result.review;
    document.getElementById("quality-review-score").textContent = `${review.score}점 (${review.status})`;
    document.getElementById("quality-review-summary").textContent = review.summary || "요약이 없습니다.";
    renderQualityReviewIssues(review.issues);
    lastQualityReviewRewriteText = GeminiReviewModule.buildRewriteRequestText(post, review);
    showQualityReviewState("done");
    triggerBtn.disabled = false;
    triggerBtn.textContent = "품질 검수";
  }

  function bindQualityReviewEvents() {
    document.getElementById("archive-detail-quality-btn").addEventListener("click", () => {
      if (!selectedArchivePostId) return;
      runQualityReview(selectedArchivePostId);
    });

    document.getElementById("quality-review-copy-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(lastQualityReviewRewriteText);
        alert("수정요청 문구를 클립보드에 복사했습니다.");
      } catch (error) {
        alert("복사에 실패했습니다.");
      }
    });
  }

  /* ============================================================
     팝업: 등록하기 (ZIP 자동 업로드 + 검증 게이트 + 수동 업로드 보조)
     repair2: ZIP 선택 즉시 자동 인식+검증을 실행하고, 결과는 가로 요약카드로만
     표시한다(파일별 긴 목록은 노출하지 않음). 스크롤 금지 대상이므로 내용은
     항상 화면 안에 들어오도록 유지한다.
     ============================================================ */

  let registerHasValidated = false;

  function showRegisterButtonRow(stage) {
    document.getElementById("register-btn-row-fail").classList.toggle("hidden", stage !== "fail");
    document.getElementById("register-btn-row-pass").classList.toggle("hidden", stage !== "pass");
    document.getElementById("register-btn-row-done").classList.toggle("hidden", stage !== "done");
    // 검증 통과 후 저장 대기 상태에서는 실수로 팝업을 닫아버리는 것을 막기 위해 X 닫기 버튼을 숨긴다.
    document.getElementById("register-close-x-btn").classList.toggle("hidden", stage === "pass");
  }

  function renderRegisterSummary(result) {
    const summaryEl = document.getElementById("register-summary");
    const failDetailEl = document.getElementById("register-fail-detail");

    summaryEl.classList.remove("hidden");
    document.getElementById("register-summary-total").textContent = result.totalCount;
    document.getElementById("register-summary-ok").textContent = result.okCount;
    document.getElementById("register-summary-fail").textContent = result.failCount;

    if (result.failCount > 0) {
      const firstFail = result.checklist.find((item) => !item.ok);
      failDetailEl.textContent = `⚠️ 실패 ${result.failCount}개: ${firstFail ? firstFail.label + " 형식 오류" : "필수 항목 누락"}`;
      failDetailEl.classList.remove("hidden");
    } else {
      failDetailEl.classList.add("hidden");
      failDetailEl.textContent = "";
    }
  }

  function resetRegisterPopupUI() {
    ZipUploadModule.reset();
    registerHasValidated = false;
    document.getElementById("zip-upload-input").value = "";
    renderUploadFileName("zip-upload-filename", null);
    document.getElementById("register-summary").classList.add("hidden");
    document.getElementById("register-fail-detail").classList.add("hidden");
    document.getElementById("register-score-area").classList.add("hidden");
    document.getElementById("register-btn-row-fail").classList.add("hidden");
    document.getElementById("register-btn-row-pass").classList.add("hidden");
    document.getElementById("register-btn-row-done").classList.add("hidden");
    document.getElementById("register-success-card").classList.add("hidden");
    document.getElementById("register-close-x-btn").classList.remove("hidden");

    GptUploadModule.reset();
    ["metadata", "html", "markdown", "text"].forEach((key) => {
      const input = document.getElementById(`upload-${key}-input`);
      if (input) input.value = "";
      renderUploadFileName(`upload-${key}-filename`, null);
    });
    renderUploadCheckList();
    document.getElementById("manual-upload-panel").classList.add("manual-upload-panel--collapsed");
    document.getElementById("manual-upload-toggle-btn").textContent = "수동 업로드 열기";
  }

  function openRegisterPopup() {
    resetRegisterPopupUI();
    openPopup("popup-register");
  }

  // 검증 통과 후 저장 전(register-btn-row-pass 표시 중)인지 여부
  function isRegisterAwaitingSave() {
    return !document.getElementById("register-btn-row-pass").classList.contains("hidden");
  }

  function runRegisterValidation() {
    const result = ZipUploadModule.runValidation();
    if (!result.success) {
      alert("ZIP 파일을 먼저 선택해주세요.");
      return;
    }

    registerHasValidated = true;
    renderRegisterSummary(result);

    if (!result.structureOk) {
      // 필수 파일/이미지 누락: 구조 검증 실패
      document.getElementById("register-score-area").classList.add("hidden");
      showRegisterButtonRow("fail");
      return;
    }

    // 구조 검증은 통과했으므로 SEO 점수/판정은 항상 표시한다.
    const scoreArea = document.getElementById("register-score-area");
    scoreArea.classList.remove("hidden");
    document.getElementById("register-score-value").textContent = result.seoResult
      ? `${result.seoResult.totalScore}점 (${result.seoResult.result})`
      : "-";

    if (result.seoOk) {
      document.getElementById("register-briefing").textContent =
        result.seoResult && result.seoResult.issues && result.seoResult.issues.length > 0
          ? `SEO 참고 사항: ${result.seoResult.issues.join(", ")}`
          : "SEO 참고 사항이 없습니다.";
      document.getElementById("register-success-card").classList.add("hidden");
      document.getElementById("register-save-btn").disabled = false;
      showRegisterButtonRow("pass");
    } else {
      // SEO 미통과: 저장 버튼을 표시하지 않고 미통과 사유를 표시한다.
      const issuesText =
        result.seoResult && result.seoResult.issues && result.seoResult.issues.length > 0
          ? result.seoResult.issues.join(", ")
          : "SEO 검수 기준을 충족하지 못했습니다.";
      document.getElementById("register-briefing").textContent =
        `현재 ${result.seoResult ? result.seoResult.totalScore : 0}점 / 수정 필요\n` +
        `기준: 80점 이상 통과\n` +
        `누락 항목: ${issuesText}`;
      showRegisterButtonRow("fail");
    }
  }

  function renderUploadCheckList() {
    const status = GptUploadModule.getCheckStatus();
    renderCheckListItems("upload-check-list", [
      { label: "metadata.json", ok: status.metadata },
      { label: "content.html", ok: status.html },
      { label: "content.md", ok: status.markdown },
      { label: "content.txt", ok: status.text },
    ]);
  }

  function bindRegisterEvents() {
    document.getElementById("register-close-x-btn").addEventListener("click", () => {
      if (registerHasValidated && isRegisterAwaitingSave()) {
        openPopup("popup-confirm-register-close");
        return;
      }
      closePopup("popup-register");
    });

    document.getElementById("confirm-register-close-btn").addEventListener("click", () => {
      closePopup("popup-confirm-register-close");
      closePopup("popup-register");
    });

    document.getElementById("confirm-register-continue-btn").addEventListener("click", () => {
      closePopup("popup-confirm-register-close");
    });

    document.getElementById("zip-upload-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      await ZipUploadModule.setZipFile(file);
      renderUploadFileName("zip-upload-filename", file);
      registerHasValidated = false;
      document.getElementById("register-summary").classList.add("hidden");
      document.getElementById("register-fail-detail").classList.add("hidden");
      document.getElementById("register-score-area").classList.add("hidden");
      showRegisterButtonRow("none");
      // repair2: 사용자가 별도로 [검증하기]를 누르지 않도록 선택 즉시 자동 검증한다.
      if (file) {
        runRegisterValidation();
      }
    });

    document.getElementById("register-revalidate-btn").addEventListener("click", runRegisterValidation);
    document.getElementById("register-revalidate-btn-2").addEventListener("click", runRegisterValidation);

    document.getElementById("register-save-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; // 중복 저장 방지: 응답 전에는 다시 누를 수 없게 즉시 비활성화

      const result = await ZipUploadModule.saveToArchive();
      if (result.success) {
        await refreshDashboard();
        document.getElementById("register-success-card").classList.remove("hidden");
        showRegisterButtonRow("done");
      } else {
        btn.disabled = false;
        alert("저장에 실패했습니다.");
      }
    });

    document.getElementById("register-goto-archive-btn").addEventListener("click", () => {
      closePopup("popup-register");
      openArchivePopup();
    });

    document.getElementById("manual-upload-toggle-btn").addEventListener("click", (e) => {
      const panel = document.getElementById("manual-upload-panel");
      const nowCollapsed = panel.classList.toggle("manual-upload-panel--collapsed");
      e.target.textContent = nowCollapsed ? "수동 업로드 열기" : "수동 업로드 닫기";
    });

    document.getElementById("upload-metadata-input").addEventListener("change", async (e) => {
      await GptUploadModule.setMetadataFile(e.target.files[0]);
      renderUploadFileName("upload-metadata-filename", e.target.files[0]);
      renderUploadCheckList();
    });

    document.getElementById("upload-html-input").addEventListener("change", async (e) => {
      await GptUploadModule.setHtmlFile(e.target.files[0]);
      renderUploadFileName("upload-html-filename", e.target.files[0]);
      renderUploadCheckList();
    });

    document.getElementById("upload-markdown-input").addEventListener("change", async (e) => {
      await GptUploadModule.setMarkdownFile(e.target.files[0]);
      renderUploadFileName("upload-markdown-filename", e.target.files[0]);
      renderUploadCheckList();
    });

    document.getElementById("upload-text-input").addEventListener("change", async (e) => {
      await GptUploadModule.setTextFile(e.target.files[0]);
      renderUploadFileName("upload-text-filename", e.target.files[0]);
      renderUploadCheckList();
    });

    document.getElementById("upload-save-btn").addEventListener("click", async () => {
      const result = await GptUploadModule.saveToArchive();
      if (result.success) {
        await refreshDashboard();

        GptUploadModule.reset();
        ["metadata", "html", "markdown", "text"].forEach((key) => {
          document.getElementById(`upload-${key}-input`).value = "";
          renderUploadFileName(`upload-${key}-filename`, null);
        });
        renderUploadCheckList();

        alert("자료실에 저장되었습니다.");
      } else {
        alert("저장에 실패했습니다. HTML/Markdown/TXT 중 하나 이상의 파일이 필요합니다.");
      }
    });
  }

  /* ============================================================
     팝업: 블로그 등록하기
     ============================================================ */

  let selectedBloggerPostId = null;

  function isBloggerEligible(post) {
    const titleOk = !!(post.title && post.title.trim());
    const htmlOk = !!(post.htmlContent && post.htmlContent.trim());
    const seoOk = !!(post.seoResult && post.seoResult.result === "통과");
    const statusOk = !BLOGGER_FORBIDDEN_STATUS.includes(displayStatus(post.status));
    return titleOk && htmlOk && seoOk && statusOk;
  }

  function showBloggerListView() {
    document.getElementById("blogger-list-view").classList.remove("hidden");
    document.getElementById("blogger-detail-view").classList.add("hidden");
  }

  function showBloggerDetailView() {
    document.getElementById("blogger-list-view").classList.add("hidden");
    document.getElementById("blogger-detail-view").classList.remove("hidden");
  }

  async function renderBloggerCandidateList() {
    const posts = await ArchiveModule.loadPosts();
    const eligible = posts.filter(isBloggerEligible);
    const listEl = document.getElementById("blogger-candidate-list");
    listEl.innerHTML = "";

    if (eligible.length === 0) {
      const li = document.createElement("li");
      li.className = "check-item";
      li.textContent = "블로그 등록 가능한 글이 없습니다. (제목/본문/SEO 통과 필요)";
      listEl.appendChild(li);
      return;
    }

    eligible.forEach((post) => {
      const itemEl = document.createElement("li");
      itemEl.className = "archive-item";

      const titleEl = document.createElement("div");
      titleEl.className = "archive-item__title";
      titleEl.textContent = post.title || "(제목 없음)";

      const metaEl = document.createElement("div");
      metaEl.className = "archive-item__meta";
      metaEl.textContent = `${displayStatus(post.status)} · 수정일 ${formatDate(post.updatedAt)}`;

      itemEl.appendChild(titleEl);
      itemEl.appendChild(metaEl);
      itemEl.addEventListener("click", () => openBloggerDetail(post.id));

      listEl.appendChild(itemEl);
    });
  }

  async function openBloggerDetail(id) {
    const post = ArchiveModule.getPostById(id);
    if (!post) return;
    selectedBloggerPostId = id;

    BloggerModule.loadPost(post);
    ScheduleModule.loadPost(post);

    document.getElementById("blogger-detail-title").textContent = post.title || "(제목 없음)";
    document
      .getElementById("blogger-image-warning")
      .classList.toggle("hidden", !BloggerModule.hasDataUrlImages());
    document.getElementById("blogger-schedule-datetime").value = "";

    showBloggerDetailView();

    const statusEl = document.getElementById("blogger-connection-status");
    statusEl.textContent = "확인 중";
    const status = await BloggerModule.getConnectionStatus();
    statusEl.textContent = status.ok ? (status.connected ? "연결됨" : "연결 안 됨") : "확인 실패";
  }

  function openBloggerPopup() {
    showBloggerListView();
    renderBloggerCandidateList();
    openPopup("popup-blogger");
  }

  function bindBloggerEvents() {
    document.getElementById("blogger-close-btn").addEventListener("click", () => closePopup("popup-blogger"));

    document.getElementById("blogger-detail-back-btn").addEventListener("click", () => {
      showBloggerListView();
      renderBloggerCandidateList();
    });

    document.getElementById("blogger-draft-btn").addEventListener("click", async (e) => {
      const ok = confirm("블로그에 임시 저장하시겠습니까?");
      if (!ok) return;

      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const result = await BloggerModule.saveDraftToBlogger();
        if (result.success) {
          alert("블로그 임시 저장이 완료되었습니다.");
          await refreshDashboard();
          showBloggerListView();
          renderBloggerCandidateList();
        } else {
          alert("블로그 임시 저장에 실패했습니다.\n" + (result.reasons ? result.reasons.join("\n") : ""));
        }
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("blogger-schedule-btn").addEventListener("click", async () => {
      const value = document.getElementById("blogger-schedule-datetime").value;
      if (!value) {
        alert("예약 일시를 입력해주세요.");
        return;
      }
      const ok = confirm("입력한 일시로 예약 저장하시겠습니까?");
      if (!ok) return;

      const result = await ScheduleModule.saveSchedule(value);
      if (result.success) {
        alert("예약 저장되었습니다. (브라우저에 저장되는 로컬 예약 정보)");
        await refreshDashboard();
        showBloggerListView();
        renderBloggerCandidateList();
      } else {
        alert("예약 저장에 실패했습니다.\n" + result.reasons.join("\n"));
      }
    });
  }

  /* ============================================================
     팝업: 설정
     ============================================================ */

  function renderErrorList() {
    const listEl = document.getElementById("error-list");
    const errors = ErrorLogModule.getAllErrors();
    listEl.innerHTML = "";

    if (errors.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "error-item error-item--empty";
      emptyEl.textContent = "기록된 오류가 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    errors
      .slice()
      .reverse()
      .forEach((err) => {
        const itemEl = document.createElement("li");
        itemEl.className = "error-item";
        itemEl.textContent = `[${formatDate(err.createdAt)}] ${ErrorLogModule.getUserMessage(err)}`;
        listEl.appendChild(itemEl);
      });
  }

  async function renderFullCheckList() {
    const result = await StatisticsModule.runFullCheck();
    const listEl = document.getElementById("fullcheck-list");
    listEl.innerHTML = "";

    if (!result.success) {
      const errorEl = document.createElement("li");
      errorEl.className = "check-item";
      errorEl.textContent = "전체 점검을 실행할 수 없습니다.";
      listEl.appendChild(errorEl);
      return;
    }

    const verdictClassMap = {
      통과: "check-item__status--ok",
      "확인 필요": "check-item__status--warn",
      오류: "check-item__status--error",
    };

    result.items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const labelEl = document.createElement("span");
      labelEl.textContent = `${item.label} · ${item.detail}`;

      const verdictEl = document.createElement("span");
      verdictEl.className = "check-item__status " + (verdictClassMap[item.verdict] || "");
      verdictEl.textContent = item.verdict;

      li.appendChild(labelEl);
      li.appendChild(verdictEl);
      listEl.appendChild(li);
    });
  }

  async function renderSettingsPanel() {
    document.getElementById("settings-version-value").textContent = `v${AppState.version}`;

    const statusEl = document.getElementById("settings-blogger-status");
    statusEl.textContent = "확인 중";
    const status = await BloggerModule.getConnectionStatus();
    statusEl.textContent = status.ok ? (status.connected ? "연결됨" : "연결 안 됨") : "확인 실패";
  }

  function openSettingsPopup() {
    renderSettingsPanel();
    openPopup("popup-settings");
  }

  function renderGuidelinePanel() {
    document.getElementById("guideline-current-text").value = GuidelineModule.getGuidelineText();
    document.getElementById("guideline-upload-input").value = "";
    renderUploadFileName("guideline-upload-filename", null);
  }

  function bindSettingsEvents() {
    document.getElementById("settings-close-btn").addEventListener("click", () => closePopup("popup-settings"));

    // 설정 기본 화면 → 각 하위 항목 팝업 열기
    document.getElementById("open-settings-error-btn").addEventListener("click", () => {
      renderErrorList();
      document.getElementById("error-panel").classList.add("error-panel--open");
    });

    document.getElementById("open-settings-fullcheck-btn").addEventListener("click", () => {
      document.getElementById("fullcheck-list").innerHTML = "";
      openPopup("popup-settings-fullcheck");
    });
    document.getElementById("settings-fullcheck-close-btn").addEventListener("click", () => {
      closePopup("popup-settings-fullcheck");
    });
    document.getElementById("fullcheck-run-btn").addEventListener("click", renderFullCheckList);

    document.getElementById("open-settings-backup-btn").addEventListener("click", () => {
      openPopup("popup-settings-backup");
    });
    document.getElementById("settings-backup-close-btn").addEventListener("click", () => {
      closePopup("popup-settings-backup");
    });

    document.getElementById("open-settings-limitations-btn").addEventListener("click", () => {
      openPopup("popup-settings-limitations");
    });
    document.getElementById("settings-limitations-close-btn").addEventListener("click", () => {
      closePopup("popup-settings-limitations");
    });

    document.getElementById("open-settings-version-btn").addEventListener("click", () => {
      document.getElementById("settings-version-value").textContent = `v${AppState.version}`;
      openPopup("popup-settings-version");
    });
    document.getElementById("settings-version-close-btn").addEventListener("click", () => {
      closePopup("popup-settings-version");
    });

    document.getElementById("open-settings-guideline-btn").addEventListener("click", () => {
      renderGuidelinePanel();
      openPopup("popup-settings-guideline");
    });
    document.getElementById("settings-guideline-close-btn").addEventListener("click", () => {
      closePopup("popup-settings-guideline");
    });

    document.getElementById("error-panel-close-btn").addEventListener("click", () => {
      document.getElementById("error-panel").classList.remove("error-panel--open");
    });

    document.getElementById("settings-reset-btn").addEventListener("click", () => {
      openPopup("popup-confirm-reset");
    });

    document.getElementById("confirm-reset-cancel-btn").addEventListener("click", () => {
      closePopup("popup-confirm-reset");
    });

    document.getElementById("confirm-reset-btn").addEventListener("click", async () => {
      try {
        await StorageModule.replaceAllPosts([]);
        await refreshDashboard();
        closePopup("popup-confirm-reset");
        alert("데이터가 초기화되었습니다.");
      } catch (error) {
        alert("초기화에 실패했습니다.");
      }
    });

    document.getElementById("settings-logout-btn").addEventListener("click", () => {
      closePopup("popup-settings");
      AuthModule.logout();
    });
  }

  /* ============================================================
     블로그 지시서 관리 (repair2 신규)
     ============================================================ */

  function bindGuidelineEvents() {
    document.getElementById("guideline-upload-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      renderUploadFileName("guideline-upload-filename", file);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = String(event.target.result || "");
        if (GuidelineModule.saveGuidelineText(text)) {
          document.getElementById("guideline-current-text").value = text;
          alert("지시서를 업로드했습니다.");
        } else {
          alert("지시서 저장에 실패했습니다.");
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("guideline-reset-btn").addEventListener("click", () => {
      const ok = confirm("기본 지시서로 복구하시겠습니까?");
      if (!ok) return;
      GuidelineModule.resetToDefault();
      document.getElementById("guideline-current-text").value = GuidelineModule.getGuidelineText();
    });

    document.getElementById("guideline-copy-btn").addEventListener("click", async () => {
      const result = await GuidelineModule.copyToClipboard();
      alert(result.success ? "지시서를 클립보드에 복사했습니다." : "복사에 실패했습니다.");
    });

    document.getElementById("copy-guideline-btn").addEventListener("click", async () => {
      const result = await GuidelineModule.copyToClipboard();
      alert(result.success ? "GPT 지시서를 클립보드에 복사했습니다." : "복사에 실패했습니다.");
    });
  }

  function bindBackupEvents() {
    document.getElementById("backup-export-btn").addEventListener("click", async () => {
      const result = await BackupModule.exportAllData();
      if (result) {
        BackupModule.triggerDownload(result.filename, result.json);
        alert("전체 데이터를 내보냈습니다.");
      } else {
        alert("내보내기에 실패했습니다.");
      }
    });

    document.getElementById("backup-import-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const ok = confirm("전체 데이터를 가져오면 현재 저장된 데이터가 덮어써질 수 있습니다. 계속하시겠습니까?");
      if (!ok) {
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = await BackupModule.importAllData(event.target.result);
        if (result.success) {
          alert(`${result.count}개의 글을 가져왔습니다.`);
          await refreshDashboard();
        } else {
          alert("가져오기에 실패했습니다: " + result.error);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  /* ============================================================
     로그인 연동 / 초기화
     ============================================================ */

  async function onLoginSuccess() {
    await StorageModule.init();
    await refreshDashboard();
  }

  function onLogout() {
    stopTicker();
    document.querySelectorAll(".popup-overlay").forEach((el) => el.classList.remove("popup-overlay--open"));
    document.getElementById("error-panel").classList.remove("error-panel--open");
  }

  async function init() {
    AuthModule.setOnLoginSuccess(onLoginSuccess);
    AuthModule.setOnLogout(onLogout);
    AuthModule.bindEvents();

    bindDashboardEvents();
    bindRegisterEvents();
    bindArchiveEvents();
    bindPreviewEvents();
    bindQualityReviewEvents();
    bindBloggerEvents();
    bindSettingsEvents();
    bindBackupEvents();
    bindGuidelineEvents();

    if (AuthModule.isLoggedIn()) {
      AuthModule.showAppScreen();
      await onLoginSuccess();
    } else {
      AuthModule.showLoginScreen();
    }
  }

  return {
    init,
    generateId,
    formatDate,
  };
})();

const AppState = {
  version: "0.0.7",
};

document.addEventListener("DOMContentLoaded", () => {
  AppCore.init();
});
