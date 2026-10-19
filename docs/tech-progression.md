# Tech-focused balance

- Inventory stays six weapons plus six passives. Per-choice rerolls remain one plus purchased bonuses.
- XP requirement: 8 + 7×(level−1) + 10×max(0,level−20) + 16×max(0,level−40). Levels1/10/20/40 cost8/71/141/481, versus4/40/80/300 previously.
- New-item weighting reduced to1.2; absence compensation8% per completed missed session, capped5. Partner multiplier1.35 and the owned-growth card remain. Regen guaranteed only at choices5 and10, subject to eligibility; thorns choice4 remains.
- All fused outputs multiply damage by1+0.08×(item level−1), before existing220 damage cap. Multiplier1/1.32/1.56 at levels1/5/8. Evolved ordinary weapons gain an additional1.35 damage multiplier. No projectile/field counts increased.
- 지옥 불꽃길 is evolved molotov. Its evolution damage factor1.5→2, area1.3→1.6, and duration factor1→2.2. Its moving trail base radius30→64; lifetime2→6 seconds scaled by sap, capped10. At level8 without passives, trail radius52.65→138.24; max spread207.36 and max sap9.6s. Trail damage remains60% of evolved tick damage. Existing0.3-second creation cadence yields at most34 live trail patches for one weapon; existing hazard pool still bounds all fields.
- Deterministic tests distinguish low-level scattered weapons, invested paired parents, and final fused output using damage×projectile-count/cooldown. This is a repeatable tuning proxy, not a claim of universal live DPS: piercing, spread, slow, hit rate and overlap vary by encounter.
- Actual field tests cover ellipse inside/outside hits, surviving beyond old2s lifetime, expiry at6s, passive multiplication once, restore, and maximum duration/damage caps.
