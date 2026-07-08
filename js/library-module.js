/**
 * library-module.js
 * 자료실(저장된 글) 관리 모듈
 *
 * 출처: GPT-main archive-module.js 이식. 검수/점수/발행 관련 상태값 마이그레이션은
 * Lite 웹에 해당 기능이 없으므로 가져오지 않는다.
 *
 * 상태값(saveStatus): "등록됨" | "임시저장완료" | "임시저장실패"
 */

const LibraryModule = (() => {
  let cachedPosts = [];
  let currentSearchText = "";

  async function loadPosts() {
    try {
      const rawPosts = await StorageModule.getAllPosts();
      cachedPosts = Array.isArray(rawPosts) ? rawPosts : [];
    } catch (error) {
      ErrorLogModule.logError({
        module: "library-module",
        message: "자료실 목록을 불러오지 못했습니다",
        detail: error.message,
        relatedId: null,
      });
      cachedPosts = [];
    }
    return cachedPosts;
  }

  function setSearchText(text) {
    currentSearchText = (text || "").trim().toLowerCase();
  }

  function getFilteredPosts() {
    let result = [...cachedPosts];

    if (currentSearchText) {
      result = result.filter((p) => (p.title || "").toLowerCase().includes(currentSearchText));
    }

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }

  function getPostById(id) {
    return cachedPosts.find((p) => p.id === id) || null;
  }

  async function savePost(post) {
    try {
      await StorageModule.savePost(post);
      await loadPosts();
      return { success: true, post };
    } catch (error) {
      ErrorLogModule.logError({
        module: "library-module",
        message: "자료실 저장 실패",
        detail: error.message,
        relatedId: post ? post.id : null,
      });
      return { success: false };
    }
  }

  return {
    loadPosts,
    setSearchText,
    getFilteredPosts,
    getPostById,
    savePost,
  };
})();
