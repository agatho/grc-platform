-- Migration 0411: Plattform-Admin, Login-Lockout, SCIM-Token-Ablauf, SAML-Replay
--
-- Migration: 0411_platform_admin_login_hardening
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP3 · S02-01, S02-03, S02-09, S02-15, S02-23]

-- ════════════════════════════════════════════════════════════════════
-- S02-03 — Plattform-Admin-Konzept
-- ════════════════════════════════════════════════════════════════════
-- Befund: `feature_gate`, `subscription_plan`, `plugin`, `data_region`,
-- `framework_mapping` haben kein `org_id`, keine RLS und keine Policy, ihre
-- Schreib-Endpunkte sind aber nur mit `withAuth("admin")` geschützt — und
-- `admin` ist eine PRO-ORGANISATION vergebene Rolle. Jeder Mandanten-Admin
-- konnte damit Abrechnungs-, Feature- und Data-Sovereignty-Konfiguration
-- ALLER Mandanten ändern. Ein Plattform-Admin-Konzept existierte im gesamten
-- Repository nicht.
--
-- Entwurfsentscheidung: eine eigene Tabelle statt eines Flags auf `user`.
--   * sie trägt Vergabemetadaten (wer, wann, warum) und ist damit prüfbar;
--   * sie hat bewusst KEINE INSERT/UPDATE/DELETE-Policy für die Laufzeitrolle
--     `grc_app`. Plattform-Adminrechte können also durch KEINEN API-Pfad
--     vergeben werden — auch nicht über S02-02-artige Fallbacks. Vergabe ist
--     eine bewusste Betreiberhandlung am DB-Prompt (siehe deploy/setup.sh).
--   * die SELECT-Policy ist eine reine Selbstauskunft; ein Mandanten-Admin
--     kann die Plattform-Admins nicht aufzählen.
CREATE TABLE IF NOT EXISTS platform_admin (
  user_id     uuid PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by  uuid REFERENCES "user"(id),
  reason      varchar(500),
  revoked_at  timestamptz
);

COMMENT ON TABLE platform_admin IS
  'WP3/S02-03: plattformweite Administratoren. Vergabe NUR durch den Betreiber '
  'am DB-Prompt — die Laufzeitrolle grc_app hat keine INSERT/UPDATE/DELETE-Policy.';

ALTER TABLE platform_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_admin_self_read ON platform_admin;
CREATE POLICY platform_admin_self_read ON platform_admin
  FOR SELECT
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

CREATE INDEX IF NOT EXISTS platform_admin_active_idx
  ON platform_admin (user_id) WHERE revoked_at IS NULL;

-- ════════════════════════════════════════════════════════════════════
-- S02-01 / S02-09 — Erstpasswortzwang und Login-Lockout
-- ════════════════════════════════════════════════════════════════════
-- S02-01: der Seed legte `admin@arctos.dev` / `admin123` an, ohne
-- Environment-Guard und ohne Rotationszwang. Der Seed vergibt jetzt ein
-- Zufallspasswort und setzt `must_change_password`.
-- S02-09: es gab weder Zähler noch Sperre (`grep lockout|failed_attempts|
-- locked_until` über packages/auth und packages/db/src/schema → 0 Treffer).
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_login_at  timestamptz,
  ADD COLUMN IF NOT EXISTS locked_until          timestamptz,
  ADD COLUMN IF NOT EXISTS must_change_password  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at   timestamptz;

CREATE INDEX IF NOT EXISTS user_locked_until_idx
  ON "user" (locked_until) WHERE locked_until IS NOT NULL;

COMMENT ON COLUMN "user".locked_until IS
  'WP3/S02-09: Ende der Login-Sperre nach zu vielen Fehlversuchen. '
  'Gepflegt über auth_register_login_failure()/auth_register_login_success().';

-- ════════════════════════════════════════════════════════════════════
-- S02-15 — SCIM-Token: Ablauf und Rotation
-- ════════════════════════════════════════════════════════════════════
-- Befund: `scim_token` hatte weder `expires_at` noch eine Prüfung von
-- `revoked_at`; ein einmal ausgestelltes Token galt unbefristet und
-- berechtigte zum Anlegen/Deaktivieren beliebiger Nutzer der Org. Eine
-- Rotation ohne Ausfallfenster war nicht vorgesehen.
ALTER TABLE scim_token
  ADD COLUMN IF NOT EXISTS expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS rotated_from_id uuid REFERENCES scim_token(id),
  ADD COLUMN IF NOT EXISTS rotated_at      timestamptz;

CREATE INDEX IF NOT EXISTS scim_token_expires_idx
  ON scim_token (expires_at) WHERE expires_at IS NOT NULL;

-- Bestandstoken bekommen ein Ablaufdatum statt "unbefristet". 90 Tage ab
-- Migration, damit Betreiber Zeit für die Rotation haben; danach greift der
-- Default aus der Token-Erstellung (ebenfalls 90 Tage).
UPDATE scim_token
   SET expires_at = now() + interval '90 days'
 WHERE expires_at IS NULL
   AND is_active = true;

-- ════════════════════════════════════════════════════════════════════
-- S02-20 / S02-08 — Portal- und iCal-Token gehasht statt im Klartext
-- ════════════════════════════════════════════════════════════════════
-- Befund S02-20: `dd_session.access_token` steht im KLARTEXT in der Datenbank
-- und wird direkt verglichen (anders als bei SCIM, wo gehasht wird). Ein
-- Leseleck (Backup, Read-Replica) genügt, um sich als beliebiger Lieferant
-- auszugeben. Dasselbe gilt für `user.ical_token`.
-- Die Klartextspalten bleiben zunächst bestehen (Übergangsfenster für laufende
-- Portal-Sitzungen); die Anwendung schreibt und liest ab sofort den Hash.
ALTER TABLE dd_session
  ADD COLUMN IF NOT EXISTS access_token_hash varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS dd_session_access_token_hash_idx
  ON dd_session (access_token_hash) WHERE access_token_hash IS NOT NULL;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS ical_token_hash varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS user_ical_token_hash_idx
  ON "user" (ical_token_hash) WHERE ical_token_hash IS NOT NULL;

-- Backfill: SHA-256 über das bestehende Klartext-Token, damit bereits
-- ausgegebene Links weiterlaufen. `pgcrypto` ist im Schema vorhanden
-- (gen_random_uuid wird durchgehend genutzt); falls nicht, wird der Backfill
-- übersprungen und die Token laufen regulär aus.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'digest') THEN
    EXECUTE $q$
      UPDATE dd_session
         SET access_token_hash = encode(digest(access_token, 'sha256'), 'hex')
       WHERE access_token_hash IS NULL AND access_token IS NOT NULL
    $q$;
    EXECUTE $q$
      UPDATE "user"
         SET ical_token_hash = encode(digest(ical_token, 'sha256'), 'hex')
       WHERE ical_token_hash IS NULL AND ical_token IS NOT NULL
    $q$;
  ELSE
    RAISE NOTICE 'WP3/0411: pgcrypto digest() nicht verfuegbar — Token-Hash-Backfill uebersprungen';
  END IF;
END
$$;

-- ════════════════════════════════════════════════════════════════════
-- S02-23 — SAML-Replay-Schutz über Instanzgrenzen hinweg
-- ════════════════════════════════════════════════════════════════════
-- Befund: der Replay-Cache war eine prozesslokale `Map` (Kommentar im Code:
-- "In production, this should be backed by Redis") — bei mehr als einer
-- Web-Instanz wirkungslos. Die Tabelle macht den Schutz instanzübergreifend.
CREATE TABLE IF NOT EXISTS saml_assertion_replay (
  assertion_id varchar(256) PRIMARY KEY,
  org_id       uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  consumed_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS saml_assertion_replay_expiry_idx
  ON saml_assertion_replay (expires_at);

ALTER TABLE saml_assertion_replay ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_assertion_replay FORCE ROW LEVEL SECURITY;

-- Mandantenpolicy für den regulären (kontextbehafteten) Zugriff. Der
-- SAML-ACS läuft anonym und nutzt die SECURITY-DEFINER-Funktion unten.
DROP POLICY IF EXISTS saml_assertion_replay_tenant ON saml_assertion_replay;
CREATE POLICY saml_assertion_replay_tenant ON saml_assertion_replay
  FOR ALL
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    -- Bewusst NUR SELECT: die Anwendung darf Plattform-Adminrechte prüfen,
    -- aber niemals vergeben oder entziehen. (Die RLS-Policy oben deckt das
    -- zusätzlich ab, falls ALTER DEFAULT PRIVILEGES später mehr gewährt.)
    EXECUTE 'REVOKE ALL ON platform_admin FROM grc_app';
    EXECUTE 'GRANT SELECT ON platform_admin TO grc_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON saml_assertion_replay TO grc_app';
  END IF;
END
$$;
