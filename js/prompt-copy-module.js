/**
 * prompt-copy-module.js
 * 현재 사용 중인 블로그 글작성 실행지시서 원문 전체를 클립보드로 복사하는 단독 기능.
 *
 * 범위 제한(작업지침서 8-5, 유지):
 * - 글 생성 기능 아님 / GPT 호출 기능 아님 / Gemini 호출 금지
 * - API 호출 추가 금지 / Blogger 저장과 연결 금지
 *
 * v1.3 보정(작업지침서 10장): 복사 우선순위를 아래와 같이 적용한다.
 *   1. localStorage에 사용자 등록 지시서가 있으면 그것을 복사
 *   2. 없으면 기본 내장 최신 지시서(data/blog-writing-prompt-v6.2.txt)를 fetch로
 *      불러와 복사
 * 사용자 등록/초기화는 settings-module.js가 담당하고, 이 모듈은 동일한
 * localStorage 키 계약만 읽는다(등록 로직은 여기서 새로 만들지 않는다):
 *   gptWorkshop.blogPrompt.customText
 *   gptWorkshop.blogPrompt.customName
 *
 * 기존 guideline/settings 계열 모듈과 섞지 않기 위해 이벤트 바인딩도
 * 이 파일 안에서 스스로 처리한다(app-core.js의 초기화 블록을 건드리지 않음).
 *
 * 주의: file://로 index.html을 직접 열면 브라우저 CORS 정책 때문에 기본
 * 지시서 fetch()가 실패할 수 있다(사용자 등록 지시서는 localStorage이므로
 * 영향받지 않는다). 반드시 HTTP(S) 환경에서 기본 지시서를 테스트한다.
 */

const PromptCopyModule = (() => {
  const PROMPT_URL = "data/blog-writing-prompt-v6.2.txt";
  const LS_KEY_TEXT = "gptWorkshop.blogPrompt.customText";
  const LS_KEY_NAME = "gptWorkshop.blogPrompt.customName";

  let cachedDefaultText = null;

  async function loadDefaultPromptText() {
    if (cachedDefaultText !== null) return cachedDefaultText;
    const response = await fetch(PROMPT_URL);
    if (!response.ok) {
      throw new Error("지시서 파일을 불러오지 못했습니다 (HTTP " + response.status + ")");
    }
    cachedDefaultText = await response.text();
    return cachedDefaultText;
  }

  function readCustomPrompt() {
    try {
      const text = localStorage.getItem(LS_KEY_TEXT) || "";
      if (!text.trim()) return null;
      return { text, name: localStorage.getItem(LS_KEY_NAME) || "사용자 등록 지시서" };
    } catch (error) {
      return null;
    }
  }

  // 복사 대상 텍스트를 우선순위대로 가져온다. 실패 시 예외를 던진다(호출부에서 처리).
  async function resolvePromptText() {
    const custom = readCustomPrompt();
    if (custom) {
      return { text: custom.text, sourceLabel: `사용자 등록 지시서 (${custom.name})` };
    }
    const defaultText = await loadDefaultPromptText();
    return { text: defaultText, sourceLabel: "기본 최신 지시서" };
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

    let resolved;
    try {
      resolved = await resolvePromptText();
    } catch (error) {
      if (typeof ErrorLogModule !== "undefined") {
        ErrorLogModule.logError({
          module: "prompt-copy-module",
          message: "블로그 지시서를 불러오지 못했습니다",
          detail: error.message,
          relatedId: null,
        });
      }
      resultEl.textContent = "[prompt-copy-module] 블로그 지시서를 불러오지 못했습니다. file://로 직접 열었다면 HTTP(S) 환경에서 다시 시도해주세요.";
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(resolved.text);
        resultEl.textContent = `✅ 복사 완료(${resolved.sourceLabel}). 사용 중인 GPT 등에 붙여넣기 하세요.`;
      } else {
        showFallback(resolved.text, resultEl, textareaEl);
      }
    } catch (error) {
      showFallback(resolved.text, resultEl, textareaEl);
    }
  }

  function renderSourceLabel() {
    const sourceEl = document.getElementById("prompt-copy-source");
    if (!sourceEl) return;
    const custom = readCustomPrompt();
    sourceEl.textContent = custom
      ? `현재 사용: 사용자 등록 지시서 (${custom.name})`
      : "현재 사용: 기본 최신 지시서";
  }

  let bound = false; // 이벤트 연결 성공 여부(중복 연결 방지)

  function isReady() {
    return bound;
  }

  // DOM 요소가 없으면 조용히 종료하고(예외를 던지지 않음), 여러 번 호출돼도
  // 이벤트가 중복 연결되지 않는다.
  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const openBtn = document.getElementById("prompt-copy-open-btn");
    const closeBtn = document.getElementById("prompt-copy-close-btn");
    const overlay = document.getElementById("popup-prompt-copy-overlay");
    const copyBtn = document.getElementById("prompt-copy-all-btn");
    const resultEl = document.getElementById("prompt-copy-result");
    const textareaEl = document.getElementById("prompt-copy-fallback");

    if (!openBtn || !closeBtn || !overlay || !copyBtn || !resultEl || !textareaEl) return;

    try {
      openBtn.addEventListener("click", () => {
        resultEl.textContent = "";
        textareaEl.classList.add("hidden");
        textareaEl.value = "";
        renderSourceLabel();
        overlay.classList.add("popup-overlay--open");
      });

      closeBtn.addEventListener("click", () => {
        overlay.classList.remove("popup-overlay--open");
      });

      copyBtn.addEventListener("click", () => copyAll(resultEl, textareaEl));

      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  return { bindEvents, isReady };
})();

document.addEventListener("DOMContentLoaded", () => {
  try {
    PromptCopyModule.bindEvents();
  } catch (error) {
    // 최후의 방어선: 실패해도 조용히 무시한다(다른 기본 기능에는 영향 없음).
  }
});
