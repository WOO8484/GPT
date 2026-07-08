/**
 * r2-image-module.js
 * ZIP 내부 이미지(dataUrl) → Blob 변환 → Worker /images/upload로 R2 업로드
 *
 * 작업지침서 2-3 / 9-3 확정값:
 *   Worker endpoint: POST {WORKER_BASE_URL}/images/upload
 *   인증: Authorization: Bearer <session token>
 *   multipart 필드: file, slug, role
 *   성공 응답: { ok, message, key, url, contentType, size }
 *
 * 작업지침서 9-2 확정 기준:
 *   PNG/JPG/JPEG만 Blogger 최종 저장용으로 사용한다.
 *   WEBP는 브라우저 canvas로 JPG 변환 후 업로드하며, 변환 실패 시 저장을 중단한다.
 */

const R2ImageModule = (() => {
  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  // WEBP Blob → JPEG Blob (브라우저 canvas 변환). 같은 문서 내 Blob URL이므로
  // CORS 문제 없이 항상 동작한다.
  function convertToJpeg(blob) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (jpegBlob) => {
              URL.revokeObjectURL(objectUrl);
              if (jpegBlob) resolve(jpegBlob);
              else reject(new Error("WEBP 변환 실패"));
            },
            "image/jpeg",
            0.92
          );
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("WEBP 변환 실패"));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("WEBP 변환 실패"));
      };

      img.src = objectUrl;
    });
  }

  /**
   * imageEntry: { fileName, dataUrl, mimeType, ext, role }
   * slug: 자료실 항목 id (또는 metadata.slug)
   * 반환: { ok, url, key, contentType, size, error }
   */
  async function uploadImage(imageEntry, slug) {
    let blob;
    try {
      blob = await dataUrlToBlob(imageEntry.dataUrl);
    } catch (error) {
      return { ok: false, error: "이미지 데이터를 읽을 수 없습니다." };
    }

    let uploadBlob = blob;
    let uploadMime = imageEntry.mimeType;
    let uploadFileName = imageEntry.fileName;

    if (imageEntry.ext === "webp") {
      try {
        uploadBlob = await convertToJpeg(blob);
        uploadMime = "image/jpeg";
        uploadFileName = imageEntry.fileName.replace(/\.webp$/i, ".jpg");
      } catch (error) {
        return { ok: false, error: "WEBP 변환 실패" };
      }
    }

    const formData = new FormData();
    formData.append("file", uploadBlob, uploadFileName);
    formData.append("slug", slug || "gpt-lite");
    formData.append("role", imageEntry.role || "extra");

    const token = AuthModule.getToken();
    const headers = {};
    if (token) headers["Authorization"] = "Bearer " + token;

    let response;
    try {
      response = await fetch(getWorkerBaseUrl() + "/images/upload", {
        method: "POST",
        headers,
        body: formData,
      });
    } catch (networkError) {
      return { ok: false, error: "연결 오류. 다시 시도해주세요." };
    }

    if (response.status === 401) {
      AuthModule.handleUnauthorized();
      return { ok: false, error: "로그인이 만료되었습니다. 다시 로그인해주세요." };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok || !data || data.ok === false || !data.url) {
      const message = (data && data.message) || `이미지 업로드 실패 (HTTP ${response.status})`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      url: data.url,
      key: data.key,
      contentType: data.contentType || uploadMime,
      size: data.size,
    };
  }

  return {
    uploadImage,
  };
})();
