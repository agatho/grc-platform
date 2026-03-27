# ARCTOS Developer Guide

A concise onboarding guide for new developers.

---

## Architecture

### Monorepo Structure

```
arctos/
├── apps/
│   ├── web/          Next.js 15 (frontend + API routes)
│   └── worker/       Hono.js (background jobs, cron, webhooks)
├── packages/
│   ├── db/           Drizzle ORM schemas, migrations, seeds
│   ├── shared/       Zod schemas, types, constants, utilities
│   ├── auth/         Auth.js adapter + RBAC middleware + org context
│   ├── ui/           shadcn/ui component library
│   ├── ai/           AI provider router (Claude, Ollama, OpenAI, Gemini)
│   └── email/        Email templates + sending service
├── docs/             ADRs, PRD, Data Model, this guide
├── messages/         i18n (de/, en/)
└── CLAUDE.md         Project conventions
```

`apps/web` handles the frontend (React Server Components) and all REST API routes.
`apps/worker` runs cron jobs, webhook processing, and long-running workflows.
Shared logic lives in `packages/*` -- never import `apps/web` code from `packages/`.

### Request Lifecycle

Every API request flows through this middleware chain:

```
Request
  -> Auth.js session check (auth())
  -> withAuth(...roles)          Resolve org context + check roles
  -> requireModule(key)          Verify module is enabled for org
  -> Zod validation              Parse + validate request body
  -> withAuditContext(ctx, fn)   Execute in audited transaction
  -> Response.json(...)          Return JSON response
```

**Key helpers** (defined in `apps/web/src/lib/api.ts`):

- `withAuth(...roles)` -- Returns `ApiContext { session, orgId, userId }` or a 401/403 Response.
  Called with no args = any authenticated user. Called with roles = role check.
- `requireModule(key, orgId, method)` -- Returns null (ok) or 403 Response.
  Checks `module_config` table. Read-only modules still allow GET.
- `withAuditContext(ctx, fn)` -- Wraps `fn` in a DB transaction with
  `SET LOCAL app.current_user_id` and `app.current_org_id` for RLS + audit triggers.
- `paginate(req)` / `paginatedResponse(items, total, page, limit)` -- Standard pagination.

### Database: Drizzle ORM + RLS + Audit Triggers

**Drizzle ORM** provides type-safe, SQL-close database access. Schemas are defined in
`packages/db/src/schema/` (one file per domain). Drizzle generates SQL migrations.

**Row-Level Security (RLS):** Every data table has `org_id`. PostgreSQL RLS policies
enforce that users can only read/write rows matching their org context. The org_id is
set via `SET LOCAL app.current_org_id` at the start of each transaction.

**Audit triggers:** DB triggers on all data tables automatically insert into `audit_log`
on INSERT/UPDATE/DELETE. Each entry includes a SHA-256 hash chain linking to the
previous entry, ensuring tamper-evidence.

### Module System

ARCTOS uses a module system to gate features per organization:

1. `module_definition` -- Platform-level: defines all available modules (erm, ics, bpm, etc.)
2. `module_config` -- Per-org: stores `ui_status` (active/hidden/read_only) and `is_data_active`
3. `requireModule(key)` -- Middleware: checks if the module is enabled before processing the request
4. `ModuleGate` -- Frontend component: conditionally renders UI based on module config

Modules: `erm`, `ics`, `bpm`, `dms`, `isms`, `bcms`, `dpms`, `audit`, `tprm`, `contract`, `esg`, `whistleblowing`

---

## Adding a New Module

Step-by-step guide for adding a new module (e.g., "vendor_audit").

### 1. Create Schema

Create `packages/db/src/schema/vendor-audit.ts`:

```typescript
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { user } from "./user";

export const vendorAudit = pgTable("vendor_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id),
  title: text("title").notNull(),
  // ... domain columns
  createdBy: uuid("created_by").references(() => user.id),
  updatedBy: uuid("updated_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});
```

Export from `packages/db/src/index.ts`.

### 2. Generate + Apply Migration

```bash
cd packages/db
npx drizzle-kit generate    # creates SQL in drizzle/
npx drizzle-kit push        # applies to DB (dev)
# -- or for production --
npx drizzle-kit migrate     # runs pending migrations
```

### 3. Enable RLS + Audit Triggers

Add to the generated migration SQL (or create a follow-up migration):

```sql
-- RLS
ALTER TABLE vendor_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_audit_org_isolation ON vendor_audit
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER vendor_audit_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON vendor_audit
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
```

### 4. Add Shared Types

In `packages/shared/src/types.ts` (or a new file under `types/`):

```typescript
export type VendorAuditStatus = "planned" | "in_progress" | "completed";
```

### 5. Add Zod Schemas

In `packages/shared/src/schemas.ts` (or a new file under `schemas/`):

```typescript
export const createVendorAuditSchema = z.object({
  title: z.string().min(1).max(500),
  // ...
});
```

### 6. Create API Routes

Create `apps/web/src/app/api/v1/vendor-audit/route.ts`. Follow the standard pattern:

```typescript
import { db, vendorAudit } from "@grc/db";
import { createVendorAuditSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("vendor_audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createVendorAuditSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }
  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.insert(vendorAudit).values({
      ...body.data, orgId: ctx.orgId, createdBy: ctx.userId, updatedBy: ctx.userId,
    }).returning();
    return row;
  });
  return Response.json({ data: created }, { status: 201 });
}
```

### 7. Create Frontend Pages

In `apps/web/src/app/(dashboard)/vendor-audit/page.tsx`:

```typescript
import { ModuleGate } from "@/components/module-gate";

export default function VendorAuditPage() {
  return (
    <ModuleGate moduleKey="vendor_audit">
      {/* Page content */}
    </ModuleGate>
  );
}
```

### 8. Add i18n Keys

Add to `messages/de/vendor-audit.json` and `messages/en/vendor-audit.json`:

```json
{
  "title": "Vendor Audit",
  "create": "Create Vendor Audit"
}
```

### 9. Register Work Item Type (if needed)

Insert into `work_item_type` table if this module tracks items in the universal work
item system. This enables cross-module dashboards and task tracking.

---

## Conventions

### File Naming

- Files: `kebab-case.ts` (e.g., `vendor-audit.ts`, `risk-treatment.ts`)
- Types/Interfaces: `PascalCase` (e.g., `VendorAudit`, `RiskTreatment`)
- Variables/Functions: `camelCase` (e.g., `createVendorAudit`, `getRiskById`)
- DB tables/columns: `snake_case` (e.g., `vendor_audit`, `risk_treatment`)
- API endpoints: kebab-case plural (`/api/v1/vendor-audits`)

### API Pattern

Every API route follows the same structure:

```
withAuth(...roles)       -> authenticate + authorize
requireModule(key)       -> check module is enabled
zodSchema.safeParse()    -> validate input
withAuditContext(ctx)    -> execute in audited transaction
Response.json()          -> return response
```

Status codes: 200 (ok), 201 (created), 400 (bad request), 401 (unauthorized),
403 (forbidden), 404 (not found), 409 (conflict), 422 (validation error), 429 (rate limit).

### Status Transitions

- Define valid transitions in `packages/shared` as a `Record<Status, Status[]>`
- Validate server-side before applying
- Map domain status to `work_item` status when applicable
- Send notifications on critical transitions

### Table Requirements

Every data table must have:
- `id` (UUID, primary key, `defaultRandom()`)
- `org_id` (FK to organization, not null)
- `created_by` / `updated_by` (FK to user)
- `created_at` / `updated_at` (timestamps)
- `deleted_at` (soft delete)
- RLS policy on `org_id`
- Audit trigger

---

## Testing

### Unit Tests

Location: `packages/shared/` (schemas, utilities, computations)

```bash
npx turbo test --filter=@grc/shared
```

Tests Zod schemas, status transition logic, computation functions (CES, residual scores,
materiality matrix, BPMN validation, etc.).

### Integration Tests

Location: `packages/db/` (RLS policies, audit triggers)

```bash
npx turbo test --filter=@grc/db
```

Tests that RLS prevents cross-org access and that audit triggers fire correctly.

### Running All Tests

```bash
npx turbo test          # run all tests
npx turbo test -- --ui  # vitest UI mode
```

Coverage targets: backend > 80%, frontend > 60%.

---

## Common Tasks

### Add a New API Endpoint

1. Create `apps/web/src/app/api/v1/<resource>/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` async functions
3. Use `withAuth()` + `requireModule()` + Zod validation + `withAuditContext()`
4. Add types/schemas to `packages/shared/`

### Add a New Database Table

1. Create schema in `packages/db/src/schema/<domain>.ts`
2. Export from `packages/db/src/index.ts`
3. Run `npx drizzle-kit generate` + `npx drizzle-kit push`
4. Add RLS policy + audit trigger in migration SQL
5. Add Zod schemas in `packages/shared/`

### Add a New Frontend Page

1. Create `apps/web/src/app/(dashboard)/<module>/page.tsx` (Server Component)
2. Wrap in `<ModuleGate moduleKey="...">` for module gating
3. Use `"use client"` only for interactive components
4. Add navigation entry in the sidebar config
5. Add i18n keys in `messages/de/` and `messages/en/`

### Add a New Email Template

1. Create template in `packages/email/src/templates/`
2. Define type in `packages/email/src/types.ts`
3. Register in `EmailService.ts`
4. Trigger from API route or worker cron

### Add a New Worker Cron Job

1. Create handler in `apps/worker/src/crons/`
2. Register in `apps/worker/src/index.ts`
3. Define schedule (cron expression)
4. Use `@grc/db` for database access (same schemas as web)

---

## Environment

```
Database: postgresql://grc:grc_dev_password@localhost:5432/grc_platform
Extensions: pgcrypto, uuid-ossp, vector, timescaledb
Node: 22  |  TypeScript: 5  |  PostgreSQL: 16
```

Start dev servers:

```bash
npx turbo dev           # all apps
npx turbo dev --filter=web   # web only
npx turbo dev --filter=worker # worker only
```

Database commands:

```bash
cd packages/db
npx drizzle-kit studio  # visual DB browser
npx drizzle-kit generate # generate migration from schema changes
npx drizzle-kit push    # apply schema directly (dev)
npx tsx src/seed.ts     # run seed data
```
