-- ============================================================================
-- ARCTOS Seed: Cross-Framework Mappings v3
-- New mappings for the catalogs added in this Focus Session:
--   - ISO 27017 (Cloud) ↔ ISO 27002:2022
--   - ISO 27018 (PII Cloud) ↔ ISO 27002:2022 / GDPR Art. 32
--   - ISO 27701 (PIMS) ↔ ISO 27001:2022 Annex A / GDPR
--   - ISO 27019 (Energy) ↔ ISO 27001:2022 Annex A / NIS2
--   - NIST SP 800-53 Rev. 5 ↔ ISO 27001:2022 Annex A / NIST CSF 2.0
--   - PCI DSS v4.0.1 ↔ ISO 27001:2022 Annex A
--   - CSA CCM v4.0 ↔ ISO 27001:2022 Annex A
--   - BSI C5:2020 ↔ ISO 27001:2022 Annex A
--   - IEC 62443 ↔ ISO 27001:2022 Annex A
--   - SWIFT CSCF v2024 ↔ ISO 27001:2022 Annex A
--
-- Uses insert_mapping() helper from seed_cross_framework_mappings.sql.
-- This file MUST run AFTER the new seed_catalog_*.sql files for the catalogs
-- it references. The setup.sh/docker-entrypoint glob already loads
-- seed_cross_framework_mappings*.sql AFTER seed_catalog_*.sql.
-- ============================================================================

-- ============================================================================
-- 1. ISO 27017:2015 ↔ ISO 27002:2022 (cloud guidance to base controls)
-- ============================================================================
SELECT insert_mapping('CLD.6.3.1', 'iso_27017_2015', 'A.5.4', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('CLD.6.3.1', 'iso_27017_2015', 'A.5.2', 'iso27002_2022', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CLD.8.1.5', 'iso_27017_2015', 'A.5.11', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('CLD.9.5.1', 'iso_27017_2015', 'A.8.22', 'iso27002_2022', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CLD.9.5.2', 'iso_27017_2015', 'A.8.9', 'iso27002_2022', 'equivalent', 85, 'official');
SELECT insert_mapping('CLD.12.1.5', 'iso_27017_2015', 'A.8.6', 'iso27002_2022', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CLD.12.4.5', 'iso_27017_2015', 'A.8.16', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('CLD.13.1.4', 'iso_27017_2015', 'A.8.20', 'iso27002_2022', 'partial_overlap', 80, 'official');
SELECT insert_mapping('5.1.1-CLD', 'iso_27017_2015', 'A.5.1', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('6.1.1-CLD', 'iso_27017_2015', 'A.5.2', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('8.1.1-CLD', 'iso_27017_2015', 'A.5.9', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('9.2.1-CLD', 'iso_27017_2015', 'A.5.16', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('9.4.1-CLD', 'iso_27017_2015', 'A.8.3', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('10.1.1-CLD', 'iso_27017_2015', 'A.8.24', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('12.1.2-CLD', 'iso_27017_2015', 'A.8.32', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('12.4.1-CLD', 'iso_27017_2015', 'A.8.15', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('13.1.1-CLD', 'iso_27017_2015', 'A.8.22', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('15.1.1-CLD', 'iso_27017_2015', 'A.5.19', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('17.1.1-CLD', 'iso_27017_2015', 'A.5.30', 'iso27002_2022', 'subset', 85, 'official');
SELECT insert_mapping('18.1.1-CLD', 'iso_27017_2015', 'A.5.31', 'iso27002_2022', 'subset', 85, 'official');

-- ============================================================================
-- 2. ISO 27018:2019 ↔ ISO 27002:2022 / GDPR Art. 32
-- ============================================================================
SELECT insert_mapping('A.2.1', 'iso_27018_2019', 'A.5.34', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.2.2', 'iso_27018_2019', 'A.5.34', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.5.1', 'iso_27018_2019', 'A.5.31', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.9.1', 'iso_27018_2019', 'A.5.24', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.9.3', 'iso_27018_2019', 'A.5.11', 'iso27002_2022', 'equivalent', 90, 'official');
SELECT insert_mapping('A.10.4', 'iso_27018_2019', 'A.7.10', 'iso27002_2022', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A.10.6', 'iso_27018_2019', 'A.8.24', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.10.7', 'iso_27018_2019', 'A.8.10', 'iso27002_2022', 'equivalent', 85, 'official');
SELECT insert_mapping('A.10.8', 'iso_27018_2019', 'A.5.16', 'iso27002_2022', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.11.1', 'iso_27018_2019', 'A.5.31', 'iso27002_2022', 'partial_overlap', 85, 'official');

SELECT insert_mapping('A.2.1', 'iso_27018_2019', 'Art.32', 'eu_gdpr', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.10.6', 'iso_27018_2019', 'Art.32.1a', 'eu_gdpr', 'equivalent', 90, 'official');
SELECT insert_mapping('A.10.4', 'iso_27018_2019', 'Art.32.1a', 'eu_gdpr', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.9.1', 'iso_27018_2019', 'Art.32', 'eu_gdpr', 'partial_overlap', 85, 'official');

-- ============================================================================
-- 3. ISO 27701:2019 ↔ ISO 27001:2022 Annex A and GDPR
-- ============================================================================
SELECT insert_mapping('A.7.2.1', 'iso_27701_2019', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.2.5', 'iso_27701_2019', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.2.6', 'iso_27701_2019', 'A.5.19', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.2.8', 'iso_27701_2019', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 90, 'official');
SELECT insert_mapping('A.7.3.6', 'iso_27701_2019', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.4.5', 'iso_27701_2019', 'A.8.10', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.4.7', 'iso_27701_2019', 'A.8.10', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A.7.5.1', 'iso_27701_2019', 'A.5.31', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A.8.2.1', 'iso_27701_2019', 'A.5.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('A.8.5.4', 'iso_27701_2019', 'A.5.34', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- ISO 27701 to GDPR
SELECT insert_mapping('A.7.2.2', 'iso_27701_2019', 'Art.32', 'eu_gdpr', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.2.5', 'iso_27701_2019', 'Art.32', 'eu_gdpr', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.2.6', 'iso_27701_2019', 'Art.32', 'eu_gdpr', 'partial_overlap', 85, 'official');

-- ============================================================================
-- 4. ISO 27019:2017 ↔ ISO 27001:2022 Annex A and NIS2
-- ============================================================================
SELECT insert_mapping('ENR.6.1.6', 'iso_27019_2017', 'A.5.19', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ENR.7.1.4', 'iso_27019_2017', 'A.7.5', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ENR.7.2.4', 'iso_27019_2017', 'A.8.20', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ENR.10.1.1', 'iso_27019_2017', 'A.8.24', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ENR.12.1.5', 'iso_27019_2017', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ENR.13.2.5', 'iso_27019_2017', 'A.8.20', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ENR.16.1.3', 'iso_27019_2017', 'A.5.24', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ENR.17.2.2', 'iso_27019_2017', 'A.5.29', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('EUI.A.13.1', 'iso_27019_2017', 'A.8.22', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('EUI.A.16.1', 'iso_27019_2017', 'A.5.24', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

SELECT insert_mapping('ENR.16.1.3', 'iso_27019_2017', 'Art.21.2b', 'eu_nis2', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ENR.17.2.2', 'iso_27019_2017', 'Art.21.2c', 'eu_nis2', 'partial_overlap', 85, 'official');

-- ============================================================================
-- 5. NIST SP 800-53 Rev. 5 ↔ ISO 27001:2022 Annex A and NIST CSF 2.0
-- ============================================================================
-- AC family
SELECT insert_mapping('AC-1', 'nist_800_53_r5', 'A.5.15', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('AC-2', 'nist_800_53_r5', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AC-3', 'nist_800_53_r5', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AC-5', 'nist_800_53_r5', 'A.5.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AC-6', 'nist_800_53_r5', 'A.8.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AC-17', 'nist_800_53_r5', 'A.6.7', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('AC-19', 'nist_800_53_r5', 'A.8.1', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
-- AT family
SELECT insert_mapping('AT-2', 'nist_800_53_r5', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AT-3', 'nist_800_53_r5', 'A.6.3', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
-- AU family
SELECT insert_mapping('AU-2', 'nist_800_53_r5', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AU-6', 'nist_800_53_r5', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AU-9', 'nist_800_53_r5', 'A.8.15', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
-- CA family
SELECT insert_mapping('CA-2', 'nist_800_53_r5', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CA-7', 'nist_800_53_r5', 'A.8.16', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
-- CM family
SELECT insert_mapping('CM-2', 'nist_800_53_r5', 'A.8.9', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CM-3', 'nist_800_53_r5', 'A.8.32', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CM-7', 'nist_800_53_r5', 'A.8.19', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('CM-8', 'nist_800_53_r5', 'A.5.9', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- CP family
SELECT insert_mapping('CP-2', 'nist_800_53_r5', 'A.5.30', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CP-9', 'nist_800_53_r5', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CP-10', 'nist_800_53_r5', 'A.5.29', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
-- IA family
SELECT insert_mapping('IA-2', 'nist_800_53_r5', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IA-5', 'nist_800_53_r5', 'A.5.17', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IA-2', 'nist_800_53_r5', 'A.8.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
-- IR family
SELECT insert_mapping('IR-4', 'nist_800_53_r5', 'A.5.26', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IR-5', 'nist_800_53_r5', 'A.5.25', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IR-6', 'nist_800_53_r5', 'A.6.8', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('IR-8', 'nist_800_53_r5', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- MP family
SELECT insert_mapping('MP-6', 'nist_800_53_r5', 'A.8.10', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- PE family
SELECT insert_mapping('PE-2', 'nist_800_53_r5', 'A.7.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PE-3', 'nist_800_53_r5', 'A.7.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PE-6', 'nist_800_53_r5', 'A.7.4', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PE-13', 'nist_800_53_r5', 'A.7.5', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('PE-14', 'nist_800_53_r5', 'A.7.5', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
-- PL family
SELECT insert_mapping('PL-2', 'nist_800_53_r5', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('PL-4', 'nist_800_53_r5', 'A.5.10', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
-- PS family
SELECT insert_mapping('PS-3', 'nist_800_53_r5', 'A.6.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PS-4', 'nist_800_53_r5', 'A.6.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PS-5', 'nist_800_53_r5', 'A.6.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('PS-6', 'nist_800_53_r5', 'A.6.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- RA family
SELECT insert_mapping('RA-3', 'nist_800_53_r5', 'A.5.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('RA-5', 'nist_800_53_r5', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- SA family
SELECT insert_mapping('SA-3', 'nist_800_53_r5', 'A.8.25', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SA-4', 'nist_800_53_r5', 'A.5.20', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SA-9', 'nist_800_53_r5', 'A.5.21', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SA-11', 'nist_800_53_r5', 'A.8.29', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- SC family
SELECT insert_mapping('SC-7', 'nist_800_53_r5', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SC-8', 'nist_800_53_r5', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SC-12', 'nist_800_53_r5', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SC-13', 'nist_800_53_r5', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SC-28', 'nist_800_53_r5', 'A.8.24', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
-- SI family
SELECT insert_mapping('SI-2', 'nist_800_53_r5', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SI-3', 'nist_800_53_r5', 'A.8.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SI-4', 'nist_800_53_r5', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- SR family
SELECT insert_mapping('SR-2', 'nist_800_53_r5', 'A.5.21', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SR-3', 'nist_800_53_r5', 'A.5.22', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SR-6', 'nist_800_53_r5', 'A.5.20', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- NIST 800-53 ↔ NIST CSF 2.0 (parent identity)
SELECT insert_mapping('AC-1', 'nist_800_53_r5', 'PR.AA-01', 'nist_csf_2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('AC-2', 'nist_800_53_r5', 'PR.AA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('AT-2', 'nist_800_53_r5', 'PR.AT-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('IR-4', 'nist_800_53_r5', 'RS.MA-01', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('CP-9', 'nist_800_53_r5', 'PR.DS-11', 'nist_csf_2', 'equivalent', 90, 'official');
SELECT insert_mapping('RA-5', 'nist_800_53_r5', 'ID.RA-01', 'nist_csf_2', 'equivalent', 90, 'official');

-- ============================================================================
-- 6. PCI DSS v4.0.1 ↔ ISO 27001:2022 Annex A
-- ============================================================================
SELECT insert_mapping('1.2', 'pci_dss_v4', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('1.3', 'pci_dss_v4', 'A.8.22', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('2.2', 'pci_dss_v4', 'A.8.9', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('3.5', 'pci_dss_v4', 'A.8.24', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('3.6', 'pci_dss_v4', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('4.2', 'pci_dss_v4', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('5.2', 'pci_dss_v4', 'A.8.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('6.2', 'pci_dss_v4', 'A.8.25', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('6.3', 'pci_dss_v4', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('6.4', 'pci_dss_v4', 'A.8.26', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('7.2', 'pci_dss_v4', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('8.2', 'pci_dss_v4', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('8.3', 'pci_dss_v4', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('8.4', 'pci_dss_v4', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('9.2', 'pci_dss_v4', 'A.7.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('9.4', 'pci_dss_v4', 'A.7.10', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('10.2', 'pci_dss_v4', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('10.3', 'pci_dss_v4', 'A.8.15', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('10.4', 'pci_dss_v4', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('10.6', 'pci_dss_v4', 'A.8.17', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('11.3', 'pci_dss_v4', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('11.4', 'pci_dss_v4', 'A.8.29', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('12.1', 'pci_dss_v4', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('12.3', 'pci_dss_v4', 'A.5.7', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('12.6', 'pci_dss_v4', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('12.7', 'pci_dss_v4', 'A.6.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('12.8', 'pci_dss_v4', 'A.5.19', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('12.10', 'pci_dss_v4', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- ============================================================================
-- 7. CSA CCM v4 ↔ ISO 27001:2022 Annex A
-- ============================================================================
SELECT insert_mapping('A&A-02', 'csa_ccm_v4', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AIS-04', 'csa_ccm_v4', 'A.8.25', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('AIS-07', 'csa_ccm_v4', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('BCR-04', 'csa_ccm_v4', 'A.5.30', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('BCR-08', 'csa_ccm_v4', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CCC-01', 'csa_ccm_v4', 'A.8.32', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('CEK-03', 'csa_ccm_v4', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('DCS-04', 'csa_ccm_v4', 'A.7.14', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('DSP-04', 'csa_ccm_v4', 'A.5.12', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('GRC-01', 'csa_ccm_v4', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('HRS-01', 'csa_ccm_v4', 'A.6.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('HRS-09', 'csa_ccm_v4', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IAM-08', 'csa_ccm_v4', 'A.5.18', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IAM-09', 'csa_ccm_v4', 'A.5.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IAM-14', 'csa_ccm_v4', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IVS-03', 'csa_ccm_v4', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IVS-06', 'csa_ccm_v4', 'A.8.22', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('LOG-03', 'csa_ccm_v4', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('LOG-05', 'csa_ccm_v4', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SEF-01', 'csa_ccm_v4', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SEF-03', 'csa_ccm_v4', 'A.5.26', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('STA-05', 'csa_ccm_v4', 'A.5.19', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('TVM-03', 'csa_ccm_v4', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('UEM-12', 'csa_ccm_v4', 'A.8.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- ============================================================================
-- 8. BSI C5:2020 ↔ ISO 27001:2022 Annex A (German cloud assurance)
-- ============================================================================
SELECT insert_mapping('OIS-01', 'bsi_c5_2020', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('OIS-02', 'bsi_c5_2020', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('OIS-04', 'bsi_c5_2020', 'A.5.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SP-01', 'bsi_c5_2020', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('HR-01', 'bsi_c5_2020', 'A.6.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('HR-03', 'bsi_c5_2020', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('HR-05', 'bsi_c5_2020', 'A.6.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AM-01', 'bsi_c5_2020', 'A.5.9', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('AM-05', 'bsi_c5_2020', 'A.5.12', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PS-01', 'bsi_c5_2020', 'A.7.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('PS-03', 'bsi_c5_2020', 'A.7.5', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('RB-03', 'bsi_c5_2020', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('RB-08', 'bsi_c5_2020', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IDM-01', 'bsi_c5_2020', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IDM-04', 'bsi_c5_2020', 'A.8.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('IDM-08', 'bsi_c5_2020', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('KRY-02', 'bsi_c5_2020', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('KRY-03', 'bsi_c5_2020', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('KOS-01', 'bsi_c5_2020', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('BEI-08', 'bsi_c5_2020', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('DLL-01', 'bsi_c5_2020', 'A.5.19', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('SIM-01', 'bsi_c5_2020', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('BCM-02', 'bsi_c5_2020', 'A.5.30', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- ============================================================================
-- 9. IEC 62443 ↔ ISO 27001:2022 Annex A (OT/ICS to enterprise IS)
-- ============================================================================
SELECT insert_mapping('SR 1.1', 'iec_62443', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 1.2', 'iec_62443', 'A.5.16', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('SR 1.5', 'iec_62443', 'A.5.17', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 1.7', 'iec_62443', 'A.5.17', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('SR 2.1', 'iec_62443', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 2.8', 'iec_62443', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 2.11', 'iec_62443', 'A.8.17', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 3.1', 'iec_62443', 'A.8.24', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('SR 3.2', 'iec_62443', 'A.8.7', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 4.1', 'iec_62443', 'A.8.24', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('SR 5.1', 'iec_62443', 'A.8.22', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 5.2', 'iec_62443', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 6.2', 'iec_62443', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 7.3', 'iec_62443', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('SR 7.4', 'iec_62443', 'A.5.29', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- ============================================================================
-- 10. SWIFT CSCF v2024 ↔ ISO 27001:2022 Annex A
-- ============================================================================
SELECT insert_mapping('1.1', 'swift_cscf_v2024', 'A.8.22', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('1.2', 'swift_cscf_v2024', 'A.8.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('1.3', 'swift_cscf_v2024', 'A.8.9', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('1.4', 'swift_cscf_v2024', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('2.2', 'swift_cscf_v2024', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('2.3', 'swift_cscf_v2024', 'A.8.9', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('2.7', 'swift_cscf_v2024', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('3.1', 'swift_cscf_v2024', 'A.7.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('4.1', 'swift_cscf_v2024', 'A.5.17', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('4.2', 'swift_cscf_v2024', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('5.1', 'swift_cscf_v2024', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('5.4', 'swift_cscf_v2024', 'A.5.17', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('6.1', 'swift_cscf_v2024', 'A.8.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('6.2', 'swift_cscf_v2024', 'A.8.32', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('6.4', 'swift_cscf_v2024', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('7.1', 'swift_cscf_v2024', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('7.2', 'swift_cscf_v2024', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- ============================================================================
-- Bridge: Re-run migration 0106 backfill so new mappings reach framework_mapping
-- This is idempotent (ON CONFLICT DO NOTHING) so safe even if 0106 already ran.
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
