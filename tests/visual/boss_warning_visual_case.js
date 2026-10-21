/**
 * Deterministic VISUAL-ONLY boss warning fixtures for independent browser QA.
 * Served from /tests/visual/ by the existing dev server (not part of game build).
 * No gameplay step(), save, entitlement, or changes to src/main.js.
 *
 * In Playwright, after opening the game's http origin:
 *   const { mountBossWarningVisualCase } =
 *     await import('/tests/visual/boss_warning_visual_case.js');
 *   mountBossWarningVisualCase({ pattern: 0, edge: 'top-left' });
 *   // Screenshot #app with the real HUD over an accurately rendered scene.
 */
import { createGame, WORLD } from '../../src/engine.js';
import { drawScene } from '../../src/render.js';

const PATTERNS = Object.freeze([0, 1, 2]);
const EDGES = Object.freeze([
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-right',
]);

export function createBossWarningVisualCase(width, height, pattern = 0, edge = 'top-left') {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 180 || height < 180)
    throw new RangeError('A real browser viewport is required');
  if (!PATTERNS.includes(pattern) || !EDGES.includes(edge))
    throw new RangeError('Unknown boss warning pattern / edge case');

  const game = createGame(73001);
  // Keep camera away from the world boundary so screen-edge warning positions
  // are deterministic and the real renderer camera produces the same offsets.
  game.player.x = WORLD.width / 2;
  game.player.y = WORLD.height / 2;
  const camera = {
    x: Math.max(0, Math.min(WORLD.width - width, game.player.x - width / 2)),
    y: Math.max(0, Math.min(WORLD.height - height, game.player.y - height / 2)),
  };
  const screenX = edge.includes('left') ? 54 : edge.includes('right') ? width - 54 : width / 2;
  const screenY = edge.startsWith('top') ? 58 : height - 58;
  const x = camera.x + screenX, y = camera.y + screenY;
  const angle = Math.atan2(game.player.y - y, game.player.x - x);
  const radius = pattern === 1 ? 200 : 170;
  // Mirror the engine's real warning payload without stepping combat state.
  const warning = {id: 1, type: 'warning', x, y, pattern, angle, ttl: 36, radius};
  game.flashes = [warning];
  game.enemies = [{
    id: 2, type: 'boss', x, y, radius: 48, hp: 520, maxHp: 520,
    speed: 35, flash: 0,
  }];
  return { game, warning, camera, screenX, screenY, width, height, pattern, edge };
}

export function mountBossWarningVisualCase({
  pattern = 0, edge = 'top-left', quality = 'low', reducedMotion = true,
} = {}) {
  if (typeof document === 'undefined') throw new Error('Only available in browser QA');
  const app = document.getElementById('app');
  if (!app) throw new Error('The real #app game container is required');
  const width = app.clientWidth, height = app.clientHeight;
  const fixture = createBossWarningVisualCase(width, height, pattern, edge);
  let canvas = document.getElementById('vfx-warning-qa-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'vfx-warning-qa-canvas';
    canvas.setAttribute('aria-label', 'Deterministic boss warning visual QA');
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      zIndex: '3', pointerEvents: 'none',
    });
    app.appendChild(canvas);
  }
  // The production HUD and boss bar (z-index 5) are deliberately NOT replaced
  // by mocks: screenshot reveals any actual canvas glyph/UI occlusion.
  document.getElementById('overlay')?.classList.add('hidden');
  document.getElementById('hud')?.classList.remove('hidden');
  document.getElementById('boss-hud')?.classList.remove('hidden');
  document.getElementById('joystick')?.classList.add('hidden');
  const context = canvas.getContext('2d', {alpha: false});
  if (!context) throw new Error('Canvas 2D is unavailable');
  const profile = {
    skin: 'apprentice', owned: ['apprentice'],
    settings: {vfx: quality, reduceMotion: reducedMotion},
  };
  // Instrument only this dedicated QA canvas instance to locate the ACTUAL
  // rasterized label (including text metrics and the DPR/current transform).
  // The game canvas and global Canvas prototype remain untouched.
  const observed = [];
  const previousFillText = context.fillText;
  context.fillText = function(text, x, y, ...args) {
    const transform = this.getTransform();
    const metrics = this.measureText(text);
    const ratio = Math.min(globalThis.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1);
    const centerX = (transform.a * x + transform.c * y + transform.e) / ratio;
    const centerY = (transform.b * x + transform.d * y + transform.f) / ratio;
    const ascent = metrics.actualBoundingBoxAscent || 12;
    const descent = metrics.actualBoundingBoxDescent || 2;
    const left = centerX - (metrics.actualBoundingBoxLeft || metrics.width / 2) - 2;
    const right = centerX + (metrics.actualBoundingBoxRight || metrics.width / 2) + 2;
    observed.push({label: String(text), x: centerX, y: centerY,
      left, top: centerY - ascent - 2, right, bottom: centerY + descent + 2});
    return previousFillText.call(this, text, x, y, ...args);
  };
  try {
    drawScene(canvas, context, fixture.game, profile, 0);
  } finally {
    delete context.fillText; // restore Canvas2D prototype method
  }
  const label = ['RING', 'FAN', 'STAR'][pattern];
  const labelBox = observed.find(item => item.label === label) || null;
  const canvasRect = canvas.getBoundingClientRect();
  const uiBoxes = ['.hud-left', '.hud-right', '#boss-hud']
    .map(selector => ({selector, element: document.querySelector(selector)}))
    .filter(item => item.element && !item.element.classList.contains('hidden'))
    .map(({selector, element}) => ({selector, rect: element.getBoundingClientRect()}));
  const occludedBy = labelBox ? uiBoxes.filter(({rect}) =>
    canvasRect.left + labelBox.left < rect.right &&
    canvasRect.left + labelBox.right > rect.left &&
    canvasRect.top + labelBox.top < rect.bottom &&
    canvasRect.top + labelBox.bottom > rect.top
  ).map(({selector}) => selector) : [];
  return {
    pattern, edge, width, height, label, labelBox, occludedBy,
    warningWorld: {x: fixture.warning.x, y: fixture.warning.y},
    camera: fixture.camera,
    canvasId: canvas.id, mode: 'live-renderer-and-real-hud',
  };
}

export function removeBossWarningVisualCase() {
  if (typeof document === 'undefined') return;
  document.getElementById('vfx-warning-qa-canvas')?.remove();
}
