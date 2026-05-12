// #NIGHT-032: GET /api/v1/bcms/exercises/upcoming crashed because the
// path was caught by the dynamic [id] handler with id="upcoming",
// which then ran a uuid lookup against the literal string.
//
// Implements the upcoming-exercises filter properly so the UI's
// "next 30 days" widget has a working endpoint.

import { db, bcExercise } from "@grc/db";
import { eq, and, gte, lte, asc, isNotNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const days = Math.max(
    1,
    Math.min(365, Number(url.searchParams.get("days")) || 30),
  );
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit")) || 20),
  );

  // bc_exercise.planned_date is a date column in string mode; pass YYYY-MM-DD.
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const nowStr = now.toISOString().slice(0, 10);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: bcExercise.id,
      title: bcExercise.title,
      exerciseType: bcExercise.exerciseType,
      plannedDate: bcExercise.plannedDate,
      status: bcExercise.status,
    })
    .from(bcExercise)
    .where(
      and(
        eq(bcExercise.orgId, ctx.orgId),
        isNotNull(bcExercise.plannedDate),
        gte(bcExercise.plannedDate, nowStr),
        lte(bcExercise.plannedDate, horizonStr),
      ),
    )
    .orderBy(asc(bcExercise.plannedDate))
    .limit(limit);

  return Response.json({
    data: rows,
    meta: { days, horizon: horizonStr },
  });
});
