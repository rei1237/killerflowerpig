const CACHE_NAME = "yeon-blue-zombie-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.webmanifest"
];

// Install: 새 캐시 생성 및 에셋 저장
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: 이전 캐시 모두 삭제
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: 네트워크 우선 전략 (항상 최신 버전)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  
  // 쿼리 파라미터가 있는 요청은 캐시하지 않음 (버전 쿼리)
  const url = new URL(event.request.url);
  if (url.search) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공적으로 가져오면 캐시 업데이트
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 제공
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return caches.match("./index.html");
        });
      })
  );
});
