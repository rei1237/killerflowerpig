# Tech identity and practical combat update

Baseline: `bddb389f`, preserving the concurrent rare-gold economy, late-stage enemies and boss HP.

## Cannon: real cadence and coverage

꽃잎포 is an instantaneous hitscan beam, not a traveling projectile. No fictitious projectile-speed upgrade is shown.

| Level | Neutral interval (seconds) | Directions | Base damage |
|---|---:|---:|---:|
| 1 | 2.600 | 1 | 28 |
| 2 | 2.366 | 2 | 40 |
| 3 | 2.132 | 3 | 40 |
| 4 | 1.898 | 4 | 40 |
| 5 | 1.664 | 5 | 40 |
| 6 | 1.430 | 6 | 55 |
| 7 | 1.196 | 7 | 55 |
| 8 | 0.962 | 8 | 75 |

Evolution doubles directions and multiplies interval by0.85. All inherited cannon cores keep the same evolved curve. A volley hits each target once: extra directions improve coverage, not overlapping point-blank boss damage. Maximum16rays, minimum0.3s, and24 decorative petals per volley. Excess magazine/tech rays convert to damage once, capped at2×; this compensation follows the inherited-core damage cap so ordinary equipment investment still matters.

Inherited cannon uses the same1.6 evolved tier factor in every owner. Absolute Bloom's factor is1.4 and Plague End's1.0, maintaining their own consumed-path premium without multiplying unrelated weapon tiers.

## Five roles

- 탄막 사수: unchanged aimed pellets, pierce and general-purpose ranged reliability. No extra survival bonus.
- 연꽃 정원: expanding radial coverage, nearby orbit protection, HP/regeneration. A focused target does not take all radial beams at once.
- 역병 화염:0.35s ballistic throws; focus-first predicted landing, footprint-aware elliptical clusters and same-kind coverage avoidance (including airborne bottles). Scans are bounded to64 enemies and64 coverage objects. First resonance gives one additional throw,15% shorter cooldown and20% slow. Lv5 adds25% field damage through the weapon-investment imprint. Plain fire and evolved trails now actually carry slow. A later turn/teleport can still evade the fixed landing point.
- 처형자: pistols have15% base crit and3.25× base critical damage. Only this tech's dual-pistol family adds0.75 to the critical multiplier; maintaining the same explicit focused target through impact adds12 percentage points of crit chance. Ordinary-enemy execution is a separate3–8% actual-hit roll at any HP, never a boss/elite HP-threshold effect.
- 도살자: the first saw predicts measured target movement; all saws use swept collision against the existing body capsule. A real144-degree sword arc is its own inventory weapon, with eight levels and evolution through 날 연마. New runs start with 도살검Lv1 and 톱날Lv1 in two slots. Existing runs are restored as saved. Both evolved Lv8 ingredients are consumed to create 학살자의 검륜Lv1, retaining each evolved attack core. No hidden free sword or invulnerability is granted.

## Aimed launch geometry

Aimed firearms and the first Butcher saw now calculate their direction from the exact selected muzzle position, retaining that origin through release. This corrects vertical and near-vertical misses caused by aiming from the body center but spawning28.8px to its side. Saw interception uses the same origin. Unaimed radial shots and hitscan beam timing remain unchanged.

## Execution safety

Execution chance is3% plus2 percentage points at weaponLv5 and3 at resonanceIII (maximum8%). It applies only to Executioner's pistols, evolved/inherited pistols, burst rail and guillotine. Old8/10/15/20%-HP threshold execution is removed. Dead targets cannot roll again or grant duplicate rewards. Focus requires the captured object, captured generation ID, and current focus to match; retargeting or pooled reuse invalidates the bonus.

## Visual identity

Seven attack families include a genuinely drawn sword swing in all three outfits. Five tech resting archetypes have separate eight-frame locomotion sheets: four breathing/cloth idle frames and four actual walking poses. Shop defaults to the selected tech and exposes idle/walk/attack previews. Actual weapon lineage determines the resting prop after exchanges/fusions. Legendary gun attacks return to the tech stance afterward. Missing non-gun art never substitutes a held rifle.

## Validation method and limitations

The old1.35× averaged static-dummy equality test hid different roles and never exercised execution or incoming damage. It is replaced with reproducible per-tech baseline floors, own-path progression, equal-investment boss/coverage/sustain contracts, moving targets and finite-HP pressure diagnostics. Immortal damage targets are elite to exclude instant-kill inflation. These automated scenarios are not claims of human clear times or phone playtesting.

The paired saw probe disables the new sword and compares only aim/sweep. The expanded40-seed probe covers48 sparse horizontal/vertical scenarios at60Hz and10Hz (1,920 volleys per version). Contact improves55.9%→95.3% overall without any scenario regression. Direct vertical approach improves40%→100% at60Hz and22.5%→100% at10Hz. Distant focused targets beyond the vertical screen edge remain vulnerable to early ricochet; the worst final scenarios are40–47.5%, not100%. No enlarged hitbox or invisible homing is used.

## Thirty-seed pressure evidence

See tech-role-evidence.json for source hashes, seed lists and exact scenarios. Each preset uses actual enemy/weapon/player collision, but no pickup collection, leveling, healing drops, permanent purchases or adaptive player decisions. This is not a human clear-rate estimate.

The deliberately underleveled stage6 test has two **unevolved Lv6** weapons and three Lv3 passives (21 item levels). Enemies appear every0.6s at210×180 distance and the player follows a fixed150-radius circle. Mean survival seconds / kills: Gunline26.48/30.17, Bloom56.61/84.53, Executioner49.79/74.67, Butcher48.41/64.73, Plague19.10/14.90. Plague remains vulnerable before evolution; this weakness is disclosed rather than hidden by a static DPS average.

A legally evolved preset has two **Lv8 evolved** route weapons, their required passive partners and25 total item levels, plus two separately earned evolution rewards. All five survive60s in30/30 seeds. Mean kills / HP remaining:

|Tech|Kills|HP remaining / max|
|---|---:|---:|
|Gunline|96.90|83.74 /100|
|Bloom|99.97|180 /180|
|Plague|97.87|63.90 /100|
|Executioner|100|100 /100|
|Butcher|96.70|173.90 /190|

Plague also survives30/30 at300-radius movement,97.33 kills and62.13 HP. Coverage-aware targeting has small mixed aggregate effects, so no aggregate performance gain is claimed from that change alone. It fixes observable wasted-placement cases. The actual progression audit's stage5 build is characterLv29 with six weapons and two evolutions, substantially above the21-level unevolved stress preset.

Sword close-boss80px DPS: evolved sword+saw1,077 → finalLv1 2,637 → finalLv8 2,936; existing absoluteLv1 4,436, Lv8 6,289. At finalLv8 stationary boss, Plague may exceed Gunline through sustained overlapping fields; a real escaping target receives less than half the stationary field exposure/damage while the field stays at its original landing point. This role-specific limitation replaces an inappropriate universal stationary-boss ordering.

Art verification:168 attack cells across7families×3outfits, plus120 idle/walk cells across5families×3outfits. Native50fps MP4s use the shared runtime renderer; no browser or physical-phone testing is claimed.

## Final aggregate verification

`node --test tests/*.mjs`:673/673 passed before publication. `git diff --check` passed. The optional local Chromium shop smoke test could not launch: temporary browser socket creation was denied by the execution sandbox; the approved outside-sandbox attempt failed in the environment wrapper before Chromium started. `tools/tech-shop-browser-qa.mjs` is provided for rerunning in a browser-capable environment, but is **not** included in the passed-test claim. Native renderer and deterministic DOM/storage tests are the verified evidence here.
