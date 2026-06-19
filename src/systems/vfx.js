export function createVfxEvent(kind, x, y, color = "#fff", count = 8) {
  return {
    kind,
    x,
    y,
    color,
    count,
    life: 0.55,
    maxLife: 0.55,
    particles: Array.from({ length: Math.min(32, count) }, (_, i) => {
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const speed = 60 + ((i * 97) % 220);
      return { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: 2 + (i % 5) };
    })
  };
}

export function updateVfx(game, dt) {
  for (let i = game.vfx.length - 1; i >= 0; i -= 1) {
    const fx = game.vfx[i];
    fx.life -= dt;
    for (const p of fx.particles || []) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    if (fx.life <= 0) game.vfx.splice(i, 1);
  }
  for (let i = game.floatingTexts.length - 1; i >= 0; i -= 1) {
    const t = game.floatingTexts[i];
    t.life -= dt;
    t.y -= 70 * dt;
    if (t.life <= 0) game.floatingTexts.splice(i, 1);
  }
}
