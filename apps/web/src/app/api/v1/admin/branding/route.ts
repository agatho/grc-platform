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

import { db, orgBranding } from "@grc/db";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
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
  reportTemplate: z
    .enum(["standard", "executive", "regulator", "minimalist"])
    .optional(),
  confidentialityNotice: z.string().nullable().optional(),
  customCss: z.string().nullable().optional(),
  inheritFromParent: z.boolean().optional(),
});

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [row] = await db
    .select()
    .from(orgBranding)
    .where(eq(orgBranding.orgId, ctx.orgId));

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
        reportTemplate: "standard",
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
