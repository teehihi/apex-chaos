import { GAME_SIZE, SUMMON_LIMITS } from "../data/balanceConfig.js";
import { clamp, dist, lerp, norm, smoothstep, TAU } from "./rng.js";
import { distToSegment, lineNormal, pointOnRayToEdge, reflectDir } from "./collision.js";
import { spawnSlimeMucus } from "./damage.js";

export function limitOwnedProjectiles(game, owner, type, limit, sortKey = "spawnTime") {
  const list = game.projectiles
    .filter((p) => p.type === type && p.owner === owner && p.life > 0)
    .sort((a, b) => (a[sortKey] || 0) - (b[sortKey] || 0));
  while (list.length > limit) list.shift().life = 0;
}

export function updateProjectiles(game, dt) {
  const projectiles = game.projectiles;
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    if (!p || !Number.isFinite(p.life)) {
      if (p?.life !== Infinity) {
        projectiles.splice(i, 1);
        continue;
      }
    }
    if (p.life !== Infinity) p.life -= dt;
    if (p.life <= 0 && !["meteor", "gravity_well", "slime_child"].includes(p.type)) {
      projectiles.splice(i, 1);
      continue;
    }
    const owner = p.owner;
    const enemy = owner ? game.getEnemy(owner) : game.fighters.find((f) => f.hp > 0);

    if (p.vx !== undefined && p.vy !== undefined) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.bounceArena) {
        const r = p.radius || 10;
        if (p.x < r || p.x > GAME_SIZE - r) p.vx *= -1;
        if (p.y < r || p.y > GAME_SIZE - r) p.vy *= -1;
        p.x = clamp(p.x, r, GAME_SIZE - r);
        p.y = clamp(p.y, r, GAME_SIZE - r);
      }
    }

    switch (p.type) {
      case "ice_lane":
        updateIceLane(game, p, enemy, dt);
        break;
      case "meteor":
        updateMeteor(game, p, enemy);
        break;
      case "fire_pit":
        if (enemy && dist(enemy.x, enemy.y, p.x, p.y) <= p.radius + enemy.radius * 0.32) {
          enemy.applyStatus("burn", 1.8, { source: owner, interval: 0.8, dmg: owner?.isRage ? 1.45 : 1.15 });
          if (owner?.isRage) enemy.applyStatus("slow", 0.8, { mult: 0.84 });
        }
        break;
      case "magnet_field":
        updateMagnetField(game, p, owner, enemy, dt);
        break;
      case "web_line":
        updateWebLine(game, p, owner, enemy, dt);
        break;
      case "toxic_trail":
      case "toxic_puddle":
        for (const target of game.fighters) {
          if (target.hp > 0 && dist(target.x, target.y, p.x, p.y) <= p.radius + target.radius * 0.28) {
            target.applyStatus("poison", 2, { source: owner, selfSafe: target === owner });
          }
        }
        break;
      case "toxic_shot":
        updateHomingShot(game, p, enemy, dt, 1080, () => {
          enemy.takeDamage(3.4, owner, "toxic-spit");
          enemy.applyStatus("poison", 3.2, { source: owner, exposure: 10, forceBreak: true });
          enemy.applyStatus("slow", 1.7, { mult: 0.45 });
        });
        break;
      case "gravity_well":
        updateGravityWell(game, p, owner, enemy, dt);
        break;
      case "blade_wave":
        updateBladeWave(game, p, owner, enemy, dt);
        break;
      case "crystal_wall":
        updateCrystalWall(game, p, owner, dt);
        break;
      case "crystal_cage":
        updateCrystalCage(game, p, owner, dt);
        break;
      case "virus_minion":
        updateVirusMinion(game, p, owner, enemy, dt);
        break;
      case "drum_wave":
        updateDrumWave(game, p, owner, enemy);
        break;
      case "card_throw":
        updateHomingShot(game, p, enemy, dt, 740, () => {
          enemy.takeDamage(p.dmg || 5, owner, p.rage ? "rage-card" : "card-throw");
          if (p.rage && game.rng.chance(0.35)) enemy.applyStatus("weak", 2.4, { source: owner });
        });
        break;
      case "math_formula":
        updateMathFormula(game, p, owner, enemy, dt);
        break;
      case "math_v2_graph":
        updateMathV2Graph(game, p, owner, enemy, dt);
        break;
      case "sniper_laser":
      case "witch_ray":
      case "flash_afterimage":
      case "red_slash":
        break;
      case "slime_child":
        updateSlimeChild(game, p, owner, enemy, dt, i);
        break;
      case "slime_mucus":
        if (enemy && dist(enemy.x, enemy.y, p.x, p.y) <= p.radius + enemy.radius * 0.25) {
          enemy.applyStatus("slow", 0.8, { mult: 0.6 });
        }
        break;
      case "time_mark":
        break;
      case "time_rift":
        if (enemy && !p.hit && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius) {
          p.hit = true;
          enemy.takeDamage(p.storedDamage || 1, owner, "time-rift");
          p.life = 0;
        }
        break;
      case "wolf_scent":
        if (enemy && dist(enemy.x, enemy.y, p.x, p.y) <= p.radius + enemy.radius * 0.25) {
          enemy.applyStatus("scent", 4.5, { source: owner });
        }
        break;
      case "witch_talisman":
        if (enemy && !p.hit && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius) {
          p.hit = true;
          enemy.applyStatus("hexBurn", 4, { source: owner, dmg: 1 });
          enemy.applyStatus("slow", 2, { mult: 0.72 });
          p.life = 0;
        }
        break;
      case "pirate_anchor":
        updatePirateAnchor(game, p, owner, enemy, dt);
        break;
      case "pirate_loot":
        updatePirateLoot(game, p, owner, enemy, dt);
        break;
      case "cannonball":
        updateHomingShot(game, p, enemy, dt, 860, () => {
          enemy.takeDamage(owner?.isRage ? 7.8 : 6.2, owner, "cannonball");
          enemy.applyStatus("push", 0.18, { ...norm(enemy.x - p.x, enemy.y - p.y), strength: 760 });
        });
        break;
      case "painter_stroke":
        updatePainterStroke(game, p, owner, enemy, dt);
        break;
      case "painter_blob":
        updateHomingShot(game, p, enemy, dt, 760, () => {
          if (p.kind === "red") enemy.applyStatus("paintRed", 3, { source: owner });
          if (p.kind === "blue") enemy.applyStatus("paintBlue", 3, { source: owner });
          if (p.kind === "yellow") owner?.applyStatus("painterGuard", 3, { source: owner });
          enemy.takeDamage(3.3, owner, "paint-blob");
        });
        break;
      case "superfan":
        updateSuperfan(game, p, owner, enemy, dt);
        break;
      case "mirror_zone":
        updateMirrorZone(game, p, owner, enemy);
        break;
      case "curse_splinter":
        if (enemy && !p.hit && dist(enemy.x, enemy.y, p.x, p.y) <= p.radius + enemy.radius * 0.2) {
          p.hit = true;
          enemy.applyStatus("slow", 1.2, { mult: 0.72 });
          enemy.takeDamage(1.8, owner, "curse-splinter");
        }
        break;
      case "puppet_card":
        if (enemy && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius && p.hitCd <= 0) {
          p.hitCd = 0.28;
          enemy.takeDamage(p.value || 2, owner, "puppet-final-card");
        }
        p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
        break;
      case "straw_monster":
        updateStrawMonster(game, p, owner, enemy, dt);
        break;
      case "kungfu_palm":
        if (enemy && !p.hit && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius) {
          p.hit = true;
          enemy.takeDamage(owner?.isRage ? 14 : 10.5, owner, "giant-palm");
          enemy.applyStatus("push", 0.35, { ...norm(enemy.x - owner.x, enemy.y - owner.y), strength: 1450 });
          enemy.applyStatus("innerTrauma", 10, { source: owner, stacks: 2 });
        }
        break;
      default:
        break;
    }

    if (p.life <= 0 && p.type === "gravity_well" && !p.exploded) {
      explodeGravityWell(game, p, owner, enemy);
    }
    if (p.life <= 0 && p.type === "slime_child") {
      spawnSlimeMucus(game, owner, p.x, p.y);
      projectiles.splice(i, 1);
    }
  }
  stableProjectileCleanup(game);
}

function updateIceLane(game, p, enemy, dt) {
  const owner = p.owner;
  if (owner && distToSegment(owner.x, owner.y, p.x1, p.y1, p.x2, p.y2) <= p.halfWidth) {
    owner.applyStatus("speed", 1.5, { mult: 1.35 });
  }
  if (enemy && distToSegment(enemy.x, enemy.y, p.x1, p.y1, p.x2, p.y2) <= p.halfWidth + enemy.radius * 0.28) {
    enemy.applyStatus("slow", 1.5, { mult: 0.38 });
    p.enemyInside = (p.enemyInside || 0) + dt;
    p.dmgTick = (p.dmgTick || 0) + dt;
    while (p.dmgTick >= 1) {
      p.dmgTick -= 1;
      enemy.takeDamage(enemy.hasStatus("freeze") ? 2.4 : 1.25, owner, "ice-field");
    }
    if (p.enemyInside >= 3.2) {
      enemy.applyStatus("freeze", 1.7, { source: owner, dartTotal: game.rng.range(7, 12) });
      enemy.applyStatus("frostMark", 7, { source: owner });
      p.enemyInside = 0;
    }
  } else {
    p.enemyInside = Math.max(0, (p.enemyInside || 0) - dt * 1.3);
  }
  if (p.life <= 0 && owner) {
    owner.data.laneActive = false;
    owner.data.cd = 6.8;
  }
}

function updateMeteor(game, p, enemy) {
  if (!p.hit && p.life <= 0.25) {
    p.hit = true;
    if (enemy) {
      const md = dist(enemy.x, enemy.y, p.x, p.y);
      if (md <= p.radius + enemy.radius) {
        enemy.takeDamage(p.damage || 6.8, p.owner, "meteor");
        enemy.applyStatus("burn", 3.2, { source: p.owner, interval: 0.8, dmg: 1.05 });
      } else if (md <= p.radius + enemy.radius + 35) {
        enemy.takeDamage(2.2, p.owner, "meteor-shock");
      }
    }
    game.emitVfx("meteor", p.x, p.y, "#ff7a1f", 30);
    game.spawnProjectile({
      type: "fire_pit",
      owner: p.owner,
      x: p.x,
      y: p.y,
      radius: p.owner?.isRage ? 76 : 48,
      life: p.owner?.isRage ? 7 : 3.4,
      maxLife: p.owner?.isRage ? 7 : 3.4
    });
  }
}

function updateMagnetField(game, p, owner, enemy, dt) {
  if (!owner || !enemy) return;
  p.x = owner.x;
  p.y = owner.y;
  p.slamCd = Math.max(0, (p.slamCd || 0) - dt);
  const d = dist(enemy.x, enemy.y, p.x, p.y);
  if (d <= p.radius + enemy.radius) {
    const n = norm(enemy.x - p.x, enemy.y - p.y);
    enemy.applyStatus("push", 0.22, { x: n.x, y: n.y, strength: owner.isRage ? 1350 : 1150 });
    p.hitCd ||= {};
    p.hitCd[enemy.id] = (p.hitCd[enemy.id] || 0) - dt;
    if (p.hitCd[enemy.id] <= 0) {
      enemy.takeDamage(1.7, owner, "magnetic-field");
      p.hitCd[enemy.id] = 0.32;
    }
    if (
      p.slamCd <= 0 &&
      (enemy.x <= enemy.radius + 8 ||
        enemy.x >= GAME_SIZE - enemy.radius - 8 ||
        enemy.y <= enemy.radius + 8 ||
        enemy.y >= GAME_SIZE - enemy.radius - 8)
    ) {
      enemy.takeDamage(owner.isRage ? 4.4 : 3.2, owner, "magnetic-slam");
      p.slamCd = 0.9;
    }
  }
}

function updateWebLine(game, p, owner, enemy, dt) {
  if (!owner || !enemy) return;
  p.x2 = owner.x;
  p.y2 = owner.y;
  p.hitCd ||= {};
  p.hitCd[enemy.id] = Math.max(0, (p.hitCd[enemy.id] || 0) - dt);
  if (distToSegment(enemy.x, enemy.y, p.x1, p.y1, p.x2, p.y2) <= enemy.radius + 10 && p.hitCd[enemy.id] <= 0) {
    enemy.takeDamage(0.55, owner, "web");
    enemy.applyStatus("slow", owner.isRage ? 1.3 : 0.9, { mult: owner.isRage ? 0.5 : 0.64 });
    p.hitCd[enemy.id] = owner.isRage ? 0.55 : 0.75;
  }
}

function updateHomingShot(game, p, enemy, dt, speed, onHit) {
  if (!enemy) return;
  const n = norm(enemy.x - p.x, enemy.y - p.y);
  p.vx = n.x * speed;
  p.vy = n.y * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + (p.radius || 16) + 6) {
    onHit();
    p.life = 0;
  }
}

function updateGravityWell(game, p, owner, enemy, dt) {
  if (enemy) {
    const d = Math.max(90, dist(enemy.x, enemy.y, p.x, p.y));
    const n = norm(p.x - enemy.x, p.y - enemy.y);
    const pullSpeed = clamp(14500000 / (d * d), 20, 760);
    enemy.data.positionLocked = true;
    enemy.x = clamp(enemy.x + n.x * pullSpeed * dt, enemy.radius, GAME_SIZE - enemy.radius);
    enemy.y = clamp(enemy.y + n.y * pullSpeed * dt, enemy.radius, GAME_SIZE - enemy.radius);
    enemy.setDir(n.x, n.y);
  }
  if (owner?.isRage) {
    for (const q of game.projectiles) {
      if (q === p || !q.owner || q.owner === owner || q.x === undefined || q.y === undefined || q.vx === undefined) continue;
      if (["meteor", "ice_lane", "toxic_puddle", "toxic_trail", "fire_pit", "gravity_well", "crystal_cage", "crystal_wall"].includes(q.type)) continue;
      const d = Math.max(35, dist(q.x, q.y, p.x, p.y));
      const n = norm(p.x - q.x, p.y - q.y);
      q.vx += n.x * clamp(300000 / (d * d), 80, 780) * dt;
      q.vy += n.y * clamp(300000 / (d * d), 80, 780) * dt;
      if (d < (p.core || 90) + (q.radius || 10)) {
        p.absorbed = (p.absorbed || 0) + 1;
        q.life = 0;
      }
    }
  }
}

function explodeGravityWell(game, p, owner, enemy) {
  p.exploded = true;
  if (enemy) {
    const d = dist(enemy.x, enemy.y, p.x, p.y);
    let dmg = d <= 210 ? lerp(17, 4, clamp(d / 210, 0, 1)) : 0;
    if (p.absorbedDamage) dmg += p.absorbedDamage * 1.1;
    if (dmg > 0) enemy.takeDamage(dmg, owner, p.absorbedDamage ? "black-hole-reflect" : "black-hole-explosion");
  }
}

function updateBladeWave(game, p, owner, enemy, dt) {
  let bounced = false;
  const pad = 24;
  if (p.x < pad || p.x > GAME_SIZE - pad) {
    p.vx *= -1;
    bounced = true;
  }
  if (p.y < pad || p.y > GAME_SIZE - pad) {
    p.vy *= -1;
    bounced = true;
  }
  if (bounced) {
    p.bounces = (p.bounces || 0) - 1;
    p.x = clamp(p.x, pad, GAME_SIZE - pad);
    p.y = clamp(p.y, pad, GAME_SIZE - pad);
    if (p.bounces < 0) p.life = 0;
  }
  if (enemy && distToBladeWave(p, enemy) <= p.halfWidth + enemy.radius * 0.2 && !p.hit) {
    enemy.takeDamage(p.dmg || 3.2, owner, "blade-wave");
    const prev = enemy.hasStatus("bladeWindow") ? enemy.statuses.bladeWindow.count || 0 : 0;
    enemy.applyStatus("bladeWindow", 0.18, { count: prev + 1 });
    if (prev + 1 >= 2) {
      enemy.applyStatus("weak", 3, { source: owner });
      enemy.takeDamage(3.4, owner, "red-slash-bonus");
      enemy.statuses.bladeWindow.count = 0;
      game.spawnProjectile({ type: "red_slash", owner, x: enemy.x, y: enemy.y, life: 0.55, maxLife: 0.55, angle: game.rng.range(-0.8, 0.8) });
    }
    p.hit = true;
    p.life = 0;
  }
}

function distToBladeWave(p, target) {
  const dir = norm(p.vx, p.vy);
  const backX = p.x - dir.x * p.length;
  const backY = p.y - dir.y * p.length;
  const forward = (target.x - backX) * dir.x + (target.y - backY) * dir.y;
  if (forward < 0 || forward > p.length + target.radius) return Infinity;
  return distToSegment(target.x, target.y, backX, backY, p.x, p.y);
}

function updateCrystalWall(game, p, owner) {
  for (const target of game.fighters) {
    if (target === owner || target.hp <= 0) continue;
    p.touchCd ||= {};
    p.hitIds ||= {};
    p.touchCd[target.id] = Math.max(0, (p.touchCd[target.id] || 0) - game.dt);
    if (distToSegment(target.x, target.y, p.x1, p.y1, p.x2, p.y2) <= target.radius + 8) {
      const n = lineNormal(p.x1, p.y1, p.x2, p.y2, target.x, target.y);
      target.x += n.x * 7;
      target.y += n.y * 7;
      target.dir = reflectDir(target.dir, n.x, n.y);
      if (!p.hitIds[target.id]) {
        target.takeDamage(2.78, owner, "crystal-wall");
        p.hitIds[target.id] = true;
      }
      if (p.touchCd[target.id] <= 0) {
        target.applyStatus("push", 0.1, { x: n.x, y: n.y, strength: 520 });
        p.touchCd[target.id] = 0.2;
      }
    }
  }
}

function updateCrystalCage(game, p, owner, dt) {
  p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
  p.diamondX += p.vx * dt;
  p.diamondY += p.vy * dt;
  const dd = dist(p.diamondX, p.diamondY, p.x, p.y);
  if (dd > p.cageRadius - p.diamondRadius) {
    const n = norm(p.diamondX - p.x, p.diamondY - p.y);
    p.diamondX = p.x + n.x * (p.cageRadius - p.diamondRadius);
    p.diamondY = p.y + n.y * (p.cageRadius - p.diamondRadius);
    const r = reflectDir(norm(p.vx, p.vy), n.x, n.y);
    const sp = Math.hypot(p.vx, p.vy) || owner.baseSpeed * 4;
    p.vx = r.x * sp;
    p.vy = r.y * sp;
  }
  const prisoner = game.fighters.find((f) => f.id === p.prisonerId && f.hp > 0);
  if (!prisoner) return;
  const pd = dist(prisoner.x, prisoner.y, p.x, p.y);
  if (pd > p.cageRadius - prisoner.radius) {
    const n = norm(prisoner.x - p.x, prisoner.y - p.y);
    prisoner.x = p.x + n.x * (p.cageRadius - prisoner.radius);
    prisoner.y = p.y + n.y * (p.cageRadius - prisoner.radius);
    prisoner.dir = reflectDir(prisoner.dir, n.x, n.y);
  }
  if (p.hitCd <= 0 && dist(prisoner.x, prisoner.y, p.diamondX, p.diamondY) <= prisoner.radius + p.diamondRadius) {
    prisoner.takeDamage(2.9, owner, "diamond-prison");
    p.hitCd = 0.18;
  }
}

function updateVirusMinion(game, p, owner, enemy, dt) {
  if (!owner) return;
  p.mergeTimer = (p.mergeTimer || 0) - dt;
  if (enemy && dist(enemy.x, enemy.y, p.x, p.y) < 310) {
    const chase = norm(enemy.x - p.x, enemy.y - p.y);
    p.dir = norm((p.dir?.x || 0) * 0.72 + chase.x * 0.28, (p.dir?.y || 0) * 0.72 + chase.y * 0.28);
  }
  p.x += (p.dir?.x || 1) * (p.level === 1 ? 112 : p.level === 2 ? 78 : 54) * dt;
  p.y += (p.dir?.y || 0) * (p.level === 1 ? 112 : p.level === 2 ? 78 : 54) * dt;
  if (p.x < p.radius || p.x > GAME_SIZE - p.radius) p.dir.x *= -1;
  if (p.y < p.radius || p.y > GAME_SIZE - p.radius) p.dir.y *= -1;
  p.x = clamp(p.x, p.radius, GAME_SIZE - p.radius);
  p.y = clamp(p.y, p.radius, GAME_SIZE - p.radius);
  if (enemy && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius) {
    const dmg = p.level === 1 ? 0.82 : p.level === 2 ? 2.15 : 4.15;
    enemy.takeDamage(dmg, owner, "virus-contact");
    enemy.virusParasites ||= [];
    enemy.virusParasites.push({ level: p.level, source: owner, timer: 24, angle: game.rng.range(0, TAU) });
    p.hp -= p.level === 1 ? 99 : 4;
    if (p.hp <= 0) p.life = 0;
  }
}

function updateDrumWave(game, p, owner, enemy) {
  const progress = 1 - p.life / p.maxLife;
  const prevR = p.radius || 0;
  p.radius = lerp(8, p.maxRadius || Math.hypot(GAME_SIZE, GAME_SIZE), smoothstep(progress));
  p.hitIds ||= {};
  if (enemy && !p.hitIds[enemy.id]) {
    const d = dist(enemy.x, enemy.y, p.x, p.y);
    if (d <= p.radius + enemy.radius && d >= prevR - enemy.radius - 18) {
      const ratio = clamp(1 - d / Math.max(1, p.maxRadius || Math.hypot(GAME_SIZE, GAME_SIZE)), 0, 1);
      enemy.takeDamage(lerp(p.minDmg || 1, p.maxDmg || 9, ratio), owner, "drum-wave");
      p.hitIds[enemy.id] = true;
    }
  }
}

function updateMathFormula(game, p, owner, enemy, dt) {
  p.age = (p.age || 0) + dt;
  if (!p.launched && p.age >= (p.rage ? 0.95 : 1.18)) {
    p.launched = true;
    if (enemy) {
      const n = norm(enemy.x - p.x, enemy.y - p.y);
      p.vx = n.x * 690;
      p.vy = n.y * 690;
    }
  }
  if (p.launched && enemy && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + 30) {
    if (p.value >= 0) enemy.takeDamage(Math.abs(p.value), owner, p.rage ? "rage-formula" : "math-formula");
    else owner?.heal(Math.abs(p.value), true);
    p.life = 0;
  }
}

function updateMathV2Graph(game, p, owner, enemy, dt) {
  if (!enemy) return;
  p.hitCd ||= {};
  p.touchCount ||= {};
  p.hitCd[enemy.id] = Math.max(0, (p.hitCd[enemy.id] || 0) - dt);
  if (p.hitCd[enemy.id] <= 0 && distToGraphPoints(enemy.x, enemy.y, p.points || []) <= enemy.radius + (p.thick || 18)) {
    enemy.takeDamage(2.75, owner, "graph-wall");
    p.touchCount[enemy.id] = (p.touchCount[enemy.id] || 0) + 1;
    if (p.touchCount[enemy.id] >= 3) {
      enemy.takeDamage(6.2, owner, "function-collapse");
      p.touchCount[enemy.id] = 0;
    }
    p.hitCd[enemy.id] = 0.34;
  }
}

function distToGraphPoints(px, py, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    best = Math.min(best, distToSegment(px, py, a.x, a.y, b.x, b.y));
  }
  return best;
}

function updateSlimeChild(game, p, owner, enemy, dt) {
  if (!owner || owner.hp <= 0) {
    p.life = 0;
    return;
  }
  p.angle += dt * 3.5;
  p.x = owner.x + Math.cos(p.angle) * (owner.radius + 42);
  p.y = owner.y + Math.sin(p.angle) * (owner.radius + 42);
  if (enemy) {
    const pull = norm(enemy.x - p.x, enemy.y - p.y);
    p.x += pull.x * 52 * dt;
    p.y += pull.y * 52 * dt;
    p.hitCd ||= {};
    p.hitCd[enemy.id] = Math.max(0, (p.hitCd[enemy.id] || 0) - dt);
    if (dist(enemy.x, enemy.y, p.x, p.y) < enemy.radius + p.radius + 14 && p.hitCd[enemy.id] <= 0) {
      enemy.takeDamage(p.damage || 3.1, owner, "slime-child");
      enemy.applyStatus("slow", 0.9, { mult: 0.68 });
      p.damageDone = (p.damageDone || 0) + (p.damage || 3.1);
      p.hitCd[enemy.id] = 0.7;
    }
  }
}

function updatePirateAnchor(game, p, owner, enemy, dt) {
  if (!owner || !enemy) return;
  p.x1 = owner.x;
  p.y1 = owner.y;
  if (!p.triggered) {
    const n = norm(enemy.x - p.x2, enemy.y - p.y2);
    p.x2 += n.x * 680 * dt;
    p.y2 += n.y * 680 * dt;
    if (dist(enemy.x, enemy.y, p.x2, p.y2) <= enemy.radius + 26) {
      p.triggered = true;
      p.timer = 1.45;
      enemy.applyStatus("slow", 1.5, { mult: 0.3 });
      enemy.takeDamage(owner.isRage ? 5.8 : 4.6, owner, "anchor-hook");
    }
  } else {
    p.timer -= dt;
    const n = norm(owner.x - enemy.x, owner.y - enemy.y);
    enemy.data.positionLocked = true;
    enemy.x = clamp(enemy.x + n.x * 420 * dt, enemy.radius, GAME_SIZE - enemy.radius);
    enemy.y = clamp(enemy.y + n.y * 420 * dt, enemy.radius, GAME_SIZE - enemy.radius);
    if (p.timer <= 0) p.life = 0;
  }
}

function updatePirateLoot(game, p, owner, enemy, dt) {
  if (!owner) return;
  if (dist(owner.x, owner.y, p.x, p.y) <= owner.radius + p.radius) {
    if (p.kind === "treasure") {
      owner.heal(owner.isRage ? 6 : 4.2, true);
      owner.data.lootPower = Math.min(4, (owner.data.lootPower || 0) + 1);
    } else if (p.kind === "cannon") {
      const n = enemy ? norm(enemy.x - owner.x, enemy.y - owner.y) : owner.dir;
      game.spawnProjectile({
        type: "cannonball",
        owner,
        x: owner.x,
        y: owner.y,
        vx: n.x * 860,
        vy: n.y * 860,
        radius: 24,
        life: 2.5,
        maxLife: 2.5
      });
    } else {
      owner.applyStatus("speed", 2.8, { mult: 1.45 });
      owner.data.broadsideTimer = 1.6;
    }
    game.audioCue(owner, "skill_hit");
    p.life = 0;
    return;
  }
  const n = norm(owner.x - p.x, owner.y - p.y);
  p.x += n.x * 36 * dt;
  p.y += n.y * 36 * dt;
}

function updatePainterStroke(game, p, owner, enemy) {
  if (!enemy) return;
  p.hitCd ||= {};
  p.hitCd[enemy.id] = Math.max(0, (p.hitCd[enemy.id] || 0) - game.dt);
  if (distToSegment(enemy.x, enemy.y, p.x1, p.y1, p.x2, p.y2) <= (p.width || 62) + enemy.radius * 0.25) {
    if (p.kind === "red") enemy.applyStatus("paintRed", 0.7, { source: owner });
    if (p.kind === "blue") enemy.applyStatus("paintBlue", 0.7, { source: owner });
    if (p.kind === "yellow") owner?.applyStatus("painterGuard", 0.55, { source: owner });
    if (p.kind === "red" && p.hitCd[enemy.id] <= 0) {
      enemy.takeDamage(owner?.isRage ? 0.95 : 0.74, owner, "red-paint");
      p.hitCd[enemy.id] = 0.58;
    }
  }
}

function updateSuperfan(game, p, owner, enemy, dt) {
  if (!owner || !enemy) return;
  const n = norm(enemy.x - p.x, enemy.y - p.y);
  p.x += n.x * 165 * dt;
  p.y += n.y * 165 * dt;
  p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
  if (p.hitCd <= 0 && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius) {
    enemy.takeDamage(1.15, owner, "superfan");
    enemy.applyStatus("slow", 0.5, { mult: 0.82 });
    p.hitCd = 0.85;
  }
}

function updateMirrorZone(game, p, owner, enemy) {
  if (!owner || !enemy || p.triggered) return;
  const ownerInside = dist(owner.x, owner.y, p.x, p.y) <= p.radius + owner.radius * 0.3;
  const enemyInside = dist(enemy.x, enemy.y, p.x, p.y) <= p.radius + enemy.radius * 0.3;
  if (ownerInside && enemyInside) {
    p.triggered = true;
    p.life = Math.min(p.life, 0.7);
    owner.applyStatus("mirrorGuard", 3.4, { source: owner });
    enemy.applyStatus("abilityDisabled", p.kind === "whole" ? 2.2 : 1.1, { source: owner });
    enemy.takeDamage(p.kind === "whole" ? 5.25 : 2.85, owner, "mirror-gate");
    game.emitText(owner.x, owner.y - owner.radius - 78, p.kind === "whole" ? "WHOLE MIRROR" : "BROKEN MIRROR", "#e9f7ff");
  }
}

function updateStrawMonster(game, p, owner, enemy, dt) {
  if (!owner || !enemy) return;
  const n = norm(enemy.x - p.x, enemy.y - p.y);
  p.x += n.x * 225 * dt;
  p.y += n.y * 225 * dt;
  p.tick = (p.tick || 0) - dt;
  if (p.tick <= 0 && dist(enemy.x, enemy.y, p.x, p.y) <= enemy.radius + p.radius) {
    p.tick = 0.88;
    enemy.takeDamage(4.15, owner, "straw-monster");
    enemy.applyStatus("slow", 0.9, { mult: 0.75 });
  }
}

function stableProjectileCleanup(game) {
  for (let i = game.projectiles.length - 1; i >= 0; i -= 1) {
    const p = game.projectiles[i];
    if (!p || p.life <= 0 || p.hp <= 0 || (p.x !== undefined && (!Number.isFinite(p.x) || !Number.isFinite(p.y)))) {
      game.projectiles.splice(i, 1);
    }
  }
  for (const owner of game.fighters) {
    limitOwnedProjectiles(game, owner, "slime_child", SUMMON_LIMITS.slimeChildren);
    limitOwnedProjectiles(game, owner, "slime_mucus", SUMMON_LIMITS.slimeMucus);
    limitOwnedProjectiles(game, owner, "puppet_effigy", SUMMON_LIMITS.puppetEffigies, "order");
    limitOwnedProjectiles(game, owner, "straw_monster", SUMMON_LIMITS.puppetMonsters, "order");
    limitOwnedProjectiles(game, owner, "virus_minion", SUMMON_LIMITS.virusMinions);
    limitOwnedProjectiles(game, owner, "superfan", SUMMON_LIMITS.superstarFans);
    limitOwnedProjectiles(game, owner, "web_line", SUMMON_LIMITS.spiderWebs);
    limitOwnedProjectiles(game, owner, "pirate_loot", SUMMON_LIMITS.pirateLoot);
    limitOwnedProjectiles(game, owner, "painter_stroke", SUMMON_LIMITS.painterStrokes);
  }
  if (game.projectiles.length > game.config.projectileHardCap) {
    game.flagBug("infinite projectile", {
      count: game.projectiles.length,
      seed: game.seed,
      time: game.matchClock
    });
    game.projectiles.splice(0, game.projectiles.length - game.config.projectileHardCap);
  }
}

export function spawnSlimeChild(game, owner, angle, hp = 14, damage = 3.1) {
  const kids = game.projectiles.filter((p) => p.type === "slime_child" && p.owner === owner && p.hp > 0 && p.life > 0);
  if (kids.length >= SUMMON_LIMITS.slimeChildren) kids.sort((a, b) => (a.spawnTime || 0) - (b.spawnTime || 0))[0].life = 0;
  game.spawnProjectile({
    type: "slime_child",
    owner,
    angle,
    x: owner.x + Math.cos(angle) * (owner.radius + 42),
    y: owner.y + Math.sin(angle) * (owner.radius + 42),
    radius: 24,
    hp,
    damage,
    life: owner.isRage ? 7.2 : 5.4,
    maxLife: owner.isRage ? 7.2 : 5.4,
    hitCd: {},
    spawnTime: game.matchClock
  });
}

export function spawnCrystalCage(game, owner, enemy) {
  const center = { x: (owner.x + enemy.x) / 2, y: (owner.y + enemy.y) / 2 };
  const a = game.rng.range(0, TAU);
  game.spawnProjectile({
    type: "crystal_cage",
    owner,
    x: center.x,
    y: center.y,
    cageRadius: 170,
    diamondRadius: 28,
    diamondX: center.x + Math.cos(a) * 80,
    diamondY: center.y + Math.sin(a) * 80,
    vx: Math.cos(a + 1.1) * 720,
    vy: Math.sin(a + 1.1) * 720,
    prisonerId: enemy.id,
    hitCd: 0,
    life: owner.isRage ? 6.2 : 4.2,
    maxLife: owner.isRage ? 6.2 : 4.2
  });
}

export function spawnMathV2Graph(game, owner, label, fn) {
  const points = [];
  for (let i = 0; i <= 80; i += 1) {
    const xNorm = -1 + (i / 80) * 2;
    const yNorm = clamp(fn(xNorm), -1, 1);
    points.push({ x: 90 + i * (820 / 80), y: 500 - yNorm * 390 });
  }
  game.spawnProjectile({
    type: "math_v2_graph",
    owner,
    formula: label,
    points,
    thick: 18,
    hitCd: {},
    touchCount: {},
    life: owner.isRage ? 6.2 : 4.5,
    maxLife: owner.isRage ? 6.2 : 4.5
  });
}

export { pointOnRayToEdge };
