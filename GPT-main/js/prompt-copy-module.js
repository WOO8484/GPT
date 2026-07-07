/**
 * prompt-copy-module.js
 * 블로그 작업 지시서(v6.1) 복사 전용 모듈 (v1.2 신규)
 *
 * 이 모듈은 글 생성 기능이 아니라, 다른 GPT에 그대로 붙여넣어 사용하는
 * 실행 지시서 원문(data/blog-writing-prompt-v6.1.txt)을 불러와 보여주고
 * 클립보드로 복사하는 정적 텍스트 보조 기능이다.
 *
 * 원칙:
 * - GPT/Gemini/기타 AI API를 호출하지 않는다.
 * - 기존 guideline-module.js(설정창의 "블로그 지시서 관리")는 건드리지 않으며,
 *   이 모듈은 완전히 별도로 동작한다.
 * - 클립보드 복사는 navigator.clipboard를 우선 시도하고, 실패 시 textarea
 *   select + document.execCommand('copy') 방식으로 대체(fallback)한다.
 */

const PromptCopyModule = (() => {
  const PROMPT_FILE_PATH = "data/blog-writing-prompt-v6.1.txt";

  let cachedText = null;

  // 지시서 원문을 서버(정적 파일)에서 불러온다. 실패는 항상 실패로 반환하며
  // mock 텍스트로 대체하지 않는다.
  async function loadPromptText() {
    if (cachedText !== null) {
      return { ok: true, text: cachedText };
    }
    try {
      const response = await fetch(PROMPT_FILE_PATH);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      cachedText = text;
      return { ok: true, text };
    } catch (error) {
      if (typeof ErrorLogModule !== "undefined") {
        ErrorLogModule.logError({
          module: "prompt-copy-module",
          message: "블로그 지시서 파일 불러오기 실패",
          detail: error.message,
          relatedId: null,
        });
      }
      return { ok: false, error: error.message };
    }
  }

  // textarea의 내용을 select 후 execCommand('copy')로 복사하는 fallback.
  function fallbackCopyFromTextarea(textareaEl) {
    try {
      textareaEl.removeAttribute("readonly");
      textareaEl.focus();
      textareaEl.select();
      textareaEl.setSelectionRange(0, textareaEl.value.length);
      const success = document.execCommand("copy");
      textareaEl.setAttribute("readonly", "readonly");
      return success;
    } catch (error) {
      textareaEl.setAttribute("readonly", "readonly");
      return false;
    }
  }

  // 지시서 전체 텍스트를 클립보드로 복사한다. navigator.clipboard 우선,
  // 실패 시 전달된 textarea 엘리먼트를 이용한 fallback을 시도한다.
  async function copyPromptText(text, textareaEl) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return { success: true };
      } catch (error) {
        // clipboard API 실패 시 아래 fallback으로 이어간다.
      }
    }

    if (textareaEl) {
      const fallbackOk = fallbackCopyFromTextarea(textareaEl);
      return { success: fallbackOk, usedFallback: true };
    }

    return { success: false };
  }

  return {
    loadPromptText,
    copyPromptText,
  };
})();
