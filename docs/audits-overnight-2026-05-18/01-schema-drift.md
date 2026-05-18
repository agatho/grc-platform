# Schema Drift Audit (Drizzle ↔ SQL)

Stand: 2026-05-18 overnight session.

- Drizzle `pgTable()` definitions: **566**
- SQL `CREATE TABLE` statements: **568**
- In both: **566**

## Drizzle-only (no matching CREATE TABLE found): 0

These are Drizzle table definitions whose underlying CREATE TABLE was not found in any migration file. Either:

- the table is created by `seed_*.sql` (legitimate),
- the table is created via `CREATE TABLE LIKE` or `CREATE TABLE AS` (parser miss),
- the Drizzle definition is stale and references a removed table (real drift).

## SQL-only (CREATE TABLE but no Drizzle definition): 2

These tables exist in the DB but have no typed Drizzle access. Either intentional platform tables (audit_log, session, etc.) or untyped admin tables. Listed for visibility.

- `bpm_simulation_result` (first defined in `0046_sprint34_abac_simulation_dmn.sql`)
- `whistleblowing_audit_log` (first defined in `0284_audit_chain_rev2_per_tenant.sql`)
