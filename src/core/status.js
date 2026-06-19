import { RAGE_HP_THRESHOLD, tuningFor } from "../data/balanceConfig.js";
import { clamp } from "./rng.js";

export function applyStatus(target, name, duration, data = {}) {
  if (!target || target.hp <= 0) return;
  const current = target.statuses[name] || {};
  if (name === "slow" || name === "speed") {
    target.statuses[name] = { timer: duration, mult: data.mult ?? 1 };
    return;
  }
  if (name === "push") {
    target.statuses[name] = {
      timer: duration,
      max: duration,
      x: data.x || 0,
      y: data.y || 0,
      strength: data.strength || 0
    };
    return;
  }
  if (name === "poison") {
    const exposure = data.exposure ?? current.exposure ?? 0;
    target.statuses[name] = {
      timer: duration,
      tick: current.tick || 0,
      exposure,
      source: data.source,
      selfSafe: !!data.selfSafe,
      breakDone: data.forceBreak ? false : !!current.breakDone
    };
    return;
  }
  if (name === "freeze") {
    target.statuses[name] = {
      timer: duration,
      max: duration,
      tick: 0,
      dartTick: 0,
      source: data.source,
      dartTotal: data.dartTotal || 0,
      dartDone: 0
    };
    return;
  }
  if (["burn", "bleed", "hexBurn", "rapidPunch", "disease"].includes(name)) {
    target.statuses[name] = {
      timer: duration,
      tick: current.tick || 0,
      source: data.source,
      interval: data.interval || current.interval || 0.8,
      dmg: data.dmg ?? current.dmg ?? 0.5,
      mult: data.mult
    };
    return;
  }
  if (name === "innerTrauma") {
    target.statuses[name] = {
      timer: duration,
      stacks: clamp((current.stacks || 0) + (data.stacks || 1), 0, 40),
      source: data.source
    };
    return;
  }
  target.statuses[name] = { timer: duration, ...data };
}

export function hasStatus(fighter, name) {
  return !!(fighter?.statuses?.[name] && fighter.statuses[name].timer > 0);
}

export function hardCC(fighter) {
  return hasStatus(fighter, "freeze") || hasStatus(fighter, "stun");
}

export function cooldownRate(fighter) {
  if (hardCC(fighter) || hasStatus(fighter, "abilityDisabled")) return 0;
  let rate = 1;
  if (hasStatus(fighter, "poison") && !fighter.statuses.poison.selfSafe) rate *= 0.72;
  if (hasStatus(fighter, "silenceCurse")) rate *= 0.58;
  if (hasStatus(fighter, "paintBlue")) rate *= 0.72;
  if (fighter.virusParasites?.some((v) => v.level >= 3)) rate *= 0.72;
  rate *= tuningFor(fighter.name).cooldownRate || 1;
  return rate;
}

export function speedMult(fighter) {
  if (hardCC(fighter)) return 0;
  let mult = 1;
  if (hasStatus(fighter, "slow")) mult *= clamp(fighter.statuses.slow.mult ?? 1, 0, 1);
  if (hasStatus(fighter, "speed")) mult *= Math.max(0, fighter.statuses.speed.mult ?? 1);
  if (fighter.type.speedModifier) mult *= fighter.type.speedModifier(fighter);
  return Math.max(0, mult);
}

export function updateStatuses(game, fighter, dt) {
  for (const key of Object.keys(fighter.statuses)) {
    const s = fighter.statuses[key];
    if (!s || s.timer <= 0) continue;
    if (key === "burn") tickDamage(game, fighter, s, s.interval || 0.8, s.dmg || 0.55, "burn", dt);
    if (key === "hexBurn") tickDamage(game, fighter, s, 1, s.dmg || 1.15, "hex-burn", dt);
    if (key === "rapidPunch") tickDamage(game, fighter, s, 0.1, s.dmg || 0.42, "rapid-punch", dt, false);
    if (key === "disease") tickDamage(game, fighter, s, 0.5, s.dmg || 0.55, "disease", dt);
    if (key === "bleed") {
      s.tick = (s.tick || 0) + dt;
      while (s.tick >= 1) {
        s.tick -= 1;
        const lost = Math.max(0, fighter.maxHp - fighter.hp);
        if (lost > 0) game.damage(fighter, lost * 0.026, s.source, "bleed", { status: true });
      }
    }
    if (key === "poison") {
      s.exposure = (s.exposure || 0) + dt;
      s.tick = (s.tick || 0) + dt;
      const poisonDmg = poisonDamage(s.exposure);
      while (s.tick >= 0.2) {
        s.tick -= 0.2;
        if (poisonDmg > 0 && !s.selfSafe) game.damage(fighter, poisonDmg, s.source, "poison", { status: true });
      }
      if (s.exposure >= 10 && !s.breakDone && !s.selfSafe) {
        s.breakDone = true;
        game.spawnProjectile({
          type: "toxic_puddle",
          owner: s.source,
          x: fighter.x,
          y: fighter.y,
          radius: 72,
          life: 3.2,
          maxLife: 3.2
        });
        game.emitText(fighter.x, fighter.y - fighter.radius - 50, "TOXIC BREAK", "#b9ff4b");
      }
    }
    if (key === "freeze" && s.dartTotal) {
      s.dartTick += dt;
      const totalTicks = Math.max(1, Math.ceil((s.max || 2) / 0.35));
      const tickDmg = s.dartTotal / totalTicks;
      while (s.dartTick >= 0.35 && s.dartDone < s.dartTotal) {
        s.dartTick -= 0.35;
        const dmg = Math.min(tickDmg, s.dartTotal - s.dartDone);
        s.dartDone += dmg;
        game.damage(fighter, dmg, s.source, "ice-darts", { status: true });
      }
    }
    s.timer -= dt;
    if (s.timer <= 0) delete fighter.statuses[key];
  }
  if (fighter.hp <= RAGE_HP_THRESHOLD && !fighter.isRage && !fighter.type.noRage) {
    game.triggerRage(fighter);
  }
}

function tickDamage(game, fighter, status, interval, amount, label, dt, statusDamage = true) {
  status.tick = (status.tick || 0) + dt;
  while (status.tick >= interval) {
    status.tick -= interval;
    game.damage(fighter, amount, status.source, label, { status: statusDamage });
  }
}

function poisonDamage(exposure) {
  if (exposure >= 10) return 0.34;
  if (exposure >= 7.5) return 0.28;
  if (exposure >= 5) return 0.22;
  if (exposure >= 3) return 0.16;
  if (exposure >= 1.5) return 0.09;
  return 0;
}
