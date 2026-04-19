-- ============================================================================
-- ARCTOS Seed: IEC 62443 — Industrial Communication Networks Security
-- Source: IEC/ISA 62443 series (multiple parts)
--
-- Includes the 7 Foundational Requirements (FR1–FR7) and the most-cited
-- System Requirements (SR) from 62443-3-3 plus selected component
-- requirements (CR) from 62443-4-2.
--
-- Target modules: isms, ics (any tenant operating OT/ICS — KRITIS, NIS2 OES)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-624430000001',
  'IEC 62443 OT/ICS Security',
  'IEC/ISA 62443 series for industrial automation and control system security. Includes 7 foundational requirements and the most-cited system and component requirements.',
  'control', 'platform', 'iec_62443', '2018+', 'en', true, '{isms,ics,bcms}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- ── 7 Foundational Requirements (FR) ───────────────────────────────────────
('c0000000-0000-0000-0000-624430000001', 'FR1', 'Identification and Authentication Control (IAC)', 'Identify and authenticate all users (humans, software processes and devices) before granting access', 0, 100, 'active'),
('c0000000-0000-0000-0000-624430000001', 'FR2', 'Use Control (UC)', 'Enforce the assigned privileges of authenticated users to perform requested actions on the system', 0, 200, 'active'),
('c0000000-0000-0000-0000-624430000001', 'FR3', 'System Integrity (SI)', 'Ensure the integrity of the IACS to prevent unauthorized manipulation', 0, 300, 'active'),
('c0000000-0000-0000-0000-624430000001', 'FR4', 'Data Confidentiality (DC)', 'Ensure the confidentiality of information on communication channels and in data repositories', 0, 400, 'active'),
('c0000000-0000-0000-0000-624430000001', 'FR5', 'Restricted Data Flow (RDF)', 'Segment the IACS via zones and conduits to limit unnecessary data flow', 0, 500, 'active'),
('c0000000-0000-0000-0000-624430000001', 'FR6', 'Timely Response to Events (TRE)', 'Respond to security violations by notifying authorities, reporting evidence and taking corrective action', 0, 600, 'active'),
('c0000000-0000-0000-0000-624430000001', 'FR7', 'Resource Availability (RA)', 'Ensure availability of the IACS against the degradation or denial of essential services', 0, 700, 'active'),

-- ── 62443-3-3 System Requirements (SR) — Selected ──────────────────────────
('c0000000-0000-0000-0000-624430000001', 'SR 1.1', 'Human user identification and authentication', 'IACS shall identify and authenticate all human users on all interfaces', 1, 110, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 1.2', 'Software process and device identification and authentication', 'IACS shall identify and authenticate all software processes and devices', 1, 120, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 1.4', 'Identifier management', 'IACS shall manage user identifiers (creation, modification, disabling, removal)', 1, 130, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 1.5', 'Authenticator management', 'IACS shall manage authenticators (initial issuance, rotation, revocation)', 1, 140, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 1.7', 'Strength of password-based authentication', 'IACS shall enforce password strength requirements', 1, 150, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 1.13', 'Access via untrusted networks', 'IACS shall control all methods of access via untrusted networks (require MFA, VPN)', 1, 160, 'active'),

('c0000000-0000-0000-0000-624430000001', 'SR 2.1', 'Authorization enforcement', 'IACS shall provide an authorization-enforcement mechanism for all identified users', 1, 210, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 2.2', 'Wireless use control', 'IACS shall authorize, monitor and enforce usage restrictions on wireless connectivity', 1, 220, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 2.4', 'Mobile code', 'IACS shall enforce restrictions on the use of mobile code', 1, 230, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 2.5', 'Session lock', 'IACS shall provide the capability to prevent further access by initiating a session lock', 1, 240, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 2.8', 'Auditable events', 'IACS shall generate audit records relevant to security for all components', 1, 250, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 2.10', 'Response to audit-processing failures', 'IACS shall handle audit-processing failures (alert, overwrite oldest, halt)', 1, 260, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 2.11', 'Timestamps', 'IACS shall provide synchronized, accurate timestamps for audit records', 1, 270, 'active'),

('c0000000-0000-0000-0000-624430000001', 'SR 3.1', 'Communication integrity', 'IACS shall protect the integrity of transmitted information', 1, 310, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 3.2', 'Malicious code protection', 'IACS shall provide capabilities for malware detection and protection', 1, 320, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 3.3', 'Security functionality verification', 'IACS shall verify the intended operation of security functions', 1, 330, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 3.4', 'Software and information integrity', 'IACS shall provide capability to detect and respond to integrity violations of software/information', 1, 340, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 3.8', 'Session integrity', 'IACS shall protect the integrity of sessions', 1, 350, 'active'),

('c0000000-0000-0000-0000-624430000001', 'SR 4.1', 'Information confidentiality', 'IACS shall protect the confidentiality of information at rest and in transit', 1, 410, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 4.2', 'Information persistence', 'IACS shall provide the capability to delete information from media before reuse or disposal', 1, 420, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 4.3', 'Use of cryptography', 'IACS shall use cryptographic algorithms approved by recognized standards', 1, 430, 'active'),

('c0000000-0000-0000-0000-624430000001', 'SR 5.1', 'Network segmentation', 'IACS shall segment the network into zones and conduits according to the risk-assessment outcomes', 1, 510, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 5.2', 'Zone boundary protection', 'IACS shall protect zone boundaries with policy-enforcement mechanisms', 1, 520, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 5.3', 'General-purpose person-to-person communication restrictions', 'IACS shall control general-purpose person-to-person communication', 1, 530, 'active'),

('c0000000-0000-0000-0000-624430000001', 'SR 6.1', 'Audit log accessibility', 'IACS shall provide read-only access to audit logs for authorized users', 1, 610, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 6.2', 'Continuous monitoring', 'IACS shall provide continuous monitoring capabilities', 1, 620, 'active'),

('c0000000-0000-0000-0000-624430000001', 'SR 7.1', 'Denial of service protection', 'IACS shall provide protection against denial-of-service conditions', 1, 710, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 7.2', 'Resource management', 'IACS shall manage system resources to limit the impact of unauthorized resource use', 1, 720, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 7.3', 'Control system backup', 'IACS shall provide a backup capability for user-level and system-level information', 1, 730, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 7.4', 'Control system recovery and reconstitution', 'IACS shall provide the capability to recover and reconstitute', 1, 740, 'active'),
('c0000000-0000-0000-0000-624430000001', 'SR 7.6', 'Network and security configuration settings', 'IACS shall provide the capability to identify and document the network and security configuration settings', 1, 750, 'active'),

-- ── 62443-4-2 Component Requirements (CR) — Selected ──────────────────────
('c0000000-0000-0000-0000-624430000001', 'CR 1.1', 'Component-level human-user identification and authentication', 'Components shall support unique identification and authentication of human users', 1, 810, 'active'),
('c0000000-0000-0000-0000-624430000001', 'CR 3.4', 'Software and information integrity (component)', 'Components shall provide the capability to verify integrity of firmware/software', 1, 820, 'active'),
('c0000000-0000-0000-0000-624430000001', 'CR 7.1', 'Component DoS protection', 'Components shall maintain essential functions when subject to DoS conditions', 1, 830, 'active'),
('c0000000-0000-0000-0000-624430000001', 'CR 7.6', 'Component network and security configuration settings', 'Components shall provide the capability to identify and document network and security configuration settings', 1, 840, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 7 FR + ~30 SR + 4 CR = ~41 IEC 62443 entries
