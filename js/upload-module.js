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
 *
 * 카테고리별 TOP1 전체 묶음 ZIP 인식(신규): 최상위에 category_top1_zips/
 * 폴더(또는 0N_..._TOP1.zip 형태의 파일명)가 있으면 "전체 묶음 ZIP"으로 보고,
 * 안에 든 개별 ZIP 9개를 각각 기존 단일 ZIP과 동일한 방식으로 다시 파싱한다.
 * 단일 ZIP 업로드 경로(scanEntries 호출 이후 처리)는 이 기능 추가 전과 완전히
 * 동일하게 동작한다(분기만 추가, 기존 로직 자체는 옮기기만 했다).
 */

const UploadModule = (() => {
  const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;
  const THUMBNAIL_RE = /^thumbnail\.(png|jpe?g|webp)$/i;
  const BODY_RE = /^body-(\d+)\.(png|jpe?g|webp)$/i;
  // v7.0 업로드 ZIP 구조 인식 보정(작업지침서 4-4): 아래는 전부 선택 항목이다.
  // 없어도 기존 필수 파일(metadata.json/content.html) 검증에는 영향을 주지 않는다.
  const TOP5_CANDIDATE_RE = /^0([1-5])_candidate\.md$/i;
  // 카테고리별 TOP1 전체 묶음 ZIP 인식용: 0N_..._TOP1.zip
  const CATEGORY_ZIP_RE = /^0([1-9])_.+_top1\.zip$/i;
  const CATEGORY_ORDER = {
    "01": "오늘의 핫이슈",
    "02": "돈 되는 생활정보",
    "03": "지원금·정책 알림",
    "04": "보험·병원비 체크",
    "05": "카드·금융 혜택",
    "06": "통신·구독 절약",
    "07": "자동차·교통 정보",
    "08": "공연·예매 소식",
    "09": "지역 생활정보",
  };

  let loadedZipFileName = null;
  let isMasterBundle = false;
  let masterCategoryResults = []; // [{ num, categoryName, fileName, scan }] (전체 묶음 ZIP일 때만 채움)

  // 단일 ZIP 모드 상태(전체 묶음 ZIP이 아닐 때만 채워진다). 기존 필드/동작 그대로 유지.
  let loadedMetadata = null;
  let loadedMetadataRaw = null; // 파싱 실패 여부 판단용
  let loadedHtml = null;
  let loadedMarkdown = null;
  let loadedText = null;
  let loadedSelectedTopicMd = ""; // v7.0: selected_topic.md 원문(선택 항목)
  let loadedNaverTagsTxt = ""; // v7.0: naver_tags.txt 원문(선택 항목)
  let loadedTop5SummaryMd = ""; // v7.0: top5/top5_summary.md 원문(선택 항목)
  let loadedTop5Candidates = {}; // v7.0: { "01": "...md 원문", "02": "...", ... }(선택 항목)
  let loadedImagePromptsMd = ""; // v7.0: image_prompts.md 원문(선택 항목, 썸네일 시각요소 진단용)
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

  // v7.0: naver_tags.txt에 금지된 특수문자가 있는지 검사한다(작업지침서 4-7).
  // 특수문자 정의: # , ( ) / ! ? " : ; _ 등. 빈 줄은 검사에서 제외한다.
  const NAVER_TAG_FORBIDDEN_RE = /[#,()/!?"':;_]/;

  function checkNaverTagsClean(rawText) {
    if (!rawText || !rawText.trim()) return { checked: false, clean: true, badLines: [] };
    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const badLines = lines.filter((line) => NAVER_TAG_FORBIDDEN_RE.test(line));
    return { checked: true, clean: badLines.length === 0, badLines };
  }

  // 순수 함수: zip entries 배열을 받아 파싱 결과만 반환한다(모듈 상태를 건드리지
  // 않음). 단일 ZIP 업로드와 전체 묶음 ZIP 내부의 개별 ZIP 9개가 이 함수를
  // 그대로 공유해서 쓴다(로직 중복 없음).
  function scanEntries(entries) {
    let metadataEntry = null;
    let htmlEntry = null;
    let markdownEntry = null;
    let textEntry = null;
    let selectedTopicEntry = null;
    let naverTagsEntry = null;
    let top5SummaryEntry = null;
    let imagePromptsEntry = null;
    const top5CandidateEntries = {}; // { "01": entry, ... }
    const scannedImageFiles = {};

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
      // v7.0: selected_topic.md / naver_tags.txt / top5/*.md(선택 항목, 없어도 실패 아님)
      if (lower === "selected_topic.md" && !selectedTopicEntry) {
        selectedTopicEntry = entry;
        return;
      }
      if (lower === "naver_tags.txt" && !naverTagsEntry) {
        naverTagsEntry = entry;
        return;
      }
      if (lower === "top5_summary.md" && !top5SummaryEntry) {
        top5SummaryEntry = entry;
        return;
      }
      if (lower === "image_prompts.md" && !imagePromptsEntry) {
        imagePromptsEntry = entry;
        return;
      }
      const top5Match = lower.match(TOP5_CANDIDATE_RE);
      if (top5Match) {
        const num = top5Match[1].padStart(2, "0");
        if (!top5CandidateEntries[num]) top5CandidateEntries[num] = entry;
        return;
      }

      if (IMAGE_EXT_RE.test(lower)) {
        const extMatch = lower.match(/\.(png|jpe?g|webp)$/i);
        const ext = extMatch[1];
        // 같은 파일명이 루트와 images/ 폴더 양쪽에 있으면 먼저 발견된 것을 유지한다
        // (본문 내용은 동일한 것이 보통이므로 중복 여부는 문제되지 않는다).
        if (!scannedImageFiles[lower]) {
          scannedImageFiles[lower] = {
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
      return { success: false, reason: "ZIP 안에서 metadata.json을 찾을 수 없습니다." };
    }

    let metadataRaw;
    let metadata;
    try {
      metadataRaw = MiniZip.bytesToText(metadataEntry.dataBytes);
      metadata = JSON.parse(metadataRaw);
    } catch (error) {
      return { success: false, reason: "metadata.json을 읽을 수 없습니다(형식 오류).", errorDetail: error.message };
    }

    if (!htmlEntry) {
      return { success: false, reason: "ZIP 안에서 content.html을 찾을 수 없습니다." };
    }

    let html;
    try {
      html = MiniZip.bytesToText(htmlEntry.dataBytes);
    } catch (error) {
      return { success: false, reason: "content.html을 읽을 수 없습니다.", errorDetail: error.message };
    }

    const markdown = markdownEntry ? MiniZip.bytesToText(markdownEntry.dataBytes) : "";
    const text = textEntry ? MiniZip.bytesToText(textEntry.dataBytes) : "";

    // v7.0 추가 선택 항목 읽기(작업지침서 4-4/4-6/4-7). 읽기 실패해도 필수 흐름을
    // 막지 않도록 각각 try/catch로 감싸고, 실패 시 빈 값으로만 남긴다.
    let selectedTopicMd = "";
    try {
      selectedTopicMd = selectedTopicEntry ? MiniZip.bytesToText(selectedTopicEntry.dataBytes) : "";
    } catch (error) {
      selectedTopicMd = "";
    }
    let naverTagsTxt = "";
    try {
      naverTagsTxt = naverTagsEntry ? MiniZip.bytesToText(naverTagsEntry.dataBytes) : "";
    } catch (error) {
      naverTagsTxt = "";
    }
    let top5SummaryMd = "";
    try {
      top5SummaryMd = top5SummaryEntry ? MiniZip.bytesToText(top5SummaryEntry.dataBytes) : "";
    } catch (error) {
      top5SummaryMd = "";
    }
    let imagePromptsMd = "";
    try {
      imagePromptsMd = imagePromptsEntry ? MiniZip.bytesToText(imagePromptsEntry.dataBytes) : "";
    } catch (error) {
      imagePromptsMd = "";
    }
    const top5Candidates = {};
    Object.keys(top5CandidateEntries).forEach((num) => {
      try {
        top5Candidates[num] = MiniZip.bytesToText(top5CandidateEntries[num].dataBytes);
      } catch (error) {
        // 개별 후보 파일 하나가 읽기 실패해도 다른 후보/필수 흐름에는 영향 없음.
      }
    });

    return {
      success: true,
      reason: null,
      metadata,
      html,
      markdown,
      text,
      selectedTopicMd,
      naverTagsTxt,
      top5SummaryMd,
      top5Candidates,
      imagePromptsMd,
      imageFiles: scannedImageFiles,
    };
  }

  // entries 안에서 "0N_..._TOP1.zip" 형태의 파일을 찾아 카테고리 순서(01~09)
  // 기준으로 정렬해 반환한다. 폴더 경로(category_top1_zips/)는 파일명 패턴만
  // 맞으면 어디에 있어도 인식한다(다른 파일 인식과 동일하게 basename 기준).
  function findCategoryZipEntries(entries) {
    const found = [];
    entries.forEach((entry) => {
      if (entry.isDirectory) return;
      const baseName = entry.name.split("/").pop();
      if (!baseName) return;
      if (baseName.charAt(0) === ".") return;
      if (entry.name.indexOf("__MACOSX") !== -1) return;
      const lower = baseName.toLowerCase();
      const match = lower.match(CATEGORY_ZIP_RE);
      if (!match) return;
      const num = match[1].padStart(2, "0");
      found.push({ num, fileName: baseName, entry });
    });
    found.sort((a, b) => a.num.localeCompare(b.num));
    return found;
  }

  // 압축을 푼 zip entry의 dataBytes(Uint8Array, 원본 버퍼의 일부일 수 있음)를
  // 안전하게 독립된 ArrayBuffer로 복사한다(MiniZip.load는 자기 자신의 EOCD를
  // 파일 끝에서부터 찾으므로, 원본 버퍼를 그대로 넘기면 잘못된 위치를 찾는다).
  function entryBytesToOwnBuffer(dataBytes) {
    return dataBytes.slice().buffer;
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

    // 카테고리별 TOP1 전체 묶음 ZIP 인식(신규): 0N_..._TOP1.zip 형태의 파일이
    // 하나라도 있으면 전체 묶음 ZIP으로 본다. 기존 단일 ZIP(metadata.json이
    // 최상위에 있는 구조)에는 이런 이름의 파일이 있을 수 없으므로 오인식 위험이 낮다.
    const categoryZipEntries = findCategoryZipEntries(entries);

    if (categoryZipEntries.length > 0) {
      isMasterBundle = true;
      masterCategoryResults = [];

      for (const item of categoryZipEntries) {
        let scan;
        try {
          const innerBuffer = entryBytesToOwnBuffer(item.entry.dataBytes);
          const innerEntries = await MiniZip.load(innerBuffer);
          scan = scanEntries(innerEntries);
        } catch (error) {
          scan = { success: false, reason: "개별 ZIP을 열 수 없습니다.", errorDetail: error.message };
        }
        masterCategoryResults.push({
          num: item.num,
          categoryName: CATEGORY_ORDER[item.num] || `카테고리 ${item.num}`,
          fileName: item.fileName,
          scan,
        });
      }

      const successCount = masterCategoryResults.filter((r) => r.scan.success).length;
      requiredFilesOk = successCount > 0;
      failReason = successCount > 0 ? null : "전체 묶음 ZIP 안에서 정상적으로 열리는 개별 ZIP을 하나도 찾지 못했습니다.";

      if (!requiredFilesOk) {
        ErrorLogModule.logError({
          module: "upload-module",
          message: "전체 묶음 ZIP 처리 실패",
          detail: failReason,
          relatedId: null,
        });
        return { success: false, reason: failReason, isMasterBundle: true, categoryCount: masterCategoryResults.length, successCount };
      }

      return { success: true, isMasterBundle: true, categoryCount: masterCategoryResults.length, successCount };
    }

    // 기존 단일 ZIP 흐름(전체 묶음 ZIP이 아닐 때) — scanEntries 도입 전과 동일한 동작.
    isMasterBundle = false;
    const scan = scanEntries(entries);

    if (!scan.success) {
      failReason = scan.reason;
      ErrorLogModule.logError({
        module: "upload-module",
        message: scan.reason && scan.reason.indexOf("찾을 수 없습니다") !== -1 ? "필수 파일 누락" : "ZIP 파싱 실패",
        detail: scan.errorDetail || scan.reason,
        relatedId: null,
      });
      return { success: false, reason: failReason };
    }

    loadedMetadata = scan.metadata;
    loadedHtml = scan.html;
    loadedMarkdown = scan.markdown;
    loadedText = scan.text;
    loadedSelectedTopicMd = scan.selectedTopicMd;
    loadedNaverTagsTxt = scan.naverTagsTxt;
    loadedTop5SummaryMd = scan.top5SummaryMd;
    loadedTop5Candidates = scan.top5Candidates;
    loadedImagePromptsMd = scan.imagePromptsMd;
    imageFiles = scan.imageFiles;

    requiredFilesOk = true;
    failReason = null;
    return { success: true, isMasterBundle: false };
  }

  function buildScanChecklist(scan, imgFiles) {
    const bodyCount = Object.values(imgFiles).filter((img) => img.role.indexOf("body-") === 0).length;
    const hasThumbnail = Object.values(imgFiles).some((img) => img.role === "thumbnail");
    const top5Count = Object.keys(scan.top5Candidates || {}).length;
    const naverTagsCheck = checkNaverTagsClean(scan.naverTagsTxt);

    return [
      { label: "metadata.json", ok: !!scan.metadata },
      { label: "content.html", ok: !!scan.html },
      { label: "content.md", ok: !!(scan.markdown && scan.markdown.trim()), optional: true },
      { label: "content.txt", ok: !!(scan.text && scan.text.trim()), optional: true },
      { label: "썸네일 이미지", ok: hasThumbnail, optional: true },
      { label: `본문 이미지 (${bodyCount}개 인식)`, ok: bodyCount > 0, optional: true },
      { label: `TOP5 개별 파일 (${top5Count}/5개 인식)`, ok: top5Count >= 5, optional: true },
      { label: "top5/top5_summary.md", ok: !!(scan.top5SummaryMd && scan.top5SummaryMd.trim()), optional: true },
      { label: "selected_topic.md", ok: !!(scan.selectedTopicMd && scan.selectedTopicMd.trim()), optional: true },
      {
        label: naverTagsCheck.checked
          ? (naverTagsCheck.clean ? "naver_tags.txt(네이버 태그: 통과)" : "naver_tags.txt(네이버 태그: 특수문자 포함 — 수정 필요)")
          : "naver_tags.txt",
        ok: naverTagsCheck.checked ? naverTagsCheck.clean : !!(scan.naverTagsTxt && scan.naverTagsTxt.trim()),
        optional: true,
      },
    ];
  }

  function getCheckStatus() {
    if (isMasterBundle) {
      // 전체 묶음 ZIP: 카테고리별로 각각의 체크리스트를 돌려준다. 화면(신규 UI)에서
      // 9개를 나열해서 보여줄 수 있게 원자료를 그대로 제공한다.
      return {
        isMasterBundle: true,
        requiredFilesOk,
        failReason,
        zipFileName: loadedZipFileName,
        categoryCount: masterCategoryResults.length,
        categoryResults: masterCategoryResults.map((r) => ({
          num: r.num,
          categoryName: r.categoryName,
          fileName: r.fileName,
          ok: r.scan.success,
          reason: r.scan.success ? null : r.scan.reason,
          title: r.scan.success ? (r.scan.metadata && r.scan.metadata.title) || "" : "",
          checklist: r.scan.success ? buildScanChecklist(r.scan, r.scan.imageFiles) : [],
        })),
      };
    }

    const unresolved = requiredFilesOk
      ? PreviewModule.findUnresolvedImageRefs(loadedHtml, imageFiles)
      : [];

    const scanShape = {
      metadata: loadedMetadata,
      html: loadedHtml,
      markdown: loadedMarkdown,
      text: loadedText,
      top5Candidates: loadedTop5Candidates,
      top5SummaryMd: loadedTop5SummaryMd,
      selectedTopicMd: loadedSelectedTopicMd,
      naverTagsTxt: loadedNaverTagsTxt,
    };
    const checklist = requiredFilesOk
      ? [{ label: "ZIP 열기", ok: true }, ...buildScanChecklist(scanShape, imageFiles)]
      : [{ label: "ZIP 열기", ok: !!loadedZipFileName }];

    return {
      isMasterBundle: false,
      requiredFilesOk,
      failReason,
      zipFileName: loadedZipFileName,
      checklist,
      unresolvedImageRefs: unresolved,
      top5CandidateCount: Object.keys(loadedTop5Candidates).length,
      naverTagsCheck: checkNaverTagsClean(loadedNaverTagsTxt),
    };
  }

  function buildFallbackTitle(nameHint) {
    const source = nameHint || loadedZipFileName;
    if (source) return source.replace(/\.[^/.]+$/, "");
    return "제목 없음";
  }

  function postFromScan(scan, nameHint, extra) {
    const meta = scan.metadata || {};
    const title = meta.title || buildFallbackTitle(nameHint);
    const now = new Date().toISOString();

    return Object.assign(
      {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        title,
        metadata: meta,
        contentHtmlRaw: scan.html || "",
        contentMd: scan.markdown || "",
        contentText: scan.text || "",
        zipFileName: nameHint || "",
        imageFiles: { ...(scan.imageFiles || {}) },
        previewHtml: null,
        saveStatus: "등록됨",
        r2ImageMap: null,
        bloggerDraftResult: null,
        selectedTopicMd: scan.selectedTopicMd || "",
        naverTagsTxt: scan.naverTagsTxt || "",
        top5SummaryMd: scan.top5SummaryMd || "",
        top5Candidates: { ...(scan.top5Candidates || {}) },
        imagePromptsMd: scan.imagePromptsMd || "",
      },
      extra || {}
    );
  }

  function buildPost() {
    if (isMasterBundle || !requiredFilesOk) return null;

    return postFromScan(
      {
        metadata: loadedMetadata,
        html: loadedHtml,
        markdown: loadedMarkdown,
        text: loadedText,
        selectedTopicMd: loadedSelectedTopicMd,
        naverTagsTxt: loadedNaverTagsTxt,
        top5SummaryMd: loadedTop5SummaryMd,
        top5Candidates: loadedTop5Candidates,
        imagePromptsMd: loadedImagePromptsMd,
        imageFiles,
      },
      loadedZipFileName
    );
  }

  // 전체 묶음 ZIP 전용: 성공적으로 인식된 카테고리 개수만큼 post 배열을 만든다.
  // 각 post는 buildPost()가 만드는 것과 같은 필드 구성에 category/categoryNum/
  // sourceZipFileName만 추가된다(app-core.js/library-module.js는 이 필드를
  // 기존 post 저장 로직에 그대로 통과시키면 된다 — 별도 저장 스키마 변경 없음).
  function buildCategoryPosts() {
    if (!isMasterBundle || !requiredFilesOk) return null;

    return masterCategoryResults
      .filter((r) => r.scan.success)
      .map((r) =>
        postFromScan(r.scan, r.fileName, {
          category: r.categoryName,
          categoryNum: r.num,
          sourceZipFileName: loadedZipFileName || "",
        })
      );
  }

  function reset() {
    loadedZipFileName = null;
    isMasterBundle = false;
    masterCategoryResults = [];
    loadedMetadata = null;
    loadedMetadataRaw = null;
    loadedHtml = null;
    loadedMarkdown = null;
    loadedText = null;
    loadedSelectedTopicMd = "";
    loadedNaverTagsTxt = "";
    loadedTop5SummaryMd = "";
    loadedTop5Candidates = {};
    loadedImagePromptsMd = "";
    imageFiles = {};
    requiredFilesOk = false;
    failReason = null;
  }

  return {
    setZipFile,
    getCheckStatus,
    buildPost,
    buildCategoryPosts,
    reset,
  };
})();
