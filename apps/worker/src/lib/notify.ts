// notify.ts — the single write path for notifications created by cron jobs.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-10, S10-03]
//
// Before: 44 cron files called `db.insert(notification).values({…})`
// directly. 40 of them had no dedup signal whatsoever, so a reminder whose
// condition stays true for 15 days produced 15 identical rows (and, once the
// e-mail path works again, 15 identical e-mails) — the audit's "alert
// fatigue" finding. Four files had a hand-rolled existence check; each one
// looked different.
//
// After: every cron notification goes through `insertNotification()`, which
//   (a) derives a stable `dedupe_key` and lets the partial UNIQUE index from
//       migration 0435 reject the duplicate in the database — the guard is
//       enforced once, centrally, instead of being correct 44 times;
//   (b) validates `templateKey` against the e-mail template registry, so a
//       key that no template can render never reaches the delivery job as a
//       silent dead letter (S10-03).
//
// Dedup window: escalations default to one calendar day, everything else to
// one calendar week — see `NotifyOptions.dedupeWindow` for why the two
// differ. Jobs with their own cadence pass `dedupeWindow` or an explicit
// `dedupeKey`; jobs that must always insert pass `dedupeWindow: "none"`.

import { db, notification } from "@grc/db";
import { createHash } from "crypto";
import { isEmailTemplateKey } from "@grc/email";
import { reportJobError } from "./job-runtime";

type NotificationInsert = typeof notification.$inferInsert;

export type DedupeWindow = "day" | "week" | "month" | "forever" | "none";

export interface NotifyOptions {
  /** Job name for error attribution. */
  job: string;
  /**
   * How long the same logical notification is suppressed.
   *
   * Default depends on the notification TYPE, because "how often should this
   * repeat" is a different question for a reminder than for an escalation:
   *
   *   * `escalation` → "day". A missed statutory deadline (GDPR Art. 33,
   *     HinSchG §17) should keep surfacing until it is handled; suppressing
   *     it for a week would be worse than the duplication it prevents.
   *   * everything else → "week". The audit's example was
   *     `risk-review-reminder`: a review date 14 days out sits inside the
   *     window for 15 consecutive days and produced 15 identical rows per
   *     risk — 4.500 for a 300-risk portfolio. A weekly cadence keeps the
   *     reminder useful without destroying the signal.
   *
   * Jobs with their own cadence (a two-stage escalation, a per-week digest)
   * pass `dedupeWindow` or `dedupeKey` explicitly.
   */
  dedupeWindow?: DedupeWindow;
  /**
   * Overrides the derived key entirely. Use when the natural identity is
   * something other than (type, entity, title) — e.g. a deadline stage.
   */
  dedupeKey?: string;
  /** Optional transaction to insert on (S10-13). */
  tx?: Pick<typeof db, "insert">;
}

function windowBucket(window: DedupeWindow, now: Date): string {
  const iso = now.toISOString();
  switch (window) {
    case "day":
      return iso.slice(0, 10);
    case "week": {
      // ISO week number — stable across a month boundary, unlike slice().
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
      );
      return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    }
    case "month":
      return iso.slice(0, 7);
    case "forever":
      return "*";
    case "none":
      return "";
  }
}

export function deriveDedupeKey(
  values: NotificationInsert,
  window: DedupeWindow,
  now: Date = new Date(),
): string | null {
  if (window === "none") return null;
  // [ARCTOS-FULL-2026-08-31 · OP-105] Hier stand `sha256(title)`. Der Titel ist
  // die gerenderte Fassung einer Meldung, nicht ihre Identität — und in 45 der
  // 55 Aufrufstellen enthält er genau das, was sich zwischen zwei Läufen
  // ändert: `DD reminder: … — ${daysUntilDeadline} days remaining`,
  // `ESG Report 2026: Completeness at ${pct}%`, `[${urgencyLevel}] ISMS NC …`.
  // Ein Titel, der herunterzählt, erzeugt jeden Tag einen neuen Schlüssel; der
  // Wochenfensterschutz aus S10-10 lief für diese Meldungen ins Leere — genau
  // die Alarmmüdigkeit, gegen die er gebaut wurde.
  //
  // `templateKey` benennt dieselbe Meldung stabil: er entscheidet, welcher
  // Renderer sie ausgibt, also welche ART Meldung es ist. Zwei verschieden
  // gemeinte Meldungen haben verschiedene templateKeys — gemessen über alle 55
  // Aufrufstellen ist die einzige Doppelung `isms_cap_overdue`, und die beiden
  // Stellen unterscheiden sich in `entityType`, der ohnehin im Schlüssel steht.
  //
  // Warum der Titel-Hash nicht ersatzlos verschwindet: 18 Aufrufstellen setzen
  // keinen templateKey. Dort bleibt der Titel die einzige verfügbare
  // Unterscheidung, und dort gilt weiter — lieber eine Zustellung zu viel als
  // eine unterdrückte Fristmeldung.
  const subject =
    values.templateKey ??
    createHash("sha256")
      .update(values.title ?? "")
      .digest("hex")
      .slice(0, 16);
  return [
    values.type,
    values.entityType ?? "-",
    values.entityId ?? "-",
    values.userId,
    subject,
    windowBucket(window, now),
  ].join("|");
}

/**
 * Insert a cron-generated notification, at most once per dedup window.
 *
 * Returns `true` when a row was written, `false` when the identical
 * notification already existed inside the window.
 */
export async function insertNotification(
  values: NotificationInsert,
  opts: NotifyOptions,
): Promise<boolean> {
  const window =
    opts.dedupeWindow ?? (values.type === "escalation" ? "day" : "week");
  const dedupeKey =
    opts.dedupeKey ?? deriveDedupeKey(values, window) ?? undefined;

  // S10-03: a templateKey with no renderer is a notification that will be
  // retried three times and then dropped for good. Keep the in-app
  // notification (the user still sees it), drop the mail channel, and make
  // the defect visible instead of letting it die in the delivery job.
  let payload = { ...values, dedupeKey };
  if (payload.templateKey && !isEmailTemplateKey(payload.templateKey)) {
    reportJobError(
      { job: opts.job, scope: `templateKey ${payload.templateKey}` },
      new Error(
        `unknown e-mail template key "${payload.templateKey}" — notification ` +
          `stored as in-app only`,
      ),
    );
    payload = {
      ...payload,
      templateKey: null,
      channel: payload.channel === "email" ? "in_app" : payload.channel,
    };
  }

  const target = opts.tx ?? db;

  // The arbiter is the plain UNIQUE index (org_id, dedupe_key) from
  // migration 0435. It is deliberately NOT partial: a partial index is only
  // inferred when the statement repeats its predicate, which would make the
  // dedup guarantee depend on an ORM detail. A NULL `dedupe_key` never
  // conflicts, so `dedupeWindow: "none"` inserts unconditionally.
  const inserted =
    (await target
      .insert(notification)
      .values(payload)
      .onConflictDoNothing({
        target: [notification.orgId, notification.dedupeKey],
      })
      .returning({ id: notification.id })) ?? [];

  return inserted.length > 0;
}

/** Batch variant; returns the number of rows actually written. */
export async function insertNotifications(
  rows: NotificationInsert[],
  opts: NotifyOptions,
): Promise<number> {
  let written = 0;
  for (const row of rows) {
    if (await insertNotification(row, opts)) written++;
  }
  return written;
}
