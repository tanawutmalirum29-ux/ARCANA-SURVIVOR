// Independent QA regression gate. Run: node --test tests/qa/*.test.js
// No browser/hardware evidence is implied by passing these pure-engine tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_AT, WORLD, createGame, step, spawnEnemy, chooseUpgrade, getReward
} from '../../src/engine.js';
import { COSMETICS, defaultProfile, sanitizeProfile } from '../../src/storage.js';

function replay(seed, skinId) {
  const profile = sanitizeProfile({
    ...defaultProfile(),
    owned: ['apprentice', 'ember', 'moon'],
    skin: skinId
  });
  const game = createGame(seed);
  for (let n = 0; n < 480; n += 1) {
    step(game, { x: Math.sin(n / 17), y: Math.cos(n / 21) });
    if (game.phase === 'upgrade') {
      assert.equal(chooseUpgrade(game, game.upgrades[0]), true);
    }
    if (game.phase === 'lost' || game.phase === 'won') break;
  }
  return { profile, game };
}

test('seeded combat state is identical across permitted cosmetics', () => {
  const reference = replay(97113, 'apprentice').game;
  for (const skin of ['ember', 'moon']) {
    const result = replay(97113, skin);
    assert.equal(result.profile.skin, skin);
    assert.deepEqual(result.game, reference, `skin ${skin} changed combat state`);
  }
});

test('cosmetics catalog contains no gameplay-power fields and unshipped premium stays locked', () => {
  const powerFields = ['attack', 'damage', 'hp', 'maxHp', 'speed',
    'radius', 'hitbox', 'crit', 'fireDelay', 'invuln', 'xp', 'level'];
  for (const item of COSMETICS) {
    for (const field of powerFields) {
      assert.equal(Object.hasOwn(item, field), false, `${item.id} introduces ${field}`);
    }
  }
  const injected = sanitizeProfile({
    ...defaultProfile(),
    skin: 'crimson',
    owned: ['apprentice', 'crimson', 'celestial', 'lantern', 'verdant']
  });
  assert.deepEqual(injected.owned, ['apprentice']);
  assert.equal(injected.skin, 'apprentice');
});

test('boss is spawned once at its configured threshold and victory freezes simulation', () => {
  const game = createGame(2244);
  game.tick = BOSS_AT * 60 - 1;
  step(game);
  const boss = game.enemies.find(enemy => enemy.type === 'boss');
  assert.ok(boss, 'boss not spawned at deadline');
  assert.equal(game.bossSpawned, true);
  boss.x = game.player.x + 65;
  boss.y = game.player.y;
  boss.hp = 1;
  boss.speed = 0;
  boss.shotTimer = 99999;
  for (let n = 0; n < 60 && game.phase === 'running'; n += 1) step(game);
  assert.equal(game.phase, 'won', 'boss defeat did not finish run');
  assert.equal(game.bossDefeated, true);
  assert.equal(game.enemies.filter(enemy => enemy.type === 'boss').length, 0);
  const ticks = game.tick;
  const reward = getReward(game);
  step(game);
  assert.equal(game.tick, ticks, 'won run still simulated');
  assert.equal(getReward(game), reward);
  assert.ok(reward >= 100);
});

test('lethal enemy contact causes loss and the world stops advancing', () => {
  const game = createGame(331);
  game.player.hp = 1;
  const enemy = spawnEnemy(game, 'brute', game.player.x, game.player.y);
  enemy.speed = 0;
  step(game);
  assert.equal(game.phase, 'lost');
  assert.equal(game.player.hp, 0);
  const snapshot = structuredClone(game);
  step(game, { x: 1, y: 1 });
  assert.deepEqual(game, snapshot);
});

test('upgrade modal phase freezes simulation until a valid upgrade', () => {
  const game = createGame(881);
  game.player.xp = game.player.nextXp - 1;
  game.pickups.push({ id: 9999, x: game.player.x, y: game.player.y, xp: 2 });
  step(game);
  assert.equal(game.phase, 'upgrade');
  const tick = game.tick;
  step(game, { x: 1, y: 0 });
  assert.equal(game.tick, tick);
  assert.equal(chooseUpgrade(game, 'nonexistent-upgrade'), false);
  assert.equal(game.phase, 'upgrade');
  assert.equal(chooseUpgrade(game, game.upgrades[0]), true);
  assert.equal(game.phase, 'running');
});

test('extreme player movement cannot escape world boundaries', () => {
  const game = createGame(442);
  for (const movement of [{ x: -999, y: -999 }, { x: 999, y: 999 }]) {
    for (let tick = 0; tick < 15 && game.phase === 'running'; tick += 1) {
      step(game, movement);
      assert.ok(game.player.x >= game.player.radius);
      assert.ok(game.player.y >= game.player.radius);
      assert.ok(game.player.x <= WORLD.width - game.player.radius);
      assert.ok(game.player.y <= WORLD.height - game.player.radius);
    }
  }
});
