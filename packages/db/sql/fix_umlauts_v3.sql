-- fix_umlauts_v3.sql
-- Fix remaining German umlaut issues in live database
-- Run with: $env:PGPASSWORD = "grc_dev_password"; & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U grc -d grc_platform -f packages/db/sql/fix_umlauts_v3.sql

-- No transaction — each statement runs independently so errors don't cascade

-- ============================================================
-- RISK table fixes
-- ============================================================
UPDATE risk SET title = REPLACE(title, 'primaeren', 'primären') WHERE title LIKE '%primaeren%';
UPDATE risk SET title = REPLACE(title, 'Schluessel', 'Schlüssel') WHERE title LIKE '%Schluessel%';
UPDATE risk SET title = REPLACE(title, 'Abhaengigkeit', 'Abhängigkeit') WHERE title LIKE '%Abhaengigkeit%';
UPDATE risk SET title = REPLACE(title, 'Grossflaechiger', 'Großflächiger') WHERE title LIKE '%Grossflaechiger%';
UPDATE risk SET title = REPLACE(title, 'Oeffentliches', 'Öffentliches') WHERE title LIKE '%Oeffentliches%';

UPDATE risk SET description = REPLACE(description, 'verschluesselt', 'verschlüsselt') WHERE description LIKE '%verschluesselt%';
UPDATE risk SET description = REPLACE(description, 'fuehrt', 'führt') WHERE description LIKE '%fuehrt%';
UPDATE risk SET description = REPLACE(description, 'mehrtaegigem', 'mehrtägigem') WHERE description LIKE '%mehrtaegigem%';
UPDATE risk SET description = REPLACE(description, 'mehrstuendigem', 'mehrstündigem') WHERE description LIKE '%mehrstuendigem%';
UPDATE risk SET description = REPLACE(description, 'erhoehter', 'erhöhter') WHERE description LIKE '%erhoehter%';
UPDATE risk SET description = REPLACE(description, 'Angriffsflaeche', 'Angriffsfläche') WHERE description LIKE '%Angriffsflaeche%';
UPDATE risk SET description = REPLACE(description, 'Verzoegerung', 'Verzögerung') WHERE description LIKE '%Verzoegerung%';
UPDATE risk SET description = REPLACE(description, 'Wissenstraegern', 'Wissensträgern') WHERE description LIKE '%Wissenstraegern%';
UPDATE risk SET description = REPLACE(description, 'Schluesselrollen', 'Schlüsselrollen') WHERE description LIKE '%Schluesselrollen%';
UPDATE risk SET description = REPLACE(description, 'Schluessellieferanten', 'Schlüssellieferanten') WHERE description LIKE '%Schluessellieferanten%';
UPDATE risk SET description = REPLACE(description, 'laengerer', 'längerer') WHERE description LIKE '%laengerer%';
UPDATE risk SET description = REPLACE(description, 'Grossflaechiger', 'Großflächiger') WHERE description LIKE '%Grossflaechiger%';
UPDATE risk SET description = REPLACE(description, 'primaeren', 'primären') WHERE description LIKE '%primaeren%';
UPDATE risk SET description = REPLACE(description, 'Oeffentliches', 'Öffentliches') WHERE description LIKE '%Oeffentliches%';

-- ============================================================
-- RISK_TREATMENT table fixes
-- ============================================================
UPDATE risk_treatment SET description = REPLACE(description, 'Folgenabschaetzung', 'Folgenabschätzung') WHERE description LIKE '%Folgenabschaetzung%';
UPDATE risk_treatment SET description = REPLACE(description, 'Unterstuetzung', 'Unterstützung') WHERE description LIKE '%Unterstuetzung%';

-- ============================================================
-- CONTROL table fixes
-- ============================================================
UPDATE control SET description = REPLACE(description, 'Angriffsflaeche', 'Angriffsfläche') WHERE description LIKE '%Angriffsflaeche%';
UPDATE control SET description = REPLACE(description, 'fuer alle', 'für alle') WHERE description LIKE '%fuer alle%';
UPDATE control SET description = REPLACE(description, 'fuer kritische', 'für kritische') WHERE description LIKE '%fuer kritische%';
UPDATE control SET description = REPLACE(description, 'fuer ', 'für ') WHERE description LIKE '%fuer %';

-- ============================================================
-- VENDOR table fixes
-- ============================================================
UPDATE vendor SET description = REPLACE(description, 'Primaerer', 'Primärer') WHERE description LIKE '%Primaerer%';
UPDATE vendor SET description = REPLACE(description, 'Nuernberg', 'Nürnberg') WHERE description LIKE '%Nuernberg%';
UPDATE vendor SET name = REPLACE(name, 'fuer ', 'für ') WHERE name LIKE '%fuer %';

-- ============================================================
-- VENDOR_DUE_DILIGENCE / VENDOR_SCORECARD fixes
-- ============================================================
UPDATE vendor_scorecard SET notes = REPLACE(notes, 'Abhaengigkeit', 'Abhängigkeit') WHERE notes LIKE '%Abhaengigkeit%';
UPDATE vendor_scorecard SET notes = REPLACE(notes, 'Primaer', 'Primär') WHERE notes LIKE '%Primaer%';
UPDATE vendor_scorecard SET notes = REPLACE(notes, 'hoechsten', 'höchsten') WHERE notes LIKE '%hoechsten%';

-- ============================================================
-- CONTRACT / CONTRACT_SLA fixes
-- ============================================================
UPDATE contract_sla SET penalty_clause = REPLACE(penalty_clause, 'Verlaengerung', 'Verlängerung') WHERE penalty_clause LIKE '%Verlaengerung%';

-- ============================================================
-- KRI table fixes
-- ============================================================
UPDATE kri SET description = REPLACE(description, 'Schluesselstellen', 'Schlüsselstellen') WHERE description LIKE '%Schluesselstellen%';
UPDATE kri SET description = REPLACE(description, 'Beruecksichtigt', 'Berücksichtigt') WHERE description LIKE '%Beruecksichtigt%';
UPDATE kri SET description = REPLACE(description, 'gekuendigten', 'gekündigten') WHERE description LIKE '%gekuendigten%';
UPDATE kri SET description = REPLACE(description, 'primaeren', 'primären') WHERE description LIKE '%primaeren%';
UPDATE kri_snapshot SET comment = REPLACE(comment, 'Schluesselstellen', 'Schlüsselstellen') WHERE comment LIKE '%Schluesselstellen%';
UPDATE kri_snapshot SET comment = REPLACE(comment, 'laeuft', 'läuft') WHERE comment LIKE '%laeuft%';

-- ============================================================
-- TASK table fixes
-- ============================================================
UPDATE task SET title = REPLACE(title, 'durchfuehren', 'durchführen') WHERE title LIKE '%durchfuehren%';
UPDATE task SET description = REPLACE(description, 'Folgenabschaetzung', 'Folgenabschätzung') WHERE description LIKE '%Folgenabschaetzung%';
UPDATE task SET description = REPLACE(description, 'Beschaeftigtendaten', 'Beschäftigtendaten') WHERE description LIKE '%Beschaeftigtendaten%';

-- ============================================================
-- FINDING table fixes
-- ============================================================
UPDATE finding SET remediation_options = REPLACE(remediation_options, 'verschluesselten', 'verschlüsselten') WHERE remediation_options LIKE '%verschluesselten%';

-- ============================================================
-- BIA / BCP / BCMS tables fixes
-- ============================================================
UPDATE bia_assessment SET description = REPLACE(description, 'Abhaengigkeiten', 'Abhängigkeiten') WHERE description LIKE '%Abhaengigkeiten%';

-- ============================================================
-- CRISIS_SCENARIO / BC_EXERCISE fixes
-- ============================================================
UPDATE crisis_scenario SET title = REPLACE(title, 'Primaerstandort', 'Primärstandort') WHERE title LIKE '%Primaerstandort%';
UPDATE crisis_scenario SET description = REPLACE(description, 'primaeren', 'primären') WHERE description LIKE '%primaeren%';
UPDATE crisis_scenario SET description = REPLACE(description, 'Kuehlung', 'Kühlung') WHERE description LIKE '%Kuehlung%';

-- ============================================================
-- BCP step / phase fixes
-- ============================================================
UPDATE bcp_phase SET description = REPLACE(description, 'Rueckfuehrung', 'Rückführung') WHERE description LIKE '%Rueckfuehrung%';
UPDATE bcp_phase SET description = REPLACE(description, 'Primaerstandort', 'Primärstandort') WHERE description LIKE '%Primaerstandort%';
UPDATE bcp_phase SET description = REPLACE(description, 'Integritaet', 'Integrität') WHERE description LIKE '%Integritaet%';
UPDATE bcp_phase SET description = REPLACE(description, 'Durchfuehrung', 'Durchführung') WHERE description LIKE '%Durchfuehrung%';
UPDATE bcp_phase SET exit_criteria = REPLACE(exit_criteria, 'Primaerstandort', 'Primärstandort') WHERE exit_criteria LIKE '%Primaerstandort%';
UPDATE bcp_phase SET exit_criteria = REPLACE(exit_criteria, 'Datenintegritaet', 'Datenintegrität') WHERE exit_criteria LIKE '%Datenintegritaet%';

-- ============================================================
-- DOCUMENT table fixes
-- ============================================================
UPDATE document SET description = REPLACE(description, 'Folgenabschaetzung', 'Folgenabschätzung') WHERE description LIKE '%Folgenabschaetzung%';
UPDATE document SET description = REPLACE(description, 'Enthaelt', 'Enthält') WHERE description LIKE '%Enthaelt%';
UPDATE document SET description = REPLACE(description, 'Integritaet', 'Integrität') WHERE description LIKE '%Integritaet%';
UPDATE document SET description = REPLACE(description, 'oeffentlich', 'öffentlich') WHERE description LIKE '%oeffentlich%';
UPDATE document SET description = REPLACE(description, 'zugehoerigen', 'zugehörigen') WHERE description LIKE '%zugehoerigen%';
UPDATE document SET notes = REPLACE(notes, 'laeuft', 'läuft') WHERE notes LIKE '%laeuft%';

-- ============================================================
-- PROCESS_STEP table fixes
-- ============================================================
UPDATE process_step SET description = REPLACE(description, 'durchfuehren', 'durchführen') WHERE description LIKE '%durchfuehren%';
UPDATE process_step SET description = REPLACE(description, 'ueber ', 'über ') WHERE description LIKE '%ueber %';
UPDATE process_step SET description = REPLACE(description, 'Integritaet', 'Integrität') WHERE description LIKE '%Integritaet%';
UPDATE process_step SET description = REPLACE(description, 'erhoehtem', 'erhöhtem') WHERE description LIKE '%erhoehtem%';
UPDATE process_step SET description = REPLACE(description, 'Folgenabschaetzung', 'Folgenabschätzung') WHERE description LIKE '%Folgenabschaetzung%';
UPDATE process_step SET description = REPLACE(description, 'Abhaengigkeiten', 'Abhängigkeiten') WHERE description LIKE '%Abhaengigkeiten%';
UPDATE process_step SET description = REPLACE(description, 'Zugaenge', 'Zugänge') WHERE description LIKE '%Zugaenge%';
UPDATE process_step SET description = REPLACE(description, 'pruefen', 'prüfen') WHERE description LIKE '%pruefen%';

-- ============================================================
-- CONTROL_TEST table fixes
-- ============================================================
UPDATE control_test SET result_notes = REPLACE(result_notes, 'Integritaet', 'Integrität') WHERE result_notes LIKE '%Integritaet%';

-- ============================================================
-- ROPA_ENTRY table fixes
-- ============================================================
UPDATE ropa_entry SET processing_description = REPLACE(processing_description, 'Oeffnungs', 'Öffnungs') WHERE processing_description LIKE '%Oeffnungs%';
UPDATE ropa_entry SET retention_note = REPLACE(retention_note, 'geloescht', 'gelöscht') WHERE retention_note LIKE '%geloescht%';
UPDATE ropa_entry SET safeguards = REPLACE(safeguards, 'verschluesselter', 'verschlüsselter') WHERE safeguards LIKE '%verschluesselter%';

-- ============================================================
-- DATA_BREACH table fixes
-- ============================================================
UPDATE data_breach SET description = REPLACE(description, 'Verschluesselt', 'Verschlüsselt') WHERE description LIKE '%Verschluesselt%';
UPDATE data_breach SET description = REPLACE(description, 'verschluesselt', 'verschlüsselt') WHERE description LIKE '%verschluesselt%';

-- ============================================================
-- DPIA table fixes
-- ============================================================
UPDATE dpia_risk SET description = REPLACE(description, 'fuehrt', 'führt') WHERE description LIKE '%fuehrt%';
UPDATE dpia_risk SET description = REPLACE(description, 'Persoenlichkeitsrechte', 'Persönlichkeitsrechte') WHERE description LIKE '%Persoenlichkeitsrechte%';

-- ============================================================
-- DSR table fixes
-- ============================================================
UPDATE dsr SET internal_notes = REPLACE(internal_notes, 'jaehriger', 'jähriger') WHERE internal_notes LIKE '%jaehriger%';
UPDATE dsr SET internal_notes = REPLACE(internal_notes, 'koennen', 'können') WHERE internal_notes LIKE '%koennen%';
UPDATE dsr SET internal_notes = REPLACE(internal_notes, 'geloescht', 'gelöscht') WHERE internal_notes LIKE '%geloescht%';

-- ============================================================
-- AUDIT related table fixes
-- ============================================================
UPDATE audit_universe_entry SET notes = REPLACE(notes, 'Primaerer', 'Primärer') WHERE notes LIKE '%Primaerer%';
UPDATE audit_checklist_item SET question = REPLACE(question, 'verschluesselt', 'verschlüsselt') WHERE question LIKE '%verschluesselt%';
UPDATE audit_checklist_item SET question = REPLACE(question, 'einschliesslich', 'einschließlich') WHERE question LIKE '%einschliesslich%';

-- ============================================================
-- VENDOR_PERFORMANCE_RECORD fixes
-- ============================================================
UPDATE vendor_performance_record SET notes = REPLACE(notes, 'Erhoehte', 'Erhöhte') WHERE notes LIKE '%Erhoehte%';

-- ============================================================
-- ESRS_DATAPOINT_DEFINITION fixes (comprehensive)
-- ============================================================
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'einschliesslich', 'einschließlich') WHERE description_de LIKE '%einschliesslich%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'fuer ', 'für ') WHERE description_de LIKE '%fuer %';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Betraege', 'Beträge') WHERE description_de LIKE '%Betraege%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Prozentsaetze', 'Prozentsätze') WHERE description_de LIKE '%Prozentsaetze%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Erwaermung', 'Erwärmung') WHERE description_de LIKE '%Erwaermung%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Massnahmen', 'Maßnahmen') WHERE description_de LIKE '%Massnahmen%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Aenderungen', 'Änderungen') WHERE description_de LIKE '%Aenderungen%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Einfuehrung', 'Einführung') WHERE description_de LIKE '%Einfuehrung%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Vermoegenswerten', 'Vermögenswerten') WHERE description_de LIKE '%Vermoegenswerten%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Biodiversitaet', 'Biodiversität') WHERE description_de LIKE '%Biodiversitaet%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Oekosystem', 'Ökosystem') WHERE description_de LIKE '%Oekosystem%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Landnutzungsaenderungen', 'Landnutzungsänderungen') WHERE description_de LIKE '%Landnutzungsaenderungen%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'aufgefuehrt', 'aufgeführt') WHERE description_de LIKE '%aufgefuehrt%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Ressourcenzufluesse', 'Ressourcenzuflüsse') WHERE description_de LIKE '%Ressourcenzufluesse%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Beschaeftigten', 'Beschäftigten') WHERE description_de LIKE '%Beschaeftigten%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Wertschoepfungskette', 'Wertschöpfungskette') WHERE description_de LIKE '%Wertschoepfungskette%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Voelker', 'Völker') WHERE description_de LIKE '%Voelker%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Bekaempfung', 'Bekämpfung') WHERE description_de LIKE '%Bekaempfung%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'ueber das', 'über das') WHERE description_de LIKE '%ueber das%';
UPDATE esrs_datapoint_definition SET description_de = REPLACE(description_de, 'Aktivitaeten', 'Aktivitäten') WHERE description_de LIKE '%Aktivitaeten%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Biodiversitaet', 'Biodiversität') WHERE name_de LIKE '%Biodiversitaet%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Oekosystem', 'Ökosystem') WHERE name_de LIKE '%Oekosystem%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'fuer ', 'für ') WHERE name_de LIKE '%fuer %';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Massnahmen', 'Maßnahmen') WHERE name_de LIKE '%Massnahmen%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Vermoegenswerten', 'Vermögenswerten') WHERE name_de LIKE '%Vermoegenswerten%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Beschaeftigten', 'Beschäftigten') WHERE name_de LIKE '%Beschaeftigten%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Wertschoepfungskette', 'Wertschöpfungskette') WHERE name_de LIKE '%Wertschoepfungskette%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Ressourcenzufluesse', 'Ressourcenzuflüsse') WHERE name_de LIKE '%Ressourcenzufluesse%';
UPDATE esrs_datapoint_definition SET name_de = REPLACE(name_de, 'Biodiversitaetswandel', 'Biodiversitätswandel') WHERE name_de LIKE '%Biodiversitaetswandel%';

-- ============================================================
-- WORKFLOW_RULE fixes
-- ============================================================
UPDATE workflow_rule SET name = REPLACE(name, 'ueberfaellig', 'überfällig') WHERE name LIKE '%ueberfaellig%';
UPDATE workflow_rule SET name = REPLACE(name, 'ueberRisikoappetit', 'über Risikoappetit') WHERE name LIKE '%ueberRisikoappetit%';
UPDATE workflow_rule SET description = REPLACE(description, 'laenger', 'länger') WHERE description LIKE '%laenger%';
UPDATE workflow_rule SET description = REPLACE(description, 'fuer ', 'für ') WHERE description LIKE '%fuer %';
UPDATE workflow_rule SET description = REPLACE(description, 'ablaeuft', 'abläuft') WHERE description LIKE '%ablaeuft%';
UPDATE workflow_rule SET description = REPLACE(description, 'laeuft', 'läuft') WHERE description LIKE '%laeuft%';
UPDATE workflow_rule SET description = REPLACE(description, 'faellt', 'fällt') WHERE description LIKE '%faellt%';
UPDATE workflow_rule SET description = REPLACE(description, 'angestossen', 'angestoßen') WHERE description LIKE '%angestossen%';
UPDATE workflow_rule SET description = REPLACE(description, 'Bestaetigungen', 'Bestätigungen') WHERE description LIKE '%Bestaetigungen%';
UPDATE workflow_rule SET description = REPLACE(description, 'ueber ', 'über ') WHERE description LIKE '%ueber %';

-- Generic catch-all: fix common patterns in actions JSONB (cast to text, replace, cast back)
UPDATE workflow_rule SET actions = (REPLACE(REPLACE(REPLACE(actions::text, 'ueberfaellig', 'überfällig'), 'ueber 90', 'über 90'), 'fuer ', 'für '))::jsonb
WHERE actions::text LIKE '%ueberfaellig%' OR actions::text LIKE '%ueber 90%' OR actions::text LIKE '%fuer %';

-- ============================================================
-- Additional broad fixes across all text columns
-- ============================================================

-- Fix 'erfuellt' -> 'erfüllt' across tables that may have it
UPDATE compliance_calendar_entry SET description = REPLACE(description, 'erfuellt', 'erfüllt') WHERE description LIKE '%erfuellt%';
UPDATE workflow_rule SET description = REPLACE(description, 'erfuellt', 'erfüllt') WHERE description LIKE '%erfuellt%';

-- Fix 'geschuetzt' -> 'geschützt'
UPDATE whistleblowing_case SET description = REPLACE(description, 'geschuetzt', 'geschützt') WHERE description LIKE '%geschuetzt%';

-- Fix 'koennen' -> 'können'
UPDATE risk_treatment SET description = REPLACE(description, 'koennen', 'können') WHERE description LIKE '%koennen%';

-- Fix 'Boswilliger' -> 'Böswilliger' / 'fahrlassiger' -> 'fahrlässiger'
UPDATE threat SET description = REPLACE(description, 'Boswilliger', 'Böswilliger') WHERE description LIKE '%Boswilliger%';
UPDATE threat SET description = REPLACE(description, 'fahrlassiger', 'fahrlässiger') WHERE description LIKE '%fahrlassiger%';
UPDATE threat SET description = REPLACE(description, 'Beschaeftigte', 'Beschäftigte') WHERE description LIKE '%Beschaeftigte%';
UPDATE threat SET description = REPLACE(description, 'fuehrt', 'führt') WHERE description LIKE '%fuehrt%';
UPDATE threat SET description = REPLACE(description, 'ueberlastet', 'überlastet') WHERE description LIKE '%ueberlastet%';
UPDATE threat SET description = REPLACE(description, 'Grossflaechiger', 'Großflächiger') WHERE description LIKE '%Grossflaechiger%';

-- Fix risk_scenario
UPDATE risk_scenario SET description = REPLACE(description, 'Boswilliger', 'Böswilliger') WHERE description LIKE '%Boswilliger%';
UPDATE risk_scenario SET description = REPLACE(description, 'Erhoehtes', 'Erhöhtes') WHERE description LIKE '%Erhoehtes%';
UPDATE risk_scenario SET description = REPLACE(description, 'Grossflaechiger', 'Großflächiger') WHERE description LIKE '%Grossflaechiger%';
UPDATE risk_scenario SET description = REPLACE(description, 'ueberlastet', 'überlastet') WHERE description LIKE '%ueberlastet%';
UPDATE risk_scenario SET description = REPLACE(description, 'fuehrt', 'führt') WHERE description LIKE '%fuehrt%';

-- Done
