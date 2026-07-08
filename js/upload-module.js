/**
 * upload-module.js
 * GPT 공작소 블로그자료 ZIP 업로드 - 파싱 모듈
 *
 * ZIP 내부 읽기는 js/vendor/zip-reader.js(MiniZip)를 사용한다(GPT-main 이식).
 *
 * 작업지침서 7-1 원칙: 파일 구성은 앞으로 변경될 수 있으므로 이미지 개수/이름을
 * 과도하게 고정하지 않는다. thumbnail.*, body-<번호>.* 패턴은 몇 개든 인식하고,
 * 그 외 이미지 파일도 파일명 기준으로 모두 인식해 매칭 대상에 포함한다.
 *
 * 패키지 점검(7-3)은 품질검수가 아니다. 다음만 확인한다:
 * - ZIP을 열 수 있는지
 * - metadata.json을 읽을 수 있는지
 * - content.html을 읽을 수 있는지
 * - 본문 이미지 매칭이 가능한지
 */

const UploadModule = (() => {
  const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;
  const THUMBNAIL_RE = /^thumbnail\.(png|jpe?g|webp)$/i;
  const BODY_RE = /^body-(\d+)\.(png|jpe?g|webp)$/i;

  let loadedZipFileName = null;
  let loadedMetadata = null;
  let loadedMetadataRaw = null; // 파싱 실패 여부 판단용
  let loadedHtml = null;
  let loadedMarkdown = null;
  let loadedText = null;
  let imageFiles = {}; // { baseNameLower: { fileName, dataUrl, mimeType, ext, role } }
  let requiredFilesOk = false;
  let failReason = null;

  function generateId() {
    return "post_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function extToMime(ext) {
    const lower = ext.toLowerCase();
    if (lower === "png") return "image/png";
    if (lower === "jpg" || lower === "jpeg") return "image/jpeg";
    if (lower === "webp") return "image/webp";
    return "application/octet-stream";
  }

  function entryToDataUrl(entry, ext) {
    const base64 = MiniZip.bytesToBase64(entry.dataBytes);
    return "data:" + extToMime(ext) + ";base64," + base64;
  }

  function classifyRole(baseName) {
    const thumbMatch = baseName.match(THUMBNAIL_RE);
    if (thumbMatch) return "thumbnail";
    const bodyMatch = baseName.match(BODY_RE);
    if (bodyMatch) return "body-" + bodyMatch[1].padStart(2, "0");
    return "extra";
  }

  async function setZipFile(file) {
    reset();

    if (!file) {
      failReason = "선택된 ZIP 파일이 없습니다.";
      return { success: false, reason: failReason };
    }

    let entries;
    try {
      const arrayBuffer = await file.arrayBuffer();
      entries = await MiniZip.load(arrayBuffer);
    } catch (error) {
      failReason = "ZIP 파일을 열 수 없습니다.";
      ErrorLogModule.logError({
        module: "upload-module",
        message: "ZIP 파일 인식 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false, reason: failReason };
    }

    loadedZipFileName = file.name;

    let metadataEntry = null;
    let htmlEntry = null;
    let markdownEntry = null;
    let textEntry = null;

    entries.forEach((entry) => {
      if (entry.isDirectory) return;
      const baseName = entry.name.split("/").pop();
      if (!baseName) return;
      if (baseName.charAt(0) === ".") return; // 숨김 파일 무시
      if (entry.name.indexOf("__MACOSX") !== -1) return;

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

      if (IMAGE_EXT_RE.test(lower)) {
        const extMatch = lower.match(/\.(png|jpe?g|webp)$/i);
        const ext = extMatch[1];
        // 같은 파일명이 루트와 images/ 폴더 양쪽에 있으면 먼저 발견된 것을 유지한다
        // (본문 내용은 동일한 것이 보통이므로 중복 여부는 문제되지 않는다).
        if (!imageFiles[lower]) {
          imageFiles[lower] = {
            fileName: baseName,
            dataUrl: entryToDataUrl(entry, ext),
            mimeType: extToMime(ext),
            ext: ext.toLowerCase(),
            role: classifyRole(baseName.toLowerCase()),
          };
        }
      }
    });

    // 필수 파일 확인: metadata.json, content.html
    if (!metadataEntry) {
      failReason = "ZIP 안에서 metadata.json을 찾을 수 없습니다.";
      ErrorLogModule.logError({
        module: "upload-module",
        message: "필수 파일 누락",
        detail: failReason,
        relatedId: null,
      });
      return { success: false, reason: failReason };
    }

    try {
      loadedMetadataRaw = MiniZip.bytesToText(metadataEntry.dataBytes);
      loadedMetadata = JSON.parse(loadedMetadataRaw);
    } catch (error) {
      failReason = "metadata.json을 읽을 수 없습니다(형식 오류).";
      ErrorLogModule.logError({
        module: "upload-module",
        message: "metadata.json 파싱 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false, reason: failReason };
    }

    if (!htmlEntry) {
      failReason = "ZIP 안에서 content.html을 찾을 수 없습니다.";
      ErrorLogModule.logError({
        module: "upload-module",
        message: "필수 파일 누락",
        detail: failReason,
        relatedId: null,
      });
      return { success: false, reason: failReason };
    }

    try {
      loadedHtml = MiniZip.bytesToText(htmlEntry.dataBytes);
    } catch (error) {
      failReason = "content.html을 읽을 수 없습니다.";
      ErrorLogModule.logError({
        module: "upload-module",
        message: "content.html 읽기 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false, reason: failReason };
    }

    loadedMarkdown = markdownEntry ? MiniZip.bytesToText(markdownEntry.dataBytes) : "";
    loadedText = textEntry ? MiniZip.bytesToText(textEntry.dataBytes) : "";

    requiredFilesOk = true;
    failReason = null;
    return { success: true };
  }

  function getCheckStatus() {
    const unresolved = requiredFilesOk
      ? PreviewModule.findUnresolvedImageRefs(loadedHtml, imageFiles)
      : [];

    const bodyCount = Object.values(imageFiles).filter((img) => img.role.indexOf("body-") === 0).length;
    const hasThumbnail = Object.values(imageFiles).some((img) => img.role === "thumbnail");

    return {
      requiredFilesOk,
      failReason,
      zipFileName: loadedZipFileName,
      checklist: [
        { label: "ZIP 열기", ok: !!loadedZipFileName && requiredFilesOk !== null },
        { label: "metadata.json", ok: !!loadedMetadata },
        { label: "content.html", ok: !!loadedHtml },
        { label: "content.md", ok: !!loadedMarkdown, optional: true },
        { label: "content.txt", ok: !!loadedText, optional: true },
        { label: "썸네일 이미지", ok: hasThumbnail, optional: true },
        { label: `본문 이미지 (${bodyCount}개 인식)`, ok: bodyCount > 0, optional: true },
      ],
      unresolvedImageRefs: unresolved,
    };
  }

  function buildFallbackTitle() {
    if (loadedZipFileName) return loadedZipFileName.replace(/\.[^/.]+$/, "");
    return "제목 없음";
  }

  function buildPost() {
    if (!requiredFilesOk) return null;

    const meta = loadedMetadata || {};
    const title = meta.title || buildFallbackTitle();
    const now = new Date().toISOString();

    const post = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      title,
      metadata: meta,
      contentHtmlRaw: loadedHtml || "",
      contentMd: loadedMarkdown || "",
      contentText: loadedText || "",
      zipFileName: loadedZipFileName || "",
      imageFiles: { ...imageFiles },
      previewHtml: null,
      saveStatus: "등록됨",
      r2ImageMap: null,
      bloggerDraftResult: null,
    };

    return post;
  }

  function reset() {
    loadedZipFileName = null;
    loadedMetadata = null;
    loadedMetadataRaw = null;
    loadedHtml = null;
    loadedMarkdown = null;
    loadedText = null;
    imageFiles = {};
    requiredFilesOk = false;
    failReason = null;
  }

  return {
    setZipFile,
    getCheckStatus,
    buildPost,
    reset,
  };
})();
