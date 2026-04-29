// ISMS Nonconformity & Corrective Action State Machines
//
// Bezug: ISO/IEC 27001:2022 Klausel 10.1 — Nichtkonformität und Korrekturmaßnahmen
// CAP-Anforderungen aus REQ-ISMS-031, REQ-ISMS-032, REQ-ISMS-034 (siehe
// docs/isms-bcms/05-requirements-catalog.md).
//
// DB-Spalten:
//   isms_nonconformity.status: varchar(30)
//     erlaubte Werte (lt. Schema-Kommentar):
//     open | analysis | action_planned | in_progress | verification | closed | reopened
//   isms_corrective_action.status: varchar(30)
//     erlaubte Werte:
//     planned | in_progress | completed | verified | closed | failed
//
// Diese State-Machine ergänzt die textbasierten Spalten um typsichere
// Übergangs-Validierung. Die API-Layer (PUT /api/v1/isms/nonconformities/[id])
// nutzt `validateNcTransition()` und `assertCanCloseNc()` vor dem Update.

// ──────────────────────────────────────────────────────────────
// Nonconformity (NC) — Status & Transitions
// ──────────────────────────────────────────────────────────────

export const NC_STATUSES = [
  "open",
  "analysis",
  "action_planned",
  "in_progress",
  "verification",
  "closed",
  "reopened",
] as const;
export type NcStatus = (typeof NC_STATUSES)[number];

/**
 * ISO 27001 §10.1 Workflow-Sequenz:
 *
 *   open → analysis → action_planned → in_progress → verification → closed
 *                                                                   ↓
 *                                                                  reopened → analysis
 *
 * Rückwärts-Sprünge erlaubt zwischen analysis ↔ action_planned ↔ in_progress
 * (für iterative Korrektur). Closure bleibt einseitig.
 */
export const NC_ALLOWED_TRANSITIONS: Record<NcStatus, NcStatus[]> = {
  open: ["analysis"],
  analysis: ["action_planned", "open"],
  action_planned: ["in_progress", "analysis"],
  in_progress: ["verification", "action_planned"],
  verification: ["closed", "in_progress"],
  closed: ["reopened"],
  reopened: ["analysis"],
};

export interface NcTransitionInput {
  from: NcStatus;
  to: NcStatus;
}

export interface NcTransitionResult {
  ok: boolean;
  reason?: string;
}

export function isNcStatus(value: unknown): value is NcStatus {
  return (
    typeof value === "string" && (NC_STATUSES as readonly string[]).includes(value)
  );
}

export function validateNcTransition(
  input: NcTransitionInput,
): NcTransitionResult {
  const { from, to } = input;
  if (from === to) {
    return { ok: true };
  }
  const allowed = NC_ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, reason: `Unknown source status: ${from}` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition ${from} → ${to} not allowed. Allowed targets: ${allowed.join(", ") || "(none)"}.`,
    };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Corrective Action (CA) — Status & Transitions
// ──────────────────────────────────────────────────────────────

export const CA_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "verified",
  "closed",
  "failed",
] as const;
export type CaStatus = (typeof CA_STATUSES)[number];

/**
 * ISO 27001 §10.1 e/f — Verifikation + Wirksamkeitsprüfung Pflicht.
 *
 *   planned → in_progress → completed → verified → closed
 *                                          ↓
 *                                        failed → in_progress
 *
 * `failed` markiert eine fehlgeschlagene Wirksamkeitsprüfung (REQ-ISMS-032).
 * `closed` erfordert vorgängig `verified` UND verificationResult=effective
 * (in `assertCanCloseNc()` zusammen mit dem NC-Closure geprüft).
 */
export const CA_ALLOWED_TRANSITIONS: Record<CaStatus, CaStatus[]> = {
  planned: ["in_progress", "failed"],
  in_progress: ["completed", "failed", "planned"],
  completed: ["verified", "failed"],
  verified: ["closed", "failed"],
  closed: [],
  failed: ["in_progress"],
};

export function isCaStatus(value: unknown): value is CaStatus {
  return (
    typeof value === "string" && (CA_STATUSES as readonly string[]).includes(value)
  );
}

export function validateCaTransition(input: {
  from: CaStatus;
  to: CaStatus;
}): NcTransitionResult {
  const { from, to } = input;
  if (from === to) return { ok: true };
  const allowed = CA_ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, reason: `Unknown source status: ${from}` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transition ${from} → ${to} not allowed. Allowed targets: ${allowed.join(", ") || "(none)"}.`,
    };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Closure-Vorbedingungen — REQ-ISMS-032
// ──────────────────────────────────────────────────────────────

/**
 * ISO 27001 §10.1 g — Bewertung der Wirksamkeit ist Pflichtschritt
 * vor dem Schließen einer Nichtkonformität.
 *
 * Eine NC darf nur in den Status `closed` überführt werden, wenn
 * mindestens eine der zugehörigen Corrective Actions:
 *   1. verified wurde (`status='verified'` ODER `closed`), UND
 *   2. die Wirksamkeitsprüfung positiv ausgefallen ist
 *      (`verification_result='effective'`).
 *
 * `assertCanCloseNc` verarbeitet einen Snapshot der gemappten
 * CAs und liefert ein Result inkl. menschenlesbarem Grund.
 */
export interface CorrectiveActionSnapshot {
  status: CaStatus;
  verificationResult: string | null;
  verifiedAt: string | null | Date;
  effectivenessReviewDate: string | null | Date;
  effectivenessRating: string | null;
}

export interface CloseAssertion {
  ok: boolean;
  reason?: string;
}

export function assertCanCloseNc(
  actions: CorrectiveActionSnapshot[],
): CloseAssertion {
  if (actions.length === 0) {
    return {
      ok: false,
      reason:
        "Cannot close NC: at least one corrective action is required (ISO 27001 §10.1 d).",
    };
  }
  const verifiedEffective = actions.find(
    (a) =>
      (a.status === "verified" || a.status === "closed") &&
      a.verificationResult === "effective",
  );
  if (!verifiedEffective) {
    return {
      ok: false,
      reason:
        "Cannot close NC: at least one corrective action must be verified with verification_result='effective' (ISO 27001 §10.1 g).",
    };
  }
  // Wirksamkeits-Review ist als Folgeprüfung empfohlen — wir machen sie
  // zur Pflicht, wenn die NC severity=major ist (Eingangs-Parameter
  // wird optional über die overload-Variante übergeben).
  return { ok: true };
}

/**
 * Strenge Variante für Major-NCs — verlangt zusätzlich einen
 * Effectiveness-Review-Eintrag (Datum + Rating).
 */
export function assertCanCloseMajorNc(
  actions: CorrectiveActionSnapshot[],
): CloseAssertion {
  const base = assertCanCloseNc(actions);
  if (!base.ok) return base;
  const withEffectiveness = actions.find(
    (a) =>
      a.effectivenessReviewDate &&
      a.effectivenessRating &&
      ["effective", "fully_effective"].includes(a.effectivenessRating),
  );
  if (!withEffectiveness) {
    return {
      ok: false,
      reason:
        "Cannot close major NC: effectiveness review with positive rating required (ISO 27001 §10.1 g, applied for major NCs).",
    };
  }
  return { ok: true };
}
