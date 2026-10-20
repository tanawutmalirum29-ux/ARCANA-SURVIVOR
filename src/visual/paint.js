import { visualBudget } from './presentation.js';

const TAU = Math.PI * 2;
function circle(ctx, x, y, r, stroke, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke();
}
function crystal(ctx, x, y, size, fill) {
  ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .65, y);
  ctx.lineTo(x, y + size); ctx.lineTo(x - size * .65, y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
function blend(ctx, x, y, r, color, opacity) {
  if (opacity <= 0) return;
  ctx.save(); ctx.globalAlpha = opacity;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function paintSkinPreview(ctx, skin, options = {}) {
  const width = Math.max(1, Number(options.width) || 340);
  const height = Math.max(1, Number(options.height) || 300);
  const budget = visualBudget(options.quality ?? 'medium', options.reducedMotion);
  const time = Number.isFinite(options.time) && !budget.reducedMotion ? options.time : 0;
  const x = width / 2, y = height * .55, scale = Math.min(width / 310, height / 310, 1.45);
  ctx.save();
  try {
    ctx.clearRect(0, 0, width, height);
    const ground = ctx.createLinearGradient(0, 0, width, height);
    ground.addColorStop(0, '#090f28'); ground.addColorStop(.55, '#191633');
    ground.addColorStop(1, '#090d1f');
    ctx.fillStyle = ground; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);

    blend(ctx, 0, 5, 133, skin.glow, .2 * budget.glow);
    circle(ctx, 0, 0, 116, skin.glow, 1.5);
    circle(ctx, 0, 0, 101, 'rgba(232,201,154,.6)', 1);
    circle(ctx, 0, 0, 88, 'rgba(165,157,218,.45)', 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + time * .13;
      const sx = Math.cos(a) * 109, sy = Math.sin(a) * 109;
      crystal(ctx, sx, sy, i % 3 ? 3 : 5, i % 3 ? skin.glow : '#f4dea9');
    }

    // Spell orbit and weapon trails are purely decorative, never used as hitboxes.
    const orbit = time * 1.45;
    for (let i = 0; i < budget.trails; i++) {
      const a = orbit + i * TAU / Math.max(1, budget.trails);
      const sx = Math.cos(a) * 87, sy = Math.sin(a) * 51 - 4;
      blend(ctx, sx, sy, 17, skin.projectile, .38 * budget.glow);
      circle(ctx, sx, sy, 5, skin.projectile, 2);
      crystal(ctx, sx, sy, 5, skin.color);
    }
    for (let i = 0; i < budget.particles; i++) {
      const a = (i * 2.399963 + time * .38) % TAU;
      const r = 51 + (i * 37 % 56), sx = Math.cos(a) * r, sy = Math.sin(a) * r * .75;
      ctx.globalAlpha = .25 + ((i % 5) * .1);
      crystal(ctx, sx, sy, i % 4 === 0 ? 3 : 1.8, skin.projectile);
    }
    ctx.globalAlpha = 1;

    const bob = budget.reducedMotion ? 0 : Math.sin(time * 2.7) * 3;
    ctx.save(); ctx.translate(0, bob);
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(0, 81, 53, 11, 0, 0, TAU); ctx.fill();
    blend(ctx, 0, -5, 63, skin.glow, .2 * budget.glow);
    // Crown, cloak, sleeves and wand form a distinct large silhouette.
    ctx.beginPath(); ctx.moveTo(-18, -55); ctx.lineTo(-45, 77); ctx.lineTo(-7, 50);
    ctx.lineTo(7, 50); ctx.lineTo(45, 77); ctx.lineTo(18, -55); ctx.closePath();
    ctx.fillStyle = skin.glow; ctx.fill();
    ctx.strokeStyle = '#e9d9bb'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-17, -38); ctx.lineTo(-27, 49);
    ctx.quadraticCurveTo(0, 73, 27, 49); ctx.lineTo(17, -38); ctx.closePath();
    ctx.fillStyle = skin.color; ctx.fill();
    ctx.fillStyle = '#222543'; ctx.beginPath(); ctx.ellipse(0, -48, 23, 29, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = skin.color; ctx.beginPath(); ctx.ellipse(0, -51, 17, 20, 0, 0, TAU); ctx.fill();
    crystal(ctx, 0, -74, 22, skin.glow);
    crystal(ctx, 0, -74, 10, '#fff1c8');
    ctx.strokeStyle = '#f3e1c0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(26, 3); ctx.lineTo(58, -49); ctx.stroke();
    crystal(ctx, 63, -55, 15, skin.projectile);
    blend(ctx, 63, -55, 27, skin.glow, .7 * budget.glow);
    ctx.restore();

    // Non-flashing static ability seal remains visible even at Low/reduced motion.
    circle(ctx, 67, -61, 21, skin.projectile, 2);
    crystal(ctx, 67, -61, 8, skin.projectile);
    ctx.restore();
    ctx.fillStyle = 'rgba(226,210,255,.68)';
    ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('COSMETIC VISUALIZATION · NO GAMEPLAY BONUS', x, height - 13);
  } finally {
    ctx.restore();
  }
}
