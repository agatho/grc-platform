import { db, consentRecord, consentType } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { hashDataSubjectIdentifier } from "@grc/shared";

// GET /api/v1/dpms/consent-records/search?identifier=... — Pseudonymized search
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const identifier = url.searchParams.get("identifier");
  if (!identifier) {
    return Response.json(
      { error: "identifier query parameter is required" },
      { status: 422 },
    );
  }

  // Hash identifier with org salt to search — NEVER log plain identifier
  const orgSalt = ctx.orgId;
  const hashedId = hashDataSubjectIdentifier(identifier, orgSalt);

  const records = await db
    .select({
      id: consentRecord.id,
      consentTypeId: consentRecord.consentTypeId,
      consentGivenAt: consentRecord.consentGivenAt,
      consentMechanism: consentRecord.consentMechanism,
      consentTextVersion: consentRecord.consentTextVersion,
      withdrawnAt: consentRecord.withdrawnAt,
      withdrawalMechanism: consentRecord.withdrawalMechanism,
      sourceSystem: consentRecord.sourceSystem,
    })
    .from(consentRecord)
    .where(
      and(
        eq(consentRecord.orgId, ctx.orgId),
        eq(consentRecord.dataSubjectIdentifier, hashedId),
      ),
    )
    .orderBy(desc(consentRecord.consentGivenAt));

  return Response.json({ data: records, count: records.length });
}
