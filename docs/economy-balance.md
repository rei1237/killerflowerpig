# Starter economy easing

Current shop prices: [higher gold shop prices](shop-pricing.md). Price examples below describe earlier revisions and are superseded by catalog 6; reward rates and item effects remain unchanged.

Values were inspected in the gameplay/catalog sources and verified with deterministic tests. These are calculations for identical kills/collected drops, not measured human playtime or a promise of earnings per minute. Early enemy density is being lowered separately; higher value per kill makes fewer successful kills useful.

## Before → after

- Normal enemy coin drop: 1 → 3; elite: 12 → 24.
- Base coin attraction: 70 → 105 world units; XP gems: 70 → 84. Upgrade multipliers still apply.
- Magnet pickup and stage-end magnet sweep now pull remaining coins as well as XP. Pulling does not grant money; durable credit occurs only on actual collection. Failed-write retry/duplicate safeguards remain unchanged. Gem movement now clamps to remaining distance to avoid long-frame overshoot.
- First permanent HP / speed / magnet price: 100 / 120 / 80 → 50 / 60 / 40.
- Subsequent prices remain progressive: HP 120/240/400/650; speed 140/260; magnet 100/200.
- Damage upgrade: 150/300/500/750/1100 → 90/200/350/550/850; rerolls 250/600 → 150/400; greed 100/250/500 → 70/160/320; exclusive pet 180 → 140.
- Guaranteed common / rare / epic relics: 120/400/1000 → 60/260/650.
- Coin chest 100 → 80; duplicate rebates 20/45/90 → 16/36/72 (same 20%/45%/90% proportions). All refunds remain below price, so duplicates cannot mint coins. Published 60%/30%/10% odds and tenth-after-nine-misses guarantee remain unchanged.
- Run XP thresholds: base 5 + 5 × (level−1) → base 4 + 4 × (level−1). Existing extra growth after levels 20 and 40 stays unchanged. Applied by progression/fusion owner. This is the in-run item choice curve, not hidden permanent character XP.

## Fixed-kill estimates (no greed, all listed coins collected)

- Cheapest starter magnet: 80 normal kills → ceil(40/3) = 14 kills.
- Starter HP: 100 → ceil(50/3) = 17 kills.
- Starter speed: 120 → 20 kills.
- Magnet + speed: 200 → ceil((40+60)/3) = 34 kills.
- At 20 normal kills: old 20 coins buys none of those; new 60 coins buys any one starter upgrade or common wing.
- At 100 normal kills plus one elite: drops 112 → 324 coins. Identical stage-1 clear bonus is approximately 60 coins, making total approximately 172 → 384. Actual bonus counts all kills, rounded by the existing formula.
- First three run upgrade choices cost 5+10+15=30 XP → 4+8+12=24 XP. First ten choices cost 275 → 220 XP. A normal starter enemy grants 1 XP; stronger enemies/elite XP keep their existing values.

No wallet gifts, resets, currency migration, hidden compensation or repeated settlements were added. Existing purchases/ownership persist. Stage clear gates, rarity effects, pet exclusivity and item fusion prerequisites remain intact. Starter items are intentionally available without a boss clear; higher-tier items still require their stage milestones.

## Verification

`node --test tests/economy-balance.mjs tests/pet-economy.mjs tests/progression-store.mjs tests/relic-economy.mjs`

Covers starter affordability, drop source values, XP thresholds, coin/gem attraction, magnet coin sweep without premature credit, overshoot prevention, negative-return duplicate refunds, durable wallet behavior, repeated purchase protection, rates/pity and ownership.

## Lower-population compensation (supersedes per-kill values above)

Regular refill rates/density and event counts are now approximately 0.60×, ordinary HP1.45× (mob-curve change). Kill-time coins change from3→5 ordinary and24→40 elite. Gem XP is multiplied by5/3 without rounding, preserving relative enemy XP values and avoiding inflated rewards from rounding every low-value gem. No prices, wallet grants, chest contents or elite-chest schedules change.

Spawn-limited opportunity proxy: 60 old ordinary kills (180coins,60×baseXP) becomes36 kills (180coins,36×baseXP×5/3). Damage-limited throughput proxy1/1.45 combined with5/3 gives1.149× prior XP/coin opportunity, a roughly15% cushion. These are arithmetic proxies, not measured player completion times; harder targeting and movement may change real outcomes.

Supply rolls use1−(1−old probability)^(5/3), preserving no-drop probability per equivalent spawn opportunity. Wounded >40% HP:4%→6.5774%; lowHP≤40%:10%→16.1047%; magnet1.5%→2.4875%; bomb0.15%→0.249875%. FullHP still suppresses healing. Drought counters retain old opportunity units, advancing5/3 per eligible ordinary kill. Guarantees become18 wounded kills (old30),8 lowHP kills (old12),36 magnet kills (old60). LowHP rounding gives13.333 old-opportunity units versus12, within one new kill. Existing integer save counters retain their original progress; fractional counters survive JSON snapshots and validation. Floating comparison epsilon prevents missing exact18/36 thresholds.

Regression tests exercise actual kill rewards, exact guarantee boundaries, probability boundaries, fullHP suppression, field cap recovery, pet/bleed kills, and fractional/legacy reloads.

## Latest roguelike request: occasional ordinary gold (supersedes guaranteed coins)

Ordinary enemy deaths now have a15% chance to drop3 coins;85% drop no coins. Elite enemies retain guaranteed40 coins and their chest. Existing boss/clear settlement rewards are untouched. XP, healing, magnets and bomb rolls are independent of whether gold appears. No wallet, purchased item, ownership or shop price is reset by this change.

Expected ordinary income is0.45 coins/kill, versus5 before: a91% reduction. At100 ordinary kills this is45 expected coins rather than500 (random variation means no promise of45 actual coins). Cheapest40-coin magnet needs about89 ordinary kills on an expectation basis;60-coin speed about134;140-coin pet about312, with stage locks still applying. One elite covers the40-coin magnet. A100-kill +1-elite interval changes from540 expected drop coins to85, before existing stage/boss bonuses and greed effects.

Recommendation: keep current shop prices for this first scarce-gold pass. Lowering prices at the same time would undermine the requested scarcity; evaluate actual completion/drop totals before a separate price change. Expensive accessories remain longer-term goals. No real-money purchase or paid randomness is introduced.

`src/game/coin-drops.js` uses its own seeded coin stream, initialized independently of Math.random. Coin success/failure therefore consumes identical shared combat/supply RNG draws. This is guest-mode gameplay randomness, not anti-cheat or authoritative server reward validation. Tests cover exact15% boundary, guaranteed elites without an RNG call, duplicate-death suppression, reproducible independent RNG and real-kill XP/healing/magnet invariance.

## Latest override: scarce coins, affordable shop, boss-only gear

This supersedes the previous unchanged-price recommendation. All permanent upgrade tiers and pet prices are now exactly one fifth of their prior values (catalog5). Starter magnet40→8, speed60→12, HP50→10; pet140→28. Relic direct purchases60/260/650→12/52/130; earned-coin chest80→16. Duplicate refunds are3/7/14 (floor of previous16/36/72 divided by5), always below chest cost. Premium accessories450/650/900/1200/1500/2200→90/130/180/240/300/440. Stage gates, effects and ownership stay unchanged. Existing saved wallets and purchases are preserved; there is no automatic refund, retroactive charge or reset.

Ordinary enemies still drop3 coins with15% probability (0.45 expected coins/kill). Elites now give guaranteed8 coins and XP only, with no gear chest or battlefield supply roll. Boss defeats retain their guaranteed boss chest; ordinary healing/magnet supply rules remain separate. At100 ordinary kills +1 elite, expected dropped gold is53 (previous scarce-gold pass85, original guaranteed pass540), before boss/clear bonuses or greed. Cheapest8-coin upgrade is about18 ordinary kills in expectation, speed12 about27 and pet28 about63; one elite funds the cheapest starter. Chance means these are not guaranteed kill counts.

Regression coverage includes10000 actual elite kills with no gear/supply, exact80000 combined elite coins, nonduplicate death rewards, actual boss defeat producing exactly one boss chest, immutable/idempotent purchases, insufficient funds, and lower-price persistence through reload. Normal coin RNG remains independent from XP/healing/magnet randomness.

## Hunter update durability follow-up

Ordinary toughness is now 1.62×, an 11.72% increase over the prior 1.45×. This follow-up changes no density, XP, gold or shop values. Historical throughput proxies above describe the earlier 1.45× revision.
