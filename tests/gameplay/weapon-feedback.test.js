import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawnEnemy,step,getUpgradeDescription} from '../../src/engine.js';
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
