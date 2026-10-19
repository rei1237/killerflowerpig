# Preview QA handoff

## Automated checks

Run `node --test tests/*.mjs` and `node --check` for every source JavaScript module. Tests cover real ES modules behind a minimal DOM/canvas boundary, not browser layout or real touch input.

Covered: legacy save migration, failed writes, revision conflicts, stale/repeated purchases, owned pet equip/reload, coin collection and capped-pool value retention, pending reward retry, pet damage cooldown, shot-driven firing timing/fixed foot anchor, ordinary mob appearance preservation, ten distinct full-body combat boss sprites, real HUD state, nested modal dismissal, concurrent chest/level-up queuing, stale chest timers, first-run/skip/reopen tutorial and all catalog/chapter/boss asset paths.

## Browser checklist still required

Use an authorized browser that can access the exact branch preview deployment. Deployment protection is intentionally unchanged. The cloud Chromium runtime currently cannot create its required socket, so no browser screenshot or gameplay QA pass is claimed.

1. Desktop 1440×900 and phone 390×844/360×740: title, buttons, tutorial, story typography and action visibility. Rotate to landscape. Tab/focus and Escape should affect only the top modal.
2. New run → skip/finish guide → story → play. Continue an existing run without resetting permanent progress. Check each chapter image and readable scrollable Korean text.
3. Move with WASD/arrows; on phone drag canvas joystick. Auto-fire must trigger recoil at actual shots and recover without foot jitter. Pause/resume and opening Settings/guide must stop gameplay; held Escape/P must not toggle repeatedly.
4. Kill enemies, collect coins, open simultaneous chests, choose upgrades, retry stage, inspect results. No duplicate coins or stuck pause. Simulate blocked storage and verify clear warnings and retained coin pickups.
5. Buy each affordable permanent upgrade, buy/equip/unequip Yeongnyang, reload and verify wallet/ownership. Unaffordable/stale purchase must not charge. Pet follows, attracts nearby coins and attacks on cooldown.
6. Inspect all ten boss portraits and actual full-body combat sprites; ordinary enemies retain their original animated look. Final portrait and story use the novel-inspired contract/hourglass adaptation. Combat hitboxes remain unchanged; boss 1 timing is deliberately eased (see beginner-balance notes).
7. New game-over scene, retry and title buttons, offline reload after successful caching. Check network panel for missing assets and console for errors.

The server adapter is preparation only. Cross-device/account persistence is not deployed; guest progress remains local to this browser.

## Initial balance changes

- The only ranged trash type is acid spitter (single projectile, not a shotgun volley). Its normal-table first spawn is now stage5 at60seconds. Stages1–4 reject all ranged mobs across ordinary, forced, elite and boss-summon routes; later damage/cooldown remain unchanged. Boss spread attacks were not globally weakened.
- Wing relic stats and 80-coin chest prices/rates are initial tunable balance. Odds and duplicate compensation are shown before opening; direct purchases offer the same relics without randomness. The strongest owned tier applies once; all speed sources are capped at 243 world units/second.

## Item-level progression and fusion (supersedes charged cannon)

- Flower cannon is an ordinary acquired and upgraded auto-firing weapon. There is no active global charge button, Space attack, permanent character-level display or new character-XP award. Old save fields remain intact for compatibility.
- Run XP provides item-selection opportunities. Three recipes combine two Lv.5 weapons into one Lv.1 fusion weapon, which can itself be upgraded. Recipe preview shows actual passive-adjusted stats, required/current levels and explicit consumption. Only clicking the confirm button consumes the two inputs. Stale/repeated clicks are rejected.
- Shop unlocks still use cleared-stage history. Yeongnyang stays direct-shop-only after stage2, with no random/drop entry. Birthday redemption remains disabled.

## Screenshot clipping correction

The supplied 1040×681 screenshot showed chapter 1's flower pig cut off at the right edge of the illustration column. The 16:9 image was being filled into a tall 43%-width column with `object-fit: cover`. Story art now uses centered `contain`, with a dark intentional letterbox and a separate location caption. No character pixels are intentionally cropped. Text remains independently scrollable and actions remain in the fixed lower row.

The title menu now uses explicit grid areas: brand, copy, launch, illustration, utility cards and progress footer. On narrow screens the launch actions precede the illustration; every viewport scrolls from the top if content exceeds available height. Primary actions are at least 54px and utility cards 64px. Menu artwork has bounded contain boxes with no off-edge placement.

Source-level responsive regression checks are not a substitute for browser rendering. Verify 1440×900, 1040×681, 768×1024, 390×844, 320×568 and 844×390; inspect the complete chapter art, scroll long text, reach Continue/Skip, and navigate every main menu action. Existing runtime restrictions prevented a real browser screenshot of this correction.

## Profile / animated roster / support update
- 177 automated tests passed before publication, including every fusion confirmed through real UI, closing nested reward dialogs, pooled-enemy reuse, then240 simulation/render frames per recipe. DOM/canvas boundaries are simulated; this is not a real browser/touch QA pass.
- Fixed a reproduced freeze: fusion replaced enemy Float32Array hit cooldown buffers with plain objects; a reused pooled enemy then threw at `.fill()`. Buffers now retain their expected type. Boss hit maps remain separate.
- New choice cards read actual current levels and show current→next or 신규/최대. Expandable recipe details are siblings of the selection button, avoiding accidental selection while inspecting ingredients/effects.
- All10 profile-consistent story scenes use contained foreground art over a matching softened backdrop. Main hero matches supplied profile.
- Ten8-pose boss sheets are event synchronized and loaded current/next only. Winged Yeongnyang uses8 actual poses, unchanged combat power and whole-frame bounds smaller than the player.
- Native-canvas renderer previews inspected. Cloud Chromium remained blocked by environment socket restrictions; protected remote preview not browser-tested.
