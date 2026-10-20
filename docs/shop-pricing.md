# Higher gold shop prices (catalog 6)

This revision fulfills the request to make the shop substantially more expensive after the stronger-enemy gold increase. Prices only: existing wallets, owned upgrades/items, pet training, equipment, stage gates, effects, combat and drops are preserved. No retroactive charge, refund, or save reset. Catalog version advances 5 → 6; save version remains 5.

## Permanent purchases (coins, each upgrade tier)

| Item | Before | After |
|---|---|---|
| HP / 별자리 망토 | 10 / 24 / 48 / 80 / 130 | 100 / 240 / 480 / 800 / 1300 |
| Damage / 보랏빛 구슬 | 18 / 40 / 70 / 110 / 170 | 180 / 400 / 700 / 1100 / 1700 |
| Speed / 분홍 발바닥 | 12 / 28 / 52 | 120 / 280 / 520 |
| Pickup / 초승달 모자 | 8 / 20 / 40 | 80 / 200 / 400 |
| Reroll / 별빛 부적 | 30 / 80 | 400 / 1000 |
| Gold / 생선 간식 주머니 | 14 / 32 / 64 | 280 / 640 / 1280 |
| 전설의 연꽃 총 | 600 | 9000 |
| 동행 펫 영냥이 | 28 | 600 |
| Pet attack training | 30 / 50 / 80 / 120 / 180 | 180 / 300 / 480 / 720 / 1080 |
| Pet healing training | 40 / 80 / 140 | 320 / 640 / 1120 |
| Pet pickup training | 25 / 50 / 90 | 150 / 300 / 540 |

## Relics, accessories and collections

| Item | Before | After |
|---|---:|---:|
| 산들바람 깃털 | 12 | 120 |
| 달빛 날개 | 52 | 520 |
| 영냥이 별빛 날개 | 130 | 1300 |
| Relic chest | 16 | 160 |
| 달빛 수호 망토 | 90 | 540 |
| 별자리 정밀 렌즈 | 130 | 780 |
| 성운 모래시계 | 180 | 1080 |
| 별꽃 등불 | 240 | 1440 |
| 혜성 발걸음 장화 | 300 | 1800 |
| 영냥이 왕별 왕관 | 440 | 2640 |
| 황혼 연꽃 망토 | 360 | 1080 |
| 비취 연꽃 예복 | 780 | 2340 |
| 새벽 꽃잎 광환 | 1200 | 4800 |

## Reasoning against current income

`node tools/coin-income-audit.mjs` reproduces unchanged expected collected income of 35.63 / 44.45 / 131.99 / 238.12 / 595.81 coins at stages 1 / 2 / 3 / 5 / 10. This is the existing seeded director model: 16-second ordinary and 48-second elite residency, 85% field pickup, guaranteed boss bounty, no greed bonus, no boss-phase ordinary kills. It is not a player completion-time measurement.

- Basic permanent stats and relics are 10× their old prices. The cheapest 80-coin tier requires approximately 2.25 stage-1-clear-equivalent incomes instead of being funded several times by one clear. Saving across the first two stages yields about 80.08 coins before other rewards/spending.
- Gold upgrades cost 20× because their permanent income boost accelerates all later purchases. Repeatable per-choice rerolls cost 12.5–13.3×; their benefit is much broader than a single stat tier.
- The pet costs 600 rather than 28 because its permanent three-target attack, healing and collection combine several utilities. This is about 4.55 stage-3 or 2.52 stage-5 expected-income equivalents, with its stage-2 gate unchanged.
- Pet attack/collection training is 6× and repeat healing is 8×. Max training costs 5830 total, making progression a continuing gold sink rather than a few cheap clicks. Existing levels keep their full benefit.
- One-slot accessories cost 6×, respecting their mutual exclusion. The 540–2640 range offers medium/late savings goals rather than being swept up with one strong stage.
- The slot-free legendary gun is a long-term 9000-coin goal (15×; about 15.1 stage-10 income equivalents). Collectible outfits, already relatively costly for small support effects, rise 3×; the purely visual prestige halo rises 4×. The gun stays the most expensive individual purchase.
- Chest rates 60/30/10%, ten-open pity and duplicate rewards 3/7/14 are unchanged. Direct deterministic relic purchases remain available; even the largest duplicate compensation is far below the new 160 cost. No drop odds were changed to offset prices.

## Consistency and verification

`src/ui/screens.js`, `src/ui/pet-upgrade-shop.js`, and `src/ui/cosmetic-shop.js` already render and disable purchase buttons using the same catalog values consumed by the pure purchase validators. No duplicated price constants were added. The service-worker cache version changes so refreshed/offline code can replace the previous catalog.

`tests/shop-pricing.mjs` checks every upgrade/training tier and every direct purchase at exact funds and one coin short, immutable rejection, zero-balance settlement and repeated request idempotency. It also verifies catalog-5 saved balances, all ownership and equipped selections migrate without monetary or gameplay changes. Existing transaction, UI, persistence and cross-tab expected-price tests are updated to the new debits.

Run `node --test tests/*.mjs`, `node --check` for every source JS module and the service worker, and `git diff --check`. Tests use deterministic DOM/canvas fixtures; no real browser layout or device gameplay pass is implied. Production promotion remains with the user.
