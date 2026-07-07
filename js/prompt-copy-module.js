/**
 * prompt-copy-module.js (v1.2 신규 모듈)
 * 블로그 글작성 실행지시서(v6.1) 원문 전체를 클립보드로 복사하는 단독 기능.
 *
 * 범위 제한(작업지침서 8-5):
 * - 글 생성 기능 아님 / GPT 호출 기능 아님 / Gemini 호출 금지
 * - API 호출 추가 금지 / Blogger 저장과 연결 금지
 * - data/blog-writing-prompt-v6.1.txt 원문을 fetch()로 불러와 그대로 복사만 한다.
 *
 * 기존 guideline/settings 계열 모듈과 섞지 않기 위해 이벤트 바인딩도
 * 이 파일 안에서 스스로 처리한다(app-core.js의 초기화 블록을 건드리지 않음).
 *
 * 주의: file:// 로 index.html을 직접 열면 브라우저 CORS 정책 때문에
 * fetch()가 실패할 수 있다. 반드시 HTTP(S) 환경(로컬 서버/GitHub Pages 등)에서
 * 테스트한다. README.txt의 "실기 테스트 필요 항목"에도 동일하게 기록했다.
 */

const PromptCopyModule = (() => {
  const PROMPT_URL = "data/blog-writing-prompt-v6.1.txt";
  let cachedText = null;

  async function loadPromptText() {
    if (cachedText !== null) return cachedText;
    const response = await fetch(PROMPT_URL);
    if (!response.ok) {
      throw new Error("지시서 파일을 불러오지 못했습니다 (HTTP " + response.status + ")");
    }
    cachedText = await response.text();
    return cachedText;
  }

  function showFallback(text, resultEl, textareaEl) {
    textareaEl.value = text;
    textareaEl.classList.remove("hidden");
    textareaEl.focus();
    textareaEl.select();
    resultEl.textContent = "자동 복사에 실패했습니다. 아래 상자를 길게 눌러(또는 Ctrl/Cmd+C) 직접 복사해주세요.";
  }

  async function copyAll(resultEl, textareaEl) {
    resultEl.textContent = "불러오는 중...";
    textareaEl.classList.add("hidden");

    let text;
    try {
      text = await loadPromptText();
    } catch (error) {
      resultEl.textContent = "지시서 파일을 불러오지 못했습니다. file://로 직접 열었다면 HTTP(S) 환경에서 다시 시도해주세요.";
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        resultEl.textContent = "✅ 복사 완료. 사용 중인 GPT 등에 붙여넣기 하세요.";
      } else {
        showFallback(text, resultEl, textareaEl);
      }
    } catch (error) {
      showFallback(text, resultEl, textareaEl);
    }
  }

  function bindEvents() {
    const openBtn = document.getElementById("prompt-copy-open-btn");
    const closeBtn = document.getElementById("prompt-copy-close-btn");
    const overlay = document.getElementById("popup-prompt-copy-overlay");
    const copyBtn = document.getElementById("prompt-copy-all-btn");
    const resultEl = document.getElementById("prompt-copy-result");
    const textareaEl = document.getElementById("prompt-copy-fallback");

    if (!openBtn || !overlay || !copyBtn || !resultEl || !textareaEl) return;

    openBtn.addEventListener("click", () => {
      resultEl.textContent = "";
      textareaEl.classList.add("hidden");
      textareaEl.value = "";
      overlay.classList.add("popup-overlay--open");
    });

    closeBtn.addEventListener("click", () => {
      overlay.classList.remove("popup-overlay--open");
    });

    copyBtn.addEventListener("click", () => copyAll(resultEl, textareaEl));
  }

  return { bindEvents };
})();

document.addEventListener("DOMContentLoaded", () => {
  PromptCopyModule.bindEvents();
});
