# Survival release verification

## Scope

The release combines the new survival engine with the old production history without force-pushing. The prior master sources and original conflicting player sprites are retained under inactive legacy paths. The active entry point is src/main.js.

Verified behaviors include real pooled-object fusion reuse after all eight success reveals; per-selection reroll receipts and saved offers; ordinary/shared passive propagation into later and fused weapons; low-health healing and abandoned field-supply recovery; reduced enemy population with compensating coins/XP/supply opportunities; distinct animated boss signatures; persistent target selection; first-run interactive practice; local progression migration; guaranteed/direct accessory purchases; boss reward receipts; and slow manual story progression.

Boss stage 1 has a specific actual-update regression: the previous 700-HP candidate could lose all charge attempts to phase interruptions. The final 1400-HP value releases an attack before defeat across 36 seeded starting-distance cases. This is controlled simulation, not human play time.

## Automated and visual evidence

The final staging tree is exported to a separate directory and the complete Node test suite is run there before publication. All runtime module imports and service-worker precache paths are checked. Original legacy source bytes are retained verbatim, including their historical whitespace.

Native canvas contact sheets exercise the real boss and fusion firing/collision/hazard/render functions. They are explicitly labeled controlled native-renderer samples, not browser screenshots. CSS layout, touch ergonomics, device thermals and real-phone FPS need browser/device verification.

Local Chromium launch is blocked by the execution sandbox. The cloud browser can open the public production origin but cannot access the local development server; protected branch previews require Vercel authentication. No protection settings are changed. After production deployment, the exact public entry/module/service-worker bytes and available cloud-browser interactions are checked and reported separately.

## Persistence limits

Progression is local to each origin until a real authenticated server integration is built. Moving between the Vercel preview domain and production does not automatically copy browser storage. The current server adapter is a contract/preparation layer, not an active CODE DESTINY account integration. No production account database is accessed.
