-- 0425_pii_pseudonym_key.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · Grundlage für S07-02, S07-03, S07-08
--
-- Drei Pseudonymisierungen des Produkts folgen demselben defekten Muster:
--
--   wb_report.ip_hash        sha256(ip)                       — ungesalzen
--   whistleblowing_audit_log.actor_hash
--                            sha256(user_id || '|' || case_id) — Salt = Nachbarspalte
--   audit_log (Tombstone)    sha256(pii   || '|' || entry_hash) — Salt = Nachbarspalte
--
-- Gemeinsam ist: das gehashte Merkmal hat einen kleinen Wertebereich
-- (2^32 IPv4-Adressen, 10^2..10^4 Nutzer je Mandant, die Namensliste einer
-- Firma) und der Salt steht dem Leser in derselben Zeile zur Verfügung.
-- Der Auditor hat alle drei per SQL in Sekunden zurückgerechnet
-- (evidence/S07-repro-wb-audit-leak.sql, S07-repro-tombstone-reversal.sql).
-- Nach Art. 4 Nr. 5 DSGVO ist das keine Pseudonymisierung, weil die
-- "zusätzlichen Informationen" nicht gesondert aufbewahrt werden.
--
-- Diese Migration stellt die fehlende "zusätzliche Information" bereit:
-- einen Schlüssel, der NICHT neben den Daten liegt. Sie folgt dem von WP4
-- mit `AUDIT_SEAL_KEY` etablierten Muster (Migration 0403):
--
--   1. Bevorzugt wird der Schlüssel je Sitzung aus der Prozessumgebung
--      gesetzt (`app.pii_pseudonym_key`, gespeist aus PII_PSEUDONYM_KEY).
--      Dann liegt er vollständig außerhalb der Datenbank — auch ein
--      Datenbank-Dump enthält ihn nicht.
--   2. Ist er nicht gesetzt, greift ein bei der Migration erzeugter
--      Installationsschlüssel in `pii_pseudonym_key`. Diese Tabelle ist
--      deny-all (RLS + FORCE, keine Grants); keine Anwendungsrolle kann sie
--      lesen, auch nicht die Meldestellen-Rollen, die den `actor_hash`
--      lesen dürfen. Damit ist der reproduzierte Angriff — Leser des Logs
--      rechnet den Hash zurück — auch ohne Umgebungsvariable geschlossen.
--   3. Welcher Weg benutzt wurde, ist an `key_id` sichtbar
--      (`env:<id>` bzw. `db-local`), analog zu WP4s `seal_key_id`.
--
-- Zusätzlich das, was ADR-011 rev.2 §103 voraussetzt und was es bisher
-- nicht gab: eine Schlüsselvernichtung. `pii_pseudonym_key_destroy()`
-- überschreibt das Schlüsselmaterial unwiderruflich. Danach ist aus keinem
-- Pseudonym mehr auf die Person zu schließen — das ist der Schritt, der aus
-- der Pseudonymisierung im Audit-Trail eine Löschung im Sinne von Art. 17
-- macht (siehe docs/compliance/gdpr-erasure-vs-immutability.md).

CREATE TABLE IF NOT EXISTS pii_pseudonym_key (
  key_id        text PRIMARY KEY,
  key_material  bytea,
  purpose       text        NOT NULL DEFAULT 'pii-pseudonymisation',
  created_at    timestamptz NOT NULL DEFAULT now(),
  destroyed_at  timestamptz,
  destroy_reason text
);

COMMENT ON TABLE pii_pseudonym_key IS
  'S07-02/-03/-08: Schlüsselmaterial für die HMAC-Pseudonymisierung. Deny-all — keine Anwendungsrolle liest hier. Bevorzugt wird app.pii_pseudonym_key aus der Prozessumgebung; diese Tabelle ist der Rückfall, damit eine Installation ohne gesetzte Variable nicht auf ungesalzene Hashes zurückfällt.';

ALTER TABLE pii_pseudonym_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_pseudonym_key FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pii_pseudonym_key_deny_all ON pii_pseudonym_key;
CREATE POLICY pii_pseudonym_key_deny_all ON pii_pseudonym_key
  USING (false) WITH CHECK (false);

REVOKE ALL ON pii_pseudonym_key FROM PUBLIC;

DO $seed$
BEGIN
  INSERT INTO pii_pseudonym_key (key_id, key_material)
  VALUES ('db-local', gen_random_bytes(32))
  ON CONFLICT (key_id) DO NOTHING;
END
$seed$;

-- ── Schlüsselauflösung ────────────────────────────────────────────────
-- SECURITY DEFINER, weil die Tabelle deny-all ist. Der Rückgabewert ist
-- NIE das Schlüsselmaterial selbst, sondern immer nur ein HMAC darüber —
-- deshalb gibt es bewusst keine Funktion, die den Schlüssel herausgibt.

CREATE OR REPLACE FUNCTION pii_pseudonym_key_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.pii_pseudonym_key', true), '') IS NOT NULL
      THEN 'env:' || COALESCE(
             NULLIF(current_setting('app.pii_pseudonym_key_id', true), ''), 'default')
    WHEN EXISTS (SELECT 1 FROM pii_pseudonym_key
                  WHERE key_id = 'db-local' AND key_material IS NOT NULL)
      THEN 'db-local'
    ELSE 'destroyed'
  END;
$$;

COMMENT ON FUNCTION pii_pseudonym_key_id() IS
  'S07-02/-03/-08: Kennung des aktuell wirksamen Pseudonymisierungsschlüssels. "destroyed" heißt: kein Schlüssel mehr vorhanden, bestehende Pseudonyme sind endgültig nicht mehr auflösbar.';

CREATE OR REPLACE FUNCTION pii_hmac(p_value text, p_domain text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_env text := NULLIF(current_setting('app.pii_pseudonym_key', true), '');
  v_key bytea;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_env IS NOT NULL THEN
    -- Hex bevorzugt (wie AUDIT_SEAL_KEY / WB_ENCRYPTION_KEY); alles andere
    -- wird als Rohtext genommen, damit eine Fehlkonfiguration nicht still
    -- auf einen leeren Schlüssel zurückfällt.
    BEGIN
      v_key := decode(v_env, 'hex');
    EXCEPTION WHEN others THEN
      v_key := convert_to(v_env, 'UTF8');
    END;
  ELSE
    SELECT key_material INTO v_key
      FROM pii_pseudonym_key
     WHERE key_id = 'db-local';
  END IF;

  IF v_key IS NULL OR length(v_key) = 0 THEN
    -- Schlüssel vernichtet (Art. 17 abgeschlossen) oder nie erzeugt. Es
    -- gibt dann bewusst KEIN verwertbares Pseudonym mehr; ein zufälliger
    -- Wert ist die einzige Antwort, die nicht heimlich auf einen
    -- ungesalzenen Hash zurückfällt.
    RETURN encode(gen_random_bytes(32), 'hex');
  END IF;

  RETURN encode(
    hmac(convert_to(COALESCE(p_domain, '') || '|' || p_value, 'UTF8'), v_key, 'sha256'),
    'hex');
END;
$$;

COMMENT ON FUNCTION pii_hmac(text, text) IS
  'S07-02/-03/-08: HMAC-SHA256 über einen Personenbezug unter einem Schlüssel, der nicht neben den Daten liegt. p_domain trennt die Einsatzzwecke (actor, audit_email, …), damit ein Pseudonym nicht über Kontexte hinweg verknüpfbar ist.';

CREATE OR REPLACE FUNCTION pii_pseudonym_key_destroy(p_key_id text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE pii_pseudonym_key
     SET key_material   = NULL,
         destroyed_at   = COALESCE(destroyed_at, now()),
         destroy_reason = COALESCE(destroy_reason, p_reason)
   WHERE key_id = p_key_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown pseudonymisation key %', p_key_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION pii_pseudonym_key_destroy(text, text) IS
  'ADR-011 rev.2 §103: Schlüsselvernichtung. Danach ist kein bestehendes Pseudonym mehr auf eine Person zurückführbar. Irreversibel und bewusst nicht über eine API erreichbar.';

REVOKE ALL ON FUNCTION pii_pseudonym_key_id()               FROM PUBLIC;
REVOKE ALL ON FUNCTION pii_hmac(text, text)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION pii_pseudonym_key_destroy(text, text) FROM PUBLIC;

DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT EXECUTE ON FUNCTION pii_pseudonym_key_id()        TO grc_app;
    GRANT EXECUTE ON FUNCTION pii_hmac(text, text)          TO grc_app;
    -- pii_pseudonym_key_destroy bewusst NICHT an grc_app: die
    -- Schlüsselvernichtung ist ein betrieblicher, kein Anwendungsvorgang.
  END IF;
END
$grants$;
