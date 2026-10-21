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


## QA follow-up: post-merge WebKit click flake and dormant Events cross-tab race

Target `main`: `fca57c234b16bca8d67f8cc0024008ec9b5b7858` (PR #39 dormant-only merge).
[Main Actions run 39543650387](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/actions/runs/39543650387) **attempt 1 failed** during existing WebKit `scripts/browser_qa.py:68` Settings music-theme → Back click. Playwright resolved a visible/enabled/stable button, scrolled it into view, then its 30s click timed out; logs did not report the hit-test obstruction or root cause. Exactly one browser-job rerun (attempt 2) **passed** existing viewport, showcase and Event localStorage suites on unchanged source. Classify **INTERMITTENT / ROOT CAUSE UNKNOWN**; a green rerun does not prove stability.

QA-owned `scripts/browser_qa.py` now emits `QA_CLICK_OBSTRUCTION` JSON with button bounds, center `elementFromPoint` and `elementsFromPoint` ancestry, computed pointer-events/z-index/opacity, active focus, viewport, scrolling and a local screenshot path **only if the Back click times out**. It neither retries nor force-clicks nor changes game behavior; screenshot is ephemeral until CEO authorizes CI artifact upload. If the flake returns, capture actual diagnostic logs/traces and investigate WebKit hit testing, layer overlap, audio-driven render and scrolling; no specific culprit is confirmed yet.

Independently demonstrated a **real design-level concurrency loss window** in dormant `eventLocalStorage.js` + `eventV2Store.js`: two tab snapshots read the same valid v2 state S0; A computes `eventId=A`, B computes `eventId=B`; A writes/validates S(A), then B writes/validates S(B) based on S0. Both immediate reads match their own write, but final saved `seenEventIds` contains only B, losing A. The QA-owned Node characterization test in `tests/qa/event_storage_race.test.js` records this expected-current bug with synthetic 2030 calendar. This is a controlled interleaving with synchronous mock storage, **not** an independently observed production two-tab/browser collision. `commitStoredEventTransition` performs read→compute→write without an atomic cross-tab compare-and-swap, so per-write readback cannot fix concurrency. Runtime activation stays **HOLD** until CEO selects authoritative serialized writer or a cross-context protocol with real atomic stale-write rejection; test with two actual browser tabs, retry/replay, crash and claims/outbox durability. Standard `localStorage` alone has no compare-and-set.

No QA files change Events/Economy/VFX gameplay, active `src/main.js`, storage, finance or premium. The blocked Economy #24 catalog must remain untouched. Physical Android/iOS, FPS and paid/player-facing release remain unverified/HOLD.


## QA — WebKit intermittent HUD bounds failure triage (post PR #42 main)

On merged main `ad7e46f1872b005cc68517b62ebc584b463cebcf` run [39564966770](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/actions/runs/39564966770), **attempt 1 browser job 119104945137 failed** at WebKit **768×1024**, after Chromium 5/5 and WebKit 320×568 + 390×844. `scripts/browser_qa.py:122` called `bounds_ok(page,'#hud')` after `#hud.is_visible()` had passed; Playwright `bounding_box()` returned `None`. Original test emitted only `AssertionError: missing bounds for #hud`. **Do not infer the HUD actually disappeared**: the source shows `setPlayingUI(false)` hides HUD on run finish, but Playwright/renderer transient, blur/visibility, navigation, GPU process and other causes were NOT distinguished. There is no DOM snapshot, browser crash notice or screenshot from the failed attempt. **Attempt 2 of only the failed browser job passed on identical main SHA**, including WebKit 768×1024 and later suites; this is a flaky/regression warning, not a fix.

QA-scoped instrumentation in `scripts/browser_qa.py` now logs **`QA_LAYOUT_FAILURE` JSON only on real missing/outside/raised bounding box**, capturing DOM existence/connection, computed display/visibility/opacity, element/class rects, game HUD HP+clock, overlay contents/title, app/body geometry, visual viewport, document visibility/focus and page crash/close/browser disconnect events. A local `/tmp/arcana-qa-layout-...png` screenshot is attempted and its location/failure logged. **The assertions still fail unchanged; no sleeps, retries, force clicks, reloading, app code modifications or browser-exception suppression.** This should distinguish a real `hidden` HUD transition from missing geometry or process teardown when the flake recurs. The existing `QA_CLICK_OBSTRUCTION` on settings Back timeout remains intact.

**Scope:** only authorized QA script/report. A new PR CI run that passes without a HUD failure verifies regression compatibility but **does not exercise or prove the failure-only instrumentation**, and does not explain the first failure. Screenshot is local runner evidence until CEO adds approved `upload-artifact` on failure in CEO-owned workflow; printed JSON is retained in Actions log. Request CEO to review PR and, if accepted, merge after exact-SHA CI, then verify new main CI. If WebKit fails again, retain JSON and independent repro before any root-cause or final release claims. Hardware iOS/Android/FPS and live Events/Season/wallet/paid remain HOLD. Economy #24 held file untouched.


## QA — WebKit `TargetClosedError` at music-settings / pause controls

On **main `742291ba54e30dcac7c726da279605e4dd0f0cbb`** Actions [39567486288](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/actions/runs/39567486288) attempt 1 browser job **119113171861 FAILED** during WebKit **768×1024** at ordinary `[data-action="music-settings"]` click, after Chromium five viewport PASS and WebKit 320×568 + 390×844 PASS. Playwright resolved the button (`อัตโนมัติ ↻`), began click and was waiting for actionability/stability, then raised **`TargetClosedError: Target page, context or browser has been closed`**. The prior QA `QA_LAYOUT_FAILURE` helper correctly did not fire because the exception was NOT a HUD geometry/bounding-box failure. An earlier source CI WebKit `#pause-btn` click ended with `TargetClosedError` as well. This evidence does **not prove** an application event handler was invoked or that a browser compositor/renderer bug caused closure. Root cause remains unknown. Main attempt 2 reran only failed browser job at identical SHA and passed — **not an issue fix**.

QA-only `scripts/browser_qa.py` adds `QA_LIFECYCLE_CLICK_FAILURE` reporting solely when a standard `music-settings` or `#pause-btn` Playwright click raises. Logs original exception type/message, tracked page crash/close/context-close/browser-disconnect/main-frame-navigation events, page JS errors/console errors, and best-effort page.is_closed / browser.is_connected probes. When still connected, logs target/overlay/HUD DOM classes, visibility, click rect, document focus/visibility and frame time. Attempts a best-effort screenshot to `/tmp/arcana-qa-layout-lifecycle-*.png`, compatible with the CEO-proposed PR #44 `/tmp/arcana-qa-layout-*.png` artifact glob after CEO merges that workflow. **The original click is unchanged, the original Playwright exception is always re-raised, no forced click/retries/sleep/fail masking**. Screenshot and DOM probes will normally fail when WebKit target has already died; lifecycle JSON remains in Actions logs, and a green CI run does **not** prove failure path executed.

Retain prior WebKit first-attempt HUD `bounding_box == None`, Settings Back timeout and pause-target-closed evidence as separate intermittent phenomena until source facts explain or connect them. Do not assert any OS/browser root cause without captured trace. Browser emulation != physical mobile testing. Runtime Events/Season/shop/wallet, historical localStorage→IDB migration, paid rights, server authority and public release remain HOLD. Restricted Economy #24 catalog not touched.


## One-shot bounded 768×1024 WebKit sound A/B diagnostic — CEO authorization

Authorized by QA #26 comment `6313888782` and accepted by successor CEO #46. Based on *unchanged production main* `bef57421bde4f2f5f4396fee9a5140c4379abec1`, this **DRAFT, QA-only** branch changes only `scripts/browser_qa.py`, new `tests/qa/webkit_sound_ab.py`, and this QA report.

GitHub PR-branch CI hook `GITHUB_HEAD_REF == test/qa-webkit-768-bounded-sound` launches this probe **once in that PR's first CI run**, *before* the regular browser matrix. The normal baseline `scenario` action sequence is reused (including both normal sound-toggle clicks); the optional muted variant begins SOUND OFF, toggles ON and returns OFF instead of baseline ON→OFF→ON. Assertions reflect the test precondition and verify final localStorage state. Hooks also add trace and defer page close so the trace can be finalized. No changes in app source or default QA-on-main behavior. The trial uses one fresh WebKit browser+context per case at 768×1024 and HTTP origin: 3 default sound, 3 localStorage `arcana-survivor-sound-v1=off` *before app script*, then at most 1 Chromium per condition. All normal clicking and pre-existing timing remain unchanged; no additional sleep/force/retry. `DEBUG=pw:browser` traces subprocess launch/exit, plus Playwright trace ZIP on success or best effort failure, lifecycle+console error ring, screenshot if obtainable. A first failing trial fails CI and is re-raised, **not reattempted**.

Logs use structured `QA_BOUNDED_CONTRACT`, `QA_BOUNDED_TRIAL` and `QA_BOUNDED_DONE`. Trial reporting includes browser version, variant, ordinal, elapsed seconds, failure site, last lifecycle signals, verified trace path and size, screenshot path *only if actually created*. Trace ZIPs are runner-local under `/tmp/arcana-qa-webkit-traces/`; if generated, CEO must approve a separate workflow-artifact upload before claiming they were retained. Current CEO workflow only preserves `/tmp/arcana-qa-layout-*.png` on failed browser jobs. A green trial run means **NOT REPRODUCED**, never WebKit fixed. Unexpected Chromium/red WebKit still blocks QA/launch until source evidence supports real code remediation.

If the actual trial is not invoked because the CI event lacks `GITHUB_HEAD_REF`, **do not** infer a successful A/B test from baseline-only green CI; request an API_REQUEST for a CEO-owned opt-in hook and do not repeat trials.
