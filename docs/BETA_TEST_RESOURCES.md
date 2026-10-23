# Temporary beta test economy kit

This feature is **only for the pre-release offline trial**. It is not a payment
system, verified reward or real-money entitlement. Enable it only while no
production accounts, commerce, leaderboard or other value-bearing identity is
connected. It must not ship as a production resource-granting backdoor.

## Tester instructions
1. Open the game, choose **ร้านค้า (Shop)** at the bottom of the lobby.
2. In the clearly labelled **BETA TEST ONLY** panel, press
   **รับหรือเติมชุดทดลอง**, then confirm the prompt.
3. The *existing* local IndexedDB campaign receives up to 500,000 of each Gold,
   Essence, Research and Dust; 50,000 shards for every hero, 50,000 fragments
   per relic, one Common and one Legendary copy of every catalog equipment
   definition, and simulated access for **five runs** to use run-gated menus.
4. Spend the resources in normal menus. Revisit Shop and repeat the grant to
   refill when a balance has dropped below the test floor. Already owned sample
   gear is not duplicated. If everything is already stocked, the command
   returns `NO_CHANGE`.
5. Simulated run access is **not a win, kill, mission claim or real play
   achievement**. Any UI showing run count may reflect the beta-access floor.
   Existing wins, claimed rewards, active run, wardrobe and saved gear are left
   unchanged. This local prototype uses one authoritative IndexedDB wallet.

## Disabling / launch checklist (mandatory)
- Set `src/testing/beta-resources.js` `BETA_TEST_MODE = false` before any public
  or commercial release. The backend-independent reducer rejects
  `BETA_TEST_REFILL` with `LOCKED`; the button disappears. Both the Node tests
  and the real-browser beta QA test the disabled code path.
- **Never transfer funded beta test profiles into real-value player accounts.**
  Back up and reset/segregate all test IndexedDB profiles before launch; simply
  hiding the button does not remove currencies already granted to test saves.
- Do not mint Astral Gems, paid cosmetic IDs, paid ownership or server
  entitlements using this feature. Commerce, anti-cheat, account restoration
  and launch security need separate approval.
- Keep strict campaign v3 validation, account revision checks, and browser
  cross-tab atomicity tests. The temporary command must not write a second
  wallet or mutate gameplay engine.
- After flag is disabled, run `npm test`, `npm run build`, full Chromium/WebKit
  mobile matrix and independent QA before shipping the new build.

**Code locations:** `src/testing/beta-resources.js` (toggle/caps),
`src/progression/index.js` (transactional validated grant),
`src/ui/lobby.js` (visible opt-in button),
`tests/testing/beta-resources.test.js` and
`scripts/beta_resource_qa.py` (unit + true-browser tests).
