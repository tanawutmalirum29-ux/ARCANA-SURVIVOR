import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, spawnEnemy, step, getLastPlayerFireEvent} from '../../src/engine.js';

// Deliberately use the production 60 Hz engine: no mocked fire timer events.
function rig(heroId='mage', distance=120) {
  const game = createGame(67291, {heroId, stats:{fireDelay:30}});
  game.timers.spawn = 999999;
  const enemy = spawnEnemy(game, 'brute', game.player.x + distance, game.player.y);
  enemy.hp = enemy.maxHp = 10000;
  enemy.speed = 0;
  enemy.shotTimer = 999999;
  return game;
}

test('confirmed player shot event is immutable, valid and absent from sim snapshots', () => {
  const game = rig('mage');
  assert.equal(getLastPlayerFireEvent(game), null);
  game.player.fireTimer = 0;
  step(game);
  const event = getLastPlayerFireEvent(game);
  assert.deepEqual(Object.keys(event), ['tick','shotId','originX','originY','aimX','aimY','intervalTicks']);
  assert.equal(event.tick, game.tick);
  assert.equal(event.shotId, game.shots[0].id);
  assert.equal(event.originX, game.player.x);
  assert.equal(event.originY, game.player.y);
  assert.equal(event.aimX, 1);
  assert.equal(event.aimY, 0);
  assert.equal(event.intervalTicks, game.player.fireDelay);
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.hasOwn(game, 'lastPlayerFire'), false);
  assert.equal(JSON.stringify(game).includes('lastPlayerFire'), false);
  step(game);
  assert.equal(getLastPlayerFireEvent(game), event, 'no false extra event before next real shot');
});

test('player event survives same-tick hit and removal of the projectile', () => {
  const game = rig('guardian', 18);
  game.player.fireTimer = 0;
  step(game);
  const event = getLastPlayerFireEvent(game);
  assert.ok(event?.shotId > 0);
  assert.equal(game.shots.some(b => b.id === event.shotId), false,
    'the bullet was consumed in the same step but animation can still see its event');
});

test('no target, full friendly cap, and paused game do not fabricate fire events', () => {
  const noTarget = createGame(12,{heroId:'ranger'});
  noTarget.timers.spawn = 999999;
  noTarget.player.fireTimer = 0;
  step(noTarget);
  assert.equal(getLastPlayerFireEvent(noTarget), null);
  const capped = rig('ranger');
  capped.player.fireTimer = 0;
  capped.shots = Array.from({length:160},(_,i)=>({
    id:10000+i, x:900, y:750, vx:0, vy:0, damage:1, radius:2, life:20, friendly:true
  }));
  step(capped);
  assert.equal(getLastPlayerFireEvent(capped), null);
  assert.equal(capped.player.fireTimer, capped.player.fireDelay, 'baseline cooldown remains unchanged');
  const fired = rig('mage');
  fired.player.fireTimer = 0;
  step(fired);
  const last = getLastPlayerFireEvent(fired);
  const beforeTick = fired.tick;
  fired.phase='upgrade';
  step(fired);
  assert.equal(fired.tick, beforeTick);
  assert.equal(getLastPlayerFireEvent(fired), last);
});

test('events are game-instance isolated and track subsequent accepted shots', () => {
  const a=rig('ranger'), b=rig('guardian');
  a.player.fireTimer=0; b.player.fireTimer=0;
  step(a);
  assert.ok(getLastPlayerFireEvent(a));
  assert.equal(getLastPlayerFireEvent(b), null);
  step(b);
  assert.notEqual(getLastPlayerFireEvent(a), getLastPlayerFireEvent(b));
  const first=getLastPlayerFireEvent(a);
  a.player.fireTimer=0; step(a);
  const next=getLastPlayerFireEvent(a);
  assert.ok(next.shotId>first.shotId);
  assert.ok(next.tick>first.tick);
  assert.equal(getLastPlayerFireEvent(null), null);
});
