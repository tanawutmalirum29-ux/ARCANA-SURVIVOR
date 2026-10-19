# Delivery Roadmap, Dependencies & Epic Backlog

## Release sequence (no dates promised)
| Phase | Must deliver | Completion / QA Gate |
|---|---|---|
| P0 Foundation | project scaffold, visual benchmark, fixed-step game loop, input/HUD | all viewports render, tests/build pass |
| P1 Playable | one map/hero, 3 enemies, boss, 4 skills, result screen, local save | 10-minute full run repeatable; combat tests & real browser smoke |
| P1.5 Beauty | cosmetic schema, wardrobe, 8 skins, quality levels, VFX profiling | change outfit without stat difference; 30FPS Low target tested |
| P2 Economy/Content | Gold, dust, achievements, crafting, daily/weekly mission and event config simulation, 50-tier season prototype | complete free reward earn/claim flow, no duplication |
| P2.5 Online | account, migrations, server inventory/ledger, remote event scheduler, admin, telemetry/consent | idempotency, offline/online conflict, staging tests |
| P3 Commercial | provider sandbox, verified billing, refund/restore, legal/privacy review, live support and rollout | payment readiness checklist all GREEN |
| P4 LiveOps | S01 launches + operations; seasonal cadence, archive/rerun, improvements | season dry run, monitoring, rollback rehearsal |

## Dependency graph
Foundation -> Combat/Skills/Boss -> Save/Reward -> Cosmetics -> Inventory/Free Shop -> Missions/Event Config -> Season Prototype -> Backend Ledger/Auth -> Payment Sandbox -> Commercial -> LiveOps.
Parallel tracks: Art Bible/VFX test can start after foundation; UX QA and accessibility start day one; gameplay balance independent of paid monetization.

## Epic identifiers & scope
- ARC-01 Engineering Foundation: build scripts, lint/test, responsive canvas/layout
- ARC-02 Controls/HUD: joystick, keyboard, pause, settings, small screens
- ARC-03 Combat Core: fixed loop, projectiles, collision, enemy behavior
- ARC-04 Skills/XP: skill pick, upgrades, progression
- ARC-05 Boss/Run Results: patterns, difficulty, rewards and replay
- ARC-06 Save/Meta: local schema, migration, profile/achievement
- ARC-07 Art/VFX Framework: particles, fallback, accessibility
- ARC-08 Skins/Wardrobe: equipment, catalog/preview, no-stat boundary
- ARC-09 Economy/Rewards: currency, crafting, achievements, sinks, wallet adapter
- ARC-10 Event Engine: event config, missions, schedule, token shop, grace windows
- ARC-11 Season Pass: 50-tier dual track, missions, claims, rollover, 4-season year plan
- ARC-12 Cloud Backend: auth, inventory, grants, idempotency, analytics/privacy
- ARC-13 Real-money Store: verified checkout/refund/restore; HOLD until ARC-12
- ARC-14 QA Automation: unit/integration/browser/performance/accessibility gates
- ARC-15 Content Production: S01 art/skins/events/localization
- ARC-16 Live Operations: scheduling, admin, rollback, incident response, archive

## Definition of Ready for any Issue
Problem/user scenario, exact scope, referenced design file, dependencies, acceptance criteria, test plan, mobile viewport impact, no-stat-skin assertion when relevant.

## Definition of Done
Implementation + tests + real-browser proof where UI; no regression; docs/data updated; responsive viewport checks; security/privacy checks where applicable; review then merge to main; rollback known.

## Scope constraints
- **Do not build all 4 seasons before P0 works**; first-year plan is content direction, not content already implemented.
- No payment/live shop until account/ledger/checkout security operational.
- Features from Later bucket are proposal-only until gameplay retention validates them.
