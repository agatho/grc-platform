# ARCTOS — UI/UX Specification: ICS + DMS Module

Sprint 4 — Internal Control System + Document Management
Pixel-accurate implementation guide for Claude Code

---

# 1. Page Structure & Navigation

## 1.1 Sidebar Entries (Sprint 4 Additions)

The Sprint 1 sidebar receives two new collapsible group sections (module-gated via `<ModuleGate>`):

```
── Internes Kontrollsystem ─────── (group header, nav_section: 'compliance', icon: check-square, color: text-blue-500)
   ├── ✅  Kontrollregister         → /controls            (roles: all)
   ├── 📋  Testkampagnen            → /controls/campaigns  (roles: risk_manager, admin)
   ├── ⚠️  Findings                 → /controls/findings   (roles: control_owner, risk_manager, admin, auditor)
   ├── 🔲  Risiko-Kontroll-Matrix   → /controls/rcm        (roles: risk_manager, admin, auditor)
   └── 📎  Nachweise                → /controls/evidence   (roles: control_owner, risk_manager, admin, auditor)

── Dokumentenmanagement ────────── (group header, nav_section: 'compliance', icon: file-text, color: text-indigo-500)
   ├── 📄  Dokumentenablage         → /documents            (roles: all)
   ├── ✓✓  Kenntnisnahme            → /documents/compliance (roles: admin, risk_manager)
   └── 🔍  Suche                    → /search               (roles: all)
```

Sidebar icon colors: use Tailwind `text-blue-500` for ICS module icons, `text-indigo-500` for DMS module icons.

## 1.2 Route Overview

### ICS Routes

| Route | Component | Access |
| --- | --- | --- |
| `/controls` | ControlListPage | all roles |
| `/controls/new` | ControlFormPage (create) | control_owner, risk_manager, admin |
| `/controls/[id]` | ControlDetailPage (7 tabs) | all roles |
| `/controls/[id]/edit` | ControlFormPage (edit) | control_owner, risk_manager, admin |
| `/controls/campaigns` | CampaignListPage | risk_manager, admin |
| `/controls/campaigns/new` | CampaignFormPage | risk_manager, admin |
| `/controls/campaigns/[id]` | CampaignDetailPage | all roles |
| `/controls/findings` | FindingListPage + Dashboard | all roles |
| `/controls/findings/new` | FindingFormPage | control_owner, risk_manager, auditor, admin |
| `/controls/findings/[id]` | FindingDetailPage | all roles |
| `/controls/rcm` | RCMMatrixPage | risk_manager, admin, auditor |
| `/controls/evidence` | EvidenceBrowserPage | control_owner, risk_manager, admin, auditor |

### DMS Routes

| Route | Component | Access |
| --- | --- | --- |
| `/documents` | DocumentListPage | all roles |
| `/documents/new` | DocumentFormPage (create) | all roles with write |
| `/documents/[id]` | DocumentDetailPage (6 tabs) | all roles |
| `/documents/[id]/edit` | DocumentFormPage (edit) | owner, reviewer, admin |
| `/documents/compliance` | AcknowledgmentCompliancePage | admin, risk_manager |
| `/search` | SearchPage | all roles |

## 1.3 Breadcrumb Patterns

```
Controls List:     Dashboard > Internes Kontrollsystem > Kontrollregister
Control Detail:    Dashboard > Internes Kontrollsystem > Kontrollregister > [Title ≤40 chars]
Control New:       Dashboard > Internes Kontrollsystem > Kontrollregister > Neue Kontrolle
Campaigns:         Dashboard > Internes Kontrollsystem > Testkampagnen
Findings:          Dashboard > Internes Kontrollsystem > Findings
RCM:               Dashboard > Internes Kontrollsystem > Risiko-Kontroll-Matrix
Documents List:    Dashboard > Dokumentenmanagement > Dokumentenablage
Document Detail:   Dashboard > Dokumentenmanagement > Dokumentenablage > [Title ≤40 chars]
Compliance:        Dashboard > Dokumentenmanagement > Kenntnisnahme
Search:            Dashboard > Suche
```

---

# 2. Control Register List Page (`/controls`)

## 2.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                    │
│                                                                  │
│  Kontrollregister                               [+ Kontrolle erstellen]  │
│  [Org Name] · 48 Kontrollen · 12 effektiv · 3 ineffektiv        │
│                                                                  │
│  ┌── Filter Bar ─────────────────────────────────────────────┐   │
│  │  [🔍 Suche...]  [Status ▾]  [Typ ▾]  [Frequenz ▾]        │   │
│  │  [Automation ▾]  [Verteidigungslinie ▾]  [Owner ▾]        │   │
│  │  [Assertions ▾]  [✕ Filter zurücksetzen]                  │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Table ──────────────────────────────────────────────────┐   │
│  │  ☐ │ ID  │ Titel │ Typ │ Freq. │ Autom. │ LoD │ Owner │ Status │ Letzter Test │ Assertions │
│  │  ☐ │ CTL-001 │ Multi-Faktor-Auth… │ 🛡 Präventiv │ Kontinuierlich │ 🤖 Vollaut. │ 1st │ Max M. │ ✅ Effektiv │ 15.03.2026 │ 🏷🏷 │
│  │  ☐ │ CTL-002 │ Quartals-Rechte… │ 🔍 Detektiv │ Quartärlich │ ⚙ Semi │ 2nd │ Anna S. │ ✅ Effektiv │ 01.01.2026 │ 🏷🏷 │
│  │  ☐ │ CTL-003 │ Incident-Response… │ 🔧 Korrektiv │ Jährlich │ 👤 Manuell │ 2nd │ — │ ⬜ Designed │ — │ 🏷 │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Bulk Actions: Exportieren / Status ändern / Owner zuweisen]    │
│                                                                  │
│  Page 1 / 2  [← Zurück]  [Weiter →]  [25 pro Seite ▾]          │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 Table Columns

| Column | Width | Sortable | Description |
| --- | --- | --- | --- |
| ID | 80px | ✓ | Element-ID: "CTL-001" format; auto-generated |
| Titel | flex (min 200px) | ✓ | Control title; truncated 60 chars; tooltip on hover |
| Typ | 110px | ✓ | Control type badge: preventive=🛡blue, detective=🔍teal, corrective=🔧orange |
| Frequenz | 120px | ✓ | Frequency label: event_driven="Ereignis", continuous="Kontinu.", daily="Täglich", etc. |
| Automation | 90px | ✓ | Icon: manual=👤, semi_automated=⚙, fully_automated=🤖 |
| LoD | 50px | ✓ | Line of Defense: "1st", "2nd", "3rd" badge |
| Owner | 140px | ✓ | Avatar (24px) + name; "Nicht zugewiesen" in muted red if null |
| Status | 110px | ✓ | Status badge: designed=gray, implemented=blue, effective=green, ineffective=red, retired=gray-striped |
| Letzter Test | 100px | ✓ | Date; overdue (>90 days) in orange; never tested = "—" |
| Assertions | 80px | — | Small pill badges for each assertion (abbreviation: CO, AC, OR, FP, EX, VA, PR, SA) |

**Row Actions (visible on hover):** `[👁 Anzeigen]  [✏️ Bearbeiten]  [⋮ Mehr]`

---

# 3. Control Detail Page (`/controls/[id]`)

## 3.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                    │
│                                                                  │
│  ┌── Header ─────────────────────────────────────────────────┐   │
│  │  CTL-001  ✅ Effektiv                                      │   │
│  │  Multi-Faktor-Authentifizierung (MFA)                      │   │
│  │  Präventiv · Kontinuierlich · Vollautomatisiert · 1st Line │   │
│  │  Owner: Max Muster   Letzer Test: 15.03.2026               │   │
│  │  [✏️ Bearbeiten]  [⋮ Aktionen]                             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Tabs ───────────────────────────────────────────────────┐   │
│  │  [Übersicht] [Tests] [Findings] [RCM (Risiken)] [Prozesse] [Nachweise] [Historie]  │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Tab Content ────────────────────────────────────────────┐   │
│  │  (Content varies by active tab — see below)                │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 Tab: Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌── Left Column (2/3) ──────────────────────────────────────┐  │
│  │  Beschreibung                                              │  │
│  │  Alle Benutzer müssen sich mit einem zweiten Faktor        │  │
│  │  authentifizieren. Dies betrifft VPN, Cloud-Dienste und    │  │
│  │  alle administrativen Zugänge.                             │  │
│  │                                                            │  │
│  │  Assertions (COSO)                                         │  │
│  │  [🏷 Fraud Prevention]  [🏷 Safeguarding of Assets]       │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌── Right Column (1/3 — Sidebar) ───────────────────────────┐  │
│  │  Status: ✅ Effektiv                                       │  │
│  │  Typ: 🛡 Präventiv                                        │  │
│  │  Frequenz: Kontinuierlich                                  │  │
│  │  Automation: 🤖 Vollautomatisiert                          │  │
│  │  Verteidigungslinie: 1st Line                              │  │
│  │  ─────────────────                                         │  │
│  │  Owner: 👤 Max Muster                                      │  │
│  │  Erstellt: 15.01.2026                                      │  │
│  │  Letzter Test: 15.03.2026                                  │  │
│  │  ─────────────────                                         │  │
│  │  Verknüpfte Risiken: 3                                     │  │
│  │  Offene Findings: 1                                        │  │
│  │  Nachweise: 5                                              │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 Tab: Tests

```
┌─────────────────────────────────────────────────────────────────┐
│  Kontrolltests                                  [+ Test anlegen] │
│                                                                  │
│  ┌── Test Card ──────────────────────────────────────────────┐   │
│  │  Kampagne: Q1 2026 Kontrolltest  ·  Tester: Anna S.      │   │
│  │  Geplant: 01.03.2026  ·  Durchgeführt: 15.03.2026        │   │
│  │                                                            │   │
│  │  ┌── ToD ──────────────┐  ┌── ToE ──────────────┐        │   │
│  │  │  ✅ Effektiv         │  │  ✅ Effektiv         │        │   │
│  │  │  "Kontrolle korrekt  │  │  "MFA-Logs zeigen   │        │   │
│  │  │   designed per       │  │   99.8% Enforcement  │        │   │
│  │  │   ISO 27002 A.8.5"  │  │   Rate in Q1."       │        │   │
│  │  └─────────────────────┘  └─────────────────────┘        │   │
│  │                                                            │   │
│  │  Gesamtergebnis: ✅ Effektiv  ·  📎 3 Nachweise           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Test Card (Overdue) ────────────────────────────────────┐   │
│  │  Kampagne: Q4 2025 Kontrolltest  ·  Tester: Max M.       │   │
│  │  Geplant: 15.12.2025  ·  ⚠️ ÜBERFÄLLIG (+101 Tage)       │   │
│  │  ToD: ⬜ Nicht getestet  ·  ToE: ⬜ Nicht getestet        │   │
│  │  [▶ Test durchführen]                                      │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.4 Tab: RCM (Risiken)

```
┌─────────────────────────────────────────────────────────────────┐
│  Verknüpfte Risiken (RCM)                    [+ Risiko verknüpfen] │
│                                                                  │
│  ┌── Risk Card ──────────────────────────────────────────────┐   │
│  │  RSK-001: Phishing-Angriff auf Mitarbeiter                │   │
│  │  Score: 🔴 20  ·  Kategorie: Cyber  ·  Status: Bewertet  │   │
│  │  Abdeckung: ✅ Vollständig                                 │   │
│  │  "MFA verhindert Credential-Theft nach erfolgreichem       │   │
│  │   Phishing-Angriff."                                       │   │
│  │  [→ Risiko öffnen]  [✏️ Abdeckung bearbeiten]              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Risk Card ──────────────────────────────────────────────┐   │
│  │  RSK-007: Brute-Force-Angriff auf Admin-Zugänge          │   │
│  │  Score: 🟡 12  ·  Kategorie: Cyber  ·  Status: Behandelt │   │
│  │  Abdeckung: 🟡 Teilweise                                  │   │
│  │  "MFA erschwert Brute-Force, aber Dienstkonto-Zugänge     │   │
│  │   sind nicht abgedeckt."                                   │   │
│  │  [→ Risiko öffnen]  [✏️ Abdeckung bearbeiten]              │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 4. Control Test Execution Form

## 4.1 ToD/ToE Split Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Kontrolltest durchführen                                        │
│  Kontrolle: CTL-001 — Multi-Faktor-Authentifizierung             │
│  Kampagne: Q1 2026 Kontrolltest                                  │
│                                                                  │
│  ┌── Left: Test-of-Design (ToD) ─────────────────────────────┐  │
│  │  "Ist die Kontrolle korrekt designed?"                     │  │
│  │                                                            │  │
│  │  Ergebnis:                                                 │  │
│  │  ○ Effektiv  ○ Teilweise  ○ Ineffektiv  ○ Nicht getestet  │  │
│  │                                                            │  │
│  │  Anmerkungen:                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ MFA-Policy ist dokumentiert und deckt alle           │  │  │
│  │  │ administrativen Zugänge ab. Dienstkonto-             │  │  │
│  │  │ Ausnahmen sind definiert und genehmigt.              │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Right: Test-of-Effectiveness (ToE) ─────────────────────┐  │
│  │  "Funktioniert die Kontrolle wie beabsichtigt?"            │  │
│  │                                                            │  │
│  │  Ergebnis:                                                 │  │
│  │  ● Effektiv  ○ Teilweise  ○ Ineffektiv  ○ Nicht getestet  │  │
│  │                                                            │  │
│  │  Anmerkungen:                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ MFA-Logs der letzten 90 Tage zeigen 99.8%           │  │  │
│  │  │ Enforcement Rate. 2 Ausnahmen dokumentiert.          │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Evidence Upload ────────────────────────────────────────┐   │
│  │  📎 Nachweise hochladen                                    │   │
│  │  ┌─ Drop Zone ─────────────────────────────────────────┐  │   │
│  │  │  📁 Dateien hierher ziehen oder [Durchsuchen]        │  │   │
│  │  │  Max. 50 MB · PDF, PNG, JPG, DOCX, XLSX, CSV        │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │  ✅ MFA-Report-Q1-2026.pdf (2.1 MB)         [✕]          │   │
│  │  ✅ Azure-AD-MFA-Stats.xlsx (340 KB)         [✕]          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Durchführungsdatum: [📅 25.03.2026]                             │
│                                                                  │
│  [Entwurf speichern]  [✅ Test abschließen]                      │
└─────────────────────────────────────────────────────────────────┘
```

---

# 5. Risk-Control Matrix (RCM) Page (`/controls/rcm`)

## 5.1 Matrix Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                                │
│                                                                              │
│  Risiko-Kontroll-Matrix                                [Export PDF] [Export Excel] │
│  [Org Name] · 42 Risiken · 48 Kontrollen · 3 Lücken                         │
│                                                                              │
│  ┌── Filters ────────────────────────────────────────────────────────────┐   │
│  │  [Risikokategorie ▾]  [Kontrolltyp ▾]  [Score ≥ ▾]  [Nur Lücken ☐]  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌── Matrix Grid ────────────────────────────────────────────────────────┐   │
│  │              │ CTL-001    │ CTL-002    │ CTL-003    │ CTL-004    │ Σ  │   │
│  │              │ MFA        │ Rechte-Rev │ Backup-Ver │ IR-Plan    │    │   │
│  │ ─────────────┼────────────┼────────────┼────────────┼────────────┼────│   │
│  │ RSK-001 🔴20 │ 🟢 Full    │ 🟡 Partial │            │            │ 2  │   │
│  │ Phishing     │            │            │            │            │    │   │
│  │ ─────────────┼────────────┼────────────┼────────────┼────────────┼────│   │
│  │ RSK-002 🔴16 │            │            │ 🟢 Full    │ 🔵 Planned │ 2  │   │
│  │ Ransomware   │            │            │            │            │    │   │
│  │ ─────────────┼────────────┼────────────┼────────────┼────────────┼────│   │
│  │ RSK-003 🟡12 │ 🟡 Partial │            │            │            │ 1  │   │
│  │ Datenverlust │            │            │            │            │    │   │
│  │ ─────────────┼────────────┼────────────┼────────────┼────────────┼────│   │
│  │ ⚠️ RSK-008 🟡8│            │            │            │            │ 🔴0│   │
│  │ Compliance   │            │            │            │            │    │   │
│  │ ─────────────┼────────────┼────────────┼────────────┼────────────┼────│   │
│  │ Σ Risiken    │ 2          │ 1          │ 1          │ 1          │    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Legende: 🟢 Vollständig  🟡 Teilweise  🔵 Geplant  ⬜ Keine  🔴 Lücke      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 Cell Interaction

- **Hover:** Tooltip with risk title, control title, coverage description, effectiveness rating
- **Click filled cell:** Opens inline edit panel for coverage description and rating
- **Click empty cell:** Opens "Verknüpfung erstellen" dialog pre-filled with row risk + column control
- **Red row (🔴 0 controls):** Entire row has `bg-red-50` background, Σ column shows red "0"
- **Gray column (0 risks):** Column header has `text-gray-400` muted style

---

# 6. Finding List & Dashboard (`/controls/findings`)

## 6.1 Dashboard Section (Top)

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌── KPI Cards ──────────────────────────────────────────────┐  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │ 23       │ │ 🔴 5     │ │ ⏰ 7     │ │ Ø 42 Tage    │ │  │
│  │  │ Gesamt   │ │ Kritisch │ │ Überfällig│ │ Behebungszeit│ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Charts ─────────────────────────────────────────────────┐  │
│  │  ┌── By Severity (Bar) ──┐  ┌── By Status (Donut) ──────┐│  │
│  │  │ Beobachtung:     █  3 │  │    ┌───┐                    │  │
│  │  │ Empfehlung:      ██ 5 │  │   /     \  Identifiziert: 5│  │
│  │  │ Verbesserung:   ███ 8 │  │  |  23   |  In Behebung: 8 │  │
│  │  │ Unwesentlich:    ██ 4 │  │   \     /  Behoben: 6      │  │
│  │  │ Wesentlich:     ███ 3 │  │    └───┘  Geschlossen: 4   │  │
│  │  └────────────────────────┘  └────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Finding Severity Color Scheme

| Severity | DE Label | Color | Badge BG | Badge Text |
| --- | --- | --- | --- | --- |
| observation | Beobachtung | Blue | `bg-blue-100` | `text-blue-800` |
| recommendation | Empfehlung | Teal | `bg-teal-100` | `text-teal-800` |
| improvement_requirement | Verbesserungsbedarf | Yellow | `bg-yellow-100` | `text-yellow-800` |
| insignificant_nonconformity | Unwesentliche Nichtkonformität | Orange | `bg-orange-100` | `text-orange-800` |
| significant_nonconformity | Wesentliche Nichtkonformität | Red | `bg-red-100` | `text-red-800` |

---

# 7. Document Repository List (`/documents`)

## 7.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                    │
│                                                                  │
│  Dokumentenablage                             [+ Dokument erstellen]  │
│  [Org Name] · 35 Dokumente · 5 zur Kenntnisnahme ausstehend    │
│                                                                  │
│  ┌── Filter Bar ─────────────────────────────────────────────┐   │
│  │  [🔍 Suche...]  [Status ▾]  [Kategorie ▾]  [Owner ▾]     │   │
│  │  [Kenntnisnahme ☐]  [Abgelaufen ☐]  [Tags ▾]             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Table ──────────────────────────────────────────────────┐   │
│  │  ☐ │ Titel │ Kategorie │ Status │ Owner │ Version │ Veröfftl. │ Ablauf │ Bestätigt │
│  │  ☐ │ Informationssicherheits… │ 📜 Richtlinie │ 🟢 Veröfftl. │ Max │ v1 │ 15.01.26 │ — │ 85% (17/20) │
│  │  ☐ │ Acceptable Use Policy │ 📜 Richtlinie │ 🟢 Veröfftl. │ Max │ v1 │ 01.02.26 │ — │ 70% (14/20) │
│  │  ☐ │ Incident Response Plan │ 📋 Verfahren │ 🟢 Veröfftl. │ Anna │ v2 │ 01.03.26 │ — │ — │
│  │  ☐ │ DS-Verfahrensanweisung │ 📋 Verfahren │ ⬜ Entwurf │ Max │ v1 │ — │ — │ — │
│  │  ☐ │ Backup-Richtlinie │ 📐 Leitlinie │ 🔴 Abgelaufen │ Max │ v1 │ 15.06.25 │ 15.03.26 │ — │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Bulk Actions: Exportieren / Status ändern / Owner zuweisen / Tags setzen]  │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Document Category Icons

| Category | Icon | DE Label |
| --- | --- | --- |
| policy | 📜 | Richtlinie |
| procedure | 📋 | Verfahrensanweisung |
| guideline | 📐 | Leitlinie |
| template | 📄 | Vorlage |
| record | 🗂 | Nachweis |
| tom | 🔒 | TOM |
| soa | ✓ | SoA |
| other | 📁 | Sonstige |

---

# 8. Document Detail Page (`/documents/[id]`)

## 8.1 Content Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌── Acknowledgment Banner (if pending) ─────────────────────┐  │
│  │  ⚠️ Dieses Dokument erfordert Ihre Kenntnisnahme           │  │
│  │  [✅ Gelesen und zur Kenntnis genommen]                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Left: Content (2/3) ────────────────────────────────────┐  │
│  │  # Informationssicherheitsrichtlinie                       │  │
│  │                                                            │  │
│  │  ## 1. Zweck                                               │  │
│  │  Diese Richtlinie definiert die grundlegenden Anforderungen│  │
│  │  an die Informationssicherheit innerhalb der Organisation. │  │
│  │                                                            │  │
│  │  ## 2. Geltungsbereich                                     │  │
│  │  Diese Richtlinie gilt für alle Mitarbeiter, Auftragnehmer │  │
│  │  und Dienstleister mit Zugang zu Informationssystemen.     │  │
│  │  ...                                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌── Right: Metadata Sidebar (1/3) ──────────────────────────┐  │
│  │  Status: 🟢 Veröffentlicht                                 │  │
│  │  Kategorie: 📜 Richtlinie                                  │  │
│  │  Version: 1                                                │  │
│  │  ─────────────────                                         │  │
│  │  Owner: 👤 Max Muster                                      │  │
│  │  Reviewer: 👤 Anna Schmidt                                 │  │
│  │  Freigegeben: 👤 Dr. Müller                                │  │
│  │  ─────────────────                                         │  │
│  │  Veröffentlicht: 15.01.2026                                │  │
│  │  Ablaufdatum: —                                            │  │
│  │  ─────────────────                                         │  │
│  │  Kenntnisnahme: 85% (17/20)                                │  │
│  │  Tags: iso27001, isms, security                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 8.2 Versions Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  Versionsverlauf                                                 │
│                                                                  │
│  ┌── Version 2 (aktuell) ────────────────────────────────────┐  │
│  │  v2 · 01.03.2026 · Max Muster                             │  │
│  │  "Abschnitt 4 aktualisiert nach NIS2-Anforderungen"       │  │
│  │  [📄 Anzeigen]  [🔄 Vergleichen mit v1]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Version 1 ──────────────────────────────────────────────┐  │
│  │  v1 · 15.01.2026 · Max Muster                             │  │
│  │  "Erstveröffentlichung"                                    │  │
│  │  [📄 Anzeigen]  [🔄 Vergleichen mit v2]  [⏮ Wiederherstellen]  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 9. Acknowledgment Compliance Dashboard (`/documents/compliance`)

## 9.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                    │
│                                                                  │
│  Dokumenten-Kenntnisnahme                                        │
│  Compliance-Status aller Pflichtdokumente                        │
│                                                                  │
│  ┌── Summary ────────────────────────────────────────────────┐   │
│  │  8 Pflichtdokumente · Gesamt-Compliance: 82%               │   │
│  │  [📧 Erinnerung an alle ausstehenden senden]               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Table ──────────────────────────────────────────────────┐   │
│  │  Dokument │ Version │ Veröffentlicht │ Gesamt │ Bestätigt │ Ausstehend │ Compliance │
│  │  InfoSec-Richtlinie │ v1 │ 15.01.26 │ 20 │ 17 │ 3 │ 🟢 85% │
│  │  AUP │ v1 │ 01.02.26 │ 20 │ 14 │ 6 │ 🟡 70% │
│  │  Remote Work Policy │ v2 │ 10.03.26 │ 20 │ 12 │ 8 │ 🔴 60% │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Expanded Row (click) ───────────────────────────────────┐   │
│  │  Ausstehende Bestätigungen für "Remote Work Policy":       │   │
│  │  • Max Muster (max@example.com)        [📧 Erinnern]       │   │
│  │  • Anna Schmidt (anna@example.com)     [📧 Erinnern]       │   │
│  │  • Peter Müller (peter@example.com)    [📧 Erinnern]       │   │
│  │  [📧 Alle erinnern]                                        │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

# 10. Responsive Design Rules

## 10.1 Breakpoints

| Breakpoint | Control Register | RCM Matrix | Document List | Finding Dashboard |
| --- | --- | --- | --- | --- |
| Desktop (≥1280px) | Full table | Full matrix grid | Full table | KPIs + charts + table |
| Tablet (768–1279px) | Compact table (hide Assertions, LoD) | Scroll horizontally | Compact table (hide Tags) | KPIs + table (charts collapsed) |
| Mobile (<768px) | Card view per control | List view: risk → controls | Card view per document | KPIs only, table below |

## 10.2 RCM Responsive Behavior

- Desktop: full matrix grid with sticky headers (both row and column)
- Tablet: horizontal scroll with sticky risk column (left-pinned)
- Mobile: switch to list view — each risk as an expandable card showing linked controls

## 10.3 Test Execution Responsive

- Desktop: side-by-side ToD/ToE panels
- Tablet: stacked ToD above ToE (full width each)
- Mobile: single-column with ToD section, then ToE section, then evidence

---

# 11. i18n Keys (Sprint 4 Modules)

## 11.1 ICS Module — `messages/de/controls.json`

```json
{
  "controls": {
    "title": "Kontrollregister",
    "subtitle": "{count} Kontrollen",
    "create": "Kontrolle erstellen",
    "detail": "Kontrolldetails",
    "edit": "Kontrolle bearbeiten",
    "fields": {
      "title": "Titel",
      "description": "Beschreibung",
      "controlType": "Kontrolltyp",
      "frequency": "Frequenz",
      "automationLevel": "Automatisierungsgrad",
      "lineOfDefense": "Verteidigungslinie",
      "owner": "Control Owner",
      "status": "Status",
      "assertions": "Prüfungsziele (COSO)",
      "lastTestedAt": "Letzter Test"
    },
    "types": {
      "preventive": "Präventiv",
      "detective": "Detektiv",
      "corrective": "Korrektiv"
    },
    "frequencies": {
      "event_driven": "Ereignisgesteuert",
      "continuous": "Kontinuierlich",
      "daily": "Täglich",
      "weekly": "Wöchentlich",
      "monthly": "Monatlich",
      "quarterly": "Quartalsweise",
      "annually": "Jährlich",
      "ad_hoc": "Ad hoc"
    },
    "automation": {
      "manual": "Manuell",
      "semi_automated": "Teilautomatisiert",
      "fully_automated": "Vollautomatisiert"
    },
    "statuses": {
      "designed": "Designed",
      "implemented": "Implementiert",
      "effective": "Effektiv",
      "ineffective": "Ineffektiv",
      "retired": "Ausgemustert"
    },
    "assertions_labels": {
      "completeness": "Vollständigkeit",
      "accuracy": "Genauigkeit",
      "obligations_and_rights": "Rechte & Pflichten",
      "fraud_prevention": "Betrugsprävention",
      "existence": "Existenz",
      "valuation": "Bewertung",
      "presentation": "Darstellung",
      "safeguarding_of_assets": "Vermögensschutz"
    },
    "tabs": {
      "overview": "Übersicht",
      "tests": "Tests",
      "findings": "Findings",
      "rcm": "RCM (Risiken)",
      "processes": "Prozesse",
      "evidence": "Nachweise",
      "history": "Historie"
    }
  },
  "campaigns": {
    "title": "Testkampagnen",
    "create": "Kampagne erstellen",
    "activate": "Kampagne aktivieren",
    "progress": "{completed} von {total} Tests abgeschlossen ({percent}%)"
  },
  "tests": {
    "tod": "Test-of-Design",
    "toe": "Test-of-Effectiveness",
    "execute": "Test durchführen",
    "overdue": "Überfällig",
    "results": {
      "effective": "Effektiv",
      "ineffective": "Ineffektiv",
      "partially_effective": "Teilweise effektiv",
      "not_tested": "Nicht getestet"
    }
  },
  "findings": {
    "title": "Findings",
    "create": "Finding erstellen",
    "severities": {
      "observation": "Beobachtung",
      "recommendation": "Empfehlung",
      "improvement_requirement": "Verbesserungsbedarf",
      "insignificant_nonconformity": "Unwesentliche Nichtkonformität",
      "significant_nonconformity": "Wesentliche Nichtkonformität"
    },
    "statuses": {
      "identified": "Identifiziert",
      "in_remediation": "In Behebung",
      "remediated": "Behoben",
      "verified": "Verifiziert",
      "accepted": "Akzeptiert",
      "closed": "Geschlossen"
    }
  },
  "rcm": {
    "title": "Risiko-Kontroll-Matrix",
    "effectiveness": {
      "full": "Vollständig",
      "partial": "Teilweise",
      "planned": "Geplant",
      "none": "Keine"
    },
    "gaps": "Lücken",
    "uncontrolled": "Risiko ohne Kontrolle"
  }
}
```

## 11.2 DMS Module — `messages/de/documents.json`

```json
{
  "documents": {
    "title": "Dokumentenablage",
    "subtitle": "{count} Dokumente",
    "create": "Dokument erstellen",
    "detail": "Dokumentdetails",
    "edit": "Dokument bearbeiten",
    "fields": {
      "title": "Titel",
      "category": "Kategorie",
      "content": "Inhalt",
      "owner": "Dokumentenverantwortlicher",
      "reviewer": "Prüfer",
      "status": "Status",
      "version": "Version",
      "publishedAt": "Veröffentlicht am",
      "expiresAt": "Ablaufdatum",
      "requiresAcknowledgment": "Kenntnisnahme erforderlich",
      "tags": "Schlagworte"
    },
    "categories": {
      "policy": "Richtlinie",
      "procedure": "Verfahrensanweisung",
      "guideline": "Leitlinie",
      "template": "Vorlage",
      "record": "Nachweis",
      "tom": "TOM",
      "dpa": "AVV",
      "bcp": "Notfallplan",
      "soa": "SoA",
      "other": "Sonstige"
    },
    "statuses": {
      "draft": "Entwurf",
      "in_review": "In Prüfung",
      "approved": "Freigegeben",
      "published": "Veröffentlicht",
      "archived": "Archiviert",
      "expired": "Abgelaufen"
    },
    "tabs": {
      "content": "Inhalt",
      "versions": "Versionen",
      "linkages": "Verknüpfungen",
      "acknowledgments": "Kenntnisnahme",
      "evidence": "Nachweise",
      "history": "Historie"
    },
    "acknowledgment": {
      "title": "Dokumenten-Kenntnisnahme",
      "banner": "Dieses Dokument erfordert Ihre Kenntnisnahme",
      "button": "Gelesen und zur Kenntnis genommen",
      "confirmed": "Bestätigt am {date} (Version {version})",
      "pending": "Ausstehend",
      "compliance": "Compliance",
      "sendReminder": "Erinnerung senden",
      "sendAllReminders": "Erinnerung an alle ausstehenden senden"
    },
    "versions": {
      "title": "Versionsverlauf",
      "view": "Anzeigen",
      "compare": "Vergleichen",
      "restore": "Wiederherstellen",
      "restoreConfirm": "Version {version} wiederherstellen? Der Status wird auf 'Entwurf' zurückgesetzt.",
      "changeSummary": "Änderungsbeschreibung"
    }
  },
  "search": {
    "title": "Suche",
    "placeholder": "Dokumente, Kontrollen, Risiken durchsuchen...",
    "noResults": "Keine Ergebnisse für \"{query}\"",
    "scope": {
      "all": "Alles",
      "documents": "Dokumente",
      "controls": "Kontrollen",
      "risks": "Risiken"
    }
  }
}
```

English translations follow the same structure in `messages/en/controls.json` and `messages/en/documents.json` with all keys translated.
