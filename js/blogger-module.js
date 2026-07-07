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

    // 0.0.10-final: 품질검수(Gemini) 통과는 더 이상 블로그 임시저장의 필수 조건이 아니다.
    // 패키지 점검을 통과한 글은 품질검수 전 상태(qualityOk=false)여도 임시저장할 수 있으며,
    // 화면에서는 검수 없이 진행함을 사용자에게 안내 팝업으로 확인받는다(app-core.js).
    const qualityOk = hasGeminiPass();

    const normalizedStatus = normalizeStatus(currentPost.status);
    const statusOk = !FORBIDDEN_DRAFT_STATUS.includes(normalizedStatus);
    if (!statusOk) reasons.push(`현재 상태(${currentPost.status})에서는 블로그 등록을 할 수 없습니다.`);

    return {
      canPublish: titleOk && htmlOk && statusOk,
      titleOk,
      htmlOk,
      qualityOk,
      seoOk: qualityOk,
      statusOk,
      reasons,
    };
  }

  // repair(0.0.10-final): Blogger 전송용 content에서만 실행되는 이미지 정리 단계.
  // content.html의 img src가 실제 https 이미지 URL이 아니면(ZIP 내부 상대경로 파일명,
  // dataUrl, blob:, 빈 src 등) 그 img 태그를 제거한다. 미리보기(preview-module.js의
  // mapImageSources)는 그대로 두고 건드리지 않으며, 이 처리는 Blogger 전송 payload를
  // 만들 때만 적용해 실제 Blogspot 화면에 회색 IMG placeholder/깨진 이미지 아이콘이
  // 남지 않게 한다.
  function stripNonHttpImages(safeHtml) {
    if (!safeHtml) return safeHtml;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeHtml, "text/html");
      const images = doc.body.querySelectorAll("img");

      images.forEach((img) => {
        const src = (img.getAttribute("src") || "").trim();
        const isRealHttpImage = /^https?:\/\//i.test(src);
        if (!isRealHttpImage) {
          img.remove();
        }
      });

      return doc.body.innerHTML;
    } catch (error) {
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "Blogger 전송용 이미지 정리 실패",
        detail: error.message,
        relatedId: currentPost ? currentPost.id : null,
      });
      return safeHtml;
    }
  }

  function buildBloggerPayload() {
    const safeHtml =
      typeof PreviewModule !== "undefined" && typeof PreviewModule.sanitizeHtml === "function"
        ? PreviewModule.sanitizeHtml(currentPost.htmlContent)
        : currentPost.htmlContent || "";

    const bloggerHtml = stripNonHttpImages(safeHtml);

    return {
      title: currentPost.title || "",
      html: bloggerHtml,
      labels: Array.isArray(currentPost.tags) ? currentPost.tags : [],
      qualityScore: currentPost.geminiReview && typeof currentPost.geminiReview.score === "number"
        ? currentPost.geminiReview.score
        : 0,
    };
  }


  // imgtest(0.0.10): Blogger가 dataUrl 이미지를 본문에 유지/표시할 수 있는지 확인하기 위한
  // 최소 실증 테스트 전용 함수다. 기존 일반 임시저장(saveDraftToBlogger)은 그대로 두며,
  // 이 함수는 stripNonHttpImages()를 거치지 않고 imageList의 첫 번째 dataUrl 이미지를
  // 테스트 본문에 직접 삽입해 /blogger/draft로 보낸다. 성공/실패 판정은 실제 Blogger
  // 관리자와 모바일/PC 화면에서 이미지가 표시되는지 사용자가 확인해야 한다.
  function escapeHtmlText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getFirstDataUrlImage() {
    if (!currentPost || !Array.isArray(currentPost.imageList)) return null;
    return currentPost.imageList.find(
      (img) => img && typeof img.dataUrl === "string" && img.dataUrl.indexOf("data:image/") === 0
    ) || null;
  }

  function canRunImageDraftTest() {
    const readiness = checkPublishReadiness();
    const image = getFirstDataUrlImage();
    const reasons = [];
    if (!readiness.canPublish) reasons.push(...readiness.reasons);
    if (!image) reasons.push("dataUrl 형식의 테스트 이미지가 없습니다. ZIP 업로드 후 이미지가 포함된 글을 선택해주세요.");
    return {
      canTest: readiness.canPublish && !!image,
      image,
      reasons,
    };
  }

  function buildImageDraftTestPayload(image) {
    const title = `[이미지 테스트] ${currentPost.title || "Blogger 이미지 포함 임시저장"}`;
    const nowText = new Date().toLocaleString("ko-KR");
    const altText = escapeHtmlText(image.altText || image.fileName || currentPost.title || "테스트 이미지");
    const fileName = escapeHtmlText(image.fileName || "이미지 파일명 없음");
    const dataUrl = image.dataUrl;

    const html = `
      <h2>Blogger 이미지 포함 임시저장 테스트</h2>
      <p>이 글은 GPT 공작소 이미지 포함 임시저장 실증 테스트용 초안입니다.</p>
      <p>확인 항목: 아래 이미지가 Blogger 관리자, 모바일 화면, PC 화면에서 모두 정상 표시되는지 확인합니다.</p>
      <figure>
        <img src="${dataUrl}" alt="${altText}" style="max-width:100%;height:auto;display:block;margin:16px auto;border-radius:12px;" />
        <figcaption>테스트 이미지: ${fileName}</figcaption>
      </figure>
      <p>테스트 생성 시각: ${escapeHtmlText(nowText)}</p>
      <p>이 초안에서 이미지가 보이면 dataUrl 이미지가 Blogger 임시저장 본문에 유지되는 것입니다. 이미지가 보이지 않거나 깨지면 Blogger 자체 이미지 저장 또는 외부 이미지 저장소 변환이 필요합니다.</p>
    `.trim();

    return {
      title,
      html,
      labels: ["GPT공작소", "이미지테스트"],
      qualityScore: 0,
    };
  }

  async function saveImageDraftTestToBlogger() {
    if (!currentPost) {
      return { success: false, reasons: ["선택된 글이 없습니다."] };
    }

    const testReady = canRunImageDraftTest();
    if (!testReady.canTest) {
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "이미지 테스트 조건 미충족",
        detail: testReady.reasons.join(" / "),
        relatedId: currentPost.id,
      });
      return { success: false, reasons: testReady.reasons };
    }

    const payload = buildImageDraftTestPayload(testReady.image);
    const result = await WorkerApiModule.saveBloggerDraft(payload);

    if (!result.ok) {
      const reason = (result.result && result.result.message) || result.error || "이미지 테스트 임시저장 실패";
      ErrorLogModule.logError({
        module: "blogger-module",
        message: "이미지 테스트 임시저장 실패",
        detail: reason,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: [reason] };
    }

    const r = result.result || {};
    return {
      success: true,
      result: r,
      postId: r.postId || r.id || null,
      url: r.url || null,
      message: "이미지 테스트 초안 저장 완료. Blogger 관리자에서 이미지 표시 여부를 확인해주세요.",
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
    canRunImageDraftTest,
    saveImageDraftTestToBlogger,
  };
})();
