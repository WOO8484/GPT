/**
 * blogger-module.js
 * Blogger 업로드 준비/검증/실행 모듈
 *
 * 보안 원칙:
 * - Blog ID / Access Token은 세션(모듈 변수) 메모리에만 보관하며,
 *   localStorage/IndexedDB 등 영속 저장소에는 기록하지 않는다.
 * - Client Secret, Refresh Token은 다루지 않는다(OAuth 전체 로그인 플로우는 이번 Phase 범위 밖).
 *
 * 주의:
 * - imageList의 dataUrl 이미지를 HTML 본문에 자동 삽입하지 않는다.
 * - Google Drive 업로드, Blogger 이미지 업로드 API는 이번 Phase에서 구현하지 않는다.
 */

const BloggerModule = (() => {
  const FORBIDDEN_PUBLISH_STATUS = ["작성중", "보류", "오류", "발행완료"];
  const LEGACY_STATUS_MAP = {
    draft: "작성중",
    published: "발행완료",
    scheduled: "예약됨",
    error: "오류",
  };

  // Blog ID / Access Token: 세션 동안만 메모리에 유지 (새로고침 시 초기화)
  let bloggerConfig = {
    blogId: "",
    accessToken: "",
  };

  let currentPost = null;

  function normalizeStatus(status) {
    return LEGACY_STATUS_MAP[status] || status;
  }

  function loadPost(post) {
    currentPost = post;
    if (currentPost && !currentPost.bloggerInfo) {
      currentPost.bloggerInfo = {
        blogId: null,
        bloggerPostId: null,
        publishedUrl: null,
        publishStatus: null,
        publishedAt: null,
        lastError: null,
      };
    }
    return currentPost;
  }

  function getCurrentPost() {
    return currentPost;
  }

  function saveBloggerConfig(blogId, accessToken) {
    const trimmedBlogId = (blogId || "").trim();
    const trimmedToken = (accessToken || "").trim();

    if (!trimmedBlogId && !trimmedToken) {
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Blogger 설정값 누락",
        detail: "Blog ID와 Access Token이 모두 비어 있음",
        relatedId: currentPost ? currentPost.id : null,
      });
      return { success: false, reasons: ["Blog ID와 Access Token을 입력해주세요."] };
    }

    const reasons = [];

    if (!trimmedBlogId) {
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Blog ID 누락",
        detail: "Blog ID 입력값 없음",
        relatedId: currentPost ? currentPost.id : null,
      });
      reasons.push("Blog ID를 입력해주세요.");
    }

    if (!trimmedToken) {
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Access Token 누락",
        detail: "Access Token 입력값 없음",
        relatedId: currentPost ? currentPost.id : null,
      });
      reasons.push("Access Token을 입력해주세요.");
    }

    if (trimmedBlogId) bloggerConfig.blogId = trimmedBlogId;
    if (trimmedToken) bloggerConfig.accessToken = trimmedToken;

    return { success: reasons.length === 0, reasons };
  }

  function hasDataUrlImages() {
    if (!currentPost || !Array.isArray(currentPost.imageList)) return false;
    return currentPost.imageList.some(
      (img) => typeof img.dataUrl === "string" && img.dataUrl.indexOf("data:") === 0
    );
  }

  function checkPublishReadiness() {
    if (!currentPost) {
      return { canPublish: false, reasons: ["선택된 글이 없습니다."] };
    }

    const reasons = [];

    const titleOk = !!(currentPost.title && currentPost.title.trim());
    if (!titleOk) reasons.push("제목이 없습니다.");

    const htmlOk = !!(currentPost.htmlContent && currentPost.htmlContent.trim());
    if (!htmlOk) reasons.push("HTML 본문이 없습니다.");

    const seoOk = !!(currentPost.seoResult && currentPost.seoResult.result === "통과");
    if (!seoOk) reasons.push("SEO 검수를 통과하지 못했습니다.");

    const normalizedStatus = normalizeStatus(currentPost.status);
    const statusOk = !FORBIDDEN_PUBLISH_STATUS.includes(normalizedStatus);
    if (!statusOk) reasons.push(`현재 상태(${currentPost.status})에서는 발행할 수 없습니다.`);

    const blogIdOk = !!bloggerConfig.blogId;
    if (!blogIdOk) reasons.push("Blog ID가 없습니다.");

    const accessTokenOk = !!bloggerConfig.accessToken;
    if (!accessTokenOk) reasons.push("Access Token이 없습니다.");

    return {
      canPublish: titleOk && htmlOk && seoOk && statusOk && blogIdOk && accessTokenOk,
      titleOk,
      htmlOk,
      seoOk,
      statusOk,
      blogIdOk,
      accessTokenOk,
      reasons,
    };
  }

  async function markReadyToPublish() {
    if (!currentPost) {
      return { success: false, reasons: ["선택된 글이 없습니다."] };
    }

    const normalizedStatus = normalizeStatus(currentPost.status);

    if (normalizedStatus === "발행대기") {
      return { success: true, alreadyReady: true };
    }

    const reasons = [];
    if (normalizedStatus !== "검수중") {
      reasons.push(
        `현재 상태(${currentPost.status})에서는 발행대기로 변경할 수 없습니다. 검수중 상태에서만 가능합니다.`
      );
    }
    if (!currentPost.seoResult || currentPost.seoResult.result !== "통과") {
      reasons.push("SEO 검수를 통과해야 발행대기로 변경할 수 있습니다.");
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "SEO 미통과 상태에서 발행 시도",
        detail: `현재 SEO 결과: ${currentPost.seoResult ? currentPost.seoResult.result : "미검수"}`,
        relatedId: currentPost.id,
      });
    }

    if (reasons.length > 0) {
      return { success: false, reasons };
    }

    const previousStatusValue = currentPost.status;
    currentPost.status = "발행대기";
    currentPost.updatedAt = new Date().toISOString();

    try {
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (error) {
      currentPost.status = previousStatusValue;
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "발행 결과 저장 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["저장에 실패했습니다."] };
    }
  }

  function buildBloggerPayload() {
    const safeHtml =
      typeof PreviewModule !== "undefined" && typeof PreviewModule.sanitizeHtml === "function"
        ? PreviewModule.sanitizeHtml(currentPost.htmlContent)
        : currentPost.htmlContent || "";

    return {
      kind: "blogger#post",
      title: currentPost.title || "",
      content: safeHtml,
      labels: Array.isArray(currentPost.tags) ? currentPost.tags : [],
    };
  }

  async function uploadToBlogger(mode) {
    const isDraft = mode !== "publish"; // 기본값은 안전한 "임시저장"

    if (!currentPost) {
      return { success: false, reasons: ["선택된 글이 없습니다."] };
    }
    if (!currentPost.bloggerInfo) {
      currentPost.bloggerInfo = {
        blogId: null,
        bloggerPostId: null,
        publishedUrl: null,
        publishStatus: null,
        publishedAt: null,
        lastError: null,
      };
    }

    const readiness = checkPublishReadiness();
    if (!readiness.canPublish) {
      if (!readiness.htmlOk) {
        ErrorLogModule.logError({
          module: "blogger-module",
          message: "HTML 본문 누락",
          detail: "업로드 시도 시 htmlContent 없음",
          relatedId: currentPost.id,
        });
      }
      if (!readiness.seoOk) {
        ErrorLogModule.logError({
          module: "blogger-module",
          message: "SEO 미통과 상태에서 발행 시도",
          detail: `현재 SEO 결과: ${currentPost.seoResult ? currentPost.seoResult.result : "미검수"}`,
          relatedId: currentPost.id,
        });
      }
      if (!readiness.blogIdOk) {
        ErrorLogModule.logError({
          module: "blogger-module",
          message: "Blog ID 누락",
          detail: "업로드 시도 시 Blog ID 없음",
          relatedId: currentPost.id,
        });
      }
      if (!readiness.accessTokenOk) {
        ErrorLogModule.logError({
          module: "blogger-module",
          message: "Access Token 누락",
          detail: "업로드 시도 시 Access Token 없음",
          relatedId: currentPost.id,
        });
      }
      return { success: false, reasons: readiness.reasons };
    }

    if (hasDataUrlImages()) {
      // 경고만 기록하고 업로드는 계속 진행한다 (본문에는 이미지가 자동 삽입되지 않음).
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "dataUrl 이미지 변환 필요",
        detail: "imageList에 dataUrl 형식 이미지가 포함된 상태로 업로드 시도",
        relatedId: currentPost.id,
      });
    }

    const payload = buildBloggerPayload();
    const endpoint = `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(
      bloggerConfig.blogId
    )}/posts/${isDraft ? "?isDraft=true" : ""}`;
    const failureMessage = isDraft ? "임시저장 업로드 실패" : "실제 발행 실패";
    const failureLabel = isDraft ? "임시저장 업로드" : "발행";

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bloggerConfig.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      currentPost.bloggerInfo.lastError = failureMessage;
      ErrorLogModule.logError({
        module: "blogger-module",
        message: failureMessage,
        detail: networkError.message,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: [`네트워크 오류로 ${failureLabel}에 실패했습니다.`] };
    }

    if (!response.ok) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch (readError) {
        bodyText = "";
      }
      currentPost.bloggerInfo.lastError = `${failureMessage} (HTTP ${response.status})`;
      ErrorLogModule.logError({
        module: "blogger-module",
        message: failureMessage,
        detail: `HTTP ${response.status} ${bodyText}`.trim(),
        relatedId: currentPost.id,
      });
      return { success: false, reasons: [`${failureLabel}에 실패했습니다. (HTTP ${response.status})`] };
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      currentPost.bloggerInfo.lastError = "Blogger 응답 파싱 실패";
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Blogger 응답 파싱 실패",
        detail: parseError.message,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["Blogger 응답을 해석할 수 없습니다."] };
    }

    // Blogger API v3 Post.status 참고값: LIVE(발행완료) / DRAFT·SCHEDULED(발행대기)
    const publishStatus = data.status === "LIVE" ? "발행완료" : "발행대기";
    const newBloggerInfo = {
      blogId: bloggerConfig.blogId,
      bloggerPostId: data.id || null,
      publishedUrl: data.url || null,
      publishStatus,
      publishedAt: new Date().toISOString(),
      lastError: null,
    };

    const previousStatusValue = currentPost.status;

    currentPost.bloggerInfo = newBloggerInfo;
    currentPost.status = publishStatus;
    currentPost.updatedAt = new Date().toISOString();

    try {
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (saveError) {
      // Blogger 업로드 자체는 성공했으므로 새 업로드 정보(bloggerPostId/publishedUrl 등)는 유지하되,
      // 로컬 저장 실패로 자료실 데이터와 실제 Blogger 상태가 다를 수 있음을 lastError에 남긴다.
      // 단, 자료실에 표시되는 상태값(status)은 저장이 실패했으므로 이전 값으로 되돌린다.
      currentPost.bloggerInfo = {
        ...newBloggerInfo,
        lastError: "Blogger 업로드는 성공했지만 로컬 저장에 실패하여 자료실 데이터와 불일치할 수 있음",
      };
      currentPost.status = previousStatusValue;
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Blogger 업로드 성공 후 로컬 저장 실패",
        detail: saveError.message,
        relatedId: currentPost.id,
      });
      return {
        success: false,
        uploaded: true,
        reasons: ["Blogger 업로드는 성공했지만 로컬 저장에 실패했습니다."],
      };
    }
  }

  return {
    loadPost,
    getCurrentPost,
    saveBloggerConfig,
    hasDataUrlImages,
    checkPublishReadiness,
    markReadyToPublish,
    uploadToBlogger,
  };
})();
