-- Default KRI Templates — werden beim Org-Create NICHT automatisch
-- angelegt (damit leere Private-Tenants nicht "vollgeseedet" aussehen),
-- stehen aber als catalog-Einträge zur Verfügung damit Admins sie
-- per UI aktivieren können.
--
-- Referenz: ADR-013 (generic catalog table), ISO 31000 6.6.
--
-- Die KRI-Vorlagen folgen branchenueblichen Indikatoren fuer ein
-- GRC-Programm. Jede laesst sich mit einer Metrik-Quelle (z. B.
-- "offene significant_nonconformity findings") verknuepfen und
-- gegen Schwellenwerte alarmieren.

-- Catalog-Metadatum
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'k1000000-0000-0000-0000-000000000000',
  'Default KRI Templates',
  'Plattform-seitig empfohlene Key-Risk-Indikatoren fuer GRC-Programme. Deckt ERM, ISMS, DPMS, BCMS, Audit und TPRM ab.',
  'reference',
  'platform',
  'arctos_default',
  '1.0',
  'de',
  true,
  ARRAY['erm', 'isms', 'dpms', 'bcms', 'audit', 'tprm']
)
ON CONFLICT (source, version) DO NOTHING;

-- KRI Templates als catalog_entry. code = interne Kennung,
-- metadata = JSON mit unit / direction / threshold-Vorschlaegen / Quelle.

INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, description_de, level, sort_order, status, metadata)
VALUES
  -- ERM
  ('e0000001-0000-0000-0000-000000000001', 'k1000000-0000-0000-0000-000000000000',
   'KRI-ERM-01', 'Risks above appetite', 'Risiken ueber Appetite',
   'Count of active risks whose residual score exceeds the declared risk appetite.',
   'Anzahl aktiver Risiken, deren Residualrisiko die Risikoakzeptanz uebersteigt.',
   1, 10, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":3,"threshold_red":10,"source_module":"erm","source_query":"SELECT COUNT(*) FROM risk WHERE risk_appetite_exceeded = true AND deleted_at IS NULL"}'::jsonb),

  ('e0000001-0000-0000-0000-000000000002', 'k1000000-0000-0000-0000-000000000000',
   'KRI-ERM-02', 'Risks without review > 12 months', 'Risiken ohne Review > 12 Monate',
   'Risks whose last review date is older than 12 months (ISO 31000 6.6).',
   'Risiken, deren letztes Review-Datum ueber 12 Monate zurueckliegt (ISO 31000 6.6).',
   1, 20, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":5,"threshold_red":15,"source_module":"erm"}'::jsonb),

  -- ISMS
  ('e0000001-0000-0000-0000-000000000003', 'k1000000-0000-0000-0000-000000000000',
   'KRI-ISMS-01', 'Open critical vulnerabilities', 'Offene kritische Schwachstellen',
   'Count of vulnerabilities with CVSS >= 9.0 that are not remediated.',
   'Anzahl nicht behobener Schwachstellen mit CVSS >= 9.0.',
   1, 30, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":1,"threshold_red":5,"source_module":"isms"}'::jsonb),

  ('e0000001-0000-0000-0000-000000000004', 'k1000000-0000-0000-0000-000000000000',
   'KRI-ISMS-02', 'Security incidents (30d)', 'Sicherheitsvorfaelle (30 Tage)',
   'Confirmed security incidents in the last 30 days.',
   'Bestaetigte Sicherheitsvorfaelle in den letzten 30 Tagen.',
   1, 40, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":1,"threshold_red":3,"source_module":"isms"}'::jsonb),

  -- DPMS
  ('e0000001-0000-0000-0000-000000000005', 'k1000000-0000-0000-0000-000000000000',
   'KRI-DPMS-01', 'DSRs overdue (GDPR Art 12)', 'Ueberfaellige DSR',
   'Data subject requests older than 30 days and not yet completed (GDPR Art. 12(3)).',
   'Betroffenenanfragen aelter als 30 Tage ohne Abschluss (DSGVO Art. 12(3)).',
   1, 50, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":1,"threshold_red":3,"source_module":"dpms"}'::jsonb),

  ('e0000001-0000-0000-0000-000000000006', 'k1000000-0000-0000-0000-000000000000',
   'KRI-DPMS-02', 'Data breaches reported (90d)', 'Datenpannen (90 Tage)',
   'Reported data breaches in the last 90 days (GDPR Art. 33).',
   'Gemeldete Datenpannen in den letzten 90 Tagen (DSGVO Art. 33).',
   1, 60, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":1,"threshold_red":3,"source_module":"dpms"}'::jsonb),

  -- BCMS
  ('e0000001-0000-0000-0000-000000000007', 'k1000000-0000-0000-0000-000000000000',
   'KRI-BCMS-01', 'BCPs without exercise > 12 months', 'BCPs ohne Uebung > 12 Monate',
   'Business continuity plans without a documented exercise in the last 12 months (ISO 22301 8.5).',
   'BCPs ohne dokumentierte Uebung innerhalb der letzten 12 Monate (ISO 22301 8.5).',
   1, 70, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":2,"threshold_red":5,"source_module":"bcms"}'::jsonb),

  -- Audit
  ('e0000001-0000-0000-0000-000000000008', 'k1000000-0000-0000-0000-000000000000',
   'KRI-AUD-01', 'Open significant nonconformities', 'Offene wesentliche Abweichungen',
   'Audit findings with severity significant_nonconformity that are still in identified or in_remediation.',
   'Audit-Feststellungen mit Schweregrad Wesentlich, die noch offen oder in Bearbeitung sind.',
   1, 80, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":1,"threshold_red":3,"source_module":"audit","source_query":"SELECT COUNT(*) FROM finding WHERE severity = ''significant_nonconformity'' AND status IN (''identified'',''in_remediation'') AND deleted_at IS NULL"}'::jsonb),

  ('e0000001-0000-0000-0000-000000000009', 'k1000000-0000-0000-0000-000000000000',
   'KRI-AUD-02', 'Overdue remediation plans', 'Ueberfaellige Massnahmen',
   'Findings with remediation_due_date in the past and still not remediated.',
   'Feststellungen mit ueberschrittener Faelligkeit, die noch nicht behoben sind.',
   1, 90, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":3,"threshold_red":10,"source_module":"audit","source_query":"SELECT COUNT(*) FROM finding WHERE remediation_due_date < CURRENT_DATE AND status IN (''identified'',''in_remediation'') AND deleted_at IS NULL"}'::jsonb),

  -- TPRM
  ('e0000001-0000-0000-0000-00000000000a', 'k1000000-0000-0000-0000-000000000000',
   'KRI-TPRM-01', 'Vendors without DD review', 'Lieferanten ohne DD-Review',
   'Critical vendors with no due diligence review in the last 24 months (LkSG requirement).',
   'Kritische Lieferanten ohne Due-Diligence-Review in den letzten 24 Monaten (LkSG).',
   1, 100, 'active',
   '{"unit":"count","direction":"desc","threshold_green":0,"threshold_yellow":2,"threshold_red":5,"source_module":"tprm"}'::jsonb)
ON CONFLICT (catalog_id, code) DO NOTHING;
