export const visualManifest = {
  RUBBER: { color: "#b7376f", glyph: "RUB", shape: "blob", asset: "/assets/images/fighters/rubber.webp", vfx: ["kinetic_ring", "red_rubber"] },
  ICE: { color: "#74d8e8", glyph: "ICE", shape: "crystal", asset: "/assets/images/fighters/ice.webp", vfx: ["ice_lane", "frost_darts"] },
  VAMPIRE: { color: "#8f101e", glyph: "VMP", shape: "fangs", asset: "/assets/images/fighters/vampire.webp", vfx: ["blood_link", "bite_lock"] },
  SPIDER: { color: "#3b2148", glyph: "WEB", shape: "spider", asset: "/assets/images/fighters/spider.webp", vfx: ["web_line", "web_snare"] },
  VOLCANO: { color: "#8f3728", glyph: "LVA", shape: "volcano", asset: "/assets/images/fighters/volcano.webp", vfx: ["meteor", "fire_pit"] },
  MAGNET: { color: "#c6a92d", glyph: "MAG", shape: "magnet", asset: "/assets/images/fighters/magnet.webp", vfx: ["field", "slam"] },
  FLASH: { color: "#e6d946", glyph: "FLS", shape: "bolt", asset: "/assets/images/fighters/flash.webp", vfx: ["zigzag", "afterimage"] },
  ELECTRIC: { color: "#2f6dff", glyph: "ELC", shape: "charge", asset: "/assets/images/fighters/electric.webp", vfx: ["wall_node", "discharge"] },
  ORBIT: { color: "#dedbd1", glyph: "ORB", shape: "orbit", asset: "/assets/images/fighters/orbit.webp", vfx: ["satellites"] },
  TOXIC: { color: "#8dff26", glyph: "TOX", shape: "drop", asset: "/assets/images/fighters/toxic.webp", vfx: ["poison", "puddle"] },
  MIRROR: { color: "#dff6ff", glyph: "MIR", shape: "mirror", asset: "/assets/images/fighters/mirror.webp", vfx: ["mirror_gate"] },
  BLACK_HOLE: { color: "#1d102b", glyph: "BLK", shape: "hole", asset: "/assets/images/fighters/black_hole.webp", vfx: ["gravity_well"] },
  SAW: { color: "#d7caba", glyph: "SAW", shape: "saw", asset: "/assets/images/fighters/saw.webp", vfx: ["spin", "blood_rip"] },
  BLADE: { color: "#d7f4ff", glyph: "BLD", shape: "blade", asset: "/assets/images/fighters/blade.webp", vfx: ["blade_wave", "red_slash"] },
  NOVA: { color: "#fff1b4", glyph: "NVA", shape: "star", asset: "/assets/images/fighters/nova.webp", vfx: ["nova_peak"] },
  HUNTER: { color: "#8e4d2c", glyph: "HNT", shape: "bow", asset: "/assets/images/fighters/hunter.webp", vfx: ["hunt", "trap"] },
  CRYSTAL: { color: "#bffcff", glyph: "CRY", shape: "diamond", asset: "/assets/images/fighters/crystal.webp", vfx: ["wall", "cage"] },
  VIRUS: { color: "#b9ff55", glyph: "VIR", shape: "cell", asset: "/assets/images/fighters/virus.webp", vfx: ["parasites"] },
  DRUM: { color: "#d9a34a", glyph: "DRM", shape: "drum", asset: "/assets/images/fighters/drum.webp", vfx: ["sound_wave"] },
  CARD: { color: "#ffe0a0", glyph: "CRD", shape: "card", asset: "/assets/images/fighters/card.webp", vfx: ["cards"] },
  MATH: { color: "#95ff94", glyph: "MTH", shape: "formula", asset: "/assets/images/fighters/math.webp", vfx: ["formula"] },
  MATH_V2: { color: "#8fcfff", glyph: "F(X)", shape: "graph", asset: "/assets/images/fighters/math_v2.webp", vfx: ["graph"] },
  SNIPER: { color: "#d7dce3", glyph: "SNP", shape: "scope", asset: "/assets/images/fighters/sniper.webp", vfx: ["laser", "scope"] },
  SLIME: { color: "#7be66f", glyph: "SLM", shape: "slime", asset: "/assets/images/fighters/slime.webp", vfx: ["child", "mucus"] },
  TIME: { color: "#c8b6ff", glyph: "TIM", shape: "clock", asset: "/assets/images/fighters/time.webp", vfx: ["clock", "rift"] },
  WOLF: { color: "#b51b1b", glyph: "WLF", shape: "wolf", asset: "/assets/images/fighters/wolf.webp", vfx: ["scent", "pounce"] },
  PUPPET: { color: "#b08a55", glyph: "PUP", shape: "puppet", asset: "/assets/images/fighters/puppet.webp", vfx: ["effigy", "curse"] },
  WITCH: { color: "#ba67e8", glyph: "HEX", shape: "witch", asset: "/assets/images/fighters/witch.webp", vfx: ["curse", "ray"] },
  PIRATE: { color: "#d7a34a", glyph: "SEA", shape: "pirate", asset: "/assets/images/fighters/pirate.webp", vfx: ["anchor", "cannon", "loot"] },
  PAINTER: { color: "#f7d64a", glyph: "ART", shape: "painter", asset: "/assets/images/fighters/painter.webp", vfx: ["ink", "blob"] },
  KUNGFU: { color: "#e2a65d", glyph: "KFU", shape: "martial", asset: "/assets/images/fighters/kungfu.webp", vfx: ["combo", "trauma", "giant_palm"] },
  SUPERSTAR: { color: "#ff7bd6", glyph: "POP", shape: "star", asset: "/assets/images/fighters/superstar.webp", vfx: ["spotlight", "fans"] }
};

export function getVisual(name) {
  return visualManifest[name] || { color: "#ddd", glyph: name?.slice(0, 3) || "???", shape: "blob", asset: null, vfx: [] };
}
