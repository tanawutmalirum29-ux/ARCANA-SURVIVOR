# ARCANA SURVIVOR — Independent QA Team Report

Appointment: [QA #26](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/26) · Coverage: [Controls #2](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/2), [Automation #14](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/14) · CEO: [#21](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/21)

## Scope and evidence discipline

Independent QA lane: `test/team-qa-regression`. Appointment baseline `ae1c5706f22ca05a60f4cf4201e6ad3ed63b18fd`; baseline inspected on main `f169e38cb84cc6ed9daf5272f15a7b715d8c3cc3` (2026-10-20, includes scope CI guard). No source engine, renderer, economy, events, shared wiring or workflow changes in this QA submission.

Baseline main Actions run [39354090161](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/actions/runs/39354090161) concluded success **before this QA patch**. That is not evidence that new assertions passed. Refer to the QA PR checks and the exact PR head SHA for the newly added coverage.

## Automated test additions

- `tests/qa/regression.test.js` (Node's built-in test runner): three permitted cosmetic profiles replay identical seeded simulation; reject gameplay-stat properties in cosmetic catalog; unshipped premium previews remain locked; boss spawn/victory and terminal-state freeze; lethal defeat freeze; upgrade-pause gating; world bounds.
- `scripts/browser_qa.py`: Chromium/WebKit, five viewports (320×568, 390×844, 768×1024, 844×390, 1440×900), served-origin scenario and optional embedded fallback. Focusable start button, no body text selection and no horizontal document overflow, menu/settings/wardrobe geometry, mobile simulated joystick/pointer capture, ArrowRight and Escape keyboard, pause/resume.
- 1440×900 now runs desktop pointer and keyboard semantics (no emulated mobile joystick). Smaller test profiles explicitly use browser touch emulation; they are **not** physical-device QA.
- The browser script runs the nested Node QA test suite first because `npm test` currently discovers only `tests/*.test.js`. The CEO may separately wire nested tests into the central CI unit job after reviewing an `API_REQUEST` if desired.

## Repeatable commands

```sh
npm test
npm run build
node --test tests/qa/regression.test.js
npm run dev
# In another shell:
python -m pip install playwright==1.57.0
python -m playwright install chromium webkit
python scripts/browser_qa.py --served --browsers chromium webkit
```

## Gates and limitations

| Gate | Status at report creation | Required evidence |
|---|---|---|
| Existing main CI | PASS (run 39354090161, previous SHA only) | See baseline run link above |
| New QA regression and browser checks | PENDING PR CI | Exact new PR head, browser and Node logs |
| Five browser viewports | Automated tests prepared, new pass **not yet claimed** | Chromium + WebKit HTTP-origin run |
| Gameplay skin-stat equality | Pure deterministic state assertion prepared | Node QA regression log |
| Event/economy duplicate claim and UTC boundaries | WAITING FOR ENGINEER PRs | Independent follow-up on submitted contract/code |
| Physical Android/iOS tap, long press, safe area | NOT VERIFIED | Device model, OS, screenshots/video and steps |
| FPS 30/60 targets, real GPU, visual flash safety | NOT VERIFIED | Real-device profiler and visuals |
| Reduced-motion appearance / colorblind telegraphs | PARTIAL: setting interaction automated, visual judgment NOT VERIFIED | Visual review after VFX PR |
| Payment/security/release | HOLD | Separate security gate; no real checkout/authority |

## QA decision and follow-up

This report is a **QA tooling submission, not a product release approval**. New code must pass its own PR CI before CEO may merge. QA reviewer will assess ENGINEER-GAME, ENGINEER-VFX, ENGINEER-ECONOMY, ENGINEER-EVENTS PR heads independently as they appear, recording reproducible defects in their review threads or #26. Critical repeatable regressions block integration. CEO alone merges after review and tests; physical hardware and real FPS remain explicitly unverified until actual evidence exists.
