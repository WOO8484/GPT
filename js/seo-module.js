/**
 * seo-module.js
 * SEO 검수 모듈
 * 제목/메타설명 길이, 헤딩 구조, 이미지 ALT, 태그, 링크 등을 점검하여
 * article.seoResult에 결과를 저장한다.
 */

const SeoModule = (() => {
  const TITLE_MIN_LENGTH = 10;
  const TITLE_MAX_LENGTH = 60;
  const META_MIN_LENGTH = 50;
  const META_MAX_LENGTH = 160;

  let currentPost = null;

  function loadPost(post) {
    currentPost = post;
    return currentPost;
  }

  function getCurrentPost() {
    return currentPost;
  }

  function parseHtmlDocument(htmlContent) {
    try {
      const parser = new DOMParser();
      return parser.parseFromString(htmlContent || "", "text/html");
    } catch (error) {
      ErrorLogModule.logError({
        module: "seo-module",
        message: "HTML heading 파싱 실패",
        detail: error.message,
        relatedId: currentPost ? currentPost.id : null,
      });
      return null;
    }
  }

  function checkTitle(issues) {
    const title = currentPost.title || "";
    if (title.length === 0) {
      issues.push("제목이 비어 있습니다.");
    } else if (title.length < TITLE_MIN_LENGTH) {
      issues.push(`제목이 너무 짧습니다. (${title.length}자)`);
    } else if (title.length > TITLE_MAX_LENGTH) {
      issues.push(`제목이 너무 깁니다. (${title.length}자)`);
    }
  }

  function checkMetaDescription(issues) {
    const meta = currentPost.metaDescription || "";
    if (meta.length === 0) {
      issues.push("메타설명이 비어 있습니다.");
    } else if (meta.length < META_MIN_LENGTH) {
      issues.push(`메타설명이 너무 짧습니다. (${meta.length}자)`);
    } else if (meta.length > META_MAX_LENGTH) {
      issues.push(`메타설명이 너무 깁니다. (${meta.length}자)`);
    }
  }

  function checkHeadingStructure(doc, issues) {
    if (!doc) {
      issues.push("HTML 구조를 확인할 수 없습니다.");
      return;
    }
    const h2Count = doc.querySelectorAll("h2").length;
    const h3Count = doc.querySelectorAll("h3").length;
    if (h2Count === 0) {
      issues.push("H2 제목이 없습니다.");
    }
    if (h3Count === 0) {
      issues.push("H3 제목이 없습니다.");
    }
  }

  function checkImages(doc, issues) {
    const imageList = Array.isArray(currentPost.imageList) ? currentPost.imageList : [];

    if (imageList.length === 0) {
      issues.push("등록된 이미지가 없습니다.");
      return;
    }

    const missingAlt = imageList.filter((img) => !img.altText || img.altText.trim().length === 0);
    if (missingAlt.length > 0) {
      issues.push(`ALT 태그가 없는 이미지가 ${missingAlt.length}개 있습니다.`);
    }
  }

  function checkFaq(issues) {
    const faqList = Array.isArray(currentPost.faqList) ? currentPost.faqList : [];
    if (faqList.length === 0) {
      issues.push("FAQ가 없습니다.");
    }
  }

  function checkTags(issues) {
    const tags = Array.isArray(currentPost.tags) ? currentPost.tags : [];
    if (tags.length === 0) {
      issues.push("태그가 없습니다.");
    }
  }

  function checkLinks(doc, issues) {
    if (!doc) return;
    const links = [...doc.querySelectorAll("a[href]")];
    const internalLinks = links.filter((a) => {
      const href = a.getAttribute("href") || "";
      return href.startsWith("/") || href.startsWith("#") || href.startsWith(".");
    });
    const externalLinks = links.filter((a) => {
      const href = a.getAttribute("href") || "";
      return href.startsWith("http://") || href.startsWith("https://");
    });

    if (internalLinks.length === 0) {
      issues.push("내부링크가 없습니다.");
    }
    if (externalLinks.length === 0) {
      issues.push("외부링크가 없습니다.");
    }
  }

  function calculateScore(issueCount) {
    const score = 100 - issueCount * 10;
    return Math.max(0, score);
  }

  function decideResult(score) {
    if (score >= 80) return "통과";
    if (score >= 50) return "수정 필요";
    return "보류";
  }

  function runCheck() {
    if (!currentPost) {
      ErrorLogModule.logError({
        module: "seo-module",
        message: "SEO 검수 실패",
        detail: "현재 글 정보가 없음",
        relatedId: null,
      });
      return null;
    }

    try {
      const doc = parseHtmlDocument(currentPost.htmlContent);
      const issues = [];

      checkTitle(issues);
      checkMetaDescription(issues);
      checkHeadingStructure(doc, issues);
      checkImages(doc, issues);
      checkFaq(issues);
      checkTags(issues);
      checkLinks(doc, issues);

      const totalScore = calculateScore(issues.length);
      const result = decideResult(totalScore);

      const seoResult = {
        totalScore,
        result,
        issues,
        checkedAt: new Date().toISOString(),
      };

      currentPost.seoResult = seoResult;
      return seoResult;
    } catch (error) {
      ErrorLogModule.logError({
        module: "seo-module",
        message: "SEO 검수 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return null;
    }
  }

  async function saveSeoResult() {
    if (!currentPost) {
      ErrorLogModule.logError({
        module: "seo-module",
        message: "SEO 결과 저장 실패",
        detail: "현재 글 정보가 없음",
        relatedId: null,
      });
      return { success: false };
    }

    try {
      if (
        currentPost.seoResult &&
        currentPost.seoResult.result === "통과" &&
        currentPost.status === "작성중"
      ) {
        currentPost.status = "검수중";
      }

      currentPost.updatedAt = new Date().toISOString();
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (error) {
      ErrorLogModule.logError({
        module: "seo-module",
        message: "SEO 결과 저장 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return { success: false };
    }
  }

  return {
    loadPost,
    getCurrentPost,
    runCheck,
    saveSeoResult,
  };
})();
