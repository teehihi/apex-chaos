export const GAME_SIZE = 1000;
export const FIGHTER_RADIUS = 75;
export const BASE_HP = 100;
export const RAGE_HP_THRESHOLD = 50;

export const SIMULATION = {
  dt: 1 / 18,
  maxSeconds: 240,
  overlongSeconds: 180,
  stuckSeconds: 42,
  noDamageSeconds: 150,
  projectileHardCap: 170,
  fighterHardCap: 6
};

export const SUMMON_LIMITS = {
  puppetEffigies: 6,
  puppetMonsters: 2,
  slimeChildren: 6,
  slimeMucus: 8,
  virusMinions: 10,
  superstarFans: 8,
  spiderWebs: 32,
  pirateLoot: 5,
  painterStrokes: 10
};

export const SMOKE_MATCHUPS = [
  ["FLASH", "TOXIC"],
  ["VAMPIRE", "BLADE"],
  ["SLIME", "SNIPER"],
  ["PUPPET", "ELECTRIC"],
  ["MIRROR", "BLACK_HOLE"],
  ["KUNGFU", "PIRATE"]
];

export const BALANCE_NOTES = [
  "Rage still triggers below 50 HP.",
  "No global hard cap was added to damage.",
  "Collision damage remains opt-in through fighter skill handlers.",
  "PUPPET effigy absorbs only its remaining HP; overflow reaches the owner in the same hit.",
  "SLIME children guard with finite HP/lifetime; missing guard means owner takes damage.",
  "WIND was removed from the final 32-fighter roster."
];

export const FIGHTER_TUNING = {
  RUBBER: { damageOut: 1.5, damageTaken: 0.85, cooldownRate: 1.3 },
  ICE: { damageOut: 2.2, damageTaken: 0.75, cooldownRate: 1.5 },
  VAMPIRE: { damageOut: 0.7, damageTaken: 1.25, cooldownRate: 0.84 },
  SPIDER: { damageOut: 0.72, damageTaken: 1.08, cooldownRate: 0.86 },
  VOLCANO: { damageOut: 0.9, damageTaken: 1.05, cooldownRate: 0.9 },
  MAGNET: { damageOut: 1.35, damageTaken: 0.9, cooldownRate: 1.2 },
  FLASH: { damageOut: 1.06, damageTaken: 0.98, cooldownRate: 1.04 },
  ELECTRIC: { damageOut: 1.2, damageTaken: 0.95, cooldownRate: 1.08 },
  ORBIT: { damageOut: 0.82, damageTaken: 1.08, cooldownRate: 0.92 },
  TOXIC: { damageOut: 0.89, damageTaken: 1.05, cooldownRate: 0.94 },
  MIRROR: { damageOut: 1.4, damageTaken: 0.88, cooldownRate: 1.25 },
  BLACK_HOLE: { damageOut: 0.9, damageTaken: 1.4, cooldownRate: 0.9 },
  SAW: { damageOut: 1.31, damageTaken: 0.92, cooldownRate: 1.14 },
  BLADE: { damageOut: 0.34, damageTaken: 1.3, cooldownRate: 0.55 },
  NOVA: { damageOut: 0.9, damageTaken: 1.08, cooldownRate: 0.94 },
  HUNTER: { damageOut: 1.48, damageTaken: 0.86, cooldownRate: 1.22 },
  CRYSTAL: { damageOut: 1.55, damageTaken: 0.85, cooldownRate: 1.35 },
  VIRUS: { damageOut: 1.2, damageTaken: 0.93, cooldownRate: 1.14 },
  DRUM: { damageOut: 0.98, damageTaken: 1.02, cooldownRate: 1 },
  CARD: { damageOut: 0.82, damageTaken: 1.04, cooldownRate: 0.92 },
  MATH: { damageOut: 1.8, damageTaken: 0.85, cooldownRate: 1.38 },
  MATH_V2: { damageOut: 0.85, damageTaken: 1.05, cooldownRate: 0.94 },
  SNIPER: { damageOut: 1.2, damageTaken: 0.96, cooldownRate: 1.08 },
  SLIME: { damageOut: 2.35, damageTaken: 0.85, cooldownRate: 1.42 },
  TIME: { damageOut: 1.2, damageTaken: 0.95, cooldownRate: 1.05 },
  WOLF: { damageOut: 1.05, damageTaken: 0.98, cooldownRate: 1.04 },
  PUPPET: { damageOut: 1.8, damageTaken: 1.35, cooldownRate: 1.35 },
  WITCH: { damageOut: 1, damageTaken: 1.03, cooldownRate: 1.01 },
  PIRATE: { damageOut: 0.58, damageTaken: 1.16, cooldownRate: 0.82 },
  PAINTER: { damageOut: 0.72, damageTaken: 2.4, cooldownRate: 0.9 },
  KUNGFU: { damageOut: 0.86, damageTaken: 1.08, cooldownRate: 0.95 },
  SUPERSTAR: { damageOut: 1.38, damageTaken: 0.88, cooldownRate: 1.28 }
};

export function tuningFor(name) {
  return FIGHTER_TUNING[name] || { damageOut: 1, damageTaken: 1, cooldownRate: 1 };
}
