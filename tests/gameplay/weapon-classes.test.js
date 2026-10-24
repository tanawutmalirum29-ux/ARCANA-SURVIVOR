import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawnEnemy,step,getLastPlayerFireEvent} from '../../src/engine.js';
import {createCampaign,validateCampaign,applyCommand,deriveLoadout,EQUIPMENT} from '../../src/progression/index.js';
import {defaultProfile} from '../../src/storage.js';
import {normalizeRunConfig} from '../../src/gameplay/run-config.js';
import {WEAPON_CLASS_BY_ID,HERO_WEAPON_CLASSES,weaponCompatible} from '../../src/gameplay/weapons.js';

function user(){
 const profile=defaultProfile();profile.runs=30;profile.gold=90000;
 const state=createCampaign(profile);
 state.progression.materials={essence:90000,research:90000,dust:90000};
 state.progression.heroes.guardian.level=1;
 state.progression.heroes.ranger.level=1;
 assert.equal(validateCampaign(state),true);
 return state;
}
function command(state,input){
 const before=structuredClone(state);
 const r=applyCommand(state,input);
 assert.equal(r.ok,true,input.type+': '+r.code);
 assert.equal(validateCampaign(r.state),true);
 assert.deepEqual(state,before,'command mutated source');
 return r.state;
}
function denied(state,input,code='WEAPON_INCOMPATIBLE'){
 const before=structuredClone(state);
 const r=applyCommand(state,input);
 assert.equal(r.ok,false,input.type+' was allowed');
 assert.equal(r.code,code);
 assert.strictEqual(r.state,state,'rejected command returned changed state');
 assert.deepEqual(state,before);
}
function craft(state,definitionId){
 const r=applyCommand(state,{type:'CRAFT_ITEM',definitionId});
 assert.equal(r.ok,true,definitionId+': '+r.code);
 assert.equal(validateCampaign(r.state),true);
 return [r.state,r.details.item.id];
}
function battle(heroId,{distance=75,weaponId=null,weaponEffect='balanced',second=false}={}){
 const s=createGame(98765,{heroId,weaponId,weaponEffect,stats:{maxHp:500,attack:22,fireDelay:30}});
 s.timers.spawn=999999;
 s.player.fireTimer=0;
 const e=spawnEnemy(s,'brute',s.player.x+distance,s.player.y);
 e.speed=0;e.hp=e.maxHp=10000;e.shotTimer=999999;
 let e2=null;
 if(second){e2=spawnEnemy(s,'brute',s.player.x+distance,s.player.y+26);e2.speed=0;e2.hp=e2.maxHp=10000;e2.shotTimer=999999;}
 step(s);
 return {s,e,e2,event:getLastPlayerFireEvent(s)};
}
test('all 9 catalog weapons belong to exactly one hero family, never to another',()=>{
 const weapons=EQUIPMENT.filter(x=>x.slot==='weapon');
 assert.equal(weapons.length,9);
 assert.deepEqual(Object.keys(HERO_WEAPON_CLASSES),['mage','guardian','ranger']);
 assert.deepEqual(new Set(weapons.map(x=>x.id)),new Set(Object.keys(WEAPON_CLASS_BY_ID)));
 for(const weapon of weapons){
  for(const hero of Object.keys(HERO_WEAPON_CLASSES)){
   assert.equal(weaponCompatible(hero,weapon.id),HERO_WEAPON_CLASSES[hero]===WEAPON_CLASS_BY_ID[weapon.id]);
  }
 }
 assert.equal(weaponCompatible('ranger','unknown'),false);
 assert.equal(weaponCompatible('mage',null),true);
});
test('craft and equip allow matching swords/bows/staffs but reject all off-class weapon equip',()=>{
 let state=user(),sword,bow;
 [state,sword]=craft(state,'sentinel_sword');
 [state,bow]=craft(state,'oak_bow');
 denied(state,{type:'EQUIP_ITEM',itemId:sword,slot:'weapon'});
 denied(state,{type:'EQUIP_ITEM',itemId:bow,slot:'weapon'});
 state=command(state,{type:'SELECT_HERO',heroId:'guardian'});
 assert.equal(state.progression.equipment.weapon,null,'Astra staff must auto-unequip on switch');
 denied(state,{type:'EQUIP_ITEM',itemId:bow,slot:'weapon'});
 denied(state,{type:'EQUIP_ITEM',itemId:'item-1',slot:'weapon'});
 state=command(state,{type:'EQUIP_ITEM',itemId:sword,slot:'weapon'});
 assert.equal(deriveLoadout(state).weaponId,'sentinel_sword');
 state=command(state,{type:'SELECT_HERO',heroId:'ranger'});
 assert.equal(state.progression.equipment.weapon,null);
 state=command(state,{type:'EQUIP_ITEM',itemId:bow,slot:'weapon'});
 assert.equal(deriveLoadout(state).weaponId,'oak_bow');
 denied(state,{type:'EQUIP_ITEM',itemId:sword,slot:'weapon'});
 state=command(state,{type:'SELECT_HERO',heroId:'mage'});
 assert.equal(state.progression.equipment.weapon,null);
 state=command(state,{type:'EQUIP_ITEM',itemId:'item-1',slot:'weapon'});
 assert.equal(deriveLoadout(state).weaponId,'star_wand');
 assert.ok(state.progression.inventory.find(x=>x.id===sword));
 assert.ok(state.progression.inventory.find(x=>x.id===bow));
});
test('old cross-class equipment and saved preset are harmless and repaired without deleting inventory',()=>{
 let state=user(),sword;
 [state,sword]=craft(state,'moonsteel_blade');
 state=command(state,{type:'SELECT_HERO',heroId:'guardian'});
 state=command(state,{type:'EQUIP_ITEM',itemId:sword,slot:'weapon'});
 assert.equal(deriveLoadout(state).weaponEffect,'cleave');
 state=command(state,{type:'SAVE_PRESET',index:0});
 state=command(state,{type:'SELECT_HERO',heroId:'mage'});
 // Existing old saves may already contain mismatched weapons. They remain
 // structurally valid for safe migration; power calculations ignore them.
 const legacy=structuredClone(state);
 legacy.progression.equipment.weapon=sword;
 assert.equal(validateCampaign(legacy),true,'existing saved profiles must still load');
 const loadout=deriveLoadout(legacy);
 assert.equal(loadout.weaponId,null,'stale off-class sword cannot boost mage');
 assert.equal(loadout.weaponEffect,'balanced');
 assert.equal(loadout.stats.attack,deriveLoadout(state).stats.attack);
 // An old preset with a mismatched weapon is loaded safely and cleared.
 const old=structuredClone(state);
 old.progression.presets[0].heroId='mage';
 old.progression.presets[0].appearance={heroId:'mage',skinId:'mage:base'};
 assert.equal(validateCampaign(old),true);
 const loaded=command(old,{type:'LOAD_PRESET',index:0});
 assert.equal(loaded.progression.equipment.weapon,null);
 assert.ok(loaded.progression.inventory.find(x=>x.id===sword));
});
test('combat config strips incompatible weapon IDs and foreign effects, preserving default skills',()=>{
 for(const heroId of ['mage','guardian','ranger']){
  for(const weaponId of Object.keys(WEAPON_CLASS_BY_ID)){
   const run=normalizeRunConfig({heroId,weaponId,weaponEffect:'cleave'});
   assert.equal(run.weaponId,weaponCompatible(heroId,weaponId)?weaponId:null);
   assert.equal(run.weaponEffect,heroId==='guardian' && run.weaponId?'cleave':'balanced');
  }
 }
 assert.equal(normalizeRunConfig({heroId:'ranger',weaponId:'thorn_bow',weaponEffect:'pierce'}).weaponEffect,'pierce');
});
test('guardian sword is a true short-range collision, not a distant magic projectile',()=>{
 const near=battle('guardian',{distance:75,weaponId:'sentinel_sword'});
 assert.ok(near.e.hp<near.e.maxHp);
 assert.equal(near.s.shots.length,0);
 assert.equal(near.event?.kind,'melee');
 assert.equal(near.event?.shotId,null);
 assert.ok(near.s.flashes.some(f=>f.type==='sword'));
 const far=battle('guardian',{distance:270,weaponId:'sentinel_sword'});
 assert.equal(far.event,null);
 assert.equal(far.e.hp,far.e.maxHp);
 assert.equal(far.s.shots.length,0);
 const normal=battle('guardian',{distance:75,second:true});
 assert.equal(Number(normal.e.hp<normal.e.maxHp)+Number(normal.e2.hp<normal.e2.maxHp),1);
 const cleave=battle('guardian',{distance:75,weaponId:'moonsteel_blade',weaponEffect:'cleave',second:true});
 assert.ok(cleave.e.hp<cleave.e.maxHp && cleave.e2.hp<cleave.e2.maxHp,'cleave hits both in arc');
 assert.equal(cleave.s.shots.length,0);
});
test('Lyra creates arrows with real velocities and Astra creates spell bolts',()=>{
 const ranger=battle('ranger',{distance:150,weaponId:'oak_bow'});
 assert.equal(ranger.event?.kind,'arrow');
 assert.equal(ranger.s.shots.length,1);
 assert.equal(ranger.s.shots[0].kind,'arrow');
 assert.ok(ranger.s.shots[0].vx>0 && ranger.s.shots[0].life>0);
 const mage=battle('mage',{distance:150,weaponId:'star_wand'});
 assert.equal(mage.event?.kind,undefined,'preserve original mage fire-event API');
 assert.equal(mage.s.shots[0].kind,'spell');
 assert.notEqual(mage.s.shots[0].kind,ranger.s.shots[0].kind);
 const piercing=battle('ranger',{distance:150,weaponId:'thorn_bow',weaponEffect:'pierce'});
 assert.equal(piercing.s.shots[0].pierce,2);
});
test('same seed and commands produce deterministic combat state and attack events by hero',()=>{
 for(const heroId of ['mage','guardian','ranger']){
  const run={heroId,stats:{maxHp:200,fireDelay:12,attack:22},mode:'resource'};
  const a=createGame(3486,run),b=createGame(3486,run);
  a.timers.spawn=b.timers.spawn=999999;
  for(const s of [a,b]){
   const e=spawnEnemy(s,'brute',s.player.x+65,s.player.y);
   e.speed=0;e.hp=e.maxHp=99999;e.shotTimer=999999;
  }
  for(let i=0;i<80;i++){
   const input={x:i%3===0?.1:0,y:i%7===0?.1:0};
   step(a,input);step(b,input);
   if(a.phase!=='running')break;
  }
  assert.deepEqual(a,b);
  assert.deepEqual(getLastPlayerFireEvent(a),getLastPlayerFireEvent(b));
 }
});
