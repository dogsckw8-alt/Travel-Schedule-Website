const CACHE_NAME = 'travel-itinerary-v1';

// 需要納入離線快取的靜態資源與 HTML 檔案清單
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './js/app.js',
  './js/renderer.js',
  './js/parser.js',
  './js/config.js'
];

// 1. 安裝事件：預先快取核心靜態資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 正在預先快取離線資源...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. 啟用事件：清理舊版本的快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 正在清除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. 攔截請求：Cache-First 策略（優先讀取快取，離線時自動降級）
self.addEventListener('fetch', (event) => {
  // 略過非 GET 請求或 Google Apps Script 遠端 API 請求（避免干擾動態資料抓取）
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 若快取中存在則直接回傳
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 否則向網路發起請求
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // 若完全斷網且請求的是網頁 HTML，則降級回傳主頁快取
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
