import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

// Exercise the real browser input-handler source against an isolated event-target
// harness; no simulation/engine imports, timeouts or synthetic success results.
const start = main.indexOf("const joystick=$('joystick'),knob=$('knob');");
const end = main.indexOf('function frame(ts){', start);
assert.ok(start !== -1 && end > start, 'input-handler source range must exist');
const handlers = main.slice(start, end);

function eventTarget() {
 const listeners = new Map();
 return {
  addEventListener(name, fn) {
   if (!listeners.has(name)) listeners.set(name, []);
   listeners.get(name).push(fn);
  },
  emit(name, event) {
   for (const fn of listeners.get(name) || []) fn(event);
  },
 };
}
function harness({rejectCapture = false} = {}) {
 const canvas = eventTarget(), window = eventTarget();
 const joystick = {style: {}, classList: {
  active: false, add() {this.active = true}, remove() {this.active = false}
 }, getBoundingClientRect: () => ({width: 88})};
 const knob = {style: {}};
 const touch = {x: 0, y: 0, active: false, pointerId: null, originX: 0, originY: 0};
 canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 390, height: 844});
 canvas.setPointerCapture = id => {
  if (rejectCapture) throw new Error('pointer capture unsupported');
  canvas.captured = id;
 };
 const context = {canvas, window, touch, heldKeys: new Set(), screen: 'play',
  $: id => ({joystick, knob})[id]};
 runInNewContext(handlers, context);
 function pointer(id, x = 140, y = 240) {
  return {pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
   preventDefault() {this.prevented = true}};
 }
 return {canvas, window, joystick, knob, touch, context, pointer};
}

test('mobile drag works anywhere with captured pointer and safely releases', () => {
 const h = harness();
 h.canvas.emit('pointerdown', h.pointer(8, 330, 570));
 assert.equal(h.canvas.captured, 8);
 assert.equal(h.touch.active, true);
 assert.equal(h.touch.x, 0);
 assert.equal(h.joystick.style.left, '330px');
 h.canvas.emit('pointermove', h.pointer(8, 370, 570));
 assert.ok(h.touch.x > 0.9);
 h.canvas.emit('pointerup', h.pointer(8, 370, 570));
 assert.equal(h.touch.active, false);
 assert.equal(h.touch.pointerId, null);
 assert.equal(h.touch.x, 0);
 assert.equal(h.knob.style.transform, 'translate(0px,0px)');
});

test('rejected pointer capture never traps joystick after an outside release', () => {
 const h = harness({rejectCapture: true});
 h.canvas.emit('pointerdown', h.pointer(3, 45, 120));
 assert.equal(h.touch.active, true, 'fallback must still allow dragging');
 h.window.emit('pointermove', h.pointer(99, 200, 120));
 assert.equal(h.touch.x, 0, 'other fingers may not steal control');
 h.window.emit('pointermove', h.pointer(3, 85, 120));
 assert.ok(h.touch.x > 0.9, 'outside-canvas move must be processed');
 h.window.emit('pointerup', h.pointer(99, 200, 120));
 assert.equal(h.touch.active, true, 'unrelated release ignored');
 h.window.emit('pointerup', h.pointer(3, 85, 120));
 assert.equal(h.touch.active, false);
 assert.equal(h.joystick.classList.active, false);
 h.canvas.emit('pointerdown', h.pointer(4, 250, 300));
 assert.equal(h.touch.pointerId, 4, 'next drag must be accepted');
 h.window.emit('pointercancel', h.pointer(4));
 assert.equal(h.touch.active, false);
});

test('input cannot begin when paused and game HUD sits above joystick decoration', () => {
 const h = harness();
 h.context.screen = 'pause';
 h.canvas.emit('pointerdown', h.pointer(1));
 assert.equal(h.touch.active, false);
 const hud = styles.match(/\.hud\{[^}]*z-index:(\d+)/);
 const joystick = styles.match(/\.joystick\{[^}]*z-index:(\d+)/);
 assert.ok(hud && joystick, 'HUD and joystick stacking rules must exist');
 assert.ok(Number(hud[1]) > Number(joystick[1]), 'joystick may not obscure pause button');
 assert.match(styles, /\.hud-button\{pointer-events:auto/);
 assert.match(styles, /#scene\{[^}]*touch-action:none/);
 assert.match(styles, /body\{[^}]*-webkit-user-select:none;user-select:none/);
});
