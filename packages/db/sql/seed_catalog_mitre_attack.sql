-- ============================================================================
-- ARCTOS Seed: MITRE ATT&CK Enterprise Framework v15.1
-- Source: MITRE ATT&CK (https://attack.mitre.org/)
-- Used by Sprint 5a: ISMS threat/risk catalog for cyber threat modeling
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-311ae0000007',
  'MITRE ATT&CK Enterprise',
  'MITRE ATT&CK Enterprise Framework — Adversarial Tactics, Techniques, and Common Knowledge for enterprise IT environments',
  'risk', 'platform', 'mitre_attack_enterprise', '15.1', true, '{isms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TA0043 — Reconnaissance
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0043', 'Reconnaissance', 'The adversary is trying to gather information they can use to plan future operations.', 0, 1, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1595', 'Active Scanning', 'Adversaries may execute active reconnaissance scans to gather information that can be used during targeting.', 1, 2, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1595.001', 'Scanning IP Blocks', 'Adversaries may scan victim IP blocks to gather information that can be used during targeting.', 2, 3, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1595.002', 'Vulnerability Scanning', 'Adversaries may scan victims for vulnerabilities that can be used during targeting.', 2, 4, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1595.003', 'Wordlist Scanning', 'Adversaries may iteratively probe infrastructure using brute-forcing and crawling techniques.', 2, 5, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1592', 'Gather Victim Host Information', 'Adversaries may gather information about the victim hosts that can be used during targeting.', 1, 6, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1592.001', 'Hardware', 'Adversaries may gather information about the victim host hardware that can be used during targeting.', 2, 7, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1592.002', 'Software', 'Adversaries may gather information about the victim host software that can be used during targeting.', 2, 8, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1589', 'Gather Victim Identity Information', 'Adversaries may gather information about the victim identity that can be used during targeting.', 1, 9, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1589.001', 'Credentials', 'Adversaries may gather credentials that can be used during targeting.', 2, 10, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1589.002', 'Email Addresses', 'Adversaries may gather email addresses that can be used during targeting.', 2, 11, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1590', 'Gather Victim Network Information', 'Adversaries may gather information about the victim network that can be used during targeting.', 1, 12, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1590.001', 'Domain Properties', 'Adversaries may gather information about the victim network domain properties.', 2, 13, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1590.002', 'DNS', 'Adversaries may gather information about the victim DNS that can be used during targeting.', 2, 14, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1591', 'Gather Victim Org Information', 'Adversaries may gather information about the victim organization that can be used during targeting.', 1, 15, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1598', 'Phishing for Information', 'Adversaries may send phishing messages to elicit sensitive information that can be used during targeting.', 1, 16, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1598.001', 'Spearphishing Service', 'Adversaries may send spearphishing messages via third-party services to elicit sensitive information.', 2, 17, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1598.002', 'Spearphishing Attachment', 'Adversaries may send spearphishing messages with a malicious attachment to elicit sensitive information.', 2, 18, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1598.003', 'Spearphishing Link', 'Adversaries may send spearphishing messages with a malicious link to elicit sensitive information.', 2, 19, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1597', 'Search Closed Sources', 'Adversaries may search and gather information about victims from closed sources that can be used during targeting.', 1, 20, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1596', 'Search Open Technical Databases', 'Adversaries may search freely available technical databases for information about victims.', 1, 21, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1593', 'Search Open Websites/Domains', 'Adversaries may search freely available websites and domains for information about victims.', 1, 22, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0042 — Resource Development
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0042', 'Resource Development', 'The adversary is trying to establish resources they can use to support operations.', 0, 23, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1583', 'Acquire Infrastructure', 'Adversaries may buy, lease, or rent infrastructure that can be used during targeting.', 1, 24, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1583.001', 'Domains', 'Adversaries may acquire domains that can be used during targeting.', 2, 25, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1583.003', 'Virtual Private Server', 'Adversaries may rent Virtual Private Servers that can be used during targeting.', 2, 26, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1583.006', 'Web Services', 'Adversaries may register for web services that can be used during targeting.', 2, 27, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1586', 'Compromise Accounts', 'Adversaries may compromise accounts with services that can be used during targeting.', 1, 28, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1586.001', 'Social Media Accounts', 'Adversaries may compromise social media accounts that can be used during targeting.', 2, 29, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1586.002', 'Email Accounts', 'Adversaries may compromise email accounts that can be used during targeting.', 2, 30, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1584', 'Compromise Infrastructure', 'Adversaries may compromise third-party infrastructure that can be used during targeting.', 1, 31, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1587', 'Develop Capabilities', 'Adversaries may build capabilities that can be used during targeting.', 1, 32, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1587.001', 'Malware', 'Adversaries may develop malware that can be used during targeting.', 2, 33, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1587.002', 'Code Signing Certificates', 'Adversaries may create self-signed code signing certificates for use during targeting.', 2, 34, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1587.003', 'Digital Certificates', 'Adversaries may create self-signed SSL/TLS certificates for use during targeting.', 2, 35, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1587.004', 'Exploits', 'Adversaries may develop exploits that can be used during targeting.', 2, 36, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1588', 'Obtain Capabilities', 'Adversaries may buy and/or steal capabilities that can be used during targeting.', 1, 37, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1588.001', 'Malware', 'Adversaries may buy, steal, or download malware that can be used during targeting.', 2, 38, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1588.002', 'Tool', 'Adversaries may buy, steal, or download tools that can be used during targeting.', 2, 39, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1588.005', 'Exploits', 'Adversaries may buy, steal, or download exploits that can be used during targeting.', 2, 40, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1585', 'Establish Accounts', 'Adversaries may create and cultivate accounts with services that can be used during targeting.', 1, 41, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1608', 'Stage Capabilities', 'Adversaries may upload, install, or otherwise set up capabilities that can be used during targeting.', 1, 42, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1608.001', 'Upload Malware', 'Adversaries may upload malware to third-party or adversary-controlled infrastructure to make it accessible during targeting.', 2, 43, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1608.005', 'Link Target', 'Adversaries may put in place resources that are referenced by a link that can be used during targeting.', 2, 44, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0001 — Initial Access
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0001', 'Initial Access', 'The adversary is trying to get into your network.', 0, 45, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1566', 'Phishing', 'Adversaries may send phishing messages to gain access to victim systems.', 1, 46, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1566.001', 'Spearphishing Attachment', 'Adversaries may send spearphishing emails with a malicious attachment in an attempt to gain access to victim systems.', 2, 47, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1566.002', 'Spearphishing Link', 'Adversaries may send spearphishing emails with a malicious link in an attempt to gain access to victim systems.', 2, 48, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1566.003', 'Spearphishing via Service', 'Adversaries may send spearphishing messages via third-party services in an attempt to gain access to victim systems.', 2, 49, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1566.004', 'Spearphishing Voice', 'Adversaries may use voice communications to ultimately gain access to victim systems.', 2, 50, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1190', 'Exploit Public-Facing Application', 'Adversaries may attempt to exploit a weakness in an Internet-facing host or system to initially access a network.', 1, 51, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1133', 'External Remote Services', 'Adversaries may leverage external-facing remote services to initially access a network.', 1, 52, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1200', 'Hardware Additions', 'Adversaries may introduce computer accessories or hardware to gain access to systems or networks.', 1, 53, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1078', 'Valid Accounts', 'Adversaries may obtain and abuse credentials of existing accounts as a means of gaining initial access.', 1, 54, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1078.001', 'Default Accounts', 'Adversaries may obtain and abuse credentials of a default account as a means of gaining initial access.', 2, 55, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1078.002', 'Domain Accounts', 'Adversaries may obtain and abuse credentials of a domain account as a means of gaining initial access.', 2, 56, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1078.003', 'Local Accounts', 'Adversaries may obtain and abuse credentials of a local account as a means of gaining initial access.', 2, 57, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1078.004', 'Cloud Accounts', 'Adversaries may obtain and abuse credentials of a cloud account as a means of gaining initial access.', 2, 58, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1189', 'Drive-by Compromise', 'Adversaries may gain access to a system through a user visiting a website over the normal course of browsing.', 1, 59, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1199', 'Trusted Relationship', 'Adversaries may breach or otherwise leverage organizations who have access to intended victims.', 1, 60, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1195', 'Supply Chain Compromise', 'Adversaries may manipulate products or product delivery mechanisms prior to receipt by a final consumer.', 1, 61, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1195.001', 'Compromise Software Dependencies and Development Tools', 'Adversaries may manipulate software dependencies and development tools prior to receipt by a final consumer.', 2, 62, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1195.002', 'Compromise Software Supply Chain', 'Adversaries may manipulate application software prior to receipt by a final consumer.', 2, 63, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1659', 'Content Injection', 'Adversaries may gain access to victim systems by injecting malicious content into systems accessible by the victim.', 1, 64, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0002 — Execution
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0002', 'Execution', 'The adversary is trying to run malicious code.', 0, 65, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059', 'Command and Scripting Interpreter', 'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.', 1, 66, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059.001', 'PowerShell', 'Adversaries may abuse PowerShell commands and scripts for execution.', 2, 67, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059.003', 'Windows Command Shell', 'Adversaries may abuse the Windows command shell for execution.', 2, 68, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059.004', 'Unix Shell', 'Adversaries may abuse Unix shell commands and scripts for execution.', 2, 69, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059.005', 'Visual Basic', 'Adversaries may abuse Visual Basic for execution.', 2, 70, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059.006', 'Python', 'Adversaries may abuse Python commands and scripts for execution.', 2, 71, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1059.007', 'JavaScript', 'Adversaries may abuse JavaScript for execution.', 2, 72, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1204', 'User Execution', 'An adversary may rely upon specific actions by a user in order to gain execution.', 1, 73, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1204.001', 'Malicious Link', 'An adversary may rely upon a user clicking a malicious link in order to gain execution.', 2, 74, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1204.002', 'Malicious File', 'An adversary may rely upon a user opening a malicious file in order to gain execution.', 2, 75, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1203', 'Exploitation for Client Execution', 'Adversaries may exploit software vulnerabilities in client applications to execute code.', 1, 76, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1047', 'Windows Management Instrumentation', 'Adversaries may abuse Windows Management Instrumentation (WMI) to execute malicious commands and payloads.', 1, 77, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1053', 'Scheduled Task/Job', 'Adversaries may abuse task scheduling functionality to facilitate initial or recurring execution of malicious code.', 1, 78, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1053.005', 'Scheduled Task', 'Adversaries may abuse the Windows Task Scheduler to perform task scheduling for initial or recurring execution.', 2, 79, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1053.003', 'Cron', 'Adversaries may abuse the cron utility to perform task scheduling for initial or recurring execution.', 2, 80, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1569', 'System Services', 'Adversaries may abuse system services or daemons to execute commands or programs.', 1, 81, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1569.002', 'Service Execution', 'Adversaries may abuse the Windows service control manager to execute malicious commands or payloads.', 2, 82, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1559', 'Inter-Process Communication', 'Adversaries may abuse inter-process communication mechanisms for local code or command execution.', 1, 83, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1106', 'Native API', 'Adversaries may interact with the native OS application programming interface to execute behaviors.', 1, 84, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1129', 'Shared Modules', 'Adversaries may execute malicious payloads via loading shared modules.', 1, 85, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0003 — Persistence
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0003', 'Persistence', 'The adversary is trying to maintain their foothold.', 0, 86, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1547', 'Boot or Logon Autostart Execution', 'Adversaries may configure system settings to automatically execute a program during system boot or logon.', 1, 87, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1547.001', 'Registry Run Keys / Startup Folder', 'Adversaries may achieve persistence by adding a program to a startup folder or referencing it with a Registry run key.', 2, 88, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1547.004', 'Winlogon Helper DLL', 'Adversaries may abuse features of Winlogon to execute DLLs during logon.', 2, 89, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1136', 'Create Account', 'Adversaries may create an account to maintain access to victim systems.', 1, 90, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1136.001', 'Local Account', 'Adversaries may create a local account to maintain access to victim systems.', 2, 91, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1136.002', 'Domain Account', 'Adversaries may create a domain account to maintain access to victim systems.', 2, 92, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1136.003', 'Cloud Account', 'Adversaries may create a cloud account to maintain access to victim systems.', 2, 93, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1543', 'Create or Modify System Process', 'Adversaries may create or modify system-level processes to repeatedly execute malicious payloads as part of persistence.', 1, 94, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1543.003', 'Windows Service', 'Adversaries may create or modify Windows services to repeatedly execute malicious payloads as part of persistence.', 2, 95, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1543.002', 'Systemd Service', 'Adversaries may create or modify systemd services to repeatedly execute malicious payloads as part of persistence.', 2, 96, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1505', 'Server Software Component', 'Adversaries may abuse legitimate extensible development features of servers to establish persistent access.', 1, 97, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1505.003', 'Web Shell', 'Adversaries may backdoor web servers with web shells to establish persistent access to systems.', 2, 98, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1098', 'Account Manipulation', 'Adversaries may manipulate accounts to maintain or elevate access to victim systems.', 1, 99, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1098.001', 'Additional Cloud Credentials', 'Adversaries may add adversary-controlled credentials to a cloud account to maintain persistent access.', 2, 100, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1053.005', 'Scheduled Task', 'Adversaries may abuse the Windows Task Scheduler to perform task scheduling for persistence.', 2, 101, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1546', 'Event Triggered Execution', 'Adversaries may establish persistence using system mechanisms that trigger execution based on specific events.', 1, 102, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1546.003', 'Windows Management Instrumentation Event Subscription', 'Adversaries may establish persistence using WMI event subscriptions.', 2, 103, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1546.015', 'Component Object Model Hijacking', 'Adversaries may establish persistence by executing malicious content triggered by hijacked COM references.', 2, 104, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1574', 'Hijack Execution Flow', 'Adversaries may execute their own malicious payloads by hijacking the way operating systems run programs.', 1, 105, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1574.001', 'DLL Search Order Hijacking', 'Adversaries may execute their own malicious payloads by hijacking the search order used to load DLLs.', 2, 106, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1574.002', 'DLL Side-Loading', 'Adversaries may execute their own malicious payloads by side-loading DLLs.', 2, 107, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1556', 'Modify Authentication Process', 'Adversaries may modify authentication mechanisms and processes to access user credentials or enable otherwise unwarranted access.', 1, 108, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0004 — Privilege Escalation
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0004', 'Privilege Escalation', 'The adversary is trying to gain higher-level permissions.', 0, 109, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1068', 'Exploitation for Privilege Escalation', 'Adversaries may exploit software vulnerabilities in an attempt to elevate privileges.', 1, 110, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1548', 'Abuse Elevation Control Mechanism', 'Adversaries may circumvent mechanisms designed to control elevated privileges to gain higher-level permissions.', 1, 111, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1548.002', 'Bypass User Account Control', 'Adversaries may bypass UAC mechanisms to elevate process privileges on system.', 2, 112, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1548.001', 'Setuid and Setgid', 'An adversary may abuse configurations where an application has the setuid or setgid bits set.', 2, 113, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1548.003', 'Sudo and Sudo Caching', 'Adversaries may perform sudo caching and/or use the sudoers file to elevate privileges.', 2, 114, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1134', 'Access Token Manipulation', 'Adversaries may modify access tokens to operate under a different user or system security context.', 1, 115, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1134.001', 'Token Impersonation/Theft', 'Adversaries may duplicate then impersonate another users existing token to escalate privileges.', 2, 116, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1055', 'Process Injection', 'Adversaries may inject code into processes in order to evade process-based defenses as well as possibly elevate privileges.', 1, 117, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1055.001', 'Dynamic-link Library Injection', 'Adversaries may inject dynamic-link libraries into processes in order to evade process-based defenses.', 2, 118, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1055.012', 'Process Hollowing', 'Adversaries may inject malicious code into suspended and hollowed processes in order to evade process-based defenses.', 2, 119, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1484', 'Domain or Tenant Policy Modification', 'Adversaries may modify the configuration settings of a domain or identity tenant to evade defenses and escalate privileges.', 1, 120, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1484.001', 'Group Policy Modification', 'Adversaries may modify Group Policy Objects to subvert the intended discretionary access controls for a domain.', 2, 121, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0005 — Defense Evasion
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0005', 'Defense Evasion', 'The adversary is trying to avoid being detected.', 0, 122, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1027', 'Obfuscated Files or Information', 'Adversaries may attempt to make an executable or file difficult to discover or analyze by encrypting, encoding, or otherwise obfuscating its contents.', 1, 123, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1027.001', 'Binary Padding', 'Adversaries may use binary padding to add junk data and change the on-disk representation of malware.', 2, 124, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1027.010', 'Command Obfuscation', 'Adversaries may obfuscate content during command execution to impede detection.', 2, 125, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1070', 'Indicator Removal', 'Adversaries may delete or modify artifacts generated within systems to remove evidence of their presence.', 1, 126, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1070.001', 'Clear Windows Event Logs', 'Adversaries may clear Windows Event Logs to hide the activity of an intrusion.', 2, 127, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1070.004', 'File Deletion', 'Adversaries may delete files left behind by the actions of their intrusion activity.', 2, 128, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1070.006', 'Timestomp', 'Adversaries may modify file time attributes to hide new or changes to existing files.', 2, 129, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1036', 'Masquerading', 'Adversaries may attempt to manipulate features of their artifacts to make them appear legitimate or benign to users.', 1, 130, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1036.005', 'Match Legitimate Name or Location', 'Adversaries may match or approximate the name or location of legitimate files or resources when naming/placing them.', 2, 131, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1036.007', 'Double File Extension', 'Adversaries may abuse a double extension in the filename as a means of masquerading the true file type.', 2, 132, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1562', 'Impair Defenses', 'Adversaries may maliciously modify components of a victim environment in order to hinder or disable defensive mechanisms.', 1, 133, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1562.001', 'Disable or Modify Tools', 'Adversaries may modify and/or disable security tools to avoid possible detection of their malware and activities.', 2, 134, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1562.002', 'Disable Windows Event Logging', 'Adversaries may disable Windows event logging to limit data that can be leveraged for detections and audits.', 2, 135, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1562.004', 'Disable or Modify System Firewall', 'Adversaries may disable or modify system firewalls in order to bypass controls limiting network usage.', 2, 136, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1140', 'Deobfuscate/Decode Files or Information', 'Adversaries may use obfuscated files or information to hide artifacts of an intrusion from analysis.', 1, 137, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1218', 'System Binary Proxy Execution', 'Adversaries may bypass process and/or signature-based defenses by proxying execution of malicious content with signed binaries.', 1, 138, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1218.011', 'Rundll32', 'Adversaries may abuse rundll32.exe to proxy execution of malicious code.', 2, 139, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1218.005', 'Mshta', 'Adversaries may abuse mshta.exe to proxy execution of malicious .hta files and Javascript or VBScript.', 2, 140, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1112', 'Modify Registry', 'Adversaries may interact with the Windows Registry to hide configuration information within Registry keys.', 1, 141, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1497', 'Virtualization/Sandbox Evasion', 'Adversaries may employ various means to detect and avoid virtualization and analysis environments.', 1, 142, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1620', 'Reflective Code Loading', 'Adversaries may reflectively load code into a process in order to conceal the execution of malicious payloads.', 1, 143, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0006 — Credential Access
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0006', 'Credential Access', 'The adversary is trying to steal account names and passwords.', 0, 144, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1003', 'OS Credential Dumping', 'Adversaries may attempt to dump credentials to obtain account login and credential material.', 1, 145, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1003.001', 'LSASS Memory', 'Adversaries may attempt to access credential material stored in the process memory of LSASS.', 2, 146, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1003.002', 'Security Account Manager', 'Adversaries may attempt to extract credential material from the Security Account Manager (SAM) database.', 2, 147, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1003.003', 'NTDS', 'Adversaries may attempt to access or create a copy of the Active Directory domain database (NTDS.dit).', 2, 148, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1003.006', 'DCSync', 'Adversaries may attempt to access credentials and other sensitive information by abusing a Windows Domain Controllers API.', 2, 149, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1110', 'Brute Force', 'Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.', 1, 150, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1110.001', 'Password Guessing', 'Adversaries may guess passwords to attempt access to accounts.', 2, 151, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1110.002', 'Password Cracking', 'Adversaries may use password cracking to attempt to recover usable credentials from captured hashes.', 2, 152, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1110.003', 'Password Spraying', 'Adversaries may use a single or small list of commonly used passwords against many different accounts.', 2, 153, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1110.004', 'Credential Stuffing', 'Adversaries may use credentials obtained from breach dumps of unrelated accounts to gain access.', 2, 154, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1555', 'Credentials from Password Stores', 'Adversaries may search for common password storage locations to obtain user credentials.', 1, 155, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1555.003', 'Credentials from Web Browsers', 'Adversaries may acquire credentials from web browsers by reading files specific to the target browser.', 2, 156, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1056', 'Input Capture', 'Adversaries may use methods of capturing user input to obtain credentials or collect information.', 1, 157, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1056.001', 'Keylogging', 'Adversaries may log user keystrokes to intercept credentials as the user types them.', 2, 158, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1557', 'Adversary-in-the-Middle', 'Adversaries may attempt to position themselves between two or more networked devices to support follow-on behaviors.', 1, 159, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1557.001', 'LLMNR/NBT-NS Poisoning and SMB Relay', 'Adversaries may spoof an authoritative source for name resolution to force communication with an adversary controlled system.', 2, 160, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1558', 'Steal or Forge Kerberos Tickets', 'Adversaries may attempt to subvert Kerberos authentication by stealing or forging Kerberos tickets.', 1, 161, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1558.003', 'Kerberoasting', 'Adversaries may abuse a valid Kerberos ticket-granting ticket or sniff network traffic to obtain ticket-granting service tickets.', 2, 162, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1539', 'Steal Web Session Cookie', 'Adversaries may steal web application or service session cookies and use them to gain access to web applications or Internet services.', 1, 163, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1552', 'Unsecured Credentials', 'Adversaries may search compromised systems to find and obtain insecurely stored credentials.', 1, 164, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1552.001', 'Credentials In Files', 'Adversaries may search local file systems and remote file shares for files containing insecurely stored credentials.', 2, 165, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0007 — Discovery
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0007', 'Discovery', 'The adversary is trying to figure out your environment.', 0, 166, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1087', 'Account Discovery', 'Adversaries may attempt to get a listing of valid accounts, usernames, or email addresses on a system or within a compromised environment.', 1, 167, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1087.001', 'Local Account', 'Adversaries may attempt to get a listing of local system accounts.', 2, 168, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1087.002', 'Domain Account', 'Adversaries may attempt to get a listing of domain accounts.', 2, 169, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1082', 'System Information Discovery', 'An adversary may attempt to get detailed information about the operating system and hardware.', 1, 170, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1083', 'File and Directory Discovery', 'Adversaries may enumerate files and directories or may search in specific locations of a host or network share.', 1, 171, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1057', 'Process Discovery', 'Adversaries may attempt to get information about running processes on a system.', 1, 172, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1049', 'System Network Connections Discovery', 'Adversaries may attempt to get a listing of network connections to or from the compromised system.', 1, 173, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1016', 'System Network Configuration Discovery', 'Adversaries may look for details about the network configuration and settings of systems they access.', 1, 174, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1018', 'Remote System Discovery', 'Adversaries may attempt to get a listing of other systems by IP address, hostname, or other logical identifier.', 1, 175, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1069', 'Permission Groups Discovery', 'Adversaries may attempt to discover group and permission settings.', 1, 176, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1069.001', 'Local Groups', 'Adversaries may attempt to find local system groups and permission settings.', 2, 177, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1069.002', 'Domain Groups', 'Adversaries may attempt to find domain-level groups and permission settings.', 2, 178, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1012', 'Query Registry', 'Adversaries may interact with the Windows Registry to gather information about the system, configuration, and installed software.', 1, 179, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1518', 'Software Discovery', 'Adversaries may attempt to get a listing of software and software versions that are installed on a system.', 1, 180, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1518.001', 'Security Software Discovery', 'Adversaries may attempt to get a listing of security software, configurations, defensive tools, and sensors that are installed on a system.', 2, 181, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1033', 'System Owner/User Discovery', 'Adversaries may attempt to identify the primary user, currently logged in user, set of users that commonly uses a system, or whether a user is actively using the system.', 1, 182, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1007', 'System Service Discovery', 'Adversaries may try to gather information about registered local system services.', 1, 183, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0008 — Lateral Movement
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0008', 'Lateral Movement', 'The adversary is trying to move through your environment.', 0, 184, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1021', 'Remote Services', 'Adversaries may use valid accounts to log into a service specifically designed to accept remote connections.', 1, 185, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1021.001', 'Remote Desktop Protocol', 'Adversaries may use valid accounts to log into a computer using the Remote Desktop Protocol.', 2, 186, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1021.002', 'SMB/Windows Admin Shares', 'Adversaries may use valid accounts to interact with a remote network share using Server Message Block.', 2, 187, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1021.003', 'Distributed Component Object Model', 'Adversaries may use valid accounts to interact with remote machines by taking advantage of DCOM.', 2, 188, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1021.004', 'SSH', 'Adversaries may use valid accounts to log into remote machines using Secure Shell.', 2, 189, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1021.006', 'Windows Remote Management', 'Adversaries may use valid accounts to interact with remote systems using Windows Remote Management.', 2, 190, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1570', 'Lateral Tool Transfer', 'Adversaries may transfer tools or other files between systems in a compromised environment.', 1, 191, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1563', 'Remote Service Session Hijacking', 'Adversaries may take control of preexisting sessions with remote services to move laterally in an environment.', 1, 192, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1563.001', 'SSH Hijacking', 'Adversaries may hijack a legitimate user SSH session to move laterally within an environment.', 2, 193, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1563.002', 'RDP Hijacking', 'Adversaries may hijack a legitimate user RDP session to move laterally within an environment.', 2, 194, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1550', 'Use Alternate Authentication Material', 'Adversaries may use alternate authentication material such as password hashes, Kerberos tickets, and application access tokens.', 1, 195, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1550.002', 'Pass the Hash', 'Adversaries may authenticate to a remote service using the stolen hash of a user password.', 2, 196, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1550.003', 'Pass the Ticket', 'Adversaries may authenticate using a stolen Kerberos ticket.', 2, 197, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1210', 'Exploitation of Remote Services', 'Adversaries may exploit remote services to gain unauthorized access to internal systems.', 1, 198, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1534', 'Internal Spearphishing', 'Adversaries may use internal spearphishing to gain access to additional information or exploit other users within the same organization.', 1, 199, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0009 — Collection
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0009', 'Collection', 'The adversary is trying to gather data of interest to their goal.', 0, 200, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1560', 'Archive Collected Data', 'An adversary may compress and/or encrypt data that is collected prior to exfiltration.', 1, 201, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1560.001', 'Archive via Utility', 'Adversaries may use utilities to compress and/or encrypt collected data prior to exfiltration.', 2, 202, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1005', 'Data from Local System', 'Adversaries may search local system sources such as file systems and configuration files to find files of interest.', 1, 203, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1039', 'Data from Network Shared Drive', 'Adversaries may search network shares on computers they have compromised to find files of interest.', 1, 204, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1025', 'Data from Removable Media', 'Adversaries may search connected removable media on computers they have compromised to find files of interest.', 1, 205, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1074', 'Data Staged', 'Adversaries may stage collected data in a central location or directory prior to exfiltration.', 1, 206, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1074.001', 'Local Data Staging', 'Adversaries may stage collected data in a central location or directory on the local system prior to exfiltration.', 2, 207, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1074.002', 'Remote Data Staging', 'Adversaries may stage data collected from multiple systems in a central location or directory on one system prior to exfiltration.', 2, 208, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1114', 'Email Collection', 'Adversaries may target user email to collect sensitive information.', 1, 209, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1114.001', 'Local Email Collection', 'Adversaries may target user email on local systems to collect sensitive information.', 2, 210, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1114.002', 'Remote Email Collection', 'Adversaries may target an Exchange server, Office 365, or Google Workspace to collect sensitive information.', 2, 211, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1113', 'Screen Capture', 'Adversaries may attempt to take screen captures of the desktop to gather information.', 1, 212, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1119', 'Automated Collection', 'Once established within a system or network, an adversary may use automated techniques for collecting internal data.', 1, 213, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1185', 'Browser Session Hijacking', 'Adversaries may take advantage of security vulnerabilities and inherent functionality in browser software to change content or modify user-behaviors.', 1, 214, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1530', 'Data from Cloud Storage', 'Adversaries may access data from improperly secured cloud storage.', 1, 215, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0010 — Exfiltration
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0010', 'Exfiltration', 'The adversary is trying to steal data.', 0, 216, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1041', 'Exfiltration Over C2 Channel', 'Adversaries may steal data by exfiltrating it over an existing command and control channel.', 1, 217, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1048', 'Exfiltration Over Alternative Protocol', 'Adversaries may steal data by exfiltrating it over a different protocol than that of the existing command and control channel.', 1, 218, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1048.001', 'Exfiltration Over Symmetric Encrypted Non-C2 Protocol', 'Adversaries may steal data by exfiltrating it over a symmetrically encrypted non-C2 protocol.', 2, 219, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1048.002', 'Exfiltration Over Asymmetric Encrypted Non-C2 Protocol', 'Adversaries may steal data by exfiltrating it over an asymmetrically encrypted non-C2 protocol.', 2, 220, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1567', 'Exfiltration Over Web Service', 'Adversaries may use an existing, legitimate external Web service to exfiltrate data.', 1, 221, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1567.002', 'Exfiltration to Cloud Storage', 'Adversaries may exfiltrate data to a cloud storage service rather than over their primary command and control channel.', 2, 222, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1029', 'Scheduled Transfer', 'Adversaries may schedule data exfiltration to be performed only at certain times of day or at certain intervals.', 1, 223, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1537', 'Transfer Data to Cloud Account', 'Adversaries may exfiltrate data by transferring the data to another cloud account they control.', 1, 224, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1052', 'Exfiltration Over Physical Medium', 'Adversaries may attempt to exfiltrate data via a physical medium such as a removable drive.', 1, 225, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1030', 'Data Transfer Size Limits', 'An adversary may exfiltrate data in fixed size chunks instead of whole files.', 1, 226, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0011 — Command and Control
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0011', 'Command and Control', 'The adversary is trying to communicate with compromised systems to control them.', 0, 227, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1071', 'Application Layer Protocol', 'Adversaries may communicate using OSI application layer protocols to avoid detection by blending in with existing traffic.', 1, 228, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1071.001', 'Web Protocols', 'Adversaries may communicate using application layer protocols associated with web traffic to avoid detection.', 2, 229, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1071.002', 'File Transfer Protocols', 'Adversaries may communicate using application layer protocols associated with file transfer to avoid detection.', 2, 230, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1071.003', 'Mail Protocols', 'Adversaries may communicate using application layer protocols associated with electronic mail delivery to avoid detection.', 2, 231, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1071.004', 'DNS', 'Adversaries may communicate using the Domain Name System application layer protocol to avoid detection.', 2, 232, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1105', 'Ingress Tool Transfer', 'Adversaries may transfer tools or other files from an external system into a compromised environment.', 1, 233, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1573', 'Encrypted Channel', 'Adversaries may employ a known encryption algorithm to conceal command and control traffic.', 1, 234, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1573.001', 'Symmetric Cryptography', 'Adversaries may employ a known symmetric encryption algorithm to conceal command and control traffic.', 2, 235, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1573.002', 'Asymmetric Cryptography', 'Adversaries may employ a known asymmetric encryption algorithm to conceal command and control traffic.', 2, 236, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1572', 'Protocol Tunneling', 'Adversaries may tunnel network communications to and from a victim system within a separate protocol to avoid detection.', 1, 237, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1090', 'Proxy', 'Adversaries may use a connection proxy to direct network traffic between systems or act as an intermediary for network communications.', 1, 238, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1090.001', 'Internal Proxy', 'Adversaries may use an internal proxy to direct command and control traffic between two or more systems in a compromised environment.', 2, 239, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1090.002', 'External Proxy', 'Adversaries may use an external proxy to act as an intermediary for network communications to a command and control server.', 2, 240, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1219', 'Remote Access Software', 'An adversary may use legitimate desktop support and remote access software to establish an interactive command and control channel.', 1, 241, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1132', 'Data Encoding', 'Adversaries may encode data to make the content of command and control traffic more difficult to detect.', 1, 242, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1001', 'Data Obfuscation', 'Adversaries may obfuscate command and control traffic to make it more difficult to detect.', 1, 243, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1568', 'Dynamic Resolution', 'Adversaries may dynamically establish connections to command and control infrastructure to evade common detections.', 1, 244, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1568.002', 'Domain Generation Algorithms', 'Adversaries may make use of Domain Generation Algorithms to dynamically identify a destination domain for command and control traffic.', 2, 245, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1095', 'Non-Application Layer Protocol', 'Adversaries may use an OSI non-application layer protocol for communication between host and C2 server.', 1, 246, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TA0040 — Impact
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-311ae0000007', 'TA0040', 'Impact', 'The adversary is trying to manipulate, interrupt, or destroy your systems and data.', 0, 247, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1486', 'Data Encrypted for Impact', 'Adversaries may encrypt data on target systems or on large numbers of systems in a network to interrupt availability.', 1, 248, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1485', 'Data Destruction', 'Adversaries may destroy data and files on specific systems or in large numbers on a network to interrupt availability.', 1, 249, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1490', 'Inhibit System Recovery', 'Adversaries may delete or remove built-in data and turn off services designed to aid in the recovery of a corrupted system.', 1, 250, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1489', 'Service Stop', 'Adversaries may stop or disable services on a system to render those services unavailable to legitimate users.', 1, 251, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1498', 'Network Denial of Service', 'Adversaries may perform Network Denial of Service (DoS) attacks to degrade or block the availability of targeted resources.', 1, 252, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1498.001', 'Direct Network Flood', 'Adversaries may attempt to cause a denial of service by directly sending a high-volume of network traffic to a target.', 2, 253, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1499', 'Endpoint Denial of Service', 'Adversaries may perform Endpoint Denial of Service (DoS) attacks to degrade or block the availability of services.', 1, 254, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1499.002', 'Service Exhaustion Flood', 'Adversaries may target the different network services provided by systems to conduct a Denial of Service.', 2, 255, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1491', 'Defacement', 'Adversaries may modify visual content available internally or externally to an enterprise network.', 1, 256, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1491.001', 'Internal Defacement', 'An adversary may deface systems internal to an organization in an attempt to intimidate or mislead users.', 2, 257, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1491.002', 'External Defacement', 'An adversary may deface systems external to an organization in an attempt to deliver messaging or intimidate.', 2, 258, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1565', 'Data Manipulation', 'Adversaries may insert, delete, or manipulate data in order to influence external outcomes.', 1, 259, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1565.001', 'Stored Data Manipulation', 'Adversaries may insert, delete, or manipulate data at rest in order to influence external outcomes.', 2, 260, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1565.002', 'Transmitted Data Manipulation', 'Adversaries may alter data en route to storage or other systems in order to manipulate external outcomes.', 2, 261, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1561', 'Disk Wipe', 'Adversaries may wipe or corrupt raw disk data on specific systems or in large numbers in a network.', 1, 262, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1561.001', 'Disk Content Wipe', 'Adversaries may erase the contents of storage devices on specific systems or in large numbers in a network.', 2, 263, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1561.002', 'Disk Structure Wipe', 'Adversaries may corrupt or wipe the disk data structures on a hard drive necessary to boot a system.', 2, 264, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1531', 'Account Access Removal', 'Adversaries may interrupt availability of system and network resources by inhibiting access to accounts utilized by legitimate users.', 1, 265, 'active'),
('c0000000-0000-0000-0000-311ae0000007', 'T1657', 'Financial Theft', 'Adversaries may steal monetary resources from targets through extortion, social engineering, technical theft, or other methods.', 1, 266, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
