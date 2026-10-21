export * from './catalog.js';
export { createCampaign, validateCampaign, validateLegacyProfile, validateRunConfig } from './state.js';
export * from './selectors.js';

import { MAX_VALUE, HEROES, EQUIPMENT, SLOTS, RARITIES, CHAPTERS, MODES, RELICS, TALENTS, RUNES, JEWELS, ARTIFACTS, COMPANIONS, GUARDIANS, RESEARCH, BUILDINGS, MISSIONS, SHOP_OFFERS, SEASON_REWARDS } from './catalog.js';
import { byId, clone, keys, integer, unique, validDay, weekOf, createItem, validateCampaign } from './state.js';
import { deriveLoadout, getFeatureState, getCommandCost, getMissionProgress, isItemProtected } from './selectors.js';

export const ERROR_MESSAGES = Object.freeze({
  OK: 'บันทึกแล้ว', INVALID_STATE: 'ข้อมูลเซฟไม่ถูกต้อง กรุณาเก็บสำเนาไว้ก่อนกู้คืน', INVALID_COMMAND: 'คำสั่งไม่ถูกต้อง',
  UNKNOWN_COMMAND: 'ไม่พบคำสั่งนี้', NOT_FOUND: 'ไม่พบรายการนี้', LOCKED: 'ระบบนี้ยังไม่ปลดล็อก', NOT_OWNED: 'ยังไม่ได้ครอบครอง',
  NO_FUNDS: 'ทรัพยากรไม่เพียงพอ', MAX_LEVEL: 'ถึงระดับสูงสุดแล้ว', NO_CHANGE: 'ตั้งค่าอยู่แล้ว',
  ALREADY_OWNED: 'ครอบครองแล้ว', ALREADY_CLAIMED: 'รับรางวัลนี้แล้ว', NOT_READY: 'ยังไม่ครบเงื่อนไข',
  INVALID_SLOT: 'ช่องสวมใส่ไม่ตรงประเภท', ITEM_PROTECTED: 'อุปกรณ์ถูกล็อก สวมใส่ หรืออยู่ในพรีเซ็ต',
  INVALID_FUSION: 'ต้องใช้อุปกรณ์ชนิดและความหายากเดียวกัน 3 ชิ้นที่ไม่ซ้ำกัน', INVESTED_FODDER: 'วัตถุดิบที่มีการขัดเกลาหรือสลักอักขระไม่สามารถหลอมได้',
  EMPTY_PRESET: 'ยังไม่ได้บันทึกพรีเซ็ตนี้', INVENTORY_FULL: 'คลังเต็ม กรุณาแยกชิ้นส่วนก่อน', CAPACITY: 'ทรัพยากรจะเกินความจุ กรุณาใช้บางส่วนก่อน',
  RUN_ACTIVE: 'มีรอบที่ยังไม่จบ กรุณากลับเข้าเล่นหรือยุติรอบ', UNKNOWN_RUN: 'ไม่พบรอบที่กำลังเล่นนี้', INVALID_RESULT: 'ผลการเล่นไม่ถูกต้อง',
  CLOCK_REWIND: 'วันที่ย้อนหลังจากเซฟ กรุณาตรวจวันบนอุปกรณ์', LIMIT_REACHED: 'ถึงขีดจำกัดของข้อมูล', INTERNAL_ERROR: 'ไม่สามารถทำรายการได้โดยปลอดภัย',
});

const COMMAND_FIELDS = Object.freeze({
  SELECT_HERO: ['heroId'], UNLOCK_HERO: ['heroId'], UPGRADE_HERO: ['heroId'], STAR_HERO: ['heroId'], SELECT_SUPPORT: ['heroId'],
  SELECT_CHAPTER: ['chapterId'], SELECT_MODE: ['mode'], EQUIP_ITEM: ['itemId', 'slot'], UNEQUIP_ITEM: ['slot'], LOCK_ITEM: ['itemId', 'locked'],
  UPGRADE_ITEM: ['itemId'], RESET_ITEM: ['itemId'], REFINE_ITEM: ['itemId'], GLYPH_ITEM: ['itemId', 'glyph'], FUSE_ITEMS: ['itemIds'], DISMANTLE_ITEM: ['itemId'], CRAFT_ITEM: ['definitionId'],
  SAVE_PRESET: ['index'], LOAD_PRESET: ['index'], UNLOCK_RELIC: ['relicId'], UPGRADE_RELIC: ['relicId'], STAR_RELIC: ['relicId'], UPGRADE_TALENT: ['talentId'], RESET_TALENTS: [],
  UPGRADE_RUNE: ['runeId'], UPGRADE_JEWEL: ['jewelId'], EQUIP_RUNE: ['runeId', 'slot'], EQUIP_JEWEL: ['jewelId', 'slot'],
  UPGRADE_ARTIFACT: ['artifactId'], UPGRADE_COMPANION: ['companionId'], UPGRADE_GUARDIAN: ['guardianId'], EQUIP_ARTIFACT: ['artifactId'], EQUIP_COMPANION: ['companionId'], EQUIP_GUARDIAN: ['guardianId'],
  UPGRADE_RESEARCH: ['researchId'], UPGRADE_BUILDING: ['buildingId'], CLAIM_HOMESTEAD: [], CLAIM_MISSION: ['missionId'], CLAIM_SEASON: ['tier'], BUY_OFFER: ['offerId'],
  FINISH_RUN: ['runId', 'stats'], ABANDON_RUN: ['runId'], PROFILE_SETTINGS: ['settings'], EQUIP_COSMETIC: ['cosmeticId'], UNLOCK_COSMETIC: ['cosmeticId'],
});
class RuleError extends Error { constructor(code) { super(code); this.code = code; } }
const requireRule = (condition, code) => { if (!condition) throw new RuleError(code); };
const bump = (object, key, amount = 1) => { object[key] = Math.min(MAX_VALUE, object[key] + amount); };
const feature = (state, key) => requireRule(getFeatureState(state, key).unlocked, 'LOCKED');
const definition = (catalog, id) => { const found = byId(catalog, id); requireRule(!!found, 'NOT_FOUND'); return found; };
const findItem = (state, id) => { const item = state.progression.inventory.find(item => item.id === id); requireRule(!!item, 'NOT_FOUND'); return item; };
function spend(state, cost, command) {
  const p = state.progression;
  const target = key => key === 'gold' ? state.profile : key === 'shards' ? p.heroes[command.heroId] : key === 'fragments' ? p.relics[command.relicId] : p.materials;
  for (const [key, amount] of Object.entries(cost)) requireRule(integer(amount) && target(key)?.[key] >= amount, 'NO_FUNDS');
  for (const [key, amount] of Object.entries(cost)) target(key)[key] -= amount;
}
function credit(state, reward, cap = false) {
  const p = state.progression; const received = {};
  const entries = Object.entries(reward).filter(([key]) => ['gold', 'essence', 'research', 'dust'].includes(key));
  for (const [key, amount] of entries) {
    const wallet = key === 'gold' ? state.profile : p.materials;
    requireRule(integer(amount) && (cap || wallet[key] + amount <= MAX_VALUE), 'CAPACITY');
  }
  for (const part of reward.relicFragments || []) requireRule(!!p.relics[part.id] && integer(part.amount) && (cap || p.relics[part.id].fragments + part.amount <= MAX_VALUE), 'CAPACITY');
  for (const [key, amount] of entries) { const wallet = key === 'gold' ? state.profile : p.materials; received[key] = Math.min(amount, MAX_VALUE - wallet[key]); wallet[key] += received[key]; }
  if (reward.relicFragments) received.relicFragments = reward.relicFragments.map(part => {
    const amount = Math.min(part.amount, MAX_VALUE - p.relics[part.id].fragments); p.relics[part.id].fragments += amount; return { id: part.id, amount };
  });
  return received;
}
function costAndUpgrade(state, command, featureKey, catalog, levels, id) {
  feature(state, featureKey); const def = definition(catalog, id);
  requireRule(levels[id] < def.maxLevel, 'MAX_LEVEL'); spend(state, getCommandCost(state, command), command);
  levels[id]++; bump(state.progression.missions.stats, 'upgrades');
}
function resetPeriod(missions, day) {
  if (missions.day !== day) {
    missions.day = day; missions.dailyRuns = 0; missions.dailyKills = 0; missions.dailyWins = 0; missions.dailyClaimed = [];
  }
  const week = weekOf(day);
  if (missions.week !== week) {
    missions.week = week; missions.weeklyRuns = 0; missions.weeklyKills = 0; missions.weeklyWins = 0; missions.weeklyClaimed = [];
  }
}
const hash = string => { let value = 2166136261; for (let i = 0; i < string.length; i++) value = Math.imul(value ^ string.charCodeAt(i), 16777619); return value >>> 0; };
function finishRun(state, command) {
  const p = state.progression; const run = p.activeRun;
  requireRule(!p.claimed.includes(`run:${command.runId}`), 'ALREADY_CLAIMED');
  requireRule(run && run.id === command.runId, 'UNKNOWN_RUN');
  const stats = command.stats;
  requireRule(keys(stats, ['kills', 'seconds', 'won']) && integer(stats.kills, 0, Number.MAX_SAFE_INTEGER) && integer(stats.seconds, 0, Number.MAX_SAFE_INTEGER) && typeof stats.won === 'boolean', 'INVALID_RESULT');
  const minimumWinTime = run.mode === 'resource' ? 90 : run.mode === 'bossRush' ? 50 : run.mode === 'expedition' ? 150 : run.runConfig.chapter.bossAtSeconds;
  requireRule(!stats.won || (run.mode !== 'endless' && stats.seconds >= minimumWinTime && (run.mode === 'resource' || stats.kills > 0)), 'INVALID_RESULT');
  const eligible = stats.seconds >= 10 || stats.kills > 0;
  const firstClear = stats.won && run.mode === 'campaign' && !p.cleared.includes(run.chapterId);
  const multiplier = run.mode === 'hard' ? 1.35 : 1;
  let gold = eligible ? Math.min(2500, Math.floor((Math.floor(stats.seconds / 8) + stats.kills * 2 + (stats.won ? 50 : 0)) * multiplier)) : 0;
  let essence = eligible ? Math.min(200, Math.floor(stats.seconds / 30) + Math.floor(stats.kills / 5) + (stats.won ? 10 : 0)) : 0;
  let research = eligible ? Math.min(50, Math.floor(stats.seconds / 60) + (stats.won ? 3 : 0)) : 0;
  let dust = eligible ? Math.min(50, Math.floor(stats.kills / 30) + (stats.won ? 2 : 0)) : 0;
  if (run.mode === 'resource') essence *= 2;
  if (run.mode === 'bossRush') research *= 2;
  if (firstClear) { gold += 150; essence += 15; research += 5; }
  let dailyBonus = false;
  if (stats.won && run.mode === 'daily' && !p.claimed.includes(`daily:${run.day}`)) { gold += 100; research += 5; p.claimed.push(`daily:${run.day}`); dailyBonus = true; }
  const xp = eligible ? Math.min(1000, Math.floor(stats.seconds / 5) + stats.kills * 2 + (stats.won ? 100 : 0)) : 0;
  const relicFragments = eligible && (stats.seconds >= 30 || stats.kills >= 10) ? [{ id: RELICS[(Number(run.id.slice(4)) - 1) % RELICS.length].id, amount: run.mode === 'expedition' ? 4 : stats.won ? 3 : 1 }] : [];
  const reward = credit(state, { gold, essence, research, dust, relicFragments }, true);
  bump(p, 'xp', xp); bump(p.season, 'xp', eligible ? Math.min(500, Math.floor(stats.seconds / 15) + stats.kills + (stats.won ? 60 : 0)) : 0);
  bump(state.profile, 'runs'); bump(state.profile, 'totalKills', stats.kills); state.profile.bestSeconds = Math.min(MAX_VALUE, Math.max(state.profile.bestSeconds, stats.seconds));
  if (state.profile.totalKills >= 30 && !state.profile.owned.includes('moon')) state.profile.owned.push('moon');
  bump(p.missions.stats, 'runs'); bump(p.missions.stats, 'kills', stats.kills);
  bump(p.missions, 'dailyRuns'); bump(p.missions, 'dailyKills', stats.kills); bump(p.missions, 'weeklyRuns'); bump(p.missions, 'weeklyKills', stats.kills);
  if (stats.won) { bump(p.missions.stats, 'wins'); bump(p.missions, 'dailyWins'); bump(p.missions, 'weeklyWins'); }
  if (firstClear) p.cleared.push(run.chapterId);
  if (eligible) {
    const shardHero = HEROES[(Number(run.id.slice(4)) - 1) % HEROES.length].id;
    bump(p.heroes[shardHero], 'shards', stats.won ? 3 : 1);
    for (const building of BUILDINGS) bump(p.homestead.pending, building.produces, p.homestead.buildings[building.id] * building.amountPerLevel);
  }
  const items = []; let convertedEssence = 0;
  if (eligible && (stats.seconds >= 30 || stats.kills >= 10 || stats.won)) {
    if (p.inventory.length < 1000 && p.nextItem < Number.MAX_SAFE_INTEGER - 1) {
      const available = EQUIPMENT.filter(def => SLOTS.some(slot => slot.type === def.slot && state.profile.runs >= slot.unlockRuns));
      const def = available[hash(`${run.seed}:drop`) % available.length];
      const rarity = stats.won && hash(`${run.seed}:rank`) % 5 === 0 ? 1 : 0;
      const item = createItem(`item-${p.nextItem++}`, def.id, rarity); p.inventory.push(item); items.push(clone(item));
    } else { const conversion = credit(state, { essence: 10 }, true); convertedEssence = conversion.essence; reward.essence += conversion.essence; }
  }
  p.claimed.push(`run:${run.id}`); p.activeRun = null;
  return { ...reward, xp, items, firstClear, unlockedChapterIds: firstClear ? CHAPTERS.filter(chapter => chapter.requires === run.chapterId).map(chapter => chapter.id) : [], won: stats.won, dailyBonus, convertedEssence };
}

function execute(state, command) {
  const p = state.progression;
  switch (command.type) {
    case 'SELECT_HERO': {
      definition(HEROES, command.heroId); requireRule(p.heroes[command.heroId].level > 0, 'NOT_OWNED'); requireRule(p.heroId !== command.heroId, 'NO_CHANGE');
      p.heroId = command.heroId; if (p.supportHeroId === p.heroId) p.supportHeroId = null; break;
    }
    case 'UNLOCK_HERO': {
      definition(HEROES, command.heroId); feature(state, `hero:${command.heroId}`); requireRule(!p.heroes[command.heroId].level, 'ALREADY_OWNED');
      spend(state, getCommandCost(state, command), command); p.heroes[command.heroId].level = 1; break;
    }
    case 'UPGRADE_HERO': {
      const def = definition(HEROES, command.heroId); const hero = p.heroes[def.id]; requireRule(hero.level > 0, 'NOT_OWNED'); requireRule(hero.level < def.maxLevel, 'MAX_LEVEL');
      spend(state, getCommandCost(state, command), command); hero.level++; bump(p.missions.stats, 'upgrades'); break;
    }
    case 'STAR_HERO': {
      const def = definition(HEROES, command.heroId); const hero = p.heroes[def.id]; requireRule(hero.level > 0, 'NOT_OWNED'); requireRule(hero.stars < def.maxStars, 'MAX_LEVEL');
      spend(state, getCommandCost(state, command), command); hero.stars++; bump(p.missions.stats, 'upgrades'); break;
    }
    case 'SELECT_SUPPORT': {
      feature(state, 'support');
      if (command.heroId !== null) { definition(HEROES, command.heroId); requireRule(p.heroes[command.heroId].level > 0, 'NOT_OWNED'); requireRule(command.heroId !== p.heroId, 'INVALID_COMMAND'); }
      requireRule(p.supportHeroId !== command.heroId, 'NO_CHANGE'); p.supportHeroId = command.heroId; break;
    }
    case 'SELECT_CHAPTER': definition(CHAPTERS, command.chapterId); feature(state, `chapter:${command.chapterId}`); requireRule(p.chapterId !== command.chapterId, 'NO_CHANGE'); p.chapterId = command.chapterId; break;
    case 'SELECT_MODE': definition(MODES, command.mode); feature(state, `mode:${command.mode}`); requireRule(p.mode !== command.mode, 'NO_CHANGE'); p.mode = command.mode; break;
    case 'EQUIP_ITEM': {
      const item = findItem(state, command.itemId); const slot = definition(SLOTS, command.slot); feature(state, `slot:${slot.id}`);
      requireRule(byId(EQUIPMENT, item.definitionId).slot === slot.type, 'INVALID_SLOT'); requireRule(p.equipment[slot.id] !== item.id, 'NO_CHANGE');
      for (const key of Object.keys(p.equipment)) if (p.equipment[key] === item.id) p.equipment[key] = null;
      p.equipment[slot.id] = item.id; break;
    }
    case 'UNEQUIP_ITEM': definition(SLOTS, command.slot); requireRule(p.equipment[command.slot] !== null, 'NO_CHANGE'); p.equipment[command.slot] = null; break;
    case 'LOCK_ITEM': { const item = findItem(state, command.itemId); requireRule(typeof command.locked === 'boolean', 'INVALID_COMMAND'); requireRule(item.locked !== command.locked, 'NO_CHANGE'); item.locked = command.locked; break; }
    case 'UPGRADE_ITEM': {
      const item = findItem(state, command.itemId); requireRule(item.level < RARITIES[item.rarity].maxLevel, 'MAX_LEVEL'); const cost = getCommandCost(state, command);
      spend(state, cost, command); item.level++; item.invested.gold += cost.gold; item.invested.essence += cost.essence; bump(p.missions.stats, 'upgrades'); break;
    }
    case 'RESET_ITEM': {
      const item = findItem(state, command.itemId); requireRule(item.level > 1, 'NO_CHANGE'); const refund = credit(state, item.invested);
      item.level = 1; item.invested = { gold: 0, essence: 0 }; return { refund };
    }
    case 'REFINE_ITEM': {
      feature(state, 'refine'); const item = findItem(state, command.itemId); requireRule(item.rarity >= 2, 'LOCKED'); requireRule(item.refinement < 10, 'MAX_LEVEL');
      spend(state, getCommandCost(state, command), command); item.refinement++; bump(p.missions.stats, 'upgrades'); break;
    }
    case 'GLYPH_ITEM': {
      feature(state, 'glyph'); const item = findItem(state, command.itemId); requireRule(item.rarity >= 2, 'LOCKED'); requireRule(['power', 'guard', 'haste'].includes(command.glyph), 'INVALID_COMMAND'); requireRule(item.glyph !== command.glyph, 'NO_CHANGE');
      spend(state, getCommandCost(state, command), command); item.glyph = command.glyph; break;
    }
    case 'FUSE_ITEMS': {
      feature(state, 'forge'); requireRule(unique(command.itemIds) && command.itemIds.length === 3, 'INVALID_FUSION');
      const items = command.itemIds.map(id => findItem(state, id)); const main = items[0];
      requireRule(main.rarity < 5, 'MAX_LEVEL'); requireRule(items.every(item => item.definitionId === main.definitionId && item.rarity === main.rarity), 'INVALID_FUSION');
      requireRule(!main.locked && items.slice(1).every(item => !isItemProtected(state, item.id)), 'ITEM_PROTECTED');
      requireRule(items.slice(1).every(item => item.refinement === 0 && item.glyph === null), 'INVESTED_FODDER');
      spend(state, getCommandCost(state, command), command);
      const refund = credit(state, { gold: items[1].invested.gold + items[2].invested.gold, essence: items[1].invested.essence + items[2].invested.essence });
      main.rarity++; const removed = command.itemIds.slice(1); p.inventory = p.inventory.filter(item => !removed.includes(item.id)); bump(p.missions.stats, 'upgrades');
      return { itemId: main.id, refund };
    }
    case 'DISMANTLE_ITEM': {
      const item = findItem(state, command.itemId); requireRule(!isItemProtected(state, item.id), 'ITEM_PROTECTED');
      requireRule(item.refinement === 0 && item.glyph === null, 'INVESTED_FODDER');
      const refund = credit(state, { gold: 20 + item.rarity * 10 + item.invested.gold, essence: 2 + item.rarity * 2 + item.invested.essence });
      p.inventory = p.inventory.filter(entry => entry.id !== item.id); return { refund };
    }
    case 'CRAFT_ITEM': {
      feature(state, 'forge'); const def = definition(EQUIPMENT, command.definitionId);
      requireRule(SLOTS.some(slot => slot.type === def.slot && getFeatureState(state, `slot:${slot.id}`).unlocked), 'LOCKED'); requireRule(p.inventory.length < 1000, 'INVENTORY_FULL'); requireRule(p.nextItem < Number.MAX_SAFE_INTEGER - 1, 'LIMIT_REACHED');
      spend(state, getCommandCost(state, command), command); const item = createItem(`item-${p.nextItem++}`, def.id); p.inventory.push(item); bump(p.missions.stats, 'crafted'); return { item: clone(item) };
    }
    case 'SAVE_PRESET': {
      requireRule(integer(command.index, 0, 2), 'INVALID_COMMAND');
      p.presets[command.index] = clone({ heroId: p.heroId, supportHeroId: p.supportHeroId, equipment: p.equipment, runes: p.runes.equipped, jewels: p.jewels.equipped, artifactId: p.artifactId, companionIds: p.companionIds, guardianId: p.guardianId }); break;
    }
    case 'LOAD_PRESET': {
      requireRule(integer(command.index, 0, 2), 'INVALID_COMMAND'); requireRule(p.presets[command.index] !== null, 'EMPTY_PRESET'); const preset = clone(p.presets[command.index]);
      Object.assign(p, { heroId: preset.heroId, supportHeroId: preset.supportHeroId, equipment: preset.equipment, artifactId: preset.artifactId, companionIds: preset.companionIds, guardianId: preset.guardianId }); p.runes.equipped = preset.runes; p.jewels.equipped = preset.jewels; break;
    }
    case 'UNLOCK_RELIC': {
      feature(state, 'relics'); definition(RELICS, command.relicId); const relic = p.relics[command.relicId]; requireRule(relic.level === 0, 'ALREADY_OWNED'); spend(state, getCommandCost(state, command), command); relic.level = 1; break;
    }
    case 'UPGRADE_RELIC': case 'STAR_RELIC': {
      feature(state, 'relics'); const def = definition(RELICS, command.relicId); const relic = p.relics[def.id]; requireRule(relic.level > 0, 'NOT_OWNED');
      const key = command.type === 'STAR_RELIC' ? 'stars' : 'level'; requireRule(relic[key] < (key === 'stars' ? def.maxStars : def.maxLevel), 'MAX_LEVEL');
      spend(state, getCommandCost(state, command), command); relic[key]++; bump(p.missions.stats, 'upgrades'); break;
    }
    case 'UPGRADE_TALENT': {
      const def = definition(TALENTS, command.talentId); requireRule(Object.values(p.talents).reduce((sum, n) => sum + n, 0) >= def.requiresLevels, 'LOCKED');
      costAndUpgrade(state, command, 'talents', TALENTS, p.talents, def.id); break;
    }
    case 'RESET_TALENTS': {
      feature(state, 'talents'); const total = Object.values(p.talents).reduce((sum, n) => sum + n, 0); requireRule(total > 0, 'NO_CHANGE');
      const investments = Object.values(p.talents).reduce((sum, n) => sum + n * (n + 1) / 2, 0); const refund = credit(state, { gold: investments * 30, essence: investments * 2 });
      for (const key of Object.keys(p.talents)) p.talents[key] = 0; return { refund };
    }
    case 'UPGRADE_RUNE': costAndUpgrade(state, command, 'runes', RUNES, p.runes.owned, command.runeId); break;
    case 'UPGRADE_JEWEL': costAndUpgrade(state, command, 'jewels', JEWELS, p.jewels.owned, command.jewelId); break;
    case 'UPGRADE_ARTIFACT': costAndUpgrade(state, command, 'artifacts', ARTIFACTS, p.artifacts, command.artifactId); break;
    case 'UPGRADE_COMPANION': costAndUpgrade(state, command, 'companions', COMPANIONS, p.companions, command.companionId); break;
    case 'UPGRADE_GUARDIAN': costAndUpgrade(state, command, 'guardians', GUARDIANS, p.guardians, command.guardianId); break;
    case 'UPGRADE_RESEARCH': costAndUpgrade(state, command, 'research', RESEARCH, p.research, command.researchId); break;
    case 'UPGRADE_BUILDING': costAndUpgrade(state, command, 'homestead', BUILDINGS, p.homestead.buildings, command.buildingId); break;
    case 'EQUIP_RUNE': {
      feature(state, 'runes'); requireRule(['attack', 'defense', 'utility'].includes(command.slot), 'INVALID_SLOT');
      if (command.runeId !== null) { const def = definition(RUNES, command.runeId); requireRule(p.runes.owned[def.id] > 0, 'NOT_OWNED'); requireRule(def.category === command.slot, 'INVALID_SLOT'); }
      requireRule(p.runes.equipped[command.slot] !== command.runeId, 'NO_CHANGE'); p.runes.equipped[command.slot] = command.runeId; break;
    }
    case 'EQUIP_JEWEL': {
      feature(state, 'jewels'); definition(SLOTS, command.slot); feature(state, `slot:${command.slot}`);
      if (command.jewelId !== null) { definition(JEWELS, command.jewelId); requireRule(p.jewels.owned[command.jewelId] > 0, 'NOT_OWNED'); }
      requireRule(p.jewels.equipped[command.slot] !== command.jewelId, 'NO_CHANGE');
      for (const slot of Object.keys(p.jewels.equipped)) if (p.jewels.equipped[slot] === command.jewelId) p.jewels.equipped[slot] = null;
      p.jewels.equipped[command.slot] = command.jewelId; break;
    }
    case 'EQUIP_ARTIFACT': case 'EQUIP_GUARDIAN': {
      const artifact = command.type === 'EQUIP_ARTIFACT'; const collection = artifact ? 'artifacts' : 'guardians'; const field = artifact ? 'artifactId' : 'guardianId'; const id = command[field];
      feature(state, collection); if (id !== null) { definition(artifact ? ARTIFACTS : GUARDIANS, id); requireRule(p[collection][id] > 0, 'NOT_OWNED'); }
      requireRule(p[field] !== id, 'NO_CHANGE'); p[field] = id; break;
    }
    case 'EQUIP_COMPANION': {
      feature(state, 'companions'); definition(COMPANIONS, command.companionId); requireRule(p.companions[command.companionId] > 0, 'NOT_OWNED');
      if (p.companionIds.includes(command.companionId)) p.companionIds = p.companionIds.filter(id => id !== command.companionId);
      else { requireRule(p.companionIds.length < 2, 'CAPACITY'); p.companionIds.push(command.companionId); } break;
    }
    case 'CLAIM_HOMESTEAD': {
      feature(state, 'homestead'); requireRule(Object.values(p.homestead.pending).some(amount => amount > 0), 'NOT_READY'); const reward = credit(state, p.homestead.pending);
      p.homestead.pending = { essence: 0, research: 0, dust: 0 }; return { reward };
    }
    case 'CLAIM_MISSION': {
      const mission = definition(MISSIONS, command.missionId); const progress = getMissionProgress(state, command.missionId); requireRule(!progress.claimed, 'ALREADY_CLAIMED'); requireRule(progress.complete, 'NOT_READY');
      const reward = credit(state, mission.reward); (mission.period === 'daily' ? p.missions.dailyClaimed : mission.period === 'weekly' ? p.missions.weeklyClaimed : p.missions.claimed).push(mission.id); return { reward };
    }
    case 'CLAIM_SEASON': {
      requireRule(integer(command.tier, 1, 50), 'INVALID_COMMAND'); const tier = SEASON_REWARDS[command.tier - 1]; requireRule(!p.season.claimed.includes(tier.tier), 'ALREADY_CLAIMED'); requireRule(p.season.xp >= tier.xp, 'NOT_READY');
      const reward = credit(state, tier.reward); p.season.claimed.push(tier.tier); return { reward };
    }
    case 'BUY_OFFER': { const offer = definition(SHOP_OFFERS, command.offerId); if (offer.reward.relicFragments) feature(state, 'relics'); spend(state, offer.cost, command); return { reward: credit(state, offer.reward) }; }
    case 'START_RUN': {
      requireRule(p.activeRun === null, 'RUN_ACTIVE'); requireRule(p.nextRun < Number.MAX_SAFE_INTEGER - 1, 'LIMIT_REACHED');
      const day = Object.hasOwn(command, 'day') ? command.day : (p.missions.day || '1970-01-01'); requireRule(validDay(day), 'INVALID_COMMAND'); requireRule(!p.missions.day || day >= p.missions.day, 'CLOCK_REWIND');
      feature(state, `chapter:${p.chapterId}`); feature(state, `mode:${p.mode}`); resetPeriod(p.missions, day);
      const config = deriveLoadout(state); const id = `run-${p.nextRun++}`; const seed = hash(config.mode === 'daily' ? `arcana:daily:${day}` : `${id}:${config.chapterId}:${config.mode}`);
      p.activeRun = { id, seed, chapterId: config.chapterId, mode: config.mode, day, runConfig: config }; return { runId: id, seed, runConfig: clone(config) };
    }
    case 'FINISH_RUN': return finishRun(state, command);
    case 'ABANDON_RUN': requireRule(!p.claimed.includes(`run:${command.runId}`), 'ALREADY_CLAIMED'); requireRule(p.activeRun?.id === command.runId, 'UNKNOWN_RUN'); p.claimed.push(`run:${command.runId}`); p.activeRun = null; return { abandoned: true };
    case 'PROFILE_SETTINGS': {
      requireRule(command.settings && typeof command.settings === 'object' && !Array.isArray(command.settings) && Object.keys(command.settings).length > 0 && Object.keys(command.settings).every(key => ['vfx', 'reduceMotion'].includes(key)), 'INVALID_COMMAND');
      if (Object.hasOwn(command.settings, 'vfx')) requireRule(['low', 'medium', 'high'].includes(command.settings.vfx), 'INVALID_COMMAND');
      if (Object.hasOwn(command.settings, 'reduceMotion')) requireRule(typeof command.settings.reduceMotion === 'boolean', 'INVALID_COMMAND');
      Object.assign(state.profile.settings, command.settings); break;
    }
    case 'EQUIP_COSMETIC': requireRule(state.profile.owned.includes(command.cosmeticId), 'NOT_OWNED'); requireRule(state.profile.skin !== command.cosmeticId, 'NO_CHANGE'); state.profile.skin = command.cosmeticId; break;
    case 'UNLOCK_COSMETIC': {
      requireRule(command.cosmeticId === 'ember' || command.cosmeticId === 'moon', 'LOCKED'); requireRule(!state.profile.owned.includes(command.cosmeticId), 'ALREADY_OWNED');
      if (command.cosmeticId === 'moon') requireRule(state.profile.totalKills >= 30, 'NOT_READY');
      spend(state, getCommandCost(state, command), command); state.profile.owned.push(command.cosmeticId); break;
    }
    default: throw new RuleError('UNKNOWN_COMMAND');
  }
  return {};
}

export function applyCommand(state, command) {
  const fail = code => ({ ok: false, code, state, details: {} });
  if (!validateCampaign(state)) return fail('INVALID_STATE');
  if (!command || typeof command.type !== 'string') return fail('INVALID_COMMAND');
  if (command.type === 'START_RUN') {
    if (!keys(command, Object.hasOwn(command, 'day') ? ['type', 'day'] : ['type'])) return fail('INVALID_COMMAND');
  } else {
    const fields = Object.hasOwn(COMMAND_FIELDS, command.type) ? COMMAND_FIELDS[command.type] : null;
    if (!fields) return fail('UNKNOWN_COMMAND');
    if (!keys(command, ['type', ...fields])) return fail('INVALID_COMMAND');
  }
  if (state.revision >= Number.MAX_SAFE_INTEGER - 1) return fail('LIMIT_REACHED');
  try {
    const next = clone(state); const details = execute(next, command); next.revision++;
    if (!validateCampaign(next)) return fail('INTERNAL_ERROR');
    return { ok: true, code: 'OK', state: next, details };
  } catch (error) { return fail(error instanceof RuleError ? error.code : 'INTERNAL_ERROR'); }
}
