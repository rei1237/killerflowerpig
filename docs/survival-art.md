# Survival art integration

The character references supplied by the owner informed the four-frame flowerpig firing strip and Yeongnyang catalog. Art is kept separate from text: Korean UI headings/body use Google Fonts Noto Sans KR, story prose Noto Serif KR, with local system fallbacks. Font downloads may be unavailable offline; layout does not depend on them.

- `asset/sprites/player-fire.png`: four 384×256 cells, fixed feet at (192,240), 0.24 world scale. Actual gun shots trigger fire (50 ms), recoil (65 ms), recovery (85 ms). Movement stays unchanged. The displayed character is20% smaller than the first firing integration; hit radius is10 instead of13. Projectile collision uses a torso-centered circle16 units above the foot anchor, excluding the gun and lotus. Ground contact keeps its planar body projection. G.clock freezes animation during pause. Original walking atlas remains a load-failure fallback.
- `asset/bosses`: illustrated archive/HUD portraits only. In combat, existing animated rabbit atlases retain movement/attack/death cycles, without changes to ordinary-mob appearance. New boss portraits are roster-specific.
- `asset/items`: generated transparent signature items plus authored SVG weapon hardware, used in upgrade, reward, equipment and shop UI. Static images are never parsed as animation sheets.
- `asset/story`: ten stage-specific, cute 2D optimized scene illustrations (v2 replaces the earlier cinematic set), loaded when a chapter opens.
- `asset/tutorial`: lightweight illustrated field guide with accessible navigation and a separate dismissal preference.

## Final boss reference

Original profile: https://code-destiny.com/images/novel/rab-sheet.webp

The final-boss illustration adapts the novel's blue rabbit, purple/gold attire, violet jewel, coin and pink-sand hourglass into this survival game's visual treatment. This is an adaptation, not a claim that the survival game's villain role is novel canon. All ten portraits are now the actual combat sprites as well as archive/HUD illustrations. Each full image is drawn once with bounded procedural breathing, attack squash, tilt and death collapse; no static image is cropped as an animated atlas. Feet are normalized using measured alpha bounds. The visible hit circle matches the existing projectile center/radius. Original atlases are load-failure fallbacks only. Ordinary mobs are unchanged.

## Verification limits

Local deterministic tests exercise economy, persistence, animation timing, HUD, tutorial and modal behavior. Browser gameplay and responsive screenshot QA remain required in an authenticated, supported browser; deployment protection is unchanged. Generated illustration previews are asset previews, not browser screenshots.
