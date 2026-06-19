import { replayLabel } from "../systems/replay.js";

export function renderPostMatch(root, result, actions) {
  const winner = result.winner || "Draw";
  const rows = result.fighters
    .map((f) => {
      const labels = Object.entries(f.damageLabels || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, value]) => `<li>${label}: ${value.toFixed(1)}</li>`)
        .join("");
      return `
        <article class="stat-card">
          <h3>${f.name}</h3>
          <p>Final HP ${f.hp.toFixed(1)} | Damage ${f.damageDone.toFixed(1)} | Taken ${f.damageTaken.toFixed(1)} | Healing ${f.healingDone.toFixed(1)}</p>
          <ul>${labels || "<li>No major source</li>"}</ul>
        </article>
      `;
    })
    .join("");
  const highlights = (result.highlights || [])
    .slice(0, 8)
    .map((h) => `<li>${h.time}s ${h.kind}: ${h.actor || ""}${h.target ? ` -> ${h.target}` : ""}</li>`)
    .join("");
  root.innerHTML = `
    <section class="screen post-screen">
      <h1>${winner} wins</h1>
      <div class="battle-tags">
        <span>${result.duration.toFixed(1)}s matchClock</span>
        <span>${result.reason}</span>
        <span>${replayLabel(result.replay)}</span>
      </div>
      <div class="stats-grid">${rows}</div>
      <div class="timeline"><h3>Highlights</h3><ul>${highlights || "<li>No highlight markers</li>"}</ul></div>
      <div class="menu-actions">
        <button data-action="rematch">Rematch Seed</button>
        <button data-action="select">Select</button>
        <button data-action="menu">Menu</button>
        <button data-action="tournamentNext">Tournament Next</button>
      </div>
    </section>
  `;
  root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => actions[button.dataset.action]?.()));
}
