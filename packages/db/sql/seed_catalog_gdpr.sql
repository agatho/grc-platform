-- ============================================================================
-- ARCTOS Seed: EU GDPR (2016/679) Control Catalog
-- Source: Regulation (EU) 2016/679 — General Data Protection Regulation
-- Chapters II–XI: Principles, Rights, Controller/Processor, Transfers,
--   Supervisory Authorities, Cooperation, Remedies, Delegated Acts, Final
-- ~90 entries across 3 levels (Chapter → Article → Key Requirement)
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-9d9200000001',
  'EU GDPR (2016/679)',
  'General Data Protection Regulation — European Union regulation on data protection and privacy. Chapters II–XI covering principles, data subject rights, controller/processor obligations, international transfers, and enforcement.',
  'control', 'platform', 'eu_gdpr', '2016/679', true, '{dpms,isms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Chapter II — Principles (Art. 5–11)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-II', 'Principles', 'Principles relating to processing of personal data (Articles 5–11)', 0, 100, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5', 'Principles relating to processing of personal data', 'Personal data shall be processed lawfully, fairly and transparently; collected for specified purposes; adequate, relevant and limited; accurate; kept no longer than necessary; processed with integrity and confidentiality. The controller is responsible for and must demonstrate compliance (accountability).', 1, 110, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.1a', 'Lawfulness, fairness and transparency', 'Personal data shall be processed lawfully, fairly and in a transparent manner in relation to the data subject.', 2, 111, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.1b', 'Purpose limitation', 'Personal data shall be collected for specified, explicit and legitimate purposes and not further processed in a manner incompatible with those purposes.', 2, 112, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.1c', 'Data minimisation', 'Personal data shall be adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed.', 2, 113, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.1d', 'Accuracy', 'Personal data shall be accurate and, where necessary, kept up to date; every reasonable step must be taken to ensure inaccurate data is erased or rectified without delay.', 2, 114, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.1e', 'Storage limitation', 'Personal data shall be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the data are processed.', 2, 115, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.1f', 'Integrity and confidentiality', 'Personal data shall be processed in a manner that ensures appropriate security, including protection against unauthorised or unlawful processing and against accidental loss, destruction or damage.', 2, 116, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.5.2', 'Accountability', 'The controller shall be responsible for, and be able to demonstrate compliance with, the data processing principles.', 2, 117, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.6', 'Lawfulness of processing', 'Processing shall be lawful only if and to the extent that at least one legal basis applies: consent, contract, legal obligation, vital interests, public interest, or legitimate interests.', 1, 120, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.6.1a', 'Consent as legal basis', 'The data subject has given consent to the processing of their personal data for one or more specific purposes.', 2, 121, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.6.1b', 'Contractual necessity', 'Processing is necessary for the performance of a contract to which the data subject is party or for pre-contractual steps.', 2, 122, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.6.1f', 'Legitimate interests', 'Processing is necessary for the purposes of the legitimate interests pursued by the controller or a third party, except where overridden by the interests or fundamental rights of the data subject.', 2, 123, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.7', 'Conditions for consent', 'The controller shall be able to demonstrate that the data subject has consented. Consent requests must be clearly distinguishable, intelligible, and easily accessible. The data subject has the right to withdraw consent at any time.', 1, 130, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.8', 'Conditions for child consent (information society services)', 'Processing of a child''s personal data based on consent shall be lawful where the child is at least 16 years old (or lower age set by Member State, minimum 13). Below that age, consent must be given by the holder of parental responsibility.', 1, 140, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.9', 'Processing of special categories of personal data', 'Processing of data revealing racial or ethnic origin, political opinions, religious beliefs, trade union membership, genetic data, biometric data, health data, sex life or sexual orientation is prohibited unless a specific exception applies.', 1, 150, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.10', 'Processing of criminal conviction data', 'Processing of personal data relating to criminal convictions and offences shall be carried out only under the control of official authority or when authorised by Union or Member State law.', 1, 160, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.11', 'Processing which does not require identification', 'If the purposes for which personal data are processed do not require identification, the controller shall not be obliged to maintain or acquire additional data solely to identify the data subject.', 1, 170, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter III — Rights of the Data Subject (Art. 12–23)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-III', 'Rights of the Data Subject', 'Rights of the data subject including transparency, access, rectification, erasure, restriction, portability, and objection (Articles 12–23)', 0, 200, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.12', 'Transparent information, communication and modalities', 'The controller shall take appropriate measures to provide information in a concise, transparent, intelligible and easily accessible form using clear and plain language. Information shall be provided free of charge. Response within one month.', 1, 210, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.12.3', 'Response timelines', 'The controller shall provide information on action taken on a request without undue delay and within one month of receipt, extendable by two further months for complex requests.', 2, 211, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.13', 'Information to be provided where data collected from data subject', 'When personal data are collected from the data subject, the controller shall provide: identity and contact details, DPO contact, purposes and legal basis, recipients, transfer intentions, retention period, and rights information.', 1, 220, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.14', 'Information to be provided where data not obtained from data subject', 'When data have not been obtained from the data subject, the controller shall provide the same information as Art. 13, plus categories of data and the source, within one month or at first communication.', 1, 230, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.15', 'Right of access by the data subject', 'The data subject has the right to obtain confirmation of whether personal data are being processed, and access to the data and information including purposes, categories, recipients, retention period, and the right to lodge a complaint.', 1, 240, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.15.3', 'Copy of data', 'The controller shall provide a copy of the personal data undergoing processing. For further copies, the controller may charge a reasonable fee based on administrative costs.', 2, 241, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.16', 'Right to rectification', 'The data subject has the right to obtain from the controller without undue delay the rectification of inaccurate personal data and the completion of incomplete personal data.', 1, 250, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.17', 'Right to erasure (right to be forgotten)', 'The data subject has the right to obtain the erasure of personal data without undue delay where the data are no longer necessary, consent is withdrawn, the subject objects, or data were unlawfully processed.', 1, 260, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.17.2', 'Notification to third parties of erasure', 'Where the controller has made personal data public, it shall take reasonable steps to inform other controllers processing those data of the erasure request.', 2, 261, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.18', 'Right to restriction of processing', 'The data subject has the right to obtain restriction of processing where accuracy is contested, processing is unlawful, the controller no longer needs the data, or the subject has objected pending verification.', 1, 270, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.19', 'Notification obligation regarding rectification, erasure or restriction', 'The controller shall communicate any rectification, erasure or restriction of processing to each recipient to whom data have been disclosed, unless impossible or involving disproportionate effort.', 1, 280, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.20', 'Right to data portability', 'The data subject has the right to receive their personal data in a structured, commonly used and machine-readable format and to transmit those data to another controller without hindrance.', 1, 290, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.20.2', 'Direct transfer between controllers', 'The data subject has the right to have personal data transmitted directly from one controller to another, where technically feasible.', 2, 291, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.21', 'Right to object', 'The data subject has the right to object at any time to processing based on public interest or legitimate interests. The controller shall cease processing unless demonstrating compelling legitimate grounds.', 1, 300, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.21.2', 'Objection to direct marketing', 'Where personal data are processed for direct marketing purposes, the data subject has the right to object at any time, and the controller must cease processing for that purpose.', 2, 301, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.22', 'Automated individual decision-making, including profiling', 'The data subject has the right not to be subject to a decision based solely on automated processing, including profiling, which produces legal effects or similarly significant effects, except where necessary for a contract, authorised by law, or based on explicit consent.', 1, 310, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.22.3', 'Safeguards for automated decisions', 'The controller shall implement suitable measures to safeguard the data subject''s rights and freedoms, including at least the right to obtain human intervention, to express their point of view and to contest the decision.', 2, 311, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.23', 'Restrictions', 'Union or Member State law may restrict the scope of rights and obligations (Articles 12–22 and Article 34) when such restriction respects the essence of fundamental rights and is necessary and proportionate in a democratic society.', 1, 320, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter IV — Controller and Processor (Art. 24–43)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-IV', 'Controller and Processor', 'Obligations of controllers and processors including data protection by design, DPO, records of processing, security, DPIA, and certification (Articles 24–43)', 0, 400, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.24', 'Responsibility of the controller', 'The controller shall implement appropriate technical and organisational measures to ensure and demonstrate that processing is performed in accordance with this Regulation, taking into account the nature, scope, context and purposes of processing and the risks to individuals.', 1, 410, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.25', 'Data protection by design and by default', 'The controller shall implement appropriate technical and organisational measures designed to implement data-protection principles (such as data minimisation) effectively, both at the time of determining the means for processing and at the time of processing itself.', 1, 420, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.25.2', 'Data protection by default', 'The controller shall implement appropriate measures for ensuring that, by default, only personal data necessary for each specific purpose are processed with regard to amount collected, extent of processing, retention period and accessibility.', 2, 421, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.26', 'Joint controllers', 'Where two or more controllers jointly determine the purposes and means of processing, they shall determine their respective responsibilities by means of a transparent arrangement.', 1, 430, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.27', 'Representatives of controllers not established in the Union', 'A controller or processor not established in the Union shall designate in writing a representative in the Union where Article 3(2) applies.', 1, 440, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.28', 'Processor', 'The controller shall use only processors providing sufficient guarantees to implement appropriate technical and organisational measures. Processing by a processor shall be governed by a contract or legal act binding the processor to the controller.', 1, 450, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.28.3', 'Processor contract requirements', 'The contract shall set out the subject-matter, duration, nature and purpose of processing, type of personal data, categories of data subjects, and obligations and rights of the controller.', 2, 451, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.29', 'Processing under the authority of the controller or processor', 'The processor and any person acting under the authority of the controller or processor who has access to personal data shall not process those data except on instructions from the controller.', 1, 460, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.30', 'Records of processing activities', 'Each controller shall maintain a record of processing activities under its responsibility containing the name and contact details, purposes, categories of data subjects and personal data, recipients, transfers, retention time limits, and security measures.', 1, 470, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.30.2', 'Processor records', 'Each processor shall maintain a record of all categories of processing activities carried out on behalf of a controller.', 2, 471, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'Art.31', 'Cooperation with the supervisory authority', 'The controller and the processor and, where applicable, their representatives shall cooperate with the supervisory authority in the performance of its tasks.', 1, 480, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.32', 'Security of processing', 'The controller and processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including pseudonymisation, encryption, ability to ensure ongoing confidentiality, integrity, availability and resilience, ability to restore availability, and regular testing and evaluation.', 1, 490, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.32.1a', 'Pseudonymisation and encryption', 'Implement pseudonymisation and encryption of personal data as a security measure where appropriate.', 2, 491, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.32.1b', 'Confidentiality, integrity, availability and resilience', 'Ensure the ability to ensure the ongoing confidentiality, integrity, availability and resilience of processing systems and services.', 2, 492, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.32.1c', 'Restore availability', 'Ensure the ability to restore the availability and access to personal data in a timely manner in the event of a physical or technical incident.', 2, 493, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.32.1d', 'Testing and evaluation', 'Implement a process for regularly testing, assessing and evaluating the effectiveness of technical and organisational measures for ensuring the security of the processing.', 2, 494, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.33', 'Notification of a personal data breach to the supervisory authority', 'In the case of a personal data breach, the controller shall without undue delay and, where feasible, not later than 72 hours after becoming aware of it, notify the breach to the competent supervisory authority, unless unlikely to result in a risk to individuals.', 1, 500, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.33.3', 'Breach notification content', 'The notification shall describe the nature of the breach, contact details of the DPO, likely consequences, and measures taken or proposed to address the breach and mitigate adverse effects.', 2, 501, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.34', 'Communication of a personal data breach to the data subject', 'When the personal data breach is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall communicate the breach to the data subject without undue delay.', 1, 510, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.35', 'Data protection impact assessment', 'Where a type of processing is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall carry out an assessment of the impact of the envisaged processing operations on the protection of personal data prior to the processing.', 1, 520, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.35.3a', 'DPIA mandatory: systematic evaluation of personal aspects', 'A DPIA is required for systematic and extensive evaluation of personal aspects based on automated processing including profiling, on which decisions are based that produce legal effects.', 2, 521, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.35.3b', 'DPIA mandatory: large scale processing of special categories', 'A DPIA is required for processing on a large scale of special categories of data or data relating to criminal convictions and offences.', 2, 522, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.35.3c', 'DPIA mandatory: systematic monitoring of public areas', 'A DPIA is required for systematic monitoring of a publicly accessible area on a large scale.', 2, 523, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.35.7', 'DPIA content requirements', 'The assessment shall contain a systematic description of processing operations, necessity and proportionality assessment, risk assessment, and measures to address risks including safeguards and security mechanisms.', 2, 524, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.36', 'Prior consultation', 'The controller shall consult the supervisory authority prior to processing where the DPIA indicates that processing would result in a high risk in the absence of measures taken by the controller to mitigate the risk.', 1, 530, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.37', 'Designation of the data protection officer', 'The controller and processor shall designate a DPO where processing is carried out by a public authority, where core activities require regular and systematic monitoring of data subjects on a large scale, or where core activities consist of large-scale processing of special categories of data.', 1, 540, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.38', 'Position of the data protection officer', 'The controller and processor shall ensure that the DPO is involved properly and in a timely manner in all issues relating to the protection of personal data. The DPO shall not receive any instructions regarding the exercise of their tasks.', 1, 550, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.39', 'Tasks of the data protection officer', 'The DPO shall inform and advise the controller/processor, monitor compliance, provide advice on DPIAs, cooperate with the supervisory authority, and act as a contact point for the supervisory authority.', 1, 560, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'Art.40', 'Codes of conduct', 'Associations and bodies representing categories of controllers or processors may prepare codes of conduct for the purpose of contributing to the proper application of this Regulation.', 1, 570, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.41', 'Monitoring of approved codes of conduct', 'A body which has an appropriate level of expertise in relation to the subject-matter of the code may be accredited to monitor compliance with a code of conduct.', 1, 580, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.42', 'Certification', 'Member States, supervisory authorities, the Board and the Commission shall encourage the establishment of data protection certification mechanisms, seals and marks for demonstrating compliance.', 1, 590, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.43', 'Certification bodies', 'Certification bodies with an appropriate level of expertise in data protection shall be accredited to issue and renew certification.', 1, 600, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter V — Transfers of Personal Data to Third Countries (Art. 44–49)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-V', 'Transfers to Third Countries or International Organisations', 'Rules for transfers of personal data to third countries or international organisations (Articles 44–49)', 0, 700, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.44', 'General principle for transfers', 'Any transfer of personal data to a third country or an international organisation shall take place only if the conditions laid down in Chapter V are complied with by the controller and processor.', 1, 710, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.45', 'Transfers on the basis of an adequacy decision', 'A transfer may take place where the Commission has decided that the third country, territory, sector or international organisation ensures an adequate level of protection.', 1, 720, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.46', 'Transfers subject to appropriate safeguards', 'In the absence of an adequacy decision, a controller or processor may transfer personal data only if appropriate safeguards are provided, including standard contractual clauses, binding corporate rules, approved codes of conduct, or approved certification mechanisms.', 1, 730, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.46.2b', 'Standard contractual clauses (SCC)', 'Appropriate safeguards may be provided by standard data protection clauses adopted by the Commission or by a supervisory authority and approved by the Commission.', 2, 731, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.47', 'Binding corporate rules', 'A supervisory authority shall approve binding corporate rules that are legally binding, confer enforceable rights on data subjects, and fulfil the requirements laid down in Article 47(2).', 1, 740, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.48', 'Transfers or disclosures not authorised by Union law', 'Any judgment of a court or tribunal and any decision of an administrative authority of a third country requiring transfer or disclosure shall only be recognised or enforceable if based on an international agreement.', 1, 750, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.49', 'Derogations for specific situations', 'In the absence of an adequacy decision or appropriate safeguards, a transfer may take place only in specific situations: explicit consent, contractual necessity, important reasons of public interest, legal claims, vital interests, or from a public register.', 1, 760, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.49.1a', 'Transfer based on explicit consent', 'The data subject has explicitly consented to the proposed transfer after being informed of the possible risks of such transfers due to the absence of an adequacy decision and appropriate safeguards.', 2, 761, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter VI — Independent Supervisory Authorities (Art. 51–59)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-VI', 'Independent Supervisory Authorities', 'Establishment, independence, competence, tasks and powers of supervisory authorities (Articles 51–59)', 0, 800, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.51', 'Supervisory authority', 'Each Member State shall provide for one or more independent public authorities to be responsible for monitoring the application of this Regulation.', 1, 810, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.55', 'Competence', 'Each supervisory authority shall be competent to perform the tasks assigned to and exercise the powers conferred on it in accordance with this Regulation on the territory of its own Member State.', 1, 820, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.57', 'Tasks', 'Each supervisory authority shall monitor and enforce the application of this Regulation, promote public awareness, advise national institutions, handle complaints, cooperate with other supervisory authorities, and conduct investigations.', 1, 830, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.58', 'Powers', 'Each supervisory authority shall have investigative powers (audits, access to data, access to premises), corrective powers (warnings, reprimands, orders, bans, fines), and authorisation and advisory powers.', 1, 840, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter VII — Cooperation and Consistency (Art. 60–76)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-VII', 'Cooperation and Consistency', 'Cooperation between lead supervisory authority and other concerned authorities, consistency mechanism, and the European Data Protection Board (Articles 60–76)', 0, 900, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.60', 'Cooperation between lead supervisory authority and other concerned authorities', 'The lead supervisory authority shall cooperate with the other supervisory authorities concerned and endeavour to reach consensus through the one-stop-shop mechanism.', 1, 910, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.61', 'Mutual assistance', 'Supervisory authorities shall provide each other with relevant information and mutual assistance in order to implement and apply this Regulation in a consistent manner.', 1, 920, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.63', 'Consistency mechanism', 'The consistency mechanism shall apply to ensure the consistent application of this Regulation throughout the Union.', 1, 930, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.68', 'European Data Protection Board', 'The European Data Protection Board (EDPB) is established as a body of the Union with legal personality. It shall act independently and issue guidelines, recommendations and best practices.', 1, 940, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter VIII — Remedies, Liability and Penalties (Art. 77–84)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-VIII', 'Remedies, Liability and Penalties', 'Right to lodge a complaint, right to effective judicial remedy, right to compensation, and administrative fines (Articles 77–84)', 0, 1000, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.77', 'Right to lodge a complaint with a supervisory authority', 'Every data subject has the right to lodge a complaint with a supervisory authority if they consider that the processing of their personal data infringes this Regulation.', 1, 1010, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.78', 'Right to an effective judicial remedy against a supervisory authority', 'Each natural or legal person has the right to an effective judicial remedy against a legally binding decision of a supervisory authority concerning them.', 1, 1020, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.79', 'Right to an effective judicial remedy against a controller or processor', 'Each data subject has the right to an effective judicial remedy where they consider that their rights under this Regulation have been infringed as a result of processing.', 1, 1030, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.82', 'Right to compensation and liability', 'Any person who has suffered material or non-material damage as a result of an infringement of this Regulation has the right to receive compensation from the controller or processor for the damage suffered.', 1, 1040, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.83', 'General conditions for imposing administrative fines', 'Each supervisory authority shall ensure that administrative fines are effective, proportionate and dissuasive. Fines up to EUR 10 million or 2% of total worldwide annual turnover (Art. 83(4)), or up to EUR 20 million or 4% of total worldwide annual turnover (Art. 83(5)) for more serious infringements.', 1, 1050, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.83.4', 'Fines for controller/processor obligations', 'Infringements of obligations of the controller and processor (Art. 8, 11, 25–39, 42, 43) shall be subject to fines up to EUR 10 million or 2% of total worldwide annual turnover.', 2, 1051, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.83.5', 'Fines for basic principles and rights', 'Infringements of the basic principles for processing (Art. 5, 6, 7, 9), data subjects'' rights (Art. 12–22), and transfers (Art. 44–49) shall be subject to fines up to EUR 20 million or 4% of total worldwide annual turnover.', 2, 1052, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.84', 'Penalties', 'Member States shall lay down rules on other penalties applicable to infringements of this Regulation in particular for infringements which are not subject to administrative fines.', 1, 1060, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter IX — Provisions relating to specific processing situations (Art. 85–91)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-IX', 'Specific Processing Situations', 'Provisions relating to specific processing situations including freedom of expression, public access to documents, national identification numbers, employment, archiving, secrecy obligations, and churches (Articles 85–91)', 0, 1100, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.85', 'Processing and freedom of expression and information', 'Member States shall reconcile the right to the protection of personal data with the right to freedom of expression and information, including processing for journalistic, academic, artistic or literary expression.', 1, 1110, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.88', 'Processing in the context of employment', 'Member States may provide for more specific rules to ensure the protection of rights and freedoms in respect of the processing of employees'' personal data in the employment context.', 1, 1120, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.89', 'Safeguards for archiving, research and statistics', 'Processing for archiving purposes in the public interest, scientific or historical research, or statistical purposes shall be subject to appropriate safeguards including technical and organisational measures to ensure respect for the principle of data minimisation.', 1, 1130, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter X — Delegated Acts and Implementing Acts (Art. 92–93)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-X', 'Delegated Acts and Implementing Acts', 'Exercise of delegation and committee procedure for implementing acts (Articles 92–93)', 0, 1200, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Chapter XI — Final Provisions (Art. 94–99)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-9d9200000001', 'CH-XI', 'Final Provisions', 'Repeal of Directive 95/46/EC, relationship to the ePrivacy Directive, entry into force and application date of 25 May 2018 (Articles 94–99)', 0, 1300, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.94', 'Repeal of Directive 95/46/EC', 'Directive 95/46/EC is repealed with effect from 25 May 2018. References to the repealed Directive shall be construed as references to this Regulation.', 1, 1310, 'active'),
('c0000000-0000-0000-0000-9d9200000001', 'Art.99', 'Entry into force and application', 'This Regulation entered into force on 24 May 2016 and applies from 25 May 2018.', 1, 1320, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Summary: ~90 entries (10 chapters + ~45 articles + ~35 key requirements)
-- ============================================================================
