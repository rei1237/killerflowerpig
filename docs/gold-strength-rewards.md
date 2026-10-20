# Strong-enemy gold and guaranteed boss bounty

Current shop prices: [higher gold shop prices](shop-pricing.md). Price examples below describe earlier revisions and are superseded by catalog 6; reward rates and item effects remain unchanged.

Latest request replaces the former ordinary0%, elite30%×6, clear5×stage economy. Prices and existing wallets/purchases are unchanged.

| Enemy | Chance | Bundle | Expected coins/kill |
|---|---:|---:|---:|
| Shambler, runner |0%|0|0|
| Spitter, suicider, gunner |15%|2|0.30|
| Brute, bloater, splitter |30%|3|0.90|
| Hulk |55%|5|2.75|
| Any elite variant |80%|10|8|
| Boss |100%|20+5×stage|25–70|

The boss drops one visible auto-pulling coin bundle and its existing gear chest. Stage-clear recovers that same bounty if not yet collected, rather than awarding a second bounty. A stable boss-bounty:run:stage receipt prevents replay credit on duplicate deaths, retry or reload. Bounty bundles never merge into ordinary coins, so their identity cannot be lost at the180-item budget; at most one additional boss bundle exists. Failed writes retain the pickup for retry. Existing chest fallback coins remain a separately disclosed chest reward, not another copy of the bounty. Elite gear exclusions, XP, healing/magnet RNG and prices are unchanged. Dedicated coin RNG never consumes shared combat/supply RNG.

Expected collected income from actual seeded director/death simulation is in coin-income-audit.json, reproduced by node tools/coin-income-audit.mjs. Assumptions: seed7, ordinary16s/elite48s residency,85% field coin collection, boss guarantee, greed1. This is not combat survival/DPS evidence, and excludes boss-phase ordinary kills.

| Stage | Previous expected | New expected including boss |
|---|---:|---:|
|1|6.53|35.63|
|2|11.53|44.45|
|3|18.06|131.99|
|5|28.06|238.12|
|10|53.06|595.81|

A stage1 clear can now support the30-coin first attack training; stronger late waves fund the80–180 training tiers. Late income rises substantially because strong types are common, while weak mobs never flood the field with coins. Shop prices were not increased to offset the requested relief. All values are local guest-mode rules; an eventual server must authorize kills and atomically enforce account/run/stage reward uniqueness.

Replay hardening: boss/chest/clear completion lives in a separate durable32-run ledger, at most30 flags per run. The active checkpoint run is explicitly pinned during pruning. Free cosmetic equip actions cannot evict those flags. Existing v5 generic receipts migrate where still available; already-evicted historic receipts cannot be reconstructed. Stage-clear commits bounty, receipt, kills, unlocks and titles in one write. A failed commit leaves all unchanged and presents a save-retry button, without advancing the checkpoint. New precache dependency: src/core/run-rewards.js.
