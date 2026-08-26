export const RECOMMENDATION_SCORE_HALF_LIFE_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * Age a local recommendation signal without mutating the persisted value.
 * Invalid legacy values are treated as neutral instead of poisoning ranking.
 */
export function decayRecommendationScore(
  score: number,
  updatedAt: number,
  now = Date.now(),
): number {
  if (!Number.isFinite(score) || !Number.isFinite(updatedAt)) return 0;
  if (score === 0) return 0;
  const elapsedMs = Math.max(0, now - updatedAt);
  return score * 0.5 ** (elapsedMs / RECOMMENDATION_SCORE_HALF_LIFE_MS);
}
