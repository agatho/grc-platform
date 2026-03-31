-- ============================================================================
-- ARCTOS Seed: IDW Pruefungsstandards (IDW PS 980, 981, 982, 986)
-- Source: Institut der Wirtschaftspruefer in Deutschland e.V.
-- 4 Standards → Requirements per standard
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-1dae95000000',
  'IDW Pruefungsstandards (PS 980/981/982/986)',
  'IDW auditing standards for Compliance, Risk, Internal Control, and Tax Compliance Management Systems.',
  'control', 'platform', 'idw_ps', '2022', true, '{ics,audit}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- IDW PS 980: Principles for Proper Auditing of CMS
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1dae95000000', 'PS980', 'IDW PS 980 — Compliance Management Systems', 'Principles for the proper auditing of compliance management systems. Defines 7 basic elements of an effective CMS.', 0, 100, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-01', 'Compliance Culture', 'The tone at the top and management commitment that sets expectations for compliance behavior across the organization.', 1, 101, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-02', 'Compliance Goals', 'The definition and documentation of specific compliance objectives derived from the regulatory and business environment.', 1, 102, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-03', 'Compliance Risks', 'Systematic identification, assessment, and prioritization of compliance risks relevant to the organization.', 1, 103, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-04', 'Compliance Program', 'Measures and controls designed to mitigate identified compliance risks, including policies, procedures, and training.', 1, 104, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-05', 'Compliance Organization', 'Organizational structures, roles, responsibilities, and resources allocated to the compliance function.', 1, 105, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-06', 'Compliance Communication', 'Communication processes ensuring that compliance requirements, expectations, and findings are shared with relevant stakeholders.', 1, 106, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS980-07', 'Compliance Monitoring and Improvement', 'Ongoing monitoring, review, and continuous improvement of the compliance management system, including handling of compliance violations.', 1, 107, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- IDW PS 981: Principles for Proper Auditing of RMS
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1dae95000000', 'PS981', 'IDW PS 981 — Risk Management Systems', 'Principles for the proper auditing of risk management systems. Defines the core elements for an effective RMS.', 0, 200, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-01', 'Risk Culture', 'The attitudes, values, and behaviors that characterize how the organization considers risk in its daily activities and decision-making.', 1, 201, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-02', 'Risk Strategy', 'The strategic framework defining risk appetite, risk tolerance, and the overall approach to managing risk across the organization.', 1, 202, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-03', 'Risk Identification', 'Systematic processes for identifying existing and emerging risks that could affect the achievement of organizational objectives.', 1, 203, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-04', 'Risk Assessment', 'Analysis and evaluation of identified risks in terms of likelihood and impact, using qualitative and quantitative methods.', 1, 204, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-05', 'Risk Management and Control', 'Definition and implementation of risk responses including avoidance, mitigation, transfer, and acceptance, along with corresponding controls.', 1, 205, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-06', 'Risk Monitoring', 'Continuous monitoring of risk exposures, control effectiveness, and changes in the risk profile, including key risk indicators.', 1, 206, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS981-07', 'Risk Reporting', 'Regular and ad-hoc risk reporting to management and governance bodies, ensuring transparency and informed decision-making.', 1, 207, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- IDW PS 982: Principles for Proper Auditing of ICS
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1dae95000000', 'PS982', 'IDW PS 982 — Internal Control Systems', 'Principles for the proper auditing of internal control systems. Based on the COSO Internal Control framework elements.', 0, 300, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS982-01', 'Control Environment', 'The organizational structures, policies, standards, and processes that provide the basis for carrying out internal control across the entity.', 1, 301, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS982-02', 'Risk Assessment', 'The entitys process for identifying and analyzing risks to the achievement of objectives, forming a basis for determining how risks should be managed.', 1, 302, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS982-03', 'Control Activities', 'The policies and procedures that help ensure management directives are carried out, including approvals, authorizations, verifications, reconciliations, and segregation of duties.', 1, 303, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS982-04', 'Information and Communication', 'The systems and processes that support the identification, capture, and exchange of information in a form and timeframe that enables people to carry out their responsibilities.', 1, 304, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS982-05', 'Monitoring Activities', 'Ongoing evaluations, separate evaluations, or some combination of both used to ascertain whether each of the five components of internal control is present and functioning.', 1, 305, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- IDW PS 986: Principles for Proper Auditing of Tax CMS
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-1dae95000000', 'PS986', 'IDW PS 986 — Tax Compliance Management Systems', 'Principles for the proper auditing of tax compliance management systems. Defines 7 elements of an effective Tax CMS.', 0, 400, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-01', 'Tax Compliance Culture', 'The overall attitude and commitment of management and employees towards tax compliance, including tone at the top.', 1, 401, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-02', 'Tax Compliance Goals', 'Clear definition of tax compliance objectives, including timely and correct filing of tax returns and payment of tax liabilities.', 1, 402, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-03', 'Tax Compliance Risks', 'Systematic identification, assessment, and prioritization of tax risks across all relevant tax types and jurisdictions.', 1, 403, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-04', 'Tax Compliance Program', 'Measures and procedures to mitigate identified tax risks, including process descriptions, checklists, and internal guidelines.', 1, 404, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-05', 'Tax Compliance Organization', 'Organizational structures, clear assignment of roles and responsibilities, and adequate resources for tax compliance functions.', 1, 405, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-06', 'Tax Compliance Communication', 'Communication processes for tax-relevant information, changes in tax legislation, and dissemination of tax compliance policies.', 1, 406, 'active'),
('c0000000-0000-0000-0000-1dae95000000', 'PS986-07', 'Tax Compliance Monitoring and Improvement', 'Ongoing monitoring of tax compliance processes, evaluation of the Tax CMS effectiveness, and continuous improvement measures.', 1, 407, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
