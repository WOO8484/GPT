/**
 * statistics-module.js
 * 통계 집계 및 전체 점검 모듈 (읽기 전용)
 *
 * 원칙:
 * - 이 모듈은 글 데이터를 수정하지 않는다(읽기 전용 집계만 수행).
 * - ArchiveModule.loadPosts() 이후 정규화(레거시 영어 상태값 보정)된 데이터를 기준으로 집계한다.
 * - 실제 외부 API(Blogger 등)를 호출하지 않으며, 현재 저장된 데이터와 모듈 상태만 확인한다.
 */

const StatisticsModule = (() => {
  // repair1: 등록완료/임시저장완료/예약저장됨(신규 상태값) 추가. 기존 값은 호환 표시를 위해 유지한다.
  const STATUS_LIST = [
    "품질검수 통과",
    "품질검수 보완필요",
    "품질검수 실패",
    "등록완료",
    "임시저장완료",
    "예약저장됨",
    "작성중",
    "검수중",
    "발행대기",
    "예약됨",
    "발행완료",
    "보류",
    "오류",
  ];
  const LEGACY_STATUS_KEYS = ["draft", "published", "scheduled", "error"];
  const RECENT_LIMIT = 10;

  function hasMissingAlt(post) {
    const imageList = Array.isArray(post.imageList) ? post.imageList : [];
    return imageList.some((img) => !img.altText || !img.altText.trim());
  }

  function hasDataUrlImage(post) {
    const imageList = Array.isArray(post.imageList) ? post.imageList : [];
    return imageList.some((img) => typeof img.dataUrl === "string" && img.dataUrl.indexOf("data:") === 0);
  }

  function hasBloggerIssue(post) {
    return !!(post.bloggerInfo && post.bloggerInfo.lastError);
  }

  function hasActiveSchedule(post) {
    return !!(post.scheduleInfo && post.scheduleInfo.scheduledAt && !post.scheduleInfo.canceledAt);
  }

  async function computeStatistics() {
    try {
      const posts = await ArchiveModule.loadPosts();

      const statusCounts = {};
      STATUS_LIST.forEach((s) => {
        statusCounts[s] = 0;
      });

      let qualityPassCount = 0;
      let bloggerIssueCount = 0;
      let imageRegisteredCount = 0;
      let altMissingCount = 0;

      posts.forEach((post) => {
        if (Object.prototype.hasOwnProperty.call(statusCounts, post.status)) {
          statusCounts[post.status] += 1;
        }

        if ((post.geminiReview && post.geminiReview.status === "통과") || post.status === "품질검수 통과") {
          qualityPassCount += 1;
        }

        if (hasBloggerIssue(post)) {
          bloggerIssueCount += 1;
        }

        const imageList = Array.isArray(post.imageList) ? post.imageList : [];
        if (imageList.length > 0) {
          imageRegisteredCount += 1;
        }

        if (hasMissingAlt(post)) {
          altMissingCount += 1;
        }
      });

      const problemPosts = posts
        .filter((post) => hasBloggerIssue(post) || hasMissingAlt(post))
        .map((post) => {
          const reasons = [];
          if (hasBloggerIssue(post)) reasons.push("Blogger 업로드 문제");
          if (hasMissingAlt(post)) reasons.push("ALT 태그 누락");
          return { id: post.id, title: post.title || "(제목 없음)", reasons };
        });

      const recentPosts = [...posts]
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, RECENT_LIMIT)
        .map((p) => ({
          id: p.id,
          title: p.title || "(제목 없음)",
          status: p.status || "-",
          updatedAt: p.updatedAt || null,
        }));

      return {
        success: true,
        totalCount: posts.length,
        statusCounts,
        qualityPassCount,
        waitingCount: statusCounts["발행대기"],
        scheduledCount: statusCounts["예약저장됨"] + statusCounts["예약됨"],
        publishedCount: statusCounts["발행완료"],
        bloggerIssueCount,
        imageRegisteredCount,
        altMissingCount,
        problemPosts,
        recentPosts,
      };
    } catch (error) {
      ErrorLogModule.logError({
        module: "statistics-module",
        message: "통계 계산 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  async function runFullCheck() {
    try {
      const posts = await ArchiveModule.loadPosts();
      const errors = ErrorLogModule.getAllErrors();
      const storageMode = StorageModule.getMode();

      let qualityPassCount = 0;
      let altMissingExists = false;
      let dataUrlImageExists = false;
      let bloggerIssueExists = false;
      let bloggerHistoryExists = false;
      let scheduledExists = false;
      let scheduleInconsistencyExists = false;
      let legacyStatusExists = false;

      posts.forEach((post) => {
        if ((post.geminiReview && post.geminiReview.status === "통과") || post.status === "품질검수 통과") qualityPassCount += 1;
        if (hasMissingAlt(post)) altMissingExists = true;
        if (hasDataUrlImage(post)) dataUrlImageExists = true;

        if (post.bloggerInfo) {
          if (post.bloggerInfo.lastError) bloggerIssueExists = true;
          if (post.bloggerInfo.bloggerPostId || post.bloggerInfo.lastError) bloggerHistoryExists = true;
        }

        const activeSchedule = hasActiveSchedule(post);
        if (activeSchedule) scheduledExists = true;
        const statusSaysScheduled = post.status === "예약저장됨" || post.status === "예약됨";
        if (activeSchedule !== statusSaysScheduled) scheduleInconsistencyExists = true;

        if (LEGACY_STATUS_KEYS.includes(post.status)) legacyStatusExists = true;
      });

      // 참고: 아래 4개 항목(레거시 상태값/ dataUrl 이미지 / Blogger 이력 / 예약 불일치)은
      // 실제 오류(저장 실패·파싱 실패·API 실패)가 아니라 전체 점검 시점의 데이터 상태 확인 결과다.
      // 같은 점검을 반복 실행해도 오류 이력에 계속 쌓이지 않도록, 아래 items 결과 표시에만 반영하고
      // ErrorLogModule에는 기록하지 않는다.

      const items = [
        {
          label: "저장소 상태",
          detail: storageMode === "indexedDB" ? "IndexedDB 사용 중" : "localStorage 사용 중 (fallback)",
          verdict: storageMode ? "통과" : "오류",
        },
        { label: "자료실 글 수", detail: `${posts.length}개`, verdict: "통과" },
        { label: "품질검수 통과 글 수", detail: `${qualityPassCount}개`, verdict: "통과" },
        {
          label: "이미지 ALT 누락 여부",
          detail: altMissingExists ? "누락된 글 있음" : "없음",
          verdict: altMissingExists ? "확인 필요" : "통과",
        },
        {
          label: "Blogger 설정/업로드 이력 존재 여부",
          detail: bloggerHistoryExists ? "이력 있음" : "이력 없음",
          verdict: bloggerIssueExists ? "확인 필요" : "통과",
        },
        {
          label: "예약 글 존재 여부",
          detail: scheduledExists ? "예약된 글 있음" : "없음",
          verdict: scheduleInconsistencyExists ? "확인 필요" : "통과",
        },
        {
          label: "오류 로그 존재 여부",
          detail: errors.length > 0 ? `${errors.length}건` : "없음",
          verdict: errors.length > 0 ? "확인 필요" : "통과",
        },
        {
          label: "상태값 영어 잔재 여부",
          detail: legacyStatusExists ? "발견됨" : "없음",
          verdict: legacyStatusExists ? "오류" : "통과",
        },
        {
          label: "dataUrl 이미지 존재 여부",
          detail: dataUrlImageExists ? "존재함 (업로드 전 변환 필요)" : "없음",
          verdict: dataUrlImageExists ? "확인 필요" : "통과",
        },
        {
          label: "현재 제한사항 안내",
          detail: "docs/KNOWN_LIMITATIONS.md 참고 (버그가 아닌 설계상 의도된 제한)",
          verdict: "통과",
        },
      ];

      return { success: true, items };
    } catch (error) {
      ErrorLogModule.logError({
        module: "statistics-module",
        message: "전체 점검 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  return {
    computeStatistics,
    runFullCheck,
  };
})();
