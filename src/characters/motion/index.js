/**
 * Deterministic, visual-only hero pose resolver. Coordinates are local actor units;
 * +x points right, +y down, and rotations are radians (Canvas convention).
 *
 * The integration layer MUST pass lastAttackTick only when the engine actually
 * emitted a friendly player projectile. It is not a cooldown-clock proxy.
 * targetPresent is an optional verified targeting signal used only for
 * anticipatory windup/charge; it never causes a release or modifies gameplay.
 */
import {resolveEightWayWalk} from './walk8.js';
const TAU = Math.PI * 2;
const HEROES = Object.freeze(['mage', 'guardian', 'ranger']);
const DIRECTIONS = Object.freeze(['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']);
const CONFIG = Object.freeze({
  mage: Object.freeze({walkTicks: 32, idleTicks: 75, stride: 2.6, bounce: 0.6}),
  guardian: Object.freeze({walkTicks: 36, idleTicks: 92, stride: 4.5, bounce: 1.3}),
  ranger: Object.freeze({walkTicks: 24, idleTicks: 58, stride: 4.0, bounce: 0.9}),
});
const number = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = n => Math.round(n * 100000) / 100000;
const transform = (x = 0, y = 0, rotation = 0) => ({x: round(x), y: round(y), rotation: round(rotation)});
const smooth = p => p * p * (3 - 2 * p);
const normalized = vector => {
  const x = number(vector?.x), y = number(vector?.y);
  const length = Math.hypot(x, y);
  return length > 1e-9 ? {x: x / length, y: y / length} : null;
};

/**
 * No target/unknown upcoming shot => never fabricate a charge or projectile.
 * lastAttackTick is a *confirmed* shot tick. RELEASE starts at that exact tick;
 * the following recovery and (optional) next-attack anticipation use tick time.
 */
function attackTimeline(tick, lastAttackTick, attackIntervalTicks, targetPresent, nextAttackTick) {
  const interval = clamp(Math.round(number(attackIntervalTicks, 30)), 4, 300);
  const releaseTicks = clamp(Math.round(interval * .12), 1, 5);
  const recoverTicks = clamp(Math.round(interval * .22), 1, 9);
  const preTicks = clamp(Math.round(interval * .44), 2, 20);
  const lastIsValid = Number.isInteger(lastAttackTick) && lastAttackTick >= 0 && lastAttackTick <= tick;
  const elapsed = lastIsValid ? tick - lastAttackTick : Infinity;
  if (elapsed < releaseTicks) {
    return {phase: 'release', progress: (elapsed + 1) / releaseTicks, interval, elapsed};
  }
  if (elapsed < releaseTicks + recoverTicks) {
    return {phase: 'recover', progress: (elapsed - releaseTicks + 1) / recoverTicks, interval, elapsed};
  }
  // A charge is visual anticipation only; the actual projectile is exclusively
  // shown by the engine event. Explicit nextAttackTick supports the first shot.
  if (targetPresent) {
    const hinted = Number.isInteger(nextAttackTick) && nextAttackTick > tick;
    const remaining = hinted ? nextAttackTick - tick : interval - elapsed;
    const timingValid = hinted || (lastIsValid && elapsed < interval);
    if (timingValid && remaining > 0 && remaining <= preTicks) {
      const fraction = (preTicks - remaining + 1) / preTicks;
      return fraction < .5
        ? {phase: 'windup', progress: fraction * 2, interval, elapsed}
        : {phase: 'charge', progress: (fraction - .5) * 2, interval, elapsed};
    }
  }
  return {phase: 'none', progress: 0, interval, elapsed: Number.isFinite(elapsed) ? elapsed : null};
}

/**
 * @param {Object} input
 * @param {'mage'|'guardian'|'ranger'} input.heroId
 * @param {number} input.tick - integer simulation tick, NOT requestAnimationFrame time
 * @param {boolean} input.moving
 * @param {{x:number,y:number}} input.moveVector
 * @param {{x:number,y:number}} input.aimVector
 * @param {number|null} input.lastAttackTick - actual confirmed player fire event
 * @param {number} input.attackIntervalTicks - current player.fireDelay
 * @param {number} input.hurtTicks - remaining visual hurt ticks, optional
 * @param {boolean} input.reducedMotion
 * @param {boolean} [input.targetPresent=false] - verified target exists
 * @param {number} [input.nextAttackTick] - optional anticipated next fire tick
 * @returns {Object} immutable-by-convention pose; no simulation mutations
 */
export function resolveHeroPose(input = {}) {
  const heroId = HEROES.includes(input.heroId) ? input.heroId : 'mage';
  const config = CONFIG[heroId];
  const tick = Math.max(0, Math.floor(number(input.tick)));
  const move = normalized(input.moveVector);
  const walking = Boolean(input.moving && move);
  const aim = normalized(input.aimVector) || (walking ? move : null) || {x: 0, y: -1};
  const angle = Math.atan2(aim.y, aim.x);
  const direction8 = DIRECTIONS[Math.round((angle + TAU) / (TAU / 8)) % 8];
  const reduced = Boolean(input.reducedMotion);
  // Locomotion uses travel, not target/weapon aim. Tick only; no frame time.
  const travel = resolveEightWayWalk({heroId,tick,moving:walking,moveVector:move,reducedMotion:reduced});
  const targetPresent = input.targetPresent === true;
  const attack = attackTimeline(tick, input.lastAttackTick, input.attackIntervalTicks, targetPresent, input.nextAttackTick);
  const phase = attack.phase;
  const t = smooth(attack.progress);
  const active = phase !== 'none';
  const walkWave = walking && !reduced ? Math.sin(tick * TAU / config.walkTicks) : 0;
  const alternate = walking && !reduced ? Math.cos(tick * TAU / config.walkTicks) : 0;
  const idleWave = !reduced ? Math.sin(tick * TAU / config.idleTicks) : 0;
  const hurt = !reduced ? clamp(Math.floor(number(input.hurtTicks)), 0, 10) / 10 : 0;
  const step = config.stride * walkWave;
  const lift = walking ? Math.abs(alternate) * config.bounce : 0;
  // Hero-specific weights are layered over leg locomotion, never replace it.
  const gesture = phase === 'windup' ? -t : phase === 'charge' ? -1 - t * .18
    : phase === 'release' ? 1 - t * .2 : phase === 'recover' ? .8 * (1 - t) : 0;
  const brace = phase === 'windup' ? t : phase === 'charge' ? 1
    : phase === 'release' ? 1 - t * .4 : phase === 'recover' ? (1 - t) * .6 : 0;
  const attackWeight = active ? (phase === 'recover' ? 1 - t : t || 1) : 0;
  // Canonical rig weapons are already upright in local actor coordinates.
  // Absolute world aim angles here used to roll idle swords/staves/bows by 180°.
  // Only a modest local wrist tilt belongs in these part transforms.
  // While running, keep the entire silhouette anchored to the *walk* heading.
  // The old attack toggle instantly mirrored the whole actor for a shot behind
  // the hero, swapping legs and handedness in the middle of a stride.
  // Stationary targeting may turn the actor, but must not reverse moving feet.
  const aimingInPlace = !walking && (active || targetPresent);
  const viewDirection = aimingInPlace ? direction8 : travel.direction8;
  const viewX = aimingInPlace ? aim.x : travel.x;
  const viewY = aimingInPlace ? aim.y : travel.y;
  const profile = 1 - .24*Math.abs(viewX);
  const westView = viewDirection==='W'||viewDirection==='SW'||viewDirection==='NW';
  const view = {
    direction8: viewDirection,
    bodyScaleX: round(westView ? -profile : profile),
    backView: Boolean((walking || active) && viewY < -.55),
  };
  // Attack crosses the visible body if the enemy lies on the weapon's
  // opposite side. This changes the arm/wrist arc, never stride or hit logic.
  // Mirrored west-facing art reverses the local horizontal axis.
  const localAimX = aim.x * (view.bodyScaleX < 0 ? -1 : 1);
  const attackSide = active && localAimX < -.25 ? -1 : 1;
  const attackGesture = gesture * attackSide;
  // A 2-D rig cannot rotate a body around its vertical axis independently.
  // Instead, tip and elevate the weapon arm toward both X and Y aim components.
  // In particular, opposite north/south shots must no longer share one pose.
  const aimPitch = active ? clamp(aim.y * .16, -.16, .16) : 0;
  const aimHeight = active ? clamp(aim.y * 4.5 * attackWeight, -4.5, 4.5) : 0;
  const aimTilt = active ? clamp(localAimX * .17 + aimPitch, -.3, .3) : 0;
  const joints = {
    root: transform(), torso: transform(), head: transform(),
    robe: transform(), cape: transform(),
    leftArm: transform(), rightArm: transform(),
    leftLeg: transform(), rightLeg: transform(),
    weapon: transform(), shield: transform(),
  };
  const fx = {staffGlow: 0, bladeArc: 0, shieldBrace: 0, bowDraw: 0, arrowVisible: false};

  if (heroId === 'mage') {
    // Continuous float and sleeve/staff shimmer; robes skim along the ground.
    joints.root = transform(0, reduced ? -1 : -2.0 - idleWave * 1.5 - lift * .3, -.035 * walkWave - hurt * .05);
    joints.torso = transform(0, 0, .035 * walkWave);
    joints.head = transform(0, -.3 * idleWave, -.045 * idleWave);
    joints.robe = transform(-.45 * walkWave, .1 * idleWave, .08 * walkWave);
    // Shoulder cape follows the torso rigidly after locomotion is composed.
    // capeTail provides delayed lower-cloth motion, not a drifting collar.
    joints.cape = transform();
    joints.capeTail = transform();
    joints.leftLeg = transform(-step * .33, 0, -.13 * walkWave);
    joints.rightLeg = transform(step * .33, 0, .13 * walkWave);
    joints.leftArm = transform(0, -.3 * idleWave, .09 * idleWave - .12 * walkWave + gesture * .22);
    joints.rightArm = transform(0, -Math.abs(gesture) * 2.4 + aimHeight,
      -.06 * idleWave + attackGesture * .6 + aimPitch * .8);
    joints.weapon = transform(0, -Math.abs(gesture) * 3.7 + aimHeight,
      aimTilt + attackGesture * .58);
    fx.staffGlow = phase === 'charge' ? .4 + .6 * t : phase === 'release' ? 1 - t * .3 : 0;
  } else if (heroId === 'guardian') {
    // Deliberately heavy footfall. Sword shoulder winds up independently of legs.
    const planted = reduced ? 0 : Math.abs(alternate) * config.bounce;
    joints.root = transform(0, planted * .33 + hurt * .7, -.055 * walkWave - hurt * .12);
    joints.torso = transform(0, -.28 * idleWave, .04 * walkWave + gesture * .11);
    joints.head = transform(0, -.18 * idleWave, -.025 * walkWave);
    joints.cape = transform(0, 0, -.055 * walkWave);
    joints.leftLeg = transform(-step * .58, Math.max(0, alternate) * -1.9, -.25 * walkWave);
    joints.rightLeg = transform(step * .58, Math.max(0, -alternate) * -1.9, .25 * walkWave);
    joints.leftArm = transform(-brace * 1.4, -brace * 1.9, -.12 * walkWave - brace * .31);
    joints.rightArm = transform(0, -Math.abs(gesture) * 2.5 + aimHeight,
      .1 * walkWave + attackGesture * .92 + aimPitch * .8);
    joints.weapon = transform(0, -Math.abs(gesture) * 2.5 + aimHeight,
      aimTilt + attackGesture * .82);
    joints.shield = transform(-brace * 1.4, -brace * 1.4, -brace * .28);
    fx.bladeArc = phase === 'release' ? 1 - t : 0;
    fx.shieldBrace = brace;
  } else {
    // Lighter alternating stride, alert bow hold and a physical string draw.
    joints.root = transform(0, -lift * .28 + hurt * .25, -.09 * walkWave - hurt * .08);
    joints.torso = transform(0, -.2 * idleWave, .06 * walkWave);
    joints.head = transform(0, -.2 * idleWave, -.1 * idleWave);
    joints.cape = transform(-.8 * walkWave, 0, -.2 * walkWave - .045 * idleWave);
    joints.leftLeg = transform(-step * .7, Math.max(0, alternate) * -1.4, -.24 * walkWave);
    joints.rightLeg = transform(step * .7, Math.max(0, -alternate) * -1.4, .24 * walkWave);
    joints.leftArm = transform(0, -brace * 1.6, -.07 * walkWave + brace * .32);
    joints.rightArm = transform(-brace * 2.6, -brace * 1.2 + aimHeight,
      .09 * walkWave - brace * .54 * attackSide + aimPitch * .8);
    joints.weapon = transform(-brace * .6, -brace * 1.5 + aimHeight,
      aimTilt + attackGesture * .16);
    fx.bowDraw = phase === 'windup' ? t * .7 : phase === 'charge' ? .7 + .3 * t
      : phase === 'release' ? 0 : phase === 'recover' ? 0 : 0;
    fx.arrowVisible = phase === 'windup' || phase === 'charge';
  }

  // Directional footwork is derived only from the movement vector, not aiming.
  // It remains deterministic when the simulation pauses or attacks during a step.
  if (walking) {
    const l = travel.legs.left, r = travel.legs.right;
    joints.leftLeg = transform(l.x,l.y,l.rotation);
    joints.rightLeg = transform(r.x,r.y,r.rotation);
    const upper = travel.upper, drift = travel.cape, root = travel.root;
    const armFactor = active ? .22 : 1; // Preserve confirmed weapon attacks.
    joints.root = transform(joints.root.x+root.x,joints.root.y+root.y,joints.root.rotation+root.rotation);
    joints.torso = transform(joints.torso.x+upper.x*.55,joints.torso.y+upper.y*.35,
      joints.torso.rotation+upper.rotation);
    joints.head = transform(joints.head.x+upper.x*.7,joints.head.y+upper.y*.5,
      joints.head.rotation+upper.rotation*.25);
    joints.cape = transform(joints.cape.x+drift.x,joints.cape.y+drift.y,
      joints.cape.rotation+drift.rotation);
    joints.leftArm = transform(joints.leftArm.x+upper.x*.22,joints.leftArm.y+upper.y*.23,
      joints.leftArm.rotation+travel.armSwing*armFactor);
    joints.rightArm = transform(joints.rightArm.x+upper.x*.22,joints.rightArm.y+upper.y*.23,
      joints.rightArm.rotation-travel.armSwing*armFactor);
    if (heroId==='mage') {
      joints.robe = transform(joints.robe.x+drift.x*.32,joints.robe.y+drift.y*.4,
        joints.robe.rotation+drift.rotation*.6);
    } else if (heroId==='guardian') {
      joints.shield = transform(joints.shield.x+upper.x*.16,joints.shield.y,
        joints.shield.rotation+travel.armSwing*.24);
    }
  }

  if (heroId === 'mage') {
    // The garment's collar pivot is (160,119), while torso rotates around
    // (160,160). Evaluate the collar point on that torso transform exactly.
    // This eliminates top-cloth separation in N/NE/NW and during turn/attacks.
    const shoulder = joints.torso;
    const shoulderAngle = shoulder.rotation;
    const collarX = shoulder.x + 41 * Math.sin(shoulderAngle);
    const collarY = shoulder.y + 41 * (1 - Math.cos(shoulderAngle));
    joints.cape = transform(collarX, collarY, shoulderAngle * .72);
    const trailing = walking && !reduced
      ? Math.sin((tick - 3) * TAU / config.walkTicks) : 0;
    joints.capeTail = transform(
      collarX - travel.x * (walking ? 1.5 : 0) - trailing * .9,
      collarY + travel.y * (walking ? .7 : 0),
      shoulderAngle * .4 - trailing * .055
    );
  }

  // Weapon art has a different named pivot from the sword/staff/bow arm.
  // Follow the shoulder's arc (as well as its translation) so hands and
  // weapons travel together on strides, attacks and recoveries.
  // This is a visual-only calculation, never feeds projectile trajectories.
  const hand = joints.rightArm;
  if (heroId === 'mage') {
    // Contact-based grip: arm pivot (206,166), drawn palm (230,153),
    // staff pivot (229,174), shaft contact (229,153). Solve the weapon
    // translation after all wrist/aim motions so both points coincide,
    // including mirrored headings and opposite-direction moving fire.
    const staffAngle = joints.weapon.rotation + hand.rotation * .16;
    const palmX = 206 + hand.x + 24 * Math.cos(hand.rotation)
      + 13 * Math.sin(hand.rotation);
    const palmY = 166 + hand.y + 24 * Math.sin(hand.rotation)
      - 13 * Math.cos(hand.rotation);
    const staffX = 229 + 21 * Math.sin(staffAngle);
    const staffY = 174 - 21 * Math.cos(staffAngle);
    joints.weapon = transform(palmX - staffX, palmY - staffY, staffAngle);
  } else {
    // Exact original guardian/ranger pose algorithm retained.
    const offset = heroId === 'ranger' ? {x: 29, y: -5}
      : {x: 33, y: -3};
    const wrist = hand.rotation * .72;
    const wristX = offset.x * (Math.cos(wrist)-1) - offset.y * Math.sin(wrist);
    const wristY = offset.x * Math.sin(wrist) + offset.y * (Math.cos(wrist)-1);
    joints.weapon = transform(
      joints.weapon.x + hand.x + wristX,
      joints.weapon.y + hand.y + wristY,
      joints.weapon.rotation + hand.rotation * .16
    );
  }

  return {
    heroId, state: active ? 'attack' : walking ? 'walk' : 'idle',
    locomotion: walking ? 'walk' : 'idle', attackPhase: phase,
    attackProgress: round(attack.progress), attackWeight: round(attackWeight),
    tick, fireIntervalTicks: attack.interval,
    facing: {angle: round(angle), direction8, x: round(aim.x), y: round(aim.y)},
    joints, fx, travel, view,
    reducedMotion: reduced,
  };
}

export const HERO_MOTION_IDS = HEROES;
