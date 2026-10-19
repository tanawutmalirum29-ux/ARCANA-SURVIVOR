# QA Gates, Release Operations, Observability & Risks

## 1. Test matrix
- Viewports: 320x568, 390x844, 768x1024, 844x390, 1440x900
- Chromium and WebKit real-browser automation; touch/manual on iOS/Android where hardware available
- Touch drag/joystick, long-press selection prevention, modal open/close, landscape HUD, pause/resume, input focus
- Skin switch: stat equality, hitbox equality, render fallback, no screen-wide flash, clear enemy telegraph
- Game: collision, out-of-bounds, hit invulnerability, deterministic RNG, XP, boss defeat, game over, offline save migration
- Economy: duplicate claim, retry, interrupted save, cap handling, insufficient balance, rollback, ledger reconcile
- Event/season: timezones/UTC, midnight boundary, claim grace, overlap priority, rerun, rollback, delayed server response
- Billing (P3 only): unsigned receipt, duplicate webhook, refund, chargeback, reinstall, cross-device restore, webhook downtime
- Accessibility: reduced motion, colorblind-readable tells, scalable text, screen-reader accessible menu where practical, no mandatory strobe

## 2. Quality thresholds (targets, not verified results)
- Low graphics 30 FPS target on defined entry-level test phone; High 60 FPS target on capable phone
- Crash-free 99.5%+ in soft launch goal; no P0 crashes/dead-end save bugs at release
- Gameplay commands should register within 1 render frame under normal load
- No UI covers essential movement zone or boss telegraph on 320x568 and 844x390
- Reward grants exact-once; buying cannot grant gameplay stats

## 3. Release gates
- G0 design docs / contract reviewed
- G1 P0 prototype passed
- G2 complete P1 run playable/mobile QA passed
- G3 P2 free cosmetic-event-season loop passes
- G4 server security, payments sandbox, privacy/legal/customer support passed
- G5 soft launch metrics and rollback test passed
- G6 paid/live season release approved

## 4. LiveOps duties
- Content owner writes config + release notes; QA validates; release manager schedules; support has FAQ and compensation rules
- Monitor active runs, crash rate, p95 FPS, event participation, token earn vs spend, reward claim success, storefront errors, refund rate
- Publish status update and timeline when service interrupted; trigger kill switch for event/shop to prevent incorrect grants
- Compensation strictly records eligibility/grants once; no unbounded manual credits
- Retrospective every event and season: bugs, rewards friction, accessibility, economy, art cost, satisfaction

## 5. Risk register
| Risk | Mitigation |
|---|---|
| VFX ทำให้มือถือช้า | pooling, quality tiers, profile frame time on hardware |
| Scope creep จากหลาย season | strict phases, reusable event kits, max content capacity |
| ผู้เล่นรู้สึก P2W | no power in cosmetic schema, A/B equal-stat tests |
| Timezone bug ทำให้รับของผิด | UTC authoritative + boundary tests + claim grace |
| Dupes / fraudulent grants | idempotent ledger, server checks, audit, reconciliation |
| Compliance ของร้านค้า/เด็ก | P3 go/no-go policy review by markets and platform |
| ผู้เล่นกลับมาไม่ทัน event | catch-up / archive rerun / no compulsory streak |
| UI มือถือเล็กบัง gameplay | 5-size automated snapshots + manual touch QA |
