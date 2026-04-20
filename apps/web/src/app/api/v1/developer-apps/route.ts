import { db, developerApp } from "@grc/db";
import { createDeveloperAppSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { randomBytes, createHash } from "crypto";

// POST /api/v1/developer-apps
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createDeveloperAppSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const clientId = randomBytes(32).toString("hex");
  const clientSecret = randomBytes(48).toString("hex");
  const clientSecretHash = createHash("sha256")
    .update(clientSecret)
    .digest("hex");
  const clientSecretLast4 = clientSecret.slice(-4);

  const [created] = await db
    .insert(developerApp)
    .values({
      orgId: ctx.orgId,
      name: body.data.name,
      description: body.data.description,
      clientId,
      clientSecretHash,
      clientSecretLast4,
      redirectUris: body.data.redirectUris,
      grantTypes: body.data.grantTypes,
      logoUrl: body.data.logoUrl,
      homepageUrl: body.data.homepageUrl,
      privacyUrl: body.data.privacyUrl,
      tosUrl: body.data.tosUrl,
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json(
    {
      data: {
        ...created,
        clientSecretHash: undefined,
        clientSecret, // shown only once
      },
    },
    { status: 201 },
  );
}

// GET /api/v1/developer-apps
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select({
      id: developerApp.id,
      name: developerApp.name,
      description: developerApp.description,
      clientId: developerApp.clientId,
      clientSecretLast4: developerApp.clientSecretLast4,
      redirectUris: developerApp.redirectUris,
      grantTypes: developerApp.grantTypes,
      status: developerApp.status,
      createdAt: developerApp.createdAt,
    })
    .from(developerApp)
    .where(eq(developerApp.orgId, ctx.orgId))
    .orderBy(desc(developerApp.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(developerApp)
    .where(eq(developerApp.orgId, ctx.orgId));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
