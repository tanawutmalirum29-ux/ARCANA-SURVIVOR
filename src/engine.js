/* Deterministic, renderer-agnostic 60Hz simulation. No DOM, storage, network or cosmetic imports. */
import { normalizeRunConfig, modeRules, bossIdentity } from './gameplay/run-config.js';
import { updateSupports } from './gameplay/supports.js';

// Presentation-only side channel. Never stored on the deterministic simulation,
// serialized runConfig or save, and never consulted for combat outcomes.
const playerFireEvents = new WeakMap();
export function getLastPlayerFireEvent(game) {
  return game && typeof game === 'object' ? playerFireEvents.get(game) || null : null;
}
export const STEP = 1 / 60;
export const WORLD = { width: 2200, height: 1500 };
export const BOSS_AT = 9 * 60;
export const BOSS_WARNING_TICKS = 36;
export const BOSS_ENRAGE_AFTER = 90 * 60;
export const MAX_ENEMIES = 125;
const TYPES = Object.freeze({
  swarmer: { hp: 24, speed: 95, radius: 12, damage: 9, xp: 5 },
  brute: { hp: 90, speed: 48, radius: 21, damage: 15, xp: 16 },
  cultist: { hp: 38, speed: 60, radius: 15, damage: 8, xp: 9 },
  boss: { hp: 520, speed: 35, radius: 48, damage: 20, xp: 50 },
});
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (dx, dy) => { const length = Math.hypot(dx, dy) || 1; return { x: dx / length, y: dy / length }; };
function random(s) { let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
// Critical rolls cannot perturb wave positions or offered upgrade choices.
function combatRandom(s) { let x = s.combatRng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.combatRng = x >>> 0; return s.combatRng / 4294967296; }
function id(s) { s.nextId += 1; return s.nextId; }
function heal(s, amount) { s.player.hp = Math.min(s.player.maxHp, s.player.hp + amount * s.player.healingMultiplier); }
function finishBoss(s) {
  s.bossesDefeated++;
  if (s.targetBosses && s.bossesDefeated >= s.targetBosses) {
    s.bossDefeated = true; s.phase = 'won'; return;
  }
  s.stage++;
  s.bossSpawned = false;
  const delay = s.runConfig.mode === 'bossRush' ? 15 : s.runConfig.mode === 'expedition' ? 45 : 120;
  s.bossAtTicks = s.tick + delay * 60;
  // A cleared stage grants a breathing interval; old boss projectiles cannot ambush the next stage.
  s.hostileShots.length = 0;
  heal(s, s.player.maxHp * .15);
  s.statusText = `STAGE ${s.stage}`;
}
export function createGame(seed = 2026, runConfig) {
  const state = {
    rng: (Number(seed) >>> 0) || 1, nextId: 0, tick: 0, phase: 'running',
    player: { x: WORLD.width / 2, y: WORLD.height / 2, radius: 14, hp: 100, maxHp: 100, speed: 230, level: 1, xp: 0, nextXp: 20, attack: 22, fireDelay: 24, fireTimer: 0, invuln: 0 },
    enemies: [], shots: [], hostileShots: [], pickups: [], flashes: [],
    kills: 0, skills: { bolt: 1, nova: 0, orbit: 0, chain: 0 },
    timers: { spawn: 35, nova: 0, chain: 0, bossShot: 110 },
    bossSpawned: false, bossDefeated: false, upgrades: [], statusText: '',
  };
  // The unconfigured path intentionally preserves the original simulation, including RNG use.
  if (runConfig !== undefined && runConfig !== null) {
    const config = normalizeRunConfig(runConfig);
    state.runConfig = config;
    state.rules = modeRules(config);
    Object.assign(state.player, config.stats, { hp: config.stats.maxHp, shield: 0, movingTicks: 0 });
    Object.assign(state, {
      bossAtTicks: state.rules.bossAtTicks, targetBosses: state.rules.targetBosses,
      timeLimitTicks: state.rules.timeLimitTicks, objective: state.rules.objective,
      bossesDefeated: 0, stage: 1, supportActors: [],
      combatRng: ((Number(seed) >>> 0) ^ 0x9e3779b9) >>> 0 || 1,
      damageDealt: 0, damageTaken: 0, criticalHits: 0,
      supportTimers: { artifact: 90, guardian: 180, heroShield: 0, gearShield: 0 },
    });
    config.companions.forEach((companion, index) => state.supportActors.push({
      ...companion, slot: index, x: state.player.x, y: state.player.y, timer: 25 + index * 35,
    }));
  }
  return state;
}
export function spawnEnemy(s, type, x, y) {
  if (!TYPES[type]) throw new Error('Unknown enemy type');
  const t = TYPES[type];
  const enemy = { id: id(s), type, x: clamp(x, t.radius, WORLD.width - t.radius), y: clamp(y, t.radius, WORLD.height - t.radius), radius: t.radius, hp: t.hp, maxHp: t.hp, speed: t.speed, damage: t.damage, xp: t.xp, shotTimer: 80, slow: 0, flash: 0 };
  if (type === 'boss') Object.assign(enemy, { nextPattern: 0, pendingAttack: null, spawnTick: s.tick, enraged: false });
  if (s.runConfig) {
    const stageMultiplier = Math.min(12, 1 + (s.stage - 1) * (s.runConfig.mode === 'endless' ? .28 : .16));
    const health = type === 'boss' ? s.runConfig.chapter.bossHpMultiplier * (s.runConfig.mode === 'hard' ? 1.35 : 1) : s.rules.healthMultiplier;
    enemy.hp = enemy.maxHp = Math.round(t.hp * health * stageMultiplier);
    enemy.damage *= s.rules.damageMultiplier * Math.min(3, stageMultiplier);
    enemy.speed *= Math.min(1.4, 1 + (s.stage - 1) * .035);
    if (type === 'boss') {
      Object.assign(enemy, bossIdentity(s.runConfig, s.stage));
      enemy.nextPattern = enemy.variant === 'grove' ? 1 : enemy.variant === 'citadel' ? 2 : 0;
    }
  }
  s.enemies.push(enemy); return enemy;
}
// Preserve an actual safe spawn distance, even when the player hugs arena edges.
function safeSpawnPosition(s, type, minRadius = 380, maxRadius = 550) {
  const p = s.player;
  const r = TYPES[type].radius;
  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = random(s) * Math.PI * 2;
    const radius = minRadius + random(s) * (maxRadius - minRadius);
    const pos = {
      x: clamp(p.x + Math.cos(angle) * radius, r, WORLD.width - r),
      y: clamp(p.y + Math.sin(angle) * radius, r, WORLD.height - r),
    };
    if (distance(p, pos) >= 280) return pos;
  }
  // Deterministic fallback if all sampled angles point beyond a boundary.
  return { x: p.x < WORLD.width / 2 ? WORLD.width - r : r,
    y: p.y < WORLD.height / 2 ? WORLD.height - r : r };
}
function spawnWave(s) {
  if (s.enemies.length >= MAX_ENEMIES - (s.runConfig && !s.bossSpawned ? 1 : 0)) return;
  const v = random(s);
  const type = s.tick / 60 < 14 || v < 0.64 ? 'swarmer' : v < 0.84 ? 'cultist' : 'brute';
  const pos = safeSpawnPosition(s, type);
  spawnEnemy(s, type, pos.x, pos.y);
}
function hurt(s, amount) {
  const p = s.player;
  if (p.invuln > 0 || s.phase !== 'running') return;
  if (s.runConfig) {
    amount *= 1 - p.armor;
    if (s.sanctuary && distance(p, s.sanctuary) < s.sanctuary.radius) amount *= .8;
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed; amount -= absorbed;
    s.damageTaken += Math.min(p.hp, amount);
  }
  p.hp = Math.max(0, p.hp - amount);
  p.invuln = 46;
  s.flashes.push({ id: id(s), x: p.x, y: p.y, type: 'hurt', ttl: 16, radius: 42 });
  if (p.hp === 0) {
    if (s.runConfig?.guardian?.id === 'phoenix' && !s.phoenixRevived) {
      s.phoenixRevived = true;
      p.hp = p.maxHp * Math.min(.6, .3 + (s.runConfig.guardian.level - 1) * .015);
      p.invuln = 180;
      s.flashes.push({ id: id(s), x: p.x, y: p.y, type: 'revive', radius: 150, ttl: 45 });
      s.statusText = 'PHOENIX REVIVAL';
    } else s.phase = 'lost';
  }
}
function damageEnemy(s, enemy, amount, critical = true) {
  if (enemy.hp <= 0 || (s.runConfig && s.phase !== 'running')) return;
  if (s.runConfig) {
    if (enemy.type === 'boss') amount *= s.player.bossDamageMultiplier;
    if (critical && s.player.critChance > 0 && combatRandom(s) < s.player.critChance) {
      amount *= s.player.critDamage; s.criticalHits++;
      s.flashes.push({ id: id(s), x: enemy.x, y: enemy.y, radius: enemy.radius + 10, ttl: 10, type: 'critical' });
    }
    s.damageDealt += Math.min(enemy.hp, amount);
  }
  enemy.hp = Math.max(0, enemy.hp - amount); enemy.flash = 8;
  if (enemy.hp === 0) {
    s.kills++;
    if (s.runConfig && s.pickups.length >= 300) {
      // Pool excess XP instead of allocating indefinitely during an endless run.
      let nearest = s.pickups[0];
      for (const orb of s.pickups) if (distance(orb, enemy) < distance(nearest, enemy)) nearest = orb;
      nearest.xp += enemy.xp;
    } else s.pickups.push({ id: id(s), x: enemy.x, y: enemy.y, xp: enemy.xp });
    s.flashes.push({ id: id(s), x: enemy.x, y: enemy.y, type: 'death', ttl: 20, radius: enemy.radius * 2.5 });
    if (s.runConfig && s.runConfig.modifiers.killHeal) heal(s, s.runConfig.modifiers.killHeal);
    if (enemy.type === 'boss') {
      if (s.runConfig) finishBoss(s);
      else { s.bossDefeated = true; s.phase = 'won'; }
    }
  }
}
const upgradePool = ['bolt', 'nova', 'orbit', 'chain', 'power', 'haste', 'speed', 'heal'];
function offerUpgrades(s) {
  const pool = upgradePool.filter(v => !['bolt','nova','orbit','chain'].includes(v) || s.skills[v] < 5);
  const offered = [];
  while (offered.length < 3 && pool.length) {
    const i = Math.floor(random(s) * pool.length);
    offered.push(pool.splice(i, 1)[0]);
  }
  s.upgrades = offered;
  s.phase = 'upgrade';
}
export function chooseUpgrade(s, key) {
  if (s.phase !== 'upgrade' || !s.upgrades.includes(key)) return false;
  const p = s.player;
  if (Object.hasOwn(s.skills, key)) s.skills[key]++;
  else if (key === 'power') p.attack += 5;
  else if (key === 'haste') p.fireDelay = Math.max(8, p.fireDelay - 3);
  else if (key === 'speed') p.speed = Math.min(350, p.speed + 22);
  else if (key === 'heal') p.hp = Math.min(p.maxHp, p.hp + 35 * (s.runConfig ? p.healingMultiplier : 1));
  s.upgrades = []; s.phase = 'running';
  // XP gained in a burst may cover multiple levels; queue the next choice, never discard XP.
  if (p.xp >= p.nextXp) gainXp(s, 0);
  return true;
}
function gainXp(s, amount) {
  const p = s.player;
  p.xp += amount;
  if (p.xp >= p.nextXp) {
    p.xp -= p.nextXp;
    p.level++;
    p.nextXp = Math.round(p.nextXp * 1.36 + 10);
    offerUpgrades(s);
  }
}
function targetNearest(s, origin, maxRange = 580) {
  let closest = null; let best = maxRange * maxRange;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const ds = (origin.x - e.x) ** 2 + (origin.y - e.y) ** 2;
    if (ds < best) { closest = e; best = ds; }
  }
  return closest;
}
function shoot(s, x, y, direction, friendly, damage, speed = 450, radius = 5) {
  if (s.runConfig && (friendly ? s.shots.length >= 160 : s.hostileShots.length >= 360)) return;
  if (s.runConfig && !friendly) damage *= s.rules.damageMultiplier * Math.min(3, 1 + (s.stage - 1) * .16);
  const item = { id: id(s), x, y, vx: direction.x * speed, vy: direction.y * speed, damage, radius, life: 125, friendly };
  (friendly ? s.shots : s.hostileShots).push(item);
  return item;
}
function updateSkills(s) {
  const p = s.player;
  const configured = Boolean(s.runConfig);
  const modifiers = configured ? s.runConfig.modifiers : null;
  const spellScale = configured ? p.attack / 22 * p.skillMultiplier * (s.runConfig.heroId === 'mage' ? 1.1 : 1) : 1;
  p.fireTimer--;
  if (p.fireTimer <= 0) {
    const sword = configured && s.runConfig.heroId === 'guardian';
    // Orin can only strike in melee range. Distant enemies do not provoke
    // a swing and NO friendly projectile is ever spawned by the sword.
    const enemy = targetNearest(s,p,sword ? 108 : 580);
    if (enemy) {
      const rangerBonus = configured && s.runConfig.heroId === 'ranger' && p.movingTicks >= 60 ? 1.12 : 1;
      const aim = unit(enemy.x-p.x,enemy.y-p.y);
      const amount = p.attack * (1 + (s.skills.bolt - 1) * .24) *
        rangerBonus * (configured ? p.skillMultiplier : 1);
      if (sword) {
        const cleave=s.runConfig.weaponEffect === 'cleave';
        let hits=0;
        // Balanced sword strikes one target; cleave strikes all in its cone.
        for (const target of s.enemies) {
          if (target.hp <= 0 || distance(p,target)>108+target.radius) continue;
          const toward=unit(target.x-p.x,target.y-p.y);
          if (toward.x*aim.x+toward.y*aim.y < (cleave ? .25 : .5)) continue;
          damageEnemy(s,target,amount);hits++;
          if (!cleave) break;
        }
        if (hits) {
          s.flashes.push({id:id(s),x:p.x,y:p.y,aimX:aim.x,aimY:aim.y,
            radius:108,ttl:12,type:'sword'});
          playerFireEvents.set(s,Object.freeze({
            tick:s.tick,shotId:null,originX:p.x,originY:p.y,aimX:aim.x,
            aimY:aim.y,intervalTicks:p.fireDelay,kind:'melee',
          }));
        }
      } else {
        const bolt=shoot(s,p.x,p.y,aim,true,amount,
          configured && s.runConfig.weaponEffect === 'rapid' ? 517.5 : 450);
        // Actual live projectiles carry their shape type into Canvas.
        // The original unconfigured legacy simulation remains byte-compatible.
        if (bolt && configured) bolt.kind=s.runConfig.heroId === 'ranger' ? 'arrow' : 'spell';
        if (bolt) playerFireEvents.set(s,Object.freeze({
          tick:s.tick,shotId:bolt.id,originX:bolt.x,originY:bolt.y,
          aimX:aim.x,aimY:aim.y,intervalTicks:p.fireDelay,
          ...(configured && s.runConfig.heroId === 'ranger' ? {kind:bolt.kind} : {}),
        }));
        if (bolt && configured && s.runConfig.weaponEffect === 'pierce') {
          bolt.pierce=2;bolt.hitIds=[];
        }
      }
      p.fireTimer=p.fireDelay;
    }
  }
  if (s.skills.nova) {
    s.timers.nova--;
    if (s.timers.nova <= 0) {
      const radius = 175 * (configured ? modifiers.novaRadius : 1);
      s.flashes.push({ id: id(s), x: p.x, y: p.y, radius, ttl: 24, type: 'nova' });
      for (const e of s.enemies) if (e.hp > 0 && distance(p, e) < radius) { damageEnemy(s, e, (12 + s.skills.nova * 8) * spellScale); e.slow = 110; }
      s.timers.nova = Math.max(100, 325 - s.skills.nova * 20);
    }
  }
  if (s.skills.orbit && s.tick % 22 === 0) {
    for (const e of s.enemies) if (e.hp > 0 && distance(p, e) < (92 + s.skills.orbit * 7) * (configured ? modifiers.orbitRadius : 1)) damageEnemy(s, e, (8 + s.skills.orbit * 5) * spellScale);
  }
  if (s.skills.chain) {
    s.timers.chain--;
    if (s.timers.chain <= 0) {
      const candidates = s.enemies.filter(e => e.hp > 0 && distance(p, e) < 340).sort((a, b) => distance(a, p) - distance(b, p) || a.id - b.id).slice(0, 1 + s.skills.chain + (configured ? modifiers.chainTargets : 0));
      let prev = p;
      for (const e of candidates) {
        s.flashes.push({ id: id(s), x: e.x, y: e.y, x2: prev.x, y2: prev.y, type: 'chain', ttl: 14, radius: 8 });
        damageEnemy(s, e, (18 + s.skills.chain * 8) * spellScale); prev = e;
      }
      s.timers.chain = Math.max(75, 210 - s.skills.chain * 18);
    }
  }
}
// Three deterministic boss patterns: rotating ring, aimed fan, and diagonal star.
function configuredBossAngles(attack) {
  if (attack.pattern === 0) {
    const count = attack.variant === 'grove' ? 10 : 12;
    return Array.from({ length: count }, (_, n) => n / count * Math.PI * 2 + attack.rotation);
  }
  if (attack.pattern === 1) {
    const spread = attack.variant === 'grove' ? 3 : 2;
    return Array.from({ length: spread * 2 + 1 }, (_, n) => attack.angle + (n - spread) * .18);
  }
  const count = attack.variant === 'citadel' ? 12 : 8;
  return Array.from({ length: count }, (_, n) => Math.PI / 4 + n / count * Math.PI * 2);
}
function queueBossAttack(s, e, delta) {
  const pattern = e.nextPattern % 3;
  e.nextPattern++;
  e.pendingAttack = {
    pattern, x: e.x, y: e.y,
    angle: Math.atan2(delta.y, delta.x),
    rotation: s.tick / 160, ticks: BOSS_WARNING_TICKS,
  };
  if (s.runConfig) {
    e.pendingAttack.variant = e.variant;
    e.pendingAttack.angles = configuredBossAngles(e.pendingAttack);
  }
  // Existing renderer draws warning rings; VFX can use pattern/angle metadata.
  const warning = { id: id(s), x: e.x, y: e.y, type: 'warning',
    pattern, angle: e.pendingAttack.angle, ttl: BOSS_WARNING_TICKS,
    radius: pattern === 1 ? 200 : 170 };
  if (s.runConfig) Object.assign(warning, { variant: e.variant, shotCount: e.pendingAttack.angles.length, angles: [...e.pendingAttack.angles] });
  s.flashes.push(warning);
  e.shotTimer = e.enraged ? 74 : 112;
}
function fireBossAttack(s, attack, enraged) {
  const damage = enraged ? 15 : 12;
  if (s.runConfig) {
    for (const angle of attack.angles) shoot(s, attack.x, attack.y, { x: Math.cos(angle), y: Math.sin(angle) }, false,
      damage + (attack.pattern === 0 ? 0 : 1), [195, 240, 175][attack.pattern], 6);
    return;
  }
  if (attack.pattern === 0) {
    for (let n = 0; n < 12; n++) {
      const a = n / 12 * Math.PI * 2 + attack.rotation;
      shoot(s, attack.x, attack.y, { x: Math.cos(a), y: Math.sin(a) }, false, damage, 195, 6);
    }
  } else if (attack.pattern === 1) {
    for (let n = -2; n <= 2; n++) {
      const a = attack.angle + n * .18;
      shoot(s, attack.x, attack.y, { x: Math.cos(a), y: Math.sin(a) }, false, damage + 1, 240, 6);
    }
  } else {
    for (let n = 0; n < 8; n++) {
      const a = Math.PI / 4 + n / 8 * Math.PI * 2;
      shoot(s, attack.x, attack.y, { x: Math.cos(a), y: Math.sin(a) }, false, damage + 1, 175, 6);
    }
  }
}
function updateEnemies(s) {
  const p = s.player;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    if (e.slow > 0) e.slow--;
    if (e.flash > 0) e.flash--;
    if (e.type === 'boss' && s.tick - e.spawnTick >= BOSS_ENRAGE_AFTER) e.enraged = true;
    const dist = distance(p, e);
    const delta = unit(p.x - e.x, p.y - e.y);
    let travel = 0;
    if (e.type === 'cultist') {
      if (dist > 270) travel = 1;
      else if (dist < 155) travel = -1;
    } else if (dist > p.radius + e.radius + 3) travel = 1;
    if (travel !== 0) {
      const bossMultiplier = e.type === 'boss' && e.enraged ? 1.5 : 1;
      const speed = e.speed * bossMultiplier * (e.slow ? .45 : 1) * STEP * travel;
      e.x = clamp(e.x + delta.x * speed, e.radius, WORLD.width - e.radius);
      e.y = clamp(e.y + delta.y * speed, e.radius, WORLD.height - e.radius);
    }
    if (dist < p.radius + e.radius) hurt(s, e.damage);
    if (s.phase !== 'running') return;
    if (e.type === 'cultist') {
      if (--e.shotTimer <= 0 && dist < 720) {
        shoot(s, e.x, e.y, delta, false, 10, 200, 5);
        e.shotTimer = 140;
      }
    } else if (e.type === 'boss') {
      if (e.pendingAttack) {
        if (--e.pendingAttack.ticks <= 0) {
          fireBossAttack(s, e.pendingAttack, e.enraged);
          e.pendingAttack = null;
        }
      } else if (--e.shotTimer <= 0 && dist < 720) {
        queueBossAttack(s, e, delta);
      }
    }
  }
}
function updateProjectiles(s) {
  const p = s.player;
  for (const [arr, friendly] of [[s.shots,true],[s.hostileShots,false]]) {
    for (const bullet of arr) {
      if (bullet.life-- <= 0) continue;
      bullet.x += bullet.vx * STEP; bullet.y += bullet.vy * STEP;
      if (friendly) {
        for (const e of s.enemies) {
          if (e.hp > 0 && !bullet.hitIds?.includes(e.id) && distance(e, bullet) < e.radius + bullet.radius) {
            damageEnemy(s, e, bullet.damage);
            if (bullet.pierce) {
              bullet.hitIds.push(e.id);
              if (--bullet.pierce === 0) bullet.life = 0;
            } else bullet.life = 0;
            break;
          }
        }
      } else if (distance(p, bullet) < p.radius + bullet.radius) {
        hurt(s, bullet.damage); bullet.life = 0;
      }
    }
  }
  s.shots = s.shots.filter(b => b.life > 0);
  s.hostileShots = s.hostileShots.filter(b => b.life > 0);
}
function updatePickups(s) {
  const p = s.player;
  for (const item of s.pickups) {
    const dist = distance(p, item);
    if (dist < (s.runConfig ? p.pickupRadius : 165) && dist > 1) { const dir = unit(p.x - item.x, p.y - item.y); item.x += dir.x * Math.min(10, 20 / dist * 45); item.y += dir.y * Math.min(10, 20 / dist * 45); }
    if (distance(p, item) < p.radius + 14) { item.collected = true; gainXp(s, item.xp); }
    if (s.phase !== 'running') break;
  }
  s.pickups = s.pickups.filter(q => !q.collected);
}
export function step(s, input = {x:0,y:0}) {
  if (s.phase !== 'running') return s;
  s.tick++;
  const p = s.player;
  if (p.invuln > 0) p.invuln--;
  const inputX = s.runConfig ? (Number.isFinite(input.x) ? clamp(input.x, -1e6, 1e6) : 0) : input.x || 0;
  const inputY = s.runConfig ? (Number.isFinite(input.y) ? clamp(input.y, -1e6, 1e6) : 0) : input.y || 0;
  const direction = unit(inputX, inputY);
  const mag = Math.min(1, Math.hypot(inputX, inputY));
  if (s.runConfig) p.movingTicks = mag > 0 ? Math.min(60, p.movingTicks + 1) : 0;
  p.x = clamp(p.x + direction.x * p.speed * STEP * mag, p.radius, WORLD.width - p.radius);
  p.y = clamp(p.y + direction.y * p.speed * STEP * mag, p.radius, WORLD.height - p.radius);
  s.timers.spawn--;
  if (s.timers.spawn <= 0) {
    spawnWave(s);
    s.timers.spawn = Math.max(24, 53 - Math.floor(s.tick / 360));
    if (s.runConfig) s.timers.spawn = Math.max(12, Math.round(s.timers.spawn / s.rules.spawnMultiplier));
  }
  if (!s.bossSpawned && (!s.runConfig || s.runConfig.mode !== 'resource') && s.tick >= (s.runConfig ? s.bossAtTicks : BOSS_AT * 60)) {
    const pos = safeSpawnPosition(s, 'boss', 340, 450);
    spawnEnemy(s, 'boss', pos.x, pos.y);
    s.bossSpawned = true;
  }
  if (s.runConfig) updateSupports(s, damageEnemy, shoot, targetNearest);
  if (s.phase === 'running') updateEnemies(s);
  if (s.phase === 'running') updateSkills(s);
  if (s.phase === 'running') updateProjectiles(s);
  if (s.phase === 'running') updatePickups(s);
  if (s.runConfig && (s.phase === 'running' || s.phase === 'upgrade') && s.timeLimitTicks && s.tick >= s.timeLimitTicks) {
    s.phase = 'won'; s.upgrades = []; s.statusText = 'SUPPLY RUN COMPLETE';
  }
  s.enemies = s.enemies.filter(e => e.hp > 0);
  for (const f of s.flashes) f.ttl--;
  s.flashes = s.flashes.filter(f => f.ttl > 0);
  if (s.runConfig && s.flashes.length > 160) s.flashes = s.flashes.slice(-160);
  return s;
}
export function formatTime(ticks) { const seconds = Math.floor(ticks / 60); return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }
export function getReward(s) { return Math.floor(s.kills * 2 + s.tick / 60 * 1.5 + (s.phase === 'won' ? 100 : 0)); }
export const UPGRADE_DESCRIPTIONS = Object.freeze({
  bolt: ['ARCANE BOLT', 'เวทกระสุนทรงพลังขึ้น'], nova: ['FROST NOVA', 'คลื่นน้ำแข็งทำให้ศัตรูช้าลง'], orbit: ['FLAME ORBIT', 'เปลวไฟรอบตัวสร้างความเสียหาย'], chain: ['LIGHTNING CHAIN', 'สายฟ้ากระโดดโจมตีเป้าหมาย'], power: ['ARCANE POWER', 'เพิ่มพลังเวท +5'], haste: ['QUICK CAST', 'โจมตีถี่ขึ้น'], speed: ['WINDSTEP', 'วิ่งเร็วขึ้น'], heal: ['RENEWAL', 'ฟื้นฟู HP 35']
});
