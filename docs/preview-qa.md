# Preview QA handoff

## Automated checks

Run `node --test tests/*.mjs` and `node --check` for every source JavaScript module. Tests cover real ES modules behind a minimal DOM/canvas boundary, not browser layout or real touch input.

Covered: legacy save migration, failed writes, revision conflicts, stale/repeated purchases, owned pet equip/reload, coin collection and capped-pool value retention, pending reward retry, pet damage cooldown, shot-driven firing timing/fixed foot anchor, ordinary mob appearance preservation, ten unique boss signatures, real HUD state, nested modal dismissal, concurrent chest/level-up queuing, stale chest timers, first-run/skip/reopen tutorial and all catalog/chapter/boss asset paths.

## Browser checklist still required

Use an authorized browser that can access the exact branch preview deployment. Deployment protection is intentionally unchanged. The cloud Chromium runtime currently cannot create its required socket, so no browser screenshot or gameplay QA pass is claimed.

1. Desktop 1440×900 and phone 390×844/360×740: title, buttons, tutorial, story typography and action visibility. Rotate to landscape. Tab/focus and Escape should affect only the top modal.
2. New run → skip/finish guide → story → play. Continue an existing run without resetting permanent progress. Check each chapter image and readable scrollable Korean text.
3. Move with WASD/arrows; on phone drag canvas joystick. Auto-fire must trigger recoil at actual shots and recover without foot jitter. Pause/resume and opening Settings/guide must stop gameplay; held Escape/P must not toggle repeatedly.
4. Kill enemies, collect coins, open simultaneous chests, choose upgrades, retry stage, inspect results. No duplicate coins or stuck pause. Simulate blocked storage and verify clear warnings and retained coin pickups.
5. Buy each affordable permanent upgrade, buy/equip/unequip Yeongnyang, reload and verify wallet/ownership. Unaffordable/stale purchase must not charge. Pet follows, attracts nearby coins and attacks on cooldown.
6. Inspect all ten boss portraits and combat costume signatures; ordinary enemies retain their original animated look. Final portrait and story use the novel-inspired contract/hourglass adaptation. Combat hitboxes/attack timing remain unchanged.
7. New game-over scene, retry and title buttons, offline reload after successful caching. Check network panel for missing assets and console for errors.

The server adapter is preparation only. Cross-device/account persistence is not deployed; guest progress remains local to this browser.

## Initial balance changes

- The only ranged trash type is acid spitter (single projectile, not a shotgun volley). Its first spawn moved from stage 2 at 50 seconds to stage 3 at 90 seconds. Stage 1–2 have no spitter; stage 4+ and its damage/cooldown remain unchanged. Boss spread attacks were not globally weakened.
- Wing relic stats and 100-coin chest prices/rates are initial tunable balance. Odds and duplicate compensation are shown before opening; direct purchases offer the same relics without randomness. The strongest owned tier applies once; all speed sources are capped at 243 world units/second.

## Charged cannon and character growth

- Manual flower-petal cannon: normal kill +5 charge, elite +10, full at100. Space or right-thumb button spends the full gauge once; its own synchronous kills do not recharge it. Pause/modals/death reject activation. Stage start/retry resets charge.
- Permanent character level is separate from the run level. At stage settlement, XP equals stage kills plus50×stage for a clear, bounded10000 per award. Level1 damage80/radius170; each level adds12 damage/4 radius, radius capped340 and level capped50. Pending storage failures are disclosed and queued in memory only.
- Shop unlocks use cleared-stage history, not current replay selection. Strong Yeongnyang is direct-shop-only after stage2 and is absent from random relic/drop tables. Birthday redemption is disabled pending an approved event answer and authenticated server validation. No birthday is embedded or collected.
