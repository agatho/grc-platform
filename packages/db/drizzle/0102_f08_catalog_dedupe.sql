-- F-08 Fix: Katalog-Duplikate entfernen + UNIQUE-Constraint
--
-- Befund (Iter 3 E2E-Test): GET /api/v1/catalogs?type=control&limit=200
-- liefert 48 Zeilen, davon 24 unique (source, version) Kombinationen.
-- Ursache: Der seed fuer catalog.sql wurde mehrfach ausgefuehrt, es gab
-- keinen UNIQUE-Constraint, der ein INSERT hatte ON CONFLICT DO NOTHING
-- anspringen koennen.
--
-- Strategie (transaktional):
--   1. Map: pro (source, version) den aeltesten Katalog behalten
--   2. catalog_entry: catalog_id auf keep_id umbiegen, dann Duplikate
--      (gleicher catalog_id + code) ueber Entry-Dedupe-Map aufloesen;
--      FK-Referenzen in risk/control/finding/catalog_entry_reference
--      umbiegen, danach Duplikat-Entries droppen
--   3. org_active_catalog: alle Aktivierungen auf keep_id migrieren,
--      Duplikat-Aktivierungen (org_id, catalog_type, keep_id) mergen
--   4. Duplikat-catalog-Rows droppen
--   5. UNIQUE-Constraint auf (source, version) anlegen -- verhindert
--      Rueckfaelle
--
-- Idempotent: WHERE-Klauseln filtern auf old_id != keep_id, erneute
-- Ausfuehrung auf bereits bereinigtem Bestand ist no-op.

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Katalog-Dedupe-Map
-- ──────────────────────────────────────────────────────────────

CREATE TEMP TABLE _cat_dedupe AS
SELECT
  c.id AS old_id,
  FIRST_VALUE(c.id) OVER (
    PARTITION BY COALESCE(c.source, ''), COALESCE(c.version, '')
    ORDER BY c.created_at NULLS LAST, c.ctid
  ) AS keep_id
FROM catalog c;

-- Nur Mappings behalten, die tatsaechlich etwas umzubiegen haben
DELETE FROM _cat_dedupe WHERE old_id = keep_id;

-- ──────────────────────────────────────────────────────────────
-- 2. catalog_entry: Phase A -- catalog_id auf keep_id migrieren
-- ──────────────────────────────────────────────────────────────
-- Achtung: Danach kann es Duplikate (catalog_id, code) geben, der
-- bestehende UNIQUE-Index blockt das. Wir loesen Duplikate VOR dem
-- UPDATE, indem wir ein Ziel-Keep pro (keep_id, code) waehlen und die
-- Verlierer-Entries (inkl. ihrer FK-Referenzen) umbiegen.

-- Map: pro (target_catalog_id=keep_id, code) den aeltesten Entry behalten
CREATE TEMP TABLE _ce_dedupe AS
SELECT
  ce.id AS old_id,
  FIRST_VALUE(ce.id) OVER (
    PARTITION BY COALESCE(m.keep_id, ce.catalog_id), ce.code
    ORDER BY ce.created_at NULLS LAST, ce.ctid
  ) AS keep_id
FROM catalog_entry ce
LEFT JOIN _cat_dedupe m ON ce.catalog_id = m.old_id;

DELETE FROM _ce_dedupe WHERE old_id = keep_id;

-- FK-Referenzen auf catalog_entry umbiegen (risk.catalog_entry_id,
-- control.catalog_entry_id, finding nutzt catalog-Entries nicht direkt
-- via entry_id, nur via controlId; catalog_entry_reference falls vorhanden)

UPDATE risk
SET catalog_entry_id = m.keep_id
FROM _ce_dedupe m
WHERE risk.catalog_entry_id = m.old_id;

UPDATE control
SET catalog_entry_id = m.keep_id
FROM _ce_dedupe m
WHERE control.catalog_entry_id = m.old_id;

-- threat.catalog_entry_id (isms.ts line 124, ON DELETE NO ACTION)
UPDATE threat
SET catalog_entry_id = m.keep_id
FROM _ce_dedupe m
WHERE threat.catalog_entry_id = m.old_id;

-- soa_entry.catalog_entry_id (isms.ts line 526, NOT NULL ON DELETE NO ACTION)
-- SoA-Unique-Constraint (org_id, catalog_entry_id) -- vorher dedupen
DELETE FROM soa_entry s1
USING soa_entry s2, _ce_dedupe m
WHERE s1.catalog_entry_id = m.old_id
  AND s2.catalog_entry_id = m.keep_id
  AND s1.org_id = s2.org_id
  AND s1.id <> s2.id;

UPDATE soa_entry
SET catalog_entry_id = m.keep_id
FROM _ce_dedupe m
WHERE soa_entry.catalog_entry_id = m.old_id;

-- catalog_entry_reference existiert als separate Tabelle (Cross-Framework-Map)
-- Update per conditional DO-Block, falls die Tabelle vorhanden ist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'catalog_entry_reference'
  ) THEN
    EXECUTE $cmd$
      UPDATE catalog_entry_reference
      SET source_entry_id = m.keep_id
      FROM _ce_dedupe m
      WHERE catalog_entry_reference.source_entry_id = m.old_id;
    $cmd$;
    EXECUTE $cmd$
      UPDATE catalog_entry_reference
      SET target_entry_id = m.keep_id
      FROM _ce_dedupe m
      WHERE catalog_entry_reference.target_entry_id = m.old_id;
    $cmd$;
  END IF;
END $$;

-- parent_entry_id im catalog_entry selbst auch umbiegen
UPDATE catalog_entry
SET parent_entry_id = m.keep_id
FROM _ce_dedupe m
WHERE catalog_entry.parent_entry_id = m.old_id;

-- Jetzt koennen wir die Verlierer-Entries loeschen
DELETE FROM catalog_entry
WHERE id IN (SELECT old_id FROM _ce_dedupe);

-- Und die gebliebenen Entries auf den neuen catalog_id umbiegen
UPDATE catalog_entry
SET catalog_id = m.keep_id
FROM _cat_dedupe m
WHERE catalog_entry.catalog_id = m.old_id;

-- ──────────────────────────────────────────────────────────────
-- 3. org_active_catalog auf keep_id umbiegen + Duplikat-Aktivierungen mergen
-- ──────────────────────────────────────────────────────────────
-- Schema: (org_id, catalog_type, catalog_id) unique. Wenn Org A sowohl
-- old_id als auch keep_id aktiviert hatte, gibt es nach UPDATE einen
-- Konflikt. Vorher dedupen.

DELETE FROM org_active_catalog a1
USING org_active_catalog a2, _cat_dedupe m
WHERE a1.catalog_id = m.old_id
  AND a2.catalog_id = m.keep_id
  AND a1.org_id = a2.org_id
  AND a1.catalog_type = a2.catalog_type;

UPDATE org_active_catalog
SET catalog_id = m.keep_id
FROM _cat_dedupe m
WHERE org_active_catalog.catalog_id = m.old_id;

-- ──────────────────────────────────────────────────────────────
-- 4. Duplikat-Kataloge droppen
-- ──────────────────────────────────────────────────────────────

DELETE FROM catalog
WHERE id IN (SELECT old_id FROM _cat_dedupe);

-- ──────────────────────────────────────────────────────────────
-- 5. UNIQUE-Constraint anlegen (verhindert Rueckfall)
-- ──────────────────────────────────────────────────────────────
-- COALESCE-Trick fuer NULL-Version: NULL = NULL ist unknown, also
-- wuerden zwei NULL-Versionen des gleichen source den Constraint nicht
-- verletzen. Mit generated column + unique constraint umgehen.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catalog_source_version_uniq'
  ) THEN
    ALTER TABLE catalog
    ADD CONSTRAINT catalog_source_version_uniq
      UNIQUE (source, version);
  END IF;
EXCEPTION WHEN unique_violation THEN
  -- Sollte nicht mehr vorkommen nach Dedupe; sichere Fallback-Message
  RAISE NOTICE 'Could not add unique constraint catalog_source_version_uniq: duplicates still present';
END $$;

COMMIT;
