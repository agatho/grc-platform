-- ============================================================================
-- [ARCTOS-FULL-2026-08-31 · OP-268] ISO 27001 Annex A als TYPISIERTER Katalog
-- ============================================================================
--
-- Projiziert die 97 Annex-A-Eintraege aus der generischen Tabelle
-- `catalog_entry` (gefuellt von `seed_catalog_iso27001_annex_a.sql`) in die
-- typisierte Tabelle `control_catalog_entry`. Das sind
-- MANDANTENUNABHAENGIGE Referenzdaten: kein `org_id`, kein Bezug auf eine
-- Demo-Organisation.
--
-- Diese beiden Schritte standen bis zum 2026-09-15 in
-- `fix_soa_annex_a.sql` — zusammen mit einem dritten, der `soa_entry`-Zeilen
-- fuer die Demo-Organisation `c2446a5c-…` anlegt. Genau diese Vermischung
-- war zweimal die Ursache eines Ausfalls:
--
--   * OP-208 (Welle 6C): die Datei stand in `REFERENCE_SEEDS`, also vor
--     `seed_demo_00_platform.sql`, das die Organisation erst anlegt. Der
--     Runner fuehrt jede Datei in EINER Transaktion aus — Schritt 3 verletzte
--     den Fremdschluessel und nahm die Schritte 1 und 2 mit zurueck. Ohne
--     `control_catalog_entry` fand der SoA-Teil von
--     `seed_demo_01_assets_isms.sql` nichts, brach ab und nahm Assets,
--     Bedrohungen und Schwachstellen mit; ohne Assets stirbt
--     `seed_demo_15_cve.sql`. Ein Fehler, drei tote Dateien.
--   * OP-268: dieselbe Wirkung in `seed-all.ts`, wo die Behebung von OP-208
--     nie ankam. Dort gibt es `seed_demo_00_platform.sql` ueberhaupt nicht,
--     die Organisation entsteht also nie — ein blosses Verschieben des
--     Listeneintrags haette den Fehler dorthin verlagert statt ihn zu
--     beheben.
--
-- Referenzdaten und Demo-Daten sind getrennt, weil sie verschiedene
-- Voraussetzungen haben. Das ist die Lehre, nicht die Reihenfolge.
-- ============================================================================

-- Schritt 1: Katalog-Kopf
INSERT INTO control_catalog (id, name, description, version, source, language, entry_count, is_system, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270010000106',
  'ISO/IEC 27001:2022 Annex A',
  'ISO 27001:2022 Annex A Controls for Statement of Applicability',
  '2022',
  'iso_27001_2022_annex_a',
  'de',
  97,
  true,
  true,
  '{isms,ics}'
) ON CONFLICT (id) DO NOTHING;

-- Schritt 2: Eintraege aus `catalog_entry` uebernehmen
INSERT INTO control_catalog_entry (id, catalog_id, code, title_de, title_en, description_de, description_en, level, sort_order, is_active)
SELECT
  ce.id,
  'c0000000-0000-0000-0000-270010000106',
  ce.code,
  COALESCE(ce.name_de, ce.name),
  ce.name,
  ce.description_de,
  ce.description,
  CASE WHEN ce.code ~ '^A\.\d+$' THEN 1 ELSE 2 END,
  COALESCE(ce.sort_order, 0),
  true
FROM catalog_entry ce
WHERE ce.catalog_id = 'c0000000-0000-0000-0000-270010000006'
  AND ce.status = 'active'
ON CONFLICT (id) DO NOTHING;
