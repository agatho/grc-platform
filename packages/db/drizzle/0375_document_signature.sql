-- ============================================================================
-- Migration 0375: Multi-Signer-e-Signatur fuer Dokumente (W21-DMS-MULTISIGN-01)
--
-- Kontext (2026-07-11): Der Wave-19-Scope-Decision-Report
-- (docs/qa-reports/wave19-n7-dms-scope-decision.md) hat Multi-Signer-Signatur
-- als out-of-scope vertagt. Entscheidung jetzt: In-house-Implementierung nach
-- dem bewaehrten Sign-Off-Chain-Muster (process_sign_off, Migration 0334 +
-- Concurrency-Guard 0341), kombiniert mit dem document_approval_step-Muster
-- (vorab angelegte, geordnete Signer-Slots).
--
--   1. document_signature_request: eine Signatur-Zeremonie pro Dokument.
--      version_id + file_sha256 werden bei Anforderung EINGEFROREN — ein
--      spaeterer Re-Upload invalidiert das Signieren (422 in der API).
--   2. document_signature: ein Slot pro Signer (sign_order, status pending),
--      beim Signieren/Ablehnen wird das Hash-Ketten-Glied gesetzt:
--        content_hash = SHA-256(kanonisches JSON aus documentId, versionId,
--                               fileSha256, signerUserId, signedAt, decision)
--        chain_hash   = SHA-256(previous_chain_hash || content_hash)
--   3. Concurrency-Guard: partieller UNIQUE-Index
--      (request_id, previous_chain_hash) NULLS NOT DISTINCT
--      WHERE content_hash IS NOT NULL — zwei parallele Signaturen, die
--      denselben Chain-Head beanspruchen, kollidieren mit 23505 (Muster 0341;
--      partiell, weil die pending-Slots alle previous_chain_hash NULL haben).
--   4. RLS ENABLE + FORCE + Policy (USING + WITH CHECK, Muster 0360/0369)
--      und Audit-Trigger-Registrierung (Guard-Muster 0357/0360).
--
-- Idempotent: alle Statements mit IF NOT EXISTS / Exception-Guards.
-- ============================================================================

-- ============================================================
-- 1) Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE document_signature_request_status AS ENUM
    ('pending', 'completed', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '[0375] document_signature_request_status existiert bereits';
END $$;

DO $$ BEGIN
  CREATE TYPE document_signature_status AS ENUM
    ('pending', 'signed', 'declined');
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '[0375] document_signature_status existiert bereits';
END $$;

-- ============================================================
-- 2) document_signature_request
-- ============================================================

CREATE TABLE IF NOT EXISTS document_signature_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  -- Eingefrorene Version: die Signatur bezieht sich exakt auf diesen Stand.
  version_id UUID NOT NULL REFERENCES document_version(id) ON DELETE RESTRICT,
  -- Eingefrorener Datei-Hash zum Zeitpunkt der Anforderung. Die Sign-Route
  -- vergleicht gegen den Live-Hash und verweigert bei Abweichung (422).
  file_sha256 VARCHAR(64) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT,
  status document_signature_request_status NOT NULL DEFAULT 'pending',
  -- true: Signer muessen in sign_order-Reihenfolge signieren
  sequential BOOLEAN NOT NULL DEFAULT false,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id),
  updated_by UUID
);

COMMENT ON COLUMN document_signature_request.file_sha256 IS
  'SHA-256 der Dokumentdatei zum Anforderungszeitpunkt (eingefroren). Abweichung vom Live-Hash blockiert das Signieren (422).';

CREATE INDEX IF NOT EXISTS dsr_req_org_idx
  ON document_signature_request(org_id);
CREATE INDEX IF NOT EXISTS dsr_req_document_idx
  ON document_signature_request(document_id, status);
CREATE INDEX IF NOT EXISTS dsr_req_version_idx
  ON document_signature_request(version_id);

-- ============================================================
-- 3) document_signature — Signer-Slots + Hash-Ketten-Glieder
-- ============================================================

CREATE TABLE IF NOT EXISTS document_signature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  request_id UUID NOT NULL
    REFERENCES document_signature_request(id) ON DELETE CASCADE,
  signer_user_id UUID NOT NULL REFERENCES "user"(id),
  sign_order INTEGER NOT NULL,
  status document_signature_status NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  decline_reason TEXT,
  -- Hash-Kette (NULL solange pending; atomar gesetzt bei sign/decline)
  content_hash VARCHAR(64),
  previous_chain_hash VARCHAR(64),
  chain_hash VARCHAR(64),
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT dsig_request_signer_unique UNIQUE (request_id, signer_user_id)
);

COMMENT ON COLUMN document_signature.content_hash IS
  'SHA-256 ueber kanonisches JSON (documentId, versionId, fileSha256, signerUserId, signedAt, decision) — siehe apps/web/src/lib/documents/signature-chain.ts';
COMMENT ON COLUMN document_signature.chain_hash IS
  'SHA-256(previous_chain_hash || content_hash) — Glied der Append-Only-Kette pro Request';

CREATE INDEX IF NOT EXISTS dsig_org_idx
  ON document_signature(org_id);
CREATE INDEX IF NOT EXISTS dsig_request_idx
  ON document_signature(request_id, sign_order);
CREATE INDEX IF NOT EXISTS dsig_signer_status_idx
  ON document_signature(signer_user_id, status);

-- Concurrency-Guard (Muster 0341): zwei parallele Sign-Requests, die
-- denselben Chain-Head (previous_chain_hash) beanspruchen, kollidieren.
-- NULLS NOT DISTINCT (PG15+), damit auch zwei parallele ERST-Signaturen
-- (previous_chain_hash NULL) kollidieren. Partiell auf content_hash IS NOT
-- NULL, weil die vorab angelegten pending-Slots alle NULL-Hashes tragen und
-- sich nicht gegenseitig blockieren duerfen.
CREATE UNIQUE INDEX IF NOT EXISTS dsig_request_prev_chain_uniq
  ON document_signature (request_id, previous_chain_hash) NULLS NOT DISTINCT
  WHERE content_hash IS NOT NULL;

-- ============================================================
-- 4) RLS: ENABLE + FORCE + Policy (USING + WITH CHECK) — Muster 0360/0369
-- ============================================================

DO $$ BEGIN
  EXECUTE 'ALTER TABLE document_signature_request ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE document_signature_request FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'document_signature_request RLS enable/force: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_document_signature_request ON document_signature_request';
  EXECUTE 'CREATE POLICY rls_document_signature_request ON document_signature_request ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'document_signature_request policy: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE document_signature ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE document_signature FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'document_signature RLS enable/force: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_document_signature ON document_signature';
  EXECUTE 'CREATE POLICY rls_document_signature ON document_signature ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'document_signature policy: %', SQLERRM;
END $$;

-- ============================================================
-- 5) Audit-Trigger — Guard-Muster 0357/0360 (idempotent)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    RAISE NOTICE '[0375] audit_trigger() fehlt - Block uebersprungen';
    RETURN;
  END IF;
  IF to_regclass('public.document_signature_request') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_proc pr ON pr.oid = tg.tgfoid
    WHERE tg.tgrelid = to_regclass('public.document_signature_request')
      AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal
  ) THEN
    CREATE TRIGGER document_signature_request_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON document_signature_request
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.document_signature') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_proc pr ON pr.oid = tg.tgfoid
    WHERE tg.tgrelid = to_regclass('public.document_signature')
      AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal
  ) THEN
    CREATE TRIGGER document_signature_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON document_signature
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
