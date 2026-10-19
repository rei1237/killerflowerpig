# Run item-choice weighting

These are Flowerpig tuning values, not Vampire Survivors probabilities. Poncle's official [Steam description and starting tips](https://store.steampowered.com/app/1794680/Vampire_Survivors/) describe run choices and recommend starting with a few offensive weapons, then focusing upgrades. No assets or implementation copied.

- Owned ordinary weapon weight remains 3; owned fused output weight is 0.75. Fusion-only items cannot drop as new ordinary choices.
- Eligible unowned items multiply their existing weight by 1.2. Items absent from offers gain a further 8% per completed eligible choice session, capped at five misses (1.4×).
- A missing recipe partner of an owned ordinary weapon gains 1.35× once, even when several recipes match. Evolved ordinary parents are eligible. An already-owned output blocks that recipe's partner boost.
- Existing thorns/heart/regen weights and evolution-passive bonuses remain. Thorns Lv4 and missing regen Lv5/Lv10 guarantees remain.
- Only completed choice sessions advance absence. All offers across the session's paid rerolls count as seen. Seen items reset to zero; newly acquired items clear their absence. Reopening, stale completion, duplicate IDs, and restore cannot increment it again.
- Snapshots copy the current session's offered/eligible IDs and capped absence map; legacy snapshots default to empty history. No permanent economy schema changes.
- Slot eligibility, level caps, bans, unique card draws, and exhausted-build heal/gold fallback remain unchanged. Chest rewards are unchanged.

Discovery multipliers were moderated for the tech-focused difficulty pass: unowned 1.6→1.2 and absence 15%→8% per missed completed session. Earlier first-card share figures are superseded; exact rates vary with eligible loadout.

Three-or-more-card offers reserve one slot for an eligible owned ordinary weapon/passive upgrade, selected by its existing weight. This never reserves a fused output, and coexists with both discovery guarantees. Thus the final three-card UI always offers ordinary growth when available; the single-card simulation above measures underlying weights only.
