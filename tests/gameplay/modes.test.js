import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, spawnEnemy, step, chooseUpgrade } from '../../src/engine.js';

function completeBoss(s) {
  s.timers.spawn = 999999; s.player.invuln = 99999;
  s.tick = s.bossAtTicks - 1; step(s);
  const boss = s.enemies.find(enemy => enemy.type === 'boss');
  assert.ok(boss, 'the scheduled boss must spawn');
  boss.x = s.player.x + 190; boss.y = s.player.y; boss.speed = 0; boss.hp = 1;
  s.skills.chain = 1; s.timers.chain = 0;
  step(s);
  return boss;
}

test('chapter schedules and difficulty are independent of player equipment strength', () => {
  const chapters = ['astral', 'grove', 'citadel'];
  let previousHp = 0;
  chapters.forEach((chapterId, index) => {
    const weak = createGame(19, { chapterId, stats: { attack: 1 } });
    const strong = createGame(19, { chapterId, stats: { attack: 1500 } });
    assert.equal(weak.bossAtTicks, (180 + index * 60) * 60);
    const a = spawnEnemy(weak, 'brute', 300, 300), b = spawnEnemy(strong, 'brute', 300, 300);
    assert.equal(a.hp, b.hp, 'equipping stronger gear must not secretly scale enemies');
    assert.ok(a.hp > previousHp); previousHp = a.hp;
    const boss = completeBoss(weak);
    assert.equal(boss.variant, chapterId); assert.ok(boss.name.length > 0);
    assert.equal(weak.phase, 'won'); assert.equal(weak.bossesDefeated, 1);
  });
});

test('hard mode increases actual enemy health, contact damage and spawn pressure', () => {
  const campaign = createGame(31, { mode: 'campaign' }), hard = createGame(31, { mode: 'hard' });
  const a = spawnEnemy(campaign, 'brute', 300, 300), b = spawnEnemy(hard, 'brute', 300, 300);
  assert.ok(b.hp > a.hp && b.damage > a.damage);
  campaign.timers.spawn = hard.timers.spawn = 1; step(campaign); step(hard);
  assert.ok(hard.timers.spawn < campaign.timers.spawn);
});

test('every configured boss pattern emits exactly its telegraphed projectile directions', () => {
  for (const chapterId of ['astral', 'grove', 'citadel']) for (let pattern = 0; pattern < 3; pattern++) {
    const s = createGame(94, { chapterId });
    s.timers.spawn = s.player.fireTimer = s.player.invuln = 99999;
    const boss = spawnEnemy(s, 'boss', s.player.x + 300, s.player.y);
    boss.speed = 0; boss.nextPattern = pattern; boss.shotTimer = 1;
    step(s);
    const warning = s.flashes.find(flash => flash.type === 'warning');
    assert.ok(warning); assert.equal(s.hostileShots.length, 0);
    assert.equal(warning.shotCount, warning.angles.length);
    assert.equal(warning.variant, chapterId);
    for (let tick = 0; tick < 36; tick++) step(s);
    assert.equal(s.hostileShots.length, warning.shotCount);
    s.hostileShots.forEach((bullet, index) => {
      const direction = Math.atan2(bullet.vy, bullet.vx), shown = warning.angles[index];
      assert.ok(Math.abs(Math.sin(direction) - Math.sin(shown)) < 1e-10);
      assert.ok(Math.abs(Math.cos(direction) - Math.cos(shown)) < 1e-10);
    });
  }
});

test('boss rush and expedition require three bosses and preserve inter-stage state', () => {
  for (const mode of ['bossRush', 'expedition']) {
    const s = createGame(918, { mode });
    assert.equal(s.targetBosses, 3);
    const health = [];
    for (let stage = 1; stage <= 3; stage++) {
      const boss = completeBoss(s); health.push(boss.maxHp);
      assert.equal(boss.variant, ['astral', 'grove', 'citadel'][stage - 1], 'successive stages feature distinct boss patterns');
      assert.equal(s.bossesDefeated, stage);
      if (stage < 3) {
        assert.equal(s.phase, 'running'); assert.equal(s.stage, stage + 1);
        assert.equal(s.bossSpawned, false); assert.ok(s.bossAtTicks > s.tick);
      } else assert.equal(s.phase, 'won');
    }
    assert.ok(health[2] > health[1] && health[1] > health[0]);
    const finished = structuredClone(s); step(s); assert.deepEqual(s, finished);
  }
});

test('resource survival completes at its deadline, including a simultaneous XP upgrade', () => {
  const s = createGame(15, { mode: 'resource' });
  assert.equal(s.timeLimitTicks, 90 * 60);
  s.player.invuln = 99999; s.timers.spawn = 99999;
  s.tick = s.timeLimitTicks - 1;
  s.pickups.push({ id: 900, x: s.player.x, y: s.player.y, xp: 50 });
  step(s);
  assert.equal(s.phase, 'won'); assert.equal(s.tick, 90 * 60);
  assert.equal(s.bossSpawned, false); assert.deepEqual(s.upgrades, []);
  const finished = structuredClone(s); step(s); assert.deepEqual(s, finished);
});

test('endless mode increases stage difficulty without declaring victory at a boss kill', () => {
  const s = createGame(777, { mode: 'endless' });
  const first = completeBoss(s);
  assert.equal(s.phase, 'running'); assert.equal(s.stage, 2);
  assert.equal(s.bossAtTicks - s.tick, 120 * 60);
  const second = completeBoss(s);
  assert.equal(s.phase, 'running'); assert.equal(s.bossesDefeated, 2);
  assert.ok(second.maxHp > first.maxHp);
  s.player.invuln = 0; s.player.hp = 1;
  spawnEnemy(s, 'brute', s.player.x, s.player.y); step(s);
  assert.equal(s.phase, 'lost');
});

test('every configured mode has deterministic replay from its frozen loadout', () => {
  for (const mode of ['campaign', 'hard', 'bossRush', 'resource', 'expedition', 'daily', 'endless']) {
    const config = { mode, heroId: 'guardian', stats: { maxHp: 180, attack: 30, armor: .12, critChance: .25 }, artifact: { id: 'sunburst', level: 2 }, companions: [{ id: 'wisp', level: 2 }, { id: 'owl', level: 1 }], guardian: { id: 'tortoise', level: 1 } };
    const a = createGame(914, config), b = createGame(914, structuredClone(config));
    for (let tick = 0; tick < 4000; tick++) {
      const input = { x: Math.sin(tick / 45), y: Math.cos(tick / 85) };
      step(a, input); step(b, input);
      if (a.phase === 'upgrade') chooseUpgrade(a, a.upgrades[0]);
      if (b.phase === 'upgrade') chooseUpgrade(b, b.upgrades[0]);
    }
    assert.deepEqual(a, b, mode);
  }
});

test('complete starter-to-citadel routes win with chapter-appropriate loadouts', () => {
  for (const [chapterId, attack, maxHp] of [['astral', 25, 115], ['grove', 42, 165], ['citadel', 65, 220]]) {
    const s = createGame(8472, { chapterId, stats: { attack, maxHp }, artifact: chapterId === 'astral' ? null : { id: 'sunburst', level: 2 } });
    // Continuous mid-field kite movement avoids the boundary/corner trap.
    // This is an actual movement input, not a mutation to enemies/player HP.
    // Starter loadout, real combat and the victory requirement are unchanged.
    const orbit = frame => [1100 + Math.cos(frame / 90) * 430,
      750 + Math.sin(frame / 90) * 290];
    for (let frame = 0; frame < 6 * 60 * 60 && (s.phase === 'running' || s.phase === 'upgrade'); frame++) {
      if (s.phase === 'upgrade') {
        // Pick a legitimately offered upgrade, prioritizing survival when hurt
        // and area clearing when healthy. No invulnerability, cheats or grants.
        const priority = s.player.hp <= s.player.maxHp - 35
          ? ['heal', 'chain', 'orbit', 'nova', 'bolt', 'haste', 'power', 'speed']
          : ['chain', 'orbit', 'nova', 'bolt', 'haste', 'power', 'speed', 'heal'];
        assert.ok(chooseUpgrade(s, priority.find(key => s.upgrades.includes(key))));

        continue;
      }
      const boss = s.enemies.find(enemy => enemy.type === 'boss');
      const [tx, ty] = boss ? [boss.x + Math.cos(frame / 95) * 230, boss.y + Math.sin(frame / 95) * 230] : orbit(frame);
      const dx = tx - s.player.x, dy = ty - s.player.y;
      step(s, { x: dx, y: dy });
    }
    assert.equal(s.phase, 'won', `${chapterId} should be completable by a repeatable route: ${JSON.stringify({
      tick:s.tick, phase:s.phase, hp:s.player.hp, maxHp:s.player.maxHp,
      damageTaken:s.damageTaken, kills:s.kills, playerLevel:s.player.level,
      shots:s.shots.length, remainingEnemies:s.enemies.length,
      bossSpawned:s.bossSpawned,bossesDefeated:s.bossesDefeated,
      boss:s.enemies.find(e=>e.type==='boss')?.hp??null,
      skills:s.skills, fireDelay:s.player.fireDelay,attack:s.player.attack,
      player:{x:s.player.x,y:s.player.y}
    })}`);
    assert.ok(s.tick >= s.rules.bossAtTicks && s.tick < s.rules.bossAtTicks + 45 * 60);
    assert.ok(s.damageTaken > 0 || chapterId === 'citadel', 'starter route uses ordinary survival, not invulnerability');
  }
});
