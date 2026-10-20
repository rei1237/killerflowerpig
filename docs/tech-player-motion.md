# Tech-aware flowerpig motion

Six authored eight-frame families cover the actual weapon registry. Each has a complete base, cape and jade body; standard and legendary firearm variants are retained. The 21 complete sheets contain 168 poses. Inventory icons are never pasted over the body. Halo remains a separate head-occluded layer.

| Motion | Weapons / actual attack |
|---|---|
| Firearm | shotgun, rifle, scatter_rail, toxic_scatter, doom_barrage; separate legendary lotus-gun volley |
| Dual pistols | pistols, burst_rail, guillotine |
| Throw | molotov, non-follow gas, plague_fire, plague_end; actual inherited bottle sub-attacks |
| Braced cannon | cannon, lotus_bloom, ember_lance, absolute_bloom |
| Blade launch | saw, venom_saw, orbit_saw, carnage_saw |
| Lotus channel | thorns activation, evolved gas follow-field creation |

Inherited fusion cores retain their real attack family and use the parent weapon's tier/color. Evolved, fusion and absolute attacks hold the authored peak pose longer, in addition to bounded release accents; tier distinction is not only tint. No damage, cooldown, RNG, projectile movement or hitbox is changed by this cosmetic state. Reduced-motion preferences cannot change projectile coordinates.

Each actual attack is marked at release, so there is no visual windup delay added to gameplay. Simultaneous events are arbitrated by tier, tech affinity and main-versus-inherited source. Readability holds are 110 ms normal, 125 ms evolved, 150 ms fusion and 180 ms absolute. No stale attack is queued. Continuous fields and orbit damage ticks never retrigger the body; activation is marked once. Idle returns to the selected tech's ready stance; Lotus Garden starts in a braced cannon stance and new runs own both thorns Lv1 and cannon Lv1.

Full body sheets are lazily loaded with a four-body resident/requested cap and two cached hurt-flash sheets. The known-good standard base remains a fallback. Missing costume-family art requests the matching uncostumed family; if both fail, a neutral ready frame is shown instead of animating a rifle while throwing. Warming happens after the current draw so it cannot invalidate a selected image or flash canvas mid-draw. Optional assets never alter purchases or combat effects.

The fitting room exposes the same six families and uses the shared renderer without modifying the run or save. `node tools/tech-motion-native-qa.mjs` exercises 144 tech/costume poses and exports a real-time six-family comparison. The additional 24 legendary firearm poses are covered by the firing comparison. These are native controlled renders, not phone captures.
