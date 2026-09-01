-- Migration 0410: user_role — eine Quelle der Wahrheit
--
-- Migration: 0410_user_role_enum_single_source
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP3 · S02-14, S06-12, S07-22]
--
-- Befund S02-14: Das Rollenmodell war dreifach inkonsistent —
--   * DB-Enum `user_role`         9 Werte
--   * TS-Union `UserRole`        20 Werte
--   * `withAuth(...)`-Guards     17 Werte, davon 8 nicht im Enum
-- 113 Guard-Slots über 79 Routendateien waren damit nicht zuweisbar: ein
-- `POST /api/v1/users/{id}/roles` mit `{"role":"ciso"}` scheiterte mit
-- 22P02/invalid input value for enum. Praktische Folge: wer ISMS-Freigaben
-- brauchte, musste `admin` bekommen — Least Privilege war nicht umsetzbar,
-- was die Wirkung von S02-02 und S02-03 direkt verstärkte.
--
-- Ursache waren die Migrationen 0096 und 0318, die die fehlenden Werte
-- ergänzen, aber nie durchliefen (BASE-002 / S09). Mit WP1 laufen sie wieder;
-- diese Migration ist die IDEMPOTENTE Absicherung, damit das Enum unabhängig
-- von der Historie einer Instanz vollständig ist.
--
-- WICHTIG: `ALTER TYPE ... ADD VALUE` darf im selben Transaktionsblock nicht
-- VERWENDET werden. Diese Datei fügt deshalb ausschließlich Werte hinzu und
-- liest keinen davon. Jede Verwendung steht in 0411+.
--
-- Die endgültige, verbindliche Rollenliste (20 Werte) ist ab sofort in
-- `packages/shared/src/types/platform.ts` als `USER_ROLES` deklariert; ein
-- Test (`packages/db/tests/role-model-consistency.test.ts`) vergleicht
-- Enum ↔ TS-Union ↔ Guard-Verwendung und schlägt bei Drift fehl.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'compliance_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ciso';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'bcm_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contract_manager';
-- S06-12: `quality_manager` war toter Code, weil der Enum-Wert fehlte.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'quality_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'security_analyst';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'department_head';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'external_auditor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'esg_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'esg_contributor';
-- S07-22: `ombudsperson` fehlte im Enum, obwohl die HinSchG-Isolation der
-- Middleware ausdrücklich darauf prüft.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ombudsperson';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vendor_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'whistleblowing_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'process_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'control_owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'risk_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dpo';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
