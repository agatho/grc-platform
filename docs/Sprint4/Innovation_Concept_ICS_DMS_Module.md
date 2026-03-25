# ARCTOS — Innovation Concept: ICS + DMS Module

Sprint 4 and Beyond — Differentiating the Internal Control System and Document Management Platform

---

## Executive Summary

ARCTOS competes in a market where ICS modules are typically afterthoughts bolted onto risk registers (a GRC competitor, a GRC competitor) or isolated SOX compliance tools (a GRC competitor, a SOX compliance suite). Only competing BPM suite offers a genuinely integrated ICS with separate Test-of-Design/Test-of-Effectiveness flows, finding taxonomies, and a visual Risk-Control Matrix. Document management in GRC is universally weak — most platforms offer nothing beyond file upload fields. a QM/process suite is the only competitor with a true document lifecycle, but it lacks GRC depth. This document defines six innovation areas that make ARCTOS's ICS+DMS modules the most capable in the mid-market GRC segment.

**Target audience:** CISO, Internal Audit Lead, Compliance Manager, DPO of multi-entity corporations (ISO 27001, NIS2, BSI IT-Grundschutz, HGB/SOX in scope).
**Competitive benchmark:** Surpass competing BPM suite on AI-powered control testing, surpass dedicated QM tools on document-GRC integration, surpass a GRC competitor on RCM intelligence and finding remediation analytics.

---

# 1. AI-Assisted Control Design & Gap Analysis (Claude API Integration)

## 1.1 Vision

Designing effective internal controls requires deep knowledge of frameworks (ISO 27002:2022 — 93 controls, NIST CSF 2.0 — 106 subcategories, BSI IT-Grundschutz — 100+ building blocks) and their applicability to specific risks. Today, this mapping is manual and error-prone: control owners spend hours cross-referencing spreadsheets. ARCTOS's AI Copilot automates control design suggestions, gap analysis, and control objective writing.

## 1.2 Feature: AI Control Suggestions per Risk

**When:** User opens the RCM tab on a risk detail page and clicks "Kontrollen vorschlagen".

**What the AI does:**
1. Reads the risk title, category, score, linked framework requirements (from `risk_framework_mapping`).
2. Reads the org's active frameworks from `module_config` and `framework` tables.
3. Calls Claude API with prompt: "Based on risk '[Title]' (Category: [X], Score: [Y]/25), active frameworks [ISO 27001, NIS2], and already linked controls [list], suggest 5 new controls that would effectively mitigate this risk."
4. Returns structured suggestions as clickable cards with pre-filled control fields.

**Suggestion card format:**
```
┌──────────────────────────────────────────────┐
│  🤖 AI-Vorschlag                              │
│  Multi-Factor Authentication Enforcement      │
│  Typ: Preventiv | Frequenz: Continuous        │
│  Automation: Semi-automated                   │
│  Framework-Ref: ISO 27002 A.8.5, NIS2 Art.21 │
│  Begründung: MFA reduziert Phishing-Erfolgs-  │
│  rate um 99%. Direkte Mitigierung des         │
│  identifizierten Credential-Theft-Risikos.    │
│  [+ Kontrolle erstellen]  [Ignorieren]        │
└──────────────────────────────────────────────┘
```

**Implementation:**
- `apps/web/src/app/api/v1/controls/ai-suggestions/route.ts`
- Calls `packages/ai/src/control-suggestions.ts` which uses Claude client
- Results cached per org + risk_id + date (Redis, TTL 24h)
- Role restriction: `risk_manager`, `control_owner`, `admin` only

## 1.3 Feature: AI-Powered RCM Gap Detection

**When:** Risk_manager opens the RCM matrix page.

**What:** System analyzes the current RCM for coverage gaps:
1. Risks with 0 controls → "Unbehandeltes Risiko" flag
2. Risks with only one control type (e.g., only detective) → "Kontroll-Typ-Lücke" flag
3. High-score risks (≥15) with only partial effectiveness → "Unzureichende Abdeckung" flag
4. Controls not linked to any risk → "Verwaiste Kontrolle" flag

**AI Enhancement:** Claude analyzes the gap list and generates prioritized recommendations:
```
🔍 RCM Gap-Analyse (AI-gestützt)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 kritische Lücken erkannt:

1. ⚠️ Risiko "Ransomware-Angriff" (Score 20) hat nur 1 detektive Kontrolle.
   → Empfehlung: Ergänze präventive Kontrollen (Netzwerk-Segmentierung, Backup-Verifizierung).

2. ⚠️ 5 Risiken in Kategorie "Compliance" haben 0 Kontrollen.
   → Empfehlung: NIS2 Art. 21 schreibt technische Maßnahmen vor. Erstelle Basis-Kontrollen.

3. ℹ️ Kontrolle "Quartalsbericht an Vorstand" ist keinem Risiko zugeordnet.
   → Empfehlung: Verknüpfe mit Risiko "Unzureichende Governance" oder archiviere.
```

**Implementation:**
- `packages/ai/src/rcm-gap-analysis.ts` — aggregation query + Claude interpretation
- Runs on-demand (button click) or scheduled weekly as worker job
- Gap results stored in cache, refreshed on RCM changes

## 1.4 Feature: AI Control Test Plan Generator

**When:** Risk_manager creates a new test campaign and clicks "Testplan generieren".

**What:** Claude generates a test plan per control including:
1. Test objective (what to verify)
2. Test procedure (step-by-step instructions for the tester)
3. Expected evidence (what documents/screenshots to collect)
4. Risk areas to focus on (based on linked risks)

**Prompt template:**
```typescript
export function buildTestPlanPrompt(control: Control, linkedRisks: Risk[]) {
  return `You are an internal audit expert. Generate a test plan for this control:
Title: ${control.title}
Type: ${control.controlType}
Frequency: ${control.frequency}
Automation Level: ${control.automationLevel}
Linked Risks: ${linkedRisks.map(r => `${r.title} (Score: ${r.riskScoreInherent})`).join(', ')}

Provide a JSON response with:
1. testObjective: string (2-3 sentences in German — what must be verified)
2. testProcedureToD: string[] (step-by-step for Test-of-Design — verify control is properly designed)
3. testProcedureToE: string[] (step-by-step for Test-of-Effectiveness — verify control operates as intended)
4. expectedEvidence: string[] (list of evidence items the tester should collect)
5. riskFocusAreas: string[] (specific risk aspects to pay attention to)

Respond only with valid JSON, no markdown.`;
}
```

---

# 2. Intelligent Document Management (Beyond File Storage)

## 2.1 The Problem with GRC Document Management

Every GRC platform has a "Documents" section. In practice, it is always a glorified file folder with status fields. a QM/process suite is the only exception with a real lifecycle — but it lacks GRC entity linking. ARCTOS innovates by making documents a **first-class GRC entity** that is context-aware, version-intelligent, and compliance-tracked.

## 2.2 Feature: AI Policy Draft Generator

**When:** Admin or compliance_manager creates a new document with category "policy" and clicks "Entwurf generieren".

**What:** Claude generates a professionally structured policy document based on:
1. The selected category (e.g., "Informationssicherheitsrichtlinie")
2. The org's active frameworks (ISO 27001, NIS2, BSI IT-Grundschutz)
3. Existing policies in the org (to avoid overlap and ensure cross-references)
4. The org's industry and size (from Organization record)

**Generated output:** Full Markdown document with:
- Purpose and scope
- Applicable regulatory requirements
- Roles and responsibilities
- Policy statements
- Exception handling process
- Review cycle

**Implementation:**
- `packages/ai/src/policy-generator.ts`
- Template library for common policies: Information Security, Acceptable Use, Incident Response, BCMS, Data Protection, Remote Work, Access Control, Vendor Management
- Generates Markdown content → inserted into document.content field
- User can edit freely after generation

## 2.3 Feature: Automatic Expiry Detection & Renewal Workflow

**When:** Background worker runs daily at 06:00 UTC.

**What:**
1. Scans all documents with `expires_at` field set
2. 60 days before expiry: notification to owner "Dokument '[Title]' läuft in 60 Tagen ab"
3. 30 days before expiry: escalation to owner + admin "Dringende Dokumentenüberprüfung erforderlich"
4. On expiry: status auto-transitions to "expired", notification to all previous acknowledgers
5. Creates a task (source_entity_type='document') for the owner to review and renew

**Phase 2 Enhancement:** Claude analyzes regulatory changes (via Regulatory Intelligence Feed) and suggests which policies need updating based on new requirements.

## 2.4 Feature: Cross-Module Document Suggestions

**When:** User creates a risk, control, or process that matches keywords of existing documents.

**What:** Inline suggestion panel shows relevant documents:
```
📎 Möglicherweise relevante Dokumente:
  • "Backup-Richtlinie v3" (Richtlinie, veröffentlicht 15.01.2026)
  • "Incident Response Plan v2" (Verfahren, veröffentlicht 01.03.2026)
  [Verknüpfen]  [Ignorieren]
```

**Implementation:** PostgreSQL full-text search on document.search_vector matched against entity title + description. Triggered on entity create/update with debounce.

---

# 3. Control Effectiveness Intelligence (Phase 2/3 Roadmap)

## 3.1 Current State in Sprint 4

Sprint 4 stores control test results as point-in-time snapshots (effective/ineffective per test execution). This is the minimum for compliance. The innovation lies in transforming these snapshots into **continuous effectiveness intelligence**.

## 3.2 Control Effectiveness Score (CES) — Phase 2

**Concept:** Each control receives a computed Control Effectiveness Score (0–100) based on:
- Test history (weighted average of last 4 test results: effective=100, partially=50, ineffective=0)
- Test freshness (penalty for overdue tests: -10 points per month overdue)
- Finding severity (open findings reduce score: significant_nonconformity = -30, insignificant = -15, improvement_req = -5)
- Automation level bonus (fully_automated = +10, semi_automated = +5)

```typescript
function computeControlEffectivenessScore(control: Control): number {
  const testHistory = getLastNTests(control.id, 4);
  const testScoreAvg = testHistory.reduce((sum, t) => {
    const score = t.result === 'effective' ? 100 : t.result === 'partially_effective' ? 50 : 0;
    return sum + score;
  }, 0) / Math.max(testHistory.length, 1);

  const overdueMonths = monthsSince(control.lastTestedAt);
  const overduePenalty = Math.min(overdueMonths * 10, 50);

  const openFindings = getOpenFindings(control.id);
  const findingPenalty = openFindings.reduce((sum, f) => {
    return sum + (f.severity === 'significant_nonconformity' ? 30 :
                  f.severity === 'insignificant_nonconformity' ? 15 :
                  f.severity === 'improvement_requirement' ? 5 : 0);
  }, 0);

  const automationBonus = control.automationLevel === 'fully_automated' ? 10 :
                          control.automationLevel === 'semi_automated' ? 5 : 0;

  return Math.max(0, Math.min(100, testScoreAvg - overduePenalty - findingPenalty + automationBonus));
}
```

**UI:** Score displayed as a gauge on the control detail page and as a column in the control register.

## 3.3 Residual Risk Auto-Update via CES — Phase 2

**Concept:** When control effectiveness changes, automatically recalculate residual risk scores for all risks linked via RCM:

```
Residual Score = Inherent Score × (1 - Average CES of linked controls / 100)
```

Example: Risk with inherent score 20, two controls with CES 80 and CES 60 → Average CES = 70 → Residual = 20 × 0.3 = 6.

This creates a **closed feedback loop**: test results → CES update → residual risk recalculation → KRI threshold check → escalation if needed.

## 3.4 Control Heatmap — Sprint 4

**Concept:** Similar to the risk heat map (5×5 matrix), a control heat map visualizes the control landscape:
- X-axis: Control Frequency (event-driven → annually)
- Y-axis: Control Type × Line of Defense
- Cell color: average CES of controls in that cell (green ≥80, yellow 50–79, red <50)
- Cell size: number of controls in that bucket

---

# 4. Finding Remediation Analytics

## 4.1 Time-to-Remediation Tracking

**What:** For each finding, track the duration from identification to resolution. Compute per-org metrics:
- Average Time-to-Remediation (TTR) by severity level
- TTR trend over time (improving/worsening)
- Percentage of findings resolved within SLA (e.g., significant_nonconformity → 30 days, observation → 90 days)

**SLA Configuration:**
```sql
-- New fields on organization.settings JSONB (or dedicated config)
{
  "finding_sla": {
    "significant_nonconformity": 30,
    "insignificant_nonconformity": 60,
    "improvement_requirement": 90,
    "recommendation": 180,
    "observation": 365
  }
}
```

**Dashboard widget:**
```
┌─────────────────────────────────────────────┐
│  Finding Remediation Performance             │
│  ┌───────────────────────────────────────┐  │
│  │ Ø TTR by Severity (Tage)             │  │
│  │ ██████████████████████ Signifikant: 28d (SLA: 30d) ✅  │
│  │ ████████████████ Unwesentlich: 52d (SLA: 60d) ✅       │
│  │ ███████████ Verbesserung: 74d (SLA: 90d) ✅            │
│  └───────────────────────────────────────┘  │
│  SLA-Einhaltung: 87% (↗ +5% vs. Vorquartal)│
└─────────────────────────────────────────────┘
```

## 4.2 Root Cause Pattern Detection (Phase 2 — AI)

**Concept:** Claude analyzes all findings' root_cause texts across the organization and identifies patterns:

```
🔍 Root-Cause-Muster erkannt (AI-Analyse)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 34% aller Findings nennen "Prozess nicht dokumentiert" als Ursache.
   → Empfehlung: Investition in Prozessdokumentation (Sprint 3 BPMN-Modul nutzen).

2. 22% der Findings in Kategorie "Cyber" beziehen sich auf "veraltete Patches".
   → Empfehlung: Automatisierte Patch-Management-Kontrolle implementieren.

3. Cluster: 5 Findings in Q1 2026 bei Org "CWS GmbH" mit Ursache "Personalwechsel".
   → Empfehlung: Wissenstransfer-Prozess und Vertretungsregelung stärken.
```

---

# 5. Compliance-Aware Document Intelligence

## 5.1 Document-Framework Matrix (SoA Enhancement)

**Concept:** The Statement of Applicability (SoA) in ISO 27001 requires that each Annex A control is mapped to implementing documents. ARCTOS builds this automatically:

```
GET /api/v1/documents/framework-matrix?framework_id=:id
```

Returns a matrix showing:
- Y-axis: Framework requirements (e.g., ISO 27002:2022 controls A.5.1 through A.8.34)
- X-axis: Documents
- Cell: ✓ if document is linked to this requirement via `document_entity_link`
- Gaps: requirements with 0 linked documents highlighted in red

**SoA Auto-Generation:** Export the matrix as a formatted Excel/PDF document suitable for auditor review. Pre-fills the `compliance_assessment` table (from Data Model v1.0) with status='implemented' for requirements that have both a linked control AND a linked document.

## 5.2 Document Freshness Score

**Concept:** Each document receives a freshness score (0–100) based on:
- Time since last review/update (penalty: -5 per month since published_at)
- Regulatory change relevance (Phase 2: penalty if a linked framework was updated after the document)
- Acknowledgment completion rate (published documents with <80% acknowledgment lose 20 points)

**UI:** Color-coded freshness indicator on document list: 🟢 ≥80, 🟡 50–79, 🔴 <50.

---

# 6. Unique Differentiators Summary

| Innovation | ARCTOS | competing BPM suite | a GRC competitor | a QM/process suite | an open-source ISMS tool |
|---|---|---|---|---|---|
| AI Control Suggestions | ✅ Claude-powered per-risk | ✗ | ✗ | ✗ | ✗ |
| Separate ToD/ToE Results | ✅ K-NEW-01 | ✅ | ✗ | ✗ | ✗ |
| AI Test Plan Generator | ✅ Per-control | ✗ | ✗ | ✗ | ✗ |
| RCM Gap Detection (AI) | ✅ Prioritized recommendations | ✗ (manual only) | ✗ | ✗ | ✗ |
| Finding Severity Taxonomy (reference-level) | ✅ 5 levels (K-NEW-04) | ✅ | ✗ (only High/Med/Low) | ✗ | ✗ |
| Control Effectiveness Score | ✅ Phase 2 | ✗ | ✗ | ✗ | ✗ |
| CES → Residual Risk Auto-Update | ✅ Phase 2 | ✗ | ✗ | ✗ | ✗ |
| AI Policy Draft Generator | ✅ Framework-aware | ✗ | ✗ | ✗ | ✗ |
| Document-Framework Matrix (SoA) | ✅ Auto-generated | Partial | ✗ | ✗ | ✅ (manual) |
| Document Freshness Score | ✅ | ✗ | ✗ | ✗ | ✗ |
| Root Cause Pattern Detection | ✅ Phase 2 AI | ✗ | ✗ | ✗ | ✗ |
| Cross-Module Document Suggestions | ✅ Full-text matching | ✗ | ✗ | Partial | ✗ |
| Acknowledgment Compliance Dashboard | ✅ | Partial | ✗ | ✅ | ✗ |
| COSO Assertion Types on Controls | ✅ 8 types (K-NEW-02) | ✅ | ✗ | ✗ | ✗ |

---

# 7. Technical Debt to Avoid

1. **No control scores stored redundantly** — CES is computed on-read or via materialized view, NOT stored as a column that must be kept in sync.
2. **No AI calls on every page load** — cache AI suggestions per org+entity+day in Redis. RCM gap analysis runs on-demand or weekly, never on every page render.
3. **No audit trigger bypass** — never use raw SQL updates that bypass Drizzle in application code. All finding/control status changes go through the API layer.
4. **No file storage in database** — evidence and document files stored in S3-compatible storage; only metadata in PostgreSQL. Never store binary blobs in the DB.
5. **No hardcoded framework references** — AI prompts reference the org's active frameworks dynamically from the `framework` table. When Sprint 4b introduces catalogs, control suggestions will use catalog entries instead of hardcoded framework lists.

---

# 8. Sprint 4 → 4b → 5 → 8 ICS/DMS Module Evolution

```
Sprint 4:  Control Register + ToD/ToE Testing + Findings + RCM + Document Repository
           └─ Foundation: COSO assertions, BIC finding taxonomy, evidence system
           └─ Foundation: Document lifecycle, acknowledgments, full-text search
           └─ AI: Control suggestions, test plan generator, policy draft generator (SHOULD)

Sprint 4b: Catalog & Framework Module
           └─ ControlCatalog + ControlCatalogEntry (ISO 27002:2022, NIST CSF 2.0, BSI IT-GS)
           └─ Control instanciation from catalog → pre-filled control fields
           └─ SoA auto-generation from control + document + framework linkages

Sprint 5:  ISMS (Assessment-Wizard)
           └─ Control evaluation per asset: Current Maturity (1–5) + Target Maturity (1–5)
           └─ Controls linked to assets (K-NEW-05): multi-framework per asset
           └─ Control Assertions expanded for ISMS context

Sprint 8:  Audit Management
           └─ Finding entity shared between ICS and Audit
           └─ Audit checklists auto-generated from control register
           └─ Control test evidence reused as audit evidence
           └─ Finding → risk linkage for risk-based audit planning

Phase 2:   Control Effectiveness Score (CES) computation
           └─ CES → Residual Risk auto-recalculation
           └─ Continuous Control Monitoring (compliance_checkpoint hypertable)
           └─ Root Cause Pattern Detection via Claude

Phase 3:   Regulatory Intelligence → Document freshness alerts
           └─ Auto-suggest policy updates when frameworks change
           └─ Benchmarking: anonymous CES comparison across industries
```
