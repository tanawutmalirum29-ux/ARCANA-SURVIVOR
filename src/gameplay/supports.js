// Support effects share the deterministic combat clock. No wall clock or random loot rolls.
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const heal = (s, amount) => { s.player.hp = Math.min(s.player.maxHp, s.player.hp + amount * s.player.healingMultiplier); };
const barrier = (s, amount) => { s.player.shield = Math.max(s.player.shield, Math.min(s.player.maxHp * .4, amount)); };
function flash(s, type, origin, radius, ttl = 24, extra = {}) {
  s.flashes.push({ id: ++s.nextId, x: origin.x, y: origin.y, type, radius, ttl, ...extra });
}
function pulse(s, radius, amount, hit) {
  for (const enemy of s.enemies) if (enemy.hp > 0 && distance(enemy, s.player) < radius) hit(s, enemy, amount);
}

export function updateSupports(s, hit, shoot, targetNearest) {
  const p = s.player, config = s.runConfig, timers = s.supportTimers;
  if (s.sanctuary && --s.sanctuary.ttl <= 0) s.sanctuary = null;
  if (config.heroId === 'guardian' && --timers.heroShield <= 0) {
    barrier(s, p.maxHp * .12);
    flash(s, 'barrier', p, 36);
    timers.heroShield = 8 * 60;
  }
  if (config.modifiers.shieldEvery > 0 && --timers.gearShield <= 0) {
    barrier(s, p.maxHp * .08);
    flash(s, 'barrier', p, 32);
    timers.gearShield = Math.max(60, Math.round(config.modifiers.shieldEvery * 60));
  }

  if (config.artifact && --timers.artifact <= 0) {
    const { id, level } = config.artifact;
    if (id === 'hourglass') {
      const radius = Math.min(400, 255 + level * 5);
      for (const enemy of s.enemies) if (enemy.hp > 0 && distance(enemy, p) < radius) enemy.slow = Math.max(enemy.slow, 180 + level * 8);
      flash(s, 'hourglass', p, radius, 36);
      timers.artifact = 9 * 60;
    } else if (id === 'lantern') {
      barrier(s, p.maxHp * Math.min(.3, .12 + level * .008));
      s.sanctuary = { x: p.x, y: p.y, radius: 145, ttl: 3 * 60 };
      flash(s, 'sanctuary', p, 145, 3 * 60);
      timers.artifact = 10 * 60;
    } else if (id === 'sunburst') {
      flash(s, 'sunburst', p, 240, 32);
      pulse(s, 240, p.attack * p.skillMultiplier * (1.4 + level * .12), hit);
      timers.artifact = 7 * 60;
    } else timers.artifact = 10 * 60;
  }
  if (s.phase !== 'running') return;

  for (const companion of s.supportActors) {
    const angle = s.tick / 90 + companion.slot * Math.PI;
    companion.x = p.x + Math.cos(angle) * 44;
    companion.y = p.y + Math.sin(angle) * 34;
    if (--companion.timer > 0) continue;
    const scale = 1 + (companion.level - 1) * .06;
    if (companion.id === 'sprite') {
      heal(s, p.maxHp * .025 * scale);
      flash(s, 'healing', companion, 55);
      companion.timer = 8 * 60;
    } else if (companion.id === 'owl') {
      const enemies = s.enemies.filter(enemy => enemy.hp > 0 && distance(enemy, companion) < 400)
        .sort((a, b) => distance(a, companion) - distance(b, companion) || a.id - b.id)
        .slice(0, Math.min(5, 2 + Math.floor(companion.level / 8)));
      let previous = companion;
      for (const enemy of enemies) {
        flash(s, 'chain', enemy, 6, 12, { x2: previous.x, y2: previous.y });
        hit(s, enemy, p.attack * .28 * p.skillMultiplier * scale);
        previous = enemy;
      }
      companion.timer = enemies.length ? 150 : 15;
    } else if (companion.id === 'wisp') {
      const enemy = targetNearest(s, companion, 480);
      if (enemy) {
        const dist = distance(enemy, companion) || 1;
        const projectile = shoot(s, companion.x, companion.y, { x: (enemy.x - companion.x) / dist, y: (enemy.y - companion.y) / dist }, true, p.attack * .38 * scale, 400, 4);
        if (projectile) projectile.support = 'wisp';
      }
      companion.timer = enemy ? 95 : 15;
    } else companion.timer = 10 * 60;
    if (s.phase !== 'running') return;
  }

  if (config.guardian && --timers.guardian <= 0) {
    const { id, level } = config.guardian;
    const scale = 1 + (level - 1) * .06;
    if (id === 'phoenix') {
      heal(s, p.maxHp * .035 * scale);
      flash(s, 'healing', p, 80);
    } else if (id === 'tortoise') {
      barrier(s, p.maxHp * Math.min(.35, .16 * scale));
      flash(s, 'barrier', p, 60);
    } else if (id === 'dragon') {
      flash(s, 'sunburst', p, 210, 30);
      pulse(s, 210, p.attack * .95 * p.skillMultiplier * scale, hit);
    }
    timers.guardian = 12 * 60;
  }
}
