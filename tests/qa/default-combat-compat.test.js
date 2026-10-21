// Independently recorded from main efeb314c7e706a3a70d7a3ba209592b673ffc88c.
// This gate checks the complete unconfigured simulation, not only a few stats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BOSS_AT, createGame, step, chooseUpgrade } from '../../src/engine.js';

const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
const fixtures = [
  [1, 0, '86dc163c47279bc64286dad1de71af7a0bcb9d500640b0c4ea204ee93da9c509'],
  [97113, 480, 'bac11d699be1e8285f8f558ad2e66cd7e4d883cd21c457691ca6b38cef9f5dcb'],
  [42, 6000, 'c216a34c1128cb29d385319f617da732f5eaaf49be77905d056638980f1d547c'],
  [0, 1800, '59ce2a8374a84b13af8947c29bfa28574788744825d7dba8247f0f70e3f1f3af'],
];

for (const [seed, ticks, expected] of fixtures) {
  test(`unconfigured engine preserves main replay: seed ${seed}, ${ticks} ticks`, () => {
    const game = createGame(seed);
    for (let n = 0; n < ticks; n++) {
      step(game, { x: Math.sin(n / 17), y: Math.cos(n / 21) });
      if (game.phase === 'upgrade') chooseUpgrade(game, game.upgrades[n % game.upgrades.length]);
    }
    assert.equal(digest(game), expected);
  });
}

test('unconfigured engine preserves main boss threshold and initial boss state', () => {
  const game = createGame(2244);
  game.tick = BOSS_AT * 60 - 1;
  step(game);
  assert.equal(digest(game), 'f48d9eb3c6e0b40e22da6a769af120fe887946b397568fa69595bde272b7e702');
});
