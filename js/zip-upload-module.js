/**
 * zip-upload-module.js
 * GPT 공작소 자료 패키지 ZIP 자동 업로드 모듈
 * (기존 gpt-upload-module.js의 개별 파일 업로드는 보조 기능으로 그대로 유지되며,
 *  이 모듈은 ZIP 파일 1개에서 글 파일/이미지 파일을 자동으로 인식해 자료실에 저장한다.)
 *
 * ZIP 내부 읽기는 js/vendor/zip-reader.js(MiniZip)를 사용한다.
 */

const ZipUploadModule = (() => {
  const IMAGE_EXT_PRIORITY = ["png", "jpg", "jpeg", "webp"];

  let loadedZipFileName = null;
  let loadedMetadata = null;
  let loadedHtml = null;
  let loadedMarkdown = null;
  let loadedText = null;
  let hasImagePrompts = false;
  let loadedThumbnail = null; // { fileName, dataUrl }
  let loadedBodyImages = []; // [{ fileName, dataUrl, order }] order: 0~2
  let validatedPost = null; // repair1: 검증하기를 통과한 임시 post(검증 없이는 저장 불가)

  function generateImageId() {
    return "img_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  function extToMime(ext) {
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    return "application/octet-stream";
  }

  function pickBestImageCandidate(candidates) {
    if (!candidates.length) return null;
    const sorted = candidates.slice().sort((a, b) => {
      const ai = IMAGE_EXT_PRIORITY.indexOf(a.ext);
      const bi = IMAGE_EXT_PRIORITY.indexOf(b.ext);
      if (ai !== bi) return ai - bi;
      return a.baseName.localeCompare(b.baseName);
    });
    return sorted[0];
  }

  function entryToDataUrl(entry, ext) {
    const base64 = MiniZip.bytesToBase64(entry.dataBytes);
    return "data:" + extToMime(ext) + ";base64," + base64;
  }

  async function setZipFile(file) {
    if (!file) {
      reset();
      return { success: false };
    }

    try {
      validatedPost = null;
      const arrayBuffer = await file.arrayBuffer();
      const entries = await MiniZip.load(arrayBuffer);

      let metadataEntry = null;
      let htmlEntry = null;
      let markdownEntry = null;
      let textEntry = null;
      let imagePromptsEntry = null;
      const thumbnailCandidates = [];
      const bodyCandidates = { 1: [], 2: [], 3: [] };

      entries.forEach((entry) => {
        if (entry.isDirectory) return;
        const baseName = entry.name.split("/").pop();
        if (!baseName) return;
        if (baseName.charAt(0) === ".") return; // 숨김 파일(.DS_Store 등) 무시
        if (entry.name.indexOf("__MACOSX") !== -1) return; // macOS 리소스 포크 폴더 무시

        const lower = baseName.toLowerCase();

        if (lower === "metadata.json" && !metadataEntry) {
          metadataEntry = entry;
          return;
        }
        if (lower === "content.html" && !htmlEntry) {
          htmlEntry = entry;
          return;
        }
        if (lower === "content.md" && !markdownEntry) {
          markdownEntry = entry;
          return;
        }
        if (lower === "content.txt" && !textEntry) {
          textEntry = entry;
          return;
        }
        if (lower === "image_prompts.md" && !imagePromptsEntry) {
          imagePromptsEntry = entry;
          return;
        }

        const thumbMatch = lower.match(/^thumbnail\.(png|jpg|jpeg|webp)$/);
        if (thumbMatch) {
          thumbnailCandidates.push({ entry, ext: thumbMatch[1], baseName });
          return;
        }
        const bodyMatch = lower.match(/^body-0([1-3])\.(png|jpg|jpeg|webp)$/);
        if (bodyMatch) {
          const num = parseInt(bodyMatch[1], 10);
          bodyCandidates[num].push({ entry, ext: bodyMatch[2], baseName });
        }
      });

      loadedMetadata = null;
      if (metadataEntry) {
        try {
          loadedMetadata = JSON.parse(MiniZip.bytesToText(metadataEntry.dataBytes));
        } catch (error) {
          loadedMetadata = null;
          ErrorLogModule.logError({
            module: "zip-upload-module",
            message: "ZIP 내 metadata.json 파싱 실패",
            detail: error.message,
            relatedId: null,
          });
        }
      }

      loadedHtml = htmlEntry ? MiniZip.bytesToText(htmlEntry.dataBytes) : null;
      loadedMarkdown = markdownEntry ? MiniZip.bytesToText(markdownEntry.dataBytes) : null;
      loadedText = textEntry ? MiniZip.bytesToText(textEntry.dataBytes) : null;
      hasImagePrompts = !!imagePromptsEntry;

      const bestThumb = pickBestImageCandidate(thumbnailCandidates);
      loadedThumbnail = bestThumb
        ? { fileName: bestThumb.baseName, dataUrl: entryToDataUrl(bestThumb.entry, bestThumb.ext) }
        : null;

      loadedBodyImages = [];
      for (let num = 1; num <= 3; num++) {
        const best = pickBestImageCandidate(bodyCandidates[num]);
        if (best) {
          loadedBodyImages.push({
            fileName: best.baseName,
            dataUrl: entryToDataUrl(best.entry, best.ext),
            order: num - 1,
          });
        }
      }

      loadedZipFileName = file.name;

      if (!htmlEntry && !markdownEntry && !textEntry) {
        ErrorLogModule.logError({
          module: "zip-upload-module",
          message: "ZIP 글 파일 누락",
          detail: "ZIP 안에서 content.html/content.md/content.txt 중 인식된 파일이 없음",
          relatedId: null,
        });
      }

      return { success: true };
    } catch (error) {
      reset();
      ErrorLogModule.logError({
        module: "zip-upload-module",
        message: "ZIP 파일 인식 실패",
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
      thumbnail: !!loadedThumbnail,
      bodyCount: loadedBodyImages.length,
      imagePrompts: hasImagePrompts,
    };
  }

  // repair1: 검증하기 — 필수 파일(8종) 구조 검증 + SEO 검수를 함께 실행한다.
  // 구조 검증에 실패하면(필수 파일/이미지 누락) 저장을 막고, 통과하면 검증된 임시 post를
  // 저장해 두어 saveToArchive()가 같은 데이터로만 저장하도록 한다.
  function runValidation() {
    validatedPost = null;

    if (!loadedHtml && !loadedMarkdown && !loadedText) {
      return { success: false, structureOk: false, checklist: [], reasons: ["ZIP 안에서 글 파일을 인식하지 못했습니다."] };
    }

    const checklist = [
      { label: "metadata.json", ok: !!loadedMetadata },
      { label: "content.html", ok: !!loadedHtml },
      { label: "content.md", ok: !!loadedMarkdown },
      { label: "content.txt", ok: !!loadedText },
      { label: loadedThumbnail ? loadedThumbnail.fileName : "thumbnail 이미지", ok: !!loadedThumbnail },
      {
        label: loadedBodyImages.find((i) => i.order === 0) ? loadedBodyImages.find((i) => i.order === 0).fileName : "body-01 이미지",
        ok: loadedBodyImages.some((i) => i.order === 0),
      },
      {
        label: loadedBodyImages.find((i) => i.order === 1) ? loadedBodyImages.find((i) => i.order === 1).fileName : "body-02 이미지",
        ok: loadedBodyImages.some((i) => i.order === 1),
      },
      {
        label: loadedBodyImages.find((i) => i.order === 2) ? loadedBodyImages.find((i) => i.order === 2).fileName : "body-03 이미지",
        ok: loadedBodyImages.some((i) => i.order === 2),
      },
    ];

    const okCount = checklist.filter((item) => item.ok).length;
    const failCount = checklist.length - okCount;
    const structureOk = failCount === 0;

    let seoResult = null;
    if (structureOk) {
      const tempPost = buildPostFromLoadedFiles();
      if (tempPost) {
        SeoModule.loadPost(tempPost);
        seoResult = SeoModule.runCheck();
        tempPost.seoResult = seoResult || {};
        // SEO 판정이 "통과"일 때만 저장 대상으로 확정한다. 구조 검증만 통과하고
        // SEO가 미통과인 경우 validatedPost를 세팅하지 않아 saveToArchive()가 저장을 거부한다.
        if (seoResult && seoResult.result === "통과") {
          validatedPost = tempPost;
        }
      }
    } else {
      ErrorLogModule.logError({
        module: "zip-upload-module",
        message: "ZIP 검증 실패",
        detail: `필수 파일/이미지 ${failCount}건 누락`,
        relatedId: null,
      });
    }

    const seoOk = !!(seoResult && seoResult.result === "통과");

    return {
      success: true,
      structureOk,
      seoOk,
      passed: structureOk && seoOk,
      checklist,
      totalCount: checklist.length,
      okCount,
      failCount,
      seoResult,
    };
  }

  function buildFallbackTitle() {
    if (loadedZipFileName) {
      return loadedZipFileName.replace(/\.[^/.]+$/, "");
    }
    return "제목 없음";
  }

  function buildImageList(title) {
    const imageList = [];

    if (loadedThumbnail) {
      imageList.push({
        id: generateImageId(),
        fileName: loadedThumbnail.fileName,
        type: "thumbnail",
        altText: title + " 썸네일 이미지",
        position: 0,
        dataUrl: loadedThumbnail.dataUrl,
        createdAt: new Date().toISOString(),
      });
    }

    loadedBodyImages.forEach((img, idx) => {
      imageList.push({
        id: generateImageId(),
        fileName: img.fileName,
        type: "body",
        altText: title + " 본문 이미지 " + (idx + 1),
        position: idx,
        dataUrl: img.dataUrl,
        createdAt: new Date().toISOString(),
      });
    });

    return imageList;
  }

  function buildPostFromLoadedFiles() {
    if (!loadedHtml && !loadedMarkdown && !loadedText) {
      ErrorLogModule.logError({
        module: "zip-upload-module",
        message: "ZIP 글 파일 누락",
        detail: "HTML/Markdown/TXT 중 인식된 본문이 없어 저장할 수 없음",
        relatedId: null,
      });
      return null;
    }

    const meta = loadedMetadata || {};
    const title = meta.title || buildFallbackTitle();

    const post = {
      id: AppCore.generateId(),
      title: title,
      keyword: meta.keyword || "",
      status: "작성중",
      htmlContent: loadedHtml || "",
      markdownContent: loadedMarkdown || "",
      textContent: loadedText || "",
      imageList: buildImageList(title),
      seoResult: {},
      metaDescription: meta.metaDescription || "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      faqList: Array.isArray(meta.faqList) ? meta.faqList : [],
      sourcePackageName: loadedZipFileName || "",
      importedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return post;
  }

  // repair1: 검증하기(runValidation)를 통과해야만 저장할 수 있다. 검증 전/검증 실패 상태에서는
  // 저장하지 않는다. 저장 시 기본 상태값은 "등록완료"로 한다.
  async function saveToArchive() {
    if (!validatedPost) {
      ErrorLogModule.logError({
        module: "zip-upload-module",
        message: "검증 전 저장 시도",
        detail: "검증하기를 통과하지 않은 상태에서 저장이 호출됨",
        relatedId: null,
      });
      return { success: false };
    }

    const post = validatedPost;
    post.status = "등록완료";

    try {
      await StorageModule.savePost(post);
      await ArchiveModule.loadPosts();
      validatedPost = null;
      return { success: true, post };
    } catch (error) {
      ErrorLogModule.logError({
        module: "zip-upload-module",
        message: "ZIP 자료실 저장 실패",
        detail: error.message,
        relatedId: post.id,
      });
      return { success: false };
    }
  }

  function reset() {
    loadedZipFileName = null;
    loadedMetadata = null;
    loadedHtml = null;
    loadedMarkdown = null;
    loadedText = null;
    hasImagePrompts = false;
    loadedThumbnail = null;
    loadedBodyImages = [];
    validatedPost = null;
  }

  return {
    setZipFile,
    getCheckStatus,
    runValidation,
    saveToArchive,
    reset,
  };
})();
