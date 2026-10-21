import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_WARNING_TICKS, createGame, step } from '../../src/engine.js';
import { warningGeometry, paintBossWarning } from '../../src/visual/warnings.js';

const TAU = Math.PI * 2;
function recorder() {
  const trace = [];
  return new Proxy({ trace }, {
    get(obj, key) { return key in obj ? obj[key] : (...args) => trace.push([key, ...args]); },
    set(obj, key, value) { obj[key] = value; return true; },
  });
}

test('warning geometry matches engine bullet arcs: ring=12, fan=5, star=8', () => {
  const basic = { type: 'warning', x: 450, y: 280, radius: 180, angle: 1.2, ttl: BOSS_WARNING_TICKS };
  const ring = warningGeometry({ ...basic, pattern: 0 });
  const fan = warningGeometry({ ...basic, pattern: 1 });
  const star = warningGeometry({ ...basic, pattern: 2 });
  assert.equal(ring.label, 'RING');
  assert.equal(fan.label, 'FAN');
  assert.equal(star.label, 'STAR');
  assert.equal(ring.angles.length, 12);
  assert.equal(fan.angles.length, 5);
  assert.equal(star.angles.length, 8);
  assert.ok(Math.abs(ring.angles[11] - 11 / 12 * TAU) < 1e-10);
  assert.ok(Math.abs(fan.angles[0] - (basic.angle - 0.36)) < 1e-10);
  assert.ok(Math.abs(fan.angles[4] - (basic.angle + 0.36)) < 1e-10);
  assert.ok(Math.abs(star.angles[0] - Math.PI / 4) < 1e-10);
});

test('static warning outlines preserve full pattern even LOW and reduced motion', () => {
  const base = { type: 'warning', x: 15, y: 15, radius: 170, angle: -0.5, ttl: 14 };
  for (const pattern of [0, 1, 2]) {
    let previous;
    for (const quality of ['low', 'medium', 'high']) {
      for (const reducedMotion of [false, true]) {
        const ctx = recorder();
        const result = paintBossWarning(ctx, { ...base, pattern }, {quality, reducedMotion});
        assert.equal(result.rays, [12, 5, 8][pattern]);
        assert.equal(result.static, true);
        assert.equal(ctx.trace.filter(item => item[0] === 'fillText').length, 1);
        assert.equal(ctx.trace.filter(item => item[0] === 'lineTo').length >= result.rays, true);
        const snapshot = JSON.stringify(ctx.trace);
        if (previous) assert.equal(snapshot, previous);
        previous = snapshot;
      }
    }
  }
});

test('fan aim draws wedge rather than misleading 360-degree danger circle', () => {
  const ctx = recorder();
  paintBossWarning(ctx, {type:'warning', pattern: 1, angle: 0.9, radius: 200, x: 0, y: 0});
  const arcs = ctx.trace.filter(call => call[0] === 'arc');
  assert.equal(arcs.length, 1);
  assert.ok(arcs[0][5] - arcs[0][4] < TAU / 3);
});

test('older no-pattern warning uses safe generic outline', () => {
  const shape = warningGeometry({ type: 'warning', x: 0, y: 0, radius: 80 });
  assert.equal(shape.pattern, -1);
  assert.equal(shape.angles.length, 0);
  const ctx = recorder();
  assert.doesNotThrow(() => paintBossWarning(ctx, {type:'warning', x: 0, y: 0, radius: 80}, {quality: 'low', reducedMotion: true}));
});

test('boss mechanics retain deterministic state without rendering VFX', () => {
  const a = createGame(73001);
  const b = createGame(73001);
  // Gameplay moves purely through engine.step; cosmetic selection is never an input.
  for (let i = 0; i < 90; i++) {
    step(a, {x: 0.2, y: 0.6});
    step(b, {x: 0.2, y: 0.6});
  }
  assert.deepEqual(a, b);
});

test('chapter-specific danger uses the exact queued projectile directions at every quality',()=>{
 const cases=[
  {pattern:0,angles:Array.from({length:10},(_,i)=>i/10*TAU+1.4)},
  {pattern:1,angles:Array.from({length:7},(_,i)=>.8+(i-3)*.18)},
  {pattern:2,angles:Array.from({length:12},(_,i)=>Math.PI/4+i/12*TAU)},
 ];
 for(const flash of cases){
  const geometry=warningGeometry({...flash,x:50,y:60,radius:200});
  assert.deepEqual(geometry.angles,flash.angles);
  assert.notEqual(geometry.angles,flash.angles,'renderer must not mutate combat directions');
  for(const quality of ['low','medium','high']){
   const ctx=recorder();
   assert.equal(paintBossWarning(ctx,flash,{quality,reducedMotion:true}).rays,flash.angles.length);
   if(flash.pattern===1){
    const arc=ctx.trace.find(call=>call[0]==='arc');
    assert.equal(arc[4],flash.angles[0]);
    assert.equal(arc[5],flash.angles.at(-1));
   }
  }
 }
});
