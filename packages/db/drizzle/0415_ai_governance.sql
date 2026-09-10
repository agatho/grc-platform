-- Migration 0415: AI-Governance — Org-Richtlinie, Egress-Protokoll, Selbsteinordnung
--
-- Migration: 0415_ai_governance
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP6 · S05-01, S05-02, S05-03, S05-11, S05-12, S05-22]
--
-- ==========================================================================
-- WARUM
-- ==========================================================================
-- Der AI-Layer hatte bis hierher keine einzige mandantenbezogene
-- Stellschraube. Provider und Jurisdiktion kamen ausschliesslich aus
-- `process.env`; das vorhandene Data-Residency-Modell (`organization.
-- data_residency`, `data_residency_rule` mit `rule_type='processing'`)
-- wurde vom Router nie gelesen (S05-03). Gleichzeitig konnte ein
-- Fachnutzer den Provider pro Request frei wählen (S05-22).
--
-- Diese Migration legt drei Objekte an:
--
--  1. `ai_org_policy` — die Richtlinie je Organisation. `egress_mode` ist
--     die Hauptentscheidung; `allowed_providers` verengt zusätzlich;
--     `allow_user_provider_choice` steuert S05-22.
--
--     KEIN Datensatz je Org anzulegen ist Absicht: fehlt die Zeile,
--     leitet der Code den Modus aus `organization.data_residency` ab
--     (EU/EWR-Ländercode → `eu_only`, sonst `any_configured`). Damit wird
--     das vorhandene Residency-Modell tatsächlich wirksam, ohne dass ein
--     Bestandsmandant erst konfiguriert werden muss.
--
--  2. `ai_egress_log` — der Nachweis, welcher Prompt an welchen Provider
--     in welcher Jurisdiktion ging. `ai_prompt_log` hat dafür keine
--     Provider-Spalte (S05-11); eine Aufsichtsanfrage nach Art. 30 Abs. 1
--     lit. e DSGVO war aus den eigenen Logs nicht zu beantworten. Die
--     Tabelle protokolliert AUCH abgelehnte Aufrufe (`outcome='blocked'`)
--     — der Nachweis, dass fail-closed gegriffen hat, ist so viel wert
--     wie der Nachweis des Transfers.
--
--     Es wird bewusst KEIN Prompt-Text gespeichert, nur ein Hash
--     (`prompt_sha256`). Sonst entstünde eine zweite, unlöschbare Kopie
--     der personenbezogenen Daten, die S07 gerade abbaut.
--
--  3. `ai_feature_registry` — die Selbsteinordnung der eigenen
--     KI-Funktionen nach EU AI Act (S05-12). Bisher existierte keine;
--     ein Betreiber hätte die KI-Funktionen des Produkts, das ihm bei
--     AI-Act-Compliance helfen soll, von Hand inventarisieren müssen.
--     Die Tabelle ist global (kein `org_id`): sie beschreibt das PRODUKT,
--     nicht den Mandanten. Die mandantenbezogene Seite sind die
--     bestehenden `ai_system`/`ai_transparency_entry`-Tabellen.
--
-- Zusätzlich bekommt `ai_prompt_log` die Spalten, die für den Nachweis
-- fehlten (`provider`, `feature`, `entity_type`, `entity_id`,
-- `contains_personal_data`, `outcome`) und `prompt_template`/`model`/
-- `latency_ms` bleiben NOT NULL — die Aufrufer füllen sie jetzt
-- vollständig (der defekte INSERT der Übersetzungsroute nannte
-- `prompt_type`/`provider`, beides existierte nicht, und der `catch {}`
-- verschluckte den Fehler: KI-Übersetzungen wurden nie protokolliert).
--
-- ==========================================================================

-- ── 1. Enum für den Egress-Modus ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_egress_mode') THEN
    CREATE TYPE ai_egress_mode AS ENUM (
      'disabled',        -- KI-Funktionen für diese Org abgeschaltet
      'local_only',      -- ausschliesslich Modelle im Betreibernetz
      'eu_only',         -- nur Verarbeitung in EU/EWR bzw. Angemessenheitsländern
      'any_configured'   -- jeder vom Betreiber freigeschaltete Provider
    );
  END IF;
END $$;

-- ── 2. ai_org_policy ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_org_policy (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL UNIQUE REFERENCES organization(id),
  egress_mode                 ai_egress_mode NOT NULL DEFAULT 'eu_only',
  -- Leeres Array = keine zusätzliche Einschränkung über den Modus hinaus.
  allowed_providers           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- S05-22: der Nutzerwunsch je Request ist per Default UNZULÄSSIG.
  allow_user_provider_choice  boolean NOT NULL DEFAULT false,
  default_provider            varchar(32),
  -- Transparenzhinweis nach AI Act Art. 50 / DSGVO Art. 13 anzeigen?
  require_transparency_notice boolean NOT NULL DEFAULT true,
  notes                       text,
  created_by                  uuid REFERENCES "user"(id),
  updated_by                  uuid REFERENCES "user"(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_org_policy_allowed_providers_is_array
    CHECK (jsonb_typeof(allowed_providers) = 'array')
);

CREATE INDEX IF NOT EXISTS ai_org_policy_org_idx ON ai_org_policy (org_id);

-- ── 3. ai_egress_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_egress_log (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organization(id),
  user_id                uuid REFERENCES "user"(id),
  feature                varchar(120) NOT NULL,
  -- 'completed' | 'blocked' | 'provider_error' | 'invalid_output'
  outcome                varchar(32)  NOT NULL,
  provider               varchar(32),
  model                  varchar(120),
  -- 'local' | 'third_country'; NULL bei outcome='blocked' ohne Auswahl
  provider_placement     varchar(32),
  provider_country       varchar(8),
  provider_regions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  egress_mode            ai_egress_mode NOT NULL,
  contains_personal_data boolean NOT NULL DEFAULT false,
  -- Nur der Hash, nie der Prompt-Text (siehe Kopfkommentar).
  prompt_sha256          char(64),
  prompt_chars           integer,
  input_tokens           integer,
  output_tokens          integer,
  latency_ms             integer,
  entity_type            varchar(64),
  entity_id              uuid,
  policy_reason          text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_egress_log_org_created_idx
  ON ai_egress_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_egress_log_org_provider_idx
  ON ai_egress_log (org_id, provider);
CREATE INDEX IF NOT EXISTS ai_egress_log_org_outcome_idx
  ON ai_egress_log (org_id, outcome);

-- ── 4. ai_feature_registry (global, produktbeschreibend) ──────────────
CREATE TABLE IF NOT EXISTS ai_feature_registry (
  feature_key         varchar(120) PRIMARY KEY,
  module              varchar(40)  NOT NULL,
  title_de            varchar(300) NOT NULL,
  title_en            varchar(300) NOT NULL,
  purpose_de          text         NOT NULL,
  -- AI-Act-Rolle des Betreibers für diese Funktion.
  ai_act_role         varchar(40)  NOT NULL DEFAULT 'deployer',
  -- 'unacceptable' | 'high' | 'limited' | 'minimal'
  ai_act_risk_class   varchar(40)  NOT NULL,
  risk_class_rationale text        NOT NULL,
  -- Art. 50: Offenlegungspflicht gegenüber der betroffenen Person?
  transparency_required boolean    NOT NULL DEFAULT true,
  -- Ist ein Mensch zwingend zwischen Ausgabe und Wirkung?
  human_in_the_loop   boolean      NOT NULL DEFAULT true,
  persists_output     boolean      NOT NULL DEFAULT false,
  processes_personal_data boolean  NOT NULL DEFAULT false,
  api_path            varchar(300) NOT NULL,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

-- ── 5. ai_prompt_log: die Spalten, die für den Nachweis fehlten ───────
ALTER TABLE ai_prompt_log
  ADD COLUMN IF NOT EXISTS provider               varchar(32),
  ADD COLUMN IF NOT EXISTS feature                varchar(120),
  ADD COLUMN IF NOT EXISTS entity_type            varchar(64),
  ADD COLUMN IF NOT EXISTS entity_id              uuid,
  ADD COLUMN IF NOT EXISTS contains_personal_data boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_sha256          char(64),
  ADD COLUMN IF NOT EXISTS outcome                varchar(32) NOT NULL DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS apl_org_provider_idx
  ON ai_prompt_log (org_id, provider);

-- ── 6. RLS auf den beiden mandantenbezogenen Tabellen ─────────────────
--
-- Prädikatform exakt wie in 0397 normalisiert: NULLIF-Guard gegen den
-- leeren GUC (sonst wirft ''::uuid), kein `app.bypass_rls`-Escape (den
-- hat 0390 entfernt), ENABLE + FORCE, und je eine Policy pro Kommando
-- mit USING **und** WITH CHECK.
DO $$
DECLARE
  t text;
  pred constant text :=
    '(org_id = (NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid)';
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_org_policy', 'ai_egress_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_delete', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING %s',
      t || '_tenant_select', t, pred);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK %s',
      t || '_tenant_insert', t, pred);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING %s WITH CHECK %s',
      t || '_tenant_update', t, pred, pred);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING %s',
      t || '_tenant_delete', t, pred);
  END LOOP;
END $$;

-- `ai_feature_registry` beschreibt das Produkt, nicht einen Mandanten:
-- kein org_id, kein RLS, aber auch kein Schreibrecht für die Runtime.

-- ── 7. Grants ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_org_policy TO grc_app;
    GRANT SELECT, INSERT                 ON public.ai_egress_log TO grc_app;
    GRANT SELECT                         ON public.ai_feature_registry TO grc_app;
  END IF;
END $$;

-- ── 8. Selbsteinordnung der 23 eigenen KI-Funktionen (S05-12) ─────────
--
-- Einordnung: keine der Funktionen fällt unter Anhang III (Hochrisiko).
-- Sie erzeugen ausschliesslich VORSCHLÄGE für Fachpersonal in einem
-- Governance-Werkzeug; keine entscheidet über Zugang zu Bildung,
-- Beschäftigung, Kreditwürdigkeit, Strafverfolgung oder wesentliche
-- Dienste. Damit greift Art. 50 (Transparenz) — der Nutzer muss wissen,
-- dass er mit einer KI interagiert — und für den unbeaufsichtigten
-- Scorer zusätzlich die Protokollpflicht.
--
-- `regulatory-relevance-scorer` ist die einzige Funktion mit
-- `human_in_the_loop = false` und `persists_output = true`. Genau dieser
-- Fall ist in S05-09 als Defekt beschrieben; er ist hier als solcher
-- ausgewiesen statt versteckt.
INSERT INTO ai_feature_registry (
  feature_key, module, title_de, title_en, purpose_de,
  ai_act_risk_class, risk_class_rationale,
  transparency_required, human_in_the_loop, persists_output,
  processes_personal_data, api_path
) VALUES
 ('ai.suggest_controls','erm','Kontrollvorschläge zu einem Risiko','Control suggestions for a risk','Schlägt bestehende oder neue Kontrollen zur Minderung eines Risikos vor.','limited','Vorschlag an eine fachkundige Person; Übernahme nur über eine separate, validierte API.',true,true,false,false,'/api/v1/ai/suggest-controls'),
 ('ai.control_suggestions','ics','Kontrollvorschläge (IKS-Variante)','Control suggestions (ICS variant)','Schlägt interne Kontrollen zu einem Risiko vor.','limited','Reiner Anzeigevorschlag, keine Persistenz.',true,true,false,false,'/api/v1/ai/control-suggestions'),
 ('ai.draft_policy','dms','Richtlinienentwurf aus Anforderungen','Policy draft from requirements','Erzeugt einen Dokumentenentwurf aus Rahmenwerksanforderungen.','limited','Entwurf; das Dokument entsteht erst durch eine gesonderte Nutzeraktion.',true,true,false,false,'/api/v1/ai/draft-policy'),
 ('ai.explain_gap','isms','Erläuterung einer SoA-Lücke','SoA gap explanation','Erklärt eine Umsetzungslücke und schlägt Schritte und Nachweise vor.','limited','Beratender Text ohne Persistenz.',true,true,false,false,'/api/v1/ai/explain-gap'),
 ('ai.test_plan','ics','Testplan für eine Kontrolle','Control test plan','Entwirft einen Prüfplan für eine interne Kontrolle.','limited','Entwurf für den Prüfer.',true,true,false,false,'/api/v1/ai/test-plan'),
 ('ai.rcm_gap_analysis','erm','RCM-Lückenanalyse','RCM gap analysis','Findet Lücken zwischen Risiken und verknüpften Kontrollen.','limited','Analyseergebnis zur Anzeige.',true,true,false,false,'/api/v1/ai/rcm-gap-analysis'),
 ('ai.root_cause_patterns','audit','Ursachenmuster über Feststellungen','Root-cause patterns','Erkennt systemische Muster über Feststellungen hinweg.','limited','Analyseergebnis zur Anzeige.',true,true,false,false,'/api/v1/ai/root-cause-patterns'),
 ('audit.generate_checklist','audit','Prüfcheckliste erzeugen','Generate audit checklist','Erzeugt Prüfpunkte aus Auditumfang und Rahmenwerken.','limited','Vorschlagsliste; Übernahme durch den Auditor.',true,true,false,false,'/api/v1/audit-mgmt/audits/[id]/ai/generate-checklist'),
 ('audit.suggest_findings','audit','Feststellungen entwerfen','Draft audit findings','Entwirft Feststellungen aus nichtkonformen Prüfpunkten.','limited','Entwurf; die Feststellung entsteht durch eine gesonderte Nutzeraktion.',true,true,false,false,'/api/v1/audit-mgmt/audits/[id]/ai/suggest-findings'),
 ('tprm.classify_vendor','tprm','Lieferantenklassifizierung','Vendor classification','Schlägt Kategorie, Stufe und DORA-/LkSG-Kandidatur vor.','limited','Vorschlag; die Einstufung setzt der Lieferantenverantwortliche.',true,true,false,false,'/api/v1/tprm/vendors/[id]/ai/classify'),
 ('tprm.draft_dd_questions','tprm','Due-Diligence-Fragen entwerfen','Draft due-diligence questions','Entwirft Fragebogeninhalte für das Lieferanten-Onboarding.','limited','Entwurf.',true,true,false,false,'/api/v1/tprm/vendors/[id]/ai/draft-dd-questions'),
 ('dpms.ropa_draft_fields','dpms','ROPA-Felder entwerfen','Draft ROPA fields','Entwirft fehlende Felder eines Verarbeitungsverzeichnisses (Art. 30).','limited','Entwurf für den Datenschutzbeauftragten.',true,true,false,true,'/api/v1/dpms/ropa/[id]/ai/draft-fields'),
 ('dpms.dpia_draft_measures','dpms','DSFA-Maßnahmen entwerfen','Draft DPIA measures','Entwirft technische und organisatorische Maßnahmen zu DSFA-Risiken.','limited','Entwurf für den Datenschutzbeauftragten.',true,true,false,true,'/api/v1/dpms/dpia/[id]/ai/draft-measures'),
 ('bpm.generate_from_text','bpm','BPMN aus Freitext','BPMN from free text','Erzeugt ein BPMN-2.0-Diagramm aus einer Prozessbeschreibung.','limited','Entwurf; Speicherung erst durch den Prozessverantwortlichen.',true,true,false,false,'/api/v1/processes/ai/generate-from-text'),
 ('bpm.generate_bpmn','bpm','BPMN erzeugen (Assistent)','Generate BPMN (assistant)','Erzeugt BPMN-XML inkl. Layout aus einer Prozessbeschreibung.','limited','Entwurf.',true,true,false,false,'/api/v1/processes/generate-bpmn'),
 ('bpm.suggest_risks','bpm','Risiken zu einem Prozess','Risks for a process','Schlägt Risiken zu einem modellierten Prozess vor.','limited','Vorschlagsliste.',true,true,false,false,'/api/v1/processes/[id]/ai/suggest-risks'),
 ('bpm.suggest_controls','bpm','Kontrollen zu einem Prozess','Controls for a process','Schlägt Kontrollen zu Prozess und Risiken vor.','limited','Vorschlagsliste.',true,true,false,false,'/api/v1/processes/[id]/ai/suggest-controls'),
 ('bpm.map_frameworks','bpm','Rahmenwerks-Zuordnung','Framework mapping','Ordnet einen Prozess Rahmenwerksanforderungen zu.','limited','Vorschlagsliste.',true,true,false,false,'/api/v1/processes/[id]/ai/map-frameworks'),
 ('bpm.optimize_diagram','bpm','Diagramm-Optimierungshinweise','Diagram optimization hints','Weist auf Vereinfachungen im BPMN-Modell hin.','minimal','Rein gestalterische Hinweise ohne Rechtsfolge.',true,true,false,false,'/api/v1/processes/[id]/ai/optimize-diagram'),
 ('isms.soa_gap_analysis','isms','SoA-Lückenanalyse','SoA gap analysis','Bewertet die Abdeckung von Rahmenwerksanforderungen.','limited','Ergebnis wird als Vorschlag mit Status "pending" gespeichert und muss freigegeben werden.',true,true,true,false,'/api/v1/isms/soa/ai-gap-analysis'),
 ('isms.maturity_roadmap','isms','Reifegrad-Roadmap','Maturity roadmap','Entwirft Maßnahmen zur Anhebung des Reifegrads.','limited','Ergebnis wird als Vorschlag mit Status "proposed" gespeichert.',true,true,true,false,'/api/v1/isms/maturity/ai-roadmap'),
 ('translations.ai_translate','platform','KI-Übersetzung von GRC-Inhalten','AI translation of GRC content','Übersetzt Titel und Beschreibungen fachlicher Objekte.','limited','Übersetzung wird als Entwurf gespeichert; der Originaltext bleibt unverändert.',true,true,true,true,'/api/v1/translations/ai-translate'),
 ('copilot.chat','platform','GRC-Copilot','GRC copilot','Beantwortet Fragen zum GRC-Bestand der Organisation.','limited','Dialogfunktion nach Art. 50 offenlegungspflichtig.',true,true,true,true,'/api/v1/copilot/conversations/[id]/messages'),
 ('worker.regulatory_relevance_scorer','compliance','Relevanzbewertung regulatorischer Meldungen','Regulatory relevance scoring','Bewertet regulatorische Änderungen je Organisation.','limited','UNBEAUFSICHTIGT: läuft als Cron ohne menschliche Freigabe und persistiert das Ergebnis. Deshalb Protokollpflicht und strikte Ausgabevalidierung.',true,false,true,false,'cron:regulatory-relevance-scorer'),
 ('worker.control_embedding_sync','ics','Embedding-Synchronisierung für Kontrollen','Control embedding sync','Berechnet Vektorrepräsentationen von Kontrolltexten für die Ähnlichkeitssuche.','minimal','Keine Bewertung, keine Ausgabe an Nutzer; reine Indexierung.',false,false,true,false,'cron:control-embedding-sync')
ON CONFLICT (feature_key) DO UPDATE SET
  module                  = EXCLUDED.module,
  title_de                = EXCLUDED.title_de,
  title_en                = EXCLUDED.title_en,
  purpose_de              = EXCLUDED.purpose_de,
  ai_act_risk_class       = EXCLUDED.ai_act_risk_class,
  risk_class_rationale    = EXCLUDED.risk_class_rationale,
  transparency_required   = EXCLUDED.transparency_required,
  human_in_the_loop       = EXCLUDED.human_in_the_loop,
  persists_output         = EXCLUDED.persists_output,
  processes_personal_data = EXCLUDED.processes_personal_data,
  api_path                = EXCLUDED.api_path,
  updated_at              = now();

-- ── 9. Audit-Trigger auf der Richtlinientabelle ───────────────────────
--
-- Wer die KI-Egress-Richtlinie einer Organisation ändert, ändert die
-- Rechtsgrundlage einer Datenübermittlung. Das gehört in den Audit-Trail
-- (0405 pflegt die Trägerliste explizit, deshalb hier ausdrücklich).
DO $$
BEGIN
  IF to_regprocedure('public.audit_trigger()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS ai_org_policy_audit_trigger ON public.ai_org_policy;
    CREATE TRIGGER ai_org_policy_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.ai_org_policy
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ── 10. EAM-Funktionen (nachgezogen, gleicher Datensatz) ─────────────
INSERT INTO ai_feature_registry (
  feature_key, module, title_de, title_en, purpose_de,
  ai_act_risk_class, risk_class_rationale,
  transparency_required, human_in_the_loop, persists_output,
  processes_personal_data, api_path
) VALUES
 ('eam.generate_description','eam','Beschreibung eines Architekturelements','Architecture element description','Erzeugt einen Beschreibungsentwurf für ein Element der Unternehmensarchitektur.','minimal','Dokumentationsentwurf ohne Rechtsfolge; Übernahme durch den Architekten.',true,true,false,false,'/api/v1/eam/ai/generate-description'),
 ('eam.generate_suggestions','eam','Vorschläge für Architekturobjekte','Architecture object suggestions','Schlägt typische Architekturobjekte für eine Branche vor.','minimal','Vorschlagsliste ohne Persistenz der Objekte selbst.',true,true,false,false,'/api/v1/eam/ai/generate-suggestions'),
 ('eam.translate','eam','Feldübersetzung im EAM-Modul','EAM field translation','Übersetzt Feldtexte von Architekturobjekten.','limited','Übersetzung wird persistiert und als KI-erzeugt gekennzeichnet.',true,true,true,true,'/api/v1/eam/ai/translate')
ON CONFLICT (feature_key) DO UPDATE SET
  module                  = EXCLUDED.module,
  title_de                = EXCLUDED.title_de,
  title_en                = EXCLUDED.title_en,
  purpose_de              = EXCLUDED.purpose_de,
  ai_act_risk_class       = EXCLUDED.ai_act_risk_class,
  risk_class_rationale    = EXCLUDED.risk_class_rationale,
  transparency_required   = EXCLUDED.transparency_required,
  human_in_the_loop       = EXCLUDED.human_in_the_loop,
  persists_output         = EXCLUDED.persists_output,
  processes_personal_data = EXCLUDED.processes_personal_data,
  api_path                = EXCLUDED.api_path,
  updated_at              = now();
