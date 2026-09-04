// ════════════════════════════════════════════════════════════════════
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079] Die Gruppen-Tabelle gibt
// es nicht — siehe `../route.ts` für die Messung
// ════════════════════════════════════════════════════════════════════
//
// Beide Handler dieser Datei standen auf derselben nicht existierenden
// Tabelle `user_group`:
//
//   * `GET /Groups/:id` beantwortete `relation "user_group" does not exist`
//     mit `404 "Group not found"`. Ein `catch`, der einen Schemafehler in
//     eine fachliche Aussage übersetzt, ist kein Fehlerpfad, sondern eine
//     Behauptung: die Route sagte „diese Gruppe gibt es nicht", ohne je
//     nachgesehen zu haben.
//   * `PATCH /Groups/:id` gab denselben Treibertext als `detail` eines
//     500ers zurück.
//
// Beide melden jetzt 501, solange `42P01` kommt — und arbeiten unverändert
// weiter, sobald die Migration für `user_group` existiert.

import { db, scimSyncLog, runWithRequestContext } from "@grc/db";
import { sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { buildScimError } from "@grc/auth/scim";
import { scimPatchOpSchema } from "@grc/shared";
import {
  scimResponse,
  scimError,
  withScimErrorHandler,
  GROUPS_UNSUPPORTED_DETAIL,
} from "@/lib/api-scim";
import { log } from "@/lib/logger";

const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";

/** Siehe `../route.ts`: `42P01` heisst hier „Gruppenablage fehlt", nicht „Störung". */
function groupStorageMissing(err: unknown, route: string): Response | null {
  if ((err as { code?: string }).code !== "42P01") return null;
  log.warn("scim groups: storage not provisioned", {
    route,
    message: (err as { message?: string }).message,
  });
  return scimError(GROUPS_UNSUPPORTED_DETAIL, 501);
}

// GET /api/v1/scim/v2/Groups/:id — Get single group
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Zeilenformen der rohen
// SCIM-Abfragen, aus ihren SELECT-Listen benannt.
type GroupRow = {
  id: string;
  name: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export const GET = withScimErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  // [ARCTOS-FULL-2026-08-31 · OP-083] Org-Kontext aus dem Maschinentoken — siehe Dateikopf.
  return runWithRequestContext(
    { orgId: authCtx.orgId, userId: "" },
    async () => {
      const { id } = await params;

      try {
        const [group] = (await db.execute(sql`
      SELECT id, name, created_at, updated_at
      FROM user_group
      WHERE id = ${id} AND org_id = ${authCtx.orgId} AND deleted_at IS NULL
    `)) as unknown as GroupRow[];

        if (!group) {
          return scimResponse(buildScimError("Group not found", 404), 404);
        }

        const members = (await db.execute(sql`
      SELECT ugm.user_id AS value, u.name AS display
      FROM user_group_member ugm
      JOIN "user" u ON u.id = ugm.user_id
      WHERE ugm.group_id = ${id}
    `)) as unknown as Array<{ value: string; display: string | null }>;

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
      } catch (err) {
        // [Welle 4b-7 · OP-079] Hier stand `catch { … "Group not found", 404 }`
        // — ein 404 über etwas, das nie nachgesehen wurde.
        const missing = groupStorageMissing(
          err,
          "GET /api/v1/scim/v2/Groups/[id]",
        );
        if (missing) return missing;
        throw err;
      }
    },
  );
}, "GET /api/v1/scim/v2/Groups/[id]");

// PATCH /api/v1/scim/v2/Groups/:id — Update group membership
export const PATCH = withScimErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  // [ARCTOS-FULL-2026-08-31 · OP-083] Org-Kontext aus dem Maschinentoken — siehe Dateikopf.
  return runWithRequestContext(
    { orgId: authCtx.orgId, userId: "" },
    async () => {
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
        const [group] = (await db.execute(sql`
      SELECT id FROM user_group
      WHERE id = ${id} AND org_id = ${authCtx.orgId} AND deleted_at IS NULL
    `)) as unknown as Array<{ id: string }>;

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
        const [updated] = (await db.execute(sql`
      SELECT id, name, created_at, updated_at
      FROM user_group WHERE id = ${id}
    `)) as unknown as GroupRow[];

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
        // [Welle 4b-7 · OP-079] Hier stand `buildScimError(err.message, 500)`.
        const missing = groupStorageMissing(
          err,
          "PATCH /api/v1/scim/v2/Groups/[id]",
        );
        if (missing) return missing;
        throw err;
      }
    },
  );
}, "PATCH /api/v1/scim/v2/Groups/[id]");
