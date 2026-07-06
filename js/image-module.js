/**
 * image-module.js
 * 이미지 관리 모듈
 * 이미지 파일은 dataUrl(base64) 방식으로 저장하며, article.imageList에 정보를 기록한다.
 * (AI 이미지 생성, 외부 이미지 API 연동은 이번 Phase 범위 밖)
 */

const ImageModule = (() => {
  let currentPost = null;

  function generateImageId() {
    return "img_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  function loadPost(post) {
    currentPost = post;
    if (currentPost && !Array.isArray(currentPost.imageList)) {
      currentPost.imageList = [];
    }
    return currentPost;
  }

  function getCurrentPost() {
    return currentPost;
  }

  function getImageList() {
    if (!currentPost) return [];
    return currentPost.imageList;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("이미지 dataUrl 생성 실패"));
      reader.readAsDataURL(file);
    });
  }

  async function addImage(file, type) {
    if (!currentPost) {
      ErrorLogModule.logError({
        module: "image-module",
        message: "imageList 저장 실패",
        detail: "현재 글 정보가 없음",
        relatedId: null,
      });
      return { success: false };
    }

    if (!file) {
      ErrorLogModule.logError({
        module: "image-module",
        message: "이미지 파일 읽기 실패",
        detail: "선택된 파일이 없음",
        relatedId: currentPost.id,
      });
      return { success: false };
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);

      if (type === "thumbnail") {
        currentPost.imageList = currentPost.imageList.filter((img) => img.type !== "thumbnail");
      }

      const image = {
        id: generateImageId(),
        fileName: file.name,
        type: type,
        altText: "",
        position: currentPost.imageList.length,
        dataUrl: dataUrl,
        createdAt: new Date().toISOString(),
      };

      currentPost.imageList.push(image);
      return { success: true, image };
    } catch (error) {
      ErrorLogModule.logError({
        module: "image-module",
        message: "이미지 dataUrl 생성 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return { success: false };
    }
  }

  function updateAltText(imageId, altText) {
    if (!currentPost) return false;
    const image = currentPost.imageList.find((img) => img.id === imageId);
    if (!image) return false;
    image.altText = altText || "";
    return true;
  }

  function removeImage(imageId) {
    if (!currentPost) return false;
    const before = currentPost.imageList.length;
    currentPost.imageList = currentPost.imageList.filter((img) => img.id !== imageId);
    return currentPost.imageList.length < before;
  }

  async function saveImageList() {
    if (!currentPost) {
      ErrorLogModule.logError({
        module: "image-module",
        message: "imageList 저장 실패",
        detail: "현재 글 정보가 없음",
        relatedId: null,
      });
      return { success: false };
    }

    try {
      currentPost.updatedAt = new Date().toISOString();
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (error) {
      ErrorLogModule.logError({
        module: "image-module",
        message: "imageList 저장 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return { success: false };
    }
  }

  return {
    loadPost,
    getCurrentPost,
    getImageList,
    addImage,
    updateAltText,
    removeImage,
    saveImageList,
  };
})();
