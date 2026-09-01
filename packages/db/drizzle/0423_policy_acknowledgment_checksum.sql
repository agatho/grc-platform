-- Migration 0423: policy_acknowledgment — Pruefsumme statt „digitaler Signatur"
--
-- Migration: 0423_policy_acknowledgment_checksum
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP7 · S06-02]
--
-- `policy_acknowledgment.signature_hash` ist ein ungeschluesselter SHA-512
-- ueber vier Werte, die alle in derselben Tabellenzeile stehen. Die Oberflaeche
-- nannte ihn „Digitale Signatur" und „dient als Nachweis" — beides ist falsch:
-- kein Schluesselmaterial, kein Zertifikat, kein HMAC, keine Verkettung.
--
-- Zwei Korrekturen, beide notwendig:
--   1. Die BEZEICHNUNG wird zurueckgenommen (i18n: „Bestaetigungs-Pruefsumme").
--      Aus einem Hash ohne Schluessel laesst sich keine Signatur machen; die
--      Verkettungs-Alternative wuerde die Semantik des Moduls aendern und ist
--      als Backlog-Punkt notiert.
--   2. Die BINDUNG wird real. Der bisherige Ausdruck hashte
--      COALESCE(dv.content, d.content, '') — bei einer als PDF verteilten
--      Richtlinie (Regelfall: Inhalt liegt in file_path, content ist NULL)
--      fiel er auf digest('') zurueck, den konstanten Leer-Hash
--      e3b0c442...b855. Die Pruefsumme attestierte dann nachweislich nichts.
--      Der Datei-Hash wird jetzt einbezogen, und die nachweistragenden Felder
--      (Status, Quiz, Lesedauer, IP, User-Agent) gehen in die Pruefsumme ein.
--
-- Die Spalten hier halten fest, WAS gebunden wurde, damit eine spaetere
-- Nachrechnung nicht raten muss.

ALTER TABLE policy_acknowledgment
  ADD COLUMN IF NOT EXISTS signature_hash_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS document_sha256        varchar(64),
  ADD COLUMN IF NOT EXISTS document_hash_source   varchar(24);

COMMENT ON COLUMN policy_acknowledgment.signature_hash IS
  'Bestaetigungs-PRUEFSUMME (SHA-512), KEINE digitale Signatur: ungeschluesselt, ohne Zertifikat und ohne Verkettung. Sie belegt die Unveraendertheit der Zeile gegenueber versehentlicher Aenderung, nicht die Urheberschaft (S06-02).';
COMMENT ON COLUMN policy_acknowledgment.signature_hash_version IS
  'Formel der Pruefsumme. 1 = userId:distId:timestamp:contentHash (Bestand). 2 = zusaetzlich Datei-Hash, Status, Quiz-Ergebnis, Lesedauer, IP und User-Agent (S06-02).';
COMMENT ON COLUMN policy_acknowledgment.document_sha256 IS
  'Der Dokument-Hash, an den diese Bestaetigung gebunden wurde.';
COMMENT ON COLUMN policy_acknowledgment.document_hash_source IS
  'Woher der Dokument-Hash stammt: file | version_content | document_content | none. „none" heisst ausdruecklich: die Pruefsumme bindet an keinen Dokumentinhalt (S06-02).';

-- Bestandszeilen tragen weiterhin Version 1 (Default). Ihr Dokument-Hash ist
-- nicht rekonstruierbar; document_hash_source bleibt bewusst NULL, damit die
-- Unterscheidung „unbekannt" vs. „nichts gebunden" erhalten bleibt.
