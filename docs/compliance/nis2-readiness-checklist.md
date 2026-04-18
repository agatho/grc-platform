# EU NIS2 (Directive 2022/2555) — ARCTOS Readiness Checklist

_Stand: 2026-04-18_

Basis: NIS2-Richtlinie, nationale Umsetzung in DE via NIS2UmsuCG (BMI-Referentenentwurf 2024). Relevant fuer **wesentliche** und **wichtige Einrichtungen** in 18 Sektoren (Annex I+II).

**Legende**: ✅ abgedeckt · ◑ teilweise · ☐ Luecke

## Art. 20 — Cybersecurity Risk Management Measures

| § | Requirement | ARCTOS-Support | Status |
|---|---|---|---|
| 20(1) | Governance, Zustaendigkeiten, Leitungsorgan haftet | RBAC + Board-Report-Modul + `approval_workflow` | ✅ |
| 20(2)(a) | Risk-Analyse-Policies | `erm.risk_methodology` mit Lifecycle-Approval | ✅ |
| 20(2)(b) | Incident Handling | ICS/ISMS Incident-Modul, Playbooks (Sprint 16) | ✅ |
| 20(2)(c) | Business Continuity & Crisis Management | BCMS-Modul komplett | ✅ |
| 20(2)(d) | Supply Chain Security | TPRM + Vendor-Due-Diligence + LkSG | ✅ |
| 20(2)(e) | Security in Network/Information-System Acquisition/Dev/Maintenance | Process-Governance + SDLC-Kontrollen via ISO 27002 Cat #4 | ◑ — SDLC-Templates fehlen |
| 20(2)(f) | Assessment of Effectiveness | `control_maturity` (CMMI-Level), `control_test` | ✅ |
| 20(2)(g) | Basic cyber hygiene & training | Academy + `compliance_culture` + `kri` (Phishing-Clicks) | ◑ |
| 20(2)(h) | Cryptography | Asset-Klassifikation mit Encryption-Felder (in `asset.isms_properties`) | ◑ — Key-Management-Tracker fehlt |
| 20(2)(i) | Human Resources / Access Control | RBAC + LoD + `user_organization_role` | ✅ |
| 20(2)(j) | MFA / secure communications / emergency-comm | Auth.js MFA + `incident.communication` | ✅ |

## Art. 21 — Reporting Obligations

| § | Frist | ARCTOS-Support | Status |
|---|---|---|---|
| 21(4)(a) | Early warning binnen 24h | `incident.notification_timeline` + Eskalation | ✅ |
| 21(4)(b) | Incident notification binnen 72h | dto | ✅ |
| 21(4)(c) | Final report binnen 1 Monat | `incident.final_report` + Attachment | ✅ |
| 21(4)(d) | Progress reports auf Authority-Anforderung | `ai_authority_communication`-Pattern, uebertragen auf generic `authority_communication` | ☐ — noch AI-spezifisch, Generalisierung offen |

## Art. 23 — Vulnerability Disclosure

| § | Requirement | ARCTOS-Support | Status |
|---|---|---|---|
| 23(1) | Coordinated Vulnerability Disclosure | **SECURITY.md** (commit 9ac971e) + GitHub Security Advisory | ✅ |
| 23(3) | Vulnerability Information Sharing | `isms.vulnerability` + CVE-Feed (Sprint 24) | ✅ |

## Annex I (Sectors of High Criticality)

ARCTOS selbst faellt als "digital infrastructure" / "ICT service management (B2B)" potenziell unter NIS2, wenn die Zielkunden wichtige/wesentliche Einrichtungen sind. Fuer CWS/Haniel ist eine Sektor-Einstufung tenantspezifisch.

## Governance-Haftung (Art. 20 Abs. 1)

NIS2 macht **Leitungsorgane persoenlich haftbar** fuer fehlende Cyber-Risk-Mgmt. ARCTOS unterstuetzt Nachweise via:
- `management_review` mit Attendees + Signed-Off-By
- `approval_decision` mit Approver-Identity + Timestamp
- `audit_log` (SHA-256-Chain) fuer Immutable-Proof

## Luecken-Zusammenfassung

| Luecke | Severity | Vorschlag |
|---|---|---|
| SDLC-Templates (Art. 20(2)(e)) | Medium | Process-Templates fuer Secure-SDLC (OWASP SAMM) seeden |
| Key-Management-Tracker (Art. 20(2)(h)) | Medium | `crypto_key` Entitaet mit Rotation + Ownership |
| Generische `authority_communication` (Art. 21(4)(d)) | High — Reporting-Pflicht | Tabelle generalisieren: aktuell nur AI-Act, braucht auch NIS2, DORA, GDPR |
| Phishing-Simulation-Kampagnen | Low | Integration zu externem Provider (z. B. KnowBe4) via Connector |

## Kompatibilitaet mit anderen Frameworks

- **ISO 27001**: 33 Cross-Framework-Mappings (Catalog NIS2 #12 ↔ Catalog ISO 27001 #16)
- **DORA**: 25 Mappings — fuer Finanzsektor ist DORA die speziellere Norm
- **BSI IT-Grundschutz**: indirekt via BSI-Kataloge #15
