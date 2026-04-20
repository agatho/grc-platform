import { db, consentRecord } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { recordConsentSchema, hashDataSubjectIdentifier } from "@grc/shared";

// POST /api/v1/dpms/consent-records — Record individual consent (pseudonymized)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = recordConsentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Hash data subject identifier with org-specific salt
  const orgSalt = ctx.orgId; // In production, use a dedicated org salt from settings
  const hashedIdentifier = hashDataSubjectIdentifier(
    body.data.dataSubjectIdentifier,
    orgSalt,
  );

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx
      .insert(consentRecord)
      .values({
        orgId: ctx.orgId,
        consentTypeId: body.data.consentTypeId,
        dataSubjectIdentifier: hashedIdentifier,
        consentGivenAt: new Date(),
        consentMechanism: body.data.consentMechanism,
        consentTextVersion: body.data.consentTextVersion,
        sourceSystem: body.data.sourceSystem,
        metadata: body.data.metadata ?? {},
      })
      .returning();
    return item;
  });

  return Response.json(
    { data: { id: created.id, consentGivenAt: created.consentGivenAt } },
    { status: 201 },
  );
}
