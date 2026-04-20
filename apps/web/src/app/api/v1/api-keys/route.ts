import { db, apiKey, apiKeyScope, apiScope } from "@grc/db";
import { createApiKeySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { randomBytes, createHash } from "crypto";

function generateApiKey(): {
  key: string;
  hash: string;
  prefix: string;
  last4: string;
} {
  const raw = randomBytes(32).toString("hex");
  const prefix = `grc_${raw.slice(0, 8)}`;
  const key = `${prefix}_${raw.slice(8)}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const last4 = raw.slice(-4);
  return { key, hash, prefix, last4 };
}

// POST /api/v1/api-keys
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createApiKeySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { key, hash, prefix, last4 } = generateApiKey();

  const [created] = await db
    .insert(apiKey)
    .values({
      orgId: ctx.orgId,
      name: body.data.name,
      description: body.data.description,
      keyPrefix: prefix,
      keyHash: hash,
      keyLast4: last4,
      expiresAt: body.data.expiresAt
        ? new Date(body.data.expiresAt)
        : undefined,
      rateLimitPerMinute: body.data.rateLimitPerMinute,
      rateLimitPerDay: body.data.rateLimitPerDay,
      allowedIps: body.data.allowedIps,
      createdBy: ctx.userId,
    })
    .returning();

  if (body.data.scopeIds.length > 0) {
    await db.insert(apiKeyScope).values(
      body.data.scopeIds.map((scopeId) => ({
        apiKeyId: created.id,
        scopeId,
      })),
    );
  }

  return Response.json(
    {
      data: {
        ...created,
        keyHash: undefined,
        secret: key, // plaintext, shown only at creation
      },
    },
    { status: 201 },
  );
}

// GET /api/v1/api-keys
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
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
      createdAt: apiKey.createdAt,
    })
    .from(apiKey)
    .where(eq(apiKey.orgId, ctx.orgId))
    .orderBy(desc(apiKey.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiKey)
    .where(eq(apiKey.orgId, ctx.orgId));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
