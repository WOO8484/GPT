/**
 * blogger-module.js
 * Blogger 연결 상태 확인 / 임시저장 모듈
 *
 * repair1 변경사항:
 * - 기존 방식(브라우저에서 Blog ID/Access Token을 직접 입력받아 Blogger API를 직접 호출)을
 *   제거하고, WP 0.0.10의 Worker 기반 흐름(/blogger/status, /blogger/draft)만 GPT 공작소
 *   구조에 맞게 이식했다. Blog ID/Client Secret/Refresh Token은 Worker가 서버 측에서
 *   관리하며 이 파일과 브라우저 코드에는 두지 않는다.
 * - Worker에 실제 발행(즉시 공개) 경로가 없으므로, 이번 repair의 Blogger 기능은
 *   "블로그 임시 저장"만 제공한다. 예약 저장은 schedule-module.js가 담당한다.
 * - mock 성공 처리를 하지 않으며, Worker 실패는 항상 실패로 표시한다.
 */

const BloggerModule = (() => {
  // 이미 발행완료된 글, 작성 중/보류/오류 상태인 글은 임시저장 대상에서 제외한다.
  const FORBIDDEN_DRAFT_STATUS = ["작성중", "보류", "오류", "발행완료"];
  const LEGACY_STATUS_MAP = {
    draft: "작성중",
    published: "발행완료",
    scheduled: "예약됨",
    error: "오류",
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

  // Blogger 연결 상태 확인 (/blogger/status). 실패를 성공으로 처리하지 않는다.
  async function getConnectionStatus() {
    const res = await WorkerApiModule.checkBloggerStatus();
    if (!res.ok) {
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Blogger 상태 확인 실패",
        detail: res.error || "",
        relatedId: currentPost ? currentPost.id : null,
      });
    }
    return res;
  }

  function hasDataUrlImages() {
    if (!currentPost || !Array.isArray(currentPost.imageList)) return false;
    return currentPost.imageList.some(
      (img) => typeof img.dataUrl === "string" && img.dataUrl.indexOf("data:") === 0
    );
  }

  function hasGeminiPass() {
    if (!currentPost) return false;
    if (currentPost.geminiReview && currentPost.geminiReview.status === "통과") return true;
    return normalizeStatus(currentPost.status) === "품질검수 통과";
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

    const qualityOk = hasGeminiPass();
    if (!qualityOk) reasons.push("품질검수를 통과하지 못했습니다.");

    const normalizedStatus = normalizeStatus(currentPost.status);
    const statusOk = !FORBIDDEN_DRAFT_STATUS.includes(normalizedStatus);
    if (!statusOk) reasons.push(`현재 상태(${currentPost.status})에서는 블로그 등록을 할 수 없습니다.`);

    return {
      canPublish: titleOk && htmlOk && qualityOk && statusOk,
      titleOk,
      htmlOk,
      qualityOk,
      seoOk: qualityOk,
      statusOk,
      reasons,
    };
  }

  function buildBloggerPayload() {
    const safeHtml =
      typeof PreviewModule !== "undefined" && typeof PreviewModule.sanitizeHtml === "function"
        ? PreviewModule.sanitizeHtml(currentPost.htmlContent)
        : currentPost.htmlContent || "";

    return {
      title: currentPost.title || "",
      html: safeHtml,
      labels: Array.isArray(currentPost.tags) ? currentPost.tags : [],
      qualityScore: currentPost.geminiReview && typeof currentPost.geminiReview.score === "number"
        ? currentPost.geminiReview.score
        : 0,
    };
  }

  // 블로그 임시 저장 — Worker의 /blogger/draft만 호출한다. 실제 발행(즉시 공개) 경로는
  // 이번 repair의 Worker에 없으므로 만들지 않는다.
  async function saveDraftToBlogger() {
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
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "블로그 임시저장 조건 미충족",
        detail: readiness.reasons.join(" / "),
        relatedId: currentPost.id,
      });
      return { success: false, reasons: readiness.reasons };
    }

    if (hasDataUrlImages()) {
      // 경고만 기록하고 임시저장은 계속 진행한다 (본문에는 이미지가 자동 삽입되지 않음).
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "dataUrl 이미지 변환 필요",
        detail: "imageList에 dataUrl 형식 이미지가 포함된 상태로 임시저장 시도",
        relatedId: currentPost.id,
      });
    }

    const payload = buildBloggerPayload();
    const result = await WorkerApiModule.saveBloggerDraft(payload);

    if (!result.ok) {
      const reason = (result.result && result.result.message) || result.error || "블로그 임시저장 실패";
      currentPost.bloggerInfo.lastError = reason;
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "임시저장 업로드 실패",
        detail: reason,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: [reason] };
    }

    const r = result.result || {};
    const newBloggerInfo = {
      blogId: r.blogId || null,
      bloggerPostId: r.postId || r.id || null,
      publishedUrl: r.url || null,
      publishStatus: "임시저장완료",
      publishedAt: new Date().toISOString(),
      lastError: null,
    };

    const previousStatusValue = currentPost.status;
    currentPost.bloggerInfo = newBloggerInfo;
    currentPost.status = "임시저장완료";
    currentPost.updatedAt = new Date().toISOString();

    try {
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (saveError) {
      // Blogger 임시저장 자체는 성공했으므로 업로드 결과는 유지하되, 로컬 저장 실패로
      // 자료실 상태값은 이전 값으로 되돌리고 불일치 사실을 lastError에 남긴다.
      currentPost.bloggerInfo = {
        ...newBloggerInfo,
        lastError: "Blogger 임시저장은 성공했지만 로컬 저장에 실패하여 자료실 데이터와 불일치할 수 있음",
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
        reasons: ["Blogger 임시저장은 성공했지만 로컬 저장에 실패했습니다."],
      };
    }
  }

  return {
    loadPost,
    getCurrentPost,
    getConnectionStatus,
    hasDataUrlImages,
    checkPublishReadiness,
    saveDraftToBlogger,
  };
})();
