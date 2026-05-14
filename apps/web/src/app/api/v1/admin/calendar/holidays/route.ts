// GET/POST/DELETE /api/v1/admin/calendar/holidays
//
// #WAVE17-P2-04: Wave-14 QA flagged this as a 404. Holidays drive
// SLA-clock pauses (DSR Art. 12 GDPR, audit-finding remediation
// deadlines, contract notice periods) — without them the platform
// counts weekend + national-holiday days as business days and over-
// reports overdue items.
//
// Pragmatic storage: holidays live as an array under
// `organization.settings.holidays` rather than a dedicated table —
// a typical org has 10-20 entries per year, JSONB is cheap, and
// avoiding a migration keeps Wave-17 polish-sized. If a future wave
// needs cross-org holiday catalogues (multinational with EU+US+APAC
// office calendars) a dedicated `org_holiday` table can land then.

import { db, organization } from "@grc/db";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  recurringAnnually: boolean;
}

const createHolidaySchema = z.object({
  name: z.string().min(1).max(255),
  // ISO date YYYY-MM-DD; full-day, no time-of-day component.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  recurringAnnually: z.boolean().default(false),
});

function readHolidays(settings: unknown): Holiday[] {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return [];
  }
  const raw = (settings as Record<string, unknown>).holidays;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (h): h is Holiday =>
      h !== null &&
      typeof h === "object" &&
      typeof (h as Holiday).id === "string" &&
      typeof (h as Holiday).name === "string" &&
      typeof (h as Holiday).date === "string",
  );
}

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [row] = await db
    .select({ settings: organization.settings })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  const holidays = readHolidays(row?.settings).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return Response.json({
    data: {
      total: holidays.length,
      holidays,
    },
  });
});

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createHolidaySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ settings: organization.settings })
      .from(organization)
      .where(eq(organization.id, ctx.orgId));

    const current = readHolidays(existing?.settings);
    const newHoliday: Holiday = {
      id: crypto.randomUUID(),
      name: body.data.name,
      date: body.data.date,
      recurringAnnually: body.data.recurringAnnually,
    };

    const merged = {
      ...((existing?.settings as Record<string, unknown> | null) ?? {}),
      holidays: [...current, newHoliday],
    };

    await tx
      .update(organization)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(organization.id, ctx.orgId));

    return newHoliday;
  });

  return Response.json({ data: created }, { status: 201 });
});

export const DELETE = withErrorHandler(async function DELETE(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json(
      { error: "Missing required query param: id" },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ settings: organization.settings })
      .from(organization)
      .where(eq(organization.id, ctx.orgId));

    const current = readHolidays(existing?.settings);
    const filtered = current.filter((h) => h.id !== id);
    if (filtered.length === current.length) {
      return { removed: 0 };
    }

    const merged = {
      ...((existing?.settings as Record<string, unknown> | null) ?? {}),
      holidays: filtered,
    };

    await tx
      .update(organization)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(organization.id, ctx.orgId));

    return { removed: 1 };
  });

  if (result.removed === 0) {
    return Response.json({ error: "Holiday not found" }, { status: 404 });
  }
  return Response.json({ data: result });
});
