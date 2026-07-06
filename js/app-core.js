/**
 * app-core.js
 * 앱 초기화, 화면 전환, 공통 렌더링 담당
 */

const AppCore = (() => {
  const VIEW_HOME = "view-home";
  const VIEW_UPLOAD = "view-upload";
  const VIEW_ARCHIVE = "view-archive";
  const VIEW_PREVIEW = "view-preview";
  const VIEW_IMAGE = "view-image";
  const VIEW_SEO = "view-seo";
  const VIEW_BLOGGER = "view-blogger";
  const VIEW_SCHEDULE = "view-schedule";
  const VIEW_STATISTICS = "view-statistics";
  const VIEW_FULLCHECK = "view-fullcheck";
  const VIEW_SETTINGS = "view-settings";

  // 레거시(영어) 상태값 표시 방어용 매핑. 실제 데이터 보정은 ArchiveModule.loadPosts()에서 수행된다.
  const LEGACY_STATUS_MAP = {
    draft: "작성중",
    published: "발행완료",
    scheduled: "예약됨",
    error: "오류",
  };

  function displayStatus(status) {
    return LEGACY_STATUS_MAP[status] || status || "-";
  }

  let selectedPostId = null;
  let previewPost = null;

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

  function buildPublishStatusText(post) {
    if (!post) return "-";
    const parts = [displayStatus(post.status)];
    if (post.bloggerInfo && post.bloggerInfo.publishedUrl) {
      parts.push(`Blogger: ${post.bloggerInfo.publishStatus || "-"}`);
    }
    if (post.scheduleInfo && post.scheduleInfo.scheduledAt) {
      parts.push(`예약: ${formatDate(post.scheduleInfo.scheduledAt)}`);
    }
    return parts.join(" · ");
  }

  function showView(viewId) {
    document.querySelectorAll(".view").forEach((el) => {
      el.classList.remove("view--active");
    });
    document.getElementById(viewId).classList.add("view--active");

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("nav-btn--active", btn.dataset.view === viewId);
    });

    if (viewId === VIEW_ARCHIVE) {
      renderArchiveList();
    } else if (viewId === VIEW_HOME) {
      renderHome();
    } else if (viewId === VIEW_SETTINGS) {
      renderSettings();
    } else if (viewId === VIEW_UPLOAD) {
      renderUploadCheckList();
    } else if (viewId === VIEW_PREVIEW) {
      renderPreviewView();
    } else if (viewId === VIEW_IMAGE) {
      renderImageView();
    } else if (viewId === VIEW_SEO) {
      renderSeoView();
    } else if (viewId === VIEW_BLOGGER) {
      renderBloggerView();
    } else if (viewId === VIEW_SCHEDULE) {
      renderScheduleView();
    } else if (viewId === VIEW_STATISTICS) {
      renderStatisticsView();
    } else if (viewId === VIEW_FULLCHECK) {
      renderFullCheckView();
    }
  }

  function renderHome() {
    document.getElementById("home-version").textContent = `버전 ${AppState.version}`;
    document.getElementById("home-post-count").textContent = `${ArchiveModule.getFilteredPosts().length}개`;
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
      itemEl.dataset.id = post.id;

      const titleEl = document.createElement("div");
      titleEl.className = "archive-item__title";
      titleEl.textContent = post.title || "(제목 없음)";

      const metaEl = document.createElement("div");
      metaEl.className = "archive-item__meta";
      metaEl.textContent = `상태: ${displayStatus(post.status)} · 수정일: ${formatDate(post.updatedAt)}`;

      itemEl.appendChild(titleEl);
      itemEl.appendChild(metaEl);
      itemEl.addEventListener("click", () => openPostDetail(post.id));

      listEl.appendChild(itemEl);
    });
  }

  function openPostDetail(id) {
    const post = ArchiveModule.getPostById(id);
    if (!post) return;
    selectedPostId = id;

    document.getElementById("detail-title").textContent = post.title || "(제목 없음)";
    document.getElementById("detail-keyword").textContent = post.keyword || "-";
    document.getElementById("detail-status").textContent = displayStatus(post.status);
    document.getElementById("detail-created").textContent = formatDate(post.createdAt);
    document.getElementById("detail-updated").textContent = formatDate(post.updatedAt);
    document.getElementById("detail-publish-status").textContent = buildPublishStatusText(post);
    document.getElementById("detail-text").textContent = post.textContent || "(내용 없음)";

    document.getElementById("archive-detail").classList.add("archive-detail--open");
  }

  function closePostDetail() {
    selectedPostId = null;
    document.getElementById("archive-detail").classList.remove("archive-detail--open");
  }

  async function renderSettings() {
    const modeText = StorageModule.getMode() === "indexedDB" ? "IndexedDB 사용 중" : "localStorage 사용 중 (fallback)";
    document.getElementById("settings-storage-status").textContent = modeText;
  }

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

  function renderUploadCheckList() {
    const status = GptUploadModule.getCheckStatus();
    const listEl = document.getElementById("upload-check-list");
    listEl.innerHTML = "";

    const items = [
      { label: "metadata.json", ok: status.metadata },
      { label: "content.html", ok: status.html },
      { label: "content.md", ok: status.markdown },
      { label: "content.txt", ok: status.text },
    ];

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const labelEl = document.createElement("span");
      labelEl.textContent = item.label;

      const statusEl = document.createElement("span");
      statusEl.className = "check-item__status " + (item.ok ? "check-item__status--ok" : "check-item__status--missing");
      statusEl.textContent = item.ok ? "인식됨" : "없음";

      li.appendChild(labelEl);
      li.appendChild(statusEl);
      listEl.appendChild(li);
    });
  }

  function renderImageView() {
    const post = ImageModule.getCurrentPost();
    document.getElementById("image-post-title").textContent = post ? (post.title || "(제목 없음)") : "선택된 글이 없습니다.";
    renderImageList();
  }

  function renderImageList() {
    const listEl = document.getElementById("image-list");
    const imageList = ImageModule.getImageList();
    listEl.innerHTML = "";

    if (imageList.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "check-item";
      emptyEl.textContent = "등록된 이미지가 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    imageList.forEach((img) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const row = document.createElement("div");
      row.className = "image-item__row";

      const thumb = document.createElement("img");
      thumb.className = "image-item__thumb";
      thumb.src = img.dataUrl;
      thumb.alt = img.altText || "";

      const info = document.createElement("div");
      info.className = "image-item__info";

      const nameEl = document.createElement("div");
      nameEl.className = "image-item__filename";
      nameEl.textContent = `${img.fileName} (${img.type === "thumbnail" ? "썸네일" : "본문"})`;

      const altInput = document.createElement("input");
      altInput.className = "image-item__alt-input";
      altInput.type = "text";
      altInput.placeholder = "ALT 태그 입력";
      altInput.value = img.altText || "";
      altInput.addEventListener("change", (e) => {
        ImageModule.updateAltText(img.id, e.target.value);
      });

      info.appendChild(nameEl);
      info.appendChild(altInput);

      row.appendChild(thumb);
      row.appendChild(info);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "image-item__delete-btn";
      deleteBtn.textContent = "삭제하기";
      deleteBtn.addEventListener("click", () => {
        ImageModule.removeImage(img.id);
        renderImageList();
      });

      li.appendChild(row);
      li.appendChild(deleteBtn);
      listEl.appendChild(li);
    });
  }

  function renderSeoView() {
    const post = SeoModule.getCurrentPost();
    document.getElementById("seo-post-title").textContent = post ? (post.title || "(제목 없음)") : "선택된 글이 없습니다.";

    if (post && post.seoResult && post.seoResult.checkedAt) {
      renderSeoResult(post.seoResult);
    } else {
      document.getElementById("seo-total-score").textContent = "-";
      document.getElementById("seo-result-badge").textContent = "-";
      document.getElementById("seo-issue-list").innerHTML = "";
    }
  }

  function renderSeoResult(seoResult) {
    document.getElementById("seo-total-score").textContent = `${seoResult.totalScore}점`;
    document.getElementById("seo-result-badge").textContent = seoResult.result;

    const listEl = document.getElementById("seo-issue-list");
    listEl.innerHTML = "";

    if (!seoResult.issues || seoResult.issues.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "seo-issue-item";
      emptyEl.textContent = "발견된 문제가 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    seoResult.issues.forEach((issue) => {
      const li = document.createElement("li");
      li.className = "seo-issue-item";
      li.textContent = issue;
      listEl.appendChild(li);
    });
  }

  function renderBloggerView() {
    const post = BloggerModule.getCurrentPost();
    document.getElementById("blogger-post-title").textContent = post
      ? post.title || "(제목 없음)"
      : "선택된 글이 없습니다.";

    if (!post) {
      document.getElementById("blogger-seo-status").textContent = "-";
      document.getElementById("blogger-ready-status").textContent = "-";
      document.getElementById("blogger-reason-list").innerHTML = "";
      document.getElementById("blogger-reason-list").classList.add("hidden");
      document.getElementById("blogger-check-title").textContent = "-";
      document.getElementById("blogger-check-tags").textContent = "-";
      document.getElementById("blogger-html-check").textContent = "-";
      document.getElementById("blogger-image-warning").classList.add("hidden");
      document.getElementById("blogger-image-list").innerHTML = "";
      return;
    }

    document.getElementById("blogger-seo-status").textContent =
      post.seoResult && post.seoResult.result ? post.seoResult.result : "미검수";

    const readiness = BloggerModule.checkPublishReadiness();
    document.getElementById("blogger-ready-status").textContent = readiness.canPublish
      ? "발행 가능"
      : "발행 불가";

    const reasonListEl = document.getElementById("blogger-reason-list");
    reasonListEl.innerHTML = "";
    if (readiness.reasons && readiness.reasons.length > 0) {
      readiness.reasons.forEach((reason) => {
        const li = document.createElement("li");
        li.className = "check-item";
        li.textContent = reason;
        reasonListEl.appendChild(li);
      });
      reasonListEl.classList.remove("hidden");
    } else {
      reasonListEl.classList.add("hidden");
    }

    document.getElementById("blogger-check-title").textContent = post.title || "(제목 없음)";
    document.getElementById("blogger-check-tags").textContent =
      Array.isArray(post.tags) && post.tags.length > 0 ? post.tags.join(", ") : "-";
    document.getElementById("blogger-html-check").textContent = post.htmlContent || "(내용 없음)";

    document
      .getElementById("blogger-image-warning")
      .classList.toggle("hidden", !BloggerModule.hasDataUrlImages());

    renderBloggerImageList(Array.isArray(post.imageList) ? post.imageList : []);
  }

  function renderBloggerImageList(imageList) {
    const listEl = document.getElementById("blogger-image-list");
    listEl.innerHTML = "";

    if (imageList.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "check-item";
      emptyEl.textContent = "등록된 이미지가 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    imageList.forEach((img) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const isDataUrl = typeof img.dataUrl === "string" && img.dataUrl.indexOf("data:") === 0;

      const labelEl = document.createElement("span");
      labelEl.textContent = `${img.fileName} (${img.type === "thumbnail" ? "썸네일" : "본문"})`;

      const statusEl = document.createElement("span");
      statusEl.className =
        "check-item__status " + (isDataUrl ? "check-item__status--missing" : "check-item__status--ok");
      statusEl.textContent = isDataUrl ? "변환 필요" : "확인됨";

      li.appendChild(labelEl);
      li.appendChild(statusEl);
      listEl.appendChild(li);
    });
  }

  async function renderScheduleView() {
    const post = ScheduleModule.getCurrentPost();
    document.getElementById("schedule-post-title").textContent = post
      ? post.title || "(제목 없음)"
      : "선택된 글이 없습니다.";
    document.getElementById("schedule-current-status").textContent = ScheduleModule.getScheduleStatusText();

    const entries = await ScheduleModule.getAllScheduleEntries();
    renderScheduleList(entries);
  }

  function renderScheduleList(entries) {
    const listEl = document.getElementById("schedule-list");
    listEl.innerHTML = "";

    if (!entries || entries.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "check-item";
      emptyEl.textContent = "예약된 글이 없습니다.";
      listEl.appendChild(emptyEl);
      return;
    }

    entries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const labelEl = document.createElement("span");
      labelEl.textContent = `${entry.title} · ${formatDate(entry.scheduledAt)}`;

      const statusEl = document.createElement("span");
      statusEl.className =
        "check-item__status " + (entry.isPast ? "check-item__status--missing" : "check-item__status--ok");
      statusEl.textContent = entry.isPast ? "지남" : "예정";

      li.appendChild(labelEl);
      li.appendChild(statusEl);
      listEl.appendChild(li);
    });
  }

  async function renderStatisticsView() {
    const stats = await StatisticsModule.computeStatistics();

    if (!stats.success) {
      document.getElementById("stats-total-count").textContent = "-";
      document.getElementById("stats-seo-pass-count").textContent = "-";
      document.getElementById("stats-status-list").innerHTML = "";
      document.getElementById("stats-problem-list").innerHTML = "";
      document.getElementById("stats-recent-list").innerHTML = "";
      return;
    }

    document.getElementById("stats-total-count").textContent = `${stats.totalCount}개`;
    document.getElementById("stats-seo-pass-count").textContent = `${stats.seoPassCount}개`;

    const statusListEl = document.getElementById("stats-status-list");
    statusListEl.innerHTML = "";
    Object.keys(stats.statusCounts).forEach((status) => {
      const li = document.createElement("li");
      li.className = "check-item";

      const labelEl = document.createElement("span");
      labelEl.textContent = status;

      const valueEl = document.createElement("span");
      valueEl.className = "check-item__status";
      valueEl.textContent = `${stats.statusCounts[status]}개`;

      li.appendChild(labelEl);
      li.appendChild(valueEl);
      statusListEl.appendChild(li);
    });

    const problemListEl = document.getElementById("stats-problem-list");
    problemListEl.innerHTML = "";
    if (stats.problemPosts.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "check-item";
      emptyEl.textContent = "문제 있는 글이 없습니다.";
      problemListEl.appendChild(emptyEl);
    } else {
      stats.problemPosts.forEach((p) => {
        const li = document.createElement("li");
        li.className = "check-item";

        const labelEl = document.createElement("span");
        labelEl.textContent = p.title;

        const statusEl = document.createElement("span");
        statusEl.className = "check-item__status check-item__status--warn";
        statusEl.textContent = p.reasons.join(", ");

        li.appendChild(labelEl);
        li.appendChild(statusEl);
        problemListEl.appendChild(li);
      });
    }

    const recentListEl = document.getElementById("stats-recent-list");
    recentListEl.innerHTML = "";
    if (stats.recentPosts.length === 0) {
      const emptyEl = document.createElement("li");
      emptyEl.className = "check-item";
      emptyEl.textContent = "저장된 글이 없습니다.";
      recentListEl.appendChild(emptyEl);
    } else {
      stats.recentPosts.forEach((p) => {
        const li = document.createElement("li");
        li.className = "check-item";

        const labelEl = document.createElement("span");
        labelEl.textContent = `${p.title} · ${displayStatus(p.status)}`;

        const dateEl = document.createElement("span");
        dateEl.className = "check-item__status";
        dateEl.textContent = formatDate(p.updatedAt);

        li.appendChild(labelEl);
        li.appendChild(dateEl);
        recentListEl.appendChild(li);
      });
    }
  }

  async function renderFullCheckView() {
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

  function renderPreviewView() {
    if (!previewPost) return;

    const rendered = PreviewModule.renderPreview(previewPost);
    if (!rendered) {
      alert("미리보기를 표시할 수 없습니다.");
      return;
    }

    document.getElementById("preview-title").textContent = rendered.title;
    document.getElementById("preview-keyword").textContent = rendered.keyword;
    document.getElementById("preview-meta").textContent = rendered.metaDescription;
    document.getElementById("preview-tags").textContent = rendered.tags;
    document.getElementById("preview-html-content").innerHTML = rendered.safeHtml;
    document.getElementById("preview-markdown-content").textContent = rendered.markdownContent;
    document.getElementById("preview-text-content").textContent = rendered.textContent;

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

    showPreviewTab("html");
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

  function bindNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
    });

    document.getElementById("home-goto-upload").addEventListener("click", () => showView(VIEW_UPLOAD));
    document.getElementById("home-goto-archive").addEventListener("click", () => showView(VIEW_ARCHIVE));
    document.getElementById("home-goto-preview").addEventListener("click", () => showView(VIEW_PREVIEW));
    document.getElementById("home-goto-settings").addEventListener("click", () => showView(VIEW_SETTINGS));
  }

  function bindArchiveEvents() {
    document.getElementById("archive-search").addEventListener("input", (e) => {
      ArchiveModule.setSearchText(e.target.value);
      renderArchiveList();
    });

    document.getElementById("archive-status-filter").addEventListener("change", (e) => {
      ArchiveModule.setStatusFilter(e.target.value);
      renderArchiveList();
    });

    document.getElementById("detail-close-btn").addEventListener("click", closePostDetail);

    document.getElementById("detail-delete-btn").addEventListener("click", async () => {
      if (!selectedPostId) return;
      const ok = confirm("이 글을 삭제하시겠습니까?");
      if (!ok) return;
      await ArchiveModule.deletePost(selectedPostId);
      closePostDetail();
      renderArchiveList();
      renderHome();
    });

    document.getElementById("detail-export-btn").addEventListener("click", () => {
      if (!selectedPostId) return;
      const result = ArchiveModule.exportPostAsJson(selectedPostId);
      if (result) {
        BackupModule.triggerDownload(result.filename, result.json);
      }
    });

    document.getElementById("detail-open-preview-btn").addEventListener("click", () => {
      if (!selectedPostId) return;
      const post = ArchiveModule.getPostById(selectedPostId);
      if (!post) {
        ErrorLogModule.logError({
          module: "archive-module",
          message: "미리보기 렌더링 실패",
          detail: "선택한 글을 찾을 수 없음",
          relatedId: selectedPostId,
        });
        alert("미리보기를 열 수 없습니다.");
        return;
      }
      previewPost = post;
      closePostDetail();
      showView(VIEW_PREVIEW);
    });

    document.getElementById("detail-open-image-btn").addEventListener("click", () => {
      if (!selectedPostId) return;
      const post = ArchiveModule.getPostById(selectedPostId);
      if (!post) {
        alert("이미지 관리를 열 수 없습니다.");
        return;
      }
      ImageModule.loadPost(post);
      closePostDetail();
      showView(VIEW_IMAGE);
    });

    document.getElementById("detail-open-seo-btn").addEventListener("click", () => {
      if (!selectedPostId) return;
      const post = ArchiveModule.getPostById(selectedPostId);
      if (!post) {
        alert("SEO 검수를 열 수 없습니다.");
        return;
      }
      SeoModule.loadPost(post);
      closePostDetail();
      showView(VIEW_SEO);
    });

    document.getElementById("detail-open-blogger-btn").addEventListener("click", () => {
      if (!selectedPostId) return;
      const post = ArchiveModule.getPostById(selectedPostId);
      if (!post) {
        alert("Blogger 업로드 화면을 열 수 없습니다.");
        return;
      }
      BloggerModule.loadPost(post);
      closePostDetail();
      showView(VIEW_BLOGGER);
    });

    document.getElementById("detail-open-schedule-btn").addEventListener("click", () => {
      if (!selectedPostId) return;
      const post = ArchiveModule.getPostById(selectedPostId);
      if (!post) {
        alert("예약발행 화면을 열 수 없습니다.");
        return;
      }
      ScheduleModule.loadPost(post);
      closePostDetail();
      showView(VIEW_SCHEDULE);
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
          await ArchiveModule.loadPosts();
          renderArchiveList();
          renderHome();
        } else {
          alert("가져오기에 실패했습니다: " + result.error);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  function bindSettingsEvents() {
    document.getElementById("settings-error-view-btn").addEventListener("click", () => {
      renderErrorList();
      document.getElementById("error-panel").classList.add("error-panel--open");
    });

    document.getElementById("error-panel-close-btn").addEventListener("click", () => {
      document.getElementById("error-panel").classList.remove("error-panel--open");
    });

    document.getElementById("settings-goto-statistics-btn").addEventListener("click", () => {
      showView(VIEW_STATISTICS);
    });

    document.getElementById("settings-goto-fullcheck-btn").addEventListener("click", () => {
      showView(VIEW_FULLCHECK);
    });
  }

  function renderUploadFileName(displayId, file) {
    const el = document.getElementById(displayId);
    if (!el) return;
    el.textContent = file ? file.name : "선택된 파일 없음";
  }

  function bindUploadEvents() {
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
        previewPost = result.post;
        renderArchiveList();
        renderHome();

        GptUploadModule.reset();
        document.getElementById("upload-metadata-input").value = "";
        document.getElementById("upload-html-input").value = "";
        document.getElementById("upload-markdown-input").value = "";
        document.getElementById("upload-text-input").value = "";
        renderUploadFileName("upload-metadata-filename", null);
        renderUploadFileName("upload-html-filename", null);
        renderUploadFileName("upload-markdown-filename", null);
        renderUploadFileName("upload-text-filename", null);
        renderUploadCheckList();

        alert("자료실에 저장되었습니다.");
      } else {
        alert("저장에 실패했습니다. HTML/Markdown/TXT 중 하나 이상의 파일이 필요합니다.");
      }
    });

    document.getElementById("upload-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });

    document.getElementById("upload-goto-preview-btn").addEventListener("click", () => {
      if (!previewPost) {
        alert("먼저 자료실에 저장한 뒤 자료실에서 미리보기를 열어주세요.");
        return;
      }
      showView(VIEW_PREVIEW);
    });
  }

  function bindPreviewEvents() {
    document.getElementById("preview-view-html-btn").addEventListener("click", () => showPreviewTab("html"));
    document.getElementById("preview-view-markdown-btn").addEventListener("click", () => showPreviewTab("markdown"));
    document.getElementById("preview-view-text-btn").addEventListener("click", () => showPreviewTab("text"));

    document.getElementById("preview-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });

    document.getElementById("preview-goto-upload-btn").addEventListener("click", () => {
      showView(VIEW_UPLOAD);
    });
  }

  function bindImageEvents() {
    document.getElementById("image-thumbnail-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const result = await ImageModule.addImage(file, "thumbnail");
      if (result.success) {
        renderImageList();
      } else {
        alert("썸네일 등록에 실패했습니다.");
      }
      e.target.value = "";
    });

    document.getElementById("image-body-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const result = await ImageModule.addImage(file, "body");
      if (result.success) {
        renderImageList();
      } else {
        alert("본문 이미지 등록에 실패했습니다.");
      }
      e.target.value = "";
    });

    document.getElementById("image-save-btn").addEventListener("click", async () => {
      const result = await ImageModule.saveImageList();
      if (result.success) {
        renderArchiveList();
        alert("저장되었습니다.");
      } else {
        alert("저장에 실패했습니다.");
      }
    });

    document.getElementById("image-goto-preview-btn").addEventListener("click", () => {
      const post = ImageModule.getCurrentPost();
      if (!post) {
        alert("먼저 자료실에서 글을 선택해주세요.");
        return;
      }
      previewPost = post;
      showView(VIEW_PREVIEW);
    });

    document.getElementById("image-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });
  }

  function bindSeoEvents() {
    document.getElementById("seo-check-btn").addEventListener("click", async () => {
      const seoResult = SeoModule.runCheck();
      if (!seoResult) {
        alert("검수에 실패했습니다. 먼저 자료실에서 글을 선택해주세요.");
        return;
      }
      renderSeoResult(seoResult);

      const saveResult = await SeoModule.saveSeoResult();
      if (saveResult.success) {
        renderArchiveList();
      } else {
        alert("검수 결과 저장에 실패했습니다.");
      }
    });

    document.getElementById("seo-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });

    document.getElementById("seo-goto-preview-btn").addEventListener("click", () => {
      const post = SeoModule.getCurrentPost();
      if (!post) {
        alert("먼저 자료실에서 글을 선택해주세요.");
        return;
      }
      previewPost = post;
      showView(VIEW_PREVIEW);
    });
  }

  function bindBloggerEvents() {
    document.getElementById("blogger-config-save-btn").addEventListener("click", () => {
      const blogId = document.getElementById("blogger-blogid-input").value;
      const token = document.getElementById("blogger-token-input").value;
      const result = BloggerModule.saveBloggerConfig(blogId, token);
      if (result.success) {
        alert("Blogger 설정이 저장되었습니다.");
      } else {
        alert("설정 저장에 실패했습니다.\n" + result.reasons.join("\n"));
      }
      renderBloggerView();
    });

    document.getElementById("blogger-mark-ready-btn").addEventListener("click", async () => {
      const ok = confirm("발행대기 상태로 전환하시겠습니까?");
      if (!ok) return;

      const result = await BloggerModule.markReadyToPublish();
      if (result.success) {
        alert(result.alreadyReady ? "이미 발행대기 상태입니다." : "발행대기 상태로 변경되었습니다.");
        renderArchiveList();
        renderHome();
      } else {
        alert("발행대기로 변경할 수 없습니다.\n" + result.reasons.join("\n"));
      }
      renderBloggerView();
    });

    async function runBloggerUpload(mode, btn) {
      btn.disabled = true;
      try {
        const result = await BloggerModule.uploadToBlogger(mode);
        if (result.success) {
          alert(mode === "publish" ? "Blogger에 발행되었습니다." : "임시저장으로 업로드되었습니다.");
          renderArchiveList();
          renderHome();
        } else if (result.uploaded) {
          alert(
            "Blogger 업로드는 성공했지만 로컬 저장에 실패했습니다. 자료실 상태가 실제 Blogger 상태와 다를 수 있습니다."
          );
          renderArchiveList();
          renderHome();
        } else {
          alert(
            (mode === "publish" ? "발행에 실패했습니다.\n" : "임시저장 업로드에 실패했습니다.\n") +
              (result.reasons ? result.reasons.join("\n") : "")
          );
        }
      } finally {
        btn.disabled = false;
        renderBloggerView();
      }
    }

    document.getElementById("blogger-upload-draft-btn").addEventListener("click", async (e) => {
      const ok = confirm("임시저장으로 Blogger에 업로드하시겠습니까?");
      if (!ok) return;
      await runBloggerUpload("draft", e.currentTarget);
    });

    document.getElementById("blogger-upload-publish-btn").addEventListener("click", async (e) => {
      const ok = confirm("실제로 발행하면 Blogger에 공개됩니다. 발행하시겠습니까?");
      if (!ok) {
        const post = BloggerModule.getCurrentPost();
        ErrorLogModule.logError({
          module: "blogger-module",
          message: "발행 전 사용자 확인 취소",
          detail: "사용자가 실제 발행 확인 팝업에서 취소를 선택함",
          relatedId: post ? post.id : null,
        });
        return;
      }
      await runBloggerUpload("publish", e.currentTarget);
    });

    document.getElementById("blogger-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });

    document.getElementById("blogger-goto-preview-btn").addEventListener("click", () => {
      const post = BloggerModule.getCurrentPost();
      if (!post) {
        alert("먼저 자료실에서 글을 선택해주세요.");
        return;
      }
      previewPost = post;
      showView(VIEW_PREVIEW);
    });
  }

  function bindScheduleEvents() {
    document.getElementById("schedule-save-btn").addEventListener("click", async () => {
      const value = document.getElementById("schedule-datetime-input").value;

      if (value) {
        const ok = confirm("입력한 일시로 예약하시겠습니까?");
        if (!ok) {
          const post = ScheduleModule.getCurrentPost();
          ErrorLogModule.logError({
            module: "schedule-module",
            message: "예약 전 사용자 확인 취소",
            detail: "사용자가 예약 저장 확인 팝업에서 취소를 선택함",
            relatedId: post ? post.id : null,
          });
          return;
        }
      }

      const result = await ScheduleModule.saveSchedule(value);
      if (result.success) {
        alert("예약이 저장되었습니다.");
        renderArchiveList();
        renderHome();
      } else {
        alert("예약 저장에 실패했습니다.\n" + result.reasons.join("\n"));
      }
      renderScheduleView();
    });

    document.getElementById("schedule-cancel-btn").addEventListener("click", async () => {
      const ok = confirm("예약을 취소하시겠습니까?");
      if (!ok) return;
      const result = await ScheduleModule.cancelSchedule();
      if (result.success) {
        alert("예약이 취소되었습니다.");
        document.getElementById("schedule-datetime-input").value = "";
        renderArchiveList();
        renderHome();
      } else {
        alert("예약 취소에 실패했습니다.\n" + result.reasons.join("\n"));
      }
      renderScheduleView();
    });

    document.getElementById("schedule-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });
  }

  function bindStatisticsEvents() {
    document.getElementById("stats-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });

    document.getElementById("stats-goto-settings-btn").addEventListener("click", () => {
      showView(VIEW_SETTINGS);
    });
  }

  function bindFullCheckEvents() {
    document.getElementById("fullcheck-run-btn").addEventListener("click", () => {
      renderFullCheckView();
    });

    document.getElementById("fullcheck-goto-archive-btn").addEventListener("click", () => {
      showView(VIEW_ARCHIVE);
    });

    document.getElementById("fullcheck-goto-settings-btn").addEventListener("click", () => {
      showView(VIEW_SETTINGS);
    });
  }

  async function init() {
    await StorageModule.init();
    await ArchiveModule.loadPosts();

    bindNav();
    bindArchiveEvents();
    bindBackupEvents();
    bindSettingsEvents();
    bindUploadEvents();
    bindPreviewEvents();
    bindImageEvents();
    bindSeoEvents();
    bindBloggerEvents();
    bindScheduleEvents();
    bindStatisticsEvents();
    bindFullCheckEvents();

    showView(VIEW_HOME);
  }

  return {
    init,
    generateId,
    formatDate,
  };
})();

const AppState = {
  version: "0.0.5",
};

document.addEventListener("DOMContentLoaded", () => {
  AppCore.init();
});
