# Item-only growth and explicit two-item fusion

The ordinary `cannon` (꽃잎포) is a normal acquired weapon, upgraded from item level 1 to 8 through run item choices and combat chests. Its automatic beam shares the normal weapon cooldown loop. There is no global charged attack or permanent-character-level multiplier. Run XP only opens item-choice opportunities; the old permanent character XP/reward fields are retained inert in save v4. No wallet, pet, relic, upgrade or previous save backup is removed or converted.

## Recipes
Both inputs must be owned and at least item level 5. Confirmation consumes both and creates the output at level 1; the output occupies one slot, freeing one of the six weapon slots. The UI previews current ingredients, levels, output stats and this level reset. Evolved inputs display their evolved names and are explicitly consumed too. Outputs upgrade to level 8 normally, but never appear as unowned random drops.

- `lotus_bloom`: `cannon` + `thorns` → 만개 연꽃포. At base output level: 50-damage piercing beam every 3.8 seconds, length 560/width 44, plus three orbiting petals dealing 14 damage with 0.45-second hit cooldown, radius 90, lasting 2.8 seconds. Item upgrades improve beam and orbit damage/area together; orbit count reaches five.
- `scatter_rail`: `shotgun` + `rifle` → 관통 산탄포. Seven spreading bullets, 18 damage each, six-target piercing, 800 speed and 0.8-second lifetime, every 1.35 seconds. Upgrades improve damage, penetration and pellet count.
- `plague_fire`: `molotov` + `gas` → 역병 화염병. Two thrown fire fields, radius 72, nine damage each 0.3-second tick, lasting 3.6 seconds, and 45% enemy slow. Upgrades increase damage, area, duration and slowing; boss immunity to movement slow remains unchanged.

Normal equipped passive/shop/relic bonuses apply. Fused stats are bounded: damage ≤220, area multiplier ≤2, cooldown ≥0.5 seconds, duration ≤6 seconds (beam ≤0.7), pierce ≤12, slow ≤65%. Projectile limits: lotus beams3, plague fields5, scatter pellets12. These are local balancing bounds, not server anti-cheat guarantees.

## API and safety
`previewFusion(recipeId)` returns eligibility, a reason code, ingredient ownership/current/required levels, output level1/stats and a signature. It does not mutate inventory. `fuseItems(recipeId, signature)` verifies live mode, exact inputs and levels, capacity, duplicate output, and unchanged preview inventory/buffs before one inventory replacement. Signature binds recipe, stage/session, inventory including evolution/slots and player stats. Double confirmation cannot create a second output. Closing preview consumes nothing.

Consumed parent shots/fields/beams are retired so they cannot continue attacking indefinitely after fusion. Surviving item slots and projectile hit channels are remapped, and hit cooldown maps are reset. `itemsFused` signals the successful transition. Build snapshots serialize output IDs and item levels; ordinary restore reconstructs correct runtime state without changing the saved wallet or archived XP. Unknown loaded item IDs are excluded and item levels are clamped to1–8.

The UI owns modal pausing and whether to checkpoint immediately after fusion. The baseline game's run snapshot persists at stage boundaries, so current-stage actions otherwise follow its normal restart/continue policy. No server backend was introduced. Future authoritative fusion should receive recipe ID, item instance IDs, expected inventory revision and idempotency key, then validate levels and atomically consume/produce server-owned items.
