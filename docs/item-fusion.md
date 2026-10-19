# Final fusion update (current rules)

Eight final recipes require BOTH ordinary inputs at Lv8 AND evolved. The ninth absolute_bloom recipe requires THREE: cannon, thorns and molotov, all Lv8 and evolved. Evolution still needs the matching passive at Lv1 and a boss chest. An unevolved Lv8 input returns EVOLUTION_REQUIRED. Existing saved fused outputs remain valid.

A final fused item occupies one slot, retains both evolved parent attack cores, and adds its unique fusion attack. Parent cores use Lv8 evolved stats and damage ×(1.35 + 0.08 × (final item level−1)); bounded at damage600/count20/area3/duration14s/cooldown0.2s. Unique fusion attacks keep their prior caps. Child cores are runtime-only, nonrecursive, restored freshly, reset at stage start, and attribute every shot/beam/field to the final item for cleanup. Their orbital/saw hit channels are independent, with typed buffers expanded safely to24 entries. Rendered orbit cores use the same stats as damage.

Preview exposes requiredEvolution, current evolved state, and inheritedCores including names/descriptions/current stats. The ordinary cannon now evolves into 개화 꽃잎포 (four baseline radial rays). lotus_bloom remains 만개 연꽃포, a two-parent final fusion. The old 만개 spectacle is promoted to 절대 만개 (absolute_bloom): eight baseline radial beams plus three inherited evolved cores, consuming three inputs and freeing two slots. Absolute main damage caps at420; inherited cores use multiplier1.65→2.21, with the same600 cap. Existing saved final outputs remain intact.

Actual collision audit: 30 seconds, identical passive prerequisites, fixed seed, high-HP single boss or18 targets in scattered/corridor layouts. All eight final Lv1 outputs beat BOTH evolved Lv8 parents: minimum ratio1.29, maximum2.02 across tested layouts. This is a stationary-target collision benchmark, not a claim that every moving combat encounter has identical DPS. The helper includes actual projectile/beam/orbit/field collisions and bleed ticks; no nominal-only damage comparison. Existing full update/projectile-render swap tests also pass.

Absolute audit, same three evolution prerequisites and30-second real collisions: single boss13,169→41,293 (3.14×), scattered18 targets64,912→154,210 (2.38×), corridor18 targets255,088→470,730 (1.85×). Inventory commit is atomic3→1; tests cover partially evolved rejection, stale preview, repeated confirm, four slots after a full-six-slot commit, and restore. Attack cores are attributed to the absolute item for exchange/fusion cleanup.

## Earlier implementation notes (requirements superseded by the current rules above)

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

## Run-global boosts and acquisition order

Weapon stats are derived from current player modifiers at use time, not copied when an item is acquired. A maxed passive therefore remains effective for later weapons and fusion outputs. Snapshot restore loads passive levels and recomputes once; it never reapplies additive bonuses to already-modified weapon values. Known passive IDs are validated and levels clamped to1–5 on restore. Stale/repeated passive choices cannot advance beyond the cap (including the former magazine Lv6 lookup that lost its bonus).

Magazine increases bullets, beam rays, thrown fields, saws and orbit petals, subject to each output's existing count cap. Hybrid lotus/saw orbits now include this modifier (five petals maximum). The evolved gas weapon remains one permanent following cloud; projectile count does not duplicate that exceptional single field. Sap applies to hybrid orbit lifetime (2.8 seconds × modifier, capped4.5) and ember secondary field lifetime (3 seconds × modifier, capped6). Scope increases beam length as well as moving projectile speed/range. These modifiers are order-independent, including boosts acquired before the ingredients are fused.
