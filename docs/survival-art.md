# Survival art integration

The character references supplied by the owner informed the four-frame flowerpig firing strip and Yeongnyang catalog. Art is kept separate from text: Korean UI headings/body use Google Fonts Noto Sans KR, story prose Noto Serif KR, with local system fallbacks. Font downloads may be unavailable offline; layout does not depend on them.

- `asset/sprites/player-fire.png`: four 384×256 cells, fixed feet at (192,240), 0.24 world scale. Actual gun shots trigger fire (50 ms), recoil (65 ms), recovery (85 ms). Movement stays unchanged. The displayed character is20% smaller than the first firing integration; hit radius is10 instead of13. Projectile collision uses a torso-centered circle16 units above the foot anchor, excluding the gun and lotus. Ground contact keeps its planar body projection. G.clock freezes animation during pause. Original walking atlas remains a load-failure fallback.
- `asset/bosses`: illustrated archive/HUD portraits and load-failure fallback. `asset/boss-animations`: ten genuine eight-pose sheets with fixed foot anchors and event-synchronized state animation. Ordinary mob atlases unchanged.
- `asset/items`: generated transparent signature items plus authored SVG weapon hardware, used in upgrade, reward, equipment and shop UI. Static images are never parsed as animation sheets.
- `asset/story`: ten stage-specific, cute 2D optimized scene illustrations (v2 replaces the earlier cinematic set), loaded when a chapter opens.
- `asset/tutorial`: lightweight illustrated field guide with accessible navigation and a separate dismissal preference.

## Final boss reference

Original profile: https://code-destiny.com/images/novel/rab-sheet.webp

The final-boss illustration adapts the novel's blue rabbit, purple/gold attire, violet jewel, coin and pink-sand hourglass into this survival game's visual treatment. This is an adaptation, not a claim that the survival game's villain role is novel canon. All ten combat bosses now use genuine eight-pose sheets: walkA/B, windup, strike, recovery, hurt and two death poses. Actual attack events drive strike frames. Current/next sheets load lazily; original full-body portraits remain failure fallbacks. Collision geometry stays unchanged. Ordinary mobs are unchanged.

## Verification limits

Local deterministic tests exercise economy, persistence, animation timing, HUD, tutorial and modal behavior. Browser gameplay and responsive screenshot QA remain required in an authenticated, supported browser; deployment protection is unchanged. Generated illustration previews are asset previews, not browser screenshots.

## Profile-consistent command menu and chapter revision

The menu survivor is redrawn from the supplied YEONI profile and the live firing sprite: layered pink lotus, large brown eyes, round pale-pink proportions, purple tied scarf, dark rifle. It replaces the previous thick-outline toy-gun illustration throughout title/HUD/result portraits. Story illustrations use the same reference design and gently shaded cute 2D treatment. The full foreground picture is always contained; a blurred, dim duplicate of the same chapter image fills the surrounding visual panel so the scene and background share color without cutting off the character.

Command-menu roles have distinct crate/book/hazard/terminal icons and descriptions. Start is the primary deployment action; settings/install are secondary system controls. The local secret-code terminal expands within the scrollable grid instead of floating over other buttons. It does not change the underlying code authorization or introduce server authentication.
