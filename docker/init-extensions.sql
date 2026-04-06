-- PostgreSQL extensions required by ARCTOS
-- Automatically executed on first docker compose up

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TimescaleDB is included in the timescale/timescaledb image
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- pgvector for AI embeddings (optional — uncomment if using local embeddings)
-- CREATE EXTENSION IF NOT EXISTS vector;
