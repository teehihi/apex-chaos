import { RAGE_HP_THRESHOLD, SUMMON_LIMITS, tuningFor } from "../data/balanceConfig.js";
import { clamp } from "./rng.js";

export function applyDamage(game, target, rawAmount, source = null, label = "direct", options = {}) {
  let amount = Number(rawAmount);
  const statusDamage = !!options.status;
  if (!target || target.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return 0;
  if (source && source === target && label !== "self-toxic") return 0;
  if (source?.statuses?.disease?.timer > 0) amount *= source.statuses.disease.mult ?? 1;
  if (source && source !== target) amount *= virusDamageOut(source);
  if (source && source !== target) amount *= tuningFor(source.name).damageOut || 1;
  amount *= tuningFor(target.name).damageTaken || 1;
  amount *= virusDamageTaken(target);

  if (target.name === "PUPPET" && source && source !== target && !statusDamage) {
    amount = absorbWithPuppetEffigy(game, target, amount);
    if (amount <= 0) return 0;
    label = `${label}-effigy-overflow`;
  }

  if (target.name === "VAMPIRE" && target.data.latchTimer > 0) {
    amount *= 0.55;
    label = `${label}-vampire-latch-guard`;
  }
  if (target.name === "MATH_V2" && target.data.phase === "typing") {
    amount *= 0.68;
    label = `${label}-graph-casting-guard`;
  }
  if (target.name === "RUBBER" && target.data.afterTier >= 3 && !target.data.active) {
    amount *= 0.6;
    label = `${label}-rubber-guard`;
  }
  if (target.name === "DRUM" && target.data.rageSolo > 0 && !statusDamage) {
    amount *= 0.24;
    label = `${label}-drum-solo-guard`;
  }
  if (target.hasStatus("bladeWeak") && source?.name === "BLADE") {
    amount *= 1.85;
    label = `${label}-blade-weak`;
  }
  if (target.hasStatus("weak") && source && source !== target && game.rng.chance(0.46)) {
    amount *= 2.35;
    label = `${label}-weak-crit`;
    game.emitText(target.x, target.y - target.radius - 90, "WEAK CRIT", "#ff3030");
  }
  if (target.hasStatus("brittle")) {
    amount *= 1.22;
    label = `${label}-brittle`;
  }
  if (target.hasStatus("paintRed")) amount *= 1.18;
  if (target.hasStatus("paintYellow")) amount *= 0.82;
  if (target.hasStatus("innerTrauma")) {
    amount *= 1 + (target.statuses.innerTrauma.stacks || 0) * 0.022;
    label = `${label}-inner-trauma`;
  }
  if (target.name === "SLIME" && target.data.gelArmorTimer > 0) {
    amount *= 1 - clamp(target.data.gelArmorReduction || 0, 0, 0.58);
    label = `${label}-gel-armor`;
  }
  if (target.name === "PAINTER" && target.hasStatus("painterGuard")) {
    amount *= 0.85;
    label = `${label}-painter-guard`;
  }

  if (target.name === "SLIME" && source && source !== target && !statusDamage) {
    amount = absorbWithSlimeChildren(game, target, amount);
    if (amount <= 0) return 0;
    label = `${label}-slime-guard-leak`;
  }

  if (target.name === "BLACK_HOLE" && target.isRage && source && source !== target) {
    const well = game.projectiles.find((p) => p.type === "gravity_well" && p.owner === target && p.life > 0);
    if (well) {
      well.absorbedDamage = (well.absorbedDamage || 0) + amount;
      game.emitText(target.x, target.y - target.radius - 40, `ABSORB ${amount.toFixed(1)}`, "#9d6bff");
      return 0;
    }
  }

  if (target.hasStatus("immune") && !statusDamage) return 0;

  if (target.name === "TIME" && target.data.mark && !target.data.deathRewindUsed && target.hp - amount <= 0) {
    const m = target.data.mark;
    target.hp = Math.max(1, m.hp || 1);
    target.x = m.x;
    target.y = m.y;
    target.data.deathRewindUsed = true;
    target.data.mark = null;
    target.data.markCd = 8.5;
    game.emitText(target.x, target.y - target.radius - 82, "DEATH DENIED", "#efeaff");
    game.addHighlight("1HP survival", target, source);
    return 0;
  }

  if (target.name === "SLIME" && source && source !== target) {
    target.data.slimeDmgWindow ||= [];
    target.data.shockDmgWindow ||= [];
    target.data.slimeDmgWindow.push({ t: game.matchClock, amount });
    target.data.shockDmgWindow.push({ t: game.matchClock, amount });
  }

  const before = target.hp;
  target.hp = Math.max(0, target.hp - amount);
  const dealt = before - target.hp;
  if (dealt <= 0) return 0;
  target.damageTaken += dealt;
  target.lastDamageAt = game.matchClock;
  game.lastDamageClock = game.matchClock;

  if (source && source !== target) {
    source.damageDone += dealt;
    source.hitsLanded += 1;
    source.maxHit = Math.max(source.maxHit, dealt);
    if (statusDamage) source.dotDamage += dealt;
    source.damageLabels[label] = (source.damageLabels[label] || 0) + dealt;
    source.lastDamageAt = game.matchClock;
    if (dealt >= 24) game.addHighlight("big hit", source, target, { amount: dealt, label });
  }

  game.emitDamageText(target.x, target.y - target.radius - 4, dealt, false);
  game.emitVfx("hit", target.x, target.y, target.color, Math.min(22, 4 + Math.ceil(dealt * 1.6)));
  if (target.type.onTakeDamage && !target.hasStatus("abilityDisabled")) {
    target.type.onTakeDamage(game, target, dealt, source, label);
  }
  if (target.hp <= RAGE_HP_THRESHOLD && !target.isRage && !target.type.noRage) {
    game.triggerRage(target);
  }
  if (target.hp <= 0 && target.name === "PUPPET" && !target.data.finalCardActive) {
    target.hp = 1;
    target.data.finalCardActive = true;
    target.data.cardTimer = 5;
    game.spawnProjectile({
      type: "puppet_card",
      owner: target,
      x: target.x,
      y: target.y,
      vx: game.rng.range(-650, 650) || 420,
      vy: game.rng.range(-650, 650) || -420,
      radius: 50,
      life: 5,
      maxLife: 5,
      hitCd: 0,
      value: 2.2
    });
    game.emitText(target.x, target.y - target.radius - 92, "FINAL CARD", "#f1d8a8");
    game.addHighlight("clutch final card", target, source);
  }
  if (target.hp <= 0) {
    game.audioCue(target, "death_or_finisher");
  }
  return dealt;
}

export function heal(game, target, rawAmount, overheal = false) {
  let amount = Number(rawAmount);
  if (!target || target.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return 0;
  amount *= virusHealMult(target);
  const cap = overheal ? 136 : target.maxHp;
  const before = target.hp;
  target.hp = Math.min(cap, target.hp + amount);
  const healed = target.hp - before;
  if (healed > 0) {
    target.healingDone += healed;
    game.emitDamageText(target.x, target.y - target.radius - 4, healed, true);
  }
  return healed;
}

function absorbWithPuppetEffigy(game, target, amount) {
  const effigies = game.projectiles
    .filter((p) => p.type === "puppet_effigy" && p.owner === target && p.hp > 0 && p.life > 0)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!effigies.length) return amount;
  let remaining = amount;
  for (const effigy of effigies) {
    if (remaining <= 0) break;
    const block = Math.min(effigy.hp, remaining);
    effigy.hp -= block;
    remaining -= block;
    game.lastDamageClock = game.matchClock;
    game.noDamageAccum = 0;
    game.emitText(effigy.x, effigy.y - effigy.radius - 24, `EFFIGY -${block.toFixed(1)}`, "#d6c0ff");
    game.emitVfx("effigy", effigy.x, effigy.y, "#d6c0ff", 14);
    if (effigy.hp <= 0) {
      effigy.life = 0;
      game.spawnProjectile({
        type: "curse_splinter",
        owner: target,
        x: effigy.x,
        y: effigy.y,
        radius: 80,
        life: 0.45,
        maxLife: 0.45,
        hit: false
      });
    }
  }
  if (remaining > 0) {
    game.emitText(target.x, target.y - target.radius - 72, `OVERFLOW ${remaining.toFixed(1)}`, "#f1d8a8");
  }
  return remaining;
}

function absorbWithSlimeChildren(game, target, amount) {
  const guards = game.projectiles
    .filter((p) => p.type === "slime_child" && p.owner === target && p.hp > 0 && p.life > 0)
    .sort((a, b) => (a.spawnTime || 0) - (b.spawnTime || 0));
  if (!guards.length) return amount;
  let remaining = amount;
  for (const guard of guards) {
    if (remaining <= 0) break;
    const block = Math.min(guard.hp, remaining);
    guard.hp -= block;
    remaining -= block;
    game.lastDamageClock = game.matchClock;
    game.noDamageAccum = 0;
    guard.blockCd = 0.25;
    game.emitText(guard.x, guard.y - guard.radius - 18, "SLIME GUARD", "#caffbb");
    game.emitVfx("slime_guard", guard.x, guard.y, target.color, 8);
    if (guard.hp <= 0) {
      guard.life = 0;
      spawnSlimeMucus(game, target, guard.x, guard.y);
    }
  }
  return remaining;
}

export function spawnSlimeMucus(game, owner, x, y) {
  const existing = game.projectiles
    .filter((p) => p.type === "slime_mucus" && p.owner === owner && p.life > 0)
    .sort((a, b) => (a.spawnTime || 0) - (b.spawnTime || 0));
  while (existing.length >= SUMMON_LIMITS.slimeMucus) {
    existing.shift().life = 0;
  }
  game.spawnProjectile({
    type: "slime_mucus",
    owner,
    x,
    y,
    radius: 68,
    life: 4.6,
    maxLife: 4.6,
    spawnTime: game.matchClock
  });
}

function virusDamageOut(fighter) {
  const list = fighter.virusParasites || [];
  let reduction = 0;
  for (const v of list) reduction += v.level >= 2 ? 0.035 : 0.012;
  return clamp(1 - reduction, 0.42, 1);
}

function virusHealMult(fighter) {
  const list = fighter.virusParasites || [];
  let reduction = 0;
  for (const v of list) reduction += v.level >= 2 ? 0.08 : 0.025;
  return clamp(1 - reduction, 0.16, 1);
}

function virusDamageTaken(fighter) {
  return fighter.virusParasites?.some((v) => v.level >= 3) ? 1.75 : 1;
}
