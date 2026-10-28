// 서비스 워커: 코드(html/js/css)는 네트워크 우선(항상 최신), 에셋(이미지/오디오/폰트)은 캐시 우선.
const VERSION = 'v45-coop-boss';
const CODE_CACHE = `kfp-code-${VERSION}`;
const ASSET_CACHE = `kfp-assets-${VERSION}`;

const PRECACHE = [
    './src/ui/mobile.css',
    './asset/branding/slayer-icon-180.png',
    './asset/branding/slayer-icon-192.png',
    './asset/branding/slayer-icon-32.png',
    './asset/branding/slayer-icon-512.png',
    './asset/branding/slayer-launch-480.webp',
    './asset/branding/slayer-launch-900.webp',
    './asset/branding/slayer-maskable-512.png',
    './src/core/run-rewards.js',
    './src/game/stage-checkpoint.js',
    './src/game/cannon-targeting.js',
    './src/game/thorn-charges.js',
    './src/game/butcher-sword.js',
    './src/game/plague-targeting.js',
    './src/data/pet-upgrades.js',
    './src/core/pet-upgrades.js',
    './src/ui/pet-upgrade-shop.js',
    './src/data/cosmetics.js',
    './src/core/cosmetics.js',
    './src/game/cosmetic-effects.js',
    './src/game/attack-animation.js',
    './src/game/player-appearance.js',
    './src/ui/cosmetic-shop.js',
    './src/ui/cosmetic-shop.css',
    './src/data/bestiary.js',
    './src/ui/bestiary.js',
    './src/ui/bestiary.css',
    './asset/enemies/rabbit-suicider.png',
    './asset/enemies/rabbit-gunner.png',
    './',
    './index.html',
    './style.css',
    './blue-night.css',
    './src/ui/tutorial.css',
    './src/ui/practice.css',
    './src/ui/fusion-reveal.css',
    './src/ui/fusion-reveal.js',
    './src/ui/fusion-button.js',
    './src/ui/practice.js',
    './src/game/practice.js',
    './src/game/targeting.js',
    './src/game/player-motion.js',
    './asset/tutorial/field-guide.webp',
    './asset/tutorial/moon-hat.webp',
    './asset/tutorial/yeongnyang.webp',
    './manifest.webmanifest',
    './src/main.js',
    './src/data/techs.js',
    './src/data/difficulty.js',
    './src/game/tech.js',
    './src/ui/tech-select.js',
    './src/ui/tech-select.css',
    './src/core/shop-access.js',
    './src/game/fusion.js',
    './src/game/loadout-exchange.js',
    './src/ui/loadout-exchange.js',
    './src/ui/loadout-exchange.css',
    './src/ui/item-choice-info.js',
    './src/ui/story-pacing.js',
    './src/ui/loading.js',
    './src/ui/loading.css',
    './src/core/accessories.js',
    './src/data/accessories.js',
    './src/data/fusions.js',
    './src/data/boss-rewards.js',
    './src/game/boss-appearance.js',
    './src/game/boss-sheets.js',
    './src/game/weapon-vfx.js',
    './src/game/supply-drops.js',
    './src/game/coin-drops.js',
    './src/game/pet-sprite.js',
    './asset/sprites/pet-yeongnyang.json',
    './asset/sprites/pet-yeongnyang.webp',
    './asset/sprites/pet-yeongnyang-attack.webp',
    './asset/sprites/pet-yeongnyang-heal.webp',
    './src/game/coop.js',
    './asset/sprites/coop-yeongnyang-walk.webp',
    './asset/sprites/coop-yeongnyang-attack.webp',
    './asset/sprites/player.webp',
    './asset/sprites/rabbit1.webp',
    './asset/ui/title.webp',
    './asset/ui-flowerpig.png',
    './asset/ui/menu-yeoni.webp',
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
