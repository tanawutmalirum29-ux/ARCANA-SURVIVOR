import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, spawnEnemy, step, chooseUpgrade, MAX_ENEMIES } from '../../src/engine.js';

function isolated(config = {}) {
  const s = createGame(8472, { heroId: 'ranger', stats: { maxHp: 100, attack: 22, speed: 230, fireDelay: 120 }, ...config });
  s.timers.spawn = 999999;
  s.player.fireTimer = 999999;
  return s;
}
function target(s, x = 75, y = 0, type = 'brute') {
  const enemy = spawnEnemy(s, type, s.player.x + x, s.player.y + y);
  enemy.speed = 0; enemy.hp = enemy.maxHp = 10000; enemy.shotTimer = 999999;
  return enemy;
}
function spellDamage(skill, attack, skillMultiplier = 1, bossDamageMultiplier = 1, type = 'brute') {
  const s = isolated({ stats: { attack, fireDelay: 120, skillMultiplier, bossDamageMultiplier } });
  const enemy = target(s, 75, 0, type);
  if (skill === 'bolt') s.player.fireTimer = 0;
  else s.skills[skill] = 1;
  if (skill === 'orbit') s.tick = 21;
  for (let i = 0; i < (skill === 'bolt' ? 12 : 1); i++) step(s);
  return enemy.maxHp - enemy.hp;
}

test('configured equipment attack and skill bonuses affect every offensive skill', () => {
  for (const skill of ['bolt', 'nova', 'orbit', 'chain']) {
    const baseline = spellDamage(skill, 22);
    assert.ok(baseline > 0, `${skill} should deal actual damage`);
    assert.ok(Math.abs(spellDamage(skill, 44) - baseline * 2) < 1e-8, `${skill} must scale with equipped attack`);
    assert.ok(Math.abs(spellDamage(skill, 22, 1.5) - baseline * 1.5) < 1e-8, `${skill} must respect skill bonuses`);
    assert.ok(Math.abs(spellDamage(skill, 22, 1, 1.4, 'boss') - baseline * 1.4) < 1e-8, `${skill} must respect boss damage bonuses`);
  }
});

test('combat snapshot excludes cosmetics, copies data, and validates replay balance version', () => {
  const input = { heroId: 'mage', stats: { attack: 47 }, cosmetic: 'paid', playerSkin: 'royal', companions: [{ id: 'wisp', level: 2 }] };
  const a = createGame(35, input);
  input.stats.attack = 900;
  input.companions[0].level = 30;
  const b = createGame(35, { heroId: 'mage', stats: { attack: 47 }, cosmetic: 'free', companions: [{ id: 'wisp', level: 2 }] });
  assert.deepEqual(a, b);
  for (let n = 0; n < 1800; n++) {
    const input = { x: Math.sin(n / 80), y: Math.cos(n / 65) };
    step(a, input); step(b, input);
    if (a.phase === 'upgrade') chooseUpgrade(a, a.upgrades[0]);
    if (b.phase === 'upgrade') chooseUpgrade(b, b.upgrades[0]);
  }
  assert.deepEqual(a, b);
  assert.throws(() => createGame(3, { balanceVersion: 2 }), /Unsupported combat balance version/);
});

test('armor, critical chance and multiplier are capped and apply in combat', () => {
  const s = isolated({ stats: { maxHp: 100, armor: 10, critChance: 10, critDamage: 10 } });
  assert.equal(s.player.armor, .65); assert.equal(s.player.critChance, .6); assert.equal(s.player.critDamage, 3);
  const contact = target(s, 0, 0);
  step(s);
  assert.ok(Math.abs(s.player.hp - (100 - contact.damage * .35)) < 1e-8);
  const a = isolated({ stats: { attack: 22, critChance: .6, critDamage: 2 } });
  const b = isolated({ stats: { attack: 22, critChance: 0 } });
  target(a); target(b); a.skills.chain = b.skills.chain = 1;
  for (let n = 0; n < 30; n++) {
    a.timers.chain = b.timers.chain = 0;
    step(a); step(b);
  }
  assert.ok(a.criticalHits > 0 && a.criticalHits < 30);
  assert.ok(a.damageDealt > b.damageDealt);
  assert.equal(a.rng, b.rng, 'critical rolls must not consume wave/upgrade RNG');
});

test('piercing weapon hits two distinct targets and never repeatedly damages the first', () => {
  const s = isolated({ weaponEffect: 'pierce' });
  const first = target(s, 80), second = target(s, 145);
  s.player.fireTimer = 0;
  for (let i = 0; i < 25; i++) step(s);
  assert.equal(first.maxHp - first.hp, 22);
  assert.equal(second.maxHp - second.hp, 22);
  assert.equal(s.shots.length, 0);
});

test('spellbook modifiers extend ranges and chain target count', () => {
  for (const [skill, range, modifier] of [['nova', 220, 'novaRadius'], ['orbit', 130, 'orbitRadius']]) {
    const base = isolated(), modified = isolated({ modifiers: { [modifier]: 1.5 } });
    const a = target(base, range), b = target(modified, range);
    base.skills[skill] = modified.skills[skill] = 1;
    base.tick = modified.tick = 21;
    step(base); step(modified);
    assert.equal(a.hp, a.maxHp); assert.ok(b.hp < b.maxHp);
  }
  const s = isolated({ modifiers: { chainTargets: 1 } });
  const targets = [target(s, 100, 0), target(s, 100, 45), target(s, 100, -45)];
  s.skills.chain = 1; step(s);
  assert.ok(targets.every(enemy => enemy.hp < enemy.maxHp));
});

test('heroes have distinct timed passives instead of cosmetic stat labels', () => {
  const mage = isolated({ heroId: 'mage' }), ranger = isolated({ heroId: 'ranger' });
  const m = target(mage), r = target(ranger);
  mage.skills.nova = ranger.skills.nova = 1;
  step(mage); step(ranger);
  assert.ok(Math.abs((m.maxHp - m.hp) / (r.maxHp - r.hp) - 1.1) < 1e-8);
  const guardian = isolated({ heroId: 'guardian', stats: { maxHp: 100 } });
  step(guardian); assert.equal(guardian.player.shield, 12);
  guardian.player.shield = 0;
  for (let i = 0; i < 480; i++) step(guardian);
  assert.equal(guardian.player.shield, 12);
  const moving = isolated(), standing = isolated();
  target(moving, 350); target(standing, 350);
  for (let i = 0; i < 60; i++) { step(moving, { x: 0, y: .01 }); step(standing); }
  moving.player.fireTimer = standing.player.fireTimer = 0;
  step(moving, { x: 0, y: .01 }); step(standing);
  assert.ok(Math.abs(moving.shots[0].damage / standing.shots[0].damage - 1.12) < 1e-8);
});

test('artifacts slow, protect, and damage with deterministic cooldowns', () => {
  const slow = isolated({ artifact: { id: 'hourglass', level: 1 } });
  const enemy = target(slow, 230); slow.supportTimers.artifact = 1; step(slow);
  assert.ok(enemy.slow >= 180);
  const lantern = isolated({ artifact: { id: 'lantern', level: 1 } });
  lantern.supportTimers.artifact = 1; step(lantern);
  assert.ok(lantern.player.shield > 0); assert.ok(lantern.sanctuary?.ttl > 0);
  const burst = isolated({ artifact: { id: 'sunburst', level: 2 } });
  const b = target(burst, 160); burst.supportTimers.artifact = 1; step(burst);
  assert.ok(b.hp < b.maxHp); assert.ok(burst.supportTimers.artifact > 300);
  const hp = b.hp; step(burst); assert.equal(b.hp, hp, 'artifact must respect cooldown');
});

test('companions attack and heal while phoenix revival is consumed exactly once', () => {
  const wisp = isolated({ companions: [{ id: 'wisp', level: 1 }] });
  const w = target(wisp, 180); wisp.supportActors[0].timer = 1;
  for (let i = 0; i < 50; i++) step(wisp);
  assert.ok(w.hp < w.maxHp);
  const owl = isolated({ companions: [{ id: 'owl', level: 1 }] });
  const o = [target(owl, 130), target(owl, 160, 30)]; owl.supportActors[0].timer = 1; step(owl);
  assert.ok(o.every(enemy => enemy.hp < enemy.maxHp));
  const sprite = isolated({ companions: [{ id: 'sprite', level: 1 }] });
  sprite.player.hp = 50; sprite.supportActors[0].timer = 1; step(sprite);
  assert.ok(sprite.player.hp > 50);
  const phoenix = isolated({ guardian: { id: 'phoenix', level: 1 } });
  target(phoenix, 0, 0); phoenix.player.hp = 1; step(phoenix);
  assert.equal(phoenix.phase, 'running'); assert.equal(phoenix.phoenixRevived, true); assert.ok(phoenix.player.hp > 0);
  phoenix.player.hp = 1; phoenix.player.invuln = 0; step(phoenix);
  assert.equal(phoenix.phase, 'lost');
  const tortoise = isolated({ guardian: { id: 'tortoise', level: 1 } });
  tortoise.supportTimers.guardian = 1; step(tortoise); assert.ok(tortoise.player.shield > 0);
  const dragon = isolated({ guardian: { id: 'dragon', level: 1 } });
  const d = target(dragon, 140); dragon.supportTimers.guardian = 1; step(dragon); assert.ok(d.hp < d.maxHp);
});

test('pickup range, healing and on-kill bonuses are actual loadout consequences', () => {
  const s = isolated({ stats: { maxHp: 100, attack: 22, pickupRadius: 300, healingMultiplier: 2 }, modifiers: { killHeal: 3 } });
  s.player.hp = 50;
  s.pickups.push({ id: 900, x: s.player.x + 240, y: s.player.y, xp: 2 });
  const before = s.pickups[0].x; step(s); assert.ok(s.pickups[0].x < before);
  s.phase = 'upgrade'; s.upgrades = ['heal']; chooseUpgrade(s, 'heal'); assert.equal(s.player.hp, 100);
  s.player.hp = 50; s.skills.chain = 1;
  const e = target(s, 190); e.hp = 1; step(s); assert.equal(s.player.hp, 56);
});

test('configured runs reject non-finite stats and movement and keep population bounded', () => {
  const s = createGame(412, { mode: 'endless', stats: { maxHp: Infinity, attack: NaN, armor: -5 }, companions: Array.from({ length: 50 }, () => ({ id: 'wisp', level: 999 })) });
  assert.equal(s.player.maxHp, 100); assert.equal(s.player.attack, 22); assert.equal(s.player.armor, 0);
  assert.equal(s.supportActors.length, 2);
  s.player.invuln = 99999;
  step(s, { x: Infinity, y: NaN }); assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.y));
  for (let n = 0; n < 12000; n++) {
    step(s, { x: Math.sin(n / 100), y: Math.cos(n / 110) });
    if (s.phase === 'upgrade') chooseUpgrade(s, s.upgrades[0]);
    assert.ok(s.enemies.length <= MAX_ENEMIES + 1);
    assert.ok(s.shots.length <= 160 && s.hostileShots.length <= 360 && s.pickups.length <= 300 && s.flashes.length <= 160);
  }
});
