# Data Contracts & IDs (Design Baseline)

## 1. Universal catalog conventions
- Stable snake_case IDs, e.g. hero_mage_01, cosmetic_starbound_adept, event_star_lantern_01, season_s01
- Each record includes schema_version, id, display_name_key, category, availability, art references, and optional localization
- All content references must resolve; cosmetic cannot modify power stats; invalid config fails CI before deploy
- Date/time store ISO-8601 UTC; UI renders local; never store display timestamp as only truth

## 2. Character
Fields: hero_id, archetype, base_stats, progression_unlock, animation_set, starting_skill_id. Numeric balance values stored in separate balance table.

## 3. Skill
Fields: skill_id, targeting_mode, cooldown_ticks, damage_formula_id, range, projectile_config, level_upgrades, prerequisites, fx_default, readable_description_key.
- Render FX can be substituted by cosmetic skill_fx_id without modifying damage_formula_id

## 4. Cosmetic
Fields: cosmetic_id, rarity, compatible_hero_ids, slot, asset_manifest, vfx_profile_id, sfx_profile_id, source_types, preview, return_policy, availability, price_offer_id (optional).
- cosmetic has no HP/attack/crit/cooldown fields by schema validation; fail test if found

## 5. Inventory/ledger
Entitlement: entitlement_id, user_id, cosmetic_id, source_type, source_ref, transaction_id (nullable), granted_at, revoked_at (nullable), version.
Wallet transaction: ledger_id, user_id, currency, delta, reason, source_ref, idempotency_key, created_at, actor, balance_after (server only).
- All grants idempotent on source_ref + user_id + cosmetic_id where appropriate

## 6. Event
Fields: event_id, type, start_at, end_at, claim_until, eligibility, objective_definitions, rewards, token_currency_id, earning_caps, shop_offers, priority, announcements, fallback, rerun_policy, revision.
- Server rejects claim after claim_until and rejects unearned rewards
- Version changes once event begins require changelog + approved migration of progress

## 7. Season
Fields: season_id, start_at, end_at, claim_until, season_xp_rules, mission_pool, reward_levels[1..50], free_reward, premium_reward, pass_product_id, catchup_rules, archive_policy.
- Premium pass ownership is entitlement, not boolean settable by client

## 8. Save & telemetry
Save: save_version, device_run_id, created_at, last_saved_at, hero_unlocks, unlocked_free_cosmetics, equipped_cosmetics, achievements, settings; include migration functions.
Telemetry (opt-in/consent-based as required): anonymized session ID, event type, client build, frame-time aggregate, run duration, difficulty, skin selection; avoid collecting sensitive identifiers in public logs.

## 9. Validation checklist
- ID uniqueness, reward existence, no dangling asset, season 50 tiers unique and monotonic, event UTC order start < end <= claim_until
- Price offers have currency/amount/tax-display pathway, never infer ownership from catalog
- JSON schema and fixtures to be created with first implementation PR; docs are specification, not deployed endpoints
