# Arcana local campaign — implementation record

Current integration work: [#61](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/61). Gameplay and feature details: [Campaign guide](CAMPAIGN_GUIDE.md). Exact validation evidence belongs to the linked integration PR and its Actions run for the final head.

## Runtime

ES modules + Canvas 2D with zero runtime dependencies. The simulation is deterministic at 60 Hz; all content and UI are served as static files. `npm run build` copies the complete `src/` tree, including progression, gameplay, lobby styles and inline SVG illustrations.

The lobby has five tabs, three playable heroes, three campaign chapters and seven modes. Equipment, relics, artifacts, talents, runes, jewels, companions, guardians, research and homestead progression affect the actual configured battle. Earned resource exchange, daily/weekly/lifetime missions and the evergreen free 50-tier Chronicle complete the local loop. Cosmetic skins remain stat-free.

The legacy unconfigured engine API remains compatible. New runs receive a versioned loadout snapshot; the engine does not import inventory, persistence, cosmetics or wall-clock time. Configured boss telegraphs use the same projectile directions as combat.

## Durable save behavior

`campaignStore` uses a single IndexedDB readwrite transaction for every command. One state envelope owns the Gold wallet, inventory and claim IDs. `campaignClient` waits for committed responses before updating the UI and serializes gestures. Cross-tab edits are revision checked; a stale operation refreshes state and requires a new deliberate gesture.

Legacy v1 data migrates once while preserving the original bytes. Malformed, future-version and unreadable saves block writes rather than becoming a new profile. Active runs keep immutable seed/loadout data. Reloading restarts the same run from its beginning; this does not implement a mid-fight checkpoint. Completion retries and concurrent completion cannot grant twice.

The former economy/event modules are retained as separately tested dormant work. They are not mounted as another runtime wallet or reward authority.

## Required merge evidence

- `npm test`: deterministic legacy compatibility, real configured combat consequences, chapter/mode completion, progression validation, costs/grants, item identity/protection, reward replay and client commit behavior.
- `npm run build`: complete static output with entrypoint, lobby, progression and gameplay modules.
- `python scripts/browser_qa.py --served --browsers chromium webkit`: keyboard/touch, battle overlays and resize regression.
- `python scripts/ceo_showcase_qa.py --browsers chromium webkit`: mounted cosmetic preview and durable equip behavior.
- `python scripts/lobby_qa.py --browsers chromium webkit`: 5 tabs × 5 sizes, hit targets, keyboard, migration/recovery, real three-page competing transactions, stale revisions, staged-write abort and duplicate reward replay.
- Existing dormant Event storage/concurrency gates remain enabled.
- Browser viewport matrix: 320×568, 390×844, 768×1024, 844×390, 1440×900. CI captures representative lobby screenshots and failure diagnostics.
- Independent reviewer must examine the final product changes and the same head that passed CI before merge.

Browser executables could not be installed in the development session, so local syntax/unit checks must not be described as local browser passes. Chromium/WebKit evidence comes from actual served-origin CI execution. Existing TODO tests for deferred server/commerce work are reported separately from passing assertions.

## Remaining production work

Physical iPhone/Android touch and FPS testing, long-session balance/playtesting, account/cloud services, verified public scores, clan/co-op, live operations and real-money commerce have separate release requirements. The local UTC clock is not trusted server time and local storage is editable by the owner; this campaign cannot serve as payment or competitive entitlement authority.

No public launch, checkout, paid entitlement or backend authority is enabled by this integration. The catalog marks unavailable premium skins as preview-only.
