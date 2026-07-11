-- ============================================================================
-- Migration 0377: control_embedding — pgvector-Embeddings für suggest-controls
--
-- Bestand-Befund (2026-07-11): Die einzige bisherige "Embedding"-Spalte ist
-- copilot_rag_source.embedding (JSONB, Migration 0189) — sie wurde nie
-- befüllt, es gibt keinen Vektor-Index und keinen Embedding-Provider-Call im
-- Code. Diese Tabelle ist damit die ERSTE echte pgvector-Nutzung der
-- Plattform; ein bestehendes vector()-Muster zum Kopieren existierte nicht.
--
-- ⚠ pgvector-Guard: Entgegen der Doku ist die vector-Extension auf der
-- Dev-DB NICHT verfügbar (pg_available_extensions enthält 'vector' nicht —
-- die Server-Binaries fehlen, verifiziert 2026-07-11). Diese Migration ist
-- deshalb vollständig hinter einem Availability-Check gekapselt: ohne
-- pgvector ist sie ein No-Op mit NOTICE. migrate-all.ts führt alle Files
-- bei jedem Lauf idempotent aus — sobald pgvector installiert ist, legt der
-- nächste Migrationslauf die Tabelle an (self-healing). Route und Cron
-- behandeln die fehlende Tabelle defensiv (Fallback Token-Overlap / Skip).
--
--   - Dimension 1536 (OpenAI text-embedding-3-small). Kleinere Modelle
--     (Ollama nomic-embed-text = 768) werden von @grc/ai generateEmbedding
--     zero-gepadded — Cosine-Ähnlichkeit innerhalb desselben Modells bleibt
--     dadurch unverändert; verglichen wird nur innerhalb desselben
--     model-Werts (Queries filtern darauf).
--   - content_hash = SHA-256 über coalesce(title,'')||E'\n'||coalesce(
--     description,'') — Invalidierung bei Textänderung. JS-Zwilling:
--     @grc/shared controlEmbeddingContentHash (MUSS synchron bleiben).
--   - Befüllung ausschließlich durch den Worker-Cron control-embedding-sync
--     (Batch max. 50/Lauf).
--   - Index: HNSW statt ivfflat — ivfflat braucht repräsentative Daten beim
--     Indexaufbau (Listen-Zentroide) und Reindexing bei Wachstum; HNSW ist
--     auf einer leeren, wachsenden Tabelle die robustere Wahl.
--   - RLS: ENABLE + FORCE + Policy (USING + WITH CHECK) — Muster 0360/0375.
--   - Audit-Trigger: copilot_rag_source HAT einen (0189). Embeddings sind
--     derived data, wir folgen aber Bestand + Regel 5 ("Audit Everything");
--     die Schreiblast ist durch Batch-Limit + Hash-Invalidierung begrenzt.
--
-- Idempotent: IF NOT EXISTS / Exception-Guards überall.
-- ============================================================================

-- ============================================================
-- 1) Extension + Tabelle + Indizes (guarded: pgvector verfügbar?)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    RAISE NOTICE '[0377] pgvector nicht verfuegbar (Server-Binaries fehlen) - control_embedding wird uebersprungen. Nach Installation von pgvector legt der naechste Migrationslauf die Tabelle an.';
    RETURN;
  END IF;

  EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';

  EXECUTE '
    CREATE TABLE IF NOT EXISTS control_embedding (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organization(id),
      control_id UUID NOT NULL REFERENCES control(id) ON DELETE CASCADE,
      embedding vector(1536) NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      model VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )';

  EXECUTE 'COMMENT ON TABLE control_embedding IS '
    || quote_literal('Derived data: pgvector-Embeddings der Kontrollen (title+description) für die semantische Kandidaten-Auswahl in POST /api/v1/ai/suggest-controls. Befüllt durch Worker-Cron control-embedding-sync.');
  EXECUTE 'COMMENT ON COLUMN control_embedding.content_hash IS '
    || quote_literal('SHA-256 über coalesce(title,'''')||E''\n''||coalesce(description,'''') — Invalidierungs-Anker (JS-Zwilling: @grc/shared controlEmbeddingContentHash).');
  EXECUTE 'COMMENT ON COLUMN control_embedding.model IS '
    || quote_literal('Embedding-Modell des Vektors. Similarity-Queries filtern darauf — Vektoren verschiedener Modelle sind nicht vergleichbar.');

  -- Ein Embedding pro Kontrolle — der Sync-Cron upsertet darauf.
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ctrl_emb_control_uniq
             ON control_embedding(control_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS ctrl_emb_org_model_idx
             ON control_embedding(org_id, model)';
  -- HNSW-Cosine-Index für den <=>-Operator (siehe Header: HNSW statt ivfflat).
  EXECUTE 'CREATE INDEX IF NOT EXISTS ctrl_emb_hnsw_cosine_idx
             ON control_embedding USING hnsw (embedding vector_cosine_ops)';
END $$;

-- ============================================================
-- 2) RLS: ENABLE + FORCE + Policy (USING + WITH CHECK) — Muster 0360/0375
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.control_embedding') IS NULL THEN
    RAISE NOTICE '[0377] control_embedding fehlt (pgvector-Guard) - RLS uebersprungen';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE control_embedding ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE control_embedding FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_control_embedding ON control_embedding';
  EXECUTE 'CREATE POLICY rls_control_embedding ON control_embedding ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'control_embedding RLS/policy: %', SQLERRM;
END $$;

-- ============================================================
-- 3) Audit-Trigger — Guard-Muster 0357/0360 (idempotent)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    RAISE NOTICE '[0377] audit_trigger() fehlt - Block uebersprungen';
    RETURN;
  END IF;
  IF to_regclass('public.control_embedding') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_proc pr ON pr.oid = tg.tgfoid
    WHERE tg.tgrelid = to_regclass('public.control_embedding')
      AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal
  ) THEN
    CREATE TRIGGER control_embedding_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON control_embedding
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
