import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile } from '../../src/storage.js';
import {
  createCampaign, validateCampaign, validateRunConfig, applyCommand, deriveLoadout,
  getCommandCost, getCommandRewardPreview, getDismantleReward, getForgeCandidates, getFeatureState, getMissionProgress,
  HEROES, EQUIPMENT, SLOTS, RELICS, TALENTS, RUNES, JEWELS, ARTIFACTS, COMPANIONS, GUARDIANS, RESEARCH, BUILDINGS,
} from '../../src/progression/index.js';
import { normalizeRunConfig } from '../../src/gameplay/run-config.js';

const copy = value => structuredClone(value);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function wealthy() {
  const profile = defaultProfile(); profile.runs = 30; profile.gold = 900000;
  const state = createCampaign(profile); state.progression.materials = { essence: 900000, research: 900000, dust: 900000 };
  assert.equal(validateCampaign(state), true); return state;
}
function step(state, command) {
  const before = copy(state); const result = applyCommand(freeze(state), command);
  assert.equal(result.ok, true, `${command.type}: ${result.code}`); assert.equal(result.code, 'OK');
  assert.equal(result.state.revision, state.revision + 1); assert.equal(validateCampaign(result.state), true);
  assert.deepEqual(state, before, `${command.type} mutated its input`); return result;
}
function reject(state, command, code) {
  const before = copy(state); const result = applyCommand(freeze(state), command);
  assert.equal(result.ok, false); if (code) assert.equal(result.code, code);
  assert.equal(result.state, state); assert.deepEqual(state, before); return result;
}
function run(state, stats = { kills: 80, seconds: 185, won: true }, day = '2026-10-21') {
  const start = step(state, { type: 'START_RUN', day });
  return step(start.state, { type: 'FINISH_RUN', runId: start.details.runId, stats });
}
function craft(state, definitionId) { const result = step(state, { type: 'CRAFT_ITEM', definitionId }); return [result.state, result.details.item.id]; }

test('fresh and legacy campaigns preserve the one wallet, earned cosmetics and every setting', () => {
  const profile = { ...defaultProfile(), gold: 418, runs: 8, totalKills: 150, bestSeconds: 610, owned: ['apprentice', 'ember', 'moon'], skin: 'ember', settings: { vfx: 'low', reduceMotion: true } };
  const campaign = createCampaign(profile); assert.deepEqual(campaign.profile, profile); assert.notEqual(campaign.profile, profile);
  assert.equal(campaign.progression.inventory.length, 2); assert.equal(validateCampaign(campaign), true);
  assert.deepEqual(campaign.progression.materials, { essence: 0, research: 0, dust: 0 });
  assert.equal(deriveLoadout(createCampaign()).stats.attack, 27); assert.equal(deriveLoadout(createCampaign()).stats.maxHp, 115);
  for (const malformed of [null, {}, { ...profile, version: 3 }, { ...profile, gold: -1 }, { ...profile, gold: NaN }, { ...profile, gold: 1.1 }, { ...profile, owned: ['apprentice', 'crimson'] }, { ...profile, extra: true }]) assert.throws(() => createCampaign(malformed));
});

test('strict validation fails closed for malformed wallets, IDs, bounds, duplicate equipment and unsupported stats', () => {
  const baseline = wealthy();
  const corruptions = [
    s => s.schemaVersion = 3, s => s.revision = -1, s => s.profile.gold = NaN, s => s.profile.gold = Infinity,
    s => s.progression.materials.essence = -1, s => s.progression.materials.gems = 12,
    s => s.progression.inventory[0].level = 31, s => s.progression.inventory[0].rarity = 6,
    s => s.progression.inventory.push(copy(s.progression.inventory[0])), s => s.progression.equipment.armor = 'item-1',
    s => s.progression.heroes.mage.level = 0, s => s.progression.companionIds = ['wisp'],
    s => s.progression.relics.compass.level = -1, s => s.progression.presets = [],
    s => s.progression.season.claimed = [1], s => s.progression.claimed = ['run:run-999'],
    s => s.progression.missions.weeklyKills = NaN, s => s.progression.missions.day = '2026-02-31',
  ];
  for (const mutate of corruptions) { const state = copy(baseline); mutate(state); assert.equal(validateCampaign(state), false); reject(state, { type: 'START_RUN' }, 'INVALID_STATE'); }
  const active = step(baseline, { type: 'START_RUN', day: '2026-10-21' }).state;
  for (const mutate of [s => s.progression.activeRun.runConfig.stats.attack = Infinity, s => s.progression.activeRun.runConfig.stats.godmode = 1, s => s.progression.activeRun.runConfig.guardian = { id: 'unknown', level: 1 }, s => s.progression.activeRun.seed = -1]) {
    const state = copy(active); mutate(state); assert.equal(validateCampaign(state), false);
  }
});

test('all malformed and unaffordable commands preserve state identity and wallets', () => {
  const state = createCampaign();
  for (const command of [null, {}, [], { type: 'constructor' }, { type: 'toString' }, { type: '__proto__' }, { type: 'UPGRADE_ITEM', itemId: 'item-1', gold: -500 }, { type: 'START_RUN', day: null }, { type: 'START_RUN', day: '2026-02-31' }, { type: 'SAVE_PRESET', index: NaN }, { type: 'PROFILE_SETTINGS', settings: { reduceMotion: 'yes' } }]) reject(state, command);
  reject(state, { type: 'UPGRADE_ITEM', itemId: 'item-1' }, 'NO_FUNDS');
  reject(state, { type: 'UNLOCK_HERO', heroId: 'guardian' }, 'LOCKED');
  reject(state, { type: 'SELECT_CHAPTER', chapterId: 'citadel' }, 'LOCKED');
  reject(state, { type: 'CLAIM_MISSION', missionId: 'first_run' }, 'NOT_READY');
  reject(state, { type: 'CLAIM_SEASON', tier: 1 }, 'NOT_READY');
  reject(state, { type: 'UNLOCK_COSMETIC', cosmeticId: 'crimson' }, 'LOCKED');
});

test('run identity is durable, immutable while upgrading, and consumed exactly once after reload', () => {
  let state = wealthy(); const start = step(state, { type: 'START_RUN', day: '2026-10-21' }); state = start.state;
  const snapshot = copy(state.progression.activeRun);
  reject(state, { type: 'START_RUN', day: '2026-10-21' }, 'RUN_ACTIVE');
  reject(state, { type: 'FINISH_RUN', runId: 'run-999', stats: { kills: 80, seconds: 185, won: true } }, 'UNKNOWN_RUN');
  for (const stats of [{ kills: -1, seconds: 185, won: true }, { kills: 8, seconds: NaN, won: false }, { kills: 100, seconds: 2, won: true }, { kills: 20, seconds: 200, won: true, gold: 9999 }]) reject(state, { type: 'FINISH_RUN', runId: snapshot.id, stats }, 'INVALID_RESULT');
  state = step(state, { type: 'UPGRADE_ITEM', itemId: 'item-1' }).state;
  state = step(state, { type: 'UPGRADE_HERO', heroId: 'mage' }).state;
  assert.deepEqual(state.progression.activeRun, snapshot); assert.ok(deriveLoadout(state).stats.attack > snapshot.runConfig.stats.attack);
  state = JSON.parse(JSON.stringify(state));
  const finish = step(state, { type: 'FINISH_RUN', runId: snapshot.id, stats: { kills: 80, seconds: 185, won: true } }); state = finish.state;
  assert.equal(state.progression.activeRun, null); assert.ok(state.progression.claimed.includes(`run:${snapshot.id}`));
  assert.equal(finish.details.firstClear, true); assert.deepEqual(finish.details.unlockedChapterIds, ['grove']); assert.equal(finish.details.items.length, 1);
  reject(JSON.parse(JSON.stringify(state)), { type: 'FINISH_RUN', runId: snapshot.id, stats: { kills: 80, seconds: 185, won: true } }, 'ALREADY_CLAIMED');
  const replay = run(state); assert.equal(replay.details.firstClear, false); assert.ok(replay.details.gold < finish.details.gold);
});

test('abandon consumes only the current run, grants nothing and cannot be finished afterwards', () => {
  const start = step(createCampaign(), { type: 'START_RUN' });
  reject(start.state, { type: 'ABANDON_RUN', runId: 'run-8' }, 'UNKNOWN_RUN');
  const end = step(start.state, { type: 'ABANDON_RUN', runId: start.details.runId }).state;
  assert.equal(end.profile.gold, 0); assert.equal(end.profile.runs, 0); assert.equal(end.progression.inventory.length, 2);
  reject(end, { type: 'FINISH_RUN', runId: start.details.runId, stats: { kills: 100, seconds: 300, won: true } }, 'ALREADY_CLAIMED');
});

test('chapter route is sequential and mode rewards use the persisted mode, not menu selection', () => {
  let state = wealthy(); reject(state, { type: 'SELECT_CHAPTER', chapterId: 'grove' }, 'LOCKED');
  state = run(state).state; state = step(state, { type: 'SELECT_CHAPTER', chapterId: 'grove' }).state;
  state = run(state, { kills: 100, seconds: 245, won: true }).state;
  state = step(state, { type: 'SELECT_CHAPTER', chapterId: 'citadel' }).state;
  state = run(state, { kills: 120, seconds: 305, won: true }).state;
  assert.deepEqual(state.progression.cleared, ['astral', 'grove', 'citadel']);
  state = step(state, { type: 'SELECT_MODE', mode: 'resource' }).state;
  const start = step(state, { type: 'START_RUN', day: '2026-10-21' });
  state = step(start.state, { type: 'SELECT_MODE', mode: 'campaign' }).state;
  const finish = step(state, { type: 'FINISH_RUN', runId: start.details.runId, stats: { kills: 20, seconds: 90, won: true } });
  assert.equal(finish.details.essence, 34); assert.equal(finish.details.firstClear, false);
});

test('fusion rejects duplicates and protected fodder, preserves equipped main identity and refunds investment', () => {
  let state = wealthy(); let a, b;
  [state, a] = craft(state, 'star_wand'); [state, b] = craft(state, 'star_wand');
  state = step(state, { type: 'UPGRADE_ITEM', itemId: a }).state;
  state = step(state, { type: 'UPGRADE_ITEM', itemId: 'item-1' }).state;
  state = step(state, { type: 'SAVE_PRESET', index: 0 }).state;
  reject(state, { type: 'FUSE_ITEMS', itemIds: ['item-1', a, a] }, 'INVALID_FUSION');
  const locked = step(state, { type: 'LOCK_ITEM', itemId: b, locked: true }).state;
  reject(locked, { type: 'FUSE_ITEMS', itemIds: ['item-1', a, b] }, 'ITEM_PROTECTED');
  assert.equal(getForgeCandidates(locked, 'item-1').length, 1);
  const wallet = state.profile.gold; const essence = state.progression.materials.essence;
  const result = step(state, { type: 'FUSE_ITEMS', itemIds: ['item-1', a, b] }); state = result.state;
  const main = state.progression.inventory.find(item => item.id === 'item-1');
  assert.equal(main.rarity, 1); assert.equal(main.level, 2); assert.deepEqual(main.invested, { gold: 15, essence: 2 });
  assert.equal(state.profile.gold, wallet - 40 + 15); assert.equal(state.progression.materials.essence, essence - 5 + 2);
  assert.equal(state.progression.equipment.weapon, 'item-1'); assert.equal(state.progression.presets[0].equipment.weapon, 'item-1');
  assert.equal(state.progression.inventory.length, 2);
  state = step(state, { type: 'RESET_ITEM', itemId: 'item-1' }).state;
  assert.equal(state.progression.inventory[0].level, 1); assert.equal(state.profile.gold, wallet - 40 + 30);
  reject(state, { type: 'RESET_ITEM', itemId: 'item-1' }, 'NO_CHANGE');
});

test('ring instances cannot duplicate; presets protect their items and restore complete loadouts', () => {
  let state = wealthy(); let ring1, ring2;
  [state, ring1] = craft(state, 'orbit_ring'); [state, ring2] = craft(state, 'hunter_ring');
  state = step(state, { type: 'EQUIP_ITEM', itemId: ring1, slot: 'ring1' }).state;
  state = step(state, { type: 'EQUIP_ITEM', itemId: ring1, slot: 'ring2' }).state;
  assert.equal(state.progression.equipment.ring1, null); assert.equal(state.progression.equipment.ring2, ring1);
  state = step(state, { type: 'EQUIP_ITEM', itemId: ring2, slot: 'ring1' }).state;
  state = step(state, { type: 'UPGRADE_RUNE', runeId: 'power' }).state;
  state = step(state, { type: 'EQUIP_RUNE', runeId: 'power', slot: 'attack' }).state;
  state = step(state, { type: 'SAVE_PRESET', index: 1 }).state; const saved = copy(state.progression.presets[1]);
  state = step(state, { type: 'UNEQUIP_ITEM', slot: 'ring2' }).state;
  state = step(state, { type: 'EQUIP_RUNE', runeId: null, slot: 'attack' }).state;
  reject(state, { type: 'DISMANTLE_ITEM', itemId: ring1 }, 'ITEM_PROTECTED');
  state = step(state, { type: 'LOAD_PRESET', index: 1 }).state;
  assert.deepEqual(state.progression.equipment, saved.equipment); assert.deepEqual(state.progression.runes.equipped, saved.runes);
  for (const index of [-1, 3, .5, NaN]) reject(state, { type: 'LOAD_PRESET', index }, 'INVALID_COMMAND');
});

test('every gear slot and all collection upgrades contribute to the derived combat loadout', () => {
  let state = wealthy();
  for (const def of EQUIPMENT) {
    let id; [state, id] = craft(state, def.id); const slot = SLOTS.find(slot => slot.type === def.slot).id;
    state = step(state, { type: 'EQUIP_ITEM', itemId: id, slot }).state;
    assert.equal(validateRunConfig(deriveLoadout(state)), true);
  }
  const base = deriveLoadout(state);
  for (const hero of HEROES.filter(hero => hero.id !== 'mage')) state = step(state, { type: 'UNLOCK_HERO', heroId: hero.id }).state;
  state = step(state, { type: 'SELECT_SUPPORT', heroId: 'guardian' }).state;
  for (let i = 0; i < 5; i++) state = step(state, { type: 'UPGRADE_TALENT', talentId: 'vitality' }).state;
  for (const talent of TALENTS.filter(def => def.id !== 'vitality')) state = step(state, { type: 'UPGRADE_TALENT', talentId: talent.id }).state;
  for (const rune of RUNES) { state = step(state, { type: 'UPGRADE_RUNE', runeId: rune.id }).state; state = step(state, { type: 'EQUIP_RUNE', runeId: rune.id, slot: rune.category }).state; }
  for (const [i, jewel] of JEWELS.entries()) { state = step(state, { type: 'UPGRADE_JEWEL', jewelId: jewel.id }).state; state = step(state, { type: 'EQUIP_JEWEL', jewelId: jewel.id, slot: SLOTS[i].id }).state; }
  for (const def of RESEARCH) state = step(state, { type: 'UPGRADE_RESEARCH', researchId: def.id }).state;
  for (const def of BUILDINGS) state = step(state, { type: 'UPGRADE_BUILDING', buildingId: def.id }).state;
  const upgraded = deriveLoadout(state);
  assert.ok(upgraded.stats.maxHp > base.stats.maxHp); assert.ok(upgraded.stats.attack > base.stats.attack); assert.ok(upgraded.stats.armor > base.stats.armor);
  assert.ok(upgraded.stats.skillMultiplier > base.stats.skillMultiplier); assert.ok(upgraded.stats.fireDelay < base.stats.fireDelay);
  assert.ok(upgraded.modifiers.novaRadius > 1); assert.ok(upgraded.modifiers.orbitRadius > 1); assert.equal(validateRunConfig(upgraded), true);
});

test('relic fragments are earned, targeted, consumed once and improve passive stats and sets', () => {
  let state = wealthy(); const base = deriveLoadout(state);
  reject(state, { type: 'UNLOCK_RELIC', relicId: 'compass' }, 'NO_FUNDS');
  for (const relic of RELICS) {
    for (let i = 0; i < 3; i++) state = step(state, { type: 'BUY_OFFER', offerId: `fragment_${relic.id}` }).state;
    state = step(state, { type: 'UNLOCK_RELIC', relicId: relic.id }).state;
    assert.equal(state.progression.relics[relic.id].fragments, 1);
    reject(state, { type: 'UNLOCK_RELIC', relicId: relic.id }, 'ALREADY_OWNED');
    state = step(state, { type: 'UPGRADE_RELIC', relicId: relic.id }).state;
  }
  const final = deriveLoadout(state); assert.ok(final.stats.attack > base.stats.attack); assert.ok(final.stats.maxHp >= base.stats.maxHp + 30);
  assert.ok(final.modifiers.killHeal > 0);
});

test('artifacts, companions, guardians and support heroes are owned, bounded and snapshotted', () => {
  let state = wealthy();
  for (const [catalog, type, field] of [[ARTIFACTS, 'ARTIFACT', 'artifactId'], [COMPANIONS, 'COMPANION', 'companionId'], [GUARDIANS, 'GUARDIAN', 'guardianId']]) {
    for (const def of catalog) { reject(state, { type: `EQUIP_${type}`, [field]: def.id }, 'NOT_OWNED'); state = step(state, { type: `UPGRADE_${type}`, [field]: def.id }).state; }
  }
  state = step(state, { type: 'EQUIP_ARTIFACT', artifactId: 'hourglass' }).state;
  state = step(state, { type: 'EQUIP_GUARDIAN', guardianId: 'phoenix' }).state;
  state = step(state, { type: 'EQUIP_COMPANION', companionId: 'wisp' }).state;
  state = step(state, { type: 'EQUIP_COMPANION', companionId: 'owl' }).state;
  reject(state, { type: 'EQUIP_COMPANION', companionId: 'sprite' }, 'CAPACITY');
  const config = deriveLoadout(state); assert.deepEqual(config.artifact, { id: 'hourglass', level: 1 }); assert.deepEqual(config.guardian, { id: 'phoenix', level: 1 }); assert.equal(config.companions.length, 2);
  state = step(state, { type: 'EQUIP_COMPANION', companionId: 'owl' }).state;
  state = step(state, { type: 'EQUIP_COMPANION', companionId: 'sprite' }).state;
  assert.deepEqual(state.progression.companionIds, ['wisp', 'sprite']);
  reject(state, { type: 'SELECT_SUPPORT', heroId: 'mage' }, 'INVALID_COMMAND');
});

test('jewels attach to slots, cannot duplicate, and give no bonus on an empty gear slot', () => {
  let state = wealthy(); state = step(state, { type: 'UPGRADE_JEWEL', jewelId: 'ruby' }).state;
  const attack = deriveLoadout(state).stats.attack;
  state = step(state, { type: 'EQUIP_JEWEL', jewelId: 'ruby', slot: 'ring1' }).state;
  assert.equal(deriveLoadout(state).stats.attack, attack);
  state = step(state, { type: 'EQUIP_JEWEL', jewelId: 'ruby', slot: 'weapon' }).state;
  assert.equal(state.progression.jewels.equipped.ring1, null); assert.ok(deriveLoadout(state).stats.attack > attack);
  reject(state, { type: 'EQUIP_RUNE', runeId: 'power', slot: 'defense' }, 'NOT_OWNED');
  state = step(state, { type: 'UPGRADE_RUNE', runeId: 'power' }).state;
  reject(state, { type: 'EQUIP_RUNE', runeId: 'power', slot: 'defense' }, 'INVALID_SLOT');
});

test('mission/Chronicle/homestead claims use earned progress and cannot be replayed', () => {
  let state = wealthy();
  for (const building of BUILDINGS) state = step(state, { type: 'UPGRADE_BUILDING', buildingId: building.id }).state;
  reject(state, { type: 'CLAIM_HOMESTEAD' }, 'NOT_READY');
  state = run(state).state;
  assert.deepEqual(state.progression.homestead.pending, { essence: 2, research: 1, dust: 1 });
  state = step(state, { type: 'CLAIM_HOMESTEAD' }).state; reject(state, { type: 'CLAIM_HOMESTEAD' }, 'NOT_READY');
  assert.equal(getMissionProgress(state, 'daily_kills').complete, true);
  state = step(state, { type: 'CLAIM_MISSION', missionId: 'daily_kills' }).state;
  reject(state, { type: 'CLAIM_MISSION', missionId: 'daily_kills' }, 'ALREADY_CLAIMED');
  state = step(state, { type: 'CLAIM_MISSION', missionId: 'first_run' }).state;
  reject(state, { type: 'CLAIM_MISSION', missionId: 'first_run' }, 'ALREADY_CLAIMED');
  state = step(state, { type: 'CLAIM_SEASON', tier: 1 }).state;
  reject(state, { type: 'CLAIM_SEASON', tier: 1 }, 'ALREADY_CLAIMED');
  reject(state, { type: 'CLAIM_SEASON', tier: 50 }, 'NOT_READY');
});

test('daily/weekly rollover is monotonic and distinguishes a new day from a new week', () => {
  let state = run(wealthy(), { kills: 80, seconds: 185, won: true }, '2026-10-25').state; // Sunday
  state = step(state, { type: 'CLAIM_MISSION', missionId: 'daily_run' }).state;
  assert.equal(state.progression.missions.week, '2026-10-19');
  reject(state, { type: 'START_RUN', day: '2026-10-24' }, 'CLOCK_REWIND');
  const start = step(state, { type: 'START_RUN', day: '2026-10-26' }); state = start.state;
  assert.equal(state.progression.missions.week, '2026-10-26'); assert.equal(state.progression.missions.weeklyRuns, 0); assert.equal(state.progression.missions.dailyRuns, 0); assert.deepEqual(state.progression.missions.dailyClaimed, []);
  state = step(state, { type: 'FINISH_RUN', runId: start.details.runId, stats: { kills: 20, seconds: 60, won: false } }).state;
  const tuesday = step(state, { type: 'START_RUN', day: '2026-10-27' }).state;
  assert.equal(tuesday.progression.missions.weeklyRuns, 1); assert.equal(tuesday.progression.missions.dailyRuns, 0);
});

test('daily challenge stats and seed are independent of bought upgrades and grant daily win bonus once', () => {
  let first = wealthy(); let second = wealthy();
  second = step(second, { type: 'UPGRADE_HERO', heroId: 'mage' }).state; second = step(second, { type: 'UPGRADE_ITEM', itemId: 'item-1' }).state;
  first = step(first, { type: 'SELECT_MODE', mode: 'daily' }).state; second = step(second, { type: 'SELECT_MODE', mode: 'daily' }).state;
  assert.deepEqual(deriveLoadout(first), deriveLoadout(second));
  const a = step(first, { type: 'START_RUN', day: '2026-10-21' }); const b = step(second, { type: 'START_RUN', day: '2026-10-21' }); assert.equal(a.details.seed, b.details.seed);
  const reward = step(a.state, { type: 'FINISH_RUN', runId: a.details.runId, stats: { kills: 80, seconds: 185, won: true } });
  assert.equal(reward.details.dailyBonus, true); assert.equal(reward.details.firstClear, false);
  const repeat = run(reward.state); assert.equal(repeat.details.dailyBonus, false); assert.equal(reward.details.gold - repeat.details.gold, 100);
});

test('cosmetics and settings never affect power, retain previews, and cannot forge paid ownership', () => {
  let state = wealthy(); const before = deriveLoadout(state);
  state = step(state, { type: 'UNLOCK_COSMETIC', cosmeticId: 'ember' }).state;
  state = step(state, { type: 'EQUIP_COSMETIC', cosmeticId: 'ember' }).state;
  state = step(state, { type: 'PROFILE_SETTINGS', settings: { vfx: 'low', reduceMotion: true } }).state;
  assert.deepEqual(deriveLoadout(state), before);
  reject(state, { type: 'UNLOCK_COSMETIC', cosmeticId: 'celestial' }, 'LOCKED');
  reject(state, { type: 'EQUIP_COSMETIC', cosmeticId: 'crimson' }, 'NOT_OWNED');
  assert.equal(state.profile.gold, 900000 - 120);
});

test('max levels, reset refunds and capped wallets cannot generate currency through loops', () => {
  let state = wealthy(); const gold = state.profile.gold; const essence = state.progression.materials.essence;
  for (let i = 0; i < 4; i++) state = step(state, { type: 'UPGRADE_ITEM', itemId: 'item-1' }).state;
  reject(state, { type: 'UPGRADE_ITEM', itemId: 'item-1' }, 'MAX_LEVEL');
  state = step(state, { type: 'RESET_ITEM', itemId: 'item-1' }).state;
  assert.equal(state.profile.gold, gold); assert.equal(state.progression.materials.essence, essence);
  for (let i = 0; i < 5; i++) state = step(state, { type: 'UPGRADE_TALENT', talentId: 'power' }).state;
  reject(state, { type: 'UPGRADE_TALENT', talentId: 'power' }, 'MAX_LEVEL');
  state = step(state, { type: 'RESET_TALENTS' }).state;
  assert.equal(state.profile.gold, gold); assert.equal(state.progression.materials.essence, essence);
  let capped = copy(state); capped.progression.materials.essence = 999999;
  reject(capped, { type: 'BUY_OFFER', offerId: 'essence_bundle' }, 'CAPACITY');
  capped = copy(capped); capped.profile.gold = 999999; const completed = run(capped); assert.equal(completed.state.profile.gold, 999999); assert.equal(completed.details.gold, 0);
});

test('bounded malformed command corpus never throws or changes accepted state', () => {
  const state = wealthy();
  const values = [null, undefined, false, true, 0, -1, .5, NaN, Infinity, '', '__proto__', 'constructor', [], {}, ['item-1']];
  for (const value of values) {
    for (const command of [{ type: 'FUSE_ITEMS', itemIds: value }, { type: 'EQUIP_ITEM', itemId: value, slot: value }, { type: 'CLAIM_SEASON', tier: value }, { type: 'FINISH_RUN', runId: value, stats: value }, { type: 'SAVE_PRESET', index: value }]) {
      const result = applyCommand(state, command); if (result.ok) assert.equal(validateCampaign(result.state), true); else assert.equal(result.state, state);
    }
  }
  assert.equal(getFeatureState(state, 'unknown').unlocked, false);
  assert.equal(getCommandCost(state, { type: 'UPGRADE_ITEM', itemId: 'item-1' }).gold, 15);
});

test('endless counters remain claimable beyond six hours and all persistent counters saturate safely', () => {
  let state = step(wealthy(), { type: 'SELECT_MODE', mode: 'endless' }).state;
  const finish = run(state, { kills: 2000000, seconds: 2000000, won: false }); state = finish.state;
  assert.equal(state.profile.bestSeconds, 999999); assert.equal(state.profile.totalKills, 999999);
  assert.equal(state.progression.missions.stats.kills, 999999); assert.equal(state.progression.activeRun, null);
  assert.equal(finish.details.gold, 2500); assert.equal(finish.details.essence, 200);
});

test('hero awakening requires max level/stars, spends real earned currencies and increases bounded combat stats', () => {
  let state = wealthy(); state.progression.heroes.mage.shards = 330;
  reject(state, { type: 'AWAKEN_HERO', heroId: 'mage' }, 'LOCKED');
  for (let level = 1; level < 20; level++) state = step(state, { type: 'UPGRADE_HERO', heroId: 'mage' }).state;
  reject(state, { type: 'UPGRADE_HERO', heroId: 'mage' }, 'MAX_LEVEL');
  reject(state, { type: 'AWAKEN_HERO', heroId: 'mage' }, 'LOCKED');
  for (let star = 0; star < 5; star++) state = step(state, { type: 'STAR_HERO', heroId: 'mage' }).state;
  reject(state, { type: 'STAR_HERO', heroId: 'mage' }, 'MAX_LEVEL');
  const before = deriveLoadout(state); const gold = state.profile.gold; const essence = state.progression.materials.essence; const research = state.progression.materials.research;
  const noShards = copy(state); noShards.progression.heroes.mage.shards = 0;
  reject(noShards, { type: 'AWAKEN_HERO', heroId: 'mage' }, 'NO_FUNDS');
  for (let rank = 0; rank < 3; rank++) state = step(state, { type: 'AWAKEN_HERO', heroId: 'mage' }).state;
  assert.equal(state.progression.heroes.mage.awakening, 3); assert.equal(state.progression.heroes.mage.shards, 0);
  assert.equal(state.profile.gold, gold - 6000); assert.equal(state.progression.materials.essence, essence - 600); assert.equal(state.progression.materials.research, research - 300);
  assert.equal(deriveLoadout(state).stats.maxHp, before.stats.maxHp + 36); assert.equal(deriveLoadout(state).stats.attack, before.stats.attack + 6); assert.equal(deriveLoadout(state).stats.critChance, before.stats.critChance + .03);
  reject(state, { type: 'AWAKEN_HERO', heroId: 'mage' }, 'MAX_LEVEL');
  const invalid = copy(state); invalid.progression.heroes.mage.level = 19; assert.equal(validateCampaign(invalid), false);
  assert.deepEqual(normalizeRunConfig(deriveLoadout(state)), deriveLoadout(state));
});

test('maxed relics convert only actual excess fragments and cannot overflow, replay or accept malformed amounts', () => {
  let state = wealthy(); reject(state, { type: 'CONVERT_RELIC_FRAGMENTS', relicId: 'compass', amount: 1 }, 'LOCKED');
  for (let offer = 0; offer < 45; offer++) state = step(state, { type: 'BUY_OFFER', offerId: 'fragment_compass' }).state;
  state = step(state, { type: 'UNLOCK_RELIC', relicId: 'compass' }).state;
  for (let level = 1; level < 10; level++) state = step(state, { type: 'UPGRADE_RELIC', relicId: 'compass' }).state;
  reject(state, { type: 'CONVERT_RELIC_FRAGMENTS', relicId: 'compass', amount: 1 }, 'LOCKED');
  for (let star = 0; star < 5; star++) state = step(state, { type: 'STAR_RELIC', relicId: 'compass' }).state;
  assert.equal(state.progression.relics.compass.fragments, 10);
  for (const amount of [0, -1, .5, Infinity, NaN, '1', 1000000]) reject(state, { type: 'CONVERT_RELIC_FRAGMENTS', relicId: 'compass', amount }, 'INVALID_COMMAND');
  reject(state, { type: 'CONVERT_RELIC_FRAGMENTS', relicId: 'compass', amount: 11 }, 'NO_FUNDS');
  const full = copy(state); full.progression.materials.dust = 999999;
  reject(full, { type: 'CONVERT_RELIC_FRAGMENTS', relicId: 'compass', amount: 1 }, 'CAPACITY');
  const dust = state.progression.materials.dust; const command = { type: 'CONVERT_RELIC_FRAGMENTS', relicId: 'compass', amount: 10 };
  assert.deepEqual(getCommandRewardPreview(state, command), { dust: 10 });
  const result = step(state, command); state = result.state;
  assert.equal(state.progression.materials.dust, dust + 10); assert.equal(state.progression.relics.compass.fragments, 0);
  assert.deepEqual(result.details.reward, { dust: 10 }); reject(state, command, 'NO_FUNDS');
});

test('four-piece gear sets add their second bonus only while four actual instances are equipped', () => {
  let state = wealthy(); let ring, book;
  [state, ring] = craft(state, 'orbit_ring'); [state, book] = craft(state, 'nova_book');
  state = step(state, { type: 'EQUIP_ITEM', itemId: ring, slot: 'ring1' }).state;
  assert.equal(deriveLoadout(state).stats.skillMultiplier, 1);
  state = step(state, { type: 'EQUIP_ITEM', itemId: book, slot: 'book' }).state;
  assert.equal(deriveLoadout(state).stats.skillMultiplier, 1.065);
  state = step(state, { type: 'UNEQUIP_ITEM', slot: 'ring1' }).state;
  assert.equal(deriveLoadout(state).stats.skillMultiplier, 1.025);
});

test('rare gear refining and glyphs affect combat; destructive refunds match the exact public preview', () => {
  let state = wealthy(); const ids = ['item-1'];
  for (let i = 0; i < 8; i++) { let id; [state, id] = craft(state, 'star_wand'); ids.push(id); }
  for (let group = 0; group < 3; group++) state = step(state, { type: 'FUSE_ITEMS', itemIds: ids.slice(group * 3, group * 3 + 3) }).state;
  state = step(state, { type: 'FUSE_ITEMS', itemIds: [ids[0], ids[3], ids[6]] }).state;
  assert.equal(state.progression.inventory[0].rarity, 2);
  const attack = deriveLoadout(state).stats.attack;
  state = step(state, { type: 'REFINE_ITEM', itemId: 'item-1' }).state;
  assert.ok(deriveLoadout(state).stats.attack > attack);
  const refinedAttack = deriveLoadout(state).stats.attack;
  state = step(state, { type: 'GLYPH_ITEM', itemId: 'item-1', glyph: 'power' }).state;
  assert.equal(deriveLoadout(state).stats.attack, refinedAttack + 1.5);
  state = step(state, { type: 'UNEQUIP_ITEM', slot: 'weapon' }).state;
  reject(state, { type: 'DISMANTLE_ITEM', itemId: 'item-1' }, 'INVESTED_FODDER');
  let fresh; [state, fresh] = craft(state, 'star_wand'); state = step(state, { type: 'UPGRADE_ITEM', itemId: fresh }).state;
  const item = state.progression.inventory.find(item => item.id === fresh); const command = { type: 'DISMANTLE_ITEM', itemId: fresh };
  const preview = getDismantleReward(item); assert.deepEqual(preview, getCommandRewardPreview(state, command));
  const gold = state.profile.gold; const essence = state.progression.materials.essence; const dismantle = step(state, command);
  assert.equal(dismantle.state.profile.gold, gold + preview.gold); assert.equal(dismantle.state.progression.materials.essence, essence + preview.essence);
  assert.deepEqual(dismantle.details.refund, preview); reject(dismantle.state, command, 'NOT_FOUND');
});

test('full inventory blocks crafting without spending and converts earned run drops explicitly', () => {
  let state = wealthy();
  for (let n = 3; n <= 1000; n++) state.progression.inventory.push({ ...copy(state.progression.inventory[0]), id: `item-${n}` });
  state.progression.nextItem = 1001;
  assert.equal(validateCampaign(state), true); reject(state, { type: 'CRAFT_ITEM', definitionId: 'star_wand' }, 'INVENTORY_FULL');
  const finish = run(state, { kills: 10, seconds: 30, won: false });
  assert.equal(finish.details.items.length, 0); assert.equal(finish.details.convertedEssence, 10); assert.equal(finish.details.essence, 13);
  assert.equal(finish.state.progression.inventory.length, 1000);
});
