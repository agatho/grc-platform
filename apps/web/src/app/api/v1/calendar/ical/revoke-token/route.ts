import { db, user } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/calendar/ical/revoke-token — Revoke iCal token for current user
export const DELETE = withErrorHandler(async function DELETE(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  await db
    .update(user)
    .set({
      icalToken: null,
      icalTokenHash: null,
      icalTokenCreatedAt: null,
    })
    .where(eq(user.id, ctx.userId));

  return Response.json({ data: { revoked: true } });
});
