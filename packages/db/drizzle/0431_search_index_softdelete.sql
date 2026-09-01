-- 0431_search_index_softdelete.sql
-- ARCTOS-FULL-2026-08-31 · WP8 · S07-25 (Low), S07-16 (Medium, DB-Anteil)
--
-- Befund S07-25: keine der vier `sync_*_search_index()`-Funktionen kennt
-- `deleted_at`. Ein Soft-Delete ist ein UPDATE und fällt deshalb in den
-- `INSERT … ON CONFLICT DO UPDATE`-Zweig — der Volltext des gelöschten
-- Datensatzes wird beim Löschen also noch AKTUALISIERT. `search_index`
-- ist damit eine Schattenkopie ohne Bereinigungspfad; sie enthält Titel
-- und Beschreibung (Freitext mit möglichem Personenbezug) von Risiken,
-- Kontrollen, Prozessen und Dokumenten, die fachlich gelöscht sind.
--
-- Fix: Soft-Delete entfernt den Indexeintrag, Reaktivierung legt ihn
-- wieder an. Zusätzlich ein einmaliger Bereinigungslauf für den Bestand.
--
-- Anmerkung zur Reichweite: `search_index` hat ausserhalb dieser Trigger
-- keinen Leser (`/api/v1/search` joint die Basistabellen und filtert dort
-- korrekt). Das Finding bleibt trotzdem berechtigt — eine Kopie ohne
-- Zweck und ohne Löschpfad ist ein Datenminimierungsdefekt, und der Tag,
-- an dem jemand die Suche auf den Index umstellt, ist der Tag, an dem sie
-- gelöschte Datensätze ausliefert.

CREATE OR REPLACE FUNCTION search_index_remove(p_entity_type text, p_entity_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM search_index WHERE entity_type = p_entity_type AND entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION sync_risk_search_index()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM search_index_remove('risk', OLD.id);
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    PERFORM search_index_remove('risk', NEW.id);
    RETURN NEW;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, owner_id, updated_at)
  VALUES (NEW.org_id, 'risk', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''),
    'erm', NEW.status, NEW.owner_id, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    owner_id = EXCLUDED.owner_id, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_control_search_index()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM search_index_remove('control', OLD.id);
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    PERFORM search_index_remove('control', NEW.id);
    RETURN NEW;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, owner_id, updated_at)
  VALUES (NEW.org_id, 'control', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''),
    'ics', NEW.status, NEW.owner_id, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    owner_id = EXCLUDED.owner_id, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_process_search_index()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM search_index_remove('process', OLD.id);
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    PERFORM search_index_remove('process', NEW.id);
    RETURN NEW;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, owner_id, updated_at)
  VALUES (NEW.org_id, 'process', NEW.id, NEW.name,
    coalesce(NEW.name,'') || ' ' || coalesce(NEW.description,''),
    'bpm', NEW.status, NEW.process_owner_id, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    owner_id = EXCLUDED.owner_id, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_document_search_index()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM search_index_remove('document', OLD.id);
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    PERFORM search_index_remove('document', NEW.id);
    RETURN NEW;
  END IF;
  INSERT INTO search_index (org_id, entity_type, entity_id, title, content, module, status, updated_at)
  VALUES (NEW.org_id, 'document', NEW.id, NEW.title,
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,''),
    'dms', NEW.status, now())
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Bestand bereinigen: alles, was im Index steht und in der Basistabelle
-- soft-gelöscht ist oder gar nicht mehr existiert.
DELETE FROM search_index si
 WHERE (si.entity_type = 'risk'     AND NOT EXISTS (SELECT 1 FROM risk     b WHERE b.id = si.entity_id AND b.deleted_at IS NULL))
    OR (si.entity_type = 'control'  AND NOT EXISTS (SELECT 1 FROM control  b WHERE b.id = si.entity_id AND b.deleted_at IS NULL))
    OR (si.entity_type = 'process'  AND NOT EXISTS (SELECT 1 FROM process  b WHERE b.id = si.entity_id AND b.deleted_at IS NULL))
    OR (si.entity_type = 'document' AND NOT EXISTS (SELECT 1 FROM document b WHERE b.id = si.entity_id AND b.deleted_at IS NULL));

-- ── S07-16: der Copilot-RAG-Index hat keinen Bereinigungspfad ────────
-- `copilot_rag_indexer` sammelt Titel und Beschreibung ein, filtert
-- `deleted_at` nicht und benutzt `onConflictDoNothing()` — ein einmal
-- indizierter Datensatz wird nie aktualisiert und nie entfernt. Der
-- TypeScript-Anteil des Fixes liegt im Cron (WP8-Datei); hier steht der
-- Bereinigungspfad, den der Cron aufruft und den es vorher nicht gab.

CREATE OR REPLACE FUNCTION copilot_rag_prune(p_org_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n     integer;
  total integer := 0;
  t     text;
BEGIN
  -- Über die Quelltabellen des Indexers. `to_regclass` prüft die
  -- Existenz, damit eine Installation ohne das jeweilige Modul nicht am
  -- Bereinigungslauf scheitert (der Indexer würde sie dann gar nicht
  -- befüllen, der Prune aber trotzdem darauf verweisen).
  FOREACH t IN ARRAY ARRAY['risk', 'control', 'process', 'document', 'policy']
  LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'DELETE FROM copilot_rag_source s
        WHERE ($1 IS NULL OR s.org_id = $1)
          AND s.source_type = $2
          AND NOT EXISTS (SELECT 1 FROM public.%I b
                           WHERE b.id = s.entity_id AND b.deleted_at IS NULL)',
      t)
    USING p_org_id, t;
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
  END LOOP;

  RETURN total;
END;
$$;

COMMENT ON FUNCTION copilot_rag_prune(uuid) IS
  'S07-16: entfernt Einträge aus copilot_rag_source, deren Quelle soft-gelöscht oder verschwunden ist. Vorher gab es keinen Pfad, der diese Sekundärkopie je bereinigt hätte.';

-- ── Nebenbefund aus der Umsetzung von S07-16 ─────────────────────────
-- `copilot_rag_indexer` schreibt mit `onConflictDoNothing()`. Auf
-- `copilot_rag_source` gibt es aber überhaupt keinen Unique-Constraint
-- ausser dem Primärschlüssel — die Konfliktbehandlung konnte also nie
-- greifen, und jeder Sechs-Stunden-Lauf legte für JEDES Risiko eine
-- weitere Zeile mit Titel und Beschreibung an. Der Bestand wuchs
-- unbegrenzt, ohne dass irgendetwas ihn je bereinigt hätte. Erst dieser
-- Index macht die Konfliktbehandlung (und das Upsert im Cron) wirksam.
DELETE FROM copilot_rag_source a
 USING copilot_rag_source b
 WHERE a.ctid < b.ctid
   AND a.org_id = b.org_id
   AND a.source_type = b.source_type
   AND a.entity_id IS NOT DISTINCT FROM b.entity_id
   AND a.chunk_index = b.chunk_index;

CREATE UNIQUE INDEX IF NOT EXISTS crs_unique_source
  ON copilot_rag_source (org_id, source_type, entity_id, chunk_index);
