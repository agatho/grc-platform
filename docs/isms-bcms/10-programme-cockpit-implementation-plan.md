# Programme Cockpit — Vollständiger Implementierungsplan

**Stand:** 2026-04-30
**Ziel:** Norm-übergreifender, geführter Einführungsprozess für Managementsysteme (ISMS, BCMS, DPMS, AIMS, …) auf Basis der bereits gelieferten PDCA-Roadmap-Dokumente.
**Modul-Schlüssel:** `programme`
**Norm-Referenzen:** ISO 27001:2022, ISO 22301:2019, ISO 27005:2022, ISO 42001:2023, DSGVO, NIS2, DORA — Phasen-Templates pro Norm.

---

## 1. Architektur-Überblick

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PROGRAMME COCKPIT                            │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐       │
│  │   Templates  │───▶│   Journeys   │───▶│  Phases + Steps │       │
│  │   (per Norm) │    │ (per Org+MS) │    │ (instanziiert)  │       │
│  └──────────────┘    └──────────────┘    └─────────────────┘       │
│                            │                       │                 │
│                            ▼                       ▼                 │
│                    ┌──────────────┐      ┌─────────────────┐       │
│                    │  Milestones  │      │  Linked         │       │
│                    │  + Gates     │      │  Artefacts      │       │
│                    └──────────────┘      └─────────────────┘       │
│                            │                       │                 │
│                            └───────────┬───────────┘                 │
│                                        ▼                             │
│                            ┌────────────────────┐                    │
│                            │  Status-Engine     │                    │
│                            │  + State-Machines  │                    │
│                            └────────────────────┘                    │
│                                        │                             │
│                  ┌─────────────────────┼─────────────────────┐      │
│                  ▼                     ▼                     ▼      │
│          ┌───────────────┐    ┌───────────────┐    ┌──────────────┐│
│          │ Next-Best-    │    │  Dashboard    │    │  Deadline-   ││
│          │ Actions       │    │  Cockpit      │    │  Monitor     ││
│          └───────────────┘    └───────────────┘    └──────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Datenmodell (7 Tabellen + 4 Enums)

### 2.1 Tabellen

| Tabelle                    | Zweck                                           | Schlüssel-Felder                                                                                                                     |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `programme_template`       | Norm-Template (immutable nach Veröffentlichung) | `ms_type`, `name`, `version`, `framework_codes[]`                                                                                    |
| `programme_template_phase` | Phasen-Definitionen                             | `template_id`, `sequence`, `name`, `pdca_phase`, `default_duration_days`                                                             |
| `programme_template_step`  | Schritt-Definitionen                            | `template_id`, `phase_id`, `sequence`, `name`, `default_owner_role`, `prerequisite_step_codes[]`, `target_module_link`, `iso_clause` |
| `programme_journey`        | Instanz pro Org                                 | `org_id`, `template_id`, `name`, `status`, `started_at`, `target_completion_date`, `owner_id`, `progress_percent`                    |
| `programme_journey_phase`  | Phase-Status pro Journey                        | `journey_id`, `template_phase_id`, `status`, `started_at`, `completed_at`                                                            |
| `programme_journey_step`   | Schritt-Status pro Journey                      | `journey_id`, `template_step_id`, `phase_id`, `status`, `owner_id`, `due_date`, `completed_at`, `evidence_links` (jsonb)             |
| `programme_journey_event`  | Append-only Event-Log (Audit)                   | `journey_id`, `event_type`, `actor_id`, `payload` (jsonb), `occurred_at`                                                             |

### 2.2 Enums

- `ms_type`: `isms | bcms | dpms | aims | esg | tcms | iccs | other`
- `pdca_phase`: `plan | do | check | act | continuous`
- `programme_journey_status`: `planned | active | on_track | at_risk | blocked | completed | archived`
- `programme_step_status`: `pending | blocked | in_progress | review | completed | skipped | cancelled`

### 2.3 Constraints + Indices

- Unique: `(org_id, template_id, name)` auf `programme_journey`
- Unique: `(template_id, sequence)` auf phases + steps
- Indices: `(org_id, status)`, `(journey_id, status)`, `(journey_id, due_date)`, `(template_id, ms_type)`
- RLS auf alle journey-/journey\_\*-Tabellen via `app.current_org_id`
- Templates sind global lesbar (org-unabhängig), modifikation nur durch admin

### 2.4 Polymorphe Verlinkungen

Schritte können auf existierende Module verweisen via `target_module_link` (jsonb):

```json
{
  "module": "isms",
  "route": "/isms/assessments/[assessmentId]/eval-gate-check",
  "entityType": "assessment_run",
  "createIfMissing": true
}
```

Artefakte werden via `evidence_links` (jsonb-Array) verknüpft:

```json
[
  { "type": "document", "id": "uuid", "label": "ISMS-Politik v1.0" },
  { "type": "soa_entry", "id": "uuid", "label": "SoA Q1" }
]
```

---

## 3. State-Machines

### 3.1 `programme_journey_status`

```
            ┌─────────┐
            │ planned │
            └────┬────┘
                 │ start
                 ▼
            ┌─────────┐
       ┌────│ active  │────┐
       │    └────┬────┘    │
       │         │         │
       ▼         ▼         ▼
  ┌──────┐  ┌──────┐  ┌─────────┐
  │ on_  │  │ at_  │  │ blocked │
  │ track│  │ risk │  └────┬────┘
  └──┬───┘  └──┬───┘       │
     │         │           │
     └────┬────┴───────────┘
          ▼
     ┌──────────┐
     │completed │
     └────┬─────┘
          ▼
     ┌──────────┐
     │ archived │
     └──────────┘
```

`on_track`/`at_risk`/`blocked` sind **abgeleitete Status**, automatisch berechnet vom `JourneyHealthEvaluator` aus:

- Anteil überfälliger Steps
- Gate-Check-Blocker
- Owner-Zuweisung-Lücken

### 3.2 `programme_step_status`

```
   ┌─────────┐
   │ pending │──────────────┐
   └────┬────┘              │
        │ start             │ block
        ▼                   ▼
   ┌─────────────┐     ┌─────────┐
   │ in_progress │────▶│ blocked │
   └────┬────────┘     └────┬────┘
        │                   │ unblock
        │                   ▼
        │           ┌─────────────┐
        │     ┌─────│ in_progress │
        │     ▼     └─────────────┘
        ▼
   ┌─────────┐
   │ review  │
   └────┬────┘
        │ approve
        ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │completed │    │ skipped  │    │cancelled │
   └──────────┘    └──────────┘    └──────────┘
```

Validierung:

- `pending → in_progress` nur, wenn alle `prerequisite_step_codes` bereits `completed | skipped`
- `in_progress → review` nur, wenn `evidence_links.length >= required_evidence_count` (aus Template)
- `review → completed` setzt `completed_at = now()` und triggert Re-Eval der Journey-Health
- `skipped` erfordert `skip_reason`-Pflichtfeld

---

## 4. Seed-Daten — Templates

### 4.1 ISO 27001 Template (23 Schritte)

Aus Y1-Roadmap-Aktivitäten direkt abgeleitet, Phasen entsprechen den 4 Quartalen + Setup:

| #   | Phase | Schritt                              | iso_clause | default_owner | duration_days |
| --- | ----- | ------------------------------------ | ---------- | ------------- | ------------- |
| 0   | setup | GL-Commitment & Charter              | 5.1        | admin         | 14            |
| 1   | plan  | Stakeholder-Analyse                  | 4.2        | risk_manager  | 14            |
| 2   | plan  | Externer + Interner Kontext          | 4.1        | risk_manager  | 14            |
| 3   | plan  | Geltungsbereich-Workshop             | 4.3        | admin         | 7             |
| 4   | plan  | NIS2/DORA-Anwendbarkeitsprüfung      | n/a        | dpo           | 7             |
| 5   | plan  | IS-Politik (5.2)                     | 5.2        | admin         | 14            |
| 6   | plan  | RACI / Rollen-Modell                 | 5.3        | admin         | 14            |
| 7   | plan  | Risiko-Methodik (27005)              | 6.1.2      | risk_manager  | 14            |
| 8   | plan  | Asset-Erfassung Phase 1              | A.5.9      | control_owner | 21            |
| 9   | plan  | Risiko-Identifikation Workshops      | 6.1.2      | risk_manager  | 21            |
| 10  | plan  | Risiko-Analyse + Bewertung           | 6.1.2      | risk_manager  | 14            |
| 11  | plan  | SoA-Entwurf (Annex A)                | 6.1.3 d    | risk_manager  | 14            |
| 12  | do    | Risk-Treatment-Plan                  | 6.1.3      | risk_manager  | 14            |
| 13  | do    | Restrisiko-Akzeptanz Top-Risiken     | 6.1.3 f    | admin         | 7             |
| 14  | do    | Maßnahmen Welle 1 (Patch/MFA/Backup) | A.8        | control_owner | 60            |
| 15  | do    | Awareness-Programm Start             | 7.3        | admin         | 30            |
| 16  | do    | Continuous Control Monitoring        | 9.1        | control_owner | 14            |
| 17  | check | Pen-Test extern                      | A.8.8      | risk_manager  | 14            |
| 18  | check | Internes Audit (50 % Scope)          | 9.2        | auditor       | 21            |
| 19  | check | Internes Audit (Rest Scope)          | 9.2        | auditor       | 21            |
| 20  | check | NC-Schließung Welle 1                | 10.1       | auditor       | 30            |
| 21  | act   | Management-Review                    | 9.3        | admin         | 14            |
| 22  | act   | Stage-1-Audit (extern)               | n/a        | admin         | 14            |
| 23  | act   | Stage-2-Audit + Zertifikat           | n/a        | admin         | 21            |

Jeder Schritt mit:

- `target_module_link` zum bestehenden Modul (z. B. Schritt 8 → `/assets`, Schritt 11 → `/isms/soa`)
- `prerequisite_step_codes` (DAG)
- `required_evidence_count` (Default 1, Stage-Audits = 3)

### 4.2 ISO 22301 Template (BCMS, 18 Schritte)

Aus BCMS-Track der Y1-Roadmap.

### 4.3 DSGVO Template (DPMS, 14 Schritte)

Ableitung aus Sprint-7-Daten + DPIA/RoPA-Workflows.

### 4.4 ISO 42001 Template (AIMS, 16 Schritte)

Aus EU-AI-Act-Roadmap.

---

## 5. API-Surface

### 5.1 Templates (öffentlich lesbar, admin-änderbar)

| Methode | Pfad                                        | Zweck                                              |
| ------- | ------------------------------------------- | -------------------------------------------------- |
| GET     | `/api/v1/programmes/templates`              | Liste aller Templates (filterbar nach `ms_type`)   |
| GET     | `/api/v1/programmes/templates/[id]`         | Detail inkl. Phasen + Schritte                     |
| GET     | `/api/v1/programmes/templates/[id]/preview` | Render-Vorschau (welche Schritte in welcher Phase) |

### 5.2 Journeys (org-spezifisch)

| Methode | Pfad                                            | Zweck                                                |
| ------- | ----------------------------------------------- | ---------------------------------------------------- |
| GET     | `/api/v1/programmes/journeys`                   | Liste der Journeys der Org                           |
| POST    | `/api/v1/programmes/journeys`                   | Neue Journey aus Template instanziieren              |
| GET     | `/api/v1/programmes/journeys/[id]`              | Detail                                               |
| PATCH   | `/api/v1/programmes/journeys/[id]`              | Update Name/Owner/Target-Date                        |
| DELETE  | `/api/v1/programmes/journeys/[id]`              | Soft-Delete (admin only)                             |
| GET     | `/api/v1/programmes/journeys/[id]/dashboard`    | Aggregierte Dashboard-Daten                          |
| GET     | `/api/v1/programmes/journeys/[id]/timeline`     | Gantt-Daten                                          |
| GET     | `/api/v1/programmes/journeys/[id]/next-actions` | Top 3–10 nächste Aktionen                            |
| GET     | `/api/v1/programmes/journeys/[id]/blockers`     | Aktuelle Blocker                                     |
| GET     | `/api/v1/programmes/journeys/[id]/health`       | Health-Score (on_track / at_risk / blocked + Gründe) |
| POST    | `/api/v1/programmes/journeys/[id]/transition`   | Journey-Status-Übergang                              |

### 5.3 Steps

| Methode | Pfad                                                                | Zweck                                        |
| ------- | ------------------------------------------------------------------- | -------------------------------------------- |
| GET     | `/api/v1/programmes/journeys/[id]/steps`                            | Alle Schritte (filterbar nach Phase, Status) |
| GET     | `/api/v1/programmes/journeys/[id]/steps/[stepId]`                   | Detail                                       |
| PATCH   | `/api/v1/programmes/journeys/[id]/steps/[stepId]`                   | Owner, Due-Date, Notes setzen                |
| POST    | `/api/v1/programmes/journeys/[id]/steps/[stepId]/transition`        | Status-Übergang (validiert)                  |
| POST    | `/api/v1/programmes/journeys/[id]/steps/[stepId]/evidence`          | Evidence-Link hinzufügen                     |
| DELETE  | `/api/v1/programmes/journeys/[id]/steps/[stepId]/evidence/[linkId]` | Evidence-Link entfernen                      |

### 5.4 Phases

| Methode | Pfad                                      | Zweck                            |
| ------- | ----------------------------------------- | -------------------------------- |
| GET     | `/api/v1/programmes/journeys/[id]/phases` | Phasen-Liste mit Aggregat-Status |

### 5.5 Events

| Methode | Pfad                                      | Zweck                              |
| ------- | ----------------------------------------- | ---------------------------------- |
| GET     | `/api/v1/programmes/journeys/[id]/events` | Event-Log (paginiert, append-only) |

---

## 6. UI-Pages + Komponenten

### 6.1 Pages

| Pfad                                          | Inhalt                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `/(dashboard)/programmes`                     | Liste aktiver Journeys + „neues Programm starten"-Button                    |
| `/(dashboard)/programmes/new`                 | Setup-Wizard: Norm wählen → Template-Vorschau → Owner + Target-Date → Start |
| `/(dashboard)/programmes/[id]`                | Cockpit (Tabs: Overview / Phases / Timeline / Events)                       |
| `/(dashboard)/programmes/[id]/steps/[stepId]` | Schritt-Detail + Action-Wizard                                              |

### 6.2 Komponenten

- `ProgrammeCockpitHeader` — Health-Badge, Progress-Bar, Owner, Target-Date
- `PhaseKanban` — Phase-Spalten mit Step-Cards (drag-frei, click-only)
- `StepCard` — kompakt: Name, Owner-Avatar, Due-Badge, Status-Pill, Click → Detail
- `NextBestActionsWidget` — Top-5-Liste, jede Aktion mit Direct-Action-Button
- `BlockersAlert` — rote Card oben, listet Top-3 Blocker mit „Blocker auflösen"-Link
- `JourneyTimeline` — horizontaler Gantt mit Phasen-Bändern
- `EvidenceLinkPicker` — Modal zum Verknüpfen von Documents / SoA-Entries / Risks
- `ProgrammeHealthBadge` — wiederverwendbar im Executive-Dashboard

### 6.3 Executive-Dashboard-Widget

`ProgrammesProgressWidget` für `/dashboard` (Cross-Programme-Übersicht über alle aktiven Journeys einer Org).

---

## 7. Cron-Jobs (Worker)

| Job                                   | Frequenz             | Inhalt                                                                                 |
| ------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `programme-journey-deadline-monitor`  | täglich 06:00        | Schritte mit überschrittenem `due_date` markieren als `at_risk`, Owner benachrichtigen |
| `programme-journey-progress-snapshot` | wöchentlich Mo 07:00 | Snapshot in `programme_journey_event` + KPI-Aggregat                                   |
| `programme-journey-health-recompute`  | stündlich            | Re-Eval `journey.status` (on_track/at_risk/blocked)                                    |

---

## 8. Module-Registration

- Neuer `module_definition`-Eintrag: `key='programme'`, `label='Programme Cockpit'`, `category='platform'`
- `nav-config.ts`: neuer Eintrag in `platform`-Gruppe
- `<ModuleGate moduleKey="programme">` auf allen Pages

---

## 9. i18n

- 1 neues Namespace-File `messages/{de,en}/programme.json`
- ~80 Translation-Keys (alle UI-Strings, Status-Labels, Aktion-CTAs, Toast-Messages)

---

## 10. Test-Strategie

| Schicht                     | Tool                | Tests                                                                |
| --------------------------- | ------------------- | -------------------------------------------------------------------- |
| Pure Logic + State-Machines | vitest              | ~60 Tests in `packages/shared/tests/programme-*`                     |
| Schema-Validation (Zod)     | vitest              | ~25 Tests                                                            |
| API-Routen                  | vitest (mock-fetch) | ~20 Tests pro Endpoint                                               |
| Cron-Logic                  | vitest              | ~15 Tests                                                            |
| E2E                         | Playwright          | 6 Specs für Setup-Wizard, Cockpit, Step-Transition, Health-Recompute |

---

## 11. Liefer-Reihenfolge (atomare Commits)

1. Schema + Migration (1 Commit)
2. State-Machines + Pure Logic + Tests (1 Commit)
3. Seed-Daten (1 Commit)
4. API-Routen (1 Commit, sequenziell innerhalb des Commits)
5. UI-Komponenten + Pages (1 Commit)
6. Cron-Jobs (1 Commit)
7. Module-Registration + i18n (1 Commit)
8. E2E-Specs (1 Commit)
9. Dokumentation + Final-Test-Run (1 Commit)

In dieser Session **alles in einem Working-Tree**, dann **ein Squash-Commit pro Schicht** (oder ein einzelner umfassender Commit, je nach PR-Strategie).

---

## 12. Akzeptanzkriterien (Definition of Done)

| Kriterium                                  | Schwelle                          |
| ------------------------------------------ | --------------------------------- |
| Vitest grün — alle bestehenden Tests       | ✓                                 |
| Vitest grün — alle neuen Tests             | ≥ 95 % der definierten Test-Cases |
| TypeScript strict                          | 0 Errors in geändertem Code       |
| RLS aktiv auf allen Org-bezogenen Tabellen | ✓                                 |
| Audit-Trigger registriert                  | ✓                                 |
| Migration `up` läuft idempotent            | ✓                                 |
| API-Routen `requireModule('programme')`    | ✓                                 |
| Pages mit `<ModuleGate>`                   | ✓                                 |
| i18n DE + EN vollständig                   | 0 hartcodierte Strings im UI      |
| ISO-Klausel-Bezug bei jedem Schritt        | ✓                                 |
| Mind. 4 Templates seeded                   | ISMS, BCMS, DPMS, AIMS            |
| E2E-Specs angelegt                         | 6 Specs                           |

---

## 13. Risiken + Mitigationen

| Risiko                                      | Mitigation                                                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Templates veralten bei Norm-Updates         | Versionierung pro Template; alte Journeys behalten ihren Template-Snapshot                                      |
| Schritt-Wizards explodieren in Anzahl       | Generischer Step-Detail-Page mit Action-Hooks pro `target_module_link`                                          |
| Health-Recompute lastig bei vielen Journeys | Cron-Job inkrementell, nur Journeys mit Änderungen seit letztem Run                                             |
| Lock-In auf eigenes Format                  | Templates als JSON exportierbar, Re-Import möglich (in dieser Session: Schema vorbereitet, Endpunkt im Backlog) |

---

## 14. Out-of-Scope dieser Session

- AI-gestützte Schritt-Vorschläge (LLM-„Coach-Modus") — separater Sprint
- Multi-Org-Templates (z. B. Konzern-Template über 5 Tochtergesellschaften gleichzeitig instanziieren) — Y2
- Template-Marketplace (Templates von Community/Partnern) — Y2
- Programme-Comparison (zwei Journeys nebeneinander) — Y2

---

Verweise:

- [01-pdca-introduction-cycle.md](./01-pdca-introduction-cycle.md) — fachliche Grundlage
- [03-roadmap-year-1.md](./03-roadmap-year-1.md) — Quelle für ISO-27001-Template
- [05-requirements-catalog.md](./05-requirements-catalog.md) — Anforderungs-Bezug
