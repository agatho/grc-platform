import { db, processTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/bpm/templates — Browse template library (read-only)
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "risk_manager",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");

  let rows;
  if (domain) {
    rows = await db
      .select()
      .from(processTemplate)
      .where(eq(processTemplate.domain, domain));
  } else {
    rows = await db
      .select()
      .from(processTemplate)
      .where(eq(processTemplate.isPublished, true));
  }

  return Response.json({ data: rows });
}

// POST, PUT, PATCH, DELETE — Not allowed (templates are seed data)
export async function POST() {
  return Response.json(
    {
      error:
        "Templates are managed by the platform. Use POST /api/v1/bpm/templates/:id/adopt to adopt a template.",
    },
    { status: 405 },
  );
}

export async function PUT() {
  return Response.json(
    { error: "Templates cannot be modified via API" },
    { status: 405 },
  );
}

export async function DELETE() {
  return Response.json(
    { error: "Templates cannot be deleted via API" },
    { status: 405 },
  );
}
