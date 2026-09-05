-- Migration 0420: Signaturkette — Vollständigkeit, Hash-Version, Zeitstempel
--
-- Migration: 0420_signature_chain_completeness
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP7 · S06-03, S06-05, S06-15, S06-23]
--
-- S06-15: `verifySignatureChain()` läuft vom Kopf vorwärts und kennt weder
--   eine erwartete Länge noch ein Endglied. Jedes Präfix einer gültigen Kette
--   ist selbst eine gültige Kette — wird das LETZTE Glied gelöscht (z. B. das
--   `declined`-Glied, das die Zeremonie zum Scheitern brachte), meldet
--   `verify()` weiterhin `chainValid: true` und das Zertifikat druckt
--   „Hash-Kette: GÜLTIG" für eine unvollständige Zeremonie.
--   → `signature_count` (Slots bei Anlage), `chain_length` (entschiedene
--     Glieder) und `final_chain_hash` (Kettenkopf) auf der Anforderung.
--
-- S06-03: `ip_address`, `user_agent`, `decline_reason` und `sign_order` lagen
--   außerhalb des `content_hash`, obwohl der Signaturdialog ausdrücklich
--   „Zeitpunkt, IP-Adresse … werden protokolliert" zusagt. Die neue
--   Hash-Formel (v2) bindet sie ein; `hash_version` unterscheidet die
--   Formeln, damit bestehende Zeilen unverändert verifizierbar bleiben.
--   `ip_trusted` hält fest, ob die IP aus einer Position stammt, die ein
--   Client nicht setzen kann (TRUSTED_PROXY_HOPS).
--
-- S06-05: Der Signaturzeitpunkt war `new Date()` auf dem App-Server. Die
--   RFC-3161-Anbindung (packages/shared/src/lib/freetsa.ts, von WP4
--   vollständig validiert) existiert im Produkt, verankerte aber nur den
--   audit_log. Die Spalten nehmen das Token der Signatur auf.
--
-- S06-23: Eine Anforderung blieb nach Dateiänderung unbegrenzt `pending`.
--   Der Enum-Wert `invalidated` und die beiden Begleitspalten machen den
--   Zustand explizit.
--
-- WICHTIG: `ALTER TYPE ... ADD VALUE` darf im selben Transaktionsblock nicht
-- VERWENDET werden. Diese Datei fügt den Wert nur hinzu.

ALTER TYPE document_signature_request_status ADD VALUE IF NOT EXISTS 'invalidated';

-- ── document_signature_request ───────────────────────────────────────
ALTER TABLE document_signature_request
  ADD COLUMN IF NOT EXISTS signature_count  integer,
  ADD COLUMN IF NOT EXISTS chain_length     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_chain_hash varchar(64),
  ADD COLUMN IF NOT EXISTS creator_is_signer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invalidated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_reason text;

COMMENT ON COLUMN document_signature_request.signature_count IS
  'Anzahl der bei Anlage erzeugten Signer-Slots. verify() vergleicht sie gegen die vorhandenen Zeilen (S06-15).';
COMMENT ON COLUMN document_signature_request.chain_length IS
  'Anzahl der entschiedenen Kettenglieder. Erkennt das Abschneiden am Ende, das eine reine Vorwärtsprüfung nicht sieht (S06-15).';
COMMENT ON COLUMN document_signature_request.final_chain_hash IS
  'chain_hash des zuletzt angehängten Glieds — der erwartete Kettenkopf (S06-15).';
COMMENT ON COLUMN document_signature_request.creator_is_signer IS
  'true, wenn der Ersteller der Anforderung selbst als Signer eingetragen ist. Wird im Zertifikat ausgewiesen (S06-13).';

-- Bestandszeilen: die vorhandenen Werte nachziehen, damit die neue Prüfung
-- nicht rückwirkend Fehlalarme erzeugt.
UPDATE document_signature_request r
SET signature_count = sub.slots,
    chain_length    = sub.decided,
    final_chain_hash = sub.head
FROM (
  SELECT s.request_id,
         count(*)              AS slots,
         count(s.content_hash) AS decided,
         (SELECT s2.chain_hash
            FROM document_signature s2
           WHERE s2.request_id = s.request_id
             AND s2.content_hash IS NOT NULL
           ORDER BY s2.signed_at DESC
           LIMIT 1)            AS head
  FROM document_signature s
  GROUP BY s.request_id
) sub
WHERE sub.request_id = r.id
  AND r.signature_count IS NULL;

-- ── document_signature ───────────────────────────────────────────────
ALTER TABLE document_signature
  ADD COLUMN IF NOT EXISTS hash_version   integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ip_trusted     boolean,
  ADD COLUMN IF NOT EXISTS tsa_status     varchar(24),
  ADD COLUMN IF NOT EXISTS tsa_gen_time   timestamptz,
  ADD COLUMN IF NOT EXISTS tsa_serial     varchar(128),
  ADD COLUMN IF NOT EXISTS tsa_policy_oid varchar(64),
  ADD COLUMN IF NOT EXISTS tsa_proof      bytea;

COMMENT ON COLUMN document_signature.hash_version IS
  'Formel des content_hash. 1 = 6 Metadatenfelder (Bestand). 2 = zusätzlich ip_address, user_agent, decline_reason, sign_order (S06-03). Bestehende Zeilen bleiben unter ihrer eigenen Version verifizierbar.';
COMMENT ON COLUMN document_signature.ip_trusted IS
  'true nur, wenn die IP aus einer Position im X-Forwarded-For stammt, die der Client nicht setzen kann (TRUSTED_PROXY_HOPS gesetzt). NULL/false = Angabe ist eine Selbstauskunft (S06-03).';
COMMENT ON COLUMN document_signature.tsa_status IS
  'RFC-3161-Zeitstempel: granted | unavailable | disabled | error. Weist aus, ob signed_at extern gedeckt ist (S06-05).';
COMMENT ON COLUMN document_signature.tsa_proof IS
  'DER-kodierte TimeStampResp über den chain_hash dieses Glieds (FreeTSA). Von packages/shared/src/lib/freetsa.ts erzeugt und validiert (S06-05).';

CREATE INDEX IF NOT EXISTS dsig_tsa_status_idx
  ON document_signature (tsa_status)
  WHERE tsa_status IS NOT NULL;
