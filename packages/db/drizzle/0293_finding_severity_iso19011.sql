-- ============================================================================
-- Migration 0293: finding_severity nach ISO 19011 ausrichten
--
-- Das Finding-Severity-Enum hatte die Arctos-eigenen Werte
--   significant_nonconformity / insignificant_nonconformity / improvement_requirement
-- Diese entsprechen inhaltlich der ISO 19011 Klassifikation — aber die
-- Audit-Welt (DAkkS, TÜV, Zertifizierer) benutzt die Namen
--   major_nonconformity / minor_nonconformity / opportunity_for_improvement.
--
-- Weil das checklist_result-Enum in Migration 0290 bereits auf ISO-Namen
-- umgestellt wurde, würde sonst jeder Auditor beim „Finding erstellen"
-- seine Bewertung manuell auf die alte Namens-Welt übersetzen müssen.
--
-- Strategie: NEUE Werte hinzufügen (Migration 0290 Muster), alte bleiben
-- als Synonym bestehen. UI zeigt die neuen ISO-Namen als Primärauswahl,
-- Altdaten bleiben lesbar. CES-Engine rechnet beide Paare gleich.
--
-- Idempotent via ADD VALUE IF NOT EXISTS.
-- ============================================================================

-- ISO 19011 § 3.4 + ISO/IEC 17021-1 § 9.4.8
ALTER TYPE finding_severity ADD VALUE IF NOT EXISTS 'positive';
ALTER TYPE finding_severity ADD VALUE IF NOT EXISTS 'conforming';
ALTER TYPE finding_severity ADD VALUE IF NOT EXISTS 'opportunity_for_improvement';
ALTER TYPE finding_severity ADD VALUE IF NOT EXISTS 'minor_nonconformity';
ALTER TYPE finding_severity ADD VALUE IF NOT EXISTS 'major_nonconformity';

COMMENT ON TYPE finding_severity IS
  'ISO 19011 § 3.4 Finding-Klassifikation. Neue Werte (major_/minor_nonconformity, opportunity_for_improvement) sind ISO-konform. Alte (significant_/insignificant_nonconformity, improvement_requirement) bleiben als Synonyme für Bestandsdaten erhalten.';
