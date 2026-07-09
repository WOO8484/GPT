/**
 * topic-detail-module.js (신규, 선택 기능)
 *
 * 역할: 카테고리별 TOP1 전체 묶음 ZIP에서 등록된(또는 단일 ZIP이라도 v7.2
 * 선택 항목을 포함한) 게시글의 TOP5 후보 파일(top5/01~05_candidate.md,
 * top5/top5_summary.md)과 selected_topic.md 원문을 읽기 전용으로 보여준다.
 *
 * 이 모듈은:
 * - 저장/발행/재선정/삭제 등 어떤 동작도 수행하지 않는다(순수 읽기 전용 뷰어).
 * - GptCoreAPI.getSelectedPost()로 이미 만들어진 post 객체만 읽는다(다른
 *   모듈처럼 upload-module.js 내부를 직접 호출하지 않는다).
 * - 값이 없으면 "정보 없음"/"파일에 없음"으로만 표시하고 예외를 던지지 않는다.
 * - prompt-copy-module.js/naver-copy-module.js와 동일하게 완전히 독립적으로
 *   스스로 초기화한다(app-core.js의 초기화 블록을 건드리지 않음).
 */

const TopicDetailModule = (() => {
  const EMPTY_LABEL = "정보 없음";
  let bound = false;

  function isReady() {
    return bound;
  }

  function els() {
    return {
      openBtn: document.getElementById("topic-detail-open-btn"),
      closeBtn: document.getElementById("topic-detail-close-btn"),
      overlay: document.getElementById("popup-topic-detail-overlay"),
      emptyEl: document.getElementById("topic-detail-empty"),
      bodyEl: document.getElementById("topic-detail-body"),
      selectedEl: document.getElementById("topic-detail-selected"),
      summaryEl: document.getElementById("topic-detail-summary"),
      candidatesEl: document.getElementById("topic-detail-candidates"),
    };
  }

  function getSelectedPost() {
    try {
      if (window.GptCoreAPI && typeof GptCoreAPI.getSelectedPost === "function") {
        return GptCoreAPI.getSelectedPost();
      }
    } catch (error) {
      // 읽기 실패는 이 모듈만의 문제로 한정한다.
    }
    return null;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function renderDetail(post) {
    const { selectedEl, summaryEl, candidatesEl } = els();

    const selectedTopicMd = (post && post.selectedTopicMd) || "";
    const top5SummaryMd = (post && post.top5SummaryMd) || "";
    const top5Candidates = (post && post.top5Candidates) || {};

    if (selectedEl) selectedEl.textContent = selectedTopicMd.trim() ? selectedTopicMd : `${EMPTY_LABEL}(selected_topic.md 파일에 없음)`;
    if (summaryEl) summaryEl.textContent = top5SummaryMd.trim() ? top5SummaryMd : `${EMPTY_LABEL}(top5_summary.md 파일에 없음)`;

    if (candidatesEl) {
      const nums = Object.keys(top5Candidates).sort();
      if (!nums.length) {
        candidatesEl.innerHTML = `<p class="notice-text">${EMPTY_LABEL}(top5/0N_candidate.md 파일에 없음)</p>`;
      } else {
        candidatesEl.innerHTML = nums
          .map((num) => {
            const text = top5Candidates[num] || "";
            return `
              <details class="topic-detail-candidate">
                <summary>후보 ${escapeHtml(parseInt(num, 10) || num)} (top5/${escapeHtml(num)}_candidate.md)</summary>
                <pre class="topic-detail-pre">${escapeHtml(text || EMPTY_LABEL)}</pre>
              </details>`;
          })
          .join("");
      }
    }
  }

  function openPopup() {
    const { overlay, emptyEl, bodyEl } = els();
    if (!overlay) return;

    const post = getSelectedPost();
    if (!post) {
      if (emptyEl) emptyEl.classList.remove("hidden");
      if (bodyEl) bodyEl.classList.add("hidden");
    } else {
      if (emptyEl) emptyEl.classList.add("hidden");
      if (bodyEl) bodyEl.classList.remove("hidden");
      renderDetail(post);
    }

    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const { overlay } = els();
    if (overlay) overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const { openBtn, closeBtn, overlay, emptyEl, bodyEl, selectedEl, summaryEl, candidatesEl } = els();
    if (!openBtn || !closeBtn || !overlay || !emptyEl || !bodyEl || !selectedEl || !summaryEl || !candidatesEl) {
      // 표시 대상 DOM이 하나라도 없으면 조용히 종료(예외를 던지지 않음).
      return;
    }

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);
      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  return { bindEvents, isReady };
})();

document.addEventListener("DOMContentLoaded", () => {
  try {
    TopicDetailModule.bindEvents();
  } catch (error) {
    // 최후의 방어선: 실패해도 조용히 무시한다(다른 기본 기능에는 영향 없음).
  }
});
