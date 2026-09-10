// GET  /api/v1/programmes/journeys
// POST /api/v1/programmes/journeys
//
// Liste aller Journeys einer Org und Erstellung neuer Journeys aus Template.

import { db, programmeJourney, programmeTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createJourneySchema } from "@grc/shared";
import { instantiateJourney } from "@/lib/programme/instantiate";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const msType = url.searchParams.get("msType");

  const conditions = [
    eq(programmeJourney.orgId, ctx.orgId),
    isNull(programmeJourney.deletedAt),
  ];
  if (status) {
    conditions.push(eq(programmeJourney.status, status as never));
  }
  if (msType) {
    conditions.push(eq(programmeJourney.msType, msType as never));
  }

  const rows = await db
    .select()
    .from(programmeJourney)
    .where(and(...conditions))
    .orderBy(desc(programmeJourney.updatedAt));

  return Response.json({ data: rows });
});
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createJourneySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Template auflösen
  const where = parsed.data.templateVersion
    ? and(
        eq(programmeTemplate.code, parsed.data.templateCode),
        eq(programmeTemplate.version, parsed.data.templateVersion),
      )
    : eq(programmeTemplate.code, parsed.data.templateCode);
  const [tpl] = await db.select().from(programmeTemplate).where(where).limit(1);
  if (!tpl) {
    return Response.json(
      { error: `Template not found: ${parsed.data.templateCode}` },
      { status: 404 },
    );
  }
  if (!tpl.isActive || tpl.deprecatedAt) {
    return Response.json(
      { error: `Template ${tpl.code}@${tpl.version} is not active` },
      { status: 422 },
    );
  }

  try {
    const result = await withAuditContext(ctx, async () =>
      instantiateJourney(db, {
        orgId: ctx.orgId,
        templateId: tpl.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        ownerId: parsed.data.ownerId ?? ctx.userId,
        sponsorId: parsed.data.sponsorId ?? null,
        startedAt: parsed.data.startedAt ?? null,
        targetCompletionDate: parsed.data.targetCompletionDate ?? null,
        metadata: parsed.data.metadata ?? {},
        createdBy: ctx.userId,
      }),
    );

    return Response.json(
      {
        data: {
          journey: result.journey,
          phaseCount: result.phaseCount,
          stepCount: result.stepCount,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("duplicate")) {
      return Response.json(
        {
          error: "A journey with this name already exists in your organization",
        },
        { status: 409 },
      );
    }
    // [E2E-TRIAGE-2026-09-02] `reason: message` put the driver's error text in
    // the RESPONSE BODY. Measured against the running application, a failing
    // insert returned the complete INSERT statement — every column of
    // `programme_journey`, the parameter placeholders and the bound VALUES,
    // which include `org_id`, `owner_id` and `created_by`, i.e. live user and
    // tenant UUIDs — to any caller able to provoke a 500. That is schema and
    // identifier disclosure, the same class of finding as the SQL text the
    // audit removed elsewhere. The detail belongs in the server log, where the
    // line above already puts it, not in the payload.
    log.error("[programmes/journeys/POST] failed", { err });
    return Response.json(
      {
        error: "Failed to create journey",
        detail:
          "The journey could not be created. The cause was logged server-side.",
      },
      { status: 500 },
    );
  }
});
