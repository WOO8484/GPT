/**
 * error-dictionary-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할:
 * - 오류 백과사전(에러코드 ↔ 쉬운 설명/원인/조치) 제공
 * - 오류 로그를 복사하기 좋은 텍스트 형식으로 클립보드에 복사
 *
 * 이 모듈은 error-log-module.js의 기존 수집 구조(logError/getAllErrors 등)를
 * 재작성하지 않는다. v1.4에서 추가된 선택적 log()/getErrorsByCode() 공개
 * 함수만 사용한다. 오류가 발생했다고 해서 기본 업로드/저장 흐름을 막지 않는다
 * (이 모듈은 오직 "보여주기/복사"만 담당한다).
 */

const ErrorDictionaryModule = (() => {
  let bound = false;

  // 기본 코드 예시(작업지침서 6-5 기준). 실제 로그의 code 필드와 매칭되면
  // 참고용으로 최근 발생 건수를 함께 보여준다(없어도 안내 자체는 항상 표시).
  const DICTIONARY = [
    {
      code: "E-UPLOAD-001",
      title: "블로그자료 ZIP 구조 오류",
      cause: "metadata.json / content.html / images 등 필수 구성이 ZIP 루트에 없거나 형식이 다릅니다.",
      action: "블로그 글작성 실행지시서 기준으로 ZIP 구조를 다시 확인한 뒤 재업로드하세요.",
    },
    {
      code: "E-R2-001",
      title: "R2 이미지 업로드 실패",
      cause: "네트워크 문제 또는 Worker의 이미지 업로드 API 응답 실패입니다.",
      action: "네트워크 상태를 확인한 뒤 다시 저장을 시도하세요. 반복되면 설정 → Worker 상세 상태를 점검하세요.",
    },
    {
      code: "E-BLOGGER-001",
      title: "Blogger 임시저장 실패",
      cause: "Blogger 인증 만료, 허용되지 않는 HTML, Worker 응답 오류 등이 원인일 수 있습니다.",
      action: "오류 목록의 상세 사유를 확인한 뒤 다시 저장하세요. 반복되면 재로그인 후 다시 시도하세요.",
    },
    {
      code: "E-WORKER-001",
      title: "Worker 연결 실패",
      cause: "Worker 주소에 접속할 수 없거나 네트워크가 차단되어 있습니다.",
      action: "설정 → 작업 서버에서 주소와 상태를 확인하세요.",
    },
    {
      code: "E-STORAGE-001",
      title: "브라우저 저장소 오류",
      cause: "IndexedDB/localStorage 접근 불가(프라이빗 모드, 저장 공간 초과 등)입니다.",
      action: "일반 브라우징 모드를 사용하거나 저장 공간을 확보한 뒤 다시 시도하세요.",
    },
  ];

  function isReady() {
    return bound;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return iso;
    }
  }

  function renderDictionary() {
    const listEl = document.getElementById("error-dictionary-list");
    if (!listEl) return;
    listEl.innerHTML = DICTIONARY.map((entry) => {
      let recentCount = 0;
      try {
        if (typeof ErrorLogModule !== "undefined" && typeof ErrorLogModule.getErrorsByCode === "function") {
          recentCount = ErrorLogModule.getErrorsByCode(entry.code).length;
        }
      } catch (error) {
        recentCount = 0;
      }
      return `
        <li class="error-dictionary-item">
          <span class="error-dictionary-item__code">${escapeHtml(entry.code)}${recentCount ? ` · 최근 ${recentCount}건` : ""}</span>
          <div class="error-dictionary-item__title">${escapeHtml(entry.title)}</div>
          <div class="error-dictionary-item__row"><strong>원인:</strong> ${escapeHtml(entry.cause)}</div>
          <div class="error-dictionary-item__row"><strong>조치:</strong> ${escapeHtml(entry.action)}</div>
        </li>`;
    }).join("");
  }

  function buildCopyText() {
    let errors = [];
    try {
      errors = typeof ErrorLogModule !== "undefined" ? ErrorLogModule.getAllErrors() : [];
    } catch (error) {
      errors = [];
    }
    if (!errors.length) return "기록된 오류가 없습니다.";
    return errors
      .map((e) => `[${formatDate(e.createdAt)}] ${e.code ? e.code + " " : ""}[${e.module}] ${e.message}${e.detail ? " - " + e.detail : ""}`)
      .join("\n");
  }

  async function handleCopyClick() {
    const resultEl = document.getElementById("error-dictionary-copy-result");
    const text = buildCopyText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        if (resultEl) resultEl.textContent = "✅ 오류 로그를 복사했습니다.";
        return;
      }
    } catch (error) {
      // 아래 fallback으로 진행
    }
    if (resultEl) {
      resultEl.textContent = "자동 복사에 실패했습니다. 아래 내용을 직접 복사해주세요.";
      resultEl.textContent += "\n\n" + text;
    }
  }

  function openPopup() {
    const overlay = document.getElementById("popup-error-dictionary-overlay");
    if (!overlay) return;
    const resultEl = document.getElementById("error-dictionary-copy-result");
    if (resultEl) resultEl.textContent = "";
    try {
      renderDictionary();
    } catch (error) {
      // 사전 렌더링 실패해도 팝업은 연다.
    }
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const overlay = document.getElementById("popup-error-dictionary-overlay");
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return;
    const openBtn = document.getElementById("settings-error-dictionary-btn");
    const closeBtn = document.getElementById("error-dictionary-close-btn");
    const overlay = document.getElementById("popup-error-dictionary-overlay");
    const copyBtn = document.getElementById("error-dictionary-copy-btn");
    if (!openBtn || !closeBtn || !overlay || !copyBtn) return;

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);
      copyBtn.addEventListener("click", handleCopyClick);
      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  function init() {
    bindEvents();
  }

  return { init, isReady };
})();

window.ErrorDictionaryModule = ErrorDictionaryModule;
