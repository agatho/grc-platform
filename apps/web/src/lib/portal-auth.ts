import { db, ddSession } from "@grc/db";
import { eq, sql } from "drizzle-orm";

export type DdSessionRow = typeof ddSession.$inferSelect;

export interface PortalSessionResult {
  session: DdSessionRow;
}

/**
 * Validate a DD portal access token.
 * Returns the session object on success, or a Response on failure.
 * Also appends the caller's IP to ip_address_log and transitions
 * status from 'invited' to 'in_progress' on first access.
 */
export async function validateDdToken(
  token: string,
  request: Request,
): Promise<PortalSessionResult | Response> {
  if (!token || token.length < 32) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const foundSession = await db.query.ddSession.findFirst({
    where: eq(ddSession.accessToken, token),
  });

  if (!foundSession) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  if (foundSession.status === "revoked") {
    return Response.json({ error: "Token revoked" }, { status: 403 });
  }

  if (foundSession.status === "submitted") {
    return Response.json({ error: "Already submitted" }, { status: 403 });
  }

  if (new Date() > new Date(foundSession.tokenExpiresAt)) {
    await db
      .update(ddSession)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(ddSession.id, foundSession.id));
    return Response.json({ error: "Token expired" }, { status: 410 });
  }

  // Log IP for audit
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const newStatus =
    foundSession.status === "invited" ? "in_progress" : foundSession.status;

  await db
    .update(ddSession)
    .set({
      ipAddressLog: sql`array_append(ip_address_log, ${ip})`,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(ddSession.id, foundSession.id));

  return {
    session: { ...foundSession, status: newStatus } as DdSessionRow,
  };
}
