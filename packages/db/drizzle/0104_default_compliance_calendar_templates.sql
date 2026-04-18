-- Default Compliance-Calendar-Templates
--
-- Wie bei 0103 (KRI-Templates) werden diese als catalog + catalog_entry
-- geseedet, NICHT automatisch in compliance_calendar_event geschrieben.
-- Admins koennen sie per UI "Aus Vorlage erstellen" in ihren Org-Kalender
-- uebernehmen.
--
-- Abdeckung: wiederkehrende Compliance-Meilensteine aus ISO 27001, NIS2,
-- DORA, GDPR, CSRD, ISO 31000. Monat/Tag sind Heuristiken auf Basis
-- typischer Geschaeftsjahr-Kalender (FY = CY, sonst per Tenant anpassen).

-- Catalog-Metadatum
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c1040000-0000-0000-0000-000000000000',
  'Default Compliance-Calendar-Templates',
  'Plattform-seitig empfohlene wiederkehrende Compliance-Ereignisse: Management-Review, Audit-Plan-Review, DPIA-Review, Penetration-Tests, Business-Impact-Analysis, Regulatory-Reporting-Fristen.',
  'reference',
  'platform',
  'arctos_default',
  '1.0',
  'de',
  true,
  ARRAY['erm', 'isms', 'dpms', 'bcms', 'audit', 'tprm', 'esg']
)
ON CONFLICT (source, version) DO NOTHING;

-- Template-Eintraege.
-- metadata-Schema:
--   {
--     "event_type": "review|deadline|training|workshop",
--     "recurrence": "annually|quarterly|monthly",
--     "default_month": 1-12,
--     "default_day": 1-28,
--     "duration_days": int,
--     "responsible_role": "admin|risk_manager|...",
--     "framework_refs": ["ISO 27001 9.3", "NIS2 Art. 20", ...]
--   }

INSERT INTO catalog_entry (catalog_id, code, title, description, metadata, module_scope, display_order)
VALUES
  ('c1040000-0000-0000-0000-000000000000', 'MGMT_REVIEW_Q1',
   'ISMS Management Review (Q1)',
   'Vierteljaehrliches ISMS-Management-Review gemaess ISO 27001 Clause 9.3. Eingangsdaten: Audit-Ergebnisse, KRI-Trends, Risk-Appetite-Abweichungen.',
   '{"event_type":"review","recurrence":"annually","default_month":3,"default_day":15,"duration_days":1,"responsible_role":"admin","framework_refs":["ISO 27001 9.3","NIS2 Art. 20(1)"]}'::jsonb,
   'isms', 1),

  ('c1040000-0000-0000-0000-000000000000', 'MGMT_REVIEW_Q3',
   'ISMS Management Review (Q3)',
   'Halbjaehrliches Review mit Fokus auf Metrik-Trends und Korrektur-Massnahmen aus Q1.',
   '{"event_type":"review","recurrence":"annually","default_month":9,"default_day":15,"duration_days":1,"responsible_role":"admin","framework_refs":["ISO 27001 9.3"]}'::jsonb,
   'isms', 2),

  ('c1040000-0000-0000-0000-000000000000', 'INTERNAL_AUDIT_PLAN_REVIEW',
   'Interner Audit-Plan Review',
   'Jaehrliche Genehmigung des 3-Jahres-Audit-Plans durch Audit-Committee. Basis: Risk-Universe + Vorjahres-Findings.',
   '{"event_type":"review","recurrence":"annually","default_month":1,"default_day":31,"duration_days":1,"responsible_role":"auditor","framework_refs":["IIA Standards 2024","ISO 27001 9.2"]}'::jsonb,
   'audit', 3),

  ('c1040000-0000-0000-0000-000000000000', 'DPIA_REVIEW',
   'DPIA-Review (Datenschutz-Folgenabschaetzungen)',
   'Jaehrliches Review aller aktiven DPIAs auf Aktualitaet (Zweckaenderung, neue Risiken, neue Rechtslage).',
   '{"event_type":"review","recurrence":"annually","default_month":4,"default_day":30,"duration_days":5,"responsible_role":"dpo","framework_refs":["GDPR Art. 35"]}'::jsonb,
   'dpms', 4),

  ('c1040000-0000-0000-0000-000000000000', 'PENTEST_ANNUAL',
   'Jaehrlicher Penetration-Test',
   'Externer Pentest der oeffentlich exponierten Systeme. Vorbereitung: Scope-Definition, Out-of-Scope-Liste, Eskalationspfad.',
   '{"event_type":"deadline","recurrence":"annually","default_month":6,"default_day":15,"duration_days":14,"responsible_role":"admin","framework_refs":["ISO 27001 A.8.8","DORA Art. 26"]}'::jsonb,
   'isms', 5),

  ('c1040000-0000-0000-0000-000000000000', 'BIA_REVIEW',
   'Business-Impact-Analysis Review',
   'Jaehrliches Review der BIA — aktualisierte RTO/RPO-Ziele, neue kritische Prozesse, neue Assets.',
   '{"event_type":"review","recurrence":"annually","default_month":10,"default_day":31,"duration_days":5,"responsible_role":"risk_manager","framework_refs":["ISO 22301 8.2","DORA Art. 11"]}'::jsonb,
   'bcms', 6),

  ('c1040000-0000-0000-0000-000000000000', 'BCP_EXERCISE',
   'BCP-Uebung (Tabletop)',
   'Halbjaehrliche Tabletop-Uebung zu einem Crisis-Szenario. Nachweis: Uebungs-Protokoll + Lessons-Learned.',
   '{"event_type":"workshop","recurrence":"quarterly","default_month":5,"default_day":15,"duration_days":1,"responsible_role":"risk_manager","framework_refs":["ISO 22301 8.5","DORA Art. 25"]}'::jsonb,
   'bcms', 7),

  ('c1040000-0000-0000-0000-000000000000', 'VENDOR_REVIEW_CRITICAL',
   'Review kritischer Third-Party',
   'Jaehrliches Due-Diligence-Review aller Vendors mit Kritikalitaet high/critical.',
   '{"event_type":"review","recurrence":"annually","default_month":11,"default_day":30,"duration_days":10,"responsible_role":"risk_manager","framework_refs":["DORA Art. 28","LkSG Sec. 5"]}'::jsonb,
   'tprm', 8),

  ('c1040000-0000-0000-0000-000000000000', 'SOA_REVIEW',
   'Statement-of-Applicability Review',
   'Jaehrliches Review der SoA (93 Annex A Kontrollen + Custom). Abgleich mit Risk-Treatment-Plan.',
   '{"event_type":"review","recurrence":"annually","default_month":2,"default_day":28,"duration_days":3,"responsible_role":"admin","framework_refs":["ISO 27001 6.1.3d"]}'::jsonb,
   'isms', 9),

  ('c1040000-0000-0000-0000-000000000000', 'RISK_APPETITE_REVIEW',
   'Risk-Appetite-Review',
   'Jaehrliche Bestaetigung oder Anpassung der Risk-Appetite-Statements durch die Geschaeftsfuehrung.',
   '{"event_type":"review","recurrence":"annually","default_month":1,"default_day":15,"duration_days":1,"responsible_role":"admin","framework_refs":["COSO ERM 2017","ISO 31000 6.3"]}'::jsonb,
   'erm', 10),

  ('c1040000-0000-0000-0000-000000000000', 'NIS2_REPORT_Q',
   'NIS2 Quartals-Reporting (Behoerde)',
   'Falls meldepflichtige Einrichtung: quartalsweises Progress-Update an zustaendige Behoerde (BSI DE) zu offenen Incidents und Corrective-Actions.',
   '{"event_type":"deadline","recurrence":"quarterly","default_month":3,"default_day":31,"duration_days":1,"responsible_role":"admin","framework_refs":["NIS2 Art. 21(4)(d)"]}'::jsonb,
   'isms', 11),

  ('c1040000-0000-0000-0000-000000000000', 'GDPR_BREACH_REGISTER_REVIEW',
   'GDPR-Breach-Register Review',
   'Halbjaehrliches Review aller data_breach-Eintraege auf Nachmeldungen, Abschluesse und Behoerden-Antworten.',
   '{"event_type":"review","recurrence":"annually","default_month":6,"default_day":30,"duration_days":2,"responsible_role":"dpo","framework_refs":["GDPR Art. 33(5)"]}'::jsonb,
   'dpms', 12),

  ('c1040000-0000-0000-0000-000000000000', 'CSRD_DATA_COLLECTION',
   'CSRD/ESRS-Datenerhebung',
   'Jaehrliche Sammlung der ESRS-Datenpunkte fuer den Nachhaltigkeitsbericht. Start Q4 des Berichtsjahres, Fertigstellung Q1 des Folgejahres.',
   '{"event_type":"deadline","recurrence":"annually","default_month":10,"default_day":1,"duration_days":120,"responsible_role":"admin","framework_refs":["CSRD Art. 29a","ESRS"]}'::jsonb,
   'esg', 13),

  ('c1040000-0000-0000-0000-000000000000', 'SECURITY_AWARENESS_TRAINING',
   'Security-Awareness-Training (alle Mitarbeiter)',
   'Jaehrliches Pflicht-Training fuer alle Mitarbeiter. Nachweis via Absolvierungs-Quote in Compliance-Culture-Modul.',
   '{"event_type":"training","recurrence":"annually","default_month":5,"default_day":1,"duration_days":30,"responsible_role":"admin","framework_refs":["ISO 27001 7.3","NIS2 Art. 20(2)(g)"]}'::jsonb,
   'isms', 14),

  ('c1040000-0000-0000-0000-000000000000', 'VULN_SCAN_MONTHLY',
   'Monatlicher Vulnerability-Scan',
   'Automatisierter Scan der Infrastruktur + Review neuer CVEs gegen Asset-Inventar.',
   '{"event_type":"deadline","recurrence":"monthly","default_month":1,"default_day":1,"duration_days":1,"responsible_role":"admin","framework_refs":["ISO 27001 A.8.8","CIS IG1 7.1"]}'::jsonb,
   'isms', 15)

ON CONFLICT (catalog_id, code) DO NOTHING;
