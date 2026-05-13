// Risk Status State Machine (ISO 31000 §6.4–6.5 lifecycle)
//
// Six documented states and the legal transitions between them. The
// matrix mirrors what the existing PUT /api/v1/risks/[id]/status route
// has been enforcing in-line; lifting it here gives a single source of
// truth that tests and other callers can rely on without reaching into
// the route handler.
//
//   identified ──→ assessed ──→ treated ──→ accepted ──→ closed
//        ↑   ↘        ↕            ↕          ↕            │
//        └────┴────────┴────────────┴──────────┘            │
//                    (reopen / re-assess)                   │
//                                                           ▼
//                                  reopened ──→ identified / assessed
//
// `reopened` is the explicit reopen state for closed risks — the only
// path out of `closed` (#WAVE14-STATE-02). Previously closed → identified
// was the implicit reopen edge, but the audit-log row read just like any
// other regression and auditors had to infer the intent. Forcing the
// closed transition through `reopened` makes the move auditable in one
// hop and lets the API enforce a mandatory `reason`.
//
// In-flight reopens (accepted → identified, treated → identified, etc.)
// remain allowed without ceremony — those are normal lifecycle backtracks
// inside an open risk, not the closed-and-revived case.
//
// API: the canonical entry point is PUT /api/v1/risks/[id]/status. The
// generic PUT /api/v1/risks/[id] does NOT accept status changes — callers
// who try to set status on the generic update endpoint get a 422 instead
// of a silent strip (QA-012, 2026-05-11). Closed → reopened transitions
// require a non-empty `reason` (HTTP 422 if missing).

export const RISK_STATUSES = [
  "identified",
  "assessed",
  "treated",
  "accepted",
  "closed",
  "reopened",
] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RISK_ALLOWED_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  identified: ["assessed", "accepted"],
  assessed: ["treated", "accepted", "identified"],
  // 'treated' must allow reopening to 'identified' too — the test
  // contract is that every later state can be reopened to walk through
  // the full assessment cycle again. Without this, a control owner who
  // realises a treatment plan was based on the wrong threat profile is
  // stuck (can't downgrade a treated risk back to identified for
  // re-scoping).
  treated: ["accepted", "closed", "assessed", "identified"],
  accepted: ["closed", "identified"],
  // closed must go through `reopened` — see the file header. The handler
  // additionally enforces a non-empty reason on this edge.
  closed: ["reopened"],
  // From reopened, callers pick where to land in the lifecycle. Both
  // identified (full re-triage) and assessed (skip re-triage if scores
  // still apply) are legitimate landings.
  reopened: ["identified", "assessed"],
};

// Edges that require a non-empty `reason` in the request body. Used by
// the status PUT handler to enforce reason capture before the audit row
// is written.
export const RISK_TRANSITIONS_REQUIRING_REASON: Array<
  [RiskStatus, RiskStatus]
> = [["closed", "reopened"]];

export function transitionRequiresReason(
  from: RiskStatus,
  to: RiskStatus,
): boolean {
  return RISK_TRANSITIONS_REQUIRING_REASON.some(
    ([f, t]) => f === from && t === to,
  );
}

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
