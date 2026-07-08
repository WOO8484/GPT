/**
 * worker-api-module.js
 * Cloudflare Worker 공통 호출 모듈
 *
 * Blogger 임시저장(/blogger/draft)만 다룬다. 품질검수/점수 관련 Worker 호출은
 * 포함하지 않는다.
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
      response = await fetch(getWorkerBaseUrl() + path, {
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
     Blogger 임시저장 — /blogger/draft
     계약(작업지침서 9-4): { title, content, labels }
     반드시 content 안의 모든 img src가 https/http 이어야 한다(호출 전 검증은
     blogger-save-module.js에서 수행).
     ---------------------------------------------------------- */
  async function saveBloggerDraft({ title, content, labels }) {
    try {
      const workerPayload = {
        title: title || "",
        content: content || "",
        labels: Array.isArray(labels) ? labels : [],
      };
      const result = await callWorker("/blogger/draft", { payload: workerPayload });
      const ok = !!(result && result.ok !== false);
      return { ok, result };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return {
    callWorker,
    saveBloggerDraft,
  };
})();
