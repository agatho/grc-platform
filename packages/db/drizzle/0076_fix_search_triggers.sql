-- Migration 0076: Fix search index triggers referencing wrong column names
-- document: NEW.description -> NEW.content (document has 'content', not 'description')
-- process:  NEW.title -> NEW.name, NEW.owner_id -> NEW.process_owner_id

CREATE OR REPLACE FUNCTION sync_document_search_index() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_index WHERE entity_type = 'document' AND entity_id = OLD.id;
    RETURN OLD;
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION sync_process_search_index() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_index WHERE entity_type = 'process' AND entity_id = OLD.id;
    RETURN OLD;
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
$$ LANGUAGE plpgsql;
