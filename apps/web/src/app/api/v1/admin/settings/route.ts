// GET/PUT /api/v1/admin/settings
//
// #WAVE17-P2-04: Wave-14 QA flagged this as 404. The /settings UI
// links to "Plattform & Organisation" general settings — backed by
// the org's `settings` JSONB column, which has been there since
// Sprint 1.2 but had no admin-facing API surface.
//
// Read access is open to any authenticated org member (settings
// drive UI behaviour like default language, date formats, etc.);
// write access is admin-only. PUT does a *merge* over the existing
// JSONB blob so callers can update single keys without round-
// tripping the whole object — same UX every settings UI in the
// world has.

import { db, organization } from "@grc/db";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

const updateSettingsSchema = z.object({
  // Settings is an open JSONB blob — accept any record shape but
  // refuse arrays/scalars at the top level so the merge stays sane.
  settings: z.record(z.string(), z.unknown()),
});

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [row] = await db
    .select({
      orgId: organization.id,
      shortName: organization.shortName,
      orgCode: organization.orgCode,
      settings: organization.settings,
    })
    .from(organization)
    .where(and(eq(organization.id, ctx.orgId), isNull(organization.deletedAt)));

  if (!row) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      orgId: row.orgId,
      shortName: row.shortName,
      orgCode: row.orgCode,
      settings: row.settings ?? {},
    },
  });
});

export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = updateSettingsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    // Merge over the existing JSONB so callers can PATCH single keys.
    const [existing] = await tx
      .select({ settings: organization.settings })
      .from(organization)
      .where(eq(organization.id, ctx.orgId));

    const merged = {
      ...((existing?.settings as Record<string, unknown> | null) ?? {}),
      ...body.data.settings,
    };

    const [row] = await tx
      .update(organization)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(organization.id, ctx.orgId))
      .returning({
        orgId: organization.id,
        shortName: organization.shortName,
        orgCode: organization.orgCode,
        settings: organization.settings,
      });
    return row;
  });

  return Response.json({ data: updated });
});
