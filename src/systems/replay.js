export function makeReplaySeed(resultOrGame) {
  if (!resultOrGame) return null;
  if (resultOrGame.replay) return resultOrGame.replay;
  return {
    seed: resultOrGame.seed,
    left: resultOrGame.fighters?.[0]?.name,
    right: resultOrGame.fighters?.[1]?.name
  };
}

export function replayLabel(replay) {
  if (!replay) return "No replay";
  return `${replay.left} vs ${replay.right} | seed ${replay.seed}`;
}
