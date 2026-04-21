-- ============================================================================
-- Migration 0289: CIS Controls v8 Implementation Groups (IG1/IG2/IG3) Metadata
--
-- Die CIS Controls v8 unterscheiden drei Implementation Groups:
--   IG1 — Essential Cyber Hygiene   (~56 Safeguards, Baseline für jede Org)
--   IG2 — Risk-Based Approach       (~74 Safeguards, umfasst IG1)
--   IG3 — Mature Cybersecurity      (~23 Safeguards, umfasst IG1 + IG2)
--
-- Audit-Anforderungen variieren je nach IG-Ziel der Org. Diese Migration
-- schreibt die IG-Zugehörigkeit als `metadata.ig = ["ig1", "ig2", "ig3"]`
-- auf jede catalog_entry-Zeile des CIS-Katalogs.
--
-- Idempotent: nutzt UPDATE … WHERE metadata IS NULL/'{}' + ON CONFLICT
-- Inserts. Re-run ist sicher.
-- ============================================================================

DO $$
DECLARE
  cis_catalog_id UUID := 'c0000000-0000-0000-0000-c150c74201a8';
BEGIN
  -- ── A) Level-0-Controls (CIS-01 bis CIS-18): gelten für alle IGs ──
  UPDATE catalog_entry
  SET metadata = jsonb_build_object(
    'ig1', true,
    'ig2', true,
    'ig3', true,
    'ig_scope', 'all',
    'framework', 'cis_controls_v8'
  )
  WHERE catalog_id = cis_catalog_id
    AND level = 0
    AND (metadata IS NULL OR NOT metadata ? 'ig1');

  -- ── B) Bestehende IG1-Safeguards (Marker "IG1" in description) ──
  -- Diese sind im aktuellen Seed ausschließlich IG1-markiert.
  UPDATE catalog_entry
  SET metadata = jsonb_build_object(
    'ig1', true,
    'ig2', true,   -- IG2 umfasst IG1
    'ig3', true,   -- IG3 umfasst IG1+IG2
    'ig_scope', 'ig1',
    'framework', 'cis_controls_v8'
  )
  WHERE catalog_id = cis_catalog_id
    AND level = 1
    AND description ILIKE '%IG1%'
    AND (metadata IS NULL OR NOT metadata ? 'ig1');

  -- ── C) Zusätzliche IG2-spezifische Safeguards (Beispiel-Set) ──
  -- Diese Safeguards greifen erst bei IG2/IG3, nicht bei IG1.
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata)
  VALUES
    (cis_catalog_id, 'CIS-01.3', 'Utilize an Active Discovery Tool', 'Utilize an active discovery tool to identify assets connected to the enterprise''s network. IG2.', 1, 103, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-02.3', 'Address Unauthorized Software', 'Ensure that unauthorized software is either removed or the inventory is updated. IG2.', 1, 203, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-04.6', 'Securely Manage Enterprise Assets and Software', 'Securely manage enterprise assets and software using secure network protocols. IG2.', 1, 406, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-05.4', 'Restrict Administrator Privileges', 'Restrict administrator privileges to dedicated administrator accounts. IG2.', 1, 504, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-06.8', 'Define and Maintain Role-Based Access Control', 'Define and maintain role-based access control (RBAC) via access grants mapped to roles. IG2.', 1, 608, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-07.5', 'Perform Automated Vulnerability Scans of Internal Assets', 'Perform automated vulnerability scans of internal enterprise assets on a quarterly or more frequent basis. IG2.', 1, 705, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-08.10', 'Retain Audit Logs', 'Retain audit logs across enterprise assets for a minimum of 90 days. IG2.', 1, 810, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-11.3', 'Protect Recovery Data', 'Protect recovery data with equivalent controls to the original data. IG2.', 1, 1103, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-12.2', 'Establish and Maintain a Secure Network Architecture', 'Establish and maintain a secure network architecture, with segmentation and separation of duties. IG2.', 1, 1202, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-13.6', 'Collect Network Traffic Flow Logs', 'Collect network traffic flow logs and/or network traffic to review and alert upon from network devices. IG2.', 1, 1306, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-14.4', 'Train Workforce on Data Handling Best Practices', 'Train workforce members on how to identify and properly store, transfer, archive, and destroy sensitive data. IG2.', 1, 1404, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-16.1', 'Establish and Maintain a Secure Application Development Process', 'Establish and maintain a secure application development process. IG2.', 1, 1601, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-17.4', 'Establish and Maintain an Incident Response Process', 'Establish and maintain an incident response process that addresses roles and responsibilities, compliance requirements, and a communication plan. IG2.', 1, 1704, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-18.1', 'Establish and Maintain a Penetration Testing Program', 'Establish and maintain a penetration testing program appropriate to the size, complexity, and maturity of the enterprise. IG2.', 1, 1801, 'active',
      jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO UPDATE
    SET metadata = EXCLUDED.metadata
    WHERE catalog_entry.metadata IS NULL OR NOT catalog_entry.metadata ? 'ig1';

  -- ── D) Zusätzliche IG3-only-Safeguards (Mature Program) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata)
  VALUES
    (cis_catalog_id, 'CIS-01.5', 'Use a Passive Asset Discovery Tool', 'Use a passive discovery tool to identify assets connected to the enterprise network. IG3.', 1, 105, 'active',
      jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-02.7', 'Allowlist Authorized Scripts', 'Use technical controls, such as digital signatures and version control, to ensure that only authorized scripts can execute. IG3.', 1, 207, 'active',
      jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-03.14', 'Log Sensitive Data Access', 'Log sensitive data access, including modification and disposal. IG3.', 1, 314, 'active',
      jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-13.10', 'Perform Application Layer Filtering', 'Perform application-layer filtering at enterprise-defined perimeter. IG3.', 1, 1310, 'active',
      jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_catalog_id, 'CIS-18.5', 'Perform Periodic Internal Penetration Tests', 'Perform periodic internal penetration tests based on program requirements, no less than annually. IG3.', 1, 1805, 'active',
      jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO UPDATE
    SET metadata = EXCLUDED.metadata
    WHERE catalog_entry.metadata IS NULL OR NOT catalog_entry.metadata ? 'ig1';

  -- ── E) Parent-Linkage für neu eingefügte Safeguards sicherstellen ──
  UPDATE catalog_entry ce SET parent_entry_id = parent.id
  FROM catalog_entry parent
  WHERE ce.catalog_id = cis_catalog_id
    AND parent.catalog_id = cis_catalog_id
    AND ce.level = 1
    AND parent.level = 0
    AND ce.parent_entry_id IS NULL
    AND ce.code LIKE parent.code || '.%';

  -- ── F) Defensive: alle noch nicht gesetzten Level-1-Einträge bekommen
  --        ig1=ig2=ig3=true (Fallback — zeigt sich in UI als "alle IGs").
  UPDATE catalog_entry
  SET metadata = jsonb_build_object(
    'ig1', true,
    'ig2', true,
    'ig3', true,
    'ig_scope', 'unspecified',
    'framework', 'cis_controls_v8'
  )
  WHERE catalog_id = cis_catalog_id
    AND (metadata IS NULL OR NOT metadata ? 'ig1');

END $$;

-- Bilanz-View (nicht persistent — nur zur Verifikation nach Migration):
--   SELECT metadata->>'ig_scope' AS scope, count(*)
--   FROM catalog_entry
--   WHERE catalog_id = 'c0000000-0000-0000-0000-c150c74201a8'
--   GROUP BY 1 ORDER BY 1;
