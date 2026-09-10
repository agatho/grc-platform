// ════════════════════════════════════════════════════════════════════
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079] Die Gruppen-Tabelle gibt
// es nicht — und bis hierher sagte es niemand
// ════════════════════════════════════════════════════════════════════
//
// Alles unter `/scim/v2/Groups` steht auf einer Tabelle `user_group` (und
// `user_group_member`). Nachgemessen am 2026-09-04 gegen die laufende
// Datenbank `grc_v4c` (617 Tabellen) und gegen das gesamte Repository:
//
//     psql> select id from user_group limit 1;
//     ERROR:  relation "user_group" does not exist
//
//     $ grep -rn "user_group" --include=*.sql --include=*.ts .
//     (ausser den beiden Groups-Routendateien: nichts)
//
// Keine Migration, kein Drizzle-Schema, kein Entwurf. Die Wirkung war nicht
// „ein Fehler", sondern VIER verschiedene Unwahrheiten:
//
//   GET  /Groups      → 200 mit `totalResults: 0`. Ein `catch`, dessen
//                       Kommentar „user_group table may not exist yet"
//                       lautete — er beschrieb keinen Übergang, sondern den
//                       Dauerzustand. Das ist die gefährlichste der vier:
//                       Entra ID und Okta lesen eine leere Liste als
//                       Bestandsauskunft, nicht als „kann ich nicht".
//   GET  /Groups/:id  → 404 „Group not found" aus demselben `catch`: eine
//                       fachliche Aussage über etwas, das nie geprüft wurde.
//   POST /Groups      → 500 mit `relation "user_group" does not exist`
//                       WÖRTLICH im Rumpf (dieselbe Klasse wie OP-174).
//   PATCH /Groups/:id → dito.
//
// Was hier NICHT passiert ist: die Implementierung wegzuwerfen. Sie ist
// richtig für den Tag, an dem die Migration kommt. Was passiert ist: die drei
// lügenden `catch` sind durch EINEN Zweig ersetzt, der den gemessenen Zustand
// benennt — `42P01` (undefined_table) auf diesen Routen heisst „dieser Dienst
// führt keine Gruppen", und das ist **501 Not Implemented**. Ein
// Bereitsteller trägt 501 in seinen Sync-Bericht ein, statt es wie die leere
// Liste als Bestand zu verbuchen. Jeder andere Fehler geht an
// `withScimErrorHandler` weiter — ohne Treibertext.
//
// Sobald `user_group` existiert, arbeiten diese Handler ohne weitere
// Änderung; der 501-Zweig wird dann nie mehr betreten. Die Migration selbst
// liegt in `packages/db` und damit ausserhalb der Dateihoheit dieser Welle.

import { db, scimSyncLog, runWithRequestContext } from "@grc/db";
import { sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { buildScimError } from "@grc/auth/scim";
import { scimCreateGroupSchema } from "@grc/shared";
// Siehe `apps/web/src/lib/api-scim.ts`: `withErrorHandler` waere hier falsch,
// weil er auf `application/problem+json` normalisiert und ein
// SCIM-Bereitsteller nach RFC 7644 §3.12 `application/scim+json` erwartet.
import {
  scimResponse,
  scimError,
  withScimErrorHandler,
  GROUPS_UNSUPPORTED_DETAIL,
} from "@/lib/api-scim";
import { log } from "@/lib/logger";

const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";

/**
 * SCIM-Antwort für den gemessenen Zustand „Gruppenablage fehlt".
 *
 * `42P01` ist Postgres' `undefined_table`. Auf DIESEN Routen kann er nur eine
 * Ursache haben, und die ist keine Störung, sondern eine fehlende Funktion —
 * deshalb 501 und nicht 500. Der Relationsname steht im Log, nicht im Rumpf.
 */
function groupStorageMissing(err: unknown, route: string): Response | null {
  if ((err as { code?: string }).code !== "42P01") return null;
  log.warn("scim groups: storage not provisioned", {
    route,
    message: (err as { message?: string }).message,
  });
  return scimError(GROUPS_UNSUPPORTED_DETAIL, 501);
}

// GET /api/v1/scim/v2/Groups — List groups
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Zeilenformen der rohen
// SCIM-Abfragen, aus ihren SELECT-Listen benannt.
type GroupRow = {
  id: string;
  name: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export const GET = withScimErrorHandler(async function GET(req: Request) {
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

        const resources = (groups as unknown as GroupRow[]).map((g) => ({
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
      } catch (err) {
        // [Welle 4b-7 · OP-079] Hier stand `catch { … Resources: [] }` — eine
        // leere Liste als Antwort auf einen Schemafehler.
        const missing = groupStorageMissing(err, "GET /api/v1/scim/v2/Groups");
        if (missing) return missing;
        throw err;
      }
    },
  );
}, "GET /api/v1/scim/v2/Groups");

// POST /api/v1/scim/v2/Groups — Create group
export const POST = withScimErrorHandler(async function POST(req: Request) {
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
    `)) as unknown as GroupRow[];

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
        // [Welle 4b-7 · OP-079] Hier stand `buildScimError(err.message, 500)`.
        const missing = groupStorageMissing(err, "POST /api/v1/scim/v2/Groups");
        if (missing) return missing;
        throw err;
      }
    },
  );
}, "POST /api/v1/scim/v2/Groups");
