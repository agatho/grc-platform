-- ============================================================================
-- ARCTOS Seed: GDPR Legal Bases Catalog
-- Source: GDPR Art. 6(1), Art. 9(2), Art. 49
-- Structure: Article (Level 0) -> Legal bases (Level 1) -> Conditions (Level 2)
-- Target Modules: dpms
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-1e9a10000000',
  'GDPR Legal Bases',
  'Lawfulness of processing under the General Data Protection Regulation — Legal bases for standard processing (Art. 6), special categories (Art. 9), and international transfers (Art. 49).',
  'reference', 'platform', 'gdpr_legal_bases', '2018', true, '{dpms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Art. 6(1): Legal bases for processing
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6', 'Art. 6(1) — Lawfulness of processing', 'Processing shall be lawful only if and to the extent that at least one of the following legal bases applies', 0, 100, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6.1a', 'Consent', 'The data subject has given consent to the processing of his or her personal data for one or more specific purposes (Art. 6(1)(a))', 1, 101, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6.1b', 'Contractual necessity', 'Processing is necessary for the performance of a contract to which the data subject is party or to take steps at the request of the data subject prior to entering into a contract (Art. 6(1)(b))', 1, 102, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6.1c', 'Legal obligation', 'Processing is necessary for compliance with a legal obligation to which the controller is subject (Art. 6(1)(c))', 1, 103, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6.1d', 'Vital interests', 'Processing is necessary in order to protect the vital interests of the data subject or of another natural person (Art. 6(1)(d))', 1, 104, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6.1e', 'Public interest', 'Processing is necessary for the performance of a task carried out in the public interest or in the exercise of official authority vested in the controller (Art. 6(1)(e))', 1, 105, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.6.1f', 'Legitimate interests', 'Processing is necessary for the purposes of the legitimate interests pursued by the controller or by a third party, except where such interests are overridden by the interests or fundamental rights of the data subject (Art. 6(1)(f))', 1, 106, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Art. 9(2): Exceptions for special categories of personal data
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9', 'Art. 9(2) — Processing of special categories', 'Exceptions to the prohibition on processing special categories of personal data (Art. 9(1))', 0, 200, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2a', 'Explicit consent', 'The data subject has given explicit consent to the processing for one or more specified purposes (Art. 9(2)(a))', 1, 201, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2b', 'Employment and social security law', 'Processing is necessary for carrying out obligations in the field of employment, social security and social protection law (Art. 9(2)(b))', 1, 202, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2c', 'Vital interests (incapacity)', 'Processing is necessary to protect the vital interests of the data subject or another person where the data subject is physically or legally incapable of giving consent (Art. 9(2)(c))', 1, 203, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2d', 'Non-profit bodies', 'Processing is carried out by a foundation, association or non-profit body with a political, philosophical, religious or trade union aim, relating solely to members or former members (Art. 9(2)(d))', 1, 204, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2e', 'Manifestly made public', 'Processing relates to personal data which are manifestly made public by the data subject (Art. 9(2)(e))', 1, 205, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2f', 'Legal claims', 'Processing is necessary for the establishment, exercise or defence of legal claims or whenever courts are acting in their judicial capacity (Art. 9(2)(f))', 1, 206, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2g', 'Substantial public interest', 'Processing is necessary for reasons of substantial public interest on the basis of Union or Member State law (Art. 9(2)(g))', 1, 207, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2h', 'Health and social care', 'Processing is necessary for purposes of preventive or occupational medicine, medical diagnosis, provision of health or social care, or management of health or social care systems (Art. 9(2)(h))', 1, 208, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2i', 'Public health', 'Processing is necessary for reasons of public interest in the area of public health, such as cross-border health threats or ensuring high standards of quality and safety of health care and medicinal products (Art. 9(2)(i))', 1, 209, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.9.2j', 'Archiving and research', 'Processing is necessary for archiving purposes in the public interest, scientific or historical research purposes or statistical purposes (Art. 9(2)(j))', 1, 210, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Art. 49: Derogations for international transfers
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49', 'Art. 49 — Derogations for specific situations', 'Derogations for transfers of personal data to third countries or international organisations in the absence of an adequacy decision or appropriate safeguards', 0, 300, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1a', 'Explicit consent for transfer', 'The data subject has explicitly consented to the proposed transfer after being informed of the possible risks (Art. 49(1)(a))', 1, 301, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1b', 'Contractual necessity for transfer', 'The transfer is necessary for the performance of a contract between the data subject and the controller or for pre-contractual measures taken at the data subject''s request (Art. 49(1)(b))', 1, 302, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1c', 'Contract in interest of data subject', 'The transfer is necessary for the conclusion or performance of a contract concluded in the interest of the data subject between the controller and another person (Art. 49(1)(c))', 1, 303, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1d', 'Public interest for transfer', 'The transfer is necessary for important reasons of public interest (Art. 49(1)(d))', 1, 304, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1e', 'Legal claims for transfer', 'The transfer is necessary for the establishment, exercise or defence of legal claims (Art. 49(1)(e))', 1, 305, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1f', 'Vital interests for transfer', 'The transfer is necessary to protect the vital interests of the data subject or other persons where the data subject is incapable of giving consent (Art. 49(1)(f))', 1, 306, 'active'),
('c0000000-0000-0000-0000-1e9a10000000', 'Art.49.1g', 'Public register', 'The transfer is made from a register intended to provide information to the public and open to consultation (Art. 49(1)(g))', 1, 307, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
