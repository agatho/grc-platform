-- ============================================================================
-- ARCTOS Seed: Cross-Framework Mappings v4 — SOC 2 + Extended PCI DSS
--
-- Closes the gap that existed even after v1/v2/v3:
--   - SOC 2 Trust Services Criteria had ZERO cross-mappings (51 entries lonely)
--   - PCI DSS only mapped to ISO 27001 — missing NIST CSF, NIST 800-53, CSA CCM
--
-- This file uses insert_mapping() from seed_cross_framework_mappings.sql.
-- It must run AFTER seed_catalog_isae3402_soc2.sql, seed_catalog_pci_dss_v4.sql,
-- seed_catalog_iso27002_2022.sql, seed_catalog_iso27001_annex_a.sql,
-- seed_catalog_nist_csf2.sql, seed_catalog_nist_800_53.sql,
-- seed_catalog_csa_ccm_v4.sql, seed_catalog_coso_erm.sql, seed_catalog_gdpr.sql.
--
-- Total mappings added: ~165
-- ============================================================================

-- ============================================================================
-- 1. SOC 2 (CC1–CC9) ↔ ISO 27001:2022 Annex A
-- Source: AICPA Trust Services Criteria 2022 mapping appendix + ISO MapPort.
-- ============================================================================

-- CC1 Control Environment → ISO 27001 organizational
SELECT insert_mapping('CC1.1', 'isae3402_soc2', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC1.1', 'isae3402_soc2', 'A.5.4', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC1.2', 'isae3402_soc2', 'A.5.4', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC1.3', 'isae3402_soc2', 'A.5.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC1.4', 'isae3402_soc2', 'A.6.3', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('CC1.5', 'isae3402_soc2', 'A.6.4', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- CC2 Communication & Information
SELECT insert_mapping('CC2.1', 'isae3402_soc2', 'A.5.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC2.2', 'isae3402_soc2', 'A.5.10', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC2.3', 'isae3402_soc2', 'A.5.5', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');

-- CC3 Risk Assessment
SELECT insert_mapping('CC3.1', 'isae3402_soc2', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC3.2', 'isae3402_soc2', 'A.5.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC3.3', 'isae3402_soc2', 'A.5.7', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC3.4', 'isae3402_soc2', 'A.5.7', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- CC4 Monitoring
SELECT insert_mapping('CC4.1', 'isae3402_soc2', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC4.2', 'isae3402_soc2', 'A.5.36', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- CC5 Control Activities
SELECT insert_mapping('CC5.1', 'isae3402_soc2', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC5.2', 'isae3402_soc2', 'A.8.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC5.3', 'isae3402_soc2', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- CC6 Logical and Physical Access (the meatiest SOC 2 area)
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.5.17', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.5.18', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.7.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.7.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.8.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.8.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- CC7 System Operations (incident management & monitoring)
SELECT insert_mapping('CC7', 'isae3402_soc2', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'A.5.25', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'A.5.26', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- CC8 Change Management
SELECT insert_mapping('CC8', 'isae3402_soc2', 'A.8.32', 'iso_27001_2022_annex_a', 'equivalent', 95, 'official');

-- CC9 Risk Mitigation (vendor & BC)
SELECT insert_mapping('CC9', 'isae3402_soc2', 'A.5.19', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'A.5.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'A.5.21', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'A.5.29', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- A1 Availability → BC + capacity controls
SELECT insert_mapping('A1.1', 'isae3402_soc2', 'A.8.6', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.2', 'isae3402_soc2', 'A.7.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A1.2', 'isae3402_soc2', 'A.7.11', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A1.2', 'isae3402_soc2', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.3', 'isae3402_soc2', 'A.5.30', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- PI Processing Integrity
SELECT insert_mapping('PI1.1', 'isae3402_soc2', 'A.8.26', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('PI1.2', 'isae3402_soc2', 'A.8.26', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('PI1.4', 'isae3402_soc2', 'A.5.27', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');

-- C Confidentiality
SELECT insert_mapping('C1.1', 'isae3402_soc2', 'A.5.12', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('C1.1', 'isae3402_soc2', 'A.5.13', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('C1.2', 'isae3402_soc2', 'A.8.10', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- P Privacy
SELECT insert_mapping('P1', 'isae3402_soc2', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('P2', 'isae3402_soc2', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('P4', 'isae3402_soc2', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('P6', 'isae3402_soc2', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('P8', 'isae3402_soc2', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- ============================================================================
-- 2. SOC 2 ↔ NIST CSF 2.0 (using primary functions)
-- ============================================================================
SELECT insert_mapping('CC1.1', 'isae3402_soc2', 'GV.OC-01', 'nist_csf_2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC1.2', 'isae3402_soc2', 'GV.RR-01', 'nist_csf_2', 'equivalent', 85, 'official');
SELECT insert_mapping('CC1.3', 'isae3402_soc2', 'GV.RR-02', 'nist_csf_2', 'equivalent', 85, 'official');
SELECT insert_mapping('CC2.2', 'isae3402_soc2', 'GV.PO-01', 'nist_csf_2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC3.1', 'isae3402_soc2', 'GV.RM-01', 'nist_csf_2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC3.2', 'isae3402_soc2', 'ID.RA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('CC4.1', 'isae3402_soc2', 'ID.IM-01', 'nist_csf_2', 'equivalent', 85, 'official');
SELECT insert_mapping('CC4.2', 'isae3402_soc2', 'ID.IM-04', 'nist_csf_2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'PR.AA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'DE.CM-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'RS.MA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('CC8', 'isae3402_soc2', 'PR.PS-01', 'nist_csf_2', 'partial_overlap', 85, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'GV.SC-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.3', 'isae3402_soc2', 'RC.RP-01', 'nist_csf_2', 'equivalent', 90, 'official');

-- ============================================================================
-- 3. SOC 2 ↔ NIST SP 800-53 Rev. 5
-- ============================================================================
SELECT insert_mapping('CC1.3', 'isae3402_soc2', 'PM-1', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC2.2', 'isae3402_soc2', 'PL-2', 'nist_800_53_r5', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC3.1', 'isae3402_soc2', 'PM-9', 'nist_800_53_r5', 'partial_overlap', 85, 'official');
SELECT insert_mapping('CC3.2', 'isae3402_soc2', 'RA-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC4.1', 'isae3402_soc2', 'CA-7', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC4.2', 'isae3402_soc2', 'CA-5', 'nist_800_53_r5', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC5.2', 'isae3402_soc2', 'CM-1', 'nist_800_53_r5', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'AC-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'AC-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'IA-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'PE-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'AU-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'IR-4', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'SI-4', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC8', 'isae3402_soc2', 'CM-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'SR-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'SR-6', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.2', 'isae3402_soc2', 'CP-9', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.3', 'isae3402_soc2', 'CP-4', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('C1.2', 'isae3402_soc2', 'MP-6', 'nist_800_53_r5', 'equivalent', 90, 'official');

-- ============================================================================
-- 4. SOC 2 ↔ COSO ICIF (CC1–CC5 are derived from COSO 2013)
-- The CC1.x/CC2.x/CC3.x/CC4.x/CC5.x map directly to COSO Principles 1–17.
-- ============================================================================
SELECT insert_mapping('CC1.1', 'isae3402_soc2', 'COSO-GC-01', 'coso_erm_2017', 'partial_overlap', 75, 'community');
SELECT insert_mapping('CC1.2', 'isae3402_soc2', 'COSO-GC-02', 'coso_erm_2017', 'partial_overlap', 80, 'community');
SELECT insert_mapping('CC3.2', 'isae3402_soc2', 'COSO-PF-10', 'coso_erm_2017', 'partial_overlap', 80, 'community');
SELECT insert_mapping('CC3.3', 'isae3402_soc2', 'COSO-PF-13', 'coso_erm_2017', 'partial_overlap', 80, 'community');
SELECT insert_mapping('CC4.1', 'isae3402_soc2', 'COSO-RR-15', 'coso_erm_2017', 'partial_overlap', 80, 'community');
SELECT insert_mapping('CC4.2', 'isae3402_soc2', 'COSO-RR-16', 'coso_erm_2017', 'partial_overlap', 85, 'community');

-- ============================================================================
-- 5. SOC 2 ↔ CSA CCM v4 (cloud-context overlap)
-- ============================================================================
SELECT insert_mapping('CC6', 'isae3402_soc2', 'IAM-08', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('CC6', 'isae3402_soc2', 'IAM-14', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'LOG-03', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('CC7', 'isae3402_soc2', 'SEF-03', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('CC8', 'isae3402_soc2', 'CCC-01', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('CC9', 'isae3402_soc2', 'STA-05', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.2', 'isae3402_soc2', 'BCR-08', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('A1.3', 'isae3402_soc2', 'BCR-06', 'csa_ccm_v4', 'equivalent', 85, 'official');
SELECT insert_mapping('C1.2', 'isae3402_soc2', 'DCS-04', 'csa_ccm_v4', 'equivalent', 85, 'official');

-- ============================================================================
-- 6. SOC 2 ↔ GDPR (Privacy category P → GDPR)
-- ============================================================================
SELECT insert_mapping('P1', 'isae3402_soc2', 'Art.32', 'eu_gdpr', 'partial_overlap', 75, 'official');
SELECT insert_mapping('P2', 'isae3402_soc2', 'Art.32', 'eu_gdpr', 'partial_overlap', 75, 'official');
SELECT insert_mapping('P4', 'isae3402_soc2', 'Art.32', 'eu_gdpr', 'partial_overlap', 75, 'official');
SELECT insert_mapping('P6', 'isae3402_soc2', 'Art.32', 'eu_gdpr', 'partial_overlap', 75, 'official');

-- ============================================================================
-- 7. PCI DSS v4 ↔ NIST CSF 2.0 (extending v3 which only had ISO mappings)
-- ============================================================================
SELECT insert_mapping('1.2', 'pci_dss_v4', 'PR.IR-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('1.3', 'pci_dss_v4', 'PR.IR-01', 'nist_csf_2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('2.2', 'pci_dss_v4', 'PR.PS-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('3.5', 'pci_dss_v4', 'PR.DS-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('3.6', 'pci_dss_v4', 'PR.DS-02', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('4.2', 'pci_dss_v4', 'PR.DS-02', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('5.2', 'pci_dss_v4', 'DE.CM-09', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('6.2', 'pci_dss_v4', 'PR.PS-06', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('6.3', 'pci_dss_v4', 'ID.RA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('7.2', 'pci_dss_v4', 'PR.AA-05', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('8.2', 'pci_dss_v4', 'PR.AA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('8.4', 'pci_dss_v4', 'PR.AA-03', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('10.2', 'pci_dss_v4', 'DE.CM-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('10.4', 'pci_dss_v4', 'DE.AE-02', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('11.3', 'pci_dss_v4', 'ID.RA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('11.4', 'pci_dss_v4', 'ID.IM-02', 'nist_csf_2', 'equivalent', 85, 'official');
SELECT insert_mapping('12.1', 'pci_dss_v4', 'GV.PO-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('12.10', 'pci_dss_v4', 'RS.MA-01', 'nist_csf_2', 'equivalent', 90, 'official');

-- ============================================================================
-- 8. PCI DSS v4 ↔ NIST SP 800-53 Rev. 5
-- ============================================================================
SELECT insert_mapping('1.2', 'pci_dss_v4', 'SC-7', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('2.2', 'pci_dss_v4', 'CM-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('2.2', 'pci_dss_v4', 'CM-6', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('3.5', 'pci_dss_v4', 'SC-28', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('3.6', 'pci_dss_v4', 'SC-12', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('4.2', 'pci_dss_v4', 'SC-8', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('5.2', 'pci_dss_v4', 'SI-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('6.2', 'pci_dss_v4', 'SA-15', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('6.3', 'pci_dss_v4', 'SI-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('6.3', 'pci_dss_v4', 'RA-5', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('7.2', 'pci_dss_v4', 'AC-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('7.2', 'pci_dss_v4', 'AC-6', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('8.2', 'pci_dss_v4', 'IA-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('8.3', 'pci_dss_v4', 'IA-5', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('8.4', 'pci_dss_v4', 'IA-2', 'nist_800_53_r5', 'partial_overlap', 85, 'official');
SELECT insert_mapping('9.2', 'pci_dss_v4', 'PE-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('9.4', 'pci_dss_v4', 'MP-6', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('10.2', 'pci_dss_v4', 'AU-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('10.3', 'pci_dss_v4', 'AU-9', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('10.4', 'pci_dss_v4', 'AU-6', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('11.3', 'pci_dss_v4', 'RA-5', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('11.4', 'pci_dss_v4', 'CA-8', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('12.1', 'pci_dss_v4', 'PL-1', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('12.6', 'pci_dss_v4', 'AT-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('12.10', 'pci_dss_v4', 'IR-4', 'nist_800_53_r5', 'equivalent', 90, 'official');

-- ============================================================================
-- 9. PCI DSS v4 ↔ CSA CCM v4 (cloud-overlap)
-- ============================================================================
SELECT insert_mapping('1.2', 'pci_dss_v4', 'IVS-03', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('1.4', 'pci_dss_v4', 'IVS-06', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('2.2', 'pci_dss_v4', 'IVS-04', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('3.5', 'pci_dss_v4', 'CEK-03', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('3.6', 'pci_dss_v4', 'CEK-13', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('5.2', 'pci_dss_v4', 'UEM-12', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('6.2', 'pci_dss_v4', 'AIS-04', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('6.3', 'pci_dss_v4', 'AIS-07', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('6.4', 'pci_dss_v4', 'AIS-05', 'csa_ccm_v4', 'partial_overlap', 80, 'official');
SELECT insert_mapping('8.4', 'pci_dss_v4', 'IAM-14', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('10.2', 'pci_dss_v4', 'LOG-03', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('10.4', 'pci_dss_v4', 'LOG-05', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('11.3', 'pci_dss_v4', 'TVM-08', 'csa_ccm_v4', 'equivalent', 90, 'official');
SELECT insert_mapping('11.4', 'pci_dss_v4', 'TVM-03', 'csa_ccm_v4', 'partial_overlap', 80, 'official');
SELECT insert_mapping('12.10', 'pci_dss_v4', 'SEF-03', 'csa_ccm_v4', 'equivalent', 90, 'official');

-- ============================================================================
-- 10. PCI DSS v4 ↔ ISO 27017/27018 (cloud overlap for cardholder cloud env)
-- ============================================================================
SELECT insert_mapping('3.5', 'pci_dss_v4', '10.1.1-CLD', 'iso_27017_2015', 'partial_overlap', 80, 'official');
SELECT insert_mapping('1.4', 'pci_dss_v4', 'CLD.9.5.1', 'iso_27017_2015', 'partial_overlap', 80, 'official');
SELECT insert_mapping('2.2', 'pci_dss_v4', 'CLD.9.5.2', 'iso_27017_2015', 'partial_overlap', 80, 'official');
SELECT insert_mapping('10.2', 'pci_dss_v4', 'CLD.12.4.5', 'iso_27017_2015', 'equivalent', 85, 'official');

-- ============================================================================
-- 11. PCI DSS v4 ↔ SWIFT CSCF (financial sector overlap)
-- ============================================================================
SELECT insert_mapping('1.4', 'pci_dss_v4', '1.4', 'swift_cscf_v2024', 'equivalent', 90, 'official');
SELECT insert_mapping('2.3', 'pci_dss_v4', '2.3', 'swift_cscf_v2024', 'equivalent', 90, 'official');
SELECT insert_mapping('5.2', 'pci_dss_v4', '6.1', 'swift_cscf_v2024', 'equivalent', 90, 'official');
SELECT insert_mapping('6.3', 'pci_dss_v4', '2.7', 'swift_cscf_v2024', 'equivalent', 90, 'official');
SELECT insert_mapping('8.4', 'pci_dss_v4', '4.2', 'swift_cscf_v2024', 'equivalent', 95, 'official');
SELECT insert_mapping('10.4', 'pci_dss_v4', '6.4', 'swift_cscf_v2024', 'equivalent', 90, 'official');
SELECT insert_mapping('12.10', 'pci_dss_v4', '7.1', 'swift_cscf_v2024', 'equivalent', 90, 'official');

-- ============================================================================
-- Bridge backfill (idempotent) — pushes the new mappings into framework_mapping
-- ============================================================================
INSERT INTO framework_mapping (
  source_framework, source_control_id, source_control_title,
  target_framework, target_control_id, target_control_title,
  relationship_type, confidence,
  mapping_source, rationale,
  is_verified, is_built_in
)
SELECT
  src_cat.source,
  src_entry.code,
  COALESCE(src_entry.name_de, src_entry.name),
  tgt_cat.source,
  tgt_entry.code,
  COALESCE(tgt_entry.name_de, tgt_entry.name),
  CASE cem.relationship::text
    WHEN 'equivalent'      THEN 'equal'
    WHEN 'partial_overlap' THEN 'intersect'
    WHEN 'subset'          THEN 'subset'
    WHEN 'superset'        THEN 'superset'
    WHEN 'related'         THEN 'intersect'
    ELSE 'intersect'
  END,
  ROUND((cem.confidence::numeric / 100.0), 2),
  CASE cem.mapping_source::text
    WHEN 'official'  THEN 'nist_olir'
    WHEN 'community' THEN 'manual'
    WHEN 'inferred'  THEN 'ai_suggested'
    WHEN 'manual'    THEN 'manual'
    ELSE 'nist_olir'
  END,
  CONCAT('Backfilled from catalog_entry_mapping. Source: ', COALESCE(cem.source_reference, 'NIST OLIR / official')),
  TRUE,
  TRUE
FROM catalog_entry_mapping cem
JOIN catalog_entry src_entry ON src_entry.id = cem.source_entry_id
JOIN catalog_entry tgt_entry ON tgt_entry.id = cem.target_entry_id
JOIN catalog       src_cat   ON src_cat.id   = src_entry.catalog_id
JOIN catalog       tgt_cat   ON tgt_cat.id   = tgt_entry.catalog_id
ON CONFLICT (source_framework, source_control_id, target_framework, target_control_id)
DO NOTHING;
