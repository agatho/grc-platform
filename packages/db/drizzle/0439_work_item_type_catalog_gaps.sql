-- 0439_work_item_type_catalog_gaps.sql
-- [ARCTOS-FULL-2026-08-31 / Restdefekte · O-4]
--
-- Befund O-4: `POST /api/v1/findings` antwortete mit 500. Ursache ist kein
-- Fehler im Routenhandler, sondern eine Lücke in den KATALOGDATEN:
--
--   apps/web/.../findings/route.ts legt ein `work_item` mit
--   `type_key = 'finding'` an; zusätzlich tut das der BEFORE-INSERT-Trigger
--   `finding_auto_create_work_item()` für jeden Weg, der `finding` direkt
--   schreibt. `work_item.type_key` hat einen Fremdschlüssel auf
--   `work_item_type.type_key` — und `'finding'` war dort nie registriert.
--   Ergebnis: `work_item_type_key_work_item_type_type_key_fk` verletzt,
--   Transaktion zurückgerollt, 500.
--
-- Der Wert gehört in die Katalogdaten, nicht in einen Test-Fixture: die
-- Registrierung ist Voraussetzung dafür, dass die Route überhaupt
-- funktioniert, und sie muss auf jeder migrierten Datenbank stehen —
-- auch auf einer ohne Demo-Seed. `packages/db/sql/seed_platform_baseline.sql`
-- und `seed_demo_00_platform.sql` führen `finding` zwar auf, aber diese
-- Dateien laufen nur bei `db:seed`/`db:seed-all`, nicht bei `db:migrate-all`.
-- Genau dieselbe Teilursache und dieselbe Lösung hatten schon 0301
-- (`risk_treatment`) und 0310 (`audit`) — dies ist der dritte Fall.
--
-- ── Vollständigkeit statt Einzelfall ────────────────────────────────
-- Eine Gegenprobe über alle `typeKey`-Literale im Anwendungscode gegen
-- `work_item_type` fand nicht einen, sondern FÜNF nicht registrierte
-- Schlüssel — alle auf produktiven POST-Pfaden, alle mit demselben 500:
--
--   finding      apps/web/.../findings/route.ts, .../findings/bulk,
--                .../audit-mgmt/.../create-finding, .../bulk-create-findings
--                (+ Trigger finding_auto_create_work_item)
--   data_breach  apps/web/.../dpms/breaches/route.ts
--   dsr          apps/web/.../dpms/dsr/route.ts
--   ropa_entry   apps/web/.../dpms/ropa/route.ts
--   tia          apps/web/.../dpms/tia/route.ts
--
-- Sie stehen hier zusammen, weil sie ein Defekt sind und nicht fünf.
-- `packages/db/tests/unit/work-item-type-registry.test.ts` hält die
-- Gegenprobe dauerhaft: ein neuer `typeKey` im Code ohne Katalogeintrag
-- macht den Test rot, statt später eine 500 zu erzeugen.
--
-- Idempotent über ON CONFLICT (type_key) DO NOTHING — gleiche Form wie
-- 0301/0310. `primary_module` folgt dem Modulgatter der jeweiligen Route
-- (`requireModule(...)`), nicht der Nav-Gruppierung.

INSERT INTO work_item_type (
  type_key, display_name_de, display_name_en, icon, color_class,
  primary_module, secondary_modules, has_status_workflow, has_responsible_user,
  has_due_date, has_priority, has_linked_asset, has_cia_evaluation,
  is_cross_module, status_enum_name, data_table, data_fk_column,
  element_id_prefix, nav_order, is_active_in_platform
) VALUES
  -- ICS-Feststellung. Nicht zu verwechseln mit 'audit_finding' (Modul audit,
  -- Tabelle audit_finding); diese hier hängt an der Tabelle `finding` und
  -- wird von /api/v1/findings unter requireModule("ics") geschrieben.
  ('finding', 'Feststellung', 'Finding', 'Search', 'text-amber-600',
   'ics', '{audit,erm}', true, true, true, true, false, false,
   true, 'finding_status', 'finding', 'work_item_id', 'FND', 19, true),

  ('data_breach', 'Datenpanne', 'Data Breach', 'ShieldAlert', 'text-red-700',
   'dpms', '{isms}', true, true, true, true, false, false,
   true, NULL, 'data_breach', 'work_item_id', 'DPA', 20, true),

  ('dsr', 'Betroffenenanfrage', 'Data Subject Request', 'UserSearch', 'text-teal-700',
   'dpms', '{}', true, true, true, false, false, false,
   false, NULL, 'dsr', 'work_item_id', 'DSR', 21, true),

  ('ropa_entry', 'Verzeichnis-Eintrag', 'RoPA Entry', 'Database', 'text-teal-600',
   'dpms', '{}', true, true, false, false, false, false,
   false, NULL, 'ropa_entry', 'work_item_id', 'ROP', 22, true),

  ('tia', 'Transfer-Folgenabschätzung', 'Transfer Impact Assessment', 'Globe', 'text-violet-700',
   'dpms', '{}', true, true, true, false, false, false,
   false, NULL, 'tia', 'work_item_id', 'TIA', 23, true)
ON CONFLICT (type_key) DO NOTHING;

-- Selbstprüfung: die fünf Schlüssel müssen danach existieren, sonst hat ein
-- ON-CONFLICT-Zweig sie stillschweigend verschluckt.
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(k ORDER BY k) INTO missing
    FROM unnest(ARRAY['finding','data_breach','dsr','ropa_entry','tia']) AS k
   WHERE NOT EXISTS (SELECT 1 FROM work_item_type t WHERE t.type_key = k);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION '0439: work_item_type fehlt weiterhin: %', missing;
  END IF;
  RAISE NOTICE 'O-4: work_item_type-Katalog vollstaendig (finding, data_breach, dsr, ropa_entry, tia).';
END $$;
