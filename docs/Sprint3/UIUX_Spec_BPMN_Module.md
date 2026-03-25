# ARCTOS — UI/UX Specification: BPMN Process Modeling Module

Sprint 3 — BPMN Process Modeling
Pixel-accurate implementation guide for Claude Code

---

# 1. Page Structure & Navigation

## 1.1 Sidebar Entries (Sprint 3)

Sprint 3 does NOT register hardcoded sidebar entries. The Process Management section appears automatically when `bpm` is enabled in `module_config`. Nav entries are defined by the Sprint 1.3 seed in `module_definition` for `module_key='bpm'`:

```
── Prozessmanagement ────────── (group header, DE: "Prozessmanagement" / EN: "Process Management")
   ├── 🔀  Prozesslandkarte     → /processes        (roles: all)
   └── (future: Process Portal)
```

Sidebar icon color: use Tailwind `text-indigo-500` for BPM module icons (distinguish from orange=Risk, blue=Org).

## 1.2 Route Overview

| Route | Component | Access |
| --- | --- | --- |
| `/processes` | ProcessLandscapePage | all roles |
| `/processes/new` | CreateProcessPage | admin, process_owner |
| `/processes/[id]` | ProcessDetailPage | all roles |
| `/processes/[id]#overview` | ProcessDetailPage (Overview tab) | all roles |
| `/processes/[id]#editor` | ProcessDetailPage (BPMN Editor tab) | all roles (edit: admin, process_owner) |
| `/processes/[id]#versions` | ProcessDetailPage (Versions tab) | all roles |
| `/processes/[id]#risks` | ProcessDetailPage (Risks tab) | all roles |
| `/processes/[id]#history` | ProcessDetailPage (History tab) | all roles |

## 1.3 Breadcrumb Pattern

All process pages use this breadcrumb pattern:
- Landscape: `Dashboard > Prozessmanagement > Prozesslandkarte`
- Detail: `Dashboard > Prozessmanagement > [Process Name truncated to 40 chars]`
- New: `Dashboard > Prozessmanagement > Neuer Prozess`

Breadcrumb component: reuse Sprint 1 `<Breadcrumb>` component.

---

# 2. Process Landscape Page (`/processes`)

## 2.1 Page Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                                │
│                                                                              │
│  Prozesslandkarte                                           [+ Neuer Prozess]│
│  [Org Name] · 42 Prozesse · 12 veröffentlicht                               │
│                                                                              │
│  ┌───────────────────┬───────────────────────────────────────────────────┐   │
│  │  Process Tree      │  Content Area                                    │   │
│  │  ┌──────────────┐ │                                                   │   │
│  │  │ 🔍 Suchen... │ │   ┌─────────────────────────────────────────┐    │   │
│  │  └──────────────┘ │   │                                         │    │   │
│  │                    │   │    Select a process from the tree       │    │   │
│  │  ▼ 📂 Konzern     │   │    on the left to view details          │    │   │
│  │    ▶ 📁 CWS-Boco  │   │                                         │    │   │
│  │    ▶ 📁 TAKKT     │   │    ─── or ───                           │    │   │
│  │    ▶ 📁 Haniel    │   │                                         │    │   │
│  │    ▶ 📁 Schacht1  │   │    [+ Create your first process]        │    │   │
│  │    ▶ 📁 ELG       │   │                                         │    │   │
│  │                    │   └─────────────────────────────────────────┘    │   │
│  │  ─── Filter ───   │                                                   │   │
│  │  Status: [All ▾]  │                                                   │   │
│  │  Level:  [All ▾]  │                                                   │   │
│  └───────────────────┴───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Process Tree (Left Panel — 280px width)

**Dimensions:** Fixed width 280px. Full height minus header. Scrollable with custom scrollbar.

**Tree Node Structure:**
```
▼ 📂 CWS-Boco Operations                    ● Published
  ▼ 📁 Sales                                 ○ Draft
    ├── 📄 Sales Order Processing            ● Published
    ├── 📄 Customer Onboarding               ◐ In Review
    └── 📄 Returns Handling                  ○ Draft
  ▶ 📁 Procurement
  ▶ 📁 IT
```

**Node Elements:**
- Expand/collapse triangle (▶/▼) — only on nodes with children
- Icon: 📂 for groups with children, 📄 for leaf processes
- Process name — truncated at 200px with ellipsis
- Status indicator (right-aligned): ● green=published, ◐ yellow=in_review, ◉ blue=approved, ○ gray=draft, ◌ red=archived

**Interactions:**
- Click node → navigate to `/processes/[id]`
- Right-click → context menu: Edit, Delete, Create Child Process
- Expand node → GET /api/v1/processes/tree?parentId=[id] (lazy loading)
- Drag-to-reorder: NOT in Sprint 3 (Phase 2 feature)

**Search:**
- Search input at top, 12px padding around
- Debounced (300ms) client-side filter on loaded nodes
- If query > 3 chars and no local results → server-side search via GET /api/v1/processes?search=[query]
- Highlight matching text in node names

**Filters (below tree):**
- Status dropdown: All, Draft, In Review, Approved, Published, Archived
- Level dropdown: All, 1 (Group), 2 (Company), 3 (Department), 4+ (Detail)
- Filters apply immediately (no "Apply" button)

## 2.3 Content Area (Right Panel)

**Default state:** Empty placeholder with illustration and text "Prozess aus der Baumstruktur links auswählen" / "Select a process from the tree on the left".

**When process selected:** Show inline preview with:
- Process name + status badge
- Description (first 200 chars)
- Owner name, Reviewer name
- Quick stats: version count, linked risk count
- "Open" button → navigates to `/processes/[id]`

**Mobile (< 768px):** Full-width tree view only. No side-by-side layout. Clicking a process navigates directly to the detail page.

---

# 3. Process Detail Page (`/processes/[id]`)

## 3.1 Page Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Header                                                                   ││
│  │                                                                          ││
│  │  📄 Sales Order Processing                    [Submit for Review] [Edit] ││
│  │  ┌─────────┐  Level 3 · Sales · v3           [Generate with AI]         ││
│  │  │ ● Draft │  Owner: Max Mustermann                                     ││
│  │  └─────────┘  Reviewer: Anna Schmidt                                    ││
│  │                                                                          ││
│  │  ⚠️ 2 Prozessrisiken                                                    ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────┬───────────┬───────────┬──────────┬──────────┐                 │
│  │ Overview │BPMN Editor│ Versions  │  Risks   │ History  │                 │
│  └──────────┴───────────┴───────────┴──────────┴──────────┘                 │
│                                                                              │
│  [Tab Content Area — full width below tabs]                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Header Section

**Process Name:** `text-2xl font-bold text-foreground`. Editable inline (click to edit) for process_owner/admin.

**Status Badge:** Same colored badges as in tree view. Larger size: `text-sm px-3 py-1 rounded-full font-medium`.
- Draft: `bg-gray-100 text-gray-700`
- In Review: `bg-yellow-100 text-yellow-800`
- Approved: `bg-blue-100 text-blue-700`
- Published: `bg-green-100 text-green-700`
- Archived: `bg-red-100 text-red-700`

**Metadata line:** `text-sm text-muted-foreground`. Format: "Level {N} · {Department} · v{version}". Below: "Owner: {name}" and "Reviewer: {name}".

**Process Risk Banner:** If process-level risks exist (via `process_risk`), show: orange banner `bg-orange-50 border-l-4 border-orange-400 p-3` with "⚠️ {count} Prozessrisiken" / "⚠️ {count} Process Risks". Clickable → navigates to Risks tab.

**Action Buttons (right-aligned in header):**
- Context-dependent based on status + role (see PRD US-14.2)
- Primary action: filled button (`bg-primary text-primary-foreground`)
- Secondary actions: outlined buttons
- "Edit" button: outline, pencil icon
- "Generate with AI" button: outline, sparkles icon (visible for admin, process_owner)

## 3.3 Tab Bar

Use shadcn/ui `Tabs` component. Active tab has `border-b-2 border-primary text-primary font-medium`.

Tab labels (i18n): Overview | BPMN Editor | Versions | Risks | History

Tab selection persisted in URL hash: `/processes/[id]#editor`.

---

# 4. BPMN Editor Tab

## 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Toolbar                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ [💾 Save] [⬇️ Export ▾] [🔙 Undo] [🔁 Redo]  v3 · ⚠️ Unsaved changes│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────┬──────────────────────────┐              │
│  │ BPMN Canvas (70%)              │ Side Panel (30%)          │              │
│  │                                │                          │              │
│  │  ┌───────────┐                │  ┌─ Task_CheckOrder ────┐│              │
│  │  │ ○ Start   │──▶┌──────┐    │  │ 📋 User Task        ││              │
│  │  └───────────┘   │Check │    │  │                      ││              │
│  │                   │Order │    │  │ ── Linked Risks ──── ││              │
│  │        ┌──────┐   │ 3🔴20│    │  │                      ││              │
│  │        │      │◀──└──────┘    │  │ RSK00000012          ││              │
│  │        │ ◇    │               │  │ Data Entry Error     ││              │
│  │        │      │──▶┌──────┐    │  │ ■■■ 16 · Assessed   ││              │
│  │        └──────┘   │Proc. │    │  │                      ││              │
│  │                   │Order │    │  │ RSK00000045          ││              │
│  │                   └──────┘    │  │ System Downtime      ││              │
│  │                    │          │  │ ■■■■ 20 · Treated    ││              │
│  │                    ▼          │  │                      ││              │
│  │               ┌──────┐       │  │ [+ Link Risk]        ││              │
│  │               │ ○ End│       │  │                      ││              │
│  │               └──────┘       │  │ ── Responsible Role ─││              │
│  │                              │  │ [Sales Manager    ]  ││              │
│  │  [Minimap]                   │  │                      ││              │
│  │                              │  │ ── Controls (S4) ─── ││              │
│  │                              │  │ Available in Sprint 4 ││              │
│  │                              │  └──────────────────────┘│              │
│  └────────────────────────────────┴──────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Toolbar

**Height:** 48px. Background: `bg-muted/50`. Border bottom: `border-b`.

**Left section:**
- Save button: `bg-primary text-white px-4 py-1.5 rounded-md text-sm font-medium`. Icon: `Save` from lucide-react. Disabled when no changes. Shows "Saving..." with spinner during save. Shows "Saved ✓" (green) for 2 seconds after save.
- Export dropdown: `<DropdownMenu>` with 3 options (BPMN XML, SVG, PNG). Icon: `Download`.
- Undo button: `<Button variant="ghost" size="sm">`. Icon: `Undo2`. Disabled when no history.
- Redo button: `<Button variant="ghost" size="sm">`. Icon: `Redo2`. Disabled when no forward history.

**Right section:**
- Version indicator: `text-sm text-muted-foreground`. "v{number}".
- Unsaved changes indicator: `text-sm text-orange-600 font-medium`. "⚠️ Unsaved changes". Only visible when changes exist.
- Read-only indicator (for viewers): `bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium`. "Read Only".

## 4.3 BPMN Canvas

**Width:** 70% of available width (when side panel is open), 100% when side panel is closed.
**Height:** Full remaining height (viewport height - header - toolbar - tabs).
**Background:** White with light dot grid pattern (bpmn.js default).

**Minimap:** Bottom-right corner, 150x100px. Shows overview of entire diagram. Draggable viewport indicator.

**Risk Badges on Shapes:**
- Position: top-right corner of the BPMN shape, offset by -14px top, -14px right.
- Format: pill shape with `[count] [emoji] [score]`.
- Colors: green (score ≤ 8), yellow (9-15), red (> 15).
- Size: `text-xs font-semibold px-2 py-0.5 rounded-full`.
- Shadow: `shadow-sm`.
- Hover: scale 1.1 with transition.
- Click: opens side panel for that shape (same as clicking the shape itself).

## 4.4 Side Panel

**Width:** 30% of editor area, min 320px, max 450px.
**Background:** `bg-background`. Border left: `border-l`.
**Animation:** Slide in from right, 200ms ease-out.

**Visibility:** Hidden by default. Opens on shape click. Closes on: ESC key, click X button, click canvas background.

**Header (56px):**
- BPMN element icon (task=CheckSquare, gateway=GitBranch, event=Circle, subprocess=Layers) from lucide-react
- Element name: `text-base font-semibold`
- Element type: `text-xs text-muted-foreground`
- Close button: X icon, top-right

**Section: Linked Risks**
```
── Linked Risks ─────────────────────
RSK00000012                    [🗑️]
Data Entry Error
■■■ 16 · Assessed

RSK00000045                    [🗑️]
System Downtime
■■■■ 20 · Treated

[+ Link Risk ─────────────── 🔍]
  Search results dropdown:
  ┌─────────────────────────────────┐
  │ RSK00000067                     │
  │ Supply Chain Disruption · 12    │
  ├─────────────────────────────────┤
  │ RSK00000089                     │
  │ Regulatory Non-Compliance · 9   │
  └─────────────────────────────────┘
```

Each risk card:
- RSK element ID: `text-xs font-mono text-muted-foreground`
- Title: `text-sm font-medium`
- Score bar: colored blocks (green/yellow/red based on score)
- Status badge: small pill
- Unlink button: trash icon, visible on hover, right-aligned. Click → confirmation dialog.

Link Risk search:
- Input with search icon, placeholder "Risiko suchen..."
- Debounced 300ms search
- Results in dropdown below input
- Click result → creates link + closes dropdown + refreshes list + updates BPMN overlay

**Section: Responsible Role**
- Text input: `process_step.responsible_role`
- Editable only by admin, process_owner
- Save on blur with PUT /api/v1/processes/:id/steps/:stepId

**Section: Controls (Placeholder)**
- Gray text: "Controls will be available in Sprint 4"
- Icon: lock icon

---

# 5. Overview Tab

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Overview                                                                    │
│                                                                              │
│  ┌──────────────────────────────┬────────────────────────────────────────┐   │
│  │ Details                       │ BPMN Preview                          │   │
│  │                              │                                        │   │
│  │ Name:        Sales Order...  │  ┌────────────────────────────────┐    │   │
│  │ Description: End-to-end...   │  │                                │    │   │
│  │ Level:       3 (Department)  │  │  [Read-only BPMN Viewer]       │    │   │
│  │ Department:  Sales           │  │  showing current published     │    │   │
│  │ Notation:    BPMN 2.0        │  │  or latest draft version       │    │   │
│  │ Owner:       Max Mustermann  │  │                                │    │   │
│  │ Reviewer:    Anna Schmidt    │  │                                │    │   │
│  │ Status:      ● Published     │  └────────────────────────────────┘    │   │
│  │ Version:     v3              │                                        │   │
│  │ Published:   24.03.2026      │                                        │   │
│  │ Essential:   No              │                                        │   │
│  │                              │                                        │   │
│  │ ── Process Steps ──────────  │                                        │   │
│  │ 1. ○ Order Received (Event)  │                                        │   │
│  │ 2. 📋 Check Order (Task)     │                                        │   │
│  │ 3. ◇ Order Valid? (Gateway)  │                                        │   │
│  │ 4. 📋 Process Order (Task)   │                                        │   │
│  │ 5. 📋 Confirm Delivery       │                                        │   │
│  │ 6. ○ Order Completed (Event) │                                        │   │
│  └──────────────────────────────┴────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Details column (50%):** Two-column key-value display. Keys are `text-sm text-muted-foreground`, values are `text-sm text-foreground font-medium`.

**BPMN Preview (50%):** Read-only BpmnViewer showing the current version. Risk overlays visible. Height: 400px min.

**Process Steps list:** Ordered list of all process_step records. Icon by step_type. Name + type label.

---

# 6. Versions Tab

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Version History                                                             │
│                                                                              │
│  ── Timeline ─────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌─ v3 ──────────────────────────────────────────────────── Current ───────┐ │
│  │ │ 24.03.2026 14:32 · Max Mustermann                                    │ │
│  │ │ "Fixed gateway conditions for order validation"                       │ │
│  │ │                                                     [View] [Restore]  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  │                                                                           │
│  ┌─ v2 ───────────────────────────────────────────────────────────────────┐  │
│  │ │ 22.03.2026 10:15 · Max Mustermann                                    │ │
│  │ │ "Added delivery confirmation step"                                    │ │
│  │ │                                                     [View] [Restore]  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  │                                                                           │
│  ┌─ v1 ───────────────────────────────────────────────────────────────────┐  │
│  │ │ 20.03.2026 09:00 · Max Mustermann                                    │ │
│  │ │ "Initial version — Sales Order Processing"                            │ │
│  │ │                                                     [View] [Restore]  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [Compare Versions]                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Version Card:**
- Left border: vertical line (timeline connector), `border-l-2 border-primary/30`
- Current version: `border-l-2 border-primary`, with "Current" badge (`bg-primary/10 text-primary text-xs`)
- Version number: `text-lg font-bold text-foreground`
- Date: `text-sm text-muted-foreground`. Format: DD.MM.YYYY HH:mm
- Creator: `text-sm text-muted-foreground`
- Change summary: `text-sm text-foreground italic`
- "View" button: `<Button variant="outline" size="sm">` — opens modal with read-only BpmnViewer
- "Restore" button: `<Button variant="outline" size="sm">` — only visible for admin role

**Compare button (bottom):** Opens a modal allowing selection of two versions, shown side by side in BpmnViewer components.

---

# 7. Risks Tab

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Risks                                                                       │
│                                                                              │
│  ── Process Risks ────────────────────────────────────────── [+ Link Risk] ─ │
│  Risks affecting the entire process                                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ RSK00000003 · Supply Chain Disruption · ■■■ 15 · Assessed    [Unlink] │  │
│  │ Context: "Affects overall procurement reliability"                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ── Step Risks ──────────────────────────────────────────────────────────── │
│  Risks at individual process steps                                           │
│                                                                              │
│  📋 Check Order Completeness (Task)                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ RSK00000012 · Data Entry Error · ■■■■ 16 · Assessed          [Unlink] │  │
│  │ RSK00000045 · System Downtime · ■■■■■ 20 · Treated           [Unlink] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  📋 Process Order (Task)                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ RSK00000067 · Regulatory Non-Compliance · ■■ 9 · Identified  [Unlink] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ◇ Order Valid? (Gateway)                                                    │
│  No risks linked.                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Process Risks Section:**
- Header with "+ Link Risk" button (for admin, process_owner, risk_manager)
- Description text: `text-sm text-muted-foreground`
- Risk cards showing: RSK element ID, title, score bar, status, context text, unlink button

**Step Risks Section:**
- Grouped by BPMN shape (process_step)
- Shape header: icon + name + type
- Risk cards same format as process risks
- Steps with no risks: "No risks linked." in muted text
- Only steps that are not soft-deleted are shown

**Risk Card Format:**
- RSK ID: `text-xs font-mono text-primary` — clickable, links to `/risks/[id]`
- Title: `text-sm font-medium`
- Score indicator: colored blocks (1-25 scale)
- Status: small badge
- Unlink button: only visible on hover, for authorized roles

---

# 8. History Tab

Reuses the Sprint 1 audit_log display pattern. Shows all audit log entries for this process, ordered newest first.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  History                                                                     │
│                                                                              │
│  24.03.2026 14:32 · Max Mustermann                                          │
│  Status changed from "draft" to "in_review"                                  │
│  Comment: "Ready for review"                                                 │
│                                                                              │
│  24.03.2026 14:30 · Max Mustermann                                          │
│  Version v3 created                                                          │
│  "Fixed gateway conditions for order validation"                             │
│                                                                              │
│  22.03.2026 10:15 · Max Mustermann                                          │
│  Version v2 created                                                          │
│  "Added delivery confirmation step"                                          │
│                                                                              │
│  20.03.2026 09:00 · Max Mustermann                                          │
│  Process created                                                             │
│  "Initial version — Sales Order Processing"                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. Create Process Page (`/processes/new`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]                                                                │
│                                                                              │
│  Neuer Prozess                                                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │  Prozessname *                                                       │    │
│  │  ┌──────────────────────────────────────────────────────────────┐    │    │
│  │  │ Sales Order Processing                                       │    │    │
│  │  └──────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  Beschreibung                                                        │    │
│  │  ┌──────────────────────────────────────────────────────────────┐    │    │
│  │  │ End-to-end sales order handling...                           │    │    │
│  │  │                                                              │    │    │
│  │  └──────────────────────────────────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  Ebene *                    Übergeordneter Prozess                   │    │
│  │  ┌─────────────────┐       ┌───────────────────────────────────┐    │    │
│  │  │ 3 - Abteilung ▾│       │ (Tree select) CWS > Operations   ▾│    │    │
│  │  └─────────────────┘       └───────────────────────────────────┘    │    │
│  │                                                                      │    │
│  │  Prozessverantwortlicher    Prüfer                                   │    │
│  │  ┌─────────────────┐       ┌─────────────────────────┐              │    │
│  │  │ Max Mustermann ▾│       │ Anna Schmidt           ▾│              │    │
│  │  └─────────────────┘       └─────────────────────────┘              │    │
│  │                                                                      │    │
│  │  Abteilung                  Notation                                 │    │
│  │  ┌─────────────────┐       ┌─────────────────┐                      │    │
│  │  │ Sales            │       │ BPMN 2.0       ▾│ (disabled)           │    │
│  │  └─────────────────┘       └─────────────────┘                      │    │
│  │                                                                      │    │
│  │  ☐ Wesentlicher Prozess (für BIA)                                    │    │
│  │                                                                      │    │
│  │  ─── or ───                                                          │    │
│  │                                                                      │    │
│  │  [✨ Generate with AI]  ← Opens AI generation modal                  │    │
│  │                                                                      │    │
│  │                                   [Cancel]  [Create Process]         │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Form validation:** Name required (min 3 chars). Level required. All other fields optional. Zod schema validation on submit.

**Parent Process selector:** Tree dropdown showing existing processes. Selecting a parent auto-sets level to parent.level + 1.

**Notation dropdown:** Only "BPMN 2.0" available in Sprint 3. Disabled with tooltip "Additional notations in future releases."

**Essential Process checkbox:** Tooltip explaining "Mark as essential for Business Continuity planning (Sprint 6)."

---

# 10. AI Generation Modal

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ✨ Generate Process with AI                                         [X]    │
│                                                                              │
│  Describe the process you want to model, and AI will generate a             │
│  BPMN diagram as a starting point.                                          │
│                                                                              │
│  Prozessname                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ Incident Response Process                                        │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  Beschreibung (mind. 50 Zeichen)                                            │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ When a security incident is detected, classify it by severity,   │       │
│  │ assign to the appropriate response team, contain the threat,     │       │
│  │ investigate root cause, remediate, and document lessons learned.  │       │
│  │ Critical incidents require CISO notification within 1 hour.      │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│  142 / 2000 characters                                                      │
│                                                                              │
│  Branchenkontext                                                             │
│  ┌──────────────────────────────────────────┐                               │
│  │ IT-Dienstleistungen                     ▾│                               │
│  └──────────────────────────────────────────┘                               │
│                                                                              │
│                                              [Cancel]  [✨ Generate]        │
│                                                                              │
│  ── After generation: ──────────────────────────────────────────────────── │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                                                                  │       │
│  │              [Read-only BPMN Viewer preview]                     │       │
│  │              showing the AI-generated diagram                    │       │
│  │                                                                  │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│                           [🔄 Regenerate]  [✅ Accept and Edit]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Loading state:** Replace the form with a centered animation: sparkles spinning around a process icon. Text: "KI generiert Prozessmodell..." / "AI generating process model..."

**Preview:** BpmnViewer showing the generated BPMN. Height: 400px.

**Actions:**
- "Regenerate": calls AI again with same inputs
- "Accept and Edit": loads BPMN into the editor (creates process if from create form, or replaces current XML if from editor)

---

# 11. Mobile Considerations

**Process Landscape (< 768px):**
- Full-width tree view, no side-by-side layout
- Clicking a process navigates to detail page

**Process Detail (< 768px):**
- Tab bar scrollable horizontally
- BPMN Editor tab: show message "BPMN-Editor ist auf mobilen Geräten nicht verfügbar. Bitte verwenden Sie einen Desktop-Browser." / "BPMN editor is not available on mobile devices. Please use a desktop browser." with a static SVG preview of the latest published version (if available).
- Side panel: full-screen overlay instead of side panel
- All other tabs render normally with responsive adjustments

---

# 12. Color Reference

| Element | Light Mode | Dark Mode |
| --- | --- | --- |
| Tree selected node bg | `bg-primary/10` | `bg-primary/20` |
| Status: Draft | `bg-gray-100 text-gray-700` | `bg-gray-800 text-gray-300` |
| Status: In Review | `bg-yellow-100 text-yellow-800` | `bg-yellow-900 text-yellow-300` |
| Status: Approved | `bg-blue-100 text-blue-700` | `bg-blue-900 text-blue-300` |
| Status: Published | `bg-green-100 text-green-700` | `bg-green-900 text-green-300` |
| Status: Archived | `bg-red-100 text-red-700` | `bg-red-900 text-red-300` |
| Risk badge green | `bg-green-100 text-green-800` | same |
| Risk badge yellow | `bg-yellow-100 text-yellow-800` | same |
| Risk badge red | `bg-red-100 text-red-800` | same |
| BPM module accent | `text-indigo-500` | `text-indigo-400` |
