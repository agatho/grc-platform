-- ============================================================================
-- ARCTOS Seed: Cross-Framework Mappings v5 — newly added Sprint 12-15 catalogs
--   - ISO 42001 ↔ ISO 27001 / EU AI Act
--   - HIPAA Security Rule ↔ ISO 27001 / NIST 800-53 / ISO 27701
--   - EU CRA ↔ ISO 27001 / IEC 62443 / NIS2
--   - NIST 800-171 R3 ↔ ISO 27001 / NIST 800-53
--   - CMMC 2.0 ↔ NIST 800-171 R3 (1:1 alignment for L2)
-- ============================================================================

-- ============================================================================
-- 1. ISO 42001 ↔ ISO 27001:2022 Annex A (HLS-MS commonality)
-- ============================================================================
SELECT insert_mapping('5.2', 'iso_42001_2023', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('5.3', 'iso_42001_2023', 'A.5.2', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('6.1.2', 'iso_42001_2023', 'A.5.7', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('6.1.4', 'iso_42001_2023', 'A.5.7', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');
SELECT insert_mapping('7.2', 'iso_42001_2023', 'A.6.3', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('9.2', 'iso_42001_2023', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('9.3', 'iso_42001_2023', 'A.5.36', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('A.4.3', 'iso_42001_2023', 'A.5.12', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A.6.2.4', 'iso_42001_2023', 'A.8.29', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.6.2.8', 'iso_42001_2023', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('A.10.3', 'iso_42001_2023', 'A.5.19', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- ISO 42001 ↔ EU AI Act
SELECT insert_mapping('A.5.2', 'iso_42001_2023', 'Art.9', 'eu_ai_act_2024_1689', 'equivalent', 90, 'official');
SELECT insert_mapping('A.5.4', 'iso_42001_2023', 'Art.9', 'eu_ai_act_2024_1689', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.7.4', 'iso_42001_2023', 'Art.10', 'eu_ai_act_2024_1689', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.6.2.7', 'iso_42001_2023', 'Art.11', 'eu_ai_act_2024_1689', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.6.2.8', 'iso_42001_2023', 'Art.12', 'eu_ai_act_2024_1689', 'partial_overlap', 85, 'official');
SELECT insert_mapping('A.8.2', 'iso_42001_2023', 'Art.13', 'eu_ai_act_2024_1689', 'partial_overlap', 80, 'official');
SELECT insert_mapping('A.6.2.6', 'iso_42001_2023', 'Art.14', 'eu_ai_act_2024_1689', 'partial_overlap', 80, 'official');

-- ============================================================================
-- 2. HIPAA Security Rule ↔ ISO 27001 / NIST 800-53 / ISO 27701
-- ============================================================================
-- Administrative
SELECT insert_mapping('164.308(a)(1)(ii)(A)', 'hipaa_security', 'A.5.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(1)(ii)(B)', 'hipaa_security', 'A.5.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(2)', 'hipaa_security', 'A.5.2', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('164.308(a)(3)', 'hipaa_security', 'A.6.1', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('164.308(a)(3)(ii)(C)', 'hipaa_security', 'A.6.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(4)', 'hipaa_security', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(5)', 'hipaa_security', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(6)', 'hipaa_security', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(7)', 'hipaa_security', 'A.5.30', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(7)(ii)(A)', 'hipaa_security', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(b)(1)', 'hipaa_security', 'A.5.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- Physical
SELECT insert_mapping('164.310(a)(1)', 'hipaa_security', 'A.7.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.310(a)(2)(ii)', 'hipaa_security', 'A.7.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.310(b)', 'hipaa_security', 'A.8.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('164.310(d)(2)(i)', 'hipaa_security', 'A.8.10', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.310(d)(2)(ii)', 'hipaa_security', 'A.7.14', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
-- Technical
SELECT insert_mapping('164.312(a)(1)', 'hipaa_security', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(a)(2)(i)', 'hipaa_security', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(a)(2)(iv)', 'hipaa_security', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(b)', 'hipaa_security', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(c)(1)', 'hipaa_security', 'A.8.4', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('164.312(d)', 'hipaa_security', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(e)(1)', 'hipaa_security', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(e)(2)(ii)', 'hipaa_security', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- HIPAA ↔ NIST 800-53 (US Federal alignment)
SELECT insert_mapping('164.308(a)(1)(ii)(A)', 'hipaa_security', 'RA-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(4)', 'hipaa_security', 'AC-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(5)', 'hipaa_security', 'AT-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(6)', 'hipaa_security', 'IR-4', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.308(a)(7)', 'hipaa_security', 'CP-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.310(a)(1)', 'hipaa_security', 'PE-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(a)(1)', 'hipaa_security', 'AC-3', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(a)(2)(iv)', 'hipaa_security', 'SC-13', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(b)', 'hipaa_security', 'AU-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(d)', 'hipaa_security', 'IA-2', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(e)(1)', 'hipaa_security', 'SC-7', 'nist_800_53_r5', 'equivalent', 90, 'official');
SELECT insert_mapping('164.312(e)(2)(ii)', 'hipaa_security', 'SC-8', 'nist_800_53_r5', 'equivalent', 90, 'official');

-- HIPAA ↔ ISO 27701 (privacy)
SELECT insert_mapping('164.308(a)(4)', 'hipaa_security', 'A.7.3.6', 'iso_27701_2019', 'partial_overlap', 80, 'official');
SELECT insert_mapping('164.308(a)(7)', 'hipaa_security', 'A.7.4.7', 'iso_27701_2019', 'partial_overlap', 75, 'official');
SELECT insert_mapping('164.314(a)(1)', 'hipaa_security', 'A.7.2.6', 'iso_27701_2019', 'equivalent', 90, 'official');

-- ============================================================================
-- 3. EU CRA ↔ ISO 27001 / IEC 62443 / NIS2
-- ============================================================================
-- Annex I Part I → ISO 27001
SELECT insert_mapping('I.1.1', 'eu_cra_2024', 'A.5.7', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('I.1.2', 'eu_cra_2024', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.3', 'eu_cra_2024', 'A.8.9', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('I.1.4', 'eu_cra_2024', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.5', 'eu_cra_2024', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.6', 'eu_cra_2024', 'A.8.4', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('I.1.8', 'eu_cra_2024', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('I.1.10', 'eu_cra_2024', 'A.8.19', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('I.1.12', 'eu_cra_2024', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.13', 'eu_cra_2024', 'A.8.32', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
-- Annex I Part II → ISO 27001
SELECT insert_mapping('I.2.1', 'eu_cra_2024', 'A.5.9', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('I.2.2', 'eu_cra_2024', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('I.2.3', 'eu_cra_2024', 'A.8.29', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('I.2.5', 'eu_cra_2024', 'A.6.8', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
-- Article 14 → ISO 27001 incident clauses
SELECT insert_mapping('ART14.1.a', 'eu_cra_2024', 'A.5.24', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ART14.3.a', 'eu_cra_2024', 'A.5.24', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ART14.3.b', 'eu_cra_2024', 'A.6.8', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- EU CRA ↔ IEC 62443 (product security alignment)
SELECT insert_mapping('I.1.4', 'eu_cra_2024', 'FR1', 'iec_62443', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.5', 'eu_cra_2024', 'FR4', 'iec_62443', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.6', 'eu_cra_2024', 'FR3', 'iec_62443', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.8', 'eu_cra_2024', 'FR7', 'iec_62443', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.10', 'eu_cra_2024', 'FR5', 'iec_62443', 'equivalent', 90, 'official');
SELECT insert_mapping('I.1.12', 'eu_cra_2024', 'FR6', 'iec_62443', 'equivalent', 90, 'official');
SELECT insert_mapping('I.2.2', 'eu_cra_2024', 'CR 3.4', 'iec_62443', 'partial_overlap', 80, 'official');

-- EU CRA ↔ NIS2 (incident reporting alignment)
SELECT insert_mapping('ART14.1.a', 'eu_cra_2024', 'Art.21.2b', 'eu_nis2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ART14.3.a', 'eu_cra_2024', 'Art.21.2b', 'eu_nis2', 'partial_overlap', 80, 'official');
SELECT insert_mapping('I.2.5', 'eu_cra_2024', 'Art.21.2e', 'eu_nis2', 'partial_overlap', 85, 'official');

-- ============================================================================
-- 4. NIST 800-171 R3 ↔ NIST 800-53 R5 (parent identity, mostly equivalent)
-- ============================================================================
SELECT insert_mapping('03.01.01', 'nist_800_171_r3', 'AC-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.01.02', 'nist_800_171_r3', 'AC-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.01.05', 'nist_800_171_r3', 'AC-6', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.01.12', 'nist_800_171_r3', 'AC-17', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.01.16', 'nist_800_171_r3', 'AC-18', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.02.01', 'nist_800_171_r3', 'AT-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.02.02', 'nist_800_171_r3', 'AT-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.03.01', 'nist_800_171_r3', 'AU-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.03.05', 'nist_800_171_r3', 'AU-6', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.04.01', 'nist_800_171_r3', 'CM-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.04.02', 'nist_800_171_r3', 'CM-6', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.04.06', 'nist_800_171_r3', 'CM-7', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.04.10', 'nist_800_171_r3', 'CM-8', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.05.01', 'nist_800_171_r3', 'IA-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.05.03', 'nist_800_171_r3', 'IA-2', 'nist_800_53_r5', 'partial_overlap', 90, 'official');
SELECT insert_mapping('03.05.07', 'nist_800_171_r3', 'IA-5', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.06.01', 'nist_800_171_r3', 'IR-4', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.06.02', 'nist_800_171_r3', 'IR-6', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.07.05', 'nist_800_171_r3', 'MA-4', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.08.03', 'nist_800_171_r3', 'MP-6', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.09.01', 'nist_800_171_r3', 'PS-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.10.01', 'nist_800_171_r3', 'PE-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.10.07', 'nist_800_171_r3', 'PE-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.11.01', 'nist_800_171_r3', 'RA-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.11.02', 'nist_800_171_r3', 'RA-5', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.12.01', 'nist_800_171_r3', 'CA-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.12.02', 'nist_800_171_r3', 'CA-5', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.12.04', 'nist_800_171_r3', 'PL-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.13.01', 'nist_800_171_r3', 'SC-7', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.13.08', 'nist_800_171_r3', 'SC-8', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.13.10', 'nist_800_171_r3', 'SC-12', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.13.11', 'nist_800_171_r3', 'SC-13', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.14.01', 'nist_800_171_r3', 'SI-2', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.14.02', 'nist_800_171_r3', 'SI-3', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.14.06', 'nist_800_171_r3', 'SI-4', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.16.01', 'nist_800_171_r3', 'SA-9', 'nist_800_53_r5', 'equivalent', 95, 'official');
SELECT insert_mapping('03.17.01', 'nist_800_171_r3', 'SR-2', 'nist_800_53_r5', 'equivalent', 95, 'official');

-- NIST 800-171 ↔ ISO 27001 (selected high-traffic mappings)
SELECT insert_mapping('03.01.01', 'nist_800_171_r3', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('03.01.05', 'nist_800_171_r3', 'A.8.2', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('03.05.03', 'nist_800_171_r3', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('03.06.01', 'nist_800_171_r3', 'A.5.26', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('03.13.08', 'nist_800_171_r3', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('03.14.01', 'nist_800_171_r3', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('03.17.01', 'nist_800_171_r3', 'A.5.21', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- ============================================================================
-- 5. CMMC 2.0 ↔ NIST 800-171 R3 (Level 2 = 1:1)
-- ============================================================================
-- Level 1 practices map to NIST 800-171 R2 codes (same numbering scheme)
SELECT insert_mapping('AC.L1-3.1.1', 'cmmc_v2', '03.01.01', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('AC.L1-3.1.2', 'cmmc_v2', '03.01.02', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('AC.L1-3.1.20', 'cmmc_v2', '03.01.12', 'nist_800_171_r3', 'partial_overlap', 85, 'official');
SELECT insert_mapping('IA.L1-3.5.1', 'cmmc_v2', '03.05.01', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('IA.L1-3.5.2', 'cmmc_v2', '03.05.01', 'nist_800_171_r3', 'partial_overlap', 90, 'official');
SELECT insert_mapping('MP.L1-3.8.3', 'cmmc_v2', '03.08.03', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('PE.L1-3.10.1', 'cmmc_v2', '03.10.01', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('SC.L1-3.13.1', 'cmmc_v2', '03.13.01', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('SI.L1-3.14.1', 'cmmc_v2', '03.14.01', 'nist_800_171_r3', 'equivalent', 95, 'official');
SELECT insert_mapping('SI.L1-3.14.2', 'cmmc_v2', '03.14.02', 'nist_800_171_r3', 'equivalent', 95, 'official');

-- ============================================================================
-- Bridge backfill (idempotent) — push these into framework_mapping
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
