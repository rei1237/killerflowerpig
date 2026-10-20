> Historical e3d3b330 balance snapshot. The later user-requested Cannon impact/focus revision supersedes Cannon damage and derived TTK below; see [current revision](cannon-impact-revision.md). Other mechanics remain unchanged.

# Cannon: three-beam cap, exclusive focus, and bounded auto-aim

This report compares the final three-beam implementation with published commit `76d85937`. The unpublished 120-damage/eight-ray experiment is not the user baseline and was discarded. Reproduce the measured JSON with `node tools/cannon-aim-qa.mjs > docs/cannon-aim-qa.json`.

## Final attack contract

- At most **three active Cannon beam objects globally**, including ordinary, evolved, retained cores, finals and absolutes, after every projectile bonus. Neutral level counts are 1/2/2/3/3/3/3/3; a stricter existing Ember Lance main cap of two remains.
- No excess-count or fractional-magazine damage compensation. Main and retained attacks that are actually due in the same update coalesce into one shared visible volley. Every contribution keeps its independently scheduled cooldown, damage, width and reach, and its owner's damage attribution. A later volley replaces the previous instantaneous-hit visual rather than stacking lingering beam objects.
- Without a valid focus, bounded auto-aim scores distinct hittable targets from the actual authored left/right muzzle, using at most64 target objects and three rays. It includes visible edge enemies, excludes entirely unseen ordinary candidates, and does not rotate after scoring.
- With a valid focus, all Cannon rays converge on that exact live target snapshot. Only it takes the aggregated Cannon damage; intervening and behind-target enemies do not. Focus damage is full stat power ×1.25/1.33/1.41 for one/two/three rays. Target death is handled on the next real attack, never mid-volley. Focus endpoints and confirmed-hit effects do not follow the target afterward.
- Advanced inherited orbit attacks, thrown fire bottles and persistent fields keep their own mechanics. “Target-only” applies to the Cannon beams, not every secondary attack of a composite weapon.
- Mixed sources use exact same-axis geometry layers. A short-wide source never grants its width to a long-narrow source, nor does a one-ray source enlarge the other two rays. Selector, damage and renderer use the same segment union. There are still only three beam objects.
- Damage is immediate in `updateWeapons`; sprite poses, beam lifetime and the cosmetic minimum hold never delay a shot. Cannon is hitscan, so no fictitious travel-speed progression is advertised.

## Neutral ordinary curve

Damage below excludes tech, gear, critical hits and permanent bonuses. Automatic damage applies its level's dispersion ratio once; focused damage uses full stat power and its bounded focus bonus. Width and range include level area growth.

| Lv | Published damage / rays | Final stat damage | Automatic damage | Focused damage | Interval | Rays | Width | Range |
|---|---|---|---|---|---|---|---|---|
|1|28 / 1|44|44|55|2.6s|1|44|520|
|2|40 / 2|56|53.2|74.48|2.366s|2|46|540|
|3|40 / 3|60|54|79.8|2.132s|2|60|626.099|
|4|40 / 4|68|57.8|95.88|1.898s|3|62.5|648.46|
|5|40 / 5|74|59.2|104.34|1.664s|3|65|670.82|
|6|55 / 6|84|63|118.44|1.43s|3|67.5|693.181|
|7|55 / 7|92|64.4|129.72|1.196s|3|70|715.542|
|8|75 / 8|100|65|141|0.962s|3|84.1|794.745|

At Lv8, ordinary automatic damage per target is75→65 (−13.3%) and rays8→3 (−62.5%). Evolved rays16→3. Base damage remains44 for a responsive opening. Evolution raises damage and area and shortens the interval another15%, without increasing the three-ray ceiling. The retained Cannon source cap is800 before its existing tier multiplier, scaled from the original600 by the base75→100 change; it does not include overflow compensation. Other source caps remain600.

## Actual published-runtime comparisons

The tool imports the published76d85937 Cannon implementation and definition from Git and runs it against the same current enemy HP and muzzle. It does not pass old stats through the new65% rule. This is an isolated weapon comparison, not a snapshot of the entire old game.

A neutral Lv8 Cannon against a stationary250px boss for30 seconds, with no passives or critical hits:

| Build | Published focused DPS | Final focused DPS | Peak published / final beams |
|---|---|---|---|
|Ordinary|80|150.4|8 / 3|
|Evolved|291.6|548.208|16 / 3|

The focus gain is88% in both isolated builds. Focus remains substantially stronger per target than automatic dispersion while the latter covers multiple enemies.

Sixteen rotating enemies on a280px ring, constant moving-player stance, no focus:

| Lv / enemy HP | First-volley kills: published → final | First effective damage: published → final | Time to clear16: published → final |
|---|---|---|---|
|1 / 40|0 → 1|28 → 40|not cleared in10s → not cleared in10s|
|1 / 70|0 → 0|28 → 44|not cleared in10s → not cleared in10s|
|4 / 40|4 → 3|160 → 120|not cleared in10s → 9.5s|
|4 / 70|0 → 0|160 → 173.4|not cleared in10s → not cleared in10s|
|8 / 40|8 → 4|320 → 160|4.833s → 3.867s|
|8 / 70|8 → 0|560 → 260|4.833s → 8.7s|

This deliberately reports the tradeoff: the70HP high-level group clears more slowly, while40HP survivors can be cleaned up faster by smarter aim despite half as many initial kills. Fewer rays do not guarantee slower clearance in every formation. These probes model coverage, not incoming damage or player survival.

## Real stage HP and volleys to kill

Bloom fixtures use current midpoint-of-stage spawned enemy HP; stage1/Lv1 has regen1, stage3/Lv4 adds whet1, stage6/Lv8 uses whet3, stage9/Lv8 evolved uses whet4+pollen1. Starter thorns are owned for legal resonance but their outgoing attacks are disabled. No crits, permanent upgrades, pets, or healing/incoming-pressure simulation. Each cell is published automatic → final automatic → final focused volleys.

| Stage / Cannon | Ordinary shambler | Strong hulk | Elite brute |
|---|---|---|---|
|1 / Lv1|1 → 1 → 1|4 → 3 → 2|10 → 6 → 5|
|3 / Lv4|1 → 1 → 1|7 → 5 → 3|18 → 13 → 8|
|6 / Lv8|1 → 1 → 1|11 → 13 → 6|27 → 31 → 14|
|9 / Lv8 evolved|1 → 1 → 1|8 → 9 → 5|20 → 22 → 11|

All six upper-path builds below use the same legal regen3/pollen3/spread3 passive budget, Bloom tech and a30-second stationary focused boss. Composite weapons retain their real secondary attacks; this is total build DPS, not just the direct beam.

| Build | Focused boss DPS |
|---|---|
|cannon Lv8|513.24|
|cannon Lv8 evolved|1900.454|
|lotus_bloom Lv1|2884.36|
|lotus_bloom Lv8|3053.36|
|absolute_bloom Lv1|4282.372|
|absolute_bloom Lv8|4872.766|

Absolute Bloom is deliberately restrained: main base125 damage/2.9s; only its retained cores use source power1.60 for Cannon or1.40 for other cores, +.05 per owner level, inherited cooldown×1.15 and inherited lifesteal×.5. Other final/absolute source owners are unchanged. It remains stronger than the relevant single final routes without restoring the discarded large-area damage through extra-ray conversion.

## Bounds and regression checks

Ordinary symmetric aiming uses at most195 angle candidates; asymmetric per-ray profiles use at most579. Every candidate scores at most64 targets over three rays. Exact geometry layers are bounded by the maximum twelve simultaneously scheduled main/retained Cannon sources and dominated rectangles are removed. Visual particles remain at most24 per volley; the renderer's separate shared VFX budgets still apply. The global beam cap and independent damage attribution are tested with two separately equipped Cannon-derived owners and overlapping lifetimes.

This host's500-run,64-target cap probe used180 candidates and3 rays: median0.967ms, p951.917ms, max8.577ms. These Node timings are not a mobile performance guarantee.

Tests cover real predicted-versus-actual hits, visibility/focus fallback, pooled focus reset, target death, invulnerable boss effects, three-ray bonus caps, no overflow damage, exact mixed geometry, immediate damage and upgrade hierarchy. Existing Gunline controls and historical role damage floors pass without changing Gunline stats. Full-game survival/clearance remains covered by separate finite-pressure and boss diagnostics.

Generated: 2026-10-20T13:29:14.609Z. Runtime stable during report: True. All definition files stable: True. Exact source SHA256 values and scenario rows are in `cannon-aim-qa.json`.
