import { createRng } from "./core/rng.js";
import { GameLoop } from "./core/gameLoop.js";
import { FighterTypes } from "./data/fighterTypes.js";
import { GameEngine, runSmokeSuite } from "./systems/simulator.js";
import { summarizeResults } from "./systems/analytics.js";
import { AudioManager } from "./systems/audio.js";
import { Renderer } from "./systems/renderer.js";
import { createTournament, applyTournamentResult, readyTournamentMatch } from "./systems/tournament.js";
import { renderMenu } from "./ui/menu.js";
import { renderSelect } from "./ui/select.js";
import { renderGameShell, updateHud } from "./ui/hud.js";
import { renderPostMatch } from "./ui/postMatch.js";

const app = document.getElementById("app");
const audio = new AudioManager();
let selected = { p1: null, p2: null };
let activeGame = null;
let renderer = null;
let loop = null;
let lastResult = null;
let tournament = null;
let tournamentMatch = null;
let cinematic = false;

showMenu();

function showMenu() {
  stopLoop();
  renderMenu(app, {
    play: showSelect,
    random: () => startRandomMatch(),
    tournament: showTournament,
    challenge: () => startRandomMatch(`challenge-${Date.now()}`),
    balance: runBrowserSmoke
  });
}

function showSelect() {
  stopLoop();
  selected = { p1: null, p2: null };
  renderSelect(app, selected, {
    menu: showMenu,
    pick: pickFighter,
    start: () => startMatch(selected.p1, selected.p2, { seed: `manual-${Date.now()}` })
  });
}

function pickFighter(name) {
  audio.playUi("select");
  if (!selected.p1) selected.p1 = name;
  else if (!selected.p2) selected.p2 = name;
  else selected = { p1: name, p2: null };
  renderSelect(app, selected, {
    menu: showMenu,
    pick: pickFighter,
    start: () => startMatch(selected.p1, selected.p2, { seed: `manual-${Date.now()}` })
  });
}

function startRandomMatch(seed = `random-${Date.now()}`) {
  const rng = createRng(seed);
  const a = rng.pick(FighterTypes).name;
  let b = rng.pick(FighterTypes).name;
  while (b === a) b = rng.pick(FighterTypes).name;
  startMatch(a, b, { seed });
}

function startMatch(left, right, options = {}) {
  if (!left || !right) return;
  const canvas = renderGameShell(app, {
    menu: showMenu,
    random: () => startRandomMatch(),
    cinematic: () => {
      cinematic = !cinematic;
      renderer?.setCinematic(cinematic);
    }
  });
  activeGame = new GameEngine({ seed: options.seed || `${left}-${right}-${Date.now()}`, mode: "browser" }).startMatch(left, right, options);
  activeGame.onEnd = (result) => {
    lastResult = result;
    stopLoop();
    if (tournament && tournamentMatch && result.winner) {
      applyTournamentResult(tournament, tournamentMatch.id, result.winner, result.loser, result);
      tournamentMatch = null;
    }
    renderPostMatch(app, result, {
      rematch: () => startMatch(result.left, result.right, { seed: result.seed }),
      select: showSelect,
      menu: showMenu,
      tournamentNext: showTournament
    });
  };
  renderer = new Renderer(canvas);
  renderer.setCinematic(cinematic);
  loop = new GameLoop({
    timestep: 1 / 60,
    update: (dt) => {
      activeGame.step(dt);
      audio.consumeEvents(activeGame.audioEvents);
      updateHud(activeGame);
    },
    render: () => renderer.render(activeGame)
  });
  loop.start();
}

function showTournament() {
  stopLoop();
  if (!tournament || tournament.champion) tournament = createTournament(createRng(`tournament-${Date.now()}`));
  const ready = readyTournamentMatch(tournament);
  app.innerHTML = `
    <section class="screen tournament-screen">
      <header class="topbar">
        <button data-action="menu">Menu</button>
        <div><h2>Tournament</h2><p>Full 32-fighter bracket. Current round ${tournament.currentRound + 1}.</p></div>
        <button data-action="reset">Shuffle</button>
      </header>
      ${tournament.champion ? `<h1>${tournament.champion} is champion</h1>` : ""}
      <div class="tournament-board">
        ${tournament.rounds
          .map(
            (round, i) => `
              <div class="round-column">
                <h3>Round ${i + 1}</h3>
                ${round
                  .map(
                    (m) => `
                    <button class="match-card ${m === ready ? "ready" : ""}" data-match="${m.id}" ${m.winner || !m.a || !m.b ? "disabled" : ""}>
                      <span>${m.a || "BYE"}</span><span>${m.b || "BYE"}</span><strong>${m.winner || (m === ready ? "READY" : "")}</strong>
                    </button>`
                  )
                  .join("")}
              </div>`
          )
          .join("")}
      </div>
    </section>
  `;
  app.querySelector('[data-action="menu"]').addEventListener("click", showMenu);
  app.querySelector('[data-action="reset"]').addEventListener("click", () => {
    tournament = createTournament(createRng(`tournament-${Date.now()}`));
    showTournament();
  });
  app.querySelectorAll("[data-match]").forEach((button) => {
    button.addEventListener("click", () => {
      const match = tournament.rounds.flat().find((m) => m.id === button.dataset.match);
      if (!match || match.winner) return;
      tournamentMatch = match;
      startMatch(match.a, match.b, { seed: `tournament:${match.id}:${Date.now()}` });
    });
  });
}

function runBrowserSmoke() {
  const results = runSmokeSuite(1, `browser-smoke-${Date.now()}`);
  const summary = summarizeResults(results);
  const bugs = summary.groups.suspectedBugs.length;
  alert(`Browser smoke: ${results.length} matches, avg ${summary.groups.durationStats.average.toFixed(1)}s, bugs ${bugs}. Use npm run balance for full reports.`);
}

function stopLoop() {
  if (loop) loop.stop();
  loop = null;
  activeGame = null;
}

window.__APEX_CHAOS__ = {
  runSmokeSuite,
  summarizeResults,
  get activeGame() {
    return activeGame;
  },
  get lastResult() {
    return lastResult;
  }
};
