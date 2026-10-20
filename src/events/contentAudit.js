/** Audit offline season/event configuration coherence without activating runtime rewards. */
import {parseUtc, validateEventCatalog} from './core.js';
import {validateSeasonCatalog} from './season.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = n => Number.isSafeInteger(n) && n > 0;
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;

/**
 * Static cross-catalog audit for offline season content fixtures.
 * Does not trust the catalog as a source of paid rights; does not call an Economy API.
 */
export function auditSeasonEventContent(season, catalog) {
  const errors = [];
  const eventValidation = validateEventCatalog(catalog);
  const seasonValidation = validateSeasonCatalog(season);
  errors.push(...eventValidation.errors.map(e => 'events: ' + e));
  errors.push(...seasonValidation.errors.map(e => 'season: ' + e));
  if (!eventValidation.valid || !seasonValidation.valid) {
    return { valid: false, errors };
  }

  const events = new Map(catalog.events.map(event => [event.id, event]));
  const start = parseUtc(season.start_at);
  const end = parseUtc(season.end_at);

  for (const event of catalog.events) {
    const label = event.id;
    if (event.type === 'daily' || event.type === 'weekly') {
      if (parseUtc(event.start_at) !== start || parseUtc(event.end_at) !== end ||
        parseUtc(event.claim_until) !== parseUtc(season.claim_until)) {
        errors.push(label + ': recurring event dates must follow the season UTC window');
      }
    }

    const tokenRewards = event.objectives
      .filter(objective => objective.reward?.kind === 'EVENT_TOKEN')
      .map(objective => objective.reward.amount);
    const tokenSum = tokenRewards.reduce((total, amount) => total + amount, 0);
    if (!Number.isSafeInteger(tokenSum)) errors.push(label + ': unsafe token reward sum');
    if (tokenSum && tokenSum > event.earning_cap) {
      // Core currently caps against unspent balance; spending must not bypass a cumulative cap.
      errors.push(label + ': configured token rewards exceed safe cumulative earning cap');
    }
    if (event.event_shop?.length) {
      if (!tokenRewards.length) errors.push(label + ': token shop has no free token earn path');
      if (!event.event_shop.some(offer => offer.cost <= tokenSum && offer.cost <= event.earning_cap)) {
        errors.push(label + ': no accessible offer with configured earnable tokens');
      }
    }
  }

  if (!Array.isArray(season.event_slots) || season.event_slots.length !== 3) {
    errors.push('season: expected three 2-week campaign slots');
  } else {
    const used = new Set();
    for (const [index, slot] of season.event_slots.entries()) {
      const label = 'season: slot ' + (index + 1);
      if (!obj(slot) || !Array.isArray(slot.weeks) || slot.weeks.length !== 2 ||
        !slot.weeks.every(positive) || slot.weeks[1] !== slot.weeks[0] + 1 ||
        slot.weeks[0] !== [2, 5, 8][index]) {
        errors.push(label + ': expected weeks 2–3, 5–6 or 8–9 in order');
        continue;
      }
      if (used.has(slot.event_id)) errors.push(label + ': repeated event reference');
      used.add(slot.event_id);
      const event = events.get(slot.event_id);
      if (!event || event.type !== 'once') {
        errors.push(label + ': unknown or non-campaign event id');
        continue;
      }
      const expectedStart = start + (slot.weeks[0] - 1) * WEEK_MS;
      const expectedEnd = start + slot.weeks[1] * WEEK_MS;
      if (parseUtc(event.start_at) !== expectedStart || parseUtc(event.end_at) !== expectedEnd) {
        errors.push(label + ': campaign start/end mismatch relative UTC season weeks');
      }
      if (parseUtc(event.claim_until) > parseUtc(season.claim_until)) {
        errors.push(label + ': campaign grace extends after season claim cutoff');
      }
    }
    const configuredCampaigns = catalog.events.filter(event => event.type === 'once').map(event => event.id);
    for (const id of configuredCampaigns) if (!used.has(id)) {
      errors.push(id + ': unreferenced campaign');
    }
  }

  if (!obj(season.xp_playtest_budget) || !positive(season.xp_playtest_budget.runs_per_week) ||
    !positive(season.xp_playtest_budget.xp_per_run) ||
    !nonnegative(season.xp_playtest_budget.weekly_missions_xp) ||
    season.xp_playtest_budget.weeks !== 12) {
    errors.push('season: valid 12-week free playtest budget required');
  } else {
    const plan = season.xp_playtest_budget;
    const weekly = plan.runs_per_week * plan.xp_per_run + plan.weekly_missions_xp;
    if (!Number.isSafeInteger(weekly) || weekly * 12 < season.reward_levels[49].xp_required) {
      errors.push('season: illustrative free XP budget cannot reach tier 50 in 12 weeks');
    }
    const featuredLevel = season.reward_levels.find(tier => tier.free_reward?.item_id === season.free_featured_cosmetic_id);
    if (!featuredLevel || featuredLevel.level < 1 || weekly * 10 < featuredLevel.xp_required) {
      errors.push('season: featured free cosmetic cannot be reached in 10 planned weeks');
    }
  }

  if (!obj(season.catchup_rules) ||
    !nonnegative(season.catchup_rules.late_join_mission_xp) ||
    !nonnegative(season.catchup_rules.week11_mission_xp) ||
    season.catchup_rules.late_join_mission_once !== true ||
    season.catchup_rules.no_login_streak_required !== true) {
    errors.push('season: catch-up must be nonnegative and not require consecutive daily logins');
  }

  for (const [catalogName, ids] of [
    ['events', catalog.cosmetic_ids],
    ['season', season.cosmetic_ids],
  ]) {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) ||
      new Set(ids).size !== ids.length) {
      errors.push(catalogName + ': cosmetic IDs must be unique stable identifiers');
    }
  }

  return { valid: errors.length === 0, errors };
}
