/**
 * `GET|PUT /api/v1/processes/:id/diagram-overlay/preference` — das Gedächtnis
 * der Sichtwahl.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-003] `user_diagram_preference` steht seit
 * Migration 0452 und wurde von **niemandem** geschrieben; `GrcViewSelect` hielt
 * seine Wahl in einem React-`useState`. Nachgemessen: außerhalb der
 * Schemadatei gab es im ganzen Repository keine einzige Referenz auf die
 * Tabelle. Bei neun Sichten und zwölf Rollenvoreinstellungen ist das der
 * Unterschied zwischen einem Werkzeug und einer Vorführung — wer eine Sicht
 * einstellt, einen Prozess wechselt und zurückkommt, fängt wieder bei „aus" an.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-016] Dieselbe Zeile trägt seit Migration 0475
 * das gewählte **Rahmenwerk** der Sicht F8. Der Overlay-Endpunkt liest es und
 * gibt `diagram.framework` aus; damit hat der Auswahlparameter, den
 * `MISSING_TODAY` als „gehört an die Sichtwahl der Oberfläche" führte, dort
 * seine Heimat.
 *
 * **Warum der Bezugsraum `default` ist und nicht die Prozess-ID.** Der Kopf von
 * 0452 legt das ausdrücklich fest: `scope` ist bewusst ein freies Kürzel und
 * kein Fremdschlüssel auf einen einzelnen Prozess — „eine Voreinstellung, die
 * nur für genau ein Diagramm gilt, hilft niemandem, und ein Prozess, den jemand
 * löscht, dürfte keine Voreinstellung mitnehmen". Die Prozesskennung im Pfad
 * bestimmt deshalb **nur**, gegen welches Objekt die Berechtigung geprüft wird;
 * gespeichert wird je Nutzer und Mandant.
 *
 * **Warum ein Fehlschlag hier folgenlos bleiben muss.** Eine Anzeige-
 * voreinstellung ist kein Nachweis (0452, „Audit-Trigger: NEIN"). Wenn das
 * Speichern scheitert, darf die Diagrammfläche nicht stehenbleiben — der
 * Aufrufer in `grc-view-select.tsx` verschluckt Fehler deshalb bewusst und
 * arbeitet mit der Wahl im Zustand weiter.
 */

import { db } from "@grc/db";
import { toRows } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

/** Der Bezugsraum dieser Voreinstellung (0452 §3). */
const SCOPE = "default";

/**
 * Die neun Sichten, als Wertemenge.
 *
 * Bewusst hier wiederholt und nicht aus `@grc/bpmn/grc` importiert: ein
 * Wertimport zöge die gesamte GRC-Schicht in diese Route. Ein Test hält die
 * Liste gegen `GRC_VIEWS`, damit die Wiederholung nicht auseinanderläuft —
 * dieselbe Lösung wie in `components/bpmn/grc-view-select.tsx`.
 */
const VIEW_IDS = [
  "modeling",
  "risk-control",
  "compliance",
  "privacy",
  "continuity",
  "operations",
  "organization",
  "architecture",
  "responsibility",
] as const;

const bodySchema = z.object({
  /**
   * `null` heißt ausdrücklich **aus** — und wird auch so gespeichert. Ein
   * Ausschalten, das nicht gespeichert wird, wäre die unangenehmere Hälfte des
   * Befunds: die Sicht käme bei jedem Seitenaufruf ungefragt zurück.
   */
  activeView: z.enum(VIEW_IDS).nullable(),
  /** Rahmenwerkcode der Sicht F8; `null` = keine Auswahl. */
  frameworkCode: z.string().max(40).nullable().optional(),
});

interface PreferenceRow {
  readonly activeView: string | null;
  readonly frameworkCode: string | null;
}

/** Prüft Modul und Prozessbezug; liefert eine Antwort, wenn etwas fehlt. */
async function guard(
  req: Request,
  processId: string,
): Promise<Response | { orgId: string; userId: string }> {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const found = toRows(
    await db.execute(
      sql`SELECT id FROM process
          WHERE id = ${processId} AND org_id = ${ctx.orgId}
            AND deleted_at IS NULL
          LIMIT 1`,
    ),
  );
  if (found.length === 0) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }
  return { orgId: ctx.orgId, userId: ctx.userId };
}

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: processId } = await params;
  const gate = await guard(req, processId);
  if (gate instanceof Response) return gate;

  const rows = toRows(
    await db.execute(
      sql`SELECT active_view    AS "activeView",
                 framework_code AS "frameworkCode"
            FROM user_diagram_preference
           WHERE org_id = ${gate.orgId}
             AND user_id = ${gate.userId}
             AND scope = ${SCOPE}
           LIMIT 1`,
    ),
  ) as unknown as PreferenceRow[];

  const row = rows[0];
  return Response.json(
    {
      data: {
        // Keine gespeicherte Zeile heißt „noch nie etwas gewählt", nicht
        // „ausgeschaltet". Beides ist hier dasselbe sichtbare Ergebnis (`null`),
        // aber der Unterschied steht im Kommentar, damit niemand später aus dem
        // `null` eine Voreinstellung ableitet.
        activeView: row?.activeView ?? null,
        frameworkCode: row?.frameworkCode ?? null,
      },
    },
    // Nutzerabhängig und RLS-gefiltert: nie in einen geteilten Zwischenspeicher.
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: processId } = await params;
  const gate = await guard(req, processId);
  if (gate instanceof Response) return gate;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const activeView = parsed.data.activeView;
  // `undefined` (Feld nicht gesendet) und `null` (ausdrücklich abgewählt) sind
  // hier dasselbe: die Zeile trägt genau eine Rahmenwerkauswahl, und wer sie
  // nicht mitschickt, hat keine. Ein Zusammenführen mit dem Bestand wäre die
  // Sorte stiller Zustand, die man später nicht mehr erklären kann.
  const frameworkCode = parsed.data.frameworkCode ?? null;

  // Ein Upsert auf den vorhandenen eindeutigen Index (0452:
  // `udp_user_scope_uniq` über org_id, user_id, scope). Kein SELECT davor:
  // zwei Sichtwechsel kurz hintereinander würden sich sonst überholen.
  await db.execute(
    sql`INSERT INTO user_diagram_preference
          (org_id, user_id, scope, active_view, framework_code)
        VALUES (${gate.orgId}, ${gate.userId}, ${SCOPE},
                ${activeView}, ${frameworkCode})
        ON CONFLICT (org_id, user_id, scope) DO UPDATE
           SET active_view    = EXCLUDED.active_view,
               framework_code = EXCLUDED.framework_code,
               updated_at     = now()`,
  );

  return Response.json(
    { data: { activeView, frameworkCode } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
