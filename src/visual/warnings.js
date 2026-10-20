/**
 * Boss warning geometry mirrors src/engine.js queueBossAttack/fireBossAttack.
 * Visual-only: fixed outlines are drawn at full strength on every quality tier.
 */
const TAU = Math.PI * 2;
const OUTLINE = '#ffd18d';
const DANGER = '#ff9299';

export function warningGeometry(flash) {
  const x = Number.isFinite(flash?.x) ? flash.x : 0;
  const y = Number.isFinite(flash?.y) ? flash.y : 0;
  const radius = Math.max(12, Number.isFinite(flash?.radius) ? flash.radius : 170);
  const pattern = [0, 1, 2].includes(flash?.pattern) ? flash.pattern : -1;
  const angle = Number.isFinite(flash?.angle) ? flash.angle : 0;
  if (pattern === 0) {
    // 12 projectiles fan around 360 degrees; rotation only changes where
    // individual bullets start, never the coverage.
    return { x, y, radius, pattern, label: 'RING', angles: Array.from({length: 12}, (_, i) => i / 12 * TAU) };
  }
  if (pattern === 1) {
    // Exact angles in engine.js: n = -2..2; a = aimAngle + n * .18.
    return { x, y, radius, pattern, label: 'FAN', angles: Array.from({length: 5}, (_, i) => angle + (i - 2) * .18) };
  }
  if (pattern === 2) {
    // Exact diagonal-star firing directions in engine.js.
    return { x, y, radius, pattern, label: 'STAR', angles: Array.from({length: 8}, (_, i) => Math.PI / 4 + i / 8 * TAU) };
  }
  // Compatibility for older saves/flashes that lack pattern metadata.
  return { x, y, radius, pattern, label: 'DANGER', angles: [] };
}

export function paintBossWarning(ctx, flash, options = {}) {
  const shape = warningGeometry(flash);
  const reducedMotion = options.reducedMotion === true;
  ctx.save();
  try {
    ctx.translate(shape.x, shape.y);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 3.5;
    ctx.beginPath();

    if (shape.pattern === 1) {
      // Only the aimed wedge is dangerous; never draw a full ring for fan.
      const first = shape.angles[0], last = shape.angles[shape.angles.length - 1];
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, shape.radius, first, last);
      ctx.lineTo(0, 0);
      ctx.stroke();
    } else {
      ctx.arc(0, 0, shape.radius, 0, TAU);
      ctx.stroke();
    }

    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const a of shape.angles) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
      ctx.lineTo(Math.cos(a) * shape.radius, Math.sin(a) * shape.radius);
      ctx.stroke();
    }
    // Additional wide-spaced landmarks make STAR distinguishable from RING
    // on tiny/mobile screens even in monochrome or LOW graphics.
    if (shape.pattern === 2) {
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 3;
      for (let n = 0; n < 4; n++) {
        const a = Math.PI / 4 + n * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 54, Math.sin(a) * 54);
        ctx.lineTo(Math.cos(a) * (shape.radius - 5), Math.sin(a) * (shape.radius - 5));
        ctx.stroke();
      }
    }
    // This intentionally does not animate or pulse: motion/flash-safe,
    // and warning geometry is readable before every attack at LOW quality.
    ctx.fillStyle = '#fff1d0';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(shape.label, 0, -shape.radius - 8);
  } finally {
    ctx.restore();
  }
  return { pattern: shape.pattern, rays: shape.angles.length, static: true, reducedMotion };
}
