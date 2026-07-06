/**
 * preview-module.js
 * HTML 미리보기 - 보안 필터링 및 렌더링 모듈
 *
 * 허용 태그: h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td,
 *            strong, em, blockquote, img 등
 * 금지 태그: script, iframe, object, embed, form, input, button
 * 인라인 이벤트(onclick 등) 및 외부 스크립트 실행은 모두 제거한다.
 */

const PreviewModule = (() => {
  const FORBIDDEN_TAGS = ["script", "iframe", "object", "embed", "form", "input", "button"];

  function sanitizeHtml(rawHtml) {
    if (!rawHtml) return "";

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");

      FORBIDDEN_TAGS.forEach((tagName) => {
        doc.querySelectorAll(tagName).forEach((el) => el.remove());
      });

      const allElements = doc.body.querySelectorAll("*");
      allElements.forEach((el) => {
        [...el.attributes].forEach((attr) => {
          const attrName = attr.name.toLowerCase();
          if (attrName.startsWith("on")) {
            el.removeAttribute(attr.name);
          }
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

  // repair(0.0.7): content.html 안의 img src가 ZIP 내부 상대경로 파일명
  // (thumbnail.png, body-01.png 등)을 그대로 가리키고 있어 미리보기에서
  // 이미지가 깨지거나 물음표로 표시되는 문제를 보정한다. imageList의 fileName과
  // 매칭되는 경우 실제 dataUrl로 치환하고, 매칭되는 이미지를 찾지 못한 경우에는
  // 깨진 이미지 아이콘 대신 src를 비우고 대체 문구만 남긴다.
  function mapImageSources(safeHtml, imageList) {
    if (!safeHtml) return safeHtml;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeHtml, "text/html");
      const images = doc.body.querySelectorAll("img");

      images.forEach((img) => {
        const src = img.getAttribute("src") || "";

        // 이미 dataUrl/Blob/Object URL/절대경로(http)인 경우는 그대로 둔다.
        if (/^(data:|blob:|https?:)/i.test(src)) return;

        const baseName = src.split("/").pop().split("?")[0].toLowerCase();
        const matched = (imageList || []).find(
          (image) => (image.fileName || "").toLowerCase() === baseName
        );

        if (matched && matched.dataUrl) {
          img.setAttribute("src", matched.dataUrl);
        } else {
          img.removeAttribute("src");
          img.setAttribute("alt", img.getAttribute("alt") || "이미지를 표시할 수 없습니다");
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

  // repair2: Blogspot 기준 미리보기를 위한 목차(h2/h3) 자동 추출.
  // safeHtml(필터링이 끝난 안전한 HTML)을 대상으로 하며, 별도 저장하지 않고 표시용으로만 사용한다.
  function extractTableOfContents(safeHtml) {
    if (!safeHtml) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeHtml, "text/html");
      const headings = doc.body.querySelectorAll("h2, h3");
      const toc = [];
      headings.forEach((heading) => {
        const text = heading.textContent.trim();
        if (text) {
          toc.push({ level: heading.tagName.toLowerCase(), text });
        }
      });
      return toc;
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
      const safeHtml = sanitizeHtml(post.htmlContent);
      const imageList = Array.isArray(post.imageList) ? post.imageList : [];
      const thumbnail = imageList.find((img) => img.type === "thumbnail") || null;
      const bodyImages = imageList.filter((img) => img.type === "body");
      const mappedHtml = mapImageSources(safeHtml, imageList);

      return {
        title: post.title || "(제목 없음)",
        keyword: post.keyword || "-",
        metaDescription: post.metaDescription || "-",
        tags: Array.isArray(post.tags) && post.tags.length > 0 ? post.tags.join(", ") : "-",
        safeHtml: mappedHtml,
        markdownContent: post.markdownContent || "(내용 없음)",
        textContent: post.textContent || "(내용 없음)",
        thumbnail,
        bodyImages,
        tableOfContents: extractTableOfContents(safeHtml),
        faqList: Array.isArray(post.faqList) ? post.faqList : [],
      };
    } catch (error) {
      ErrorLogModule.logError({
        module: "preview-module",
        message: "미리보기 이미지 표시 실패",
        detail: error.message,
        relatedId: post.id || null,
      });
      return null;
    }
  }

  return {
    sanitizeHtml,
    renderPreview,
  };
})();
