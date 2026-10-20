# CEO Cross-Lane Integration — Offline Reward Adapter
Main QA proved that raw event/season reward intents are not compatible with the earned-only Economy reducer:
- Event/season uses uppercase reward types and `@`/`#` timestamps in identifiers, while economy requires a restricted ASCII key and lowercased reward types.
- Event and season cosmetic IDs are not in the economy's three-item free catalog. **Never substitute another skin ID or acknowledge an undelivered cosmetic grant.**
- Event tokens and Season XP remain in their originating engine; they are not wallet commands.

CEO integration module `src/integration/rewardBridge.js` converts only GOLD/DUST and cosmetics explicitly registered in `FREE_COSMETICS`. Stable ASCII base64url creates reversible, collision-free grant/source keys; overlong/unprintable keys reject without lossy hashing. Cosmetic IDs missing from the economy catalog produce `CONTENT_NOT_AVAILABLE` and stay in the Event/Season outbox.

`applyEarnedRewardIntent(state,intent)` returns `{state,status,ackReady,...}`. **Caller must persist economy snapshot before invoking the matching event/season acknowledge function** with the original idempotencyKey, otherwise retry on next startup. Retries after saved wallet grant return `ALREADY_APPLIED`, avoiding double award.

Limits: offline/demo only; local save editable; no real purchases, premium claims, online anti-fraud, merged cloud inventory, or fully wired UI. Cosmetic catalog reconciliation is a separate explicit task before activating event cosmetic redemptions.

Acceptance proof: `npm test` includes checked-in source tests for economy, events and cross-lane integration; CI must pass with Chromium+WebKit. Further QA review required; physically measured FPS/touch unverified.
