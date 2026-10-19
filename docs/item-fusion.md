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

## Expanded recipe roster (eight total)

The original three recipes remain unchanged. Five additional recipes also require both original weapons at Lv5; consume both into one Lv1 output; and use the same preview/signature, slot cleanup, level cap and run checkpoint rules.

- `burst_rail`: pistols + rifle → 연쇄 관통권총. Three timed shots per burst (0.07 seconds apart), 17 damage and five-target piercing each, 900 projectile speed, 0.8-second flight, 1.2-second weapon cooldown. A pending burst is not overwritten when cooldown bonuses would otherwise fire the next burst early. Maximum eight rounds per burst.
- `venom_saw`: saw + gas → 맹독 회전톱. Two bouncing saws, 14 damage per hit, 0.4-second repeat-hit cooldown, 3.2-second flight and 45% on-hit enemy slow. Maximum four saws per activation.
- `ember_lance`: cannon + molotov → 화염 꽃잎창. A 48-damage piercing floral beam (540 length / 40 width) plus one thrown fire field (54 radius, 7.68 damage per 0.3-second tick, three-second duration), every four seconds. Field damage is 16% of the upgraded/modifier-adjusted beam damage. Maximum two beams and two fields per activation. Field/beam share area upgrades but use separate bounded durations.
- `orbit_saw`: thorns + saw → 연꽃 톱니진. Two bouncing saws dealing 18 damage plus three close orbiting petals dealing 10.8 damage. Orbit radius78, lifetime2.8 seconds, cooldown3.8 seconds, repeat-hit cooldown0.4 seconds. Orbit damage is60% of saw damage; orbit count grows to five, saw count caps at four.
- `toxic_scatter`: shotgun + gas → 맹독 산탄총. Six spread bullets dealing14 damage, three-target piercing, 40% on-hit enemy slow, cooldown1.3 seconds. Maximum10 pellets per activation. It does not create a lingering fog or trigger recursive explosions.

Slow applies to regular enemies through existing hit handling; existing boss slow immunity is retained. Secondary effects use their fusion output ID for damage attribution, and all parent effects are retired on fusion. None of these effects spawns additional shots on hit or on kill.

Preview API additionally exposes `fieldDamage`, `fieldAmount`, `fieldRadius` (already area-adjusted), `fieldDuration`, `fieldTick` for ember_lance. `orbitDamage`, `orbitAmount`, `orbitRadius` (already area-adjusted), `orbitDuration` are exposed for both lotus_bloom and orbit_saw. Generic damage/amount for orbit_saw describe its saws. `slow` is a fraction, e.g.0.45 means45%. Raw beam length is multiplied by sqrt(area), beam width and field radius by area for display and collision.
