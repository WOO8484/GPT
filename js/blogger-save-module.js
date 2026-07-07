/**
 * blogger-save-module.js
 * 저장 모듈: 자료실 선택 글 → ZIP 내부 이미지 R2 업로드 → img src 교체 →
 * Blogger 임시저장(/blogger/draft)
 *
 * 작업지침서 9장 흐름을 그대로 따른다.
 * - 이미 https/http URL: 그대로 유지 (단, WEBP면 경고만 하고 계속 진행)
 * - ZIP 내부 경로: imageFiles map과 매칭 → R2 업로드 → URL 교체
 * - data:image/png,jpeg: R2 업로드 → URL 교체 / data:image/webp: JPG 변환 후 업로드
 * - blob: 또는 매칭 실패: 저장 중단("원본 이미지 매칭 실패")
 * - 실패한 상태로 Blogger 임시저장을 진행하지 않는다.
 */

const BloggerSaveModule = (() => {
  function parseDataUrlMeta(dataUrl) {
    const match = dataUrl.match(/^data:([^;,]+)(;base64)?,/);
    if (!match) return null;
    const mime = match[1];
    let ext = "bin";
    if (mime === "image/png") ext = "png";
    else if (mime === "image/jpeg") ext = "jpg";
    else if (mime === "image/webp") ext = "webp";
    return { mime, ext };
  }

  function collectImageTasks(rawHtml, imageFiles) {
    // 반환: { tasks: [...], warnings: [...], blockingError: string|null }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml || "", "text/html");
    const imgs = [...doc.body.querySelectorAll("img")];

    const tasks = [];
    const warnings = [];
    let blockingError = null;

    for (const img of imgs) {
      const src = (img.getAttribute("src") || "").trim();
      if (!src) continue;

      if (/^https?:\/\//i.test(src)) {
        if (/\.webp(\?|#|$)/i.test(src)) {
          warnings.push(`이미 HTTPS 이미지이지만 WEBP 형식입니다: ${src}`);
        }
        continue; // 그대로 유지, 업로드 불필요
      }

      if (/^blob:/i.test(src)) {
        blockingError = `원본 이미지 매칭 실패: ${src} (blob URL은 재사용할 수 없습니다)`;
        break;
      }

      if (/^data:/i.test(src)) {
        const meta = parseDataUrlMeta(src);
        if (!meta || (meta.mime !== "image/png" && meta.mime !== "image/jpeg" && meta.mime !== "image/webp")) {
          blockingError = `지원하지 않는 이미지 형식입니다: ${src.slice(0, 40)}...`;
          break;
        }
        tasks.push({
          key: src,
          matchType: "dataUrl",
          imageEntry: {
            fileName: "inline-" + tasks.length + "." + meta.ext,
            dataUrl: src,
            mimeType: meta.mime,
            ext: meta.ext,
            role: "extra",
          },
        });
        continue;
      }

      // 그 외: ZIP 내부 상대경로로 간주
      const baseName = src.split("/").pop().split("?")[0].toLowerCase();
      const matched = (imageFiles || {})[baseName];
      if (!matched) {
        blockingError = `원본 이미지 매칭 실패: ${src}`;
        break;
      }
      tasks.push({ key: baseName, matchType: "zip", imageEntry: matched });
    }

    return { tasks, warnings, blockingError };
  }

  function buildFinalHtml(rawHtml, urlMap) {
    const safeHtml = PreviewModule.sanitizeHtml(rawHtml);
    const parser = new DOMParser();
    const doc = parser.parseFromString(safeHtml, "text/html");
    const imgs = [...doc.body.querySelectorAll("img")];

    let hasInvalidSrc = false;

    imgs.forEach((img) => {
      const src = (img.getAttribute("src") || "").trim();

      if (/^https?:\/\//i.test(src)) {
        // 그대로 유지
      } else if (/^data:/i.test(src) && urlMap.has(src)) {
        img.setAttribute("src", urlMap.get(src));
      } else {
        const baseName = src.split("/").pop().split("?")[0].toLowerCase();
        if (urlMap.has(baseName)) {
          img.setAttribute("src", urlMap.get(baseName));
        }
      }

      const finalSrc = (img.getAttribute("src") || "").trim();
      if (!/^https?:\/\//i.test(finalSrc)) {
        hasInvalidSrc = true;
        return;
      }

      // 모바일/PC 양쪽에서 본문 폭을 넘지 않도록 인라인 스타일 보강(10-1).
      const existingStyle = img.getAttribute("style") || "";
      if (existingStyle.indexOf("max-width") === -1) {
        img.setAttribute("style", (existingStyle ? existingStyle + ";" : "") + "max-width:100%;height:auto;");
      }
    });

    return { html: doc.body.innerHTML, hasInvalidSrc };
  }

  /**
   * post: 자료실 항목
   * onProgress(stepIndex, stepTotal, message): 진행 상태 콜백
   * 반환: { success, reasons, warnings, result, r2ImageMap }
   */
  async function runSaveFlow(post, onProgress) {
    const notify = (step, message) => {
      if (typeof onProgress === "function") onProgress(step, 5, message);
    };

    if (!post) {
      return { success: false, reasons: ["선택된 글이 없습니다."] };
    }
    if (!post.title || !post.title.trim()) {
      return { success: false, reasons: ["제목이 없습니다."] };
    }
    if (!post.contentHtmlRaw || !post.contentHtmlRaw.trim()) {
      return { success: false, reasons: ["HTML 본문이 없습니다."] };
    }

    notify(1, "자료실 글 불러오는 중");

    notify(2, "본문 이미지 확인 중");
    const { tasks, warnings, blockingError } = collectImageTasks(post.contentHtmlRaw, post.imageFiles);

    if (blockingError) {
      return { success: false, reasons: [blockingError], warnings };
    }

    const urlMap = new Map();
    const r2ImageMap = {};
    const slug = (post.metadata && post.metadata.slug) || post.id;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      notify(3, `이미지 R2 업로드 중 ${i + 1}/${tasks.length}`);
      const result = await R2ImageModule.uploadImage(task.imageEntry, slug);
      if (!result.ok) {
        return {
          success: false,
          reasons: [`이미지 업로드 실패: ${task.imageEntry.fileName}`, result.error || "알 수 없는 오류"],
          warnings,
        };
      }
      urlMap.set(task.key, result.url);
      r2ImageMap[task.key] = result.url;
    }

    notify(4, "Blogger용 HTML 생성 중");
    const { html: finalHtml, hasInvalidSrc } = buildFinalHtml(post.contentHtmlRaw, urlMap);

    if (hasInvalidSrc) {
      return {
        success: false,
        reasons: ["최종 HTML에 내부 이미지 경로가 남아 있어 저장을 중단했습니다."],
        warnings,
      };
    }

    notify(5, "블로그스팟 임시저장 중");
    const meta = post.metadata || {};
    const draftResult = await WorkerApiModule.saveBloggerDraft({
      title: post.title,
      content: finalHtml,
      labels: Array.isArray(meta.tags) ? meta.tags : [],
    });

    if (!draftResult.ok) {
      const reason = (draftResult.result && draftResult.result.message) || draftResult.error || "Blogger 임시저장 실패";
      post.saveStatus = "임시저장실패";
      post.r2ImageMap = r2ImageMap;
      post.updatedAt = new Date().toISOString();
      await LibraryModule.savePost(post);
      return { success: false, reasons: [reason], warnings };
    }

    post.saveStatus = "임시저장완료";
    post.r2ImageMap = r2ImageMap;
    post.bloggerDraftResult = draftResult.result || {};
    post.updatedAt = new Date().toISOString();
    await LibraryModule.savePost(post);

    return { success: true, result: draftResult.result, warnings, r2ImageMap };
  }

  return {
    runSaveFlow,
  };
})();
