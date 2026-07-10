-- ============================================================================
-- Migration 0360: Risk-Acceptance Repair (ISO 27005 Clause 10)
--
-- Kontext (2026-07-10): Migration 0088 legte risk_acceptance +
-- risk_acceptance_authority an, enthielt aber einen Seed-INSERT mit
-- hartkodiertem org_id — auf DBs ohne diese Organisation schlug der INSERT
-- fehl und die GESAMTE Migration rollte zurueck (MIGRATIONS_KNOWN_ISSUES.md,
-- Kategorie A). Folge auf der Dev-DB: beide Tabellen existieren nicht,
-- obwohl STATUS.md/CLAUDE.md das Modul als "Done" fuehren. Die nachgelagerten
-- Statements aus 0089 (Audit-Trigger), 0105 (RLS) und 0345 (FORCE RLS)
-- liefen dadurch auf diesen Tabellen ins Leere (Exception-Handler).
--
-- Diese Migration ist idempotent und repariert alle drei Ebenen:
--   1. Tabellen (CREATE TABLE IF NOT EXISTS, Spaltensatz identisch zu 0088)
--   2. Seed der Default-Authority-Matrix — org-sicher (pro existierender
--      Organisation, mit set_config fuer RLS-WITH-CHECK-Kompatibilitaet)
--   3. RLS: ENABLE + FORCE + Policies mit USING und WITH CHECK
--      (Pattern von 0345/0336)
--
-- Audit-Trigger werden hier bewusst NICHT registriert — die explizite
-- Registrierung laeuft ueber den Audit-Trigger-Backfill (0357 ff.).
-- ACHTUNG: risk_acceptance/risk_acceptance_authority fehlen in 0357 und
-- muessen dort (oder in einem Folge-Backfill) ergaenzt werden, da 0089 auf
-- frischen DBs vor dieser Migration laeuft und die Tabellen dann noch
-- nicht existieren.
-- ============================================================================

-- ============================================================
-- 1) Tabellen
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  risk_id UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  -- Who accepted
  accepted_by UUID NOT NULL REFERENCES "user"(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Conditions
  acceptance_conditions TEXT,
  -- Time-bound acceptance
  valid_until DATE,
  -- Risk level at time of acceptance (for audit trail)
  risk_score_at_acceptance INTEGER NOT NULL,
  risk_level_at_acceptance VARCHAR(20) NOT NULL,
  -- Justification (mandatory per ISO 27005)
  justification TEXT NOT NULL,
  -- Status: active | expired | revoked
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES "user"(id),
  revoke_reason TEXT,
  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_acceptance_org ON risk_acceptance(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_acceptance_risk ON risk_acceptance(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_acceptance_status ON risk_acceptance(org_id, status);
-- Expiry-Cron sucht: status='active' AND valid_until < now
CREATE INDEX IF NOT EXISTS idx_risk_acceptance_valid_until
  ON risk_acceptance(valid_until) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS risk_acceptance_authority (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  -- Rule: risk_score >= min_score AND risk_score <= max_score -> required_role
  min_score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 25,
  required_role VARCHAR(50) NOT NULL,
  required_role_label VARCHAR(200),
  -- Optional: require specific user approval
  required_approver_id UUID REFERENCES "user"(id),
  -- Description
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 0088 hatte UNIQUE (org_id, min_score, max_score) ueber ALLE Rows. Die
-- Authority-PUT-Route ersetzt die Matrix per Soft-Deactivate + Insert —
-- mit dem harten UNIQUE kollidiert jede erneute PUT derselben Bänder.
-- Ersatz: partieller Unique-Index nur auf aktive Rows (Integritaet der
-- wirksamen Matrix bleibt erzwungen, deaktivierte Historie bleibt erhalten).
ALTER TABLE risk_acceptance_authority
  DROP CONSTRAINT IF EXISTS risk_acceptance_authority_org_id_min_score_max_score_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_acceptance_authority_active_band
  ON risk_acceptance_authority(org_id, min_score, max_score)
  WHERE is_active;

-- ============================================================
-- 2) Seed: Default-Authority-Matrix pro Organisation
--
-- Anders als 0088 (hartkodierter org_id → FK-Violation → Rollback) laeuft
-- der Seed hier ueber alle existierenden Organisationen, die noch keine
-- Matrix haben. set_config('app.current_org_id', ...) pro Org, damit der
-- INSERT auch dann durchgeht, wenn die Tabelle in dieser Umgebung bereits
-- FORCE RLS + WITH CHECK traegt (0345 / Abschnitt 3 unten).
-- ============================================================

DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organization LOOP
    PERFORM set_config('app.current_org_id', org.id::text, true);
    INSERT INTO risk_acceptance_authority
      (org_id, min_score, max_score, required_role, required_role_label, description)
    SELECT org.id, v.min_score, v.max_score, v.required_role, v.label, v.descr
    FROM (VALUES
      (1, 8,  'control_owner', 'Kontrollverantwortlicher',
       'Niedrige und mittlere Risiken (Score 1-8) können vom Kontrollverantwortlichen akzeptiert werden'),
      (9, 14, 'risk_manager', 'Risikomanager',
       'Hohe Risiken (Score 9-14) erfordern die Genehmigung des Risikomanagers'),
      (15, 25, 'admin', 'Geschäftsführung',
       'Sehr hohe und kritische Risiken (Score 15-25) erfordern die Genehmigung der Geschäftsführung')
    ) AS v(min_score, max_score, required_role, label, descr)
    WHERE NOT EXISTS (
      SELECT 1 FROM risk_acceptance_authority a WHERE a.org_id = org.id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM set_config('app.current_org_id', '', true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'risk_acceptance_authority seed skipped: %', SQLERRM;
END $$;

-- ============================================================
-- 3) RLS: ENABLE + FORCE + Policies (USING + WITH CHECK)
--    Idempotent — Pattern von 0345 (F#27) / 0336 (RLS gap closure v5).
-- ============================================================

DO $$ BEGIN
  EXECUTE 'ALTER TABLE risk_acceptance ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE risk_acceptance FORCE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE risk_acceptance_authority ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE risk_acceptance_authority FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS enable/force: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_risk_acceptance ON risk_acceptance';
  EXECUTE 'CREATE POLICY rls_risk_acceptance ON risk_acceptance ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'risk_acceptance policy: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_risk_acceptance_authority ON risk_acceptance_authority';
  EXECUTE 'CREATE POLICY rls_risk_acceptance_authority ON risk_acceptance_authority ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'risk_acceptance_authority policy: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Audit-Trigger fuer risk_acceptance / risk_acceptance_authority
-- (0357_audit_trigger_backfill lief VOR dieser Migration; auf frischen DBs
--  existieren die Tabellen erst ab hier -- Trigger daher hier registrieren.
--  Guards identisch zum 0357-Pattern: idempotent, namensunabhaengig.)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN RAISE NOTICE '[0360] audit_trigger() fehlt - Block uebersprungen'; RETURN; END IF;
  IF to_regclass('public.risk_acceptance') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_acceptance') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_acceptance_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_acceptance FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF to_regclass('public.risk_acceptance_authority') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_proc pr ON pr.oid = tg.tgfoid WHERE tg.tgrelid = to_regclass('public.risk_acceptance_authority') AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal) THEN
    CREATE TRIGGER risk_acceptance_authority_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_acceptance_authority FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
