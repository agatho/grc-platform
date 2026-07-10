// Cron Job: Risk-Acceptance Auto-Expire (ISO 27005 Clause 10)
//
// Time-bound acceptances (risk_acceptance.valid_until) whose validity has
// lapsed transition automatically active → expired (state machine:
// @grc/shared state-machines/risk-acceptance). The underlying risk drops
// back from `accepted` to `identified` so it re-enters the assessment
// lane — an expired acceptance means the residual risk is no longer
// formally covered. The acceptor is notified so they can re-accept or
// treat.
//
// RLS note: risk_acceptance carries FORCE ROW LEVEL SECURITY (0345/0360),
// so unlike document-auto-expire we cannot scan cross-org in one query.
// Pattern follows calendar-overdue-check: iterate orgs, set
// app.current_org_id per org (transaction-local), work inside that scope.

import { db, risk, riskAcceptance, notification } from "@grc/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface RiskAcceptanceExpiryResult {
  orgsScanned: number;
  scanned: number;
  expired: number;
  risksReopened: number;
  notified: number;
}

export const processRiskAcceptanceExpiry = withCronInstrumentation(
  "risk-acceptance-expiry",
  async (): Promise<RiskAcceptanceExpiryResult> => {
    const now = new Date();
    let scanned = 0;
    let expired = 0;
    let risksReopened = 0;
    let notified = 0;

    const orgs = await db.execute(
      sql`SELECT id FROM organization WHERE deleted_at IS NULL`,
    );

    for (const org of (orgs ?? []) as Array<Record<string, unknown>>) {
      const orgId = String(org.id);

      try {
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
          );

          const candidates = await tx
            .select({
              id: riskAcceptance.id,
              riskId: riskAcceptance.riskId,
              acceptedBy: riskAcceptance.acceptedBy,
              validUntil: riskAcceptance.validUntil,
              riskTitle: risk.title,
              riskStatus: risk.status,
            })
            .from(riskAcceptance)
            .leftJoin(risk, eq(risk.id, riskAcceptance.riskId))
            .where(
              and(
                eq(riskAcceptance.orgId, orgId),
                eq(riskAcceptance.status, "active"),
                isNotNull(riskAcceptance.validUntil),
                sql`${riskAcceptance.validUntil} < NOW()::date`,
              ),
            );

          scanned += candidates.length;

          for (const row of candidates) {
            // active → expired (guarded: status recheck in WHERE keeps a
            // concurrent revoke from being overwritten).
            const updatedRows = await tx
              .update(riskAcceptance)
              .set({ status: "expired", updatedAt: now })
              .where(
                and(
                  eq(riskAcceptance.id, row.id),
                  eq(riskAcceptance.status, "active"),
                ),
              )
              .returning({ id: riskAcceptance.id });
            if (!updatedRows.length) continue;
            expired++;

            // The risk is no longer formally accepted — back into the
            // assessment lane (mirrors the manual revoke flow).
            if (row.riskStatus === "accepted") {
              await tx
                .update(risk)
                .set({ status: "identified", updatedAt: now })
                .where(and(eq(risk.id, row.riskId), eq(risk.status, "accepted")));
              risksReopened++;
            }

            const validStr = row.validUntil
              ? String(row.validUntil).split("T")[0]
              : "";
            await tx.insert(notification).values({
              userId: row.acceptedBy,
              orgId,
              type: "deadline_approaching" as const,
              entityType: "risk",
              entityId: row.riskId,
              title: `Risk acceptance expired: ${row.riskTitle ?? row.riskId}`,
              message: `The formal acceptance of risk "${row.riskTitle ?? row.riskId}" reached its validity limit (${validStr}) and was automatically set to 'expired'. The risk returned to the assessment lane — re-accept or treat it.`,
              channel: "both" as const,
              templateKey: "risk_acceptance_expired",
              templateData: {
                riskId: row.riskId,
                acceptanceId: row.id,
                validUntil: validStr,
              },
              createdAt: now,
              updatedAt: now,
            });
            notified++;
          }
        });
      } catch {
        // Wrapper logs structured error; continue with the next org.
      }
    }

    return {
      orgsScanned: (orgs ?? []).length,
      scanned,
      expired,
      risksReopened,
      notified,
    };
  },
);
