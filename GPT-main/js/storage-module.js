/**
 * storage-module.js
 * 저장소 관리 모듈
 * 1순위: IndexedDB
 * 2순위: localStorage (IndexedDB 실패 시 자동 전환)
 */

const StorageModule = (() => {
  const DB_NAME = "gpt_gongjakso_db";
  const DB_VERSION = 1;
  const STORE_POSTS = "posts";
  const LS_KEY_POSTS = "gpt_gongjakso_posts";

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
      ErrorLogModule.logError({
        module: "storage-module",
        message: "IndexedDB 접근 실패",
        detail: error.message,
        relatedId: null,
      });
      currentMode = "localStorage";
      ErrorLogModule.logError({
        module: "storage-module",
        message: "localStorage fallback 전환",
        detail: "IndexedDB 사용 불가로 localStorage 사용",
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
        message: "데이터 구조 불일치",
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

  async function replaceAllPosts(posts) {
    if (currentMode === "indexedDB") {
      return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(STORE_POSTS, "readwrite");
        const store = tx.objectStore(STORE_POSTS);
        store.clear();
        posts.forEach((post) => store.put(post));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }
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
    replaceAllPosts,
  };
})();
