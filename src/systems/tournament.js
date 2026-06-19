import { rosterNames } from "../data/fighterTypes.js";

export function createTournament(rng) {
  const shuffled = [...rosterNames];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let round = shuffled.map((name) => ({ name }));
  const rounds = [pairRound(round, 0)];
  return { entrants: shuffled, rounds, currentRound: 0, champion: null, history: [] };
}

export function readyTournamentMatch(tournament) {
  const round = tournament.rounds[tournament.currentRound] || [];
  return round.find((match) => !match.winner && match.a && match.b) || null;
}

export function applyTournamentResult(tournament, matchId, winner, loser, result) {
  const round = tournament.rounds[tournament.currentRound] || [];
  const match = round.find((m) => m.id === matchId);
  if (!match) return;
  match.winner = winner;
  match.loser = loser;
  match.result = result;
  tournament.history.push({ matchId, winner, loser, seed: result?.seed, duration: result?.duration });
  if (round.every((m) => m.winner)) {
    const winners = round.map((m) => ({ name: m.winner }));
    if (winners.length === 1) {
      tournament.champion = winners[0].name;
      return;
    }
    tournament.currentRound += 1;
    tournament.rounds[tournament.currentRound] = pairRound(winners, tournament.currentRound);
  }
}

function pairRound(entries, roundIndex) {
  const out = [];
  for (let i = 0; i < entries.length; i += 2) {
    out.push({
      id: `R${roundIndex + 1}-M${i / 2 + 1}`,
      a: entries[i]?.name,
      b: entries[i + 1]?.name,
      winner: null,
      loser: null,
      result: null
    });
  }
  return out;
}
