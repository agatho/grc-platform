// Risk-Acceptance State Machine + Governance-Regeln (ISO 27005 Clause 10)
//
// Eine Akzeptanz-Entscheidung ist ein append-only Governance-Artefakt:
//
//   active ──→ expired   (valid_until abgelaufen — Worker-Cron
//        │                `risk-acceptance-expiry`)
//        └──→ revoked    (manueller Widerruf mit Pflicht-Begruendung,
//                         PATCH /risks/:id/acceptance/:acceptanceId/revoke)
//
// `expired` und `revoked` sind terminal — eine erneute Akzeptanz erzeugt
// IMMER eine neue Row (POST /risks/:id/acceptance), damit der Audit-Trail
// jede einzelne Management-Entscheidung als eigenen Datensatz fuehrt.
//
// Zusaetzlich hier als Single Source of Truth (Route + Tests):
//   - Vier-Augen-Prinzip: der Risk-Owner darf sein eigenes Risiko nicht
//     formal akzeptieren (422 in der Route).
//   - Authority-Matrix-Aufloesung: welche Rolle darf welches Score-Band
//     akzeptieren (Tabelle risk_acceptance_authority).

export const RISK_ACCEPTANCE_STATUSES = [
  "active",
  "expired",
  "revoked",
] as const;
export type RiskAcceptanceStatus = (typeof RISK_ACCEPTANCE_STATUSES)[number];

export const RISK_ACCEPTANCE_ALLOWED_TRANSITIONS: Record<
  RiskAcceptanceStatus,
  RiskAcceptanceStatus[]
> = {
  active: ["expired", "revoked"],
  // Terminal — re-acceptance creates a new row instead of reviving this one.
  expired: [],
  revoked: [],
};

export function isRiskAcceptanceStatus(
  value: unknown,
): value is RiskAcceptanceStatus {
  return (
    typeof value === "string" &&
    (RISK_ACCEPTANCE_STATUSES as readonly string[]).includes(value)
  );
}

export interface RiskAcceptanceTransitionResult {
  ok: boolean;
  reason?: string;
}

export function validateRiskAcceptanceTransition(input: {
  from: RiskAcceptanceStatus;
  to: RiskAcceptanceStatus;
}): RiskAcceptanceTransitionResult {
  const { from, to } = input;
  if (from === to) {
    return { ok: true };
  }
  const allowed = RISK_ACCEPTANCE_ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, reason: `Unknown source status: ${from}` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition ${from} → ${to} not allowed. Allowed targets: ${allowed.join(", ") || "(none — terminal state)"}.`,
    };
  }
  return { ok: true };
}

// ─── Vier-Augen-Prinzip ──────────────────────────────────────────────
//
// Der Owner eines Risikos (1st Line) darf die formale Akzeptanz nicht
// selbst aussprechen — Akzeptanz ist eine unabhaengige 2nd-Line-/
// Management-Entscheidung. Route antwortet mit 422.

export function validateAcceptanceFourEyes(input: {
  riskOwnerId: string | null | undefined;
  acceptedBy: string;
}): RiskAcceptanceTransitionResult {
  if (input.riskOwnerId && input.riskOwnerId === input.acceptedBy) {
    return {
      ok: false,
      reason:
        "Four-eyes principle: the risk owner cannot formally accept their own risk. An independent role per the acceptance-authority matrix must decide.",
    };
  }
  return { ok: true };
}

// ─── Authority-Matrix-Aufloesung ─────────────────────────────────────
//
// Regel: erste aktive Band-Row (ASC nach maxScore) mit
// minScore <= score <= maxScore bestimmt die erforderliche Rolle.
// Faellt der Score in kein Band (z. B. katastrophal ueber dem hoechsten
// Band), gilt der admin-Fallback. `admin` darf immer akzeptieren
// (universeller Escape-Hatch, von der Route zusaetzlich erzwungen).

export interface AcceptanceAuthorityBand {
  minScore: number;
  maxScore: number;
  requiredRole: string;
  isActive: boolean;
}

export interface ResolvedAcceptanceAuthority {
  requiredRole: string;
  /** Matched band, or null when the admin fallback applied. */
  band: AcceptanceAuthorityBand | null;
}

export function resolveAcceptanceAuthority(
  bands: AcceptanceAuthorityBand[],
  score: number,
): ResolvedAcceptanceAuthority {
  const covering = bands
    .filter((b) => b.isActive)
    .sort((a, b) => a.maxScore - b.maxScore)
    .find((b) => b.minScore <= score && b.maxScore >= score);
  if (!covering) {
    return { requiredRole: "admin", band: null };
  }
  return { requiredRole: covering.requiredRole, band: covering };
}

/** May a user holding `roles` accept a risk that requires `requiredRole`? */
export function canAcceptWithRoles(
  roles: readonly string[],
  requiredRole: string,
): boolean {
  return roles.includes(requiredRole) || roles.includes("admin");
}

// Score → Level-Snapshot (identische Bänder wie die Risk-Heatmap).
export function riskLevelFromScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "unknown";
  if (score <= 3) return "low";
  if (score <= 9) return "medium";
  if (score <= 15) return "high";
  return "critical";
}
