/**
 * error-log-module.js
 * 오류 발생 기록 및 조회 모듈
 */

const ErrorLogModule = (() => {
  const LS_KEY_ERRORS = "gpt_gongjakso_errors";

  function generateId() {
    return "err_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  function readErrors() {
    try {
      const raw = localStorage.getItem(LS_KEY_ERRORS);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function writeErrors(errors) {
    try {
      localStorage.setItem(LS_KEY_ERRORS, JSON.stringify(errors));
    } catch (error) {
      // localStorage 자체가 불가한 경우 조용히 무시 (오류 기록 실패는 화면을 막지 않음)
    }
  }

  function logError({ module, message, detail, relatedId }) {
    const errors = readErrors();
    const entry = {
      id: generateId(),
      module: module || "unknown",
      message: message || "알 수 없는 오류",
      detail: detail || "",
      relatedId: relatedId || null,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    errors.push(entry);
    writeErrors(errors);
    return entry;
  }

  function getAllErrors() {
    return readErrors();
  }

  function resolveError(id) {
    const errors = readErrors();
    const idx = errors.findIndex((e) => e.id === id);
    if (idx >= 0) {
      errors[idx].resolved = true;
      writeErrors(errors);
      return true;
    }
    return false;
  }

  // v1.3: 설정창 "오류 초기화" 버튼에서 사용. 기존 기록 구조(readErrors/writeErrors)를
  // 그대로 사용하며, 오류 기록 자체를 비우기만 한다(다른 로직 변경 없음).
  function clearErrors() {
    writeErrors([]);
    return true;
  }

  function getUserMessage(entry) {
    return `[${entry.module}] ${entry.message}`;
  }

  return {
    logError,
    getAllErrors,
    resolveError,
    clearErrors,
    getUserMessage,
  };
})();
