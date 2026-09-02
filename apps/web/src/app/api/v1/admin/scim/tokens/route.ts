import { db, scimToken } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createScimTokenSchema } from "@grc/shared";
import {
  generateScimToken,
  hashScimToken,
  scimTokenDefaultExpiry,
  SCIM_TOKEN_DEFAULT_TTL_DAYS,
} from "@grc/auth/scim";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/scim/tokens — List SCIM tokens for current org
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const tokens = await db
    .select({
      id: scimToken.id,
      description: scimToken.description,
      isActive: scimToken.isActive,
      lastUsedAt: scimToken.lastUsedAt,
      createdAt: scimToken.createdAt,
      revokedAt: scimToken.revokedAt,
      // #WP3-S02-15: surface the expiry so an operator can see which tokens
      // are about to lapse instead of discovering it when provisioning breaks.
      expiresAt: scimToken.expiresAt,
      rotatedFromId: scimToken.rotatedFromId,
      rotatedAt: scimToken.rotatedAt,
    })
    .from(scimToken)
    .where(eq(scimToken.orgId, ctx.orgId))
    .orderBy(scimToken.createdAt);

  return Response.json({ data: tokens });
});
// POST /api/v1/admin/scim/tokens — Generate new SCIM token
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = createScimTokenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const plainToken = generateScimToken();
  const tokenHash = hashScimToken(plainToken);

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(scimToken)
      .values({
        orgId: ctx.orgId,
        tokenHash,
        description: parsed.data.description,
        createdBy: ctx.userId,
        // #WP3-S02-15: SCIM tokens are no longer immortal. A token that leaks
        // into an IdP configuration backup, a ticket or a log now stops working
        // on its own instead of authorising create/update/deactivate on every
        // user of the org until somebody notices.
        expiresAt: scimTokenDefaultExpiry(),
        // Rotation without a downtime window: the caller may name the token
        // this one replaces. Both stay valid until the old one is revoked.
        rotatedFromId: parsed.data.rotatesTokenId ?? null,
        rotatedAt: parsed.data.rotatesTokenId ? new Date() : null,
      })
      .returning({
        id: scimToken.id,
        description: scimToken.description,
        createdAt: scimToken.createdAt,
        expiresAt: scimToken.expiresAt,
      });
    return created;
  });

  // Return plaintext token ONCE — it is never stored/returned again
  return Response.json(
    {
      data: {
        id: result.id,
        token: plainToken,
        description: result.description,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        validForDays: SCIM_TOKEN_DEFAULT_TTL_DAYS,
      },
    },
    { status: 201 },
  );
});
