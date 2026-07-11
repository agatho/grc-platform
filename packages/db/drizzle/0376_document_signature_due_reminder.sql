-- ============================================================================
-- Migration 0376: Signatur-Fristen-Erinnerung + Eskalation (W21-DMS-MULTISIGN-02)
--
-- Kontext (2026-07-11): Der Worker-Cron `signature-due-reminder`
-- (apps/worker/src/crons/signature-due-reminder.ts) erinnert ausstehende
-- Signer gestaffelt (3 Tage vor Frist / am Fälligkeitstag — Muster
-- document-review-reminder mit document.last_reminder_sent_at) und
-- eskaliert einmalig an Ersteller + Dokument-Owner, wenn eine pending
-- Anfrage mehr als 3 Tage überfällig ist.
--
--   last_reminder_sent_at — Staffelungs-Anker: eine Erinnerung feuert nur,
--     wenn die Anfrage seit der letzten Erinnerung in eine nähere Stufe
--     gerückt ist (@grc/shared shouldSendSignatureDueReminder).
--   escalated_at — Einmal-Marker für die Überfälligkeits-Eskalation
--     (@grc/shared shouldEscalateSignatureRequest). Bewusst KEIN
--     Auto-Cancel: die Entscheidung liegt beim Ersteller (Cancel-Route).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE document_signature_request
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE document_signature_request
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

COMMENT ON COLUMN document_signature_request.last_reminder_sent_at IS
  'Zeitpunkt der letzten gestaffelten Frist-Erinnerung (3/0-Tage-Stufen, Cron signature-due-reminder). NULL = noch keine Erinnerung versandt.';

COMMENT ON COLUMN document_signature_request.escalated_at IS
  'Einmal-Marker: Überfälligkeits-Eskalation (> 3 Tage nach due_date) an Ersteller + Dokument-Owner wurde versandt. Kein Auto-Cancel — Entscheidung liegt beim Ersteller.';
