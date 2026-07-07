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
 *
 * v1.1 추가: Blogger 저장용 최종 HTML을 만들기 전에만 적용되는 전처리 2가지.
 * (자료실 미리보기 화면에는 영향 없음, 이미지 R2 업로드/치환 로직은 아래 그대로 유지)
 * - stripExcessiveFontSize: 원본 인라인 font-size를 제거해 Blogger 모바일 화면에서
 *   글씨가 과도하게 크거나 뭉개지는 문제를 줄인다.
 * - convertTablesToCards: 3열 이상 table을 Blogger에 안정적으로 반영되는
 *   div/h3/p 카드형 목록으로 변환한다(2열 이하 table은 그대로 둔다).
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

  // v1.1: Blogger 전송용 본문에서만 인라인 font-size를 제거한다(과도한/뭉개지는 글씨 방지).
  function stripExcessiveFontSize(html) {
    if (!html) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.body.querySelectorAll("[style]").forEach((el) => {
      const cleaned = (el.getAttribute("style") || "")
        .split(";")
        .map((rule) => rule.trim())
        .filter((rule) => rule && !/^font-size\s*:/i.test(rule))
        .join("; ");
      if (cleaned) el.setAttribute("style", cleaned + ";");
      else el.removeAttribute("style");
    });
    return doc.body.innerHTML;
  }

  // v1.1: 3열 이상 table을 카드형 목록(div/h3/p)으로 변환한다. 2열 이하 table은
  // 그대로 둔다. 셀 안의 서식/링크/이미지는 텍스트로 뭉개지 않도록 자식 노드를
  // 그대로 옮긴다.
  function convertTablesToCards(html) {
    if (!html) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const tables = [...doc.body.querySelectorAll("table")];

    tables.forEach((table) => {
      const rows = [...table.querySelectorAll("tr")];
      if (!rows.length) return;

      const maxCols = rows.reduce((max, r) => Math.max(max, r.children.length), 0);
      if (maxCols < 3) return; // 2열 이하는 변환 대상이 아니다.

      const firstRowCells = [...rows[0].children];
      const firstRowAllTh = firstRowCells.length > 0 && firstRowCells.every((c) => c.tagName === "TH");
      const headerLabels = firstRowAllTh ? firstRowCells.map((c) => c.textContent.trim()) : null;
      const bodyRows = firstRowAllTh ? rows.slice(1) : rows;

      const group = doc.createElement("div");
      group.setAttribute("style", "margin:16px 0;");

      bodyRows.forEach((row) => {
        const cells = [...row.children];
        if (!cells.length) return;

        const card = doc.createElement("div");
        card.setAttribute("style", "border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:10px;");

        const title = doc.createElement("h3");
        title.setAttribute("style", "font-size:15px;margin:0 0 8px;");
        while (cells[0].firstChild) title.appendChild(cells[0].firstChild);
        card.appendChild(title);

        for (let i = 1; i < cells.length; i++) {
          const p = doc.createElement("p");
          p.setAttribute("style", "margin:4px 0;font-size:14px;line-height:1.6;");
          const label = headerLabels && headerLabels[i] ? headerLabels[i] : null;
          if (label) {
            const strong = doc.createElement("strong");
            strong.textContent = label + ": ";
            p.appendChild(strong);
          }
          while (cells[i].firstChild) p.appendChild(cells[i].firstChild);
          card.appendChild(p);
        }

        group.appendChild(card);
      });

      table.replaceWith(group);
    });

    return doc.body.innerHTML;
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
    const fontFixedHtml = stripExcessiveFontSize(rawHtml);
    const cardifiedHtml = convertTablesToCards(fontFixedHtml);
    const safeHtml = PreviewModule.sanitizeHtml(cardifiedHtml);
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
