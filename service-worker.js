// 서비스 워커: 코드(html/js/css)는 네트워크 우선(항상 최신), 에셋(이미지/오디오/폰트)은 캐시 우선.
const VERSION = 'v6-item-fusion-survival';
const CODE_CACHE = `kfp-code-${VERSION}`;
const ASSET_CACHE = `kfp-assets-${VERSION}`;

const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './blue-night.css',
    './src/ui/tutorial.css',
    './asset/tutorial/field-guide.webp',
    './asset/tutorial/moon-hat.webp',
    './asset/tutorial/yeongnyang.webp',
    './manifest.webmanifest',
    './src/main.js',
    './src/core/shop-access.js',
    './src/game/fusion.js',
    './src/data/fusions.js',
    './src/game/boss-appearance.js',
    './asset/sprites/player.webp',
    './asset/sprites/rabbit1.webp',
    './asset/ui/title.webp',
    './asset/ui-flowerpig.png',
    './asset/ui-rabbit.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CODE_CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CODE_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
        )),
    );
    self.clients.claim();
});

function isAsset(url) {
    return /\.(webp|png|jpg|mp3|woff2?|ttf)$/i.test(url.pathname) || url.hostname.includes('gstatic.com');
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    // 오디오 Range 요청은 브라우저에 맡김
    if (req.headers.has('range')) return;

    if (isAsset(url)) {
        event.respondWith(
            caches.open(ASSET_CACHE).then(async (cache) => {
                const hit = await cache.match(req);
                if (hit) return hit;
                const res = await fetch(req);
                if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
                return res;
            }),
        );
        return;
    }

    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res.ok && url.origin === location.origin) {
                    const copy = res.clone();
                    caches.open(CODE_CACHE).then((c) => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
    );
});
