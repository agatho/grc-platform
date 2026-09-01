-- ===========================================================================
-- [ARCTOS-FULL-2026-08-31 / WP2] Zwei-Mandanten-Seed für den RLS-Systemtest
-- ===========================================================================
--
-- Legt je eine Zeile pro Mandant in JEDEM Objekt an, das Mandantentrennung
-- leisten muss, und merkt sich die Primärschlüssel in `_wp2_seed_ids`. Der
-- Probe-Teil (tenant-isolation-systemtest.test.ts) fragt danach als Rolle
-- `grc_app` im Kontext von Org A gezielt nach den Zeilen von Org B — per ID,
-- unabhängig davon, ob das Objekt eine `org_id` trägt.
--
-- Warum ID-basiert und nicht `WHERE org_id = B`: die Lücken aus Stream S01
-- lagen gerade in den Objekten OHNE `org_id` (18 Kindtabellen, die
-- Auth-Kerntabellen). Ein org_id-basierter Test kann sie konstruktionsbedingt
-- nicht sehen — genau der Fehler, den `rls-audit.ts` vorher hatte (S01-15).
--
-- Läuft als Superuser (`session_replication_role = 'replica'` überspringt FK-
-- Prüfungen und Trigger, damit auch Tabellen mit zyklischen Abhängigkeiten
-- oder strengen Triggern befüllbar sind). Werte werden typgetrieben erzeugt.
--
-- Idempotent: `_wp2_seed_ids` wird geleert, vorhandene Zeilen der beiden
-- Test-Orgs werden von `tenant-isolation-cleanup.sql` entfernt.
-- ===========================================================================

SET session_replication_role = 'replica';
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS _wp2_seed_ids (
  tbl text NOT NULL,
  org text NOT NULL,
  id  uuid,
  PRIMARY KEY (tbl, org)
);
TRUNCATE _wp2_seed_ids;

CREATE TABLE IF NOT EXISTS _wp2_seed_errors (tbl text, org text, err text);
TRUNCATE _wp2_seed_errors;

-- ── 1. Die beiden Mandanten ────────────────────────────────────────────────
INSERT INTO organization (id, name, type, country, is_eu) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'WP2-RLS-ORG-A', 'subsidiary', 'DEU', true),
  ('bb000000-0000-4000-8000-000000000002', 'WP2-RLS-ORG-B', 'subsidiary', 'AUT', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO _wp2_seed_ids VALUES
  ('organization', 'A', 'aa000000-0000-4000-8000-000000000001'),
  ('organization', 'B', 'bb000000-0000-4000-8000-000000000002');

-- ── 2. Ein Nutzer je Mandant + echte Mitgliedschaft ────────────────────────
-- Explizit statt generisch, weil der Systemtest die Policy auf `user`
-- (Mitgliedschaft über user_organization_role, S01-04) tatsächlich prüfen
-- soll — mit einem zufälligen user_id wäre die Mitgliedschaft nicht echt.
INSERT INTO "user" (id, email, name, password_hash, is_active) VALUES
  ('aa000000-0000-4000-8000-0000000000a1', 'wp2-rls-a@example.invalid', 'WP2 A', 'x', true),
  ('bb000000-0000-4000-8000-0000000000b1', 'wp2-rls-b@example.invalid', 'WP2 B', 'x', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_organization_role (id, org_id, user_id, role) VALUES
  ('aa000000-0000-4000-8000-0000000000a2',
   'aa000000-0000-4000-8000-000000000001',
   'aa000000-0000-4000-8000-0000000000a1', 'admin'),
  ('bb000000-0000-4000-8000-0000000000b2',
   'bb000000-0000-4000-8000-000000000002',
   'bb000000-0000-4000-8000-0000000000b1', 'admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO _wp2_seed_ids VALUES
  ('user', 'A', 'aa000000-0000-4000-8000-0000000000a1'),
  ('user', 'B', 'bb000000-0000-4000-8000-0000000000b1'),
  ('user_organization_role', 'A', 'aa000000-0000-4000-8000-0000000000a2'),
  ('user_organization_role', 'B', 'bb000000-0000-4000-8000-0000000000b2');

-- ── 3. Typgetriebener Wertgenerator ────────────────────────────────────────
-- Liefert, falls die Tabelle für diese Spalte eine CHECK-Constraint der Form
-- `(col)::text = ANY (ARRAY[...])` trägt, den ersten erlaubten Wert. Ohne das
-- scheitert der Seed an Tabellen mit Wertelisten-Constraints
-- (audit_anchor.provider, automation_rule.trigger_type, …) — und eine nicht
-- befüllte Tabelle ist eine nicht geprüfte Tabelle.
CREATE OR REPLACE FUNCTION _wp2_check_literal(p_tbl text, p_col text)
RETURNS text LANGUAGE plpgsql STABLE AS $chk$
DECLARE
  def text;
  m   text[];
BEGIN
  FOR def IN
    SELECT pg_get_constraintdef(c.oid)
      FROM pg_constraint c
     WHERE c.conrelid = ('public.' || quote_ident(p_tbl))::regclass
       AND c.contype = 'c'
  LOOP
    CONTINUE WHEN position(p_col IN def) = 0;
    CONTINUE WHEN def !~ ('\(\(?"?' || p_col || '"?\)?::text = ANY');
    m := regexp_match(substr(def, position(p_col IN def)), $re$'([^']+)'$re$);
    IF m IS NOT NULL THEN RETURN m[1]; END IF;
  END LOOP;
  RETURN NULL;
END
$chk$;

-- `p_uniq` ist ein laufender, prozessweit eindeutiger Zähler. Er verhindert,
-- dass die beiden Mandantenzeilen einer Tabelle an einem UNIQUE-Index
-- kollidieren (Token-, Slug-, Nummernspalten) — ohne ihn scheiterte der Seed
-- an ~20 Tabellen, und ein nicht befülltes Objekt ist ein nicht geprüftes
-- Objekt.
CREATE OR REPLACE FUNCTION _wp2_seed_value(
  p_tbl text, p_attname text, p_ftype text, p_typtype "char",
  p_typcategory "char", p_typoid oid, p_maxlen int, p_uniq text
) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  lit text;
BEGIN
  IF p_ftype LIKE 'character varying%' OR p_ftype LIKE 'character%'
     OR p_ftype IN ('text', 'citext') THEN
    lit := _wp2_check_literal(p_tbl, p_attname);
    IF lit IS NOT NULL THEN RETURN quote_literal(lit); END IF;
  END IF;
  IF p_typcategory = 'A' THEN
    RETURN quote_literal('{}') || '::' || p_ftype;
  ELSIF p_typtype = 'e' THEN
    RETURN (SELECT quote_literal(e.enumlabel) || '::' || p_ftype
              FROM pg_enum e WHERE e.enumtypid = p_typoid
             ORDER BY e.enumsortorder LIMIT 1);
  ELSIF p_ftype = 'uuid' THEN
    RETURN 'gen_random_uuid()';
  ELSIF p_ftype LIKE 'character varying%' OR p_ftype LIKE 'character%'
     OR p_ftype IN ('text', 'citext') THEN
    IF p_maxlen > 0 THEN
      RETURN quote_literal(left('W' || p_uniq || 'WP2RLS', p_maxlen));
    END IF;
    RETURN quote_literal('W' || p_uniq || 'WP2RLS');
  ELSIF p_ftype IN ('integer', 'bigint', 'smallint', 'real', 'double precision')
     OR p_ftype LIKE 'numeric%' THEN
    RETURN '1';
  ELSIF p_ftype = 'boolean' THEN RETURN 'false';
  ELSIF p_ftype LIKE 'timestamp%' THEN RETURN 'now()';
  ELSIF p_ftype = 'date' THEN RETURN 'current_date';
  ELSIF p_ftype LIKE 'time%' THEN RETURN quote_literal('12:00:00') || '::' || p_ftype;
  ELSIF p_ftype IN ('json', 'jsonb') THEN RETURN quote_literal('{}') || '::' || p_ftype;
  ELSIF p_ftype = 'bytea' THEN RETURN quote_literal('\x00') || '::bytea';
  ELSIF p_ftype = 'inet' THEN RETURN quote_literal('127.0.0.1') || '::inet';
  ELSIF p_ftype = 'interval' THEN RETURN quote_literal('1 day') || '::interval';
  ELSE RETURN 'NULL';
  END IF;
END
$fn$;

-- ── 4. Generischer Seed ────────────────────────────────────────────────────
-- Runde 0  : alle Tabellen mit org_id.
-- Runde 1-4: Tabellen OHNE org_id, deren Fremdschlüssel auf eine bereits
--            geseedete Tabelle zeigt — so entstehen Kind- und Enkelzeilen mit
--            korrekter Abstammung je Mandant.
DO $seed$
DECLARE
  round_no int;
  t        record;
  c        record;
  o        record;
  fk_col    text;
  fk_parent text;
  cols     text;
  vals     text;
  v        text;
  stmt     text;
  new_id   uuid;
  progress boolean;
  fk_val   uuid;
  uniq_no  bigint := 1000;
BEGIN
  FOR round_no IN 0..4 LOOP
    progress := false;

    FOR t IN
      SELECT cl.relname AS tbl,
             EXISTS (SELECT 1 FROM information_schema.columns col
                      WHERE col.table_schema = 'public'
                        AND col.table_name = cl.relname
                        AND col.column_name = 'org_id') AS has_org
        FROM pg_class cl
        JOIN pg_namespace n ON n.oid = cl.relnamespace
       WHERE cl.relkind = 'r' AND n.nspname = 'public'
         AND cl.relname NOT LIKE '\_wp2%'
         AND cl.relname NOT LIKE '\_arctos%'
         AND cl.relname NOT IN ('organization', 'user', 'user_organization_role')
       ORDER BY cl.relname
    LOOP
      CONTINUE WHEN EXISTS (SELECT 1 FROM _wp2_seed_ids s WHERE s.tbl = t.tbl);
      CONTINUE WHEN (round_no = 0) <> t.has_org;

      -- Für org-lose Tabellen brauchen wir eine ABSTAMMUNG: einen
      -- Fremdschlüssel, der die Zeile eindeutig einem Mandanten zuordnet.
      -- Drei zulässige Formen — und `user` ist bewusst KEINE davon, ausser
      -- die Tabelle ist erkennbar nutzerskaliert:
      --   (a) das Ziel trägt selbst `org_id`,
      --   (b) das Ziel ist `user` UND die Tabelle hat eine Policy auf
      --       `app.current_user_id` (notification_preference),
      --   (c) das Ziel ist eine bereits geseedete Kindtabelle (Enkelkette).
      -- Ohne (b)/(c)-Einschränkung würde ein reiner Akteursverweis
      -- (`created_by`, `verified_by` → user) plattformglobale Tabellen wie
      -- `framework_mapping` oder `programme_template` fälschlich als
      -- Mandantendaten behandeln — der Probe-Teil meldete sie dann als Leck,
      -- obwohl sie bewusst global sind.
      IF NOT t.has_org THEN
        fk_col := NULL; fk_parent := NULL;
        SELECT a.attname, tgt.relname INTO fk_col, fk_parent
          FROM pg_constraint con
          JOIN pg_class src ON src.oid = con.conrelid
          JOIN pg_class tgt ON tgt.oid = con.confrelid
          JOIN pg_namespace n ON n.oid = src.relnamespace
          JOIN LATERAL unnest(con.conkey) k(attnum) ON true
          JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = k.attnum
         WHERE con.contype = 'f' AND n.nspname = 'public'
           AND src.relname = t.tbl
           AND tgt.relname <> t.tbl
           AND EXISTS (SELECT 1 FROM _wp2_seed_ids s
                        WHERE s.tbl = tgt.relname AND s.id IS NOT NULL)
           AND (
             EXISTS (SELECT 1 FROM information_schema.columns col
                      WHERE col.table_schema = 'public'
                        AND col.table_name = tgt.relname
                        AND col.column_name = 'org_id')
             OR (tgt.relname = 'user' AND EXISTS (
                   SELECT 1 FROM pg_policies p
                    WHERE p.schemaname = 'public' AND p.tablename = t.tbl
                      AND COALESCE(p.qual, '') || COALESCE(p.with_check, '')
                          LIKE '%app.current_user_id%'))
             OR EXISTS (SELECT 1 FROM _wp2_seed_ids s2
                         WHERE s2.tbl = tgt.relname
                           AND s2.tbl NOT IN ('user', 'organization'))
           )
         ORDER BY
           (NOT EXISTS (SELECT 1 FROM information_schema.columns col
                         WHERE col.table_schema = 'public'
                           AND col.table_name = tgt.relname
                           AND col.column_name = 'org_id')),
           (tgt.relname = 'user'),
           a.attname
         LIMIT 1;
        CONTINUE WHEN fk_col IS NULL;
      END IF;

      FOR o IN SELECT unnest(ARRAY['A', 'B']) AS tag LOOP
        cols := ''; vals := '';

        IF NOT t.has_org THEN
          SELECT s.id INTO fk_val FROM _wp2_seed_ids s
           WHERE s.tbl = fk_parent AND s.org = o.tag;
          CONTINUE WHEN fk_val IS NULL;
        END IF;

        FOR c IN
          SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS ftype,
                 a.atttypid, a.attnotnull, a.atthasdef,
                 tp.typtype, tp.typcategory,
                 COALESCE(information_schema._pg_char_max_length(
                            a.atttypid, a.atttypmod), 0) AS maxlen
            FROM pg_attribute a
            JOIN pg_type tp ON tp.oid = a.atttypid
           WHERE a.attrelid = ('public.' || quote_ident(t.tbl))::regclass
             AND a.attnum > 0 AND NOT a.attisdropped
           ORDER BY a.attnum
        LOOP
          IF c.attname = 'org_id' AND t.has_org THEN
            v := quote_literal((SELECT s.id FROM _wp2_seed_ids s
                                 WHERE s.tbl = 'organization' AND s.org = o.tag)::text)
                 || '::uuid';
          ELSIF NOT t.has_org AND c.attname = fk_col THEN
            v := quote_literal(fk_val::text) || '::uuid';
          ELSIF c.atthasdef OR NOT c.attnotnull THEN
            CONTINUE;
          ELSE
            uniq_no := uniq_no + 1;
            v := _wp2_seed_value(t.tbl, c.attname, c.ftype, c.typtype,
                                 c.typcategory, c.atttypid, c.maxlen,
                                 uniq_no::text);
          END IF;
          cols := cols || CASE WHEN cols = '' THEN '' ELSE ', ' END || quote_ident(c.attname);
          vals := vals || CASE WHEN vals = '' THEN '' ELSE ', ' END || v;
        END LOOP;

        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns col
                      WHERE col.table_schema = 'public' AND col.table_name = t.tbl
                        AND col.column_name = 'id' AND col.data_type = 'uuid')
          THEN
            stmt := format('INSERT INTO public.%I (%s) VALUES (%s) RETURNING id',
                           t.tbl, cols, vals);
            EXECUTE stmt INTO new_id;
          ELSE
            stmt := format('INSERT INTO public.%I (%s) VALUES (%s)', t.tbl, cols, vals);
            EXECUTE stmt;
            new_id := NULL;
          END IF;
          INSERT INTO _wp2_seed_ids VALUES (t.tbl, o.tag, new_id)
            ON CONFLICT (tbl, org) DO NOTHING;
          progress := true;
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO _wp2_seed_errors VALUES (t.tbl, o.tag, SQLERRM);
        END;
      END LOOP;
    END LOOP;

    EXIT WHEN round_no > 0 AND NOT progress;
  END LOOP;
END
$seed$;

-- Tabellen, in denen nur EINE der beiden Orgs befüllt werden konnte, taugen
-- nicht als Nachweis — der Probe-Teil verlangt beide.
DELETE FROM _wp2_seed_ids s
 WHERE NOT EXISTS (SELECT 1 FROM _wp2_seed_ids o
                    WHERE o.tbl = s.tbl AND o.org <> s.org);

SET session_replication_role = 'origin';
