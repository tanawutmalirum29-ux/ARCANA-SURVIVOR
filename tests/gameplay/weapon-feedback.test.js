import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawnEnemy,step,getLastPlayerFireEvent,getUpgradeDescription} from '../../src/engine.js';
import {captureAudioState,getStepSounds,createGameAudio} from '../../src/audio.js';

function cue(heroId){
 const game=createGame(888,{heroId,stats:{fireDelay:30,maxHp:200}});
 game.timers.spawn=999999;
 const enemy=spawnEnemy(game,'brute',game.player.x+65,game.player.y);
 enemy.hp=enemy.maxHp=10000;enemy.speed=0;enemy.shotTimer=999999;
 game.player.fireTimer=0;
 const before=captureAudioState(game);
 step(game);
 return getStepSounds(before,game);
}
test('battle audio comes from actual sword strikes, arrows and magic projectiles',()=>{
 const sword=cue('guardian'),arrow=cue('ranger'),spell=cue('mage');
 assert.ok(sword.includes('slash'),JSON.stringify(sword));
 assert.ok(!sword.includes('cast')&&!sword.includes('bow'));
 assert.ok(arrow.includes('bow'),JSON.stringify(arrow));
 assert.ok(!arrow.includes('slash')&&!arrow.includes('cast'));
 assert.ok(spell.includes('cast'),JSON.stringify(spell));
 assert.ok(!spell.includes('slash')&&!spell.includes('bow'));
});
test('weapon upgrades use the correct terms while keeping legacy magic spell labels',()=>{
 for(const [hero,label] of [['mage','ARCANE BOLT'],['guardian','BLADE EDGE'],['ranger','ARROWHEAD']]){
  assert.equal(getUpgradeDescription('bolt',hero)[0],label);
  assert.ok(getUpgradeDescription('haste',hero)?.[0]);
  assert.ok(getUpgradeDescription('power',hero)?.[0]);
  assert.equal(getUpgradeDescription('nova',hero)[0],'FROST NOVA');
 }
});

function nearAttack(heroId, distance=30) {
 const game=createGame(888,{heroId,stats:{fireDelay:30,maxHp:200}});
 game.timers.spawn=999999;
 const enemy=spawnEnemy(game,'brute',game.player.x+distance,game.player.y);
 enemy.hp=enemy.maxHp=10000;enemy.speed=0;enemy.shotTimer=999999;
 game.player.fireTimer=0;
 const before=captureAudioState(game);
 step(game);
 return {game,enemy,before,sounds:getStepSounds(before,game)};
}
test('QA_BLOCK #1: same-tick arrow and staff impacts still emit genuine fire audio',()=>{
 for (const [hero,expected] of [['ranger','bow'],['mage','cast']]) {
  const {game,enemy,sounds}=nearAttack(hero,30);
  assert.ok(enemy.hp<enemy.maxHp,hero+' must actually hit');
  assert.equal(game.shots.length,0,hero+' bullet consumed in the SAME tick');
  const event=getLastPlayerFireEvent(game);
  assert.equal(event?.tick,game.tick);
  assert.equal(hero==='mage' ? event?.kind : event?.kind,hero==='mage'?undefined:'arrow');
  assert.ok(sounds.includes(expected),JSON.stringify({hero,sounds}));
  assert.equal(sounds.filter(x=>x===expected).length,1,'one cue per confirmed hit');
  assert.ok(!sounds.includes(hero==='mage'?'bow':'cast'));
 }
});
test('no-target/capped/paused/old-fire events do not synthesize attack audio',()=>{
 for(const hero of ['ranger','mage']) {
  const game=createGame(888,{heroId:hero,stats:{fireDelay:30,maxHp:200}});
  game.timers.spawn=999999;game.player.fireTimer=0;
  let before=captureAudioState(game);step(game);
  assert.equal(getLastPlayerFireEvent(game),null);
  assert.ok(!getStepSounds(before,game).some(x=>['bow','cast'].includes(x)));
  const enemy=spawnEnemy(game,'brute',game.player.x+30,game.player.y);
  enemy.hp=enemy.maxHp=10000;enemy.speed=0;enemy.shotTimer=999999;
  game.shots=Array.from({length:160},(_,i)=>({
    id:10000+i,x:game.player.x+700,y:game.player.y,vx:0,vy:0,damage:1,
    radius:2,life:125,friendly:true
  }));
  game.player.fireTimer=0;before=captureAudioState(game);step(game);
  assert.equal(getLastPlayerFireEvent(game),null,'projectile cap blocks firing');
  assert.ok(!getStepSounds(before,game).some(x=>['bow','cast'].includes(x)));
  game.shots=[];game.player.fireTimer=0;
  before=captureAudioState(game);step(game);
  assert.ok(getLastPlayerFireEvent(game),'real shot accepted');
  assert.ok(getStepSounds(before,game).includes(hero==='mage'?'cast':'bow'));
  before=captureAudioState(game);
  game.phase='upgrade';
  const lastTick=game.tick;
  step(game);
  assert.equal(game.tick,lastTick);
  assert.ok(!getStepSounds(before,game).some(x=>['bow','cast'].includes(x)),
    'stale event on paused frame must not replay sound');
  game.phase='running';game.player.fireTimer=9999;
  before=captureAudioState(game);step(game);
  assert.ok(!getStepSounds(before,game).some(x=>['bow','cast'].includes(x)),
    'stale event during non-fire tick cannot play again');
 }
});
test('unconfigured legacy player emits a single confirmed cast with original event API',()=>{
 const game=createGame(299);
 game.timers.spawn=999999;
 const enemy=spawnEnemy(game,'brute',game.player.x+30,game.player.y);
 enemy.hp=enemy.maxHp=10000;enemy.speed=0;enemy.shotTimer=999999;
 game.player.fireTimer=0;
 const before=captureAudioState(game);
 step(game);
 assert.equal(game.shots.length,0);
 assert.deepEqual(Object.keys(getLastPlayerFireEvent(game)),[
  'tick','shotId','originX','originY','aimX','aimY','intervalTicks'
 ]);
 assert.equal(getStepSounds(before,game).filter(x=>x==='cast').length,1);
});
