import { HEROES, EQUIPMENT, GEAR_SETS, SLOTS, RARITIES, CHAPTERS, MODES, RELICS, TALENTS, RUNES, JEWELS, ARTIFACTS, COMPANIONS, GUARDIANS, RESEARCH, BUILDINGS, MISSIONS, SHOP_OFFERS, SEASON_REWARDS, FEATURE_RUNS } from './catalog.js';
import {weaponCompatible} from '../gameplay/weapons.js';
import { byId, clone, STAT_BOUNDS } from './state.js';

export const getProfileLevel = state => 1 + Math.floor(state.progression.xp / 120);
export function getFeatureState(state, key) {
  if (typeof key !== 'string') return { unlocked: false, reason: 'ไม่พบระบบนี้' };
  const p = state.progression;
  let requiredRuns = FEATURE_RUNS[key];
  let requiredChapter = null;
  if (key.startsWith('hero:')) requiredRuns = byId(HEROES, key.slice(5))?.unlockRuns;
  if (key.startsWith('slot:')) requiredRuns = byId(SLOTS, key.slice(5))?.unlockRuns;
  if (key.startsWith('chapter:')) {
    const chapter = byId(CHAPTERS, key.slice(8));
    if (!chapter) return { unlocked: false, reason: 'ไม่พบบทนี้' };
    requiredRuns = 0; requiredChapter = chapter.requires;
  }
  if (key.startsWith('mode:')) {
    const mode = byId(MODES, key.slice(5));
    if (!mode) return { unlocked: false, reason: 'ไม่พบโหมดนี้' };
    requiredRuns = mode.unlockRuns || 0; requiredChapter = mode.requires;
  }
  if (requiredRuns === undefined) return { unlocked: false, reason: 'ไม่พบระบบนี้' };
  if (state.profile.runs < requiredRuns) return { unlocked: false, reason: `เล่นให้จบ ${requiredRuns} รอบ (${state.profile.runs}/${requiredRuns})` };
  if (requiredChapter && !p.cleared.includes(requiredChapter)) return { unlocked: false, reason: `ผ่าน ${byId(CHAPTERS, requiredChapter).name} ในโหมดผจญภัย` };
  return { unlocked: true, reason: '' };
}
export const getUnlockReason = (state, key) => getFeatureState(state, key).reason;
export const canUnlockHero = (state, id) => !!byId(HEROES, id) && !state.progression.heroes[id].level && getFeatureState(state, `hero:${id}`).unlocked;
export function getItemStats(item) {
  const def = byId(EQUIPMENT, item?.definitionId);
  if (!def || !RARITIES[item.rarity]) return {};
  const scale = RARITIES[item.rarity].multiplier * (1 + (item.level - 1) * .08) * (1 + item.refinement * .02);
  const stats = Object.fromEntries(Object.entries(def.stats).map(([key, value]) => [key, Math.round(value * scale * 10000) / 10000]));
  const glyph = { power: { attack: 1.5 }, guard: { maxHp: 8 }, haste: { fireDelay: -.35 } }[item.glyph];
  for (const [key, value] of Object.entries(glyph || {})) stats[key] = (stats[key] || 0) + value;
  return stats;
}
export const itemStats = getItemStats;
export const getUpgradeCost = item => item ? { gold: 15 * item.level * (item.rarity + 1), essence: 2 * item.level } : {};
export function isItemProtected(state, itemId) {
  const p = state.progression;
  const item = p.inventory.find(item => item.id === itemId);
  return !item || item.locked || Object.values(p.equipment).includes(itemId) || p.presets.some(preset => preset && Object.values(preset.equipment).includes(itemId));
}
export function getForgeCandidates(state, itemId) {
  const main = state.progression.inventory.find(item => item.id === itemId);
  if (!main || main.locked || main.rarity >= 5) return [];
  return state.progression.inventory.filter(item => item.id !== main.id && item.definitionId === main.definitionId && item.rarity === main.rarity && !isItemProtected(state, item.id) && item.refinement === 0 && item.glyph === null);
}
export function getMissionProgress(state, missionId) {
  const mission = byId(MISSIONS, missionId);
  if (!mission) return { current: 0, target: 0, complete: false, claimed: false };
  const m = state.progression.missions;
  const stat = mission.stat[0].toUpperCase() + mission.stat.slice(1);
  const current = mission.period === 'daily' ? m[`daily${stat}`] : mission.period === 'weekly' ? m[`weekly${stat}`] : m.stats[mission.stat];
  const claimed = (mission.period === 'daily' ? m.dailyClaimed : mission.period === 'weekly' ? m.weeklyClaimed : m.claimed).includes(missionId);
  return { current, target: mission.target, complete: current >= mission.target, claimed };
}
export function getCommandCost(state, command) {
  const p = state.progression;
  const item = p.inventory.find(item => item.id === command.itemId);
  switch (command.type) {
    case 'UNLOCK_HERO': return clone(byId(HEROES, command.heroId)?.unlockCost || {});
    case 'UPGRADE_HERO': { const level = p.heroes[command.heroId]?.level || 0; return { gold: 30 * level + 10, essence: 3 * level }; }
    case 'STAR_HERO': return { shards: 10 * ((p.heroes[command.heroId]?.stars || 0) + 1) };
    case 'AWAKEN_HERO': { const next = (p.heroes[command.heroId]?.awakening || 0) + 1; return { gold: 1000 * next, essence: 100 * next, research: 50 * next, shards: 30 * next }; }
    case 'CRAFT_ITEM': return clone(byId(EQUIPMENT, command.definitionId)?.craftCost || {});
    case 'UPGRADE_ITEM': return getUpgradeCost(item);
    case 'REFINE_ITEM': return { gold: 60 * ((item?.refinement || 0) + 1), research: 3 * ((item?.refinement || 0) + 1) };
    case 'GLYPH_ITEM': return { gold: 80, dust: 12 };
    case 'FUSE_ITEMS': { const main = p.inventory.find(item => item.id === command.itemIds?.[0]); return { gold: 40 * ((main?.rarity || 0) + 1), essence: 5 * ((main?.rarity || 0) + 1) }; }
    case 'UNLOCK_RELIC': return { fragments: byId(RELICS, command.relicId)?.unlockFragments || 5 };
    case 'UPGRADE_RELIC': { const level = p.relics[command.relicId]?.level || 0; return { gold: 30 * level, essence: 5 * level }; }
    case 'STAR_RELIC': return { fragments: 5 * ((p.relics[command.relicId]?.stars || 0) + 1) };
    case 'CONVERT_RELIC_FRAGMENTS': return { fragments: Number.isSafeInteger(command.amount) && command.amount > 0 ? command.amount : 0 };
    case 'UPGRADE_TALENT': { const next = (p.talents[command.talentId] || 0) + 1; return { gold: 30 * next, essence: 2 * next }; }
    case 'UPGRADE_RUNE': { const next = (p.runes.owned[command.runeId] || 0) + 1; return { gold: 25 * next, essence: 8 * next }; }
    case 'UPGRADE_JEWEL': { const next = (p.jewels.owned[command.jewelId] || 0) + 1; return { gold: 25 * next, dust: 4 * next }; }
    case 'UPGRADE_ARTIFACT': { const next = (p.artifacts[command.artifactId] || 0) + 1; return { gold: 80 * next, essence: 15 * next }; }
    case 'UPGRADE_COMPANION': { const next = (p.companions[command.companionId] || 0) + 1; return { gold: 70 * next, essence: 12 * next }; }
    case 'UPGRADE_GUARDIAN': { const next = (p.guardians[command.guardianId] || 0) + 1; return { gold: 100 * next, research: 10 * next }; }
    case 'UPGRADE_RESEARCH': { const next = (p.research[command.researchId] || 0) + 1; return { gold: 50 * next, research: 5 * next }; }
    case 'UPGRADE_BUILDING': { const next = (p.homestead.buildings[command.buildingId] || 0) + 1; return { gold: 70 * next, research: 5 * next }; }
    case 'BUY_OFFER': return clone(byId(SHOP_OFFERS, command.offerId)?.cost || {});
    case 'UNLOCK_COSMETIC': return typeof command.cosmeticId === 'string' && command.cosmeticId.endsWith(':ember') ? { gold: 120 } : {};
    default: return {};
  }
}
export function getDismantleReward(item) {
  return item ? { gold: 20 + item.rarity * 10 + item.invested.gold, essence: 2 + item.rarity * 2 + item.invested.essence } : {};
}
export function getCommandRewardPreview(state, command) {
  const p = state.progression; const item = p.inventory.find(item => item.id === command.itemId);
  switch (command.type) {
    case 'DISMANTLE_ITEM': return getDismantleReward(item);
    case 'RESET_ITEM': return clone(item?.invested || {});
    case 'FUSE_ITEMS': return (command.itemIds || []).slice(1).reduce((reward, id) => {
      const item = p.inventory.find(item => item.id === id);
      reward.gold += item?.invested.gold || 0; reward.essence += item?.invested.essence || 0; return reward;
    }, { gold: 0, essence: 0 });
    case 'RESET_TALENTS': { const sum = Object.values(p.talents).reduce((sum, level) => sum + level * (level + 1) / 2, 0); return { gold: sum * 30, essence: sum * 2 }; }
    case 'CLAIM_HOMESTEAD': return clone(p.homestead.pending);
    case 'CLAIM_MISSION': return clone(byId(MISSIONS, command.missionId)?.reward || {});
    case 'CLAIM_SEASON': return clone(SEASON_REWARDS.find(tier => tier.tier === command.tier)?.reward || {});
    case 'BUY_OFFER': return clone(byId(SHOP_OFFERS, command.offerId)?.reward || {});
    case 'CONVERT_RELIC_FRAGMENTS': return { dust: Number.isSafeInteger(command.amount) && command.amount > 0 ? command.amount : 0 };
    default: return {};
  }
}
function addStats(target, stats, scale = 1) {
  for (const [key, value] of Object.entries(stats || {})) target[key] = (target[key] || 0) + value * scale;
}
function engineConfig(heroId, chapterId, mode) {
  const hero = byId(HEROES, heroId); const chapter = byId(CHAPTERS, chapterId);
  return { version: 1, balanceVersion: 1, heroId, chapterId, mode,
    stats: { ...hero.stats, armor: 0, critChance: .03, critDamage: 1.5, pickupRadius: 110, healingMultiplier: 1, skillMultiplier: 1, bossDamageMultiplier: 1 },
    weaponId: null, weaponEffect: 'balanced', artifact: null, companions: [], guardian: null,
    modifiers: { novaRadius: 1, chainTargets: 0, orbitRadius: 1, shieldEvery: 0, killHeal: 0 },
    chapter: { enemyHpMultiplier: chapter.enemyHpMultiplier, enemyDamageMultiplier: chapter.enemyDamageMultiplier, spawnMultiplier: chapter.spawnMultiplier, bossAtSeconds: chapter.bossAtSeconds, bossHpMultiplier: chapter.bossHpMultiplier, bossName: chapter.bossName, durationSeconds: mode === 'resource' ? 90 : 0 },
  };
}
export function deriveLoadout(state) {
  const p = state.progression;
  if (p.mode === 'daily') { const config = engineConfig('mage', 'astral', 'daily'); config.weaponId = 'star_wand'; return config; }
  const config = engineConfig(p.heroId, p.chapterId, p.mode); const stats = config.stats;
  const hero = p.heroes[p.heroId];
  addStats(stats, { maxHp: 6 * (hero.level - 1) + 10 * hero.stars, attack: .8 * (hero.level - 1) + 1.5 * hero.stars });
  addStats(stats, byId(HEROES, p.heroId).awakeningStats, hero.awakening);
  if (p.supportHeroId) addStats(stats, byId(HEROES, p.supportHeroId).support, 1 + (p.heroes[p.supportHeroId].level - 1) * .02 + p.heroes[p.supportHeroId].awakening * .1);
  const sets = {};
  for (const id of Object.values(p.equipment)) {
    const item = p.inventory.find(item => item.id === id);
    if (!item) continue;
    const def = byId(EQUIPMENT, item.definitionId);
    // Legacy mismatched weapons contribute neither stats nor set power.
    if (def.slot === 'weapon' && !weaponCompatible(p.heroId,def.id)) continue;
    addStats(stats, getItemStats(item));
    sets[def.set] = (sets[def.set] || 0) + 1;
    if (def.slot === 'weapon') { config.weaponId = def.id; config.weaponEffect = def.effect; }
  }
  for (const set of GEAR_SETS) for (const bonus of set.bonuses) if (sets[set.id] >= bonus.pieces) addStats(stats, bonus.stats);
  for (const def of TALENTS) addStats(stats, def.stats, p.talents[def.id]);
  for (const id of Object.values(p.runes.equipped).filter(Boolean)) addStats(stats, byId(RUNES, id).stats, p.runes.owned[id]);
  for (const [slot, id] of Object.entries(p.jewels.equipped)) if (id && p.equipment[slot]) addStats(stats, byId(JEWELS, id).stats, p.jewels.owned[id]);
  const relicSets = {};
  for (const def of RELICS) {
    const relic = p.relics[def.id];
    if (!relic.level) continue;
    addStats(stats, def.stats, relic.level * (1 + relic.stars * .2)); relicSets[def.set] = (relicSets[def.set] || 0) + 1;
  }
  for (const count of Object.values(relicSets)) if (count === 4) stats.maxHp += 10;
  for (const def of RESEARCH) addStats(stats, def.stats, p.research[def.id]);
  for (const def of BUILDINGS) addStats(stats, def.stats, p.homestead.buildings[def.id]);
  if (p.artifactId) config.artifact = { id: p.artifactId, level: p.artifacts[p.artifactId] };
  if (p.guardianId) config.guardian = { id: p.guardianId, level: p.guardians[p.guardianId] };
  config.companions = p.companionIds.map(id => ({ id, level: p.companions[id] }));
  config.modifiers.novaRadius += p.research.sigils * .02;
  config.modifiers.orbitRadius += p.research.totems * .015;
  config.modifiers.chainTargets = Math.floor(p.research.altars / 4);
  if (p.research.totems >= 5) config.modifiers.shieldEvery = 20 - p.research.totems;
  if (relicSets.wild === 4) config.modifiers.killHeal = .15;
  for (const [key, [min, max]] of Object.entries(STAT_BOUNDS)) stats[key] = Math.round(Math.max(min, Math.min(max, stats[key])) * 10000) / 10000;
  return config;
}
