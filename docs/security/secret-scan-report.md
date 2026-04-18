# Secret-Scan Report

_Generated: 2026-04-18T06:23:24.037Z_

Files scanned: 2874. Findings: 6.

| File | Line | Pattern | Severity | Match |
|---|---|---|---|---|
| `apps/web/src/app/(dashboard)/access-log/page.tsx` | 71 | Generic password assignment | medium | `password: "Password"...` |
| `packages/db/sql/fix_umlauts_v3.sql` | 3 | Generic password assignment | medium | `PASSWORD = "grc_dev_...` |
| `packages/shared/tests/identity-schemas.test.ts` | 161 | Generic password assignment | medium | `password: "secure-pa...` |
| `packages/shared/tests/schemas.test.ts` | 457 | Generic password assignment | medium | `password: "SecureP@s...` |
| `packages/shared/tests/schemas.test.ts` | 474 | Generic password assignment | medium | `password: "Str0ngP@s...` |
| `packages/shared/tests/schemas.test.ts` | 505 | Generic password assignment | medium | `password: "12345678"...` |