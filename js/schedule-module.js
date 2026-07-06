/**
 * schedule-module.js
 * 예약발행 정보 저장/관리 모듈
 *
 * 주의:
 * - 브라우저가 꺼져 있어도 자동 발행되는 서버형 예약발행은 이번 Phase에서 구현하지 않는다.
 * - 이번 Phase의 예약발행은 "예약 정보 저장/관리" 수준까지만 다룬다.
 *   실제 자동 발행은 추후 서버/Worker 연동 단계에서 별도 개발한다.
 */

const ScheduleModule = (() => {
  const LEGACY_STATUS_MAP = {
    draft: "작성중",
    published: "발행완료",
    scheduled: "예약됨",
    error: "오류",
  };

  // 예약 가능한 상태값: 발행대기, 또는 검수중(별도로 SEO 통과 조건과 함께 확인됨)
  const ALLOWED_SCHEDULE_STATUS = ["발행대기", "검수중"];

  let currentPost = null;

  function normalizeStatus(status) {
    return LEGACY_STATUS_MAP[status] || status;
  }

  function loadPost(post) {
    currentPost = post;
    if (currentPost && !currentPost.scheduleInfo) {
      currentPost.scheduleInfo = {
        scheduledAt: null,
        canceledAt: null,
        previousStatus: null,
      };
    }
    return currentPost;
  }

  function getCurrentPost() {
    return currentPost;
  }

  function getScheduleStatusText() {
    if (!currentPost) return "-";
    const info = currentPost.scheduleInfo;
    if (!info || !info.scheduledAt) return "예약 없음";
    const isPast = new Date(info.scheduledAt).getTime() < Date.now();
    return isPast ? "예약됨 (예약 시간 지남)" : "예약됨";
  }

  function checkScheduleReadiness() {
    if (!currentPost) {
      return { canSchedule: false, reasons: ["선택된 글이 없습니다."] };
    }

    const reasons = [];

    const titleOk = !!(currentPost.title && currentPost.title.trim());
    if (!titleOk) reasons.push("제목이 없습니다.");

    const htmlOk = !!(currentPost.htmlContent && currentPost.htmlContent.trim());
    if (!htmlOk) reasons.push("HTML 본문이 없습니다.");

    const seoOk = !!(currentPost.seoResult && currentPost.seoResult.result === "통과");
    if (!seoOk) reasons.push("SEO 검수를 통과하지 못했습니다.");

    const normalizedStatus = normalizeStatus(currentPost.status);
    const statusOk = ALLOWED_SCHEDULE_STATUS.includes(normalizedStatus);
    if (!statusOk) reasons.push(`현재 상태(${currentPost.status})에서는 예약할 수 없습니다.`);

    return {
      canSchedule: titleOk && htmlOk && seoOk && statusOk,
      titleOk,
      htmlOk,
      seoOk,
      statusOk,
      reasons,
    };
  }

  async function saveSchedule(rawValue) {
    if (!currentPost) {
      return { success: false, reasons: ["선택된 글이 없습니다."] };
    }

    if (!rawValue) {
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "예약일시 누락",
        detail: "예약일시 입력값 없음",
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["예약일시를 입력해주세요."] };
    }

    const parsed = new Date(rawValue);
    if (isNaN(parsed.getTime())) {
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "예약일시 형식 오류",
        detail: `입력값: ${rawValue}`,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["예약일시 형식이 올바르지 않습니다."] };
    }

    const readiness = checkScheduleReadiness();
    if (!readiness.canSchedule) {
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "예약 조건 미충족",
        detail: readiness.reasons.join(" / "),
        relatedId: currentPost.id,
      });
      return { success: false, reasons: readiness.reasons };
    }

    const previousScheduleInfo = currentPost.scheduleInfo ? { ...currentPost.scheduleInfo } : null;
    const previousStatusValue = currentPost.status;

    currentPost.scheduleInfo = {
      scheduledAt: parsed.toISOString(),
      canceledAt: null,
      previousStatus: normalizeStatus(currentPost.status),
    };
    currentPost.status = "예약됨";
    currentPost.updatedAt = new Date().toISOString();

    try {
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (error) {
      currentPost.scheduleInfo = previousScheduleInfo;
      currentPost.status = previousStatusValue;
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "발행 결과 저장 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["저장에 실패했습니다."] };
    }
  }

  async function cancelSchedule() {
    if (!currentPost) {
      return { success: false, reasons: ["선택된 글이 없습니다."] };
    }

    if (!currentPost.scheduleInfo || !currentPost.scheduleInfo.scheduledAt) {
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "예약 취소 실패",
        detail: "취소할 예약 정보가 없음",
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["취소할 예약이 없습니다."] };
    }

    const previousScheduleInfo = { ...currentPost.scheduleInfo };
    const previousStatusValue = currentPost.status;
    const restoreStatus = normalizeStatus(currentPost.scheduleInfo.previousStatus) || "발행대기";

    currentPost.scheduleInfo.canceledAt = new Date().toISOString();
    currentPost.scheduleInfo.scheduledAt = null;
    currentPost.status = restoreStatus;
    currentPost.updatedAt = new Date().toISOString();

    try {
      await StorageModule.savePost(currentPost);
      await ArchiveModule.loadPosts();
      return { success: true, post: currentPost };
    } catch (error) {
      currentPost.scheduleInfo = previousScheduleInfo;
      currentPost.status = previousStatusValue;
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "예약 취소 실패",
        detail: error.message,
        relatedId: currentPost.id,
      });
      return { success: false, reasons: ["예약 취소에 실패했습니다."] };
    }
  }

  async function getAllScheduleEntries() {
    try {
      const posts = await StorageModule.getAllPosts();
      const now = Date.now();
      return posts
        .filter((p) => p.scheduleInfo && p.scheduleInfo.scheduledAt && !p.scheduleInfo.canceledAt)
        .map((p) => ({
          id: p.id,
          title: p.title || "(제목 없음)",
          scheduledAt: p.scheduleInfo.scheduledAt,
          isPast: new Date(p.scheduleInfo.scheduledAt).getTime() < now,
        }))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    } catch (error) {
      ErrorLogModule.logError({
        module: "schedule-module",
        message: "예약 목록 조회 실패",
        detail: error.message,
        relatedId: null,
      });
      return [];
    }
  }

  return {
    loadPost,
    getCurrentPost,
    getScheduleStatusText,
    saveSchedule,
    cancelSchedule,
    getAllScheduleEntries,
  };
})();
