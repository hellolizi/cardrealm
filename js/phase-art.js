const revealed = new Set();

function phaseArtKey(battle) {
  const enemy = battle?.enemy;
  return `${battle?.mode || 'battle'}:${battle?.startedAt || 0}:${enemy?.defId || enemy?.name || 'none'}`;
}

export function isPhaseArtRevealed(battle) {
  return revealed.has(phaseArtKey(battle));
}

export function markPhaseArtRevealed(battle) {
  revealed.add(phaseArtKey(battle));
}
