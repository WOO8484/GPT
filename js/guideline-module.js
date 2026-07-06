/**
 * guideline-module.js
 * 블로그 지시서(GPT 블로그자료 생성용 요청 문구) 관리 모듈
 *
 * repair2 신규 기능. OpenAI API를 자동 호출하지 않으며, 단순 텍스트 저장/복사 보조 기능이다.
 * 저장은 기존 저장 우선순위(IndexedDB/localStorage) 중 텍스트 데이터에 적합한 localStorage를 사용한다.
 */

const GuidelineModule = (() => {
  const STORAGE_KEY = "gongjakso_gpt_guideline";

  const DEFAULT_GUIDELINE_TEXT =
    "GPT 공작소 블로그 자료 패키지를 생성해줘.\n" +
    "다음 형식의 ZIP 자료 패키지를 만들어줘:\n" +
    "- metadata.json (title, keyword, tags, metaDescription, faqList 포함)\n" +
    "- content.html / content.md / content.txt\n" +
    "- thumbnail.png, body-01.png, body-02.png, body-03.png\n" +
    "SEO 기준(제목 길이, 메타설명, H2/H3, 내부/외부링크, FAQ, 태그)을 충족하도록 작성해줘.";

  function getGuidelineText() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && stored.trim() ? stored : DEFAULT_GUIDELINE_TEXT;
    } catch (error) {
      ErrorLogModule.logError({
        module: "guideline-module",
        message: "지시서 불러오기 실패",
        detail: error.message,
        relatedId: null,
      });
      return DEFAULT_GUIDELINE_TEXT;
    }
  }

  function saveGuidelineText(text) {
    try {
      localStorage.setItem(STORAGE_KEY, text);
      return true;
    } catch (error) {
      ErrorLogModule.logError({
        module: "guideline-module",
        message: "지시서 저장 실패",
        detail: error.message,
        relatedId: null,
      });
      return false;
    }
  }

  function resetToDefault() {
    return saveGuidelineText(DEFAULT_GUIDELINE_TEXT);
  }

  async function copyToClipboard() {
    const text = getGuidelineText();
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      ErrorLogModule.logError({
        module: "guideline-module",
        message: "지시서 클립보드 복사 실패",
        detail: error.message,
        relatedId: null,
      });
      return { success: false };
    }
  }

  return {
    getGuidelineText,
    saveGuidelineText,
    resetToDefault,
    copyToClipboard,
  };
})();
