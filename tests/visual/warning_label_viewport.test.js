import test from 'node:test';
import assert from 'node:assert/strict';
import { paintBossWarning } from '../../src/visual/warnings.js';

function recorder() {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get(target, name) {
      return name in target ? target[name] : (...args) => calls.push([name, ...args]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  return ctx;
}

function paint(flash, options) {
  const ctx = recorder();
  paintBossWarning(ctx, flash, options);
  const text = ctx.calls.find(([method]) => method === 'fillText');
  return { calls: ctx.calls, text };
}

test('warning labels stay in the viewport on all five layouts including screen-edge bosses', () => {
  const sizes = [[320, 568], [390, 844], [768, 1024], [844, 390], [1440, 900]];
  for (const [width, height] of sizes) {
    const viewport = { x: 410, y: 730, width, height };
    for (const [dx, dy] of [[2, 2], [width - 2, 2], [2, height - 2], [width - 2, height - 2]]) {
      for (const pattern of [0, 1, 2]) {
        const flash = { type: 'warning', x: viewport.x + dx, y: viewport.y + dy, radius: 170, angle: 0.6, pattern };
        const { calls, text } = paint(flash, { viewport, quality: 'low', reducedMotion: true });
        assert.ok(text, `missing label on ${width}x${height}`);
        const [, label, offsetX, offsetY] = text;
        assert.equal(label, ['RING', 'FAN', 'STAR'][pattern]);
        const screenX = flash.x + offsetX - viewport.x;
        const screenY = flash.y + offsetY - viewport.y;
        assert.ok(screenX >= 42 && screenX <= width - 42, `${label} X=${screenX} on ${width}x${height}`);
        assert.ok(screenY >= 20 && screenY <= height - 16, `${label} Y=${screenY} on ${width}x${height}`);
        assert.equal(calls.filter(([method]) => method === 'strokeText').length, 1);
        assert.equal(calls.filter(([method]) => method === 'fillText').length, 1);
      }
    }
  }
});

test('only warning text placement changes; telegraph danger geometry stays identical', () => {
  const flash = {type: 'warning', pattern: 1, angle: 1.2, radius: 180, x: 430, y: 750};
  const baseline = paint(flash, { quality: 'low', reducedMotion: true });
  const clipped = paint(flash, { quality: 'high', reducedMotion: false,
    viewport: {x: 410, y: 730, width: 320, height: 568} });
  const geometry = calls => calls.filter(([method]) => ['translate', 'arc', 'moveTo', 'lineTo'].includes(method));
  assert.deepEqual(geometry(clipped.calls), geometry(baseline.calls));
  assert.notDeepEqual(clipped.text.slice(2), baseline.text.slice(2));
  assert.deepEqual(baseline.text, ['fillText', 'FAN', 0, -188]);
});

test('malformed viewport safely keeps legacy text coordinates', () => {
  const flash = {type:'warning', pattern:2, x:20, y:20, radius:90};
  const expected = ['fillText', 'STAR', 0, -98];
  for (const viewport of [undefined, {x:0,y:0,width:0,height:390},
    {x:0,y:0,width:NaN,height:390}, {x:0,y:0,width:320,height:Infinity}]) {
    const { text } = paint(flash, {viewport, reducedMotion:true});
    assert.deepEqual(text, expected);
  }
});
