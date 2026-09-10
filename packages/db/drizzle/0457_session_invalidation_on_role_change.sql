-- Migration 0457: Session-Invalidierung beim Rollenentzug
--
-- Migration: 0457_session_invalidation_on_role_change
-- Breaking: no
-- Estimated-Duration: 2
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-085]  (WP2/S01-22, an WP3 uebergeben)
--
-- Befund: „nach Entzug einer Mitgliedschaft behaelt das JWT die Rolle bis zum
-- naechsten Refresh, und RLS kennt nur den GUC, nicht die Mitgliedschaft."
--
-- Was seither GESCHEHEN ist und was NICHT:
--
--   * S12-17 hat `fetchFreshRoles` eingefuehrt (apps/web/src/auth.ts). Der
--     `session`-Callback liest die Rollen bei JEDEM `auth()`-Aufruf frisch aus
--     der Datenbank. `withAuth` entscheidet also bereits auf dem aktuellen
--     Stand — fuer den API-Verkehr ist der Entzug damit sofort wirksam.
--   * NICHT geschehen ist die Invalidierung selbst. Die JWT-Kopie der Rollen
--     (`token.roles`) wird nur bei `trigger === "update"` neu geladen, also nur
--     nach einem ausdruecklichen `session.update()` im Client. Der rollierende
--     Refresh (`updateAge`, 15 min) ruft den Callback OHNE Trigger auf und
--     laesst die Kopie stehen. Der Kommentar in `packages/auth/src/config.ts`
--     behauptete das Gegenteil („updateAge … is what makes the freshly read
--     roles propagate into the JWT copy the middleware sees") — die
--     Edge-Middleware entscheidet ihr HinSchG-Gatter und ihre Modulsicht
--     weiterhin auf einer bis zu zwei Stunden alten Kopie.
--   * Und es gibt keinen Weg, eine ausgestellte Sitzung ZU BEENDEN. Ein
--     entzogener Zugang bleibt eine gueltige Anmeldung, bis das Konto
--     deaktiviert wird — was etwas anderes ist und andere Folgen hat.
--
-- Diese Migration liefert die fehlende Haelfte: eine Epoche je Nutzer.
--
--   `user.sessions_valid_from` — jedes JWT, das VOR diesem Zeitpunkt
--   ausgestellt wurde, gilt als ungueltig. Die Pruefung ist ein Vergleich
--   gegen `iat` und kostet keinen zusaetzlichen Rundlauf: der `session`-
--   Callback liest die Zeile ohnehin (S12-17).
--
-- Warum eine Epoche und keine Denylist: die JWT-Strategie hat keinen
-- serverseitigen Sitzungsspeicher. Eine Denylist muesste jede ausgestellte
-- Kennung fuehren; eine Epoche ist EIN Zeitstempel je Nutzer und invalidiert
-- alles Aeltere auf einen Schlag — genau die Semantik von „Rechte entzogen,
-- bitte neu anmelden". Sie ist ausserdem selbstraeumend: nach Ablauf der
-- maximalen Sitzungsdauer (2 h, config.ts) ist der Wert wirkungslos.

ALTER TABLE public."user"
  ADD COLUMN IF NOT EXISTS sessions_valid_from timestamptz;

COMMENT ON COLUMN public."user".sessions_valid_from IS
  'OP-085: Sitzungs-Epoche. Ein JWT mit iat < diesem Wert wird abgelehnt. '
  'Gesetzt bei Rollenvergabe/-entzug ueber auth_invalidate_user_sessions().';

-- ── Auslesen ────────────────────────────────────────────────────────
-- Der `session`-Callback laeuft im NextAuth-Handler, nicht in `withAuth`, und
-- hat deshalb keinen Request-Kontext. Er liest die Rollen ueber
-- `withUserReadContext` (setzt `app.current_user_id`), und mit dem gesetzten
-- Nutzer-GUC greift die `user`-Policy `id = <uid>` — die Spalte ist also ueber
-- den normalen Weg lesbar und braucht keine eigene Kapsel.
--
-- ── Setzen ──────────────────────────────────────────────────────────
-- Das Setzen dagegen schon: der Administrator, der eine Rolle entzieht, ist
-- ein ANDERER Nutzer als der Betroffene, und `user_tenant_update` erlaubt ihm
-- die fremde Zeile nur, solange der Betroffene noch Mitglied seiner Org ist.
-- Genau das ist beim Entzug der letzten Rolle nicht mehr der Fall — die
-- Reihenfolge (erst entziehen, dann invalidieren) wuerde am eigenen Fix
-- scheitern. Deshalb eine eng gefasste Kapsel.
--
-- Sie kann NUR diesen einen Zeitstempel setzen, nur auf `now()`, und sie
-- verlangt, dass Aufrufer und Betroffener eine gemeinsame Organisation haben
-- (auch eine gerade beendete: `deleted_at` wird bewusst NICHT gefiltert, sonst
-- liesse sich der eigene Entzug nicht mehr durchsetzen). Ein Administrator
-- kann damit niemanden ausserhalb seines Mandanten aussperren.
CREATE OR REPLACE FUNCTION public.auth_invalidate_user_sessions(
  p_user_id uuid, p_actor_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'OP-085: user_id und actor_id sind Pflicht';
  END IF;

  -- Selbstinvalidierung (Passwortwechsel, „ueberall abmelden") ist immer
  -- erlaubt. Fuer fremde Zeilen: gemeinsame Organisation erforderlich.
  IF p_user_id <> p_actor_id AND NOT EXISTS (
       SELECT 1
         FROM public.user_organization_role a
         JOIN public.user_organization_role b ON b.org_id = a.org_id
        WHERE a.user_id = p_actor_id
          AND a.deleted_at IS NULL
          AND b.user_id = p_user_id
     ) THEN
    RAISE EXCEPTION
      'OP-085: % darf die Sitzungen von % nicht beenden (keine gemeinsame Organisation)',
      p_actor_id, p_user_id;
  END IF;

  UPDATE public."user"
     SET sessions_valid_from = v_now
   WHERE id = p_user_id;

  RETURN v_now;
END;
$$;

COMMENT ON FUNCTION public.auth_invalidate_user_sessions(uuid, uuid) IS
  'OP-085: setzt user.sessions_valid_from = now(). Jedes aeltere JWT wird '
  'beim naechsten session-Callback abgelehnt. Nur innerhalb einer gemeinsamen '
  'Organisation oder auf die eigene Zeile.';

-- ── Rechtevergabe (S01-13-Muster) ───────────────────────────────────
DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.auth_invalidate_user_sessions(uuid, uuid) FROM PUBLIC';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.auth_invalidate_user_sessions(uuid, uuid) TO grc_app';
  END IF;
END
$$;

-- ── Endzustand pruefen ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user'
       AND column_name = 'sessions_valid_from'
  ) THEN
    RAISE EXCEPTION 'OP-085: Spalte user.sessions_valid_from fehlt';
  END IF;
  IF to_regprocedure('public.auth_invalidate_user_sessions(uuid, uuid)') IS NULL THEN
    RAISE EXCEPTION 'OP-085: auth_invalidate_user_sessions fehlt';
  END IF;
  RAISE NOTICE 'OP-085: Sitzungs-Epoche und Invalidierungskapsel angelegt';
END
$$;
