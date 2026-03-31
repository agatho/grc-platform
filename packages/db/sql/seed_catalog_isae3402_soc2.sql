-- ============================================================================
-- ARCTOS Seed: ISAE 3402 / SOC 2 Trust Services Criteria
-- Source: AICPA Trust Services Criteria (2017, updated 2022) / IAASB ISAE 3402
-- 5 Trust Service Categories → Criteria → Points of Focus
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-50c200000000',
  'ISAE 3402 / SOC 2 Trust Services Criteria',
  'Trust Services Criteria for SOC 2 / ISAE 3402 reporting. 5 categories: Security (Common Criteria), Availability, Processing Integrity, Confidentiality, and Privacy.',
  'control', 'platform', 'isae3402_soc2', '2022', true, '{audit,tprm}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- CC: Common Criteria (Security) — CC1 through CC9
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'CC', 'Common Criteria (Security)', 'The foundational security criteria that apply to all SOC 2 engagements. Organized into 9 series covering control environment through change management.', 0, 100, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC1', 'Control Environment', 'Criteria related to the set of standards, processes, and structures that provide the basis for carrying out internal control across the organization.', 1, 101, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC1.1', 'COSO Principle 1: Demonstrates Commitment to Integrity and Ethical Values', 'The entity demonstrates a commitment to integrity and ethical values.', 2, 1011, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC1.2', 'COSO Principle 2: Exercises Oversight Responsibility', 'The board of directors demonstrates independence from management and exercises oversight.', 2, 1012, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC1.3', 'COSO Principle 3: Establishes Structure, Authority, and Responsibility', 'Management establishes structures, reporting lines, and appropriate authorities and responsibilities.', 2, 1013, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC1.4', 'COSO Principle 4: Demonstrates Commitment to Competence', 'The entity demonstrates a commitment to attract, develop, and retain competent individuals.', 2, 1014, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC1.5', 'COSO Principle 5: Enforces Accountability', 'The entity holds individuals accountable for their internal control responsibilities.', 2, 1015, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'CC2', 'Communication and Information', 'Criteria related to internal and external communication of information necessary to support the functioning of internal control.', 1, 102, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC2.1', 'COSO Principle 13: Uses Relevant Information', 'The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.', 2, 1021, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC2.2', 'COSO Principle 14: Communicates Internally', 'The entity internally communicates information, including objectives and responsibilities for internal control.', 2, 1022, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC2.3', 'COSO Principle 15: Communicates Externally', 'The entity communicates with external parties regarding matters affecting the functioning of internal control.', 2, 1023, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'CC3', 'Risk Assessment', 'Criteria related to the process of identifying and assessing risks to the achievement of objectives.', 1, 103, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC3.1', 'COSO Principle 6: Specifies Suitable Objectives', 'The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks.', 2, 1031, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC3.2', 'COSO Principle 7: Identifies and Analyzes Risk', 'The entity identifies risks to the achievement of its objectives and analyzes risks as a basis for determining how they should be managed.', 2, 1032, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC3.3', 'COSO Principle 8: Assesses Fraud Risk', 'The entity considers the potential for fraud in assessing risks to the achievement of objectives.', 2, 1033, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC3.4', 'COSO Principle 9: Identifies and Analyzes Significant Change', 'The entity identifies and assesses changes that could significantly impact the system of internal control.', 2, 1034, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'CC4', 'Monitoring Activities', 'Criteria related to ongoing and separate evaluations to ascertain whether components of internal control are present and functioning.', 1, 104, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC4.1', 'COSO Principle 16: Selects and Develops Ongoing and Separate Evaluations', 'The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether internal control components are present and functioning.', 2, 1041, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC4.2', 'COSO Principle 17: Evaluates and Communicates Deficiencies', 'The entity evaluates and communicates internal control deficiencies in a timely manner to those parties responsible for taking corrective action.', 2, 1042, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'CC5', 'Control Activities', 'Criteria related to actions established through policies and procedures that help ensure management directives to mitigate risks are carried out.', 1, 105, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC5.1', 'COSO Principle 10: Selects and Develops Control Activities', 'The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives.', 2, 1051, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC5.2', 'COSO Principle 11: Selects and Develops General Controls over Technology', 'The entity selects and develops general control activities over technology to support the achievement of objectives.', 2, 1052, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC5.3', 'COSO Principle 12: Deploys through Policies and Procedures', 'The entity deploys control activities through policies that establish what is expected and procedures that put policies into action.', 2, 1053, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'CC6', 'Logical and Physical Access Controls', 'Criteria related to restricting logical and physical access to the system and protecting against unauthorized access.', 1, 106, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC7', 'System Operations', 'Criteria related to detecting and monitoring anomalies in system operations and evaluating whether incidents need to be managed as security events or incidents.', 1, 107, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC8', 'Change Management', 'Criteria related to controlling changes to infrastructure, data, software, and procedures to reduce risk of unauthorized changes.', 1, 108, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'CC9', 'Risk Mitigation', 'Criteria related to selecting and developing risk mitigation activities, including vendor and business partner controls.', 1, 109, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- A: Availability
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'A', 'Availability', 'The system is available for operation and use as committed or agreed upon.', 0, 200, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'A1', 'System Availability', 'The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand and enable the implementation of additional capacity to meet its objectives.', 1, 201, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'A1.1', 'Current Processing Capacity', 'The entity maintains, monitors, and evaluates current processing capacity and use of system components to manage capacity demand.', 2, 2011, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'A1.2', 'Environmental Protections', 'The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup processes, and recovery infrastructure.', 2, 2012, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'A1.3', 'Recovery Testing', 'The entity tests recovery plan procedures supporting system recovery to meet its objectives.', 2, 2013, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- PI: Processing Integrity
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'PI', 'Processing Integrity', 'System processing is complete, valid, accurate, timely, and authorized to meet the entitys objectives.', 0, 300, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'PI1', 'Processing Completeness, Accuracy, and Timeliness', 'The entity implements policies and procedures over system processing to ensure completeness, accuracy, timeliness, and authorization of system inputs, system processing, and outputs.', 1, 301, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'PI1.1', 'Input Processing', 'The entity implements policies and procedures over the completeness, accuracy, and timeliness of inputs.', 2, 3011, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'PI1.2', 'System Processing', 'The entity implements policies and procedures to result in processing that is complete, valid, accurate, timely, and authorized.', 2, 3012, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'PI1.3', 'Output Processing', 'The entity implements policies and procedures to ensure the completeness, accuracy, and timeliness of outputs.', 2, 3013, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'PI1.4', 'Error and Exception Handling', 'The entity implements policies and procedures to enable the definition, identification, and handling of errors and exceptions.', 2, 3014, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- C: Confidentiality
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'C', 'Confidentiality', 'Information designated as confidential is protected as committed or agreed upon.', 0, 400, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'C1', 'Confidential Information Protection', 'The entity identifies and maintains confidential information to meet the entitys objectives related to confidentiality.', 1, 401, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'C1.1', 'Identification of Confidential Information', 'The entity identifies and maintains confidential information and defines the retention period for such information.', 2, 4011, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'C1.2', 'Disposal of Confidential Information', 'The entity disposes of confidential information to meet the entitys objectives related to confidentiality.', 2, 4012, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- P: Privacy
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-50c200000000', 'P', 'Privacy', 'Personal information is collected, used, retained, disclosed, and disposed of to meet the entitys objectives.', 0, 500, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P1', 'Notice and Communication of Objectives', 'The entity provides notice to data subjects about its privacy practices to meet its objectives related to privacy.', 1, 501, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P2', 'Choice and Consent', 'The entity communicates choices available regarding the collection, use, retention, disclosure, and disposal of personal information and obtains consent.', 1, 502, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P3', 'Collection', 'The entity collects personal information only for the purposes identified in the notice to meet its objectives related to privacy.', 1, 503, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P4', 'Use, Retention, and Disposal', 'The entity limits the use and retention of personal information to the purposes identified in the notice, and disposes of it when no longer needed.', 1, 504, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P5', 'Access', 'The entity provides data subjects with access to their personal information for review and correction, including a mechanism for obtaining consent for changes.', 1, 505, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P6', 'Disclosure and Notification', 'The entity discloses personal information to third parties with the consent of the data subject and notifies data subjects of incidents and breaches.', 1, 506, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P7', 'Quality', 'The entity collects and maintains accurate, up-to-date, complete, and relevant personal information to meet its objectives related to privacy.', 1, 507, 'active'),
('c0000000-0000-0000-0000-50c200000000', 'P8', 'Monitoring and Enforcement', 'The entity monitors compliance with its privacy policies and procedures and has procedures to address privacy-related complaints and disputes.', 1, 508, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
