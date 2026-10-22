import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHeroPose, HERO_MOTION_IDS} from '../../../src/characters/motion/index.js';

const base = (heroId='mage', extra={}) => ({
  heroId, tick: 80, moving: false, moveVector: {x: 0, y: 0},
  aimVector: {x: 0, y: -1}, lastAttackTick: null, attackIntervalTicks: 30,
  hurtTicks: 0, reducedMotion: false, ...extra,
});

for (const id of HERO_MOTION_IDS) {
  test(id+': idle, moving legs and confirmed shot are three separate states', () => {
    const idle = resolveHeroPose(base(id));
    const walk = resolveHeroPose(base(id, {moving:true,moveVector:{x:1,y:0}}));
    const shot = resolveHeroPose(base(id, {moving:true,moveVector:{x:1,y:0},lastAttackTick:80}));
    assert.equal(idle.state, 'idle');
    assert.equal(walk.state, 'walk');
    assert.equal(shot.state, 'attack');
    assert.equal(shot.attackPhase, 'release');
    assert.equal(shot.locomotion, 'walk');
    assert.notDeepEqual(walk.joints.leftLeg, walk.joints.rightLeg);
    assert.deepEqual(shot.joints.leftLeg, walk.joints.leftLeg);
    assert.deepEqual(shot.joints.rightLeg, walk.joints.rightLeg);
  });
  test(id+': confirmed attack finishes into idle without an infinite loop', () => {
    assert.equal(resolveHeroPose(base(id,{tick:80,lastAttackTick:80})).attackPhase,'release');
    assert.equal(resolveHeroPose(base(id,{tick:85,lastAttackTick:80})).attackPhase,'recover');
    assert.equal(resolveHeroPose(base(id,{tick:115,lastAttackTick:80})).state,'idle');
    assert.equal(resolveHeroPose(base(id,{tick:200,lastAttackTick:80,targetPresent:false})).attackPhase,'none');
  });
  test(id+': equal input/tick always gives equal serialized result', () => {
    const input=base(id,{tick:123,moving:true,moveVector:{x:0.3,y:-.7},lastAttackTick:117});
    assert.deepEqual(resolveHeroPose(input),resolveHeroPose(structuredClone(input)));
    assert.equal(JSON.stringify(resolveHeroPose(input)),JSON.stringify(resolveHeroPose(input)));
  });
  test(id+': freeze when simulation tick does not advance', () => {
    const input=base(id,{tick:90,moving:true,moveVector:{x:1,y:1},lastAttackTick:80});
    const freeze=resolveHeroPose(input);
    assert.deepEqual(freeze,resolveHeroPose(input));
    assert.equal(freeze.tick,90);
  });
}

test('three heroes have different locomotion, distinct weapons and attack articulation',()=>{
  const poses = HERO_MOTION_IDS.map(heroId=>resolveHeroPose(base(heroId,{tick:81,moving:true,moveVector:{x:1,y:0},lastAttackTick:80})));
  assert.equal(new Set(poses.map(p=>JSON.stringify(p.joints))).size,3);
  assert.ok(poses[0].fx.staffGlow>0);
  assert.ok(poses[1].fx.bladeArc>=0);
  assert.equal(poses[2].fx.bowDraw,0);
  assert.ok(poses[0].joints.weapon.rotation!==poses[1].joints.weapon.rotation);
});

test('8 directions and continuous aim orientation, no aim safely falls back to move',()=>{
  const seen=new Set();
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    const pose=resolveHeroPose(base('ranger',{aimVector:{x:Math.cos(angle),y:Math.sin(angle)}}));
    seen.add(pose.facing.direction8);
    assert.ok(Math.abs(pose.facing.angle-angle)<1e-4 || (i>4&&Math.abs(pose.facing.angle-(angle-2*Math.PI))<1e-4));
  }
  assert.equal(seen.size,8);
  assert.equal(resolveHeroPose(base('ranger',{moving:true,moveVector:{x:-1,y:0},aimVector:{x:0,y:0}})).facing.direction8,'W');
});

test('no confirmed shot means no projectile/release despite elapsed time and low fireDelay',()=>{
  const p=resolveHeroPose(base('ranger',{lastAttackTick:null,targetPresent:true,attackIntervalTicks:4}));
  assert.equal(p.attackPhase,'none');
  assert.equal(p.fx.arrowVisible,false);
  assert.equal(resolveHeroPose(base('mage',{lastAttackTick:90,tick:80})).attackPhase,'none');
});

test('verified target and cooldown may anticipate; never synthesize a release',()=>{
  const windup=resolveHeroPose(base('ranger',{tick:99,lastAttackTick:80,attackIntervalTicks:30,targetPresent:true}));
  const charged=resolveHeroPose(base('ranger',{tick:108,lastAttackTick:80,attackIntervalTicks:30,targetPresent:true}));
  assert.equal(windup.attackPhase,'windup');
  assert.equal(charged.attackPhase,'charge');
  assert.ok(charged.fx.bowDraw > windup.fx.bowDraw);
  assert.equal(resolveHeroPose(base('ranger',{tick:108,lastAttackTick:80,attackIntervalTicks:30,targetPresent:false})).attackPhase,'none');
  assert.equal(resolveHeroPose(base('ranger',{tick:110,lastAttackTick:80,attackIntervalTicks:30,targetPresent:true})).attackPhase,'none');
});

test('optional nextAttackTick supports first-shot windup only with actual target',()=>{
  const p=resolveHeroPose(base('mage',{tick:9,lastAttackTick:null,targetPresent:true,nextAttackTick:14}));
  assert.ok(['windup','charge'].includes(p.attackPhase));
  assert.equal(resolveHeroPose(base('mage',{tick:14,lastAttackTick:null,targetPresent:true,nextAttackTick:14})).attackPhase,'none');
});

test('cadence scales timeline and recovery remains bounded even when faster',()=>{
  const fast=resolveHeroPose(base('guardian',{tick:102,lastAttackTick:100,attackIntervalTicks:7,targetPresent:true}));
  const slow=resolveHeroPose(base('guardian',{tick:102,lastAttackTick:100,attackIntervalTicks:90,targetPresent:true}));
  assert.ok(['recover','windup','charge','none'].includes(fast.attackPhase));
  assert.ok(['release','recover','none'].includes(slow.attackPhase));
  assert.equal(fast.fireIntervalTicks,7);
  assert.equal(slow.fireIntervalTicks,90);
});

test('reduced motion disables cyclic motion but preserves attacks and facing',()=>{
  const mk=tick=>resolveHeroPose(base('guardian',{tick,moving:true,moveVector:{x:1,y:0},lastAttackTick:80,reducedMotion:true}));
  assert.deepEqual(mk(100).joints,mk(103).joints);
  assert.equal(mk(80).attackPhase,'release');
  assert.equal(mk(80).locomotion,'walk');
  assert.equal(mk(80).facing.direction8,'N');
});

test('invalid or nonfinite data yields safe finite fallbacks without throwing',()=>{
  const p=resolveHeroPose({heroId:'bad',tick:NaN,moving:true,moveVector:{x:Infinity,y:NaN},aimVector:{x:NaN,y:-Infinity},attackIntervalTicks:0,hurtTicks:-3});
  assert.equal(p.heroId,'mage');
  assert.equal(p.state,'idle');
  assert.equal(p.tick,0);
  assert.equal(p.facing.direction8,'N');
  assert.ok(Object.values(p.joints).every(j=>Object.values(j).every(Number.isFinite)));
});

test('samples for frame strips are repeatable without network or a browser',()=>{
  for(const heroId of HERO_MOTION_IDS){
    const poses=[80,87,93,98,105,110,120].map(tick=>resolveHeroPose(base(heroId,{tick,lastAttackTick:80,attackIntervalTicks:30,targetPresent:true,moving:true,moveVector:{x:0,y:1},aimVector:{x:1,y:1}})));
    assert.equal(poses[0].attackPhase,'release');
    assert.equal(poses.at(-1).state,'walk');
    assert.ok(poses.every(p=>['E','SE','S','SW','W','NW','N','NE'].includes(p.facing.direction8)));
  }
});
