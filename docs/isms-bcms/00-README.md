# ISMS & BCMS Programm-Dokumentation

**Stand:** 2026-04-30
**Geltungsbereich:** ARCTOS Plattform — ISMS-, BCMS-, NIS2-, DORA-Module
**Normen-Basis:** ISO/IEC 27001:2022, ISO/IEC 27005:2022, ISO 22301:2019, NIS2 (RL (EU) 2022/2555), DORA (VO (EU) 2022/2554)

## Dokument-Set

| # | Dokument | Zweck |
|---|----------|-------|
| 01 | [PDCA — Einführungs- & Implementierungszyklus](./01-pdca-introduction-cycle.md) | Erst-Etablierung des ISMS (Plan/Do/Check/Act für die Implementierungsphase) |
| 02 | [PDCA — Regulärer Betriebszyklus](./02-pdca-regular-cycle.md) | Jährlicher Betriebszyklus nach Inbetriebnahme |
| 03 | [Roadmap Jahr 1 — ISMS + 27005 + 22301 + NIS2 + DORA](./03-roadmap-year-1.md) | Vollständiger Einführungs-Ablaufplan mit Meilensteinen, Owner, Artefakten |
| 04 | [Roadmap Jahr 2 — Festigung & KVP](./04-roadmap-year-2.md) | Konsolidierung, interne Audit, Re-Zertifizierung |
| 05 | [Anforderungskatalog ISMS + BCMS](./05-requirements-catalog.md) | Alle funktionalen + nicht-funktionalen Anforderungen für die Software |
| 06 | [Detaillierter Testplan](./06-test-plan.md) | Test-Strategie, -Cases, -Daten, -Umgebung |
| 07 | [Test-Execution-Report + Gap-Liste](./07-test-execution-report.md) | Ausführung, identifizierte Bugs/Lücken |
| 08 | [Gap-Closure-Report](./08-gap-closure-report.md) | Geschlossene Punkte + verbleibendes Backlog |
| 09 | [Final Summary & Acceptance](./09-final-summary.md) | Übergabe-Dokument |

## Lese-Reihenfolge

1. **Geschäfts-Sicht:** 03 → 04 → 05
2. **Norm-Sicht:** 01 → 02 → 03 → 04
3. **Engineering-Sicht:** 05 → 06 → 07 → 08

## Zielgruppen

- **CISO / ISMS-Beauftragter:** 01, 02, 03, 04
- **BCM-Beauftragter:** 03 (BCM-Track), 04, 05 (BCMS-Sektion)
- **Auditor (intern/extern):** 02, 09
- **Produkt- / Engineering-Team:** 05, 06, 07, 08
- **Geschäftsleitung:** 03, 09 (Executive Summary)

## Versions- und Änderungsführung

Diese Dokumente sind versionierter Bestandteil des Repositories. Änderungen über PR mit Review durch CISO + Engineering-Lead. Inhaltliche Aktualisierung mindestens **jährlich** im Rahmen des Management-Reviews (siehe Doc 02 §M-REV).

## Konventionen

- **Klauselbezüge** in der Form `[27001 §6.1.2]`, `[22301 §8.4]`, `[NIS2 Art. 21]`, `[DORA Art. 6]` etc.
- **Anforderungs-IDs:** `REQ-ISMS-NNN`, `REQ-BCMS-NNN`, `REQ-NIS2-NNN`, `REQ-DORA-NNN`
- **Test-Case-IDs:** `TC-<Modul>-<Nummer>`
- **Gap-IDs:** `GAP-<Modul>-<Nummer>`
- **Status-Marker:** `IMPLEMENTED`, `PARTIAL`, `OPEN`, `PLANNED-Y1`, `PLANNED-Y2`
