/**
 * gpt-upload-module.js
 * GPT 결과물 개별 파일 업로드 인식 모듈
 * (ZIP 업로드는 이번 Phase 범위 밖. metadata.json/content.html/content.md/content.txt
 *  개별 파일을 선택해 자료실에 저장하는 방식만 지원한다.)
 */

const GptUploadModule = (() => {
  let loadedMetadata = null;
  let loadedHtml = null;
  let loadedMarkdown = null;
  let loadedText = null;
  let loadedSourceFileNames = {
    metadata: null,
    html: null,
    markdown: null,
    text: null,
  };

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("파일 읽기 실패"));
      reader.readAsText(file);
    });
  }

  async function setMetadataFile(file) {
    if (!file) {
      loadedMetadata = null;
      loadedSourceFileNames.metadata = null;
      return { success: false };
    }
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      loadedMetadata = parsed;
      loadedSourceFileNames.metadata = file.name;
      return { success: true };
    } catch (error) {
      loadedMetadata = null;
      loadedSourceFileNames.metadata = null;
      ErrorLogModule.logError({
        module: "gpt-upload-module",
        message: "metadata.json 파싱 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  async function setHtmlFile(file) {
    if (!file) {
      loadedHtml = null;
      loadedSourceFileNames.html = null;
      return { success: false };
    }
    try {
      loadedHtml = await readFileAsText(file);
      loadedSourceFileNames.html = file.name;
      return { success: true };
    } catch (error) {
      loadedHtml = null;
      loadedSourceFileNames.html = null;
      ErrorLogModule.logError({
        module: "gpt-upload-module",
        message: "HTML 파일 인식 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  async function setMarkdownFile(file) {
    if (!file) {
      loadedMarkdown = null;
      loadedSourceFileNames.markdown = null;
      return { success: false };
    }
    try {
      loadedMarkdown = await readFileAsText(file);
      loadedSourceFileNames.markdown = file.name;
      return { success: true };
    } catch (error) {
      loadedMarkdown = null;
      loadedSourceFileNames.markdown = null;
      ErrorLogModule.logError({
        module: "gpt-upload-module",
        message: "Markdown 파일 인식 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  async function setTextFile(file) {
    if (!file) {
      loadedText = null;
      loadedSourceFileNames.text = null;
      return { success: false };
    }
    try {
      loadedText = await readFileAsText(file);
      loadedSourceFileNames.text = file.name;
      return { success: true };
    } catch (error) {
      loadedText = null;
      loadedSourceFileNames.text = null;
      ErrorLogModule.logError({
        module: "gpt-upload-module",
        message: "TXT 파일 인식 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  function getCheckStatus() {
    return {
      metadata: !!loadedMetadata,
      html: !!loadedHtml,
      markdown: !!loadedMarkdown,
      text: !!loadedText,
    };
  }

  function buildFallbackTitle() {
    if (loadedSourceFileNames.html) {
      return loadedSourceFileNames.html.replace(/\.[^/.]+$/, "");
    }
    return "제목 없음";
  }

  function buildPostFromLoadedFiles() {
    if (!loadedHtml && !loadedMarkdown && !loadedText) {
      ErrorLogModule.logError({
        module: "gpt-upload-module",
        message: "content.html 누락",
        detail: "HTML/Markdown/TXT 중 인식된 본문이 없음",
        relatedId: null,
      });
      return null;
    }

    const meta = loadedMetadata || {};

    const post = {
      id: AppCore.generateId(),
      title: meta.title || buildFallbackTitle(),
      keyword: meta.keyword || "",
      status: meta.status || "작성중",
      htmlContent: loadedHtml || "",
      markdownContent: loadedMarkdown || "",
      textContent: loadedText || "",
      imageList: Array.isArray(meta.imageList) ? meta.imageList : [],
      seoResult: {},
      metaDescription: meta.metaDescription || "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      faqList: Array.isArray(meta.faqList) ? meta.faqList : [],
      sourcePackageName: loadedSourceFileNames.html || loadedSourceFileNames.markdown || loadedSourceFileNames.text || "",
      importedAt: new Date().toISOString(),
      createdAt: meta.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return post;
  }

  async function saveToArchive() {
    const post = buildPostFromLoadedFiles();
    if (!post) {
      return { success: false };
    }

    try {
      await StorageModule.savePost(post);
      await ArchiveModule.loadPosts();
      return { success: true, post };
    } catch (error) {
      ErrorLogModule.logError({
        module: "gpt-upload-module",
        message: "자료실 저장 실패",
        detail: error.message,
        relatedId: post.id,
      });
      return { success: false };
    }
  }

  function reset() {
    loadedMetadata = null;
    loadedHtml = null;
    loadedMarkdown = null;
    loadedText = null;
    loadedSourceFileNames = {
      metadata: null,
      html: null,
      markdown: null,
      text: null,
    };
  }

  return {
    setMetadataFile,
    setHtmlFile,
    setMarkdownFile,
    setTextFile,
    getCheckStatus,
    saveToArchive,
    reset,
  };
})();
