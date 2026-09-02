-- 0466_webhook_signing_secret_registry.sql
--
-- Migration: 0466_webhook_signing_secret_registry
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-129]
--
-- `webhook_registration.secret_hash` traegt keinen Hash. Der Wert ist der
-- HMAC-SHA256-Schluessel der Webhook-Signatur und muss dem Empfaenger im
-- Klartext bekannt sein — ein geteiltes Geheimnis in einer Spalte, deren Name
-- das Gegenteil behauptet. Migration 0436 hat das per Spaltenkommentar
-- festgehalten und die Umbenennung nach `signing_secret` weitergereicht; sie
-- beruehrt packages/db, packages/events, apps/worker und apps/web/api
-- gleichzeitig und ist deshalb weiterhin offen (siehe
-- docs/UMSETZUNG-WELLE-1B.md, "Was an die folgenden Wellen weitergeht").
--
-- Diese Migration behebt nicht den Namen, sondern seine gefaehrlichste Folge.
-- Gemessen am laufenden Schema:
--
--   SELECT audit_key_is_secret('secret_hash');   -- t
--
-- Der Audit-Scrubber redigiert den Wert heute also — aber nur, WEIL im Namen
-- zufaellig "secret" steht. Die Absicherung haengt damit an genau der
-- Zeichenkette, die als irrefuehrend erkannt wurde. Eine Umbenennung nach
-- `hmac_key` — eine naheliegende Wahl — faellt aus der Heuristik heraus
-- (`audit_key_is_secret('hmac_key')` ist false), und der Schluessel stuende ab
-- diesem Moment im Klartext in `audit_log.changes`: in einer Tabelle, aus der
-- per Konstruktion nichts geloescht werden kann.
--
-- Ein Eintrag in `audit_sensitive_column` macht die Redaktion namensunabhaengig:
-- `audit_scrub_changes()` liest die Registry ZUSAETZLICH zur Heuristik. Damit
-- ist die Umbenennung ab jetzt gefahrlos — was ihre Voraussetzung ist, nicht
-- ihr Ersatz.
--
-- `entity_type` ist der Tabellenname (`TG_TABLE_NAME`), so wie `audit_trigger()`
-- ihn schreibt. Beide Namen sind eingetragen: der heutige und der geplante,
-- damit die Umbenennung keine Luecke von einer Migration Breite aufreisst.

DO $$ BEGIN
  IF to_regclass('public.audit_sensitive_column') IS NOT NULL THEN
    INSERT INTO audit_sensitive_column (entity_type, column_name, reason)
    VALUES
      ('webhook_registration', 'secret_hash',    'credential'),
      ('webhook_registration', 'secretHash',     'credential'),
      ('webhook_registration', 'signing_secret', 'credential'),
      ('webhook_registration', 'signingSecret',  'credential')
    ON CONFLICT (entity_type, column_name) DO NOTHING;
  END IF;
END $$;
