// Sprint 55: Damage Index Computation
// Composite score from CIA ratings, exposure factor, and severity factor

/**
 * Compute damage index (0-100) from assessment parameters.
 *
 * Formula: MAX(C,I,A) * exposureFactor * severityFactor, scaled to 0-100
 * Raw range: 1*1*1=1 to 4*4*4=64, mapped to percentage.
 *
 * @param confidentiality 1-4 rating
 * @param integrity 1-4 rating
 * @param availability 1-4 rating
 * @param exposureFactor 1-4 (low=1, rather_low=2, medium=3, high=4)
 * @param severityFactor 1-4
 * @returns 0-100 damage index score
 */
export function computeDamageIndex(
  confidentiality: number,
  integrity: number,
  availability: number,
  exposureFactor: number,
  severityFactor: number,
): number {
  const maxCIA = Math.max(confidentiality, integrity, availability);
  const raw = maxCIA * exposureFactor * severityFactor;
  return Math.round((raw / 64) * 100);
}

/**
 * Get severity label for a damage index score.
 */
export function getDamageIndexSeverity(value: number): string {
  if (value >= 81) return "critical";
  if (value >= 61) return "high";
  if (value >= 41) return "medium";
  if (value >= 21) return "low";
  return "minimal";
}

/**
 * Get color for damage index badge.
 */
export function getDamageIndexColor(value: number): string {
  if (value >= 81) return "#ef4444"; // red
  if (value >= 61) return "#f97316"; // orange
  if (value >= 41) return "#eab308"; // yellow
  if (value >= 21) return "#84cc16"; // lime
  return "#22c55e"; // green
}
