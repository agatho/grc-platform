-- Sprint 47: BPM Advanced — Process Mining, KPIs, Maturity,
-- Value Stream Mapping, Template Library
-- Migrations 706–728

-- ═══════════════════════════════════════════════════════════
-- process_event_log — Imported event log metadata
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_event_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  process_id      UUID REFERENCES process(id),
  import_name     VARCHAR(500) NOT NULL,
  format_source   VARCHAR(10) NOT NULL,
  event_count     INTEGER,
  case_count      INTEGER,
  activity_count  INTEGER,
  date_range_start DATE,
  date_range_end  DATE,
  imported_by     UUID REFERENCES "user"(id),
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          VARCHAR(20) NOT NULL DEFAULT 'importing',
  error_message   TEXT
);
CREATE INDEX IF NOT EXISTS pel_org_idx ON process_event_log(org_id);
CREATE INDEX IF NOT EXISTS pel_process_idx ON process_event_log(process_id);

-- ═══════════════════════════════════════════════════════════
-- process_event — Individual events (HIGH-VOLUME table)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_log_id    UUID NOT NULL REFERENCES process_event_log(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  case_id         VARCHAR(200) NOT NULL,
  activity        VARCHAR(500) NOT NULL,
  "timestamp"     TIMESTAMPTZ NOT NULL,
  resource        VARCHAR(200),
  additional_data JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS pe_log_idx ON process_event(event_log_id);
CREATE INDEX IF NOT EXISTS pe_case_idx ON process_event(event_log_id, case_id);
CREATE INDEX IF NOT EXISTS pe_activity_idx ON process_event(event_log_id, activity);
CREATE INDEX IF NOT EXISTS pe_timestamp_idx ON process_event(event_log_id, "timestamp");

-- ═══════════════════════════════════════════════════════════
-- process_conformance_result
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_conformance_result (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_log_id      UUID NOT NULL REFERENCES process_event_log(id),
  org_id            UUID NOT NULL,
  process_id        UUID REFERENCES process(id),
  conformance_score NUMERIC(5,2),
  total_traces      INTEGER,
  conformant_traces INTEGER,
  fitness_gaps      JSONB DEFAULT '[]',
  precision_issues  JSONB DEFAULT '[]',
  rework_loops      JSONB DEFAULT '[]',
  bottlenecks       JSONB DEFAULT '[]',
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pcr_event_log_idx ON process_conformance_result(event_log_id);
CREATE INDEX IF NOT EXISTS pcr_process_idx ON process_conformance_result(process_id);

-- ═══════════════════════════════════════════════════════════
-- process_mining_suggestion
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_mining_suggestion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conformance_result_id  UUID NOT NULL REFERENCES process_conformance_result(id),
  org_id                 UUID NOT NULL,
  suggestion_type        VARCHAR(30) NOT NULL,
  description            TEXT NOT NULL,
  evidence_frequency     NUMERIC(10,2),
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS pms_result_idx ON process_mining_suggestion(conformance_result_id);

-- ═══════════════════════════════════════════════════════════
-- process_kpi_definition
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_kpi_definition (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organization(id),
  process_id         UUID NOT NULL REFERENCES process(id),
  name               VARCHAR(500) NOT NULL,
  metric_type        VARCHAR(30) NOT NULL,
  unit               VARCHAR(50) NOT NULL,
  target_value       NUMERIC(15,4) NOT NULL,
  threshold_green    NUMERIC(15,4) NOT NULL,
  threshold_yellow   NUMERIC(15,4) NOT NULL,
  measurement_period VARCHAR(20) NOT NULL,
  data_source        VARCHAR(20) NOT NULL,
  api_config         JSONB,
  owner_id           UUID REFERENCES "user"(id),
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pkd_process_idx ON process_kpi_definition(process_id);
CREATE INDEX IF NOT EXISTS pkd_org_idx ON process_kpi_definition(org_id);

-- ═══════════════════════════════════════════════════════════
-- process_kpi_measurement
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_kpi_measurement (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_definition_id  UUID NOT NULL REFERENCES process_kpi_definition(id),
  org_id             UUID NOT NULL,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  actual_value       NUMERIC(15,4) NOT NULL,
  target_value       NUMERIC(15,4) NOT NULL,
  status             VARCHAR(10) NOT NULL,
  data_source_detail TEXT,
  measured_by        UUID REFERENCES "user"(id),
  measured_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pkm_kpi_idx ON process_kpi_measurement(kpi_definition_id, period_start);

-- ═══════════════════════════════════════════════════════════
-- process_maturity_assessment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_maturity_assessment (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  process_id       UUID NOT NULL REFERENCES process(id),
  assessment_date  DATE NOT NULL,
  overall_level    INTEGER NOT NULL,
  dimension_scores JSONB NOT NULL,
  target_level     INTEGER,
  gap_actions      JSONB DEFAULT '[]',
  assessor_id      UUID REFERENCES "user"(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pma_org_idx ON process_maturity_assessment(org_id);
CREATE INDEX IF NOT EXISTS pma_process_idx ON process_maturity_assessment(process_id);

-- ═══════════════════════════════════════════════════════════
-- process_maturity_questionnaire — Shared template (NOT org-scoped)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_maturity_questionnaire (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension       VARCHAR(30) NOT NULL,
  question_number INTEGER NOT NULL,
  question_text   JSONB NOT NULL,
  level_mapping   INTEGER NOT NULL,
  weight          INTEGER NOT NULL DEFAULT 1
);

-- ═══════════════════════════════════════════════════════════
-- value_stream_map
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS value_stream_map (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organization(id),
  process_id               UUID NOT NULL REFERENCES process(id),
  map_type                 VARCHAR(20) NOT NULL,
  title                    VARCHAR(500) NOT NULL,
  diagram_data             JSONB NOT NULL,
  total_lead_time_minutes  NUMERIC(15,2),
  total_value_add_minutes  NUMERIC(15,2),
  value_add_ratio          NUMERIC(5,2),
  waste_analysis           JSONB DEFAULT '[]',
  version                  INTEGER NOT NULL DEFAULT 1,
  status                   VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by               UUID REFERENCES "user"(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vsm_org_idx ON value_stream_map(org_id);
CREATE INDEX IF NOT EXISTS vsm_process_idx ON value_stream_map(process_id);

-- ═══════════════════════════════════════════════════════════
-- process_template — Pre-built BPMN templates (NOT org-scoped)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS process_template (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain           VARCHAR(30) NOT NULL,
  name             JSONB NOT NULL,
  description      JSONB,
  bpmn_xml         TEXT NOT NULL,
  typical_kpis     JSONB DEFAULT '[]',
  typical_risks    JSONB DEFAULT '[]',
  typical_controls JSONB DEFAULT '[]',
  required_roles   TEXT[] DEFAULT '{}',
  complexity       VARCHAR(20) NOT NULL DEFAULT 'moderate',
  is_published     BOOLEAN NOT NULL DEFAULT true
);

-- ═══════════════════════════════════════════════════════════
-- RLS Policies (org-scoped tables only; not questionnaire/templates)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE process_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_event_log_org ON process_event_log USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE process_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_event_org ON process_event USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE process_conformance_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_conformance_result_org ON process_conformance_result USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE process_mining_suggestion ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_mining_suggestion_org ON process_mining_suggestion USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE process_kpi_definition ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_kpi_definition_org ON process_kpi_definition USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE process_kpi_measurement ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_kpi_measurement_org ON process_kpi_measurement USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE process_maturity_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_maturity_assessment_org ON process_maturity_assessment USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE value_stream_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY value_stream_map_org ON value_stream_map USING (org_id = current_setting('app.current_org_id')::uuid);

-- ═══════════════════════════════════════════════════════════
-- Audit triggers
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER process_event_log_audit AFTER INSERT OR UPDATE ON process_event_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER process_conformance_result_audit AFTER INSERT ON process_conformance_result FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER process_mining_suggestion_audit AFTER INSERT OR UPDATE ON process_mining_suggestion FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER process_kpi_definition_audit AFTER INSERT OR UPDATE OR DELETE ON process_kpi_definition FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER process_kpi_measurement_audit AFTER INSERT ON process_kpi_measurement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER process_maturity_assessment_audit AFTER INSERT ON process_maturity_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER value_stream_map_audit AFTER INSERT OR UPDATE OR DELETE ON value_stream_map FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ═══════════════════════════════════════════════════════════
-- Seed: 30 maturity questionnaire items (5 dimensions x 6)
-- ═══════════════════════════════════════════════════════════
INSERT INTO process_maturity_questionnaire (dimension, question_number, question_text, level_mapping, weight) VALUES
('documentation', 1, '{"en": "Is the process documented in a standard format (e.g., BPMN)?", "de": "Ist der Prozess in einem Standardformat (z.B. BPMN) dokumentiert?"}', 2, 2),
('documentation', 2, '{"en": "Are process roles and responsibilities clearly defined?", "de": "Sind Prozessrollen und Verantwortlichkeiten klar definiert?"}', 2, 2),
('documentation', 3, '{"en": "Is there a formal process owner with defined authority?", "de": "Gibt es einen formalen Prozessverantwortlichen mit definierter Befugnis?"}', 3, 2),
('documentation', 4, '{"en": "Are process variants and exceptions documented?", "de": "Sind Prozessvarianten und Ausnahmen dokumentiert?"}', 3, 1),
('documentation', 5, '{"en": "Is the documentation reviewed and updated regularly?", "de": "Wird die Dokumentation regelmässig überprüft und aktualisiert?"}', 4, 2),
('documentation', 6, '{"en": "Is process documentation version-controlled with change history?", "de": "Ist die Prozessdokumentation versioniert mit Änderungshistorie?"}', 4, 1),
('adherence', 1, '{"en": "Do all participants follow the documented process?", "de": "Befolgen alle Beteiligten den dokumentierten Prozess?"}', 2, 2),
('adherence', 2, '{"en": "Is there a mechanism to detect process deviations?", "de": "Gibt es einen Mechanismus zur Erkennung von Prozessabweichungen?"}', 3, 2),
('adherence', 3, '{"en": "Are process controls in place to prevent unauthorized deviations?", "de": "Sind Prozesskontrollen vorhanden, um unautorisierte Abweichungen zu verhindern?"}', 3, 2),
('adherence', 4, '{"en": "Is conformance regularly measured (e.g., via process mining)?", "de": "Wird die Konformität regelmässig gemessen (z.B. via Process Mining)?"}', 4, 2),
('adherence', 5, '{"en": "Are deviations systematically analyzed for root causes?", "de": "Werden Abweichungen systematisch auf Ursachen analysiert?"}', 4, 1),
('adherence', 6, '{"en": "Is the conformance rate above 90% based on measured data?", "de": "Liegt die Konformitätsrate basierend auf Messdaten über 90%?"}', 5, 2),
('measurement', 1, '{"en": "Are basic process metrics defined (e.g., cycle time, throughput)?", "de": "Sind grundlegende Prozesskennzahlen definiert (z.B. Durchlaufzeit, Durchsatz)?"}', 2, 2),
('measurement', 2, '{"en": "Are metrics collected regularly and systematically?", "de": "Werden Kennzahlen regelmässig und systematisch erhoben?"}', 3, 2),
('measurement', 3, '{"en": "Are KPI targets defined with green/yellow/red thresholds?", "de": "Sind KPI-Ziele mit Grün/Gelb/Rot-Schwellenwerten definiert?"}', 3, 2),
('measurement', 4, '{"en": "Are metrics used for decision-making by process owners?", "de": "Werden Kennzahlen von Prozessverantwortlichen zur Entscheidungsfindung genutzt?"}', 4, 2),
('measurement', 5, '{"en": "Is statistical process control applied to key metrics?", "de": "Wird statistische Prozesskontrolle auf Schlüsselkennzahlen angewendet?"}', 5, 1),
('measurement', 6, '{"en": "Are predictive analytics used for process forecasting?", "de": "Werden prädiktive Analysen für Prozessprognosen eingesetzt?"}', 5, 1),
('improvement', 1, '{"en": "Is there a defined process for handling improvement suggestions?", "de": "Gibt es einen definierten Prozess für den Umgang mit Verbesserungsvorschlägen?"}', 2, 2),
('improvement', 2, '{"en": "Are process improvements implemented based on data analysis?", "de": "Werden Prozessverbesserungen auf Basis von Datenanalysen umgesetzt?"}', 3, 2),
('improvement', 3, '{"en": "Is there a continuous improvement cycle (PDCA) in place?", "de": "Ist ein kontinuierlicher Verbesserungszyklus (PDCA) etabliert?"}', 4, 2),
('improvement', 4, '{"en": "Are improvement results measured and verified?", "de": "Werden Verbesserungsergebnisse gemessen und verifiziert?"}', 4, 2),
('improvement', 5, '{"en": "Is innovation actively encouraged in process design?", "de": "Wird Innovation im Prozessdesign aktiv gefördert?"}', 5, 1),
('improvement', 6, '{"en": "Are best practices shared across the organization?", "de": "Werden Best Practices organisationsweit geteilt?"}', 5, 1),
('satisfaction', 1, '{"en": "Is process stakeholder feedback collected regularly?", "de": "Wird regelmässig Feedback von Prozess-Stakeholdern eingeholt?"}', 2, 2),
('satisfaction', 2, '{"en": "Are internal customer satisfaction surveys conducted?", "de": "Werden interne Kundenzufriedenheitsumfragen durchgeführt?"}', 3, 1),
('satisfaction', 3, '{"en": "Is stakeholder feedback used to drive process changes?", "de": "Wird Stakeholder-Feedback genutzt, um Prozessänderungen voranzutreiben?"}', 3, 2),
('satisfaction', 4, '{"en": "Is end-to-end process satisfaction measured (not just steps)?", "de": "Wird die End-to-End-Prozesszufriedenheit gemessen (nicht nur einzelne Schritte)?"}', 4, 2),
('satisfaction', 5, '{"en": "Is satisfaction trending positively over the last 4 periods?", "de": "Zeigt die Zufriedenheit in den letzten 4 Perioden einen positiven Trend?"}', 4, 1),
('satisfaction', 6, '{"en": "Are satisfaction targets consistently met or exceeded?", "de": "Werden Zufriedenheitsziele regelmässig erreicht oder übertroffen?"}', 5, 2);
