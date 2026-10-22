import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEightWayWalk, WALK_DIRECTIONS} from '../../../src/characters/motion/walk8.js';
import {resolveHeroPose} from '../../../src/characters/motion/index.js';
import {renderHeroActor, heroActorSvg} from '../../../src/characters/visual/hero-art.js';

const heroes = ['mage','guardian','ranger'];
const vectors = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const inputs = (heroId,moveVector,tick=7,extra={}) =>
  ({heroId,tick,moving:true,moveVector,aimVector:{x:0,y:-1},
    targetPresent:false,lastAttackTick:null,attackIntervalTicks:30,...extra});

for (const heroId of heroes) {
  test(heroId+': all eight walk directions differ in visible actor pose',()=>{
    const keys = new Set();
    vectors.forEach(([x,y],i)=>{
      const p=resolveHeroPose(inputs(heroId,{x,y}));
      assert.equal(p.travel.direction8,WALK_DIRECTIONS[i]);
      assert.equal(p.facing.direction8,'N','walking does not rewrite independent attack aim');
      assert.equal(p.locomotion,'walk');
      assert.ok(p.travel.bodyScaleX < 0 === (x<0));
      assert.ok(Math.abs(p.joints.leftLeg.x+p.joints.rightLeg.x)<1e-6);
      const svg=heroActorSvg({heroId,pose:p});
      assert.match(svg, /data-actor-part="legLeft"/);
      assert.match(svg, /data-actor-part="legRight"/);
      if(x<0) assert.match(svg, /scale\(-0\./,'westward view must mirror body');
      keys.add(svg);
    });
    assert.equal(keys.size,8,'directionally distinct actor SVGs, not just a compass label');
  });
  test(heroId+': alternating foot plants repeat at fixed ticks',()=>{
    const a=resolveEightWayWalk({heroId,tick:0,moving:true,moveVector:{x:0,y:1}});
    const b=resolveEightWayWalk({heroId,tick:a.period/2,moving:true,moveVector:{x:0,y:1}});
    assert.ok(a.legs.left.y<b.legs.left.y,'left foot lands and recovers');
    assert.ok(b.legs.right.y<a.legs.right.y,'right foot alternates');
    const again=resolveEightWayWalk({heroId,tick:a.period,moving:true,moveVector:{x:0,y:1}});
    assert.deepEqual(again,a);
    const paused=inputs(heroId,{x:-1,y:-1},19);
    assert.deepEqual(resolveHeroPose(paused),resolveHeroPose(structuredClone(paused)));
  });
  test(heroId+': reduced motion is static but still communicates travel heading',()=>{
    const base=inputs(heroId,{x:-1,y:-1},35,{reducedMotion:true});
    const a=resolveHeroPose(base);
    const b=resolveHeroPose({...base,tick:41});
    assert.deepEqual(a.joints,b.joints);
    assert.equal(a.travel.direction8,'NW');
    assert.equal(a.travel.backView,true);
    assert.equal(a.travel.bodyScaleX,b.travel.bodyScaleX);
    assert.ok(!JSON.stringify(a.joints).includes('NaN'));
  });
  test(heroId+': movement direction does not corrupt shot timing or gait phase',()=>{
    const move={x:-1,y:0};
    const walking=resolveHeroPose(inputs(heroId,move,84));
    const fired=resolveHeroPose(inputs(heroId,move,84,{lastAttackTick:84,aimVector:{x:1,y:0}}));
    assert.equal(fired.attackPhase,'release');
    assert.equal(fired.facing.direction8,'E');
    assert.equal(fired.travel.direction8,'W');
    assert.equal(fired.view.direction8,'W','walk+attack cannot flip the entire actor');
    assert.ok(fired.view.bodyScaleX<0 && walking.view.bodyScaleX<0,
      'running west while shooting east must not swap sprite handedness');
    assert.deepEqual(fired.joints.leftLeg,walking.joints.leftLeg);
    assert.deepEqual(fired.joints.rightLeg,walking.joints.rightLeg);
    const noShot=resolveHeroPose(inputs(heroId,move,84,{targetPresent:true}));
    assert.equal(noShot.attackPhase,'none');
  });
}

test('actual shot turns silhouette without reversing the walking direction',()=>{
  for(const heroId of heroes){
    const walk=resolveHeroPose(inputs(heroId,{x:1,y:0},96));
    const shot=resolveHeroPose(inputs(heroId,{x:1,y:0},96,{
      lastAttackTick:96,aimVector:{x:-1,y:-1}}));
    assert.equal(shot.travel.direction8,'E');
    assert.equal(shot.view.direction8,'E');
    assert.ok(shot.view.bodyScaleX>0);
    assert.equal(shot.view.backView,false);
    assert.deepEqual(walk.joints.leftLeg,shot.joints.leftLeg);
    assert.deepEqual(walk.joints.rightLeg,shot.joints.rightLeg);
    const html=heroActorSvg({heroId,pose:shot});
    assert.doesNotMatch(html, /scale\(-0\./);
    assert.ok(html.indexOf('data-actor-part="cape"')<
      html.indexOf('data-actor-part="head"'));
  }
});

test('Canvas signed profile and backward cloak ordering follow SVG',()=>{
  const prior=globalThis.Path2D;
  globalThis.Path2D=class Path2D {constructor(d){this.d=d;}};
  const scales=[], fills=[];
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(x,y){scales.push([x,y]);},
    fill(p){fills.push(p.d);},stroke(){},set lineJoin(v){},set lineCap(v){},
    set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}};
  try {
    for(const heroId of heroes) {
      const west=resolveHeroPose(inputs(heroId,{x:-1,y:0}));
      const north=resolveHeroPose(inputs(heroId,{x:0,y:-1}));
      const front=resolveHeroPose(inputs(heroId,{x:0,y:1}));
      scales.length=0;
      assert.equal(renderHeroActor(ctx,{heroId,pose:west,x:40,y:40,scale:.2}),true);
      assert.ok(scales.some(v=>v[0]<0&&v[1]===1),'Canvas horizontal mirror');
      const n=heroActorSvg({heroId,pose:north});
      const s=heroActorSvg({heroId,pose:front});
      assert.ok(n.indexOf('data-actor-part="cape"')>
        n.indexOf('data-actor-part="head"'),'back-facing cape overlays the face');
      assert.ok(s.indexOf('data-actor-part="cape"')<
        s.indexOf('data-actor-part="head"'),'front-facing cape behind the face');
    }
    assert.ok(fills.length>30);
  } finally {
    if (prior === undefined) delete globalThis.Path2D;
    else globalThis.Path2D=prior;
  }
});

test('near-vertical joystick noise does not flip N and S sprites',()=>{
  for (const heroId of heroes) {
    for (const y of [-1,1]) {
      const samples=[-1e-7,0,1e-7].map(x =>
        resolveHeroPose(inputs(heroId,{x,y},30)));
      assert.equal(new Set(samples.map(p=>p.travel.direction8)).size,1);
      assert.ok(samples.every(p=>p.travel.bodyScaleX>0));
    }
  }
});

test('idle weapons remain upright no matter where the movement joystick or last aim points',()=>{
  for (const heroId of heroes) {
    for (const [x,y] of vectors) {
      const idle=resolveHeroPose({heroId,tick:131,moving:false,moveVector:{x:0,y:0},
        aimVector:{x,y},lastAttackTick:null,targetPresent:false});
      const walk=resolveHeroPose(inputs(heroId,{x,y},131,{aimVector:{x:-x,y:-y}}));
      assert.ok(Math.abs(idle.joints.weapon.rotation)<.08,heroId+' idle weapon rolled away');
      assert.ok(Math.abs(walk.joints.weapon.rotation)<.08,heroId+' walking weapon rolled away');
      assert.equal(walk.attackPhase,'none');
    }
  }
});

test('attack lifecycle preserves walk silhouette despite opposite projectile aim',()=>{
  for(const heroId of heroes) for(const [x,y] of vectors) {
    const opposite={x:-x,y:-y};
    // At the same sample tick test unarmed walk, confirmed release and recover.
    const walk=resolveHeroPose(inputs(heroId,{x,y},120,{aimVector:opposite}));
    const shot=resolveHeroPose(inputs(heroId,{x,y},120,{aimVector:opposite,lastAttackTick:120}));
    const recovering=resolveHeroPose(inputs(heroId,{x,y},120,{aimVector:opposite,lastAttackTick:114}));
    for(const pose of [shot,recovering]){
      assert.equal(pose.travel.direction8,walk.travel.direction8);
      assert.equal(pose.view.direction8,walk.view.direction8);
      assert.equal(Math.sign(pose.view.bodyScaleX),Math.sign(walk.view.bodyScaleX));
      assert.equal(pose.view.backView,walk.view.backView);
      assert.deepEqual(pose.joints.leftLeg,walk.joints.leftLeg);
      assert.deepEqual(pose.joints.rightLeg,walk.joints.rightLeg);
      assert.ok(Math.abs(pose.joints.weapon.rotation)<1.4,'weapon local rotation excessive');
      assert.ok(Math.abs(pose.joints.weapon.x)<80 && Math.abs(pose.joints.weapon.y)<80,
        'weapon displaced from its grip');
    }
    assert.equal(shot.attackPhase,'release');
  }
});

test('weapon arm crosses body toward opposite-side targets without flipping feet',()=>{
  for(const heroId of heroes){
    for(const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){
      const base=inputs(heroId,dir,150,{lastAttackTick:150});
      const facingRight=resolveHeroPose({...base,aimVector:{x:1,y:0}});
      const facingLeft=resolveHeroPose({...base,aimVector:{x:-1,y:0}});
      assert.equal(facingRight.attackPhase,'release');
      assert.equal(facingLeft.attackPhase,'release');
      assert.equal(facingRight.view.direction8,facingLeft.view.direction8);
      assert.deepEqual(facingRight.joints.leftLeg,facingLeft.joints.leftLeg);
      assert.deepEqual(facingRight.joints.rightLeg,facingLeft.joints.rightLeg);
      // Distinct local attack swing arcs, and neither weapon leaves its grip.
      assert.notEqual(facingRight.joints.rightArm.rotation,
        facingLeft.joints.rightArm.rotation,heroId+' arm does not follow shot side');
      assert.ok(Math.abs(facingRight.joints.weapon.rotation)<1.4);
      assert.ok(Math.abs(facingLeft.joints.weapon.rotation)<1.4);
    }
  }
});

test('stationary confirmed attack may face its target and keeps exact shot tick',()=>{
  for (const heroId of heroes) {
    const idle={heroId,tick:75,moving:false,moveVector:{x:0,y:0},
      aimVector:{x:-1,y:0},lastAttackTick:75,targetPresent:true};
    const shot=resolveHeroPose(idle);
    assert.equal(shot.view.direction8,'W');
    assert.ok(shot.view.bodyScaleX<0);
    assert.equal(shot.attackPhase,'release');
    assert.equal(resolveHeroPose({...idle,lastAttackTick:null,targetPresent:false}).attackPhase,'none');
  }
});

test('nonfinite vectors and stationary attacks never synthesize steps or projectiles',()=>{
  const p=resolveHeroPose({heroId:'ranger',tick:50,moving:true,
    moveVector:{x:Infinity,y:NaN},targetPresent:false,lastAttackTick:null});
  assert.equal(p.locomotion,'idle');
  assert.equal(p.attackPhase,'none');
  assert.equal(p.fx.arrowVisible,false);
  assert.equal(p.travel.bodyScaleX,1);
  assert.ok(Object.values(p.joints).every(j=>Object.values(j).every(Number.isFinite)));
});
