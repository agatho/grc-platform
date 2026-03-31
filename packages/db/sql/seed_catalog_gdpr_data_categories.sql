-- ============================================================================
-- ARCTOS Seed: GDPR Data Categories Catalog
-- Source: GDPR Art. 4, Art. 9, Art. 10 — Personal Data Categories
-- Structure: Category Groups (Level 0) -> Specific categories (Level 1)
-- Target Modules: dpms
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-da7a00000000',
  'GDPR Data Categories',
  'Classification of personal data categories under the General Data Protection Regulation, including standard personal data (Art. 4), special categories (Art. 9), and criminal records (Art. 10).',
  'reference', 'platform', 'gdpr_data_categories', '2018', true, '{dpms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- DC-PID: Personal Identification Data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-PID', 'Personal Identification Data', 'Data that directly identifies a natural person', 0, 100, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-PID.01', 'Full name', 'First name, last name, maiden name, aliases', 1, 101, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-PID.02', 'Residential address', 'Street address, city, postal code, country of residence', 1, 102, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-PID.03', 'Date of birth', 'Date and place of birth', 1, 103, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-PID.04', 'National identification numbers', 'Government-issued ID numbers (e.g. national ID, passport number, social security number)', 1, 104, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-PID.05', 'Photographs and images', 'Photographs, video recordings, and other visual representations of a person', 1, 105, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-CON: Contact Data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-CON', 'Contact Data', 'Data used to contact or communicate with a natural person', 0, 200, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-CON.01', 'Email address', 'Personal and professional email addresses', 1, 201, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-CON.02', 'Phone number', 'Mobile, landline, and fax numbers', 1, 202, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-CON.03', 'Postal address', 'Mailing address for correspondence', 1, 203, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-EMP: Employment Data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-EMP', 'Employment Data', 'Data relating to a person''s employment and professional activities', 0, 300, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-EMP.01', 'Job title and role', 'Current and previous job titles, department, organizational role', 1, 301, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-EMP.02', 'Employer information', 'Name and address of current and previous employers', 1, 302, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-EMP.03', 'Salary and compensation', 'Salary, bonuses, benefits, pension contributions', 1, 303, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-EMP.04', 'Work history', 'Employment history, performance reviews, disciplinary records', 1, 304, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-EMP.05', 'Employment contracts', 'Terms of employment, contractual obligations, termination records', 1, 305, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-FIN: Financial Data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-FIN', 'Financial Data', 'Data relating to a person''s financial situation and transactions', 0, 400, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-FIN.01', 'Bank account details', 'Bank name, IBAN, BIC, account numbers', 1, 401, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-FIN.02', 'Credit information', 'Credit scores, credit history, creditworthiness assessments', 1, 402, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-FIN.03', 'Payment data', 'Credit card numbers, payment transaction records, billing information', 1, 403, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-FIN.04', 'Tax identification', 'Tax ID numbers, tax returns, tax-related correspondence', 1, 404, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-HEA: Health Data (Art. 9 GDPR — Special Category)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-HEA', 'Health Data (Art. 9)', 'Special category: data concerning the physical or mental health of a natural person, including the provision of health care services', 0, 500, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-HEA.01', 'Medical records', 'Diagnoses, treatment records, medical history, prescriptions', 1, 501, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-HEA.02', 'Disability information', 'Physical or mental disability status, degree of disability, accommodation needs', 1, 502, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-HEA.03', 'Health insurance data', 'Health insurance provider, policy numbers, claims history', 1, 503, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-HEA.04', 'Genetic data', 'Data relating to the inherited or acquired genetic characteristics of a natural person (Art. 4(13) GDPR)', 1, 504, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-BIO: Biometric Data (Art. 9 GDPR — Special Category)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-BIO', 'Biometric Data (Art. 9)', 'Special category: biometric data processed for the purpose of uniquely identifying a natural person (Art. 4(14) GDPR)', 0, 600, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-BIO.01', 'Fingerprints', 'Fingerprint scans and templates used for identification', 1, 601, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-BIO.02', 'Facial recognition data', 'Facial geometry data, facial recognition templates', 1, 602, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-BIO.03', 'Iris scans', 'Iris pattern data used for biometric identification', 1, 603, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-ART9: Other Art. 9 Special Categories
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-RAC', 'Racial or Ethnic Origin (Art. 9)', 'Special category: data revealing racial or ethnic origin', 0, 700, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-POL', 'Political Opinions (Art. 9)', 'Special category: data revealing political opinions or political party membership', 0, 800, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-REL', 'Religious or Philosophical Beliefs (Art. 9)', 'Special category: data revealing religious or philosophical beliefs', 0, 900, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-TRU', 'Trade Union Membership (Art. 9)', 'Special category: data revealing trade union membership', 0, 1000, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-SEX', 'Sexual Orientation (Art. 9)', 'Special category: data concerning a natural person''s sex life or sexual orientation', 0, 1100, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-CRM: Criminal Records (Art. 10 GDPR)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-CRM', 'Criminal Records (Art. 10)', 'Data relating to criminal convictions and offences, may only be processed under the control of official authority or when authorized by Union or Member State law (Art. 10 GDPR)', 0, 1200, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-OID: Online Identifiers
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-OID', 'Online Identifiers', 'Data relating to a person''s online presence and digital identity (Recital 30 GDPR)', 0, 1300, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-OID.01', 'IP addresses', 'IPv4 and IPv6 addresses assigned to user devices', 1, 1301, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-OID.02', 'Cookies and tracking identifiers', 'Cookie IDs, advertising IDs, browser fingerprints', 1, 1302, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-OID.03', 'Device identifiers', 'IMEI, MAC addresses, device serial numbers, hardware IDs', 1, 1303, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-OID.04', 'Location data', 'GPS coordinates, cell tower data, Wi-Fi-based location, geolocation history', 1, 1304, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-BEH: Behavioral Data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-BEH', 'Behavioral Data', 'Data relating to a person''s behavior, preferences, and habits', 0, 1400, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-BEH.01', 'Browsing history', 'Websites visited, search queries, page views, click patterns', 1, 1401, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-BEH.02', 'Purchase history', 'Products and services purchased, transaction amounts, purchase dates', 1, 1402, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-BEH.03', 'Preferences and interests', 'User preferences, stated interests, profile settings, marketing segments', 1, 1403, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- DC-COM: Communication Data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-da7a00000000', 'DC-COM', 'Communication Data', 'Data relating to a person''s communications', 0, 1500, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-COM.01', 'Email content', 'Content of sent and received emails, attachments', 1, 1501, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-COM.02', 'Call records', 'Phone call metadata, call duration, caller/callee information', 1, 1502, 'active'),
('c0000000-0000-0000-0000-da7a00000000', 'DC-COM.03', 'Chat and messaging logs', 'Instant messaging content, chat history, messaging metadata', 1, 1503, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
