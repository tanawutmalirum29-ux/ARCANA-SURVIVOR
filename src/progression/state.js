import { defaultProfile } from '../storage.js';
import { MAX_VALUE, HEROES, EQUIPMENT, SLOTS, RARITIES, CHAPTERS, MODES, RELICS, TALENTS, RUNES, JEWELS, ARTIFACTS, COMPANIONS, GUARDIANS, RESEARCH, BUILDINGS, MISSIONS } from './catalog.js';

export const clone = value => structuredClone(value);
export const byId = (catalog, id) => catalog.find(entry => entry.id === id);
export const zeroes = catalog => Object.fromEntries(catalog.map(entry => [entry.id, 0]));
export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const integer = (value, min = 0, max = MAX_VALUE) => Number.isSafeInteger(value) && value >= min && value <= max;
export const keys = (object, expected) => record(object) && Object.keys(object).length === expected.length && expected.every(key => Object.hasOwn(object, key));
export const unique = array => Array.isArray(array) && new Set(array).size === array.length;
export const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
export function weekOf(day) {
  if (!day) return '';
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
const earnedCosmetics = ['apprentice', 'ember', 'moon'];
export function validateLegacyProfile(profile) {
  return keys(profile, ['version', 'gold', 'totalKills', 'runs', 'bestSeconds', 'skin', 'owned', 'settings']) && profile.version === 1
    && ['gold', 'totalKills', 'runs', 'bestSeconds'].every(key => integer(profile[key]))
    && unique(profile.owned) && profile.owned.includes('apprentice') && profile.owned.every(id => earnedCosmetics.includes(id))
    && profile.owned.includes(profile.skin) && keys(profile.settings, ['vfx', 'reduceMotion'])
    && ['low', 'medium', 'high'].includes(profile.settings.vfx) && typeof profile.settings.reduceMotion === 'boolean';
}
export function createItem(id, definitionId, rarity = 0) {
  return { id, definitionId, rarity, level: 1, locked: false, refinement: 0, glyph: null, invested: { gold: 0, essence: 0 } };
}
export function createCampaign(legacyProfile = defaultProfile()) {
  if (!validateLegacyProfile(legacyProfile)) throw new TypeError('A valid normalized version 1 profile is required');
  const equipment = Object.fromEntries(SLOTS.map(slot => [slot.id, null]));
  equipment.weapon = 'item-1'; equipment.armor = 'item-2';
  return {
    schemaVersion: 2, revision: 0, profile: clone(legacyProfile),
    progression: {
      xp: 0, heroId: 'mage', supportHeroId: null,
      heroes: Object.fromEntries(HEROES.map(hero => [hero.id, { level: hero.id === 'mage' ? 1 : 0, stars: 0, shards: 0 }])),
      chapterId: 'astral', mode: 'campaign', cleared: [],
      inventory: [createItem('item-1', 'star_wand'), createItem('item-2', 'astral_robe')], equipment,
      materials: { essence: 0, research: 0, dust: 0 },
      relics: Object.fromEntries(RELICS.map(relic => [relic.id, { fragments: 0, level: 0, stars: 0 }])),
      talents: zeroes(TALENTS), runes: { owned: zeroes(RUNES), equipped: { attack: null, defense: null, utility: null } },
      jewels: { owned: zeroes(JEWELS), equipped: Object.fromEntries(SLOTS.map(slot => [slot.id, null])) },
      artifacts: zeroes(ARTIFACTS), artifactId: null, companions: zeroes(COMPANIONS), companionIds: [],
      guardians: zeroes(GUARDIANS), guardianId: null, research: zeroes(RESEARCH),
      homestead: { buildings: zeroes(BUILDINGS), pending: { essence: 0, research: 0, dust: 0 } },
      presets: [null, null, null],
      missions: { stats: { runs: 0, kills: 0, wins: 0, upgrades: 0, crafted: 0 }, claimed: [], day: '', dailyRuns: 0, dailyKills: 0, dailyWins: 0, dailyClaimed: [], week: '', weeklyRuns: 0, weeklyKills: 0, weeklyWins: 0, weeklyClaimed: [] },
      season: { xp: 0, claimed: [] }, claimed: [], nextItem: 3, nextRun: 1, activeRun: null,
    },
  };
}
const idsOf = catalog => catalog.map(entry => entry.id);
const validLevels = (values, catalog) => keys(values, idsOf(catalog)) && catalog.every(def => integer(values[def.id], 0, def.maxLevel));
const validWallet = value => keys(value, ['essence', 'research', 'dust']) && Object.values(value).every(n => integer(n));
const claimList = (value, period) => unique(value) && value.every(id => byId(MISSIONS, id)?.period === period);
const nullableOwned = (id, levels) => id === null || (typeof id === 'string' && Object.hasOwn(levels, id) && levels[id] > 0);
const itemNumber = id => typeof id === 'string' && /^item-[1-9]\d*$/.test(id) ? Number(id.slice(5)) : NaN;
const runNumber = id => typeof id === 'string' && /^run-[1-9]\d*$/.test(id) ? Number(id.slice(4)) : NaN;

function validEquipment(equipment, inventory, runs) {
  return keys(equipment, idsOf(SLOTS)) && unique(Object.values(equipment).filter(Boolean)) && SLOTS.every(slot => {
    const id = equipment[slot.id];
    if (id === null) return true;
    const item = inventory.find(item => item.id === id);
    return item && byId(EQUIPMENT, item.definitionId).slot === slot.type && runs >= slot.unlockRuns;
  });
}
function validRunes(equipped, owned) {
  return keys(equipped, ['attack', 'defense', 'utility']) && Object.entries(equipped).every(([slot, id]) => id === null || (nullableOwned(id, owned) && byId(RUNES, id)?.category === slot));
}
function validJewels(equipped, owned, runs) {
  return keys(equipped, idsOf(SLOTS)) && unique(Object.values(equipped).filter(Boolean)) && SLOTS.every(slot => nullableOwned(equipped[slot.id], owned) && (equipped[slot.id] === null || runs >= slot.unlockRuns));
}
function validPreset(preset, p, profile) {
  if (!keys(preset, ['heroId', 'supportHeroId', 'equipment', 'runes', 'jewels', 'artifactId', 'companionIds', 'guardianId'])) return false;
  return Object.hasOwn(p.heroes, preset.heroId) && p.heroes[preset.heroId].level > 0
    && (preset.supportHeroId === null || (preset.supportHeroId !== preset.heroId && p.heroes[preset.supportHeroId]?.level > 0 && profile.runs >= 5))
    && validEquipment(preset.equipment, p.inventory, profile.runs) && validRunes(preset.runes, p.runes.owned)
    && validJewels(preset.jewels, p.jewels.owned, profile.runs) && nullableOwned(preset.artifactId, p.artifacts)
    && nullableOwned(preset.guardianId, p.guardians) && unique(preset.companionIds) && preset.companionIds.length <= 2
    && preset.companionIds.every(id => nullableOwned(id, p.companions) && id !== null);
}
export const STAT_BOUNDS = Object.freeze({
  maxHp: [1, 3000], attack: [1, 500], speed: [100, 350], fireDelay: [8, 60], armor: [0, .65],
  critChance: [0, .6], critDamage: [1, 3], pickupRadius: [20, 450],
  healingMultiplier: [1, 3], skillMultiplier: [1, 3], bossDamageMultiplier: [1, 3],
});
const boundedRecord = (value, bounds) => keys(value, Object.keys(bounds)) && Object.entries(bounds).every(([key, [min, max]]) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= min && value[key] <= max);
export function validateRunConfig(config) {
  if (!keys(config, ['version', 'balanceVersion', 'heroId', 'chapterId', 'mode', 'stats', 'weaponId', 'weaponEffect', 'artifact', 'companions', 'guardian', 'modifiers', 'chapter'])) return false;
  if (config.version !== 1 || config.balanceVersion !== 1 || !byId(HEROES, config.heroId) || !byId(CHAPTERS, config.chapterId) || !byId(MODES, config.mode)) return false;
  if (!boundedRecord(config.stats, STAT_BOUNDS) || !(config.weaponId === null || byId(EQUIPMENT, config.weaponId)?.slot === 'weapon') || !['balanced', 'pierce', 'rapid'].includes(config.weaponEffect)) return false;
  const support = (value, catalog) => value === null || (keys(value, ['id', 'level']) && byId(catalog, value.id) && integer(value.level, 1, byId(catalog, value.id).maxLevel));
  if (!support(config.artifact, ARTIFACTS) || !support(config.guardian, GUARDIANS) || !Array.isArray(config.companions) || config.companions.length > 2 || !unique(config.companions.map(x => x?.id)) || !config.companions.every(x => x !== null && support(x, COMPANIONS))) return false;
  if (!boundedRecord(config.modifiers, { novaRadius: [1, 2], chainTargets: [0, 4], orbitRadius: [1, 2], shieldEvery: [0, 120], killHeal: [0, 5] })) return false;
  const chapter = config.chapter;
  return keys(chapter, ['enemyHpMultiplier', 'enemyDamageMultiplier', 'spawnMultiplier', 'bossAtSeconds', 'bossHpMultiplier', 'bossName', 'durationSeconds'])
    && ['enemyHpMultiplier', 'enemyDamageMultiplier', 'spawnMultiplier', 'bossHpMultiplier'].every(key => Number.isFinite(chapter[key]) && chapter[key] >= .1 && chapter[key] <= 10)
    && integer(chapter.bossAtSeconds, 1, 3600) && integer(chapter.durationSeconds, 0, 3600) && typeof chapter.bossName === 'string' && chapter.bossName.length <= 100;
}
export function validateCampaign(state) {
  try {
    if (!keys(state, ['schemaVersion', 'revision', 'profile', 'progression']) || state.schemaVersion !== 2 || !integer(state.revision, 0, Number.MAX_SAFE_INTEGER - 1) || !validateLegacyProfile(state.profile)) return false;
    const p = state.progression;
    if (!keys(p, ['xp', 'heroId', 'supportHeroId', 'heroes', 'chapterId', 'mode', 'cleared', 'inventory', 'equipment', 'materials', 'relics', 'talents', 'runes', 'jewels', 'artifacts', 'artifactId', 'companions', 'companionIds', 'guardians', 'guardianId', 'research', 'homestead', 'presets', 'missions', 'season', 'claimed', 'nextItem', 'nextRun', 'activeRun'])) return false;
    if (!integer(p.xp) || !keys(p.heroes, idsOf(HEROES)) || !HEROES.every(def => {
      const hero = p.heroes[def.id];
      return keys(hero, ['level', 'stars', 'shards']) && integer(hero.level, 0, def.maxLevel) && integer(hero.stars, 0, def.maxStars) && integer(hero.shards) && (hero.level > 0 || hero.stars === 0);
    }) || !p.heroes[p.heroId]?.level || p.heroes.mage.level === 0) return false;
    if (p.supportHeroId !== null && (!p.heroes[p.supportHeroId]?.level || p.supportHeroId === p.heroId || state.profile.runs < 5)) return false;
    if (!unique(p.cleared) || !p.cleared.every(id => byId(CHAPTERS, id)) || !p.cleared.every(id => !byId(CHAPTERS, id).requires || p.cleared.includes(byId(CHAPTERS, id).requires))) return false;
    const chapter = byId(CHAPTERS, p.chapterId); const mode = byId(MODES, p.mode);
    if (!chapter || (chapter.requires && !p.cleared.includes(chapter.requires)) || !mode || (mode.requires && !p.cleared.includes(mode.requires)) || state.profile.runs < (mode.unlockRuns || 0)) return false;
    if (!integer(p.nextItem, 3, Number.MAX_SAFE_INTEGER - 1) || !integer(p.nextRun, 1, Number.MAX_SAFE_INTEGER - 1) || !Array.isArray(p.inventory) || p.inventory.length > 1000 || !unique(p.inventory.map(item => item?.id))) return false;
    if (!p.inventory.every(item => keys(item, ['id', 'definitionId', 'rarity', 'level', 'locked', 'refinement', 'glyph', 'invested']) && integer(itemNumber(item.id), 1, p.nextItem - 1) && byId(EQUIPMENT, item.definitionId)
      && integer(item.rarity, 0, 5) && integer(item.level, 1, RARITIES[item.rarity].maxLevel) && typeof item.locked === 'boolean' && integer(item.refinement, 0, 10)
      && [null, 'power', 'guard', 'haste'].includes(item.glyph) && keys(item.invested, ['gold', 'essence']) && Object.values(item.invested).every(n => integer(n)))) return false;
    if (!validEquipment(p.equipment, p.inventory, state.profile.runs) || !validWallet(p.materials) || !keys(p.relics, idsOf(RELICS))) return false;
    if (!RELICS.every(def => { const r = p.relics[def.id]; return keys(r, ['fragments', 'level', 'stars']) && integer(r.fragments) && integer(r.level, 0, def.maxLevel) && integer(r.stars, 0, def.maxStars) && (r.level > 0 || r.stars === 0); })) return false;
    if (!validLevels(p.talents, TALENTS) || !keys(p.runes, ['owned', 'equipped']) || !validLevels(p.runes.owned, RUNES) || !validRunes(p.runes.equipped, p.runes.owned)
      || !keys(p.jewels, ['owned', 'equipped']) || !validLevels(p.jewels.owned, JEWELS) || !validJewels(p.jewels.equipped, p.jewels.owned, state.profile.runs)) return false;
    if (!validLevels(p.artifacts, ARTIFACTS) || !nullableOwned(p.artifactId, p.artifacts) || !validLevels(p.companions, COMPANIONS) || !unique(p.companionIds) || p.companionIds.length > 2 || !p.companionIds.every(id => id !== null && nullableOwned(id, p.companions))
      || !validLevels(p.guardians, GUARDIANS) || !nullableOwned(p.guardianId, p.guardians) || !validLevels(p.research, RESEARCH)) return false;
    if (!keys(p.homestead, ['buildings', 'pending']) || !validLevels(p.homestead.buildings, BUILDINGS) || !validWallet(p.homestead.pending) || !Array.isArray(p.presets) || p.presets.length !== 3 || !p.presets.every(preset => preset === null || validPreset(preset, p, state.profile))) return false;
    const m = p.missions;
    if (!keys(m, ['stats', 'claimed', 'day', 'dailyRuns', 'dailyKills', 'dailyWins', 'dailyClaimed', 'week', 'weeklyRuns', 'weeklyKills', 'weeklyWins', 'weeklyClaimed'])
      || !keys(m.stats, ['runs', 'kills', 'wins', 'upgrades', 'crafted']) || !Object.values(m.stats).every(n => integer(n)) || m.stats.wins > m.stats.runs || m.stats.runs > state.profile.runs
      || !['dailyRuns', 'dailyKills', 'dailyWins', 'weeklyRuns', 'weeklyKills', 'weeklyWins'].every(key => integer(m[key])) || !claimList(m.claimed, 'lifetime') || !claimList(m.dailyClaimed, 'daily') || !claimList(m.weeklyClaimed, 'weekly')) return false;
    if (!(m.day === '' || validDay(m.day)) || m.week !== weekOf(m.day)) return false;
    if (!keys(p.season, ['xp', 'claimed']) || !integer(p.season.xp) || !unique(p.season.claimed) || !p.season.claimed.every(tier => integer(tier, 1, 50) && tier * 100 <= p.season.xp)) return false;
    if (!unique(p.claimed) || !p.claimed.every(key => typeof key === 'string' && ((key.startsWith('run:') && integer(runNumber(key.slice(4)), 1, p.nextRun - 1)) || (key.startsWith('daily:') && validDay(key.slice(6)))))) return false;
    if (p.activeRun !== null) {
      const run = p.activeRun;
      if (!keys(run, ['id', 'seed', 'chapterId', 'mode', 'day', 'runConfig']) || !integer(runNumber(run.id), 1, p.nextRun - 1) || p.claimed.includes(`run:${run.id}`) || !integer(run.seed, 0, 4294967295)
        || !validDay(run.day) || run.day !== m.day || !validateRunConfig(run.runConfig) || run.chapterId !== run.runConfig.chapterId || run.mode !== run.runConfig.mode) return false;
    }
    return true;
  } catch { return false; }
}
