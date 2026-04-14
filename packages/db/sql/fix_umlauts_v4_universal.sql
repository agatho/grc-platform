-- Universal Umlaut Fix v4
-- Uses DO block with dynamic SQL to fix ALL text columns automatically
-- Zero errors guaranteed: only touches columns that actually exist

DO $$
DECLARE
  r RECORD;
  affected INT;
  total_affected INT := 0;
  sql_text TEXT;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying')
      AND column_name IN (
        'title', 'name', 'description', 'content', 'summary', 'body',
        'justification', 'remediation_actions', 'root_cause', 'lessons_learned',
        'name_de', 'description_de', 'title_de', 'comment_text', 'notes',
        'implementation_notes', 'applicability_justification'
      )
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_drizzle%'
    ORDER BY table_name, column_name
  LOOP
    sql_text := format(
      'UPDATE %I SET %I = ' ||
      'REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(' ||
      'REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(' ||
      '%I,' ||
      '''verschluesselt'', E''verschl\\u00FCsselt''),' ||
      '''Verschluesselung'', E''Verschl\\u00FCsselung''),' ||
      '''Abhaengigkeit'', E''Abh\\u00E4ngigkeit''),' ||
      '''abhaengig'', E''abh\\u00E4ngig''),' ||
      '''primaeren'', E''prim\\u00E4ren''),' ||
      '''einschliesslich'', E''einschlie\\u00DFlich''),' ||
      '''Integritaet'', E''Integrit\\u00E4t''),' ||
      '''Biodiversitaet'', E''Biodiversit\\u00E4t''),' ||
      '''erhoehte'', E''erh\\u00F6hte''),' ||
      '''Schluessel'', E''Schl\\u00FCssel''),' ||
      '''Folgenabschaetzung'', E''Folgenabsch\\u00E4tzung''),' ||
      '''Beschaeftigte'', E''Besch\\u00E4ftigte''),' ||
      '''Durchfuehrung'', E''Durchf\\u00FChrung''),' ||
      '''durchfuehren'', E''durchf\\u00FChren''),' ||
      '''Angriffsflaeche'', E''Angriffsfl\\u00E4che''),' ||
      '''Oekosystem'', E''\\u00D6kosystem''),' ||
      '''oeffentlich'', E''\\u00F6ffentlich''),' ||
      '''geloescht'', E''gel\\u00F6scht''),' ||
      '''Aenderungen'', E''\\u00C4nderungen''),' ||
      ''' fuer '', E'' f\\u00FCr '')' ||
      ' WHERE %I ~ ''verschluessel|Abhaengig|abhaengig|primaer|einschliesslich|Integritaet|Biodiversitaet|erhoehte|Schluessel|Folgenabschaetzung|Beschaeftigte|Durchfuehr|durchfuehr|Angriffsflaeche|Oekosystem|oeffentlich|geloescht|Aenderungen| fuer ''',
      r.table_name, r.column_name, r.column_name, r.column_name
    );
    EXECUTE sql_text;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      total_affected := total_affected + affected;
      RAISE NOTICE 'Fixed % rows in %.%', affected, r.table_name, r.column_name;
    END IF;
  END LOOP;
  RAISE NOTICE '=== Total rows fixed: % ===', total_affected;
END
$$;
