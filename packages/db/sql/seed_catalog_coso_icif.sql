-- Seed: COSO Internal Control — Integrated Framework (2013)
-- 5 Components, 17 Principles

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  gen_random_uuid(),
  'COSO ICIF 2013 — Internal Control Framework',
  'Committee of Sponsoring Organizations: Internal Control — Integrated Framework (2013). 5 components with 17 principles for effective internal control systems.',
  'control',
  'platform',
  'coso_icif_2013',
  '2013',
  'en',
  true,
  ARRAY['ics', 'audit']
) ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (id, catalog_id, code, name, name_de, description, level, sort_order, status)
SELECT gen_random_uuid(), c.id, e.code, e.name, e.name_de, e.description, e.level, e.sort_order, 'active'
FROM catalog c
CROSS JOIN (VALUES
  -- Component 1: Control Environment
  ('CE', 'Control Environment', 'Kontrollumfeld', 'Set of standards, processes, and structures that provide the basis for carrying out internal control', 0, 1),
  ('CE-1', 'Principle 1: Integrity and Ethics', 'Prinzip 1: Integrität und Ethik', 'Organization demonstrates commitment to integrity and ethical values', 1, 2),
  ('CE-2', 'Principle 2: Board Independence', 'Prinzip 2: Unabhängigkeit des Vorstands', 'Board demonstrates independence from management and exercises oversight', 1, 3),
  ('CE-3', 'Principle 3: Organizational Structure', 'Prinzip 3: Organisationsstruktur', 'Management establishes structures, reporting lines, authorities and responsibilities', 1, 4),
  ('CE-4', 'Principle 4: Competence', 'Prinzip 4: Kompetenz', 'Organization demonstrates commitment to attract, develop, and retain competent individuals', 1, 5),
  ('CE-5', 'Principle 5: Accountability', 'Prinzip 5: Verantwortlichkeit', 'Organization holds individuals accountable for internal control responsibilities', 1, 6),
  -- Component 2: Risk Assessment
  ('RA', 'Risk Assessment', 'Risikobewertung', 'Dynamic and iterative process for identifying and assessing risks to achievement of objectives', 0, 7),
  ('RA-6', 'Principle 6: Clear Objectives', 'Prinzip 6: Klare Ziele', 'Organization specifies objectives with sufficient clarity to enable identification of risks', 1, 8),
  ('RA-7', 'Principle 7: Risk Identification', 'Prinzip 7: Risikoidentifikation', 'Organization identifies risks to the achievement of objectives and analyzes them', 1, 9),
  ('RA-8', 'Principle 8: Fraud Risk', 'Prinzip 8: Betrugsrisiko', 'Organization considers the potential for fraud in assessing risks', 1, 10),
  ('RA-9', 'Principle 9: Change Management', 'Prinzip 9: Änderungsmanagement', 'Organization identifies and assesses changes that could significantly impact the system of internal control', 1, 11),
  -- Component 3: Control Activities
  ('CA', 'Control Activities', 'Kontrollaktivitäten', 'Actions established through policies and procedures to help ensure management directives are carried out', 0, 12),
  ('CA-10', 'Principle 10: Control Selection', 'Prinzip 10: Kontrollauswahl', 'Organization selects and develops control activities that contribute to mitigation of risks', 1, 13),
  ('CA-11', 'Principle 11: Technology Controls', 'Prinzip 11: Technologiekontrollen', 'Organization selects and develops general control activities over technology', 1, 14),
  ('CA-12', 'Principle 12: Policies & Procedures', 'Prinzip 12: Richtlinien und Verfahren', 'Organization deploys control activities through policies and procedures', 1, 15),
  -- Component 4: Information & Communication
  ('IC', 'Information & Communication', 'Information und Kommunikation', 'Information is necessary for the entity to carry out internal control responsibilities', 0, 16),
  ('IC-13', 'Principle 13: Quality Information', 'Prinzip 13: Qualitätsinformationen', 'Organization obtains or generates and uses relevant, quality information', 1, 17),
  ('IC-14', 'Principle 14: Internal Communication', 'Prinzip 14: Interne Kommunikation', 'Organization internally communicates information necessary for internal control to function', 1, 18),
  ('IC-15', 'Principle 15: External Communication', 'Prinzip 15: Externe Kommunikation', 'Organization communicates with external parties regarding matters affecting internal control', 1, 19),
  -- Component 5: Monitoring Activities
  ('MA', 'Monitoring Activities', 'Überwachungsaktivitäten', 'Ongoing evaluations, separate evaluations, or combination to ascertain if components are present and functioning', 0, 20),
  ('MA-16', 'Principle 16: Ongoing/Separate Evaluations', 'Prinzip 16: Laufende/separate Bewertungen', 'Organization selects, develops, and performs ongoing and/or separate evaluations', 1, 21),
  ('MA-17', 'Principle 17: Deficiency Communication', 'Prinzip 17: Mängelmeldung', 'Organization evaluates and communicates internal control deficiencies in a timely manner', 1, 22)
) AS e(code, name, name_de, description, level, sort_order)
WHERE c.source = 'coso_icif_2013'
ON CONFLICT (catalog_id, code) DO NOTHING;
