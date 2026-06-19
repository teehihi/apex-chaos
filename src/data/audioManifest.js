const baseVoices = {
  RUBBER: { base: 150, wave: "sine", bend: 2.25, noise: 0.05 },
  ICE: { base: 720, wave: "triangle", bend: 0.48, noise: 0.025 },
  VAMPIRE: { base: 82, wave: "sawtooth", bend: 0.62, noise: 0.04 },
  SPIDER: { base: 430, wave: "square", bend: 1.35, noise: 0.02 },
  VOLCANO: { base: 58, wave: "sawtooth", bend: 0.38, noise: 0.1 },
  MAGNET: { base: 120, wave: "sine", bend: 1.02, noise: 0.03 },
  FLASH: { base: 920, wave: "sawtooth", bend: 2.7, noise: 0.018 },
  ELECTRIC: { base: 980, wave: "square", bend: 0.31, noise: 0.06 },
  ORBIT: { base: 530, wave: "sine", bend: 1.62, noise: 0.018 },
  TOXIC: { base: 190, wave: "triangle", bend: 0.58, noise: 0.08 },
  MIRROR: { base: 840, wave: "triangle", bend: 1.42, noise: 0.022 },
  BLACK_HOLE: { base: 42, wave: "sine", bend: 0.42, noise: 0.04 },
  SAW: { base: 310, wave: "sawtooth", bend: 1.1, noise: 0.1 },
  BLADE: { base: 640, wave: "triangle", bend: 1.85, noise: 0.035 },
  NOVA: { base: 240, wave: "sine", bend: 3.25, noise: 0.03 },
  HUNTER: { base: 520, wave: "triangle", bend: 1.48, noise: 0.03 },
  CRYSTAL: { base: 900, wave: "sine", bend: 1.72, noise: 0.02 },
  VIRUS: { base: 115, wave: "sawtooth", bend: 0.72, noise: 0.09 },
  DRUM: { base: 95, wave: "sine", bend: 0.55, noise: 0.14 },
  CARD: { base: 620, wave: "triangle", bend: 1.32, noise: 0.016 },
  MATH: { base: 460, wave: "square", bend: 1.18, noise: 0.012 },
  MATH_V2: { base: 510, wave: "square", bend: 0.86, noise: 0.012 },
  SNIPER: { base: 760, wave: "triangle", bend: 0.34, noise: 0.04 },
  SLIME: { base: 210, wave: "sine", bend: 0.65, noise: 0.07 },
  TIME: { base: 520, wave: "square", bend: 0.8, noise: 0.018 },
  WOLF: { base: 140, wave: "sawtooth", bend: 0.55, noise: 0.06 },
  PUPPET: { base: 265, wave: "triangle", bend: 0.7, noise: 0.04 },
  WITCH: { base: 760, wave: "triangle", bend: 0.72, noise: 0.026 },
  PIRATE: { base: 180, wave: "sawtooth", bend: 0.62, noise: 0.07 },
  PAINTER: { base: 460, wave: "triangle", bend: 1.4, noise: 0.022 },
  KUNGFU: { base: 300, wave: "triangle", bend: 1.2, noise: 0.035 },
  SUPERSTAR: { base: 680, wave: "sine", bend: 1.55, noise: 0.03 }
};

export const audioBuses = {
  master: { volume: 0.72, cap: 0.9 },
  music: { volume: 0.28, cap: 0.45 },
  sfx: { volume: 0.68, cap: 0.75 },
  ui: { volume: 0.5, cap: 0.7 }
};

const actions = {
  wall_hit: { dur: 0.12, gain: 0.08, priority: 1, cooldown: 0.08 },
  skill_cast: { dur: 0.28, gain: 0.12, priority: 2, cooldown: 0.16 },
  skill_hit: { dur: 0.2, gain: 0.14, priority: 3, cooldown: 0.1 },
  rage_trigger: { dur: 0.55, gain: 0.2, priority: 4, cooldown: 1 },
  death_or_finisher: { dur: 0.6, gain: 0.22, priority: 5, cooldown: 0.5 }
};

export const audioManifest = Object.fromEntries(
  Object.entries(baseVoices).map(([name, voice]) => [
    name,
    {
      voice,
      sfx: Object.fromEntries(
        Object.entries(actions).map(([action, cfg]) => [
          action,
          {
            asset: `/assets/audio/${name.toLowerCase()}_${action}.webm`,
            fallback: { ...voice, ...cfg }
          }
        ])
      )
    }
  ])
);

export const uiAudio = {
  select: { base: 520, bend: 1.4, wave: "triangle", dur: 0.08, gain: 0.07, priority: 2, cooldown: 0.05 },
  menu_music: { asset: "/assets/audio/menu_loop.webm", fallback: { base: 96, wave: "sine" } },
  select_music: { asset: "/assets/audio/select_loop.webm", fallback: { base: 128, wave: "triangle" } },
  tournament_music: { asset: "/assets/audio/tournament_loop.webm", fallback: { base: 72, wave: "sawtooth" } }
};
