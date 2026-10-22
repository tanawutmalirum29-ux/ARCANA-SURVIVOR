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
    assert.deepEqual(fired.joints.leftLeg,walking.joints.leftLeg);
    assert.deepEqual(fired.joints.rightLeg,walking.joints.rightLeg);
    const noShot=resolveHeroPose(inputs(heroId,move,84,{targetPresent:true}));
    assert.equal(noShot.attackPhase,'none');
  });
}

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

test('nonfinite vectors and stationary attacks never synthesize steps or projectiles',()=>{
  const p=resolveHeroPose({heroId:'ranger',tick:50,moving:true,
    moveVector:{x:Infinity,y:NaN},targetPresent:false,lastAttackTick:null});
  assert.equal(p.locomotion,'idle');
  assert.equal(p.attackPhase,'none');
  assert.equal(p.fx.arrowVisible,false);
  assert.equal(p.travel.bodyScaleX,1);
  assert.ok(Object.values(p.joints).every(j=>Object.values(j).every(Number.isFinite)));
});
