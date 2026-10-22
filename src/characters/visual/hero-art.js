// Pure actor renderer. Both SVG lobby and Canvas map use the same lobby-derived rig.
// Does not access DOM, storage, simulation, gameplay weaponId or entitlements.
import { HERO_RIGS, HERO_IDS } from './rigs.js';
export { HERO_IDS };
export const HERO_ART_VIEWBOX = Object.freeze({ width: 320, height: 350, anchorX: 160, anchorY: 185 });
export const HERO_ART_PARTS = Object.freeze(['cape', 'legLeft', 'legRight', 'torso',
  'weapon', 'armLeft', 'offhand', 'armRight', 'head', 'arrow']);
const paths = new Map(); // Compile each Path2D only once.
const palettes = new Map();
const COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const color = n => typeof n === 'string' && COLOR.test(n) ? n : null;
const number = n => String(Number(n.toFixed(3)));

export function getCanonicalHeroArt(heroId = 'mage') {
  return HERO_RIGS[heroId] || HERO_RIGS.mage;
}
// Skin is presentation-only. Gameplay weaponId is NOT a visual weapon class:
// each hero permanently retains a recognisable signature staff, sword+shield or bow.
export function resolveHeroPalette(heroId = 'mage', skin = null, weaponStyle = null) {
  const rig = getCanonicalHeroArt(heroId);
  const s = skin && typeof skin === 'object' ? skin : {};
  const w = weaponStyle && typeof weaponStyle === 'object' ? weaponStyle : {};
  const primary = color(s.primary) || color(s.color) || rig.palette.primary;
  const glow = color(s.glow) || color(s.projectile) || primary;
  const shadow = color(s.shadow) || rig.palette.shadow;
  const trim = color(s.trim) || rig.palette.trim;
  const metal = color(w.metal) || color(s.metal) || rig.palette.metal;
  const leather = color(w.leather) || rig.palette.leather;
  const key = [rig.id,primary,glow,shadow,trim,metal,leather].join('|');
  if (palettes.has(key)) return palettes.get(key);
  const palette = Object.freeze({ ...rig.palette, primary, glow, shadow, trim, metal,
    leather, weaponGlow: color(w.glow) || glow });
  if (palettes.size >= 64) palettes.clear();
  palettes.set(key, palette);
  return palette;
}
// ENGINEER-MOTION owns timelines. rotation in radians, dx/dy/bob in source pixels.
function poseFor(pose, name) {
  const v = pose?.parts?.[name] ?? pose?.[name];
  return { rotation: clamp(finite(v?.rotation),-Math.PI,Math.PI),
    dx: clamp(finite(v?.dx),-80,80), dy: clamp(finite(v?.dy),-80,80) };
}
const bobFor = pose => clamp(finite(pose?.bob),-30,30);
const swatch = (name,palette) => palette[name] || 'none';
function svgPart(part,palette,pose) {
  const { rotation,dx,dy } = poseFor(pose,part.name);
  const { x,y } = part.pivot;
  const transform = (rotation || dx || dy) ?
    ' transform="translate('+number(x+dx)+' '+number(y+dy)+') rotate('+
    number(rotation*180/Math.PI)+') translate('+(-x)+' '+(-y)+')"' : '';
  return '<g data-actor-part="'+part.name+'"'+transform+'>'+
    part.layers.map(layer => '<path d="'+layer.d+'" fill="'+swatch(layer.fill,palette)+
      '" stroke="'+swatch(layer.stroke,palette)+'" stroke-width="'+layer.width+
      '" stroke-linecap="round" stroke-linejoin="round"/>').join('')+'</g>';
}
// Actor-only SVG: NO stage, rune, orbit or aura. Same layers as Canvas.
// Output uses only static path data, finite numbers and validated hex colors.
export function heroActorSvg({heroId='mage',skin=null,pose=null,weaponStyle=null}={}) {
  const rig = getCanonicalHeroArt(heroId);
  const palette = resolveHeroPalette(rig.id,skin,weaponStyle);
  const bob = bobFor(pose);
  return '<svg class="lb-hero-art canonical-hero-art" data-hero="'+rig.id+
    '" data-signature="'+rig.signature+
    '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 350" role="img" aria-label="'+
    rig.name+' hero"><g class="canonical-hero-actor"'+
    (bob ? ' transform="translate(0 '+number(bob)+')"' : '')+'>'+
    rig.parts.map(part => svgPart(part,palette,pose)).join('')+'</g></svg>';
}
export const renderHeroActorSvg = heroActorSvg;
// Render (x,y) at actor center, in CSS pixels; scale=.17 gives a compact map hero.
// Geometry is Path2D-cached, no reparsing SVG or allocating DOM on each frame.
// Returns false if Path2D is unavailable: client may use the SVG fallback.
export function renderHeroActor(ctx,{heroId='mage',skin=null,pose=null,
    weaponStyle=null,x=0,y=0,scale=.17}={}) {
  if (!ctx || typeof ctx.save !== 'function' || typeof Path2D !== 'function') return false;
  const rig = getCanonicalHeroArt(heroId);
  const palette = resolveHeroPalette(rig.id,skin,weaponStyle);
  const factor = clamp(finite(scale,.17),.01,8);
  ctx.save();
  try {
    ctx.translate(finite(x),finite(y));
    ctx.scale(factor,factor);
    ctx.translate(-HERO_ART_VIEWBOX.anchorX,-HERO_ART_VIEWBOX.anchorY+bobFor(pose));
    for (const part of rig.parts) {
      const {x:px,y:py} = part.pivot;
      const {rotation,dx,dy} = poseFor(pose,part.name);
      ctx.save();
      try {
        if (rotation || dx || dy) {
          ctx.translate(px+dx,py+dy);
          ctx.rotate(rotation);
          ctx.translate(-px,-py);
        }
        ctx.lineJoin='round';
        ctx.lineCap='round';
        for (const layer of part.layers) {
          let path=paths.get(layer.d);
          if (!path) {path=new Path2D(layer.d);paths.set(layer.d,path);}
          const fill=swatch(layer.fill,palette);
          const stroke=swatch(layer.stroke,palette);
          if (fill!=='none') {ctx.fillStyle=fill;ctx.fill(path);}
          if (stroke!=='none') {
            ctx.strokeStyle=stroke;
            ctx.lineWidth=factor<=.2?Math.max(layer.width,2.3):layer.width;
            ctx.stroke(path);
          }
        }
      } finally {ctx.restore();}
    }
  } finally {ctx.restore();}
  return true;
}
