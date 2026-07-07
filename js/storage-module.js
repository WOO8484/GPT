/**
 * storage-module.js
 * 자료실 저장소 관리 모듈
 * 1순위: IndexedDB
 * 2순위: localStorage (IndexedDB 실패 시 자동 전환)
 *
 * 출처: GPT-main storage-module.js 이식 (DB/키 이름만 Lite 전용으로 변경)
 */

const StorageModule = (() => {
  const DB_NAME = "gpt_lite_gongjakso_db";
  const DB_VERSION = 1;
  const STORE_POSTS = "posts";
  const LS_KEY_POSTS = "gpt_lite_gongjakso_posts";

  let dbInstance = null;
  let currentMode = null; // "indexedDB" | "localStorage"

  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB 미지원 환경"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_POSTS)) {
          db.createObjectStore(STORE_POSTS, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = () => {
        reject(new Error("IndexedDB 접근 실패"));
      };
    });
  }

  async function init() {
    try {
      dbInstance = await openIndexedDB();
      currentMode = "indexedDB";
    } catch (error) {
      currentMode = "localStorage";
      ErrorLogModule.logError({
        module: "storage-module",
        message: "IndexedDB 사용 불가, localStorage로 전환",
        detail: error.message,
        relatedId: null,
      });
    }
    return currentMode;
  }

  function getMode() {
    return currentMode;
  }

  function readLocalStoragePosts() {
    try {
      const raw = localStorage.getItem(LS_KEY_POSTS);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      ErrorLogModule.logError({
        module: "storage-module",
        message: "자료실 데이터 읽기 실패",
        detail: error.message,
        relatedId: null,
      });
      return [];
    }
  }

  function writeLocalStoragePosts(posts) {
    localStorage.setItem(LS_KEY_POSTS, JSON.stringify(posts));
  }

  async function getAllPosts() {
    if (currentMode === "indexedDB") {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_POSTS, "readonly");
        const store = tx.objectStore(STORE_POSTS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return readLocalStoragePosts();
  }

  async function getPostById(id) {
    if (currentMode === "indexedDB") {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_POSTS, "readonly");
        const store = tx.objectStore(STORE_POSTS);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }
    const posts = readLocalStoragePosts();
    return posts.find((p) => p.id === id) || null;
  }

  async function savePost(post) {
    if (currentMode === "indexedDB") {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_POSTS, "readwrite");
        const store = tx.objectStore(STORE_POSTS);
        const request = store.put(post);
        request.onsuccess = () => resolve(post);
        request.onerror = () => reject(request.error);
      });
    }
    const posts = readLocalStoragePosts();
    const idx = posts.findIndex((p) => p.id === post.id);
    if (idx >= 0) {
      posts[idx] = post;
    } else {
      posts.push(post);
    }
    writeLocalStoragePosts(posts);
    return post;
  }

  async function deletePost(id) {
    if (currentMode === "indexedDB") {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_POSTS, "readwrite");
        const store = tx.objectStore(STORE_POSTS);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    }
    const posts = readLocalStoragePosts().filter((p) => p.id !== id);
    writeLocalStoragePosts(posts);
    return true;
  }

  return {
    init,
    getMode,
    getAllPosts,
    getPostById,
    savePost,
    deletePost,
  };
})();
