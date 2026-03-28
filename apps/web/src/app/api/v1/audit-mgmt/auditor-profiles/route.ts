import { db, auditorProfile } from "@grc/db";
import { createAuditorProfileSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/audit-mgmt/auditor-profiles
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset } = paginate(new URL(req.url).searchParams);

  const rows = await db
    .select()
    .from(auditorProfile)
    .where(eq(auditorProfile.orgId, ctx.orgId))
    .orderBy(desc(auditorProfile.createdAt))
    .limit(limit)
    .offset(offset);

  // Strip hourlyRate for non-CAE/admin users
  const userRoles = ctx.roles ?? [];
  const isCAEorAdmin = userRoles.includes("admin") || userRoles.includes("cae");
  const sanitized = rows.map((r) => {
    if (!isCAEorAdmin) {
      const { hourlyRate: _, ...rest } = r;
      return rest;
    }
    return r;
  });

  return paginatedResponse(sanitized, sanitized.length, limit, offset);
}

// POST /api/v1/audit-mgmt/auditor-profiles
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createAuditorProfileSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditorProfile)
      .values({
        orgId: ctx.orgId,
        userId: body.data.userId,
        seniority: body.data.seniority,
        certifications: body.data.certifications ?? [],
        skills: body.data.skills ?? [],
        availableHoursYear: body.data.availableHoursYear,
        hourlyRate: body.data.hourlyRate?.toString(),
        team: body.data.team,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
