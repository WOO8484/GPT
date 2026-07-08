/**
 * naver-export-module.js (v1.6.3 신규 모듈, 선택 기능)
 *
 * 작업지시서(GPT 공작소 v1.6.3) 8장 범위:
 * 현재 선택된 글 데이터를 "읽어서" 네이버 붙여넣기용 복사 데이터만 만드는
 * 읽기 전용 보조 모듈이다.
 *
 * 안전 원칙(8-7, 반드시 지킨다):
 * - 기존 post 데이터를 수정하지 않는다(어떤 필드도 write하지 않음).
 * - 기존 저장 상태(saveStatus 등)를 변경하지 않는다.
 * - Blogger 저장 흐름(BloggerSaveModule.runSaveFlow 등)을 호출하지 않는다.
 * - R2 업로드(R2ImageModule)를 실행하지 않는다.
 * - 네이버 복사용 문자열만 생성한다. 네이버 자동 로그인/자동 발행/네이버 앱
 *   제어/에디터 자동 입력은 구현하지 않는다(1차 범위 아님).
 * - 이 파일과 네이버 카드 마크업만 제거하면 기존 시스템은 그대로 동작해야 한다.
 *
 * 공개 API(전역 객체, 작업지시서 8-2):
 *   window.NaverExportModule = {
 *     init, render,
 *     getNaverTitle, getNaverBody, getNaverTags,
 *     copyTitle, copyBody, copyTags,
 *     renderNaverImageList
 *   }
 */

const NaverExportModule = (() => {
  let bound = false;

  function isReady() {
    return bound;
  }

  function getCurrentPost() {
    try {
      if (window.GptCoreAPI && typeof GptCoreAPI.getSelectedPost === "function") {
        return GptCoreAPI.getSelectedPost();
      }
    } catch (error) {
      // GptCoreAPI가 없거나 실패해도 이 모듈은 조용히 빈 상태로 남는다.
    }
    return null;
  }

  /* ----------------------------------------------------------
     8-3: 제목 복사 — 우선순위: 선택된 글 title → metadata.title →
     content의 첫 제목(h1/h2) → 파일명 기반 제목
     ---------------------------------------------------------- */
  function extractFirstHeadingText(html) {
    if (!html) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const heading = doc.body.querySelector("h1, h2, h3");
      return heading ? heading.textContent.trim() : "";
    } catch (error) {
      return "";
    }
  }

  function buildTitleFromFileName(post) {
    if (!post || !post.zipFileName) return "";
    return post.zipFileName.replace(/\.[^/.]+$/, "");
  }

  function getNaverTitle(post) {
    const target = post || getCurrentPost();
    if (!target) return "";

    if (target.title && target.title.trim()) return target.title.trim();

    const meta = target.metadata || {};
    if (meta.title && String(meta.title).trim()) return String(meta.title).trim();

    const fromHeading = extractFirstHeadingText(target.contentHtmlRaw);
    if (fromHeading) return fromHeading;

    return buildTitleFromFileName(target);
  }

  /* ----------------------------------------------------------
     8-4: 전체 본문 복사 — 우선순위: content.txt → content.md(기호 정리) →
     content.html(태그 제거 후 텍스트 변환). 이미지 위치는
     "[사진 N 삽입 위치]"로 표시하고, 본문 하단에 태그를 기본 포함한다.
     ---------------------------------------------------------- */

  // content.md의 과도한 마크다운 기호만 가볍게 정리한다(구조 재작성은 하지 않음).
  function cleanMarkdown(md) {
    if (!md) return "";
    return md
      .replace(/^#{1,6}\s+/gm, "") // 헤딩 기호 제거
      .replace(/\*\*(.*?)\*\*/g, "$1") // 볼드
      .replace(/\*(.*?)\*/g, "$1") // 이탤릭
      .replace(/^\s*[-*+]\s+/gm, "- ") // 목록 기호 통일
      .replace(/`([^`]*)`/g, "$1") // 인라인 코드
      .trim();
  }

  // content.html에서 이미지 위치는 "[사진 N 삽입 위치]"로 치환하고, 나머지는
  // 텍스트만 남긴다(블록 요소 사이에는 빈 줄을 넣어 문단을 구분한다).
  function htmlToNaverText(html) {
    if (!html) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // 금지 태그는 미리 제거한다(preview-module.js의 기준과 동일한 태그
      // 목록을 참고하되, 이 모듈은 표시/저장을 하지 않으므로 별도로 안전
      // 처리한다 — sanitizeHtml을 호출하지 않고 이 함수 내부에서만 처리).
      ["script", "style", "iframe", "object", "embed", "form", "input", "button"].forEach((tag) => {
        doc.querySelectorAll(tag).forEach((el) => el.remove());
      });

      let imageIndex = 0;
      doc.body.querySelectorAll("img").forEach((img) => {
        imageIndex += 1;
        const marker = doc.createTextNode(`\n\n[사진 ${imageIndex} 삽입 위치]\n\n`);
        img.replaceWith(marker);
      });

      const blockTags = ["P", "DIV", "LI", "H1", "H2", "H3", "H4", "TR", "BLOCKQUOTE"];
      blockTags.forEach((tag) => {
        doc.body.querySelectorAll(tag).forEach((el) => {
          el.appendChild(doc.createTextNode("\n"));
        });
      });

      const text = doc.body.textContent || "";
      return text
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } catch (error) {
      return "";
    }
  }

  function extractHashtagsFromText(text) {
    if (!text) return [];
    const matches = text.match(/#[^\s#]+/g);
    if (!matches) return [];
    // 중복 제거, # 없이 순수 태그명만 남긴다.
    const seen = new Set();
    const tags = [];
    matches.forEach((m) => {
      const clean = m.replace(/^#/, "").trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        tags.push(clean);
      }
    });
    return tags;
  }

  /* ----------------------------------------------------------
     8-5: 태그 복사 — 우선순위: metadata.tags → metadata.keywords →
     본문 하단의 #태그 추출
     ---------------------------------------------------------- */
  function getNaverTags(post) {
    const target = post || getCurrentPost();
    if (!target) return [];

    const meta = target.metadata || {};

    if (Array.isArray(meta.tags) && meta.tags.length > 0) {
      return meta.tags.map((t) => String(t).trim()).filter(Boolean);
    }

    if (Array.isArray(meta.keywords) && meta.keywords.length > 0) {
      return meta.keywords.map((t) => String(t).trim()).filter(Boolean);
    }
    if (typeof meta.keywords === "string" && meta.keywords.trim()) {
      return meta.keywords
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const fromBodyText = target.contentText || htmlToNaverText(target.contentHtmlRaw);
    return extractHashtagsFromText(fromBodyText);
  }

  function buildTagLine(tags) {
    if (!tags || !tags.length) return "";
    return tags.map((t) => "#" + t.replace(/^#/, "")).join(" ");
  }

  function getNaverBody(post) {
    const target = post || getCurrentPost();
    if (!target) return "";

    let bodyText = "";
    if (target.contentText && target.contentText.trim()) {
      bodyText = target.contentText.trim();
    } else if (target.contentMd && target.contentMd.trim()) {
      bodyText = cleanMarkdown(target.contentMd);
    } else {
      bodyText = htmlToNaverText(target.contentHtmlRaw);
    }

    // 1차 범위: 본문 하단에 태그를 기본 포함한다.
    const tagLine = buildTagLine(getNaverTags(target));
    if (tagLine) {
      return `${bodyText}\n\n${tagLine}`;
    }
    return bodyText;
  }

  /* ----------------------------------------------------------
     8-6: 이미지 순서 보기 — 자동 삽입 없음. role(thumbnail/body-NN)
     순서대로 파일명만 나열한다(자동 삽입/자동 입력 없음).
     ---------------------------------------------------------- */
  function getNaverImageList(post) {
    const target = post || getCurrentPost();
    if (!target || !target.imageFiles) return [];

    const entries = Object.values(target.imageFiles);

    const thumbnails = entries.filter((img) => img.role === "thumbnail");
    const bodyImages = entries
      .filter((img) => typeof img.role === "string" && img.role.indexOf("body-") === 0)
      .sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : 0));
    const extras = entries.filter((img) => img.role !== "thumbnail" && (typeof img.role !== "string" || img.role.indexOf("body-") !== 0));

    return [...thumbnails, ...bodyImages, ...extras];
  }

  /* ----------------------------------------------------------
     복사 실행 + 안내 표시. 공용 팝업(showPopup)을 새로 열지 않고, 네이버
     카드 안의 결과 문구 영역(#naver-copy-result)에 짧게 안내한다(작업
     지시서 8-3의 "토스트 또는 공용 팝업으로 안내" 중 카드 내 인라인 안내
     방식을 선택 — 팝업을 새로 열면 다른 팝업과 겹칠 수 있어 더 가벼운
     방식을 사용했다).
     ---------------------------------------------------------- */
  function showResult(message) {
    const resultEl = document.getElementById("naver-copy-result");
    if (!resultEl) return;
    resultEl.textContent = message;
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // 폴백: 임시 textarea로 선택 복사.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (error) {
      return false;
    }
  }

  async function copyTitle() {
    const post = getCurrentPost();
    if (!post) return;
    const title = getNaverTitle(post);
    if (!title) {
      showResult("복사할 제목이 없습니다.");
      return;
    }
    try {
      const ok = await copyText(title);
      showResult(ok ? "네이버 제목이 복사되었습니다." : "복사에 실패했습니다. 직접 선택해 복사해주세요.");
    } catch (error) {
      showResult("복사에 실패했습니다. 직접 선택해 복사해주세요.");
    }
  }

  async function copyBody() {
    const post = getCurrentPost();
    if (!post) return;
    const body = getNaverBody(post);
    if (!body) {
      showResult("복사할 본문이 없습니다.");
      return;
    }
    try {
      const ok = await copyText(body);
      showResult(ok ? "네이버 본문이 복사되었습니다." : "복사에 실패했습니다. 직접 선택해 복사해주세요.");
    } catch (error) {
      showResult("복사에 실패했습니다. 직접 선택해 복사해주세요.");
    }
  }

  async function copyTags() {
    const post = getCurrentPost();
    if (!post) return;
    const tags = getNaverTags(post);
    const tagLine = buildTagLine(tags);
    if (!tagLine) {
      showResult("복사할 태그가 없습니다.");
      return;
    }
    try {
      const ok = await copyText(tagLine);
      showResult(ok ? "네이버 태그가 복사되었습니다." : "복사에 실패했습니다. 직접 선택해 복사해주세요.");
    } catch (error) {
      showResult("복사에 실패했습니다. 직접 선택해 복사해주세요.");
    }
  }

  function escapeHtmlLocal(text) {
    const div = document.createElement("div");
    div.textContent = text === null || text === undefined ? "" : String(text);
    return div.innerHTML;
  }

  function imageLabel(img, index) {
    if (img.role === "thumbnail") return `이미지 ${index}: 대표 이미지`;
    if (typeof img.role === "string" && img.role.indexOf("body-") === 0) {
      return `이미지 ${index}: 본문 이미지 (${img.fileName})`;
    }
    return `이미지 ${index}: ${img.fileName}`;
  }

  function renderNaverImageList(post) {
    const listEl = document.getElementById("naver-image-list");
    if (!listEl) return;

    const target = post || getCurrentPost();
    const images = getNaverImageList(target);

    if (!images.length) {
      listEl.innerHTML = `<li class="naver-image-item naver-image-item--empty">표시할 이미지가 없습니다.</li>`;
      return;
    }

    listEl.innerHTML = images
      .map((img, i) => `<li class="naver-image-item">${escapeHtmlLocal(imageLabel(img, i + 1))}</li>`)
      .join("");
  }

  /* ----------------------------------------------------------
     카드 표시 갱신. 글 미선택 시 안내 문구, 선택 시 복사 도구를 보여준다.
     ---------------------------------------------------------- */
  function render(post) {
    const emptyEl = document.getElementById("naver-empty");
    const targetEl = document.getElementById("naver-target");
    if (!emptyEl || !targetEl) return;

    const target = post !== undefined ? post : getCurrentPost();

    if (!target) {
      emptyEl.classList.remove("hidden");
      targetEl.classList.add("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    targetEl.classList.remove("hidden");
    showResult("");
    renderNaverImageList(target);
  }

  function handleLifecycle(eventName, payload) {
    if (eventName !== "post-selected") return;
    const post = (payload && payload.post) || null;
    render(post);
  }

  function bindEvents() {
    if (bound) return;

    const titleBtn = document.getElementById("naver-copy-title-btn");
    const bodyBtn = document.getElementById("naver-copy-body-btn");
    const tagsBtn = document.getElementById("naver-copy-tags-btn");
    const emptyEl = document.getElementById("naver-empty");
    const targetEl = document.getElementById("naver-target");

    if (!titleBtn || !bodyBtn || !tagsBtn || !emptyEl || !targetEl) return;
    if (!window.GptCoreAPI || typeof GptCoreAPI.registerLifecycleListener !== "function") return;

    try {
      titleBtn.addEventListener("click", copyTitle);
      bodyBtn.addEventListener("click", copyBody);
      tagsBtn.addEventListener("click", copyTags);

      GptCoreAPI.registerLifecycleListener("naver-export-module", handleLifecycle);

      render(getCurrentPost());

      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  function init() {
    bindEvents();
  }

  return {
    init,
    render,
    isReady,
    getNaverTitle,
    getNaverBody,
    getNaverTags,
    copyTitle,
    copyBody,
    copyTags,
    renderNaverImageList,
  };
})();

window.NaverExportModule = NaverExportModule;

// v1.6.3: 이 모듈은 별도 연결 파일 없이 스스로 초기화한다(prompt-copy-module.js와
// 동일한 패턴). GptCoreAPI 객체 자체는 app-core.js가 스크립트 최상위에서
// 즉시 만들어 두므로(로그인 여부와 무관), DOMContentLoaded 시점에는 항상
// 접근 가능하다. 로그인 전에는 selectedPost가 없으므로 "글 미선택" 안내만
// 표시된 채로 대기하며, 로그인 후 글 선택 이벤트(post-selected)가 오면
// 정상적으로 반영된다.
document.addEventListener("DOMContentLoaded", () => {
  try {
    NaverExportModule.init();
  } catch (error) {
    // 최후의 방어선: 실패해도 조용히 무시한다(기존 시스템에는 영향 없음).
  }
});
