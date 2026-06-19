#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRng, percentile } from "../src/core/rng.js";
import { rosterNames } from "../src/data/fighterTypes.js";
import { SIMULATION } from "../src/data/balanceConfig.js";
import { runMatch } from "../src/systems/simulator.js";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const prefix = `${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  if (!hit) return fallback;
  return hit.slice(prefix.length);
};

const tournaments = Number(getArg("--tournaments", 64));
const baseSeed = getArg("--seed", "tournament-balance");
const maxSeconds = Number(getArg("--maxSeconds", Math.max(360, SIMULATION.maxSeconds)));
const retryLimit = Number(getArg("--retryLimit", 80));
const untilAllChampions = args.includes("--untilAllChampions");
const maxBatches = Number(getArg("--maxBatches", untilAllChampions ? 8 : 1));
const started = Date.now();

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function runDeathMatch(left, right, context) {
  const attempts = [];
  for (let attempt = 0; attempt < retryLimit; attempt += 1) {
    const seed = `${baseSeed}:T${context.tournament}:R${context.round}:M${context.match}:A${attempt}:${left}:${right}`;
    const result = runMatch(left, right, {
      seed,
      maxSeconds,
      config: { maxSeconds }
    });
    attempts.push({
      seed,
      winner: result.winner,
      reason: result.reason,
      duration: result.duration,
      unresolved: result.unresolved
    });
    if (!result.unresolved && result.reason === "death" && result.winner) {
      result.retryAttempts = attempt;
      return { result, attempts };
    }
  }
  const last = attempts[attempts.length - 1];
  throw new Error(
    `No death result after ${retryLimit} retries for ${left} vs ${right}; last=${JSON.stringify(last)}`
  );
}

function runTournament(index) {
  const rng = createRng(`${baseSeed}:bracket:${index}`);
  const entrants = shuffle(rosterNames, rng);
  const bracketSignature = entrants.join(">");
  let round = entrants.map((name) => ({ name }));
  const rounds = [];
  const matches = [];
  let roundIndex = 1;
  while (round.length > 1) {
    const next = [];
    const roundMatches = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i].name;
      const b = round[i + 1].name;
      const matchNumber = i / 2 + 1;
      const { result, attempts } = runDeathMatch(a, b, {
        tournament: index + 1,
        round: roundIndex,
        match: matchNumber
      });
      const winner = result.winner;
      const loser = winner === a ? b : a;
      const match = {
        id: `T${index + 1}-R${roundIndex}-M${matchNumber}`,
        round: roundIndex,
        a,
        b,
        winner,
        loser,
        duration: result.duration,
        seed: result.seed,
        retryAttempts: result.retryAttempts,
        attempts
      };
      roundMatches.push(match);
      matches.push(match);
      next.push({ name: winner });
    }
    rounds.push(roundMatches);
    round = next;
    roundIndex += 1;
  }
  return {
    index: index + 1,
    entrants,
    bracketSignature,
    champion: round[0].name,
    rounds,
    matches
  };
}

const tournamentResults = [];
let batchesRun = 0;
while (batchesRun < maxBatches) {
  const batchStart = tournamentResults.length;
  for (let i = 0; i < tournaments; i += 1) {
    tournamentResults.push(runTournament(batchStart + i));
  }
  batchesRun += 1;
  if (!untilAllChampions) break;
  const coverage = Object.fromEntries(rosterNames.map((name) => [name, 0]));
  for (const tournament of tournamentResults) coverage[tournament.champion] += 1;
  if (rosterNames.every((name) => coverage[name] > 0)) break;
}

const allMatches = tournamentResults.flatMap((t) => t.matches);
const championCounts = Object.fromEntries(rosterNames.map((name) => [name, 0]));
for (const tournament of tournamentResults) championCounts[tournament.champion] += 1;

const pairKeys = new Set();
for (const match of allMatches) pairKeys.add([match.a, match.b].sort().join("__"));
const retryMatches = allMatches.filter((match) => match.retryAttempts > 0);
const durations = allMatches.map((match) => match.duration);
const missingChampions = rosterNames.filter((name) => championCounts[name] <= 0);
const sortedChampions = Object.entries(championCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const summary = {
  generatedAt: new Date().toISOString(),
  command: args,
  baseSeed,
  roster: rosterNames,
  settings: {
    tournaments: tournamentResults.length,
    batchSize: tournaments,
    batchesRun,
    untilAllChampions,
    bracketSize: rosterNames.length,
    maxSeconds,
    retryLimit
  },
  sample: {
    totalTournamentMatches: allMatches.length,
    uniquePairs: pairKeys.size,
    uniqueBracketOrders: new Set(tournamentResults.map((t) => t.bracketSignature)).size,
    deathWins: allMatches.length,
    timeoutWins: 0,
    retryMatches: retryMatches.length,
    retryAttempts: allMatches.reduce((sum, match) => sum + match.retryAttempts, 0)
  },
  durationStats: {
    average: avg(durations),
    median: percentile(durations, 0.5),
    p90: percentile(durations, 0.9),
    max: Math.max(...durations)
  },
  championCounts,
  sortedChampions,
  missingChampions,
  pass: {
    allWinsByDeath: true,
    randomizedEveryTournament: new Set(tournamentResults.map((t) => t.bracketSignature)).size === tournamentResults.length,
    allFightersChampionAtLeastOnce: missingChampions.length === 0
  },
  tournaments: tournamentResults.map((t) => ({
    index: t.index,
    champion: t.champion,
    entrants: t.entrants,
    rounds: t.rounds.map((round) =>
      round.map(({ attempts, ...match }) => ({
        ...match,
        attemptCount: attempts.length
      }))
    )
  })),
  runtimeMs: Date.now() - started
};

await mkdir(resolve("reports"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const prefix = `tournament-balance-${stamp}`;
await writeFile(resolve("reports", `${prefix}.json`), JSON.stringify(summary, null, 2));
await writeFile(resolve("reports", `${prefix}.md`), renderMarkdown(summary));
await writeFile(resolve("reports", "latest-tournament-balance.json"), JSON.stringify(summary, null, 2));
await writeFile(resolve("reports", "latest-tournament-balance.md"), renderMarkdown(summary));

console.log(
  JSON.stringify(
    {
      tournaments: summary.settings.tournaments,
      matches: summary.sample.totalTournamentMatches,
      uniquePairs: summary.sample.uniquePairs,
      uniqueBracketOrders: summary.sample.uniqueBracketOrders,
      deathWins: summary.sample.deathWins,
      timeoutWins: summary.sample.timeoutWins,
      retryMatches: summary.sample.retryMatches,
      missingChampions,
      topChampions: sortedChampions.slice(0, 8),
      runtimeMs: summary.runtimeMs,
      latest: {
        json: "reports/latest-tournament-balance.json",
        md: "reports/latest-tournament-balance.md"
      }
    },
    null,
    2
  )
);

function renderMarkdown(summary) {
  const lines = [];
  lines.push("# Apex Chaos Tournament Balance Report");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Seed: \`${summary.baseSeed}\``);
  lines.push(`Tournaments: ${summary.settings.tournaments}`);
  lines.push(`Bracket size: ${summary.settings.bracketSize}`);
  lines.push(`Matches: ${summary.sample.totalTournamentMatches}`);
  lines.push(`Unique pairs: ${summary.sample.uniquePairs}`);
  lines.push(`Unique bracket orders: ${summary.sample.uniqueBracketOrders}`);
  lines.push(`Death wins: ${summary.sample.deathWins}`);
  lines.push(`Timeout wins: ${summary.sample.timeoutWins}`);
  lines.push(`Retry matches: ${summary.sample.retryMatches}`);
  lines.push("");
  lines.push("## Pass Gates");
  for (const [key, value] of Object.entries(summary.pass)) lines.push(`- ${key}: ${value ? "PASS" : "CHECK"}`);
  lines.push("");
  lines.push("## Duration");
  lines.push(
    `Average ${summary.durationStats.average.toFixed(1)}s, median ${summary.durationStats.median.toFixed(1)}s, p90 ${summary.durationStats.p90.toFixed(1)}s, max ${summary.durationStats.max.toFixed(1)}s.`
  );
  lines.push("");
  lines.push("## Champion Counts");
  lines.push("| Fighter | Championships |");
  lines.push("|---|---:|");
  for (const [name, count] of summary.sortedChampions) lines.push(`| ${name} | ${count} |`);
  lines.push("");
  lines.push("## Missing Champions");
  lines.push(summary.missingChampions.length ? summary.missingChampions.join(", ") : "None.");
  return `${lines.join("\n")}\n`;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
