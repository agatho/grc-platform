import { ddSession, withOrgReadContext } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import {
  hashOpaqueToken,
  resolveDdSessionTokenHash,
} from "@grc/auth/anonymous-token";

export type DdSessionRow = typeof ddSession.$inferSelect;

export interface PortalSessionResult {
  session: DdSessionRow;
  /** Org context of the resolved session — callers scope their reads with it. */
  orgId: string;
}

/**
 * #WP3-S02-20 — IP pseudonymisation.
 *
 * The previous code stored `sha256(ip)` and labelled it "GDPR: hash IP".
 * An unsalted SHA-256 over an IPv4 address has 2^32 candidates, so the whole
 * column is invertible by rainbow table in seconds — it was not a
 * pseudonymisation measure at all. Now: HMAC-SHA-256 under a server-side key
 * plus a daily rotation component, so the value is neither invertible nor
 * correlatable across days. Without a configured key we store NOTHING rather
 * than something that merely looks protected.
 */
export function pseudonymizeIp(ip: string): string | null {
  const key =
    process.env.IP_PSEUDONYM_KEY ??
    process.env.SECRET_ENCRYPTION_KEY ??
    process.env.AUTH_SECRET;
  if (!key) return null;
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", key).update(`${day}|${ip}`).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Hash helper for the issuing side (create/rotate a dd_session token). */
export function ddTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Validate a DD portal access token.
 * Returns the session object on success, or a Response on failure.
 * Also appends the caller's pseudonymised IP to ip_address_log and transitions
 * status from 'invited' to 'in_progress' on first access.
 *
 * #WP3-S02-05: `dd_session` has FORCE RLS and this endpoint is anonymous by
 * design, so the previous plain read under `grc_app` returned 0 rows and every
 * valid supplier token answered 401. The token is resolved through the narrow
 * SECURITY DEFINER helper (migration 0412); everything after that runs under a
 * normal org-pinned RLS context.
 *
 * #WP3-S02-20: the token was stored and compared in PLAINTEXT. It is now
 * matched by SHA-256 hash (`access_token_hash`, migration 0411), so a read leak
 * (backup, read replica) no longer hands out live supplier sessions.
 * `require("crypto")` in this ESM module is gone as well — it only worked
 * because the bundler transpiled it.
 */
export async function validateDdToken(
  token: string,
  request: Request,
): Promise<PortalSessionResult | Response> {
  if (!token || token.length < 32) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const tokenHash = hashOpaqueToken(token);
  const resolved = await resolveDdSessionTokenHash(tokenHash);

  if (!resolved) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const orgId = resolved.orgId;

  return withOrgReadContext<PortalSessionResult | Response>(
    orgId,
    async (sdb) => {
      const foundSession = await sdb.query.ddSession.findFirst({
        where: eq(ddSession.id, resolved.id),
      });

      if (!foundSession) {
        return Response.json(
          { error: "Invalid or expired token" },
          { status: 401 },
        );
      }

      // Defence in depth: the resolver already matched on the hash, but compare
      // again in constant time so a future change there cannot silently widen
      // the match.
      if (
        foundSession.accessTokenHash &&
        !constantTimeEquals(foundSession.accessTokenHash, tokenHash)
      ) {
        return Response.json({ error: "Invalid token" }, { status: 401 });
      }

      if (foundSession.status === "revoked") {
        return Response.json({ error: "Token revoked" }, { status: 403 });
      }

      if (foundSession.status === "submitted") {
        return Response.json({ error: "Already submitted" }, { status: 403 });
      }

      if (new Date() > new Date(foundSession.tokenExpiresAt)) {
        await sdb
          .update(ddSession)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(ddSession.id, foundSession.id));
        return Response.json({ error: "Token expired" }, { status: 410 });
      }

      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      const pseudonym = pseudonymizeIp(ip);

      const newStatus =
        foundSession.status === "invited" ? "in_progress" : foundSession.status;

      await sdb
        .update(ddSession)
        .set({
          ...(pseudonym
            ? { ipAddressLog: sql`array_append(ip_address_log, ${pseudonym})` }
            : {}),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(ddSession.id, foundSession.id));

      return {
        session: { ...foundSession, status: newStatus } as DdSessionRow,
        orgId,
      };
    },
  );
}
