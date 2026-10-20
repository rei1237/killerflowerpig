# Slayer launch branding

Canonical display name: **꽃돼지 청토끼 슬레이어!**

Updated document title, Apple installation name, manifest name and short name, launch heading, title heading and installation dialog. The complete short name is intentional to preserve the requested identity; operating systems may visually truncate launcher labels.

## Art

Both new pieces were generated with the built-in image generation tool using `asset/ui/menu-yeoni.webp` as the inspected canonical reference. Invariants: warm brown eyes, pink skin, layered head lotus, purple scarf, curled pig tail and compact futuristic rifle. No rasterized title text; Korean identity remains accessible HTML.

- `asset/branding/slayer-icon-{32,180,192,512}.png`: opaque square icon at actual declared sizes. 180 is the Apple touch icon; 32 is favicon.
- `asset/branding/slayer-maskable-512.png`: separately padded opaque maskable variant.
- `asset/branding/slayer-launch-{480,900}.webp`: uncropped full-body artwork, responsive source selection, approximately 48KB/119KB. No required game-loader dependency: failure reveals the existing text emblem and boot continues.

Generation prompts specified a textless premium square game icon / full-body launch key art of the exact reference flowerpig, brown rather than blue eyes, complete lotus/scarf/tail, dark navy-charcoal and jade atmosphere, restrained gold rimlight, lotus-pink highlights, polished hand-painted dimensional game illustration, no additional characters, text, UI, watermark or gore. Icon brief emphasized a readable close portrait; launch brief required the entire body and rifle with generous edge space against a misty ruined city and jade moon. Generated originals were resized and encoded for shipping; maskable padding is deterministic.

## Runtime

The actual asset event stream remains the sole progress source. No artificial timer or decorative percentage. Retry, stale-attempt suppression, aborted fetch/image handling, failed-initialization reload and image fallback are unchanged. The canonical heading remains consistent in error state; live status and alert describe the failure. Contrast, reduced-motion rules, short-screen scrolling, touch retry and `object-fit: contain` are retained. Viewport restrictions on browser zoom are removed.

Cache version: `v26-slayer-mobile-launch`; all new branded assets and mobile CSS are included in service-worker precache. The existing start URL is unchanged so install identity and saved game origin remain stable.

## Verification

- `node --test tests/slayer-branding.mjs tests/loading.mjs tests/menu-layout.mjs`: 21/21 passed.
- `tools/slayer-branding-qa.mjs`: executable real-browser QA covering desktop, phone, small phone, landscape, actual boot and image-failure fallback. **Not completed in this sandbox**: Chromium socket creation is prohibited; escalated attempt failed environment setup. No runtime screenshot claims.
- `node tools/slayer-branding-proof.mjs`: `docs/qa/slayer-branding/design-proof.png`, inspected deterministic composition proof using shipped images. This illustrates the design, not actual HTML/CSS layout.
- Generated artwork inspected directly at source and scaled-down icon sizes.

Real iOS/Android installation, launcher masking and device browser QA remain unverified. Existing installed PWAs can retain old launcher metadata until the OS refreshes it or the app is re-added.
