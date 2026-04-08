-- Fix German Umlauts in demo data that were lost due to encoding issues

-- Risk titles
UPDATE risk SET title = 'Verlust von Schlüssel-Personal (CISO, DPO, IT-Architekten)' WHERE title LIKE '%Schluessel%';
UPDATE risk SET title = 'Ausfall des primären Cloud-Providers' WHERE title LIKE '%primaeren Cloud%';
UPDATE risk SET title = 'DSGVO-Verstoß durch Datenpanne' WHERE title LIKE 'DSGVO-Verstoss durch Datenpanne' AND title NOT LIKE '%(Updated)%';
UPDATE risk SET title = 'DSGVO-Verstoß durch Datenpanne (Updated)' WHERE title LIKE '%Verstoss%(Updated)%';
UPDATE risk SET title = 'Regulatorische Änderungen im EU AI Act' WHERE title LIKE '%Aenderungen im EU AI%';
UPDATE risk SET title = 'Abhängigkeit von einzelnem Cloud-Provider' WHERE title LIKE '%Abhaengigkeit von einzelnem%';
UPDATE risk SET title = 'DORA-Compliance für kritische IKT-Dienste' WHERE title LIKE '%DORA-Compliance fuer%';
UPDATE risk SET title = 'Mangelhafter Zugriffsentzug bei Offboarding' WHERE title LIKE '%Mangelhafter Zugriffsentzug%';

-- Risk descriptions
UPDATE risk SET description = REPLACE(description, 'erhoht', 'erhöht') WHERE description LIKE '%erhoht%';
UPDATE risk SET description = REPLACE(description, 'Verzoegertes', 'Verzögertes') WHERE description LIKE '%Verzoegertes%';
UPDATE risk SET description = REPLACE(description, 'koennen', 'können') WHERE description LIKE '%koennen%';
UPDATE risk SET description = REPLACE(description, 'Bussgelder', 'Bußgelder') WHERE description LIKE '%Bussgelder%';
UPDATE risk SET description = REPLACE(description, 'gemaess', 'gemäß') WHERE description LIKE '%gemaess%';
UPDATE risk SET description = REPLACE(description, 'Aufsichtsbehoerde', 'Aufsichtsbehörde') WHERE description LIKE '%Aufsichtsbehoerde%';
UPDATE risk SET description = REPLACE(description, 'Angriffsflaeche', 'Angriffsfläche') WHERE description LIKE '%Angriffsflaeche%';
UPDATE risk SET description = REPLACE(description, 'Oeffentliches', 'Öffentliches') WHERE description LIKE '%Oeffentliches%';
UPDATE risk SET description = REPLACE(description, 'fuehrt', 'führt') WHERE description LIKE '%fuehrt%';
UPDATE risk SET description = REPLACE(description, 'beeintraechtigen', 'beeinträchtigen') WHERE description LIKE '%beeintraechtigen%';
UPDATE risk SET description = REPLACE(description, 'ungenuegend', 'ungenügend') WHERE description LIKE '%ungenuegend%';
UPDATE risk SET description = REPLACE(description, 'Ungenuegend', 'Ungenügend') WHERE description LIKE '%Ungenuegend%';
UPDATE risk SET description = REPLACE(description, 'geprueft', 'geprüft') WHERE description LIKE '%geprueft%';
UPDATE risk SET description = REPLACE(description, 'regelmaessigen', 'regelmäßigen') WHERE description LIKE '%regelmaessigen%';
UPDATE risk SET description = REPLACE(description, 'Stabilitaet', 'Stabilität') WHERE description LIKE '%Stabilitaet%';
UPDATE risk SET description = REPLACE(description, 'Betriebsstabilitaet', 'Betriebsstabilität') WHERE description LIKE '%Betriebsstabilitaet%';

-- Control titles
UPDATE control SET title = REPLACE(title, 'Verschluesselungsrichtlinie', 'Verschlüsselungsrichtlinie') WHERE title LIKE '%Verschluesselungs%';
UPDATE control SET title = REPLACE(title, 'Datenportabilitaet', 'Datenportabilität') WHERE title LIKE '%Datenportabilitaet%';
UPDATE control SET title = REPLACE(title, 'Jaehrliche', 'Jährliche') WHERE title LIKE '%Jaehrliche%';

-- Control descriptions
UPDATE control SET description = REPLACE(description, 'Quartalmaessige', 'Quartalmäßige') WHERE description LIKE '%Quartalmaessige%';
UPDATE control SET description = REPLACE(description, 'fuer alle', 'für alle') WHERE description LIKE '%fuer alle%';
UPDATE control SET description = REPLACE(description, 'Angriffsflaeche', 'Angriffsfläche') WHERE description LIKE '%Angriffsflaeche%';
UPDATE control SET description = REPLACE(description, 'fuer kritische', 'für kritische') WHERE description LIKE '%fuer kritische%';
UPDATE control SET description = REPLACE(description, 'Sicherheitsbewertung', 'Sicherheitsbewertung') WHERE description LIKE '%Sicherheitsbewertung%';

-- Finding titles
UPDATE finding SET title = REPLACE(title, 'Loesung', 'Lösung') WHERE title LIKE '%Loesung%';
UPDATE finding SET title = REPLACE(title, 'regelmaessig ueberschritten', 'regelmäßig überschritten') WHERE title LIKE '%regelmaessig%';
UPDATE finding SET title = REPLACE(title, 'lueckenhaft bei Externen', 'lückenhaft bei Externen') WHERE title LIKE '%lueckenhaft%';

-- Finding descriptions
UPDATE finding SET description = REPLACE(description, 'Uebung', 'Übung') WHERE description LIKE '%Uebung%';
