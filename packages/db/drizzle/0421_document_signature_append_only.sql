-- Migration 0421: document_signature wird tatsächlich append-only
--
-- Migration: 0421_document_signature_append_only
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP7 · S06-16]
--
-- Migration 0375 kommentiert die Spalte als „Glied der Append-Only-Kette pro
-- Request". Es existierte weder ein UPDATE/DELETE-blockierender Trigger noch
-- eine Rule noch ein REVOKE. Die Applikation BRAUCHT UPDATE (`sign()` füllt
-- den pending-Slot), das Recht war also zwingend vorhanden — und da die Kette
-- ungeschlüsselt ist, konnte jeder mit diesem Recht eine Zeremonie beliebig
-- umschreiben und die Kette komplett neu rechnen.
--
-- Der Guard macht die Zusage wahr, ohne den Anwendungsfall zu brechen:
--   * ein Slot mit content_hash IS NULL (pending) darf beliebig aktualisiert
--     werden — das ist der einzige Schreibvorgang, den `sign()` / `decline()`
--     ausführen;
--   * sobald content_hash gesetzt ist, sind die beweisführenden Spalten
--     eingefroren: jede Änderung an signer_user_id, sign_order, status,
--     signed_at, decline_reason, ip_address, user_agent, content_hash,
--     previous_chain_hash, chain_hash, hash_version wird abgewiesen;
--   * DELETE ist auf entschiedenen Gliedern verboten, SOLANGE die
--     zugehörige Anforderung noch existiert. Wird die ganze Zeremonie
--     entfernt — DSGVO-Löschung des Dokuments, Retention-Purge —, läuft
--     das über ON DELETE CASCADE von `document` über
--     `document_signature_request` auf `document_signature`; PostgreSQL
--     löscht die Elternzeile zuerst, sodass der Trigger den Kaskadenpfad
--     daran erkennt, dass die Anforderung in dieser Transaktion nicht mehr
--     sichtbar ist. Das braucht keine Mitwirkung der Aufrufer und schließt
--     insbesondere `apps/worker/src/crons/document-retention-purge.ts`
--     (fremde Hoheit) ein. Zusätzlich gibt es `app.dms_signature_purge`
--     als ausdrückliche Freigabe für einen gezielten Einzellöschpfad.
--
-- ENABLE ALWAYS: wirkt auch unter session_replication_role = 'replica'
-- (Muster aus 0401/WP4).
--
-- Die Kette bleibt ungeschlüsselt; die eigentliche Tamper-Evidence ist
-- weiterhin der verankerte audit_log. Dieser Guard schließt die Lücke
-- zwischen dem, was 0375 behauptet, und dem, was durchgesetzt wird.

CREATE OR REPLACE FUNCTION document_signature_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_purge text := current_setting('app.dms_signature_purge', true);
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Erlaubt im ausdrücklich markierten Lösch-/Retention-Pfad.
    IF v_purge = OLD.request_id::text OR v_purge = 'all' THEN
      RETURN OLD;
    END IF;
    IF OLD.content_hash IS NULL THEN
      -- Unentschiedener Slot (z. B. stornierte Anforderung) — unkritisch.
      RETURN OLD;
    END IF;
    -- Kaskade: die Anforderung selbst ist bereits weg → die ganze
    -- Zeremonie wird entfernt, nicht ein einzelnes Glied herausgeschnitten.
    IF NOT EXISTS (
      SELECT 1 FROM document_signature_request WHERE id = OLD.request_id
    ) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION
      'document_signature ist append-only: das entschiedene Kettenglied % darf nicht geloescht werden (S06-16)',
      OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- UPDATE
  IF OLD.content_hash IS NULL THEN
    RETURN NEW;  -- pending → decided: der einzige legitime Schreibvorgang
  END IF;

  IF NEW.signer_user_id     IS DISTINCT FROM OLD.signer_user_id
     OR NEW.sign_order          IS DISTINCT FROM OLD.sign_order
     OR NEW.status             IS DISTINCT FROM OLD.status
     OR NEW.signed_at          IS DISTINCT FROM OLD.signed_at
     OR NEW.decline_reason     IS DISTINCT FROM OLD.decline_reason
     OR NEW.ip_address         IS DISTINCT FROM OLD.ip_address
     OR NEW.user_agent         IS DISTINCT FROM OLD.user_agent
     OR NEW.content_hash       IS DISTINCT FROM OLD.content_hash
     OR NEW.previous_chain_hash IS DISTINCT FROM OLD.previous_chain_hash
     OR NEW.chain_hash         IS DISTINCT FROM OLD.chain_hash
     OR NEW.hash_version       IS DISTINCT FROM OLD.hash_version
     OR NEW.request_id         IS DISTINCT FROM OLD.request_id
     OR NEW.org_id             IS DISTINCT FROM OLD.org_id
  THEN
    RAISE EXCEPTION
      'document_signature ist append-only: das entschiedene Kettenglied % darf nicht veraendert werden (S06-16)',
      OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_signature_append_only_trg ON document_signature;
CREATE TRIGGER document_signature_append_only_trg
  BEFORE UPDATE OR DELETE ON document_signature
  FOR EACH ROW EXECUTE FUNCTION document_signature_append_only();
ALTER TABLE document_signature
  ENABLE ALWAYS TRIGGER document_signature_append_only_trg;

COMMENT ON FUNCTION document_signature_append_only() IS
  'S06-16: setzt die Append-Only-Zusage aus 0375 durch. Entschiedene Glieder sind gegen UPDATE und DELETE gesperrt; der pending→decided-Uebergang bleibt erlaubt.';
