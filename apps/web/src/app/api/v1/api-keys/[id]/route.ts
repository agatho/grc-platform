import { db, apiKey, apiKeyScope } from "@grc/db";
import { updateApiKeySchema, revokeApiKeySchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/api-keys/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description,
      keyPrefix: apiKey.keyPrefix,
      keyLast4: apiKey.keyLast4,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      rateLimitPerDay: apiKey.rateLimitPerDay,
      allowedIps: apiKey.allowedIps,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    })
    .from(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

  const scopes = await db
    .select()
    .from(apiKeyScope)
    .where(eq(apiKeyScope.apiKeyId, id));

  return Response.json({ data: { ...row, scopes } });
}

// PATCH /api/v1/api-keys/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updateApiKeySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { scopeIds, ...updateData } = body.data;

  const [updated] = await db
    .update(apiKey)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(apiKey.id, id), eq(apiKey.orgId, ctx.orgId)))
    .returning();

  if (!updated) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

  if (scopeIds) {
    await db.delete(apiKeyScope).where(eq(apiKeyScope.apiKeyId, id));
    if (scopeIds.length > 0) {
      await db.insert(apiKeyScope).values(
        scopeIds.map((scopeId) => ({ apiKeyId: id, scopeId })),
      );
    }
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/api-keys/:id — Revoke
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [revoked] = await db
    .update(apiKey)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(apiKey.id, id), eq(apiKey.orgId, ctx.orgId)))
    .returning();

  if (!revoked) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

  return Response.json({ data: revoked });
}
