// Pure actor renderer. Both SVG lobby and Canvas map use the same lobby-derived rig.
// Does not access DOM, storage, simulation, gameplay weaponId or entitlements.
import { HERO_RIGS, HERO_IDS, ASTRA_REAR_HOOD } from './rigs.js';
export { HERO_IDS };
export const HERO_ART_VIEWBOX = Object.freeze({ width: 320, height: 350, anchorX: 160, anchorY: 185 });
export const HERO_ART_PARTS = Object.freeze(['capeTail', 'cape', 'legLeft', 'legRight', 'torso',
  'weapon', 'armLeft', 'offhand', 'armRight', 'head', 'arrow', 'robe']);
const paths = new Map(); // Compile each Path2D only once.
const palettes = new Map();
const backOrders = new Map(); // Fixed hero part order; calculated once, not each frame.
const COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const color = n => typeof n === 'string' && COLOR.test(n) ? n : null;
const number = n => String(Number(n.toFixed(3)));

export function getCanonicalHeroArt(heroId = 'mage') {
  return Object.hasOwn(HERO_RIGS, heroId) ? HERO_RIGS[heroId] : HERO_RIGS.mage;
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
  const weaponGlow = color(w.glow) || glow;
  const key = [rig.id,primary,glow,shadow,trim,metal,leather,weaponGlow].join('|');
  if (palettes.has(key)) return palettes.get(key);
  const palette = Object.freeze({ ...rig.palette, primary, glow, shadow, trim, metal,
    leather, weaponGlow });
  if (palettes.size >= 64) palettes.clear();
  palettes.set(key, palette);
  return palette;
}
// ENGINEER-MOTION #69 uses pose.joints with x/y/rotation in local actor units.
// Keep the original named-part dx/dy input too for preview/static client callers.
const MOTION_JOINTS = Object.freeze({
  legLeft: 'leftLeg', legRight: 'rightLeg',
  armLeft: 'leftArm', armRight: 'rightArm', offhand: 'shield', arrow: 'weapon',
});
function poseFor(pose, name) {
  const joint = MOTION_JOINTS[name] || name;
  const v = pose?.parts?.[name] ?? pose?.[name] ?? pose?.joints?.[joint];
  const bowDraw = name === 'arrow' ? clamp(finite(pose?.fx?.bowDraw),0,1) : 0;
  return { rotation: clamp(finite(v?.rotation),-Math.PI,Math.PI),
    dx: clamp(finite(v?.dx ?? v?.x),-80,80)-bowDraw*13,
    dy: clamp(finite(v?.dy ?? v?.y),-80,80) };
}
function rootFor(pose) {
  const v = pose?.joints?.root ?? pose?.root;
  return { rotation: clamp(finite(v?.rotation),-Math.PI,Math.PI),
    dx: clamp(finite(v?.dx ?? v?.x),-80,80),
    dy: clamp(finite(v?.dy ?? v?.y),-80,80) };
}
const arrowVisible = pose => !pose?.fx || pose.fx.arrowVisible !== false;
const bobFor = pose => clamp(finite(pose?.bob),-30,30);
const swatch = (name,palette) => palette[name] || 'none';
// Directional silhouette is shared by SVG and Canvas. No mutation to the rig.
// North-facing cloak sits in front of the torso; equipment remains visible.
function partsFor(rig,pose) {
  if (!(pose?.view?.backView ?? pose?.travel?.backView)) return rig.parts;
  if (rig.id === 'mage') {
    // Keep shoulder yoke aligned to the torso, but NEVER display the
    // front-facing eyes/mask when Astra runs N/NW/NE. The closed rear hood
    // shares the head joint and pivot and occludes any staff crossing behind
    // the skull. Draw the staff before the support arm/gripping hand.
    const order = ['legLeft','legRight','robe','torso','capeTail','cape',
      'weapon','armLeft','armRight','head'];
    return order.map(name=>name==='head'
      ? ASTRA_REAR_HOOD : rig.parts.find(part=>part.name===name)).filter(Boolean);
  }
  if (backOrders.has(rig.id)) return backOrders.get(rig.id);
  const accessory = new Set(['weapon','offhand','arrow']);
  const ordered = Object.freeze([
    ...rig.parts.filter(p=>p.name!=='cape'&&!accessory.has(p.name)),
    ...rig.parts.filter(p=>p.name==='cape'),
    ...rig.parts.filter(p=>accessory.has(p.name)),
  ]);
  backOrders.set(rig.id,ordered);
  return ordered;
}
function bodyScale(pose) {
  const s=finite(pose?.view?.bodyScaleX ?? pose?.travel?.bodyScaleX,1);
  return s===0 ? 1 : Math.sign(s)*clamp(Math.abs(s),.65,1);
}
function svgPart(part,palette,pose) {
  if (part.name === 'arrow' && !arrowVisible(pose)) return '<g data-actor-part="arrow" visibility="hidden"/>';
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
  const root = rootFor(pose);
  const side = bodyScale(pose);
  const sideTransform = side===1 ? '' :
    ' translate(160 185) scale('+number(side)+' 1) translate(-160 -185)';
  const actorTransform = (root.dx || root.dy || root.rotation || bob || side!==1) ?
    ' transform="translate('+number(root.dx)+' '+number(root.dy)+') rotate('+
    number(root.rotation*180/Math.PI)+' 160 185)'+sideTransform+
    ' translate(0 '+number(bob)+')"' : '';
  return '<svg class="lb-hero-art canonical-hero-art" data-hero="'+rig.id+
    '" data-signature="'+rig.signature+
    '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 350" role="img" aria-label="'+
    rig.name+' hero"><g class="canonical-hero-actor"'+actorTransform+'>'+
    partsFor(rig,pose).map(part => svgPart(part,palette,pose)).join('')+'</g></svg>';
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
    const root = rootFor(pose);
    ctx.translate(root.dx,root.dy);
    ctx.rotate(root.rotation);
    ctx.scale(bodyScale(pose),1);
    ctx.translate(-HERO_ART_VIEWBOX.anchorX,-HERO_ART_VIEWBOX.anchorY+bobFor(pose));
    for (const part of partsFor(rig,pose)) {
      if (part.name === 'arrow' && !arrowVisible(pose)) continue;
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
