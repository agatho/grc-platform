-- =============================================================================
-- ARCTOS Demo Data Seed — BCMS (Business Continuity Management System)
-- BIA assessments, BCP, procedures, strategies, crisis scenarios, exercises
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000008XX pattern
-- Depends on: seed_demo_data.sql (org, admin user)
--             Processes 0C01-0C03 must exist (process table)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Session config for audit triggers
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('app.current_org_id', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', true);
SELECT set_config('app.current_user_id', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', true);
SELECT set_config('app.current_user_email', 'admin@arctos.dev', true);
SELECT set_config('app.current_user_name', 'Platform Admin', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BIA Assessments (2 campaigns)
-- ─────────────────────────────────────────────────────────────────────────────

-- BIA-001: IT-Kernprozesse Q1 2026 (approved)
INSERT INTO bia_assessment (id, org_id, name, description, status,
  period_start, period_end, lead_assessor_id, approved_by, approved_at, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000801',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'BIA 2026 Q1 IT-Kernprozesse',
  'Business-Impact-Analyse der geschaeftskritischen IT-Prozesse fuer Q1 2026. Umfasst ERP-Betrieb, E-Mail-Infrastruktur und Kundenportal. Ziel: Aktualisierung der RTO/RPO-Werte und Identifikation neuer Abhaengigkeiten nach Cloud-Migration.',
  'approved',
  '2026-01-01',
  '2026-03-31',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-03-15T14:00:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- BIA-002: Verwaltungsprozesse Q2 2026 (in_progress)
INSERT INTO bia_assessment (id, org_id, name, description, status,
  period_start, period_end, lead_assessor_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000802',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'BIA 2026 Q2 Verwaltung',
  'Business-Impact-Analyse der administrativen Kernprozesse: Finanzbuchhaltung, Personalverwaltung, Einkauf und Vertragsmanagement. Fokus auf Abhaengigkeiten zu externen Dienstleistern (DATEV, Banken).',
  'in_progress',
  '2026-04-01',
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BIA Process Impacts (4 entries, 2 per BIA)
-- ─────────────────────────────────────────────────────────────────────────────

-- BIA-001 → Process 0C01 (ERP-Betrieb)
INSERT INTO bia_process_impact (id, org_id, bia_assessment_id, process_id,
  mtpd_hours, rto_hours, rpo_hours,
  impact_1h, impact_4h, impact_24h, impact_72h, impact_1w,
  impact_reputation, impact_legal, impact_operational, impact_financial, impact_safety,
  critical_resources, minimum_staff, alternate_location, peak_periods,
  priority_ranking, is_essential, assessed_by, assessed_at)
VALUES (
  'd0000000-0000-0000-0000-000000000810',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000801',
  'd0000000-0000-0000-0000-000000000c01',
  72, 4, 1,
  15000.00, 60000.00, 350000.00, 1200000.00, 3500000.00,
  4, 3, 5, 5, 1,
  'ERP-Server, Datenbankcluster, SAP-Lizenzen, VPN-Infrastruktur',
  3,
  'Disaster-Recovery-Standort Frankfurt',
  'Monatsabschluss (Arbeitstag 1-5), Jahresabschluss (Januar)',
  1, true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-10T10:00:00Z'
) ON CONFLICT (id) DO NOTHING;

-- BIA-001 → Process 0C02 (E-Mail/Collaboration)
INSERT INTO bia_process_impact (id, org_id, bia_assessment_id, process_id,
  mtpd_hours, rto_hours, rpo_hours,
  impact_1h, impact_4h, impact_24h, impact_72h,
  impact_reputation, impact_legal, impact_operational, impact_financial, impact_safety,
  critical_resources, minimum_staff, alternate_location,
  priority_ranking, is_essential, assessed_by, assessed_at)
VALUES (
  'd0000000-0000-0000-0000-000000000811',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000801',
  'd0000000-0000-0000-0000-000000000c02',
  24, 2, 0,
  5000.00, 25000.00, 150000.00, 500000.00,
  3, 2, 4, 3, 1,
  'Mail-Server, Exchange Online, Backup-MX, DNS-Infrastruktur',
  2,
  'Cloud-Failover via sekundaeren Mail-Provider',
  2, true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-12T14:00:00Z'
) ON CONFLICT (id) DO NOTHING;

-- BIA-002 → Process 0C03 (Finanzbuchhaltung)
INSERT INTO bia_process_impact (id, org_id, bia_assessment_id, process_id,
  mtpd_hours, rto_hours, rpo_hours,
  impact_1h, impact_4h, impact_24h, impact_72h, impact_1w,
  impact_reputation, impact_legal, impact_operational, impact_financial, impact_safety,
  critical_resources, minimum_staff, alternate_location, peak_periods,
  priority_ranking, is_essential, assessed_by, assessed_at)
VALUES (
  'd0000000-0000-0000-0000-000000000812',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000802',
  'd0000000-0000-0000-0000-000000000c03',
  48, 8, 4,
  2000.00, 10000.00, 80000.00, 400000.00, 1500000.00,
  2, 5, 4, 5, 1,
  'DATEV-Zugang, Buchhaltungssoftware, Bankschnittstellen, Belegarchiv',
  2,
  'Homeoffice mit VPN-Zugang',
  'Monatsabschluss, Umsatzsteuer-Voranmeldung (10. des Folgemonats), Jahresabschluss',
  1, true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-04-05T09:00:00Z'
) ON CONFLICT (id) DO NOTHING;

-- BIA-002 → Process 0C01 (Personalverwaltung — same process, different BIA context)
INSERT INTO bia_process_impact (id, org_id, bia_assessment_id, process_id,
  mtpd_hours, rto_hours, rpo_hours,
  impact_1h, impact_4h, impact_24h, impact_72h,
  impact_reputation, impact_legal, impact_operational, impact_financial, impact_safety,
  critical_resources, minimum_staff,
  priority_ranking, is_essential, assessed_by, assessed_at)
VALUES (
  'd0000000-0000-0000-0000-000000000813',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000802',
  'd0000000-0000-0000-0000-000000000c01',
  168, 24, 8,
  500.00, 2000.00, 15000.00, 50000.00,
  2, 4, 3, 3, 1,
  'HR-System, DATEV-Personalabrechnung, Zeiterfassungssystem',
  1,
  2, false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-04-08T11:00:00Z'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BCP — Business Continuity Plan (1 approved plan)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO bcp (id, org_id, title, description, status, version, scope,
  process_ids, bc_manager_id,
  activation_criteria, activation_authority,
  last_tested_date, next_review_date,
  approved_by, approved_at, published_at, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000820',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'IT-Notfallplan Meridian Holdings',
  'Umfassender IT-Notfallplan fuer die Wiederherstellung geschaeftskritischer IT-Systeme nach einem Totalausfall. Deckt die Szenarien Ransomware, Rechenzentrumsausfall und Cloud-Provider-Ausfall ab. Basiert auf den Ergebnissen der BIA Q1 2026.',
  'approved',
  3,
  'Alle geschaeftskritischen IT-Systeme der Meridian Holdings: ERP, E-Mail/Collaboration, Kundenportal, Finanzsysteme. Gilt fuer den Hauptstandort und das DR-Rechenzentrum Frankfurt.',
  ARRAY['d0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'd0000000-0000-0000-0000-000000000c03']::uuid[],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Aktivierung bei: (1) Ausfall von 2+ geschaeftskritischen Systemen > 1h, (2) Ransomware-Befall mit Verschluesselung, (3) physischer Standortausfall, (4) Erklaerung durch Krisenstab.',
  'IT-Leiter oder CISO (Stellvertretung: CTO)',
  '2026-02-15',
  '2026-08-15',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-20T10:00:00Z',
  '2026-01-25T08:00:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BCP Procedures (5 recovery steps)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO bcp_procedure (id, bcp_id, org_id, step_number, title, description,
  responsible_role, responsible_id, estimated_duration_minutes,
  required_resources, prerequisites, success_criteria) VALUES
  ('d0000000-0000-0000-0000-000000000830', 'd0000000-0000-0000-0000-000000000820', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   1, 'Krisenstab einberufen und Lage bewerten',
   'Sofortige Benachrichtigung aller Krisenstabsmitglieder ueber Notfall-Kommunikationskanal (Signal-Gruppe). Erstbewertung der Schadenslage und Entscheidung ueber Eskalationsstufe.',
   'crisis_lead', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', 30,
   'Notfall-Kommunikationskanal (Signal), Krisenhandbuch, Kontaktliste',
   'Vorfall erkannt und erstgemeldet',
   'Krisenstab vollstaendig besetzt, Eskalationsstufe festgelegt, Erstmeldung an Geschaeftsfuehrung erfolgt'),

  ('d0000000-0000-0000-0000-000000000831', 'd0000000-0000-0000-0000-000000000820', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   2, 'Betroffene Systeme isolieren und Schaden begrenzen',
   'Netzwerksegmentierung der betroffenen Systeme, Deaktivierung kompromittierter Accounts, Sicherung fluechtigter Forensik-Daten (RAM-Dumps, Logfiles).',
   'technical', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', 60,
   'Netzwerk-Management-Tools, Forensik-Toolkit, Admin-Zugang zu Firewalls',
   'Krisenstab hat Isolierung freigegeben',
   'Betroffene Systeme vom Netz getrennt, keine weitere Ausbreitung, forensische Sicherung abgeschlossen'),

  ('d0000000-0000-0000-0000-000000000832', 'd0000000-0000-0000-0000-000000000820', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   3, 'DR-Umgebung aktivieren und Kernsysteme wiederherstellen',
   'Aktivierung der Disaster-Recovery-Umgebung am Standort Frankfurt. Wiederherstellung der priorisierten Systeme (ERP, E-Mail, VPN) aus aktuellen Backups gemaess RTO-Vorgaben.',
   'technical', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', 240,
   'DR-Standort Frankfurt, Offline-Backup-Medien, DR-Runbooks, Lizenzschluessel',
   'Isolation abgeschlossen, saubere Backups identifiziert',
   'ERP erreichbar (RTO 4h), E-Mail funktional (RTO 2h), VPN fuer Remote-Zugriff aktiv'),

  ('d0000000-0000-0000-0000-000000000833', 'd0000000-0000-0000-0000-000000000820', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   4, 'Stakeholder-Kommunikation und Meldepflichten',
   'Information der betroffenen Stakeholder: Mitarbeiter (Intranet/E-Mail), Kunden (bei Betroffenheit), Aufsichtsbehoerde (bei Datenschutzvorfall innerhalb 72h), Cyberversicherung.',
   'communication', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', 120,
   'Kommunikationsvorlagen, Kontaktlisten, Zugang zu Meldeplattform der Aufsichtsbehoerde',
   'Schadenslage bewertet, betroffene Daten identifiziert',
   'Alle Pflichtmeldungen fristgerecht abgesetzt, Mitarbeiter informiert, Kunden bei Betroffenheit benachrichtigt'),

  ('d0000000-0000-0000-0000-000000000834', 'd0000000-0000-0000-0000-000000000820', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
   5, 'Normalbetrieb wiederherstellen und Lessons Learned',
   'Schrittweise Rueckfuehrung der Systeme in den Normalbetrieb am Primaerstandort. Integritaetspruefung aller wiederhergestellten Daten. Durchfuehrung eines Post-Incident-Reviews mit allen Beteiligten.',
   'crisis_lead', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', 480,
   'Primaerstandort bereinigt, alle Systeme im DR-Betrieb stabil',
   'DR-Betrieb stabil seit mindestens 24h, Forensik abgeschlossen',
   'Alle Systeme am Primaerstandort wiederhergestellt, Datenintegritaet bestaetigt, Lessons-Learned-Bericht erstellt')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Continuity Strategy (1 active strategy)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO continuity_strategy (id, org_id, process_id, strategy_type, name, description,
  rto_target_hours, rto_actual_hours, estimated_cost_eur, annual_cost_eur,
  effort_hours, cost_currency, cost_note,
  required_staff, required_systems, alternate_location,
  is_active, last_tested_date, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000840',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000c01',
  'active_passive',
  'Active-Passive DR fuer ERP und Kernsysteme',
  'Disaster-Recovery-Strategie mit Active-Passive-Replikation der geschaeftskritischen Systeme zum DR-Standort Frankfurt. Asynchrone Datenbankreplikation (RPO 1h), vorkonfigurierte VMs im Standby. Automatisiertes Failover fuer DNS und Load-Balancing.',
  4, 3,
  120000.00, 48000.00,
  240.00, 'EUR',
  'Einmalig: DR-Infrastruktur aufbauen. Jaehrlich: Colocation Frankfurt, Replikationslizenzen, halbjährliche DR-Tests.',
  3,
  'DR-Server (3x Dell PowerEdge), Replikationssoftware, VPN-Konzentrator, DNS-Failover',
  'Colocation Frankfurt — RZ Interxion FRA1',
  true,
  '2026-02-15',
  'Strategie nach BIA Q1 2026 aktualisiert. RTO-Ziel von 8h auf 4h verschaerft aufgrund gestiegener Geschaeftskritikalitaet des ERP-Systems.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Crisis Scenarios (2 playbooks)
-- ─────────────────────────────────────────────────────────────────────────────

-- Crisis-001: Ransomware (level_3_crisis)
INSERT INTO crisis_scenario (id, org_id, name, description, category, severity, status,
  escalation_matrix, communication_template, bcp_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000850',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Ransomware-Grossangriff',
  'Szenario: Grossflaechiger Ransomware-Angriff mit Verschluesselung mehrerer Produktivsysteme. Moegliche Datenexfiltration. Erfordert sofortige Aktivierung des Krisenstabs und Einschaltung externer Forensik.',
  'cyber_attack',
  'level_3_crisis',
  'standby',
  '[{"level": 1, "trigger": "Einzelnes System betroffen", "action": "IT-Incident-Response-Team aktivieren", "authority": "IT-Leiter"},
    {"level": 2, "trigger": "Mehrere Systeme, laterale Ausbreitung", "action": "Krisenstab einberufen, Netzwerksegmentierung", "authority": "CISO"},
    {"level": 3, "trigger": "Geschaeftskritische Systeme betroffen, Datenexfiltration", "action": "Externe Forensik, Aufsichtsbehoerde, Geschaeftsfuehrung", "authority": "CEO"}]'::jsonb,
  'DRINGEND — Sicherheitsvorfall bei Meridian Holdings

Sehr geehrte Damen und Herren,

wir informieren Sie, dass ein Sicherheitsvorfall festgestellt wurde. Unser Krisenteam arbeitet mit Hochdruck an der Eindaemmung und Behebung.

Aktuelle Lage: [STATUS]
Naechstes Update: [ZEITPUNKT]

Bei Rueckfragen wenden Sie sich bitte an: krisen-hotline@meridian-holdings.example',
  'd0000000-0000-0000-0000-000000000820',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- Crisis-002: Rechenzentrumsausfall (level_2_emergency)
INSERT INTO crisis_scenario (id, org_id, name, description, category, severity, status,
  escalation_matrix, communication_template, bcp_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000851',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Rechenzentrumsausfall — Primaerstandort',
  'Szenario: Totalausfall des primaeren Rechenzentrums durch Stromausfall, Kuehlung oder physischen Schaden (Brand, Wasser). Failover auf DR-Standort Frankfurt erforderlich.',
  'it_outage',
  'level_2_emergency',
  'standby',
  '[{"level": 1, "trigger": "Teilausfall einzelner Racks", "action": "IT-Betrieb informieren, Redundanz pruefen", "authority": "RZ-Leiter"},
    {"level": 2, "trigger": "Totalausfall RZ > 30 Minuten", "action": "DR-Failover einleiten, Krisenstab informieren", "authority": "IT-Leiter"}]'::jsonb,
  'INFORMATION — IT-Stoerung bei Meridian Holdings

Sehr geehrte Kolleginnen und Kollegen,

aufgrund eines Rechenzentrumsproblems sind aktuell einige IT-Systeme eingeschraenkt verfuegbar. Wir arbeiten an der Wiederherstellung.

Betroffene Systeme: [SYSTEME]
Voraussichtliche Wiederherstellung: [ZEITPUNKT]

Bitte nutzen Sie bis auf Weiteres [WORKAROUND].',
  'd0000000-0000-0000-0000-000000000820',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BC Exercise (1 completed tabletop exercise)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO bc_exercise (id, org_id, title, description, exercise_type, status,
  crisis_scenario_id, bcp_id,
  planned_date, planned_duration_hours, actual_date, actual_duration_hours,
  exercise_lead_id,
  objectives, lessons_learned, overall_result, completed_at, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000860',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Tabletop-Uebung Ransomware-Szenario Q1 2026',
  'Planspiel-Uebung zur Validierung des IT-Notfallplans anhand des Ransomware-Szenarios. Teilnehmer: Krisenstab, IT-Leitung, CISO, DSB, Kommunikation. Durchgespielt werden Erkennung, Eindaemmung, Wiederherstellung und Meldepflichten.',
  'tabletop',
  'completed',
  'd0000000-0000-0000-0000-000000000850',
  'd0000000-0000-0000-0000-000000000820',
  '2026-02-15',
  4,
  '2026-02-15',
  5,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '[{"objective": "Krisenstab-Alarmierung innerhalb 15 Minuten", "result": "achieved", "notes": "Alarmierung nach 12 Minuten abgeschlossen"},
    {"objective": "Netzwerksegmentierung innerhalb 30 Minuten", "result": "achieved", "notes": "Firewall-Regeln waren vorbereitet, Umsetzung in 22 Minuten"},
    {"objective": "DR-Failover ERP innerhalb RTO (4h)", "result": "partially_achieved", "notes": "Failover nach 4h 35min — Lizenzaktivierung am DR-Standort dauerte laenger als geplant"},
    {"objective": "72h-Meldung an Aufsichtsbehoerde rechtzeitig", "result": "achieved", "notes": "Meldevorlage war vorbereitet, Prozess klar definiert"}]'::jsonb,
  'Schwachstelle bei Lizenzaktivierung am DR-Standort identifiziert — Offline-Lizenzschluessel muessen kuenftig am DR-Standort hinterlegt werden. Kommunikationsvorlagen fuer Kunden waren nicht aktuell. Insgesamt gute Reaktionszeiten, Krisenstab-Koordination funktioniert.',
  'partially_successful',
  '2026-02-15T17:00:00Z',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
