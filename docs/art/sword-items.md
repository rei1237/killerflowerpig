# Sword and final sword-wheel item icons

Final product icons:

- `asset/items/sword.png`: 도살검, 512×512 RGBA. Broad forged steel sword, gold/lotus/jade guard, purple grip. Its broad blade and angled point reference the actual sword held by the canonical pig.
- `asset/items/blood-reaper.png`: 학살자의 검륜, 512×512 RGBA. One cohesive final sword-and-saw weapon with an integrated serrated wheel around the blade base, jade bearing, gold frame, pink lotus gemstone and purple hilt/ribbon.

Both are separate object-only transparent icons with no text, character, detached projectiles, background tile or gore. Each source was uniformly fitted inside a 448×448 region of a 512×512 transparent canvas, leaving at least 32 pixels of untouched transparent margin; artwork was not repainted or reconstructed in code.

Native/thumbnail proof: `tmp/sword-items/sword-items-native-contact.png` includes 512px icons and actual 64px/96px shop-size previews on contrasting backgrounds. Both source artwork and final previews were visually inspected. Source copies and SHA-256 verification are in `tmp/sword-items/`.

Built-in `image_gen` produced the icons:
- Sword source: `exec-7ea6a975-1cec-41c8-bde1-e52a8afb8280.png`.
- Final sword-wheel source: `exec-26f181f2-c3b5-47a4-9c84-f4e8b1fbace4.png`.

Reference pixels: `asset/sprites/player-base-sword.png` for the actual held butcher sword; `asset/sprites/player-base-blade.png` for the circular steel saw/turquoise hub; `asset/items/lotus-gun.png` for the game's polished jade/gold/pink/purple material palette.

Sword prompt: one premium diagonal broad steel butcher sword, handle lower-left and blade upper-right, compact cleaver-like angled point, restrained forged wear, warm gold guard with jade inlay and pink lotus gemstone, purple wrapped grip, readable at 64px, square transparent object-only illustration with generous padding and no text or gore.

Final fusion prompt: one believable integrated sword-plus-circular-saw weapon, broad moonsteel sword, serrated ring-saw structurally mounted around the lower blade, jade bearing and golden frame, pink lotus/gem focal points, purple grip, restrained crimson detailing, premium polished natural 2D game art, clear final-upgrade silhouette at small size, transparent object-only composition with no detached disc, text, background or gore.

No gameplay mapping or publication state was changed by this art work. The agreed paths are `sword.png` and `blood-reaper.png`.
