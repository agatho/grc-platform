# ARCTOS — Sprint Roadmap v3.1

Updated March 2026 — reflects Sprint 3 planning completion

---

## Sprint Status Overview

| Sprint | Scope | SP | Status |
| --- | --- | --- | --- |
| Sprint 1 | Foundation (Auth, RBAC, Audit, UI Shell, i18n) | ~40 | ✅ Completed |
| Sprint 1.2 | Workflow Engine, Email Service, Org GDPR | ~24 | ✅ Completed |
| Sprint 1.3 | Module System (12 modules, ModuleGate, dynamic sidebar) | ~16 | ✅ Completed |
| Sprint 1.4 | Extended Assets, Work Item System, Tab Navigation | ~20 | ✅ Completed |
| Sprint 2 | ERM: Risk Register + KRI Dashboard + Group Aggregation | ~72 | 🔄 In Development |
| **Sprint 3** | **BPMN: Process Modeling + Risk Overlays + Approval** | **~68** | **⬜ PRD Complete** |
| Sprint 4 | ICS + DMS (Controls, RCM, Document Management) | ~76 est | ⬜ Planned |
| Sprint 5 | ISMS (ISO 27001, NIS2, Assessment Wizard) | ~80 est | ⬜ Planned |
| Sprint 6 | BCMS (BIA, BCP, Crisis Management) | ~60 est | ⬜ Planned |
| Sprint 7 | DPMS (GDPR, DPIA, DSR, Breach Management) | ~60 est | ⬜ Planned |
| Sprint 8 | Audit Management (Universe, Plan, Execution, Findings) | ~50 est | ⬜ Planned |
| Sprint 9 | TPRM + Contract Management | ~50 est | ⬜ Planned |
| Phase 3-A | ESG + Materiality + CSRD Metrics | TBD | ⬜ Future |
| Phase 3-B | Whistleblowing (HinSchG) | TBD | ⬜ Future |

---

## Sprint 3 Summary

### Goal
BPMN Process Modeling module — native BPMN 2.0 editor (bpmn.js), hierarchical process landscape, risk overlays in BPMN diagrams, approval workflow, version management, AI process generation.

### Key Deliverables
- 6 Epics, 24 User Stories, ~68 Story Points
- 8 SQL migrations (048–055)
- 3 new tables: process, process_version, process_step
- 2 placeholder tables for Sprint 4: process_control, process_step_control
- Retroactive FK constraints on Sprint 2's process_risk and process_step_risk
- bpmn.js React wrapper with custom risk overlay extension
- BPMN XML parser for ProcessStep auto-sync
- Claude AI integration for BPMN generation from text
- Complete DE+EN i18n

### Dependencies Satisfied for Sprint 4
- `process_control` table ready (Sprint 4 adds FK + UI)
- `process_step_control` table ready (Sprint 4 adds FK + UI)
- `process_step.bpmn_element_id` available for control overlay placement
- Risk overlay pattern fully documented as template for control overlays
- Approval workflow pattern reusable for document workflows

---

## Module System Map (Sprint 1.3)

```
Module Key    │ Name                │ Depends On      │ Sprint
──────────────┼─────────────────────┼─────────────────┼────────
erm           │ Risk Management     │ —               │ Sprint 2  ✅
bpm           │ Process Management  │ —               │ Sprint 3  ⬜
ics           │ Internal Controls   │ erm             │ Sprint 4  ⬜
dms           │ Document Management │ —               │ Sprint 4  ⬜
isms          │ Information Security│ erm, ics        │ Sprint 5  ⬜
bcms          │ Business Continuity │ erm, bpm        │ Sprint 6  ⬜
dpms          │ Data Protection     │ dms             │ Sprint 7  ⬜
audit         │ Audit Management    │ erm, ics        │ Sprint 8  ⬜
tprm          │ Third-Party Risk    │ —               │ Sprint 9  ⬜
contract      │ Contract Management │ —               │ Sprint 9  ⬜
esg           │ ESG/CSRD            │ —               │ Phase 3-A ⬜
whistleblowing│ Whistleblowing      │ —               │ Phase 3-B ⬜
```

---

## Cross-Module Data Flow

```
Sprint 2 (ERM):
  risk → process_risk → Sprint 3 (BPM)
  risk → process_step_risk → Sprint 3 (BPM)
  risk → risk_control → Sprint 4 (ICS)

Sprint 3 (BPM):
  process → process_control → Sprint 4 (ICS)
  process_step → process_step_control → Sprint 4 (ICS)
  process.is_essential → Sprint 6 (BCMS)

Sprint 4 (ICS):
  control → risk_control → Sprint 2 (ERM: RCM)
  control → control_requirement → Sprint 5 (ISMS: SoA)
  document → document_link → all modules
```

---

## Sprint 3 Documents Produced

| Document | Description |
| --- | --- |
| `PRD_Sprint3_BPMN_Process_Modeling.md` | Complete PRD with epics, user stories, migrations, API endpoints |
| `Tech_Spec_BPMN_Module.md` | Drizzle schemas, Zod schemas, BPMN parser, React components, API implementations |
| `UIUX_Spec_BPMN_Module.md` | Page layouts, component specs, color reference, mobile considerations |
| `Sprint3_Test_Plan.md` | Unit tests, integration tests, E2E tests, performance benchmarks |
| `GRC_Requirements_Gap_Analyse_v3.md` | Updated gap analysis with BIC GRC v3.0 insights |
