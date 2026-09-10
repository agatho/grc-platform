// Sprint 21: User Content Language Preference
// GET /api/v1/users/content-language — get current user's content language
// PUT /api/v1/users/content-language — update content language preference

import { db } from "@grc/db";
import { updateUserContentLanguageSchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const result = await db.execute(sql`
    SELECT content_language, language
    FROM "user"
    WHERE id = ${ctx.userId}
  `);

  const rows = result as unknown as Array<{
    content_language: string | null;
    language: string;
  }>;

  if (!rows || rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      contentLanguage: rows[0].content_language,
      uiLanguage: rows[0].language,
    },
  });
});
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = updateUserContentLanguageSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx.execute(sql`
      UPDATE "user"
      SET content_language = ${body.data.contentLanguage},
          updated_at = now(),
          updated_by = ${ctx.userId}
      WHERE id = ${ctx.userId}
    `);
  });

  return Response.json({
    data: { contentLanguage: body.data.contentLanguage },
  });
});
