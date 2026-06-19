import { audioBuses, audioManifest, uiAudio } from "../data/audioManifest.js";

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.buses = structuredClone(audioBuses);
    this.cooldowns = new Map();
    this.lastMusic = null;
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setBus(name, volume) {
    if (this.buses[name]) this.buses[name].volume = Math.max(0, Math.min(this.buses[name].cap, volume));
  }

  playUi(name = "select") {
    const cfg = uiAudio[name] || uiAudio.select;
    this.playProcedural(`ui:${name}`, cfg, "ui");
  }

  playFighter(name, action = "skill_cast") {
    const entry = audioManifest[name];
    const cfg = entry?.sfx?.[action]?.fallback;
    if (!cfg) return;
    this.playProcedural(`${name}:${action}`, cfg, "sfx");
  }

  consumeEvents(events) {
    if (!events?.length) return;
    const selected = events
      .sort((a, b) => priority(b.action) - priority(a.action))
      .slice(0, 5);
    for (const event of selected) this.playFighter(event.name, event.action);
    events.length = 0;
  }

  playProcedural(key, cfg, busName = "sfx") {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = this.cooldowns.get(key) || 0;
    if (now - last < (cfg.cooldown || 0.08)) return;
    this.cooldowns.set(key, now);
    const bus = this.buses[busName] || this.buses.sfx;
    const master = this.buses.master;
    const gainValue = Math.min(bus.cap, bus.volume) * Math.min(master.cap, master.volume) * (cfg.gain || 0.1);
    const dur = cfg.dur || 0.22;
    const start = Math.max(24, cfg.base || 320);
    const end = Math.max(24, start * (cfg.bend || 1.2));
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = cfg.wave || "triangle";
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(end, now + dur);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
    if (cfg.noise) this.playNoise(dur * 0.7, gainValue * cfg.noise * 2.2, cfg.base > 700 ? 2200 : 600);
  }

  playNoise(duration, gainValue, filterFreq = 900) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 4;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }
}

function priority(action) {
  if (action === "death_or_finisher") return 5;
  if (action === "rage_trigger") return 4;
  if (action === "skill_hit") return 3;
  if (action === "skill_cast") return 2;
  return 1;
}
