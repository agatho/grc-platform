import { db, user } from "@grc/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { generateICalFeed } from "@/lib/services/ical-generator";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/v1/calendar/ical/:token — Public iCal feed (token-based auth, no session)
export async function GET(req: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Look up user by iCal token
  const [tokenUser] = await db
    .select({
      id: user.id,
      email: user.email,
    })
    .from(user)
    .where(
      and(
        eq(user.icalToken, token),
        isNotNull(user.icalToken),
      ),
    );

  if (!tokenUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get user's primary org
  const orgResult = await db.execute(
    sql`SELECT org_id FROM user_organization_role WHERE user_id = ${tokenUser.id} LIMIT 1`,
  );

  const orgRows = orgResult as unknown as Array<Record<string, unknown>>;
  if (!orgRows || orgRows.length === 0) {
    return new Response("No organization found", { status: 404 });
  }

  const orgId = String(orgRows[0]!.org_id);

  // Set RLS context for the aggregation queries
  await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);

  const icalContent = await generateICalFeed(orgId);

  return new Response(icalContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=arctos-calendar.ics",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
