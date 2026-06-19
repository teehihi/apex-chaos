import { GAME_SIZE, SUMMON_LIMITS } from "./balanceConfig.js";
import { getVisual } from "./visualManifest.js";
import { clamp, dist, lerp, norm, TAU } from "../core/rng.js";
import { distToSegment } from "../core/collision.js";
import { pointOnRayToEdge, spawnCrystalCage, spawnMathV2Graph, spawnSlimeChild } from "../core/projectile.js";

const v = (name) => getVisual(name);
const abilityDt = (f, dt) => dt * f.cooldownRate();

function skill(game, fighter, label = "skill_cast") {
  fighter.skillsUsed += 1;
  game.audioCue(fighter, label);
}

function pushProjectile(game, p) {
  game.spawnProjectile({ spawnTime: game.matchClock, ...p });
}

function spawnWaveFromWall(game, owner, damage = 2.8) {
  const a = Math.atan2(GAME_SIZE / 2 - owner.y, GAME_SIZE / 2 - owner.x);
  const spread = owner.isRage ? [-0.14, 0.14] : [0];
  for (const off of spread) {
    const aa = a + off;
    pushProjectile(game, {
      type: "blade_wave",
      owner,
      x: owner.x,
      y: owner.y,
      vx: Math.cos(aa) * 960,
      vy: Math.sin(aa) * 960,
      halfWidth: 210,
      length: 330,
      life: 2.2,
      maxLife: 2.2,
      dmg: damage,
      bounces: owner.isRage ? 2 : 0,
      hit: false
    });
  }
}

function spawnVirusChildren(game, owner, count, level, x = owner.x, y = owner.y) {
  const live = game.projectiles.filter((p) => p.type === "virus_minion" && p.owner === owner && p.life > 0);
  for (let i = live.length; i >= SUMMON_LIMITS.virusMinions && live.length; i -= 1) live.shift().life = 0;
  const room = Math.max(0, SUMMON_LIMITS.virusMinions - game.projectiles.filter((p) => p.type === "virus_minion" && p.owner === owner && p.life > 0).length);
  for (let i = 0; i < Math.min(count, room); i += 1) {
    const a = game.rng.range(0, TAU);
    pushProjectile(game, {
      type: "virus_minion",
      owner,
      x: x + Math.cos(a) * game.rng.range(12, 55),
      y: y + Math.sin(a) * game.rng.range(12, 55),
      radius: level === 1 ? 15 : level === 2 ? 22 : 30,
      hp: level === 1 ? 1 : level === 2 ? 7 : 14,
      level,
      dir: norm(Math.cos(a), Math.sin(a)),
      mergeTimer: 4,
      spawnCd: 5.5,
      life: 22,
      maxLife: 22
    });
  }
}

function randomCard(game) {
  const suits = ["S", "H", "D", "C"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return { suit: game.rng.pick(suits), rank: game.rng.pick(ranks) };
}

function cardPoint(card, rage = false) {
  if (card.rank === "A") return rage ? 11 : 1;
  if (["J", "Q", "K"].includes(card.rank)) return rage ? 10 : 0;
  if (card.rank === "10") return rage ? 10 : 0;
  return Number(card.rank);
}

function mathExpression(game, owner, enemy, rage = false) {
  if (rage) {
    const rolls = [game.rng.int(-18, 24), game.rng.int(-16, 26), game.rng.int(-10, 22)];
    const value = clamp(rolls.reduce((a, b) => a + b, 0) / 2, -14, 30);
    return { formula: `${rolls[0]}+${rolls[1]}+${rolls[2]}`, value };
  }
  const x = Math.round(owner.x / 50);
  const y = Math.round(owner.y / 50);
  const a = Math.round(enemy.x / 50);
  const b = Math.max(1, Math.round(enemy.y / 50));
  let value = Math.round(((x - y) * a) / b);
  if (value === 0) value = game.rng.chance(0.5) ? -2 : 2;
  return { formula: `(${x}-${y})*${a}/${b}`, value: clamp(value, -10, 22) };
}

function makeMathV2Function(game) {
  const options = [
    { label: "sin(x*pi)", fn: (x) => Math.sin(x * Math.PI) },
    { label: "x^2-.5", fn: (x) => x * x - 0.5 },
    { label: "-x", fn: (x) => -x },
    { label: "abs(x)-.4", fn: (x) => Math.abs(x) - 0.4 },
    { label: "cos(2x)", fn: (x) => Math.cos(2 * x) * 0.75 }
  ];
  return game.rng.pick(options);
}

function addPirateLoot(game, owner) {
  const kinds = ["treasure", "cannon", "boat"];
  const kind = game.rng.pick(kinds);
  pushProjectile(game, {
    type: "pirate_loot",
    owner,
    kind,
    x: clamp(owner.x + game.rng.range(-220, 220), 90, 910),
    y: clamp(owner.y + game.rng.range(-220, 220), 90, 910),
    radius: 34,
    life: 8,
    maxLife: 8
  });
}

function spawnPainterStroke(game, owner, kind, x1, y1, x2, y2) {
  const color = kind === "red" ? "#ff4040" : kind === "blue" ? "#50a6ff" : "#ffd447";
  pushProjectile(game, {
    type: "painter_stroke",
    owner,
    kind,
    color,
    x1,
    y1,
    x2,
    y2,
    width: owner.isRage ? 84 : 64,
    life: owner.isRage ? 4 : 2.8,
    maxLife: owner.isRage ? 4 : 2.8,
    hitCd: {}
  });
}

function spawnSuperFans(game, owner, count = 2) {
  const live = game.projectiles.filter((p) => p.type === "superfan" && p.owner === owner && p.life > 0);
  while (live.length >= SUMMON_LIMITS.superstarFans) live.shift().life = 0;
  for (let i = 0; i < count; i += 1) {
    const a = game.rng.range(0, TAU);
    pushProjectile(game, {
      type: "superfan",
      owner,
      x: owner.x + Math.cos(a) * 40,
      y: owner.y + Math.sin(a) * 40,
      radius: 11,
      life: 16,
      maxLife: 16,
      hitCd: 0
    });
  }
}

export const rosterNames = [
  "RUBBER",
  "ICE",
  "VAMPIRE",
  "SPIDER",
  "VOLCANO",
  "MAGNET",
  "FLASH",
  "ELECTRIC",
  "ORBIT",
  "TOXIC",
  "MIRROR",
  "BLACK_HOLE",
  "SAW",
  "BLADE",
  "NOVA",
  "HUNTER",
  "CRYSTAL",
  "VIRUS",
  "DRUM",
  "CARD",
  "MATH",
  "MATH_V2",
  "SNIPER",
  "SLIME",
  "TIME",
  "WOLF",
  "PUPPET",
  "WITCH",
  "PIRATE",
  "PAINTER",
  "KUNGFU",
  "SUPERSTAR"
];

export const FighterTypes = [
  {
    name: "RUBBER",
    color: v("RUBBER").color,
    desc: "Kinetic bounce, red-rubber guard, learned sub-skill rhythm",
    speed: 508,
    startDx: 1,
    startDy: 0.55,
    init: (game, f) => {
      f.data.cd = 1.2;
      f.data.active = false;
      f.data.timer = 0;
      f.data.kinetic = 0;
      f.data.afterTier = 0;
      f.data.bounceBoost = 0;
    },
    speedModifier: (f) => (f.data.active ? 1.82 + (f.data.bounceBoost || 0) : f.data.afterTier >= 4 ? 1.18 : 1),
    update: (game, f, e, dt) => {
      if (f.data.active) {
        f.data.timer -= dt;
        if (f.data.timer <= 0) {
          f.data.active = false;
          f.data.cd = 5.8;
          f.data.afterTier = f.data.kinetic >= 5 ? 5 : f.data.kinetic >= 3 ? 4 : f.data.kinetic >= 2 ? 3 : 0;
          f.data.kinetic = 0;
        }
      } else {
        f.data.cd -= abilityDt(f, dt);
        if (f.data.cd <= 0) {
          f.data.active = true;
          f.data.timer = 4.4;
          f.data.kinetic = 0;
          f.data.bounceBoost = 0;
          skill(game, f);
        }
      }
      if (f.isRage) f.radius = f.baseRadius * (1.18 + (50 - Math.max(0, f.hp)) * 0.004);
    },
    onWallBounce: (game, f) => {
      if (f.data.active) {
        f.data.kinetic = Math.min(9, (f.data.kinetic || 0) + 1);
        f.data.bounceBoost = Math.min(0.95, (f.data.bounceBoost || 0) + 0.12);
        f.data.timer = Math.min(5.8, (f.data.timer || 0) + 0.22);
      }
    },
    onCollide: (game, f, e) => {
      if (!f.data.active && f.data.afterTier < 4) return false;
      const kinetic = f.data.active ? f.data.kinetic || 0 : 3;
      const dmg = (f.data.active ? 2.0 : 1.3) + kinetic * 0.52 + Math.max(0, f.radius / f.baseRadius - 1) * 3;
      e.takeDamage(dmg, f, f.data.active ? "kinetic-bounce" : "red-rubber-impact");
      const n = norm(e.x - f.x, e.y - f.y);
      e.applyStatus("push", 0.2, { x: n.x, y: n.y, strength: 820 + kinetic * 80 });
      if (f.data.active) f.data.kinetic = 0;
      return true;
    }
  },
  {
    name: "ICE",
    color: v("ICE").color,
    desc: "Frost lane, slow field, dart execution",
    speed: 480,
    startDx: 1,
    startDy: 0.75,
    init: (game, f) => {
      f.data.cd = 1.5;
      f.data.laneActive = false;
      f.data.rageTouches = {};
    },
    update: (game, f, e, dt) => {
      f.data.bumpCd = Math.max(0, (f.data.bumpCd || 0) - dt);
      if (!f.data.laneActive) f.data.cd -= abilityDt(f, dt);
      if (!f.data.laneActive && f.data.cd <= 0) {
        const a = Math.atan2(e.y - f.y, e.x - f.x);
        const far = pointOnRayToEdge(f.x, f.y, Math.cos(a), Math.sin(a));
        pushProjectile(game, { type: "ice_lane", owner: f, x1: f.x, y1: f.y, x2: far.x, y2: far.y, halfWidth: 190, life: 6.5, maxLife: 6.5, enemyInside: 0, dmgTick: 0 });
        f.data.laneActive = true;
        skill(game, f);
      }
    },
    onCollide: (game, f, e) => {
      f.data.bumpCd = Math.max(0, f.data.bumpCd || 0);
      if (f.data.bumpCd <= 0) {
        f.data.bumpCd = 1.1;
        e.takeDamage(1.25, f, "frost-contact");
        e.applyStatus("slow", 0.65, { mult: 0.72 });
      }
      if (!f.isRage) return false;
      const rec = f.data.rageTouches[e.id] || { n: 0, t: 0 };
      if (game.matchClock - rec.t > 6) rec.n = 0;
      rec.n += 1;
      rec.t = game.matchClock;
      f.data.rageTouches[e.id] = rec;
      if (rec.n >= 3) {
        e.applyStatus("freeze", 1.8, { source: f, dartTotal: game.rng.range(8, 13) });
        e.applyStatus("frostMark", 8, { source: f });
        rec.n = 0;
      }
      return false;
    }
  },
  {
    name: "VAMPIRE",
    color: v("VAMPIRE").color,
    desc: "Fixed-contact bite and permanent blood link",
    speed: 528,
    startDx: 1,
    startDy: 0.25,
    init: (game, f) => {
      f.data.latchTimer = 0;
      f.data.latchCd = 0;
      f.data.latchTick = 0;
      f.data.bloodLinkLevel = 0;
      f.data.linkTick = 0;
    },
    update: (game, f, e, dt) => {
      if (f.data.latchTimer > 0) {
        f.data.positionLocked = true;
        f.data.latchTimer -= dt;
        const off = f.data.latchOffset || norm(f.x - e.x, f.y - e.y);
        const gap = e.radius + f.radius + 2;
        f.x = clamp(e.x + off.x * gap, f.radius, GAME_SIZE - f.radius);
        f.y = clamp(e.y + off.y * gap, f.radius, GAME_SIZE - f.radius);
        f.setDir(e.x - f.x, e.y - f.y);
        e.applyStatus("slow", 0.18, { mult: 0.34 });
        f.data.latchTick += dt;
        while (f.data.latchTick >= 0.55) {
          f.data.latchTick -= 0.55;
          e.takeDamage(1.52, f, "blood-drain");
          f.heal(1.34, true);
        }
        if (f.data.latchTimer <= 0) f.data.latchCd = 2.05;
      } else {
        f.data.latchCd = Math.max(0, f.data.latchCd - abilityDt(f, dt));
      }
      if (f.isRage && f.data.bloodLinkLevel > 0) {
        f.data.linkTick += dt;
        while (f.data.linkTick >= 0.65) {
          f.data.linkTick -= 0.65;
          const d = 0.38 * f.data.bloodLinkLevel;
          e.takeDamage(d, f, "permanent-blood-link", { status: true });
          f.heal(d * 0.85, true);
        }
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.latchCd <= 0 && f.data.latchTimer <= 0) {
        f.data.latchOffset = norm(f.x - e.x, f.y - e.y);
        f.data.latchTimer = 4.2;
        f.data.latchTick = 0;
        if (f.isRage) f.data.bloodLinkLevel = Math.min(8, (f.data.bloodLinkLevel || 0) + 1);
        skill(game, f, "skill_hit");
      }
      return false;
    }
  },
  {
    name: "SPIDER",
    color: v("SPIDER").color,
    desc: "Living snare web network",
    speed: 500,
    startDx: 0.7,
    startDy: 1,
    init: () => {},
    speedModifier: (f) => (f.isRage ? 1 + Math.max(0, (f.rageStartHp ?? f.hp) - f.hp) * 0.014 : 1),
    onWallBounce: (game, f, side) => {
      const anchor = { x: f.x, y: f.y };
      if (side === "left") anchor.x = 0;
      if (side === "right") anchor.x = GAME_SIZE;
      if (side === "top") anchor.y = 0;
      if (side === "bottom") anchor.y = GAME_SIZE;
      pushProjectile(game, { type: "web_line", owner: f, x1: anchor.x, y1: anchor.y, x2: f.x, y2: f.y, hitCd: {}, life: Infinity, maxLife: Infinity });
      skill(game, f);
    }
  },
  {
    name: "VOLCANO",
    color: v("VOLCANO").color,
    desc: "Meteor disaster and burning pits",
    speed: 420,
    startDx: 1,
    startDy: 1,
    init: (game, f) => {
      f.data.cd = 1.8;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = f.isRage ? 9.3 : 10.6;
        const count = f.isRage ? 9 : 7;
        let delay = 0.18;
        for (let i = 0; i < count; i += 1) {
          delay += game.rng.range(0.12, 0.38);
          const predictedX = clamp(e.x + e.dir.x * e.baseSpeed * 0.5 + game.rng.range(-105, 105), 95, 905);
          const predictedY = clamp(e.y + e.dir.y * e.baseSpeed * 0.5 + game.rng.range(-105, 105), 95, 905);
          pushProjectile(game, {
            type: "meteor",
            owner: f,
            x: i < 4 ? predictedX : game.rng.range(100, 900),
            y: i < 4 ? predictedY : game.rng.range(100, 900),
            radius: 82,
            delay,
            life: delay + 0.25,
            maxLife: delay + 0.25,
            hit: false,
            damage: f.isRage ? 7.8 : 7.0
          });
        }
        skill(game, f);
      }
    }
  },
  {
    name: "MAGNET",
    color: v("MAGNET").color,
    desc: "Two-pole magnetic slam field",
    speed: 466,
    startDx: 1,
    startDy: -0.75,
    init: (game, f) => {
      f.data.cd = 2.3;
      f.data.fieldTimer = 0;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = 6.7;
        f.data.fieldTimer = 2.9;
        pushProjectile(game, { type: "magnet_field", owner: f, radius: 295, life: 2.9, maxLife: 2.9, hitCd: {}, slamCd: 0 });
        skill(game, f);
      }
      if (f.data.fieldTimer > 0) {
        f.data.fieldTimer -= dt;
        const shell = 292;
        if (f.x < shell) f.setDir(1, f.dir.y);
        if (f.x > GAME_SIZE - shell) f.setDir(-1, f.dir.y);
        if (f.y < shell) f.setDir(f.dir.x, 1);
        if (f.y > GAME_SIZE - shell) f.setDir(f.dir.x, -1);
        f.x = clamp(f.x, shell, GAME_SIZE - shell);
        f.y = clamp(f.y, shell, GAME_SIZE - shell);
      }
    }
  },
  {
    name: "FLASH",
    color: v("FLASH").color,
    desc: "Lightning dash and readable zigzag rage",
    speed: 600,
    startDx: 1,
    startDy: 0.8,
    init: (game, f) => {
      f.data.cd = 2;
      f.data.dashTimer = 0;
      f.data.dashHitIds = {};
      f.data.rageCd = 1.2;
      f.data.ragePrep = 0;
      f.data.zigzag = null;
      f.data.zigIndex = 0;
      f.data.zigTimer = 0;
    },
    speedModifier: (f) => (f.data.dashTimer > 0 ? (f.data.zigTimer > 0 ? 8.6 : 4.8) : f.data.ragePrep > 0 ? 0.12 : 1),
    update: (game, f, e, dt) => {
      if (f.isRage) {
        if (f.data.ragePrep > 0) {
          f.data.ragePrep -= dt;
          f.applyStatus("immune", 0.08, { source: f });
          f.data.dashTimer = Math.max(f.data.dashTimer || 0, 0.12);
          if (f.data.ragePrep <= 0) {
            const pts = [{ x: f.x, y: f.y }];
            const rows = [150, 310, 470, 630, 790];
            const leftFirst = game.rng.chance(0.5);
            for (let i = 0; i < rows.length; i += 1) pts.push({ x: leftFirst === (i % 2 === 0) ? game.rng.range(110, 260) : game.rng.range(740, 890), y: clamp(rows[i] + game.rng.range(-65, 65), 95, 905) });
            f.data.zigzag = pts;
            f.data.zigIndex = 1;
            f.data.zigTimer = 1.8;
            f.data.dashHitIds = {};
            skill(game, f);
          }
          return;
        }
        if (f.data.zigTimer > 0 && f.data.zigzag) {
          f.data.zigTimer -= dt;
          f.applyStatus("immune", 0.08, { source: f });
          f.data.dashTimer = 0.12;
          const target = f.data.zigzag[f.data.zigIndex];
          if (target) {
            f.setDir(target.x - f.x, target.y - f.y);
            if (dist(f.x, f.y, target.x, target.y) < 34) f.data.zigIndex += 1;
          }
          if (!target || f.data.zigTimer <= 0 || f.data.zigIndex >= f.data.zigzag.length) {
            f.data.zigTimer = 0;
            f.data.zigzag = null;
            f.data.dashTimer = 0;
            f.data.rageCd = 2.4;
          }
          return;
        }
        f.data.rageCd -= abilityDt(f, dt);
        if (f.data.rageCd <= 0) {
          f.data.rageCd = 4;
          f.data.ragePrep = 0.75;
          game.emitText(f.x, f.y - f.radius - 66, "DRAW ZIGZAG", f.color);
          return;
        }
      }
      if (f.data.dashTimer > 0) {
        f.data.dashTimer -= dt;
        f.data.phaseDash = 0.08;
        f.applyStatus("immune", 0.05, { source: f });
        if (f.data.dashTimer <= 0) f.data.dashHitIds = {};
      } else {
        f.data.cd -= abilityDt(f, dt);
        if (f.data.cd <= 0) {
          f.data.cd = 6.2;
          f.data.dashTimer = 0.36;
          f.data.dashHitIds = {};
          f.setDir(e.x - f.x, e.y - f.y);
          skill(game, f);
        }
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.dashTimer > 0 && !f.data.dashHitIds[e.id]) {
        f.data.dashHitIds[e.id] = true;
        const dmg = f.data.zigTimer > 0 ? 8.4 : 5.4;
        e.takeDamage(dmg, f, f.data.zigTimer > 0 ? "flash-zigzag" : "flash-dash");
        return true;
      }
      return false;
    }
  },
  {
    name: "ELECTRIC",
    color: v("ELECTRIC").color,
    desc: "Wall-hit charge discharge on contact",
    speed: 500,
    startDx: 1,
    startDy: -1,
    noRage: true,
    init: (game, f) => {
      f.data.wallHits = 0;
      f.data.wallNodes = [];
      f.data.nodeWallCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.nodeWallCd = Math.max(0, f.data.nodeWallCd - dt);
    },
    onWallBounce: (game, f, side) => {
      if (f.data.nodeWallCd > 0) return;
      f.data.nodeWallCd = 0.08;
      f.data.wallHits = Math.min(9, (f.data.wallHits || 0) + 1);
      const pnt = { x: f.x, y: f.y };
      if (side === "left") pnt.x = 0;
      if (side === "right") pnt.x = GAME_SIZE;
      if (side === "top") pnt.y = 0;
      if (side === "bottom") pnt.y = GAME_SIZE;
      f.data.wallNodes.push(pnt);
      if (f.data.wallNodes.length > 18) f.data.wallNodes.shift();
      pushProjectile(game, { type: "electric_node", owner: f, x: pnt.x, y: pnt.y, radius: 18, life: 2.5, maxLife: 2.5, visualOnly: true });
    },
    onCollide: (game, f, e) => {
      const charges = f.data.wallHits || 0;
      if (charges <= 0) return false;
      const lost = Math.max(0, f.maxHp - f.hp);
      const dmg = 0.0029 * (lost + 13) * Math.pow(2, charges);
      e.takeDamage(dmg, f, "electric-contact");
      game.emitText(e.x, e.y - e.radius - 65, `DISCHARGE ${charges}`, "#bde5ff");
      f.data.wallHits = 0;
      f.data.wallNodes = [];
      skill(game, f, "skill_hit");
      return false;
    }
  },
  {
    name: "ORBIT",
    color: v("ORBIT").color,
    desc: "Random elemental satellite system",
    speed: 425,
    startDx: 1,
    startDy: 1,
    init: (game, f) => {
      f.data.cd = 2.2;
      f.data.theta = 0;
      f.data.sats = [newOrbitSat(game, 0), newOrbitSat(game, Math.PI)];
      f.data.rageCd = 0;
    },
    update: (game, f, e, dt) => {
      const full = f.data.sats.length >= 6;
      f.data.theta += dt * (full ? 5.4 : 4.1);
      f.data.cd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = 6.2;
        while (f.data.sats.length < 6 && game.rng.chance(0.65)) f.data.sats.push(newOrbitSat(game, game.rng.range(0, TAU)));
        if (f.data.sats.length < 6) f.data.sats.push(newOrbitSat(game, game.rng.range(0, TAU)));
        skill(game, f);
      }
      if (f.isRage) {
        f.data.rageCd -= abilityDt(f, dt);
        if (f.data.rageCd <= 0 && f.data.sats.length < 6) {
          f.data.rageCd = 1.8;
          const sat = newOrbitSat(game, game.rng.range(0, TAU));
          sat.ring = 2;
          f.data.sats.push(sat);
        }
      }
      for (let i = f.data.sats.length - 1; i >= 0; i -= 1) {
        const sat = f.data.sats[i];
        sat.cd = Math.max(0, sat.cd - dt);
        const rad = sat.ring === 2 ? 170 : full ? 146 : 128;
        const sx = f.x + Math.cos(f.data.theta + sat.a) * rad;
        const sy = f.y + Math.sin(f.data.theta + sat.a) * rad;
        if (sat.cd <= 0 && dist(sx, sy, e.x, e.y) < 24 + e.radius) {
          e.takeDamage(2.05, f, "satellite");
          applyOrbitEffect(e, f, sat);
          sat.hp -= 1;
          sat.cd = 0.58;
          if (sat.hp <= 0) f.data.sats.splice(i, 1);
        }
      }
    }
  },
  {
    name: "TOXIC",
    color: v("TOXIC").color,
    desc: "Poison trail, venom siphon, toxic break",
    speed: 445,
    startDx: 0.7,
    startDy: 1,
    init: (game, f) => {
      f.data.drop = 0;
      f.data.collisionCd = 0;
      f.data.spitCd = 2.4;
    },
    update: (game, f, e, dt) => {
      f.data.drop -= dt;
      if (f.data.drop <= 0) {
        f.data.drop = 0.18;
        pushProjectile(game, { type: "toxic_trail", owner: f, x: f.x, y: f.y, radius: 32, life: 2.8, maxLife: 2.8 });
      }
      f.data.spitCd -= abilityDt(f, dt);
      if ((f.isRage || f.hp < 72) && f.data.spitCd <= 0) {
        f.data.spitCd = f.isRage ? 2.4 : 3.5;
        const d = norm(e.x - f.x, e.y - f.y);
        pushProjectile(game, { type: "toxic_shot", owner: f, x: f.x, y: f.y, vx: d.x * 900, vy: d.y * 900, radius: 38, life: 2.1, maxLife: 2.1 });
        skill(game, f);
      }
      f.data.collisionCd = Math.max(0, f.data.collisionCd - dt);
    },
    onCollide: (game, f) => {
      if (f.data.collisionCd <= 0) {
        f.data.collisionCd = 1.05;
        for (let i = 0; i < 5; i += 1) pushProjectile(game, { type: "toxic_puddle", owner: f, x: clamp(f.x + game.rng.range(-90, 90), 50, 950), y: clamp(f.y + game.rng.range(-90, 90), 50, 950), radius: 50, life: 3.2, maxLife: 3.2 });
        f.takeDamage(0.8, f, "self-toxic");
      }
      return false;
    }
  },
  {
    name: "MIRROR",
    color: v("MIRROR").color,
    desc: "Whole and broken gate, copy-through disruption",
    speed: 452,
    startDx: 1,
    startDy: 0.15,
    init: (game, f) => {
      f.data.cd = 2.5;
      f.data.reflectCd = 0;
      f.data.shatterCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      f.data.reflectCd = Math.max(0, f.data.reflectCd - dt);
      f.data.shatterCd = Math.max(0, f.data.shatterCd - dt);
      if (f.data.cd <= 0) {
        f.data.cd = f.isRage ? 6.7 : 8;
        const pair = `${f.id}-${game.matchClock.toFixed(2)}-${game.rng.int(1, 9999)}`;
        for (const kind of ["broken", "whole"]) {
          pushProjectile(game, { type: "mirror_zone", owner: f, pair, kind, x: game.rng.range(210, 790), y: game.rng.range(210, 790), radius: kind === "whole" ? 190 : 170, life: 7.2, maxLife: 7.2, triggered: false });
        }
        skill(game, f);
      }
    },
    onTakeDamage: (game, f, amount, source) => {
      if (source && f.hasStatus("mirrorGuard") && f.data.reflectCd <= 0) {
        f.data.reflectCd = 0.7;
        source.takeDamage(amount * (f.isRage ? 0.46 : 0.3), f, "mirror-reflect");
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.shatterCd > 0) return false;
      f.data.shatterCd = f.isRage ? 0.95 : 1.25;
      e.takeDamage(f.isRage ? 2.7 : 1.85, f, "mirror-shatter-contact");
      if (f.isRage) e.applyStatus("slow", 0.8, { mult: 0.75 });
      return false;
    }
  },
  {
    name: "BLACK_HOLE",
    color: v("BLACK_HOLE").color,
    desc: "Gravity well, pull collapse, rage absorption",
    speed: 390,
    startDx: 1,
    startDy: -0.55,
    init: (game, f) => {
      f.data.cd = 1.6;
      f.data.contactCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      f.data.contactCd = Math.max(0, f.data.contactCd - dt);
      if (f.data.cd <= 0) {
        f.data.cd = f.isRage ? 6.4 : 7.4;
        pushProjectile(game, { type: "gravity_well", owner: f, x: f.x, y: f.y, core: 94, radius: 205, life: 3.0, maxLife: 3.0, exploded: false, absorbed: 0, absorbedDamage: 0 });
        skill(game, f);
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.contactCd > 0) return false;
      f.data.contactCd = f.isRage ? 0.9 : 1.2;
      e.takeDamage(f.isRage ? 2.6 : 1.7, f, "event-horizon-contact");
      e.applyStatus("slow", 0.7, { mult: 0.78 });
      return false;
    }
  },
  {
    name: "SAW",
    color: v("SAW").color,
    desc: "Spin saw and bleed rip",
    speed: 485,
    startDx: 1,
    startDy: 0.28,
    init: (game, f) => {
      f.data.cd = 1.5;
      f.data.spin = 0;
      f.data.hitCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.hitCd = Math.max(0, f.data.hitCd - dt);
      if (f.data.spin > 0) {
        f.data.spin -= dt;
        if (dist(f.x, f.y, e.x, e.y) <= f.radius + e.radius + 42 && f.data.hitCd <= 0) {
          f.data.hitCd = 0.24;
          let dmg = f.isRage ? 4.6 : 3.8;
          if (e.hasStatus("bleed")) dmg += 2.6 + Math.max(0, e.maxHp - e.hp) * 0.025;
          e.takeDamage(dmg, f, "blood-rip-saw");
          e.applyStatus("bleed", 4.2, { source: f });
        }
      } else {
        f.data.cd -= abilityDt(f, dt);
        if (f.data.cd <= 0) {
          f.data.cd = 4.8;
          f.data.spin = f.isRage ? 4.2 : 3.5;
          skill(game, f);
        }
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.spin > 0 && f.data.hitCd <= 0) {
        f.data.hitCd = 0.22;
        e.takeDamage(f.isRage ? 4.5 : 3.6, f, "saw-contact");
        e.applyStatus("bleed", 4, { source: f });
        return true;
      }
      return false;
    }
  },
  {
    name: "BLADE",
    color: v("BLADE").color,
    desc: "Wall blade wave and red slash weakness",
    speed: 535,
    startDx: 1,
    startDy: 0.48,
    init: () => {},
    onWallBounce: (game, f) => {
      spawnWaveFromWall(game, f, f.isRage ? 4.05 : 3.35);
      skill(game, f);
    },
    onCollide: (game, f, e) => {
      if (!f.isRage || f.data.rageHitCd > 0) return false;
      f.data.rageHitCd = 1.2;
      e.applyStatus("bladeWeak", 2.8, { source: f });
      e.takeDamage(2.55, f, "blade-graze");
      return false;
    },
    update: (game, f, e, dt) => {
      f.data.rageHitCd = Math.max(0, (f.data.rageHitCd || 0) - dt);
    }
  },
  {
    name: "NOVA",
    color: v("NOVA").color,
    desc: "Eight-second peak charge, contact nova",
    speed: 410,
    startDx: 1,
    startDy: -0.35,
    init: (game, f) => {
      f.data.chargeTime = 0;
    },
    update: (game, f, e, dt) => {
      const prev = f.data.chargeTime;
      f.data.chargeTime = clamp(f.data.chargeTime + abilityDt(f, dt), 0, 15);
      if (prev < 8 && f.data.chargeTime >= 8) {
        const ratio = clamp(1 - dist(f.x, f.y, e.x, e.y) / Math.hypot(GAME_SIZE, GAME_SIZE), 0, 1);
        e.takeDamage(8 + 36 * ratio, f, "nova-peak-auto");
        f.data.chargeTime = 0;
        skill(game, f, "death_or_finisher");
      }
    },
    onCollide: (game, f, e) => {
      const dmg = novaDamage(f.data.chargeTime);
      if (dmg > 0.8) {
        e.takeDamage(dmg, f, "nova-contact");
        if (f.isRage && game.rng.chance(0.35)) e.takeDamage(dmg * 0.42, f, "nova-double");
        f.data.chargeTime = 0;
        return true;
      }
      return false;
    }
  },
  {
    name: "HUNTER",
    color: v("HUNTER").color,
    desc: "Hunt mode, traps, weak-point strike",
    speed: 492,
    startDx: 1,
    startDy: 0.62,
    init: (game, f) => {
      f.data.cd = 1.3;
      f.data.hunt = 0;
      f.data.trapCd = 3.2;
      f.data.hitCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.hitCd = Math.max(0, f.data.hitCd - dt);
      f.data.hunt = Math.max(0, f.data.hunt - dt);
      f.data.cd -= abilityDt(f, dt);
      f.data.trapCd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = 7.2;
        f.data.hunt = f.isRage ? 5 : 3.8;
        e.applyStatus("weak", 3.2, { source: f });
        skill(game, f);
      }
      if (f.data.trapCd <= 0) {
        f.data.trapCd = 6.4;
        pushProjectile(game, { type: "wolf_scent", owner: f, x: e.x, y: e.y, radius: 95, life: 3.6, maxLife: 3.6 });
      }
    },
    speedModifier: (f) => (f.data.hunt > 0 ? 1.22 : 1),
    onCollide: (game, f, e) => {
      if (f.data.hitCd > 0) return false;
      f.data.hitCd = 0.52;
      if (f.data.hunt > 0) {
        e.takeDamage(f.isRage ? 6.4 : 5.1, f, "hunt-strike");
        e.applyStatus("weak", 4, { source: f });
        f.data.hunt = 0;
      } else {
        e.takeDamage(1.2, f, "hunter-bump");
      }
      return false;
    }
  },
  {
    name: "CRYSTAL",
    color: v("CRYSTAL").color,
    desc: "Crystal wall and diamond cage",
    speed: 420,
    startDx: 1,
    startDy: -0.7,
    init: (game, f) => {
      f.data.cd = 1.5;
      f.data.cageCd = 5.5;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      f.data.cageCd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = 2.72;
        const a = Math.atan2(e.y - f.y, e.x - f.x) + Math.PI / 2;
        const len = 170;
        const cx = (f.x + e.x) / 2;
        const cy = (f.y + e.y) / 2;
        pushProjectile(game, { type: "crystal_wall", owner: f, x1: cx - Math.cos(a) * len, y1: cy - Math.sin(a) * len, x2: cx + Math.cos(a) * len, y2: cy + Math.sin(a) * len, life: f.isRage ? 6.5 : 4.2, maxLife: f.isRage ? 6.5 : 4.2, hitIds: {}, touchCd: {} });
        skill(game, f);
      }
      if (f.data.cageCd <= 0) {
        f.data.cageCd = f.isRage ? 8.0 : 10.1;
        spawnCrystalCage(game, f, e);
      }
    }
  },
  {
    name: "VIRUS",
    color: v("VIRUS").color,
    desc: "Minion exposure and parasite debuffs",
    speed: 398,
    startDx: 1,
    startDy: 0.25,
    init: (game, f) => {
      f.data.spawnCd = 1.8;
      f.data.mergeCd = 5;
    },
    update: (game, f, e, dt) => {
      f.data.spawnCd -= abilityDt(f, dt);
      f.data.mergeCd -= dt;
      if (f.data.spawnCd <= 0) {
        f.data.spawnCd = f.isRage ? 3.25 : 4.3;
        spawnVirusChildren(game, f, f.isRage ? 4 : 3, 1);
        skill(game, f);
      }
      if (f.data.mergeCd <= 0) {
        f.data.mergeCd = 5.5;
        const kids = game.projectiles.filter((p) => p.type === "virus_minion" && p.owner === f && p.level === 1 && p.life > 0).slice(0, 3);
        if (kids.length >= 3) {
          const x = kids.reduce((s, p) => s + p.x, 0) / kids.length;
          const y = kids.reduce((s, p) => s + p.y, 0) / kids.length;
          kids.forEach((p) => (p.life = 0));
          spawnVirusChildren(game, f, 1, 2, x, y);
        }
      }
    }
  },
  {
    name: "DRUM",
    color: v("DRUM").color,
    desc: "Arena sound waves and rage solo guard",
    speed: 405,
    startDx: 1,
    startDy: 0.9,
    init: (game, f) => {
      f.data.wallWaveCd = 0;
      f.data.rageSolo = 0;
      f.data.rageBeatTick = 0;
      f.data.rageBeatsLeft = 0;
    },
    onRage: (game, f) => {
      f.data.rageSolo = 5;
      f.data.rageBeatTick = 0.2;
      f.data.rageBeatsLeft = 5;
    },
    update: (game, f, e, dt) => {
      f.data.wallWaveCd = Math.max(0, f.data.wallWaveCd - dt);
      if (f.data.rageSolo > 0) {
        f.data.rageSolo -= dt;
        f.applyStatus("immune", 0.05, { source: f });
        f.data.rageBeatTick -= dt;
        if (f.data.rageBeatTick <= 0 && f.data.rageBeatsLeft > 0) {
          f.data.rageBeatTick = 1;
          f.data.rageBeatsLeft -= 1;
          pushProjectile(game, { type: "drum_wave", owner: f, x: f.x, y: f.y, radius: 8, maxRadius: 1415, life: 1, maxLife: 1, minDmg: 1.45, maxDmg: 2.5 });
          skill(game, f);
        }
      }
    },
    onWallBounce: (game, f) => {
      if (f.data.wallWaveCd <= 0) {
        f.data.wallWaveCd = f.isRage ? 1.3 : 2.1;
        pushProjectile(game, { type: "drum_wave", owner: f, x: f.x, y: f.y, radius: 8, maxRadius: 1415, life: 1, maxLife: 1, minDmg: 1, maxDmg: f.isRage ? 7.75 : 5.85 });
      }
    }
  },
  {
    name: "CARD",
    color: v("CARD").color,
    desc: "Cao draw, face-card pressure, joker rage",
    speed: 455,
    startDx: 1,
    startDy: -0.32,
    init: (game, f) => {
      f.data.cd = 1.7;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = f.isRage ? 4.25 : 5.05;
        const hand = [randomCard(game), randomCard(game), randomCard(game)];
        const total = hand.reduce((s, c) => s + cardPoint(c, f.isRage), 0);
        const dmg = f.isRage ? clamp(total, 5, 25) : Math.max(3, total % 10);
        pushProjectile(game, { type: "card_throw", owner: f, enemy: e, x: f.x, y: f.y, hand, dmg, rage: f.isRage, radius: 30, life: 3.2, maxLife: 3.2 });
        skill(game, f);
      }
    }
  },
  {
    name: "MATH",
    color: v("MATH").color,
    desc: "Formula projectile with positive damage or negative heal",
    speed: 432,
    startDx: 1,
    startDy: 0.5,
    init: (game, f) => {
      f.data.cd = 1.9;
    },
    update: (game, f, e, dt) => {
      f.data.cd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.cd = f.isRage ? 3.9 : 4.7;
        const expr = mathExpression(game, f, e, f.isRage);
        pushProjectile(game, { type: "math_formula", owner: f, enemy: e, formula: expr.formula, value: expr.value, rage: f.isRage, life: 4.2, maxLife: 4.2, phase: "typing", age: 0, x: f.x, y: f.y, hit: false, launched: false, vx: 0, vy: 0 });
        skill(game, f);
      }
    }
  },
  {
    name: "MATH_V2",
    color: v("MATH_V2").color,
    desc: "Function graph battlefield",
    speed: 420,
    startDx: 1,
    startDy: -0.45,
    init: (game, f) => {
      f.data.cd = 1.6;
      f.data.phase = "idle";
      f.data.timer = 0;
    },
    update: (game, f, e, dt) => {
      const hasGraph = game.projectiles.some((p) => p.type === "math_v2_graph" && p.owner === f && p.life > 0);
      if (f.data.phase === "typing") {
        f.data.timer -= dt;
        if (f.data.timer <= 0) {
          spawnMathV2Graph(game, f, f.data.option.label, f.data.option.fn);
          f.data.phase = "idle";
          f.data.cd = f.isRage ? 1.2 : 5.2;
        }
        return;
      }
      if (!hasGraph) {
        f.data.cd -= abilityDt(f, dt);
        if (f.data.cd <= 0) {
          f.data.option = makeMathV2Function(game);
          f.data.phase = "typing";
          f.data.timer = f.isRage ? 1.1 : 2.5;
          pushProjectile(game, { type: "math_v2_grid", owner: f, x: 500, y: 500, life: f.data.timer + 4.5, maxLife: f.data.timer + 4.5, formula: f.data.option.label });
          skill(game, f);
        }
      }
    }
  },
  {
    name: "SNIPER",
    color: v("SNIPER").color,
    desc: "Distance-scaled aim shot and rage reload",
    speed: 382,
    startDx: 1,
    startDy: 0.2,
    init: (game, f) => {
      f.data.cd = 1.4;
      f.data.aim = 0;
      f.data.aimMax = 0;
      f.data.reload = 0;
    },
    update: (game, f, e, dt) => {
      if (f.data.aim > 0) {
        f.data.positionLocked = true;
        f.data.aim -= dt;
        f.setDir(e.x - f.x, e.y - f.y);
        if (f.data.aim <= 0) fireSniper(game, f, e);
        return;
      }
      f.data.cd -= abilityDt(f, dt);
      if (f.data.cd <= 0) {
        f.data.aim = f.isRage ? 0.72 : 1.05;
        f.data.aimMax = f.data.aim;
        f.data.cd = f.isRage ? 5.4 : 7.2;
      }
    }
  },
  {
    name: "SLIME",
    color: v("SLIME").color,
    desc: "Finite child guard, mucus, gel armor",
    speed: 412,
    startDx: 1,
    startDy: 0.58,
    init: (game, f) => {
      f.data.childSpawnCd = 0;
      f.data.slimeDmgWindow = [];
      f.data.shockDmgWindow = [];
      f.data.gelArmorTimer = 0;
      f.data.gelArmorReduction = 0;
    },
    update: (game, f, e, dt) => {
      f.data.childSpawnCd = Math.max(0, f.data.childSpawnCd - dt);
      f.data.gelArmorTimer = Math.max(0, f.data.gelArmorTimer - dt);
      if (f.data.gelArmorTimer <= 0) f.data.gelArmorReduction = 0;
      f.data.slimeDmgWindow = (f.data.slimeDmgWindow || []).filter((x) => game.matchClock - x.t <= 5);
      f.data.shockDmgWindow = (f.data.shockDmgWindow || []).filter((x) => game.matchClock - x.t <= 1.2);
      const sum = f.data.slimeDmgWindow.reduce((s, x) => s + x.amount, 0);
      if (sum >= (f.isRage ? 5 : 6.5) && f.data.childSpawnCd <= 0) {
        const count = f.isRage ? 2 : 1;
        for (let i = 0; i < count; i += 1) spawnSlimeChild(game, f, game.rng.range(0, TAU), f.isRage ? 16 : 13, f.isRage ? 3.5 : 3.0);
        f.data.slimeDmgWindow = [];
        f.data.childSpawnCd = 0.65;
        f.data.gelArmorTimer = 2.2;
        f.data.gelArmorReduction = 0.22;
        skill(game, f);
      }
    },
    onCollide: (game, f, e) => {
      if (f.isRage && !f.hasStatus("gelBumpCd")) {
        f.applyStatus("gelBumpCd", 1.2, { source: f });
        e.applyStatus("slow", 1.2, { mult: 0.62 });
        e.takeDamage(1.4, f, "gel-bump");
      }
      return false;
    }
  },
  {
    name: "TIME",
    color: v("TIME").color,
    desc: "Clock hit and rewind mark",
    speed: 420,
    startDx: 1,
    startDy: -0.67,
    init: (game, f) => {
      f.data.clockTick = 3.2;
      f.data.markCd = 2;
      f.data.mark = null;
      f.data.deathRewindUsed = false;
    },
    update: (game, f, e, dt) => {
      f.data.clockTick -= abilityDt(f, dt);
      if (f.data.clockTick <= 0) {
        f.data.clockTick = 3.6;
        const dmg = clockDamageValue(game);
        e.takeDamage(dmg, f, "clock-hand");
        skill(game, f);
      }
      if (f.data.mark) {
        const m = f.data.mark;
        m.timer -= dt;
        if (m.timer <= 0) {
          const lost = Math.max(0, m.hp - f.hp);
          const dealt = Math.max(0, f.damageDone - m.damageStart);
          f.x = m.x;
          f.y = m.y;
          f.hp = Math.min(f.maxHp, Math.max(f.hp, m.hp - lost * 0.25));
          if (e && dealt > 0) e.heal(dealt * 0.28, false);
          if (f.isRage && lost > 0) pushProjectile(game, { type: "time_rift", owner: f, x: m.x, y: m.y, radius: 62, storedDamage: lost * 0.75, life: 3.2, maxLife: 3.2, hit: false });
          f.data.mark = null;
          f.data.markCd = 8.5;
        }
        return;
      }
      f.data.markCd -= abilityDt(f, dt);
      if (f.data.markCd <= 0) {
        f.data.mark = { x: f.x, y: f.y, hp: f.hp, timer: 3, damageStart: f.damageDone };
        f.data.markCd = 99;
        pushProjectile(game, { type: "time_mark", owner: f, x: f.x, y: f.y, life: 3, maxLife: 3 });
      }
    }
  },
  {
    name: "WOLF",
    color: v("WOLF").color,
    desc: "Blood scent, pounce, bite weakness",
    speed: 505,
    startDx: 1,
    startDy: 0.75,
    init: (game, f) => {
      f.data.scentCd = 1.2;
      f.data.biteCd = 0;
      f.data.pounceTimer = 0;
    },
    speedModifier: (f) => (f.data.pounceTimer > 0 ? 2.0 : 1),
    update: (game, f, e, dt) => {
      f.data.biteCd = Math.max(0, f.data.biteCd - dt);
      f.data.pounceTimer = Math.max(0, f.data.pounceTimer - dt);
      f.data.scentCd -= abilityDt(f, dt);
      if (e.hasStatus("scent")) {
        const lost = (e.maxHp - e.hp) / e.maxHp;
        const radius = Math.max(120, 900 * lost);
        if (dist(f.x, f.y, e.x, e.y) < radius) {
          const n = norm(e.x - f.x, e.y - f.y);
          f.setDir(f.dir.x * 0.58 + n.x * 0.42, f.dir.y * 0.58 + n.y * 0.42);
        }
      }
      if (f.data.scentCd <= 0) {
        f.data.scentCd = 6.8;
        pushProjectile(game, { type: "wolf_scent", owner: f, x: e.x, y: e.y, radius: f.isRage ? 180 : 130, life: 3.6, maxLife: 3.6 });
        if (f.isRage) f.data.pounceTimer = 1.6;
        skill(game, f);
      }
    },
    onCollide: (game, f, e) => {
      if (e.hasStatus("scent") && f.data.biteCd <= 0) {
        e.takeDamage(f.data.pounceTimer > 0 ? 10 : 7.5, f, "wolf-bite");
        f.data.biteCd = 1.9;
        if (f.isRage && game.rng.chance(lerp(0.45, 0.9, clamp((50 - f.hp) / 50, 0, 1)))) e.applyStatus("weak", 3.5, { source: f });
      }
      return false;
    }
  },
  {
    name: "PUPPET",
    color: v("PUPPET").color,
    desc: "Effigy damage transfer, cursed straw monster, final card",
    speed: 435,
    startDx: 1,
    startDy: 0.43,
    init: (game, f) => {
      f.data.wallHitStamp = {};
      f.data.finalCardActive = false;
      f.data.cardTimer = 0;
      f.data.curseTouchCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.curseTouchCd = Math.max(0, (f.data.curseTouchCd || 0) - dt);
      if (f.data.finalCardActive) {
        f.data.cardTimer -= dt;
        if (f.data.cardTimer <= 0 && !game.projectiles.some((p) => p.type === "puppet_card" && p.owner === f && p.life > 0)) f.hp = 0;
      }
    },
    onWallBounce: (game, f, wall) => {
      const last = f.data.wallHitStamp[wall] || -99;
      if (game.matchClock - last < 0.28) return;
      f.data.wallHitStamp[wall] = game.matchClock;
      const pos = { x: f.x, y: f.y };
      if (wall === "left") pos.x = 0;
      if (wall === "right") pos.x = GAME_SIZE;
      if (wall === "top") pos.y = 0;
      if (wall === "bottom") pos.y = GAME_SIZE;
      pushProjectile(game, { type: "puppet_effigy", owner: f, x: pos.x, y: pos.y, radius: 62, hp: f.isRage ? 2.8 : 1.4, life: 12, maxLife: 12, wall, order: game.matchClock + game.rng.range(0, 0.0001) });
      const sameWall = game.projectiles.filter((p) => p.type === "puppet_effigy" && p.owner === f && p.wall === wall && p.hp > 0 && p.life > 0);
      if (sameWall.length >= 4) {
        sameWall.slice(0, 4).forEach((p) => (p.life = 0));
        pushProjectile(game, { type: "straw_monster", owner: f, x: pos.x, y: pos.y, radius: 50, hp: 14, life: 18, maxLife: 18, tick: 0, order: game.matchClock });
      }
      skill(game, f);
    },
    onCollide: (game, f, e) => {
      if (f.data.curseTouchCd > 0) return false;
      f.data.curseTouchCd = f.isRage ? 0.95 : 1.25;
      e.takeDamage(f.isRage ? 2.16 : 1.5, f, "cursed-touch");
      e.applyStatus("slow", 0.8, { mult: 0.78 });
      return false;
    }
  },
  {
    name: "WITCH",
    color: v("WITCH").color,
    desc: "Curses and magic ray",
    speed: 430,
    startDx: 1,
    startDy: -0.62,
    init: (game, f) => {
      f.data.rayCd = 1.2;
      f.data.curseCd = 2.5;
    },
    update: (game, f, e, dt) => {
      f.data.rayCd -= abilityDt(f, dt);
      if (f.data.rayCd <= 0) {
        f.data.rayCd = 2.2;
        pushProjectile(game, { type: "witch_ray", owner: f, x1: f.x, y1: f.y, x2: e.x, y2: e.y, life: 0.18, maxLife: 0.18 });
        if (distToSegment(e.x, e.y, f.x, f.y, e.x, e.y) <= e.radius + 18) e.takeDamage(3.5, f, "magic-ray");
        skill(game, f);
      }
      f.data.curseCd -= abilityDt(f, dt);
      if (f.data.curseCd <= 0) {
        f.data.curseCd = 6.7;
        rollWitchCurse(game, f, e);
        if (f.isRage) rollWitchCurse(game, f, e);
      }
    }
  },
  {
    name: "PIRATE",
    color: v("PIRATE").color,
    desc: "Anchor hook, cannonball, boat speed and treasure loot",
    speed: 470,
    startDx: 1,
    startDy: 0.36,
    init: (game, f) => {
      f.data.lootCd = 0.8;
      f.data.anchorCd = 2.2;
      f.data.broadsideTimer = 0;
      f.data.bumpCd = 0;
    },
    update: (game, f, e, dt) => {
      f.data.lootCd -= abilityDt(f, dt);
      f.data.anchorCd -= abilityDt(f, dt);
      f.data.broadsideTimer = Math.max(0, f.data.broadsideTimer - dt);
      f.data.bumpCd = Math.max(0, f.data.bumpCd - dt);
      if (f.data.lootCd <= 0) {
        f.data.lootCd = f.isRage ? 2.4 : 3.0;
        addPirateLoot(game, f);
      }
      if (f.data.anchorCd <= 0) {
        f.data.anchorCd = f.isRage ? 5.4 : 6.5;
        pushProjectile(game, { type: "pirate_anchor", owner: f, x1: f.x, y1: f.y, x2: f.x, y2: f.y, radius: 20, life: 3.2, maxLife: 3.2, triggered: false, timer: 0 });
        skill(game, f);
      }
      if (f.data.broadsideTimer > 0 && game.rng.chance(dt * 1.8)) {
        const n = norm(e.x - f.x, e.y - f.y);
        pushProjectile(game, { type: "cannonball", owner: f, x: f.x, y: f.y, vx: n.x * 760, vy: n.y * 760, radius: 22, life: 2.2, maxLife: 2.2 });
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.bumpCd > 0) return false;
      f.data.bumpCd = 0.9;
      const bonus = Math.min(3, f.data.lootPower || 0);
      e.takeDamage(2.1 + bonus * 0.75, f, "cutlass-bump");
      return false;
    }
  },
  {
    name: "PAINTER",
    color: v("PAINTER").color,
    desc: "Terrain paint strokes and color blobs",
    speed: 462,
    startDx: 1,
    startDy: -0.4,
    init: (game, f) => {
      f.data.colorIndex = 0;
      f.data.colorTimer = 2;
      f.data.paintTimer = 0;
      f.data.paintDrop = 0;
      f.data.blobCd = 1.2;
    },
    update: (game, f, e, dt) => {
      f.data.colorTimer -= dt;
      if (f.data.colorTimer <= 0) {
        f.data.colorTimer = 2;
        f.data.colorIndex = (f.data.colorIndex + 1) % 3;
      }
      f.data.blobCd -= abilityDt(f, dt);
      if (f.data.blobCd <= 0) {
        f.data.blobCd = f.isRage ? 2.3 : 2.9;
        const kinds = ["red", "blue", "yellow"];
        const kind = kinds[f.data.colorIndex];
        pushProjectile(game, { type: "painter_blob", owner: f, kind, x: f.x, y: f.y, radius: 32, life: 3, maxLife: 3, color: kind === "red" ? "#ff4040" : kind === "blue" ? "#50a6ff" : "#ffd447" });
        skill(game, f);
      }
      if (f.data.paintTimer > 0) {
        f.data.paintTimer -= dt;
        f.data.paintDrop -= dt;
        f.applyStatus("immune", 0.1, { source: f });
        if (f.data.paintDrop <= 0) {
          f.data.paintDrop = 0.14;
          const kind = ["red", "blue", "yellow"][f.data.colorIndex];
          spawnPainterStroke(game, f, kind, f.data.lastPaintX ?? f.x, f.data.lastPaintY ?? f.y, f.x, f.y);
          f.data.lastPaintX = f.x;
          f.data.lastPaintY = f.y;
        }
      }
    },
    onWallBounce: (game, f) => {
      f.data.paintTimer = 1.25;
      f.data.paintDrop = 0;
      f.data.lastPaintX = f.x;
      f.data.lastPaintY = f.y;
    }
  },
  {
    name: "KUNGFU",
    color: v("KUNGFU").color,
    desc: "Four-step combo, trauma rush and giant palm",
    speed: 516,
    startDx: 1,
    startDy: 0.54,
    init: (game, f) => {
      f.data.combo = 0;
      f.data.comboTimer = 0;
      f.data.hitCd = 0;
      f.data.rushTimer = 0;
      f.data.rushHitCd = 0;
      f.data.palmCd = 3.8;
    },
    speedModifier: (f) => (f.data.rushTimer > 0 ? 8.4 : 1),
    update: (game, f, e, dt) => {
      f.data.hitCd = Math.max(0, f.data.hitCd - dt);
      f.data.comboTimer = Math.max(0, f.data.comboTimer - dt);
      f.data.rushHitCd = Math.max(0, f.data.rushHitCd - dt);
      f.data.palmCd -= abilityDt(f, dt);
      if (f.data.comboTimer <= 0) f.data.combo = 0;
      if (f.data.palmCd <= 0 && (f.isRage || f.data.combo >= 2)) {
        f.data.palmCd = f.isRage ? 5.4 : 7.2;
        const n = norm(e.x - f.x, e.y - f.y);
        pushProjectile(game, { type: "kungfu_palm", owner: f, x: f.x + n.x * 90, y: f.y + n.y * 90, vx: n.x * 620, vy: n.y * 620, radius: f.isRage ? 92 : 72, life: 0.9, maxLife: 0.9, hit: false });
        game.emitText(f.x, f.y - f.radius - 80, "GIANT PALM", "#ffdda8");
        skill(game, f);
      }
      if (f.data.rushTimer > 0) {
        f.data.rushTimer -= dt;
        const target = e;
        if (f.data.rushAnchor) {
          target.x = f.data.rushAnchor.x;
          target.y = f.data.rushAnchor.y;
          target.data.positionLocked = true;
          f.setDir(target.x - f.x, target.y - f.y);
          if (dist(f.x, f.y, target.x, target.y) < f.radius + target.radius + 28 && f.data.rushHitCd <= 0) {
            target.applyStatus("innerTrauma", 9, { source: f, stacks: 1 });
            target.takeDamage(1.1, f, "trauma-rush");
            f.data.rushHitCd = 0.18;
          }
        }
        if (f.data.rushTimer <= 0) {
          f.data.combo = 0;
          if (target.statuses.stun) target.statuses.stun.timer = 0;
          f.data.rushAnchor = null;
        }
      }
    },
    onCollide: (game, f, e) => {
      if (f.data.hitCd > 0) return false;
      f.data.hitCd = 0.4;
      if (f.data.rushTimer > 0) return false;
      f.data.combo = (f.data.combo || 0) + 1;
      f.data.comboTimer = 5.2;
      const c = f.data.combo;
      game.emitText(f.x, f.y - f.radius - 72, `COMBO ${c}`, "#ffd28a");
      if (c === 1) e.takeDamage(3.0, f, "kungfu-punch");
      else if (c === 2) {
        e.applyStatus("stun", 0.8, { source: f });
        e.applyStatus("rapidPunch", 0.8, { source: f, dmg: 0.46 });
      } else if (c === 3) {
        e.takeDamage(8.5, f, "palm-blast");
        const n = norm(e.x - f.x, e.y - f.y);
        e.applyStatus("push", 0.38, { x: n.x, y: n.y, strength: 1350 });
      } else if (c >= (f.isRage ? 5 : 4)) {
        e.applyStatus("stun", 3.3, { source: f });
        f.data.rushTimer = 2.8;
        f.data.rushAnchor = { x: e.x, y: e.y };
        f.data.combo = 0;
        f.setDir((e.x < 500 ? 1000 : 0) - f.x, (e.y < 500 ? 1000 : 0) - f.y);
        game.addHighlight("combo rush", f, e);
      }
      return false;
    }
  },
  {
    name: "SUPERSTAR",
    color: v("SUPERSTAR").color,
    desc: "Media invincibility, spotlight and fan swarm",
    speed: 445,
    startDx: 1,
    startDy: -0.42,
    init: (game, f) => {
      f.data.eventCd = 2;
      f.data.mediaStreak = 0;
      f.data.spotlight = 0;
    },
    update: (game, f, e, dt) => {
      f.data.spotlight = Math.max(0, f.data.spotlight - dt);
      const fanCount = game.projectiles.filter((p) => p.type === "superfan" && p.owner === f && p.life > 0).length;
      const cdRate = f.isRage ? 1 + clamp(fanCount * 0.035, 0, 0.25) : 1;
      f.data.eventCd -= abilityDt(f, dt) * cdRate;
      if (f.data.eventCd <= 0) {
        f.data.eventCd = 6.2;
        const roll = game.rng.next();
        if (roll < 0.34) {
          f.applyStatus("immune", 1.2, { source: f });
          f.data.spotlight = 1.5;
          game.emitText(f.x, f.y - f.radius - 78, "MEDIA POSE", "#fff2a0");
        } else if (roll < 0.74) {
          spawnSuperFans(game, f, f.isRage ? 3 : 2);
        } else {
          e.applyStatus("stun", 0.75, { source: f });
          e.takeDamage(3.2, f, "spotlight-drop");
        }
        skill(game, f);
      }
    }
  }
];

function newOrbitSat(game, a) {
  const types = [
    { kind: "freeze", color: "#74d8e8" },
    { kind: "burn", color: "#ff7a1f" },
    { kind: "bleed", color: "#8d1111" },
    { kind: "stun", color: "#e5fbff" },
    { kind: "poison", color: "#8dff26" }
  ];
  const t = game.rng.pick(types);
  return { a, hp: 2, cd: 0, ring: 1, kind: t.kind, color: t.color };
}

function applyOrbitEffect(enemy, owner, sat) {
  if (sat.kind === "freeze") enemy.applyStatus("freeze", 0.75, { source: owner, dartTotal: 3.2 });
  else if (sat.kind === "burn") enemy.applyStatus("burn", 2.2, { source: owner, interval: 0.8, dmg: 0.52 });
  else if (sat.kind === "bleed") enemy.applyStatus("bleed", 3.2, { source: owner });
  else if (sat.kind === "stun") enemy.applyStatus("stun", 0.48, { source: owner });
  else if (sat.kind === "poison") enemy.applyStatus("poison", 2.1, { source: owner, exposure: Math.max(1.5, enemy.statuses.poison?.exposure || 0) + 1.3 });
}

function novaDamage(t) {
  const x = clamp(t, 0, 15);
  const pts = [
    [0, 0.8],
    [2, 1.2],
    [4, 3.5],
    [5, 7],
    [6, 15],
    [7, 26],
    [8, 40],
    [9, 26],
    [10, 15],
    [11, 7],
    [13, 2.5],
    [15, 0.8]
  ];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [t0, d0] = pts[i];
    const [t1, d1] = pts[i + 1];
    if (x >= t0 && x <= t1) return lerp(d0, d1, (x - t0) / (t1 - t0));
  }
  return 0.8;
}

function fireSniper(game, f, e) {
  const ratio = clamp(dist(f.x, f.y, e.x, e.y) / Math.hypot(GAME_SIZE, GAME_SIZE), 0, 1);
  const dmg = (f.isRage ? 33 : 29) * ratio + (f.isRage ? 2 : 0);
  pushProjectile(game, { type: "sniper_laser", owner: f, x1: f.x, y1: f.y, x2: e.x, y2: e.y, life: 0.45, maxLife: 0.45 });
  e.takeDamage(dmg, f, "sniper-shot");
  skill(game, f, "skill_hit");
}

function clockDamageValue(game) {
  const sec = game.matchClock || 0;
  const digit = Math.max(1, Math.floor(sec) % 10);
  return digit === 0 ? 10 : clamp(digit, 1, 9);
}

function rollWitchCurse(game, owner, enemy) {
  const roll = game.rng.int(0, 4);
  if (roll === 0) enemy.applyStatus("silenceCurse", 3.2, { source: owner });
  if (roll === 1) enemy.applyStatus("hexBurn", 4, { source: owner, dmg: 1 });
  if (roll === 2) enemy.applyStatus("weak", 3.5, { source: owner });
  if (roll === 3) enemy.applyStatus("slow", 3, { mult: 0.55 });
  if (roll === 4) {
    const n = norm(enemy.x - owner.x, enemy.y - owner.y);
    pushProjectile(game, { type: "witch_talisman", owner, x: owner.x, y: owner.y, vx: n.x * 620, vy: n.y * 620, radius: 26, life: 2.3, maxLife: 2.3, hit: false });
  }
  skill(game, owner);
}

export function typeByName(name) {
  return FighterTypes.find((type) => type.name === name) || null;
}

export function assertRoster() {
  const names = FighterTypes.map((t) => t.name);
  const missing = rosterNames.filter((name) => !names.includes(name));
  const extra = names.filter((name) => !rosterNames.includes(name));
  if (missing.length || extra.length || names.includes("WIND") || names.length !== 32) {
    throw new Error(`Invalid roster. missing=${missing.join(",")} extra=${extra.join(",")} count=${names.length}`);
  }
}
