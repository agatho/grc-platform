-- ============================================================================
-- ARCTOS Seed: OWASP Application Security Verification Standard (ASVS) v4.0.3
-- Source: OWASP ASVS 4.0.3 (October 2021)
-- Structure: Chapters (Level 0) -> Sections (Level 1) -> Key requirements (Level 2)
-- Target Modules: isms
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-0ea5a0000000',
  'OWASP ASVS 4.0.3',
  'OWASP Application Security Verification Standard — 14 chapters of security verification requirements for designing, developing, and testing modern web applications. Three verification levels (L1, L2, L3).',
  'control', 'platform', 'owasp_asvs', '4.0.3', true, '{isms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- V1: Architecture, Design and Threat Modeling
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V1', 'Architecture, Design and Threat Modeling', 'Requirements for a secure development lifecycle including threat modeling, secure architecture, and security design patterns', 0, 100, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.1', 'Secure Software Development Lifecycle', 'Requirements for a secure SDLC including threat modeling, secure design reviews, and security testing', 1, 101, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.2', 'Authentication Architecture', 'Architectural requirements for authentication including centralized authentication mechanisms', 1, 102, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.4', 'Access Control Architecture', 'Architectural requirements for access control including enforcement at trusted service layers', 1, 103, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.5', 'Input and Output Architecture', 'Architectural requirements for input validation and output encoding at a trusted service layer', 1, 104, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.1.1', 'Verify the use of a secure software development lifecycle', 'A secure SDLC is in use that addresses security in all stages of development (L2)', 2, 105, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.1.2', 'Verify the use of threat modeling for every design change', 'Threat modeling is performed for every design change or sprint planning to identify threats and select countermeasures (L2)', 2, 106, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V1.1.5', 'Verify definition of all application components', 'All application components are defined in terms of business and security functions they provide (L2)', 2, 107, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V2: Authentication
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V2', 'Authentication', 'Requirements for verifying the identity of users, services, or devices accessing the application', 0, 200, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.1', 'Password Security', 'Requirements for secure password storage and policies', 1, 201, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.2', 'General Authenticator Security', 'Requirements for authenticator agility, resistance to brute force, and default credential detection', 1, 202, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.1.1', 'Verify that user-set passwords are at least 12 characters in length', 'User passwords shall be at least 12 characters in length after combining spaces (L1)', 2, 203, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.1.7', 'Verify that passwords are checked against a set of breached passwords', 'Passwords submitted during registration are checked against a set of known breached passwords (L1)', 2, 204, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.2.1', 'Verify anti-automation controls are effective against credential stuffing', 'Anti-automation controls are effective at mitigating breached credential testing, brute force, and account lockout attacks (L1)', 2, 205, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.8.1', 'Verify that time-based OTPs have a defined lifetime', 'Time-based OTPs have a defined lifetime before expiring (L1)', 2, 206, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V2.9.1', 'Verify that cryptographic keys used in verification are stored securely', 'Cryptographic keys used in verification are stored securely and protected from disclosure (L2)', 2, 207, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V3: Session Management
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V3', 'Session Management', 'Requirements for securely handling user sessions', 0, 300, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.1', 'Fundamental Session Management Security', 'Requirements for session token generation and handling', 1, 301, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.2', 'Session Binding', 'Requirements for session binding to prevent hijacking', 1, 302, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.2.1', 'Verify the application generates a new session token on user authentication', 'A new session token is generated on user authentication to prevent session fixation (L1)', 2, 303, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.3.1', 'Verify that logout and expiration invalidate the session token', 'Logout and expiration invalidate the session token such that the back button or downstream relying party cannot resume an authenticated session (L1)', 2, 304, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.4.1', 'Verify that cookie-based session tokens have the Secure attribute set', 'Cookie-based session tokens have the Secure attribute set (L1)', 2, 305, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.5.1', 'Verify the application allows users to revoke OAuth tokens that form trust relationships', 'The application allows users to revoke OAuth tokens that form trust relationships with linked applications (L2)', 2, 306, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V3.7.1', 'Verify the application logs session management events', 'The application ensures a full, valid login session or requires re-authentication or secondary verification before allowing sensitive transactions or account modifications (L1)', 2, 307, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V4: Access Control
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V4', 'Access Control', 'Requirements for enforcing access control policies at a trusted service layer', 0, 400, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.1', 'General Access Control Design', 'Requirements for general access control design principles', 1, 401, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.2', 'Operation Level Access Control', 'Requirements for verifying users have required permissions for actions', 1, 402, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.1.1', 'Verify that the application enforces access control rules on a trusted service layer', 'Access control rules are enforced on a trusted service layer and not at the client side (L1)', 2, 403, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.1.2', 'Verify that all user and data attributes used by access controls cannot be manipulated', 'All user and data attributes and policy information used by access controls cannot be manipulated by end users (L1)', 2, 404, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.1.3', 'Verify that the principle of least privilege exists', 'The principle of least privilege exists — users should only be able to access functions, data files, URLs, controllers, services, and other resources for which they possess specific authorization (L1)', 2, 405, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.2.1', 'Verify that sensitive data and APIs are protected against IDOR attacks', 'Sensitive data and APIs are protected against Insecure Direct Object Reference attacks targeting creation, reading, updating and deletion of records (L1)', 2, 406, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V4.3.1', 'Verify administrative interfaces use appropriate multi-factor authentication', 'Administrative interfaces use appropriate multi-factor authentication to prevent unauthorized use (L1)', 2, 407, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V5: Validation, Sanitization and Encoding
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V5', 'Validation, Sanitization and Encoding', 'Requirements for input validation, output encoding, and parameterized queries', 0, 500, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.1', 'Input Validation', 'Requirements for positive input validation and data type enforcement', 1, 501, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.2', 'Sanitization and Sandboxing', 'Requirements for sanitizing untrusted HTML input and ensuring safe rendering', 1, 502, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.1.1', 'Verify that HTTP parameter pollution attacks are defended against', 'The application has defenses against HTTP parameter pollution attacks particularly if the framework makes no distinction about the source of request parameters (L1)', 2, 503, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.2.1', 'Verify that all untrusted HTML input is properly sanitized', 'All untrusted HTML input from WYSIWYG editors or similar is properly sanitized with an HTML sanitizer library or framework feature (L1)', 2, 504, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.3.1', 'Verify that output encoding is relevant for the interpreter and context', 'Output encoding is relevant for the interpreter and context required to prevent XSS (L1)', 2, 505, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.3.4', 'Verify that data selection or database queries use parameterized queries', 'Data selection or database queries use parameterized queries, ORMs, entity frameworks, or are otherwise protected from SQL injection (L1)', 2, 506, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V5.5.1', 'Verify that serialized objects use integrity checks or encryption', 'Serialized objects use integrity checks or encryption to prevent hostile object creation or data tampering (L1)', 2, 507, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V6: Stored Cryptography
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V6', 'Stored Cryptography', 'Requirements for ensuring that cryptography is used correctly to protect sensitive data', 0, 600, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.1', 'Data Classification', 'Requirements for classifying data so appropriate protections are applied', 1, 601, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.2', 'Algorithms', 'Requirements for using approved and current cryptographic algorithms', 1, 602, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.1.1', 'Verify that regulated private data is stored encrypted while at rest', 'Regulated private data is stored encrypted while at rest such as PII, sensitive personal information, or data assessed likely to be subject to GDPR (L2)', 2, 603, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.2.1', 'Verify that all cryptographic modules fail securely', 'All cryptographic modules fail securely and errors are handled in a way that does not enable oracle padding (L1)', 2, 604, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.2.5', 'Verify that known insecure block modes, padding modes, ciphers with small block sizes, and weak hashing algorithms are not used', 'Insecure block modes (ECB), padding modes (PKCS#1 v1.5), ciphers with small block sizes (Triple-DES, Blowfish), and weak hashing algorithms (MD5, SHA1) are not used (L1)', 2, 605, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.3.1', 'Verify that all random numbers and strings are generated using a CSPRNG', 'All random numbers, random file names, random GUIDs, and random strings are generated using the cryptographic module approved CSPRNG (L2)', 2, 606, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V6.4.1', 'Verify that a key management solution is in place', 'A secrets management solution such as a key vault is used to securely create, store, control access to, and destroy secrets (L2)', 2, 607, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V7: Error Handling and Logging
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V7', 'Error Handling and Logging', 'Requirements for secure error handling and sufficient logging for incident detection', 0, 700, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.1', 'Log Content', 'Requirements for logging security-relevant events', 1, 701, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.2', 'Log Processing', 'Requirements for secure log processing and storage', 1, 702, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.1.1', 'Verify the application does not log credentials or payment details', 'The application does not log credentials or payment details and session tokens should only be stored in logs in an irreversible hashed form (L1)', 2, 703, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.1.2', 'Verify that all authentication decisions are logged', 'All authentication decisions are logged without storing sensitive session tokens or passwords, including requests with relevant metadata (L2)', 2, 704, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.2.1', 'Verify that all authentication decisions are logged without sensitive data', 'All access control decisions are logged and all failed decisions are logged, including the identity and IP of the requestor (L2)', 2, 705, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.3.1', 'Verify that all logging components appropriately encode data to prevent log injection', 'All logging components appropriately encode data to prevent log injection (L2)', 2, 706, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V7.4.1', 'Verify that a generic error message is shown when an unexpected error occurs', 'A generic message is shown when an unexpected or security-sensitive error occurs, potentially with a unique ID for support (L1)', 2, 707, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V8: Data Protection
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V8', 'Data Protection', 'Requirements for protecting sensitive data from unauthorized access and disclosure', 0, 800, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.1', 'General Data Protection', 'Requirements for general data protection controls', 1, 801, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.2', 'Client-side Data Protection', 'Requirements for protecting data on the client side', 1, 802, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.1.1', 'Verify the application protects sensitive data from being cached in server components', 'The application protects sensitive data from being cached in server components such as load balancers and application caches (L2)', 2, 803, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.1.2', 'Verify that all cached or temporary copies of sensitive data are protected from unauthorized access', 'All cached or temporary copies of sensitive data stored on the server are protected from unauthorized access or purged after the authorized user accesses them (L2)', 2, 804, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.2.1', 'Verify the application sets sufficient anti-caching headers', 'The application sets sufficient anti-caching headers so that sensitive data is not cached in modern browsers (L1)', 2, 805, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.3.1', 'Verify that sensitive data is sent to the server in the HTTP message body or headers', 'Sensitive data is sent to the server in the HTTP message body or headers and that query string parameters from any HTTP verb do not contain sensitive data (L1)', 2, 806, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V8.3.4', 'Verify that all sensitive data created and processed by the application has been identified', 'All sensitive data created and processed by the application has been identified and there is a policy in place on how to deal with sensitive data (L1)', 2, 807, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V9: Communication
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V9', 'Communication', 'Requirements for securing communication channels', 0, 900, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V9.1', 'Client Communication Security', 'Requirements for client-to-server communication security using TLS', 1, 901, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V9.2', 'Server Communication Security', 'Requirements for server-to-server communication security', 1, 902, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V9.1.1', 'Verify that TLS is used for all client connectivity', 'TLS is used for all client connectivity and does not fall back to insecure or unencrypted communications (L1)', 2, 903, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V9.1.2', 'Verify using up-to-date TLS testing tools that only strong cipher suites are enabled', 'Only strong cipher suites are enabled with the strongest cipher suites set as preferred using online TLS testing tools (L1)', 2, 904, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V9.1.3', 'Verify that only the latest recommended versions of TLS protocol are enabled', 'Only the latest recommended versions of the TLS protocol are enabled such as TLS 1.2 and TLS 1.3 (L1)', 2, 905, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V9.2.1', 'Verify that connections to and from the server use trusted TLS certificates', 'Connections to and from the server use trusted TLS certificates and the server rejects connections to non-trusted endpoints (L2)', 2, 906, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V10: Malicious Code
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V10', 'Malicious Code', 'Requirements to ensure code does not contain malicious functionality', 0, 1000, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V10.1', 'Code Integrity', 'Requirements for ensuring application code integrity', 1, 1001, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V10.2', 'Malicious Code Search', 'Requirements for verifying that code does not contain back doors, time bombs, or other malicious code', 1, 1002, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V10.1.1', 'Verify that a code analysis tool is in use', 'A code analysis tool is in use that can detect potentially malicious code such as time functions, unsafe file operations, and suspicious network connections (L3)', 2, 1003, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V10.2.1', 'Verify that the application source code and third-party libraries do not contain back doors', 'The application source code and third-party libraries do not contain unauthorized phone home or data collection capabilities (L2)', 2, 1004, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V10.3.1', 'Verify that if the application has auto-update functionality, updates are obtained over secure channels and digitally signed', 'If the application has a client-side or server-side auto-update feature, updates should be obtained over secure channels and digitally signed (L1)', 2, 1005, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V11: Business Logic
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V11', 'Business Logic', 'Requirements to ensure business logic flows are sequential, processed in realistic human speed, and not bypassed', 0, 1100, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V11.1', 'Business Logic Security', 'Requirements for securing business logic against abuse and manipulation', 1, 1101, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V11.1.1', 'Verify that the application will only process business logic flows for the same user in sequential step order', 'The application will only process business logic flows for the same user in sequential step order and not skip steps (L1)', 2, 1102, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V11.1.2', 'Verify that the application will only process business logic flows with all steps being processed in realistic human time', 'The application will only process business logic flows with all steps being processed in realistic human time to prevent automated attacks (L1)', 2, 1103, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V11.1.5', 'Verify the application has business logic limits or validation to protect against likely business risks or threats', 'The application has business logic limits or validation to protect against likely business risks or threats identified during threat modeling or similar activities (L1)', 2, 1104, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V11.1.6', 'Verify that the application does not suffer from time-of-check time-of-use (TOCTOU) issues', 'The application does not suffer from TOCTOU issues or other race conditions for sensitive business logic operations (L2)', 2, 1105, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V12: Files and Resources
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V12', 'Files and Resources', 'Requirements for secure file upload, storage and serving of files from untrusted sources', 0, 1200, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V12.1', 'File Upload', 'Requirements for secure file upload handling', 1, 1201, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V12.3', 'File Execution', 'Requirements to prevent execution of uploaded files', 1, 1202, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V12.1.1', 'Verify that the application will not accept large files that could fill up storage or cause a denial of service', 'The application will not accept large files that could fill up storage or cause a denial of service (L1)', 2, 1203, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V12.1.2', 'Verify that the application checks compressed files against maximum allowed uncompressed size', 'The application checks compressed files against maximum allowed uncompressed size and against maximum number of files before uncompressing (L2)', 2, 1204, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V12.3.1', 'Verify that user-submitted filename metadata is not used directly by system or framework filesystems', 'User-submitted filename metadata is not used directly by system or framework filesystems and that a URL API is used to protect against path traversal (L1)', 2, 1205, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V12.4.1', 'Verify that files obtained from untrusted sources are stored outside the web root', 'Files obtained from untrusted sources are stored outside the web root with limited permissions (L1)', 2, 1206, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V13: API and Web Service
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V13', 'API and Web Service', 'Requirements for securing APIs and web services including RESTful, GraphQL, SOAP, and WebSocket', 0, 1300, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.1', 'Generic Web Service Security', 'Requirements for generic web service security controls', 1, 1301, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.2', 'RESTful Web Service', 'Requirements specific to RESTful web services', 1, 1302, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.1.1', 'Verify that all application components use the same encodings and parsers to avoid parsing attacks', 'All application components use the same encodings and parsers to avoid parsing attacks that exploit different URI or file parsing behavior (L1)', 2, 1303, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.1.3', 'Verify that API URLs do not expose sensitive information', 'API URLs do not expose sensitive information such as API keys, session tokens, etc. (L1)', 2, 1304, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.2.1', 'Verify that enabled RESTful HTTP methods are a valid choice for the user or action', 'Enabled RESTful HTTP methods are a valid choice for the user or action such as preventing normal users from using DELETE or PUT on protected API or resources (L1)', 2, 1305, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.2.2', 'Verify that JSON schema validation is in place and verified before accepting input', 'JSON schema validation is in place and verified before accepting input (L1)', 2, 1306, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V13.4.1', 'Verify that GraphQL or data layer expression queries use a query allow-list to limit complexity and depth', 'Verify that a query allow list or a combination of depth limiting and amount limiting is used to prevent GraphQL or data layer expression denial of service (L2)', 2, 1307, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- V14: Configuration
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-0ea5a0000000', 'V14', 'Configuration', 'Requirements for secure configuration of the application, frameworks, server, and platform', 0, 1400, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.1', 'Build and Deploy', 'Requirements for secure build and deployment pipelines', 1, 1401, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.2', 'Dependency', 'Requirements for secure management of application dependencies', 1, 1402, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.1.1', 'Verify that the application build and deployment processes are performed in a secure and repeatable way', 'The application build and deployment processes are performed in a secure and repeatable way such as CI/CD automation, automated configuration management, and automated deployment scripts (L2)', 2, 1403, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.2.1', 'Verify that all components are up to date', 'All components are up to date preferably using a dependency checker during build or compile time (L1)', 2, 1404, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.2.2', 'Verify that all unneeded features, documentation, sample applications and configurations are removed', 'All unneeded features, documentation, sample applications and configurations are removed (L1)', 2, 1405, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.3.2', 'Verify that web or application server and application framework debug modes are disabled in production', 'Web or application server and application framework debug modes are disabled in production to eliminate debug features, developer consoles, and unintended security disclosures (L1)', 2, 1406, 'active'),
('c0000000-0000-0000-0000-0ea5a0000000', 'V14.4.1', 'Verify that every HTTP response contains a Content-Type header specifying a safe character set', 'Every HTTP response contains a Content-Type header specifying a safe character set such as UTF-8 or ISO-8859-1 (L1)', 2, 1407, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
