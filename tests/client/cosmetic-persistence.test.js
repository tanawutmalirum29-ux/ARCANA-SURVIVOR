import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {defaultProfile} from '../../src/storage.js';
import {createCampaign, applyCommand} from '../../src/progression/index.js';
import {createCampaignClient} from '../../src/campaignClient.js';

const source=readFileSync(new URL('../../src/main.js',import.meta.url),'utf8');
const begin=source.indexOf('async function handleAction(action,id){');
const end=source.indexOf('\nfunction showPauseFromSettings()',begin);
assert.ok(begin>=0&&end>begin,'test uses production application action handlers');
const actions=source.slice(begin,end);

async function setup({owned=false,failure=null,gate=null}={}){
 const legacy=defaultProfile();legacy.gold=130;if(owned)legacy.owned.push('ember');
 let durable=createCampaign(legacy),visible=durable,writes=0;
 const toasts=[],sounds=[],wardrobes=[];
 const client=createCampaignClient({store:{
  async load(){return {ok:true,code:'LOADED',state:structuredClone(durable)}},
  async dispatch(command,{expectedRevision}){
   writes++;
   if(gate)await gate;
   if(failure)return {ok:false,code:failure,state:structuredClone(durable)};
   assert.equal(expectedRevision,durable.revision);
   const result=applyCommand(durable,command);
   if(result.ok)durable=structuredClone(result.state);
   return result;
  },
 },onChange:next=>{visible=next}});
 await client.load();
 const context={
  commitCommand:async command=>{const result=await client.dispatch(command);if(!result.ok)toasts.push(result.code);return result},
  notify:message=>toasts.push(message),sound:{play:id=>sounds.push(id)},
  showWardrobe:()=>wardrobes.push(structuredClone(visible.profile)),
 };
 runInNewContext(`${actions}\nglobalThis.performAction=handleAction`,context);
 return {run:(action,id)=>context.performAction(action,id),client,
  visible:()=>visible,durable:()=>durable,writes:()=>writes,toasts,sounds,wardrobes};
}

test('unlock and equip become visible only after durable transaction completes',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const h=await setup({gate});
 const pending=h.run('unlock','mage:ember');
 await Promise.resolve();
 assert.equal(h.visible().profile.gold,130);
 assert.equal(h.visible().profile.owned.includes('ember'),false);
 assert.deepEqual(h.sounds,[]);
 release();await pending;
 assert.equal(h.visible().profile.gold,10);
 assert.equal(h.durable().profile.gold,10);
 assert.equal(h.wardrobes.at(-1).gold,10);
 assert.equal(h.durable().progression.wardrobe.mage.owned.includes('mage:ember'),true);
 assert.equal(h.durable().progression.wardrobe.guardian.owned.includes('guardian:ember'),true);
 assert.deepEqual(h.sounds,['unlock']);
 await h.run('equip','mage:ember');
 assert.equal(h.visible().progression.wardrobe.mage.equipped,'mage:ember');
 assert.equal(h.durable().progression.wardrobe.mage.equipped,'mage:ember');
});

test('failed, corrupt and future-save responses cannot grant, spend or present success',async()=>{
 for(const failure of ['WRITE_FAILED','STORAGE_UNAVAILABLE','CORRUPT_SAVE','UNSUPPORTED_SAVE']){
  const h=await setup({failure}),before=structuredClone(h.visible());
  await h.run('unlock','mage:ember');
  assert.deepEqual(h.visible(),before);
  assert.deepEqual(h.durable(),before);
  assert.deepEqual(h.wardrobes.at(-1),before.profile);
  assert.deepEqual(h.sounds,[]);
  assert.deepEqual(h.toasts,[failure]);
 }
});

test('equipping on failed transaction leaves durable and displayed skin unchanged',async()=>{
 const h=await setup({owned:true,failure:'WRITE_FAILED'});
 await h.run('equip','mage:ember');
 assert.equal(h.visible().progression.wardrobe.mage.equipped,'mage:base');
 assert.equal(h.durable().progression.wardrobe.mage.equipped,'mage:base');
 assert.equal(h.wardrobes.at(-1).skin,'apprentice');
 assert.deepEqual(h.sounds,[]);
});

test('rapid duplicate purchase gestures cannot deduct twice',async()=>{
 const h=await setup();
 await Promise.all([h.run('unlock','mage:ember'),h.run('unlock','mage:ember')]);
 assert.equal(h.durable().profile.gold,10);
 assert.equal(h.durable().revision,1);
 assert.equal(h.durable().progression.wardrobe.mage.owned.filter(id=>id==='mage:ember').length,1);
 assert.deepEqual(h.sounds,['unlock']);
});

test('stale-tab conflicts refresh the displayed balance but do not retry a purchase silently',async()=>{
 const original=createCampaign(defaultProfile());
 const updated=structuredClone(original);updated.revision=3;updated.profile.gold=300;
 let dispatches=0;
 const h=createCampaignClient({store:{
  async load(){return {ok:true,state:original}},
  async dispatch(_command,options){dispatches++;assert.equal(options.expectedRevision,0);return {ok:false,code:'STALE_STATE',state:updated}},
 }});
 await h.load();
 const result=await h.dispatch({type:'UNLOCK_COSMETIC',heroId:'mage',cosmeticId:'mage:ember'});
 assert.equal(result.ok,false);assert.equal(dispatches,1);
 assert.equal(h.getState().profile.gold,300);
 assert.equal(h.getState().profile.owned.includes('ember'),false);
});
