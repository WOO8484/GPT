/**
 * backup-module.js
 * 전체 데이터 백업/복구 모듈
 * (ZIP 백업은 Phase A 범위 밖. 추후 확장을 위해 exportFormat 필드만 준비)
 */

const BackupModule = (() => {
  function getTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    );
  }

  async function exportAllData() {
    try {
      const posts = await StorageModule.getAllPosts();
      const errors = ErrorLogModule.getAllErrors();
      const payload = {
        exportFormat: "json", // 추후 zip 등 확장 대비 필드
        exportedAt: new Date().toISOString(),
        version: "0.0.6",
        posts,
        errors,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `GPT공작소_전체백업_${getTimestamp()}.json`;
      return { filename, json };
    } catch (error) {
      ErrorLogModule.logError({
        module: "backup-module",
        message: "JSON 가져오기 실패",
        detail: error.message,
        relatedId: null,
      });
      return null;
    }
  }

  function validatePostStructure(post) {
    const requiredFields = [
      "id",
      "title",
      "keyword",
      "status",
      "htmlContent",
      "markdownContent",
      "textContent",
      "imageList",
      "seoResult",
      "createdAt",
      "updatedAt",
    ];
    return requiredFields.every((field) => field in post);
  }

  async function importAllData(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || !Array.isArray(parsed.posts)) {
        throw new Error("데이터 구조 불일치");
      }

      const invalidPost = parsed.posts.find((p) => !validatePostStructure(p));
      if (invalidPost) {
        throw new Error("데이터 구조 불일치");
      }

      await StorageModule.replaceAllPosts(parsed.posts);
      return { success: true, count: parsed.posts.length };
    } catch (error) {
      ErrorLogModule.logError({
        module: "backup-module",
        message: "JSON 가져오기 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false, error: error.message };
    }
  }

  function exportSinglePost(post) {
    if (!post) return null;
    const json = JSON.stringify(post, null, 2);
    const safeTitle = (post.title || "untitled").replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
    const filename = `${safeTitle}_${getTimestamp()}.json`;
    return { filename, json };
  }

  function triggerDownload(filename, content) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return {
    exportAllData,
    importAllData,
    exportSinglePost,
    triggerDownload,
  };
})();
