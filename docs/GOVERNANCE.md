# ARCANA SURVIVOR — Project Governance

**Authoritative general policy:** https://github.com/tanawutmalirum29-ux/appointment-CEO/blob/main/RULES.md
**Authoritative commands:** https://github.com/tanawutmalirum29-ux/appointment-CEO/blob/main/COMMANDS.md
**Parallel mission scope:** [TEAM_EXECUTION.md](TEAM_EXECUTION.md)
**Baseline:** `ae1c5706f22ca05a60f4cf4201e6ad3ed63b18fd` (2026-10-20)

The central repository is generic governance only; all Arcana-specific Issue/PR/branch/code and role receipts belong **here** in `ARCANA-SURVIVOR`.

## Roles
OWNER requests outcomes and relays short appointment messages. CEO coordinates, resolves integration APIs and merges after QA; Engineers code only within their assigned Issue path set; QA independently verifies. All positions are temporary per mission; roles are logical work positions, not additional GitHub accounts.

## Team execution
- [CEO #21](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/21) owns main integration; workers: [GAME #22](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/22), [VFX #23](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/23), [ECONOMY #24](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/24), [EVENTS #25](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/25), [QA #26](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/26).
- Each works on a **different branch and exclusive file set**, all initially branched from frozen main SHA. Avoid writing shared files; API_REQUEST to CEO instead.
- CEO reviews PR diff, scope, deterministic tests, Chromium/WebKit responsive tests and game economy boundaries. Merge sequentially via squash after the exact PR SHA passes gates; then CI on main; other workers incorporate current main before final integration.
- Role appointment is START_AUTHORIZED but **requires a separate active worker session** to actually start. No fake signatures or proof of background execution.

## Commands
Central COMMANDS.md is source of truth: `I` help, `MN` do real work, `TR` retry safely once, `ST` short status, `C` acknowledge/no relay **not merge approval**, `PF` cleanup after full mission. Owner relays exactly `ROLE: AP-ROLE #N URL` to initialize independent chats and `ROLE: MN #N URL` thereafter.

## Deliverable and cleanup
Every PR requires tests/evidence/contract update. No changes to combat power from cosmetics. No paid checkout/paid inventory authority without backend and compliance. On entire mission completion, CEO follows central RULES §6 and reports any cleanup limitation honestly; no removing active branches.
