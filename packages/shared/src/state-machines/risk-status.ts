// Risk Status State Machine (ISO 31000 §6.4–6.5 lifecycle)
//
// Five documented states and the legal transitions between them. The
// matrix mirrors what the existing PUT /api/v1/risks/[id]/status route
// has been enforcing in-line; lifting it here gives a single source of
// truth that tests and other callers can rely on without reaching into
// the route handler.
//
//   identified ──→ assessed ──→ treated ──→ accepted ──→ closed
//        ↑   ↘        ↕            ↕          ↕            │
//        └────┴────────┴────────────┴──────────┴────────────┘
//                    (reopen / re-assess)
//
// Reverse jumps to `identified` are allowed because that's the project's
// canonical "reopen" target — it forces the user back through assessment
// instead of letting them jump straight from closed to treated. Auditors
// can therefore reconstruct every status change by following the
// audit-log chain forward without needing to know about hidden states.
//
// API: the canonical entry point is PUT /api/v1/risks/[id]/status. The
// generic PUT /api/v1/risks/[id] does NOT accept status changes — callers
// who try to set status on the generic update endpoint get a 422 instead
// of a silent strip (QA-012, 2026-05-11).

export const RISK_STATUSES = [
  "identified",
  "assessed",
  "treated",
  "accepted",
  "closed",
] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RISK_ALLOWED_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  identified: ["assessed", "accepted"],
  assessed: ["treated", "accepted", "identified"],
  treated: ["accepted", "closed", "assessed"],
  accepted: ["closed", "identified"],
  closed: ["identified"],
};

export interface RiskStatusTransitionInput {
  from: RiskStatus;
  to: RiskStatus;
}

export interface RiskStatusTransitionResult {
  ok: boolean;
  reason?: string;
}

export function isRiskStatus(value: unknown): value is RiskStatus {
  return (
    typeof value === "string" &&
    (RISK_STATUSES as readonly string[]).includes(value)
  );
}

export function validateRiskStatusTransition(
  input: RiskStatusTransitionInput,
): RiskStatusTransitionResult {
  const { from, to } = input;
  if (from === to) {
    return { ok: true };
  }
  const allowed = RISK_ALLOWED_TRANSITIONS[from];
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
