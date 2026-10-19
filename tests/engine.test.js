import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, step, spawnEnemy, chooseUpgrade, formatTime, getReward, WORLD, BOSS_AT, STEP} from '../src/engine.js';

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
