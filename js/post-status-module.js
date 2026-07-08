/**
 * post-status-module.js (v1.4 신규 모듈, 선택 기능)
 *
 * 역할: 게시글의 생애주기 상태(업로드 확인 완료/게시판 저장 완료/Blogger
 * 임시저장 완료/저장 실패/이미지 업로드 실패)를 표시한다.
 *
 * 저장 방식:
 * - 게시글 원본 구조(LibraryModule/StorageModule)는 전혀 건드리지 않는다.
 * - 별도 localStorage key(gptWorkshop.postStatus.v1)에 { postId: {status,
 *   detail, updatedAt} } 형태로만 기록한다.
 *
 * 연결 방식:
 * - app-core.js가 게시글 생애주기 시점(업로드 확인/게시판 저장/Blogger 저장
 *   결과/글 선택)마다 GptCoreAPI.registerLifecycleListener()로 등록해둔 이
 *   모듈의 콜백을 안전하게(safeInit) 호출해준다. 이 모듈이 실패해도 app-core.js의
 *   호출부는 다음 리스너 호출/기본 흐름을 계속 진행한다.
 * - 표시 대상 DOM(#post-status-line)이 없으면 조용히 아무 것도 하지 않는다.
 */

const PostStatusModule = (() => {
  const LS_KEY = "gptWorkshop.postStatus.v1";
  let bound = false;

  function isReady() {
    return bound;
  }

  function readMap() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeMap(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map));
    } catch (error) {
      // localStorage 불가 환경에서도 화면 동작은 막지 않는다.
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "";
    }
  }

  function recordStatus(postId, status, detail) {
    if (!postId) return;
    const map = readMap();
    map[postId] = { status, detail: detail || "", updatedAt: new Date().toISOString() };
    writeMap(map);
  }

  function getStatus(postId) {
    if (!postId) return null;
    return readMap()[postId] || null;
  }

  function renderForPost(post) {
    const line = document.getElementById("post-status-line");
    if (!line) return;
    if (!post) {
      line.textContent = "";
      return;
    }
    const entry = getStatus(post.id);
    line.textContent = entry ? `현재 상태: ${entry.status}${entry.updatedAt ? " · " + formatDate(entry.updatedAt) : ""}` : "";
  }

  function handleLifecycle(eventName, payload) {
    payload = payload || {};
    const post = payload.post || null;

    if (eventName === "post-selected") {
      renderForPost(post);
      return;
    }

    if (!post) return;

    if (eventName === "upload-confirmed") {
      recordStatus(post.id, "업로드 확인 완료");
    } else if (eventName === "board-saved") {
      recordStatus(post.id, "게시판 저장 완료");
    } else if (eventName === "board-save-failed") {
      recordStatus(post.id, "저장 실패", "게시판 저장 실패");
    } else if (eventName === "blogger-save-result") {
      const result = payload.result || {};
      if (result.success) {
        recordStatus(post.id, "Blogger 임시저장 완료");
      } else {
        const reasons = Array.isArray(result.reasons) ? result.reasons : [];
        const isImageFail = reasons.some((r) => /이미지\s*업로드\s*실패/.test(String(r)));
        recordStatus(post.id, isImageFail ? "이미지 업로드 실패" : "저장 실패", reasons.join(" / "));
      }
    } else {
      return;
    }

    // 방금 상태가 바뀐 글이 현재 선택된 글이면 화면도 함께 갱신한다.
    try {
      if (window.GptCoreAPI) {
        const current = GptCoreAPI.getSelectedPost();
        if (current && current.id === post.id) renderForPost(current);
      }
    } catch (error) {
      // 화면 갱신 실패는 상태 기록 자체를 무효화하지 않는다.
    }
  }

  function bindEvents() {
    if (bound) return;
    const line = document.getElementById("post-status-line");
    if (!line) return; // 표시할 자리가 없으면 조용히 종료한다.
    if (!window.GptCoreAPI || typeof GptCoreAPI.registerLifecycleListener !== "function") return;

    try {
      GptCoreAPI.registerLifecycleListener("post-status-module", handleLifecycle);
      // 초기화 시점에 이미 선택된 글이 있으면 바로 한 번 표시한다.
      const current = GptCoreAPI.getSelectedPost();
      renderForPost(current);
      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  function init() {
    bindEvents();
  }

  return { init, isReady, getStatus };
})();

window.PostStatusModule = PostStatusModule;
