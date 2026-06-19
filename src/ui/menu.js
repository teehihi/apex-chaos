export function renderMenu(root, actions) {
  root.innerHTML = `
    <section class="screen menu-screen">
      <div class="brand-block">
        <h1>Apex Chaos</h1>
        <p>32 Fighters. Arena 1000x1000. Deterministic seeds, replayable chaos.</p>
      </div>
      <div class="menu-actions">
        <button data-action="play">Play</button>
        <button data-action="random">Random Match</button>
        <button data-action="tournament">Tournament</button>
        <button data-action="challenge">Random Challenge</button>
      </div>
      <div class="mini-panel">
        <strong>Dev tools</strong>
        <button data-action="balance">Run Browser Smoke</button>
      </div>
    </section>
  `;
  bind(root, actions);
}

export function bind(root, actions) {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => actions[button.dataset.action]?.());
  });
}
