import { db, cveAssetMatch, cveFeedItem, vulnerability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { convertCveToVulnerabilitySchema } from "@grc/shared";

// POST /api/v1/isms/cve/matches/:id/convert — Convert CVE match to ISMS vulnerability
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = convertCveToVulnerabilitySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch the match and its CVE data
  const [match] = await db
    .select()
    .from(cveAssetMatch)
    .where(and(eq(cveAssetMatch.id, id), eq(cveAssetMatch.orgId, ctx.orgId)))
    .limit(1);

  if (!match) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.linkedVulnerabilityId) {
    return Response.json({ error: "Already converted to vulnerability" }, { status: 409 });
  }

  const [cve] = await db
    .select()
    .from(cveFeedItem)
    .where(eq(cveFeedItem.id, match.cveId))
    .limit(1);

  if (!cve) {
    return Response.json({ error: "CVE not found" }, { status: 404 });
  }

  // Map CVSS severity to vulnerability severity
  const severityMap: Record<string, string> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
    none: "low",
  };

  const result = await withAuditContext(ctx, async (tx) => {
    // Create vulnerability
    const [vuln] = await tx
      .insert(vulnerability)
      .values({
        orgId: ctx.orgId,
        title: parsed.data.title ?? `${cve.cveId}: ${cve.title.slice(0, 400)}`,
        description: cve.description ?? undefined,
        cveReference: cve.cveId,
        affectedAssetId: parsed.data.affectedAssetId ?? match.assetId,
        severity: parsed.data.severity ?? severityMap[cve.cvssSeverity ?? "medium"] ?? "medium",
        status: "open",
        createdBy: ctx.userId,
      })
      .returning();

    // Link match to vulnerability
    await tx
      .update(cveAssetMatch)
      .set({
        linkedVulnerabilityId: vuln.id,
        status: "acknowledged",
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(cveAssetMatch.id, id));

    return vuln;
  });

  return Response.json({ data: result }, { status: 201 });
}
