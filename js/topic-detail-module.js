/**
 * topic-detail-module.js (v1.8.6-fix1 재설계)
 *
 * 역할: 선택된 글의 selected_topic.md / TOP5 후보 원문에서 필요한 값만
 * 파싱해 "선정자료" 요약 카드로 보여준다.
 *
 * 이 모듈은:
 * - 파일명(selected_topic.md, top5/0N_candidate.md 등)을 화면에 노출하지 않는다.
 * - 원문 전체를 그대로 보여주지 않는다(요약 값만 파싱해서 보여준다).
 * - 저장/발행/재선정/삭제 등 어떤 동작도 수행하지 않는다(순수 읽기 전용 뷰어).
 * - GptCoreAPI.getSelectedPost()로 이미 만들어진 post 객체만 읽는다.
 * - 값이 없으면 "정보 없음"으로만 표시하고 예외를 던지지 않는다.
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
      finalTopicEl: document.getElementById("topic-detail-final-topic"),
      reasonsEl: document.getElementById("topic-detail-reasons"),
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

  // selected_topic.md는 지시문 버전에 따라 "## N. 라벨" 형식이거나 라벨만
  // 나열된 형식일 수 있다. 어느 쪽이든 아래 라벨들을 기준으로 구간을
  // 나눠서 파싱한다(포맷이 달라도 최대한 값을 뽑아낸다).
  const KNOWN_LABELS = [
    "카테고리명",
    "최종 TOP1 주제",
    "최종 선정 주제",
    "선정 이유",
    "TOP5 중 선택한 순위",
    "TOP5 중 선택 순위",
    "자동 대체 여부",
    "2순위 후보",
    "제외 후보 요약",
    "버린 후보 요약",
    "핵심 키워드",
    "예상 제목",
    "공식출처",
    "이미지 방향",
    "썸네일 방향",
    "네이버 태그 방향",
    "최근 발행 이력 확인 여부",
    "정치/갈등성 최종 점검",
  ];

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function parseLabeledSections(md) {
    if (!md) return {};
    const pattern = KNOWN_LABELS.map(escapeRegExp).join("|");
    // 라벨 앞에 "## 3." 같은 마크다운 헤더 표시나 "-" 목록 기호가 붙어 있어도
    // 무시하고 라벨 자체만 구분 기준으로 삼는다.
    const re = new RegExp("(?:^|\\n)[ \\t]*(?:#{1,6}\\s*\\d+[.)]\\s*|[-*]\\s*)?(" + pattern + ")\\s*[:：]?[ \\t]*\\n?", "g");
    const matches = [...md.matchAll(re)];
    const result = {};
    for (let i = 0; i < matches.length; i += 1) {
      const label = matches[i][1];
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
      if (!result[label]) result[label] = md.slice(start, end).trim();
    }
    return result;
  }

  function pickFirst(sections, keys) {
    for (const key of keys) {
      if (sections[key] && sections[key].trim()) return sections[key].trim();
    }
    return "";
  }

  function firstLine(text) {
    const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    return lines[0] || "";
  }

  // 선정 이유처럼 여러 줄일 수 있는 항목을 짧은 목록으로 정리한다. 너무
  // 길어지지 않게 상한을 둔다(요약 카드 취지에 맞춤).
  function toBulletLines(text, maxLines) {
    const lines = (text || "")
      .split("\n")
      .map((l) => l.trim().replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""))
      .filter(Boolean);
    return lines.slice(0, maxLines || 6);
  }

  function parseSelectedTopic(md) {
    const sections = parseLabeledSections(md);
    const finalTopic = firstLine(pickFirst(sections, ["최종 TOP1 주제", "최종 선정 주제"]));
    const reasons = toBulletLines(pickFirst(sections, ["선정 이유"]), 6);
    return { finalTopic, reasons };
  }

  // TOP5 후보 개별 파일(top5/0N_candidate.md) 원문에서 후보 제목 한 줄만
  // 뽑아낸다. 파일명/원문 구조는 화면에 노출하지 않는다.
  function renderDetail(post) {
    const { finalTopicEl, reasonsEl } = els();

    const selectedTopicMd = (post && post.selectedTopicMd) || "";
    const parsed = parseSelectedTopic(selectedTopicMd);

    if (finalTopicEl) {
      finalTopicEl.textContent = parsed.finalTopic || post.title || EMPTY_LABEL;
    }

    if (reasonsEl) {
      if (parsed.reasons.length) {
        reasonsEl.innerHTML = parsed.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
      } else {
        reasonsEl.innerHTML = `<li>${EMPTY_LABEL}</li>`;
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

    const { openBtn, closeBtn, overlay, emptyEl, bodyEl, finalTopicEl, reasonsEl } = els();
    if (!openBtn || !closeBtn || !overlay || !emptyEl || !bodyEl || !finalTopicEl || !reasonsEl) {
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
