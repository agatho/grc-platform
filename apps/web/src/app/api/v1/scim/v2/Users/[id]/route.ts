import { db, user, userOrganizationRole, scimSyncLog } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { arctosToScimUser, buildScimError } from "@grc/auth/scim";
import { scimPatchOpSchema, scimReplaceUserSchema } from "@grc/shared";

const SCIM_CONTENT_TYPE = "application/scim+json";

function scimResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

// GET /api/v1/scim/v2/Users/:id — Get single user
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const { id } = await params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  // Verify user belongs to org
  const result = await db.execute(sql`
    SELECT u.id, u.email, u.name, u.external_id, u.is_active,
           u.created_at, u.updated_at
    FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `);

  const row = (result as any[])[0];
  if (!row) {
    return scimResponse(buildScimError("User not found", 404), 404);
  }

  return scimResponse(
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
}

// PUT /api/v1/scim/v2/Users/:id — Replace user
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = scimReplaceUserSchema.safeParse(body);
  if (!parsed.success) {
    return scimResponse(
      buildScimError(`Invalid SCIM payload: ${parsed.error.message}`, 400),
      400,
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  // Verify user belongs to org
  const [existing] = (await db.execute(sql`
    SELECT u.id FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as any[];

  if (!existing) {
    return scimResponse(buildScimError("User not found", 404), 404);
  }

  const name =
    `${parsed.data.name.givenName} ${parsed.data.name.familyName}`.trim();

  await db.execute(sql`
    UPDATE "user" SET
      email = ${parsed.data.userName.toLowerCase()},
      name = ${name},
      external_id = ${parsed.data.externalId ?? null},
      is_active = ${parsed.data.active ?? true},
      identity_provider = 'scim',
      last_synced_at = now(),
      updated_at = now()
    WHERE id = ${id}
  `);

  await db.insert(scimSyncLog).values({
    orgId: authCtx.orgId,
    action: "update",
    status: "success",
    scimResourceId: id,
    userId: id,
    userEmail: parsed.data.userName,
    requestPayload: body,
    tokenId: authCtx.tokenId,
  });

  // Fetch updated user
  const [updated] = await db.select().from(user).where(eq(user.id, id));

  return scimResponse(
    arctosToScimUser(
      {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        externalId: updated.externalId,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      `${baseUrl}/api/v1`,
    ),
  );
}

// PATCH /api/v1/scim/v2/Users/:id — Partial update (PatchOp)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = scimPatchOpSchema.safeParse(body);
  if (!parsed.success) {
    return scimResponse(
      buildScimError(`Invalid PatchOp: ${parsed.error.message}`, 400),
      400,
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";

  // Verify user belongs to org
  const [existing] = (await db.execute(sql`
    SELECT u.id, u.email, u.name FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as any[];

  if (!existing) {
    return scimResponse(buildScimError("User not found", 404), 404);
  }

  let action: "update" | "deactivate" | "reactivate" = "update";

  // Process operations
  for (const op of parsed.data.Operations) {
    if (op.op === "replace") {
      if (op.path === "active") {
        const isActive = op.value === true || op.value === "true";
        await db.execute(sql`
          UPDATE "user" SET is_active = ${isActive}, updated_at = now(), last_synced_at = now()
          WHERE id = ${id}
        `);
        action = isActive ? "reactivate" : "deactivate";
      } else if (
        op.path === "name.givenName" ||
        op.path === "name.familyName"
      ) {
        // For name updates, fetch current name and update the relevant part
        const [current] = await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, id));
        const parts = (current?.name ?? "").split(" ");
        if (op.path === "name.givenName") {
          parts[0] = String(op.value);
        } else {
          parts[parts.length > 1 ? parts.length - 1 : 1] = String(op.value);
        }
        await db.execute(sql`
          UPDATE "user" SET name = ${parts.join(" ")}, updated_at = now(), last_synced_at = now()
          WHERE id = ${id}
        `);
      } else if (
        op.path === "userName" ||
        op.path === 'emails[type eq "work"].value'
      ) {
        await db.execute(sql`
          UPDATE "user" SET email = ${String(op.value).toLowerCase()}, updated_at = now(), last_synced_at = now()
          WHERE id = ${id}
        `);
      } else if (op.path === "externalId") {
        await db.execute(sql`
          UPDATE "user" SET external_id = ${String(op.value)}, updated_at = now(), last_synced_at = now()
          WHERE id = ${id}
        `);
      }
    }
  }

  await db.insert(scimSyncLog).values({
    orgId: authCtx.orgId,
    action,
    status: "success",
    scimResourceId: id,
    userId: id,
    userEmail: existing.email,
    requestPayload: body,
    tokenId: authCtx.tokenId,
  });

  // Fetch updated user
  const [updated] = await db.select().from(user).where(eq(user.id, id));

  return scimResponse(
    arctosToScimUser(
      {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        externalId: updated.externalId,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      `${baseUrl}/api/v1`,
    ),
  );
}

// DELETE /api/v1/scim/v2/Users/:id — Deactivate user (soft-delete, NOT hard delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const { id } = await params;

  // Verify user belongs to org
  const [existing] = (await db.execute(sql`
    SELECT u.id, u.email FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as any[];

  if (!existing) {
    return scimResponse(buildScimError("User not found", 404), 404);
  }

  // Soft-delete: deactivate user, do NOT hard delete
  await db.execute(sql`
    UPDATE "user" SET is_active = false, updated_at = now(), last_synced_at = now()
    WHERE id = ${id}
  `);

  await db.insert(scimSyncLog).values({
    orgId: authCtx.orgId,
    action: "deactivate",
    status: "success",
    scimResourceId: id,
    userId: id,
    userEmail: existing.email,
    tokenId: authCtx.tokenId,
  });

  return new Response(null, { status: 204 });
}
