export function hashSeed(input) {
  const text = String(input ?? "apex-chaos");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed = "apex-chaos") {
  let state = hashSeed(seed) || 0x9e3779b9;
  return {
    seed,
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.next();
    },
    int(min, maxInclusive) {
      return Math.floor(this.range(min, maxInclusive + 1));
    },
    chance(p) {
      return this.next() < p;
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)] ?? list[0];
    },
    fork(label) {
      return createRng(`${seed}:${label}:${Math.floor(this.next() * 1e9)}`);
    }
  };
}

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function norm(x, y) {
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

export function dot(ax, ay, bx, by) {
  return ax * bx + ay * by;
}

export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp((sorted.length - 1) * p, 0, sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lerp(sorted[lo], sorted[hi], idx - lo);
}
