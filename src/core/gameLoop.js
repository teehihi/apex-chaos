export class GameLoop {
  constructor({ update, render, timestep = 1 / 60 }) {
    this.update = update;
    this.render = render;
    this.timestep = timestep;
    this.accumulator = 0;
    this.last = 0;
    this.frame = 0;
    this.running = false;
    this.timeScale = 1;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  stop() {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  tick(time) {
    if (!this.running) return;
    const rawDt = Math.min(0.05, (time - this.last) / 1000 || 0);
    this.last = time;
    this.accumulator += rawDt * this.timeScale;
    let guard = 0;
    while (this.accumulator >= this.timestep && guard < 4) {
      this.update(this.timestep);
      this.accumulator -= this.timestep;
      guard += 1;
    }
    this.render(rawDt);
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }
}
