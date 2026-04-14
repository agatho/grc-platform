-- Fix German umlauts in existing demo data (ae->ä, oe->ö, ue->ü, fuer->für)
-- This fixes data already imported into the database

-- Helper: generic umlaut fix for text columns
-- We run targeted updates on tables with known text content

-- Risks
UPDATE risk SET title = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title,
  'Geschaeft', 'Geschäft'), 'Verschluesselung', 'Verschlüsselung'), 'Aenderung', 'Änderung'),
  'Ueberwach', 'Überwach'), 'Praeventiv', 'Präventiv'), 'Regelmaessig', 'Regelmäßig'),
  'Massnahme', 'Maßnahme')
WHERE title ~ 'ae|oe|ue';

UPDATE risk SET description = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(description,
  'fuer ', 'für '), 'Jaehrlich', 'Jährlich'), 'Woechentlich', 'Wöchentlich'), 'Taeglich', 'Täglich'),
  'Geschaeft', 'Geschäft'), 'geprueft', 'geprüft'), 'durchgefuehrt', 'durchgeführt'),
  'Uebung', 'Übung')
WHERE description ~ 'ae|oe|ue|fuer';

-- Controls
UPDATE control SET title = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(title,
  'Verschluesselung', 'Verschlüsselung'), 'Praeventiv', 'Präventiv'),
  'Ueberwach', 'Überwach'), 'Regelmaessig', 'Regelmäßig'), 'Pruef', 'Prüf')
WHERE title ~ 'ae|oe|ue';

UPDATE control SET description = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(description,
  'fuer ', 'für '), 'Jaehrlich', 'Jährlich'), 'Woechentlich', 'Wöchentlich'),
  'Taeglich', 'Täglich'), 'durchgefuehrt', 'durchgeführt'), 'gemaess', 'gemäß'),
  'Massnahme', 'Maßnahme')
WHERE description ~ 'ae|oe|ue|fuer';

-- Audit
UPDATE audit SET title = REPLACE(REPLACE(REPLACE(title,
  'Jaehrlich', 'Jährlich'), 'Geschaeft', 'Geschäft'), 'Pruef', 'Prüf')
WHERE title ~ 'ae|oe|ue';

-- BIA assessments
UPDATE bia_assessment SET process_name = REPLACE(REPLACE(process_name,
  'Geschaeft', 'Geschäft'), 'fuer ', 'für ')
WHERE process_name ~ 'ae|oe|ue|fuer';

-- Documents
UPDATE document SET title = REPLACE(REPLACE(REPLACE(REPLACE(title,
  'Verschluesselung', 'Verschlüsselung'), 'Pruef', 'Prüf'),
  'fuer ', 'für '), 'Erklaerung', 'Erklärung')
WHERE title ~ 'ae|oe|ue|fuer';

-- Processes
UPDATE process SET name = REPLACE(REPLACE(REPLACE(name,
  'Geschaeft', 'Geschäft'), 'Pruef', 'Prüf'), 'Aufklaerung', 'Aufklärung')
WHERE name ~ 'ae|oe|ue';

-- Tasks
UPDATE task SET title = REPLACE(REPLACE(REPLACE(REPLACE(title,
  'Jaehrlich', 'Jährlich'), 'Pruef', 'Prüf'), 'fuer ', 'für '),
  'Uebung', 'Übung')
WHERE title ~ 'ae|oe|ue|fuer';

-- Vendors
UPDATE vendor SET name = REPLACE(name, 'fuer ', 'für ')
WHERE name ~ 'fuer';

-- Findings
UPDATE finding SET title = REPLACE(REPLACE(REPLACE(title,
  'Unzulaessig', 'Unzulässig'), 'Geringfuegig', 'Geringfügig'),
  'Massnahme', 'Maßnahme')
WHERE title ~ 'ae|oe|ue';

-- ESG Emissions - fix the â€" encoding issue
UPDATE esg_metric SET name = REPLACE(name, 'â€"', '–') WHERE name LIKE '%â€"%';
UPDATE esg_metric SET name = REPLACE(name, 'Schoepfung', 'Schöpfung') WHERE name LIKE '%Schoepfung%';
