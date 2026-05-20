// POST /api/v1/_debug/finding-insert-trace — Wave-24-A1 diagnostic endpoint
//
// #WAVE24-A1: Fifth wave on the same finding-FK-persistence symptom.
// Repository code looks correct (route handler, Zod schema, Drizzle
// table), Wave-23 added a post-insert FK-mismatch verifier that
// throws if the returning row doesn't match the input, and yet
// production still reports controlId/auditId/riskId persisting as
// null. The disconnect is either in the deploy (old build) or in
// a layer we haven't observed live yet (Drizzle inference, DB
// trigger, RLS).
//
// This endpoint isolates the "where does the FK go missing" question
// by exercising three paths against the same payload and returning
// the result of each:
//
//   raw-body      — the JSON body as parsed, for sanity
//   direct-sql    — raw INSERT via db.execute(sql`…`) using the
//                   request's FK literals, bypassing Drizzle entirely
//   drizzle       — db.insert(finding).values({…}).returning(), the
//                   exact path the production POST handler uses
//
// Cowork QA can run this against a prod-mirror with valid IDs to
// pinpoint which layer is dropping the FK. The trace is purposely
// verbose so the resulting PR comment is unambiguous.
//
// Deployment guard: this endpoint is mounted but only executes when
// ARCTOS_DEBUG_TRACE_ENABLED === "1" OR the caller's request has a
// matching x-arctos-debug-token header (env: ARCTOS_DEBUG_TOKEN).
// Production deploys leave both unset by default, so accidental
// invocation from a misconfigured client yields 404 (mimicking a
// route that doesn't exist) instead of running the unsafe insert.
//
// **Removal:** once A1 is root-caused and fixed, this entire folder
// is deleted via a follow-up migration commit. The endpoint is not
// a long-term API surface.

import { db, finding } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

function debugEnabled(req: Request): boolean {
  if (process.env.ARCTOS_DEBUG_TRACE_ENABLED === "1") return true;
  const provided = req.headers.get("x-arctos-debug-token");
  const expected = process.env.ARCTOS_DEBUG_TOKEN;
  return Boolean(expected && provided && provided === expected);
}

type Trace = {
  stage: string;
  value?: unknown;
  result?: unknown;
  error?: string;
};

export async function POST(req: Request) {
  // Hide behind a 404 when not enabled — matches the "no such route"
  // shape callers see for any unmounted path.
  if (!debugEnabled(req)) {
    return new Response("Not Found", { status: 404 });
  }

  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  let raw: Record<string, unknown> = {};
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Body must be valid JSON" }, { status: 422 });
  }

  const traces: Trace[] = [];
  traces.push({ stage: "raw-body", value: raw });

  // Path 1 — direct SQL. Bypasses Drizzle's column-name conversion,
  // proves whether the DB itself accepts the FK literals.
  try {
    const directResult = await db.execute<{
      id: string;
      control_id: string | null;
      audit_id: string | null;
      risk_id: string | null;
      control_test_id: string | null;
    }>(sql`
      INSERT INTO finding (
        org_id, work_item_id, title, severity, source,
        control_id, audit_id, risk_id, control_test_id,
        created_by, updated_by
      )
      VALUES (
        ${ctx.orgId},
        gen_random_uuid(),
        ${typeof raw.title === "string" ? raw.title : "debug-direct-insert"},
        ${typeof raw.severity === "string" ? raw.severity : "minor_nonconformity"}::finding_severity,
        ${typeof raw.source === "string" ? raw.source : "audit"}::finding_source,
        ${raw.controlId ?? null}::uuid,
        ${raw.auditId ?? null}::uuid,
        ${raw.riskId ?? null}::uuid,
        ${raw.controlTestId ?? null}::uuid,
        ${ctx.userId},
        ${ctx.userId}
      )
      RETURNING id, control_id, audit_id, risk_id, control_test_id;
    `);
    const rows = Array.isArray(directResult) ? directResult : [];
    traces.push({ stage: "direct-sql-insert", result: rows[0] ?? null });
  } catch (e) {
    traces.push({
      stage: "direct-sql-insert",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Path 2 — Drizzle ORM. Same code path the production POST handler
  // uses; if this returns null FKs while direct-SQL persisted, the
  // bug is in the ORM layer.
  try {
    const drizzleResult = await db
      .insert(finding)
      .values({
        orgId: ctx.orgId,
        workItemId: crypto.randomUUID(),
        title: typeof raw.title === "string" ? raw.title : "drizzle-test",
        severity: (typeof raw.severity === "string"
          ? raw.severity
          : "minor_nonconformity") as
          | "minor_nonconformity"
          | "major_nonconformity",
        source: (typeof raw.source === "string" ? raw.source : "audit") as
          | "audit"
          | "control_test"
          | "incident"
          | "self_assessment"
          | "external",
        controlId:
          typeof raw.controlId === "string" ? raw.controlId : undefined,
        controlTestId:
          typeof raw.controlTestId === "string" ? raw.controlTestId : undefined,
        riskId: typeof raw.riskId === "string" ? raw.riskId : undefined,
        auditId: typeof raw.auditId === "string" ? raw.auditId : undefined,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    traces.push({
      stage: "drizzle-insert",
      result: drizzleResult[0] ?? null,
    });
  } catch (e) {
    traces.push({
      stage: "drizzle-insert",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return Response.json({
    enabled: true,
    note: "DEBUG endpoint — see ADR-026 + wave-24 prompt A1. Removed once A1 is closed.",
    orgId: ctx.orgId,
    userId: ctx.userId,
    traces,
  });
}
