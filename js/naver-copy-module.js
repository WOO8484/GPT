/**
 * naver-copy-module.js (v1.6.2 신규 → v6.9 지시문 반영 → 네이버 이미지 팝업 최종 정리)
 *
 * 역할:
 * - 네이버는 자동 저장/발행 대상이 아니다. 이 모듈은 게시판에서 선택된 글의
 *   제목 / 본문 / 게시판 / 네이버 주제분류 / 태그 / 지역 키워드 / 공식 링크를
 *   확인하고 클립보드로 "수동 복사"만 한다.
 * - v6.9 반영: 항목이 많아져 메인 화면에는 상태 + 여는 버튼만 두고, 실제 항목
 *   표시/복사는 팝업(#popup-naver-copy-overlay) 안에서 처리한다.
 * - 네이버 이미지 팝업 최종 정리: 구버전 이미지 안내 문구/버튼을 제거하고,
 *   대신 "이미지 목록 팝업"(#popup-naver-image-list-overlay)에서 썸네일 →
 *   본문 이미지 순서로 미리보기를 보여주고, 이미지마다 [이미지 다운로드] 버튼
 *   하나만 둔다(저장 안내 문구/크게보기 버튼 없음, 클릭 시 파일 다운로드를
 *   시도하고 브라우저 정책으로 막히면 새 창 표시로 대체한다).
 *   본문 이미지 개수는 고정하지 않고 post.imageFiles의 role(썸네일/본문 번호)
 *   기준으로 동적으로 표시한다.
 *
 * 금지 사항 준수(변경 없음):
 * - 네이버 자동 저장/임시저장/발행을 구현하지 않는다.
 * - 네이버 API를 호출하지 않는다.
 * - Blogger 저장 흐름(blogger-save-module.js, app-core.js의 handleSaveStartClick 등)을
 *   호출하거나 개입하지 않는다. 오직 GptCoreAPI로 "읽기"만 한다.
 *
 * metadata.json에 v6.9 신규 필드(naver_board / naver_topic_category / naver_tags /
 * naver_location_keywords / official_links)가 없어도 빈칸으로 깨지지 않게
 * "정보 없음"으로 표시하고, 기능(복사 등)은 계속 동작한다.
 *
 * 연결 방식:
 * - prompt-copy-module.js와 동일하게 완전히 독립적으로 스스로 초기화한다
 *   (자체 DOMContentLoaded 리스너). app-core.js의 초기화 블록은 건드리지 않는다.
 * - 표시 대상 DOM이 하나라도 없으면 조용히 아무 것도 하지 않는다(예외를 던지지 않음).
 * - 글 선택 상태 표시는 GptCoreAPI.registerLifecycleListener("post-selected")로만
 *   갱신한다. 이 리스너가 실패해도 Blogger 저장 흐름에는 영향이 없다.
 */

const NaverCopyModule = (() => {
  const EMPTY_LABEL = "정보 없음";

  let bound = false;

  function isReady() {
    return bound;
  }

  function els() {
    return {
      statusEl: document.getElementById("naver-copy-status"),
      openBtn: document.getElementById("naver-copy-open-btn"),
      closeBtn: document.getElementById("naver-copy-close-btn"),
      overlay: document.getElementById("popup-naver-copy-overlay"),

      fieldBoard: document.getElementById("naver-field-board"),
      fieldCategory: document.getElementById("naver-field-category"),
      fieldTags: document.getElementById("naver-field-tags"),
      fieldTagCheck: document.getElementById("naver-field-tag-check"),
      fieldLocation: document.getElementById("naver-field-location"),
      fieldTitle: document.getElementById("naver-field-title"),
      fieldLinks: document.getElementById("naver-field-links"),

      titleBtn: document.getElementById("naver-copy-title-btn"),
      bodyBtn: document.getElementById("naver-copy-body-btn"),
      boardCategoryBtn: document.getElementById("naver-copy-board-category-btn"),
      tagLocationBtn: document.getElementById("naver-copy-tag-location-btn"),
      linksBtn: document.getElementById("naver-copy-links-btn"),

      resultEl: document.getElementById("naver-copy-result"),
    };
  }

  // 이미지 목록 팝업 전용 DOM(네이버 이미지 팝업 최종 정리). 안내문/저장/크게보기
  // 없이 "이미지 목록 팝업" + 이미지마다 [이미지 다운로드] 버튼 하나만 사용한다.
  function imageListEls() {
    return {
      openBtn: document.getElementById("naver-image-list-open-btn"),
      closeBtn: document.getElementById("naver-image-list-close-btn"),
      overlay: document.getElementById("popup-naver-image-list-overlay"),
      bodyEl: document.getElementById("naver-image-list-body"),
      emptyEl: document.getElementById("naver-image-list-empty"),
    };
  }

  // GptCoreAPI가 없거나 실패해도 조용히 null을 반환한다(읽기 전용 접근).
  function getSelectedPost() {
    try {
      if (window.GptCoreAPI && typeof GptCoreAPI.getSelectedPost === "function") {
        return GptCoreAPI.getSelectedPost();
      }
    } catch (error) {
      // 읽기 실패는 이 모듈만의 문제로 한정한다.
    }
    return null;
  }

  function stripHtml(html) {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = html || "";
      return (tmp.textContent || tmp.innerText || "").trim();
    } catch (error) {
      return "";
    }
  }

  function getMeta(post) {
    return (post && post.metadata) || {};
  }

  // 네이버 태그 최종 정제(실기 오류 수정). naver_tags.txt 또는
  // metadata.naver_tags 어느 쪽에서 와도 화면 표시/복사 직전에 반드시 이
  // 파이프라인을 통과시킨다. "#뢰출, 호우주의보, 날씨확인지역 키워드: 정보
  // 없음"처럼 라벨/값이 태그 뒤에 공백 없이 붙어오는 실기 오류를, 라벨
  // 문구를 구분자로 바꿔 분리한 뒤 플레이스홀더 값을 제거하는 방식으로 고친다.
  const NAVER_TAG_LABEL_RE = /(지역\s*키워드|키워드|태그)\s*[:：]/g;
  const NAVER_TAG_SPLIT_RE = /[\n,#]+|\s{2,}/g;
  const NAVER_TAG_PUNCT_RE = /[:：;；,，#()（）\[\]{}/\\'"“”‘’]/g;
  const NAVER_TAG_PLACEHOLDER_SET = new Set(["정보없음", "정보 없음", "없음", "null", "undefined", "-", ""]);
  const NAVER_TAG_MAX_COUNT = 10;

  // raw는 문자열(naver_tags.txt 원문) 또는 배열(metadata.naver_tags)일 수 있다.
  function cleanNaverTagsFromRaw(raw) {
    const source = Array.isArray(raw) ? raw.join("\n") : String(raw || "");
    if (!source.trim()) return [];

    // 1) "지역 키워드:" / "키워드:" / "태그:" 라벨은 구분자로 바꾸고 라벨
    //    자체는 버린다(태그 뒤에 공백 없이 붙어와도 여기서 분리된다).
    let text = source.replace(NAVER_TAG_LABEL_RE, "\n");

    // 2) 줄바꿈 / 쉼표 / # / 공백 2개 이상을 전부 구분자로 통일한다.
    text = text.replace(NAVER_TAG_SPLIT_RE, "\n");

    const seen = new Set();
    const cleaned = [];
    text.split("\n").forEach((token) => {
      const tag = token.replace(NAVER_TAG_PUNCT_RE, "").trim();
      if (!tag) return;
      if (NAVER_TAG_PLACEHOLDER_SET.has(tag) || NAVER_TAG_PLACEHOLDER_SET.has(tag.toLowerCase())) return;
      if (seen.has(tag)) return;
      seen.add(tag);
      cleaned.push(tag);
    });

    return cleaned.slice(0, NAVER_TAG_MAX_COUNT);
  }

  // v7.2: selected_topic.md는 "## N. 필드명" 형식 섹션으로 구성된다(지시문 9장).
  // metadata.json에 값이 없을 때만 보조로 추출한다.
  function extractMdSection(md, label) {
    if (!md) return "";
    const re = new RegExp("##\\s*\\d+\\.\\s*" + label + "\\s*\\n+([\\s\\S]*?)(?=\\n##\\s*\\d+\\.|$)", "i");
    const match = md.match(re);
    if (!match) return "";
    return match[1].replace(/^[-\s]+/, "").trim().split("\n")[0].trim();
  }

  function getBoard(post) {
    const meta = getMeta(post);
    const value = meta.naver_board;
    if (typeof value === "string" && value.trim()) return value.trim();
    return extractMdSection(post && post.selectedTopicMd, "추천 게시판");
  }

  function getCategory(post) {
    const meta = getMeta(post);
    const value = meta.naver_topic_category;
    if (typeof value === "string" && value.trim()) return value.trim();
    return extractMdSection(post && post.selectedTopicMd, "네이버 주제분류");
  }

  // 신규 작업지침서(카테고리별 TOP1 전체 ZIP 업로드 처리) 10장: "네이버 태그는
  // naver_tags.txt를 우선 사용한다." naver_tags.txt가 있으면 그것을 먼저 쓰고,
  // 없을 때만 metadata.naver_tags로 보조한다.
  function getTags(post) {
    const rawFile = (post && post.naverTagsTxt) || "";
    if (rawFile.trim()) return cleanNaverTagsFromRaw(rawFile);

    const meta = getMeta(post);
    if (Array.isArray(meta.naver_tags) && meta.naver_tags.length) {
      return cleanNaverTagsFromRaw(meta.naver_tags);
    }
    return [];
  }

  // 원본에 특수문자/라벨/플레이스홀더 등 정제가 필요한 부분이
  // 있었는지 확인한다("네이버 태그: 통과" / "정리됨"). 실제 표시/복사되는
  // 값은 항상 cleanNaverTagsFromRaw()를 거친 결과이므로, 이 검사는 안내용이다.
  const NAVER_TAG_DIRTY_TEST_RE = /[:：;；,，#()（）\[\]{}/\\'"“”‘’]|정보\s*없음|없음|null|undefined/i;

  function getTagCheckStatus(post) {
    const rawFile = (post && post.naverTagsTxt) || "";
    const meta = getMeta(post);
    const rawSource = rawFile.trim() ? rawFile : (Array.isArray(meta.naver_tags) ? meta.naver_tags.join("\n") : "");
    if (!rawSource.trim()) return "";
    return NAVER_TAG_DIRTY_TEST_RE.test(rawSource) ? "정리됨(원본에 정제 필요한 부분 있었음)" : "네이버 태그: 통과";
  }

  function getLocationKeywords(meta) {
    return Array.isArray(meta.naver_location_keywords) ? meta.naver_location_keywords.filter(Boolean) : [];
  }

  // official_links: [{ name, url, type, purpose }, ...] 형태(v6.9 기준). 형식이
  // 다르거나(예: 문자열 배열) 값이 없어도 깨지지 않게 최대한 표시한다.
  function getOfficialLinks(meta) {
    if (!Array.isArray(meta.official_links)) return [];
    return meta.official_links
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return { name: "", url: item };
        const name = typeof item.name === "string" ? item.name : "";
        const url = typeof item.url === "string" ? item.url : "";
        if (!name && !url) return null;
        return { name, url };
      })
      .filter(Boolean);
  }

  function renderStatus() {
    const { statusEl } = els();
    if (!statusEl) return;
    const post = getSelectedPost();
    statusEl.textContent = post ? "현재 상태: 네이버 수동 복사 준비" : "현재 상태: 게시글 선택 필요";
  }

  // 팝업을 열 때 현재 선택된 글 기준으로 항목들을 채운다. 글이 없거나
  // metadata 필드가 없어도 "정보 없음"으로만 표시하고 예외를 던지지 않는다.
  function renderFields() {
    const {
      fieldBoard, fieldCategory, fieldTags, fieldTagCheck, fieldLocation, fieldTitle, fieldLinks,
    } = els();
    const post = getSelectedPost();
    const meta = getMeta(post);

    if (fieldTitle) fieldTitle.textContent = (post && post.title) ? post.title : EMPTY_LABEL;
    if (fieldBoard) fieldBoard.textContent = getBoard(post) || EMPTY_LABEL;
    if (fieldCategory) fieldCategory.textContent = getCategory(post) || EMPTY_LABEL;

    const tags = getTags(post);
    if (fieldTags) fieldTags.textContent = tags.length ? tags.join(", ") : EMPTY_LABEL;
    if (fieldTagCheck) fieldTagCheck.textContent = getTagCheckStatus(post) || EMPTY_LABEL;

    const location = getLocationKeywords(meta);
    if (fieldLocation) fieldLocation.textContent = location.length ? location.join(", ") : EMPTY_LABEL;

    const links = getOfficialLinks(meta);
    if (fieldLinks) {
      fieldLinks.textContent = links.length
        ? links.map((link) => (link.name ? `${link.name}: ${link.url}` : link.url)).join(" / ")
        : EMPTY_LABEL;
    }
  }

  async function copyText(text, resultEl, label) {
    if (!text || !text.trim()) {
      resultEl.textContent = `복사할 ${label} 내용이 없습니다.`;
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        resultEl.textContent = `✅ ${label} 복사 완료`;
      } else {
        resultEl.textContent = "이 환경에서는 자동 복사를 지원하지 않습니다. 직접 선택해 복사해주세요.";
      }
    } catch (error) {
      resultEl.textContent = "복사에 실패했습니다. 직접 선택해 복사해주세요.";
    }
  }

  function withSelectedPost(resultEl, handler) {
    const post = getSelectedPost();
    if (!post) {
      resultEl.textContent = "게시글을 먼저 선택해주세요.";
      return;
    }
    handler(post);
  }

  function handleCopyTitle() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => copyText(post.title || "", resultEl, "제목"));
  }

  function handleCopyBody() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const text = post.contentText && post.contentText.trim() ? post.contentText : stripHtml(post.contentHtmlRaw);
      copyText(text, resultEl, "본문");
    });
  }

  function handleCopyBoardCategory() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const board = getBoard(post);
      const category = getCategory(post);
      if (!board && !category) {
        resultEl.textContent = "복사할 게시판/주제분류 정보가 없습니다(metadata에 없음).";
        return;
      }
      const lines = [];
      lines.push(`게시판: ${board || EMPTY_LABEL}`);
      lines.push(`네이버 주제분류: ${category || EMPTY_LABEL}`);
      copyText(lines.join("\n"), resultEl, "게시판/주제분류");
    });
  }

  // 네이버 태그 복사 오류 수정. 복사되는 문자열은 반드시 "태그1\n태그2\n
  // 태그3"처럼 정제된 태그만 한 줄에 하나씩 담는다. "태그:"/"지역 키워드:" 같은
  // 라벨이나 "지역 키워드: 정보 없음" 같은 빈 값 줄은 절대 포함하지 않는다
  // (지역 키워드가 실제로 있을 때만 태그 뒤에 같은 방식으로 이어 붙인다).
  function handleCopyTagLocation() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const meta = getMeta(post);
      const tags = getTags(post);
      const location = getLocationKeywords(meta);
      if (!tags.length && !location.length) {
        resultEl.textContent = "복사할 태그/지역 키워드가 없습니다(metadata에 없음).";
        return;
      }
      const lines = [...tags, ...location];
      copyText(lines.join("\n"), resultEl, "태그/지역");
    });
  }

  function handleCopyLinks() {
    const { resultEl } = els();
    withSelectedPost(resultEl, (post) => {
      const links = getOfficialLinks(getMeta(post));
      if (!links.length) {
        resultEl.textContent = "복사할 공식 링크가 없습니다(metadata에 없음).";
        return;
      }
      const text = links.map((link) => (link.name ? `${link.name}: ${link.url}` : link.url)).join("\n");
      copyText(text, resultEl, "공식 링크");
    });
  }

  // post.imageFiles({ baseNameLower: { fileName, dataUrl, role, ... } })에서
  // role 기준(썸네일 → 본문 이미지 번호 순)으로 정렬한다. 이는 upload-module.js가
  // ZIP 내부 파일명 매칭 순서로 이미 분류해둔 값이라 별도 재파싱 없이 그대로
  // "ZIP 내부 매칭 순서" 기준을 만족한다. thumbnail/body- 외의 이미지(extra)는
  // 이미지 목록 팝업 대상에서 제외한다(썸네일/본문 설명 이미지만 노출).
  function getOrderedImages(post) {
    const files = (post && post.imageFiles) || {};
    const list = Object.values(files).filter((img) => img && (img.role === "thumbnail" || /^body-\d+$/.test(img.role)));

    list.sort((a, b) => {
      if (a.role === "thumbnail" && b.role !== "thumbnail") return -1;
      if (b.role === "thumbnail" && a.role !== "thumbnail") return 1;
      if (a.role === "thumbnail" && b.role === "thumbnail") return 0;
      const aNum = parseInt(a.role.slice(5), 10) || 0;
      const bNum = parseInt(b.role.slice(5), 10) || 0;
      return aNum - bNum;
    });

    let bodyIndex = 0;
    return list.map((img) => {
      let label;
      if (img.role === "thumbnail") {
        label = "썸네일 미리보기";
      } else {
        bodyIndex += 1;
        label = `본문 이미지 ${bodyIndex} 미리보기`;
      }
      return { label, dataUrl: img.dataUrl, fileName: img.fileName };
    });
  }

  // [이미지 다운로드]: 새 창으로 열기만 하던 동작을 실제 파일 다운로드
  // 시도로 바꾼다. a 태그의 download 속성으로 다운로드를 시도하고, 브라우저
  // 보안 정책 등으로 막히면 새 창 열기로 대체한다(버튼명은 계속 "이미지
  // 다운로드"를 유지한다).
  function downloadImage(dataUrl, fileName) {
    if (!dataUrl) return;
    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName || "image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    } catch (error) {
      // 아래 fallback(새 창 열기)으로 진행
    }
    try {
      const win = window.open("", "_blank");
      if (win && win.document) {
        win.document.title = fileName || "이미지";
        win.document.body.style.margin = "0";
        win.document.body.style.background = "#111";
        const img = win.document.createElement("img");
        img.src = dataUrl;
        img.alt = fileName || "이미지";
        img.style.display = "block";
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.margin = "0 auto";
        win.document.body.appendChild(img);
        return;
      }
    } catch (error) {
      // 아래 최종 fallback으로 진행
    }
    window.open(dataUrl, "_blank");
  }

  function renderImageList() {
    const { bodyEl, emptyEl } = imageListEls();
    if (!bodyEl) return;

    const post = getSelectedPost();
    const images = getOrderedImages(post);

    bodyEl.innerHTML = "";

    if (!images.length) {
      if (emptyEl) emptyEl.classList.remove("hidden");
      return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    images.forEach((image) => {
      const item = document.createElement("div");
      item.className = "naver-image-item";

      const thumb = document.createElement("img");
      thumb.className = "naver-image-item__thumb";
      thumb.src = image.dataUrl;
      thumb.alt = image.label;

      const label = document.createElement("div");
      label.className = "naver-image-item__label";
      label.textContent = image.label;

      const openImgBtn = document.createElement("button");
      openImgBtn.type = "button";
      openImgBtn.className = "btn btn--ghost btn--compact naver-image-item__open-btn";
      openImgBtn.textContent = "이미지 다운로드";
      openImgBtn.addEventListener("click", () => downloadImage(image.dataUrl, image.fileName));

      const info = document.createElement("div");
      info.className = "naver-image-item__info";
      info.appendChild(label);
      info.appendChild(openImgBtn);

      item.appendChild(thumb);
      item.appendChild(info);
      bodyEl.appendChild(item);
    });
  }

  function openImageListPopup() {
    const { overlay } = imageListEls();
    if (!overlay) return;
    renderImageList();
    overlay.classList.add("popup-overlay--open");
  }

  function closeImageListPopup() {
    const { overlay } = imageListEls();
    if (!overlay) return;
    overlay.classList.remove("popup-overlay--open");
  }

  function handleLifecycle(eventName) {
    if (eventName === "post-selected") renderStatus();
  }

  function openPopup() {
    const { overlay, resultEl } = els();
    if (!overlay) return;
    if (resultEl) resultEl.textContent = "";
    renderFields();
    overlay.classList.add("popup-overlay--open");
  }

  function closePopup() {
    const { overlay } = els();
    if (!overlay) return;
    overlay.classList.remove("popup-overlay--open");
  }

  function bindEvents() {
    if (bound) return; // 중복 연결 방지

    const {
      statusEl, openBtn, closeBtn, overlay,
      titleBtn, bodyBtn, boardCategoryBtn, tagLocationBtn, linksBtn,
      resultEl,
    } = els();
    const {
      openBtn: imageListOpenBtn, closeBtn: imageListCloseBtn, overlay: imageListOverlay,
    } = imageListEls();

    // 표시 대상 DOM이 하나라도 없으면 조용히 종료(예외를 던지지 않음).
    if (!statusEl || !openBtn || !closeBtn || !overlay || !titleBtn || !bodyBtn
      || !boardCategoryBtn || !tagLocationBtn || !linksBtn || !resultEl
      || !imageListOpenBtn || !imageListCloseBtn || !imageListOverlay) {
      return;
    }

    try {
      openBtn.addEventListener("click", openPopup);
      closeBtn.addEventListener("click", closePopup);

      titleBtn.addEventListener("click", handleCopyTitle);
      bodyBtn.addEventListener("click", handleCopyBody);
      boardCategoryBtn.addEventListener("click", handleCopyBoardCategory);
      tagLocationBtn.addEventListener("click", handleCopyTagLocation);
      linksBtn.addEventListener("click", handleCopyLinks);

      imageListOpenBtn.addEventListener("click", openImageListPopup);
      imageListCloseBtn.addEventListener("click", closeImageListPopup);

      if (window.GptCoreAPI && typeof GptCoreAPI.registerLifecycleListener === "function") {
        GptCoreAPI.registerLifecycleListener("naver-copy-module", handleLifecycle);
      }

      renderStatus();
      bound = true;
    } catch (error) {
      bound = false;
    }
  }

  return { bindEvents, isReady };
})();

document.addEventListener("DOMContentLoaded", () => {
  try {
    NaverCopyModule.bindEvents();
  } catch (error) {
    // 최후의 방어선: 실패해도 조용히 무시한다(다른 기본 기능/Blogger 저장 흐름에는 영향 없음).
  }
});
