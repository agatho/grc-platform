# ARCTOS — Implementation Pattern Guide

Copy-paste patterns for Claude Code. Every new module follows these exact patterns.

---

## Pattern 1: SQL Migration with RLS

```sql
-- Migration XXX: Create [entity] table
CREATE TABLE [entity] (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organization(id),
  -- domain fields here --
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES "user"(id),
  deleted_at  timestamptz
);

CREATE INDEX [entity]_org_idx ON [entity](org_id);
ALTER TABLE [entity] ENABLE ROW LEVEL SECURITY;
CREATE POLICY [entity]_org_isolation ON [entity]
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Register audit trigger
CREATE TRIGGER [entity]_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON [entity]
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

## Pattern 2: Drizzle Schema with Relations

```typescript
// packages/db/src/schema/[domain].ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./organization";
import { user } from "./user";

export const entityStatusEnum = pgEnum("entity_status", [
  "draft",
  "active",
  "archived",
]);

export const entity = pgTable(
  "entity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: entityStatusEnum("status").notNull().default("draft"),
    ownerId: uuid("owner_id").references(() => user.id),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgIdx: index("entity_org_idx").on(table.orgId),
    statusIdx: index("entity_status_idx").on(table.orgId, table.status),
  }),
);

export const entityRelations = relations(entity, ({ one }) => ({
  organization: one(organization, {
    fields: [entity.orgId],
    references: [organization.id],
  }),
  owner: one(user, { fields: [entity.ownerId], references: [user.id] }),
  creator: one(user, { fields: [entity.createdBy], references: [user.id] }),
}));
```

## Pattern 3: Zod Schema with Status Transitions

```typescript
// packages/shared/src/schemas/[domain].ts
import { z } from "zod";

export const createEntitySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateEntitySchema = createEntitySchema.partial();

export const entityStatusTransitions: Record<string, string[]> = {
  draft: ["active", "cancelled"],
  active: ["archived"],
  archived: [],
  cancelled: [],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return entityStatusTransitions[from]?.includes(to) ?? false;
}

export const entityListQuerySchema = z.object({
  status: z.enum(["draft", "active", "archived"]).optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
```

## Pattern 4: API Route (Hono.js with Middleware)

```typescript
// apps/web/src/app/api/v1/[entities]/route.ts
import { Hono } from "hono";
import {
  requireAuth,
  requireModule,
  orgContext,
  requireRole,
} from "@/middleware";
import {
  createEntitySchema,
  entityListQuerySchema,
} from "@arctos/shared/schemas/domain";

const app = new Hono().use(
  "*",
  requireAuth(),
  requireModule("module_key"),
  orgContext(),
);

// GET /api/v1/entities — List with filters + pagination
app.get("/", async (c) => {
  const orgId = c.get("orgId");
  const query = entityListQuerySchema.parse(c.req.query());

  let where = and(eq(entity.orgId, orgId), isNull(entity.deletedAt));
  if (query.status) where = and(where, eq(entity.status, query.status));
  if (query.search)
    where = and(where, ilike(entity.title, `%${query.search}%`));

  const [data, totalResult] = await Promise.all([
    db.query.entity.findMany({
      where,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      orderBy: desc(entity.createdAt),
      with: {
        owner: { columns: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.select({ count: count() }).from(entity).where(where),
  ]);

  return c.json({
    data,
    total: totalResult[0].count,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// POST /api/v1/entities — Create
app.post("/", requireRole(["admin", "risk_manager"]), async (c) => {
  const body = createEntitySchema.parse(await c.req.json());
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [created] = await db
    .insert(entity)
    .values({
      orgId,
      ...body,
      createdBy: userId,
    })
    .returning();

  return c.json({ data: created }, 201);
});

// PUT /api/v1/entities/:id/status — Status transition
app.put("/:id/status", requireRole(["admin", "risk_manager"]), async (c) => {
  const { id } = c.req.param();
  const { status: targetStatus } = z
    .object({ status: z.string() })
    .parse(await c.req.json());
  const orgId = c.get("orgId");

  const current = await db.query.entity.findFirst({
    where: and(eq(entity.id, id), eq(entity.orgId, orgId)),
  });
  if (!current) return c.json({ error: "Not found" }, 404);
  if (!isValidStatusTransition(current.status, targetStatus)) {
    return c.json(
      { error: `Invalid transition: ${current.status} → ${targetStatus}` },
      400,
    );
  }

  const [updated] = await db
    .update(entity)
    .set({ status: targetStatus, updatedAt: new Date() })
    .where(eq(entity.id, id))
    .returning();

  return c.json({ data: updated });
});

export default app;
```

## Pattern 5: Frontend Page with ModuleGate

```tsx
// apps/web/src/app/(dashboard)/[module]/page.tsx
import { ModuleGate } from "@arctos/ui";
import { useTranslations } from "next-intl";

export default function EntityListPage() {
  return (
    <ModuleGate moduleKey="module_key">
      <EntityListContent />
    </ModuleGate>
  );
}

function EntityListContent() {
  const t = useTranslations("domain");
  const { data, isLoading } = useQuery({
    queryKey: ["entities"],
    queryFn: () => api.get("/api/v1/entities"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={() => router.push("/module/new")}>
          {t("create")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
```

## Pattern 6: Integration Test with RLS

```typescript
// apps/web/src/__tests__/api/entity.api.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  testFetch,
  adminA,
  userB,
  viewerA,
  createTestEntity,
} from "../helpers";

describe("Entity API", () => {
  it("creates entity", async () => {
    const res = await testFetch("/api/v1/entities", {
      method: "POST",
      token: adminA.token,
      body: { title: "Test Entity" },
    });
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.title).toBe("Test Entity");
    expect(data.orgId).toBe(adminA.orgId);
  });

  it("RLS: Org B cannot see Org A entities", async () => {
    const entity = await createTestEntity(adminA.token);
    const res = await testFetch(`/api/v1/entities/${entity.id}`, {
      token: userB.token,
    });
    expect(res.status).toBe(404); // RLS filters it out
  });

  it("viewer cannot create", async () => {
    const res = await testFetch("/api/v1/entities", {
      method: "POST",
      token: viewerA.token,
      body: { title: "Blocked" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects invalid status transition", async () => {
    const entity = await createTestEntity(adminA.token, { status: "draft" });
    const res = await testFetch(`/api/v1/entities/${entity.id}/status`, {
      method: "PUT",
      token: adminA.token,
      body: { status: "archived" },
    });
    expect(res.status).toBe(400); // draft → archived not allowed
  });
});
```

## Pattern 7: Worker Job (Cron)

```typescript
// apps/worker/src/jobs/entity-reminder.ts
import { db } from "@arctos/db";
import { entity } from "@arctos/db/schema";
import { createNotification, createTask } from "@arctos/shared/services";

export async function entityReminderJob() {
  const today = new Date();
  const items = await db
    .select()
    .from(entity)
    .where(
      and(
        lte(entity.nextReviewDate, addDays(today, 30).toISOString()),
        eq(entity.isActive, true),
        isNull(entity.deletedAt),
      ),
    );

  for (const item of items) {
    const daysUntil = differenceInDays(new Date(item.nextReviewDate!), today);
    if (daysUntil === 30 || daysUntil === 0 || daysUntil === -14) {
      await createNotification({
        userId: item.ownerId!,
        orgId: item.orgId,
        type: daysUntil < 0 ? "overdue" : "reminder",
        title: daysUntil < 0 ? "Überfällig" : "Fällig in ${daysUntil} Tagen",
        channel: "both",
      });
    }
    if (daysUntil <= 0) {
      await createTask({
        orgId: item.orgId,
        sourceEntityType: "entity",
        sourceEntityId: item.id,
        assigneeId: item.ownerId!,
        title: `Review fällig: ${item.title}`,
        dueDate: item.nextReviewDate!,
      });
    }
  }
}
// Register in apps/worker/src/index.ts: cron('0 7 * * *', entityReminderJob)
```

## Pattern 8: Bulk Operations

```typescript
// Zod schema — always cap at 100
export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_status"),
    ids: z.array(z.string().uuid()).min(1).max(100),
    targetStatus: z.string(),
  }),
  z.object({
    action: z.literal("change_owner"),
    ids: z.array(z.string().uuid()).min(1).max(100),
    targetOwnerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("export"),
    ids: z.array(z.string().uuid()).min(1).max(100),
    format: z.enum(["excel", "csv"]).default("excel"),
  }),
]);

// API route — POST /api/v1/entities/bulk
app.post("/bulk", requireRole(["admin"]), async (c) => {
  const body = bulkActionSchema.parse(await c.req.json());
  const orgId = c.get("orgId");
  const results: { id: string; success: boolean; reason?: string }[] = [];

  for (const id of body.ids) {
    try {
      // ... process each item with validation
      results.push({ id, success: true });
    } catch (e) {
      results.push({ id, success: false, reason: (e as Error).message });
    }
  }

  await logAuditEvent({
    orgId,
    userId: c.get("userId"),
    entityType: "entity",
    action: `bulk_${body.action}`,
    metadata: { affectedCount: results.filter((r) => r.success).length },
  });

  return c.json({
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    failures: results.filter((r) => !r.success),
  });
});
```

## Pattern 9: Dashboard with KPI Cards + Charts

```typescript
// API: GET /api/v1/[module]/dashboard
app.get("/dashboard", requireRole(["admin", "risk_manager"]), async (c) => {
  const orgId = c.get("orgId");
  const [total, active, overdue, statusDist] = await Promise.all([
    db
      .select({ count: count() })
      .from(entity)
      .where(and(eq(entity.orgId, orgId), isNull(entity.deletedAt))),
    db
      .select({ count: count() })
      .from(entity)
      .where(and(eq(entity.orgId, orgId), eq(entity.status, "active"))),
    db
      .select({ count: count() })
      .from(entity)
      .where(
        and(
          eq(entity.orgId, orgId),
          lte(entity.nextReviewDate, new Date().toISOString()),
        ),
      ),
    db
      .select({ status: entity.status, count: count() })
      .from(entity)
      .where(and(eq(entity.orgId, orgId), isNull(entity.deletedAt)))
      .groupBy(entity.status),
  ]);
  return c.json({
    total: total[0].count,
    active: active[0].count,
    overdue: overdue[0].count,
    statusDistribution: statusDist,
  });
});
```

## Pattern 10: i18n Namespace File

```json
// apps/web/messages/de/[domain].json
{
  "title": "Modulname",
  "create": "Erstellen",
  "edit": "Bearbeiten",
  "delete": "Löschen",
  "status.draft": "Entwurf",
  "status.active": "Aktiv",
  "status.archived": "Archiviert",
  "filter.all": "Alle",
  "filter.status": "Status",
  "filter.owner": "Verantwortlich",
  "confirm.delete": "Wirklich löschen?",
  "success.created": "Erfolgreich erstellt",
  "success.updated": "Erfolgreich aktualisiert",
  "error.notFound": "Nicht gefunden",
  "error.invalidTransition": "Ungültiger Statusübergang"
}
```
