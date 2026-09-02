import { db } from "@grc/db";
import { sql } from "drizzle-orm";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-085] Sitzungen eines Nutzers beenden.
 *
 * Befund (WP2/S01-22, an WP3 uebergeben): nach dem Entzug einer Mitgliedschaft
 * behielt das JWT die Rolle bis zum naechsten Refresh, und RLS kennt nur den
 * GUC, nicht die Mitgliedschaft.
 *
 * Was seither geschehen ist: S12-17 hat `fetchFreshRoles` eingefuehrt — der
 * `session`-Callback liest die Rollen bei jedem `auth()`-Aufruf frisch, der
 * API-Pfad entscheidet also bereits auf dem aktuellen Stand.
 *
 * Was NICHT geschehen war, und was diese Funktion nachtraegt:
 *
 *   1. Die JWT-Kopie der Rollen — das, worauf die Edge-Middleware ihr
 *      HinSchG-Gatter und ihre Modulsicht stuetzt — wurde nur bei einem
 *      ausdruecklichen `session.update()` aufgefrischt.
 *   2. Eine ausgestellte Sitzung liess sich ueberhaupt nicht beenden. Ein
 *      entzogener Zugang blieb eine gueltige Anmeldung, bis das KONTO
 *      deaktiviert wurde — was etwas anderes ist und andere Folgen hat.
 *
 * `auth_invalidate_user_sessions` (Migration 0457) setzt
 * `user.sessions_valid_from = now()`. Jedes Token mit aelterem `iat` faellt
 * beim naechsten `session`-Callback aus (apps/web/src/auth.ts), mit derselben
 * Wirkung wie ein deaktiviertes Konto: keine Rollen, kein Org-Kontext,
 * `withAuth` verweigert ab dem naechsten Request.
 *
 * Warum eine SECURITY-DEFINER-Kapsel und kein UPDATE an dieser Stelle: der
 * Administrator ist ein anderer Nutzer als der Betroffene, und
 * `user_tenant_update` erlaubt ihm die fremde Zeile nur, solange der Betroffene
 * Mitglied seiner Organisation ist. Beim Entzug der LETZTEN Rolle ist er das
 * nicht mehr — das UPDATE traefe also genau in dem Fall null Zeilen, fuer den
 * es gebaut ist. Die Kapsel prueft die gemeinsame Organisation selbst und
 * beruecksichtigt dabei auch bereits beendete Mitgliedschaften.
 *
 * Bewusst NICHT fatal: wenn wir hier ankommen, ist die Rollenaenderung gebucht
 * und auditiert. Schlaegt die Invalidierung fehl, ist der Zugriff trotzdem
 * entzogen (der `session`-Callback liest die Rollen frisch) — nur die
 * Middleware-Kopie lebt bis zu einer Minute laenger. Eine bereits erfolgte,
 * korrekte Aenderung an einem Nachlauf scheitern zu lassen, waere die
 * schlechtere Ausfallrichtung.
 */
export async function invalidateUserSessions(
  userId: string,
  actorId: string,
): Promise<void> {
  try {
    await db.execute(
      sql`SELECT public.auth_invalidate_user_sessions(${userId}::uuid, ${actorId}::uuid)`,
    );
  } catch (err) {
    console.error(
      "[OP-085] Sitzungs-Invalidierung fehlgeschlagen:",
      err instanceof Error ? err.message : err,
    );
  }
}
