# ARCANA SURVIVOR — Concurrent Team Work Order

Mission status: **APPOINTED / START_AUTHORIZED / WORKER_SESSIONS_NOT_YET_CONFIRMED**.
CEO integration board: [#21](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/21).
Governance: [appointment-CEO RULES](https://github.com/tanawutmalirum29-ux/appointment-CEO/blob/main/RULES.md).
Baseline: `ae1c5706f22ca05a60f4cf4201e6ad3ed63b18fd` (2026-10-20).

## Ready-to-run parallel lanes
| Role | Appointment | Git branch | Owned files | Scope |
|---|---|---|---|---|
| ENGINEER-GAME | [#22](../issues/22) | `feat/team-gameplay-balance` | `src/engine.js`, `tests/engine.test.js`, `src/gameplay/**`, `tests/gameplay/**` | Combat #3, skills #4, boss #5 |
| ENGINEER-VFX | [#23](../issues/23) | `feat/team-visual-skins` | `src/render.js`, `src/styles.css`, `src/visual/**`, `assets/**`, `tests/visual/**` | Skin preview #20, VFX #7, wardrobe #8 |
| ENGINEER-ECONOMY | [#24](../issues/24) | `feat/team-economy-free` | `src/economy/**`, `src/content/economy/**`, `tests/economy/**`, `docs/ECONOMY_IMPLEMENTATION.md` | Local earned-only Gold/Dust/craft #9, save schema proposal #6 |
| ENGINEER-EVENTS | [#25](../issues/25) | `feat/team-events-season` | `src/events/**`, `src/content/events/**`, `src/content/seasons/**`, `tests/events/**`, `docs/EVENTS_IMPLEMENTATION.md` | Daily/weekly #10, S01 content #15, 50-level pass prototype #11 |
| QA-REVIEWER | [#26](../issues/26) | `test/team-qa-regression` | `scripts/browser_qa.py`, `tests/qa/**`, `docs/QA_TEAM_REPORT.md` | independent QA #14 and mobile #2 |

**CEO-only shared wiring:** `src/main.js`, `src/storage.js`, `index.html`, `package.json`, `.github/workflows/ci.yml` and source-wide architecture refactors. No engineer touches these without an explicit CEO-issued scope revision and an integration lock.

## Activating workers (each independently)
Send one message **in a separate chat for each role**, exactly:
```
ENGINEER-GAME: AP-ROLE #22 https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/22
ENGINEER-VFX: AP-ROLE #23 https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/23
ENGINEER-ECONOMY: AP-ROLE #24 https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/24
ENGINEER-EVENTS: AP-ROLE #25 https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/25
QA-REVIEWER: AP-ROLE #26 https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/26
```
Subsequent invocation: `ROLE: MN #N https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/N`; `I`/ `ST`/ `TR` per COMMANDS.md. A role Issue's creation does NOT run an AI worker in the background. Only workers actually opening their Issue begin work; no fabricated acknowledgments.

## Synchronization contract
1. **Worker START**: reads central rules, role scope and current main. Checks head of own branch; if main advanced, safely update own branch before proposing PR.
2. **Implementation**: code and test exclusively owned paths, submit PR with exact paths and evidence. `API_REQUEST` in appointment Issue if another role's files are needed. Do not independently change integration files.
3. **CEO review**: inspect changed files, reject scope violations, check determinism, free-vs-paid entitlement and cosmetics invariants, run unit/build + Chromium/WebKit five viewports. Wait for QA reviewer evidence; no inventing actual iOS/Android testing.
4. **Integration**: one PR at a time, record commit SHA, run CI again on main. After economy merges, adapt events to the **documented API** before events PR merge, without rewriting another team's files.
5. **Closeout**: mark child work complete only when merged verified; CEO closes #21 when all scoped work delivered, perform PF; remove only completed temporary branches after ensuring no one depends on them.

## Merge order (dependencies, not enforced release dates)
- Independent review can run simultaneously. Suggested first: GAME and VFX (separate files); ECONOMY free module; EVENTS only after contract compatibility with ECONOMY; QA tests can merge whenever no role file collision; CEO exclusive wiring integration occurs after source modules merged.
- Do not require ECONOMY developer to edit EVENTS files or vice versa.
- Open issues #12 server and #13 real-money payments stay HOLD; this mission does not authorize production entitlements, online rewards, checkout, paid pass ownership or a public launch.

## Minimum QA evidence
- `npm test`, `npm run build`
- `scripts/browser_qa.py --served --browsers chromium webkit` across 320x568, 390x844, 768x1024, 844x390, 1440x900 on an HTTP origin
- Seeded reproducibility, correct boss victory and loss paths, no-stat skin equality, no duplicate free reward claim, UTC/claim grace rules, reduced effects readability.
- Physical touch hardware and actual FPS must be explicitly marked NOT VERIFIED if not tested.

## Operational reality
Different Git branches and separate Issues enable **independent concurrent collaboration** without overwriting each other's work, but GitHub does not automatically create or run AI agents. CEO review/integration happens when this CEO session is invoked; a passing CI cannot replace real human/agent content and product judgment.
