-- ============================================================================
-- Migration 0292: Audit-Method-Entries (typisierte Mehrfach-Methoden pro Bewertung)
--
-- Die Migrationen 0290/0291 haben das Modell „eine Methode + einige
-- Einzelfelder (interviewee, sampleSize, …)" etabliert. In der Realität
-- prüft ein:e Auditor:in aber MEHRERE Dinge gleichzeitig mit je eigenen
-- Details: Interview mit Person A PLUS Dokumentenprüfung von Policy X
-- PLUS Stichprobe aus Ticket-System (N=500, gezogen=25) PLUS technischer
-- Test des Firewall-Rule-Sets. Jede Methode bringt eigene Nachweisfelder.
--
-- Lösung: `method_entries jsonb` — Array typisierter Einträge, jedes Objekt
-- hält alle Felder die für seinen Methodentyp relevant sind (ISO 19011
-- § 6.4.5 „Audit-Nachweise sollen aufzeichenbar und nachvollziehbar sein").
--
-- Struktur pro Entry:
--   { id, method, date?, notes?, ...method-spezifische-Felder }
--
-- Method-spezifische Felder:
--   interview       → interviewee, intervieweeRole
--   document_review → documents: [{ title, reference? }]
--   observation     → location, observedProcess
--   walkthrough     → process, participants
--   technical_test  → system, testDescription, testResult
--   sampling        → populationSize, sampleSize, sampleIds[], selectionMethod
--   reperformance   → activity, baseline
--
-- Altdaten werden aus 0290/0291-Spalten ins Array gehoben, danach werden
-- die einzelnen Spalten (audit_methods, interviewee, interviewee_role,
-- sample_size, sample_ids) ersatzlos gedroppt.
--
-- Idempotent. Hinweis: DROP COLUMN entfernt Daten — daher erst migrieren.
-- ============================================================================

-- ── 1. Neue Spalte anlegen ──────────────────────────────────────────
ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS method_entries jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN audit_checklist_item.method_entries IS
  'ISO 19011 § 6.4.5/6.4.7: Array typisierter Audit-Method-Entries. Jeder Entry hat { id, method, date?, notes?, + method-spezifische Felder }.';

-- ── 2. Altdaten migrieren ───────────────────────────────────────────
-- Baut ein Entry pro Wert aus audit_methods[]. Einzelfelder (interviewee,
-- sample_*) werden auf das passende Entry gemappt — rest bleibt NULL.

-- Schutz: nur migrieren wenn die Spalte noch existiert UND noch nichts
-- in method_entries steht.
DO $$
DECLARE
  has_audit_methods boolean;
  has_interviewee   boolean;
  has_sample_size   boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_checklist_item' AND column_name = 'audit_methods'
  ) INTO has_audit_methods;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_checklist_item' AND column_name = 'interviewee'
  ) INTO has_interviewee;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_checklist_item' AND column_name = 'sample_size'
  ) INTO has_sample_size;

  IF has_audit_methods THEN
    EXECUTE $MIG$
      WITH expanded AS (
        SELECT
          ACI.id AS item_id,
          UNNEST(ACI.audit_methods) AS m,
          ACI.interviewee,
          ACI.interviewee_role,
          ACI.sample_size,
          ACI.sample_ids
        FROM audit_checklist_item ACI
        WHERE ACI.audit_methods IS NOT NULL
          AND cardinality(ACI.audit_methods) > 0
          AND (ACI.method_entries IS NULL OR ACI.method_entries = '[]'::jsonb)
      ),
      entries AS (
        SELECT
          item_id,
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'method', m
          )
          -- Interview: interviewee + role
          || CASE WHEN m = 'interview' AND interviewee IS NOT NULL
                  THEN jsonb_build_object('interviewee', interviewee)
                  ELSE '{}'::jsonb END
          || CASE WHEN m = 'interview' AND interviewee_role IS NOT NULL
                  THEN jsonb_build_object('intervieweeRole', interviewee_role)
                  ELSE '{}'::jsonb END
          -- Sampling / Technical Test: sample_size + ids
          || CASE WHEN m IN ('sampling','technical_test') AND sample_size IS NOT NULL
                  THEN jsonb_build_object('sampleSize', sample_size)
                  ELSE '{}'::jsonb END
          || CASE WHEN m IN ('sampling','technical_test') AND sample_ids IS NOT NULL
                  THEN jsonb_build_object('sampleIds', to_jsonb(sample_ids))
                  ELSE '{}'::jsonb END
            AS entry
        FROM expanded
      ),
      grouped AS (
        SELECT item_id, jsonb_agg(entry) AS entries
        FROM entries GROUP BY item_id
      )
      UPDATE audit_checklist_item ACI
      SET method_entries = grouped.entries
      FROM grouped
      WHERE ACI.id = grouped.item_id;
    $MIG$;
  END IF;
END $$;

-- ── 3. Alte Spalten entfernen ───────────────────────────────────────
DROP INDEX IF EXISTS aci_audit_methods_idx;

ALTER TABLE audit_checklist_item
  DROP CONSTRAINT IF EXISTS audit_checklist_item_methods_check;

ALTER TABLE audit_checklist_item
  DROP COLUMN IF EXISTS audit_methods;

ALTER TABLE audit_checklist_item
  DROP COLUMN IF EXISTS interviewee;

ALTER TABLE audit_checklist_item
  DROP COLUMN IF EXISTS interviewee_role;

ALTER TABLE audit_checklist_item
  DROP COLUMN IF EXISTS sample_size;

ALTER TABLE audit_checklist_item
  DROP COLUMN IF EXISTS sample_ids;

-- ── 4. GIN-Index auf method_entries ────────────────────────────────
-- Erlaubt schnelle Queries wie „alle Checklist-Items mit irgendeinem
-- Interview" via `method_entries @> '[{"method":"interview"}]'`.
CREATE INDEX IF NOT EXISTS aci_method_entries_idx
  ON audit_checklist_item USING gin (method_entries jsonb_path_ops);
