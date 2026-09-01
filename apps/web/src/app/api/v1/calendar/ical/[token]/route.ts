import { runWithRequestContext } from "@grc/db";
import {
  hashOpaqueToken,
  resolveIcalTokenHash,
} from "@grc/auth/anonymous-token";
import { generateICalFeed } from "@/lib/services/ical-generator";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/v1/calendar/ical/:token — Public iCal feed (token-based auth, no session)
//
// #WP3-S02-08 (High) — the previous implementation did:
//
//   await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);
//
// The third argument `false` means `is_local = false`, i.e. a SESSION-level
// GUC. Because this handler uses no `withAuth`, the `db` proxy resolves to the
// shared BASE pool — the pool the code itself documents as "never pinned to an
// org context … so the base pool always stays clean". The connection returned
// to the pool still carrying `app.current_org_id = <org A>`, and every later
// context-free query on that same connection (login bootstrap, event bus,
// webhook dispatch, worker jobs) then saw org A's rows where it expected none.
//
// #WP3-S02-05 — the token lookup itself could not work under `grc_app` either:
// `user` is FORCE-RLS, so a context-free read returned 0 rows and every valid
// feed URL answered 401.
//
// #WP3-S02-20 — the feed token was stored in PLAINTEXT and compared directly.
// It is matched by SHA-256 hash now (migration 0411).
//
// Now: the token resolves through the narrow SECURITY DEFINER helper, and the
// aggregation runs inside `runWithRequestContext`, which reserves its OWN
// connection, pins the GUCs on THAT connection and releases it afterwards.
export async function GET(req: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resolved = await resolveIcalTokenHash(hashOpaqueToken(token));
  if (!resolved) {
    return new Response("Unauthorized", { status: 401 });
  }

  const icalContent = await runWithRequestContext(
    { orgId: resolved.orgId, userId: resolved.userId },
    () => generateICalFeed(resolved.orgId),
  );

  return new Response(icalContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=arctos-calendar.ics",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
