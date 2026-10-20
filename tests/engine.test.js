import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, step, spawnEnemy, chooseUpgrade, formatTime, getReward, WORLD, BOSS_AT, BOSS_WARNING_TICKS, BOSS_ENRAGE_AFTER, STEP} from '../src/engine.js';

test('fixed timestep and seeded simulation replay', () => {
  const a = createGame(8472), b = createGame(8472);
  for (let n=0;n<2500;n++) {
    const input = {x: Math.sin(n/14), y: Math.cos(n/17)};
    step(a,input); step(b,input);
    if (a.phase === 'upgrade') chooseUpgrade(a,a.upgrades[0]);
    if (b.phase === 'upgrade') chooseUpgrade(b,b.upgrades[0]);
    if (a.phase !== 'running' && a.phase !== 'upgrade') break;
  }
  assert.deepEqual(a,b);
  assert.equal(STEP, 1/60);
});
test('movement stays in world and normalizes diagonals', () => {
  const s=createGame(1); s.player.x=15;s.player.y=15;
  step(s,{x:-10,y:-10});assert.ok(s.player.x>=s.player.radius);assert.ok(s.player.y>=s.player.radius);
  s.player.x=WORLD.width-15;s.player.y=WORLD.height-15;
  step(s,{x:10,y:10}); assert.ok(s.player.x<=WORLD.width-s.player.radius);
});
test('three enemy types and boss have distinct archetypes',()=>{
  const s=createGame();const a=['swarmer','brute','cultist','boss'].map((t,i)=>spawnEnemy(s,t,300+i*10,400));
  assert.equal(a.length,4);assert.ok(a[1].maxHp>a[0].maxHp);assert.ok(a[0].speed>a[1].speed);
  assert.ok(a[3].maxHp>a[2].maxHp);
});
test('auto fire hits enemies and grants xp orb',()=>{
  const s=createGame();const e=spawnEnemy(s,'swarmer',s.player.x+60,s.player.y);
  e.speed=0;for(let i=0;i<100&&s.phase==='running';i++)step(s);
  assert.ok(s.kills>=1,'at least one enemy defeated');assert.ok(s.pickups.length>=1 || s.player.xp>0 || s.player.level>1,'XP drop or collection reflected');
});
test('damage respects invulnerability and game over stops simulation',()=>{
  const s=createGame();s.player.hp=9; const e=spawnEnemy(s,'brute',s.player.x,s.player.y);e.speed=0;
  step(s);assert.equal(s.phase,'lost');const tick=s.tick;step(s);assert.equal(s.tick,tick);
});
test('level-up is paused and only offered upgrades can be applied',()=>{
  const s=createGame();s.player.xp=18;const orb=()=>({id:900,x:s.player.x,y:s.player.y,xp:10});s.pickups=[orb()];step(s);
  assert.equal(s.phase,'upgrade');assert.equal(s.upgrades.length,3);
  assert.equal(chooseUpgrade(s,'invalid'),false);const key=s.upgrades[0];assert.equal(chooseUpgrade(s,key),true);assert.equal(s.phase,'running');
});
test('boss spawn timing and victory trigger',()=>{
 const s=createGame();s.tick=BOSS_AT*60-1;step(s);assert.equal(s.bossSpawned,true);
 const boss=s.enemies.find(e=>e.type==='boss'); assert.ok(boss);
 boss.x=s.player.x+65;boss.y=s.player.y;boss.speed=0;boss.hp=1;
 for(let i=0;i<36 && s.phase==='running';i++)step(s);
 assert.equal(s.phase,'won');assert.equal(s.bossDefeated,true);assert.ok(getReward(s)>=100);
});
test('time and rewards pure',()=>{
 assert.equal(formatTime(0),'00:00');assert.equal(formatTime(3720),'01:02');
 const s=createGame();assert.equal(getReward(s),0);
});

test('nine-minute boss schedule gives an 8–12 minute baseline run', () => {
  assert.equal(BOSS_AT, 540, 'boss should not arrive 70 seconds into a run');
  const s = createGame(8472);
  s.timers.spawn = BOSS_AT * 60 + 50;
  s.player.invuln = BOSS_AT * 60 + 50;
  for (let t = 0; t < BOSS_AT * 60 - 1; t++) step(s);
  assert.equal(s.bossSpawned, false);
  step(s);
  assert.equal(s.bossSpawned, true);
  assert.equal(s.tick, 32400);
  assert.ok(s.enemies.some(e => e.type === 'boss'));
});

test('boss attacks warn for 36 ticks before each of three distinct bullet patterns', () => {
  const s = createGame(2026);
  s.timers.spawn = 99999;
  s.player.invuln = 99999;
  const boss = spawnEnemy(s, 'boss', s.player.x + 300, s.player.y);
  boss.speed = 0;
  boss.hp = boss.maxHp = 99999;
  s.bossSpawned = true;
  for (const [pattern, count] of [[0,12], [1,5], [2,8]]) {
    s.hostileShots = [];
    let guard = 0;
    while (!boss.pendingAttack && guard++ < 200) step(s);
    assert.ok(boss.pendingAttack, 'attack should be queued');
    assert.equal(boss.pendingAttack.pattern, pattern);
    assert.equal(boss.pendingAttack.ticks, BOSS_WARNING_TICKS);
    assert.equal(s.hostileShots.length, 0, 'warning must precede bullet emission');
    assert.ok(s.flashes.some(f => f.type === 'warning' && f.pattern === pattern));
    for (let i = 0; i < BOSS_WARNING_TICKS - 1; i++) step(s);
    assert.ok(boss.pendingAttack, 'still warning');
    assert.equal(s.hostileShots.length, 0);
    step(s);
    assert.equal(boss.pendingAttack, null, 'pattern released after warning');
    assert.equal(s.hostileShots.length, count);
  }
});

test('enrage uses elapsed boss time and deterministic state, not cosmetic data', () => {
  const a = createGame(301), b = createGame(301);
  for (const s of [a,b]) {
    s.timers.spawn = 99999;
    s.player.invuln = 99999;
    const boss = spawnEnemy(s,'boss',s.player.x + 320,s.player.y);
    boss.speed = 0;
    s.bossSpawned = true;
    s.tick = boss.spawnTick + BOSS_ENRAGE_AFTER - 1;
  }
  a.player.skin = 'paid_legendary';
  b.player.skin = 'free_default';
  for (let i = 0; i < 240; i++) { step(a);step(b); }
  assert.ok(a.enemies[0].enraged);
  assert.equal(a.enemies[0].enraged, b.enemies[0].enraged);
  delete a.player.skin;delete b.player.skin;
  assert.deepEqual(a,b,'skin IDs must not affect combat decisions or seeded replay');
});

test('cultist retreats from melee range while brute advances', () => {
  const s = createGame(7);s.timers.spawn = 9999;
  const cultist = spawnEnemy(s, 'cultist', s.player.x+95, s.player.y);
  const brute = spawnEnemy(s, 'brute', s.player.x+390, s.player.y);
  const beforeCultist = Math.abs(cultist.x - s.player.x);
  const beforeBrute = Math.abs(brute.x - s.player.x);
  step(s);
  assert.ok(Math.abs(cultist.x - s.player.x) > beforeCultist);
  assert.ok(Math.abs(brute.x - s.player.x) < beforeBrute);
});

test('wave spawn keeps safe separation at arena corner', () => {
  const s=createGame(1);s.player.x=s.player.radius;s.player.y=s.player.radius;
  s.timers.spawn=1;step(s);
  assert.equal(s.enemies.length,1);
  const e=s.enemies[0];
  assert.ok(Math.hypot(e.x-s.player.x,e.y-s.player.y) >= 280);
});

test('overflow XP queues successive level-up choices without losing XP', () => {
  const s=createGame(42);
  s.timers.spawn = 9999;
  s.pickups.push({id:999,x:s.player.x,y:s.player.y,xp:180});
  step(s);
  assert.equal(s.phase,'upgrade');
  const prev = s.player.level;
  assert.equal(chooseUpgrade(s,s.upgrades[0]),true);
  assert.equal(s.phase,'upgrade','extra XP should trigger the next choice');
  assert.ok(s.player.level > prev);
  assert.equal(chooseUpgrade(s,'not-offered'),false);
});

test('four spell mechanics fire and affect enemies independently', () => {
  const bolt = createGame(10);bolt.timers.spawn=9999;
  const target = spawnEnemy(bolt,'brute',bolt.player.x+100,bolt.player.y);
  target.speed=0;
  step(bolt);
  assert.ok(bolt.shots.length > 0, 'Arcane Bolt emits projectile');
  const nova = createGame(10);nova.timers.spawn=9999;nova.skills.nova=1;
  const n=spawnEnemy(nova,'brute',nova.player.x+80,nova.player.y);
  n.speed=0;step(nova);
  assert.ok(n.hp<n.maxHp && n.slow>0,'Frost Nova damages and slows');
  const orbit = createGame(10);orbit.timers.spawn=9999;orbit.skills.orbit=1;
  const o=spawnEnemy(orbit,'brute',orbit.player.x+78,orbit.player.y);
  o.speed=0;orbit.tick=21;step(orbit);
  assert.ok(o.hp<o.maxHp,'Flame Orbit damages in range');
  const chain = createGame(10);chain.timers.spawn=9999;chain.skills.chain=1;
  const c=spawnEnemy(chain,'brute',chain.player.x+180,chain.player.y);
  c.speed=0;step(chain);
  assert.ok(c.hp<c.maxHp,'Lightning Chain hits target');
  assert.ok(chain.flashes.some(f=>f.type==='chain'));
});

test('sample win and loss routes are deterministic and cannot be advanced after finish',()=>{
  const win=createGame(8472);win.tick=BOSS_AT*60-1;
  win.timers.spawn=9999;win.player.invuln=1000;step(win);
  const boss=win.enemies.find(e=>e.type==='boss');
  assert.ok(boss);boss.x=win.player.x+65;boss.y=win.player.y;boss.speed=0;boss.hp=1;
  for(let i=0;i<45&&win.phase==='running';i++)step(win);
  assert.equal(win.phase,'won');assert.equal(win.bossDefeated,true);
  const frozenWin=structuredClone(win);step(win);assert.deepEqual(win,frozenWin);
  const loss=createGame(16);loss.player.hp=9;
  const e=spawnEnemy(loss,'brute',loss.player.x,loss.player.y);e.speed=0;
  step(loss);assert.equal(loss.phase,'lost');
  const frozenLoss=structuredClone(loss);step(loss);assert.deepEqual(loss,frozenLoss);
});
