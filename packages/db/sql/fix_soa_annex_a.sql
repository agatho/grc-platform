-- ============================================================================
-- SoA-Zeilen fuer ALLE Annex-A-Kontrollen der Demo-Organisation
-- ============================================================================
--
-- [ARCTOS-FULL-2026-08-31 · OP-268, 2026-09-15] Die Schritte 1 und 2 dieser
-- Datei — Katalog-Kopf und Projektion nach `control_catalog_entry` — stehen
-- jetzt in `seed_control_catalog_annex_a.sql` und laufen als
-- REFERENZ-Seed. Hier bleibt nur, was eine Organisation voraussetzt.
--
-- Der Grund steht ausfuehrlich in der neuen Datei: Referenzdaten und
-- Demo-Daten in EINER Transaktion zu mischen hat zweimal dafuer gesorgt,
-- dass ein Fremdschluesselfehler im org-abhaengigen Teil die
-- mandantenunabhaengigen Schritte mit zurueckgerollt hat (OP-208, OP-268).
--
-- Voraussetzung: `seed_control_catalog_annex_a.sql` (REFERENCE_SEEDS) und
-- `seed_demo_00_platform.sql`, das die Organisation anlegt. Diese Datei
-- gehoert deshalb in DEMO_SEEDS, hinter beide.
-- ============================================================================

INSERT INTO soa_entry (org_id, catalog_entry_id, applicability, implementation, created_at, updated_at)
SELECT
  'c2446a5c-64f1-40a7-862a-8ab084f66f41',
  cce.id,
  'applicable',
  'not_implemented',
  now(),
  now()
FROM control_catalog_entry cce
WHERE cce.catalog_id = 'c0000000-0000-0000-0000-270010000106'
  AND cce.is_active = true
  AND cce.code LIKE 'A.%.%'  -- nur Blattkontrollen, keine Gruppenueberschriften
ON CONFLICT (org_id, catalog_entry_id) DO NOTHING;
