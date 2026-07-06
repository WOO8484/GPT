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

      return {
        title: post.title || "(제목 없음)",
        keyword: post.keyword || "-",
        metaDescription: post.metaDescription || "-",
        tags: Array.isArray(post.tags) && post.tags.length > 0 ? post.tags.join(", ") : "-",
        safeHtml,
        markdownContent: post.markdownContent || "(내용 없음)",
        textContent: post.textContent || "(내용 없음)",
        thumbnail,
        bodyImages,
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
