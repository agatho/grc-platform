// Sprint 21: Organization Language Configuration API
// GET /api/v1/admin/languages — get org language config
// PUT /api/v1/admin/languages — update org language config

import { db, organization } from "@grc/db";
import {
  updateOrgLanguagesSchema,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
} from "@grc/shared";
import { eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Get org language config
  const result = await db.execute(sql`
    SELECT
      default_language,
      active_languages
    FROM organization
    WHERE id = ${ctx.orgId}
  `);

  const rows = result as unknown as Array<{
    default_language: string;
    active_languages: string[] | string;
  }>;

  if (!rows || rows.length === 0) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const orgRow = rows[0];
  let activeLanguages: string[];
  try {
    activeLanguages =
      typeof orgRow.active_languages === "string"
        ? JSON.parse(orgRow.active_languages)
        : orgRow.active_languages;
  } catch {
    activeLanguages = ["de"];
  }

  const defaultLanguage = orgRow.default_language ?? "de";

  // Build language configs with labels
  const languages = SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code] ?? code,
    isPrimary: code === defaultLanguage,
    isActive: activeLanguages.includes(code),
  }));

  return Response.json({
    data: {
      defaultLanguage,
      activeLanguages,
      languages,
      supportedLanguages: SUPPORTED_LANGUAGES,
    },
  });
}

export async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = updateOrgLanguagesSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  if (body.data.defaultLanguage) {
    // Default language must be in active languages
    if (body.data.activeLanguages && !body.data.activeLanguages.includes(body.data.defaultLanguage)) {
      return Response.json(
        { error: "Default language must be in active languages list" },
        { status: 422 },
      );
    }
  }

  await withAuditContext(ctx, async (tx) => {
    if (body.data.defaultLanguage) {
      await tx.execute(sql`
        UPDATE organization
        SET default_language = ${body.data.defaultLanguage},
            updated_at = now(),
            updated_by = ${ctx.userId}
        WHERE id = ${ctx.orgId}
      `);
    }

    if (body.data.activeLanguages) {
      const langJson = JSON.stringify(body.data.activeLanguages);
      await tx.execute(sql`
        UPDATE organization
        SET active_languages = ${langJson}::jsonb,
            updated_at = now(),
            updated_by = ${ctx.userId}
        WHERE id = ${ctx.orgId}
      `);
    }
  });

  return Response.json({
    data: {
      defaultLanguage: body.data.defaultLanguage,
      activeLanguages: body.data.activeLanguages,
    },
  });
}
