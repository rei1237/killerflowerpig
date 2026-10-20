# Nongun efficiency and consumable thorns

This change preserves the ordinary shotgun, rifle and pistol definitions, including the existing critical-hit behavior. The separate cannon redesign is owned and measured independently. No art changes are part of this pass.

## Final data curves

Values below are registry values before passive/tech/evolution multipliers.

| Weapon | Previous → final damage, Lv1 / Lv4 / Lv8 | Other changes |
|---|---|---|
| Bone saw | 10 / 14 / 19 → **18 / 25 / 34** | Base cooldown 3.4→2.8s; Lv4 cooldown −8%, Lv8 another −8%; speed 360→410; lifetime 3→3.2s; size +15% at Lv5 and +25% at Lv8 |
| Molotov | 5 / 7 / 10 → **8 / 11 / 15** per tick | Radius 46→60, a **70.1% larger ellipse footprint**; cooldown 3→2.65s; tick 0.3s and duration 2.6s unchanged |
| Gas grenade | 3 / 5 / 8 → **6 / 9 / 13** per tick | Radius 98→106, a **17.0% larger footprint**; cooldown 4.5→3.8s; tick 0.4s and duration 20s unchanged |
| Sword | 24 / 30 / 48 → **28 / 36 / 58** | Reach 100→110; existing cooldown curve, arc cap and one swing per release preserved |
| Lotus thorns | 8 / 11 / 15 continuous tick → **54 / 72 / 96 per consumed petal** | New charge mechanic described below; Lv5 damage78, Lv7 damage96 |

Molotov's unmodified duration/cooldown ratio rises from 0.867 to 0.981; Gas's rises from 4.444 to 5.263. Actual Plague resonance further modifies both duration and cooldown, once. These ratios describe available field lifetime, not guaranteed target occupancy: fields remain fixed ellipses, and moving enemies can leave them.

Saw already penetrated indefinitely (`pierce=9999` at emission). This pass does not invent a pierce upgrade. Faster traversal, higher contact damage, shorter release interval and level size growth improve unique coverage while retaining swept body collision, the per-core repeat-hit cooldown, six emitted saws per volley, the short retiring volley and overflow-to-damage behavior.

The normal field count/fade limits, evolved moving-fire trail lifetime and following-gas singleton remain unchanged. The final 30-seed mid Plague route peaks at 12 live/retiring fields, the same as the earlier candidate. Gas's final 5→6 candidate was separately tested: moving mean clear time improved 9.075→8.606s without increasing this peak.

## Consumable thorns

- Each actual visible petal has its own ready state and deadline. Contact damages one victim and spends that petal **before** damage/kill callbacks. It immediately disappears.
- A victim can consume at most one petal from a given core in one update, even if a large boss overlaps the whole ring.
- Base regrowth is **1.6s**, becoming **1.2s at Lv4** and remaining 1.2s through Lv8. Evolution multiplies this by 0.85, yielding **1.02s** before cooldown modifiers.
- Counts remain 2 initially, 3 at Lv2, 4 at Lv6 and 5 at Lv8; evolved count is 6 before passive bonuses. The existing 8-petal rendered/active cap and overflow compensation remain in force.
- Player and tech cooldown modifiers are included exactly once. Regrowth has a 0.35s safety floor. The current source damage and other fusion caps remain in force.
- Level/evolution growth adds only genuinely new slots; spent existing slots retain their deadlines. A new player, rewound clock, stage change or changed stage-start identity resets the state and prevents stale teleport sweeps. Checkpoint restoration reconstructs weapons without old charge state.
- Relative-motion collision sweeps the real petal orbit and enemy travel, with a conservative broad phase, at most 64 segments, and no enlarged collision radius. Stalled-frame rotation is capped at 0.25s. A regenerated petal can hit at most once in that update; no catch-up loop creates extra attacks.
- Blocked/invulnerable boss contact still consumes a petal, but heals only if `hurt()` returns positive damage.
- Hybrid weapons' separate continuous orbit attacks remain separate; retained evolved **thorns** cores use independent charge states.
- Drawing reads the same slot mask without mutating it or closing gaps in the ring. Korean descriptions and fusion stat text describe per-petal consumption and regeneration.

This is intentionally a stronger-hit, finite-charge defense rather than continuous tick damage. The first charge candidate was too slow at mid-game, so the accepted curve was increased and regrowth front-loaded. The final solo mid moving probe retains a measured sustain tradeoff (about 24.4s versus 21.5s previously), while base and evolved moving clears improve. This limitation is reported explicitly rather than presenting static damage as proof of blanket superiority. The equal-budget Bloom route also has its actual resonance cooldown and separately revised cannon.

## Evidence

Final focused verification: **132 tests passed**, including all15 thorn lifecycle/collision/rendering tests and all23 tier-hierarchy tests. Both final paired reports record no source changes during execution, and all18 Gunline/Executioner control scenes match exactly.

- `nongun-mid-30seed-evidence.json`: **30 paired seeds**, actual 24-enemy finite waves, dense/spread/moving geometry, stage4 HP, equal mid investment; historical continuous-thorns runtime versus final runtime in two fresh processes.
- `nongun-base-evolved-evidence.json`: three paired seeds at stages2/6, legal equal-budget base/evolved builds.
- `nongun-mid-continuous-thorns-30seed-evidence.json`: **superseded intermediate experiment**, prior to the user's consumable-thorns request. It is retained for provenance and is not the final thorn result.
- `thorn-charge-performance.json`: 180 enemies, three independent inherited cores, requested20 stat petals/core capped to8 actual petals/core; 900 calls per60/10/4FPS step size. This is a Node timing diagnostic, not a mobile-frame guarantee.

The paired benchmark uses the real enemy spawn health, pursuit, separation, slow, bleed, knockback, body collision, damage and death paths. Player invulnerability isolates clearing efficiency; this is not a survival/win-rate claim. No immortal targets, artificial HP multipliers, permanent upgrades, equipment, pets or pickup/level-up feedback are used.

Initial-volley unique coverage is measured separately for four seconds. For consumable thorns, only the initial ready petals are counted, with later regrowth disabled in that diagnostic. A moving Molotov's unique first-volley coverage does not improve in every scene, despite stronger kills and shorter complete-wave clear time.

The current 30-seed mid controls keep Gunline and Executioner unchanged. Saw spread first-volley distinct targets rise **6.667→9.400**. Representative full-wave means:

| Route/weapon | Dense before→after | Spread before→after | Moving before→after |
|---|---:|---:|---:|
| Saw alone | 11.656→8.584s | 14.809→10.320s | 19.449→12.605s |
| Plague, equal budget | 6.311→3.128s | 10.162→7.236s | 12.579→8.606s |
| Butcher, equal budget | 5.445→4.895s | 6.708→5.739s | 8.003→6.806s |

Reproduce:

```sh
node --test tests/thorn-charges.mjs tests/nongun-wave-efficiency.mjs tests/gas-range.mjs tests/sword-progression.mjs tests/global-passives.mjs tests/tier-order.mjs tests/saw-aim-collision.mjs tests/plague-targeting.mjs tests/weapon-vfx.mjs
node tools/nongun-paired-qa.mjs --phases=mid --seeds=$(seq -s, 1 30)
node tools/nongun-paired-qa.mjs --phases=base,evolved --seeds=1,7,13
node tools/thorn-charge-qa.mjs
```

The historical runtime fixture is used only by the read-only benchmark loader; the app never imports it. Exact source hashes are recorded in each report.
