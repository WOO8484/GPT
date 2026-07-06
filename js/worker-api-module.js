/**
 * worker-api-module.js
 * Cloudflare Worker 공통 호출 모듈
 *
 * 출처: WP 0.0.10 assets/js/wp/common/api-adapter.js 중 "Worker 공통 호출 함수"와
 * "/blogger/status", "/blogger/draft" 호출 부분만 GPT 공작소 구조에 맞게 이식했다.
 * 네이버 검색, AI 글 생성, 이미지 생성 등 GPT 공작소에서 쓰지 않는 WP 함수는 가져오지 않는다.
 *
 * 보안 원칙:
 * - API Key, Client Secret, Refresh Token, 관리자 비밀번호는 이 파일에 두지 않는다.
 * - 인증은 AuthModule이 sessionStorage에 저장한 세션 토큰을 Authorization 헤더로만 사용한다.
 * - Worker 응답을 mock으로 대체하지 않으며, 실패는 항상 실패로 반환한다.
 */

const WorkerApiModule = (() => {
  async function callWorker(path, options) {
    const opts = options || {};
    const headers = { "Content-Type": "application/json" };
    const token = AuthModule.getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    let response;
    try {
      response = await fetch(WORKER_BASE_URL + path, {
        method: opts.method || "POST",
        headers,
        body: opts.method === "GET" ? undefined : JSON.stringify(opts.payload || {}),
      });
    } catch (networkError) {
      throw new Error("연결 오류. 다시 시도해주세요.");
    }

    if (response.status === 401) {
      AuthModule.handleUnauthorized();
      throw new Error("로그인이 만료되었습니다. 다시 로그인해주세요.");
    }

    if (!response.ok) {
      let message = `요청 실패 (HTTP ${response.status})`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.message) message = errBody.message;
      } catch (parseError) {
        // 응답 본문이 JSON이 아니면 기본 메시지를 사용한다.
      }
      throw new Error(message);
    }

    try {
      return await response.json();
    } catch (parseError) {
      throw new Error("Worker 응답을 해석할 수 없습니다.");
    }
  }

  /* ----------------------------------------------------------
     Blogger 연결 상태 확인 — /blogger/status
     ---------------------------------------------------------- */
  async function checkBloggerStatus() {
    try {
      const result = await callWorker("/blogger/status", { method: "GET" });
      const connected = !!(result && (result.connected === true || result.ok === true));
      return { ok: true, connected, result };
    } catch (error) {
      return { ok: false, connected: false, error: error.message };
    }
  }

  /* ----------------------------------------------------------
     Blogger 임시저장 — /blogger/draft (실제 Worker 결과만 사용, mock 없음)
     ---------------------------------------------------------- */
  async function saveBloggerDraft(payload) {
    try {
      const workerPayload = {
        post: {
          title: payload.title,
          contentHtml: payload.html,
          labels: payload.labels || [],
          tags: payload.labels || [],
        },
        title: payload.title,
        html: payload.html,
        labels: payload.labels || [],
        qualityScore: payload.qualityScore || 0,
      };
      const result = await callWorker("/blogger/draft", { payload: workerPayload });
      const ok = !!(result && result.ok !== false);
      return { ok, result };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /* ----------------------------------------------------------
     Gemini 품질검수 요청 — /gemini/review (0.0.7 신규)
     기존 callWorker() 공통 호출 함수를 그대로 재사용한다. Gemini API Key/모델 호출은
     기존 Worker 쪽 경로(AI_MODEL=gemini-2.5-flash, AI_PRO_MODEL=gemini-2.5-pro)가
     그대로 처리하며, 이 프로젝트는 신규 Worker를 만들지 않고 호출만 담당한다.
     실제 Worker 엔드포인트 경로가 다르면 이 경로 문자열만 맞춰 조정하면 된다.
     ---------------------------------------------------------- */
  async function requestGeminiReview(payload) {
    return callWorker("/gemini/review", { payload });
  }

  return {
    callWorker,
    checkBloggerStatus,
    saveBloggerDraft,
    requestGeminiReview,
  };
})();
