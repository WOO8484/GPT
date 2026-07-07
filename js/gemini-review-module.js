/**
 * gemini-review-module.js (0.0.7 신규)
 * Gemini 품질검수 요청 모듈
 *
 * 원칙:
 * - Gemini는 글을 생성하지 않으며 ZIP을 수정하지 않는다. 검수 결과와 수정 제안만 받는다.
 * - 기존 WorkerApiModule.callWorker() 공통 호출 경로를 그대로 재사용한다(신규 Worker 미작성).
 * - Gemini에 보내는 데이터는 최소화한다(원본 이미지/Blogger 토큰/Worker 토큰/API Key 전송 금지).
 * - 실패는 ZIP 등록 실패로 취급하지 않으며, 자료실 데이터를 손상시키지 않는다(읽기 전용 조회만 수행).
 */

const GeminiReviewModule = (() => {
  // 작업지시서 6번: 본문 길이 기준(단순 글자수)으로 빠른 검수/정밀 검수를 자동 선택한다.
  const LONG_CONTENT_THRESHOLD = 1500;

  function extractPlainText(post) {
    if (post.textContent && post.textContent.trim()) return post.textContent;
    if (post.htmlContent) {
      try {
        const doc = new DOMParser().parseFromString(post.htmlContent, "text/html");
        return doc.body.textContent || "";
      } catch (error) {
        return "";
      }
    }
    return post.markdownContent || "";
  }

  // 자동 선택 기준(작업지시서 6):
  // - 본문이 짧음 → 빠른 검수 / SEO 통과 글 단순 확인 → 빠른 검수
  // - 본문이 김 또는 SEO 미통과/보완 항목 많음 → 정밀 검수
  // - 사용자가 정밀 검수를 직접 선택 → 무조건 정밀 검수
  function decideModelMode(post, forcedMode) {
    if (forcedMode === "precise") return "precise";
    if (forcedMode === "fast") return "fast";

    const seoResult = post.seoResult || {};
    const seoOk = seoResult.result === "통과";
    const textLength = extractPlainText(post).length;

    if (!seoOk) return "precise";
    if (textLength >= LONG_CONTENT_THRESHOLD) return "precise";
    return "fast";
  }

  // 작업지시서 9: Gemini에 보낼 데이터를 최소화해서 구성한다.
  function buildRequestPayload(post, mode) {
    const seoResult = post.seoResult || {};
    const imageList = Array.isArray(post.imageList) ? post.imageList : [];
    const thumbnail = imageList.find((img) => img.type === "thumbnail") || null;
    const bodyText = extractPlainText(post).slice(0, 6000);
    const metaDescription = post.metaDescription || "";
    const faqList = Array.isArray(post.faqList) ? post.faqList : [];
    const imageAltTexts = imageList.map((img) => img.altText || "");
    const seoScore = typeof seoResult.totalScore === "number" ? seoResult.totalScore : null;
    const seoIssues = Array.isArray(seoResult.issues) ? seoResult.issues : [];

    return {
      mode, // "fast" | "precise" (화면 표기: 빠른 검수 / 정밀 검수)
      reviewMode: mode,
      title: post.title || "",
      description: metaDescription,
      metaDescription,
      bodyText,
      text: bodyText,
      content: bodyText,
      faqList,
      faq: faqList,
      thumbnailText: thumbnail ? thumbnail.altText || "" : "",
      imageAltTexts,
      seoScore,
      qualityScore: seoScore || 0,
      seoIssues,
      issues: seoIssues,
      post: {
        title: post.title || "",
        description: metaDescription,
        metaDescription,
        text: bodyText,
        content: bodyText,
        faq: faqList,
        thumbnailText: thumbnail ? thumbnail.altText || "" : "",
      },
      metadata: {
        title: post.title || "",
        description: metaDescription,
        metaDescription,
        seoScore,
        seoIssues,
        imageAltTexts,
      },
    };
  }

  // 작업지시서 10: Gemini 응답은 반드시 JSON이어야 한다. 문자열로 내려오는 경우까지 방어적으로 처리한다.
  function parseGeminiResult(raw) {
    let data = raw;
    if (raw && typeof raw.result === "string") {
      data = JSON.parse(raw.result);
    } else if (raw && raw.result && typeof raw.result === "object") {
      data = raw.result;
    } else if (raw && raw.review && typeof raw.review === "object") {
      data = raw.review;
    } else if (raw && raw.data && typeof raw.data === "object") {
      data = raw.data;
    }

    if (!data || typeof data !== "object") {
      throw new Error("품질검수 응답 형식이 올바르지 않습니다.");
    }

    const issues = Array.isArray(data.issues) ? data.issues : [];
    // 작업지시서 11: improvements가 없으면 issues의 suggestion으로 개선내역을 만들어 표시한다.
    let improvements = Array.isArray(data.improvements) ? data.improvements.filter(Boolean) : [];
    if (improvements.length === 0 && issues.length > 0) {
      improvements = issues.map((issue) => issue.suggestion).filter(Boolean);
    }

    return {
      status: data.status || "보완필요",
      score: typeof data.score === "number" ? data.score : 0,
      summary: data.summary || "",
      issues,
      improvements,
      rewriteRequest: data.rewriteRequest || "",
    };
  }

  // 작업지시서 6.5: 실패 사유를 단순 안내 대신 구분해서 보여주기 위한 분류.
  // 프롬프트/페이로드 구성 로직은 건드리지 않고, 에러 메시지 내용만으로 분류한다.
  function classifyReviewError(error) {
    const message = (error && error.message) || "";
    const lower = message.toLowerCase();

    if (error instanceof SyntaxError || message.includes("해석할 수 없") || lower.includes("json")) {
      return "응답 JSON 파싱 실패";
    }
    if (message.includes("로그인이 만료") || message.includes("인증") || lower.includes("401")) {
      return "인증 토큰 만료";
    }
    if (lower.includes("quota") || message.includes("쿼터") || message.includes("사용량")) {
      return "Gemini 쿼터/사용량 초과";
    }
    if (lower.includes("api_key") || lower.includes("api key") || message.includes("키")) {
      return "AI_API_KEY 문제";
    }
    if (lower.includes("model") || message.includes("모델")) {
      return "모델명 문제";
    }
    if (message.includes("연결 오류") || lower.includes("network") || lower.includes("fetch")) {
      return "Worker 연결 실패";
    }
    return message ? `알 수 없는 오류 (${message})` : "알 수 없는 오류";
  }

  // 실패 시 실기 확인을 위해 실제로 호출된 주소를 화면에 표시할 수 있도록 노출한다.
  function getReviewEndpointUrl() {
    return getWorkerBaseUrl() + "/gemini/review";
  }

  // 작업지시서 7: 구조/SEO 1차 검증(이미 완료)을 마친 글을 대상으로 Gemini 품질검수를 요청한다.
  // 실패 시 ZIP 등록 실패로 취급하지 않고, 정식 오류(Gemini API 호출 실패/응답 파싱 실패)로만 기록한다.
  // onStage(stageLabel)는 화면에 진행 단계를 표시하기 위한 선택적 콜백이다(호출 로직/프롬프트는 변경 없음).
  async function requestReview(post, forcedMode, onStage) {
    if (!post) {
      return { success: false, error: "글 정보가 없습니다.", reason: "알 수 없는 오류" };
    }

    const notify = typeof onStage === "function" ? onStage : () => {};

    notify("요청 준비");
    const mode = decideModelMode(post, forcedMode);
    const payload = buildRequestPayload(post, mode);

    try {
      notify("Worker 전송");
      notify("Gemini 응답 대기");
      const raw = await WorkerApiModule.requestGeminiReview(payload);
      notify("결과 정리");
      const review = parseGeminiResult(raw);
      return { success: true, mode, review };
    } catch (error) {
      const reason = classifyReviewError(error);
      const isParseError = error instanceof SyntaxError;
      ErrorLogModule.logError({
        module: "gemini-review-module",
        message: isParseError ? "Gemini 응답 파싱 실패" : "Gemini API 호출 실패",
        detail: error.message,
        relatedId: post.id || null,
      });
      return {
        success: false,
        error: "품질검수 요청에 실패했습니다.",
        reason,
        url: getReviewEndpointUrl(),
      };
    }
  }

  // 작업지시서 12: 패키지 점검(구조/주의 항목) + Gemini 검수 결과를 합쳐 GPT에게 다시 전달할
  // 수정요청 문구를 만든다. "SEO 점수" 같은 명칭은 노출하지 않는다.
  function buildRewriteRequestText(post, review) {
    const seoResult = post.seoResult || {};
    const advisories =
      Array.isArray(seoResult.issues) && seoResult.issues.length > 0
        ? seoResult.issues.map((issue) => `- ${issue}`).join("\n")
        : "- 없음";
    const geminiIssues =
      Array.isArray(review.issues) && review.issues.length > 0
        ? review.issues.map((issue) => `- ${issue.message || issue.suggestion || ""}`).join("\n")
        : "- 없음";
    const improvementsText =
      Array.isArray(review.improvements) && review.improvements.length > 0
        ? review.improvements.map((item, idx) => `${idx + 1}. ${item}`).join("\n")
        : "- 없음";
    const rewriteHint = review.rewriteRequest ? `\n${review.rewriteRequest}\n` : "";

    return (
      `방금 생성한 블로그 ZIP을 검증한 결과 아래 항목 보완이 필요합니다.\n\n` +
      `패키지 점검 주의 항목:\n` +
      `${advisories}\n\n` +
      `Gemini 품질검수 문제 항목:\n` +
      `${geminiIssues}\n\n` +
      `개선내역:\n` +
      `${improvementsText}\n` +
      `${rewriteHint}\n` +
      `기존 제목과 주제는 유지하고,\n` +
      `위 항목만 보완해서 다시 통과 가능한 ZIP으로 만들어줘.\n` +
      `이미지 파일명과 ZIP 구조는 기존 지시서 기준을 유지해줘.`
    );
  }

  return {
    decideModelMode,
    requestReview,
    buildRewriteRequestText,
  };
})();
