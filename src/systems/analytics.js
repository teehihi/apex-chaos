import { percentile } from "../core/rng.js";
import { FighterTypes, rosterNames } from "../data/fighterTypes.js";
import { BALANCE_NOTES, SIMULATION } from "../data/balanceConfig.js";

export function summarizeResults(results) {
  const names = rosterNames;
  const byFighter = Object.fromEntries(
    names.map((name) => [
      name,
      {
        wins: 0,
        losses: 0,
        ties: 0,
        matches: 0,
        winScore: 0,
        durations: [],
        overlong: 0,
        damageDealt: 0,
        damageTaken: 0,
        healing: 0,
        labels: {}
      }
    ])
  );
  const matrix = Object.fromEntries(names.map((a) => [a, Object.fromEntries(names.map((b) => [b, null]))]));
  const pairStats = {};
  const bugs = [];
  const abnormalSeeds = [];

  for (const result of results) {
    const participants = [result.left, result.right].filter(Boolean);
    for (const name of participants) {
      const row = byFighter[name];
      row.matches += 1;
      row.durations.push(result.duration);
      if (result.overlong) row.overlong += 1;
      const dmg = result.damage[name] || {};
      row.damageDealt += dmg.dealt || 0;
      row.damageTaken += dmg.taken || 0;
      row.healing += dmg.healing || 0;
      for (const [label, value] of Object.entries(dmg.labels || {})) row.labels[label] = (row.labels[label] || 0) + value;
    }
    if (result.unresolved || !result.winner) {
      for (const name of participants) {
        byFighter[name].ties += 1;
        byFighter[name].winScore += 0.5;
      }
    } else {
      byFighter[result.winner].wins += 1;
      byFighter[result.winner].winScore += 1;
      if (result.loser) byFighter[result.loser].losses += 1;
    }
    const [a, b] = [result.left, result.right].sort();
    const key = `${a}__${b}`;
    pairStats[key] ||= { a, b, wins: { [a]: 0, [b]: 0 }, ties: 0, matches: 0, durations: [] };
    pairStats[key].matches += 1;
    pairStats[key].durations.push(result.duration);
    if (result.winner && pairStats[key].wins[result.winner] !== undefined) pairStats[key].wins[result.winner] += 1;
    else pairStats[key].ties += 1;
    if (result.bugs?.length) {
      for (const bug of result.bugs) bugs.push({ ...bug, matchup: `${result.left} vs ${result.right}`, seed: result.seed });
      abnormalSeeds.push(result.replay);
    }
    if (result.overlong) abnormalSeeds.push(result.replay);
  }

  for (const stat of Object.values(pairStats)) {
    const aScore = stat.wins[stat.a] + stat.ties * 0.5;
    const bScore = stat.wins[stat.b] + stat.ties * 0.5;
    matrix[stat.a][stat.b] = pct(aScore / Math.max(1, stat.matches));
    matrix[stat.b][stat.a] = pct(bScore / Math.max(1, stat.matches));
  }
  for (const name of names) matrix[name][name] = 0.5;

  const fighterSummaries = Object.fromEntries(
    Object.entries(byFighter).map(([name, row]) => {
      const topDamageSource = Object.entries(row.labels).sort((a, b) => b[1] - a[1])[0] || ["none", 0];
      return [
        name,
        {
          matches: row.matches,
          wins: row.wins,
          losses: row.losses,
          ties: row.ties,
          winrate: pct(row.winScore / Math.max(1, row.matches)),
          averageDuration: avg(row.durations),
          medianDuration: percentile(row.durations, 0.5),
          p10Duration: percentile(row.durations, 0.1),
          p90Duration: percentile(row.durations, 0.9),
          overlongRate: pct(row.overlong / Math.max(1, row.matches)),
          damageDealt: row.damageDealt,
          damageTaken: row.damageTaken,
          healing: row.healing,
          topDamageSource: { label: topDamageSource[0], value: topDamageSource[1] }
        }
      ];
    })
  );

  const durations = results.map((r) => r.duration);
  const winrates = Object.values(fighterSummaries).map((f) => f.winrate);
  const durationBands = {
    under60: results.filter((r) => r.duration < 60).length,
    in60to180: results.filter((r) => r.duration >= 60 && r.duration <= 180).length,
    over180: results.filter((r) => r.duration > 180).length
  };
  const pass = {
    noRosterDrift: FighterTypes.length === 32 && !FighterTypes.some((f) => f.name === "WIND"),
    winrateFloor: Math.min(...winrates) >= 0.4,
    winrateCeiling: Math.max(...winrates) <= 0.6,
    spreadWithin20pp: Math.max(...winrates) - Math.min(...winrates) <= 0.2,
    noRuntimeBugs: bugs.length === 0,
    majorityDurationInBand: durationBands.in60to180 >= results.length * 0.5
  };

  return {
    generatedAt: new Date().toISOString(),
    roster: names,
    sample: {
      totalMatches: results.length,
      uniquePairs: Object.keys(pairStats).length,
      overlongThresholdSeconds: SIMULATION.overlongSeconds,
      maxSimulationSeconds: SIMULATION.maxSeconds
    },
    groups: {
      winrateByFighter: fighterSummaries,
      durationStats: {
        average: avg(durations),
        median: percentile(durations, 0.5),
        p10: percentile(durations, 0.1),
        p90: percentile(durations, 0.9),
        bands: durationBands,
        timeoutOrOverlongRate: pct(results.filter((r) => r.overlong || r.unresolved).length / Math.max(1, results.length))
      },
      damageHealing: Object.fromEntries(Object.entries(fighterSummaries).map(([name, f]) => [name, { dealt: f.damageDealt, taken: f.damageTaken, healing: f.healing }])),
      topDamageSource: Object.fromEntries(Object.entries(fighterSummaries).map(([name, f]) => [name, f.topDamageSource])),
      matchupMatrix: matrix,
      suspectedBugs: bugs,
      abnormalReplaySeeds: abnormalSeeds.slice(0, 200),
      notes: BALANCE_NOTES
    },
    pass,
    tierList: buildTierList(fighterSummaries),
    rawResults: results
  };
}

export function renderMarkdownReport(summary) {
  const fighters = Object.entries(summary.groups.winrateByFighter).sort((a, b) => b[1].winrate - a[1].winrate);
  const lines = [];
  lines.push("# Apex Chaos Balance Report");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Matches: ${summary.sample.totalMatches}, unique pairs: ${summary.sample.uniquePairs}`);
  lines.push("");
  lines.push("## Pass Gates");
  for (const [key, value] of Object.entries(summary.pass)) lines.push(`- ${key}: ${value ? "PASS" : "CHECK"}`);
  lines.push("");
  lines.push("## Duration");
  const d = summary.groups.durationStats;
  lines.push(`Average ${d.average.toFixed(1)}s, median ${d.median.toFixed(1)}s, p10 ${d.p10.toFixed(1)}s, p90 ${d.p90.toFixed(1)}s.`);
  lines.push(`Bands: under60=${d.bands.under60}, in60to180=${d.bands.in60to180}, over180=${d.bands.over180}.`);
  lines.push("");
  lines.push("## Winrate By Fighter");
  lines.push("| Fighter | Winrate | W-L-T | Avg Dur | Top Source |");
  lines.push("|---|---:|---:|---:|---|");
  for (const [name, row] of fighters) {
    lines.push(`| ${name} | ${(row.winrate * 100).toFixed(1)}% | ${row.wins}-${row.losses}-${row.ties} | ${row.averageDuration.toFixed(1)}s | ${row.topDamageSource.label} (${row.topDamageSource.value.toFixed(1)}) |`);
  }
  lines.push("");
  lines.push("## Suspected Bugs");
  if (!summary.groups.suspectedBugs.length) lines.push("No NaN, stuck, no-damage loop, infinite projectile, runaway summon, or abnormal HP bugs were detected in this pass.");
  else for (const bug of summary.groups.suspectedBugs.slice(0, 80)) lines.push(`- ${bug.kind} ${bug.matchup || ""} seed=${bug.seed} time=${bug.time}`);
  lines.push("");
  lines.push("## Notes");
  for (const note of summary.groups.notes) lines.push(`- ${note}`);
  return `${lines.join("\n")}\n`;
}

export function renderHtmlReport(summary) {
  const rows = Object.entries(summary.groups.winrateByFighter)
    .sort((a, b) => b[1].winrate - a[1].winrate)
    .map(
      ([name, row]) =>
        `<tr><td>${name}</td><td>${(row.winrate * 100).toFixed(1)}%</td><td>${row.wins}-${row.losses}-${row.ties}</td><td>${row.averageDuration.toFixed(1)}s</td><td>${row.topDamageSource.label}</td><td>${row.overlongRate.toFixed(3)}</td></tr>`
    )
    .join("");
  const pass = Object.entries(summary.pass)
    .map(([k, v]) => `<span class="pill ${v ? "pass" : "check"}">${k}: ${v ? "PASS" : "CHECK"}</span>`)
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Apex Chaos Balance Report</title>
<style>
body{font-family:Inter,Segoe UI,Arial,sans-serif;background:#10100f;color:#eee;margin:0;padding:24px}
table{border-collapse:collapse;width:100%;background:#171615}td,th{border-bottom:1px solid #333;padding:8px;text-align:left}th{color:#ffe0a0}
.pill{display:inline-block;margin:4px;padding:6px 9px;border-radius:6px;background:#332}.pass{background:#163b26}.check{background:#56321f}
pre{white-space:pre-wrap;background:#171615;padding:12px;border:1px solid #333}
</style></head><body>
<h1>Apex Chaos Balance Report</h1>
<p>Generated ${summary.generatedAt}. Matches ${summary.sample.totalMatches}; unique pairs ${summary.sample.uniquePairs}.</p>
<div>${pass}</div>
<h2>Duration</h2>
<p>Average ${summary.groups.durationStats.average.toFixed(1)}s, median ${summary.groups.durationStats.median.toFixed(1)}s, p10 ${summary.groups.durationStats.p10.toFixed(1)}s, p90 ${summary.groups.durationStats.p90.toFixed(1)}s.</p>
<h2>Winrate</h2><table><thead><tr><th>Fighter</th><th>Winrate</th><th>W-L-T</th><th>Avg Duration</th><th>Top Source</th><th>Overlong Rate</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Suspected Bugs</h2><pre>${summary.groups.suspectedBugs.length ? JSON.stringify(summary.groups.suspectedBugs.slice(0, 120), null, 2) : "No suspected bugs detected."}</pre>
<h2>Abnormal Replay Seeds</h2><pre>${JSON.stringify(summary.groups.abnormalReplaySeeds.slice(0, 80), null, 2)}</pre>
</body></html>`;
}

function buildTierList(fighterSummaries) {
  return Object.entries(fighterSummaries)
    .sort((a, b) => b[1].winrate - a[1].winrate)
    .map(([name, row], index) => ({ rank: index + 1, name, winrate: row.winrate }));
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function pct(value) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(4));
}
