import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeroPose } from '../../../src/characters/motion/index.js';
import { heroActorSvg } from '../../../src/characters/visual/hero-art.js';
import { HERO_RIGS } from '../../../src/characters/visual/rigs.js';

// Actor-space contacts derive from the actual path coordinates in mage rigs.
// Palm (230,153) belongs to armRight pivot (206,166). The staff contact
// (229,153) belongs to weapon pivot (229,174). Root/body mirroring affects
// both points equally, so it cannot create a new grip gap.
function point(partPivot, point, joint) {
  const dx = point.x - partPivot.x;
  const dy = point.y - partPivot.y;
  return {
    x: partPivot.x + joint.x + dx * Math.cos(joint.rotation) - dy * Math.sin(joint.rotation),
    y: partPivot.y + joint.y + dx * Math.sin(joint.rotation) + dy * Math.cos(joint.rotation),
  };
}
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const vectors = Object.freeze([
  ['E',1,0],['SE',1,1],['S',0,1],['SW',-1,1],
  ['W',-1,0],['NW',-1,-1],['N',0,-1],['NE',1,-1],
]);
function assertContacts(pose,label) {
  const {rightArm,weapon,torso,cape,capeTail} = pose.joints;
  const hand = point({x:206,y:166},{x:230,y:153},rightArm);
  const shaft = point({x:229,y:174},{x:229,y:153},weapon);
  assert.ok(dist(hand,shaft)<.001,label+' disconnected palm/staff');
  const shoulder = point({x:160,y:160},{x:160,y:119},torso);
  const collar = point({x:160,y:119},{x:160,y:119},cape);
  assert.ok(dist(shoulder,collar)<.0001,label+' floating cape collar');
  for (const joint of [rightArm,weapon,torso,cape,capeTail]) {
    assert.ok(Object.values(joint).every(Number.isFinite),label+' nonfinite joint');
  }
  assert.ok(Math.abs(capeTail.x-cape.x)<5,label+' hem detached horizontally');
  assert.ok(Math.abs(capeTail.y-cape.y)<2,label+' hem detached vertically');
}

test('Astra preserves palm grip and neck collar across 8 headings, walk ticks and attacks',()=>{
  for(const [direction,x,y] of vectors){
    for(let tick=80;tick<144;tick++){
      const combinations = [
        {lastAttackTick:null,targetPresent:false},
        {lastAttackTick:tick,targetPresent:true},
        {lastAttackTick:tick-4,targetPresent:false},
        {lastAttackTick:null,targetPresent:true,nextAttackTick:tick+6},
      ];
      for(const [phase,combat] of combinations.entries()){
        const input = {
          heroId:'mage',tick,moving:true,moveVector:{x,y},
          aimVector:{x:-x || 0,y:-y || -1},
          attackIntervalTicks:30,...combat,
        };
        const pose = resolveHeroPose(input);
        assert.equal(pose.travel.direction8,direction);
        assertContacts(pose,direction+'/'+tick+'/'+phase);
        assert.deepEqual(resolveHeroPose(input),pose,'non-deterministic fixed tick');
      }
    }
  }
});

test('Astra standalone aim, injury and reduced-motion maintain anchored fabric and grip',()=>{
  for (const [direction,x,y] of vectors) {
    for (const reducedMotion of [false,true]) {
      for (const state of ['idle','windup','charge','release','recover','hurt']) {
        const input={heroId:'mage',tick:100,moving:false,
          aimVector:{x,y},attackIntervalTicks:30,reducedMotion};
        if(state==='windup'){input.targetPresent=true;input.nextAttackTick=111;}
        if(state==='charge'){input.targetPresent=true;input.nextAttackTick=106;}
        if(state==='release'){input.lastAttackTick=100;}
        if(state==='recover'){input.lastAttackTick=96;}
        if(state==='hurt'){input.hurtTicks=8;}
        const pose=resolveHeroPose(input);
        assertContacts(pose,direction+'/'+state+'/'+reducedMotion);
        if(state==='release')assert.equal(pose.attackPhase,'release');
        if(state==='recover')assert.equal(pose.attackPhase,'recover');
        if(state==='windup')assert.equal(pose.attackPhase,'windup');
        if(state==='charge')assert.equal(pose.attackPhase,'charge');
        if(state==='idle' || state==='hurt')assert.equal(pose.attackPhase,'none');
      }
    }
  }
});

test('Astra split cape renders behind hood in back view and the other heroes retain signatures',()=>{
  const back=resolveHeroPose({heroId:'mage',tick:99,moving:true,
    moveVector:{x:0,y:-1},aimVector:{x:1,y:0}});
  const svg=heroActorSvg({heroId:'mage',pose:back});
  const partOrder=[...svg.matchAll(/data-actor-part="([^"]+)"/g)].map(m=>m[1]);
  for(const name of ['capeTail','cape','head','weapon']){
    assert.ok(partOrder.includes(name),'missing Astra '+name);
  }
  assert.ok(partOrder.indexOf('torso')<partOrder.indexOf('cape'));
  assert.ok(partOrder.indexOf('capeTail')<partOrder.indexOf('cape'));
  assert.ok(partOrder.indexOf('cape')<partOrder.indexOf('head'));
  assert.ok(partOrder.indexOf('head')<partOrder.indexOf('weapon'));
  for(const [heroId,signature] of [['guardian','sword-shield'],['ranger','bow']]){
    assert.equal(HERO_RIGS[heroId].signature,signature);
    assert.ok(!HERO_RIGS[heroId].parts.some(p=>p.name==='capeTail'),
      heroId+' was contaminated by Astra-specific geometry');
  }
  assert.ok(!svg.includes('NaN'),'nonfinite SVG');
});
