import { db, scimSyncLog } from "@grc/db";
import { sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { buildScimError } from "@grc/auth/scim";
import { scimPatchOpSchema } from "@grc/shared";

const SCIM_CONTENT_TYPE = "application/scim+json";
const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";

function scimResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

// GET /api/v1/scim/v2/Groups/:id — Get single group
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  const { id } = await params;

  try {
    const [group] = await db.execute(sql`
      SELECT id, name, created_at, updated_at
      FROM user_group
      WHERE id = ${id} AND org_id = ${authCtx.orgId} AND deleted_at IS NULL
    `) as any[];

    if (!group) {
      return scimResponse(buildScimError("Group not found", 404), 404);
    }

    const members = await db.execute(sql`
      SELECT ugm.user_id AS value, u.name AS display
      FROM user_group_member ugm
      JOIN "user" u ON u.id = ugm.user_id
      WHERE ugm.group_id = ${id}
    `) as any[];

    return scimResponse({
      schemas: [SCIM_GROUP_SCHEMA],
      id: group.id,
      displayName: group.name,
      members,
      meta: {
        resourceType: "Group",
        created: group.created_at,
        lastModified: group.updated_at,
      },
    });
  } catch {
    return scimResponse(buildScimError("Group not found", 404), 404);
  }
}

// PATCH /api/v1/scim/v2/Groups/:id — Update group membership
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

  try {
    // Verify group exists and belongs to org
    const [group] = await db.execute(sql`
      SELECT id FROM user_group
      WHERE id = ${id} AND org_id = ${authCtx.orgId} AND deleted_at IS NULL
    `) as any[];

    if (!group) {
      return scimResponse(buildScimError("Group not found", 404), 404);
    }

    for (const op of parsed.data.Operations) {
      if (op.path === "members" || op.path === "members[value eq") {
        if (op.op === "add" && Array.isArray(op.value)) {
          for (const member of op.value as Array<{ value: string }>) {
            await db.execute(sql`
              INSERT INTO user_group_member (group_id, user_id, created_at)
              VALUES (${id}, ${member.value}, now())
              ON CONFLICT DO NOTHING
            `);
          }
        } else if (op.op === "remove" && Array.isArray(op.value)) {
          for (const member of op.value as Array<{ value: string }>) {
            await db.execute(sql`
              DELETE FROM user_group_member
              WHERE group_id = ${id} AND user_id = ${member.value}
            `);
          }
        }
      } else if (op.path === "displayName" && op.op === "replace") {
        await db.execute(sql`
          UPDATE user_group SET name = ${String(op.value)}, updated_at = now()
          WHERE id = ${id}
        `);
      }
    }

    await db.insert(scimSyncLog).values({
      orgId: authCtx.orgId,
      action: "group_assign",
      status: "success",
      scimResourceId: id,
      requestPayload: body,
      tokenId: authCtx.tokenId,
    });

    // Return updated group
    const [updated] = await db.execute(sql`
      SELECT id, name, created_at, updated_at
      FROM user_group WHERE id = ${id}
    `) as any[];

    return scimResponse({
      schemas: [SCIM_GROUP_SCHEMA],
      id: updated.id,
      displayName: updated.name,
      meta: {
        resourceType: "Group",
        created: updated.created_at,
        lastModified: updated.updated_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Group update failed";
    return scimResponse(buildScimError(message, 500), 500);
  }
}
