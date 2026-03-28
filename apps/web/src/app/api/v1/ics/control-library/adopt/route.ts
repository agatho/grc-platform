import { db, controlLibraryEntry, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { adoptControlsSchema } from "@grc/shared";

// POST /api/v1/ics/control-library/adopt — Adopt library controls into org
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = adoptControlsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const libraryEntries = await db.select().from(controlLibraryEntry)
    .where(inArray(controlLibraryEntry.id, body.data.libraryEntryIds));

  if (libraryEntries.length === 0) {
    return Response.json({ error: "No library entries found" }, { status: 404 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const adopted = [];
    for (const entry of libraryEntries) {
      const title = typeof entry.title === "object" && entry.title !== null
        ? (entry.title as Record<string, string>).en ?? (entry.title as Record<string, string>).de ?? entry.controlRef
        : entry.controlRef;
      const [newControl] = await tx.insert(control).values({
        orgId: ctx.orgId,
        title,
        description: typeof entry.description === "object" && entry.description !== null
          ? (entry.description as Record<string, string>).en ?? ""
          : "",
        controlType: entry.controlType as "preventive" | "detective" | "corrective",
        frequency: entry.frequency,
        status: "draft",
        sourceLibraryRef: entry.controlRef,
        createdBy: ctx.userId,
      }).returning();
      adopted.push(newControl);
    }
    return adopted;
  });

  return Response.json({ data: created, count: created.length }, { status: 201 });
}
