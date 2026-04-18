// DPMS Retention-Execution-Helpers (GDPR Art. 5(1)(e))
//
// Retention-Logic fuer Worker-Job der taeglich prueft welche Records
// zum Loeschen anstehen.

export interface RetentionScheduleRule {
  id: string;
  entityType: string;
  retentionPeriodDays: number;
  basis: "legal_obligation" | "contract" | "consent" | "legitimate_interest";
  legalReference: string | null;
  triggerEvent: "contract_end" | "consent_withdrawal" | "last_interaction" | "fixed_date";
  deletionStrategy: "hard_delete" | "anonymize" | "pseudonymize" | "archive";
}

export interface RetentionExecutionContext {
  schedule: RetentionScheduleRule;
  recordId: string;
  /** Zeitpunkt des Trigger-Events (z. B. contract_end-Datum) */
  triggerEventAt: Date;
  /** Now zum Vergleich */
  now?: Date;
  /** Aktive Litigation-Holds oder sonstige Ausnahmen */
  activeExceptions?: Array<{
    id: string;
    reason: string;
    validUntil: Date | null;
  }>;
}

export interface RetentionDecision {
  shouldDelete: boolean;
  reason: string;
  daysOverdue: number;
  blockedByException?: {
    id: string;
    reason: string;
  };
}

export function decideRetention(ctx: RetentionExecutionContext): RetentionDecision {
  const now = ctx.now ?? new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const dueAt = new Date(ctx.triggerEventAt.getTime() + ctx.schedule.retentionPeriodDays * DAY_MS);
  const daysOverdue = Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS);

  // Exception-Check
  const activeEx = (ctx.activeExceptions ?? []).find(
    (e) => !e.validUntil || e.validUntil.getTime() > now.getTime(),
  );
  if (activeEx) {
    return {
      shouldDelete: false,
      reason: `Blocked by exception: ${activeEx.reason}`,
      daysOverdue,
      blockedByException: { id: activeEx.id, reason: activeEx.reason },
    };
  }

  if (daysOverdue < 0) {
    return {
      shouldDelete: false,
      reason: `Retention-Periode noch nicht erreicht (${Math.abs(daysOverdue)} Tage verbleibend).`,
      daysOverdue,
    };
  }

  return {
    shouldDelete: true,
    reason: `Retention-Periode abgelaufen vor ${daysOverdue} Tagen. Strategy: ${ctx.schedule.deletionStrategy}.`,
    daysOverdue,
  };
}

// ─── Consent-Widget-Helpers (Art. 7) ───────────────────────────

export interface ConsentTypeMeta {
  name: string;
  requiredForService: boolean;
  granularity: "single" | "bundled" | "per_purpose";
  defaultDurationDays: number;
  canBeWithdrawnEasily: boolean;
}

export interface ConsentValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validiert Consent-Type gegen Art. 7 + EDPB-Guidelines.
 * Insbesondere Art. 7(4) Koppelungsverbot.
 */
export function validateConsentType(meta: ConsentTypeMeta): ConsentValidationResult {
  const issues: string[] = [];

  if (meta.requiredForService && meta.granularity === "bundled") {
    issues.push(
      "Art. 7(4) Koppelungsverbot: required_for_service + bundled schafft wahrscheinlich unrechtmaessige Koppelung. Bitte in Einzelconsents aufspalten.",
    );
  }

  if (!meta.canBeWithdrawnEasily) {
    issues.push(
      "Art. 7(3): Widerruf muss genauso einfach sein wie die Erteilung. canBeWithdrawnEasily=false ist ein Compliance-Risiko.",
    );
  }

  if (meta.defaultDurationDays > 730) {
    issues.push(
      "Consent-Duration > 2 Jahre ist ungewoehnlich lang. Re-Consent empfohlen.",
    );
  }

  return { valid: issues.length === 0, issues };
}

export function isConsentStillValid(
  consent: { grantedAt: Date; withdrawnAt: Date | null; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (consent.withdrawnAt && consent.withdrawnAt.getTime() <= now.getTime()) return false;
  if (consent.expiresAt && consent.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}
