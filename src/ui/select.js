import { FighterTypes } from "../data/fighterTypes.js";
import { getVisual } from "../data/visualManifest.js";

export function renderSelect(root, state, actions) {
  const { p1, p2 } = state;
  root.innerHTML = `
    <section class="screen select-screen">
      <header class="topbar">
        <button data-action="menu">Back</button>
        <div>
          <h2>${p1 ? (p2 ? "Ready" : "Select Player 2") : "Select Player 1"}</h2>
          <p>${FighterTypes.length} Fighters. WIND removed from this roster.</p>
        </div>
        <button data-action="start" ${p1 && p2 ? "" : "disabled"}>Engage</button>
      </header>
      <div class="selected-strip">
        <div class="pick-card ${p1 ? "filled" : ""}">${p1 || "P1"}</div>
        <div class="pick-card ${p2 ? "filled" : ""}">${p2 || "P2"}</div>
      </div>
      <div class="roster-grid">
        ${FighterTypes.map(cardTemplate).join("")}
      </div>
    </section>
  `;
  root.querySelectorAll("[data-name]").forEach((card) => {
    card.addEventListener("click", () => actions.pick(card.dataset.name));
  });
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => actions[button.dataset.action]?.());
  });
}

function cardTemplate(type) {
  const visual = getVisual(type.name);
  return `
    <button class="fighter-card" data-name="${type.name}" style="--accent:${type.color}">
      <span class="fighter-icon">${visual.glyph}</span>
      <strong>${type.name}</strong>
      <small>${type.desc}</small>
    </button>
  `;
}
