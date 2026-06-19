import { FIGHTER_RADIUS, GAME_SIZE } from "../data/balanceConfig.js";
import { clamp, dist, dot, norm } from "./rng.js";

export function reflectDir(dir, nx, ny) {
  const d = dot(dir.x, dir.y, nx, ny);
  return norm(dir.x - 2 * d * nx, dir.y - 2 * d * ny);
}

export function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return dist(px, py, x1, y1);
  const t = clamp(((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2, 0, 1);
  return dist(px, py, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
}

export function pointOnRayToEdge(x, y, dx, dy) {
  const tx = dx > 0 ? (GAME_SIZE - x) / dx : dx < 0 ? -x / dx : Infinity;
  const ty = dy > 0 ? (GAME_SIZE - y) / dy : dy < 0 ? -y / dy : Infinity;
  const t = Math.min(tx > 0 ? tx : Infinity, ty > 0 ? ty : Infinity);
  return { x: x + dx * t, y: y + dy * t };
}

export function lineNormal(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const n1 = norm(-dy, dx);
  const side = Math.sign((px - x1) * n1.x + (py - y1) * n1.y) || 1;
  return { x: n1.x * side, y: n1.y * side };
}

export function resolveFighterWalls(game, fighter) {
  let wall = null;
  const r = fighter.radius || FIGHTER_RADIUS;
  if (fighter.x - r < 0) {
    fighter.x = r;
    fighter.dir.x = Math.abs(fighter.dir.x);
    wall = "left";
  }
  if (fighter.x + r > GAME_SIZE) {
    fighter.x = GAME_SIZE - r;
    fighter.dir.x = -Math.abs(fighter.dir.x);
    wall = "right";
  }
  if (fighter.y - r < 0) {
    fighter.y = r;
    fighter.dir.y = Math.abs(fighter.dir.y);
    wall = "top";
  }
  if (fighter.y + r > GAME_SIZE) {
    fighter.y = GAME_SIZE - r;
    fighter.dir.y = -Math.abs(fighter.dir.y);
    wall = "bottom";
  }
  if (wall) {
    const jitter = game?.rng?.range ? game.rng.range(-0.055, 0.055) : 0;
    const c = Math.cos(jitter);
    const s = Math.sin(jitter);
    const x = fighter.dir.x * c - fighter.dir.y * s;
    const y = fighter.dir.x * s + fighter.dir.y * c;
    fighter.dir.x = x;
    fighter.dir.y = y;
    fighter.dir = norm(fighter.dir.x, fighter.dir.y);
    fighter.data.deform = 0.32;
    game.audioCue(fighter, "wall_hit");
    if (!fighter.hasStatus("abilityDisabled") && fighter.type.onWallBounce) {
      fighter.type.onWallBounce(game, fighter, wall);
    }
  }
  return wall;
}

export function handleFighterCollisions(game, dt) {
  const live = game.fighters.filter((f) => f.hp > 0);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if (a.teamId === b.teamId) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const minD = a.radius + b.radius;
      if (d >= minD) continue;
      const nx = dx / d;
      const ny = dy / d;
      const aPierce = a.data.phaseDash > 0;
      const bPierce = b.data.phaseDash > 0;
      if (!aPierce && !bPierce) {
        const overlap = minD - d;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        a.dir = reflectDir(a.dir, -nx, -ny);
        b.dir = reflectDir(b.dir, nx, ny);
      }
      if (!a.hasStatus("abilityDisabled") && a.type.onCollide) {
        a.type.onCollide(game, a, b, dt, { x: nx, y: ny });
      }
      if (!b.hasStatus("abilityDisabled") && b.type.onCollide) {
        b.type.onCollide(game, b, a, dt, { x: -nx, y: -ny });
      }
    }
  }
}
