import { randomBytes } from "crypto";

/** Generate a URL-safe access token for DD sessions (64 chars). */
export function generateDdToken(): string {
  return randomBytes(48).toString("base64url");
}

interface ScoredResponse {
  score?: number | null;
}

interface ScoredQuestion {
  maxScore?: number | null;
}

/** Compute total score, max possible, and percentage from responses and questions. */
export function computeScore(
  responses: ScoredResponse[],
  questions: ScoredQuestion[],
): { total: number; max: number; percent: number } {
  const total = responses.reduce((sum, r) => sum + (r.score ?? 0), 0);
  const max = questions.reduce((sum, q) => sum + (q.maxScore ?? 0), 0);
  const percent = max > 0 ? Math.round((total / max) * 100) : 0;
  return { total, max, percent };
}
