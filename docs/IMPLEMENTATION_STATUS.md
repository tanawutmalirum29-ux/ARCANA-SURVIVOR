# ARC-01 Playable Foundation — Implementation Record

## Stack decision (Phase 0 spike)
เลือก **ES Modules JavaScript + Canvas 2D, zero dependencies** สำหรับ playable proof-of-concept แทนที่จะผูก Phaser/Vite ตั้งแต่วันแรก เพื่อให้เปิดเล่นบน mobile browser/static hosting ได้ทันทีและรัน QA ได้โดยไม่ต้องดาวน์โหลดแพ็กเกจ. สถาปัตยกรรมแยก deterministic simulation, renderer, UI, save/entitlement demo และ static tooling ชัดเจน.

Migration option: เมื่อ art pipeline ต้องใช้ sprite atlases/complex animation ให้ทดลอง Phaser/Vite/TypeScript บน branch แยกและวัด bundle size + frame time ก่อนเลือก; ยังไม่อ้างว่าปัจจุบันเป็น Phaser/TypeScript.

## Implemented in this increment
- Fixed-step 60Hz deterministic simulation with xorshift RNG and seeded runs, browser-independent core.
- Canvas renderer with procedural arena, enemies, aura, glow, low/high VFX and reduced motion.
- Mobile joystick + keyboard, safe-area-aware HTML/CSS HUD, pause, resume, overlays, landscape/portrait adjustments.
- Enemy archetypes Swarmer/Brute/Cultist, auto Arcane Bolt, 4 upgradeable abilities, XP choice modal, Starfall Warden at 01:10 with patterns, win/lose, rewards.
- Offline cosmetic wardrobe: default skin, Gold-cost unlock, achievement unlock. Explicit **NO real-money purchase** / no server verified entitlement.
- Versioned localStorage profile data with validation and guarded writes; current save is a demo and not tamper-resistant.
- Offline static dev server, zero-dependency build, unit tests for simulation, GitHub Actions Node 22 check. No assets or music copied from third parties.

## Deferred / known limitations
- Boss telegraph, wave tuning, multiplayer, anti-cheat and balancing need playtesting; P1/P2 issues remain for production maturity.
- Offline free-only coins can be edited from devtools, not suitable for purchases, leaderboard or commercial account.
- No real payments, backend accounts, events, season runtime, cloud sync or secure premium entitlement.
- Chromium 5 viewport smoke tests passed locally (320×568, 390×844, 768×1024, 844×390, 1440×900) using Playwright Python / injected ES modules. Chromium navigations were blocked by sandbox administrator policy, so this is not a full served-origin or touch-hardware test. WebKit and physical iOS/Android remain untested.

## Commands
- `npm run dev` open http://localhost:4173
- `npm test` deterministic engine tests
- `npm run build` static deployment to `dist/`

## Follow-up work
1. Browser + device QA (320×568, 390×844, 768×1024, 844×390, 1440×900; Chromium/WebKit)
2. Balance enemies/boss, refine touch control and low FPS devices
3. Add art asset packs and optimize particles
4. Production economy and event/season config ONLY after robust free loop

Issue mapping: ARC-01 foundation, ARC-02 controls/HUD, initial ARC-03 combat and ARC-04 abilities, ARC-05 demo boss/result, ARC-06 profile save, ARC-08 demo cosmetics. Don't close follow-up issues until their full acceptance gates pass.
