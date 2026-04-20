-- Sprint 55, Migration 866: Add resource classification column

ALTER TABLE work_item ADD COLUMN IF NOT EXISTS resource_classification VARCHAR(20)
  CHECK (resource_classification IN ('critical', 'significant', 'non_critical'));
