/**
 * naver-copy-module.js
 *
 * 네이버 블로그 수동 복사 전용 단독 모듈.
 * - 자동 저장/API 연결 없음
 * - Blogger 저장 흐름과 분리
 * - 필요 없으면 이 파일, index.html의 네이버 섹션, script 연결만 삭제하면 된다.
 */

const NaverCopyModule = (() => {
  let bound = false;
  let selectedPost = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setResult(message, type) {
    const el = $("naver-copy-result");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("naver-copy-result--ok", "naver-copy-result--warn");
    if (type) el.classList.add(`naver-copy-result--${type}`);
  }

  function setButtonsDisabled(disabled) {
    [
      "naver-title-copy-btn",
      "naver-body-copy-btn",
      "naver-image-copy-btn",
      "naver-tags-copy-btn",
    ].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!disabled;
    });
  }

  function getTitle(post) {
    const meta = post && post.metadata ? post.metadata : {};
    return (post && post.title) || meta.title || "";
  }

  function getTags(post) {
    const meta = post && post.metadata ? post.metadata : {};
    if (Array.isArray(meta.tags) && meta.tags.length) return meta.tags.join(", ");
    if (Array.isArray(meta.keywords) && meta.keywords.length) return meta.keywords.join(", ");
    if (meta.keyword) return String(meta.keyword);
    if (meta.targetKeyword) return String(meta.targetKeyword);
    return "";
  }

  function collectR2ImageUrls(post) {
    const map = (post && post.r2ImageMap) || {};
    const urls = Object.values(map).filter((url) => /^https?:\/\//i.test(String(url || "")));
    return [...new Set(urls)];
  }

  function replaceImageSourcesWithR2(html, post) {
    if (!html) return "";
    const r2Map = (post && post.r2ImageMap) || {};
    if (!Object.keys(r2Map).length) return html;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      doc.body.querySelectorAll("img").forEach((img) => {
        const src = (img.getAttribute("src") || "").trim();
        const baseName = src.split("/").pop().split("?")[0].toLowerCase();
        const replaced = r2Map[src] || r2Map[baseName];
        if (replaced) img.setAttribute("src", replaced);
      });
      return doc.body.innerHTML;
    } catch (error) {
      return html;
    }
  }

  function htmlToPlainText(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html || "", "text/html");
      doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      doc.querySelectorAll("p, h1, h2, h3, li, blockquote").forEach((el) => {
        el.appendChild(doc.createTextNode("\n"));
      });
      return doc.body.textContent.replace(/\n{3,}/g, "\n\n").trim();
    } catch (error) {
      return "";
    }
  }

  function buildBodyHtml(post) {
    if (!post) return "";
    const raw = post.contentHtmlRaw || "";
    const safe = window.PreviewModule && typeof PreviewModule.sanitizeHtml === "function"
      ? PreviewModule.sanitizeHtml(raw)
      : raw;
    return replaceImageSourcesWithR2(safe, post);
  }

  async function copyText(text) {
    if (!text) {
      setResult("복사할 내용이 없습니다.", "warn");
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      setResult("복사 권한이 없어 실패했습니다.", "warn");
      return false;
    }
  }

  async function copyRichBody(post) {
    const html = buildBodyHtml(post);
    const plain = htmlToPlainText(html);
    if (!html && !plain) {
      setResult("복사할 본문이 없습니다.", "warn");
      return;
    }

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain || html);
      }
      setResult("본문을 복사했습니다.", "ok");
    } catch (error) {
      const ok = await copyText(plain || html);
      if (ok) setResult("본문을 복사했습니다.", "ok");
    }
  }

  function render(post) {
    selectedPost = post || null;

    const titleEl = $("naver-copy-title");
    const statusEl = $("naver-copy-status");

    if (!selectedPost) {
      if (titleEl) titleEl.textContent = "선택된 글 없음";
      if (statusEl) statusEl.textContent = "현재 상태: 글 미선택";
      setButtonsDisabled(true);
      setResult("");
      return;
    }

    if (titleEl) titleEl.textContent = getTitle(selectedPost) || "제목 없음";
    if (statusEl) statusEl.textContent = "현재 상태: 네이버 수동 복사 준비";
    setButtonsDisabled(false);
    setResult("");
  }

  function handleLifecycle(eventName, payload) {
    if (eventName !== "post-selected") return;
    render((payload && payload.post) || null);
  }

  function bindEvents() {
    if (bound) return;

    const titleBtn = $("naver-title-copy-btn");
    const bodyBtn = $("naver-body-copy-btn");
    const imageBtn = $("naver-image-copy-btn");
    const tagsBtn = $("naver-tags-copy-btn");
    const openBtn = $("naver-blog-open-btn");

    if (!titleBtn || !bodyBtn || !imageBtn || !tagsBtn || !openBtn) return;

    titleBtn.addEventListener("click", async () => {
      if (!selectedPost) return;
      const ok = await copyText(getTitle(selectedPost));
      if (ok) setResult("제목을 복사했습니다.", "ok");
    });

    bodyBtn.addEventListener("click", async () => {
      if (!selectedPost) return;
      await copyRichBody(selectedPost);
    });

    imageBtn.addEventListener("click", async () => {
      if (!selectedPost) return;
      const urls = collectR2ImageUrls(selectedPost);
      if (!urls.length) {
        setResult("R2 이미지 URL이 없습니다. 블로그스팟 임시저장 후 다시 확인하세요.", "warn");
        return;
      }
      const ok = await copyText(urls.join("\n"));
      if (ok) setResult("이미지 URL을 복사했습니다.", "ok");
    });

    tagsBtn.addEventListener("click", async () => {
      if (!selectedPost) return;
      const ok = await copyText(getTags(selectedPost));
      if (ok) setResult("태그를 복사했습니다.", "ok");
    });

    openBtn.addEventListener("click", () => {
      window.open("https://blog.naver.com", "_blank", "noopener,noreferrer");
    });

    if (window.GptCoreAPI && typeof GptCoreAPI.registerLifecycleListener === "function") {
      GptCoreAPI.registerLifecycleListener("naver-copy-module", handleLifecycle);
      render(GptCoreAPI.getSelectedPost ? GptCoreAPI.getSelectedPost() : null);
    } else {
      render(null);
    }

    bound = true;
  }

  function init() {
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    init,
    isReady: () => bound,
  };
})();

window.NaverCopyModule = NaverCopyModule;
