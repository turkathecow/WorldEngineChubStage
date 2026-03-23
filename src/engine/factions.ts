export function adjustReputation(
  reputation: Record<string, number>,
  factionId: string,
  delta: number,
): Record<string, number> {
  const current = reputation[factionId] ?? 0;
  return {
    ...reputation,
    [factionId]: Math.max(-100, Math.min(100, current + delta)),
  };
}

export function describeReputation(score: number): string {
  if (score >= 60) {
    return "trusted";
  }
  if (score >= 20) {
    return "favored";
  }
  if (score > -20) {
    return "neutral";
  }
  if (score > -60) {
    return "strained";
  }
  return "hostile";
}
