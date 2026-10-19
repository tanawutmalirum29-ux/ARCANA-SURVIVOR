/* Deterministic, renderer-agnostic 60Hz simulation. No DOM, storage, network or cosmetic imports. */
export const STEP = 1 / 60;
export const WORLD = { width: 2200, height: 1500 };
export const BOSS_AT = 70;
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
function id(s) { s.nextId += 1; return s.nextId; }
export function createGame(seed = 2026) {
  return {
    rng: (Number(seed) >>> 0) || 1, nextId: 0, tick: 0, phase: 'running',
    player: { x: WORLD.width / 2, y: WORLD.height / 2, radius: 14, hp: 100, maxHp: 100, speed: 230, level: 1, xp: 0, nextXp: 20, attack: 22, fireDelay: 24, fireTimer: 0, invuln: 0 },
    enemies: [], shots: [], hostileShots: [], pickups: [], flashes: [],
    kills: 0, skills: { bolt: 1, nova: 0, orbit: 0, chain: 0 },
    timers: { spawn: 35, nova: 0, chain: 0, bossShot: 110 },
    bossSpawned: false, bossDefeated: false, upgrades: [], statusText: '',
  };
}
export function spawnEnemy(s, type, x, y) {
  if (!TYPES[type]) throw new Error('Unknown enemy type');
  const t = TYPES[type];
  const enemy = { id: id(s), type, x: clamp(x, t.radius, WORLD.width - t.radius), y: clamp(y, t.radius, WORLD.height - t.radius), radius: t.radius, hp: t.hp, maxHp: t.hp, speed: t.speed, damage: t.damage, xp: t.xp, shotTimer: 80, slow: 0, flash: 0 };
  s.enemies.push(enemy); return enemy;
}
function spawnWave(s) {
  if (s.enemies.length >= MAX_ENEMIES) return;
  const p = s.player;
  const angle = random(s) * Math.PI * 2;
  const radius = 380 + random(s) * 170;
  const v = random(s);
  const type = s.tick / 60 < 14 || v < 0.64 ? 'swarmer' : v < 0.84 ? 'cultist' : 'brute';
  spawnEnemy(s, type, p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius);
}
function hurt(s, amount) {
  const p = s.player;
  if (p.invuln > 0 || s.phase !== 'running') return;
  p.hp = Math.max(0, p.hp - amount);
  p.invuln = 46;
  s.flashes.push({ id: id(s), x: p.x, y: p.y, type: 'hurt', ttl: 16, radius: 42 });
  if (p.hp === 0) s.phase = 'lost';
}
function damageEnemy(s, enemy, amount) {
  if (enemy.hp <= 0) return;
  enemy.hp = Math.max(0, enemy.hp - amount); enemy.flash = 8;
  if (enemy.hp === 0) {
    s.kills++;
    s.pickups.push({ id: id(s), x: enemy.x, y: enemy.y, xp: enemy.xp });
    s.flashes.push({ id: id(s), x: enemy.x, y: enemy.y, type: 'death', ttl: 20, radius: enemy.radius * 2.5 });
    if (enemy.type === 'boss') { s.bossDefeated = true; s.phase = 'won'; }
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
  else if (key === 'heal') p.hp = Math.min(p.maxHp, p.hp + 35);
  s.upgrades = []; s.phase = 'running';
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
  const item = { id: id(s), x, y, vx: direction.x * speed, vy: direction.y * speed, damage, radius, life: 125, friendly };
  (friendly ? s.shots : s.hostileShots).push(item);
}
function updateSkills(s) {
  const p = s.player;
  p.fireTimer--;
  if (p.fireTimer <= 0) {
    const enemy = targetNearest(s, p);
    if (enemy) {
      shoot(s, p.x, p.y, unit(enemy.x - p.x, enemy.y - p.y), true, p.attack * (1 + (s.skills.bolt - 1) * .24));
      p.fireTimer = p.fireDelay;
    }
  }
  if (s.skills.nova) {
    s.timers.nova--;
    if (s.timers.nova <= 0) {
      s.flashes.push({ id: id(s), x: p.x, y: p.y, radius: 175, ttl: 24, type: 'nova' });
      for (const e of s.enemies) if (e.hp > 0 && distance(p, e) < 175) { damageEnemy(s, e, 12 + s.skills.nova * 8); e.slow = 110; }
      s.timers.nova = Math.max(100, 325 - s.skills.nova * 20);
    }
  }
  if (s.skills.orbit && s.tick % 22 === 0) {
    for (const e of s.enemies) if (e.hp > 0 && distance(p, e) < 92 + s.skills.orbit * 7) damageEnemy(s, e, 8 + s.skills.orbit * 5);
  }
  if (s.skills.chain) {
    s.timers.chain--;
    if (s.timers.chain <= 0) {
      const candidates = s.enemies.filter(e => e.hp > 0 && distance(p, e) < 340).sort((a, b) => distance(a, p) - distance(b, p) || a.id - b.id).slice(0, 1 + s.skills.chain);
      let prev = p;
      for (const e of candidates) {
        s.flashes.push({ id: id(s), x: e.x, y: e.y, x2: prev.x, y2: prev.y, type: 'chain', ttl: 14, radius: 8 });
        damageEnemy(s, e, 18 + s.skills.chain * 8); prev = e;
      }
      s.timers.chain = Math.max(75, 210 - s.skills.chain * 18);
    }
  }
}
function updateEnemies(s) {
  const p = s.player;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    if (e.slow > 0) e.slow--;
    if (e.flash > 0) e.flash--;
    const dist = distance(p, e);
    const delta = unit(p.x - e.x, p.y - e.y);
    let desired = e.type === 'cultist' ? 235 : p.radius + e.radius + 3;
    if (dist > desired) {
      const speed = e.speed * (e.slow ? .45 : 1) * STEP;
      e.x = clamp(e.x + delta.x * speed, e.radius, WORLD.width - e.radius);
      e.y = clamp(e.y + delta.y * speed, e.radius, WORLD.height - e.radius);
    }
    if (dist < p.radius + e.radius) hurt(s, e.damage);
    if (e.type === 'cultist' || e.type === 'boss') {
      e.shotTimer--;
      if (e.shotTimer <= 0 && dist < 720) {
        if (e.type === 'cultist') shoot(s, e.x, e.y, delta, false, 10, 200, 5);
        else {
          const phase = Math.floor(s.tick / 240) % 3;
          if (phase === 0) {
            for (let n = 0; n < 12; n++) { const a = n / 12 * Math.PI * 2 + s.tick / 160; shoot(s, e.x, e.y, { x: Math.cos(a), y: Math.sin(a) }, false, 12, 195, 6); }
          } else if (phase === 1) {
            for (let n = -2; n <= 2; n++) { const a = Math.atan2(delta.y, delta.x) + n * .18; shoot(s, e.x, e.y, {x: Math.cos(a), y: Math.sin(a)}, false, 13, 240, 6); }
          } else {
            s.flashes.push({ id: id(s), x: e.x, y: e.y, type: 'warning', ttl: 36, radius: 170 });
            for (let n = 0; n < 8; n++) { const a = n / 8 * Math.PI * 2; shoot(s, e.x, e.y, {x: Math.cos(a), y: Math.sin(a)}, false, 13, 165, 6); }
          }
        }
        e.shotTimer = e.type === 'boss' ? 105 : 140;
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
          if (e.hp > 0 && distance(e, bullet) < e.radius + bullet.radius) {
            damageEnemy(s, e, bullet.damage);
            bullet.life = 0;
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
    if (dist < 165 && dist > 1) { const dir = unit(p.x - item.x, p.y - item.y); item.x += dir.x * Math.min(10, 20 / dist * 45); item.y += dir.y * Math.min(10, 20 / dist * 45); }
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
  const direction = unit(input.x || 0, input.y || 0);
  const mag = Math.min(1, Math.hypot(input.x || 0, input.y || 0));
  p.x = clamp(p.x + direction.x * p.speed * STEP * mag, p.radius, WORLD.width - p.radius);
  p.y = clamp(p.y + direction.y * p.speed * STEP * mag, p.radius, WORLD.height - p.radius);
  s.timers.spawn--;
  if (s.timers.spawn <= 0) { spawnWave(s); s.timers.spawn = Math.max(14, 53 - Math.floor(s.tick / 180)); }
  if (!s.bossSpawned && s.tick >= BOSS_AT * 60) {
    const theta = random(s) * Math.PI * 2;
    spawnEnemy(s, 'boss', p.x + Math.cos(theta) * 340, p.y + Math.sin(theta) * 340);
    s.bossSpawned = true;
  }
  updateEnemies(s);
  if (s.phase === 'running') updateSkills(s);
  if (s.phase === 'running') updateProjectiles(s);
  if (s.phase === 'running') updatePickups(s);
  s.enemies = s.enemies.filter(e => e.hp > 0);
  for (const f of s.flashes) f.ttl--;
  s.flashes = s.flashes.filter(f => f.ttl > 0);
  return s;
}
export function formatTime(ticks) { const seconds = Math.floor(ticks / 60); return `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }
export function getReward(s) { return Math.floor(s.kills * 2 + s.tick / 60 * 1.5 + (s.phase === 'won' ? 100 : 0)); }
export const UPGRADE_DESCRIPTIONS = Object.freeze({
  bolt: ['ARCANE BOLT', 'เวทกระสุนทรงพลังขึ้น'], nova: ['FROST NOVA', 'คลื่นน้ำแข็งทำให้ศัตรูช้าลง'], orbit: ['FLAME ORBIT', 'เปลวไฟรอบตัวสร้างความเสียหาย'], chain: ['LIGHTNING CHAIN', 'สายฟ้ากระโดดโจมตีเป้าหมาย'], power: ['ARCANE POWER', 'เพิ่มพลังเวท +5'], haste: ['QUICK CAST', 'โจมตีถี่ขึ้น'], speed: ['WINDSTEP', 'วิ่งเร็วขึ้น'], heal: ['RENEWAL', 'ฟื้นฟู HP 35']
});
