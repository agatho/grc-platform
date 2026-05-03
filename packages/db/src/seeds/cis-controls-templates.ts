// CIS Controls v8 — Programme Templates für Implementation Groups IG1, IG2, IG3
//
// CIS Critical Security Controls v8 ist ein priorisierter Maßnahmenkatalog
// (18 Controls, 153 Safeguards) der Center for Internet Security. Die
// Implementation Groups gruppieren Safeguards nach Reife/Ressourcen:
//
//   IG1 (Implementation Group 1): "Essential Cyber Hygiene" — 56 Safeguards.
//        Mindestziel für jede Organisation, Fokus auf Standardabwehr gegen
//        opportunistische Angriffe.
//   IG2 (Implementation Group 2): IG1 + 74 weitere = 130 Safeguards.
//        Enterprise-Cybersecurity, schützt vor zielgerichteten Angriffen.
//   IG3 (Implementation Group 3): IG2 + 23 weitere = 153 Safeguards.
//        Schutz vor APT, Insider-Bedrohungen, Zero-Day-Risiken.
//
// Additivität: Jede höhere IG enthält ALLE Safeguards der niedrigeren plus
// zusätzliche. Diese 3 Templates spiegeln das wider — IG2 ist Superset von
// IG1, IG3 Superset von IG2.
//
// Bezug:
//   - https://www.cisecurity.org/controls/v8
//   - CIS Controls v8.1.1 Mappings (für Cross-Framework-Verknüpfung)

import type { MsType, PdcaPhase } from "../schema/programme";

// Re-using the SeedTemplate interface from programme-templates.ts.
// We export only the 3 templates; the seeder consumes them via the
// PROGRAMME_TEMPLATE_SEEDS array there.

interface SeedSubtask {
  title: string;
  description?: string;
  defaultOwnerRole?: string;
  defaultDurationDays?: number;
  deliverableType?: string;
  isMandatory?: boolean;
}

interface SeedStep {
  code: string;
  phaseCode: string;
  sequence: number;
  name: string;
  description?: string;
  isoClause?: string;
  defaultOwnerRole?: string;
  defaultDurationDays: number;
  prerequisiteStepCodes?: string[];
  targetModuleLink?: {
    module?: string;
    route?: string;
    entityType?: string;
    createIfMissing?: boolean;
  };
  requiredEvidenceCount?: number;
  isMandatory?: boolean;
  isMilestone?: boolean;
  subtasks?: SeedSubtask[];
}

interface SeedPhase {
  code: string;
  sequence: number;
  name: string;
  description?: string;
  pdcaPhase: PdcaPhase;
  defaultDurationDays: number;
  isGate?: boolean;
  gateCriteria?: Array<{ check: string; description: string }>;
}

interface SeedTemplate {
  code: string;
  msType: MsType;
  name: string;
  description: string;
  version: string;
  frameworkCodes: string[];
  estimatedDurationDays: number;
  phases: SeedPhase[];
  steps: SeedStep[];
}

// ──────────────────────────────────────────────────────────────
// Phasen — gemeinsam für alle 3 IG-Templates
// ──────────────────────────────────────────────────────────────

const CIS_PHASES: SeedPhase[] = [
  {
    code: "setup",
    sequence: 0,
    name: "Programm-Setup",
    pdcaPhase: "plan",
    defaultDurationDays: 14,
    description:
      "Programm-Charter, Scope, Owner-Modell, Tooling-Erstkonfiguration.",
  },
  {
    code: "foundation",
    sequence: 1,
    name: "Foundation — Inventare (Controls 1-3)",
    pdcaPhase: "plan",
    defaultDurationDays: 90,
    isGate: true,
    gateCriteria: [
      {
        check: "asset_inventory_v1",
        description: "Asset-Inventar v1 (Hardware + Software) liegt vor",
      },
      {
        check: "data_inventory_v1",
        description: "Datenkatalog v1 mit Klassifikation existiert",
      },
    ],
    description:
      "Jede CIS-Implementierung scheitert ohne aktuelle Inventare — Hardware, Software, Daten.",
  },
  {
    code: "configuration",
    sequence: 2,
    name: "Configuration & Identity (Controls 4-6)",
    pdcaPhase: "do",
    defaultDurationDays: 120,
    isGate: true,
    gateCriteria: [
      {
        check: "mfa_admin_remote_external",
        description: "MFA für Admin, Remote-Access und externe Apps aktiv",
      },
      {
        check: "hardening_baselines_applied",
        description:
          "Hardening-Baselines auf ≥ 90 % der Enterprise-Assets angewendet",
      },
    ],
    description:
      "Sichere Konfiguration aller Assets + Identity- und Access-Management.",
  },
  {
    code: "detection",
    sequence: 3,
    name: "Detection & Defense (Controls 7-13)",
    pdcaPhase: "do",
    defaultDurationDays: 120,
    isGate: true,
    gateCriteria: [
      {
        check: "vuln_management_running",
        description:
          "Vulnerability-Scanner liefert wöchentlich Reports, Patch-SLA dokumentiert",
      },
      {
        check: "centralized_logging",
        description: "Audit-Logs zentralisiert (SIEM oder gleichwertig)",
      },
      {
        check: "backup_restore_tested",
        description:
          "Restore-Test eines kritischen Systems erfolgreich durchgeführt",
      },
    ],
    description:
      "Vulnerability-Management, Logging, Email/Browser-Schutz, Anti-Malware, Recovery, Network-Hardening.",
  },
  {
    code: "operate",
    sequence: 4,
    name: "Operate — Awareness, Vendors, AppSec, IR, PenTest (Controls 14-18)",
    pdcaPhase: "check",
    defaultDurationDays: 90,
    isGate: true,
    gateCriteria: [
      {
        check: "awareness_round_1",
        description: "Awareness-Erstrunde abgeschlossen, ≥ 80 % Quote",
      },
      {
        check: "incident_response_plan",
        description: "Incident-Response-Plan dokumentiert + Tabletop geübt",
      },
    ],
    description:
      "Awareness, Service-Provider-Management, Application-Security, Incident-Response, Penetration-Testing.",
  },
  {
    code: "review",
    sequence: 5,
    name: "Review & Continuous Improvement",
    pdcaPhase: "act",
    defaultDurationDays: 30,
    description:
      "Programm-Review, Maturity-Assessment, Y2-Roadmap.",
  },
];

// ──────────────────────────────────────────────────────────────
// Step-Definitionen — pro Control 1 Step, Subtasks IG-spezifisch.
// Die `_buildSafeguards`-Helper liefert Safeguards je IG-Level.
// ──────────────────────────────────────────────────────────────

interface ControlSpec {
  controlNum: number;
  code: string; // CIS-1, CIS-2, ...
  phaseCode: string;
  sequence: number; // unique per template
  name: string;
  description: string;
  defaultOwnerRole: string;
  defaultDurationDays: number;
  prerequisiteStepCodes?: string[];
  targetModuleLink?: { module?: string; route?: string };
  requiredEvidenceCount?: number;
  isMilestone?: boolean;
  /** Safeguards split by IG. Order = safeguard number. */
  safeguardsIg1: SeedSubtask[];
  safeguardsIg2Additional: SeedSubtask[];
  safeguardsIg3Additional: SeedSubtask[];
}

const CIS_CONTROL_SPECS: ControlSpec[] = [
  // ─── Control 1: Asset Inventory ───
  {
    controlNum: 1,
    code: "CIS-1",
    phaseCode: "foundation",
    sequence: 1,
    name: "Inventory and Control of Enterprise Assets",
    description:
      "Aktive Verwaltung (Inventarisieren, Tracken, Korrigieren) aller Enterprise-Assets — Endgeräte, Server, Netzwerk-Geräte, IoT, mobile Geräte. Voraussetzung für jede weitere Maßnahme: was nicht inventarisiert ist, kann nicht geschützt werden.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 30,
    targetModuleLink: { module: "isms", route: "/isms/assets" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "1.1 Detailliertes Enterprise-Asset-Inventar etablieren + pflegen",
        description:
          "Inventar enthält pro Asset: Eindeutige ID, Hardware-Adresse, Netzwerk-Adresse, Maschinenname, Eigentümer, Department, ggf. Approval-Status. Mindestens halbjährliche Reviews.",
        defaultDurationDays: 14,
        deliverableType: "register",
      },
      {
        title: "1.2 Unautorisierte Assets adressieren",
        description:
          "Erkannte unautorisierte Assets müssen entfernt, in Quarantäne gestellt oder zugelassen werden — wöchentliche oder häufigere Prüfung. Ergebnis dokumentieren.",
        defaultDurationDays: 7,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "1.3 Active-Discovery-Tool einsetzen",
        description:
          "Aktive Netzwerk-Scans (z.B. nmap-basiert) zur Identifikation aller verbundenen Assets, mindestens täglich. Ergebnisse fließen in das Inventar.",
        defaultDurationDays: 14,
      },
      {
        title: "1.4 DHCP-Logging zur Inventar-Aktualisierung",
        description:
          "DHCP-Lease-Logs zentralisieren und mit dem Asset-Inventar abgleichen. Erkennt neue/unautorisierte Endgeräte beim Verbindungsaufbau.",
        defaultDurationDays: 7,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "1.5 Passive Asset-Discovery",
        description:
          "Passive Sniffing-Tools (z.B. Zeek/Bro, Suricata-passiv) identifizieren Assets ohne aktive Scans — entdeckt scan-resistente / unkooperative Geräte (IoT, OT, Drucker).",
        defaultDurationDays: 14,
      },
    ],
  },

  // ─── Control 2: Software Inventory ───
  {
    controlNum: 2,
    code: "CIS-2",
    phaseCode: "foundation",
    sequence: 2,
    name: "Inventory and Control of Software Assets",
    description:
      "Software, die auf Enterprise-Assets installiert oder ausgeführt wird, aktiv verwalten — Inventarisierung, Verhinderung unautorisierter Software, Allowlisting. Ohne Software-Inventar keine effektive Patch- oder Vulnerability-Strategie.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["CIS-1"],
    targetModuleLink: { module: "isms", route: "/isms/assets" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "2.1 Software-Inventar etablieren + pflegen",
        description:
          "Pro Software-Eintrag: Titel, Version, Publisher, Installations-/Lizenz-Datum, Zweck. Mindestens halbjährlich aktualisieren.",
        defaultDurationDays: 14,
        deliverableType: "register",
      },
      {
        title: "2.2 Sicherstellen dass autorisierte Software supported ist",
        description:
          "Nur Software einsetzen, die vom Hersteller noch supported wird (Security-Updates verfügbar). End-of-Life-Software dokumentieren + Migrationsplan oder formal akzeptiertes Restrisiko.",
        defaultDurationDays: 7,
      },
      {
        title: "2.3 Unautorisierte Software adressieren",
        description:
          "Wöchentliche Prüfung auf nicht autorisierte Software — entfernen, dokumentieren, oder ins Inventar aufnehmen.",
        defaultDurationDays: 7,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "2.4 Automatisierte Software-Inventar-Tools nutzen",
        description:
          "EDR / Configuration Management Tools (SCCM, Intune, JAMF, Ansible) zur automatischen Erfassung — kein manuelles Pflegen mehr.",
        defaultDurationDays: 21,
      },
      {
        title: "2.5 Authorisierte Software allowlisten",
        description:
          "Application-Whitelisting (Windows AppLocker, macOS Gatekeeper, Linux fapolicyd) erzwingt Ausführung nur autorisierter Software.",
        defaultDurationDays: 30,
        deliverableType: "control",
      },
      {
        title: "2.6 Authorisierte Bibliotheken allowlisten",
        description:
          "Auch Software-Bibliotheken (DLLs, Shared Objects) auf Whitelist beschränken — verhindert DLL-Hijacking und ähnliche Angriffe.",
        defaultDurationDays: 21,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "2.7 Authorisierte Skripte allowlisten",
        description:
          "PowerShell, Python, Bash-Skripte nur ausführen wenn signiert und auf Whitelist. Constrained Language Mode für PowerShell aktivieren.",
        defaultDurationDays: 21,
      },
    ],
  },

  // ─── Control 3: Data Protection ───
  {
    controlNum: 3,
    code: "CIS-3",
    phaseCode: "foundation",
    sequence: 3,
    name: "Data Protection",
    description:
      "Datenmanagement-Prozesse + technische Kontrollen zur Identifikation, Klassifikation, sicheren Verarbeitung und Aufbewahrung von Daten. Bestimmt die Gesamt-Datenstrategie der Organisation.",
    defaultOwnerRole: "dpo",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["CIS-1", "CIS-2"],
    targetModuleLink: { module: "dpms", route: "/dpms" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "3.1 Datenmanagement-Prozess etablieren",
        description:
          "Schriftlicher Prozess für Datensensibilität, Eigentümerschaft, Verarbeitungsanforderungen, Aufbewahrungsfristen, Entsorgungsstandards. Jährliche Review.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "3.2 Daten-Inventar etablieren + pflegen",
        description:
          "Pro Datenkategorie: Speicherort, Eigentümer, Klassifikation, Sensibilität. Halbjährlich aktualisieren.",
        defaultDurationDays: 14,
        deliverableType: "register",
      },
      {
        title: "3.3 Datenzugriffs-ACLs konfigurieren",
        description:
          "Zugriff nach Need-to-Know-Prinzip beschränken. Default-Deny, explizite Berechtigung pro Rolle/Gruppe.",
        defaultDurationDays: 21,
      },
      {
        title: "3.4 Datenaufbewahrung durchsetzen",
        description:
          "Pro Datenkategorie definierte Aufbewahrungsfrist + automatische Löschung. Nachweis über Lösch-Logs.",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
      {
        title: "3.5 Daten sicher entsorgen",
        description:
          "Sichere Löschung (Crypto-Erase, NIST 800-88) für ausrangierte Datenträger. Zertifikate aufbewahren.",
        defaultDurationDays: 7,
        deliverableType: "evidence",
      },
      {
        title: "3.6 Daten auf Endgeräten verschlüsseln",
        description:
          "Full-Disk-Encryption (BitLocker, FileVault, LUKS) auf allen Notebooks + mobilen Endgeräten. Recovery-Keys zentral verwaltet.",
        defaultDurationDays: 30,
        deliverableType: "control",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "3.7 Datenklassifikations-Schema etablieren",
        description:
          "Klassen z.B. Public/Internal/Confidential/Restricted mit klaren Behandlungsanweisungen. Pro Klasse Schutzanforderungen.",
        defaultDurationDays: 14,
      },
      {
        title: "3.8 Datenflüsse dokumentieren",
        description:
          "Pro Geschäftsprozess: woher kommen Daten, wohin gehen sie, welche Kontrollen greifen unterwegs. Visualisierung als Datenfluss-Diagramm.",
        defaultDurationDays: 21,
        deliverableType: "documentation",
      },
      {
        title: "3.9 Daten auf Wechseldatenträgern verschlüsseln",
        description:
          "USB-Sticks, externe Festplatten zwingend verschlüsselt (z.B. BitLocker To Go) + Policy zur Nutzung.",
        defaultDurationDays: 14,
      },
      {
        title: "3.10 Sensitive Daten in Transit verschlüsseln",
        description:
          "TLS 1.2+ für alle Datenübertragungen außerhalb des LAN. Verbot unverschlüsselter Protokolle (FTP, Telnet, HTTP für sensible Daten).",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "3.11 Sensitive Daten at Rest verschlüsseln",
        description:
          "Datenbank-Verschlüsselung (TDE), Storage-Verschlüsselung, Application-Level-Encryption für besonders schützenswerte Felder.",
        defaultDurationDays: 30,
      },
      {
        title: "3.12 Datenverarbeitung nach Sensibilität segmentieren",
        description:
          "Hochsensible Daten in eigenen Netzwerk-Segmenten/VLANs verarbeiten. Strenge Egress-Kontrollen.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "3.13 Data Loss Prevention (DLP) deployen",
        description:
          "DLP-Lösung erkennt + blockiert Exfiltration sensitiver Daten via E-Mail, Web, Cloud-Upload, USB. Policies pro Datenklasse.",
        defaultDurationDays: 60,
        deliverableType: "control",
      },
      {
        title: "3.14 Zugriff auf sensitive Daten loggen",
        description:
          "Alle Zugriffe auf besonders sensitive Daten in Audit-Logs erfassen, Anomalie-Detection darauf laufen lassen.",
        defaultDurationDays: 21,
      },
    ],
  },

  // ─── Control 4: Secure Configuration ───
  {
    controlNum: 4,
    code: "CIS-4",
    phaseCode: "configuration",
    sequence: 4,
    name: "Secure Configuration of Enterprise Assets and Software",
    description:
      "Etablierung und Pflege sicherer Konfigurationen — Default-Konfigurationen sind unsicher (offene Ports, Default-Passwörter, unnötige Services). Pro Asset-Klasse dokumentierte Hardening-Baselines anwenden und durchsetzen.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["CIS-1", "CIS-2"],
    targetModuleLink: { module: "ics", route: "/controls" },
    requiredEvidenceCount: 2,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "4.1 Sichere Konfigurations-Prozess etablieren",
        description:
          "Pro Asset-Typ Hardening-Baseline (CIS Benchmarks, BSI SiSyPHuS, DISA STIG). Abweichungen dokumentieren + begründen.",
        defaultDurationDays: 21,
        deliverableType: "policy",
      },
      {
        title: "4.2 Sichere Konfigurations-Prozess für Netzwerk-Infrastruktur",
        description:
          "Switches, Router, Firewalls, Wireless-APs nach Hardening-Baseline konfigurieren. Default-Credentials immer ändern.",
        defaultDurationDays: 14,
      },
      {
        title: "4.3 Automatisches Session-Locking konfigurieren",
        description:
          "Bildschirmsperre nach max. 15 min Inaktivität (Workstation), 2 min (Mobile). Per GPO/MDM erzwingen.",
        defaultDurationDays: 7,
      },
      {
        title: "4.4 Firewall auf Servern implementieren + verwalten",
        description:
          "Host-basierte Firewalls (iptables, nftables, Windows Firewall) auf allen Servern. Default-Deny inbound, explizite Allow-Regeln.",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
      {
        title: "4.5 Firewall auf Endgeräten implementieren + verwalten",
        description:
          "Host-Firewall auf allen Workstations + Notebooks aktiv, inkl. mobilen Geräten in Public-Networks.",
        defaultDurationDays: 14,
      },
      {
        title: "4.6 Enterprise-Assets sicher verwalten",
        description:
          "Out-of-Band-Management-Netze, jump hosts, MFA für administrative Zugriffe. Verbot direkter Internet-Exposition von Admin-Interfaces.",
        defaultDurationDays: 21,
      },
      {
        title: "4.7 Default-Accounts auf Assets verwalten",
        description:
          "Default-/Built-in-Accounts deaktivieren oder Passwort sofort ändern. Inventar aller Default-Accounts.",
        defaultDurationDays: 14,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "4.8 Unnötige Services deaktivieren",
        description:
          "Pro Asset-Typ liste der notwendigen Services führen. Alles andere deaktivieren oder entfernen.",
        defaultDurationDays: 21,
      },
      {
        title: "4.9 Trusted DNS-Server auf Assets konfigurieren",
        description:
          "Pro Asset nur firmen-eigene oder vertraue DNS-Resolver — kein 8.8.8.8 oder ungeprüfte ISP-DNS. DNS-over-HTTPS für mobile Geräte.",
        defaultDurationDays: 14,
      },
      {
        title: "4.10 Automatisches Device-Lockout auf mobilen Endgeräten",
        description:
          "Nach X Fehlversuchen automatisches Sperren / Wipe. Per MDM erzwingen.",
        defaultDurationDays: 7,
      },
      {
        title: "4.11 Remote-Wipe für mobile Endgeräte",
        description:
          "Verlorene/gestohlene Geräte fernlöschbar. MDM-Konsole + dokumentierter Prozess.",
        defaultDurationDays: 7,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "4.12 Enterprise-Workspaces auf mobilen Geräten trennen",
        description:
          "BYOD: separate Container für Firmen-Apps + Daten (Android Work Profile, iOS Managed Apps). Personal-Workspace bleibt unberührt.",
        defaultDurationDays: 30,
      },
    ],
  },

  // ─── Control 5: Account Management ───
  {
    controlNum: 5,
    code: "CIS-5",
    phaseCode: "configuration",
    sequence: 5,
    name: "Account Management",
    description:
      "Lebenszyklus-Management aller Accounts (Joiner-Mover-Leaver). Privilegierte Accounts strikt von normalen User-Accounts trennen. Dormant Accounts sind primäres Angriffs-Surface.",
    defaultOwnerRole: "admin",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["CIS-1"],
    targetModuleLink: { module: "platform", route: "/users" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "5.1 Account-Inventar etablieren + pflegen",
        description:
          "Vollständige Liste aller Accounts (Mitarbeiter, Service, Admin, Drittparteien). Pro Account: Owner, Zweck, letzte Nutzung, Berechtigungs-Level. Quartalsweise Review.",
        defaultDurationDays: 14,
        deliverableType: "register",
      },
      {
        title: "5.2 Eindeutige Passwörter verwenden",
        description:
          "Pro Account ein eindeutiges Passwort. Mindestlängen + Komplexität via Policy. Password-Manager für End-User empfehlen + ausrollen.",
        defaultDurationDays: 14,
      },
      {
        title: "5.3 Inaktive Accounts deaktivieren",
        description:
          "Accounts ohne Nutzung > 45 Tage automatisch deaktivieren. Manuelle Reaktivierung mit Begründung.",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
      {
        title: "5.4 Admin-Privilegien auf dedizierte Admin-Accounts beschränken",
        description:
          "Niemals tägliche Arbeit mit Admin-Account. Separate, nur für Admin-Tätigkeit genutzte Accounts. Persönliche User-Accounts ohne lokale Admin-Rechte.",
        defaultDurationDays: 21,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "5.5 Service-Account-Inventar",
        description:
          "Pro Service-Account: Eigentümer (eine Person, nicht das Team), Zweck, Berechtigungen, Rotation-Schedule für Credentials.",
        defaultDurationDays: 14,
      },
      {
        title: "5.6 Account-Management zentralisieren",
        description:
          "AD/LDAP/Identity-Provider als Single Source of Truth. SaaS-Apps via SAML/OIDC anbinden. Lokale Accounts nur in Notfällen.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [],
  },

  // ─── Control 6: Access Control Management ───
  {
    controlNum: 6,
    code: "CIS-6",
    phaseCode: "configuration",
    sequence: 6,
    name: "Access Control Management",
    description:
      "Granting + Revoking von Zugriff systematisch managen. MFA an allen kritischen Zugängen. RBAC oder ABAC als Berechtigungsmodell.",
    defaultOwnerRole: "admin",
    defaultDurationDays: 45,
    prerequisiteStepCodes: ["CIS-5"],
    targetModuleLink: { module: "platform", route: "/users" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "6.1 Access-Granting-Prozess etablieren",
        description:
          "Schriftlicher Prozess für neue Berechtigungen: Owner-Approval, Bedarf nachweisen, Audit-Trail. SLA für Bearbeitung.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "6.2 Access-Revoking-Prozess etablieren",
        description:
          "Joiner-Mover-Leaver: bei Wechsel/Austritt automatische Berechtigungs-Anpassung. SLA für Revoke (z.B. < 24h bei Austritt).",
        defaultDurationDays: 14,
      },
      {
        title: "6.3 MFA für externally-exposed Apps",
        description:
          "Jede aus dem Internet erreichbare App (Webmail, VPN-Portale, Cloud-Apps) zwingend mit MFA. TOTP minimum, FIDO2 bevorzugt.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "6.4 MFA für Remote-Network-Access",
        description:
          "VPN, RDP-Gateway, Bastion-Hosts MFA-pflichtig.",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
      {
        title: "6.5 MFA für administrative Zugriffe",
        description:
          "Jede administrative Aktion (sudo, AD-Console, Cloud-Konsole) MFA-geschützt. Kein 'shared admin password' ohne MFA.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "6.6 Inventar aller Authentication- + Authorization-Systeme",
        description:
          "Liste aller IdP, AD-Forests, OAuth-Provider, lokaler Auth-Systeme. Verantwortliche, Backup-Strategie, Recovery-Plan.",
        defaultDurationDays: 14,
      },
      {
        title: "6.7 Access Control zentralisieren",
        description:
          "SSO über Identity-Provider für alle Apps. Reduziert Account-Sprawl + ermöglicht globalen Revoke.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "6.8 Role-Based Access Control (RBAC) definieren + pflegen",
        description:
          "Rollen-Modell statt individueller Berechtigungen. Rollen-Matrix dokumentiert, jährlich reviewed. Berechtigungs-Vergabe nur über Rollen.",
        defaultDurationDays: 45,
      },
    ],
  },

  // ─── Control 7: Vulnerability Management ───
  {
    controlNum: 7,
    code: "CIS-7",
    phaseCode: "detection",
    sequence: 7,
    name: "Continuous Vulnerability Management",
    description:
      "Kontinuierliche Erkennung + Behebung von Schwachstellen. Patch-Management + Vulnerability-Scanning + Remediation-Workflow.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 45,
    prerequisiteStepCodes: ["CIS-1", "CIS-2"],
    targetModuleLink: { module: "isms", route: "/isms/vulnerabilities" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "7.1 Vulnerability-Management-Prozess etablieren",
        description:
          "Schriftlicher Prozess: Identifikation, Bewertung, Priorisierung, Behebung. SLA pro CVSS-Severity. Verantwortliche.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "7.2 Remediation-Prozess etablieren",
        description:
          "Risikobasiertes Patching: Critical < 7d, High < 30d, Medium < 90d. Exception-Prozess für nicht-patchbare Fälle.",
        defaultDurationDays: 14,
      },
      {
        title: "7.3 Automatisches OS-Patch-Management",
        description:
          "Windows Update, WSUS, Linux unattended-upgrades, Apple SUS — automatisches Einspielen sicherheitsrelevanter Patches.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "7.4 Automatisches Application-Patch-Management",
        description:
          "Drittanbieter-Apps (Browser, Office, PDF-Reader, Java) automatisch patchen. Tools: Chocolatey, Ninite, JAMF, SCCM.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "7.5 Automatisierte Vuln-Scans interner Assets",
        description:
          "Wöchentliche Vulnerability-Scans (Nessus, OpenVAS, Qualys) aller internen Enterprise-Assets. Reports automatisch ans Security-Team.",
        defaultDurationDays: 14,
      },
      {
        title: "7.6 Automatisierte Vuln-Scans externally-exposed Assets",
        description:
          "Mindestens monatlich extern-erreichbare Systeme scannen. Externe Scanner-Sicht (z.B. AttackSurfaceManagement).",
        defaultDurationDays: 14,
      },
      {
        title: "7.7 Erkannte Schwachstellen beheben",
        description:
          "Pro identifizierter Schwachstelle: Owner, Frist, Tracking bis zum Closure. Re-Scan zur Verifikation.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [],
  },

  // ─── Control 8: Audit Log Management ───
  {
    controlNum: 8,
    code: "CIS-8",
    phaseCode: "detection",
    sequence: 8,
    name: "Audit Log Management",
    description:
      "Sammlung, Aufbewahrung und Auswertung von Audit-Logs für Detection, Forensik, Compliance. SIEM oder gleichwertige Zentralisierung.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 45,
    prerequisiteStepCodes: ["CIS-1"],
    targetModuleLink: { module: "isms", route: "/isms/incidents" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "8.1 Audit-Log-Management-Prozess etablieren",
        description:
          "Schriftlicher Prozess: was wird geloggt, wo gespeichert, wie lange, wer reviewed. Mindestens jährlich aktualisieren.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "8.2 Audit-Logs sammeln",
        description:
          "Mindestens: Authentication, Privilege-Use, System-Events, Account-Changes, Critical Application Logs.",
        defaultDurationDays: 21,
      },
      {
        title: "8.3 Adäquaten Audit-Log-Storage sicherstellen",
        description:
          "Genügend Speicher für mindestens 90 Tage online + Archivierung. Schutz vor unbefugtem Löschen.",
        defaultDurationDays: 14,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "8.4 Zeit-Synchronisation standardisieren",
        description:
          "Alle Systeme via NTP gegen mindestens 2 Stratum-1-Quellen. Logs nur mit korrektem Timestamp forensisch verwertbar.",
        defaultDurationDays: 7,
      },
      {
        title: "8.5 Detaillierte Audit-Logs sammeln",
        description:
          "Logs mit ausreichendem Kontext: User, Source-IP, Ziel, Zeitpunkt, Result. Sensible Felder (Passwörter) maskieren.",
        defaultDurationDays: 14,
      },
      {
        title: "8.6 DNS-Query-Audit-Logs sammeln",
        description:
          "DNS-Logs zentralisieren — kritisch für Detection von C2-Channels, DGA-Domains, Datenexfiltration via DNS-Tunneling.",
        defaultDurationDays: 14,
      },
      {
        title: "8.7 URL-Request-Audit-Logs sammeln",
        description:
          "Web-Proxy / NGFW-Logs aller HTTP/HTTPS-Requests. Erkennt Malware-Downloads, Phishing-Klicks, Data-Exfiltration.",
        defaultDurationDays: 14,
      },
      {
        title: "8.8 Command-Line-Audit-Logs sammeln",
        description:
          "PowerShell ScriptBlock Logging, bash-history, Linux auditd execve. Erkennt Living-off-the-Land-Angriffe.",
        defaultDurationDays: 14,
      },
      {
        title: "8.9 Audit-Logs zentralisieren",
        description:
          "SIEM (Splunk, Elastic, Wazuh, Microsoft Sentinel) sammelt + korreliert alle Log-Quellen. Pro Asset definiert was wohin geht.",
        defaultDurationDays: 30,
        deliverableType: "control",
      },
      {
        title: "8.10 Audit-Logs retainen",
        description:
          "Mindestens 90 Tage online, Compliance-Anforderungen ggf. 1+ Jahre. Schutz vor Manipulation (write-once, verschlüsselt).",
        defaultDurationDays: 14,
      },
      {
        title: "8.11 Audit-Log-Reviews durchführen",
        description:
          "Wöchentliche oder häufigere Reviews durch Security-Team. Use-Cases definiert für Auto-Alerts. Manuelles Sichten als Backup.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "8.12 Service-Provider-Logs sammeln",
        description:
          "Logs von SaaS-Anbietern (Microsoft 365, AWS, Salesforce) abholen + ins SIEM. Cross-Domain-Detection.",
        defaultDurationDays: 30,
      },
    ],
  },

  // ─── Control 9: Email and Web Browser Protections ───
  {
    controlNum: 9,
    code: "CIS-9",
    phaseCode: "detection",
    sequence: 9,
    name: "Email and Web Browser Protections",
    description:
      "Reduzierung der Angriffsfläche aus den zwei häufigsten Initial-Vektoren — E-Mail und Webbrowser. Phishing + Drive-by-Downloads gehören zu den Top-3-Initial-Access-Methoden.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 45,
    prerequisiteStepCodes: ["CIS-2"],
    targetModuleLink: { module: "ics", route: "/controls" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "9.1 Nur supported Browser + E-Mail-Clients verwenden",
        description:
          "Verbot von End-of-Life-Browsern (alte IE-Versionen, alte Firefox ESR). Liste freigegebener Versionen pflegen.",
        defaultDurationDays: 14,
      },
      {
        title: "9.2 DNS-Filtering-Services nutzen",
        description:
          "DNS-Resolver mit Threat-Intelligence (Quad9, Cisco Umbrella, Cloudflare Gateway) blockiert Verbindungen zu malicious Domains.",
        defaultDurationDays: 14,
        deliverableType: "control",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "9.3 Network-basierte URL-Filter",
        description:
          "Web-Proxy / NGFW mit Kategorisierung. Mindestens Malware/Phishing/Adult/Crypto-Mining blockieren.",
        defaultDurationDays: 21,
      },
      {
        title: "9.4 Browser- + E-Mail-Client-Extensions beschränken",
        description:
          "Whitelist erlaubter Extensions. Verbot von User-installierten Extensions ohne Approval (Manifest-V3).",
        defaultDurationDays: 14,
      },
      {
        title: "9.5 DMARC implementieren",
        description:
          "DMARC-Policy reject + SPF + DKIM für eigene Domain. Verhindert Spoofing der eigenen Domain.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "9.6 Unnötige Dateitypen blockieren",
        description:
          "E-Mail-Gateway blockiert ausführbare Anhänge (.exe, .scr, .vbs, .ps1, .iso). Macro-Office-Files quarantänieren.",
        defaultDurationDays: 14,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "9.7 E-Mail-Server-Anti-Malware",
        description:
          "Sandboxing-Lösung am E-Mail-Gateway (z.B. FireEye, Proofpoint TAP) für unbekannte Dateien. Detonation in Sandbox vor Zustellung.",
        defaultDurationDays: 30,
      },
    ],
  },

  // ─── Control 10: Malware Defenses ───
  {
    controlNum: 10,
    code: "CIS-10",
    phaseCode: "detection",
    sequence: 10,
    name: "Malware Defenses",
    description:
      "Anti-Malware-Tools (signatur- und verhaltensbasiert) auf allen Endpoints. Zentrale Verwaltung, automatische Updates, Behavioral Detection.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 30,
    prerequisiteStepCodes: ["CIS-1"],
    targetModuleLink: { module: "ics", route: "/controls" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "10.1 Anti-Malware-Software deployen + warten",
        description:
          "EPP/EDR auf allen Endpoints (Workstations, Server). Microsoft Defender for Endpoint, CrowdStrike, SentinelOne, etc.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "10.2 Automatische Anti-Malware-Signatur-Updates konfigurieren",
        description:
          "Mindestens täglich automatische Updates der Signaturen + Engines. Monitoring auf veraltete Signaturen.",
        defaultDurationDays: 7,
      },
      {
        title: "10.3 Autorun + Autoplay für Wechseldatenträger deaktivieren",
        description:
          "Per GPO/MDM Autorun-Funktionen deaktivieren — verhindert USB-Drop-Angriffe.",
        defaultDurationDays: 7,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "10.4 Automatisches Anti-Malware-Scanning für Wechseldatenträger",
        description:
          "Beim Anschluss eines USB-Sticks automatischer Scan vor Ausführung jeglicher Inhalte.",
        defaultDurationDays: 7,
      },
      {
        title: "10.5 Anti-Exploitation-Features aktivieren",
        description:
          "DEP, ASLR, CFG, ControlFlowGuard, Exploit Protection. Microsoft Defender Exploit Guard / Windows Defender Application Guard.",
        defaultDurationDays: 14,
      },
      {
        title: "10.6 Anti-Malware-Software zentral verwalten",
        description:
          "Zentrale Konsole mit Übersicht aller Endpoints, automatische Reaktion auf Detections, Compliance-Reports.",
        defaultDurationDays: 14,
      },
      {
        title: "10.7 Verhaltens-basierte Anti-Malware nutzen",
        description:
          "EDR mit Behavioral Detection — erkennt fileless malware, ransomware, lateral movement. Cloud-Sandbox für unbekannte Files.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
    ],
    safeguardsIg3Additional: [],
  },

  // ─── Control 11: Data Recovery ───
  {
    controlNum: 11,
    code: "CIS-11",
    phaseCode: "detection",
    sequence: 11,
    name: "Data Recovery",
    description:
      "Backup-Strategie + getestete Recovery-Fähigkeit. 3-2-1-Regel: 3 Kopien, 2 Medien, 1 Off-Site. Ohne getestete Restores ist Backup nur Hoffnung.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 45,
    prerequisiteStepCodes: ["CIS-3"],
    targetModuleLink: { module: "bcms", route: "/bcms" },
    requiredEvidenceCount: 2,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "11.1 Datenrecovery-Prozess etablieren",
        description:
          "Schriftlicher Prozess: was wird gesichert, wie oft, wo gespeichert, wer hat Zugriff, wie wird recovered. Pro Datenklasse RTO/RPO.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "11.2 Automatisierte Backups durchführen",
        description:
          "Pro Asset-Klasse Backup-Schedule (Datenbanken täglich, File-Server wöchentlich+inkrementell, etc.). Backup-Tools mit Job-Monitoring.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
      {
        title: "11.3 Recovery-Daten schützen",
        description:
          "Backups verschlüsselt, Zugriff strikt limitiert (separate Backup-Account-Domain). Schutz vor Ransomware-Verschlüsselung.",
        defaultDurationDays: 14,
      },
      {
        title: "11.4 Isolierte Instanz von Recovery-Daten etablieren",
        description:
          "Mindestens eine Backup-Kopie offline / immutable / air-gapped. WORM-Storage oder Tape oder S3 Object Lock.",
        defaultDurationDays: 21,
        deliverableType: "control",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "11.5 Datenrecovery testen",
        description:
          "Mindestens jährlich vollständiger Restore-Test eines kritischen Systems. Protokoll mit Erfolg/Fehler + Lessons Learned.",
        defaultDurationDays: 14,
        deliverableType: "evidence",
      },
    ],
    safeguardsIg3Additional: [],
  },

  // ─── Control 12: Network Infrastructure Management ───
  {
    controlNum: 12,
    code: "CIS-12",
    phaseCode: "detection",
    sequence: 12,
    name: "Network Infrastructure Management",
    description:
      "Sicheres Management der Netzwerk-Infrastruktur. Up-to-date Firmware, sichere Architektur, AAA für administrative Zugänge.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["CIS-4"],
    targetModuleLink: { module: "isms", route: "/isms/assets" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "12.1 Netzwerk-Infrastruktur up-to-date halten",
        description:
          "Firmware aller Switches, Router, Firewalls, APs aktuell. Patch-Schedule + Notification-Subscription beim Hersteller.",
        defaultDurationDays: 21,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "12.2 Sichere Netzwerk-Architektur etablieren + pflegen",
        description:
          "Segmentierung in Vertrauenszonen (DMZ, internal, OT, IoT, Guest). Default-Deny-Regeln zwischen Zonen.",
        defaultDurationDays: 30,
        deliverableType: "policy",
      },
      {
        title: "12.3 Netzwerk-Infrastruktur sicher verwalten",
        description:
          "Out-of-Band-Management-Netz, MFA für Admin-Zugriff, Bastion-Hosts, Konfig-Backup vor Änderungen.",
        defaultDurationDays: 21,
      },
      {
        title: "12.4 Architektur-Diagramme etablieren + pflegen",
        description:
          "Aktuelle Netzwerk-Diagramme (Logical + Physical), Datenfluss-Diagramme. Mindestens jährlich aktualisieren.",
        defaultDurationDays: 14,
        deliverableType: "documentation",
      },
      {
        title: "12.5 Netzwerk-AAA zentralisieren",
        description:
          "RADIUS/TACACS+ für administrative Zugriffe auf Netz-Geräte. Personal-Accounts, kein shared admin password.",
        defaultDurationDays: 21,
      },
      {
        title: "12.6 Sichere Netzwerk-Management-Protokolle nutzen",
        description:
          "SSH statt Telnet, HTTPS statt HTTP, SNMPv3 statt SNMPv2c, NTP authenticated. Verbot unverschlüsselter Protokolle.",
        defaultDurationDays: 14,
      },
      {
        title: "12.7 Remote-Devices via VPN + AAA",
        description:
          "Alle Remote-Verbindungen über VPN, das mit der Enterprise-AAA-Infrastruktur integriert ist. Split-Tunneling sorgfältig konfigurieren.",
        defaultDurationDays: 21,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "12.8 Dedizierte Computing-Resources für administrative Arbeit",
        description:
          "Privileged Access Workstations (PAWs) — separate Hardware/VMs nur für Admin-Tätigkeiten, isoliert von User-Aktivität (E-Mail, Web).",
        defaultDurationDays: 30,
      },
    ],
  },

  // ─── Control 13: Network Monitoring and Defense (IG2/IG3 only) ───
  {
    controlNum: 13,
    code: "CIS-13",
    phaseCode: "detection",
    sequence: 13,
    name: "Network Monitoring and Defense",
    description:
      "Aktive Erkennung + Abwehr von Netzwerk-Bedrohungen. SIEM-Korrelation, IDS/IPS, Network-Flow-Analytics. Erst ab IG2 verpflichtend — IG1 setzt Foundation.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["CIS-8", "CIS-12"],
    targetModuleLink: { module: "isms", route: "/isms/incidents" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [],
    safeguardsIg2Additional: [
      {
        title: "13.1 Security-Event-Alerting zentralisieren",
        description:
          "SIEM erhält Events aus allen Quellen + korreliert. Use-Cases pro MITRE ATT&CK Technique. SOC-Pager bei kritischen Alerts.",
        defaultDurationDays: 30,
        deliverableType: "control",
      },
      {
        title: "13.2 Host-basierte Intrusion-Detection deployen",
        description:
          "HIDS auf kritischen Servern (OSSEC, Wazuh, EDR mit IDS-Funktionalität).",
        defaultDurationDays: 21,
      },
      {
        title: "13.3 Network-Intrusion-Detection deployen",
        description:
          "NIDS an Netzwerk-Aggregations-Punkten (Suricata, Snort, Zeek). Signatur + Anomalie-basiert.",
        defaultDurationDays: 30,
      },
      {
        title: "13.4 Traffic-Filterung zwischen Netz-Segmenten",
        description:
          "Inter-VLAN-Filtering via Firewalls. Nur explizit erlaubter Traffic zwischen Trust-Zonen.",
        defaultDurationDays: 21,
      },
      {
        title: "13.5 Access Control für Remote-Assets",
        description:
          "Zero-Trust-Ansatz: Remote-Geräte werden vor Vollzugriff geprüft (Compliance, Posture). Conditional Access in M365/Azure AD.",
        defaultDurationDays: 30,
      },
      {
        title: "13.6 Network-Traffic-Flow-Logs sammeln",
        description:
          "NetFlow/sFlow/IPFIX an allen Aggregations-Punkten. Liefert Sichtbarkeit für Anomalie-Detection.",
        defaultDurationDays: 14,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "13.7 Host-basierte Intrusion-Prevention deployen",
        description:
          "HIPS blockiert aktiv (nicht nur erkennt) Bedrohungen am Host. Vorsicht: höheres False-Positive-Risiko.",
        defaultDurationDays: 30,
      },
      {
        title: "13.8 Network-Intrusion-Prevention deployen",
        description:
          "NIPS inline am Netzwerk-Perimeter + zwischen kritischen Segmenten. Tuning erforderlich.",
        defaultDurationDays: 30,
      },
      {
        title: "13.9 Port-Level Access Control",
        description:
          "802.1X auf Switch-Ports — kein Netzwerk-Zugriff ohne Authentifikation. NAC (Network Access Control) Lösung.",
        defaultDurationDays: 45,
      },
      {
        title: "13.10 Application-Layer-Filtering",
        description:
          "L7-Firewalls (NGFW) inspizieren Inhalt. App-Awareness, TLS-Inspektion bei kritischen Verbindungen.",
        defaultDurationDays: 30,
      },
      {
        title: "13.11 Security-Event-Alert-Thresholds tunen",
        description:
          "Kontinuierliches Tuning der SIEM-Regeln zur Reduktion von Alert-Fatigue. Pro Use-Case Metriken (TP/FP/FN).",
        defaultDurationDays: 30,
      },
    ],
  },

  // ─── Control 14: Security Awareness and Skills Training ───
  {
    controlNum: 14,
    code: "CIS-14",
    phaseCode: "operate",
    sequence: 14,
    name: "Security Awareness and Skills Training",
    description:
      "Awareness-Programm für alle Mitarbeiter + spezifisches Skills-Training für Schlüsselrollen. Mensch ist die anpassungsfähigste Verteidigungslinie — und die häufigste Schwachstelle.",
    defaultOwnerRole: "admin",
    defaultDurationDays: 60,
    targetModuleLink: { module: "academy", route: "/academy" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "14.1 Security-Awareness-Programm etablieren + pflegen",
        description:
          "Jährliches Curriculum, Onboarding-Module, Refresher. Plattform mit Tracking + Reporting.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "14.2 Workforce in Social Engineering trainieren",
        description:
          "Phishing-Erkennung, Vishing, Smishing, Pretexting. Inkl. Simulationen mit Klick-Rate-Tracking.",
        defaultDurationDays: 21,
      },
      {
        title: "14.3 Workforce in Authentication-Best-Practices trainieren",
        description:
          "Passwort-Strategien, MFA-Nutzung, Risiken bei Wiederverwendung, Password-Manager-Bedienung.",
        defaultDurationDays: 14,
      },
      {
        title: "14.4 Workforce in Daten-Handling trainieren",
        description:
          "Klassifikations-Schema, Verschlüsselung in Transit/At Rest, sichere Vernichtung, Drittparteien-Sharing.",
        defaultDurationDays: 14,
      },
      {
        title: "14.5 Workforce in Ursachen unbeabsichtigter Daten-Exposure trainieren",
        description:
          "Falsche E-Mail-Empfänger, vergessene Anhänge, ungesicherte Drucke, USB-Verlust. Praxis-Beispiele.",
        defaultDurationDays: 14,
      },
      {
        title: "14.6 Workforce im Erkennen + Melden von Incidents trainieren",
        description:
          "Was zählt als Incident? Wie melde ich? Welche Information benötige ich? Klare Eskalation. Anti-Retaliation-Policy.",
        defaultDurationDays: 14,
      },
      {
        title: "14.7 Workforce zu fehlenden Security-Updates trainieren",
        description:
          "Wie erkennt der User dass sein Endgerät nicht aktuell ist? Wie meldet er das? Self-Help-Anleitungen.",
        defaultDurationDays: 7,
      },
      {
        title: "14.8 Workforce zu unsicheren Netzwerken trainieren",
        description:
          "Risiken in Public-WiFi, Hotspots, Coffee-Shop-Netzen. VPN-Pflicht für Firmen-Daten unterwegs.",
        defaultDurationDays: 7,
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "14.9 Rollen-spezifisches Awareness- + Skills-Training",
        description:
          "Developer: Secure Coding. Admins: Hardening. HR: PII-Handling. Finance: BEC-Erkennung. Pro Rolle Curriculum.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [],
  },

  // ─── Control 15: Service Provider Management ───
  {
    controlNum: 15,
    code: "CIS-15",
    phaseCode: "operate",
    sequence: 15,
    name: "Service Provider Management",
    description:
      "Drittparteien (Cloud, SaaS, Outsourcing) systematisch managen. Inventar, Risikobewertung, vertragliche Sicherheits-Anforderungen, kontinuierliches Monitoring.",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 45,
    targetModuleLink: { module: "tprm", route: "/tprm" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [
      {
        title: "15.1 Service-Provider-Inventar etablieren + pflegen",
        description:
          "Pro Anbieter: Typ, verarbeitete Daten, Kritikalität, Vertrag, Vertrags-End-Datum, Eigentümer. Halbjährliche Review.",
        defaultDurationDays: 14,
        deliverableType: "register",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "15.2 Service-Provider-Management-Policy etablieren",
        description:
          "Schriftliche Policy: Onboarding-Prozess, Risikobewertung, Sicherheits-Anforderungen, Monitoring, Offboarding.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
      {
        title: "15.3 Service-Provider klassifizieren",
        description:
          "Pro Anbieter: Risiko-Tier (Critical/High/Medium/Low) basierend auf verarbeiteten Daten + Service-Kritikalität.",
        defaultDurationDays: 14,
      },
      {
        title: "15.4 Sicherheits-Anforderungen in Verträgen",
        description:
          "Standard-Sicherheits-Anhang in allen Verträgen: Verschlüsselung, MFA, Audit-Recht, Breach-Notification, Subprocessor-Approval.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "15.5 Service-Provider assessen",
        description:
          "Pro kritischer Anbieter: Vendor-Assessment (Fragebogen, SOC-2-Report, Pen-Test-Report). Mindestens jährlich.",
        defaultDurationDays: 30,
      },
      {
        title: "15.6 Service-Provider monitoren",
        description:
          "Kontinuierliches Monitoring (Threat-Intel-Feeds zu Vendor-Breaches, BitSight, SecurityScorecard). Alerts bei Statusänderungen.",
        defaultDurationDays: 21,
      },
      {
        title: "15.7 Service-Provider sicher decommissionieren",
        description:
          "Offboarding-Checkliste: Datenrückführung, Daten-Vernichtung, Zugriff-Revoke, Schlüssel-Rotation. Bestätigung vom Anbieter.",
        defaultDurationDays: 14,
      },
    ],
  },

  // ─── Control 16: Application Software Security (IG2/IG3 only) ───
  {
    controlNum: 16,
    code: "CIS-16",
    phaseCode: "operate",
    sequence: 16,
    name: "Application Software Security",
    description:
      "Sichere Software-Entwicklung: SDLC-Integration, Vulnerability-Handling, Component-Inventar, Secure Design. Erst ab IG2 — Foundation muss stehen.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 90,
    prerequisiteStepCodes: ["CIS-2", "CIS-7"],
    targetModuleLink: { module: "ics", route: "/controls" },
    requiredEvidenceCount: 1,
    safeguardsIg1: [],
    safeguardsIg2Additional: [
      {
        title: "16.1 Secure-Application-Development-Prozess etablieren",
        description:
          "SSDLC mit Security-Checkpoints in jeder Phase: Requirements, Design, Code, Test, Deploy, Operate.",
        defaultDurationDays: 30,
        deliverableType: "policy",
      },
      {
        title: "16.2 Prozess für Software-Vulnerabilities etablieren",
        description:
          "Vulnerability-Disclosure-Programm, Triage-Prozess, SLA pro Severity, Coordinated Disclosure.",
        defaultDurationDays: 21,
      },
      {
        title: "16.3 Root-Cause-Analyse für Vulnerabilities",
        description:
          "Pro kritischer Vulnerability nicht nur Fix, sondern Root-Cause: warum entstand die Lücke, wie verhindern wir Wiederholung.",
        defaultDurationDays: 14,
      },
      {
        title: "16.4 Inventar von Drittanbieter-Software-Components",
        description:
          "SBOM für jede Anwendung. SCA-Tools (Snyk, Dependabot, Renovate, OWASP DC) im CI integriert.",
        defaultDurationDays: 21,
        deliverableType: "register",
      },
      {
        title: "16.5 Up-to-Date + Trusted Drittanbieter-Components nutzen",
        description:
          "Pinning auf bekannt-sichere Versionen, automatische Updates für non-breaking. Verbot abandoned Libraries.",
        defaultDurationDays: 21,
      },
      {
        title: "16.6 Severity-Rating-System für Application-Vulnerabilities",
        description:
          "CVSS-basiertes Rating + interne Anpassung an Business-Kontext. Pro Severity Behandlungs-SLA.",
        defaultDurationDays: 14,
      },
      {
        title: "16.7 Standard-Hardening-Templates für App-Infrastruktur",
        description:
          "Hardened Container Images, Terraform/IaC mit Secure Defaults, Pre-approved Reference-Architectures.",
        defaultDurationDays: 30,
      },
      {
        title: "16.8 Production + Non-Production trennen",
        description:
          "Separate Netzwerke, Accounts, Credentials. Keine Prod-Daten in Test ohne Anonymisierung.",
        defaultDurationDays: 21,
      },
      {
        title: "16.9 Developer in Application-Security trainieren",
        description:
          "OWASP Top 10, Secure Coding pro Sprache, threat modeling Grundlagen. Mindestens jährliches Training.",
        defaultDurationDays: 21,
      },
      {
        title: "16.10 Secure Design Principles in App-Architekturen",
        description:
          "Defense in Depth, Least Privilege, Secure Defaults, Fail Securely. Architektur-Reviews mit Security-Checkliste.",
        defaultDurationDays: 21,
      },
      {
        title: "16.11 Vetted Modules für Security-Components",
        description:
          "Crypto-Libraries, Auth-Libraries: keine eigenen Implementierungen, sondern bewährte Bibliotheken (libsodium, Auth0/Keycloak).",
        defaultDurationDays: 14,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "16.12 Code-Level Security Checks implementieren",
        description:
          "SAST in CI (SonarQube, Semgrep, CodeQL). Dependency-Scanning. Secret-Scanning. Pre-commit Hooks.",
        defaultDurationDays: 30,
      },
      {
        title: "16.13 Application Penetration-Testing durchführen",
        description:
          "Mindestens jährlich + bei major releases. Externe Pen-Tester. DAST in CI für Routine-Tests.",
        defaultDurationDays: 30,
      },
      {
        title: "16.14 Threat-Modeling durchführen",
        description:
          "Pro neuer App / major Change: STRIDE oder vergleichbare Methodik. Threat Model als versioned Artifact.",
        defaultDurationDays: 21,
      },
    ],
  },

  // ─── Control 17: Incident Response Management ───
  {
    controlNum: 17,
    code: "CIS-17",
    phaseCode: "operate",
    sequence: 17,
    name: "Incident Response Management",
    description:
      "Strukturiertes Incident-Response-Programm: Personal benannt, Plan dokumentiert, Übungen geprobt. Wenn (nicht wenn) ein Incident eintritt, ist Vorbereitung der Unterschied zwischen kontrolliertem Schaden und Katastrophe.",
    defaultOwnerRole: "control_owner",
    defaultDurationDays: 60,
    targetModuleLink: { module: "isms", route: "/isms/incidents" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [
      {
        title: "17.1 Personal für Incident-Handling benennen",
        description:
          "Mindestens 1 Hauptverantwortlicher + 1 Backup. Klare Eskalation. 24/7-Erreichbarkeit dokumentiert.",
        defaultDurationDays: 7,
      },
      {
        title: "17.2 Kontaktinformationen für Incident-Reporting etablieren",
        description:
          "Wem melden Mitarbeiter Vorfälle? Wem extern (LKA, BSI, Behörden)? Pflege der Kontaktliste mit Stellvertretern.",
        defaultDurationDays: 7,
        deliverableType: "register",
      },
      {
        title: "17.3 Enterprise-Prozess für Incident-Reporting etablieren",
        description:
          "Standard-Meldeweg (Hotline, Mail, Ticket-System). Inhaltliche Anforderungen. Bestätigung an Melder.",
        defaultDurationDays: 14,
        deliverableType: "policy",
      },
    ],
    safeguardsIg2Additional: [
      {
        title: "17.4 Incident-Response-Prozess etablieren",
        description:
          "Schriftlicher IR-Plan: Phasen (Preparation/Detection/Containment/Eradication/Recovery/Lessons), pro Phase Checklisten + Tools.",
        defaultDurationDays: 21,
        deliverableType: "policy",
      },
      {
        title: "17.5 Schlüsselrollen + Verantwortungen zuweisen",
        description:
          "Incident Commander, Communications Lead, Technical Lead, Legal Lead. RACI-Matrix.",
        defaultDurationDays: 14,
      },
      {
        title: "17.6 Kommunikations-Mechanismen für Incident-Response definieren",
        description:
          "Out-of-Band-Kanäle (Signal, Telefon) falls Mail/Slack kompromittiert. Templates für interne + externe Kommunikation.",
        defaultDurationDays: 14,
      },
      {
        title: "17.7 Routine-IR-Übungen durchführen",
        description:
          "Mindestens 2x/Jahr Tabletop-Übung mit IR-Team + GL-Vertretung. Szenarien aus aktuellen Threat-Reports.",
        defaultDurationDays: 30,
        deliverableType: "evidence",
      },
      {
        title: "17.8 Post-Incident Reviews durchführen",
        description:
          "Nach jedem signifikanten Incident: Blameless Post-Mortem. Was lief gut, was nicht, welche Verbesserungen. Action-Items getrackt.",
        defaultDurationDays: 14,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "17.9 Security-Incident-Thresholds etablieren",
        description:
          "Pro Incident-Typ klare Schwellen für Eskalation (P1/P2/P3). Automatische Alerts bei Überschreiten.",
        defaultDurationDays: 14,
      },
    ],
  },

  // ─── Control 18: Penetration Testing (IG2/IG3 only) ───
  {
    controlNum: 18,
    code: "CIS-18",
    phaseCode: "operate",
    sequence: 18,
    name: "Penetration Testing",
    description:
      "Periodisches Pen-Testing zur Validierung der Sicherheits-Controls aus Sicht eines Angreifers. Erst ab IG2 verpflichtend. Externe Tester für unbeeinflusste Sicht.",
    defaultOwnerRole: "risk_manager",
    defaultDurationDays: 60,
    prerequisiteStepCodes: ["CIS-7"],
    targetModuleLink: { module: "isms", route: "/isms/vulnerabilities" },
    requiredEvidenceCount: 1,
    isMilestone: true,
    safeguardsIg1: [],
    safeguardsIg2Additional: [
      {
        title: "18.1 Penetration-Testing-Programm etablieren + pflegen",
        description:
          "Schriftliches Programm: Frequenz, Scope-Methodik, Vendor-Selection, Findings-Workflow.",
        defaultDurationDays: 21,
        deliverableType: "policy",
      },
      {
        title: "18.2 Periodische externe Pen-Tests durchführen",
        description:
          "Mindestens jährlich extern-erreichbare Systeme von zertifiziertem Pen-Tester (BSI/CREST/OSCP).",
        defaultDurationDays: 30,
        deliverableType: "evidence",
      },
      {
        title: "18.3 Pen-Test-Findings beheben",
        description:
          "Pro Finding Owner + Frist + Re-Test. Critical < 30d, High < 90d. Acceptance-Prozess für nicht-behebbare Findings.",
        defaultDurationDays: 30,
      },
    ],
    safeguardsIg3Additional: [
      {
        title: "18.4 Security-Maßnahmen validieren",
        description:
          "Nicht nur Schwachstellen suchen, sondern explizit Wirksamkeit der Detektions-Controls testen (Purple Team, Atomic Red Team).",
        defaultDurationDays: 30,
      },
      {
        title: "18.5 Periodische interne Pen-Tests",
        description:
          "Lateral-Movement-Szenarien aus Innentäter- oder Post-Compromise-Perspektive. Mindestens jährlich.",
        defaultDurationDays: 30,
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// Setup-Step (gemeinsam für alle 3 Templates)
// ──────────────────────────────────────────────────────────────

const CIS_SETUP_STEP: SeedStep = {
  code: "CIS-S00",
  phaseCode: "setup",
  sequence: 0,
  name: "Programm-Setup: Charter, Scope, Owner-Modell",
  description:
    "CIS-Implementierung erfordert klare Owner-Zuteilung pro Control + verbindliches Mandate der GL. Output: Charter mit Scope, Owner pro Control-Bereich (typischerweise 6-8 Bereichs-Owner für die 18 Controls), Tooling-Bereitstellung.",
  isoClause: "5.1",
  defaultOwnerRole: "admin",
  defaultDurationDays: 14,
  requiredEvidenceCount: 1,
  isMilestone: true,
  targetModuleLink: { module: "documents", route: "/documents" },
  subtasks: [
    {
      title: "CIS-Briefing für GL vorbereiten",
      description:
        "Foliendeck mit Treibern (Cyber-Bedrohungslage, regulatorische Pflichten, Cyber-Versicherungs-Anforderungen), gewähltem IG-Level (IG1/IG2/IG3) und Aufwand-Schätzung.",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 3,
      deliverableType: "presentation",
    },
    {
      title: "Charter mit IG-Auswahl + Scope schreiben",
      description:
        "Inhalte: Begründung gewähltes IG-Level, Geltungsbereich (Standorte/Entitäten), Sponsoren, Steering-Committee, Y1-Budget, Reporting-Kadenz.",
      defaultOwnerRole: "admin",
      defaultDurationDays: 5,
      deliverableType: "policy",
    },
    {
      title: "Bereichs-Owner pro Control benennen",
      description:
        "Typisch 6-8 Owner: IT-Infrastruktur, Endpoint, Network, Identity, Data Privacy, AppSec, Awareness, Incident Response. Persönliche schriftliche Nominierung.",
      defaultOwnerRole: "admin",
      defaultDurationDays: 4,
      deliverableType: "register",
    },
    {
      title: "Tooling-Inventar + Lücken-Analyse",
      description:
        "Welche der ~15 typischen Tool-Kategorien (EDR, SIEM, MDM, IAM, MFA, Backup, Pen-Test) sind vorhanden? Was muss beschafft werden? Budgetposten.",
      defaultOwnerRole: "control_owner",
      defaultDurationDays: 7,
      deliverableType: "register",
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// Step-Builder per IG-Level
// ──────────────────────────────────────────────────────────────

function buildStep(spec: ControlSpec, igLevel: 1 | 2 | 3): SeedStep {
  const subtasks: SeedSubtask[] = [];
  if (igLevel >= 1) subtasks.push(...spec.safeguardsIg1);
  if (igLevel >= 2) subtasks.push(...spec.safeguardsIg2Additional);
  if (igLevel >= 3) subtasks.push(...spec.safeguardsIg3Additional);

  return {
    code: spec.code,
    phaseCode: spec.phaseCode,
    sequence: spec.sequence,
    name: spec.name,
    description: spec.description,
    isoClause: undefined,
    defaultOwnerRole: spec.defaultOwnerRole,
    defaultDurationDays: spec.defaultDurationDays,
    prerequisiteStepCodes: spec.prerequisiteStepCodes,
    targetModuleLink: spec.targetModuleLink,
    requiredEvidenceCount: spec.requiredEvidenceCount,
    isMilestone: spec.isMilestone,
    subtasks,
  };
}

// Review-Step (gemeinsam)
const CIS_REVIEW_STEP_BASE: Omit<SeedStep, "code" | "sequence"> = {
  phaseCode: "review",
  name: "Programm-Review + Y2-Roadmap",
  description:
    "Bewertung des Reife-Levels nach Abschluss der Y1-Phase. Empfohlen: CIS Self-Assessment Tool (CIS-CSAT) oder externes Maturity-Assessment. Output: Y2-Roadmap mit nächstem IG-Sprung oder Vertiefung.",
  defaultOwnerRole: "admin",
  defaultDurationDays: 14,
  prerequisiteStepCodes: ["CIS-17"],
  targetModuleLink: { module: "isms", route: "/isms/maturity" },
  requiredEvidenceCount: 1,
  isMilestone: true,
  subtasks: [
    {
      title: "CIS-CSAT-Assessment durchführen",
      description:
        "Pro Safeguard Reife-Bewertung (0-5). Visualisierung als Spider-Diagramm. Lücken priorisieren.",
      defaultDurationDays: 7,
    },
    {
      title: "Maturity-Bericht für Steering",
      description:
        "Erreichtes Level, verbleibende Lücken, ROI der Investitionen, Budget-Empfehlung Y2.",
      defaultDurationDays: 5,
      deliverableType: "evidence",
    },
    {
      title: "Y2-Roadmap erstellen",
      description:
        "Aufstieg auf nächste IG, Vertiefung schwacher Bereiche, neue Bedrohungen aus aktuellen Reports berücksichtigen.",
      defaultDurationDays: 7,
      deliverableType: "policy",
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// Templates: IG1, IG2, IG3
// ──────────────────────────────────────────────────────────────

function buildTemplate(
  igLevel: 1 | 2 | 3,
  estimatedDurationDays: number,
): SeedTemplate {
  // Filter steps: Controls 13, 16, 18 sind IG1 nur Foundation — kein Subtask
  // bei IG1, daher in der Step-Liste auch nur ab IG2 sinnvoll.
  const steps: SeedStep[] = [CIS_SETUP_STEP];

  for (const spec of CIS_CONTROL_SPECS) {
    const stepSubtasksCount =
      (igLevel >= 1 ? spec.safeguardsIg1.length : 0) +
      (igLevel >= 2 ? spec.safeguardsIg2Additional.length : 0) +
      (igLevel >= 3 ? spec.safeguardsIg3Additional.length : 0);
    if (stepSubtasksCount === 0) continue;
    steps.push(buildStep(spec, igLevel));
  }

  steps.push({
    ...CIS_REVIEW_STEP_BASE,
    code: "CIS-REVIEW",
    sequence: 99,
  });

  return {
    code: `cis-v8-ig${igLevel}`,
    msType: "isms",
    name: `CIS Controls v8 — Implementation Group ${igLevel}`,
    description:
      igLevel === 1
        ? "Essential Cyber Hygiene nach CIS Controls v8 — 56 Safeguards in 15 Controls (Controls 13, 16, 18 nicht in IG1). Mindeststandard für jede Organisation, schützt vor opportunistischen Angriffen."
        : igLevel === 2
          ? "Enterprise Cybersecurity nach CIS Controls v8 — 130 Safeguards (alle 18 Controls). Schutz vor zielgerichteten Angriffen. Setzt IG1 als abgeschlossen voraus."
          : "Advanced Cybersecurity nach CIS Controls v8 — vollständige 153 Safeguards (alle 18 Controls). Schutz vor APT, Insider-Bedrohungen, Zero-Days. Setzt IG2 als abgeschlossen voraus.",
    version: "1.0",
    frameworkCodes: [`CIS-v8-IG${igLevel}`, "CIS-Controls-v8.1"],
    estimatedDurationDays,
    phases: CIS_PHASES,
    steps,
  };
}

export const CIS_IG1_TEMPLATE: SeedTemplate = buildTemplate(1, 270);
export const CIS_IG2_TEMPLATE: SeedTemplate = buildTemplate(2, 365);
export const CIS_IG3_TEMPLATE: SeedTemplate = buildTemplate(3, 540);

export const CIS_TEMPLATES: SeedTemplate[] = [
  CIS_IG1_TEMPLATE,
  CIS_IG2_TEMPLATE,
  CIS_IG3_TEMPLATE,
];
