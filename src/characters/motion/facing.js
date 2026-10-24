/**
 * Presentation-only auto-attack aim. No changes to fixed-tick movement,
 * enemy target selection, projectiles, save data, RNG or combat damage.
 *
 * Standing heroes face the target they are about to shoot/swing at; on the
 * actual hit tick, the engine-confirmed attack direction takes priority.
 * Walking still faces the walk heading regardless of where the shot went.
 */
const normal = v => {
  const x=Number.isFinite(v?.x)?v.x:0;
  const y=Number.isFinite(v?.y)?v.y:0;
  const length=Math.hypot(x,y);
  return length>1e-9?{x:x/length,y:y/length}:null;
};
const attackAim = event => normal({x:event?.aimX,y:event?.aimY});

export function resolveHeroFacing({
  heroId='mage',tick=0,player=null,enemies=[],movement=null,
  fireEvent=null,lastFacing=null,configured=true
}={}) {
  const travel=normal(movement);
  // Match the engine's nearest-alive enemy selection and actual attack range.
  const range=configured && heroId==='guardian'?108:580;
  const px=Number.isFinite(player?.x)?player.x:0;
  const py=Number.isFinite(player?.y)?player.y:0;
  let target=null,best=range*range;
  for(const enemy of Array.isArray(enemies)?enemies:[]) {
    if (!(enemy?.hp>0) || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
    const dx=enemy.x-px,dy=enemy.y-py;
    const distance=dx*dx+dy*dy;
    if(distance<best) {best=distance;target=enemy;}
  }
  const targetVector=target?normal({x:target.x-px,y:target.y-py}):null;
  const confirmed=Number.isInteger(fireEvent?.tick) &&
    fireEvent.tick>=0 && fireEvent.tick<=tick;
  const verifiedShot=confirmed?attackAim(fireEvent):null;
  const justFired=confirmed && fireEvent.tick===tick;
  // Never aim at an arbitrary enemy array entry: auto-attacks choose nearest.
  // The last confirmed direction is retained if the shot already killed its
  // target, but a new living target takes priority from the next tick onward.
  const combatAim=(justFired?verifiedShot:null) || targetVector || verifiedShot;
  const facing=travel || combatAim || normal(lastFacing);
  return {
    moving:Boolean(travel),
    targetPresent:Boolean(targetVector),
    aimVector:combatAim || travel || normal(lastFacing) || {x:0,y:-1},
    facingVector:facing,
  };
}
