import { db, vendorSubProcessor } from "@grc/db";
import { createSubProcessorSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/tprm/sub-processors?vendorId=...
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  const { limit, offset } = paginate(url.searchParams);
  const conditions = [eq(vendorSubProcessor.orgId, ctx.orgId)];
  if (vendorId) conditions.push(eq(vendorSubProcessor.vendorId, vendorId));

  const rows = await db.select().from(vendorSubProcessor).where(and(...conditions)).orderBy(desc(vendorSubProcessor.createdAt)).limit(limit).offset(offset);
  return paginatedResponse(rows, rows.length, limit, offset);
}

// POST /api/v1/tprm/sub-processors?vendorId=...
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  if (!vendorId) return Response.json({ error: "vendorId required" }, { status: 400 });

  const body = createSubProcessorSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  // Auto-compute country risk flags (reuse Sprint 37 adequacy data)
  const EU_EEA_COUNTRIES = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO"];
  const ADEQUACY_COUNTRIES = ["AD","AR","CA","FO","GG","IL","IM","JP","JE","NZ","KR","CH","GB","UY"];
  const country = body.data.hostingCountry?.toUpperCase();
  const isEu = country ? EU_EEA_COUNTRIES.includes(country) : false;
  const isAdequateCountry = country ? ADEQUACY_COUNTRIES.includes(country) || isEu : false;
  const requiresTia = country ? !isEu && !isAdequateCountry : false;

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.insert(vendorSubProcessor).values({
      orgId: ctx.orgId,
      vendorId,
      name: body.data.name,
      serviceDescription: body.data.serviceDescription,
      dataCategories: body.data.dataCategories,
      hostingCountry: body.data.hostingCountry,
      isEu,
      isAdequateCountry,
      requiresTia,
      dateAdded: body.data.dateAdded,
    }).returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
