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

import {
  db,
  user,
  userOrganizationRole,
  scimSyncLog,
  runWithRequestContext,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import {
  scimToArctosUser,
  arctosToScimUser,
  buildScimListResponse,
  buildScimError,
} from "@grc/auth/scim";
import { parseScimFilter } from "@grc/auth/scim";
import { getBaseUrl } from "@/lib/base-url";
import { scimCreateUserSchema } from "@grc/shared";

const SCIM_CONTENT_TYPE = "application/scim+json";

function scimResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

// GET /api/v1/scim/v2/Users — List users (SCIM)
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Zeilenform der rohen
// SCIM-Abfrage, aus ihrer SELECT-Liste benannt.
type ScimUserRow = {
  id: string;
  email: string;
  // `user.name`, `user.is_active`, `created_at` und `updated_at` sind in
  // `packages/db/src/schema/platform.ts` NOT NULL; nur `external_id` nicht.
  name: string;
  external_id: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

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
      const filterStr = url.searchParams.get("filter");

      const baseUrl = getBaseUrl();

      // Build filter conditions
      let filterCondition = sql`1=1`;
      if (filterStr) {
        const filter = parseScimFilter(filterStr);
        if (filter) {
          if (
            filter.attribute === "userName" ||
            filter.attribute === "emails.value"
          ) {
            if (filter.operator === "eq") {
              filterCondition = sql`u.email = ${filter.value}`;
            } else if (filter.operator === "co") {
              filterCondition = sql`u.email ILIKE ${"%" + filter.value + "%"}`;
            } else if (filter.operator === "sw") {
              filterCondition = sql`u.email ILIKE ${filter.value + "%"}`;
            }
          } else if (
            filter.attribute === "externalId" &&
            filter.operator === "eq"
          ) {
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

      const resources = (items as unknown as ScimUserRow[]).map((row) =>
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

      return scimResponse(
        buildScimListResponse(resources, total, startIndex, count),
      );
    },
  );
}

// POST /api/v1/scim/v2/Users — Create user (SCIM)
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
      const parsed = scimCreateUserSchema.safeParse(body);
      if (!parsed.success) {
        return scimResponse(
          buildScimError(`Invalid SCIM payload: ${parsed.error.message}`, 400),
          400,
        );
      }

      const baseUrl = getBaseUrl();

      try {
        // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Hier stand
        // `parsed.data as any`. Die Zusicherung verdeckte einen echten
        // Formunterschied: `scimCreateUserSchema` fuehrt `emails` als
        // optional und `type`/`primary` je Eintrag als optional, waehrend
        // `ScimUser` beide verlangt. Statt die Pruefung abzuschalten wird
        // die Luecke hier geschlossen — mit den Vorgaben aus RFC 7643 §2.4
        // (`primary` fehlt = false) und ohne einen `type` zu erfinden.
        const arctosUser = scimToArctosUser({
          ...parsed.data,
          emails: (parsed.data.emails ?? []).map((e) => ({
            value: e.value,
            type: e.type ?? "",
            primary: e.primary === true,
          })),
          groups: parsed.data.groups?.map((g) => ({
            value: g.value,
            display: g.display ?? "",
          })),
        });

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
        const message =
          err instanceof Error ? err.message : "SCIM user creation failed";

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
    },
  );
}
