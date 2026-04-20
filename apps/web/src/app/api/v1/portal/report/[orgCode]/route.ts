// POST /api/v1/portal/report/:orgCode — Submit whistleblower report (public, no auth)
// GET  /api/v1/portal/report/:orgCode — Load org info for report form

import {
  db,
  organization,
  wbReport,
  wbCase,
  wbAnonymousMailbox,
} from "@grc/db";
import { submitReportSchema } from "@grc/shared";
import { encrypt, hashIp, generateMailboxToken } from "@grc/shared";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ orgCode: string }>;
}

// GET — Org info for report form
export async function GET(_req: Request, { params }: RouteParams) {
  const { orgCode } = await params;

  const org = await db.query.organization.findFirst({
    where: eq(organization.orgCode, orgCode),
  });

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      orgId: org.id,
      orgName: org.name,
      orgCode: org.orgCode,
      categories: [
        "fraud",
        "corruption",
        "discrimination",
        "privacy",
        "environmental",
        "health_safety",
        "other",
      ],
    },
  });
}

// POST — Submit report
export async function POST(req: Request, { params }: RouteParams) {
  const { orgCode } = await params;

  const org = await db.query.organization.findFirst({
    where: eq(organization.orgCode, orgCode),
  });

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = submitReportSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const now = new Date();
  const tokenExpires = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // ~6 months
  const acknowledgeDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const responseDeadline = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // ~3 months

  // Generate tokens
  const reportToken = generateMailboxToken();
  const mailboxToken = generateMailboxToken();

  // Encrypt sensitive fields
  const encryptedDescription = encrypt(body.data.description);
  const encryptedEmail = body.data.contactEmail
    ? encrypt(body.data.contactEmail)
    : null;

  // Hash IP for duplicate detection
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipHashed = hashIp(ip);

  // Generate case number: WB-YYYY-NNN
  const year = now.getFullYear();
  const countResult = await db.execute(
    sql`SELECT COUNT(*) as cnt FROM wb_case WHERE org_id = ${org.id} AND EXTRACT(YEAR FROM created_at) = ${year}`,
  );
  const count = Number((countResult as any)[0]?.cnt ?? 0) + 1;
  const caseNumber = `WB-${year}-${String(count).padStart(3, "0")}`;

  // Create report, case, and mailbox in transaction
  const result = await db.transaction(async (tx) => {
    const [report] = await tx
      .insert(wbReport)
      .values({
        orgId: org.id,
        reportToken,
        tokenExpiresAt: tokenExpires,
        category: body.data.category,
        description: encryptedDescription,
        contactEmail: encryptedEmail,
        language: body.data.language,
        ipHash: ipHashed,
        submittedAt: now,
        createdAt: now,
      })
      .returning();

    const [wbCaseRow] = await tx
      .insert(wbCase)
      .values({
        orgId: org.id,
        reportId: report!.id,
        caseNumber,
        status: "received",
        priority: "medium",
        acknowledgeDeadline,
        responseDeadline,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(wbAnonymousMailbox).values({
      reportId: report!.id,
      token: mailboxToken,
      expiresAt: tokenExpires,
    });

    return { reportId: report!.id, caseId: wbCaseRow!.id, caseNumber };
  });

  return Response.json(
    {
      data: {
        mailboxToken,
        caseNumber: result.caseNumber,
        tokenExpiresAt: tokenExpires.toISOString(),
      },
    },
    { status: 201 },
  );
}
