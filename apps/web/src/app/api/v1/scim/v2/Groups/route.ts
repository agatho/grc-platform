// ════════════════════════════════════════════════════════════════════
// [ARCTOS-FULL-2026-08-31 · OP-083] Org-Kontext fuer die SCIM-Endpunkte
// ════════════════════════════════════════════════════════════════════
//
// SCIM authentifiziert sich mit einem Maschinentoken, nicht mit einer Sitzung.
// Es gab hier deshalb nie einen Request-Kontext, und jede Abfrage lief ueber
// den kontextlosen Basis-Pool. Das hatte zwei Folgen, und die zweite ist die
// schwerere:
//
//   * Lesend war der Endpunkt tot: der JOIN auf `user_organization_role` traf
//     unter `grc_app` KEINE Zeile (org-skalierte Policy, kein Org-GUC).
//     Gemessen auf einer frisch migrierten Datenbank: 0 statt 1 Nutzer. SCIM
//     listete also nie jemanden, und das Deprovisioning Ausgeschiedener —
//     der eigentliche Zweck der Schnittstelle — lief ins Leere.
//   * Auf `user` trug die Policy bis Migration 0456 eine kontextlose
//     Disjunktion. Dieser Pfad sah damit das Nutzerverzeichnis ALLER
//     Mandanten (gemessen 36 Zeilen mit Passwort-Hashes gegenueber 1).
//
// Jeder Handler laeuft jetzt in `runWithRequestContext`: eine eigene
// reservierte Verbindung, `app.current_org_id` auf die Org DES TOKENS, und der
// globale `db`-Proxy zeigt fuer die Dauer des Aufrufs darauf. `userId: ""` ist
// die etablierte Form fuer maschinelle Kontexte (portal/*, wb-Mailbox): SCIM
// handelt als Dienst, nicht als Person, und der Audit-Trigger schreibt
// entsprechend keinen Akteur statt einen erfundenen.

import { db, scimSyncLog, runWithRequestContext } from "@grc/db";
import { sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { buildScimError } from "@grc/auth/scim";
import { scimCreateGroupSchema } from "@grc/shared";

const SCIM_CONTENT_TYPE = "application/scim+json";
const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";

function scimResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

// GET /api/v1/scim/v2/Groups — List groups
export async function GET(req: Request) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  // [ARCTOS-FULL-2026-08-31 · OP-083] Org-Kontext aus dem Maschinentoken — siehe Dateikopf.
  return runWithRequestContext(
    { orgId: authCtx.orgId, userId: "" },
    async () => {
      const url = new URL(req.url);
      const startIndex = Math.max(
        1,
        parseInt(url.searchParams.get("startIndex") ?? "1", 10),
      );
      const count = Math.min(
        100,
        Math.max(1, parseInt(url.searchParams.get("count") ?? "100", 10)),
      );

      // If user_group table exists, query it; otherwise return empty
      // The user_group table is from Sprint 1.x which may or may not be implemented
      try {
        const groups = await db.execute(sql`
      SELECT ug.id, ug.name, ug.created_at, ug.updated_at
      FROM user_group ug
      WHERE ug.org_id = ${authCtx.orgId}
        AND ug.deleted_at IS NULL
      ORDER BY ug.name
      LIMIT ${count} OFFSET ${startIndex - 1}
    `);

        const [{ total }] = await db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM user_group
      WHERE org_id = ${authCtx.orgId} AND deleted_at IS NULL
    `);

        const resources = (groups as any[]).map((g) => ({
          schemas: [SCIM_GROUP_SCHEMA],
          id: g.id,
          displayName: g.name,
          meta: {
            resourceType: "Group",
            created: g.created_at,
            lastModified: g.updated_at,
          },
        }));

        return scimResponse({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: total,
          startIndex,
          itemsPerPage: count,
          Resources: resources,
        });
      } catch {
        // user_group table may not exist yet — return empty
        return scimResponse({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: 0,
          startIndex: 1,
          itemsPerPage: count,
          Resources: [],
        });
      }
    },
  );
}

// POST /api/v1/scim/v2/Groups — Create group
export async function POST(req: Request) {
  const authCtx = await validateScimToken(req.headers.get("Authorization"));
  if (!authCtx) {
    return scimResponse(buildScimError("Unauthorized", 401), 401);
  }

  // [ARCTOS-FULL-2026-08-31 · OP-083] Org-Kontext aus dem Maschinentoken — siehe Dateikopf.
  return runWithRequestContext(
    { orgId: authCtx.orgId, userId: "" },
    async () => {
      const body = await req.json();
      const parsed = scimCreateGroupSchema.safeParse(body);
      if (!parsed.success) {
        return scimResponse(
          buildScimError(
            `Invalid SCIM group payload: ${parsed.error.message}`,
            400,
          ),
          400,
        );
      }

      try {
        const [created] = (await db.execute(sql`
      INSERT INTO user_group (org_id, name, created_at, updated_at)
      VALUES (${authCtx.orgId}, ${parsed.data.displayName}, now(), now())
      RETURNING id, name, created_at, updated_at
    `)) as any[];

        // Add members if provided
        if (parsed.data.members?.length) {
          for (const member of parsed.data.members) {
            await db.execute(sql`
          INSERT INTO user_group_member (group_id, user_id, created_at)
          VALUES (${created.id}, ${member.value}, now())
          ON CONFLICT DO NOTHING
        `);
          }
        }

        await db.insert(scimSyncLog).values({
          orgId: authCtx.orgId,
          action: "group_assign",
          status: "success",
          scimResourceId: created.id,
          requestPayload: body,
          tokenId: authCtx.tokenId,
        });

        return scimResponse(
          {
            schemas: [SCIM_GROUP_SCHEMA],
            id: created.id,
            displayName: created.name,
            members: parsed.data.members ?? [],
            meta: {
              resourceType: "Group",
              created: created.created_at,
              lastModified: created.updated_at,
            },
          },
          201,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Group creation failed";
        return scimResponse(buildScimError(message, 500), 500);
      }
    },
  );
}
