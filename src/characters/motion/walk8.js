/**
 * Eight-way directional locomotion, sampled exclusively at fixed simulation ticks.
 * Pure presentation: no engine state, RNG, frame delta, interpolation clock or DOM.
 * X points right and Y points down. The gait is independent of weapon aim.
 */
const TAU = Math.PI * 2;
export const WALK_DIRECTIONS = Object.freeze(['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']);
const STYLES = Object.freeze({
  mage: Object.freeze({period:32, stride:2.6, footLift:.8, lean:.028, sway:.6, bounce:.55, swing:.09}),
  guardian: Object.freeze({period:36, stride:4.5, footLift:2.7, lean:.044, sway:.9, bounce:1.2, swing:.12}),
  ranger: Object.freeze({period:24, stride:4.0, footLift:2.2, lean:.065, sway:1.0, bounce:.8, swing:.19}),
});
const finite = x => Number.isFinite(x) ? x : 0;
const round = x => Math.round(x * 100000) / 100000;

export function resolveEightWayWalk({heroId='mage',tick=0,moving=false,moveVector=null,reducedMotion=false}={}) {
  const style = STYLES[heroId] || STYLES.mage;
  const dx = finite(moveVector?.x), dy = finite(moveVector?.y);
  const length = Math.hypot(dx,dy);
  const walking = Boolean(moving && length > 1e-9);
  const x = walking ? dx / length : 0;
  const y = walking ? dy / length : 0;
  const angle = walking ? Math.atan2(y,x) : -Math.PI/2;
  const direction8 = WALK_DIRECTIONS[(Math.round(angle/(Math.PI/4)) + 8) % 8];
  // Signed silhouette width makes west/east visibly different without changing
  // the rig, palette, equipment identity or the attack-facing direction.
  const profile = walking ? 1 - .24 * Math.abs(x) : 1;
  // Follow the quantized facing rather than noisy near-zero analog X;
  // a near-vertical stick must not flip the whole actor each tick.
  const westFacing = direction8 === 'SW' || direction8 === 'W' || direction8 === 'NW';
  const bodyScaleX = walking && westFacing ? -profile : profile;
  const backView = walking && y < -.55;
  const t = Math.max(0, Math.floor(finite(tick))) % style.period;
  const phase = t * TAU/style.period;
  const swing = walking && !reducedMotion ? Math.sin(phase) : 0;
  const contact = walking && !reducedMotion ? Math.cos(phase) : 0;
  const leftLift = Math.max(0, contact)*style.footLift;
  const rightLift = Math.max(0,-contact)*style.footLift;
  const width = .3 + .7*Math.abs(x);
  const lengthwise = y * .55;
  const forward = style.stride*swing;
  const left = {
    x:round(-forward*width),
    y:round(forward*lengthwise-leftLift),
    rotation:round(-swing*style.swing*(.48 + .52*Math.abs(x))),
  };
  const right = {
    x:round(forward*width),
    y:round(-forward*lengthwise-rightLift),
    rotation:round(swing*style.swing*(.48 + .52*Math.abs(x))),
  };
  // Contact lowers Orin (weight), Lyra lifts between strides, Astra glides.
  const landing = Math.abs(contact);
  const bob = heroId === 'guardian' ? landing*style.bounce*.55
    : heroId === 'ranger' ? -landing*style.bounce*.48
    : -landing*style.bounce*.22;
  const horizontalLean = walking && !reducedMotion ? x*style.lean*2.7 : 0;
  const sway = walking && !reducedMotion ? swing*style.sway : 0;
  const root = {
    x:round(-x*sway*.32), y:round(bob), rotation:round(horizontalLean - swing*style.lean),
  };
  const upper = {
    x:round(x*(walking ? 1.4 : 0) + sway*.3),
    y:round(-y*(walking ? 1.1 : 0)),
    rotation:round(horizontalLean*.7 + swing*style.lean*.55),
  };
  const cape = {
    x:round(-x*(walking ? (heroId === 'guardian' ? 2.4 : 3.8) : 0) - sway*.85),
    y:round(y*(walking ? 1.6 : 0)),
    rotation:round(swing*(heroId === 'ranger' ? -.18 : -.1) - x*.055),
  };
  return {
    direction8, x:round(x), y:round(y), angle:round(angle),
    walking, profile:round(profile), bodyScaleX:round(bodyScaleX), backView,
    period:style.period, phase:round(phase), contact:round(contact),
    legs:{left,right},root,upper,cape,
    // Weapon arm stays free for combat, support arm counters the gait.
    armSwing:round(swing*(heroId === 'ranger' ? .16 : heroId === 'guardian' ? .075 : .045)),
  };
}
