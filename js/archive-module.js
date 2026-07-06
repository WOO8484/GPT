/**
 * archive-module.js
 * 자료실(저장된 글) 관리 모듈
 */

const ArchiveModule = (() => {
  const LEGACY_STATUS_MAP = {
    draft: "작성중",
    published: "발행완료",
    scheduled: "예약됨",
    error: "오류",
  };

  let cachedPosts = [];
  let currentSearchText = "";
  let currentStatusFilter = "all";

  function normalizeStatus(status) {
    return LEGACY_STATUS_MAP[status] || status;
  }

  async function migrateLegacyStatuses(posts) {
    const legacyKeys = Object.keys(LEGACY_STATUS_MAP);
    const targets = posts.filter((p) => legacyKeys.includes(p.status));

    for (const post of targets) {
      const corrected = normalizeStatus(post.status);
      try {
        post.status = corrected;
        post.updatedAt = new Date().toISOString();
        await StorageModule.savePost(post);
      } catch (error) {
        ErrorLogModule.logError({
          module: "archive-module",
          message: "기존 영어 상태값 마이그레이션 실패",
          detail: error.message,
          relatedId: post.id || null,
        });
      }
    }

    return posts;
  }

  async function loadPosts() {
    try {
      const rawPosts = await StorageModule.getAllPosts();
      cachedPosts = await migrateLegacyStatuses(rawPosts);
    } catch (error) {
      ErrorLogModule.logError({
        module: "archive-module",
        message: "자료실 목록 렌더링 실패",
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

  function setStatusFilter(status) {
    currentStatusFilter = status || "all";
  }

  function getFilteredPosts() {
    let result = [...cachedPosts];

    if (currentSearchText) {
      result = result.filter((p) =>
        (p.title || "").toLowerCase().includes(currentSearchText)
      );
    }

    if (currentStatusFilter !== "all") {
      result = result.filter((p) => normalizeStatus(p.status) === currentStatusFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }

  function getPostById(id) {
    return cachedPosts.find((p) => p.id === id) || null;
  }

  async function deletePost(id) {
    try {
      await StorageModule.deletePost(id);
      cachedPosts = cachedPosts.filter((p) => p.id !== id);
      return true;
    } catch (error) {
      ErrorLogModule.logError({
        module: "archive-module",
        message: "자료실 목록 렌더링 실패",
        detail: error.message,
        relatedId: id,
      });
      return false;
    }
  }

  function exportPostAsJson(id) {
    const post = getPostById(id);
    if (!post) return null;
    const json = JSON.stringify(post, null, 2);
    const safeTitle = (post.title || "untitled").replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
    const filename = `${safeTitle}_${post.id}.json`;
    return { filename, json };
  }

  return {
    loadPosts,
    setSearchText,
    setStatusFilter,
    getFilteredPosts,
    getPostById,
    deletePost,
    exportPostAsJson,
  };
})();
