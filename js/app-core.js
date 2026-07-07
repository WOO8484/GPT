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

  // repair(0.0.9): '임시저장완료'는 실제로 Blogger에 초안이 저장된 상태에서만 설정되는 값이지만,
  // 목록에 그대로 표시하면 "블로그 임시저장"과 혼동될 수 있어 표시 문구만 명확히 한다
  // (blogger-module.js가 저장하는 실제 상태값(post.status)은 변경하지 않는다).
  const STATUS_DISPLAY_OVERRIDE = {
    임시저장완료: "블로그스팟 임시저장 완료",
  };

  function displayStatus(status) {
    const mapped = LEGACY_STATUS_MAP[status] || status || "-";
    return STATUS_DISPLAY_OVERRIDE[mapped] || mapped;
  }

  // 작업지시서 9: 점수 체계를 Gemini 품질검수 점수 하나로 통일한다("SEO 80점 통과" 같은 표시는 제거).
  function buildQualityDisplayText(post) {
    if (post.geminiReview && post.geminiReview.status) {
      const scoreText = typeof post.geminiReview.score === "number" ? `${post.geminiReview.score}점` : "-";
      return `품질검수 ${post.geminiReview.status} · ${scoreText}`;
    }
    return "품질검수 전";
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
      const qualityText = buildQualityDisplayText(post);

      const metaEl = document.createElement("div");
      metaEl.className = "archive-item__meta";
      metaEl.textContent = `${displayStatus(post.status)} · ${formatDate(post.updatedAt)} · ${qualityText} · 이미지 ${imgCount}장`;

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
    document.getElementById("archive-detail-seo").textContent = buildQualityDisplayText(post);
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
  let qualityReviewTimerHandle = null;

  function formatElapsedTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // repair(0.0.10): 자료실 상세와 등록 팝업이 동일한 타이머/단계 로직을 공유하도록 일반화.
  function startElapsedTimer(valueElId, labelPrefix) {
    const valueEl = document.getElementById(valueElId);
    const startTime = Date.now();
    valueEl.textContent = `${labelPrefix} 00:00`;
    return setInterval(() => {
      valueEl.textContent = `${labelPrefix} ${formatElapsedTime(Date.now() - startTime)}`;
    }, 1000);
  }

  function stopElapsedTimer(handle) {
    if (handle) clearInterval(handle);
  }

  function setStageText(elId, stageLabel) {
    document.getElementById(elId).textContent = `단계: ${stageLabel}`;
  }

  function renderIssueList(listElId, issues) {
    const listEl = document.getElementById(listElId);
    listEl.innerHTML = "";

    if (!issues || issues.length === 0) {
      const li = document.createElement("li");
      li.className = "check-item";
      li.textContent = "문제 항목이 없습니다.";
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

  // 작업지시서 6: Gemini 결과에는 개선내역(improvements)도 함께 표시한다.
  function renderImprovementList(listElId, improvements) {
    const listEl = document.getElementById(listElId);
    listEl.innerHTML = "";

    if (!improvements || improvements.length === 0) {
      const li = document.createElement("li");
      li.className = "check-item";
      li.textContent = "개선내역이 없습니다.";
      listEl.appendChild(li);
      return;
    }

    improvements.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "check-item";
      const labelEl = document.createElement("span");
      labelEl.textContent = `${idx + 1}. ${item}`;
      li.appendChild(labelEl);
      listEl.appendChild(li);
    });
  }

  function buildGeminiFailDetailText(result) {
    const reasonText = result.reason || "알 수 없는 오류";
    return reasonText.includes("Gemini 품질검수 응답을 해석하지 못했습니다")
      ? "Worker가 Gemini 원문 응답을 JSON으로 해석하지 못했습니다. 본문 전달값을 보정했으니 다시 품질검수를 눌러 확인하세요."
      : `품질검수 요청에 실패했습니다. (${reasonText})`;
  }

  function setQualityReviewStage(stageLabel) {
    setStageText("quality-review-stage-text", stageLabel);
  }

  function resetQualityReviewPanel() {
    stopElapsedTimer(qualityReviewTimerHandle);
    qualityReviewTimerHandle = null;
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
    if (state !== "loading") {
      stopElapsedTimer(qualityReviewTimerHandle);
      qualityReviewTimerHandle = null;
    }
  }

  async function runQualityReview(postId) {
    const post = ArchiveModule.getPostById(postId);
    if (!post) return;

    const triggerBtn = document.getElementById("archive-detail-quality-btn");
    triggerBtn.disabled = true;
    triggerBtn.textContent = "검수 중...";

    showQualityReviewState("loading");
    qualityReviewTimerHandle = startElapsedTimer("quality-review-status-value", "Gemini 품질검수 요청 중...");
    setQualityReviewStage("요청 준비");

    const result = await GeminiReviewModule.requestReview(post, null, setQualityReviewStage);

    if (!result.success) {
      document.getElementById("quality-review-fail-reason").textContent = buildGeminiFailDetailText(result);
      document.getElementById("quality-review-fail-url").textContent = result.url
        ? `호출 주소: ${result.url}`
        : "";
      showQualityReviewState("fail");
      triggerBtn.disabled = false;
      triggerBtn.textContent = "품질 검수";
      return;
    }

    const review = result.review;
    document.getElementById("quality-review-score").textContent = `${review.score}점 (${review.status})`;
    document.getElementById("quality-review-summary").textContent = review.summary || "요약이 없습니다.";
    renderIssueList("quality-review-issue-list", review.issues);
    renderImprovementList("quality-review-improvement-list", review.improvements);
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

    document.getElementById("quality-review-retry-btn").addEventListener("click", () => {
      if (!selectedArchivePostId) return;
      runQualityReview(selectedArchivePostId);
    });

    document.getElementById("quality-review-fail-close-btn").addEventListener("click", () => {
      resetQualityReviewPanel();
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
     팝업: 등록하기 (ZIP 업로드 → 패키지 점검 자동 실행 → Gemini 품질검수 자동 실행 → 사용자 판단)
     0.0.10: 업로드 즉시 자료실에 저장하지 않는다. Gemini 결과 확인 후 사용자가
     [자료실 저장]/[문제 있어도 보관]을 눌렀을 때만 저장한다.
     기존 "재검증" 버튼은 삭제하고 [다시 업로드](새 ZIP 선택)/[다시 품질검수](같은 패키지로
     Gemini만 재실행)로 분리했다. 패키지 점검은 ZIP 선택 즉시 자동 실행되므로 별도 버튼이 없다.
     ============================================================ */

  let registerHasResult = false;
  let registerGeminiTimerHandle = null;
  let lastRegisterRewriteText = "";
  let registerCurrentReview = null;

  // stage: "none" | "package-fail" | "gemini-loading" | "gemini-pass" | "gemini-warn" | "gemini-call-fail" | "done"
  function setRegisterStage(stage) {
    const ids = [
      "register-package-check",
      "register-btn-row-package-fail",
      "register-gemini-status",
      "register-gemini-result",
      "register-gemini-fail",
      "register-btn-row-gemini-pass",
      "register-btn-row-gemini-pass-2",
      "register-btn-row-gemini-warn",
      "register-btn-row-gemini-warn-2",
      "register-btn-row-gemini-call-fail",
      "register-common-actions",
      "register-btn-row-done",
    ];
    ids.forEach((id) => document.getElementById(id).classList.add("hidden"));
    document.getElementById("register-close-x-btn").classList.remove("hidden");

    if (stage === "none") return;

    document.getElementById("register-package-check").classList.remove("hidden");

    if (stage === "package-fail") {
      document.getElementById("register-btn-row-package-fail").classList.remove("hidden");
      document.getElementById("register-common-actions").classList.remove("hidden");
    } else if (stage === "gemini-loading") {
      document.getElementById("register-gemini-status").classList.remove("hidden");
    } else if (stage === "gemini-pass") {
      document.getElementById("register-gemini-result").classList.remove("hidden");
      document.getElementById("register-btn-row-gemini-pass").classList.remove("hidden");
      document.getElementById("register-btn-row-gemini-pass-2").classList.remove("hidden");
      document.getElementById("register-common-actions").classList.remove("hidden");
      // 저장 판단 대기 중에는 실수로 팝업을 닫아버리는 것을 막기 위해 X를 숨긴다.
      document.getElementById("register-close-x-btn").classList.add("hidden");
    } else if (stage === "gemini-warn") {
      document.getElementById("register-gemini-result").classList.remove("hidden");
      document.getElementById("register-btn-row-gemini-warn").classList.remove("hidden");
      document.getElementById("register-btn-row-gemini-warn-2").classList.remove("hidden");
      document.getElementById("register-common-actions").classList.remove("hidden");
      document.getElementById("register-close-x-btn").classList.add("hidden");
    } else if (stage === "gemini-call-fail") {
      document.getElementById("register-gemini-fail").classList.remove("hidden");
      document.getElementById("register-btn-row-gemini-call-fail").classList.remove("hidden");
      document.getElementById("register-common-actions").classList.remove("hidden");
    } else if (stage === "done") {
      document.getElementById("register-gemini-result").classList.remove("hidden");
      document.getElementById("register-btn-row-done").classList.remove("hidden");
    }
  }

  // 작업지시서 4: 패키지 점검은 SEO 점수가 아니라 정상/주의/실패 상태로만 표시한다.
  function renderRegisterPackageCheck(result) {
    document.getElementById("register-package-status-value").textContent = `패키지 점검: ${result.packageStatus}`;

    const advisoriesEl = document.getElementById("register-package-advisories");
    const failDetailEl = document.getElementById("register-package-fail-detail");

    if (!result.structureOk) {
      const failedLabels = result.checklist.filter((item) => !item.ok).map((item) => item.label);
      failDetailEl.textContent = `누락/실패 항목: ${failedLabels.join(", ")}`;
      failDetailEl.classList.remove("hidden");
      advisoriesEl.classList.add("hidden");
      advisoriesEl.textContent = "";
      return;
    }

    failDetailEl.classList.add("hidden");
    failDetailEl.textContent = "";

    if (result.advisories && result.advisories.length > 0) {
      advisoriesEl.textContent = `주의 항목: ${result.advisories.join(", ")}`;
      advisoriesEl.classList.remove("hidden");
    } else {
      advisoriesEl.classList.add("hidden");
      advisoriesEl.textContent = "";
    }
  }

  // 패키지 점검 자체가 실패(구조 오류)한 경우 Gemini 없이 GPT에게 보낼 수정요청 문구를 만든다.
  function buildPackageFailureRewriteText(checklist) {
    const failedLabels = checklist
      .filter((item) => !item.ok)
      .map((item) => `- ${item.label}`)
      .join("\n");
    return (
      `방금 업로드한 ZIP 패키지에서 아래 필수 항목이 인식되지 않았습니다.\n\n` +
      `누락/인식 실패 항목:\n${failedLabels || "- 없음"}\n\n` +
      `기존 제목과 주제는 유지하고,\n` +
      `위 항목이 모두 포함되도록 ZIP 구조를 다시 만들어줘.\n` +
      `파일명은 metadata.json, content.html, content.md, content.txt, thumbnail.(png/jpg/jpeg/webp), body-01~03.(png/jpg/jpeg/webp) 형식을 지켜줘.`
    );
  }

  function mapGeminiStatusToSaveLabel(status) {
    if (status === "통과") return "품질검수 통과";
    if (status === "실패") return "품질검수 실패";
    return "품질검수 보완필요";
  }

  // 작업지시서 3.2/5: 패키지 점검 → (정상/주의면) Gemini 품질검수 자동 실행.
  function runRegisterPackageCheck() {
    const result = ZipUploadModule.runValidation();
    if (!result.success) {
      alert("ZIP 파일을 먼저 선택해주세요.");
      return;
    }

    registerHasResult = true;
    renderRegisterPackageCheck(result);

    if (!result.structureOk) {
      lastRegisterRewriteText = buildPackageFailureRewriteText(result.checklist);
      setRegisterStage("package-fail");
      return;
    }

    runRegisterGeminiReview();
  }

  async function runRegisterGeminiReview() {
    const post = ZipUploadModule.getValidatedPost();
    if (!post) return;

    setRegisterStage("gemini-loading");
    registerGeminiTimerHandle = startElapsedTimer("register-gemini-status-value", "Gemini 품질검수 요청 중...");
    setStageText("register-gemini-stage-text", "패키지 점검 완료");

    const result = await GeminiReviewModule.requestReview(post, null, (stageLabel) =>
      setStageText("register-gemini-stage-text", stageLabel)
    );

    stopElapsedTimer(registerGeminiTimerHandle);
    registerGeminiTimerHandle = null;

    if (!result.success) {
      document.getElementById("register-gemini-fail-reason").textContent = buildGeminiFailDetailText(result);
      document.getElementById("register-gemini-fail-url").textContent = result.url
        ? `호출 주소: ${result.url}`
        : "";
      setRegisterStage("gemini-call-fail");
      return;
    }

    const review = result.review;
    registerCurrentReview = review;
    document.getElementById("register-gemini-score").textContent = `${review.score}점 (${review.status})`;
    document.getElementById("register-gemini-summary").textContent = review.summary || "요약이 없습니다.";
    renderIssueList("register-gemini-issue-list", review.issues);
    renderImprovementList("register-gemini-improvement-list", review.improvements);
    lastRegisterRewriteText = GeminiReviewModule.buildRewriteRequestText(post, review);

    setRegisterStage(review.status === "통과" ? "gemini-pass" : "gemini-warn");
  }

  async function handleRegisterSave(btn) {
    btn.disabled = true; // 중복 저장 방지: 응답 전에는 다시 누를 수 없게 즉시 비활성화
    const statusLabel = mapGeminiStatusToSaveLabel(registerCurrentReview ? registerCurrentReview.status : "");
    const result = await ZipUploadModule.saveToArchive(statusLabel, registerCurrentReview);
    if (result.success) {
      await refreshDashboard();
      document.getElementById("register-success-card").classList.remove("hidden");
      setRegisterStage("done");
    } else {
      btn.disabled = false;
      alert("저장에 실패했습니다.");
    }
  }

  function resetRegisterPopupUI() {
    ZipUploadModule.reset();
    registerHasResult = false;
    registerCurrentReview = null;
    stopElapsedTimer(registerGeminiTimerHandle);
    registerGeminiTimerHandle = null;
    document.getElementById("zip-upload-input").value = "";
    renderUploadFileName("zip-upload-filename", null);
    document.getElementById("register-success-card").classList.add("hidden");
    setRegisterStage("none");

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

  // 저장 판단 대기(Gemini 결과 확인 후 아직 저장/폐기 전) 상태인지 여부
  function isRegisterAwaitingSave() {
    return document.getElementById("register-close-x-btn").classList.contains("hidden");
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
      if (registerHasResult && isRegisterAwaitingSave()) {
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
      registerHasResult = false;
      registerCurrentReview = null;
      setRegisterStage("none");
      // 작업지시서 3.2/8: ZIP 선택 즉시 패키지 점검이 자동 실행된다(별도 재검증 버튼 없음).
      if (file) {
        runRegisterPackageCheck();
      }
    });

    document.getElementById("register-package-copy-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(lastRegisterRewriteText);
        alert("수정요청 문구를 클립보드에 복사했습니다.");
      } catch (error) {
        alert("복사에 실패했습니다.");
      }
    });

    [document.getElementById("register-gemini-copy-btn"), document.getElementById("register-gemini-copy-btn-warn")].forEach(
      (btn) => {
        btn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(lastRegisterRewriteText);
            alert("수정요청 문구를 클립보드에 복사했습니다.");
          } catch (error) {
            alert("복사에 실패했습니다.");
          }
        });
      }
    );

    [document.getElementById("register-preview-btn"), document.getElementById("register-preview-btn-warn")].forEach(
      (btn) => {
        btn.addEventListener("click", () => {
          const post = ZipUploadModule.getValidatedPost();
          if (!post) {
            alert("미리보기를 열 수 없습니다.");
            return;
          }
          openPreviewPopup(post);
        });
      }
    );

    document.getElementById("register-gemini-retry-btn").addEventListener("click", () => {
      runRegisterGeminiReview();
    });

    document.getElementById("register-reupload-btn").addEventListener("click", () => {
      resetRegisterPopupUI();
      document.getElementById("zip-upload-input").click();
    });

    document.getElementById("register-discard-btn").addEventListener("click", () => {
      resetRegisterPopupUI();
    });

    document.getElementById("register-save-btn").addEventListener("click", (e) => {
      handleRegisterSave(e.currentTarget);
    });

    document.getElementById("register-keep-anyway-btn").addEventListener("click", (e) => {
      handleRegisterSave(e.currentTarget);
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

  // 작업지시서 11: 예약 날짜 기본값은 오늘, 시간은 현재 시각 이후(다음 정시)로 설정한다.
  function getDefaultScheduleDatetimeLocal() {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(
      next.getHours()
    )}:${pad(next.getMinutes())}`;
  }

  function showBloggerResult(type, message) {
    const el = document.getElementById("blogger-result-card");
    el.textContent = message;
    el.classList.remove("hidden", "result-card--success", "result-card--fail");
    el.classList.add(type === "success" ? "result-card--success" : "result-card--fail");
  }

  function resetBloggerResultCard() {
    const el = document.getElementById("blogger-result-card");
    el.classList.add("hidden");
    el.textContent = "";
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
    document.getElementById("blogger-schedule-datetime").value = getDefaultScheduleDatetimeLocal();
    resetBloggerResultCard();

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
      resetBloggerResultCard();
      try {
        const result = await BloggerModule.saveDraftToBlogger();
        if (result.success) {
          showBloggerResult(
            "success",
            "블로그스팟 임시저장 완료\nBlogger 관리자 화면에서 초안으로 확인할 수 있습니다."
          );
          await refreshDashboard();
        } else {
          showBloggerResult(
            "fail",
            "블로그 등록 실패\n사유: " + (result.reasons ? result.reasons.join(", ") : "알 수 없는 오류")
          );
        }
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("blogger-schedule-btn").addEventListener("click", async () => {
      const value = document.getElementById("blogger-schedule-datetime").value;
      if (!value) {
        showBloggerResult("fail", "예약 일시를 입력해주세요.");
        return;
      }
      const ok = confirm("입력한 일시로 예약 저장하시겠습니까?");
      if (!ok) return;

      resetBloggerResultCard();
      const result = await ScheduleModule.saveSchedule(value);
      if (result.success) {
        const [datePart, timePart] = value.split("T");
        showBloggerResult(
          "success",
          `예약 저장 완료\n예약 날짜: ${datePart}\n예약 시간: ${timePart || "-"}`
        );
        await refreshDashboard();
      } else {
        showBloggerResult("fail", "예약 저장 실패\n사유: " + result.reasons.join(", "));
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
    document.getElementById("settings-build-value").textContent = AppState.build || "-";
    document.getElementById("settings-version-worker-value").textContent = getWorkerBaseUrl();

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

    document.getElementById("open-settings-worker-btn").addEventListener("click", () => {
      document.getElementById("settings-worker-url-input").value = getWorkerBaseUrl();
      document.getElementById("settings-worker-result").textContent = "";
      openPopup("popup-settings-worker");
    });
    document.getElementById("settings-worker-close-btn").addEventListener("click", () => {
      closePopup("popup-settings-worker");
    });
    document.getElementById("settings-worker-save-btn").addEventListener("click", () => {
      const input = document.getElementById("settings-worker-url-input");
      const value = input.value.trim();
      const resultEl = document.getElementById("settings-worker-result");
      if (!value) {
        resultEl.textContent = "Worker 주소를 입력해주세요.";
        return;
      }
      const saved = setWorkerBaseUrl(value);
      resultEl.textContent = saved ? "저장했습니다. 다음 요청부터 이 주소를 사용합니다." : "저장에 실패했습니다.";
    });
    document.getElementById("settings-worker-check-btn").addEventListener("click", async () => {
      const input = document.getElementById("settings-worker-url-input");
      const resultEl = document.getElementById("settings-worker-result");
      resultEl.textContent = "연결 확인 중...";
      const health = await WorkerApiModule.checkWorkerHealth(input.value.trim());
      resultEl.textContent = health.ok
        ? `연결 정상 (${health.url})`
        : `연결 실패 (${health.url}) - ${health.reason}`;
    });

    document.getElementById("open-settings-version-btn").addEventListener("click", () => {
      document.getElementById("settings-version-value").textContent = `v${AppState.version}`;
      document.getElementById("settings-build-value").textContent = AppState.build || "-";
      document.getElementById("settings-version-worker-value").textContent = getWorkerBaseUrl();
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
  version: "0.0.10",
  build: "flow-check-gemini-auto",
};

document.addEventListener("DOMContentLoaded", () => {
  AppCore.init();
});
