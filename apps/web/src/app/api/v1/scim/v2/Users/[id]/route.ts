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

import { db, user, scimSyncLog, runWithRequestContext } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { validateScimToken } from "@grc/auth/scim";
import { arctosToScimUser, buildScimError } from "@grc/auth/scim";
import { scimPatchOpSchema, scimReplaceUserSchema } from "@grc/shared";
import { getBaseUrl } from "@/lib/base-url";
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079/OP-084] Keiner der vier
// Handler dieser Datei hatte ein `try`. Eine Kennung, die keine UUID ist —
// beim Anschluss eines neuen Verzeichnisses der Normalfall, weil der
// Bereitsteller zunaechst seine EIGENE Kennung schickt — traf in der ersten
// Abfrage auf `u.id = $1` gegen eine `uuid`-Spalte und ergab
// `invalid input syntax for type uuid`. Ohne Fehlerpfad antwortete Next.js
// mit 500 und LEEREM Rumpf; der Bereitsteller protokollierte „unknown error"
// und wiederholte. Der SCIM-Wickel macht daraus ein 400 mit Begruendung.
// Siehe `apps/web/src/lib/api-scim.ts`, auch dazu, warum hier nicht
// `withErrorHandler` steht.
import { scimResponse, withScimErrorHandler } from "@/lib/api-scim";

// GET /api/v1/scim/v2/Users/:id — Get single user
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Zeilenformen der rohen
// SCIM-Abfragen, aus ihren SELECT-Listen benannt.
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
      const baseUrl = getBaseUrl();

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

      const row = (result as unknown as ScimUserRow[])[0];
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
    },
  );
}, "GET /api/v1/scim/v2/Users/[id]");

// PUT /api/v1/scim/v2/Users/:id — Replace user
export const PUT = withScimErrorHandler(async function PUT(
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
      const parsed = scimReplaceUserSchema.safeParse(body);
      if (!parsed.success) {
        return scimResponse(
          buildScimError(`Invalid SCIM payload: ${parsed.error.message}`, 400),
          400,
        );
      }

      const baseUrl = getBaseUrl();

      // Verify user belongs to org
      const [existing] = (await db.execute(sql`
    SELECT u.id FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as unknown as Array<Partial<ScimUserRow> & { id: string }>;

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
    },
  );
}, "PUT /api/v1/scim/v2/Users/[id]");

// PATCH /api/v1/scim/v2/Users/:id — Partial update (PatchOp)
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

      const baseUrl = getBaseUrl();

      // Verify user belongs to org
      const [existing] = (await db.execute(sql`
    SELECT u.id, u.email, u.name FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as unknown as Array<Partial<ScimUserRow> & { id: string }>;

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
    },
  );
}, "PATCH /api/v1/scim/v2/Users/[id]");

// DELETE /api/v1/scim/v2/Users/:id — Deactivate user (soft-delete, NOT hard delete)
export const DELETE = withScimErrorHandler(async function DELETE(
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

      // Verify user belongs to org
      const [existing] = (await db.execute(sql`
    SELECT u.id, u.email FROM "user" u
    JOIN user_organization_role uor ON uor.user_id = u.id
    WHERE u.id = ${id}
      AND uor.org_id = ${authCtx.orgId}
      AND uor.deleted_at IS NULL
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as unknown as Array<Partial<ScimUserRow> & { id: string }>;

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
    },
  );
}, "DELETE /api/v1/scim/v2/Users/[id]");
