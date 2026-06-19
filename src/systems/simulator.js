import { Fighter } from "../core/fighter.js";
import { createRng, clamp, dist, norm } from "../core/rng.js";
import { applyDamage, heal } from "../core/damage.js";
import { handleFighterCollisions } from "../core/collision.js";
import { updateProjectiles } from "../core/projectile.js";
import { FighterTypes, assertRoster, typeByName } from "../data/fighterTypes.js";
import { FIGHTER_RADIUS, GAME_SIZE, SIMULATION } from "../data/balanceConfig.js";
import { createVfxEvent, updateVfx } from "./vfx.js";

assertRoster();

export class GameEngine {
  constructor(options = {}) {
    this.seed = options.seed || "apex-chaos";
    this.rng = createRng(this.seed);
    this.config = { ...SIMULATION, ...(options.config || {}) };
    this.mode = options.mode || "sim";
    this.dt = this.config.dt;
    this.matchClock = 0;
    this.gameState = "idle";
    this.fighters = [];
    this.projectiles = [];
    this.vfx = [];
    this.floatingTexts = [];
    this.audioEvents = [];
    this.highlights = [];
    this.bugs = [];
    this.replay = [];
    this.lastDamageClock = 0;
    this.lastHpSum = 0;
    this.noDamageAccum = 0;
    this.winner = null;
    this.loser = null;
    this.result = null;
    this.onEnd = null;
  }

  startMatch(leftName, rightName, options = {}) {
    this.seed = options.seed || this.seed;
    this.rng = createRng(this.seed);
    this.matchClock = 0;
    this.gameState = "playing";
    this.projectiles.length = 0;
    this.vfx.length = 0;
    this.floatingTexts.length = 0;
    this.audioEvents.length = 0;
    this.highlights.length = 0;
    this.bugs.length = 0;
    this.replay.length = 0;
    this.lastDamageClock = 0;
    this.winner = null;
    this.loser = null;
    this.result = null;
    const leftType = typeByName(leftName);
    const rightType = typeByName(rightName);
    if (!leftType || !rightType) throw new Error(`Unknown fighter matchup ${leftName} vs ${rightName}`);
    const yJitter = this.rng.range(-90, 90);
    const left = new Fighter(this, 1, 235 + this.rng.range(-35, 35), 500 + yJitter, leftType, "left");
    const right = new Fighter(this, 2, 765 + this.rng.range(-35, 35), 500 - yJitter, rightType, "right");
    randomizeInitialDirection(this, left, right);
    this.fighters = [left, right];
    this.lastHpSum = left.hp + right.hp;
    this.emitText(500, 110, `${left.name} VS ${right.name}`, "#efe8d7", 1.2);
    return this;
  }

  getEnemy(fighter) {
    return this.fighters.find((f) => f.hp > 0 && f.teamId !== fighter.teamId) || this.fighters.find((f) => f !== fighter);
  }

  damage(target, amount, source, label, options = {}) {
    return applyDamage(this, target, amount, source, label, options);
  }

  heal(target, amount, overheal = false) {
    return heal(this, target, amount, overheal);
  }

  spawnProjectile(projectile) {
    if (!projectile) return null;
    const p = {
      life: 1,
      maxLife: projectile.life ?? 1,
      radius: 10,
      spawnTime: this.matchClock,
      ...projectile
    };
    if (p.maxLife === undefined) p.maxLife = p.life;
    this.projectiles.push(p);
    return p;
  }

  emitText(x, y, text, color = "#fff", life = 0.9) {
    if (this.mode === "sim" && this.floatingTexts.length > 80) return;
    this.floatingTexts.push({ x, y, text, color, life, maxLife: life });
  }

  emitDamageText(x, y, amount, isHeal = false) {
    if (this.mode === "sim") return;
    this.emitText(x, y, `${isHeal ? "+" : "-"}${Math.abs(amount).toFixed(1)}`, isHeal ? "#44ff7a" : "#ff5950", 0.75);
  }

  emitVfx(kind, x, y, color, count = 8) {
    if (this.mode === "sim") return;
    this.vfx.push(createVfxEvent(kind, x, y, color, count));
  }

  audioCue(fighterOrName, action = "skill_cast") {
    const name = typeof fighterOrName === "string" ? fighterOrName : fighterOrName?.name;
    if (!name) return;
    this.audioEvents.push({ time: this.matchClock, name, action });
  }

  triggerRage(fighter) {
    if (!fighter || fighter.isRage || fighter.type.noRage) return;
    fighter.isRage = true;
    fighter.rageStartHp = fighter.hp;
    this.audioCue(fighter, "rage_trigger");
    this.emitVfx("rage", fighter.x, fighter.y, fighter.color, 34);
    this.emitText(fighter.x, fighter.y - fighter.radius - 88, "RAGE", fighter.color, 1.1);
    this.addHighlight("rage comeback window", fighter, this.getEnemy(fighter));
    if (fighter.type.onRage) fighter.type.onRage(this, fighter);
  }

  addHighlight(kind, actor, target, data = {}) {
    this.highlights.push({
      time: Number(this.matchClock.toFixed(3)),
      kind,
      actor: actor?.name || null,
      target: target?.name || null,
      ...data
    });
  }

  flagBug(kind, data = {}) {
    const key = `${kind}:${Math.round(this.matchClock * 10)}:${data.count || ""}`;
    if (this.bugs.some((bug) => bug.key === key)) return;
    this.bugs.push({ key, kind, time: Number(this.matchClock.toFixed(3)), seed: this.seed, ...data });
  }

  step(dt = this.config.dt) {
    if (this.gameState !== "playing") return this.result;
    this.dt = dt;
    this.matchClock += dt;
    try {
      const live = this.fighters.filter((f) => f.hp > 0);
      for (const f of live) f.update(dt, this.getEnemy(f));
      handleFighterCollisions(this, dt);
      updateProjectiles(this, dt);
      updateVfx(this, dt);
      this.checkStability();
      const aliveTeams = new Set(this.fighters.filter((f) => f.hp > 0).map((f) => f.teamId));
      if (aliveTeams.size <= 1) this.endMatch();
      else if (this.matchClock >= this.config.maxSeconds) this.endMatch({ unresolved: true, reason: "sim-max-seconds" });
    } catch (error) {
      this.flagBug("runtime exception", { message: error?.message || String(error), stack: error?.stack?.slice(0, 500) });
      this.endMatch({ unresolved: true, reason: "runtime-exception" });
    }
    return this.result;
  }

  checkStability() {
    let hpSum = 0;
    for (const f of this.fighters) {
      hpSum += f.hp;
      if (!Number.isFinite(f.hp) || !Number.isFinite(f.x) || !Number.isFinite(f.y)) this.flagBug("NaN", { fighter: f.name });
      if (f.hp > 170 || f.hp < -5) this.flagBug("HP abnormal", { fighter: f.name, hp: f.hp });
      f.x = clamp(f.x, f.radius, GAME_SIZE - f.radius);
      f.y = clamp(f.y, f.radius, GAME_SIZE - f.radius);
    }
    if (Math.abs(hpSum - this.lastHpSum) < 0.001) this.noDamageAccum += this.dt;
    else {
      this.noDamageAccum = 0;
      this.lastHpSum = hpSum;
    }
    if (this.noDamageAccum > this.config.noDamageSeconds) {
      this.flagBug("no-damage loop", { duration: this.noDamageAccum });
      this.noDamageAccum = 0;
    }
    const summonCount = this.projectiles.filter((p) => ["slime_child", "puppet_effigy", "straw_monster", "virus_minion", "superfan"].includes(p.type)).length;
    if (summonCount > 48) this.flagBug("runaway summon", { count: summonCount });
  }

  endMatch(options = {}) {
    if (this.gameState === "ended") return this.result;
    this.gameState = "ended";
    const alive = this.fighters.filter((f) => f.hp > 0);
    if (options.unresolved || alive.length !== 1) {
      const sorted = [...this.fighters].sort((a, b) => b.hp - a.hp);
      this.winner = options.unresolved ? null : sorted[0];
      this.loser = options.unresolved ? null : sorted[1];
    } else {
      this.winner = alive[0];
      this.loser = this.fighters.find((f) => f !== this.winner) || null;
    }
    this.result = buildMatchResult(this, options);
    if (this.onEnd) this.onEnd(this.result);
    return this.result;
  }

  runUntilEnd(maxSeconds = this.config.maxSeconds) {
    while (this.gameState === "playing" && this.matchClock < maxSeconds) this.step(this.config.dt);
    if (this.gameState !== "ended") this.endMatch({ unresolved: true, reason: "run-limit" });
    return this.result;
  }
}

export function createMatch(leftName, rightName, options = {}) {
  return new GameEngine(options).startMatch(leftName, rightName, options);
}

export function runMatch(leftName, rightName, options = {}) {
  return createMatch(leftName, rightName, options).runUntilEnd(options.maxSeconds || SIMULATION.maxSeconds);
}

export function runSmokeSuite(matches = 4, baseSeed = "smoke") {
  const pairs = [
    ["FLASH", "TOXIC"],
    ["VAMPIRE", "BLADE"],
    ["SLIME", "SNIPER"],
    ["PUPPET", "ELECTRIC"],
    ["MIRROR", "BLACK_HOLE"],
    ["KUNGFU", "PIRATE"]
  ];
  const results = [];
  for (const [a, b] of pairs) {
    for (let i = 0; i < matches; i += 1) {
      results.push(runMatch(a, b, { seed: `${baseSeed}:${a}:${b}:L:${i}` }));
      results.push(runMatch(b, a, { seed: `${baseSeed}:${a}:${b}:R:${i}` }));
    }
  }
  return results;
}

export function runFullMatrix({ matchesPerOrientation = 20, baseSeed = "balance" } = {}) {
  const results = [];
  for (let i = 0; i < FighterTypes.length; i += 1) {
    for (let j = i + 1; j < FighterTypes.length; j += 1) {
      const a = FighterTypes[i].name;
      const b = FighterTypes[j].name;
      for (let m = 0; m < matchesPerOrientation; m += 1) {
        results.push(runMatch(a, b, { seed: `${baseSeed}:${a}:${b}:L:${m}` }));
        results.push(runMatch(b, a, { seed: `${baseSeed}:${a}:${b}:R:${m}` }));
      }
    }
  }
  return results;
}

function buildMatchResult(game, options = {}) {
  const fighters = game.fighters.map((f) => f.snapshot());
  const winnerName = game.winner?.name || null;
  const loserName = game.loser?.name || null;
  const duration = Number(game.matchClock.toFixed(3));
  const topDamageSource = fighters
    .flatMap((f) => Object.entries(f.damageLabels || {}).map(([label, value]) => ({ fighter: f.name, label, value })))
    .sort((a, b) => b.value - a.value)[0] || null;
  const unresolved = !!options.unresolved;
  return {
    seed: game.seed,
    left: fighters[0]?.name,
    right: fighters[1]?.name,
    winner: winnerName,
    loser: loserName,
    unresolved,
    reason: options.reason || (unresolved ? "unresolved" : "death"),
    duration,
    overlong: duration > game.config.overlongSeconds,
    fighters,
    damage: Object.fromEntries(fighters.map((f) => [f.name, { dealt: f.damageDone, taken: f.damageTaken, healing: f.healingDone, labels: f.damageLabels }])),
    topDamageSource,
    projectileCount: game.projectiles.length,
    bugs: game.bugs.map(({ key, ...bug }) => bug),
    highlights: game.highlights,
    replay: {
      seed: game.seed,
      left: fighters[0]?.name,
      right: fighters[1]?.name
    }
  };
}

function randomizeInitialDirection(game, left, right) {
  const a = norm(1 + game.rng.range(-0.2, 0.25), game.rng.range(-0.82, 0.82));
  const b = norm(-1 + game.rng.range(-0.25, 0.2), game.rng.range(-0.82, 0.82));
  left.setDir(a.x, a.y);
  right.setDir(b.x, b.y);
  const bump = game.rng.range(-22, 22);
  left.y = clamp(left.y + bump, FIGHTER_RADIUS, GAME_SIZE - FIGHTER_RADIUS);
  right.y = clamp(right.y - bump, FIGHTER_RADIUS, GAME_SIZE - FIGHTER_RADIUS);
}
