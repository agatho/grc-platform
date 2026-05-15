// GET/PUT /api/v1/admin/branding
//
// #WAVE17-P2-04: Wave-14 QA flagged this as a 404 even though the
// /settings/branding page exists and the org_branding Drizzle schema
// is fully defined (per-org colors, logos, report template, custom CSS).
// Wires up the missing CRUD path.
//
// Auth model: any authenticated org member can READ the branding (the
// theme is rendered by every page) but only `admin` can write.
// PUT is upsert — if no row exists for the org we create it with the
// payload merged onto the column defaults.

import { orgBranding } from "@grc/db";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

const HEX_COLOR = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "must be a hex colour like #RRGGBB");

const updateBrandingSchema = z.object({
  primaryColor: HEX_COLOR.optional(),
  secondaryColor: HEX_COLOR.optional(),
  accentColor: HEX_COLOR.optional(),
  textColor: HEX_COLOR.optional(),
  backgroundColor: HEX_COLOR.optional(),
  darkModePrimaryColor: HEX_COLOR.nullable().optional(),
  darkModeAccentColor: HEX_COLOR.nullable().optional(),
  logoPath: z.string().max(1000).nullable().optional(),
  faviconPath: z.string().max(1000).nullable().optional(),
  // #WAVE18-P2: Wave-17 ship had `executive | regulator | minimalist`
  // here, but the actual `branding_template_style` enum (migrated in
  // Sprint 13a) only has `standard | formal | minimal`. PUT bombed
  // with 500 the moment QA tried any of the other values. Aligned.
  reportTemplate: z.enum(["standard", "formal", "minimal"]).optional(),
  confidentialityNotice: z.string().nullable().optional(),
  customCss: z.string().nullable().optional(),
  inheritFromParent: z.boolean().optional(),
});

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // #WAVE19-P2-01: Wave-17 + Marathon + Wave-18 QA all hit 500 here.
  // Root cause was a missing RLS context: `db.select()` without
  // withReadContext runs outside any transaction → app.current_org_id
  // GUC isn't set → the org_branding RLS policy filters out every
  // row, OR (depending on pg version + driver) raises an
  // invalid_text_representation cast error on the empty-string GUC.
  // Wrapping the read in withReadContext sets the GUC inside the
  // transaction, which is the canonical pattern documented in
  // apps/web/src/lib/api.ts.
  //
  // Defence in depth: if the org_branding table genuinely doesn't
  // exist on a given deploy (pre-Sprint-13a), fall back to the
  // defaults payload rather than 500. The catch maps the PG
  // 42P01 (undefined_table) onto the same defaults branch.
  let row: typeof orgBranding.$inferSelect | undefined;
  try {
    const rows = await withReadContext(ctx, async (tx) =>
      tx.select().from(orgBranding).where(eq(orgBranding.orgId, ctx.orgId)),
    );
    row = rows[0];
  } catch (err) {
    // Surface table-missing as a typed defaults response rather than
    // a generic 500. Other PG errors propagate to withErrorHandler.
    const code = (err as { code?: string }).code;
    if (code !== "42P01") throw err;
    row = undefined;
  }

  // Surface defaults if no row exists yet — every UI element wants a
  // theme, even before the admin has customised one. Mirrors the
  // column-default values on org_branding so the UI sees a consistent
  // shape regardless of branding-row presence.
  if (!row) {
    return Response.json({
      data: {
        orgId: ctx.orgId,
        primaryColor: "#2563eb",
        secondaryColor: "#1e40af",
        accentColor: "#f59e0b",
        textColor: "#0f172a",
        backgroundColor: "#ffffff",
        darkModePrimaryColor: null,
        darkModeAccentColor: null,
        logoPath: null,
        faviconPath: null,
        reportTemplate: "standard" as const,
        confidentialityNotice: "CONFIDENTIAL -- For internal use only",
        customCss: null,
        inheritFromParent: true,
        source: "defaults",
      },
    });
  }

  return Response.json({ data: { ...row, source: "stored" } });
});

export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = updateBrandingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: orgBranding.id })
      .from(orgBranding)
      .where(eq(orgBranding.orgId, ctx.orgId));

    if (existing) {
      const [row] = await tx
        .update(orgBranding)
        .set({
          ...body.data,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orgBranding.id, existing.id),
            eq(orgBranding.orgId, ctx.orgId),
          ),
        )
        .returning();
      return row;
    }

    const [row] = await tx
      .insert(orgBranding)
      .values({
        orgId: ctx.orgId,
        ...body.data,
        updatedBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: { ...updated, source: "stored" } });
});
