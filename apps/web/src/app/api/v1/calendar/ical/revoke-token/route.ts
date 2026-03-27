import { db, user } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// DELETE /api/v1/calendar/ical/revoke-token — Revoke iCal token for current user
export async function DELETE(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  await db
    .update(user)
    .set({
      icalToken: null,
      icalTokenCreatedAt: null,
    })
    .where(eq(user.id, ctx.userId));

  return Response.json({ data: { revoked: true } });
}
