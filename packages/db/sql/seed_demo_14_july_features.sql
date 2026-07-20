-- =============================================================================
-- ARCTOS Demo Data Seed 14 — Juli-2026-Features (Alpha-Demo-Top-up)
-- =============================================================================
-- Befüllt die im Juli 2026 gebauten Features mit Demo-Daten für die Demo-Org
-- (Meridian Demo Tenant, ccc4cc1c):
--
--   1. Prozesslandkarte     — map_category/map_sequence für Bestandsprozesse
--                             + 4 neue Level-1-Prozesse (management/core) +
--                             2 Kindprozesse + Call-Activity-Link
--   2. Freigabekette        — abgeschlossene review→approval-Kette + 2
--                             Kenntnisnahme-Steps (1 completed, 1 pending)
--                             für den published Incident-Response-Prozess
--   3. Management-Review    — 1 completed Review Q2/2026 mit 5 strukturierten
--                             Items + 1 planned Review (nächste Woche)
--   4. DMS                  — KI-Nutzungsrichtlinie mit 3 Versionen
--                             (1.0 → 1.1 → 2.0, Effective-Dating-Kette) +
--                             completed Signaturanfrage mit 2 Signern und
--                             mathematisch korrekter Hash-Kette (pgcrypto)
--   5. Risk-Acceptance      — 2 aktive Akzeptanzen (eine läuft 2026-08-10 ab
--                             → Expiry-Highlight) + Authority-Matrix
--   6. Retention-Policy     — "Aufbewahrung 10 Jahre (GoBD)", zugewiesen an
--                             die Informationssicherheitsrichtlinie (DOC-001)
--
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING (ohne Target, damit auch
-- sekundäre Unique-Constraints wie (process_id, version_number, step_order)
-- abgefangen werden) bzw. UPDATE ... WHERE ... IS NULL Guards.
-- Deterministische UUIDs: d0000000-0000-0000-0000-0000000014XX
-- Depends on: seed_demo_00_platform.sql (Org/User), seed_demo_data.sql
--             (Risiken 0101-0105), seed_demo_08_documents.sql (DOC-001),
--             seed_demo_09_processes.sql (Prozesse 0C01-0C03),
--             Migrationen 0349a, 0353, 0355, 0360, 0363, 0369, 0373-0375.
--
-- Hash-Ketten-Hinweis (document_signature): content_hash/chain_hash werden
-- hier per pgcrypto digest() exakt nach dem kanonischen Payload-Format aus
-- apps/web/src/lib/documents/signature-chain.ts berechnet (JSON mit
-- sortierten Keys, keine Whitespaces; chain = SHA-256(prev || content)).
-- Die signed_at-Timestamps sind millisekundengenau (.000) gesetzt, damit
-- die Verify-Route (Date.toISOString()-Roundtrip) dieselben Strings
-- rekonstruiert. Feld-Reihenfolge NICHT ändern:
--   {"decision","documentId","fileSha256","signedAt","signerUserId","versionId"}
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Session config for audit triggers + RLS (FORCE-RLS-Tabellen: risk_acceptance,
-- management_review_item, document_signature_request, document_signature)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('app.current_org_id', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', true);
SELECT set_config('app.current_user_id', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', true);
SELECT set_config('app.current_user_email', 'admin@arctos.dev', true);
SELECT set_config('app.current_user_name', 'Platform Admin', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Prozesslandkarte
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Bestandsprozesse (seed_demo_09) in das Support-Band einsortieren.
--     Guard: nur wenn noch keine Kategorie manuell gesetzt wurde.
UPDATE process SET map_category = 'support', map_sequence = 10
WHERE id = 'd0000000-0000-0000-0000-000000000C01' AND map_category IS NULL; -- Incident-Response

UPDATE process SET map_category = 'support', map_sequence = 20
WHERE id = 'd0000000-0000-0000-0000-000000000C02' AND map_category IS NULL; -- Change-Management

UPDATE process SET map_category = 'support', map_sequence = 30
WHERE id = 'd0000000-0000-0000-0000-000000000C03' AND map_category IS NULL; -- Lieferanten-Onboarding

-- 1b. Neue Level-1-Prozesse: Management-Band
INSERT INTO process (id, org_id, name, description, level, notation, status,
  process_owner_id, department, current_version, is_essential, published_at,
  map_category, map_sequence, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001401',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Managementbewertung und Governance',
  'Jährlicher Steuerungsprozess der Geschäftsführung: Management-Review nach ISO 27001 Kap. 9.3, Zielableitung, Ressourcenfreigabe und Nachverfolgung der Beschlüsse aus Vorreviews.',
  1, 'bpmn', 'published',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', 'Geschäftsführung', 1, false,
  '2026-02-01 09:00:00+01',
  'management', 10,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process (id, org_id, name, description, level, notation, status,
  process_owner_id, department, current_version, is_essential, published_at,
  map_category, map_sequence, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001402',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Risikomanagement-Prozess',
  'Konzernweiter ERM-Regelkreis: Risikoidentifikation, Bewertung (inhärent/residual), Behandlungsplanung und quartalsweises Reporting an den Risikoausschuss gemäß ISO 31000.',
  1, 'bpmn', 'published',
  'e1f2a3b4-c5d6-7890-4567-bcdef0123456', 'Risikomanagement', 1, true,
  '2026-02-01 09:30:00+01',
  'management', 20,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- 1c. Neue Level-1-Prozesse: Core-Band
INSERT INTO process (id, org_id, name, description, level, notation, status,
  process_owner_id, department, current_version, is_essential, published_at,
  map_category, map_sequence, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001403',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Auftragsabwicklung Textilservice',
  'Kernwertschöpfung der Meridian-Gruppe: Auftragsannahme, Tourenplanung, Bearbeitung im Werk und Auslieferung an den Kunden. Kritischer Prozess mit BIA-Verknüpfung.',
  1, 'bpmn', 'published',
  'f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'Operations', 1, true,
  '2026-03-10 08:00:00+01',
  'core', 10,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process (id, org_id, name, description, level, notation, status,
  process_owner_id, department, current_version, is_essential, published_at,
  map_category, map_sequence, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001404',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Kundenservice und Reklamationsmanagement',
  'Annahme, Klassifizierung und Bearbeitung von Kundenanliegen und Reklamationen inkl. Ursachenanalyse und Rückkopplung in die Qualitätsplanung (ISO 9001 Kap. 10.2).',
  1, 'bpmn', 'published',
  'a7b8c9d0-e1f2-3456-0123-789abcdef012', 'Kundenservice', 1, false,
  '2026-03-10 08:30:00+01',
  'core', 20,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- 1d. Kindprozesse (Level 2) unter der Auftragsabwicklung
INSERT INTO process (id, org_id, parent_process_id, name, description, level,
  notation, status, process_owner_id, department, current_version, is_essential,
  published_at, map_category, map_sequence, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001405',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001403',
  'Tourenplanung und Logistik',
  'Teilprozess der Auftragsabwicklung: Routenoptimierung, Fahrzeugdisposition und Zeitfensterplanung für Hol- und Bringservice.',
  2, 'bpmn', 'published',
  'f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'Logistik', 1, false,
  '2026-03-12 10:00:00+01',
  NULL, NULL, -- erbt das Core-Band vom Parent auf der Landkarte
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process (id, org_id, parent_process_id, name, description, level,
  notation, status, process_owner_id, department, current_version, is_essential,
  published_at, map_category, map_sequence, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001406',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001403',
  'Wareneingang und Sortierung',
  'Teilprozess der Auftragsabwicklung: Annahme der Rückläufer, Sortierung nach Behandlungsklassen und Chargenbildung für die Werksbearbeitung.',
  2, 'bpmn', 'published',
  'f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'Operations', 1, false,
  '2026-03-12 10:30:00+01',
  NULL, NULL,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- 1e. Prozessversionen (v1, current) mit einfachem BPMN-XML
INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001411',
  'd0000000-0000-0000-0000-000000001401',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Def_1401" targetNamespace="http://arctos.dev/bpmn"><bpmn:process id="Process_1401" isExecutable="false"><bpmn:startEvent id="Start_1401" name="Reviewzyklus faellig"><bpmn:outgoing>Flow_1401_1</bpmn:outgoing></bpmn:startEvent><bpmn:task id="Task_MR_Inputs" name="9.3-Inputs sammeln"><bpmn:incoming>Flow_1401_1</bpmn:incoming><bpmn:outgoing>Flow_1401_2</bpmn:outgoing></bpmn:task><bpmn:task id="Task_MR_Sitzung" name="Management-Review durchfuehren"><bpmn:incoming>Flow_1401_2</bpmn:incoming><bpmn:outgoing>Flow_1401_3</bpmn:outgoing></bpmn:task><bpmn:task id="Task_MR_Beschluesse" name="Beschluesse nachverfolgen"><bpmn:incoming>Flow_1401_3</bpmn:incoming><bpmn:outgoing>Flow_1401_4</bpmn:outgoing></bpmn:task><bpmn:endEvent id="End_1401" name="Review abgeschlossen"><bpmn:incoming>Flow_1401_4</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="Flow_1401_1" sourceRef="Start_1401" targetRef="Task_MR_Inputs"/><bpmn:sequenceFlow id="Flow_1401_2" sourceRef="Task_MR_Inputs" targetRef="Task_MR_Sitzung"/><bpmn:sequenceFlow id="Flow_1401_3" sourceRef="Task_MR_Sitzung" targetRef="Task_MR_Beschluesse"/><bpmn:sequenceFlow id="Flow_1401_4" sourceRef="Task_MR_Beschluesse" targetRef="End_1401"/></bpmn:process><bpmndi:BPMNDiagram id="Diag_1401"><bpmndi:BPMNPlane id="Plane_1401" bpmnElement="Process_1401"><bpmndi:BPMNShape id="Start_1401_di" bpmnElement="Start_1401"><dc:Bounds x="152" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_MR_Inputs_di" bpmnElement="Task_MR_Inputs"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_MR_Sitzung_di" bpmnElement="Task_MR_Sitzung"><dc:Bounds x="390" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_MR_Beschluesse_di" bpmnElement="Task_MR_Beschluesse"><dc:Bounds x="540" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_1401_di" bpmnElement="End_1401"><dc:Bounds x="692" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1401_1_di" bpmnElement="Flow_1401_1"><di:waypoint x="188" y="120"/><di:waypoint x="240" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1401_2_di" bpmnElement="Flow_1401_2"><di:waypoint x="340" y="120"/><di:waypoint x="390" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1401_3_di" bpmnElement="Flow_1401_3"><di:waypoint x="490" y="120"/><di:waypoint x="540" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1401_4_di" bpmnElement="Flow_1401_4"><di:waypoint x="640" y="120"/><di:waypoint x="692" y="120"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
  'Initiale Version des Governance-Prozesses (Landkarten-Demo).',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001412',
  'd0000000-0000-0000-0000-000000001402',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Def_1402" targetNamespace="http://arctos.dev/bpmn"><bpmn:process id="Process_1402" isExecutable="false"><bpmn:startEvent id="Start_1402" name="Quartalszyklus"><bpmn:outgoing>Flow_1402_1</bpmn:outgoing></bpmn:startEvent><bpmn:task id="Task_RM_Ident" name="Risiken identifizieren"><bpmn:incoming>Flow_1402_1</bpmn:incoming><bpmn:outgoing>Flow_1402_2</bpmn:outgoing></bpmn:task><bpmn:task id="Task_RM_Bewertung" name="Risiken bewerten"><bpmn:incoming>Flow_1402_2</bpmn:incoming><bpmn:outgoing>Flow_1402_3</bpmn:outgoing></bpmn:task><bpmn:task id="Task_RM_Report" name="Risikobericht erstellen"><bpmn:incoming>Flow_1402_3</bpmn:incoming><bpmn:outgoing>Flow_1402_4</bpmn:outgoing></bpmn:task><bpmn:endEvent id="End_1402" name="Berichtet"><bpmn:incoming>Flow_1402_4</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="Flow_1402_1" sourceRef="Start_1402" targetRef="Task_RM_Ident"/><bpmn:sequenceFlow id="Flow_1402_2" sourceRef="Task_RM_Ident" targetRef="Task_RM_Bewertung"/><bpmn:sequenceFlow id="Flow_1402_3" sourceRef="Task_RM_Bewertung" targetRef="Task_RM_Report"/><bpmn:sequenceFlow id="Flow_1402_4" sourceRef="Task_RM_Report" targetRef="End_1402"/></bpmn:process><bpmndi:BPMNDiagram id="Diag_1402"><bpmndi:BPMNPlane id="Plane_1402" bpmnElement="Process_1402"><bpmndi:BPMNShape id="Start_1402_di" bpmnElement="Start_1402"><dc:Bounds x="152" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_RM_Ident_di" bpmnElement="Task_RM_Ident"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_RM_Bewertung_di" bpmnElement="Task_RM_Bewertung"><dc:Bounds x="390" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_RM_Report_di" bpmnElement="Task_RM_Report"><dc:Bounds x="540" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_1402_di" bpmnElement="End_1402"><dc:Bounds x="692" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1402_1_di" bpmnElement="Flow_1402_1"><di:waypoint x="188" y="120"/><di:waypoint x="240" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1402_2_di" bpmnElement="Flow_1402_2"><di:waypoint x="340" y="120"/><di:waypoint x="390" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1402_3_di" bpmnElement="Flow_1402_3"><di:waypoint x="490" y="120"/><di:waypoint x="540" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1402_4_di" bpmnElement="Flow_1402_4"><di:waypoint x="640" y="120"/><di:waypoint x="692" y="120"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
  'Initiale Version des ERM-Regelkreises (Landkarten-Demo).',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001413',
  'd0000000-0000-0000-0000-000000001403',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Def_1403" targetNamespace="http://arctos.dev/bpmn"><bpmn:process id="Process_1403" isExecutable="false"><bpmn:startEvent id="Start_1403" name="Auftrag eingegangen"><bpmn:outgoing>Flow_1403_1</bpmn:outgoing></bpmn:startEvent><bpmn:task id="Task_OA_Annahme" name="Auftrag annehmen und pruefen"><bpmn:incoming>Flow_1403_1</bpmn:incoming><bpmn:outgoing>Flow_1403_2</bpmn:outgoing></bpmn:task><bpmn:callActivity id="CallActivity_OA_Touren" name="Tourenplanung und Logistik"><bpmn:incoming>Flow_1403_2</bpmn:incoming><bpmn:outgoing>Flow_1403_3</bpmn:outgoing></bpmn:callActivity><bpmn:task id="Task_OA_Auslieferung" name="Bearbeitung und Auslieferung"><bpmn:incoming>Flow_1403_3</bpmn:incoming><bpmn:outgoing>Flow_1403_4</bpmn:outgoing></bpmn:task><bpmn:endEvent id="End_1403" name="Auftrag abgeschlossen"><bpmn:incoming>Flow_1403_4</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="Flow_1403_1" sourceRef="Start_1403" targetRef="Task_OA_Annahme"/><bpmn:sequenceFlow id="Flow_1403_2" sourceRef="Task_OA_Annahme" targetRef="CallActivity_OA_Touren"/><bpmn:sequenceFlow id="Flow_1403_3" sourceRef="CallActivity_OA_Touren" targetRef="Task_OA_Auslieferung"/><bpmn:sequenceFlow id="Flow_1403_4" sourceRef="Task_OA_Auslieferung" targetRef="End_1403"/></bpmn:process><bpmndi:BPMNDiagram id="Diag_1403"><bpmndi:BPMNPlane id="Plane_1403" bpmnElement="Process_1403"><bpmndi:BPMNShape id="Start_1403_di" bpmnElement="Start_1403"><dc:Bounds x="152" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_OA_Annahme_di" bpmnElement="Task_OA_Annahme"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="CallActivity_OA_Touren_di" bpmnElement="CallActivity_OA_Touren"><dc:Bounds x="390" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_OA_Auslieferung_di" bpmnElement="Task_OA_Auslieferung"><dc:Bounds x="540" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_1403_di" bpmnElement="End_1403"><dc:Bounds x="692" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1403_1_di" bpmnElement="Flow_1403_1"><di:waypoint x="188" y="120"/><di:waypoint x="240" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1403_2_di" bpmnElement="Flow_1403_2"><di:waypoint x="340" y="120"/><di:waypoint x="390" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1403_3_di" bpmnElement="Flow_1403_3"><di:waypoint x="490" y="120"/><di:waypoint x="540" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1403_4_di" bpmnElement="Flow_1403_4"><di:waypoint x="640" y="120"/><di:waypoint x="692" y="120"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
  'Initiale Version der Auftragsabwicklung mit Call-Activity auf die Tourenplanung.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001414',
  'd0000000-0000-0000-0000-000000001404',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Def_1404" targetNamespace="http://arctos.dev/bpmn"><bpmn:process id="Process_1404" isExecutable="false"><bpmn:startEvent id="Start_1404" name="Anliegen eingegangen"><bpmn:outgoing>Flow_1404_1</bpmn:outgoing></bpmn:startEvent><bpmn:task id="Task_KS_Klassifizierung" name="Anliegen klassifizieren"><bpmn:incoming>Flow_1404_1</bpmn:incoming><bpmn:outgoing>Flow_1404_2</bpmn:outgoing></bpmn:task><bpmn:task id="Task_KS_Bearbeitung" name="Reklamation bearbeiten"><bpmn:incoming>Flow_1404_2</bpmn:incoming><bpmn:outgoing>Flow_1404_3</bpmn:outgoing></bpmn:task><bpmn:endEvent id="End_1404" name="Anliegen geloest"><bpmn:incoming>Flow_1404_3</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="Flow_1404_1" sourceRef="Start_1404" targetRef="Task_KS_Klassifizierung"/><bpmn:sequenceFlow id="Flow_1404_2" sourceRef="Task_KS_Klassifizierung" targetRef="Task_KS_Bearbeitung"/><bpmn:sequenceFlow id="Flow_1404_3" sourceRef="Task_KS_Bearbeitung" targetRef="End_1404"/></bpmn:process><bpmndi:BPMNDiagram id="Diag_1404"><bpmndi:BPMNPlane id="Plane_1404" bpmnElement="Process_1404"><bpmndi:BPMNShape id="Start_1404_di" bpmnElement="Start_1404"><dc:Bounds x="152" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_KS_Klassifizierung_di" bpmnElement="Task_KS_Klassifizierung"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_KS_Bearbeitung_di" bpmnElement="Task_KS_Bearbeitung"><dc:Bounds x="390" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_1404_di" bpmnElement="End_1404"><dc:Bounds x="542" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1404_1_di" bpmnElement="Flow_1404_1"><di:waypoint x="188" y="120"/><di:waypoint x="240" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1404_2_di" bpmnElement="Flow_1404_2"><di:waypoint x="340" y="120"/><di:waypoint x="390" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1404_3_di" bpmnElement="Flow_1404_3"><di:waypoint x="490" y="120"/><di:waypoint x="542" y="120"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
  'Initiale Version des Kundenservice-Prozesses (Landkarten-Demo).',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001415',
  'd0000000-0000-0000-0000-000000001405',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Def_1405" targetNamespace="http://arctos.dev/bpmn"><bpmn:process id="Process_1405" isExecutable="false"><bpmn:startEvent id="Start_1405" name="Tour angefordert"><bpmn:outgoing>Flow_1405_1</bpmn:outgoing></bpmn:startEvent><bpmn:task id="Task_TP_Route" name="Route optimieren"><bpmn:incoming>Flow_1405_1</bpmn:incoming><bpmn:outgoing>Flow_1405_2</bpmn:outgoing></bpmn:task><bpmn:task id="Task_TP_Dispo" name="Fahrzeuge disponieren"><bpmn:incoming>Flow_1405_2</bpmn:incoming><bpmn:outgoing>Flow_1405_3</bpmn:outgoing></bpmn:task><bpmn:endEvent id="End_1405" name="Tour geplant"><bpmn:incoming>Flow_1405_3</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="Flow_1405_1" sourceRef="Start_1405" targetRef="Task_TP_Route"/><bpmn:sequenceFlow id="Flow_1405_2" sourceRef="Task_TP_Route" targetRef="Task_TP_Dispo"/><bpmn:sequenceFlow id="Flow_1405_3" sourceRef="Task_TP_Dispo" targetRef="End_1405"/></bpmn:process><bpmndi:BPMNDiagram id="Diag_1405"><bpmndi:BPMNPlane id="Plane_1405" bpmnElement="Process_1405"><bpmndi:BPMNShape id="Start_1405_di" bpmnElement="Start_1405"><dc:Bounds x="152" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_TP_Route_di" bpmnElement="Task_TP_Route"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_TP_Dispo_di" bpmnElement="Task_TP_Dispo"><dc:Bounds x="390" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_1405_di" bpmnElement="End_1405"><dc:Bounds x="542" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1405_1_di" bpmnElement="Flow_1405_1"><di:waypoint x="188" y="120"/><di:waypoint x="240" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1405_2_di" bpmnElement="Flow_1405_2"><di:waypoint x="340" y="120"/><di:waypoint x="390" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1405_3_di" bpmnElement="Flow_1405_3"><di:waypoint x="490" y="120"/><di:waypoint x="542" y="120"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
  'Initiale Version der Tourenplanung (Call-Activity-Ziel).',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001416',
  'd0000000-0000-0000-0000-000000001406',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Def_1406" targetNamespace="http://arctos.dev/bpmn"><bpmn:process id="Process_1406" isExecutable="false"><bpmn:startEvent id="Start_1406" name="Lieferung eingetroffen"><bpmn:outgoing>Flow_1406_1</bpmn:outgoing></bpmn:startEvent><bpmn:task id="Task_WE_Annahme" name="Wareneingang erfassen"><bpmn:incoming>Flow_1406_1</bpmn:incoming><bpmn:outgoing>Flow_1406_2</bpmn:outgoing></bpmn:task><bpmn:task id="Task_WE_Sortierung" name="Nach Behandlungsklassen sortieren"><bpmn:incoming>Flow_1406_2</bpmn:incoming><bpmn:outgoing>Flow_1406_3</bpmn:outgoing></bpmn:task><bpmn:endEvent id="End_1406" name="Charge gebildet"><bpmn:incoming>Flow_1406_3</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="Flow_1406_1" sourceRef="Start_1406" targetRef="Task_WE_Annahme"/><bpmn:sequenceFlow id="Flow_1406_2" sourceRef="Task_WE_Annahme" targetRef="Task_WE_Sortierung"/><bpmn:sequenceFlow id="Flow_1406_3" sourceRef="Task_WE_Sortierung" targetRef="End_1406"/></bpmn:process><bpmndi:BPMNDiagram id="Diag_1406"><bpmndi:BPMNPlane id="Plane_1406" bpmnElement="Process_1406"><bpmndi:BPMNShape id="Start_1406_di" bpmnElement="Start_1406"><dc:Bounds x="152" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_WE_Annahme_di" bpmnElement="Task_WE_Annahme"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_WE_Sortierung_di" bpmnElement="Task_WE_Sortierung"><dc:Bounds x="390" y="80" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_1406_di" bpmnElement="End_1406"><dc:Bounds x="542" y="102" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1406_1_di" bpmnElement="Flow_1406_1"><di:waypoint x="188" y="120"/><di:waypoint x="240" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1406_2_di" bpmnElement="Flow_1406_2"><di:waypoint x="340" y="120"/><di:waypoint x="390" y="120"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_1406_3_di" bpmnElement="Flow_1406_3"><di:waypoint x="490" y="120"/><di:waypoint x="542" y="120"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>',
  'Initiale Version Wareneingang und Sortierung.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- 1f. Prozess-Steps der Auftragsabwicklung inkl. Call-Activity-Link
--     (process_step.called_process_id → Tourenplanung, Migration 0363)
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000001421',
  'd0000000-0000-0000-0000-000000001403',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_OA_Annahme',
  'Auftrag annehmen und pruefen',
  'Kundenauftrag erfassen, Vertragskonditionen und Lieferfenster pruefen, Auftragsbestaetigung versenden.',
  'task',
  'Vertriebsinnendienst',
  1
) ON CONFLICT DO NOTHING;

INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order, called_process_id)
VALUES (
  'd0000000-0000-0000-0000-000000001422',
  'd0000000-0000-0000-0000-000000001403',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'CallActivity_OA_Touren',
  'Tourenplanung und Logistik',
  'Aufruf des Teilprozesses Tourenplanung: Routenoptimierung und Fahrzeugdisposition fuer Hol- und Bringservice.',
  'call_activity',
  'Logistik',
  2,
  'd0000000-0000-0000-0000-000000001405'
) ON CONFLICT DO NOTHING;

INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000001423',
  'd0000000-0000-0000-0000-000000001403',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_OA_Auslieferung',
  'Bearbeitung und Auslieferung',
  'Werksbearbeitung, Qualitaetskontrolle und Auslieferung der Textilien an den Kunden im vereinbarten Zeitfenster.',
  'task',
  'Operations',
  3
) ON CONFLICT DO NOTHING;

-- Falls der Call-Activity-Step bereits ohne Link existierte: Link nachziehen.
UPDATE process_step SET called_process_id = 'd0000000-0000-0000-0000-000000001405'
WHERE id = 'd0000000-0000-0000-0000-000000001422' AND called_process_id IS NULL;

-- Steps der Tourenplanung (Call-Activity-Ziel)
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000001424',
  'd0000000-0000-0000-0000-000000001405',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_TP_Route',
  'Route optimieren',
  'Tagesrouten anhand von Auftragsvolumen, Zeitfenstern und Fahrzeugkapazitaeten optimieren.',
  'task',
  'Disposition',
  1
) ON CONFLICT DO NOTHING;

INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000001425',
  'd0000000-0000-0000-0000-000000001405',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_TP_Dispo',
  'Fahrzeuge disponieren',
  'Fahrzeuge und Fahrer den geplanten Touren zuweisen, Ausfaelle kompensieren.',
  'task',
  'Disposition',
  2
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Freigabekette + Kenntnisnahme (process_approval_step, Migration 0349a)
--    Für den published Incident-Response-Prozess (PRC-001, Version 1):
--    review → approval abgeschlossen, danach 2 Kenntnisnahme-Steps
--    (Andrea Fischer completed, Platform Admin pending → Portal-Demo).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO process_approval_step (id, org_id, process_id, version_number, step_order,
  step_type, assignee_user_id, status, decision, comment, decided_at, decided_by,
  created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001431',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000C01',
  1, 1, 'review',
  'd4e5f6a7-b8c9-0123-def0-456789abcdef', -- Thomas Schmidt (Compliance)
  'completed', 'approve',
  'Fachliche Pruefung abgeschlossen. Eskalationsstufen und NIS2-Meldewege sind konsistent mit dem Incident-Response-Plan (DOC-004).',
  '2026-01-10 11:30:00+01',
  'd4e5f6a7-b8c9-0123-def0-456789abcdef',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_approval_step (id, org_id, process_id, version_number, step_order,
  step_type, assignee_user_id, status, decision, comment, decided_at, decided_by,
  created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001432',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000C01',
  1, 2, 'approval',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf', -- Sarah Mueller (CISO)
  'completed', 'approve',
  'Freigegeben. Version 1 ist ab sofort verbindlich; Kenntnisnahme durch die benannten Rollen erforderlich.',
  '2026-01-14 09:15:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO process_approval_step (id, org_id, process_id, version_number, step_order,
  step_type, assignee_user_id, status, decision, comment, decided_at, decided_by,
  created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001433',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000C01',
  1, 3, 'acknowledgment',
  'a7b8c9d0-e1f2-3456-0123-789abcdef012', -- Andrea Fischer (QM)
  'completed', 'acknowledge',
  'Zur Kenntnis genommen; QM-Checklisten wurden entsprechend aktualisiert.',
  '2026-01-20 14:00:00+01',
  'a7b8c9d0-e1f2-3456-0123-789abcdef012',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- Pending Kenntnisnahme für den Demo-Login admin@arctos.dev → das
-- Prozess-Portal zeigt sofort eine offene Kenntnisnahme an.
INSERT INTO process_approval_step (id, org_id, process_id, version_number, step_order,
  step_type, assignee_user_id, status, due_date, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000001434',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000C01',
  1, 4, 'acknowledgment',
  'f22a4bc0-0147-4c0d-a02f-98cf65f1e768', -- Platform Admin (Demo-Login)
  'pending', '2026-08-15',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- Zweite pending Kenntnisnahme für den Alpha-QA-Login
-- process-owner@meridian.test (Migration 0317, deterministische UUID) —
-- guarded, falls die RBAC-QA-User auf der Ziel-DB nicht existieren.
INSERT INTO process_approval_step (id, org_id, process_id, version_number, step_order,
  step_type, assignee_user_id, status, due_date, created_by, updated_by)
SELECT
  'd0000000-0000-0000-0000-000000001435',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000C01',
  1, 5, 'acknowledgment',
  u.id, 'pending', '2026-08-15',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
FROM "user" u
WHERE u.id = 'a0000002-0000-0000-0000-000000000005' -- process-owner@meridian.test
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Management-Review-Cockpit (Migration 0369)
--    Completed Review Q2/2026 (mit Zeitraum + 5 strukturierten Items) und
--    planned Review nächste Woche (Zeitraum NULL → "seit letztem Review").
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO management_review (id, org_id, title, description, review_date, status,
  chair_id, participant_ids, changes_in_context, performance_feedback,
  audit_results, improvement_opportunities, minutes, next_review_date,
  period_start, period_end, completed_at, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001441',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Management-Review Q2/2026',
  'Quartalsweises Management-Review des ISMS nach ISO 27001 Kap. 9.3. Schwerpunkte: Ransomware-Restrisiko, Lieferantenaudits, KI-Nutzungsrichtlinie.',
  '2026-07-03', 'completed',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  ARRAY['f22a4bc0-0147-4c0d-a02f-98cf65f1e768',
        '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
        'd4e5f6a7-b8c9-0123-def0-456789abcdef',
        'd0e1f2a3-b4c5-6789-3456-abcdef012345',
        'e1f2a3b4-c5d6-7890-4567-bcdef0123456']::uuid[],
  'NIS2-Umsetzungsgesetz in Kraft; zwei neue Cloud-Dienstleister onboarded.',
  'KRI-Ampeln ueberwiegend gruen; Patch-Compliance bei 94 % (Ziel 95 %).',
  'Internes Audit A-2026-02 abgeschlossen: 2 Minor Findings, keine Major.',
  'Automatisierung der Evidence-Sammlung fuer Annex-A-Kontrollen pruefen.',
  'Protokoll siehe strukturierte Review-Punkte; Beschluesse einstimmig gefasst.',
  '2026-10-02',
  '2026-04-01', '2026-06-30',
  '2026-07-03 16:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO management_review_item (id, org_id, review_id, category, content, decision, sort_order, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001442',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001441',
  'previous_actions',
  'Von 6 Massnahmen aus dem Q1-Review sind 5 umgesetzt; die MFA-Ausweitung auf Produktionsstandorte laeuft noch (Termin 2026-08-31).',
  'Restmassnahme bleibt offen; Statusbericht im naechsten Review.',
  1,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO management_review_item (id, org_id, review_id, category, content, decision, sort_order, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001443',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001441',
  'risks',
  'Ransomware-Restrisiko (RSK-001) residual bei 8 stabil; zwei formale Risk-Acceptances aktiv, davon laeuft die Akzeptanz zum Cloud-Provider-Ausfall am 2026-08-10 ab.',
  'Akzeptanz RSK-005 vor Ablauf neu bewerten; Verantwortlich: Risikomanagement.',
  2,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO management_review_item (id, org_id, review_id, category, content, decision, sort_order, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001444',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001441',
  'findings',
  'Zwei Minor Findings aus dem internen Audit (Dokumentenlenkung, Wiederanlauftest-Protokolle); Korrekturmassnahmen terminiert.',
  'CAP-Massnahmen bis 2026-09-30 abschliessen; QM berichtet monatlich.',
  3,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO management_review_item (id, org_id, review_id, category, content, decision, sort_order, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001445',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001441',
  'incidents',
  'Im Zeitraum 3 Sicherheitsvorfaelle (P3/P4), alle innerhalb der SLA geschlossen; keine meldepflichtigen Vorfaelle nach NIS2/DSGVO.',
  'Keine weiteren Massnahmen; Phishing-Awareness-Kampagne Q3 wie geplant.',
  4,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

INSERT INTO management_review_item (id, org_id, review_id, category, content, decision, sort_order, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001446',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001441',
  'improvement',
  'KI-Nutzungsrichtlinie v2.0 per e-Signatur freigegeben; Vorschlag, den Signatur-Workflow auf alle Leitlinien auszurollen.',
  'e-Signatur wird Standard fuer Richtlinien-Freigaben ab Q3/2026.',
  5,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- Planned Review nächste Woche — period NULL = "seit letztem completed Review"
INSERT INTO management_review (id, org_id, title, description, review_date, status,
  chair_id, participant_ids, next_review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001447',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Management-Review Q3/2026 (ausserplanmaessig)',
  'Ausserplanmaessiges Review vor dem Stage-1-Audit der ISO-27001-Zertifizierung. Input-Zeitraum: automatisch seit dem letzten abgeschlossenen Review.',
  '2026-07-27', 'planned',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  ARRAY['f22a4bc0-0147-4c0d-a02f-98cf65f1e768',
        '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
        'd4e5f6a7-b8c9-0123-def0-456789abcdef']::uuid[],
  NULL,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DMS: Effective Dating + e-Signatur
--    KI-Nutzungsrichtlinie mit 3 Versionen (1.0 → 1.1 → 2.0) und einer
--    completed Signaturanfrage (2 Signer, korrekte Hash-Kette via pgcrypto).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  published_at, review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001451',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'KI-Nutzungsrichtlinie',
  'Richtlinie fuer den Einsatz generativer KI-Werkzeuge im Konzern. Version 2.0: verbindliche Freigabeprozesse fuer KI-Anwendungsfaelle, Verbot der Eingabe personenbezogener und vertraulicher Daten in oeffentliche Modelle, AI-Act-Risikoklassifizierung je Anwendungsfall und Schulungspflicht fuer alle Nutzer.',
  'policy',
  'published',
  3,
  true,
  ARRAY['isms', 'ai-act', 'policy', 'ki'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'd4e5f6a7-b8c9-0123-def0-456789abcdef',
  'f22a4bc0-0147-4c0d-a02f-98cf65f1e768',
  '2026-06-01 09:00:00+02',
  '2027-06-01 00:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- v1.0 — galt vom 2025-12-01 bis 2026-03-01
INSERT INTO document_version (id, document_id, org_id, version_number, content,
  change_summary, is_current, valid_from, valid_until, version_label,
  version_major, version_minor, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001452',
  'd0000000-0000-0000-0000-000000001451',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Erstfassung der KI-Nutzungsrichtlinie: Grundsaetze fuer den Einsatz generativer KI, Pilotphase auf die IT-Abteilung beschraenkt.',
  'Erstversion 1.0 — Pilotbetrieb IT.',
  false,
  '2025-12-01 09:00:00+01', '2026-03-01 09:00:00+01',
  '1.0', 1, 0,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- v1.1 — galt vom 2026-03-01 bis 2026-06-01 (Minor: Klarstellungen)
INSERT INTO document_version (id, document_id, org_id, version_number, content,
  change_summary, is_current, valid_from, valid_until, version_label,
  version_major, version_minor, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001453',
  'd0000000-0000-0000-0000-000000001451',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  2,
  'KI-Nutzungsrichtlinie 1.1: Klarstellung zulaessiger Anwendungsfaelle, Negativliste oeffentlicher Modelle, Meldeweg fuer KI-Vorfaelle ergaenzt.',
  'Minor-Update 1.1 — Klarstellungen aus dem Pilotbetrieb.',
  false,
  '2026-03-01 09:00:00+01', '2026-06-01 09:00:00+02',
  '1.1', 1, 1,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- v2.0 — gilt seit 2026-06-01 (Major: konzernweit verbindlich, AI-Act)
-- file_sha256 = SHA-256 des Versionsinhalts (Basis der Signatur-Zeremonie)
INSERT INTO document_version (id, document_id, org_id, version_number, content,
  change_summary, is_current, valid_from, valid_until, version_label,
  version_major, version_minor, file_sha256, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001454',
  'd0000000-0000-0000-0000-000000001451',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  3,
  'KI-Nutzungsrichtlinie 2.0: konzernweit verbindlich. Freigabeprozess fuer KI-Anwendungsfaelle, AI-Act-Risikoklassifizierung, Verbot personenbezogener Daten in oeffentlichen Modellen, Schulungspflicht.',
  'Major-Release 2.0 — konzernweite Ausweitung + AI-Act-Anforderungen.',
  true,
  '2026-06-01 09:00:00+02', NULL,
  '2.0', 2, 0,
  encode(digest('KI-Nutzungsrichtlinie 2.0: konzernweit verbindlich. Freigabeprozess fuer KI-Anwendungsfaelle, AI-Act-Risikoklassifizierung, Verbot personenbezogener Daten in oeffentlichen Modellen, Schulungspflicht.', 'sha256'), 'hex'),
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- Inline-Hash am Dokument nachziehen (Fallback-Quelle der Verify-Route)
UPDATE document
SET file_sha256 = (SELECT file_sha256 FROM document_version
                   WHERE id = 'd0000000-0000-0000-0000-000000001454')
WHERE id = 'd0000000-0000-0000-0000-000000001451' AND file_sha256 IS NULL;

-- Signaturanfrage (completed): CISO + Admin haben v2.0 sequenziell signiert
INSERT INTO document_signature_request (id, org_id, document_id, version_id,
  file_sha256, title, message, status, sequential, due_date, completed_at, created_by)
SELECT
  'd0000000-0000-0000-0000-000000001455',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001451',
  'd0000000-0000-0000-0000-000000001454',
  dv.file_sha256,
  'Freigabe KI-Nutzungsrichtlinie v2.0',
  'Bitte die konzernweite Fassung 2.0 der KI-Nutzungsrichtlinie elektronisch signieren (Freigabe CISO + Geschaeftsfuehrung).',
  'completed',
  true,
  '2026-06-15 23:59:59+02',
  '2026-06-12 10:30:00+00',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
FROM document_version dv
WHERE dv.id = 'd0000000-0000-0000-0000-000000001454'
ON CONFLICT DO NOTHING;

-- Signer 1 (CISO, sign_order 1) — Kettenanfang (previous_chain_hash NULL).
-- Kanonisches Payload-JSON exakt wie signature-chain.ts (sortierte Keys):
--   {"decision":"signed","documentId":...,"fileSha256":...,"signedAt":...,
--    "signerUserId":...,"versionId":...}
INSERT INTO document_signature (id, org_id, request_id, signer_user_id, sign_order,
  status, signed_at, content_hash, previous_chain_hash, chain_hash,
  ip_address, user_agent, created_by)
SELECT
  'd0000000-0000-0000-0000-000000001456',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001455',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  1,
  'signed',
  '2026-06-10 09:15:00.000+00',
  c.content_hash,
  NULL,
  encode(digest(c.content_hash, 'sha256'), 'hex'),
  '10.20.30.11',
  'Mozilla/5.0 (Demo Seed)',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
FROM (
  SELECT encode(digest(
    '{"decision":"signed"'
    || ',"documentId":"d0000000-0000-0000-0000-000000001451"'
    || ',"fileSha256":"' || dv.file_sha256 || '"'
    || ',"signedAt":"2026-06-10T09:15:00.000Z"'
    || ',"signerUserId":"8c148f0a-f558-4a9f-8886-a3d7096da6cf"'
    || ',"versionId":"d0000000-0000-0000-0000-000000001454"}',
    'sha256'), 'hex') AS content_hash
  FROM document_version dv
  WHERE dv.id = 'd0000000-0000-0000-0000-000000001454'
) c
ON CONFLICT DO NOTHING;

-- Signer 2 (Platform Admin, sign_order 2) — previous_chain_hash = chain_hash
-- von Signer 1 (deterministisch rekonstruiert aus demselben Payload).
INSERT INTO document_signature (id, org_id, request_id, signer_user_id, sign_order,
  status, signed_at, content_hash, previous_chain_hash, chain_hash,
  ip_address, user_agent, created_by)
SELECT
  'd0000000-0000-0000-0000-000000001457',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000001455',
  'f22a4bc0-0147-4c0d-a02f-98cf65f1e768',
  2,
  'signed',
  '2026-06-12 10:30:00.000+00',
  c.content_hash2,
  c.chain_hash1,
  encode(digest(c.chain_hash1 || c.content_hash2, 'sha256'), 'hex'),
  '10.20.30.12',
  'Mozilla/5.0 (Demo Seed)',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
FROM (
  SELECT
    encode(digest(
      encode(digest(
        '{"decision":"signed"'
        || ',"documentId":"d0000000-0000-0000-0000-000000001451"'
        || ',"fileSha256":"' || dv.file_sha256 || '"'
        || ',"signedAt":"2026-06-10T09:15:00.000Z"'
        || ',"signerUserId":"8c148f0a-f558-4a9f-8886-a3d7096da6cf"'
        || ',"versionId":"d0000000-0000-0000-0000-000000001454"}',
        'sha256'), 'hex'),
      'sha256'), 'hex') AS chain_hash1,
    encode(digest(
      '{"decision":"signed"'
      || ',"documentId":"d0000000-0000-0000-0000-000000001451"'
      || ',"fileSha256":"' || dv.file_sha256 || '"'
      || ',"signedAt":"2026-06-12T10:30:00.000Z"'
      || ',"signerUserId":"f22a4bc0-0147-4c0d-a02f-98cf65f1e768"'
      || ',"versionId":"d0000000-0000-0000-0000-000000001454"}',
      'sha256'), 'hex') AS content_hash2
  FROM document_version dv
  WHERE dv.id = 'd0000000-0000-0000-0000-000000001454'
) c
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Risk-Acceptance (Migration 0088/0360) + Authority-Matrix
-- ─────────────────────────────────────────────────────────────────────────────

-- Akzeptanz 1: Schluessel-Personal-Risiko (RSK-004, residual 4 = low),
-- langfristig akzeptiert durch die CISO.
INSERT INTO risk_acceptance (id, org_id, risk_id, accepted_by, accepted_at,
  acceptance_conditions, valid_until, risk_score_at_acceptance,
  risk_level_at_acceptance, justification, status, tags)
SELECT
  'd0000000-0000-0000-0000-000000001461',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  r.id,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-06-20 10:00:00+02',
  'Nachfolgeplanung und Wissensdokumentation fuer Schluesselrollen werden halbjaehrlich ueberprueft.',
  '2027-06-30',
  4, 'low',
  'Residualrisiko nach Vertreterregelungen und Dokumentationspflichten im Appetit-Rahmen; weitere Massnahmen unwirtschaftlich.',
  'active',
  ARRAY['erm', 'hr']
FROM risk r
WHERE r.id = 'd0000000-0000-0000-0000-000000000104'
ON CONFLICT DO NOTHING;

-- Akzeptanz 2: Cloud-Provider-Ausfall (RSK-005, residual 6 = medium),
-- befristet bis 2026-08-10 → Expiry-Highlight im Cockpit (laeuft in ~3 Wochen ab).
INSERT INTO risk_acceptance (id, org_id, risk_id, accepted_by, accepted_at,
  acceptance_conditions, valid_until, risk_score_at_acceptance,
  risk_level_at_acceptance, justification, status, tags)
SELECT
  'd0000000-0000-0000-0000-000000001462',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  r.id,
  'e1f2a3b4-c5d6-7890-4567-bcdef0123456',
  '2026-02-10 14:30:00+01',
  'Befristet bis zum Abschluss der Multi-Region-Failover-Evaluierung; Notfall-Runbook fuer Cloud-Ausfall bleibt aktiv.',
  '2026-08-10',
  6, 'medium',
  'Multi-Cloud-Strategie in Evaluierung; bis zur Entscheidung wird das Restrisiko formal getragen (ISO 27005 Kap. 10).',
  'active',
  ARRAY['erm', 'cloud', 'bcms']
FROM risk r
WHERE r.id = 'd0000000-0000-0000-0000-000000000105'
ON CONFLICT DO NOTHING;

-- Authority-Matrix: bis Score 15 Risikomanager, darueber Geschaeftsfuehrung
INSERT INTO risk_acceptance_authority (id, org_id, min_score, max_score,
  required_role, required_role_label, description, is_active)
VALUES (
  'd0000000-0000-0000-0000-000000001463',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  0, 15,
  'risk_manager', 'Risikomanager (2nd Line)',
  'Risiken bis Score 15 duerfen durch die 2nd-Line-Risikomanager formal akzeptiert werden.',
  true
) ON CONFLICT DO NOTHING;

INSERT INTO risk_acceptance_authority (id, org_id, min_score, max_score,
  required_role, required_role_label, description, is_active)
VALUES (
  'd0000000-0000-0000-0000-000000001464',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  16, 25,
  'admin', 'Geschaeftsfuehrung',
  'Risiken ueber Score 15 erfordern die Akzeptanz durch die Geschaeftsfuehrung.',
  true
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Retention-Policy (Migration 0355) — GoBD 10 Jahre, zugewiesen an DOC-001
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO retention_policy (id, org_id, name, description, retention_years, basis, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000001465',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Aufbewahrung 10 Jahre (GoBD)',
  'Aufbewahrungsfrist fuer steuer- und handelsrechtlich relevante Unterlagen gemaess GoBD/§ 147 AO: 10 Jahre ab Veroeffentlichung.',
  10, 'published',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT DO NOTHING;

-- Zuweisung an DOC-001 (Informationssicherheitsrichtlinie), nur wenn noch
-- keine Policy zugewiesen ist; retention_until = published_at + 10 Jahre.
UPDATE document
SET retention_policy_id = 'd0000000-0000-0000-0000-000000001465',
    retention_until = published_at + INTERVAL '10 years'
WHERE id = 'd0000000-0000-0000-0000-000000000B01'
  AND retention_policy_id IS NULL;

COMMIT;
