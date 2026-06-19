export function renderGameShell(root, actions) {
  root.innerHTML = `
    <section class="game-shell">
      <div class="game-top">
        <button data-action="menu">Menu</button>
        <button data-action="random">Auto Random</button>
        <button data-action="cinematic">Cinematic</button>
      </div>
      <div class="arena-wrap">
        <canvas id="game-canvas" width="1000" height="1000"></canvas>
        <div class="hud">
          <div class="hud-fighter left">
            <div class="name" id="p1-name">P1</div>
            <div class="hp-track"><div class="hp-loss-trail" id="p1-hp-loss"></div><div class="hp-fill" id="p1-hp"></div><span id="p1-hp-text"></span></div>
            <div class="rage" id="p1-rage">RAGE ACTIVE</div>
          </div>
          <div class="clock" id="match-clock">0.0s</div>
          <div class="hud-fighter right">
            <div class="name" id="p2-name">P2</div>
            <div class="hp-track"><div class="hp-loss-trail" id="p2-hp-loss"></div><div class="hp-fill" id="p2-hp"></div><span id="p2-hp-text"></span></div>
            <div class="rage" id="p2-rage">RAGE ACTIVE</div>
          </div>
        </div>
      </div>
    </section>
  `;
  root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => actions[button.dataset.action]?.()));
  return root.querySelector("#game-canvas");
}

export function updateHud(game) {
  if (!game?.fighters?.length) return;
  const clock = document.getElementById("match-clock");
  if (clock) clock.textContent = `${game.matchClock.toFixed(1)}s`;
  game.fighters.slice(0, 2).forEach((fighter, index) => {
    const n = index + 1;
    const hp = document.getElementById(`p${n}-hp`);
    const text = document.getElementById(`p${n}-hp-text`);
    const name = document.getElementById(`p${n}-name`);
    const rage = document.getElementById(`p${n}-rage`);
    if (name) name.textContent = fighter.name;
    if (hp) {
      hp.style.width = `${Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100))}%`;
      hp.style.background = fighter.color;
    }
    if (text) text.textContent = `${fighter.hp.toFixed(1)} / ${fighter.maxHp}`;
    if (rage) rage.style.opacity = fighter.isRage ? "1" : "0";
  });
}
