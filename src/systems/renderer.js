import { GAME_SIZE } from "../data/balanceConfig.js";
import { getVisual } from "../data/visualManifest.js";
import { clamp, TAU } from "../core/rng.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.cinematic = false;
    this.cameraShake = 0;
    this.assets = new Map();
  }

  setCinematic(enabled) {
    this.cinematic = enabled;
  }

  render(game) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, GAME_SIZE, GAME_SIZE);
    const shake = this.cinematic ? Math.min(14, Math.max(this.cameraShake, game.highlights.length ? 4 : 0)) : 0;
    ctx.translate(GAME_SIZE / 2 + jitter(game.matchClock, 4) * shake, GAME_SIZE / 2 + jitter(game.matchClock + 9, 4) * shake);
    const zoom = this.cinematic ? 1.015 + Math.sin(game.matchClock * 0.9) * 0.006 : 1;
    ctx.scale(zoom, zoom);
    ctx.translate(-GAME_SIZE / 2, -GAME_SIZE / 2);
    drawBackground(ctx, game);
    for (const p of game.projectiles) drawProjectile(ctx, p, game);
    for (const fx of game.vfx) drawVfx(ctx, fx);
    for (const f of game.fighters) if (f.hp > 0) drawFighter(ctx, f, game);
    for (const text of game.floatingTexts) drawFloatingText(ctx, text);
    ctx.restore();
  }
}

function drawBackground(ctx, game) {
  ctx.fillStyle = "#0d0b0a";
  ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);
  const grad = ctx.createRadialGradient(500, 500, 80, 500, 500, 720);
  grad.addColorStop(0, "rgba(70,55,42,.2)");
  grad.addColorStop(0.75, "rgba(10,9,8,.88)");
  grad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#b2a47e";
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_SIZE; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GAME_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= GAME_SIZE; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_SIZE, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.44;
  ctx.strokeStyle = "#5f513b";
  ctx.lineWidth = 9;
  ctx.strokeRect(4, 4, GAME_SIZE - 8, GAME_SIZE - 8);
  ctx.restore();
  if (game.fighters.some((f) => f.name === "TIME" && f.hp > 0)) drawClockArena(ctx, game.matchClock);
}

function drawClockArena(ctx, time) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#d6d0ff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(500, 500, 430, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#d6d0ff";
  ctx.font = "900 26px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 1; i <= 12; i += 1) {
    const a = -Math.PI / 2 + (i * TAU) / 12;
    ctx.fillText(String(i), 500 + Math.cos(a) * 405, 500 + Math.sin(a) * 405);
  }
  ctx.strokeStyle = "#efeaff";
  ctx.lineWidth = 8;
  const a = ((time % 13) / 13) * TAU - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(500, 500);
  ctx.lineTo(500 + Math.cos(a) * 260, 500 + Math.sin(a) * 260);
  ctx.stroke();
  ctx.restore();
}

function drawFighter(ctx, f, game) {
  const visual = getVisual(f.name);
  ctx.save();
  if (f.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(f.trail[0].x, f.trail[0].y);
    for (const p of f.trail) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = f.color;
    ctx.globalAlpha = 0.11;
    ctx.lineWidth = f.radius * 0.55;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.translate(f.x, f.y);
  ctx.rotate(Math.atan2(f.dir.y, f.dir.x));
  if (f.isRage) {
    ctx.save();
    ctx.strokeStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 14, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  drawShape(ctx, visual.shape, f.radius, f.color, f, game);
  ctx.rotate(-Math.atan2(f.dir.y, f.dir.x));
  ctx.fillStyle = "#f7efe1";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 5;
  ctx.font = "900 18px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.strokeText(visual.glyph, 0, 7);
  ctx.fillText(visual.glyph, 0, 7);
  drawStatus(ctx, f);
  ctx.restore();
}

function drawShape(ctx, shape, r, color, f, game) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 6;
  if (shape === "bolt") polygon(ctx, [[-28, -70], [55, -8], [16, -5], [52, 70], [-62, -3], [-12, 0]], color);
  else if (shape === "crystal" || shape === "diamond") polygon(ctx, [[0, -78], [58, -20], [32, 62], [-45, 55], [-66, -10]], color);
  else if (shape === "magnet") {
    ctx.lineWidth = 22;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.arc(0, 0, 48, -Math.PI * 0.78, Math.PI * 0.78);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#211b00";
    ctx.stroke();
  } else if (shape === "saw") {
    ctx.beginPath();
    for (let i = 0; i < 22; i += 1) {
      const a = (i / 22) * TAU;
      const rr = i % 2 ? r * 0.82 : r * 1.05;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape === "clock") {
    polygon(ctx, [[-55, -58], [55, -58], [66, 0], [55, 58], [-55, 58], [-66, 0]], "#2a2440", "#d6d0ff");
    ctx.strokeStyle = "#d6d0ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 43, 0, TAU);
    ctx.stroke();
  } else if (shape === "pirate") {
    polygon(ctx, [[-62, -34], [-20, -62], [50, -44], [60, 48], [-48, 56]], "#3a1f14", color);
    ctx.fillStyle = "#14100c";
    ctx.fillRect(-44, -58, 92, 18);
    ctx.strokeStyle = "#eee1bb";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(32, 4, 18, -0.8, 0.8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "900 17px serif";
    ctx.fillText("ANCHOR", 0, 34);
  } else if (shape === "martial") {
    polygon(ctx, [[-46, -58], [46, -58], [62, 40], [0, 66], [-62, 40]], "#3b2417", "#ffd28a");
    ctx.strokeStyle = "#ffd28a";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-40, -5);
    ctx.lineTo(-86, -22);
    ctx.moveTo(40, -5);
    ctx.lineTo(86, -22);
    ctx.stroke();
    if (f.data.combo) {
      ctx.fillStyle = "#ffd28a";
      ctx.font = "900 18px ui-monospace, monospace";
      ctx.fillText(`COMBO ${f.data.combo}`, 0, -r - 16);
    }
  } else {
    sketchBlob(ctx, r, color, shape === "spider" ? 9 : 14);
  }
}

function drawStatus(ctx, f) {
  const labels = [];
  if (f.hasStatus("freeze")) labels.push(["FREEZE", "#a6f4ff"]);
  if (f.hasStatus("stun")) labels.push(["STUN", "#fff36a"]);
  if (f.hasStatus("poison")) labels.push(["POISON", "#88ff00"]);
  if (f.hasStatus("weak")) labels.push(["WEAK", "#ff3030"]);
  labels.forEach(([label, color], i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 20 + i * 10, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "800 13px ui-monospace, monospace";
    ctx.fillText(label, 0, -f.radius - 24 - i * 16);
  });
}

function drawProjectile(ctx, p, game) {
  ctx.save();
  const alpha = p.maxLife && p.life !== Infinity ? clamp(p.life / p.maxLife, 0.12, 1) : 0.85;
  ctx.globalAlpha = alpha;
  if (["toxic_trail", "toxic_puddle"].includes(p.type)) {
    ctx.fillStyle = "#8dff26";
    circle(ctx, p.x, p.y, p.radius);
  } else if (p.type === "ice_lane" || p.type === "painter_stroke") {
    ctx.strokeStyle = p.color || (p.type === "ice_lane" ? "#d8ffff" : "#fff");
    ctx.lineWidth = p.type === "ice_lane" ? p.halfWidth * 2 : (p.width || 60) * 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();
  } else if (p.type === "meteor") {
    ctx.fillStyle = p.hit ? "#ff7a1f" : "#ffb02e";
    circle(ctx, p.x, p.y, p.radius * (p.hit ? 1 : 0.45));
  } else if (p.type === "gravity_well") {
    ctx.fillStyle = "#000";
    circle(ctx, p.x, p.y, p.core || 90);
    ctx.strokeStyle = "#9d6bff";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 140, 42, game.matchClock, 0, TAU);
    ctx.stroke();
  } else if (p.type === "blade_wave") {
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.fillStyle = "rgba(230,246,255,.35)";
    ctx.beginPath();
    ctx.ellipse(-p.length * 0.35, 0, p.length * 0.55, p.halfWidth * 0.9, 0, -0.82, 0.82);
    ctx.fill();
  } else if (p.type === "web_line" || p.type === "pirate_anchor") {
    ctx.strokeStyle = p.type === "web_line" ? "#d9ccff" : "#d7a34a";
    ctx.lineWidth = p.type === "web_line" ? 5 : 7;
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();
    if (p.type === "pirate_anchor") {
      ctx.fillStyle = "#2d2a25";
      circle(ctx, p.x2, p.y2, 22);
    }
  } else if (p.x !== undefined && p.y !== undefined) {
    const color = p.owner?.color || "#fff";
    ctx.fillStyle = projectileColor(p.type, color);
    circle(ctx, p.x, p.y, p.radius || 16);
    if (p.type === "slime_child" || p.type === "puppet_effigy") {
      ctx.fillStyle = "#fff";
      ctx.font = "900 13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(Math.max(0, Math.ceil(p.hp || 0)), p.x, p.y + (p.radius || 16) + 16);
    }
  }
  ctx.restore();
}

function drawVfx(ctx, fx) {
  const a = clamp(fx.life / fx.maxLife, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, 20 + (1 - a) * 120, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = fx.color;
  for (const p of fx.particles || []) {
    ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
  }
  ctx.restore();
}

function drawFloatingText(ctx, text) {
  ctx.save();
  ctx.globalAlpha = clamp(text.life / text.maxLife, 0, 1);
  ctx.fillStyle = text.color;
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 5;
  ctx.font = "900 28px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.strokeText(text.text, text.x, text.y);
  ctx.fillText(text.text, text.x, text.y);
  ctx.restore();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function polygon(ctx, pts, fill, stroke = "#080808") {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 6;
  ctx.stroke();
}

function sketchBlob(ctx, r, color, seed = 10) {
  ctx.beginPath();
  for (let i = 0; i <= seed; i += 1) {
    const a = (i / seed) * TAU;
    const rr = r * (0.9 + 0.1 * Math.sin(i * 2.17 + r));
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#080808";
  ctx.lineWidth = 6;
  ctx.stroke();
}

function projectileColor(type, ownerColor) {
  if (type.includes("slime")) return "#7be66f";
  if (type.includes("virus")) return "#b9ff55";
  if (type.includes("card")) return "#ffe0a0";
  if (type.includes("math")) return "#95ff94";
  if (type.includes("cannon")) return "#2d3136";
  if (type.includes("palm")) return "#ffdda8";
  return ownerColor;
}

function jitter(t, salt) {
  return Math.sin(t * 41.7 + salt) * 0.5 + Math.sin(t * 19.3 + salt * 2) * 0.5;
}
