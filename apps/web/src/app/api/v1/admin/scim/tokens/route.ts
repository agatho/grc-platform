import { db, scimToken } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createScimTokenSchema } from "@grc/shared";
import { generateScimToken, hashScimToken } from "@grc/auth/scim";

// GET /api/v1/admin/scim/tokens — List SCIM tokens for current org
export async function GET(req: Request) {
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
    })
    .from(scimToken)
    .where(eq(scimToken.orgId, ctx.orgId))
    .orderBy(scimToken.createdAt);

  return Response.json({ data: tokens });
}

// POST /api/v1/admin/scim/tokens — Generate new SCIM token
export async function POST(req: Request) {
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
      })
      .returning({
        id: scimToken.id,
        description: scimToken.description,
        createdAt: scimToken.createdAt,
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
      },
    },
    { status: 201 },
  );
}
