import { db, ccmConnector } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { createCcmConnectorSchema } from "@grc/shared";

// GET /api/v1/ics/ccm/connectors — List CCM connectors
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);
  const where = eq(ccmConnector.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(ccmConnector).where(where)
      .orderBy(desc(ccmConnector.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(ccmConnector).where(where),
  ]);

  // Strip credentials from response
  const sanitized = items.map((c) => ({ ...c, credentialRef: c.credentialRef ? "***" : null }));

  return paginatedResponse(sanitized, total, page, limit);
}

// POST /api/v1/ics/ccm/connectors — Create CCM connector
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createCcmConnectorSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Validate HTTPS-only for URLs in config (SSRF protection)
  const configUrl = body.data.config?.url as string | undefined;
  if (configUrl) {
    try {
      const url = new URL(configUrl);
      if (url.protocol !== "https:") {
        return Response.json({ error: "Only HTTPS URLs are allowed" }, { status: 422 });
      }
      const hostname = url.hostname;
      if (hostname === "localhost" || hostname.startsWith("10.") || hostname.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
        return Response.json({ error: "Internal IP addresses are not allowed" }, { status: 422 });
      }
    } catch { /* not a URL, skip validation */ }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx.insert(ccmConnector).values({
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      ...body.data,
    }).returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}
