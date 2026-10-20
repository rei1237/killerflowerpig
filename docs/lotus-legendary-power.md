# Legendary lotus gun: combat upgrade

This is the permanent, slot-free shop `lotus_gun`, not the separate `cannon` / 꽃잎포 or its fusions. Ownership enables auto-fire on each run. Price is 9,000 gold, stage-3 unlock, one purchase. Other weapons and tech statistics are unchanged.

## Exact changes

- Round damage: `18 + 8 × stage` → `40 + 14 × stage`, scaled by player might as before.
- Three rounds every 0.45 → 0.36 seconds (player cooldown applies as before).
- Spread step 0.16 → 0.07 radians; speed 820 → 960; pierce 4 → 7; radius 7 → 8.
- Predictive aim follows moving targets; focused targets retain priority. Swept body-capsule collision prevents low-FPS tunneling for this gun only.
- The first damaging impact among the three rounds opens exactly one 90-radius lotus bloom. Up to eight ordinary enemies take one extra round of damage; a nearby boss takes 0.75 rounds. There are no recursive projectiles, chain blooms, execute effects or bonus weapon slots. Direct rounds and bloom obey the real boss phase shield.
- Existing 10% weapon crit chance is unchanged. Bloom uses only the player's normal crit chance, not the weapon's extra 10%.
- Jade/gold seed projectiles, pink opening petals, an actual-hit lotus and a fine radius outline replace the generic mint pistol appearance. Bloom metadata is capped at 12 events; frame-wide petal/impact budgets apply. Low-quality retains five bloom petals; reduced-motion removes trails and uses a fixed blossom size. No screen flash or shake is added.

## Measured real-runtime comparison

`node tools/lotus-legendary-bench.mjs [optional-baseline-root]` exercises actual firing and collision for 20 seconds with seeded no-crit probes. Stage 4 results:

| Scene | Before damage | After damage | Ratio |
| --- | ---: | ---: | ---: |
| Stationary boss, 180 px | 6,300 | 19,080 | 3.03× |
| Stationary boss, 440 px | 2,050 | 19,080 | 9.31× |
| 18 moving enemies | 16,300 | 102,720 | 6.30× |
| Focused moving pack | 18,800 | 108,000 | 5.74× |
| Nonowner, moving pack | 0 | 0 | unchanged |

The large far-boss increase fixes the old fan's two missed side rounds. Peak active projectiles rose from six to nine. At 15 FPS the new nearby-boss probe deals 17,640 damage; timer quantization lowers cadence, but swept hits remain reliable. Complete stages 1/4/10 results are in `lotus-legendary-bench.json`. These are controlled damage probes, not full encounter clear times; they omit player dodging, enemy mortality and art-based muzzle offsets.

`tests/lotus-legendary.mjs` verifies exact single-volley damage, one bounded bloom, 15 FPS collision, focus, nonowner/pool reuse, and actual Boss phase-transition invulnerability. Existing cannon tests continue to enforce its three-ray limit and focus rules. Existing attack-animation tests cover the authored eight-frame legendary sheet; preview cadence tests now use 360 ms.

`node tools/lotus-legendary-preview.mjs` produces the actual native-canvas renderer contact sheet, `art/lotus-legendary-combat.png`: opening volley, real impact, low quality, reduced motion. It loads the actual legendary firing sheet before capture. This is not browser/mobile gameplay QA.

## Full live endgame boss check

`node tools/lotus-legendary-boss-bench.mjs [optional-baseline-root]` uses the existing live-AI fixture (stage 10, 2,822,400 HP, seed 7, focus, fixed scatter_rail Lv6 + lotus_bloom Lv8 progression build, standing high-HP player). Both phase transitions occurred:

- No ownership: **169.30 seconds / 40 attack patterns**, exactly identical before and after.
- Old legendary: **158.75 seconds / 37 patterns**.
- New legendary: **142.28 seconds / 34 patterns**; phases at **56.25 / 106.12 seconds**.

This demonstrates useful added legendary power without deleting endgame boss phases or attacks. The fixture is not a human clear-time promise, and no browser or phone playthrough was performed.
