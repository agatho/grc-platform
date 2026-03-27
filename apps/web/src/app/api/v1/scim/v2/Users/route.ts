import { db, user, userOrganizationRole, scimSyncLog } from "@grc/db";
import { eq, and, isNull, sql, ilike } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { scimToArctosUser, arctosToScimUser, buildScimListResponse, buildScimError } from "@grc/auth/scim";
import { parseScimFilter } from "@grc/auth/scim";
import { scimCreateUserSchema } from "@grc/shared";

const SCIM_CONTENT_TYPE = "application/scim+json";

function scimResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

// GET /api/v1/scim/v2/Users — List users (SCIM)
export async function GET(req: Request) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const url = new URL(req.url);
  const startIndex = Math.max(1, parseInt(url.searchParams.get("startIndex") ?? "1", 10));
  const count = Math.min(100, Math.max(1, parseInt(url.searchParams.get("count") ?? "100", 10)));
  const filterStr = url.searchParams.get("filter");

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  // Build filter conditions
  let filterCondition = sql`1=1`;
  if (filterStr) {
    const filter = parseScimFilter(filterStr);
    if (filter) {
      if (filter.attribute === "userName" || filter.attribute === "emails.value") {
        if (filter.operator === "eq") {
          filterCondition = sql`u.email = ${filter.value}`;
        } else if (filter.operator === "co") {
          filterCondition = sql`u.email ILIKE ${"%" + filter.value + "%"}`;
        } else if (filter.operator === "sw") {
          filterCondition = sql`u.email ILIKE ${filter.value + "%"}`;
        }
      } else if (filter.attribute === "externalId" && filter.operator === "eq") {
        filterCondition = sql`u.external_id = ${filter.value}`;
      }
    }
  }

  const items = await db.execute(sql`
    SELECT u.id, u.email, u.name, u.external_id, u.is_active,
           u.created_at, u.updated_at
    FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND ${filterCondition}
    ORDER BY u.created_at
    LIMIT ${count} OFFSET ${startIndex - 1}
  `);

  const [{ total }] = await db.execute<{ total: number }>(sql`
    SELECT count(DISTINCT u.id)::int AS total
    FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND ${filterCondition}
  `);

  const resources = (items as any[]).map((row) =>
    arctosToScimUser(
      {
        id: row.id,
        email: row.email,
        name: row.name,
        externalId: row.external_id,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      `${baseUrl}/api/v1`,
    ),
  );

  return scimResponse(buildScimListResponse(resources, total, startIndex, count));
}

// POST /api/v1/scim/v2/Users — Create user (SCIM)
export async function POST(req: Request) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const body = await req.json();
  const parsed = scimCreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return scimResponse(
      buildScimError(`Invalid SCIM payload: ${parsed.error.message}`, 400),
      400,
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  try {
    const arctosUser = scimToArctosUser(parsed.data as any);

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(user)
      .where(and(eq(user.email, arctosUser.email), isNull(user.deletedAt)));

    if (existing) {
      // Check if already in this org
      const [existingRole] = await db
        .select()
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.userId, existing.id),
            eq(userOrganizationRole.orgId, authCtx.orgId),
            isNull(userOrganizationRole.deletedAt),
          ),
        );

      if (existingRole) {
        return scimResponse(
          buildScimError("User already exists in this organization", 409),
          409,
        );
      }

      // Add to org with default viewer role
      await db.insert(userOrganizationRole).values({
        userId: existing.id,
        orgId: authCtx.orgId,
        role: "viewer",
      });

      // Update identity provider
      await db.execute(sql`
        UPDATE "user" SET
          identity_provider = 'scim',
          external_id = ${arctosUser.externalId ?? null},
          last_synced_at = now()
        WHERE id = ${existing.id}
      `);

      // Log sync
      await db.insert(scimSyncLog).values({
        orgId: authCtx.orgId,
        action: "create",
        status: "success",
        scimResourceId: existing.id,
        userId: existing.id,
        userEmail: arctosUser.email,
        requestPayload: body,
        tokenId: authCtx.tokenId,
      });

      const scimUser = arctosToScimUser(
        {
          ...existing,
          externalId: arctosUser.externalId,
          isActive: true,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        },
        `${baseUrl}/api/v1`,
      );

      return scimResponse(scimUser, 201);
    }

    // Create new user
    const [created] = await db
      .insert(user)
      .values({
        email: arctosUser.email,
        name: arctosUser.name,
        emailVerified: new Date(),
        isActive: arctosUser.isActive,
        language: "de",
        identityProvider: "scim",
        externalId: arctosUser.externalId,
        lastSyncedAt: new Date(),
      })
      .returning();

    // Assign default role
    await db.insert(userOrganizationRole).values({
      userId: created.id,
      orgId: authCtx.orgId,
      role: "viewer",
    });

    // Log sync
    await db.insert(scimSyncLog).values({
      orgId: authCtx.orgId,
      action: "create",
      status: "success",
      scimResourceId: created.id,
      userId: created.id,
      userEmail: arctosUser.email,
      requestPayload: body,
      tokenId: authCtx.tokenId,
    });

    const scimUser = arctosToScimUser(
      {
        id: created.id,
        email: created.email,
        name: created.name,
        externalId: created.externalId,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      `${baseUrl}/api/v1`,
    );

    return scimResponse(scimUser, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SCIM user creation failed";

    await db.insert(scimSyncLog).values({
      orgId: authCtx.orgId,
      action: "create",
      status: "error",
      userEmail: parsed.data.userName,
      errorMessage: message,
      requestPayload: body,
      tokenId: authCtx.tokenId,
    });

    return scimResponse(buildScimError(message, 500), 500);
  }
}
