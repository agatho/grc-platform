-- Sprint 29: Knowledge Graph + Impact Analysis
-- Migrations 383-386: Performance indices + weight column on entity_reference

-- 383: Composite index on entity_reference for graph traversal (source side)
CREATE INDEX IF NOT EXISTS er_graph_source_idx
  ON entity_reference (org_id, source_type, source_id);

-- 383: Composite index on entity_reference for graph traversal (target side)
CREATE INDEX IF NOT EXISTS er_graph_target_idx
  ON entity_reference (org_id, target_type, target_id);

-- 384: Add weight column to entity_reference (coupling strength 0-100, default 50)
ALTER TABLE entity_reference ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 50;

-- Add check constraint for weight range
ALTER TABLE entity_reference ADD CONSTRAINT er_weight_range CHECK (weight >= 0 AND weight <= 100);

-- 385: Seed default weights by relationship_type
UPDATE entity_reference SET weight = 90 WHERE relationship = 'mitigates';
UPDATE entity_reference SET weight = 80 WHERE relationship = 'affects';
UPDATE entity_reference SET weight = 80 WHERE relationship = 'affected';
UPDATE entity_reference SET weight = 70 WHERE relationship = 'owned_by';
UPDATE entity_reference SET weight = 60 WHERE relationship = 'tested_by';
UPDATE entity_reference SET weight = 60 WHERE relationship = 'assessed_in';
UPDATE entity_reference SET weight = 50 WHERE relationship = 'depends_on';
UPDATE entity_reference SET weight = 50 WHERE relationship = 'linked_to';
UPDATE entity_reference SET weight = 50 WHERE relationship = 'implemented_in';
UPDATE entity_reference SET weight = 50 WHERE relationship = 'bound_by';
UPDATE entity_reference SET weight = 40 WHERE relationship = 'found_in';
UPDATE entity_reference SET weight = 30 WHERE relationship = 'documented_in';

-- 386: Index on relationship for type-filtered traversals
CREATE INDEX IF NOT EXISTS er_relationship_idx
  ON entity_reference (relationship);

-- Composite index for weight-filtered queries
CREATE INDEX IF NOT EXISTS er_weight_idx
  ON entity_reference (org_id, weight DESC);
