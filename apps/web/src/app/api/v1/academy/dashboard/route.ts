import {
  db,
  academyCourse,
  academyEnrollment,
  academyCertificate,
} from "@grc/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { academyDashboardQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

/**
 * Anfang des Zeitfensters zu `timeRange`. Die drei Werte des Schemas sind
 * Kalenderspannen; gerechnet wird relativ zum Aufrufzeitpunkt.
 */
const TIME_RANGE_START: Record<"month" | "quarter" | "year", () => Date> = {
  month: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  quarter: () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  year: () => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
};

// GET /api/v1/academy/dashboard
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-176] Das Ergebnis der Pruefung
  // wurde nicht gebunden: `timeRange` wurde geprueft und weggeworfen. Wer
  // „Monat" waehlte, sah dieselben Zahlen wie bei „Jahr" — und weil das
  // Schema `quarter` als Vorgabe fuehrt, war auch die unbeschickte Antwort
  // nicht das, was der Vertrag zusagt.
  const { timeRange } = academyDashboardQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const since = TIME_RANGE_START[timeRange]();

  // Das Fenster gilt den EREIGNISSEN, nicht dem Bestand: `totalCourses`,
  // `mandatoryCourses` und `activeCourses` beschreiben den Kurskatalog, und
  // „Kurse gesamt" heisst nicht „Kurse, die in diesem Quartal angelegt
  // wurden". Gefenstert sind die Einschreibungen (ueber `created_at`, also
  // die im Zeitraum begonnene Kohorte) und die in diesem Zeitraum
  // ausgestellten Zertifikate. `completionRate` ergibt sich damit aus
  // derselben Kohorte.

  const [courseStats] = await db
    .select({
      totalCourses: sql<number>`count(*)::int`,
      mandatoryCourses: sql<number>`count(*) filter (where is_mandatory)::int`,
      activeCourses: sql<number>`count(*) filter (where is_active)::int`,
    })
    .from(academyCourse)
    .where(eq(academyCourse.orgId, ctx.orgId));

  const [enrollmentStats] = await db
    .select({
      totalEnrollments: sql<number>`count(*)::int`,
      completedEnrollments: sql<number>`count(*) filter (where status = 'completed')::int`,
      overdueEnrollments: sql<number>`count(*) filter (where status = 'overdue')::int`,
      inProgressEnrollments: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      avgProgressPct: sql<number>`round(avg(progress_pct))::int`,
    })
    .from(academyEnrollment)
    .where(
      and(
        eq(academyEnrollment.orgId, ctx.orgId),
        gte(academyEnrollment.createdAt, since),
      ),
    );

  const [certStats] = await db
    .select({
      totalCertificates: sql<number>`count(*)::int`,
    })
    .from(academyCertificate)
    .where(
      and(
        eq(academyCertificate.orgId, ctx.orgId),
        gte(academyCertificate.issuedAt, since),
      ),
    );

  const completionRate =
    enrollmentStats.totalEnrollments > 0
      ? Math.round(
          (enrollmentStats.completedEnrollments /
            enrollmentStats.totalEnrollments) *
            100,
        )
      : 0;

  return Response.json({
    data: {
      ...courseStats,
      ...enrollmentStats,
      ...certStats,
      completionRate,
      // Das angewandte Fenster steht in der Antwort: sonst laesst sich von
      // aussen nicht unterscheiden, ob ein Filter gewirkt hat.
      timeRange,
      since: since.toISOString(),
    },
  });
});
