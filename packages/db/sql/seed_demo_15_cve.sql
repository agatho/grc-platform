-- =============================================================================
-- ARCTOS Demo Data Seed 15 — CVE feed, asset CPEs and CVE/asset matches
-- =============================================================================
-- [E2E-TRIAGE-4 · 2026-09-02] Why this file exists
--
-- `i-08-cve-flow.spec.ts` opened with
--   `test.skip(!id, "no CVE matches available — skip ack test")`
-- and had skipped itself on every run this repository has a record of.
-- Measured against the running database before this file:
--
--   cve_feed_item     0 rows
--   asset_cpe         0 rows
--   cve_asset_match   0 rows
--
-- — on a database that had `db:seed` and `db:seed:demo` applied in full. The
-- gap is not a tenant problem and not a fixture problem: no seed file has ever
-- written a single row into the vulnerability-intelligence tables, so the CVE
-- surface (feed, matches, acknowledgement, conversion to a vulnerability, the
-- CVE dashboard) has never been exercised end to end. The list endpoint
-- answered 200 with an empty array, which is why the spec reported "skipped"
-- rather than "failed" — an empty list is a valid answer and only the test
-- knew it was not the answer it needed.
--
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000015XX for the feed
-- items; the CPE assignments and the matches derive theirs with md5() from the
-- pair they describe, so they are identical on every database without a
-- hand-maintained list.
-- Idempotent: feed items and CPE assignments do nothing on conflict, the
-- matches converge to the seeded status (see section 3).
-- Depends on: seed_demo_00_platform.sql (org + personas),
--             seed_demo_01_assets_isms.sql (assets 0401-040A).
--
-- The feed items are PLATFORM-WIDE (`cve_feed_item` carries no org_id — it is
-- the mirror of an external NVD/CERT-Bund feed); the CPE assignments and the
-- matches are per-tenant and are written for the demo tenant the E2E suite
-- asserts against.
--
-- The CVE identifiers below are real, public advisories, used here as
-- realistic reference data. The CVSS scores are the published base scores.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Session config for audit triggers (same pattern as the other demo files)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('app.current_org_id', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', true);
SELECT set_config('app.current_user_id', 'b8c9d0e1-f2a3-4567-1234-89abcdef0123', true);
SELECT set_config('app.current_user_email', 'demo.security@arctos.dev', true);
SELECT set_config('app.current_user_name', 'Markus Bauer', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CVE feed items (platform-wide mirror of the external feed)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO cve_feed_item (id, cve_id, source, title, description, cvss_score,
  cvss_severity, affected_cpes, published_at, modified_at, "references")
VALUES
  ('d0000000-0000-0000-0000-000000001501',
   'CVE-2021-44228', 'nvd',
   'Apache Log4j2 JNDI features do not protect against attacker controlled LDAP endpoints (Log4Shell)',
   'JNDI-Lookups in Log4j 2 erlauben einem Angreifer, ueber kontrollierte Log-Eingaben Code aus einem entfernten LDAP-Verzeichnis zu laden und auszufuehren. Betrifft Anwendungsserver, die Nutzereingaben protokollieren.',
   10.0, 'critical',
   '["cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*"]'::jsonb,
   '2021-12-10T10:15:00Z', '2023-11-07T03:39:00Z',
   '["https://nvd.nist.gov/vuln/detail/CVE-2021-44228"]'::jsonb),

  ('d0000000-0000-0000-0000-000000001502',
   'CVE-2023-4863', 'nvd',
   'Heap buffer overflow in libwebp',
   'Ein Heap-Pufferueberlauf in der WebP-Bibliothek erlaubt das Ausfuehren von Code beim Verarbeiten praeparierter Bilddateien. Betrifft alle Dienste, die Anhaenge oder Uploads rendern.',
   8.8, 'high',
   '["cpe:2.3:a:webmproject:libwebp:1.3.1:*:*:*:*:*:*:*"]'::jsonb,
   '2023-09-12T15:15:00Z', '2024-01-31T18:15:00Z',
   '["https://nvd.nist.gov/vuln/detail/CVE-2023-4863"]'::jsonb),

  ('d0000000-0000-0000-0000-000000001503',
   'CVE-2022-1292', 'nvd',
   'OpenSSL c_rehash script allows command injection',
   'Das Skript c_rehash verarbeitet Dateinamen ohne ausreichende Maskierung; auf Systemen, die es automatisiert ausfuehren, ist eine Befehlsinjektion moeglich.',
   9.8, 'critical',
   '["cpe:2.3:a:openssl:openssl:3.0.2:*:*:*:*:*:*:*"]'::jsonb,
   '2022-05-03T16:15:00Z', '2023-11-07T03:41:00Z',
   '["https://nvd.nist.gov/vuln/detail/CVE-2022-1292"]'::jsonb),

  ('d0000000-0000-0000-0000-000000001504',
   'CVE-2023-38545', 'nvd',
   'curl SOCKS5 heap buffer overflow',
   'Beim SOCKS5-Handshake kann curl einen zu langen Hostnamen in einen zu kleinen Puffer kopieren. Ausnutzbar ueber einen kontrollierten Proxy oder eine Weiterleitung.',
   9.8, 'critical',
   '["cpe:2.3:a:haxx:curl:8.3.0:*:*:*:*:*:*:*"]'::jsonb,
   '2023-10-11T20:15:00Z', '2024-01-25T16:15:00Z',
   '["https://nvd.nist.gov/vuln/detail/CVE-2023-38545"]'::jsonb),

  ('d0000000-0000-0000-0000-000000001505',
   'CVE-2023-44487', 'nvd',
   'HTTP/2 Rapid Reset denial of service',
   'Schnell zuruecckgenommene HTTP/2-Streams erzeugen serverseitig Last, die die Verbindungsgrenze umgeht — ein Denial-of-Service gegen exponierte Reverse-Proxies und Gateways.',
   7.5, 'high',
   '["cpe:2.3:a:nginx:nginx:1.25.2:*:*:*:*:*:*:*"]'::jsonb,
   '2023-10-10T14:15:00Z', '2024-02-15T06:23:00Z',
   '["https://nvd.nist.gov/vuln/detail/CVE-2023-44487"]'::jsonb),

  ('d0000000-0000-0000-0000-000000001506',
   'CVE-2022-42889', 'nvd',
   'Apache Commons Text insecure interpolation defaults (Text4Shell)',
   'Die Vorgabe-Interpolatoren von Commons Text werten Skript-, DNS- und URL-Ausdruecke aus. Wer Nutzereingaben interpoliert, fuehrt fremden Code aus.',
   9.8, 'critical',
   '["cpe:2.3:a:apache:commons_text:1.9:*:*:*:*:*:*:*"]'::jsonb,
   '2022-10-13T10:15:00Z', '2023-11-07T03:53:00Z',
   '["https://nvd.nist.gov/vuln/detail/CVE-2022-42889"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CPE identifiers on the demo assets — a match is derived from these
--
-- Nine technical assets (the tenth, AST-001 "IT-Abteilung", is an
-- organisational unit and carries no software) times the six products above.
-- A server that runs log4j, openssl, curl, nginx, libwebp and commons-text is
-- an ordinary server; enumerating the cross product keeps the CPE inventory
-- and the match list derivable from one another instead of hand-listed twice.
--
-- The id is derived from (asset, cpe) so it is the same on every database, and
-- the row is keyed on that pair, so re-running `db:seed:demo` converges
-- instead of duplicating.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO asset_cpe (id, asset_id, org_id, cpe_uri, vendor, product, version,
  created_by)
SELECT
  md5('acpe:' || a.id::text || ':' || c.cpe_uri)::uuid,
  a.id,
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'::uuid,
  c.cpe_uri, c.vendor, c.product, c.version,
  'b8c9d0e1-f2a3-4567-1234-89abcdef0123'::uuid
FROM (VALUES
  ('d0000000-0000-0000-0000-000000000402'::uuid),  -- ERP-System
  ('d0000000-0000-0000-0000-000000000403'::uuid),  -- CRM-System
  ('d0000000-0000-0000-0000-000000000404'::uuid),  -- Cloud-Gehaltsabrechnung
  ('d0000000-0000-0000-0000-000000000405'::uuid),  -- Applikationsserver
  ('d0000000-0000-0000-0000-000000000406'::uuid),  -- Datenbankserver
  ('d0000000-0000-0000-0000-000000000407'::uuid),  -- Firewall (Perimeter)
  ('d0000000-0000-0000-0000-000000000408'::uuid),  -- E-Mail-Gateway
  ('d0000000-0000-0000-0000-000000000409'::uuid),  -- Cloud-Speicher
  ('d0000000-0000-0000-0000-00000000040a'::uuid)   -- Backup-System
) AS a(id)
CROSS JOIN (VALUES
  ('cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*',        'apache',      'log4j',        '2.14.1'),
  ('cpe:2.3:a:apache:commons_text:1.9:*:*:*:*:*:*:*',    'apache',      'commons_text', '1.9'),
  ('cpe:2.3:a:openssl:openssl:3.0.2:*:*:*:*:*:*:*',      'openssl',     'openssl',      '3.0.2'),
  ('cpe:2.3:a:nginx:nginx:1.25.2:*:*:*:*:*:*:*',         'nginx',       'nginx',        '1.25.2'),
  ('cpe:2.3:a:webmproject:libwebp:1.3.1:*:*:*:*:*:*:*',  'webmproject', 'libwebp',      '1.3.1'),
  ('cpe:2.3:a:haxx:curl:8.3.0:*:*:*:*:*:*:*',            'haxx',        'curl',         '8.3.0')
) AS c(cpe_uri, vendor, product, version)
WHERE EXISTS (SELECT 1 FROM asset x WHERE x.id = a.id)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CVE <-> asset matches — one per (asset, CPE) pair the inventory carries
--
-- The status distribution is deliberate and reproducible:
--
--   * three named pairs carry `acknowledged`, `mitigated` and
--     `not_applicable`, so the dashboard, the status filter and the "this
--     transition is not allowed any more" branch of the state machine all have
--     something real to work on;
--   * every other pair is `new`. That is the pool the acknowledgement path
--     consumes: `i-08-cve-flow` acknowledges ONE match per run, and the only
--     legal transitions out of `new` are `acknowledged` and `not_applicable`
--     (packages/shared/src/schemas/isms-intelligence.ts) — both one-way. A
--     single seeded row would therefore make the test pass once and fail on
--     the second run of the same database, which is exactly the kind of
--     landmine this round is meant to remove.
--
-- `ON CONFLICT ... DO UPDATE` on the (cve, asset) pair: re-running
-- `db:seed:demo` restores the documented statuses rather than leaving the
-- tenant wherever the last suite run left it.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO cve_asset_match (id, cve_id, asset_id, org_id, matched_cpe, status,
  acknowledged_by, acknowledged_at, matched_at)
SELECT
  md5('cam:' || p.asset_id::text || ':' || f.id::text)::uuid,
  f.id,
  p.asset_id,
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'::uuid,
  p.cpe_uri,
  s.status,
  CASE WHEN s.status = 'new' THEN NULL
       ELSE 'b8c9d0e1-f2a3-4567-1234-89abcdef0123'::uuid END,
  CASE WHEN s.status = 'new' THEN NULL
       ELSE now() - interval '5 days' END,
  now() - interval '7 days'
FROM asset_cpe p
JOIN cve_feed_item f
  ON f.affected_cpes @> to_jsonb(ARRAY[p.cpe_uri])
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN p.asset_id = 'd0000000-0000-0000-0000-000000000407'::uuid
     AND f.cve_id = 'CVE-2023-44487' THEN 'acknowledged'
    WHEN p.asset_id = 'd0000000-0000-0000-0000-000000000408'::uuid
     AND f.cve_id = 'CVE-2023-4863'  THEN 'mitigated'
    WHEN p.asset_id = 'd0000000-0000-0000-0000-00000000040a'::uuid
     AND f.cve_id = 'CVE-2023-38545' THEN 'not_applicable'
    ELSE 'new'
  END AS status
) AS s
WHERE p.org_id = 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'
ON CONFLICT (cve_id, asset_id) DO UPDATE
  SET status          = EXCLUDED.status,
      matched_cpe     = EXCLUDED.matched_cpe,
      acknowledged_by = EXCLUDED.acknowledged_by,
      acknowledged_at = EXCLUDED.acknowledged_at,
      updated_at      = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Self-check — the point of this file is that a query returns rows.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_new integer;
  v_total integer;
  v_states integer;
BEGIN
  SELECT count(*) INTO v_total FROM cve_asset_match
   WHERE org_id = 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7';
  SELECT count(*) INTO v_new FROM cve_asset_match
   WHERE org_id = 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7' AND status = 'new';
  SELECT count(DISTINCT status) INTO v_states FROM cve_asset_match
   WHERE org_id = 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7';

  IF v_total < 40 THEN
    RAISE EXCEPTION 'seed_demo_15_cve: expected the CPE cross product to yield at least 40 matches, found % — did seed_demo_01_assets_isms.sql run?', v_total;
  END IF;
  IF v_new < 20 THEN
    RAISE EXCEPTION 'seed_demo_15_cve: only % matches left in status new; the acknowledgement path needs a pool', v_new;
  END IF;
  IF v_states < 4 THEN
    RAISE EXCEPTION 'seed_demo_15_cve: expected all four match states to be represented, found %', v_states;
  END IF;
  RAISE NOTICE 'seed_demo_15_cve: % matches (% new, % distinct states) in the demo tenant', v_total, v_new, v_states;
END $$;

COMMIT;
