-- ============================================================================
-- ARCTOS Seed: Cross-Framework Mappings v2
-- Mappings for newly added catalogs (Sprint 4b+)
-- Uses the insert_mapping() helper function from seed_cross_framework_mappings.sql
--
-- Mapping sets:
--   1. ISO 27001 Annex A <-> ISO 27002:2022 (93 1:1 equivalences)
--   2. NIS2 Art. 21 <-> ISO 27001 Annex A (~25 mappings)
--   3. DORA <-> ISO 27001 Annex A (~20 mappings)
--   4. GDPR Art. 32 <-> TOMs catalog (~15 mappings)
--   5. TISAX <-> ISO 27001 Annex A (~25 mappings)
--   6. COSO ERM <-> COBIT 2019 (~10 mappings)
--   7. BSI Grundschutz <-> ISO 27001 Annex A (~30 mappings)
--   8. ISO 22301 <-> ISO 27001 Annex A (~5 mappings)
-- ============================================================================

-- ============================================================================
-- 1. ISO 27001:2022 Annex A <-> ISO 27002:2022 (1:1 equivalence)
-- Source: ISO official — Annex A is the normative reference derived from 27002
-- 93 controls, all 'equivalent', confidence 95, 'official'
-- ============================================================================

-- Theme A.5: Organizational controls (37)
SELECT insert_mapping('A.5.1', 'iso_27001_2022_annex_a', 'A.5.1', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.2', 'iso_27001_2022_annex_a', 'A.5.2', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.3', 'iso_27001_2022_annex_a', 'A.5.3', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.4', 'iso_27001_2022_annex_a', 'A.5.4', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.5', 'iso_27001_2022_annex_a', 'A.5.5', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.6', 'iso_27001_2022_annex_a', 'A.5.6', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.7', 'iso_27001_2022_annex_a', 'A.5.7', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.8', 'iso_27001_2022_annex_a', 'A.5.8', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.9', 'iso_27001_2022_annex_a', 'A.5.9', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.10', 'iso_27001_2022_annex_a', 'A.5.10', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.11', 'iso_27001_2022_annex_a', 'A.5.11', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.12', 'iso_27001_2022_annex_a', 'A.5.12', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.13', 'iso_27001_2022_annex_a', 'A.5.13', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.14', 'iso_27001_2022_annex_a', 'A.5.14', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.15', 'iso_27001_2022_annex_a', 'A.5.15', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.16', 'iso_27001_2022_annex_a', 'A.5.16', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.17', 'iso_27001_2022_annex_a', 'A.5.17', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.18', 'iso_27001_2022_annex_a', 'A.5.18', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.19', 'iso_27001_2022_annex_a', 'A.5.19', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.20', 'iso_27001_2022_annex_a', 'A.5.20', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.21', 'iso_27001_2022_annex_a', 'A.5.21', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.22', 'iso_27001_2022_annex_a', 'A.5.22', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.23', 'iso_27001_2022_annex_a', 'A.5.23', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.24', 'iso_27001_2022_annex_a', 'A.5.24', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.25', 'iso_27001_2022_annex_a', 'A.5.25', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.26', 'iso_27001_2022_annex_a', 'A.5.26', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.27', 'iso_27001_2022_annex_a', 'A.5.27', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.28', 'iso_27001_2022_annex_a', 'A.5.28', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.29', 'iso_27001_2022_annex_a', 'A.5.29', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.30', 'iso_27001_2022_annex_a', 'A.5.30', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.31', 'iso_27001_2022_annex_a', 'A.5.31', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.32', 'iso_27001_2022_annex_a', 'A.5.32', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.33', 'iso_27001_2022_annex_a', 'A.5.33', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.34', 'iso_27001_2022_annex_a', 'A.5.34', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.35', 'iso_27001_2022_annex_a', 'A.5.35', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.36', 'iso_27001_2022_annex_a', 'A.5.36', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.5.37', 'iso_27001_2022_annex_a', 'A.5.37', 'iso27002_2022', 'equivalent', 95, 'official');

-- Theme A.6: People controls (8)
SELECT insert_mapping('A.6.1', 'iso_27001_2022_annex_a', 'A.6.1', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.2', 'iso_27001_2022_annex_a', 'A.6.2', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.3', 'iso_27001_2022_annex_a', 'A.6.3', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.4', 'iso_27001_2022_annex_a', 'A.6.4', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.5', 'iso_27001_2022_annex_a', 'A.6.5', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.6', 'iso_27001_2022_annex_a', 'A.6.6', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.7', 'iso_27001_2022_annex_a', 'A.6.7', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.6.8', 'iso_27001_2022_annex_a', 'A.6.8', 'iso27002_2022', 'equivalent', 95, 'official');

-- Theme A.7: Physical controls (14)
SELECT insert_mapping('A.7.1', 'iso_27001_2022_annex_a', 'A.7.1', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.2', 'iso_27001_2022_annex_a', 'A.7.2', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.3', 'iso_27001_2022_annex_a', 'A.7.3', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.4', 'iso_27001_2022_annex_a', 'A.7.4', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.5', 'iso_27001_2022_annex_a', 'A.7.5', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.6', 'iso_27001_2022_annex_a', 'A.7.6', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.7', 'iso_27001_2022_annex_a', 'A.7.7', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.8', 'iso_27001_2022_annex_a', 'A.7.8', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.9', 'iso_27001_2022_annex_a', 'A.7.9', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.10', 'iso_27001_2022_annex_a', 'A.7.10', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.11', 'iso_27001_2022_annex_a', 'A.7.11', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.12', 'iso_27001_2022_annex_a', 'A.7.12', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.13', 'iso_27001_2022_annex_a', 'A.7.13', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.7.14', 'iso_27001_2022_annex_a', 'A.7.14', 'iso27002_2022', 'equivalent', 95, 'official');

-- Theme A.8: Technological controls (34)
SELECT insert_mapping('A.8.1', 'iso_27001_2022_annex_a', 'A.8.1', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.2', 'iso_27001_2022_annex_a', 'A.8.2', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.3', 'iso_27001_2022_annex_a', 'A.8.3', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.4', 'iso_27001_2022_annex_a', 'A.8.4', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.5', 'iso_27001_2022_annex_a', 'A.8.5', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.6', 'iso_27001_2022_annex_a', 'A.8.6', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.7', 'iso_27001_2022_annex_a', 'A.8.7', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.8', 'iso_27001_2022_annex_a', 'A.8.8', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.9', 'iso_27001_2022_annex_a', 'A.8.9', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.10', 'iso_27001_2022_annex_a', 'A.8.10', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.11', 'iso_27001_2022_annex_a', 'A.8.11', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.12', 'iso_27001_2022_annex_a', 'A.8.12', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.13', 'iso_27001_2022_annex_a', 'A.8.13', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.14', 'iso_27001_2022_annex_a', 'A.8.14', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.15', 'iso_27001_2022_annex_a', 'A.8.15', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.16', 'iso_27001_2022_annex_a', 'A.8.16', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.17', 'iso_27001_2022_annex_a', 'A.8.17', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.18', 'iso_27001_2022_annex_a', 'A.8.18', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.19', 'iso_27001_2022_annex_a', 'A.8.19', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.20', 'iso_27001_2022_annex_a', 'A.8.20', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.21', 'iso_27001_2022_annex_a', 'A.8.21', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.22', 'iso_27001_2022_annex_a', 'A.8.22', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.23', 'iso_27001_2022_annex_a', 'A.8.23', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.24', 'iso_27001_2022_annex_a', 'A.8.24', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.25', 'iso_27001_2022_annex_a', 'A.8.25', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.26', 'iso_27001_2022_annex_a', 'A.8.26', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.27', 'iso_27001_2022_annex_a', 'A.8.27', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.28', 'iso_27001_2022_annex_a', 'A.8.28', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.29', 'iso_27001_2022_annex_a', 'A.8.29', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.30', 'iso_27001_2022_annex_a', 'A.8.30', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.31', 'iso_27001_2022_annex_a', 'A.8.31', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.32', 'iso_27001_2022_annex_a', 'A.8.32', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.33', 'iso_27001_2022_annex_a', 'A.8.33', 'iso27002_2022', 'equivalent', 95, 'official');
SELECT insert_mapping('A.8.34', 'iso_27001_2022_annex_a', 'A.8.34', 'iso27002_2022', 'equivalent', 95, 'official');

-- ============================================================================
-- 2. NIS2 Art. 21 <-> ISO 27001:2022 Annex A (~25 key mappings)
-- Source: ENISA NIS2 implementation guidance + official mapping tables
-- NIS2 codes: Art.21.2a through Art.21.2j (from seed_catalog_nis2.sql)
-- ============================================================================

-- Art.21.2a: Risk analysis and IS policies -> A.5.1 IS policies
SELECT insert_mapping('Art.21.2a', 'eu_nis2', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- Art.21.2b: Incident handling -> A.5.24-A.5.26, A.6.8
SELECT insert_mapping('Art.21.2b', 'eu_nis2', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('Art.21.2b', 'eu_nis2', 'A.5.25', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.21.2b', 'eu_nis2', 'A.5.26', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.21.2b', 'eu_nis2', 'A.6.8', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Art.21.2c: BC/DR/crisis management -> A.5.29, A.5.30
SELECT insert_mapping('Art.21.2c', 'eu_nis2', 'A.5.29', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('Art.21.2c', 'eu_nis2', 'A.5.30', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- Art.21.2d: Supply chain security -> A.5.19-A.5.23
SELECT insert_mapping('Art.21.2d', 'eu_nis2', 'A.5.19', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('Art.21.2d', 'eu_nis2', 'A.5.20', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.21.2d', 'eu_nis2', 'A.5.21', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.21.2d', 'eu_nis2', 'A.5.22', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2d', 'eu_nis2', 'A.5.23', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Art.21.2e: Vulnerability handling -> A.8.8, A.8.25, A.8.28
SELECT insert_mapping('Art.21.2e', 'eu_nis2', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('Art.21.2e', 'eu_nis2', 'A.8.25', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2e', 'eu_nis2', 'A.8.28', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Art.21.2f: Assess effectiveness -> A.5.35, A.5.36
SELECT insert_mapping('Art.21.2f', 'eu_nis2', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('Art.21.2f', 'eu_nis2', 'A.5.36', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- Art.21.2g: Cyber hygiene/training -> A.6.3, A.5.37
SELECT insert_mapping('Art.21.2g', 'eu_nis2', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('Art.21.2g', 'eu_nis2', 'A.5.37', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Art.21.2h: Cryptography -> A.8.24
SELECT insert_mapping('Art.21.2h', 'eu_nis2', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- Art.21.2i: HR/access/asset -> A.5.9, A.5.15-A.5.18, A.6.1-A.6.5
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.5.9', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.5.15', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.5.16', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.5.17', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.5.18', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.6.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.6.2', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.6.3', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.6.4', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');
SELECT insert_mapping('Art.21.2i', 'eu_nis2', 'A.6.5', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');

-- Art.21.2j: MFA/secured comms -> A.8.5, A.5.14
SELECT insert_mapping('Art.21.2j', 'eu_nis2', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('Art.21.2j', 'eu_nis2', 'A.5.14', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- ============================================================================
-- 3. DORA <-> ISO 27001:2022 Annex A (~20 key mappings)
-- Source: DORA-to-ISO mapping from financial sector guidance
-- DORA codes: DORA-II.x (ICT Risk), DORA-III.x (Incidents),
--   DORA-IV.x (Testing), DORA-V.x (Third-Party)
-- ============================================================================

-- Chapter II: ICT Risk Management -> ISO 27001 controls
SELECT insert_mapping('DORA-II.5', 'eu_dora', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.5', 'eu_dora', 'A.5.4', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-II.6', 'eu_dora', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.8', 'eu_dora', 'A.5.9', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.9', 'eu_dora', 'A.5.15', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-II.9', 'eu_dora', 'A.8.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-II.10', 'eu_dora', 'A.8.15', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.10', 'eu_dora', 'A.8.16', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.11', 'eu_dora', 'A.5.29', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.11', 'eu_dora', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-II.12', 'eu_dora', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('DORA-II.13', 'eu_dora', 'A.5.27', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- Chapter III: Incident Management -> ISO 27001 controls
SELECT insert_mapping('DORA-III.17', 'eu_dora', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('DORA-III.17', 'eu_dora', 'A.5.25', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-III.17', 'eu_dora', 'A.5.26', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-III.19', 'eu_dora', 'A.6.8', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-III.17', 'eu_dora', 'A.5.28', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');

-- Chapter IV: Resilience Testing -> ISO 27001 controls
SELECT insert_mapping('DORA-IV.24', 'eu_dora', 'A.5.35', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-IV.25', 'eu_dora', 'A.8.8', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-IV.24', 'eu_dora', 'A.5.36', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Chapter V: Third-Party Risk -> ISO 27001 controls
SELECT insert_mapping('DORA-V.28', 'eu_dora', 'A.5.19', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DORA-V.28', 'eu_dora', 'A.5.20', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-V.28', 'eu_dora', 'A.5.21', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-V.30', 'eu_dora', 'A.5.22', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('DORA-V.28', 'eu_dora', 'A.5.23', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- ============================================================================
-- 4. GDPR Art. 32 <-> TOMs Catalog (~15 mappings)
-- Source: Art. 32 GDPR sub-requirements mapped to specific TOM measures
-- GDPR codes: Art.32, Art.32.1a-d (from seed_catalog_gdpr.sql)
-- TOM codes: TOM-C/I/A/R/P categories (from seed_catalog_toms.sql)
-- ============================================================================

-- Art.32.1a: Pseudonymisation and encryption
SELECT insert_mapping('Art.32.1a', 'eu_gdpr', 'TOM-C.05', 'gdpr_art32_toms', 'equivalent', 90, 'official');
SELECT insert_mapping('Art.32.1a', 'eu_gdpr', 'TOM-I.01', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');

-- Art.32.1b: Confidentiality, integrity, availability and resilience
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-C.01', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-C.02', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-C.03', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-C.04', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-I.02', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-I.03', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-R.01', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-R.04', 'gdpr_art32_toms', 'partial_overlap', 75, 'official');
SELECT insert_mapping('Art.32.1b', 'eu_gdpr', 'TOM-R.05', 'gdpr_art32_toms', 'partial_overlap', 75, 'official');

-- Art.32.1c: Restore availability
SELECT insert_mapping('Art.32.1c', 'eu_gdpr', 'TOM-A.01', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1c', 'eu_gdpr', 'TOM-A.02', 'gdpr_art32_toms', 'equivalent', 90, 'official');
SELECT insert_mapping('Art.32.1c', 'eu_gdpr', 'TOM-A.03', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1c', 'eu_gdpr', 'TOM-A.04', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');

-- Art.32.1d: Testing and evaluation
SELECT insert_mapping('Art.32.1d', 'eu_gdpr', 'TOM-P.01', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1d', 'eu_gdpr', 'TOM-P.02', 'gdpr_art32_toms', 'equivalent', 90, 'official');
SELECT insert_mapping('Art.32.1d', 'eu_gdpr', 'TOM-P.03', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1d', 'eu_gdpr', 'TOM-P.06', 'gdpr_art32_toms', 'partial_overlap', 85, 'official');
SELECT insert_mapping('Art.32.1d', 'eu_gdpr', 'TOM-P.08', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');

-- Art.32 overall -> sub-processor measures and training
SELECT insert_mapping('Art.32', 'eu_gdpr', 'TOM-S.01', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.32', 'eu_gdpr', 'TOM-S.02', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');
SELECT insert_mapping('Art.32', 'eu_gdpr', 'TOM-P.04', 'gdpr_art32_toms', 'partial_overlap', 75, 'official');
SELECT insert_mapping('Art.32', 'eu_gdpr', 'TOM-P.05', 'gdpr_art32_toms', 'partial_overlap', 80, 'official');

-- ============================================================================
-- 5. TISAX / VDA ISA <-> ISO 27001:2022 Annex A (~25 key mappings)
-- Source: VDA ISA official mapping to ISO 27001 (TISAX is based on ISO 27001)
-- TISAX codes: Module.Section (e.g. 1.1, 2.1) from seed_catalog_tisax.sql
-- ============================================================================

-- Module 1: IS Policies -> A.5.1-A.5.4
SELECT insert_mapping('1.1', 'vda_isa_tisax', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('1.2', 'vda_isa_tisax', 'A.5.2', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('1.2', 'vda_isa_tisax', 'A.5.3', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('1.3', 'vda_isa_tisax', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Module 2: HR -> A.6.1-A.6.5
SELECT insert_mapping('2.1', 'vda_isa_tisax', 'A.6.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('2.2', 'vda_isa_tisax', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('2.2', 'vda_isa_tisax', 'A.6.2', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('2.3', 'vda_isa_tisax', 'A.6.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- Module 3: Asset Management -> A.5.9-A.5.14
SELECT insert_mapping('3.1', 'vda_isa_tisax', 'A.5.9', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('3.2', 'vda_isa_tisax', 'A.5.12', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('3.2', 'vda_isa_tisax', 'A.5.13', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('3.3', 'vda_isa_tisax', 'A.7.10', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Module 4: Access Control -> A.5.15-A.5.18, A.8.2-A.8.5
SELECT insert_mapping('4.1', 'vda_isa_tisax', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('4.2', 'vda_isa_tisax', 'A.5.16', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('4.2', 'vda_isa_tisax', 'A.5.18', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('4.2', 'vda_isa_tisax', 'A.8.2', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('4.3', 'vda_isa_tisax', 'A.8.5', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- Module 5: Cryptography -> A.8.24
SELECT insert_mapping('5.1', 'vda_isa_tisax', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- Module 6: Physical Security -> A.7.1-A.7.14
SELECT insert_mapping('6.1', 'vda_isa_tisax', 'A.7.1', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('6.1', 'vda_isa_tisax', 'A.7.2', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('6.2', 'vda_isa_tisax', 'A.7.8', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- Module 7: Operations Security -> A.8.7-A.8.16
SELECT insert_mapping('7.1', 'vda_isa_tisax', 'A.5.37', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('7.2', 'vda_isa_tisax', 'A.8.7', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('7.3', 'vda_isa_tisax', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('7.4', 'vda_isa_tisax', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('7.4', 'vda_isa_tisax', 'A.8.16', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('7.6', 'vda_isa_tisax', 'A.8.8', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- Module 8: Communications Security -> A.8.20-A.8.22
SELECT insert_mapping('8.1', 'vda_isa_tisax', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('8.1', 'vda_isa_tisax', 'A.8.21', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('8.1', 'vda_isa_tisax', 'A.8.22', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('8.2', 'vda_isa_tisax', 'A.5.14', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- Module 9: System Dev -> A.8.25-A.8.34
SELECT insert_mapping('9.1', 'vda_isa_tisax', 'A.8.26', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('9.2', 'vda_isa_tisax', 'A.8.25', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('9.2', 'vda_isa_tisax', 'A.8.27', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('9.3', 'vda_isa_tisax', 'A.8.33', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- Module 10: Suppliers -> A.5.19-A.5.23
SELECT insert_mapping('10.1', 'vda_isa_tisax', 'A.5.19', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('10.1', 'vda_isa_tisax', 'A.5.20', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('10.2', 'vda_isa_tisax', 'A.5.22', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- Module 11: Incidents -> A.5.24-A.5.28
SELECT insert_mapping('11.1', 'vda_isa_tisax', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('11.1', 'vda_isa_tisax', 'A.5.25', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('11.1', 'vda_isa_tisax', 'A.5.26', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('11.1', 'vda_isa_tisax', 'A.5.27', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Module 12: BC -> A.5.29-A.5.30
SELECT insert_mapping('12.1', 'vda_isa_tisax', 'A.5.29', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('12.1', 'vda_isa_tisax', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Module 13: Compliance -> A.5.31-A.5.36
SELECT insert_mapping('13.1', 'vda_isa_tisax', 'A.5.31', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('13.2', 'vda_isa_tisax', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('13.2', 'vda_isa_tisax', 'A.5.36', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- ============================================================================
-- 6. COSO ERM 2017 <-> COBIT 2019 (~10 key mappings)
-- Source: ISACA/COSO integration guidance
-- COSO codes: COSO-GC-xx, COSO-SO-xx, COSO-PF-xx, COSO-RR-xx, COSO-IC-xx
-- COBIT codes: EDM01-05, APO02-03, APO12, DSS01-06, MEA01-04
-- ============================================================================

-- Governance & Culture -> EDM (Evaluate, Direct and Monitor)
SELECT insert_mapping('COSO-GC-01', 'coso_erm_2017', 'EDM01', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-GC-01', 'coso_erm_2017', 'EDM03', 'cobit_2019', 'partial_overlap', 85, 'community');
SELECT insert_mapping('COSO-GC-02', 'coso_erm_2017', 'EDM01', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-GC-03', 'coso_erm_2017', 'EDM05', 'cobit_2019', 'partial_overlap', 75, 'community');
SELECT insert_mapping('COSO-GC-05', 'coso_erm_2017', 'APO07', 'cobit_2019', 'partial_overlap', 80, 'community');

-- Strategy & Objective-Setting -> APO (Align, Plan and Organize)
SELECT insert_mapping('COSO-SO-06', 'coso_erm_2017', 'APO02', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-SO-07', 'coso_erm_2017', 'EDM03', 'cobit_2019', 'partial_overlap', 85, 'community');
SELECT insert_mapping('COSO-SO-08', 'coso_erm_2017', 'APO02', 'cobit_2019', 'partial_overlap', 75, 'community');
SELECT insert_mapping('COSO-SO-09', 'coso_erm_2017', 'APO03', 'cobit_2019', 'partial_overlap', 75, 'community');

-- Performance -> APO12 (Managed Risk), DSS (Deliver, Service and Support)
SELECT insert_mapping('COSO-PF-10', 'coso_erm_2017', 'APO12', 'cobit_2019', 'equivalent', 85, 'community');
SELECT insert_mapping('COSO-PF-11', 'coso_erm_2017', 'APO12', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-PF-13', 'coso_erm_2017', 'APO12', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-PF-13', 'coso_erm_2017', 'DSS05', 'cobit_2019', 'partial_overlap', 75, 'community');
SELECT insert_mapping('COSO-PF-14', 'coso_erm_2017', 'APO12', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-PF-10', 'coso_erm_2017', 'DSS01', 'cobit_2019', 'partial_overlap', 70, 'community');
SELECT insert_mapping('COSO-PF-13', 'coso_erm_2017', 'DSS02', 'cobit_2019', 'partial_overlap', 70, 'community');
SELECT insert_mapping('COSO-PF-13', 'coso_erm_2017', 'DSS04', 'cobit_2019', 'partial_overlap', 75, 'community');

-- Review & Revision -> MEA (Monitor, Evaluate and Assess)
SELECT insert_mapping('COSO-RR-15', 'coso_erm_2017', 'MEA01', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-RR-16', 'coso_erm_2017', 'MEA01', 'cobit_2019', 'equivalent', 85, 'community');
SELECT insert_mapping('COSO-RR-16', 'coso_erm_2017', 'MEA02', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-RR-17', 'coso_erm_2017', 'MEA04', 'cobit_2019', 'partial_overlap', 80, 'community');

-- Information, Communication & Reporting -> MEA + APO
SELECT insert_mapping('COSO-IC-18', 'coso_erm_2017', 'APO14', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-IC-19', 'coso_erm_2017', 'APO08', 'cobit_2019', 'partial_overlap', 75, 'community');
SELECT insert_mapping('COSO-IC-20', 'coso_erm_2017', 'MEA01', 'cobit_2019', 'partial_overlap', 80, 'community');
SELECT insert_mapping('COSO-IC-20', 'coso_erm_2017', 'MEA03', 'cobit_2019', 'partial_overlap', 75, 'community');

-- ============================================================================
-- 7. BSI IT-Grundschutz <-> ISO 27001:2022 Annex A (~30 key mappings)
-- Source: BSI Kreuzreferenztabelle (official cross-reference table)
-- BSI codes: ISMS.1, ORP.x, CON.x, DER.x, APP.x, SYS.x, NET.x, INF.x
-- ============================================================================

-- ISMS.1: Security management -> A.5.1-A.5.4
SELECT insert_mapping('ISMS.1', 'bsi_itgs_bausteine', 'A.5.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('ISMS.1', 'bsi_itgs_bausteine', 'A.5.2', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ISMS.1', 'bsi_itgs_bausteine', 'A.5.3', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ISMS.1', 'bsi_itgs_bausteine', 'A.5.4', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- ORP.1: Organisation -> A.5.2-A.5.8
SELECT insert_mapping('ORP.1', 'bsi_itgs_bausteine', 'A.5.2', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ORP.1', 'bsi_itgs_bausteine', 'A.5.3', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ORP.1', 'bsi_itgs_bausteine', 'A.5.8', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- ORP.2: Personnel -> A.6.1-A.6.5
SELECT insert_mapping('ORP.2', 'bsi_itgs_bausteine', 'A.6.1', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('ORP.2', 'bsi_itgs_bausteine', 'A.6.2', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ORP.2', 'bsi_itgs_bausteine', 'A.6.5', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- ORP.3: Awareness and training -> A.6.3
SELECT insert_mapping('ORP.3', 'bsi_itgs_bausteine', 'A.6.3', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- ORP.4: Identity and access management -> A.5.15-A.5.18, A.8.2-A.8.5
SELECT insert_mapping('ORP.4', 'bsi_itgs_bausteine', 'A.5.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('ORP.4', 'bsi_itgs_bausteine', 'A.5.16', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ORP.4', 'bsi_itgs_bausteine', 'A.5.17', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ORP.4', 'bsi_itgs_bausteine', 'A.5.18', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('ORP.4', 'bsi_itgs_bausteine', 'A.8.2', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('ORP.4', 'bsi_itgs_bausteine', 'A.8.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- ORP.5: Compliance management -> A.5.31-A.5.36
SELECT insert_mapping('ORP.5', 'bsi_itgs_bausteine', 'A.5.31', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('ORP.5', 'bsi_itgs_bausteine', 'A.5.36', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- CON.1: Crypto concept -> A.8.24
SELECT insert_mapping('CON.1', 'bsi_itgs_bausteine', 'A.8.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- CON.3: Data backup -> A.8.13
SELECT insert_mapping('CON.3', 'bsi_itgs_bausteine', 'A.8.13', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- CON.6: Deletion and destruction -> A.8.10
SELECT insert_mapping('CON.6', 'bsi_itgs_bausteine', 'A.8.10', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- CON.8: Software development -> A.8.25-A.8.28
SELECT insert_mapping('CON.8', 'bsi_itgs_bausteine', 'A.8.25', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('CON.8', 'bsi_itgs_bausteine', 'A.8.28', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- CON.9: Information exchange -> A.5.14
SELECT insert_mapping('CON.9', 'bsi_itgs_bausteine', 'A.5.14', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- DER.1: Detection of security-relevant events -> A.8.15-A.8.16
SELECT insert_mapping('DER.1', 'bsi_itgs_bausteine', 'A.8.15', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('DER.1', 'bsi_itgs_bausteine', 'A.8.16', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- DER.2.1: Incident handling -> A.5.24-A.5.28
SELECT insert_mapping('DER.2.1', 'bsi_itgs_bausteine', 'A.5.24', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');
SELECT insert_mapping('DER.2.1', 'bsi_itgs_bausteine', 'A.5.25', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DER.2.1', 'bsi_itgs_bausteine', 'A.5.26', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DER.2.1', 'bsi_itgs_bausteine', 'A.5.27', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('DER.2.1', 'bsi_itgs_bausteine', 'A.5.28', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- DER.2.2: Forensics -> A.5.28
SELECT insert_mapping('DER.2.2', 'bsi_itgs_bausteine', 'A.5.28', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- DER.3.1: Audits -> A.5.35
SELECT insert_mapping('DER.3.1', 'bsi_itgs_bausteine', 'A.5.35', 'iso_27001_2022_annex_a', 'equivalent', 90, 'official');

-- DER.4: Emergency management -> A.5.29, A.5.30
SELECT insert_mapping('DER.4', 'bsi_itgs_bausteine', 'A.5.29', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('DER.4', 'bsi_itgs_bausteine', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- APP layer (Applications) -> A.8 technological controls (grouped)
SELECT insert_mapping('APP.1.1', 'bsi_itgs_bausteine', 'A.8.19', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');
SELECT insert_mapping('APP.1.2', 'bsi_itgs_bausteine', 'A.8.23', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('APP.3.2', 'bsi_itgs_bausteine', 'A.8.9', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');
SELECT insert_mapping('APP.5.3', 'bsi_itgs_bausteine', 'A.8.24', 'iso_27001_2022_annex_a', 'partial_overlap', 70, 'official');

-- SYS layer (IT Systems) -> A.8 technological controls
SELECT insert_mapping('SYS.1.1', 'bsi_itgs_bausteine', 'A.8.9', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('SYS.2.1', 'bsi_itgs_bausteine', 'A.8.1', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('SYS.3.1', 'bsi_itgs_bausteine', 'A.8.1', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');
SELECT insert_mapping('SYS.3.1', 'bsi_itgs_bausteine', 'A.6.7', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');

-- NET layer (Networks) -> A.8.20-A.8.22
SELECT insert_mapping('NET.1.1', 'bsi_itgs_bausteine', 'A.8.20', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('NET.1.1', 'bsi_itgs_bausteine', 'A.8.22', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('NET.3.2', 'bsi_itgs_bausteine', 'A.8.20', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- INF layer (Infrastructure) -> A.7.1-A.7.14
SELECT insert_mapping('INF.1', 'bsi_itgs_bausteine', 'A.7.1', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('INF.1', 'bsi_itgs_bausteine', 'A.7.2', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('INF.1', 'bsi_itgs_bausteine', 'A.7.3', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('INF.1', 'bsi_itgs_bausteine', 'A.7.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('INF.2', 'bsi_itgs_bausteine', 'A.7.4', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('INF.2', 'bsi_itgs_bausteine', 'A.7.5', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('INF.2', 'bsi_itgs_bausteine', 'A.7.8', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('INF.2', 'bsi_itgs_bausteine', 'A.7.11', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('INF.7', 'bsi_itgs_bausteine', 'A.7.7', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');
SELECT insert_mapping('INF.9', 'bsi_itgs_bausteine', 'A.6.7', 'iso_27001_2022_annex_a', 'equivalent', 85, 'official');

-- OPS layer -> A.8 controls
SELECT insert_mapping('OPS.1.1.2', 'bsi_itgs_bausteine', 'A.8.8', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');
SELECT insert_mapping('OPS.1.1.2', 'bsi_itgs_bausteine', 'A.8.32', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('OPS.2.2', 'bsi_itgs_bausteine', 'A.5.23', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- ============================================================================
-- 8. ISO 22301:2019 <-> ISO 27001:2022 Annex A (~5 key mappings)
-- Source: ISO official alignment between 22301 and 27001
-- ISO 22301 codes: Clause 8.x (from seed_catalog_iso22301.sql)
-- ============================================================================

-- Clause 8.2: BIA and risk assessment -> A.5.29, A.5.30
SELECT insert_mapping('8.2', 'iso_22301_2019', 'A.5.29', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');
SELECT insert_mapping('8.2', 'iso_22301_2019', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Clause 8.3: BC strategies -> A.5.29
SELECT insert_mapping('8.3', 'iso_22301_2019', 'A.5.29', 'iso_27001_2022_annex_a', 'partial_overlap', 80, 'official');

-- Clause 8.4: BC plans -> A.5.30
SELECT insert_mapping('8.4', 'iso_22301_2019', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 85, 'official');

-- Clause 8.5: Exercise programme -> A.5.30
SELECT insert_mapping('8.5', 'iso_22301_2019', 'A.5.30', 'iso_27001_2022_annex_a', 'partial_overlap', 75, 'official');

-- Clause 8.1: Operational planning -> A.5.1 (general policies)
SELECT insert_mapping('8.1', 'iso_22301_2019', 'A.5.1', 'iso_27001_2022_annex_a', 'partial_overlap', 70, 'official');
