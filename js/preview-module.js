/**
 * preview-module.js
 * HTML 미리보기 - 보안 필터링 및 렌더링 모듈
 *
 * 출처: GPT-main preview-module.js 이식. 이미지 매칭 대상만 imageList 배열 대신
 * 자료실 항목의 imageFiles map(파일명 기준)을 사용하도록 맞췄다.
 *
 * 허용 태그: h1~h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em,
 *            blockquote, img, a 등 (content.html 원본 구조 유지)
 * 금지 태그: script, iframe, object, embed, form, input, button, style
 */

const PreviewModule = (() => {
  const FORBIDDEN_TAGS = ["script", "iframe", "object", "embed", "form", "input", "button", "style"];

  function sanitizeHtml(rawHtml) {
    if (!rawHtml) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");

      FORBIDDEN_TAGS.forEach((tagName) => {
        doc.querySelectorAll(tagName).forEach((el) => el.remove());
      });

      doc.body.querySelectorAll("*").forEach((el) => {
        [...el.attributes].forEach((attr) => {
          const attrName = attr.name.toLowerCase();
          if (attrName.startsWith("on")) el.removeAttribute(attr.name);
          if (attrName === "href" && attr.value.trim().toLowerCase().startsWith("javascript:")) {
            el.removeAttribute("href");
          }
          if (attrName === "src" && attr.value.trim().toLowerCase().startsWith("javascript:")) {
            el.removeAttribute("src");
          }
        });
      });

      return doc.body.innerHTML;
    } catch (error) {
      ErrorLogModule.logError({
        module: "preview-module",
        message: "HTML 보안 필터링 실패",
        detail: error.message,
        relatedId: null,
      });
      return "";
    }
  }

  // 미리보기 전용: content.html 안의 img src가 ZIP 내부 상대경로(thumbnail.png,
  // images/body-01.png 등)를 그대로 가리키는 경우, 자료실 항목의 imageFiles map에서
  // 같은 파일명을 찾아 실제 dataUrl로 치환한다. 매칭되는 이미지를 찾지 못하면
  // 깨진 이미지 아이콘 대신 src를 비우고 대체 문구만 남긴다.
  function mapImageSources(safeHtml, imageFiles) {
    if (!safeHtml) return safeHtml;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeHtml, "text/html");
      const images = doc.body.querySelectorAll("img");
      const map = imageFiles || {};

      images.forEach((img) => {
        const src = img.getAttribute("src") || "";

        // 이미 dataUrl/Blob/Object URL/절대경로(http)인 경우는 그대로 둔다.
        if (/^(data:|blob:|https?:)/i.test(src)) return;

        const baseName = src.split("/").pop().split("?")[0].toLowerCase();
        const matched = map[baseName];

        if (matched && matched.dataUrl) {
          img.setAttribute("src", matched.dataUrl);
        } else {
          img.removeAttribute("src");
          img.setAttribute("alt", img.getAttribute("alt") || "이미지를 표시할 수 없습니다");
          img.classList.add("preview-broken-img");
        }
      });

      return doc.body.innerHTML;
    } catch (error) {
      ErrorLogModule.logError({
        module: "preview-module",
        message: "미리보기 이미지 표시 실패",
        detail: error.message,
        relatedId: null,
      });
      return safeHtml;
    }
  }

  // Blogspot 기준 미리보기를 위한 목차(h2/h3) 자동 추출(표시용, 저장하지 않음).
  function extractTableOfContents(safeHtml) {
    if (!safeHtml) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeHtml, "text/html");
      const headings = doc.body.querySelectorAll("h2, h3");
      const toc = [];
      headings.forEach((heading) => {
        const text = heading.textContent.trim();
        if (text) toc.push({ level: heading.tagName.toLowerCase(), text });
      });
      return toc;
    } catch (error) {
      return [];
    }
  }

  // content.html 안에서 참조하는 이미지 파일명 중 imageFiles map에 실제로 없는
  // (원본 ZIP에서 매칭되지 않는) 항목을 찾아낸다. 저장 모듈에서 R2 업로드 전
  // "원본 이미지 매칭 실패" 판정에 사용한다.
  function findUnresolvedImageRefs(rawHtml, imageFiles) {
    if (!rawHtml) return [];
    const map = imageFiles || {};
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");
      const images = doc.body.querySelectorAll("img");
      const unresolved = [];
      images.forEach((img) => {
        const src = (img.getAttribute("src") || "").trim();
        if (!src) return;
        if (/^(https?:|data:)/i.test(src)) return; // http(s)/data는 이 단계에서 확인 대상 아님
        const baseName = src.split("/").pop().split("?")[0].toLowerCase();
        if (!map[baseName]) unresolved.push(src);
      });
      return unresolved;
    } catch (error) {
      return [];
    }
  }

  function renderPreview(post) {
    if (!post) {
      ErrorLogModule.logError({
        module: "preview-module",
        message: "미리보기 렌더링 실패",
        detail: "표시할 글 데이터가 없음",
        relatedId: null,
      });
      return null;
    }

    try {
      const meta = post.metadata || {};
      const safeHtml = sanitizeHtml(post.contentHtmlRaw);
      const mappedHtml = mapImageSources(safeHtml, post.imageFiles);
      const imageFiles = post.imageFiles || {};
      const thumbnail = Object.values(imageFiles).find((img) => img.role === "thumbnail") || null;

      return {
        title: post.title || meta.title || "(제목 없음)",
        keyword: meta.keyword || meta.targetKeyword || "-",
        metaDescription: meta.metaDescription || meta.description || "-",
        tags: Array.isArray(meta.tags) && meta.tags.length > 0 ? meta.tags.join(", ") : "-",
        safeHtml: mappedHtml,
        thumbnail,
        tableOfContents: extractTableOfContents(safeHtml),
        faqList: Array.isArray(meta.faq) ? meta.faq : [],
      };
    } catch (error) {
      ErrorLogModule.logError({
        module: "preview-module",
        message: "미리보기 렌더링 실패",
        detail: error.message,
        relatedId: post.id || null,
      });
      return null;
    }
  }

  return {
    sanitizeHtml,
    mapImageSources,
    extractTableOfContents,
    findUnresolvedImageRefs,
    renderPreview,
  };
})();
