// Versioned, data-only combat snapshots. The engine never reads a save or cosmetic.
import {weaponCompatible} from './weapons.js';
export const BALANCE_VERSION = 1;
export const COMBAT_LIMITS = Object.freeze({ armor: .65, critChance: .6, critDamage: 3, companions: 2 });

const HERO_STATS = Object.freeze({
  mage: { maxHp: 100, attack: 22, speed: 230, fireDelay: 24 },
  guardian: { maxHp: 135, attack: 20, speed: 210, fireDelay: 27 },
  ranger: { maxHp: 90, attack: 21, speed: 250, fireDelay: 21 },
});
const CHAPTERS = Object.freeze({
  astral: { enemyHpMultiplier: 1, enemyDamageMultiplier: 1, spawnMultiplier: 1, bossAtSeconds: 180, bossHpMultiplier: 1, bossName: 'ผู้กลืนดาว' },
  grove: { enemyHpMultiplier: 1.35, enemyDamageMultiplier: 1.15, spawnMultiplier: 1.1, bossAtSeconds: 240, bossHpMultiplier: 1.3, bossName: 'ราชาพฤกษาคราส' },
  citadel: { enemyHpMultiplier: 1.7, enemyDamageMultiplier: 1.3, spawnMultiplier: 1.2, bossAtSeconds: 300, bossHpMultiplier: 1.6, bossName: 'จอมราชารอยแยก' },
});
const MODES = new Set(['campaign', 'hard', 'bossRush', 'resource', 'expedition', 'daily', 'endless']);
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const own = (values, key, fallback) => typeof key === 'string' && Object.hasOwn(values, key) ? key : fallback;
const support = value => value && typeof value.id === 'string' ? Object.freeze({ id: value.id.slice(0, 64), level: Math.floor(number(value.level, 1, 1, 30)) }) : null;

export function normalizeRunConfig(input) {
  const config = object(input);
  const version = config.balanceVersion ?? config.version ?? BALANCE_VERSION;
  if (version !== BALANCE_VERSION) throw new RangeError(`Unsupported combat balance version: ${version}`);
  const heroId = own(HERO_STATS, config.heroId, 'mage');
  const chapterId = own(CHAPTERS, config.chapterId, 'astral');
  const mode = MODES.has(config.mode) ? config.mode : 'campaign';
  const defaults = HERO_STATS[heroId];
  const stats = object(config.stats), chapter = object(config.chapter), modifiers = object(config.modifiers);
  const chapterDefaults = CHAPTERS[chapterId];
  const companions = Array.isArray(config.companions) ? config.companions.map(support).filter(Boolean).slice(0, COMBAT_LIMITS.companions) : [];
  const suppliedWeapon = typeof config.weaponId === 'string' ? config.weaponId.slice(0, 64) : null;
  const validWeapon = suppliedWeapon && weaponCompatible(heroId,suppliedWeapon) ? suppliedWeapon : null;
  const effects = heroId === 'guardian' ? ['balanced','cleave','rapid'] : ['balanced','pierce','rapid'];
  const effect = (!suppliedWeapon || validWeapon) && effects.includes(config.weaponEffect)
    ? config.weaponEffect : 'balanced';
  // Explicit field copies prevent unknown (including cosmetic) data from influencing a replay.
  return Object.freeze({
    version: BALANCE_VERSION, balanceVersion: BALANCE_VERSION, heroId, chapterId, mode,
    stats: Object.freeze({
      maxHp: number(stats.maxHp, defaults.maxHp, 1, 10000),
      attack: number(stats.attack, defaults.attack, 1, 2000),
      speed: number(stats.speed, defaults.speed, 100, 350),
      fireDelay: number(stats.fireDelay, defaults.fireDelay, 8, 120),
      armor: number(stats.armor, 0, 0, COMBAT_LIMITS.armor),
      critChance: number(stats.critChance, 0, 0, COMBAT_LIMITS.critChance),
      critDamage: number(stats.critDamage, 1.5, 1, COMBAT_LIMITS.critDamage),
      pickupRadius: number(stats.pickupRadius, 60, 40, 450),
      healingMultiplier: number(stats.healingMultiplier, 1, .25, 3),
      skillMultiplier: number(stats.skillMultiplier, 1, .25, 4),
      bossDamageMultiplier: number(stats.bossDamageMultiplier, 1, .25, 4),
    }),
    weaponId: validWeapon,
    weaponEffect: effect,
    artifact: support(config.artifact), companions: Object.freeze(companions), guardian: support(config.guardian),
    modifiers: Object.freeze({
      novaRadius: number(modifiers.novaRadius, 1, 1, 2),
      chainTargets: Math.floor(number(modifiers.chainTargets, 0, 0, 4)),
      orbitRadius: number(modifiers.orbitRadius, 1, 1, 2),
      shieldEvery: number(modifiers.shieldEvery, 0, 0, 120),
      killHeal: number(modifiers.killHeal, 0, 0, 5),
    }),
    chapter: Object.freeze({
      enemyHpMultiplier: number(chapter.enemyHpMultiplier, chapterDefaults.enemyHpMultiplier, .25, 12),
      enemyDamageMultiplier: number(chapter.enemyDamageMultiplier, chapterDefaults.enemyDamageMultiplier, .25, 8),
      spawnMultiplier: number(chapter.spawnMultiplier, chapterDefaults.spawnMultiplier, .3, 3),
      bossAtSeconds: number(chapter.bossAtSeconds, chapterDefaults.bossAtSeconds, 15, 900),
      bossHpMultiplier: number(chapter.bossHpMultiplier, chapterDefaults.bossHpMultiplier, .25, 20),
      durationSeconds: mode === 'resource' ? number(chapter.durationSeconds === 0 ? 90 : chapter.durationSeconds, 90, 30, 900) : 0,
      bossName: typeof chapter.bossName === 'string' && chapter.bossName.trim() ? chapter.bossName.trim().slice(0, 64) : chapterDefaults.bossName,
    }),
  });
}

export function modeRules(config) {
  const { mode, chapter } = config;
  return {
    bossAtTicks: Math.round((mode === 'bossRush' ? 20 : mode === 'expedition' ? 60 : mode === 'endless' ? 120 : chapter.bossAtSeconds) * 60),
    targetBosses: mode === 'bossRush' || mode === 'expedition' ? 3 : mode === 'endless' || mode === 'resource' ? 0 : 1,
    timeLimitTicks: mode === 'resource' ? Math.round(chapter.durationSeconds * 60) : 0,
    objective: mode === 'resource' ? 'SURVIVE' : mode === 'endless' ? 'ENDURE' : mode === 'bossRush' || mode === 'expedition' ? 'DEFEAT 3 BOSSES' : 'DEFEAT THE BOSS',
    healthMultiplier: chapter.enemyHpMultiplier * (mode === 'hard' ? 1.35 : 1),
    damageMultiplier: chapter.enemyDamageMultiplier * (mode === 'hard' ? 1.2 : 1),
    spawnMultiplier: chapter.spawnMultiplier * (mode === 'hard' ? 1.15 : mode === 'bossRush' ? .35 : mode === 'resource' ? 1.3 : 1),
  };
}

export function bossIdentity(config, stage) {
  const cycle = ['astral', 'grove', 'citadel'];
  const rotates = config.mode === 'bossRush' || config.mode === 'expedition' || config.mode === 'endless';
  const variant = rotates ? cycle[(cycle.indexOf(config.chapterId) + stage - 1) % cycle.length] : config.chapterId;
  return { variant, name: variant === config.chapterId ? config.chapter.bossName : CHAPTERS[variant].bossName };
}
