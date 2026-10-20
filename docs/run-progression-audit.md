# Ten-stage progression audit: expanded sword roster

## Current result

The registry has9 ordinary weapons and14 fusion/absolute recipes. Recomputed after the real sword, sword+saw final and Butcher dual start. This replaces the previous population/XP-era tables and removes their obsolete universal three-final claim.

For the regression's director seed7, central residency16seconds and85% XP collection, the40 focused runs now reach three finals37times and two finals3times before boss10 (previous fixture expectation34/6). The Butcher route reaches three34times and two6times. This change is an observed seeded planning result, not evidence the enlarged choice pool always makes combat easier.

A larger200-seed choice audit (director seed7, with three declared residency/collection scenarios) produces the distributions stored in the JSON artifact below. No gameplay balance was changed by this audit.

## Reproduction and scope

- `node tools/run-progression-audit.mjs 200 --compact > docs/run-progression-audit-results.json`
- `node tools/run-progression-audit.mjs --fixtures > tests/fixtures/planned-boss-builds.json`
- `node --test tests/run-progression-audit.mjs`

The model calls the actual director, enemy death/XP drops, choice weights, reroll sessions, choice application, boss chest evolution and fusion validation. It uses synthetic residency, not autonomous combat. Elites remain alive3× ordinary residency. Split children and spawn caps are real; uncredited survivors do not become XP. Explosion chains, boss-phase ordinary kills, movement, actual DPS and survival are not simulated. Collected XP becomes available at wave end. Boss chests precede boss-drop XP; boss10 rewards never count toward its pre-fight snapshot.

Baseline starts with one Lv1 shotgun. Butcher mode reads the actual techStartingWeapons helper, starts sword+saw at Lv1 plus whet Lv1, and enables the actual tech choice-family behavior. It targets sword_wheel, scatter_rail and lotus_bloom. Thus this is a real route comparison, not a starter-only controlled experiment. No permanent purchases are granted.

Investment conservation subtracts each run's recorded initial weapon+passive levels (baseline1, Butcher3), then accounts exactly for every applied choice, boss upgrade, consumed fusion input and exchange loss. Every consumed evolution must have a prior actual chest evolution. All snapshots fit six weapon slots; passives follow the current12-item registry rather than the obsolete six-slot claim.

Current XP costs come directly from xpForLevel: base10+10×(level−1)+20×max(0,level−20)+40×max(0,level−35)+12×max(0,level−11)+25×max(0,level−25), multiplied by the active difficulty factor. XP-related passive choices can change the number of earned levels, so choice counts are distributions.

## Before-boss10 results,200 choice seeds

| Residency / collection | Policy | 0 finals |1 final|2 finals|3 finals|1 absolute |
|---|---|---:|---:|---:|---:|---:|
|24s / 70%|planned|0|10|107|83|0|
|24s / 70%|scattered|112|77|11|0|0|
|24s / 70%|absolute|3|197|0|0|198|
|24s / 70%|butcher|0|10|119|71|0|
|16s / 85%|planned|0|0|23|177|0|
|16s / 85%|scattered|69|113|18|0|0|
|16s / 85%|absolute|0|200|0|0|200|
|16s / 85%|butcher|0|0|40|160|0|
|8s / 95%|planned|0|0|0|200|0|
|8s / 95%|scattered|11|124|64|1|0|
|8s / 95%|absolute|0|200|0|0|200|
|8s / 95%|butcher|0|0|1|199|0|

Central focused and Butcher routes meet the2–3-final target in200/200 runs. Slow collection/residency leaves10/200 of each focused route at one final; this5% shortfall is disclosed, not hidden by snapshot updates. Fast focused reaches three in200/200, Butcher199/200. Scattered selection remains weaker because it does not prioritize recipes or use the planned reroll policy. Absolute counts are separate from ordinary finals.

Fixtures now include a fifth actual Butcher pre-boss build. Existing fixture levels/stats are regenerated from the real rollout, not manually strengthened. The prior recorded sensitivity batch is not retained as current evidence; rerun --sensitivity separately if needed. Tests verify exact artifact reproduction, conservation over160 seeded runs, legal evolutions, starter grants and boss-reward ordering.
