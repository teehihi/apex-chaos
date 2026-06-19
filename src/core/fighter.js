import { BASE_HP, FIGHTER_RADIUS, GAME_SIZE } from "../data/balanceConfig.js";
import { norm, clamp } from "./rng.js";
import { applyStatus, cooldownRate, hardCC, hasStatus, speedMult, updateStatuses } from "./status.js";
import { resolveFighterWalls } from "./collision.js";

export class Fighter {
  constructor(game, id, x, y, type, side = "left") {
    this.game = game;
    this.id = id;
    this.teamId = id;
    this.side = side;
    this.x = x;
    this.y = y;
    this.type = type;
    this.name = type.name;
    this.color = type.color;
    this.baseRadius = FIGHTER_RADIUS;
    this.radius = FIGHTER_RADIUS;
    this.maxHp = type.hp || BASE_HP;
    this.hp = this.maxHp;
    this.baseSpeed = type.speed || 450;
    this.dir = norm(type.startDx * (side === "left" ? 1 : -1), type.startDy);
    this.isRage = false;
    this.rageStartHp = null;
    this.data = {};
    this.statuses = {};
    this.trail = [];
    this.damageDone = 0;
    this.damageTaken = 0;
    this.healingDone = 0;
    this.hitsLanded = 0;
    this.maxHit = 0;
    this.dotDamage = 0;
    this.skillsUsed = 0;
    this.damageLabels = {};
    this.timeline = [];
    this.virusParasites = [];
    this.lastDamageAt = 0;
    if (type.init) type.init(game, this);
  }

  setDir(x, y) {
    this.dir = norm(x, y);
  }

  hasStatus(name) {
    return hasStatus(this, name);
  }

  hardCC() {
    return hardCC(this);
  }

  cooldownRate() {
    return cooldownRate(this);
  }

  applyStatus(name, duration, data = {}) {
    applyStatus(this, name, duration, data);
  }

  takeDamage(amount, source = null, label = "direct", options = {}) {
    return this.game.damage(this, amount, source, label, options);
  }

  heal(amount, overheal = false) {
    return this.game.heal(this, amount, overheal);
  }

  update(dt, enemy) {
    if (this.hp <= 0) return;
    updateStatuses(this.game, this, dt);
    if (this.virusParasites?.length) {
      for (const v of this.virusParasites) v.timer = (v.timer ?? 24) - dt;
      this.virusParasites = this.virusParasites.filter((v) => v.timer > 0);
    }
    this.data.phaseDash = Math.max(0, (this.data.phaseDash || 0) - dt);
    const canAct = !this.hardCC() && !this.hasStatus("abilityDisabled");
    if (canAct && this.type.update) this.type.update(this.game, this, enemy, dt);
    if (!this.hardCC() && !this.data.positionLocked) {
      const mod = speedMult(this);
      let vx = this.dir.x * this.baseSpeed * mod;
      let vy = this.dir.y * this.baseSpeed * mod;
      if (this.hasStatus("push")) {
        const p = this.statuses.push;
        const t = clamp(p.timer / Math.max(0.001, p.max), 0, 1);
        vx += p.x * p.strength * t;
        vy += p.y * p.strength * t;
      }
      this.x += vx * dt;
      this.y += vy * dt;
    }
    this.data.positionLocked = false;
    this.x = clamp(this.x, -200, GAME_SIZE + 200);
    this.y = clamp(this.y, -200, GAME_SIZE + 200);
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.shift();
    resolveFighterWalls(this.game, this);
  }

  snapshot() {
    return {
      id: this.id,
      name: this.name,
      hp: this.hp,
      x: this.x,
      y: this.y,
      isRage: this.isRage,
      damageDone: this.damageDone,
      damageTaken: this.damageTaken,
      healingDone: this.healingDone,
      hitsLanded: this.hitsLanded,
      maxHit: this.maxHit,
      damageLabels: { ...this.damageLabels }
    };
  }
}
