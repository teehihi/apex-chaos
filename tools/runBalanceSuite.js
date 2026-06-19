#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runFullMatrix, runSmokeSuite } from "../src/systems/simulator.js";
import { renderHtmlReport, renderMarkdownReport, summarizeResults } from "../src/systems/analytics.js";

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback) => {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (!hit) return fallback;
  return hit.slice(prefix.length);
};
const matches = Number(getArg("--matches", args.has("--smoke") ? 6 : 20));
const baseSeed = getArg("--seed", args.has("--smoke") ? "smoke" : "balance");
const started = Date.now();
const results = args.has("--smoke")
  ? runSmokeSuite(matches, baseSeed)
  : runFullMatrix({ matchesPerOrientation: matches, baseSeed });
const summary = summarizeResults(results);
summary.runtimeMs = Date.now() - started;
summary.command = process.argv.slice(2);

await mkdir(resolve("reports"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const prefix = args.has("--smoke") ? `smoke-${stamp}` : `balance-${stamp}`;
await writeFile(resolve("reports", `${prefix}.json`), JSON.stringify(summary, null, 2));
await writeFile(resolve("reports", `${prefix}.md`), renderMarkdownReport(summary));
await writeFile(resolve("reports", `${prefix}.html`), renderHtmlReport(summary));
await writeFile(resolve("reports", "latest.json"), JSON.stringify(summary, null, 2));
await writeFile(resolve("reports", "latest.md"), renderMarkdownReport(summary));
await writeFile(resolve("reports", "latest.html"), renderHtmlReport(summary));

const winrates = Object.values(summary.groups.winrateByFighter).map((x) => x.winrate);
console.log(JSON.stringify({
  matches: summary.sample.totalMatches,
  runtimeMs: summary.runtimeMs,
  winrateMin: Math.min(...winrates),
  winrateMax: Math.max(...winrates),
  avgDuration: summary.groups.durationStats.average,
  medianDuration: summary.groups.durationStats.median,
  over180: summary.groups.durationStats.bands.over180,
  bugs: summary.groups.suspectedBugs.length,
  pass: summary.pass,
  latest: {
    json: "reports/latest.json",
    md: "reports/latest.md",
    html: "reports/latest.html"
  }
}, null, 2));
