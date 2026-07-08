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

  // code는 선택 항목이다(예: "E-UPLOAD-001"). 기존 호출부(module/message/detail/
  // relatedId만 넘기는 코드)는 code가 없어도 그대로 동작한다 — 하위 호환 유지.
  function logError({ module, message, detail, relatedId, code }) {
    const errors = readErrors();
    const entry = {
      id: generateId(),
      module: module || "unknown",
      message: message || "알 수 없는 오류",
      detail: detail || "",
      relatedId: relatedId || null,
      code: code || null,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    errors.push(entry);
    writeErrors(errors);
    return entry;
  }

  // v1.4: safeInit() 등 신규 모듈 초기화 실패를 간단히 기록하기 위한 편의 함수.
  // logError({module, message, detail})의 얇은 래퍼일 뿐, 기존 저장 구조/로직은
  // 그대로 사용한다(재작성 없음).
  function log(moduleName, err) {
    return logError({
      module: moduleName || "unknown",
      message: "모듈 처리 중 오류가 발생했습니다",
      detail: err && err.message ? err.message : String(err || ""),
      relatedId: null,
    });
  }

  function getAllErrors() {
    return readErrors();
  }

  // v1.4: error-dictionary-module.js가 특정 에러코드에 해당하는 최근 기록을 찾을 때 사용.
  // code가 없는(v1.3 이전) 기존 기록은 단순히 대상에서 제외될 뿐, 조회 자체는 안전하다.
  function getErrorsByCode(code) {
    if (!code) return [];
    return readErrors().filter((e) => e.code === code);
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
    log,
    getAllErrors,
    getErrorsByCode,
    resolveError,
    clearErrors,
    getUserMessage,
  };
})();
