/**
 * auth-module.js
 * 암호 로그인 / 세션 관리 모듈
 *
 * 출처: WP 0.0.10 assets/js/wp/auth/auth-session.js 의 핵심 로직(암호 입력 →
 * Worker 로그인 호출 → 세션 토큰 저장 → 실패/만료 처리)만 GPT 공작소 구조에 맞게
 * 이식했다. WP의 화면명/변수명/문구는 사용하지 않는다.
 *
 * 보안 원칙:
 * - Worker 관리자 비밀번호, API Key, Client Secret, Refresh Token은 이 파일에 두지 않는다.
 * - 세션 토큰은 sessionStorage에만 저장하며(localStorage 사용 안 함), 브라우저 세션 동안만 유지된다.
 */

const WORKER_BASE_URL = "https://wooow.qudrnr84.workers.dev";
const SESSION_TOKEN_KEY = "gongjakso_session_token";

const AuthModule = (() => {
  let onLoginSuccess = null;
  let onLogout = null;

  function setOnLoginSuccess(fn) {
    onLoginSuccess = fn;
  }

  function setOnLogout(fn) {
    onLogout = fn;
  }

  function getToken() {
    try {
      return sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function saveToken(token) {
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch (error) {
      ErrorLogModule.logError({
        module: "auth-module",
        message: "세션 저장 실패",
        detail: error.message,
        relatedId: null,
      });
    }
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch (error) {
      // sessionStorage 접근 불가 시에도 로그인 화면 전환은 계속 진행한다.
    }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function showLoginScreen() {
    document.getElementById("screen-login").classList.remove("hidden");
    document.getElementById("app-container").classList.add("hidden");
  }

  function showAppScreen() {
    document.getElementById("screen-login").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
  }

  function logout() {
    clearToken();
    showLoginScreen();
    if (typeof onLogout === "function") onLogout();
  }

  // Worker에서 401(세션 만료/미인증)을 받았을 때 worker-api-module.js가 호출한다.
  function handleUnauthorized() {
    logout();
  }

  async function handleLogin() {
    const pwInput = document.getElementById("login-password");
    const errorBox = document.getElementById("login-error");
    const loginBtn = document.getElementById("login-btn");
    if (!pwInput || !errorBox || !loginBtn) return;

    const originalLabel = loginBtn.textContent;
    const password = pwInput.value.trim();

    errorBox.textContent = "";
    errorBox.classList.add("hidden");

    if (!password) {
      errorBox.textContent = "비밀번호를 입력해주세요.";
      errorBox.classList.remove("hidden");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "확인 중...";

    try {
      const response = await fetch(WORKER_BASE_URL + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (response.ok && data && data.ok && data.token) {
        saveToken(data.token);
        pwInput.value = "";
        errorBox.classList.add("hidden");
        showAppScreen();
        if (typeof onLoginSuccess === "function") await onLoginSuccess();
      } else {
        ErrorLogModule.logError({
          module: "auth-module",
          message: "로그인 실패",
          detail: `HTTP ${response.status}`,
          relatedId: null,
        });
        errorBox.textContent = "비밀번호가 올바르지 않습니다.";
        errorBox.classList.remove("hidden");
      }
    } catch (networkError) {
      ErrorLogModule.logError({
        module: "auth-module",
        message: "로그인 연결 오류",
        detail: networkError.message,
        relatedId: null,
      });
      errorBox.textContent = "연결 오류. 다시 시도해주세요.";
      errorBox.classList.remove("hidden");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = originalLabel;
    }
  }

  function bindEvents() {
    document.getElementById("login-btn").addEventListener("click", handleLogin);
    document.getElementById("login-password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
  }

  return {
    bindEvents,
    isLoggedIn,
    getToken,
    showLoginScreen,
    showAppScreen,
    logout,
    handleUnauthorized,
    setOnLoginSuccess,
    setOnLogout,
  };
})();
