# Technical Architecture & Delivery Boundaries

## 1. Proposed stack (decision candidate, validate with spike)
- **Client**: TypeScript + Vite + Phaser 3 (2D Canvas/WebGL) + data-driven UI/game configs; mobile web/PWA first
- **Game engine**: deterministic fixed-step simulation modules separate from rendering, seeded random, snapshot for tests
- **State**: immutable-ish game state, explicit transitions, versioned IndexedDB (fallback localStorage for non-sensitive settings)
- **Later backend**: authenticated API (Node.js + TypeScript), relational DB (PostgreSQL proposed), entitlement ledger, admin event scheduler, purchase webhook processor
- Repository should stay easy to run locally: npm install, npm run dev, npm test, npm run build; exact stack locked after Phase 0 spike

## 2. Suggested directory architecture (to implement, not yet present)
- src/game/core: simulation clock, RNG, combat, collision, enemy AI, modifiers
- src/game/content: hero/enemy/skill/level definitions and balance tables
- src/game/render: scenes, camera, sprites, VFX pools, texture atlases
- src/ui: lobby, wardrobe, missions, catalog, settings, controls
- src/state: profile, inventory, run results, save migrations
- src/services: repository interface, economy adapter, event calendar, offline stub, later authenticated API
- src/content: versioned JSON catalogs for cosmetics, events, seasons, localization
- tests/unit, tests/integration, tests/browser; scripts for validation and asset manifest generation
- server (only at P2): auth, inventory/ledger, events, shop/payment, admin, audit

## 3. Trust and authority rules
| Data | Phase 0/1 | Commercial |
|---|---|---|
| Physics/combat | Local deterministic | local; server validates competitive/reward claims as needed |
| Save/owned demo items | Local/versioned | server owns entitlements, client caches |
| Skin stats | No gameplay effect | No gameplay effect |
| Event start/end | local test clock | authoritative UTC from server |
| Paid gems/checkout | Disabled | server ledger, provider validation & fraud/rate limits |
| Leaderboards | Disabled | signed run summaries, anti-cheat / moderation |

## 4. Offline-first -> online migration
- Save schema has version, player settings, progression, unlocked free cosmetics; migrations tested from previous version
- On account-link: merge rules explicitly defined. Do not silently overwrite a user's paid inventory; backend authoritative for paid entitlements.
- If network unavailable, core gameplay remains playable; paid/shop claims/events require reconnect and clear UI messaging
- In online mode never accept device clock for event time or client-only purchase confirmations

## 5. Interfaces
- Gameplay emits events: RUN_STARTED, ENEMY_KILLED, SKILL_UPGRADED, BOSS_DEFEATED, RUN_FINISHED
- Progression/mission systems consume validated domain events and produce rewards; no scene directly edits wallet
- Wardrobe writes equipped cosmetic IDs only through entitlement checking
- Cosmetics engine applies visual bundles and never imports combat stat modules
- Server API (planned): /profile, /inventory, /wallet, /events, /missions/claim, /shop/catalog, /checkout/intent, /purchase/verify, /support/restore

## 6. Security & compliance gate
- Secrets never committed or placed in browser bundle; use env secrets on server only
- Provider verification is server-to-server; idempotency keys, signatures, webhook replay protection, ledger/reconciliation, refund/chargeback
- Auth, rate limiting, access controls, minimal personal data, deletion/export process, documented retention, HTTPS, security logging
- Jurisdiction/platform privacy, consumer rights, age requirements and payment rules reviewed before real-money availability
- No real-money payments, account claims, competitive leaderboards until backend and anti-fraud QA complete
