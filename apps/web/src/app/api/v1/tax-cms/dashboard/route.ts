import { db, taxCmsElement, taxRisk, taxGobdArchive, taxIcfrControl, taxAuditPrep } from "@grc/db";
import { eq, and, sql, isNull, ne } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const [totalElements, implemented, totalRisks, critical, gobdCompliant, totalDocs, keyEffective, totalKey, activeAudits, exposure] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(taxCmsElement).where(eq(taxCmsElement.orgId, ctx.orgId)),
    db.select({ count: sql<number>`count(*)` }).from(taxCmsElement).where(and(eq(taxCmsElement.orgId, ctx.orgId), eq(taxCmsElement.status, "implemented"))),
    db.select({ count: sql<number>`count(*)` }).from(taxRisk).where(and(eq(taxRisk.orgId, ctx.orgId), isNull(taxRisk.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(taxRisk).where(and(eq(taxRisk.orgId, ctx.orgId), eq(taxRisk.riskLevel, "critical"), isNull(taxRisk.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(taxGobdArchive).where(and(eq(taxGobdArchive.orgId, ctx.orgId), eq(taxGobdArchive.gobdCompliant, true))),
    db.select({ count: sql<number>`count(*)` }).from(taxGobdArchive).where(eq(taxGobdArchive.orgId, ctx.orgId)),
    db.select({ count: sql<number>`count(*)` }).from(taxIcfrControl).where(and(eq(taxIcfrControl.orgId, ctx.orgId), eq(taxIcfrControl.keyControl, true), eq(taxIcfrControl.lastTestResult, "effective"))),
    db.select({ count: sql<number>`count(*)` }).from(taxIcfrControl).where(and(eq(taxIcfrControl.orgId, ctx.orgId), eq(taxIcfrControl.keyControl, true))),
    db.select({ count: sql<number>`count(*)` }).from(taxAuditPrep).where(and(eq(taxAuditPrep.orgId, ctx.orgId), ne(taxAuditPrep.status, "completed"))),
    db.select({ sum: sql<number>`COALESCE(sum(financial_exposure), 0)` }).from(taxRisk).where(and(eq(taxRisk.orgId, ctx.orgId), isNull(taxRisk.deletedAt))),
  ]);

  const avgMaturity = await db.select({ avg: sql<number>`COALESCE(avg(maturity_level), 0)` }).from(taxCmsElement).where(eq(taxCmsElement.orgId, ctx.orgId));

  return Response.json({
    data: {
      totalElements: Number(totalElements[0]?.count ?? 0),
      implementedElements: Number(implemented[0]?.count ?? 0),
      averageMaturity: Number(avgMaturity[0]?.avg ?? 0),
      totalTaxRisks: Number(totalRisks[0]?.count ?? 0),
      criticalRisks: Number(critical[0]?.count ?? 0),
      gobdCompliantDocs: Number(gobdCompliant[0]?.count ?? 0),
      totalArchiveDocs: Number(totalDocs[0]?.count ?? 0),
      keyControlsEffective: Number(keyEffective[0]?.count ?? 0),
      totalKeyControls: Number(totalKey[0]?.count ?? 0),
      activeAudits: Number(activeAudits[0]?.count ?? 0),
      totalExposure: Number(exposure[0]?.sum ?? 0),
    },
  });
}
